"""Iteration 9: tests for the new duplicate endpoint, the one-time fee
double-count regression, and the classless-set-live 400 path."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://enterprise-ops-66.preview.emergentagent.com').rstrip('/')
ADMIN_EMAIL = 'admin@stanvard.school'
ADMIN_PASS = 'Admin@2026'
SUPER_EMAIL = 'superadmin@stanvard.school'
SUPER_PASS = 'Stanvard@2026'


def _login(email, pw):
    s = requests.Session()
    s.headers.update({'Content-Type': 'application/json'})
    r = s.post(f'{BASE_URL}/api/auth/login', json={'email': email, 'password': pw})
    assert r.status_code == 200, r.text
    tok = r.json().get('token') or r.json().get('access_token')
    s.headers.update({'Authorization': f'Bearer {tok}'})
    return s


@pytest.fixture(scope='module')
def admin_client():
    return _login(ADMIN_EMAIL, ADMIN_PASS)


@pytest.fixture(scope='module')
def fee_head(admin_client):
    heads = admin_client.get(f'{BASE_URL}/api/fees/heads').json()
    tuition = next((h for h in heads if 'tuition' in (h.get('category') or '').lower()), None) or heads[0]
    return {'id': tuition['id'], 'name': tuition.get('name', 'Fee')}


@pytest.fixture(scope='module')
def onetime_head(admin_client):
    heads = admin_client.get(f'{BASE_URL}/api/fees/heads').json()
    # pick a non-tuition head or create one
    non_t = next((h for h in heads if 'tuition' not in (h.get('category') or '').lower()), None)
    if non_t:
        return {'id': non_t['id'], 'name': non_t.get('name', 'Admission')}
    r = admin_client.post(f'{BASE_URL}/api/fees/heads',
                          json={'name': 'TEST_Admission', 'category': 'admission'})
    j = r.json()
    return {'id': j['id'], 'name': j['name']}


created_plan_ids = []


def _create_plan(client, payload):
    r = client.post(f'{BASE_URL}/api/fees/plans', json=payload)
    assert r.status_code in (200, 201), r.text
    p = r.json()
    created_plan_ids.append(p['id'])
    return p


# --------------- ONE-TIME + OVERRIDE (double-count regression) ----------
class TestOneTimeCompositionBackend:
    """Backend _build_plan_installments must add one-time on top of override,
    never double-count. Frontend stores override = typed - oneTime."""

    def test_untouched_april_shows_recurring_plus_onetime(self, admin_client, fee_head, onetime_head):
        # 37000 monthly + 5000 one-time in April, no month_amounts
        p = _create_plan(admin_client, {
            'name': 'TEST_OT_Untouched',
            'academic_session': '2026-27',
            'items': [
                {'fee_head_id': fee_head['id'], 'fee_head_name': fee_head['name'],
                 'amount': 37000, 'frequency': 'monthly'},
                {'fee_head_id': onetime_head['id'], 'fee_head_name': onetime_head['name'],
                 'amount': 5000, 'frequency': 'one_time', 'one_time_month': 4},
            ],
            'month_amounts': [],
        })
        inst = admin_client.get(f'{BASE_URL}/api/fees/plans/{p["id"]}/installments').json()['installments']
        by_m = {int(i['month']): i for i in inst}
        # April = 3700 recurring + 5000 one-time = 8700 (NEVER 13700)
        assert by_m[4]['amount'] == 8700.0, f"April got {by_m[4]}"
        # Other collection months = 3700
        for m in [5, 7, 8, 9, 10, 11, 12, 1, 2]:
            assert by_m[m]['amount'] == 3700.0, f"Month {m}: {by_m[m]['amount']}"
        # June & March skip
        assert by_m[6]['status'] == 'skip' and by_m[3]['status'] == 'skip'

    def test_retyping_displayed_value_no_double_count(self, admin_client, fee_head, onetime_head):
        """User types 8700 into April (same as displayed). Frontend stores
        override = 8700 - 5000 = 3700 (recurring part only). Backend must
        return April = 8700, NOT 13700."""
        p = _create_plan(admin_client, {
            'name': 'TEST_OT_Retype_Same',
            'academic_session': '2026-27',
            'items': [
                {'fee_head_id': fee_head['id'], 'fee_head_name': fee_head['name'],
                 'amount': 37000, 'frequency': 'monthly'},
                {'fee_head_id': onetime_head['id'], 'fee_head_name': onetime_head['name'],
                 'amount': 5000, 'frequency': 'one_time', 'one_time_month': 4},
            ],
            'month_amounts': [{'month': 4, 'amount': 3700}],  # recurring part only
        })
        inst = admin_client.get(f'{BASE_URL}/api/fees/plans/{p["id"]}/installments').json()['installments']
        by_m = {int(i['month']): i for i in inst}
        assert by_m[4]['amount'] == 8700.0, f"April got {by_m[4]['amount']}, expected 8700 (no double-count)"

    def test_typed_increase_stored_recurring_only(self, admin_client, fee_head, onetime_head):
        """User types 12000 into April. Frontend stores override = 7000
        (recurring). Backend must return April = 12000."""
        p = _create_plan(admin_client, {
            'name': 'TEST_OT_Increase',
            'academic_session': '2026-27',
            'items': [
                {'fee_head_id': fee_head['id'], 'fee_head_name': fee_head['name'],
                 'amount': 37000, 'frequency': 'monthly'},
                {'fee_head_id': onetime_head['id'], 'fee_head_name': onetime_head['name'],
                 'amount': 5000, 'frequency': 'one_time', 'one_time_month': 4},
            ],
            'month_amounts': [{'month': 4, 'amount': 7000}],
        })
        inst = admin_client.get(f'{BASE_URL}/api/fees/plans/{p["id"]}/installments').json()['installments']
        by_m = {int(i['month']): i for i in inst}
        assert by_m[4]['amount'] == 12000.0

    def test_plan_persists_month_amounts_recurring_only(self, admin_client, fee_head, onetime_head):
        p = _create_plan(admin_client, {
            'name': 'TEST_OT_Persist',
            'academic_session': '2026-27',
            'items': [
                {'fee_head_id': fee_head['id'], 'fee_head_name': fee_head['name'],
                 'amount': 37000, 'frequency': 'monthly'},
                {'fee_head_id': onetime_head['id'], 'fee_head_name': onetime_head['name'],
                 'amount': 5000, 'frequency': 'one_time', 'one_time_month': 4},
            ],
            'month_amounts': [{'month': 4, 'amount': 7000}],
        })
        plans = admin_client.get(f'{BASE_URL}/api/fees/plans').json()
        stored = next(x for x in plans if x['id'] == p['id'])
        m4 = next((o for o in (stored.get('month_amounts') or []) if int(o['month']) == 4), None)
        assert m4 is not None and float(m4['amount']) == 7000.0


# ------------------ DUPLICATE ENDPOINT ---------------------
class TestDuplicateEndpoint:

    def test_duplicate_creates_copy_draft(self, admin_client, fee_head):
        p = _create_plan(admin_client, {
            'name': 'TEST_Original',
            'academic_session': '2026-27',
            'items': [{'fee_head_id': fee_head['id'], 'fee_head_name': fee_head['name'],
                       'amount': 24000, 'frequency': 'monthly'}],
            'month_amounts': [{'month': 6, 'amount': 500}],
        })
        r = admin_client.post(f'{BASE_URL}/api/fees/plans/{p["id"]}/duplicate')
        assert r.status_code in (200, 201), r.text
        dup = r.json()
        created_plan_ids.append(dup['id'])
        assert dup['id'] != p['id']
        assert dup['name'].endswith('(Copy)')
        assert dup.get('status') == 'draft'
        assert dup.get('is_active') is False
        # items and month_amounts copied
        assert len(dup['items']) == len(p['items'])
        assert float(dup['items'][0]['amount']) == 24000.0
        m6 = next((o for o in (dup.get('month_amounts') or []) if int(o['month']) == 6), None)
        assert m6 and float(m6['amount']) == 500.0
        # original plan untouched
        plans = admin_client.get(f'{BASE_URL}/api/fees/plans').json()
        orig = next(x for x in plans if x['id'] == p['id'])
        assert orig['name'] == 'TEST_Original'

    def test_duplicate_404_unknown(self, admin_client):
        r = admin_client.post(f'{BASE_URL}/api/fees/plans/does-not-exist/duplicate')
        assert r.status_code == 404


# ------------------ SET-LIVE VALIDATION ---------------------
class TestSetLiveValidation:

    def test_set_live_classless_returns_400(self, admin_client, fee_head):
        p = _create_plan(admin_client, {
            'name': 'TEST_Classless_SetLive',
            'academic_session': '2026-27',
            'items': [{'fee_head_id': fee_head['id'], 'fee_head_name': fee_head['name'],
                       'amount': 12000, 'frequency': 'monthly'}],
            'month_amounts': [],
        })
        r = admin_client.post(f'{BASE_URL}/api/fees/plans/{p["id"]}/set-live')
        assert r.status_code == 400, r.text
        # Plan status should NOT have become live
        plans = admin_client.get(f'{BASE_URL}/api/fees/plans').json()
        stored = next(x for x in plans if x['id'] == p['id'])
        assert stored.get('status') != 'live'


def teardown_module(module):
    try:
        s = _login(ADMIN_EMAIL, ADMIN_PASS)
    except Exception:
        return
    for pid in created_plan_ids:
        try:
            s.delete(f'{BASE_URL}/api/fees/plans/{pid}')
        except Exception:
            pass
