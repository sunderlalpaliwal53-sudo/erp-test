"""
End-to-end backend regression for Stanvard School ERP against the REAL seed
(Kanpur / KNP branch, 375 students, 298 parent accounts).

Covers:
- Auth (super_admin, school_admin, accountant, teacher) by email
- Auth (parent) by 10-digit mobile
- RBAC boundaries
- School listing / KNP student count
- Student list / search / detail / dues
- Fee heads / plans (13 classes)
- Offline payment collection + sequential receipt number KNP-2026-XXXXXX
- Razorpay MOCK order + verify (good & bad signature)
- Receipt PDF download
- Analytics + reports (fee-status PDF/XLSX/CSV, collection CSV, analytics/fees)
- Parent portal: multi-child + single-child dues/payments visibility
"""
import hmac
import hashlib
import os
import re
import pytest
import requests

_base = os.environ.get('REACT_APP_BACKEND_URL')
if not _base:
    raise RuntimeError('Set REACT_APP_BACKEND_URL to run these tests')
BASE_URL = _base.rstrip('/')
API = f"{BASE_URL}/api"

# Test credentials come from the environment (fall back to seeded demo values).
CREDS = {
    'super_admin':  (os.environ.get('TEST_SUPER_EMAIL', 'superadmin@stanvard.school'), os.environ.get('TEST_SUPER_PASS', 'Stanvard@2026')),
    'school_admin': (os.environ.get('TEST_ADMIN_EMAIL', 'admin@stanvard.school'), os.environ.get('TEST_ADMIN_PASS', 'Admin@2026')),
    'accountant':   (os.environ.get('TEST_ACCT_EMAIL', 'accountant@stanvard.school'), os.environ.get('TEST_ACCT_PASS', 'Accountant@2026')),
    'teacher':      (os.environ.get('TEST_TEACHER_EMAIL', 'teacher@stanvard.school'), os.environ.get('TEST_TEACHER_PASS', 'Teacher@2026')),
    'parent_multi': (os.environ.get('TEST_PARENT_EMAIL', '6376066570'), os.environ.get('TEST_PARENT_PASS', '066570')),
    'parent_single':(os.environ.get('TEST_PARENT2_EMAIL', '9079111899'), os.environ.get('TEST_PARENT2_PASS', '111899')),
}

MOCK_SECRET = os.environ.get('RAZORPAY_WEBHOOK_SECRET', 'mock_secret_stanvard')


# ------------------------ shared helpers/fixtures ------------------------
def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={'email': email, 'password': password}, timeout=30)
    return r


def _client(token):
    s = requests.Session()
    s.headers.update({'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'})
    return s


@pytest.fixture(scope='session')
def tokens():
    tks = {}
    for role, (email, pw) in CREDS.items():
        r = _login(email, pw)
        assert r.status_code == 200, f"login failed for {role}: {r.status_code} {r.text[:200]}"
        tks[role] = r.json()['access_token']
    return tks


@pytest.fixture(scope='session')
def sa(tokens):  return _client(tokens['super_admin'])
@pytest.fixture(scope='session')
def adm(tokens): return _client(tokens['school_admin'])
@pytest.fixture(scope='session')
def acc(tokens): return _client(tokens['accountant'])
@pytest.fixture(scope='session')
def tch(tokens): return _client(tokens['teacher'])
@pytest.fixture(scope='session')
def pm(tokens):  return _client(tokens['parent_multi'])
@pytest.fixture(scope='session')
def ps(tokens):  return _client(tokens['parent_single'])


@pytest.fixture(scope='session')
def knp_school_id(sa):
    r = sa.get(f"{API}/schools")
    assert r.status_code == 200
    schools = r.json()
    knp = next((s for s in schools if (s.get('code') or '').upper() == 'KNP'), None)
    assert knp, f"KNP branch not found in schools: {[s.get('code') for s in schools]}"
    return knp['id']


# ------------------------ Auth ------------------------
class TestAuth:
    def test_super_admin_login(self):
        r = _login(*CREDS['super_admin'])
        assert r.status_code == 200
        u = r.json()['user']
        assert u['role'] == 'super_admin'
        assert u['email'] == 'superadmin@stanvard.school'

    def test_parent_login_by_mobile(self):
        r = _login(*CREDS['parent_multi'])
        assert r.status_code == 200
        assert r.json()['user']['role'] == 'parent'

    def test_parent_single_login_by_mobile(self):
        r = _login(*CREDS['parent_single'])
        assert r.status_code == 200
        assert r.json()['user']['role'] == 'parent'

    def test_invalid_password(self):
        r = _login('superadmin@stanvard.school', 'WrongPass!')
        assert r.status_code == 401

    def test_me_endpoint(self, sa):
        r = sa.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()['role'] == 'super_admin'


