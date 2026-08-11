"""Real-data seed for The Stanvard Sec. School (Kanpur, Girwa, Udaipur).

- Wipes all demo data across the 3 branches (Ganesh Nagar, Kanpur, Ayar) but
  keeps the school shells (renaming Kanpur to the real school).
- Imports 375 students from the FY 2026-27 tuition-fee Excel into the Kanpur branch.
- Creates production accounts:
    Super Admin:  superadmin@stanvard.school / Stanvard@2026
    Accountant:   accountant@stanvard.school / Accountant@2026
    Parents:      one per unique mobile in the sheet.
                  Username = mobile number  |  Password = last 6 digits of mobile.
                  Multiple children with the same mobile share ONE parent account.

Run:  cd /app/backend && python real_seed.py
"""
import asyncio
from datetime import datetime, timedelta, timezone
from pathlib import Path

import xlrd  # type: ignore

from database import (
    schools_col, users_col, students_col, classes_col,
    fee_heads_col, fee_plans_col, fee_assignments_col,
    payments_col, attendance_col, homework_col, timetable_col,
    events_col, circulars_col, gallery_col, staff_col,
    notifications_col, audit_col, settings_col, counters_col,
)
from models import (
    School, User, Student, ClassRoom, FeeHead, FeePlan, FeePlanItem,
    FeeAssignment, FeeAssignmentItem, Payment, PaymentLineItem, now_iso,
)
from auth import hash_password


DATA_FILE = Path(__file__).parent / 'data' / 'stanvard_2026_27.xls'

# --- Branch configuration --------------------------------------------------
# The Kanpur (Girwa) branch is the real school. Keep the other 2 branches as
# empty shells so they can be commissioned later without schema changes.
BRANCH_CONFIG = [
    {
        'code': 'KNP',
        'name': 'The Stanvard Sec. School',
        'city': 'Kanpur (Girwa), Udaipur',
        'address': 'Kanpur (Girwa), Udaipur, Rajasthan',
        'phone': '0294-2493312',
        'email': 'info@stanvard.school',
        'principal_name': 'Principal',
        'is_primary': True,
    },
    {
        'code': 'GN',
        'name': 'Stanvard School - Ganesh Nagar',
        'city': 'Ganesh Nagar',
        'address': 'Ganesh Nagar (to be commissioned)',
        'phone': '',
        'email': '',
        'principal_name': '',
        'is_primary': False,
    },
    {
        'code': 'AYR',
        'name': 'Stanvard School - Ayar',
        'city': 'Ayar',
        'address': 'Ayar (to be commissioned)',
        'phone': '',
        'email': '',
        'principal_name': '',
        'is_primary': False,
    },
]

