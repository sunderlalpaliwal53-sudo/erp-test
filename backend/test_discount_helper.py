"""Unit checks for plan-baked discount computation (Phase 1)."""
from server import compute_plan_discount_breakdown, _discount_amount, _plan_month_discount_map


def approx(a, b):
    return abs(a - b) < 0.02


def test_flat_plan_discount():
    plan = {'plan_discount_type': 'flat', 'plan_discount_value': 2000}
    bd = compute_plan_discount_breakdown(plan, 12000, list(range(1, 13)))
    assert approx(bd['plan_discount_amount'], 2000)
    assert approx(bd['net_annual'], 10000)
    assert approx(bd['base_month'], 833.33)


def test_percent_plan_discount():
    plan = {'plan_discount_type': 'percent', 'plan_discount_value': 10}
    bd = compute_plan_discount_breakdown(plan, 12000, list(range(1, 13)))
    assert approx(bd['plan_discount_amount'], 1200)
    assert approx(bd['net_annual'], 10800)


def test_yearly_after_plan():
    plan = {'plan_discount_type': 'percent', 'plan_discount_value': 10,
            'yearly_discount_type': 'flat', 'yearly_discount_value': 1000}
    bd = compute_plan_discount_breakdown(plan, 12000, list(range(1, 13)))
    # plan 10% -> 1200, remaining 10800, yearly flat 1000
    assert approx(bd['plan_discount_amount'], 1200)
    assert approx(bd['yearly_discount_amount'], 1000)
    assert approx(bd['net_annual'], 9800)


def test_month_discount_stacks():
    plan = {'plan_discount_type': 'flat', 'plan_discount_value': 1200,
            'month_discounts': [{'month': 4, 'type': 'flat', 'value': 100},
                                {'month': 5, 'type': 'percent', 'value': 10}]}
    bd = compute_plan_discount_breakdown(plan, 12000, list(range(1, 13)))
    # net after lump = 10800, base month = 900
    assert approx(bd['base_month'], 900)
    m4 = next(r for r in bd['per_month'] if r['month'] == 4)
    m5 = next(r for r in bd['per_month'] if r['month'] == 5)
    assert approx(m4['net'], 800)          # 900 - 100 flat
    assert approx(m5['net'], 810)          # 900 - 10%
    assert approx(bd['month_discount_total'], 190)
    assert approx(bd['net_annual'], 10610)  # 12000 - 1200 - 190


def test_flat_capped_and_percent_clamped():
    assert approx(_discount_amount('flat', 99999, 500), 500)     # capped at base
    assert approx(_discount_amount('percent', 250, 1000), 1000)  # clamped to 100%
    assert _discount_amount(None, 100, 1000) == 0.0
    assert _discount_amount('flat', -50, 1000) == 0.0


def test_month_map_priority():
    plan = {'installment_discounts': [{'month': 6, 'type': 'flat', 'value': 50}],
            'month_discounts': [{'month': 6, 'type': 'percent', 'value': 20}]}
    m = _plan_month_discount_map(plan)
    assert m[6]['type'] == 'percent' and m[6]['value'] == 20  # month_discounts win


if __name__ == '__main__':
    fns = [v for k, v in sorted(globals().items()) if k.startswith('test_')]
    for fn in fns:
        fn()
        print('PASS', fn.__name__)
    print('ALL %d PASSED' % len(fns))
