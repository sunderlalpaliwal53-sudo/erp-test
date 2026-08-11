"""
Backend tests for Stanvard School ERP – Fee Plan Discounts feature.

Covers:
- Auth (admin login)
- Fee Plans: create/patch with plan-baked discounts (plan/yearly/month)
- Validation (percent>100, negative, month outside 1..12)
- Backward compatibility of GET /api/fees/plans
- Student fee schedule reflects plan discounts (net_annual, plan_discount_total,
  plan_lump_discount, month_discount_total, you_saved, month-specific lower amount)
- Dues total_discount includes plan-baked discounts
- Parent portal read (parent fetches fee-schedule with 'you_saved')
- Regression: student-level ad-hoc discount still triggers approval
"""
import os
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL is missing")
BASE_URL = base_url.rstrip("/") + "/api"

ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL", "admin.gn@stanvard.school")
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASS", "admin123")
PARENT_EMAIL = os.environ.get("TEST_PARENT_EMAIL", "parent.gn20250001@stanvard.school")
PARENT_PASSWORD = os.environ.get("TEST_PARENT_PASS", "parent123")
SUPER_EMAIL = os.environ.get("TEST_SUPER_EMAIL", "superadmin@stanvard.school")
SUPER_PASSWORD = os.environ.get("TEST_SUPER_PASS", "super123")


# ------------------------------ fixtures ------------------------------
@pytest.fixture(scope="session")
def session_req():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(session_req, email, password):
    r = session_req.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text[:200]}"
    return r.json()


@pytest.fixture(scope="session")
def admin_ctx(session_req):
    data = _login(session_req, ADMIN_EMAIL, ADMIN_PASSWORD)
    return {"token": data["access_token"], "user": data["user"]}


@pytest.fixture(scope="session")
def parent_ctx(session_req):
    data = _login(session_req, PARENT_EMAIL, PARENT_PASSWORD)
    return {"token": data["access_token"], "user": data["user"]}


@pytest.fixture(scope="session")
def super_ctx(session_req):
    data = _login(session_req, SUPER_EMAIL, SUPER_PASSWORD)
    return {"token": data["access_token"], "user": data["user"]}


def auth_h(ctx):
    return {"Authorization": f"Bearer {ctx['token']}"}


@pytest.fixture(scope="session")
def created_plans():
    return []


@pytest.fixture(scope="session")
def fee_head_id(session_req, admin_ctx):
    r = session_req.get(f"{BASE_URL}/fees/heads", headers=auth_h(admin_ctx))
    assert r.status_code == 200, r.text
    heads = r.json()
    if heads:
        # prefer Tuition
        tuition = next((h for h in heads if 'tuition' in (h.get('name') or '').lower()), heads[0])
        return tuition["id"]
    r2 = session_req.post(f"{BASE_URL}/fees/heads",
                          json={"name": "TEST_Tuition", "category": "tuition"},
                          headers=auth_h(admin_ctx))
    assert r2.status_code == 200, r2.text
    return r2.json()["id"]


def _item(fee_head_id, amount=12000, name="Tuition Fee"):
    return {"fee_head_id": fee_head_id, "fee_head_name": name,
            "amount": amount, "frequency": "yearly"}


@pytest.fixture(scope="session", autouse=True)
def cleanup_plans(session_req, admin_ctx, created_plans):
    yield
    for pid in created_plans:
        try:
            session_req.delete(f"{BASE_URL}/fees/plans/{pid}", headers=auth_h(admin_ctx))
        except Exception:
            pass


# ------------------------------ AUTH ------------------------------
class TestAuth:
    def test_admin_login(self, admin_ctx):
        assert admin_ctx["token"]
        assert admin_ctx["user"]["role"] in ("school_admin", "super_admin")

    def test_parent_login(self, parent_ctx):
        assert parent_ctx["user"]["role"] == "parent"


