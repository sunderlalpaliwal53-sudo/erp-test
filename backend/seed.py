"""Seed the Stanvard ERP database with 3 schools + demo users + sample data.
Run:  cd /app/backend && python seed.py
"""
import asyncio
import random
from datetime import datetime, timedelta

from database import (
    schools_col, users_col, students_col, classes_col,
    fee_heads_col, fee_plans_col, fee_assignments_col,
    payments_col, attendance_col, homework_col, timetable_col,
    events_col, circulars_col, gallery_col, staff_col,
    notifications_col, audit_col, settings_col, counters_col,
)
from models import (
    School, User, Student, ClassRoom, FeeHead, FeePlan, FeePlanItem,
    FeeAssignment, Payment, PaymentLineItem, AttendanceRecord, Homework,
    Timetable, TimetableSlot, Event, Circular, GalleryAlbum, Staff,
    Notification, now_iso,
)
from auth import hash_password


INDIAN_FIRST_NAMES_M = ['Aarav', 'Vihaan', 'Aditya', 'Reyansh', 'Krishna', 'Ishaan', 'Arjun', 'Kabir',
                       'Vivaan', 'Karthik', 'Ayaan', 'Advik', 'Dhruv', 'Rohan', 'Shivansh', 'Yash']
INDIAN_FIRST_NAMES_F = ['Aadhya', 'Anaya', 'Diya', 'Isha', 'Kavya', 'Meera', 'Myra', 'Navya',
                       'Pari', 'Riya', 'Saanvi', 'Sara', 'Siya', 'Tara', 'Ananya', 'Ira']
LAST_NAMES = ['Sharma', 'Verma', 'Gupta', 'Singh', 'Kumar', 'Mishra', 'Yadav', 'Patel',
             'Agarwal', 'Jain', 'Reddy', 'Nair', 'Chauhan', 'Tiwari', 'Iyer', 'Bansal']
CATEGORIES = ['General', 'OBC', 'SC', 'ST']
RELIGIONS = ['Hindu', 'Muslim', 'Sikh', 'Christian', 'Jain']
BLOOD_GROUPS = ['A+', 'B+', 'AB+', 'O+', 'A-', 'B-', 'O-']
SUBJECTS = ['Mathematics', 'Science', 'English', 'Hindi', 'Social Studies', 'Computer', 'Sanskrit', 'PE']


async def wipe():
    """Clear all collections for a fresh seed."""
    for c in [schools_col, users_col, students_col, classes_col, fee_heads_col,
              fee_plans_col, fee_assignments_col, payments_col, attendance_col,
              homework_col, timetable_col, events_col, circulars_col, gallery_col,
              staff_col, notifications_col, audit_col, settings_col, counters_col]:
        await c.delete_many({})


async def seed_schools():
    schools_data = [
        {'name': 'Stanvard School - Ganesh Nagar', 'code': 'GN', 'city': 'Ganesh Nagar',
         'address': 'Sector 12, Ganesh Nagar, New Delhi', 'phone': '+91 98100 12345',
         'email': 'ganeshnagar@stanvard.school', 'principal_name': 'Dr. Anjali Malhotra'},
        {'name': 'Stanvard School - Kanpur', 'code': 'KNP', 'city': 'Kanpur',
         'address': 'Civil Lines, Kanpur, Uttar Pradesh', 'phone': '+91 94520 67890',
         'email': 'kanpur@stanvard.school', 'principal_name': 'Mr. Rajeev Nair'},
        {'name': 'Stanvard School - Ayar', 'code': 'AYR', 'city': 'Ayar',
         'address': 'Green Meadows, Ayar, Uttar Pradesh', 'phone': '+91 93110 55666',
         'email': 'ayar@stanvard.school', 'principal_name': 'Ms. Priyanka Iyer'},
    ]
    schools = [School(**d) for d in schools_data]
    await schools_col.insert_many([s.model_dump() for s in schools])
    print(f'  Seeded {len(schools)} schools')
    return schools


