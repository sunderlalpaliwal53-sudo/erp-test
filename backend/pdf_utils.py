"""Server-side PDF generation for receipts and reports using reportlab."""
from io import BytesIO
from datetime import datetime
from typing import List, Dict, Any
from reportlab.lib.pagesizes import A4, A5, landscape
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, PageBreak,
    KeepInFrame,
)
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT


def _num_to_words_inr(n: float) -> str:
    """Convert number to Indian rupee words (basic)."""
    n = int(round(n))
    if n == 0:
        return 'Zero Rupees Only'
    ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
            'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
            'Seventeen', 'Eighteen', 'Nineteen']
    tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

    def two_digit(x):
        if x < 20:
            return ones[x]
        return tens[x // 10] + (' ' + ones[x % 10] if x % 10 else '')

    def three_digit(x):
        s = ''
        if x >= 100:
            s += ones[x // 100] + ' Hundred'
            x %= 100
            if x:
                s += ' '
        if x:
            s += two_digit(x)
        return s

    parts = []
    crore = n // 10000000
    n %= 10000000
    lakh = n // 100000
    n %= 100000
    thousand = n // 1000
    n %= 1000
    if crore:
        parts.append(three_digit(crore) + ' Crore')
    if lakh:
        parts.append(three_digit(lakh) + ' Lakh')
    if thousand:
        parts.append(three_digit(thousand) + ' Thousand')
    if n:
        parts.append(three_digit(n))
    return ' '.join(parts) + ' Rupees Only'


def _build_receipt_flowables(payment: Dict[str, Any], school: Dict[str, Any],
                             student: Dict[str, Any], copy_label: str,
                             styles) -> list:
    """Build the flowables for ONE receipt copy (Office or Parent).

    Designed to fit inside an A5-portrait sized column (roughly 138mm wide).
    """
    story = []

    # Copy label banner (Office / Parent)
    copy_style = ParagraphStyle('cp', parent=styles['Normal'], fontSize=7.5,
                                textColor=colors.white, alignment=TA_CENTER,
                                leading=9)
    banner = Table([[Paragraph(f"<b>{copy_label}</b>", copy_style)]],
                   colWidths=[130 * mm])
    banner.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#0B2F4A')),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(banner)
    story.append(Spacer(1, 3))

    # School header
    header_style = ParagraphStyle('h', parent=styles['Title'], fontSize=13,
                                  textColor=colors.HexColor('#0B2F4A'),
                                  alignment=TA_CENTER, leading=15, spaceAfter=0)
    sub_style = ParagraphStyle('s', parent=styles['Normal'], fontSize=7.5,
                               textColor=colors.HexColor('#475569'),
                               alignment=TA_CENTER, leading=9, spaceAfter=2)
    story.append(Paragraph(school.get('name', 'STANVARD SCHOOL').upper(), header_style))
    tag_parts = []
    if school.get('city'):
        tag_parts.append(school['city'])
    if school.get('phone'):
        tag_parts.append(f"Ph: {school['phone']}")
    tag = ' · '.join(tag_parts)
    if tag:
        story.append(Paragraph(tag, sub_style))
    story.append(HRFlowable(width='100%', thickness=0.8,
                            color=colors.HexColor('#0B2F4A'),
                            spaceBefore=2, spaceAfter=4))

    title_style = ParagraphStyle('t', parent=styles['Heading2'], fontSize=9.5,
                                 textColor=colors.HexColor('#1E40AF'),
                                 alignment=TA_CENTER, leading=11, spaceAfter=4)
    story.append(Paragraph('FEE PAYMENT RECEIPT', title_style))

    # Meta table (Receipt No, Date, Mode, Txn)
    paid_at = payment.get('paid_at', '')
    if paid_at:
        try:
            paid_at_display = datetime.fromisoformat(paid_at.replace('Z', '+00:00')).strftime('%d %b %Y, %H:%M')
        except Exception:
            paid_at_display = paid_at
    else:
        paid_at_display = ''
    meta = [
        ['Receipt No:', payment.get('receipt_number', ''),
         'Date:', paid_at_display],
        ['Mode:', str(payment.get('payment_mode', '')).replace('_', ' ').title(),
         'Ref:', payment.get('txn_ref') or payment.get('razorpay_payment_id') or '-'],
    ]
    meta_tbl = Table(meta, colWidths=[18 * mm, 42 * mm, 14 * mm, 56 * mm])
    meta_tbl.setStyle(TableStyle([
        ('FONT', (0, 0), (-1, -1), 'Helvetica', 7.5),
        ('FONT', (0, 0), (0, -1), 'Helvetica-Bold', 7.5),
        ('FONT', (2, 0), (2, -1), 'Helvetica-Bold', 7.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('TOPPADDING', (0, 0), (-1, -1), 1),
    ]))
    story.append(meta_tbl)

    # Small "EDITED" / "VOIDED" chip in the meta area (when applicable)
    status_style = ParagraphStyle('st', parent=styles['Normal'], fontSize=7,
                                  leading=8, alignment=TA_LEFT)
    if payment.get('status') == 'voided':
        vt = payment.get('voided_at', '') or ''
        try:
            vt = datetime.fromisoformat(vt.replace('Z', '+00:00')).strftime('%d %b %Y, %H:%M')
        except Exception:
            pass
        vr = (payment.get('void_reason') or '').strip()
        chip = Table([[Paragraph(
            f'<font color="#B42318"><b>VOIDED</b></font> · {vt}'
            + (f' · <i>{vr}</i>' if vr else ''),
            status_style,
        )]], colWidths=[130 * mm])
        chip.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#FEE4E2')),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#FECACA')),
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ]))
        story.append(Spacer(1, 2))
        story.append(chip)
    elif payment.get('edited_at'):
        et = payment.get('edited_at', '')
        try:
            et = datetime.fromisoformat(et.replace('Z', '+00:00')).strftime('%d %b %Y, %H:%M')
        except Exception:
            pass
        er = (payment.get('edited_reason') or '').strip()
        chip = Table([[Paragraph(
            f'<font color="#B45309"><b>REVISED</b></font> · {et}'
            + (f' · <i>{er}</i>' if er else ''),
            status_style,
        )]], colWidths=[130 * mm])
        chip.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#FEF3C7')),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#FDE68A')),
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ]))
        story.append(Spacer(1, 2))
        story.append(chip)

    story.append(Spacer(1, 4))

    # Student details
    student_rows = [
        ['Student:', student.get('full_name', '') or '',
         'Adm No:', student.get('admission_number', '') or ''],
        ['Class:', f"{(student.get('class_name') or '')} - {(student.get('section') or '')}".strip(' -'),
         'Roll:', student.get('roll_number') or '-'],
        ['Father:', student.get('father_name') or '-',
         'Contact:', student.get('phone') or '-'],
    ]
    stu_tbl = Table(student_rows, colWidths=[18 * mm, 42 * mm, 16 * mm, 54 * mm])
    stu_tbl.setStyle(TableStyle([
        ('FONT', (0, 0), (-1, -1), 'Helvetica', 7.5),
        ('FONT', (0, 0), (0, -1), 'Helvetica-Bold', 7.5),
        ('FONT', (2, 0), (2, -1), 'Helvetica-Bold', 7.5),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F1F5F9')),
        ('BOX', (0, 0), (-1, -1), 0.4, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.2, colors.HexColor('#E2E8F0')),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(stu_tbl)
    story.append(Spacer(1, 5))

    # Fee items
    fee_rows = [['#', 'Fee Head', 'Period', 'Amount (Rs.)']]
    for i, it in enumerate(payment.get('items', []), start=1):
        fee_rows.append([str(i), it.get('fee_head_name', ''),
                         it.get('period', '') or '-',
                         f"{it.get('amount', 0):,.2f}"])
    subtotal = payment.get('subtotal', 0.0)
    discount = payment.get('discount', 0.0)
    late_fee = payment.get('late_fee', 0.0)
    total = payment.get('total_paid', 0.0)
    fee_rows.append(['', '', 'Sub-Total', f"{subtotal:,.2f}"])
    if late_fee:
        fee_rows.append(['', '', 'Late Fee', f"{late_fee:,.2f}"])
    if discount:
        fee_rows.append(['', '', 'Discount', f"-{discount:,.2f}"])
    fee_rows.append(['', '', 'TOTAL PAID', f"{total:,.2f}"])

    fee_tbl = Table(fee_rows, colWidths=[7 * mm, 55 * mm, 30 * mm, 38 * mm])
    fee_tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0B2F4A')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONT', (0, 0), (-1, 0), 'Helvetica-Bold', 7.5),
        ('FONT', (0, 1), (-1, -1), 'Helvetica', 7.5),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('ALIGN', (3, 0), (3, -1), 'RIGHT'),
        ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
        ('BOX', (0, 0), (-1, -1), 0.4, colors.HexColor('#94A3B8')),
        ('INNERGRID', (0, 0), (-1, -1), 0.15, colors.HexColor('#E2E8F0')),
        ('FONT', (2, -1), (-1, -1), 'Helvetica-Bold', 8),
        ('BACKGROUND', (2, -1), (-1, -1), colors.HexColor('#DBEAFE')),
        ('TOPPADDING', (0, 0), (-1, -1), 2.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 3),
        ('RIGHTPADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(fee_tbl)
    story.append(Spacer(1, 5))

    story.append(Paragraph(
        f"<b>In Words:</b> {_num_to_words_inr(total)}",
        ParagraphStyle('aw', parent=styles['Normal'], fontSize=7.5, leading=9,
                       textColor=colors.HexColor('#0F172A'))
    ))
    if payment.get('remarks'):
        story.append(Spacer(1, 2))
        story.append(Paragraph(
            f"<b>Remarks:</b> {payment['remarks']}",
            ParagraphStyle('rm', parent=styles['Normal'], fontSize=7, leading=9,
                           textColor=colors.HexColor('#475569'))))

    story.append(Spacer(1, 8))
    story.append(HRFlowable(width='100%', thickness=0.3,
                            color=colors.HexColor('#CBD5E1'), spaceAfter=3))
    footer = Table([
        ['Computer-generated receipt.', 'Authorised Signatory']
    ], colWidths=[70 * mm, 60 * mm])
    footer.setStyle(TableStyle([
        ('FONT', (0, 0), (-1, -1), 'Helvetica-Oblique', 6.5),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#64748B')),
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
    ]))
    story.append(footer)

    return story


def generate_receipt_pdf(payment: Dict[str, Any], school: Dict[str, Any],
                         student: Dict[str, Any]) -> bytes:
    """Generate an A4-landscape PDF containing two side-by-side A5-sized copies
    of the fee receipt: the LEFT half is the OFFICE COPY, the RIGHT half is the
    PARENT COPY, with a dashed cut line between them.

    The page is 297mm wide x 210mm tall (A4 landscape). Each half is roughly
    A5-portrait sized (148mm x 210mm), which is the standard tear-off fee
    receipt format used in Indian schools.
    """
    buffer = BytesIO()
    page_size = landscape(A4)  # (297mm, 210mm) in points

    doc = SimpleDocTemplate(
        buffer, pagesize=page_size,
        leftMargin=6 * mm, rightMargin=6 * mm,
        topMargin=6 * mm, bottomMargin=6 * mm,
        title=f"Fee Receipt - {payment.get('receipt_number', '')}"
    )
    styles = getSampleStyleSheet()

    is_voided = payment.get('status') == 'voided'

    def _draw_watermark(canvas, _doc):
        if not is_voided:
            return
        page_w, page_h = page_size
        canvas.saveState()
        canvas.setFont('Helvetica-Bold', 110)
        canvas.setFillColor(colors.HexColor('#FCA5A5'))
        # Semi-transparent big diagonal watermark on each half
        try:
            canvas.setFillAlpha(0.30)
        except Exception:
            pass
        # Left half
        canvas.translate(page_w * 0.25, page_h * 0.5)
        canvas.rotate(30)
        canvas.drawCentredString(0, 0, 'VOIDED')
        canvas.restoreState()
        # Right half
        canvas.saveState()
        try:
            canvas.setFillAlpha(0.30)
        except Exception:
            pass
        canvas.setFillColor(colors.HexColor('#FCA5A5'))
        canvas.setFont('Helvetica-Bold', 110)
        canvas.translate(page_w * 0.75, page_h * 0.5)
        canvas.rotate(30)
        canvas.drawCentredString(0, 0, 'VOIDED')
        canvas.restoreState()

    # Build the two copies as separate flowable lists
    office_copy = _build_receipt_flowables(payment, school, student,
                                            'OFFICE COPY', styles)
    parent_copy = _build_receipt_flowables(payment, school, student,
                                            'PARENT COPY', styles)

    # Use KeepInFrame so any overflow shrinks gracefully within its cell.
    left_cell = KeepInFrame(132 * mm, 190 * mm, office_copy, mode='shrink')
    right_cell = KeepInFrame(132 * mm, 190 * mm, parent_copy, mode='shrink')

    # Outer 2-column table with a dashed vertical cut-line between the halves.
    outer = Table(
        [[left_cell, right_cell]],
        colWidths=[140 * mm, 140 * mm],
        rowHeights=[192 * mm],
    )
    outer.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 3),
        ('RIGHTPADDING', (0, 0), (-1, -1), 3),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        # Dashed vertical cut-line between the two copies
        ('LINEAFTER', (0, 0), (0, 0), 0.6, colors.HexColor('#94A3B8'),
         None, [2, 2]),
    ]))

    doc.build([outer], onFirstPage=_draw_watermark, onLaterPages=_draw_watermark)
    buffer.seek(0)
    return buffer.getvalue()