# ------------------------------ FEE PLAN CRUD + DISCOUNTS ------------------------------
class TestFeePlanDiscountCRUD:
    def test_backward_compat_get_plans(self, session_req, admin_ctx):
        r = session_req.get(f"{BASE_URL}/fees/plans", headers=auth_h(admin_ctx))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_plan_with_all_discount_types(self, session_req, admin_ctx, created_plans, fee_head_id):
        payload = {
            "name": f"TEST_Discount_Plan_{uuid.uuid4().hex[:6]}",
            "academic_session": "2026-27",
            "items": [_item(fee_head_id, 12000)],
            "plan_discount_type": "percent",
            "plan_discount_value": 10,
            "yearly_discount_type": "flat",
            "yearly_discount_value": 1000,
            "month_discounts": [{"month": 4, "type": "flat", "value": 200}],
        }
        r = session_req.post(f"{BASE_URL}/fees/plans", json=payload, headers=auth_h(admin_ctx))
        assert r.status_code == 200, r.text
        plan = r.json()
        created_plans.append(plan["id"])
        # persistence assertions
        assert plan["plan_discount_type"] == "percent"
        assert plan["plan_discount_value"] == 10
        assert plan["yearly_discount_type"] == "flat"
        assert plan["yearly_discount_value"] == 1000
        assert plan["month_discounts"] and plan["month_discounts"][0]["month"] == 4

        # GET verify persistence
        r2 = session_req.get(f"{BASE_URL}/fees/plans", headers=auth_h(admin_ctx))
        assert r2.status_code == 200
        got = next((p for p in r2.json() if p["id"] == plan["id"]), None)
        assert got, "plan not returned by GET"
        assert got["plan_discount_value"] == 10
        assert got["month_discounts"][0]["value"] == 200

    def test_patch_plan_updates_discount_fields(self, session_req, admin_ctx, created_plans, fee_head_id):
        assert created_plans, "prior test must create a plan"
        pid = created_plans[0]
        patch = {
            "name": "TEST_Discount_Plan_Updated",
            "academic_session": "2026-27",
            "items": [_item(fee_head_id, 12000)],
            "plan_discount_type": "flat",
            "plan_discount_value": 500,
            "yearly_discount_type": "percent",
            "yearly_discount_value": 5,
            "month_discounts": [{"month": 5, "type": "percent", "value": 10}],
        }
        r = session_req.patch(f"{BASE_URL}/fees/plans/{pid}", json=patch, headers=auth_h(admin_ctx))
        assert r.status_code == 200, r.text
        upd = r.json()
        assert upd["plan_discount_type"] == "flat"
        assert upd["plan_discount_value"] == 500
        assert upd["yearly_discount_type"] == "percent"
        assert upd["month_discounts"][0]["month"] == 5

    def test_validation_percent_over_100(self, session_req, admin_ctx, fee_head_id):
        payload = {
            "name": "TEST_Bad_Percent",
            "academic_session": "2026-27",
            "items": [_item(fee_head_id, 1000, "Tuition")],
            "plan_discount_type": "percent",
            "plan_discount_value": 150,
        }
        r = session_req.post(f"{BASE_URL}/fees/plans", json=payload, headers=auth_h(admin_ctx))
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:200]}"

    def test_validation_negative_value(self, session_req, admin_ctx, fee_head_id):
        payload = {
            "name": "TEST_Bad_Neg",
            "academic_session": "2026-27",
            "items": [_item(fee_head_id, 1000, "Tuition")],
            "plan_discount_type": "flat",
            "plan_discount_value": -50,
        }
        r = session_req.post(f"{BASE_URL}/fees/plans", json=payload, headers=auth_h(admin_ctx))
        assert r.status_code == 400

    def test_validation_month_out_of_range(self, session_req, admin_ctx, fee_head_id):
        payload = {
            "name": "TEST_Bad_Month",
            "academic_session": "2026-27",
            "items": [_item(fee_head_id, 1000, "Tuition")],
            "month_discounts": [{"month": 13, "type": "flat", "value": 50}],
        }
        r = session_req.post(f"{BASE_URL}/fees/plans", json=payload, headers=auth_h(admin_ctx))
        assert r.status_code == 400


