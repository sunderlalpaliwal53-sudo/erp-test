"""Tests for Twilio messaging endpoints (status, pending, fee-reminders, test).

Trial-account behavior: sends to unverified numbers fail with Twilio 21608/422.
Each attempt should still be logged and returned gracefully.
"""
import os
import re
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
API = f"{BASE_URL}/api"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={'email': email, 'password': password}, timeout=30)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()['access_token']


@pytest.fixture(scope='module')
def admin_headers():
    return {'Authorization': f'Bearer {_login("admin@stanvard.school", "Admin@2026")}'}


@pytest.fixture(scope='module')
def accountant_headers():
    return {'Authorization': f'Bearer {_login("accountant@stanvard.school", "Accountant@2026")}'}


@pytest.fixture(scope='module')
def parent_headers():
    tok = _login('6376066570', '066570')
    return {'Authorization': f'Bearer {tok}'}


@pytest.fixture(scope='module')
def classes(admin_headers):
    r = requests.get(f"{API}/classes", headers=admin_headers, timeout=30)
    assert r.status_code == 200
    return r.json()


# ---- /messaging/status ----
def test_status_configured(admin_headers):
    r = requests.get(f"{API}/messaging/status", headers=admin_headers, timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d['configured'] is True
    assert set(d['channels']) == {'sms', 'whatsapp'}
    assert 'Trial' in d.get('note', '') or 'trial' in d.get('note', '')


# ---- /messaging/pending ----
def test_pending_month_8_has_rows(admin_headers):
    r = requests.get(f"{API}/messaging/pending", params={'month': 8}, headers=admin_headers, timeout=90)
    assert r.status_code == 200
    d = r.json()
    assert d['count'] > 0, f"expected pending>0 for August, got {d['count']}"
    assert d['rows'], 'rows should be present'
    row = d['rows'][0]
    for k in ('student_name', 'class_name', 'phone', 'remaining', 'label'):
        assert k in row, f"row missing key {k}"


def test_pending_lkg_is_zero(admin_headers, classes):
    lkg = next((c for c in classes if c.get('name', '').strip().upper() == 'LKG'), None)
    if not lkg:
        pytest.skip('LKG class not found')
    r = requests.get(f"{API}/messaging/pending",
                     params={'month': 8, 'class_id': lkg['id']},
                     headers=admin_headers, timeout=60)
    assert r.status_code == 200
    assert r.json()['count'] == 0


def test_pending_class_ii_has_rows(admin_headers, classes):
    cls2 = next((c for c in classes if c.get('name', '').strip().lower() in ('class ii', 'ii', 'class 2')), None)
    if not cls2:
        pytest.skip('Class II not found')
    r = requests.get(f"{API}/messaging/pending",
                     params={'month': 8, 'class_id': cls2['id']},
                     headers=admin_headers, timeout=60)
    assert r.status_code == 200
    assert r.json()['count'] > 0


# ---- /messaging/test ----
def test_messaging_test_returns_json_error_on_trial(admin_headers):
    r = requests.post(f"{API}/messaging/test",
                      params={'phone': '9999999999', 'channel': 'sms'},
                      headers=admin_headers, timeout=60)
    assert r.status_code == 200, f"expected 200 JSON, got {r.status_code}: {r.text[:200]}"
    assert 'application/json' in r.headers.get('content-type', '')
    d = r.json()
    assert d['ok'] is False
    assert d.get('error'), 'error text should be present'
    # Trial rejection mentions verified/unverified recipient
    assert re.search(r'verif|21608|unverified', d['error'], re.I), f"unexpected error: {d['error']}"


def test_messaging_test_invalid_phone(admin_headers):
    r = requests.post(f"{API}/messaging/test",
                      params={'phone': 'abc', 'channel': 'sms'},
                      headers=admin_headers, timeout=30)
    assert r.status_code == 400


# ---- /messaging/fee-reminders ----
def test_fee_reminders_class_ii_graceful_failures(admin_headers, classes):
    cls2 = next((c for c in classes if c.get('name', '').strip().lower() in ('class ii', 'ii', 'class 2')), None)
    if not cls2:
        pytest.skip('Class II not found')
    r = requests.post(f"{API}/messaging/fee-reminders",
                     json={'month': 8, 'channel': 'sms', 'class_id': cls2['id']},
                     headers=admin_headers, timeout=180)
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:300]}"
    d = r.json()
    assert d['pending_count'] > 0
    # On trial, every send fails (unless a number is verified) so failed+sent+skipped == pending_count
    assert d['sent'] + d['failed'] + d['skipped'] == d['pending_count']
    # Expect at least some failures (trial) with error text
    failed_entries = [e for e in d['results'] if not e['sent']]
    assert failed_entries, 'expected at least one failed entry'
    e0 = failed_entries[0]
    # error may be in top-level or per-channel
    err_texts = [e0.get('error')] + [c.get('error') for c in (e0.get('channels') or {}).values()]
    assert any(err_texts), 'expected Twilio error text on failed entry'


def test_fee_reminders_bad_month(admin_headers):
    r = requests.post(f"{API}/messaging/fee-reminders",
                      json={'month': 13, 'channel': 'sms'},
                      headers=admin_headers, timeout=30)
    assert r.status_code in (400, 422)


def test_fee_reminders_bad_channel(admin_headers):
    r = requests.post(f"{API}/messaging/fee-reminders",
                      json={'month': 8, 'channel': 'pigeon'},
                      headers=admin_headers, timeout=30)
    assert r.status_code in (400, 422)


def test_accountant_can_send_reminders(accountant_headers, classes):
    lkg = next((c for c in classes if c.get('name', '').strip().upper() == 'LKG'), None)
    cid = lkg['id'] if lkg else None
    r = requests.post(f"{API}/messaging/fee-reminders",
                      json={'month': 8, 'channel': 'sms', 'class_id': cid},
                      headers=accountant_headers, timeout=60)
    assert r.status_code == 200, f"accountant should be allowed, got {r.status_code}: {r.text[:200]}"


def test_parent_forbidden_on_test_endpoint(parent_headers):
    r = requests.post(f"{API}/messaging/test",
                      params={'phone': '9999999999', 'channel': 'sms'},
                      headers=parent_headers, timeout=30)
    assert r.status_code == 403


def test_parent_forbidden_on_reminders(parent_headers):
    r = requests.post(f"{API}/messaging/fee-reminders",
                      json={'month': 8, 'channel': 'sms'},
                      headers=parent_headers, timeout=30)
    assert r.status_code == 403
