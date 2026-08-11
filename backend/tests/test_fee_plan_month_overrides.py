"""Tests for Issue 1 (June/March editable + arbitrary month skip via zero override)
and Issue 2 (plan installments endpoint provides the timeline the student
Assign-Fee dialog uses)."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://enterprise-ops-66.preview.emergentagent.com').rstrip('/')
ADMIN_EMAIL = 'admin@stanvard.school'
ADMIN_PASS = 'Admin@2026'


# ---------- fixtures ----------
@pytest.fixture(scope='module')
def admin_client():
    s = requests.Session()
    s.headers.update({'Content-Type': 'application/json'})
    r = s.post(f'{BASE_URL}/api/auth/login', json={'email': ADMIN_EMAIL, 'password': ADMIN_PASS})
    assert r.status_code == 200, r.text
    tok = r.json().get('token') or r.json().get('access_token')
    s.headers.update({'Authorization': f'Bearer {tok}'})
    return s


@pytest.fixture(scope='module')
def fee_head(admin_client):
    heads = admin_client.get(f'{BASE_URL}/api/fees/heads').json()
    if heads:
        return {'id': heads[0]['id'], 'name': heads[0].get('name', 'Fee')}
    r = admin_client.post(f'{BASE_URL}/api/fees/heads', json={'name': 'TEST_Tuition', 'category': 'tuition'})
    assert r.status_code in (200, 201)
    j = r.json()
    return {'id': j['id'], 'name': j.get('name', 'TEST_Tuition')}


created_plan_ids = []


def _create_plan(client, head, month_amounts, name='TEST_Plan_Overrides'):
    # No class_id -> avoids mass-assigning to real students.
    payload = {
        'name': name,
        'academic_session': '2026-27',
        'items': [{'fee_head_id': head['id'], 'fee_head_name': head['name'],
                   'amount': 50000, 'frequency': 'monthly'}],
        'month_amounts': month_amounts,
    }
    r = client.post(f'{BASE_URL}/api/fees/plans', json=payload)
    assert r.status_code in (200, 201), r.text
    pid = r.json().get('id')
    created_plan_ids.append(pid)
    return pid, r.json()


# ---------- tests ----------
class TestPlanMonthOverrides:

    def test_june_march_override_charged_may_zero_skipped(self, admin_client, fee_head):
        # June (6) = 2500 (charge), May (5) = 0 (skip), March (3) untouched -> still skip.
        month_amounts = [
            {'month': 6, 'amount': 2500},
            {'month': 5, 'amount': 0},
        ]
        pid, plan = _create_plan(admin_client, fee_head, month_amounts,
                                  name='TEST_Plan_June_Charge_May_Skip')
        # Fetch timeline
        r = admin_client.get(f'{BASE_URL}/api/fees/plans/{pid}/installments')
        assert r.status_code == 200, r.text
        installments = r.json()['installments']
        assert len(installments) == 12
        by_m = {int(i['month']): i for i in installments}

        # March = skip / No Fee (excluded, no override)
        assert by_m[3]['status'] == 'skip'
        assert by_m[3]['amount'] == 0.0
        # June = active with 2500 override
        assert by_m[6]['status'] == 'active', f"June expected active, got {by_m[6]}"
        assert by_m[6]['amount'] == 2500.0
        # May = zero override -> skip
        assert by_m[5]['status'] == 'skip'
        assert by_m[5]['amount'] == 0.0
        # Other months should carry equal split of 50000 across the original 10 collection months = 5000.
        # With May zeroed out, remaining months keep their equal split of 5000 (overrides do NOT redistribute).
        for m in [4, 7, 8, 9, 10, 11, 12, 1, 2]:
            assert by_m[m]['status'] == 'active', f"Month {m}: {by_m[m]}"
            assert by_m[m]['amount'] == 5000.0, f"Month {m}: got {by_m[m]['amount']}"

        # Sum sanity: 9 months x 5000 + June 2500 = 47500
        total = sum(i['amount'] for i in installments)
        assert total == 47500.0, f"Expected 47500, got {total}"

    def test_plain_plan_equal_split_skips_june_march(self, admin_client, fee_head):
        pid, _ = _create_plan(admin_client, fee_head, month_amounts=[],
                              name='TEST_Plan_Plain_50000')
        r = admin_client.get(f'{BASE_URL}/api/fees/plans/{pid}/installments')
        assert r.status_code == 200
        installments = r.json()['installments']
        by_m = {int(i['month']): i for i in installments}
        for m in (6, 3):
            assert by_m[m]['status'] == 'skip'
            assert by_m[m]['amount'] == 0.0
        active = [i for i in installments if i['status'] == 'active']
        assert len(active) == 10
        assert all(a['amount'] == 5000.0 for a in active)
        assert sum(a['amount'] for a in active) == 50000.0

    def test_installments_endpoint_rbac(self, admin_client, fee_head):
        # Unauthenticated -> 401
        pid, _ = _create_plan(admin_client, fee_head, month_amounts=[],
                              name='TEST_Plan_RBAC')
        r = requests.get(f'{BASE_URL}/api/fees/plans/{pid}/installments')
        assert r.status_code in (401, 403)

    def test_persistence_of_month_amounts(self, admin_client, fee_head):
        month_amounts = [{'month': 6, 'amount': 1234}, {'month': 5, 'amount': 0}]
        pid, _ = _create_plan(admin_client, fee_head, month_amounts,
                              name='TEST_Plan_Persist')
        # Re-fetch plan
        plans = admin_client.get(f'{BASE_URL}/api/fees/plans').json()
        p = next((x for x in plans if x['id'] == pid), None)
        assert p is not None
        by_m = {int(o['month']): float(o['amount']) for o in (p.get('month_amounts') or [])}
        assert by_m.get(6) == 1234.0
        assert by_m.get(5) == 0.0


# --- cleanup ---
def teardown_module(module):
    s = requests.Session()
    r = s.post(f'{BASE_URL}/api/auth/login', json={'email': ADMIN_EMAIL, 'password': ADMIN_PASS})
    if r.status_code != 200:
        return
    tok = r.json().get('token') or r.json().get('access_token')
    s.headers.update({'Authorization': f'Bearer {tok}', 'Content-Type': 'application/json'})
    for pid in created_plan_ids:
        try:
            s.delete(f'{BASE_URL}/api/fees/plans/{pid}')
        except Exception:
            pass
