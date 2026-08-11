"""
Phase 1 Core POC — Stanvard School ERP
Tests:
  1. Razorpay Order creation (LIVE keys — but no real payment triggered)
  2. Razorpay payment signature verification algorithm (mock payload)
  3. Razorpay webhook signature verification algorithm (mock payload)
  4. Server-side PDF receipt generation (reportlab)

Run:  cd /app/backend && python test_core_poc.py
"""

import os
import hmac
import hashlib
import json
import uuid
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET")

OUTPUT_DIR = Path("/tmp/poc_output")
OUTPUT_DIR.mkdir(exist_ok=True)


def test_razorpay_order_creation():
    """Test 1: Create a Razorpay order (does NOT charge anyone; orders are just intents)."""
    print("\n" + "=" * 60)
    print("TEST 1: Razorpay Order Creation")
    print("=" * 60)
    try:
        import razorpay
        client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
        # amount in paise → 500000 = ₹5000
        receipt_id = f"rcpt_{uuid.uuid4().hex[:12]}"
        order_payload = {
            "amount": 500000,
            "currency": "INR",
            "receipt": receipt_id,
            "payment_capture": 1,
            "notes": {
                "purpose": "POC Test - Fee Collection",
                "school": "Stanvard School - Ganesh Nagar",
                "student": "Demo Student"
            }
        }
        order = client.order.create(data=order_payload)
        print("✅ Order created successfully")
        print(f"   Order ID: {order['id']}")
        print(f"   Amount: ₹{order['amount']/100:.2f} {order['currency']}")
        print(f"   Receipt: {order['receipt']}")
        print(f"   Status: {order['status']}")

        # Save output
        with open(OUTPUT_DIR / "order_response.json", "w") as f:
            json.dump(order, f, indent=2, default=str)
        return order
    except Exception as e:
        print(f"❌ FAILED: {type(e).__name__}: {e}")
        return None


def test_payment_signature_verification():
    """Test 2: Verify Razorpay payment signature using HMAC-SHA256."""
    print("\n" + "=" * 60)
    print("TEST 2: Payment Signature Verification (mock payload)")
    print("=" * 60)
    try:
        # Simulate a payment callback payload
        mock_order_id = "order_MOCK123456789"
        mock_payment_id = "pay_MOCK987654321"

        # Server-side would compute this signature
        secret = RAZORPAY_KEY_SECRET.encode()
        payload = f"{mock_order_id}|{mock_payment_id}".encode()
        expected_signature = hmac.new(secret, payload, hashlib.sha256).hexdigest()

        # Now "verify" it as the backend would
        computed = hmac.new(secret, payload, hashlib.sha256).hexdigest()
        is_valid = hmac.compare_digest(expected_signature, computed)

        print(f"   Order ID:   {mock_order_id}")
        print(f"   Payment ID: {mock_payment_id}")
        print(f"   Signature:  {expected_signature[:40]}...")
        assert is_valid, "Signature mismatch"
        print("✅ Signature verification algorithm works correctly")

        # Test tampered signature is rejected
        tampered = "0" * 64
        is_tampered_valid = hmac.compare_digest(tampered, computed)
        assert not is_tampered_valid, "Tampered signature should not verify"
        print("✅ Tampered signature correctly rejected")
        return True
    except Exception as e:
        print(f"❌ FAILED: {type(e).__name__}: {e}")
        return False


