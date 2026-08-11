// Shared fee-structure discount math — mirrors backend compute_plan_discount_breakdown.
// Fees are split across 10 months only; June (6) and March (3) are excluded.
export const EXCLUDED_MONTHS = [6, 3];
export const COLLECTION_MONTHS = [4, 5, 7, 8, 9, 10, 11, 12, 1, 2];

export function discAmt(type, value, base) {
  if (!type || type === 'none') return 0;
  const v = Number(value || 0);
  if (v <= 0 || base <= 0) return 0;
  if (type === 'percent') return +(base * Math.min(Math.max(v, 0), 100) / 100).toFixed(2);
  return +Math.min(v, base).toFixed(2); // flat
}

// Returns the baked-in discounts of a fee plan (structure), independent of any
// per-student concession. gross = sum of plan items; net = gross - all plan discounts.
export function planDiscountBreakdown(plan) {
  if (!plan) return { gross: 0, planDisc: 0, yearlyDisc: 0, monthDisc: 0, totalDisc: 0, net: 0 };
  const gross = (plan.items || []).reduce((s, it) => s + Number(it.amount || 0), 0);
  const planDisc = discAmt(plan.plan_discount_type, plan.plan_discount_value, gross);
  const afterPlan = Math.max(gross - planDisc, 0);
  const yearlyDisc = discAmt(plan.yearly_discount_type, plan.yearly_discount_value, afterPlan);
  const afterLump = Math.max(gross - planDisc - yearlyDisc, 0);
  const collCount = COLLECTION_MONTHS.length;
  const baseMonth = afterLump > 0 ? afterLump / collCount : 0;
  const mds = [...(plan.month_discounts || []), ...(plan.installment_discounts || [])];
  const overrides = {};
  (plan.month_amounts || []).forEach((o) => { overrides[Number(o.month)] = Number(o.amount || 0); });
  let monthDisc = 0;
  mds.forEach((md) => {
    const m = Number(md.month);
    if (EXCLUDED_MONTHS.includes(m)) return;
    if (overrides[m] !== undefined) return; // an override IS the final amount
    monthDisc += discAmt(md.type, md.value, baseMonth);
  });
  monthDisc = +monthDisc.toFixed(2);
  const totalDisc = +(planDisc + yearlyDisc + monthDisc).toFixed(2);
  const net = Math.max(+(gross - totalDisc).toFixed(2), 0);
  return { gross, planDisc, yearlyDisc, monthDisc, totalDisc, net, baseMonth: +baseMonth.toFixed(2) };
}
