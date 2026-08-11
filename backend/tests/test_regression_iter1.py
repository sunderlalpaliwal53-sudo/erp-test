"""Regression tests after two safe changes (env-based MOCK keys + stable list key)."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')
if not BASE_URL:
    # Fallback to frontend .env for consistency with app runtime
    with open('/app/frontend/.env') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL='):
                BASE_URL = line.split('=', 1)[1].strip()
                break
BASE_URL = BASE_URL.rstrip('/')
API = f"{BASE_URL}/api"


def _login(username, password):
    r = requests.post(f"{API}/auth/login", json={"email": username, "password": password}, timeout=30)
    return r


# --- Auth for three roles ---
def test_superadmin_login():
    r = _login("superadmin@stanvard.school", "Stanvard@2026")
    assert r.status_code == 200, r.text
    d = r.json()
    assert "access_token" in d or "token" in d
    pytest.superadmin_token = d.get("access_token") or d.get("token")


def test_accountant_login():
    r = _login("accountant@stanvard.school", "Accountant@2026")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("access_token") or d.get("token")


def test_parent_login_by_mobile():
    r = _login("9079111899", "111899")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("access_token") or d.get("token")
    # parent role
    user = d.get("user") or {}
    role = user.get("role") or d.get("role")
    assert role and "parent" in str(role).lower()


# --- Students list (375 seeded) ---
def test_students_list_superadmin():
    tok = getattr(pytest, "superadmin_token", None)
    if not tok:
        r = _login("superadmin@stanvard.school", "Stanvard@2026")
        tok = r.json().get("access_token") or r.json().get("token")
    headers = {"Authorization": f"Bearer {tok}"}
    schools = requests.get(f"{API}/schools", headers=headers, timeout=30).json()
    sid_school = schools[0]["id"]
    r = requests.get(f"{API}/students?school_id={sid_school}&limit=500", headers=headers, timeout=60)
    assert r.status_code == 200, r.text
    data = r.json()
    items = data if isinstance(data, list) else data.get("items") or data.get("students") or []
    assert len(items) >= 300, f"Expected ~375 students, got {len(items)}"
    pytest.first_student_id = items[0].get("id") or items[0].get("_id")


# --- Fee dues / schedule ---
def test_fees_dues_and_schedule():
    tok = getattr(pytest, "superadmin_token", None) or _login("superadmin@stanvard.school", "Stanvard@2026").json().get("access_token")
    sid = getattr(pytest, "first_student_id", None)
    if not sid:
        schools = requests.get(f"{API}/schools", headers={"Authorization": f"Bearer {tok}"}, timeout=30).json()
        r = requests.get(f"{API}/students?school_id={schools[0]['id']}&limit=10", headers={"Authorization": f"Bearer {tok}"}, timeout=60)
        items = r.json()
        sid = items[0].get("id")
    headers = {"Authorization": f"Bearer {tok}"}
    dues = requests.get(f"{API}/fees/student/{sid}/dues", headers=headers, timeout=30)
    assert dues.status_code == 200, dues.text
    sched = requests.get(f"{API}/fees/student/{sid}/fee-schedule", headers=headers, timeout=30)
    assert sched.status_code == 200, sched.text


# --- Razorpay order create (live keys; do not capture) ---
def test_razorpay_order_create():
    tok = _login("superadmin@stanvard.school", "Stanvard@2026").json().get("access_token")
    headers = {"Authorization": f"Bearer {tok}"}
    schools = requests.get(f"{API}/schools", headers=headers, timeout=30).json()
    sid = schools[0]["id"]
    students = requests.get(f"{API}/students?school_id={sid}&limit=1", headers=headers, timeout=30).json()
    assert students, "no students"
    student_id = students[0]["id"]
    payload = {
        "student_id": student_id,
        "items": [{"fee_head_id": "test", "fee_head_name": "Test Fee", "amount": 100.0, "period": "2026-01"}],
        "discount": 0,
        "late_fee": 0,
        "remarks": "regression test"
    }
    r = requests.post(f"{API}/payments/razorpay/order", json=payload, headers=headers, timeout=60)
    print("razorpay order:", r.status_code, r.text[:400])
    assert r.status_code == 200, r.text
    d = r.json()
    assert "order_id" in d
    # Live keys => mock should be False and order id should start with order_ (not order_mock_)
    assert d.get("mock") is False, f"Expected live mode; got mock={d.get('mock')}"
    assert d["order_id"].startswith("order_") and not d["order_id"].startswith("order_mock_"), \
        f"Expected live razorpay order_id, got {d['order_id']}"
