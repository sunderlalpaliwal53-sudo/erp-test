"""Regression test: one-time fee item must be charged in full in the chosen
month only, not divided across collection months, and must sync to student
fee assignments/schedules and dues."""
import os
import requests
from pathlib import Path

def _load_env():
    p = Path('/app/frontend/.env')
    if p.exists():
        for line in p.read_text().splitlines():
            if '=' in line and not line.strip().startswith('#'):
                k, v = line.split('=', 1)
                os.environ.setdefault(k.strip(), v.strip())
_load_env()

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
API = f"{BASE_URL}/api"

SUPER = {"email": "superadmin@stanvard.school", "password": "Stanvard@2026"}


def _login(session):
    r = session.post(f"{API}/auth/login", json=SUPER)
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    tok = r.json().get('token') or r.json().get('access_token')
    assert tok, r.text
    session.headers.update({"Authorization": f"Bearer {tok}"})


def test_one_time_fee_flow():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    _login(s)

    # Pick KNP school (or first)
    r = s.get(f"{API}/schools")
    assert r.status_code == 200, r.text
    schools = r.json()
    assert schools, "no schools"
    school = next((sc for sc in schools if 'KNP' in (sc.get('code','') + sc.get('name','')).upper()), schools[0])
    sid = school['id']
    s.headers.update({"X-School-Id": sid})
    print("school:", school.get('name'), sid)

    # Create class
    r = s.post(f"{API}/classes", json={"name": "ONETIME-TEST", "sections": ["A"], "school_id": sid})
    assert r.status_code in (200, 201), r.text
    cls = r.json()
    class_id = cls['id']
    print("class:", class_id)

    # Create student
    r = s.post(f"{API}/students", json={
        "full_name": "One Time Test", "class_id": class_id,
        "section": "A", "school_id": sid,
    })
    assert r.status_code in (200, 201), r.text
    student = r.json()
    student_id = student['id']
    print("student:", student_id)

    # Fee heads
    r = s.post(f"{API}/fees/heads", json={"name": "Tuition OT", "category": "general", "school_id": sid})
    assert r.status_code in (200, 201), r.text
    tuition = r.json()

    r = s.post(f"{API}/fees/heads", json={"name": "Admission OT", "category": "general", "school_id": sid})
    assert r.status_code in (200, 201), r.text
    admission = r.json()

    # Fee plan
    plan_body = {
        "name": "OneTime Test Plan",
        "class_id": class_id,
        "school_id": sid,
        "academic_session": "2026-27",
        "annual_discount_percent": 0,
        "late_fee_amount": 0,
        "late_fee_after_day": 10,
        "plan_discount_type": None,
        "yearly_discount_type": None,
        "month_discounts": [],
        "month_amounts": [],
        "installment_discounts": [],
        "items": [
            {"fee_head_id": tuition['id'], "fee_head_name": "Tuition OT",
             "amount": 10000, "frequency": "monthly", "installments": 12},
            {"fee_head_id": admission['id'], "fee_head_name": "Admission OT",
             "amount": 2000, "frequency": "one_time", "installments": 1,
             "one_time_month": 9},
        ],
    }
    r = s.post(f"{API}/fees/plans", json=plan_body)
    assert r.status_code in (200, 201), r.text
    plan = r.json()
    print("plan assigned_students:", plan.get('assigned_students'))
    assert plan.get('assigned_students', 0) >= 1

    # Fetch fee schedule
    r = s.get(f"{API}/fees/student/{student_id}/fee-schedule")
    assert r.status_code == 200, r.text
    sched_resp = r.json()
    schedule = sched_resp.get('schedule') or sched_resp.get('installments') or sched_resp
    print("schedule:", schedule)

    by_month = {}
    for row in schedule:
        by_month[int(row['month'])] = row

    # Assertions
    sept = by_month.get(9)
    assert sept is not None, f"no september row: {by_month}"
    assert float(sept.get('amount', 0)) == 3000.0, f"Sept expected 3000, got {sept}"

    april = by_month.get(4)
    assert april is not None and float(april['amount']) == 1000.0, f"April expected 1000, got {april}"

    june = by_month.get(6)
    march = by_month.get(3)
    for m, name in [(june, 'June'), (march, 'March')]:
        assert m is not None
        assert float(m.get('amount', 0)) == 0.0, f"{name} expected 0, got {m}"
        assert m.get('status') in ('skip', 'no_fee') or (m.get('label') or '').lower().startswith('no'), f"{name} should be no-fee: {m}"

    # Active months sum == 12000 (sum non-zero months)
    active_sum = sum(float(r_.get('amount', 0)) for r_ in schedule if float(r_.get('amount', 0)) > 0)
    assert active_sum == 12000.0, f"active sum expected 12000, got {active_sum}"

    # One-time appears only in September (no other month inflated above 1000)
    for mnum, row in by_month.items():
        if mnum in (3, 6, 9):
            continue
        assert float(row['amount']) == 1000.0, f"month {mnum} inflated: {row}"

    # Dues
    r = s.get(f"{API}/fees/student/{student_id}/dues")
    assert r.status_code == 200, r.text
    dues = r.json()
    print("dues total_expected:", dues.get('total_expected'))
    assert float(dues.get('total_expected', 0)) == 12000.0, dues

    # And installments in dues show one-time only in September
    dues_insts = dues.get('installments') or []
    dues_by_month = {int(i['month']): float(i.get('amount', 0)) for i in dues_insts}
    if dues_by_month:
        assert dues_by_month.get(9) == 3000.0, dues_by_month
        assert dues_by_month.get(4) == 1000.0, dues_by_month
        assert dues_by_month.get(6, 0) == 0.0, dues_by_month
        assert dues_by_month.get(3, 0) == 0.0, dues_by_month

    print("ALL ASSERTIONS PASSED")


if __name__ == '__main__':
    test_one_time_fee_flow()
