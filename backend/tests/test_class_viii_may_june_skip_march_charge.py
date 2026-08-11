"""Iteration 8 — verifies the exact user-reported Class VIII scenario:
Plan total ₹37,000 (₹3,700 per active month) with month_amounts overrides
May=0 (skip), June=0 (skip), March=3700 (charge).
Expected timeline: May & June skip/0, March active/3700, all other months
(April, July..February) active/3700.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
ADMIN_EMAIL = 'admin@stanvard.school'
ADMIN_PASS = 'Admin@2026'

_created = []


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
    j = r.json()
    return {'id': j['id'], 'name': j.get('name', 'TEST_Tuition')}


def test_class_viii_37000_may_june_skip_march_charge(admin_client, fee_head):
    """Reproduces the user's reported plan: ₹37,000 with May/June skipped and March charged."""
    payload = {
        'name': 'TEST_Iter8_ClassVIII_37000',
        'academic_session': '2026-27',
        'items': [{'fee_head_id': fee_head['id'], 'fee_head_name': fee_head['name'],
                   'amount': 37000, 'frequency': 'monthly'}],
        'month_amounts': [
            {'month': 5, 'amount': 0},
            {'month': 6, 'amount': 0},
            {'month': 3, 'amount': 3700},
        ],
    }
    r = admin_client.post(f'{BASE_URL}/api/fees/plans', json=payload)
    assert r.status_code in (200, 201), r.text
    pid = r.json()['id']
    _created.append(pid)

    r = admin_client.get(f'{BASE_URL}/api/fees/plans/{pid}/installments')
    assert r.status_code == 200
    installments = r.json()['installments']
    by_m = {int(i['month']): i for i in installments}

    # May and June — skipped
    for m in (5, 6):
        assert by_m[m]['status'] == 'skip', f"Month {m}: {by_m[m]}"
        assert by_m[m]['amount'] == 0.0

    # March — CHARGED at 3700 (this was the bug — dialog dropped this)
    assert by_m[3]['status'] == 'active', f"March expected active, got {by_m[3]}"
    assert by_m[3]['amount'] == 3700.0

    # All other months active at 3700
    for m in (4, 7, 8, 9, 10, 11, 12, 1, 2):
        assert by_m[m]['status'] == 'active', f"Month {m}: {by_m[m]}"
        assert by_m[m]['amount'] == 3700.0

    total = sum(i['amount'] for i in installments)
    # 10 active months × 3700 = 37000
    assert total == 37000.0, f"Expected 37000, got {total}"


def teardown_module(module):
    s = requests.Session()
    r = s.post(f'{BASE_URL}/api/auth/login', json={'email': ADMIN_EMAIL, 'password': ADMIN_PASS})
    if r.status_code != 200:
        return
    tok = r.json().get('token') or r.json().get('access_token')
    s.headers.update({'Authorization': f'Bearer {tok}', 'Content-Type': 'application/json'})
    for pid in _created:
        try:
            s.delete(f'{BASE_URL}/api/fees/plans/{pid}')
        except Exception:
            pass
