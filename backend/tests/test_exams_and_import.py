"""Regression tests for new Exams / Marks / Report Cards / CSV import features."""
import io
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
API = f"{BASE_URL}/api"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login("admin.gn@stanvard.school", "admin123")


@pytest.fixture(scope="module")
def teacher_token():
    return _login("teacher.gn@stanvard.school", "teacher123")


@pytest.fixture(scope="module")
def parent_token():
    return _login("parent.gn20250001@stanvard.school", "parent123")


def H(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def gn_school_id(admin_token):
    r = requests.get(f"{API}/auth/me", headers=H(admin_token), timeout=15)
    return r.json().get("school_id")


@pytest.fixture(scope="module")
def gn_class(admin_token):
    r = requests.get(f"{API}/classes", headers=H(admin_token), timeout=15)
    assert r.status_code == 200
    classes = r.json()
    assert classes, "No classes seeded for GN"
    # prefer Class I
    for c in classes:
        if 'I' in (c.get('name') or '') and 'II' not in c.get('name', ''):
            return c
    return classes[0]


# ---------- 1. Existing seeded exam ----------
class TestSeededExam:
    def test_list_exams_has_half_yearly(self, admin_token):
        r = requests.get(f"{API}/exams", headers=H(admin_token), timeout=15)
        assert r.status_code == 200
        exams = r.json()
        names = [e.get('name') for e in exams]
        assert any('Half-Yearly' in n for n in names), f"Seeded exam missing. Got: {names}"

    def test_results_has_ranks(self, admin_token):
        r = requests.get(f"{API}/exams", headers=H(admin_token), timeout=15)
        exam = next(e for e in r.json() if 'Half-Yearly' in e.get('name', ''))
        rr = requests.get(f"{API}/exams/{exam['id']}/results", headers=H(admin_token), timeout=15)
        assert rr.status_code == 200
        data = rr.json()
        with_marks = [x for x in data['results'] if x['has_marks']]
        assert len(with_marks) >= 1
        for r_ in with_marks:
            assert 'rank' in r_
            assert 'percentage' in r_
            assert 'grade' in r_


# ---------- 2. Create exam + edge cases ----------
class TestExamCreate:
    def test_create_without_subjects_400(self, admin_token, gn_class):
        payload = {"name": f"TEST_NoSubj_{uuid.uuid4().hex[:6]}",
                   "class_id": gn_class['id'], "subjects": []}
        r = requests.post(f"{API}/exams", headers=H(admin_token), json=payload, timeout=15)
        assert r.status_code == 400

    def test_duplicate_subject_names_400(self, admin_token, gn_class):
        payload = {"name": f"TEST_Dup_{uuid.uuid4().hex[:6]}",
                   "class_id": gn_class['id'],
                   "subjects": [{"name": "Math", "max_marks": 100},
                                {"name": "math", "max_marks": 100}]}
        r = requests.post(f"{API}/exams", headers=H(admin_token), json=payload, timeout=15)
        assert r.status_code == 400

    def test_create_success(self, admin_token, gn_class):
        payload = {"name": f"TEST_Exam_{uuid.uuid4().hex[:6]}",
                   "class_id": gn_class['id'], "section": "A",
                   "subjects": [{"name": "TestSubj1", "max_marks": 50},
                                {"name": "TestSubj2", "max_marks": 100}]}
        r = requests.post(f"{API}/exams", headers=H(admin_token), json=payload, timeout=15)
        assert r.status_code == 200, r.text
        exam = r.json()
        assert exam['id']
        assert len(exam['subjects']) == 2
        # Verify persistence via list
        r2 = requests.get(f"{API}/exams", headers=H(admin_token), timeout=15)
        assert any(e['id'] == exam['id'] for e in r2.json())
        # Cleanup
        requests.delete(f"{API}/exams/{exam['id']}", headers=H(admin_token), timeout=15)


# ---------- 3. Marks entry edge cases ----------
class TestMarksEntry:
    @pytest.fixture(scope="class")
    def exam_ctx(self, admin_token, gn_class):
        payload = {"name": f"TEST_Marks_{uuid.uuid4().hex[:6]}",
                   "class_id": gn_class['id'], "section": "A",
                   "subjects": [{"name": "S1", "max_marks": 100},
                                {"name": "S2", "max_marks": 50}]}
        r = requests.post(f"{API}/exams", headers=H(admin_token), json=payload, timeout=15)
        assert r.status_code == 200
        exam = r.json()
        # get students
        d = requests.get(f"{API}/exams/{exam['id']}", headers=H(admin_token), timeout=15).json()
        yield exam, d.get('students', [])
        requests.delete(f"{API}/exams/{exam['id']}", headers=H(admin_token), timeout=15)

    def test_marks_above_max_400(self, admin_token, exam_ctx):
        exam, students = exam_ctx
        if not students:
            pytest.skip("no students in class")
        payload = {"entries": [{"student_id": students[0]['id'],
                                "marks": {"S1": 120, "S2": 40}}]}
        r = requests.post(f"{API}/exams/{exam['id']}/marks", headers=H(admin_token),
                          json=payload, timeout=15)
        assert r.status_code == 400

    def test_teacher_can_save_marks(self, teacher_token, exam_ctx):
        exam, students = exam_ctx
        if not students:
            pytest.skip("no students in class")
        payload = {"entries": [{"student_id": students[0]['id'],
                                "marks": {"S1": 80, "S2": 45}}]}
        r = requests.post(f"{API}/exams/{exam['id']}/marks", headers=H(teacher_token),
                          json=payload, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()['saved'] >= 1

    def test_results_totals_and_grade(self, admin_token, exam_ctx):
        exam, students = exam_ctx
        if not students:
            pytest.skip()
        r = requests.get(f"{API}/exams/{exam['id']}/results", headers=H(admin_token), timeout=15)
        assert r.status_code == 200
        found = next((x for x in r.json()['results'] if x['student_id'] == students[0]['id']), None)
        assert found and found['has_marks']
        assert found['total'] == 125.0
        assert found['max_total'] == 150.0
        # 83.33% -> A
        assert found['grade'] in ('A', 'A+')
        assert found['rank'] == 1


# ---------- 4. Report card + PDF ----------
class TestReportCard:
    def _first_exam(self, token):
        r = requests.get(f"{API}/exams", headers=H(token), timeout=15).json()
        return next((e for e in r if 'Half-Yearly' in e.get('name', '')), None)

    def test_report_card_json(self, admin_token):
        exam = self._first_exam(admin_token)
        assert exam
        # find a student with marks
        rr = requests.get(f"{API}/exams/{exam['id']}/results", headers=H(admin_token), timeout=15).json()
        sid = next(r['student_id'] for r in rr['results'] if r['has_marks'])
        r = requests.get(f"{API}/students/{sid}/report-card", headers=H(admin_token), timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data['student']['id'] == sid
        assert any(e['exam']['id'] == exam['id'] and e['marks_entered'] for e in data['exams'])

    def test_report_card_pdf(self, admin_token):
        exam = self._first_exam(admin_token)
        rr = requests.get(f"{API}/exams/{exam['id']}/results", headers=H(admin_token), timeout=15).json()
        sid = next(r['student_id'] for r in rr['results'] if r['has_marks'])
        r = requests.get(f"{API}/students/{sid}/report-card.pdf?exam_id={exam['id']}",
                        headers=H(admin_token), timeout=30)
        assert r.status_code == 200
        assert r.headers.get('content-type', '').startswith('application/pdf')
        assert r.content[:4] == b'%PDF'

    def test_parent_403_for_unlinked_child(self, parent_token, admin_token):
        # find a student NOT linked to parent
        me = requests.get(f"{API}/auth/me", headers=H(parent_token), timeout=15).json()
        linked = set(me.get('linked_student_ids') or [])
        if me.get('linked_student_id'):
            linked.add(me['linked_student_id'])
        # admin lists students
        stds = requests.get(f"{API}/students", headers=H(admin_token), timeout=15).json()
        other = next((s for s in stds if s['id'] not in linked), None)
        assert other, "need at least one unlinked student"
        r = requests.get(f"{API}/students/{other['id']}/report-card", headers=H(parent_token), timeout=15)
        assert r.status_code == 403

    def test_parent_can_access_own_child(self, parent_token):
        me = requests.get(f"{API}/auth/me", headers=H(parent_token), timeout=15).json()
        sid = (me.get('linked_student_ids') or [me.get('linked_student_id')])[0]
        r = requests.get(f"{API}/students/{sid}/report-card", headers=H(parent_token), timeout=15)
        assert r.status_code == 200


# ---------- 5. Publish/unpublish toggle ----------
class TestPublishToggle:
    def test_publish_toggle(self, admin_token, gn_class):
        payload = {"name": f"TEST_Pub_{uuid.uuid4().hex[:6]}",
                   "class_id": gn_class['id'],
                   "subjects": [{"name": "X", "max_marks": 100}]}
        r = requests.post(f"{API}/exams", headers=H(admin_token), json=payload, timeout=15)
        eid = r.json()['id']
        try:
            r2 = requests.patch(f"{API}/exams/{eid}", headers=H(admin_token),
                                json={"status": "published"}, timeout=15)
            assert r2.status_code == 200
            assert r2.json()['status'] == 'published'
            r3 = requests.patch(f"{API}/exams/{eid}", headers=H(admin_token),
                                json={"status": "scheduled"}, timeout=15)
            assert r3.json()['status'] == 'scheduled'
        finally:
            requests.delete(f"{API}/exams/{eid}", headers=H(admin_token), timeout=15)


# ---------- 6. CSV import ----------
class TestCSVImport:
    def test_import_valid_and_invalid_rows(self, admin_token, gn_class):
        cname = gn_class['name']
        tag = uuid.uuid4().hex[:6]
        csv_text = (
            "full_name,class_name,section,roll_number\n"
            f"TEST_Import_A_{tag},{cname},A,901\n"
            f"TEST_Import_B_{tag},NON_EXISTENT_CLASS,A,902\n"
            f",{cname},A,903\n"
            f"TEST_Import_C_{tag},{cname},B,904\n"
        )
        files = {'file': ('students.csv', csv_text.encode('utf-8'), 'text/csv')}
        r = requests.post(f"{API}/students/import", headers=H(admin_token), files=files, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data['created'] == 2, f"expected 2 created, got {data}"
        assert data['skipped'] == 2
        assert len(data['errors']) >= 2

    def test_import_missing_full_name_column_400(self, admin_token):
        csv_text = "name,class_name\nJohn,I\n"
        files = {'file': ('bad.csv', csv_text.encode('utf-8'), 'text/csv')}
        r = requests.post(f"{API}/students/import", headers=H(admin_token), files=files, timeout=15)
        assert r.status_code == 400


# ---------- 7. Regression smoke ----------
class TestSmoke:
    def test_students_list(self, admin_token):
        r = requests.get(f"{API}/students?limit=5", headers=H(admin_token), timeout=15)
        assert r.status_code == 200

    def test_receipts_list(self, admin_token):
        r = requests.get(f"{API}/receipts", headers=H(admin_token), timeout=15)
        assert r.status_code in (200, 404)  # tolerate absence