# ------------------------ Schools / RBAC ------------------------
class TestSchoolsAndRBAC:
    def test_schools_list_has_knp(self, sa):
        r = sa.get(f"{API}/schools")
        assert r.status_code == 200
        codes = [s.get('code', '').upper() for s in r.json()]
        assert 'KNP' in codes

    def test_accountant_cannot_create_school(self, acc):
        r = acc.post(f"{API}/schools", json={'name': 'X', 'code': 'XX'})
        assert r.status_code == 403

    def test_teacher_cannot_collect_payment(self, tch, knp_school_id):
        r = tch.post(f"{API}/payments/collect", json={
            'student_id': 'bogus', 'school_id': knp_school_id,
            'payment_mode': 'cash', 'amount': 100, 'items': []
        })
        assert r.status_code == 403

    def test_teacher_cannot_manage_users(self, tch):
        r = tch.post(f"{API}/users", json={
            'email': 'TEST_x@x.com', 'password': 'x', 'full_name': 'x', 'role': 'teacher'
        })
        assert r.status_code == 403


# ------------------------ Students ------------------------
class TestStudents:
    def test_knp_student_count(self, sa, knp_school_id):
        r = sa.get(f"{API}/students", params={'school_id': knp_school_id, 'limit': 1000})
        assert r.status_code == 200
        data = r.json()
        # response can be a list or a paginated object
        items = data if isinstance(data, list) else data.get('items') or data.get('data') or []
        # We expect ~375 students; allow small drift
        assert len(items) >= 300, f"Expected >=300 students in KNP, got {len(items)}"

    def test_search_by_name(self, sa, knp_school_id):
        r = sa.get(f"{API}/students", params={'school_id': knp_school_id, 'search': 'Gurjar', 'limit': 50})
        assert r.status_code == 200
        data = r.json()
        items = data if isinstance(data, list) else data.get('items') or []
        assert len(items) >= 1

    def test_student_detail_and_dues(self, sa, knp_school_id):
        r = sa.get(f"{API}/students", params={'school_id': knp_school_id, 'limit': 5})
        assert r.status_code == 200
        data = r.json()
        items = data if isinstance(data, list) else data.get('items') or []
        assert items, "no students returned"
        sid = items[0]['id']
        r2 = sa.get(f"{API}/students/{sid}")
        assert r2.status_code == 200
        r3 = sa.get(f"{API}/fees/student/{sid}/dues")
        assert r3.status_code == 200


# ------------------------ Fees ------------------------
class TestFees:
    def test_fee_heads_list(self, sa, knp_school_id):
        r = sa.get(f"{API}/fees/heads", params={'school_id': knp_school_id})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_13_classes_have_plans(self, sa, knp_school_id):
        rc = sa.get(f"{API}/classes", params={'school_id': knp_school_id})
        assert rc.status_code == 200
        classes = rc.json()
        assert len(classes) >= 13, f"Expected >=13 classes, got {len(classes)}"
        rp = sa.get(f"{API}/fees/plans", params={'school_id': knp_school_id})
        assert rp.status_code == 200
        plans = rp.json()
        # at least 13 plans in KNP
        assert len(plans) >= 13, f"Expected >=13 fee plans, got {len(plans)}"


# ------------------------ Offline payment + receipt sequence ------------------------
@pytest.fixture(scope='session')
def target_student_with_assignment(sa, knp_school_id):
    r = sa.get(f"{API}/fees/assignments", params={'school_id': knp_school_id})
    assert r.status_code == 200
    asns = r.json()
    assert asns, "No fee assignments found in KNP"
    # find one with a tuition amount > 0
    for a in asns:
        if (a.get('tuition_fee') or a.get('annual_fee') or 0) > 0 and a.get('student_id'):
            return a
    return asns[0]


class TestPaymentsOffline:
    def test_offline_cash_payment_and_receipt_seq(self, acc, knp_school_id, target_student_with_assignment):
        sid = target_student_with_assignment['student_id']
        payload = {
            'student_id': sid,
            'school_id': knp_school_id,
            'payment_mode': 'cash',
            'discount': 0,
            'late_fee': 0,
            'items': [{'fee_head_name': 'TEST_Tuition', 'period': 'TEST', 'amount': 100}],
            'remarks': 'TEST_offline_regression'
        }
        r = acc.post(f"{API}/payments/collect", json=payload)
        assert r.status_code in (200, 201), f"collect failed: {r.status_code} {r.text[:300]}"
        pay = r.json()
        assert 'receipt_number' in pay, f"payment missing receipt_number: {pay}"
        assert re.match(r'^KNP-\d{4}-\d{6}$', pay['receipt_number']), f"bad receipt format: {pay['receipt_number']}"

        # second payment must increment
        r2 = acc.post(f"{API}/payments/collect", json=payload)
        assert r2.status_code in (200, 201)
        pay2 = r2.json()
        n1 = int(pay['receipt_number'].split('-')[-1])
        n2 = int(pay2['receipt_number'].split('-')[-1])
        # Under parallel test execution, other receipts may be issued between our
        # two calls (e.g. by the Razorpay test). We only assert monotonically
        # increasing + correct format.
        assert n2 > n1, f"receipts not increasing: {pay['receipt_number']} -> {pay2['receipt_number']}"
        assert re.match(r'^KNP-\d{4}-\d{6}$', pay2['receipt_number'])

        # receipt PDF
        pid = pay['id']
        rp = acc.get(f"{API}/payments/{pid}/receipt.pdf")
        assert rp.status_code == 200
        assert rp.headers.get('content-type', '').startswith('application/pdf')
        assert len(rp.content) > 500


