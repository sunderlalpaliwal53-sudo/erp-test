"""Seed a demo exam with marks (idempotent). Run AFTER seed.py:
    cd /app/backend && python seed_exams.py
"""
import asyncio
import random

from database import exams_col, marks_col, students_col, schools_col
from models import Exam, ExamSubject, now_iso, new_id

SUBJECTS = [('Mathematics', 100), ('English', 100), ('Science', 100),
            ('Hindi', 100), ('Social Studies', 100)]


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


async def main():
    school = await schools_col.find_one({'code': 'GN'}, {'_id': 0}) \
        or await schools_col.find_one({}, {'_id': 0})
    if not school:
        print('No school found. Run seed.py first.')
        return
    existing = await exams_col.find_one(
        {'school_id': school['id'], 'name': 'Half-Yearly Examination'}, {'_id': 0})
    if existing:
        print('Demo exam already exists, skipping.')
        return
    students = await students_col.find(
        {'school_id': school['id'], 'status': 'active'}, {'_id': 0}).to_list(2000)
    if not students:
        print('No students found. Run seed.py first.')
        return
    class_id = students[0]['class_id']
    section = students[0].get('section')
    roster = [s for s in students
              if s['class_id'] == class_id and s.get('section') == section]
    ex = Exam(school_id=school['id'], name='Half-Yearly Examination', term='Term 1',
              academic_session=school.get('academic_session', '2025-26'),
              class_id=class_id, section=section,
              subjects=[ExamSubject(name=n, max_marks=m) for n, m in SUBJECTS],
              exam_date='2025-10-15', status='published')
    await exams_col.insert_one(ex.model_dump())
    random.seed(7)
    max_total = sum(m for _, m in SUBJECTS)
    for s in roster:
        marks = {n: float(round(random.uniform(35, 98))) for n, _ in SUBJECTS}
        total = round(sum(marks.values()), 2)
        pct = round(total / max_total * 100, 2)
        await marks_col.insert_one({
            'id': new_id(), 'school_id': school['id'], 'exam_id': ex.id,
            'student_id': s['id'], 'marks': marks, 'total': total,
            'max_total': float(max_total), 'percentage': pct,
            'grade': grade_for(pct), 'entered_by_name': 'Seed',
            'created_at': now_iso(), 'updated_at': now_iso(),
        })
    print(f'Seeded "{ex.name}" with marks for {len(roster)} students of class {class_id} sec {section}')


if __name__ == '__main__':
    asyncio.run(main())
