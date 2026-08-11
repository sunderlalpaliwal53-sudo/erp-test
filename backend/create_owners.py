"""Create owner accounts for Stanvard School ERP.

Creates 2 owner users:
  1. Satya Prakash Mundra   → satya.mundra@stanvard.school   / Mundra@Satya2026
  2. Mrityunjay Mundra      → mrityunjay.mundra@stanvard.school / Mundra@Mrityunjay2026

Owners have read access to Home Dashboard, Analytics, Reports, and Users list,
and are the ONLY role (besides super_admin) that can approve/reject discount
requests raised by Admins/Accountants during fee collection.
"""
import asyncio
import os
import sys
from pathlib import Path

BASE = Path(__file__).parent
sys.path.insert(0, str(BASE))

from dotenv import load_dotenv
load_dotenv(BASE / '.env')

from database import users_col, schools_col
from auth import hash_password
from models import User, now_iso


OWNERS = [
    {
        'full_name': 'Satya Prakash Mundra',
        'email': 'spmundra@stanvard.school',
        'password': 'mundra@sp2026',
        'phone': '9414150001',
    },
    {
        'full_name': 'Mrityunjay Mundra',
        'email': 'mjmundra@stanvard.school',
        'password': 'mundra@mj2026',
        'phone': '9414150002',
    },
]


async def main():
    # Owners are scoped to KNP (Kanpur/Girwa – the primary branch with real data)
    # so cross-branch context defaults correctly. Change/duplicate if you need
    # separate owners per branch.
    school = await schools_col.find_one({'code': 'KNP', 'status': {'$ne': 'deleted'}}, {'_id': 0})
    if not school:
        school = await schools_col.find_one({'status': {'$ne': 'deleted'}}, {'_id': 0}, sort=[('code', 1)])
    school_id = school['id'] if school else None
    print(f'Assigning owners to school: {school.get("name") if school else "(none)"}')

    created = []
    for o in OWNERS:
        existing = await users_col.find_one({'email': o['email']}, {'_id': 0})
        if existing:
            # Update password + role/school
            await users_col.update_one(
                {'email': o['email']},
                {'$set': {
                    'password_hash': hash_password(o['password']),
                    'role': 'owner',
                    'school_id': school_id,
                    'status': 'active',
                    'full_name': o['full_name'],
                    'phone': o['phone'],
                    'updated_at': now_iso(),
                }}
            )
            created.append(f"UPDATED  {o['email']}")
        else:
            u = User(
                full_name=o['full_name'],
                email=o['email'],
                phone=o['phone'],
                role='owner',
                school_id=school_id,
                password_hash=hash_password(o['password']),
                status='active',
            )
            await users_col.insert_one(u.model_dump())
            created.append(f"CREATED  {o['email']}")

    print('\n=== OWNER ACCOUNTS ===')
    for line in created:
        print(f'  ✓ {line}')

    print('\nLogin Credentials:')
    for o in OWNERS:
        print(f'  {o["full_name"]:<25s} → {o["email"]}  |  password: {o["password"]}')


if __name__ == '__main__':
    asyncio.run(main())