async def seed_users(schools):
    users = [
        User(email='superadmin@stanvard.school', password_hash=hash_password('super123'),
             full_name='Super Admin', role='super_admin'),
    ]
    for sc in schools:
        users.append(User(email=f'admin.{sc.code.lower()}@stanvard.school',
                         password_hash=hash_password('admin123'),
                         full_name=f'{sc.city} School Admin',
                         role='school_admin', school_id=sc.id))
        users.append(User(email=f'accountant.{sc.code.lower()}@stanvard.school',
                         password_hash=hash_password('acc123'),
                         full_name=f'{sc.city} Accountant',
                         role='accountant', school_id=sc.id))
        users.append(User(email=f'teacher.{sc.code.lower()}@stanvard.school',
                         password_hash=hash_password('teacher123'),
                         full_name=f'{sc.city} Teacher',
                         role='teacher', school_id=sc.id))
    await users_col.insert_many([u.model_dump() for u in users])
    print(f'  Seeded {len(users)} users (roles)')
    return users


async def seed_classes(schools):
    all_classes = {}
    class_names = ['Class I', 'Class II', 'Class III', 'Class IV', 'Class V',
                   'Class VI', 'Class VII', 'Class VIII', 'Class IX', 'Class X']
    for sc in schools:
        sc_classes = []
        for name in class_names:
            c = ClassRoom(school_id=sc.id, name=name, sections=['A', 'B'])
            sc_classes.append(c)
        await classes_col.insert_many([c.model_dump() for c in sc_classes])
        all_classes[sc.id] = sc_classes
    print(f'  Seeded {sum(len(v) for v in all_classes.values())} classes')
    return all_classes


async def seed_fee_heads(schools):
    all_heads = {}
    head_names = [('Tuition Fee', 'general'), ('Transport Fee', 'transport'),
                  ('Computer Fee', 'general'), ('Library Fee', 'general'),
                  ('Activity Fee', 'activity'), ('Annual Fee', 'general'),
                  ('Exam Fee', 'exam')]
    for sc in schools:
        heads = [FeeHead(school_id=sc.id, name=n, category=c) for n, c in head_names]
        await fee_heads_col.insert_many([h.model_dump() for h in heads])
        all_heads[sc.id] = heads
    print('  Seeded fee heads')
    return all_heads


async def seed_fee_plans(schools, all_classes, all_heads):
    all_plans = {}
    for sc in schools:
        heads = {h.name: h for h in all_heads[sc.id]}
        for cls in all_classes[sc.id]:
            # Base amounts scale by class
            grade = int(cls.name.split()[-1].replace('I', '1').replace('V', '5').replace('X', '10')) if False else all_classes[sc.id].index(cls) + 1
            base_tuition = 3000 + grade * 300
            items = [
                FeePlanItem(fee_head_id=heads['Tuition Fee'].id, fee_head_name='Tuition Fee',
                           amount=base_tuition, frequency='monthly', installments=12),
                FeePlanItem(fee_head_id=heads['Transport Fee'].id, fee_head_name='Transport Fee',
                           amount=1200, frequency='monthly', installments=12),
                FeePlanItem(fee_head_id=heads['Computer Fee'].id, fee_head_name='Computer Fee',
                           amount=300, frequency='monthly', installments=12),
                FeePlanItem(fee_head_id=heads['Annual Fee'].id, fee_head_name='Annual Fee',
                           amount=base_tuition * 10, frequency='yearly', installments=1),
                FeePlanItem(fee_head_id=heads['Exam Fee'].id, fee_head_name='Exam Fee',
                           amount=500, frequency='half_yearly', installments=2),
            ]
            plan = FeePlan(school_id=sc.id, name=f'{cls.name} 2025-26', class_id=cls.id,
                          items=items, annual_discount_percent=10.0, late_fee_amount=50.0,
                          late_fee_after_day=10)
            await fee_plans_col.insert_one(plan.model_dump())
            all_plans.setdefault(sc.id, {})[cls.id] = plan
    print('  Seeded fee plans')
    return all_plans