def generate_report_pdf(title: str, subtitle: str, columns: List[str],
                       rows: List[List[Any]], school_name: str = 'Stanvard School',
                       summary: Dict[str, Any] = None) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=landscape(A4),
        leftMargin=15 * mm, rightMargin=15 * mm,
        topMargin=15 * mm, bottomMargin=15 * mm,
        title=title
    )
    styles = getSampleStyleSheet()
    story = []
    story.append(Paragraph(school_name.upper(),
                           ParagraphStyle('h', parent=styles['Title'], fontSize=16,
                                          textColor=colors.HexColor('#0B2F4A'),
                                          alignment=TA_CENTER)))
    story.append(Paragraph(title,
                           ParagraphStyle('t', parent=styles['Heading2'], fontSize=12,
                                          textColor=colors.HexColor('#1E40AF'),
                                          alignment=TA_CENTER)))
    if subtitle:
        story.append(Paragraph(subtitle,
                               ParagraphStyle('sub', parent=styles['Normal'], fontSize=9,
                                              textColor=colors.HexColor('#64748B'),
                                              alignment=TA_CENTER)))
    story.append(Spacer(1, 10))

    data = [columns] + rows
    n_cols = len(columns)
    col_widths = [270 * mm / n_cols] * n_cols
    tbl = Table(data, colWidths=col_widths, repeatRows=1)
    tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0B2F4A')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONT', (0, 0), (-1, 0), 'Helvetica-Bold', 9),
        ('FONT', (0, 1), (-1, -1), 'Helvetica', 8),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#94A3B8')),
        ('INNERGRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1),
         [colors.white, colors.HexColor('#F8FAFC')]),
    ]))
    story.append(tbl)
    if summary:
        story.append(Spacer(1, 10))
        summ_lines = ' &nbsp;&nbsp;·&nbsp;&nbsp; '.join(
            [f"<b>{k}:</b> {v}" for k, v in summary.items()]
        )
        story.append(Paragraph(summ_lines,
                               ParagraphStyle('sm', parent=styles['Normal'], fontSize=10,
                                              textColor=colors.HexColor('#0F172A'))))
    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()
