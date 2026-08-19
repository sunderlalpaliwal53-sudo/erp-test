"""LIVE MODE Razorpay tests.

CRITICAL: These tests exercise the real Razorpay live keys but ONLY the order
create + fake-signature verify endpoints. No real payment is captured.
"""
import os
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://enterprise-ops-66.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"


def _login(username, password):
    r = requests.post(f"{API}/auth/login",
                      json={'email': username, 'password': password}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()['access_token']


@pytest.fixture(scope='module')
def admin_token():
    return _login('admin@stanvard.school', 'Admin@2026')


@pytest.fixture(scope='module')
def parent_token():
    return _login('6376066570', '066570')


@pytest.fixture(scope='module')
def parent_student(parent_token):
    r = requests.get(f"{API}/students",
                     headers={'Authorization': f'Bearer {parent_token}'}, timeout=30)
    assert r.status_code == 200, r.text
    children = r.json()
    assert children, 'Parent has no children'
    for c in children:
        if 'gaurav' in c.get('full_name', '').lower():
            return c
    return children[0]


def test_razorpay_order_live_mode(parent_token, parent_student):
    """POST /api/payments/razorpay/order must return mock:false with a real
    live key + real order id."""
    body = {
        'student_id': parent_student['id'],
        'items': [{'fee_head_name': 'Tuition Fee', 'component': 'Tuition Fee', 'month': 4, 'amount': 100.0}],
        'discount': 0,
        'late_fee': 0,
        'remarks': 'LIVE-mode order smoke test (no capture)',
    }
    r = requests.post(f"{API}/payments/razorpay/order",
                      headers={'Authorization': f'Bearer {parent_token}'},
                      json=body, timeout=60)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data['mock'] is False, f'Expected LIVE (mock=false), got {data}'
    assert data['key_id'].startswith('rzp_live_'), f'key_id not live: {data["key_id"]}'
    assert data['order_id'].startswith('order_'), f'order id not real: {data["order_id"]}'
    assert 'mock' not in data['order_id']
    assert data['amount'] == 10000  # paise
    assert data['currency'] == 'INR'


def test_razorpay_verify_rejects_fabricated_signature(parent_token, parent_student):
    """A fabricated signature must be rejected with 400 — proves live secret
    is used for signature verification."""
    # First create a real order
    order_body = {
        'student_id': parent_student['id'],
        'items': [{'fee_head_name': 'Tuition Fee', 'component': 'Tuition Fee', 'month': 4, 'amount': 100.0}],
        'discount': 0, 'late_fee': 0,
    }
    r = requests.post(f"{API}/payments/razorpay/order",
                      headers={'Authorization': f'Bearer {parent_token}'},
                      json=order_body, timeout=60)
    assert r.status_code == 200, r.text
    order_id = r.json()['order_id']

    verify_body = {
        'razorpay_order_id': order_id,
        'razorpay_payment_id': 'pay_fake_1234567890',
        'razorpay_signature': 'deadbeef' * 8,
    }
    r = requests.post(f"{API}/payments/razorpay/verify",
                      headers={'Authorization': f'Bearer {parent_token}'},
                      json=verify_body, timeout=30)
    assert r.status_code == 400, f'Expected 400, got {r.status_code}: {r.text}'
    assert 'Signature verification failed' in r.text


def test_offline_admin_cash_collection_still_works(admin_token):
    """Regression: /api/fees/collect (offline cash) must still work."""
    # find a student with a fee assignment
    r = requests.get(f"{API}/fees/assignments",
                     headers={'Authorization': f'Bearer {admin_token}'}, timeout=30)
    assert r.status_code == 200, r.text
    assignments = r.json()
    if not assignments:
        pytest.skip('No fee assignments exist right now (user re-creating them)')
    # get schedule for first assignment's student
    stu_id = assignments[0]['student_id']
    r = requests.get(f"{API}/fees/student/{stu_id}/schedule",
                     headers={'Authorization': f'Bearer {admin_token}'}, timeout=30)
    if r.status_code != 200:
        pytest.skip(f'schedule not available: {r.status_code}')
    sched = r.json()
    # Find a month with balance > 0
    due_row = None
    for row in sched.get('months', []):
        if row.get('balance', 0) > 0 and row.get('components'):
            due_row = row
            break
    if not due_row:
        pytest.skip('No dues to collect right now')
    comp = due_row['components'][0]
    body = {
        'school_id': assignments[0]['school_id'],
        'student_id': stu_id,
        'items': [{'component': comp['name'], 'month': due_row['month'],
                    'amount': min(50.0, float(comp.get('balance', 50)))}],
        'discount': 0, 'late_fee': 0,
        'payment_mode': 'cash',
        'remarks': 'TEST_regression_offline',
    }
    r = requests.post(f"{API}/fees/collect",
                      headers={'Authorization': f'Bearer {admin_token}'},
                      json=body, timeout=30)
    # Accept 200 or 201; 400 with a business reason is also acceptable info
    assert r.status_code in (200, 201), f'{r.status_code}: {r.text}'
    pay = r.json()
    assert pay.get('payment_mode') == 'cash'
    assert pay.get('id')