async def seed_students_and_parents(schools, all_classes, all_plans):
    all_students = {}
    parent_users = []
    for sc in schools:
        sc_students = []
        for cls in all_classes[sc.id][:6]:  # Class I to VI
            for section in ['A', 'B']:
                for i in range(8):  # 8 students per section
                    is_male = random.random() > 0.4
                    first = random.choice(INDIAN_FIRST_NAMES_M if is_male else INDIAN_FIRST_NAMES_F)
                    last = random.choice(LAST_NAMES)
                    father = random.choice(['Rajesh', 'Amit', 'Suresh', 'Vikas', 'Manoj', 'Prakash']) + ' ' + last
                    mother = random.choice(['Sunita', 'Priya', 'Meena', 'Kavita', 'Anjali']) + ' ' + last
                    adm_no = f"{sc.code}-2025-{len(sc_students) + 1:04d}"
                    s = Student(
                        school_id=sc.id, admission_number=adm_no,
                        roll_number=str(i + 1),
                        full_name=f'{first} {last}',
                        dob=f'201{random.randint(0, 5)}-0{random.randint(1, 9)}-{random.randint(10, 28)}',
                        gender='Male' if is_male else 'Female',
                        blood_group=random.choice(BLOOD_GROUPS),
                        religion=random.choice(RELIGIONS),
                        category=random.choice(CATEGORIES),
                        class_id=cls.id, section=section,
                        father_name=father, mother_name=mother,
                        phone=f'+91 {random.randint(70, 99)}{random.randint(10000000, 99999999)}',
                        email=f'{first.lower()}.{last.lower()}@stanvard.school',
                        address=f'{random.randint(1, 200)}, {sc.city}',
                        admission_date=f'2024-04-0{random.randint(1, 9)}',
                        photo_url=f'https://api.dicebear.com/9.x/notionists/svg?seed={first}{last}',
                        remarks='',
                    )
                    sc_students.append(s)
                    # Create fee assignment
                    plan = all_plans[sc.id][cls.id]
                    fa = FeeAssignment(school_id=sc.id, student_id=s.id, fee_plan_id=plan.id)
                    await fee_assignments_col.insert_one(fa.model_dump())
                    # Create parent user for first 3 students of each section
                    if i < 3:
                        parent_email = f'parent.{s.admission_number.lower().replace("-", "")}@stanvard.school'
                        parent_users.append(User(
                            email=parent_email, password_hash=hash_password('parent123'),
                            full_name=father, role='parent',
                            school_id=sc.id, linked_student_ids=[s.id],
                            phone=s.phone,
                        ))
        await students_col.insert_many([s.model_dump() for s in sc_students])
        all_students[sc.id] = sc_students
    if parent_users:
        await users_col.insert_many([u.model_dump() for u in parent_users])
    total_students = sum(len(v) for v in all_students.values())
    print(f'  Seeded {total_students} students + {len(parent_users)} parent accounts')
    return all_students


async def seed_payments(schools, all_students):
    total_payments = 0
    for sc in schools:
        for student in all_students[sc.id][:24]:  # first 24 pay some fees
            n_months = random.randint(1, 5)
            for m in range(n_months):
                month_date = datetime.now() - timedelta(days=30 * m + random.randint(0, 15))
                items = [
                    PaymentLineItem(fee_head_name='Tuition Fee',
                                    period=month_date.strftime('%B %Y'),
                                    amount=random.choice([3300, 3600, 3900, 4200, 4500])),
                    PaymentLineItem(fee_head_name='Transport Fee',
                                    period=month_date.strftime('%B %Y'),
                                    amount=1200),
                ]
                subtotal = sum(i.amount for i in items)
                discount = 0
                late_fee = 0
                total_paid = subtotal + late_fee - discount
                p = Payment(
                    school_id=sc.id,
                    student_id=student.id,
                    student_name=student.full_name,
                    receipt_number=f'{sc.code}-2025-{total_payments + 1:06d}',
                    items=items, subtotal=subtotal, discount=discount,
                    late_fee=late_fee, total_paid=total_paid,
                    payment_mode=random.choice(['cash', 'upi', 'card', 'cheque', 'razorpay']),
                    txn_ref=f'TXN{random.randint(100000, 999999)}',
                    status='success',
                    collected_by_name='Accountant',
                    paid_at=month_date.isoformat(),
                )
                await payments_col.insert_one(p.model_dump())
                total_payments += 1
    print(f'  Seeded {total_payments} payments')


