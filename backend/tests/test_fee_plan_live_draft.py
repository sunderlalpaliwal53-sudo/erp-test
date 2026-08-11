"""Backend tests for LIVE/DRAFT fee plan behavior."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
SUPER_EMAIL = 'superadmin@stanvard.school'
SUPER_PASS = 'Stanvard@2026'


@pytest.fixture(scope='module')
def client():
    s = requests.Session()
    s.headers.update({'Content-Type': 'application/json'})
    r = s.post(f'{BASE_URL}/api/auth/login', json={'email': SUPER_EMAIL, 'password': SUPER_PASS})
    assert r.status_code == 200, f'login failed: {r.status_code} {r.text}'
    tok = r.json().get('access_token') or r.json().get('token')
    assert tok, f'no token in login response: {r.json()}'
    s.headers.update({'Authorization': f'Bearer {tok}'})
    # Pick KNP school
    r = s.get(f'{BASE_URL}/api/schools')
    assert r.status_code == 200, r.text
    schools = r.json()
    knp = None
    for sc in schools:
        name = (sc.get('name') or '').lower()
        code = (sc.get('code') or '').lower()
        if 'knp' in name or 'knp' in code:
            knp = sc
            break
    if not knp:
        knp = schools[0]
    s.headers.update({'X-School-Id': knp['id']})
    s.school_id = knp['id']
    return s


@pytest.fixture(scope='module')
def seed(client):
    tag = uuid.uuid4().hex[:6].upper()
    # Class
    r = client.post(f'{BASE_URL}/api/classes',
                    json={'name': f'LIVEDRAFT-{tag}', 'sections': ['A'], 'school_id': client.school_id})
    assert r.status_code in (200, 201), r.text
    cls = r.json()
    class_id = cls['id']

    # Student
    r = client.post(f'{BASE_URL}/api/students',
                    json={'full_name': f'LiveDraft Student {tag}', 'class_id': class_id,
                          'section': 'A', 'school_id': client.school_id})
    assert r.status_code in (200, 201), r.text
    student = r.json()

    # Fee head
    r = client.post(f'{BASE_URL}/api/fees/heads',
                    json={'name': f'Tuition LD {tag}', 'category': 'general',
                          'school_id': client.school_id})
    assert r.status_code in (200, 201), r.text
    head = r.json()
    return {'class_id': class_id, 'student_id': student['id'], 'head_id': head['id'],
            'head_name': head.get('name'), 'tag': tag}


def _plan_body(name, class_id, head_id, head_name, amount, school_id):
    return {
        'name': name,
        'school_id': school_id,
        'class_id': class_id,
        'academic_session': '2026-27',
        'annual_discount_percent': 0,
        'late_fee_amount': 0,
        'late_fee_after_day': 10,
        'items': [{
            'fee_head_id': head_id,
            'fee_head_name': head_name,
            'amount': amount,
            'frequency': 'monthly',
            'installments': 12,
        }],
    }


def test_first_plan_becomes_live_and_assigns(client, seed):
    body = _plan_body(f'Plan A {seed["tag"]}', seed['class_id'], seed['head_id'],
                      seed['head_name'], 12000, client.school_id)
    r = client.post(f'{BASE_URL}/api/fees/plans', json=body)
    assert r.status_code in (200, 201), r.text
    data = r.json()
    assert data['status'] == 'live', f"expected live, got {data.get('status')}"
    assert data.get('assigned_students', 0) >= 1, f"expected >=1 assigned, got {data.get('assigned_students')}"
    seed['plan_a_id'] = data['id']


def test_second_plan_becomes_draft_no_assign(client, seed):
    body = _plan_body(f'Plan B {seed["tag"]}', seed['class_id'], seed['head_id'],
                      seed['head_name'], 24000, client.school_id)
    r = client.post(f'{BASE_URL}/api/fees/plans', json=body)
    assert r.status_code in (200, 201), r.text
    data = r.json()
    assert data['status'] == 'draft', f"expected draft, got {data.get('status')}"
    assert data.get('assigned_students', 0) == 0, f"expected 0 assigned, got {data.get('assigned_students')}"
    seed['plan_b_id'] = data['id']


def test_only_one_live_per_class(client, seed):
    r = client.get(f'{BASE_URL}/api/fees/plans', params={'class_id': seed['class_id']})
    assert r.status_code == 200, r.text
    plans = r.json()
    same = [p for p in plans if p['id'] in (seed['plan_a_id'], seed['plan_b_id'])]
    assert len(same) == 2
    live = [p for p in same if p.get('status') == 'live']
    draft = [p for p in same if p.get('status') == 'draft']
    assert len(live) == 1 and live[0]['id'] == seed['plan_a_id']
    assert len(draft) == 1 and draft[0]['id'] == seed['plan_b_id']


def test_student_dues_reflect_plan_a(client, seed):
    r = client.get(f'{BASE_URL}/api/fees/student/{seed["student_id"]}/dues')
    assert r.status_code == 200, r.text
    d = r.json()
    total = d.get('total_expected', 0)
    assert 10000 <= total <= 14000, f'expected ~12000, got {total}'


def test_set_live_promotes_b_demotes_a(client, seed):
    r = client.post(f'{BASE_URL}/api/fees/plans/{seed["plan_b_id"]}/set-live')
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get('ok') is True
    assert d.get('status') == 'live'
    assert d.get('assigned_students', 0) >= 1

    # Verify list
    r = client.get(f'{BASE_URL}/api/fees/plans', params={'class_id': seed['class_id']})
    plans = {p['id']: p for p in r.json()}
    assert plans[seed['plan_b_id']]['status'] == 'live'
    assert plans[seed['plan_a_id']]['status'] == 'draft'


def test_student_dues_reflect_plan_b(client, seed):
    r = client.get(f'{BASE_URL}/api/fees/student/{seed["student_id"]}/dues')
    assert r.status_code == 200, r.text
    total = r.json().get('total_expected', 0)
    assert 22000 <= total <= 26000, f'expected ~24000, got {total}'


def test_edit_draft_does_not_touch_assignments(client, seed):
    # Plan A is now draft; patch it with a new late_fee
    body = _plan_body(f'Plan A {seed["tag"]}', seed['class_id'], seed['head_id'],
                      seed['head_name'], 12000, client.school_id)
    body['late_fee_amount'] = 99
    r = client.patch(f'{BASE_URL}/api/fees/plans/{seed["plan_a_id"]}', json=body)
    assert r.status_code == 200, r.text
    doc = r.json()
    assert doc.get('status') == 'draft'
    assert doc.get('assigned_students', 0) == 0

    # Student's dues still Plan B (~24000)
    r = client.get(f'{BASE_URL}/api/fees/student/{seed["student_id"]}/dues')
    assert r.status_code == 200
    total = r.json().get('total_expected', 0)
    assert 22000 <= total <= 26000, f'expected still ~24000, got {total}'


def test_edit_live_re_syncs_assignments(client, seed):
    # Plan B is live; change amount to 30000; assignments should reflect
    body = _plan_body(f'Plan B {seed["tag"]}', seed['class_id'], seed['head_id'],
                      seed['head_name'], 30000, client.school_id)
    r = client.patch(f'{BASE_URL}/api/fees/plans/{seed["plan_b_id"]}', json=body)
    assert r.status_code == 200, r.text
    doc = r.json()
    assert doc.get('status') == 'live'
    assert doc.get('assigned_students', 0) >= 1
    time.sleep(0.5)
    r = client.get(f'{BASE_URL}/api/fees/student/{seed["student_id"]}/dues')
    total = r.json().get('total_expected', 0)
    assert 28000 <= total <= 32000, f'expected ~30000, got {total}'