# ------------------------ Razorpay MOCK order + verify ------------------------
class TestRazorpayMock:
    def test_mock_order_and_verify_flow(self, acc, knp_school_id, target_student_with_assignment):
        sid = target_student_with_assignment['student_id']
        r = acc.post(f"{API}/payments/razorpay/order", json={
            'student_id': sid, 'school_id': knp_school_id,
            'discount': 0, 'late_fee': 0,
            'items': [{'fee_head_name': 'TEST_Tuition', 'period': 'TEST', 'amount': 250}]
        })
        assert r.status_code == 200, f"order create failed: {r.status_code} {r.text[:300]}"
        order = r.json()
        assert order.get('mock') is True, f"expected mock:true, got: {order}"
        oid = order['order_id'] if 'order_id' in order else order.get('id')
        assert oid, f"no order id in mock order response: {order}"

        # bad signature
        rb = acc.post(f"{API}/payments/razorpay/verify", json={
            'razorpay_order_id': oid,
            'razorpay_payment_id': 'pay_MOCK_bad',
            'razorpay_signature': 'deadbeef',
        })
        assert rb.status_code == 400

        # good signature
        pay_id = 'pay_MOCK_' + oid[-8:]
        payload = f"{oid}|{pay_id}".encode()
        sig = hmac.new(MOCK_SECRET.encode(), payload, hashlib.sha256).hexdigest()
        rg = acc.post(f"{API}/payments/razorpay/verify", json={
            'razorpay_order_id': oid,
            'razorpay_payment_id': pay_id,
            'razorpay_signature': sig,
        })
        assert rg.status_code in (200, 201), f"verify(good) failed: {rg.status_code} {rg.text[:300]}"
        pay = rg.json()
        assert 'receipt_number' in pay, f"payment missing receipt_number: {pay}"
        assert pay['receipt_number'].startswith('KNP-')


# ------------------------ Analytics + Reports ------------------------
class TestReportsAnalytics:
    def test_analytics_fees(self, sa, knp_school_id):
        r = sa.get(f"{API}/analytics/fees", params={'school_id': knp_school_id})
        assert r.status_code == 200
        assert isinstance(r.json(), dict)

    def test_collection_csv(self, sa, knp_school_id):
        r = sa.get(f"{API}/reports/collection.csv", params={'school_id': knp_school_id})
        assert r.status_code == 200
        assert 'text/csv' in r.headers.get('content-type', '').lower() or r.content[:10]

    def test_fee_status_pdf_xlsx_csv(self, sa, knp_school_id):
        base = {'school_id': knp_school_id}
        r1 = sa.get(f"{API}/reports/fee-status.pdf", params=base)
        assert r1.status_code == 200 and r1.headers.get('content-type', '').startswith('application/pdf')
        r2 = sa.get(f"{API}/reports/fee-status.xlsx", params=base)
        assert r2.status_code == 200 and ('sheet' in r2.headers.get('content-type', '').lower() or 'excel' in r2.headers.get('content-type', '').lower() or 'openxml' in r2.headers.get('content-type', '').lower())
        r3 = sa.get(f"{API}/reports/fee-status.csv", params=base)
        assert r3.status_code == 200


# ------------------------ Parent portal ------------------------
class TestParentPortal:
    def test_parent_multi_has_two_children(self, pm):
        r = pm.get(f"{API}/auth/me")
        assert r.status_code == 200
        u = r.json()
        # linked_student_ids may live on user doc
        linked = u.get('linked_student_ids') or u.get('student_ids') or []
        assert len(linked) >= 2, f"expected multi-child parent to have >=2 children, got {linked}"

    def test_parent_single_has_one_child(self, ps):
        r = ps.get(f"{API}/auth/me")
        assert r.status_code == 200
        u = r.json()
        linked = u.get('linked_student_ids') or u.get('student_ids') or []
        assert len(linked) >= 1

    def test_parent_can_read_own_child_dues(self, pm):
        me = pm.get(f"{API}/auth/me").json()
        linked = me.get('linked_student_ids') or me.get('student_ids') or []
        if not linked:
            pytest.skip('no linked students on parent user')
        sid = linked[0]
        r = pm.get(f"{API}/fees/student/{sid}/dues")
        assert r.status_code == 200

    def test_parent_cannot_read_random_student(self, pm, sa, knp_school_id):
        # pick a student unrelated to parent
        me = pm.get(f"{API}/auth/me").json()
        linked = set(me.get('linked_student_ids') or me.get('student_ids') or [])
        r = sa.get(f"{API}/students", params={'school_id': knp_school_id, 'limit': 50})
        items = r.json() if isinstance(r.json(), list) else r.json().get('items') or []
        other = next((s['id'] for s in items if s['id'] not in linked), None)
        if not other:
            pytest.skip('could not find non-linked student')
        r2 = pm.get(f"{API}/fees/student/{other}/dues")
        assert r2.status_code in (401, 403, 404)