async def seed_attendance(schools, all_students, all_classes):
    total_att = 0
    for sc in schools:
        # last 10 school days
        for d in range(10):
            day = datetime.now() - timedelta(days=d)
            if day.weekday() == 6:  # skip Sundays
                continue
            date_str = day.strftime('%Y-%m-%d')
            for cls in all_classes[sc.id][:6]:
                students_in_class = [s for s in all_students[sc.id] if s.class_id == cls.id]
                for s in students_in_class:
                    status = 'present' if random.random() > 0.1 else random.choice(['absent', 'leave'])
                    rec = AttendanceRecord(
                        school_id=sc.id, date=date_str, class_id=cls.id,
                        section=s.section, student_id=s.id, status=status,
                    )
                    await attendance_col.insert_one(rec.model_dump())
                    total_att += 1
    print(f'  Seeded {total_att} attendance records')


async def seed_homework(schools, all_classes):
    total = 0
    for sc in schools:
        for cls in all_classes[sc.id][:6]:
            for subj in random.sample(SUBJECTS, 3):
                hw = Homework(
                    school_id=sc.id, class_id=cls.id, section='A',
                    subject=subj,
                    title=f'{subj} homework for {cls.name}',
                    description='Complete exercises 1 to 10 from chapter 3. Submit before due date.',
                    due_date=(datetime.now() + timedelta(days=random.randint(2, 7))).strftime('%Y-%m-%d'),
                    created_by_name='Class Teacher',
                )
                await homework_col.insert_one(hw.model_dump())
                total += 1
    print(f'  Seeded {total} homework items')


