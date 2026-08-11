"""Add a school_admin + teacher for the Kanpur branch so RBAC QA covers all roles.
Also prints a sample multi-child parent for parent-portal testing. Idempotent."""
import asyncio
from database import schools_col, users_col, students_col, classes_col
from models import User
from auth import hash_password


async def main():
    kanpur = await schools_col.find_one({'code': 'KNP'}, {'_id': 0})
    sid = kanpur['id']
    a_class = await classes_col.find_one({'school_id': sid}, {'_id': 0})

    for email, pwd, name, role, extra in [
        ('admin@stanvard.school', 'Admin@2026', 'School Administrator', 'school_admin', {}),
        ('teacher@stanvard.school', 'Teacher@2026', 'Class Teacher', 'teacher',
         {'linked_class_ids': [a_class['id']] if a_class else []}),
    ]:
        exists = await users_col.find_one({'email': email}, {'_id': 0})
        if exists:
            print(f'  = exists: {email}')
            continue
        u = User(email=email, password_hash=hash_password(pwd), full_name=name,
                 role=role, school_id=sid, status='active', **extra)
        await users_col.insert_one(u.model_dump())
        print(f'  + created {role}: {email} / {pwd}')

    # Find a parent with multiple children for multi-child switcher testing
    multi = await users_col.find_one(
        {'role': 'parent', 'linked_student_ids.1': {'$exists': True}}, {'_id': 0})
    single = await users_col.find_one({'role': 'parent'}, {'_id': 0})
    print('\n--- Sample parents ---')
    if multi:
        kids = await students_col.find(
            {'id': {'$in': multi['linked_student_ids']}}, {'_id': 0, 'full_name': 1}).to_list(10)
        print(f"  MULTI-child parent -> mobile: {multi['phone']} | pwd: {multi['phone'][-6:]} "
              f"| children: {[k['full_name'] for k in kids]}")
    if single:
        print(f"  SINGLE parent      -> mobile: {single['phone']} | pwd: {single['phone'][-6:]}")


if __name__ == '__main__':
    asyncio.run(main())
