"""Regression tests for the 'multi-assignment monthly fee merge' bug fix.

Bug: When a student had a recurring tuition assignment AND a one-time Books
assignment, the Monthly Fees view showed only the one-time fee and 'No Fee'
in other months. Expected: every month should show the SUM of all fees for
that month across all non-draft assignments.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')

SUPER_ADMIN = {'email': 'superadmin@stanvard.school', 'password': 'Stanvard@2026'}


@pytest.fixture(scope='module')
def admin_client():
    s = requests.Session()
    s.headers.update({'Content-Type': 'application/json'})
    r = s.post(f'{BASE_URL}/api/auth/login', json=SUPER_ADMIN)
    assert r.status_code == 200, f'login failed: {r.status_code} {r.text}'
    tok = r.json()['access_token']
    s.headers.update({'Authorization': f'Bearer {tok}'})
    # Pick KNP school
    schools = s.get(f'{BASE_URL}/api/schools').json()
    knp = next(x for x in schools if x.get('code') == 'KNP')
    s.headers.update({'X-School-Id': knp['id']})
    s.knp_id = knp['id']
    return s


@pytest.fixture(scope='module')
def target_student(admin_client):
    """Pick a KNP student that already has a non-draft assignment with
    installments (recurring tuition) AND does NOT already have a TEST_ books
    assignment."""
    students = admin_client.get(f'{BASE_URL}/api/students?limit=500').json()
    assert len(students) >= 100
    # Find one whose fee-schedule has active tuition in multiple months (baseline)
    for stu in students[:60]:
        sched = admin_client.get(
            f'{BASE_URL}/api/fees/student/{stu["id"]}/fee-schedule').json()
        active = [m for m in sched.get('schedule', [])
                  if m['status'] != 'no_fee' and m['amount'] > 0]
        if len(active) >= 8 and sched.get('annual_total', 0) > 0:
            return stu, sched
    pytest.skip('No KNP student with a full 10-month tuition assignment found')


def _cleanup_test_assignments(client, student_id):
    """Remove any assignments we created with the TEST_ marker."""
    ass = client.get(
        f'{BASE_URL}/api/fees/assignments?student_id={student_id}').json()
    for a in ass:
        if 'TEST_' in (a.get('remarks') or ''):
            client.delete(f'{BASE_URL}/api/fees/assignments/{a["id"]}')


class TestMonthlyFeeMerge:
    def test_baseline_tuition_shows_in_all_collection_months(self, target_student):
        _stu, sched = target_student
        active = [m for m in sched['schedule']
                  if m['status'] != 'no_fee' and m['amount'] > 0]
        # Should be 10 collection months
        assert len(active) == 10, f'baseline expected 10 active months, got {len(active)}'
        # June (6) and March (3) should be no_fee
        no_fee_months = {m['month'] for m in sched['schedule'] if m['status'] == 'no_fee'}
        assert 6 in no_fee_months and 3 in no_fee_months

    def test_add_one_time_books_fee_merges_correctly(self, admin_client, target_student):
        stu, base_sched = target_student
        _cleanup_test_assignments(admin_client, stu['id'])
        base_annual = round(base_sched['net_annual'], 2)
        base_active = [m for m in base_sched['schedule']
                       if m['status'] != 'no_fee' and m['amount'] > 0]
        base_month_amount = base_active[0]['amount']  # typical monthly tuition
        # First collection month for this session
        first_collection = min(base_active, key=lambda m: (m['year'], m['month']))
        first_year, first_month = first_collection['year'], first_collection['month']

        session = base_sched['academic_session']
        books_amount = 2000.0
        # Build installments: books charged fully in the FIRST collection month.
        installments = []
        for m in base_sched['schedule']:
            if m['year'] == first_year and m['month'] == first_month:
                installments.append({'year': m['year'], 'month': m['month'],
                                     'amount': books_amount, 'status': 'active',
                                     'due_date': f"{m['year']}-{m['month']:02d}-15"})
            else:
                installments.append({'year': m['year'], 'month': m['month'],
                                     'amount': 0.0, 'status': 'skip',
                                     'label': 'No Fee',
                                     'due_date': f"{m['year']}-{m['month']:02d}-15"})

        payload = {
            'student_id': stu['id'],
            'academic_session': session,
            'custom_items': [{
                'fee_head_id': None,
                'fee_head_name': 'Books Fee',
                'amount': books_amount,
                'frequency': 'one_time',
            }],
            'installments': installments,
            'discount_percent': 0,
            'discount_amount': 0,
            'remarks': f'TEST_books_{uuid.uuid4().hex[:6]}',
            'is_draft': False,
            'notify_parent': False,
        }
        r = admin_client.post(f'{BASE_URL}/api/fees/assignments', json=payload)
        assert r.status_code == 200, f'assignment create failed: {r.status_code} {r.text}'
        new_assign_id = r.json()['id']

        try:
            # Re-fetch the fee schedule
            sched = admin_client.get(
                f'{BASE_URL}/api/fees/student/{stu["id"]}/fee-schedule').json()

            # 1) Tuition still shows in every collection month, NOT "No Fee"
            active = [m for m in sched['schedule']
                      if m['status'] != 'no_fee' and m['amount'] > 0]
            assert len(active) == 10, (
                f'After adding one-time books, still expect 10 active months. '
                f'Got {len(active)}: {[(m["month"], m["amount"]) for m in sched["schedule"]]}')

            # 2) June and March still No Fee
            no_fee_months = {m['month'] for m in sched['schedule'] if m['status'] == 'no_fee'}
            assert 6 in no_fee_months, 'June should remain No Fee'
            assert 3 in no_fee_months, 'March should remain No Fee'

            # 3) The books month shows tuition + books combined
            books_month_entry = next(m for m in sched['schedule']
                                     if m['year'] == first_year and m['month'] == first_month)
            expected_combined = round(base_month_amount + books_amount, 2)
            assert abs(books_month_entry['amount'] - expected_combined) < 0.5, (
                f'Books month amount should be tuition({base_month_amount}) + books({books_amount}) '
                f'= {expected_combined}, got {books_month_entry["amount"]}')

            # 4) Other collection months keep tuition only
            other_active = [m for m in active
                            if not (m['year'] == first_year and m['month'] == first_month)]
            for m in other_active:
                assert abs(m['amount'] - base_month_amount) < 0.5, (
                    f'Non-books month {m["label"]} should still show tuition '
                    f'{base_month_amount}, got {m["amount"]}')

            # 5) Annual total & net_annual grew by books amount
            assert abs(sched['net_annual'] - (base_annual + books_amount)) < 1.0, (
                f'net_annual should grow by {books_amount}: base={base_annual}, '
                f'new={sched["net_annual"]}')

            # 6) Dues endpoint sanity: months_total still 10, total_expected includes books
            dues = admin_client.get(f'{BASE_URL}/api/fees/student/{stu["id"]}/dues').json()
            assert dues['months_total'] == 10
            assert dues['total_expected'] >= base_annual + books_amount - 1

        finally:
            admin_client.delete(f'{BASE_URL}/api/fees/assignments/{new_assign_id}')

    def test_regression_only_tuition_still_works(self, admin_client, target_student):
        """After cleanup, the tuition-only view should be unchanged."""
        stu, base_sched = target_student
        _cleanup_test_assignments(admin_client, stu['id'])
        sched = admin_client.get(
            f'{BASE_URL}/api/fees/student/{stu["id"]}/fee-schedule').json()
        active = [m for m in sched['schedule']
                  if m['status'] != 'no_fee' and m['amount'] > 0]
        assert len(active) == 10
        # Amount matches baseline (student had only tuition originally)
        assert abs(sched['net_annual'] - base_sched['net_annual']) < 1.0

    def test_report_student_fee_status_monthly_tokens(self, admin_client):
        """Regression: Reports > Student Fee Status still renders monthly tokens."""
        r = admin_client.get(f'{BASE_URL}/api/reports/fee-status')
        assert r.status_code == 200, f'{r.status_code} {r.text[:200]}'
        data = r.json()
        rows = data.get('rows') or data.get('students') or []
        assert len(rows) > 0, 'expected at least one row'
        sample = rows[0]
        assert 'monthly_status' in sample
        assert isinstance(sample['monthly_status'], list)
        assert len(sample['monthly_status']) == 12