# --- Class configuration ---------------------------------------------------
# Excel labels → normalised class names. Class labels appear in this order.
CLASS_ORDER = ['L.K.G', 'UKG', 'PREP', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']
CLASS_DISPLAY = {
    'L.K.G': 'LKG', 'UKG': 'UKG', 'PREP': 'PREP',
    'I': 'Class I', 'II': 'Class II', 'III': 'Class III', 'IV': 'Class IV',
    'V': 'Class V', 'VI': 'Class VI', 'VII': 'Class VII', 'VIII': 'Class VIII',
    'IX': 'Class IX', 'X': 'Class X',
}


# ---------------------------------------------------------------------------
# Excel parsing
# ---------------------------------------------------------------------------
def parse_students():
    """Parse the FY 2026-27 tuition-fee Excel and return a list of student dicts."""
    book = xlrd.open_workbook(str(DATA_FILE))
    sh = book.sheet_by_index(0)
    rows_out = []
    current_class = None
    for r in range(sh.nrows):
        row = [sh.cell_value(r, c) for c in range(sh.ncols)]
        first = str(row[0]).strip() if row[0] else ''
        name = str(row[4]).strip() if row[4] else ''
        # A class-heading row has a class label in col 0 and no student name.
        if first in CLASS_ORDER and not name:
            current_class = first
            continue
        # Student row: numeric S.No + student name present.
        try:
            sno = int(float(row[0])) if row[0] not in ('', None) else None
        except (TypeError, ValueError):
            sno = None
        if sno is not None and name and current_class:
            mobile = str(row[7]).strip() if row[7] else ''
            # Keep only digits
            mobile_digits = ''.join(ch for ch in mobile if ch.isdigit())
            actual_fee = float(row[8] or 0)
            paid = float(row[10] or 0)
            concession = float(row[11] or 0)
            due = float(row[13] or 0)
            rows_out.append({
                'class_label': current_class,
                'sno': sno,
                'scholar_no': str(row[2]).strip(),
                'full_name': name.title(),
                'father_name': (str(row[5] or '').strip()).title(),
                'mobile': mobile_digits if len(mobile_digits) == 10 else '',
                'raw_mobile': mobile,
                'actual_fee': actual_fee,
                'paid': paid,
                'concession': concession,
                'due': due,
            })
    return rows_out


# ---------------------------------------------------------------------------
# Wipe
# ---------------------------------------------------------------------------
async def wipe_all():
    for c in [users_col, students_col, classes_col, fee_heads_col,
              fee_plans_col, fee_assignments_col, payments_col, attendance_col,
              homework_col, timetable_col, events_col, circulars_col, gallery_col,
              staff_col, notifications_col, audit_col, counters_col]:
        await c.delete_many({})
    # Keep settings but clear branch-specific ones
    await settings_col.delete_many({})
    # Reset schools (we recreate them below)
    await schools_col.delete_many({})
    print('  ✓ Wiped all collections')


# ---------------------------------------------------------------------------
# Seed
# ---------------------------------------------------------------------------
async def seed_schools():
    school_map = {}
    for i, cfg in enumerate(BRANCH_CONFIG):
        school = School(
            name=cfg['name'],
            code=cfg['code'],
            city=cfg['city'],
            address=cfg['address'],
            phone=cfg['phone'],
            email=cfg['email'],
            principal_name=cfg['principal_name'],
            academic_session='2026-27',
        )
        await schools_col.insert_one(school.model_dump())
        school_map[cfg['code']] = school.model_dump()
        print(f"  ✓ School #{i+1}: {cfg['name']} ({cfg['code']})")
    return school_map


async def seed_classes_for(school_doc):
    """Seed 13 classes with a single default section 'A' each."""
    class_map = {}
    for i, label in enumerate(CLASS_ORDER):
        display = CLASS_DISPLAY[label]
        c = ClassRoom(
            school_id=school_doc['id'],
            name=display,
            sections=['A'],
        )
        await classes_col.insert_one(c.model_dump())
        class_map[label] = c.model_dump()
    print(f"  ✓ Created {len(class_map)} classes for {school_doc['name']}")
    return class_map


async def seed_fee_plans(school_doc, class_map, students_by_class):
    """One fee plan per class based on the actual_fee value seen in that class."""
    fh = FeeHead(school_id=school_doc['id'], name='Tuition Fee', category='general')
    await fee_heads_col.insert_one(fh.model_dump())
    fee_plan_map = {}
    for class_label, students in students_by_class.items():
        if not students:
            continue
        klass = class_map[class_label]
        # Use the most-common actual_fee as the plan's tuition figure.
        fees = [s['actual_fee'] for s in students if s['actual_fee'] > 0]
        tuition = max(set(fees), key=fees.count) if fees else 0
        plan = FeePlan(
            school_id=school_doc['id'],
            name=f"{klass['name']} — FY 2026-27 Tuition Plan",
            class_id=klass['id'],
            academic_session='2026-27',
            items=[FeePlanItem(fee_head_id=fh.id, fee_head_name='Tuition Fee',
                               amount=tuition, frequency='yearly', installments=1)],
        )
        await fee_plans_col.insert_one(plan.model_dump())
        fee_plan_map[class_label] = plan.model_dump()
    print(f"  ✓ Created {len(fee_plan_map)} fee plans")
    return fh.model_dump(), fee_plan_map


async def seed_students_and_fees(school_doc, class_map, fee_head_doc, fee_plan_map, students):
    """Insert student records + per-student fee assignments + backdated payments."""
    students_by_id = {}
    students_by_mobile = {}  # mobile → [student_id, ...]
    admission_seq = {}  # class_label → counter for admission numbers

    for s in students:
        class_label = s['class_label']
        klass = class_map[class_label]
        admission_seq[class_label] = admission_seq.get(class_label, 0) + 1
        seq = admission_seq[class_label]
        admission_no = f"KNP-{s['scholar_no']}" if s['scholar_no'] else f"KNP-{class_label}-{seq:03d}"

        student = Student(
            school_id=school_doc['id'],
            admission_number=admission_no,
            roll_number=str(s['sno']),
            full_name=s['full_name'],
            father_name=s['father_name'] or None,
            phone=s['mobile'] or None,
            class_id=klass['id'],
            section='A',
            status='active',
            admission_date='2026-04-01',
        )
        await students_col.insert_one(student.model_dump())
        students_by_id[student.id] = student.model_dump()
        if s['mobile']:
            students_by_mobile.setdefault(s['mobile'], []).append(student.id)

        # Fee assignment (custom_items so the exact per-student amount is honoured)
        assignment = FeeAssignment(
            school_id=school_doc['id'],
            student_id=student.id,
            fee_plan_id=fee_plan_map[class_label]['id'] if class_label in fee_plan_map else None,
            academic_session='2026-27',
            custom_items=[FeeAssignmentItem(
                fee_head_id=fee_head_doc['id'],
                fee_head_name='Tuition Fee',
                amount=s['actual_fee'],
                frequency='yearly',
                due_date='2026-04-15',
            )],
            discount_amount=s['concession'],
            remarks='Concession applied' if s['concession'] > 0 else None,
            due_date='2026-04-15',
        )
        await fee_assignments_col.insert_one(assignment.model_dump())

        # If already paid something, create a backdated payment.
        if s['paid'] > 0:
            paid_at_dt = datetime(2026, 4, 5, 10, 0, tzinfo=timezone.utc)
            payment = Payment(
                school_id=school_doc['id'],
                student_id=student.id,
                student_name=student.full_name,
                receipt_number=f"KNP-REC-{admission_no}-01",
                items=[PaymentLineItem(
                    fee_head_id=fee_head_doc['id'],
                    fee_head_name='Tuition Fee',
                    period='FY 2026-27',
                    amount=s['paid'],
                )],
                subtotal=s['paid'],
                discount=0.0,
                late_fee=0.0,
                total_paid=s['paid'],
                payment_mode='cash',
                status='success',
                paid_at=paid_at_dt.isoformat().replace('+00:00', 'Z'),
                collected_by_name='Opening Balance Import',
                remarks='Opening balance from FY 2026-27 imported ledger',
            )
            await payments_col.insert_one(payment.model_dump())

    print(f"  ✓ Created {len(students_by_id)} students, fee assignments, and imported payments")
    return students_by_id, students_by_mobile


async def seed_admin_users(school_doc):
    super_admin = User(
        email='superadmin@stanvard.school',
        password_hash=hash_password('Stanvard@2026'),
        full_name='Super Administrator',
        role='super_admin',
        school_id=None,
        phone=None,
        status='active',
    )
    accountant = User(
        email='accountant@stanvard.school',
        password_hash=hash_password('Accountant@2026'),
        full_name='School Accountant',
        role='accountant',
        school_id=school_doc['id'],
        phone=school_doc['phone'] or None,
        status='active',
    )
    await users_col.insert_many([super_admin.model_dump(), accountant.model_dump()])
    print('  ✓ Created Super Admin (superadmin@stanvard.school / Stanvard@2026)')
    print('  ✓ Created Accountant (accountant@stanvard.school / Accountant@2026)')
    return super_admin.model_dump(), accountant.model_dump()


async def seed_parent_users(school_doc, students_by_mobile, students_by_id):
    """One parent user per unique mobile, linked to all their children."""
    created = 0
    for mobile, student_ids in students_by_mobile.items():
        if not mobile or len(mobile) != 10:
            continue
        password = mobile[-6:]
        # Compose a lookup email for admin visibility (login uses mobile via login endpoint).
        email = f"{mobile}@parent.stanvard.school"
        # Prefer the father's name of the first child as the parent's display name.
        first_child = students_by_id.get(student_ids[0])
        father_name = (first_child or {}).get('father_name') or 'Parent'
        parent = User(
            email=email,
            password_hash=hash_password(password),
            full_name=father_name,
            role='parent',
            school_id=school_doc['id'],
            phone=mobile,
            linked_student_ids=list(student_ids),
            status='active',
        )
        await users_col.insert_one(parent.model_dump())
        created += 1
    print(f"  ✓ Created {created} parent accounts (login: mobile no. | password: last 6 digits)")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
async def main():
    print('\n=== REAL DATA SEED — The Stanvard Sec. School ===\n')
    print('Step 1/6: Wiping demo data…')
    await wipe_all()

    print('\nStep 2/6: Recreating school shells (3 branches, real Kanpur active)…')
    school_map = await seed_schools()
    kanpur = school_map['KNP']

    print('\nStep 3/6: Creating classes for Kanpur…')
    class_map = await seed_classes_for(kanpur)

    print('\nStep 4/6: Parsing Excel and grouping by class…')
    students = parse_students()
    print(f'  ✓ Parsed {len(students)} student rows from Excel')
    students_by_class = {}
    for s in students:
        students_by_class.setdefault(s['class_label'], []).append(s)
    for cl, lst in students_by_class.items():
        print(f'    · {CLASS_DISPLAY[cl]:<12} — {len(lst)} students')

    print('\nStep 5/6: Creating fee heads/plans/assignments and importing payments…')
    fee_head_doc, fee_plan_map = await seed_fee_plans(kanpur, class_map, students_by_class)
    students_by_id, students_by_mobile = await seed_students_and_fees(
        kanpur, class_map, fee_head_doc, fee_plan_map, students,
    )

    print('\nStep 6/6: Creating administrator, accountant, and parent accounts…')
    await seed_admin_users(kanpur)
    await seed_parent_users(kanpur, students_by_mobile, students_by_id)

    print('\n=== SEED COMPLETE ===\n')
    print(f"Total students imported : {len(students_by_id)}")
    print(f"Unique parent mobiles   : {len(students_by_mobile)}")
    students_missing_mobile = sum(1 for s in students if not s['mobile'])
    print(f"Students w/o mobile     : {students_missing_mobile} (no parent account created)")
    print()
    print("Login Credentials:")
    print("  Super Admin  → superadmin@stanvard.school  |  password: Stanvard@2026")
    print("  Accountant   → accountant@stanvard.school  |  password: Accountant@2026")
    print("  Parents      → username: <10-digit mobile>  |  password: <last 6 digits of mobile>")
    print()


if __name__ == '__main__':
    asyncio.run(main())