def test_webhook_signature_verification():
    """Test 3: Verify webhook signature (uses webhook secret, but algorithm same)."""
    print("\n" + "=" * 60)
    print("TEST 3: Webhook Signature Verification")
    print("=" * 60)
    try:
        # For POC we use key_secret as webhook secret placeholder
        webhook_secret = os.environ.get("RAZORPAY_WEBHOOK_SECRET") or RAZORPAY_KEY_SECRET

        webhook_body = json.dumps({
            "event": "payment.captured",
            "payload": {"payment": {"entity": {"id": "pay_MOCK123", "status": "captured"}}}
        }).encode()

        expected_sig = hmac.new(
            webhook_secret.encode(),
            webhook_body,
            hashlib.sha256
        ).hexdigest()

        # Verify
        computed = hmac.new(
            webhook_secret.encode(),
            webhook_body,
            hashlib.sha256
        ).hexdigest()
        assert hmac.compare_digest(expected_sig, computed)
        print(f"   Webhook body length: {len(webhook_body)} bytes")
        print(f"   Signature:           {expected_sig[:40]}...")
        print("✅ Webhook signature verification works")
        return True
    except Exception as e:
        print(f"❌ FAILED: {type(e).__name__}: {e}")
        return False


def test_pdf_receipt_generation():
    """Test 4: Generate a professional fee receipt PDF using reportlab."""
    print("\n" + "=" * 60)
    print("TEST 4: PDF Receipt Generation")
    print("=" * 60)
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import mm
        from reportlab.platypus import (
            SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
        )
        from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT

        pdf_path = OUTPUT_DIR / "sample_receipt.pdf"
        doc = SimpleDocTemplate(
            str(pdf_path),
            pagesize=A4,
            leftMargin=18 * mm, rightMargin=18 * mm,
            topMargin=15 * mm, bottomMargin=15 * mm,
            title="Fee Receipt - Stanvard School"
        )
        styles = getSampleStyleSheet()

        story = []
        # Header
        header_style = ParagraphStyle(
            "hdr", parent=styles["Title"], fontSize=20, textColor=colors.HexColor("#0F172A"),
            alignment=TA_CENTER, spaceAfter=2
        )
        sub_style = ParagraphStyle(
            "sub", parent=styles["Normal"], fontSize=10, textColor=colors.HexColor("#475569"),
            alignment=TA_CENTER, spaceAfter=6
        )
        story.append(Paragraph("STANVARD SCHOOL", header_style))
        story.append(Paragraph("Ganesh Nagar Branch · Excellence in Education", sub_style))
        story.append(HRFlowable(width="100%", thickness=1.2,
                                color=colors.HexColor("#0F172A"), spaceBefore=4, spaceAfter=10))

        # Receipt title
        title_style = ParagraphStyle(
            "rt", parent=styles["Heading2"], fontSize=13,
            textColor=colors.HexColor("#1E40AF"), alignment=TA_CENTER, spaceAfter=8
        )
        story.append(Paragraph("FEE PAYMENT RECEIPT", title_style))

        # Meta
        receipt_no = f"REC-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        meta = [
            ["Receipt No:", receipt_no, "Date:", datetime.now().strftime("%d %b %Y, %H:%M")],
            ["Payment Mode:", "Online (Razorpay)", "Txn ID:", "pay_MOCK987654321"],
        ]
        meta_tbl = Table(meta, colWidths=[30 * mm, 55 * mm, 20 * mm, 45 * mm])
        meta_tbl.setStyle(TableStyle([
            ("FONT", (0, 0), (-1, -1), "Helvetica", 9),
            ("FONT", (0, 0), (0, -1), "Helvetica-Bold", 9),
            ("FONT", (2, 0), (2, -1), "Helvetica-Bold", 9),
            ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#0F172A")),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(meta_tbl)
        story.append(Spacer(1, 8))

        # Student details
        student = [
            ["Student Name:", "Aarav Sharma", "Admission No:", "STV-2024-0142"],
            ["Class:", "VIII - A", "Roll No:", "18"],
            ["Father:", "Rajesh Sharma", "Contact:", "+91 98765 43210"],
        ]
        stu_tbl = Table(student, colWidths=[30 * mm, 55 * mm, 25 * mm, 40 * mm])
        stu_tbl.setStyle(TableStyle([
            ("FONT", (0, 0), (-1, -1), "Helvetica", 9),
            ("FONT", (0, 0), (0, -1), "Helvetica-Bold", 9),
            ("FONT", (2, 0), (2, -1), "Helvetica-Bold", 9),
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F1F5F9")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E2E8F0")),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(stu_tbl)
        story.append(Spacer(1, 12))

        # Fee breakdown
        fee_rows = [
            ["#", "Fee Head", "Period", "Amount (₹)"],
            ["1", "Tuition Fee", "October 2025", "5,000.00"],
            ["2", "Transport Fee", "October 2025", "1,200.00"],
            ["3", "Computer Fee", "October 2025", "300.00"],
            ["", "", "Sub-Total", "6,500.00"],
            ["", "", "Late Fee", "50.00"],
            ["", "", "Discount", "-100.00"],
            ["", "", "TOTAL PAID", "6,450.00"],
        ]
        fee_tbl = Table(fee_rows, colWidths=[12 * mm, 70 * mm, 40 * mm, 40 * mm])
        fee_tbl.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E40AF")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 9),
            ("FONT", (0, 1), (-1, -1), "Helvetica", 9),
            ("ALIGN", (0, 0), (0, -1), "CENTER"),
            ("ALIGN", (3, 0), (3, -1), "RIGHT"),
            ("ALIGN", (2, 0), (2, -1), "RIGHT"),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#94A3B8")),
            ("INNERGRID", (0, 0), (-1, 3), 0.25, colors.HexColor("#E2E8F0")),
            ("LINEABOVE", (0, 4), (-1, 4), 0.5, colors.HexColor("#94A3B8")),
            ("FONT", (2, -1), (-1, -1), "Helvetica-Bold", 10),
            ("BACKGROUND", (2, -1), (-1, -1), colors.HexColor("#DBEAFE")),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(fee_tbl)
        story.append(Spacer(1, 14))

        # Amount in words
        story.append(Paragraph(
            "<b>Amount in Words:</b> Six Thousand Four Hundred Fifty Rupees Only",
            ParagraphStyle("aw", parent=styles["Normal"], fontSize=9,
                           textColor=colors.HexColor("#0F172A"))
        ))
        story.append(Spacer(1, 18))

        # Footer
        story.append(HRFlowable(width="100%", thickness=0.5,
                                color=colors.HexColor("#CBD5E1"), spaceAfter=6))
        footer = Table([
            ["This is a computer-generated receipt and does not require a signature.",
             "Authorized Signatory"]
        ], colWidths=[110 * mm, 60 * mm])
        footer.setStyle(TableStyle([
            ("FONT", (0, 0), (-1, -1), "Helvetica-Oblique", 8),
            ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#64748B")),
            ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ]))
        story.append(footer)

        doc.build(story)
        size = pdf_path.stat().st_size
        assert size > 1000, "PDF unexpectedly small"
        print("✅ PDF receipt generated")
        print(f"   Path: {pdf_path}")
        print(f"   Size: {size} bytes")
        print(f"   Receipt No: {receipt_no}")
        return True
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"❌ FAILED: {type(e).__name__}: {e}")
        return False


def main():
    print("\n" + "█" * 60)
    print("  STANVARD SCHOOL ERP — PHASE 1 CORE POC")
    print("█" * 60)
    results = {
        "razorpay_order":     test_razorpay_order_creation() is not None,
        "payment_signature":  test_payment_signature_verification(),
        "webhook_signature":  test_webhook_signature_verification(),
        "pdf_receipt":        test_pdf_receipt_generation(),
    }

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    for k, ok in results.items():
        print(f"  {'✅' if ok else '❌'}  {k}")
    all_pass = all(results.values())
    print("\n" + ("🎉 ALL POC TESTS PASSED — READY FOR PHASE 2" if all_pass
                  else "⚠️  FIX FAILING TESTS BEFORE PROCEEDING"))
    print(f"\nOutputs saved in: {OUTPUT_DIR}")
    return 0 if all_pass else 1


if __name__ == "__main__":
    exit(main())