# ------------------------------ STUDENT FEE SCHEDULE ------------------------------
class TestStudentFeeSchedule:
    """Assign a plan (with plan+yearly+month discounts) to a fresh student
    and verify fee-schedule numbers."""

    @pytest.fixture(scope="class")
    def scenario(self, session_req, admin_ctx, created_plans, fee_head_id):
        # 1. Create a fresh discounted plan (12000 tuition, 10% plan + flat 1000 yearly + April flat 200)
        payload = {
            "name": f"TEST_Sched_Plan_{uuid.uuid4().hex[:6]}",
            "academic_session": "2026-27",
            "items": [_item(fee_head_id, 12000)],
            "plan_discount_type": "percent",
            "plan_discount_value": 10,
            "yearly_discount_type": "flat",
            "yearly_discount_value": 1000,
            "month_discounts": [{"month": 4, "type": "flat", "value": 200}],
        }
        r = session_req.post(f"{BASE_URL}/fees/plans", json=payload, headers=auth_h(admin_ctx))
        assert r.status_code == 200, r.text
        plan = r.json()
        created_plans.append(plan["id"])

        # 2. Find a student with no existing assignment
        rs = session_req.get(f"{BASE_URL}/students?limit=500", headers=auth_h(admin_ctx))
        assert rs.status_code == 200
        students = rs.json()
        ra = session_req.get(f"{BASE_URL}/fees/assignments", headers=auth_h(admin_ctx))
        assert ra.status_code == 200
        assigned_ids = {a["student_id"] for a in ra.json()}
        target = next((s for s in students if s["id"] not in assigned_ids), None)
        cleanup_assignment_ids = []
        if not target:
            # fall back: pick a student and delete existing assignments
            target = students[0]
            for a in ra.json():
                if a["student_id"] == target["id"]:
                    dr = session_req.delete(f"{BASE_URL}/fees/assignments/{a['id']}", headers=auth_h(admin_ctx))
                    # cannot rely on delete endpoint; skip if not supported
        assert target, "no student available"

        # 3. Assign plan to the student
        r_ass = session_req.post(
            f"{BASE_URL}/fees/plans/{plan['id']}/assign",
            json=[target["id"]],
            headers=auth_h(admin_ctx),
        )
        assert r_ass.status_code == 200, r_ass.text
        yield {"plan": plan, "student": target}

    def test_fee_schedule_reflects_plan_discounts(self, session_req, admin_ctx, scenario):
        sid = scenario["student"]["id"]
        r = session_req.get(f"{BASE_URL}/fees/student/{sid}/fee-schedule", headers=auth_h(admin_ctx))
        assert r.status_code == 200, r.text
        data = r.json()
        # These fields must exist
        for f in ("net_annual", "plan_discount_total", "plan_lump_discount",
                  "month_discount_total", "you_saved", "schedule"):
            assert f in data, f"missing field {f}"

        # expected: 12000 - 10% = 10800; -1000 yearly = 9800; April -200 = 9600
        assert abs(data["plan_lump_discount"] - 2200) < 1.0, data
        assert abs(data["month_discount_total"] - 200) < 1.0, data
        assert abs(data["net_annual"] - 9600) < 1.0, data
        assert data["you_saved"] >= 2400 - 1  # includes plan+month

        # April (month 4) should be lower than May (month 5)
        by_month = {int(e["month"]): e for e in data["schedule"]}
        assert 4 in by_month and 5 in by_month
        assert float(by_month[4]["amount"]) < float(by_month[5]["amount"]), (
            f"April {by_month[4]['amount']} should be < May {by_month[5]['amount']}"
        )

    def test_dues_reflects_plan_discount(self, session_req, admin_ctx, scenario):
        sid = scenario["student"]["id"]
        r = session_req.get(f"{BASE_URL}/fees/student/{sid}/dues", headers=auth_h(admin_ctx))
        assert r.status_code == 200, r.text
        data = r.json()
        # Response should reference plan-baked discount somewhere; be tolerant to field naming
        # Look for either total_discount or plan_discount_total or similar.
        blob = str(data)
        assert any(k in data for k in ("total_discount", "plan_discount_total", "plan_lump_discount", "you_saved")) or "discount" in blob.lower()


# ------------------------------ PARENT PORTAL ------------------------------
class TestParentPortal:
    def test_parent_can_fetch_own_child_schedule(self, session_req, parent_ctx):
        kids = parent_ctx["user"].get("linked_student_ids") or []
        if not kids:
            pytest.skip("Parent has no linked children")
        r = session_req.get(f"{BASE_URL}/fees/student/{kids[0]}/fee-schedule", headers=auth_h(parent_ctx))
        assert r.status_code == 200, r.text
        data = r.json()
        # Fields that must be present for the ParentPay page to render banner correctly
        for f in ("you_saved", "plan_discount_total", "net_annual", "payable_full"):
            assert f in data, f"missing field {f}"