async def seed_events_circulars_gallery(schools):
    for sc in schools:
        events = [
            Event(school_id=sc.id, title='Annual Sports Day',
                 description='Inter-house sports competition with track & field events.',
                 event_date=(datetime.now() + timedelta(days=14)).strftime('%Y-%m-%d'),
                 location='School Ground',
                 image_url='https://images.unsplash.com/photo-1577896851231-70ef18881754?w=800'),
            Event(school_id=sc.id, title='Parent-Teacher Meeting',
                 description='Half-yearly progress discussion with class teachers.',
                 event_date=(datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d'),
                 location='Assembly Hall',
                 image_url='https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800'),
            Event(school_id=sc.id, title='Science Exhibition',
                 description='Class VI-X students showcase innovative projects.',
                 event_date=(datetime.now() + timedelta(days=21)).strftime('%Y-%m-%d'),
                 location='Science Block',
                 image_url='https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800'),
        ]
        await events_col.insert_many([e.model_dump() for e in events])

        circulars = [
            Circular(school_id=sc.id, title='School Reopens Monday',
                    body='Dear Parents, the school will reopen on Monday after the short vacation. Please ensure students carry their books and stationery.',
                    priority='normal', audience='parents', created_by_name='Principal'),
            Circular(school_id=sc.id, title='Fee Reminder: October',
                    body='Kindly clear October fees by 10th of the month to avoid late charges.',
                    priority='high', audience='parents', created_by_name='Accounts'),
            Circular(school_id=sc.id, title='Diwali Vacation Schedule',
                    body='School will remain closed from 30th Oct to 5th Nov for Diwali celebrations.',
                    priority='normal', audience='all', created_by_name='Principal'),
        ]
        await circulars_col.insert_many([c.model_dump() for c in circulars])

        gallery = [
            GalleryAlbum(school_id=sc.id, title='Independence Day 2025',
                        description='Photos from our vibrant Independence Day celebration.',
                        cover_url='https://images.unsplash.com/photo-1596496050755-c923e73e42e1?w=800',
                        photos=['https://images.unsplash.com/photo-1596496050755-c923e73e42e1?w=800',
                                'https://images.unsplash.com/photo-1580927752452-89d86da3fa0a?w=800']),
            GalleryAlbum(school_id=sc.id, title='Annual Function 2024',
                        description='Highlights from the annual cultural function.',
                        cover_url='https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800',
                        photos=['https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800',
                                'https://images.unsplash.com/photo-1577896851231-70ef18881754?w=800']),
        ]
        await gallery_col.insert_many([g.model_dump() for g in gallery])
    print('  Seeded events, circulars, gallery for all schools')


async def seed_staff_notifications_timetable(schools, all_classes):
    for sc in schools:
        staff = [
            Staff(school_id=sc.id, full_name=f'{random.choice(["Ms.", "Mr.", "Dr."])} {random.choice(INDIAN_FIRST_NAMES_F)} {random.choice(LAST_NAMES)}',
                  designation='Teacher', department='Mathematics',
                  subjects=['Mathematics'], joining_date='2022-06-15',
                  photo_url=f'https://api.dicebear.com/9.x/notionists/svg?seed=staff{i}',
                  email=f'staff{i}@stanvard.school', phone='+91 98765 43210')
            for i in range(6)
        ]
        await staff_col.insert_many([s.model_dump() for s in staff])
        notifications = [
            Notification(school_id=sc.id, title='Welcome to Stanvard ERP',
                        body='Your child portal is now live. Access attendance, homework, and fee status here.',
                        audience='parents', kind='announcement'),
            Notification(school_id=sc.id, title='Half-yearly Exam Schedule Released',
                        body='Exam schedule for October has been shared. Please check circulars.',
                        audience='all', kind='exam'),
        ]
        await notifications_col.insert_many([n.model_dump() for n in notifications])

        # Timetable for first class only (Class I A)
        cls = all_classes[sc.id][0]
        days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
        slots = []
        for d in days:
            for p in range(1, 7):
                slots.append(TimetableSlot(
                    day=d, period=p,
                    start_time=f'{8 + p:02d}:00',
                    end_time=f'{8 + p:02d}:45',
                    subject=random.choice(SUBJECTS),
                    teacher_name=f'Ms. {random.choice(INDIAN_FIRST_NAMES_F)}',
                ))
        tt = Timetable(school_id=sc.id, class_id=cls.id, section='A', slots=slots)
        await timetable_col.insert_one(tt.model_dump())
    print('  Seeded staff, notifications, timetable')


async def main():
    print('\n' + '=' * 60)
    print('STANVARD SCHOOL ERP - DATABASE SEED')
    print('=' * 60)
    random.seed(42)
    print('\n[1/9] Wiping existing data...')
    await wipe()
    print('[2/9] Seeding schools...')
    schools = await seed_schools()
    print('[3/9] Seeding users...')
    await seed_users(schools)
    print('[4/9] Seeding classes...')
    all_classes = await seed_classes(schools)
    print('[5/9] Seeding fee heads...')
    all_heads = await seed_fee_heads(schools)
    print('[6/9] Seeding fee plans...')
    all_plans = await seed_fee_plans(schools, all_classes, all_heads)
    print('[7/9] Seeding students & parents...')
    all_students = await seed_students_and_parents(schools, all_classes, all_plans)
    print('[8/9] Seeding payments & attendance...')
    await seed_payments(schools, all_students)
    await seed_attendance(schools, all_students, all_classes)
    print('[9/9] Seeding homework, events, circulars, gallery, staff...')
    await seed_homework(schools, all_classes)
    await seed_events_circulars_gallery(schools)
    await seed_staff_notifications_timetable(schools, all_classes)

    print('\n' + '=' * 60)
    print('SEED COMPLETE - Login Credentials')
    print('=' * 60)
    print("""
  Super Admin:      superadmin@stanvard.school     / super123
  Ganesh Nagar:
    Admin:          admin.gn@stanvard.school       / admin123
    Accountant:     accountant.gn@stanvard.school  / acc123
    Teacher:        teacher.gn@stanvard.school     / teacher123
  Kanpur:
    Admin:          admin.knp@stanvard.school      / admin123
    Accountant:     accountant.knp@stanvard.school / acc123
    Teacher:        teacher.knp@stanvard.school    / teacher123
  Ayar:
    Admin:          admin.ayr@stanvard.school      / admin123
    Accountant:     accountant.ayr@stanvard.school / acc123
    Teacher:        teacher.ayr@stanvard.school    / teacher123
  Parent (sample):  parent.gn20250001@stanvard.school / parent123
""")


if __name__ == '__main__':
    asyncio.run(main())
