"""Seed demo exams with marks (idempotent). Run AFTER real_seed.py:
    cd /app/backend && python seed_exams.py

Seeds, for the primary (KNP) branch:
  1. "Half-Yearly Examination" for the first class with students (published).
  2. "Unit Test 1" for the class of the documented QA parent
     (mobile 6376066570 -> children Gaurav/Shivam Gurjar), so the parent
     portal /parent/results has content out of the box.
"""
import asyncio
import random

from database import exams_col, marks_col, students_col, schools_col
from models import Exam, ExamSubject, now_iso, new_id

SUBJECTS = [('Mathematics', 100), ('English', 100), ('Science', 100),
            ('Hindi', 100), ('Social Studies', 100)]
UNIT_SUBJECTS = [('Mathematics', 50), ('English', 50), ('Science', 50),
                 ('Hindi', 50), ('Social Studies', 50)]


def grade_for(pct: float) -> str:
    if pct >= 90:
        return 'A+'
    if pct >= 75:
        return 'A'
    if pct >= 60:
        return 'B'
    if pct >= 45:
        return 'C'
    if pct >= 33:
        return 'D'
    return 'F'


async def seed_one(school, name, term, exam_date, subjects, roster, rng):
    existing = await exams_col.find_one(
        {'school_id': school['id'], 'name': name}, {'_id': 0})
    if existing:
        print(f'  = "{name}" already exists, skipping.')
        return
    if not roster:
        print(f'  ! no students for "{name}", skipped.')
        return
    ex = Exam(school_id=school['id'], name=name, term=term,
              academic_session=school.get('academic_session', '2025-26'),
              class_id=roster[0]['class_id'], section=roster[0].get('section'),
              subjects=[ExamSubject(name=n, max_marks=m) for n, m in subjects],
              exam_date=exam_date, status='published')
    await exams_col.insert_one(ex.model_dump())
    max_total = sum(m for _, m in subjects)
    for s in roster:
        marks = {n: float(round(rng.uniform(0.35, 0.98) * m)) for n, m in subjects}
        total = round(sum(marks.values()), 2)
        pct = round(total / max_total * 100, 2)
        await marks_col.insert_one({
            'id': new_id(), 'school_id': school['id'], 'exam_id': ex.id,
            'student_id': s['id'], 'marks': marks, 'total': total,
            'max_total': float(max_total), 'percentage': pct,
            'grade': grade_for(pct), 'entered_by_name': 'Seed',
            'created_at': now_iso(), 'updated_at': now_iso(),
        })
    print(f'  + "{name}": marks for {len(roster)} students '
          f'(class {roster[0]["class_id"]} sec {roster[0].get("section")})')


async def main():
    school = await schools_col.find_one({'code': 'KNP'}, {'_id': 0}) \
        or await schools_col.find_one({}, {'_id': 0})
    if not school:
        print('No school found. Run real_seed.py first.')
        return
    students = await students_col.find(
        {'school_id': school['id'], 'status': 'active'}, {'_id': 0}).to_list(5000)
    if not students:
        print('No students found. Run real_seed.py first.')
        return
    rng = random.Random(7)

    first = students[0]
    roster1 = [s for s in students if s['class_id'] == first['class_id']
               and s.get('section') == first.get('section')]
    await seed_one(school, 'Half-Yearly Examination', 'Term 1', '2025-10-15',
                   SUBJECTS, roster1, rng)

    qa = [s for s in students if (s.get('phone') or '').replace(' ', '').endswith('6376066570')
          or s.get('full_name') in ('Gaurav Gurjar', 'Shivam Gurjar')]
    if qa:
        target = qa[0]
        roster2 = [s for s in students if s['class_id'] == target['class_id']
                   and s.get('section') == target.get('section')]
        await seed_one(school, 'Unit Test 1', 'Term 1', '2025-08-20',
                       UNIT_SUBJECTS, roster2, rng)
    else:
        print('  ! QA parent children not found, "Unit Test 1" skipped.')


if __name__ == '__main__':
    asyncio.run(main())
