"""
Test: Discount-approval workflow correctly reduces student dues by BOTH
approved_discount + amount_paid (not just amount_paid).

Bug fix verification per iteration_2 request.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

API = f"{BASE_URL}/api"

SUPER = ("superadmin@stanvard.school", "Stanvard@2026")
OWNER = ("spmundra@stanvard.school", "mundra@sp2026")


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text}"
    data = r.json()
    return data.get("access_token") or data.get("token"), data


def _headers(token, school_id=None):
    h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    if school_id:
        h["X-School-Id"] = school_id
    return h


PNG_1x1 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="


@pytest.fixture(scope="module")
def ctx():
    sa_token, _ = _login(*SUPER)
    # find KNP school
    r = requests.get(f"{API}/schools", headers=_headers(sa_token), timeout=30)
    assert r.status_code == 200, r.text
    schools = r.json()
    knp = next((s for s in schools if "KNP" in (s.get("code") or "").upper() or "KNP" in (s.get("name") or "").upper()), schools[0])
    school_id = knp["id"]

    # Fee-status report – pick a student with expected>2500 and due>2500
    r = requests.get(f"{API}/reports/fee-status", params={"school_id": school_id},
                     headers=_headers(sa_token), timeout=60)
    assert r.status_code == 200, r.text
    rep = r.json()
    rows = rep if isinstance(rep, list) else rep.get("rows") or rep.get("data") or []
    candidates = [r for r in rows if (r.get("expected") or 0) > 2500 and (r.get("due") or 0) > 2500]
    assert candidates, f"no candidate student found. sample: {rows[:2]}"
    student = candidates[0]
    student_id = student.get("student_id") or student.get("id")
    return {"sa_token": sa_token, "school_id": school_id, "student_id": student_id,
            "initial_report_row": student}


def _get_dues(token, school_id, student_id):
    r = requests.get(f"{API}/fees/student/{student_id}/dues",
                     headers=_headers(token, school_id), timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


def _get_report_row(token, school_id, student_id):
    r = requests.get(f"{API}/reports/fee-status", params={"school_id": school_id},
                     headers=_headers(token, school_id), timeout=60)
    assert r.status_code == 200, r.text
    rep = r.json()
    rows = rep if isinstance(rep, list) else rep.get("rows") or rep.get("data") or []
    return next((r for r in rows if (r.get("student_id") or r.get("id")) == student_id), None)


def _get_schedule(token, school_id, student_id):
    r = requests.get(f"{API}/fees/student/{student_id}/fee-schedule",
                     headers=_headers(token, school_id), timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


def test_discount_approval_reduces_balance_by_discount_plus_paid(ctx):
    sa_token = ctx["sa_token"]
    school_id = ctx["school_id"]
    student_id = ctx["student_id"]

    # BEFORE
    dues_before = _get_dues(sa_token, school_id, student_id)
    balance_before = dues_before.get("balance")
    report_before = _get_report_row(sa_token, school_id, student_id)
    sched_before = _get_schedule(sa_token, school_id, student_id)

    print(f"BEFORE dues: balance={balance_before}, tot_disc={dues_before.get('total_discount')}, "
          f"pay_disc={dues_before.get('total_payment_discount')}, plan_disc={dues_before.get('total_plan_discount')}, "
          f"paid={dues_before.get('total_paid')}")
    print(f"BEFORE report row: due={report_before.get('due') if report_before else None}, "
          f"discount={report_before.get('discount') if report_before else None}")
    print(f"BEFORE schedule: remaining={sched_before.get('remaining_balance')}, "
          f"pay_disc_total={sched_before.get('payment_discount_total')}")

    # verify new response fields exist
    assert "total_payment_discount" in dues_before, f"missing total_payment_discount: {list(dues_before.keys())}"
    assert "total_plan_discount" in dues_before, f"missing total_plan_discount: {list(dues_before.keys())}"
    assert "payment_discount_total" in sched_before, f"missing payment_discount_total in schedule: {list(sched_before.keys())}"

    # (B) Raise discounted payment as super_admin
    payload = {
        "student_id": student_id,
        "items": [{"fee_head_name": "Tuition Fee", "amount": 2000}],
        "discount": 500,
        "late_fee": 0,
        "discount_reason": "Sibling concession",
        "payment_mode": "cash",
        "application_image": PNG_1x1,
    }
    r = requests.post(f"{API}/payments/collect", json=payload,
                      headers=_headers(sa_token, school_id), timeout=30)
    assert r.status_code in (200, 201), f"collect failed: {r.status_code} {r.text}"
    resp = r.json()
    print(f"collect response: {resp}")
    assert resp.get("status") in ("pending_approval", "pending"), f"unexpected status: {resp}"
    approval_id = resp.get("approval_id") or resp.get("id") or (resp.get("approval") or {}).get("id")
    assert approval_id, f"no approval_id: {resp}"

    # (C) Owner approves
    owner_token, _ = _login(*OWNER)
    r = requests.post(f"{API}/discount-approvals/{approval_id}/approve",
                      json={"approved_discount": 500, "remark": "ok"},
                      headers=_headers(owner_token, school_id), timeout=30)
    assert r.status_code in (200, 201), f"approve failed: {r.status_code} {r.text}"
    print(f"approve response: {r.json()}")

    # (D) Super admin collects
    r = requests.post(f"{API}/discount-approvals/{approval_id}/collect",
                      json={"payment_mode": "cash"},
                      headers=_headers(sa_token, school_id), timeout=30)
    assert r.status_code in (200, 201), f"collect-after-approval failed: {r.status_code} {r.text}"
    collect_resp = r.json()
    print(f"final collect response: {collect_resp}")

    # (E) Re-fetch
    dues_after = _get_dues(sa_token, school_id, student_id)
    balance_after = dues_after.get("balance")
    report_after = _get_report_row(sa_token, school_id, student_id)
    sched_after = _get_schedule(sa_token, school_id, student_id)

    print(f"AFTER dues: balance={balance_after}, tot_disc={dues_after.get('total_discount')}, "
          f"pay_disc={dues_after.get('total_payment_discount')}, paid={dues_after.get('total_paid')}")
    print(f"AFTER report row: due={report_after.get('due') if report_after else None}, "
          f"discount={report_after.get('discount') if report_after else None}")
    print(f"AFTER schedule: remaining={sched_after.get('remaining_balance')}, "
          f"pay_disc_total={sched_after.get('payment_discount_total')}")

    # Assertions
    delta_balance = balance_before - balance_after
    assert delta_balance == 2000, f"BUG: balance decreased by {delta_balance}, expected 2000 (500 disc + 1500 paid). before={balance_before}, after={balance_after}"

    # dues field checks
    assert (dues_after.get("total_payment_discount") or 0) - (dues_before.get("total_payment_discount") or 0) == 500, \
        f"total_payment_discount delta wrong: before={dues_before.get('total_payment_discount')} after={dues_after.get('total_payment_discount')}"
    assert (dues_after.get("total_discount") or 0) - (dues_before.get("total_discount") or 0) >= 500, \
        f"total_discount should include approved 500"
    assert (dues_after.get("total_paid") or 0) - (dues_before.get("total_paid") or 0) == 1500

    # report row
    if report_before and report_after:
        due_delta = (report_before.get("due") or 0) - (report_after.get("due") or 0)
        assert due_delta == 2000, f"report due delta = {due_delta}, expected 2000"
        disc_delta = (report_after.get("discount") or 0) - (report_before.get("discount") or 0)
        assert disc_delta >= 500, f"report discount delta = {disc_delta}, expected >=500"

    # schedule
    rem_delta = (sched_before.get("remaining_balance") or 0) - (sched_after.get("remaining_balance") or 0)
    assert rem_delta == 2000, f"schedule remaining_balance delta = {rem_delta}, expected 2000"
    pd_delta = (sched_after.get("payment_discount_total") or 0) - (sched_before.get("payment_discount_total") or 0)
    assert pd_delta == 500, f"schedule payment_discount_total delta = {pd_delta}, expected 500"
