import React, { useState, useEffect, useMemo } from 'react';
import { api, money } from '@/lib/api';
import { planDiscountBreakdown } from '@/lib/feeCalc';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Trash2, Plus, X, Search, User2, GraduationCap, Phone as PhoneIcon, IndianRupee,
  Percent, CalendarDays, Receipt, CheckCircle2, AlertTriangle, Info, StickyNote,
  Wallet, Layers, ChevronDown, ChevronUp, Copy, ShieldCheck, Bell, Save, Eye, ClipboardList,
} from 'lucide-react';
import { toast } from 'sonner';

// -------------------- CONSTANTS --------------------
const MONTH_ORDER = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
// Default 10-month collection: June (Summer Vacation) & March (Session End) are No-Fee months.
const DEFAULT_COLLECTION_MONTHS = [4, 5, 7, 8, 9, 10, 11, 12, 1, 2];
const MONTH_LABELS = {
  1: 'January', 2: 'February', 3: 'March', 4: 'April', 5: 'May', 6: 'June',
  7: 'July', 8: 'August', 9: 'September', 10: 'October', 11: 'November', 12: 'December',
};
const MONTH_ABBR = { 1: 'Jan', 2: 'Feb', 3: 'Mar', 4: 'Apr', 5: 'May', 6: 'Jun', 7: 'Jul', 8: 'Aug', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dec' };
const DISCOUNT_REASONS = [
  'Scholarship', 'Sibling Discount', 'Staff Child', 'Merit',
  'Special Approval', 'Management', 'Other',
];
const COMMON_ITEMS = [
  'Tuition Fee', 'Admission Fee', 'Exam Fee', 'Library Fee', 'Sports Fee',
  'Computer Fee', 'Transport Fee', 'Hostel Fee', 'Books', 'Uniform', 'ID Card',
];

// -------------------- HELPERS --------------------
function sessionYears(session /* "2026-27" */) {
  if (!session) return { start: new Date().getFullYear(), end: new Date().getFullYear() + 1 };
  const [a, b] = String(session).split('-');
  const start = parseInt(a, 10);
  const endShort = parseInt(b || '0', 10);
  const end = endShort < 100 ? Math.floor(start / 100) * 100 + endShort : endShort;
  return { start: isNaN(start) ? new Date().getFullYear() : start, end: isNaN(end) ? start + 1 : end };
}
function ymFor(month, session) {
  const { start, end } = sessionYears(session);
  const year = month >= 4 ? start : end;
  return { year, month };
}
function lastDayOfMonth(year, month) {
  return new Date(year, month, 0).getDate();
}
function toIso(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function initials(name) {
  return (name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}
function fmtLongDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch (_e) { return iso; }
}
function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// -------------------- MAIN COMPONENT --------------------
export function AssignFeeDialog({
  open, onOpenChange, student, feePlans = [], feeHeads = [], classes = [], existingAssignment, onSaved,
}) {
  const isEdit = !!existingAssignment;

  // ------ form state ------
  const [mode, setMode] = useState('plan');
  const [planId, setPlanId] = useState('');
  const [planPickerOpen, setPlanPickerOpen] = useState(false);
  const [planSearch, setPlanSearch] = useState('');
  const [items, setItems] = useState([]);
  const [session, setSession] = useState('2026-27');
  const [discountKind, setDiscountKind] = useState('none'); // none | p5 | p10 | p15 | percent | amount
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountAmountInput, setDiscountAmountInput] = useState(0);
  const [discountReason, setDiscountReason] = useState('');
  const [discountReasonOther, setDiscountReasonOther] = useState('');
  const [dueDay, setDueDay] = useState(15);
  const [remarks, setRemarks] = useState('');
  const [collectionMonths, setCollectionMonths] = useState(DEFAULT_COLLECTION_MONTHS);
  const [installments, setInstallments] = useState([]); // [{month,year,amount,due_date,last_payment_date,label,status}]
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [copyingPrev, setCopyingPrev] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [prevAssignment, setPrevAssignment] = useState(null);
  // The MAIN fee structure's 12-month timeline for the selected plan — the
  // source of truth this dialog syncs to (fixes plan vs assignment mismatch).
  const [planTimeline, setPlanTimeline] = useState(null);

  // ------ hydrate on open ------
  useEffect(() => {
    if (!open) return;
    if (existingAssignment) {
      setMode(existingAssignment.custom_items?.length ? 'custom' : 'plan');
      setPlanId(existingAssignment.fee_plan_id || '');
      setItems((existingAssignment.custom_items || []).map((it, i) => ({ ...it, key: `it-x-${i}` })));
      setSession(existingAssignment.academic_session || '2026-27');
      const dp = Number(existingAssignment.discount_percent || 0);
      const da = Number(existingAssignment.discount_amount || 0);
      if (da > 0) { setDiscountKind('amount'); setDiscountAmountInput(da); setDiscountPercent(0); }
      else if (dp === 5) { setDiscountKind('p5'); setDiscountPercent(5); setDiscountAmountInput(0); }
      else if (dp === 10) { setDiscountKind('p10'); setDiscountPercent(10); setDiscountAmountInput(0); }
      else if (dp === 15) { setDiscountKind('p15'); setDiscountPercent(15); setDiscountAmountInput(0); }
      else if (dp > 0) { setDiscountKind('percent'); setDiscountPercent(dp); setDiscountAmountInput(0); }
      else { setDiscountKind('none'); setDiscountPercent(0); setDiscountAmountInput(0); }
      const dr = existingAssignment.discount_reason || '';
      if (dr.startsWith('Other:')) { setDiscountReason('Other'); setDiscountReasonOther(dr.replace(/^Other:\s*/, '')); }
      else { setDiscountReason(dr); setDiscountReasonOther(''); }
      setDueDay(existingAssignment.due_day_of_month || 15);
      setRemarks(existingAssignment.remarks || '');
      setCollectionMonths(existingAssignment.collection_months && existingAssignment.collection_months.length
        ? existingAssignment.collection_months : DEFAULT_COLLECTION_MONTHS);
      setInstallments((existingAssignment.installments || []).map((i) => ({ ...i })));
      // Plan-mode assignments must SYNC with the main fee structure, so only
      // skip the auto-rebuild for CUSTOM assignments (no plan to sync from).
      skipRebuildRef.current = (existingAssignment.custom_items?.length && (existingAssignment.installments || []).length) ? 1 : 0;
      monthsHydratedRef.current = !!(existingAssignment.collection_months && existingAssignment.collection_months.length);
    } else {
      setMode('plan'); setPlanId(''); setItems([]); setSession('2026-27');
      setDiscountKind('none'); setDiscountPercent(0); setDiscountAmountInput(0);
      setDiscountReason(''); setDiscountReasonOther('');
      setDueDay(15); setRemarks('');
      setCollectionMonths(DEFAULT_COLLECTION_MONTHS);
      setInstallments([]);
      skipRebuildRef.current = 0;
      monthsHydratedRef.current = false;
    }
    setPlanSearch(''); setErrors({}); setPreviewOpen(false); setPrevAssignment(null);
  }, [existingAssignment, open]);

  // ------ derived: plan/gross ------
  const selectedPlan = useMemo(() => feePlans.find((p) => p.id === planId), [feePlans, planId]);
  const planItemsTotal = useMemo(
    () => (selectedPlan?.items || []).reduce((s, it) => s + Number(it.amount || 0), 0),
    [selectedPlan],
  );
  const customTotal = useMemo(
    () => items.reduce((s, it) => s + Number(it.amount || 0), 0),
    [items],
  );
  const grossTotal = mode === 'plan' ? planItemsTotal : customTotal;
  // Baked-in discounts from the selected fee structure (plan), synced into this assignment.
  const planBaked = mode === 'plan' ? planDiscountBreakdown(selectedPlan) : null;
  const structureDisc = planBaked ? planBaked.totalDisc : 0;

  const effectivePercent = useMemo(() => {
    if (discountKind === 'p5') return 5;
    if (discountKind === 'p10') return 10;
    if (discountKind === 'p15') return 15;
    if (discountKind === 'percent') return Number(discountPercent || 0);
    return 0;
  }, [discountKind, discountPercent]);

  const discountAmt = useMemo(() => {
    if (discountKind === 'amount') return Math.max(0, Number(discountAmountInput || 0));
    return Math.round((grossTotal * effectivePercent) / 100);
  }, [discountKind, discountAmountInput, effectivePercent, grossTotal]);

  const netPayable = Math.max(grossTotal - structureDisc - discountAmt, 0);

  const activeCollectionMonths = useMemo(
    () => MONTH_ORDER.filter((m) => collectionMonths.includes(m)),
    [collectionMonths],
  );
  const inactiveMonths = useMemo(
    () => MONTH_ORDER.filter((m) => !collectionMonths.includes(m)),
    [collectionMonths],
  );

  // ---- One-time vs Monthly split ----
  // Items marked "one_time" are charged fully in the FIRST collection month
  // (the due month) and are NOT divided across months. Monthly items are
  // divided equally across the active collection months.
  const currentItems = mode === 'plan' ? (selectedPlan?.items || []) : items;
  const oneTimeGross = useMemo(
    () => currentItems.reduce((s, it) => ((it.frequency || 'monthly') === 'one_time' ? s + Number(it.amount || 0) : s), 0),
    [currentItems],
  );
  const recurringGross = Math.max(grossTotal - oneTimeGross, 0);
  const isOneTimeOnly = grossTotal > 0 && recurringGross <= 0;
  // Scale both pools by the discount ratio so the discount applies proportionally.
  const discountRatio = grossTotal > 0 ? netPayable / grossTotal : 0;
  const oneTimeNet = Math.round(oneTimeGross * discountRatio * 100) / 100;
  const recurringNet = Math.max(Math.round((netPayable - oneTimeNet) * 100) / 100, 0);

  const monthlyAmount = useMemo(() => {
    if (isOneTimeOnly) return Math.round(netPayable * 100) / 100;
    // Plan mode: show the most-common ACTIVE timeline amount (syncs with the
    // main structure instead of an abstract equal split).
    if (mode === 'plan' && planTimeline) {
      const active = installments.filter((r) => r.status === 'active' && Number(r.amount) > 0);
      if (active.length) {
        const freq = {};
        active.forEach((r) => { const v = Math.round(Number(r.amount) * 100) / 100; freq[v] = (freq[v] || 0) + 1; });
        const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
        if (top) return Number(top[0]);
      }
    }
    const n = activeCollectionMonths.length || 1;
    return Math.round((recurringNet / n) * 100) / 100;
  }, [recurringNet, activeCollectionMonths, isOneTimeOnly, netPayable, mode, planTimeline, installments]);

  const firstActiveMonth = activeCollectionMonths.length ? activeCollectionMonths[0] : null;

  // Skip ONE automatic rebuild right after hydrating an existing assignment so
  // its saved installment amounts are preserved.
  const skipRebuildRef = React.useRef(0);
  // True when the collection-month selection came from a saved assignment —
  // then we don't overwrite it with the plan's default months.
  const monthsHydratedRef = React.useRef(false);

  // ------ fetch the MAIN structure's monthly timeline for the selected plan ------
  useEffect(() => {
    if (!open || mode !== 'plan' || !planId) { setPlanTimeline(null); return; }
    let cancelled = false;
    api.get(`/fees/plans/${planId}/installments`, { params: { session } })
      .then(({ data }) => {
        if (cancelled) return;
        const rows = data.installments || [];
        setPlanTimeline(rows);
        if (!monthsHydratedRef.current) {
          setCollectionMonths(
            rows.filter((r) => (r.status || 'active') !== 'skip' && Number(r.amount || 0) > 0)
              .map((r) => Number(r.month)),
          );
        }
      })
      .catch(() => { if (!cancelled) setPlanTimeline(null); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, planId, session]);

  // ------ rebuild the installment table whenever inputs change ------
  useEffect(() => {
    if (!open) return;
    if (skipRebuildRef.current > 0) { skipRebuildRef.current -= 1; return; }
    // PLAN MODE with the structure timeline loaded: build the student's
    // timeline FROM the main fee structure (per-month amounts, overrides,
    // June/March rules), scaled by this student's personal concession so the
    // annual total still equals Net Payable. This keeps the student
    // assignment in sync with the main fee structure.
    if (mode === 'plan' && planTimeline && !isOneTimeOnly) {
      const freq = {};
      planTimeline.forEach((r) => {
        if ((r.status || 'active') === 'skip') return;
        const v = Math.round(Number(r.amount || 0) * 100) / 100;
        if (v > 0) freq[v] = (freq[v] || 0) + 1;
      });
      const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
      const typical = top ? Number(top[0]) : 0;
      const rawFor = (m) => {
        if (!collectionMonths.includes(m)) return 0;
        const pr = planTimeline.find((r) => Number(r.month) === m);
        if (pr && (pr.status || 'active') !== 'skip' && Number(pr.amount || 0) > 0) return Number(pr.amount);
        return typical; // user re-enabled a No-Fee month (e.g. June) — charge a typical month
      };
      const rawTotal = MONTH_ORDER.reduce((s, m) => s + rawFor(m), 0);
      const factor = rawTotal > 0 ? netPayable / rawTotal : 0;
      const rows = MONTH_ORDER.map((m) => {
        const { year, month } = ymFor(m, session);
        const raw = rawFor(m);
        const isActive = raw > 0;
        const lastDay = lastDayOfMonth(year, month);
        return {
          month, year,
          amount: isActive ? Math.round(raw * factor * 100) / 100 : 0,
          due_date: isActive ? toIso(year, month, Math.min(dueDay, lastDay)) : null,
          last_payment_date: isActive ? toIso(year, month, lastDay) : null,
          label: isActive ? null : (m === 6 ? 'Summer Vacation' : m === 3 ? 'Session End' : null),
          status: isActive ? 'active' : 'skip',
        };
      });
      // Absorb rounding remainder into the last active month (total == netPayable).
      const activeRows = rows.filter((r) => r.status === 'active');
      if (activeRows.length) {
        const sum = activeRows.reduce((s, r) => s + r.amount, 0);
        const diff = Math.round((netPayable - sum) * 100) / 100;
        const last = activeRows[activeRows.length - 1];
        last.amount = Math.round((last.amount + diff) * 100) / 100;
      }
      setInstallments(rows);
      return;
    }
    const active = MONTH_ORDER.filter((m) => collectionMonths.includes(m));
    const n = active.length;
    const first = n ? active[0] : null;
    const amounts = new Map();
    if (isOneTimeOnly) {
      if (first != null) amounts.set(first, Math.round(netPayable * 100) / 100);
    } else if (n > 0) {
      const base = Math.round((recurringNet / n) * 100) / 100;
      let acc = 0;
      active.forEach((m, i) => {
        let amt = i === n - 1 ? Math.round((recurringNet - acc) * 100) / 100 : base;
        acc = Math.round((acc + amt) * 100) / 100;
        if (m === first && oneTimeNet > 0) amt = Math.round((amt + oneTimeNet) * 100) / 100;
        amounts.set(m, amt);
      });
    }
    setInstallments(MONTH_ORDER.map((m) => {
      const { year, month } = ymFor(m, session);
      const isActive = isOneTimeOnly ? m === first : collectionMonths.includes(m);
      const lastDay = lastDayOfMonth(year, month);
      return {
        month, year,
        amount: isActive ? (amounts.get(m) || 0) : 0,
        due_date: isActive ? toIso(year, month, Math.min(dueDay, lastDay)) : null,
        last_payment_date: isActive ? toIso(year, month, lastDay) : null,
        label: isActive ? null : (m === 6 ? 'Summer Vacation' : m === 3 ? 'Session End' : null),
        status: isActive ? 'active' : 'skip',
      };
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, session, dueDay, collectionMonths, netPayable, recurringNet, oneTimeNet, isOneTimeOnly, mode, planTimeline]);

  const toggleCollectionMonth = (m) => {
    setCollectionMonths((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]);
  };

  // Manually edit an installment's amount (admin override)
  const editInstallmentAmount = (idx, val) => {
    setInstallments((prev) => prev.map((it, i) => i === idx ? { ...it, amount: Math.max(0, Number(val || 0)) } : it));
  };

  // Toggle skip on a single row (turns into "No Fee").
  // Just flip the collection month — the rebuild effect recomputes the table.
  const toggleInstallmentSkip = (idx) => {
    const row = installments[idx];
    if (!row) return;
    toggleCollectionMonth(row.month);
  };

  // ------ derived summary text ------
  const activeCount = activeCollectionMonths.length;
  const firstActive = installments.find((i) => i.status === 'active');
  const lastActive = [...installments].reverse().find((i) => i.status === 'active');
  const collectionMonthsLabel = useMemo(() => {
    if (activeCount === 0) return '—';
    return `${MONTH_LABELS[activeCollectionMonths[0]]} – ${MONTH_LABELS[activeCollectionMonths[activeCount - 1]]}`;
  }, [activeCollectionMonths]);
  const skipMonthsLabel = inactiveMonths.map((m) => MONTH_LABELS[m]).join(' & ');

  // ------ Copy previous year ------
  const copyPreviousYear = async () => {
    if (!student?.id) return;
    setCopyingPrev(true);
    try {
      const { data } = await api.get(`/fees/assignments/previous-for-student/${student.id}`);
      const prev = data?.previous;
      if (!prev) {
        toast.info('No prior fee assignment found for this student.');
        setCopyingPrev(false);
        return;
      }
      setPrevAssignment(prev);
      // Apply values
      setMode(prev.custom_items?.length ? 'custom' : 'plan');
      setPlanId(prev.fee_plan_id || '');
      setItems((prev.custom_items || []).map((it, i) => ({ ...it, key: `it-prev-${i}` })));
      const dp = Number(prev.discount_percent || 0);
      const da = Number(prev.discount_amount || 0);
      if (da > 0) { setDiscountKind('amount'); setDiscountAmountInput(da); setDiscountPercent(0); }
      else if ([5, 10, 15].includes(dp)) { setDiscountKind(`p${dp}`); setDiscountPercent(dp); setDiscountAmountInput(0); }
      else if (dp > 0) { setDiscountKind('percent'); setDiscountPercent(dp); setDiscountAmountInput(0); }
      else { setDiscountKind('none'); setDiscountPercent(0); setDiscountAmountInput(0); }
      const dr = prev.discount_reason || '';
      if (dr.startsWith('Other:')) { setDiscountReason('Other'); setDiscountReasonOther(dr.replace(/^Other:\s*/, '')); }
      else { setDiscountReason(dr); setDiscountReasonOther(''); }
      setDueDay(prev.due_day_of_month || 15);
      setRemarks(prev.remarks || '');
      setCollectionMonths(prev.collection_months && prev.collection_months.length ? prev.collection_months : DEFAULT_COLLECTION_MONTHS);
      // We keep the CURRENT session, not the previous session's — because dates
      // will regenerate for this year via useEffect.
      toast.success(`Copied structure from ${prev.academic_session || 'previous session'}.`);
    } catch (err) {
      toast.error('Could not fetch previous year assignment');
    } finally {
      setCopyingPrev(false);
    }
  };

  // ------ Validation ------
  const validate = () => {
    const e = {};
    if (mode === 'plan' && !planId) e.plan = 'Select a fee plan';
    if (mode === 'custom' && items.length === 0) e.items = 'Add at least one fee item';
    if (mode === 'custom' && items.some((it) => !it.fee_head_name?.trim() || !(Number(it.amount) > 0))) {
      e.items = 'Every custom item needs a name and amount > 0';
    }
    if (effectivePercent > 100) e.disc = 'Discount % cannot exceed 100';
    if (discountAmt > grossTotal && grossTotal > 0) e.disc = 'Discount cannot exceed gross total';
    if (discountAmt > 0 && !discountReason) e.discReason = 'Choose a reason for the discount';
    if (discountReason === 'Other' && !discountReasonOther.trim()) e.discReason = 'Enter the "Other" reason';
    if (activeCount === 0) e.months = 'Enable at least one collection month';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ------ Submit ------
  const submit = async ({ asDraft = false, notify = false } = {}) => {
    if (!asDraft && !validate()) { toast.error('Please fix the highlighted issues'); return; }
    setSaving(true);
    try {
      const finalReason = discountAmt > 0
        ? (discountReason === 'Other' ? `Other: ${discountReasonOther.trim()}` : discountReason)
        : null;
      const payload = {
        student_id: student.id,
        academic_session: session,
        fee_plan_id: mode === 'plan' ? planId : null,
        custom_items: mode === 'custom' ? items.map((it) => ({
          fee_head_id: it.fee_head_id || null,
          fee_head_name: it.fee_head_name || 'Custom',
          amount: Number(it.amount || 0),
          frequency: it.frequency || 'monthly',
        })) : [],
        discount_percent: discountKind === 'amount' ? 0 : effectivePercent,
        discount_amount: discountKind === 'amount' ? Number(discountAmountInput || 0) : 0,
        discount_reason: finalReason,
        collection_months: activeCollectionMonths,
        installments: installments.map((i) => ({
          month: i.month, year: i.year,
          amount: Number(i.amount || 0),
          due_date: i.due_date || null,
          last_payment_date: i.last_payment_date || null,
          label: i.label || null,
          status: i.status || 'active',
        })),
        due_day_of_month: dueDay,
        remarks: remarks || null,
        is_draft: !!asDraft,
        notify_parent: !!notify,
        copied_from_assignment_id: prevAssignment?.id || null,
      };
      if (isEdit) {
        await api.patch(`/fees/assignments/${existingAssignment.id}`, payload);
        toast.success(asDraft ? 'Draft saved' : (notify ? 'Assignment updated & parent notified' : 'Fee assignment updated'));
      } else {
        await api.post('/fees/assignments', payload);
        toast.success(asDraft ? 'Draft saved' : (notify ? 'Fee assigned & parent notified' : 'Fee assigned to student'));
      }
      onOpenChange(false);
      onSaved && onSaved();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save assignment');
    } finally { setSaving(false); }
  };

  if (!student) return null;

  const filteredPlans = feePlans.filter((p) => {
    if (!planSearch.trim()) return true;
    const s = planSearch.trim().toLowerCase();
    return (p.name || '').toLowerCase().includes(s)
      || (p.academic_session || '').toLowerCase().includes(s)
      || (p.class_name || '').toLowerCase().includes(s);
  });

  const hasActivePlan = existingAssignment && !existingAssignment.is_draft;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-[1200px] w-[97vw] max-h-[92vh] p-0 border-border rounded-xl overflow-hidden flex flex-col gap-0"
          data-testid="assign-fee-dialog"
        >
          <DialogTitle className="sr-only">Assign Fees</DialogTitle>
          {/* ------------- Header ------------- */}
          <div className="px-6 py-4 flex items-start justify-between gap-4 border-b border-border bg-white shrink-0">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-[#0B2F4A]/10 flex items-center justify-center">
                <ClipboardList className="h-5 w-5 text-[#0B2F4A]" />
              </div>
              <div>
                <h2 className="h-font text-xl font-semibold leading-tight">Assign Fees</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Create or assign fee plan to the student</p>
              </div>
            </div>
          </div>

          {/* ------------- Body (2-col) ------------- */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] flex-1 min-h-0 overflow-y-auto lg:overflow-hidden">
            {/* LEFT scroller */}
            <div className="lg:overflow-y-auto p-5 space-y-4 bg-slate-50/40 min-h-0">
              <StudentInfoCard
                student={student}
                classes={classes}
                session={session}
                onCopyPrev={copyPreviousYear}
                copyingPrev={copyingPrev}
                hasActivePlan={hasActivePlan}
                onSessionChange={setSession}
              />

              {/* Section 1 — Fee Assignment Type */}
              <SectionCard number="1" title="Fee Assignment Type">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <TypeCard
                    selected={mode === 'plan'}
                    onClick={() => setMode('plan')}
                    icon={<ClipboardList className="h-4 w-4" />}
                    title="Use Existing Fee Plan"
                    desc="Apply a fee plan created by school"
                    testId="assign-type-plan"
                  />
                  <TypeCard
                    selected={mode === 'custom'}
                    onClick={() => setMode('custom')}
                    icon={<Plus className="h-4 w-4" />}
                    title="Custom Fee Items"
                    desc="Create custom fee structure for this student"
                    testId="assign-type-custom"
                  />
                </div>
                {errors.plan && mode === 'plan' && <ErrLine msg={errors.plan} />}
                {errors.items && mode === 'custom' && <ErrLine msg={errors.items} />}
              </SectionCard>

              {/* Section 2 — Select Fee Plan / Custom Items */}
              {mode === 'plan' ? (
                <SectionCard number="2" title="Select Fee Plan">
                  <Popover open={planPickerOpen} onOpenChange={setPlanPickerOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={`w-full text-left rounded-lg border ${errors.plan ? 'border-red-400' : 'border-border'} bg-white px-3 py-2.5 hover:border-[hsl(var(--primary))] transition-colors flex items-center justify-between gap-2`}
                        data-testid="assign-fee-plan-select"
                      >
                        {selectedPlan ? (
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{selectedPlan.name}</div>
                            <div className="text-[11px] text-muted-foreground truncate">
                              {selectedPlan.class_name || '—'} · {selectedPlan.academic_session || ''} · {money(planItemsTotal)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Search & select a fee plan…</span>
                        )}
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-[520px] max-w-[92vw]" align="start" sideOffset={4}>
                      <div className="border-b border-border p-2">
                        <div className="relative">
                          <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <Input value={planSearch} onChange={(e) => setPlanSearch(e.target.value)} placeholder="Search by plan / class / session…" className="pl-8 h-9" autoFocus />
                        </div>
                      </div>
                      <div className="max-h-72 overflow-y-auto">
                        {filteredPlans.length === 0 && <div className="text-center py-6 text-sm text-muted-foreground">No plans match your search.</div>}
                        {filteredPlans.map((p) => {
                          const t = (p.items || []).reduce((s, it) => s + Number(it.amount || 0), 0);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => { setPlanId(p.id); setPlanPickerOpen(false); monthsHydratedRef.current = false; }}
                              className={`w-full text-left px-3 py-2.5 hover:bg-secondary transition-colors border-b border-border/50 last:border-0 ${p.id === planId ? 'bg-secondary' : ''}`}
                              data-testid={`plan-option-${p.id}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-medium truncate">{p.name}</div>
                                  <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5 flex-wrap">
                                    <span>{p.class_name || '—'}</span><span>·</span>
                                    <span>{p.academic_session || ''}</span><span>·</span>
                                    <span>{(p.items || []).length} items</span>
                                  </div>
                                </div>
                                <div className="text-sm font-semibold tabular-nums shrink-0">{money(t)}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* Plan preview card */}
                  {selectedPlan && (
                    <div className="mt-3 rounded-lg border border-border bg-white p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-start gap-3 md:col-span-1">
                        <div className="h-10 w-10 rounded-md bg-[#0B2F4A]/10 flex items-center justify-center shrink-0">
                          <ClipboardList className="h-5 w-5 text-[#0B2F4A]" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">{selectedPlan.name}</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">Annual Tuition Fee</div>
                          <div className="text-lg font-semibold tabular-nums text-[#0B2F4A]">{money(planItemsTotal)}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div>
                          <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Installments</div>
                          <div className="text-sm font-semibold">{activeCount}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Collection Months</div>
                          <div className="text-sm font-semibold truncate">
                            {activeCount > 0 ? `${MONTH_ABBR[activeCollectionMonths[0]]} – ${MONTH_ABBR[activeCollectionMonths[activeCount - 1]]}` : '—'}
                          </div>
                          {skipMonthsLabel && <div className="text-[10px] text-muted-foreground">(No Fee in {skipMonthsLabel})</div>}
                        </div>
                      </div>
                    </div>
                  )}
                </SectionCard>
              ) : (
                <SectionCard
                  number="2" title="Custom Fee Items"
                  actions={<Button size="sm" variant="outline" onClick={() => setItems((prev) => [...prev, { key: `it-${Date.now()}`, fee_head_name: '', amount: 0, frequency: 'monthly' }])} className="gap-1 h-8"><Plus className="h-3.5 w-3.5" /> Add Item</Button>}
                >
                  <div className="text-[11px] text-muted-foreground mb-2">Quick add:</div>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {COMMON_ITEMS.map((c) => (
                      <button key={c} type="button" onClick={() => setItems((prev) => [...prev, { key: `it-${Date.now()}-${c}`, fee_head_name: c, amount: 0, frequency: 'monthly' }])} className="px-2 py-0.5 text-[11px] rounded-md border border-border hover:bg-secondary transition-colors">+ {c}</button>
                    ))}
                  </div>
                  {items.length === 0 && (
                    <div className="rounded-md border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
                      No items yet. Click a suggestion above or "Add Item".
                    </div>
                  )}
                  <div className="grid gap-2">
                    {items.map((it, idx) => (
                      <div key={it.key} className="grid grid-cols-12 gap-2 items-center rounded-md border border-border p-2 bg-white">
                        <Input className="col-span-12 md:col-span-5 h-9" placeholder="Fee item name" value={it.fee_head_name} onChange={(e) => setItems((prev) => prev.map((x, i) => i === idx ? { ...x, fee_head_name: e.target.value } : x))} />
                        <div className="col-span-6 md:col-span-3 relative">
                          <IndianRupee className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <Input type="number" className="pl-7 h-9" placeholder="Amount" value={it.amount || ''} onChange={(e) => setItems((prev) => prev.map((x, i) => i === idx ? { ...x, amount: e.target.value } : x))} />
                        </div>
                        <div className="col-span-5 md:col-span-3">
                          <Select value={it.frequency || 'monthly'} onValueChange={(v) => setItems((prev) => prev.map((x, i) => i === idx ? { ...x, frequency: v } : x))}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="quarterly">Quarterly</SelectItem>
                              <SelectItem value="yearly">Yearly</SelectItem>
                              <SelectItem value="one_time">One time</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <button type="button" className="text-muted-foreground hover:text-destructive p-1" onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))} title="Remove"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}

              {/* Section 3 — Discount */}
              <SectionCard number="3" title="Discount">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  <RadioBox selected={discountKind === 'none'} onClick={() => { setDiscountKind('none'); setDiscountPercent(0); setDiscountAmountInput(0); }} label="No Discount" />
                  <RadioBox selected={discountKind === 'p5'} onClick={() => { setDiscountKind('p5'); setDiscountPercent(5); setDiscountAmountInput(0); }} label="5% Discount" />
                  <RadioBox selected={discountKind === 'p10'} onClick={() => { setDiscountKind('p10'); setDiscountPercent(10); setDiscountAmountInput(0); }} label="10% Discount" />
                  <RadioBox selected={discountKind === 'p15'} onClick={() => { setDiscountKind('p15'); setDiscountPercent(15); setDiscountAmountInput(0); }} label="15% Discount" />
                  <RadioBox selected={discountKind === 'percent'} onClick={() => { setDiscountKind('percent'); setDiscountAmountInput(0); }} label="Custom %" />
                  <RadioBox selected={discountKind === 'amount'} onClick={() => { setDiscountKind('amount'); setDiscountPercent(0); }} label="Custom Amount" />
                </div>

                {(discountKind === 'percent' || discountKind === 'amount') && (
                  <div className="mt-3 grid gap-1.5">
                    <Label className="text-xs">{discountKind === 'percent' ? 'Discount %' : 'Discount Amount'}</Label>
                    {discountKind === 'percent' ? (
                      <div className="relative max-w-xs">
                        <Input type="number" min={0} max={100} value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} className="pr-8 h-10" data-testid="assign-fee-discount-percent" />
                        <Percent className="h-3.5 w-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      </div>
                    ) : (
                      <div className="relative max-w-xs">
                        <IndianRupee className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input type="number" min={0} value={discountAmountInput} onChange={(e) => setDiscountAmountInput(e.target.value)} className="pl-8 h-10" data-testid="assign-fee-discount-amount" />
                      </div>
                    )}
                  </div>
                )}

                {discountAmt > 0 && (
                  <div className="mt-3 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 flex items-center justify-between">
                    <span className="text-xs text-emerald-800 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Discount Amount
                    </span>
                    <span className="text-sm font-semibold text-emerald-800 tabular-nums" data-testid="assign-fee-discount-computed">
                      {money(discountAmt)}
                    </span>
                  </div>
                )}

                {discountAmt > 0 && (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Reason <span className="text-red-600">*</span></Label>
                      <Select value={discountReason} onValueChange={setDiscountReason}>
                        <SelectTrigger className="h-10" data-testid="assign-fee-discount-reason"><SelectValue placeholder="Choose a reason…" /></SelectTrigger>
                        <SelectContent>{DISCOUNT_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    {discountReason === 'Other' && (
                      <div className="grid gap-1.5">
                        <Label className="text-xs">Specify Reason</Label>
                        <Input value={discountReasonOther} onChange={(e) => setDiscountReasonOther(e.target.value)} placeholder="Enter reason…" className="h-10" />
                      </div>
                    )}
                  </div>
                )}
                {errors.disc && <ErrLine msg={errors.disc} />}
                {errors.discReason && <ErrLine msg={errors.discReason} />}
              </SectionCard>

              {/* Section 4 — Due Date Rule + Remarks (side by side) */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="md:col-span-3">
                  <SectionCard number="4" title="Due Date Rule">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="text-sm">Fee becomes due on</span>
                      <Select value={String(dueDay)} onValueChange={(v) => setDueDay(Number(v))}>
                        <SelectTrigger className="w-20 h-9" data-testid="assign-fee-due-day"><SelectValue /></SelectTrigger>
                        <SelectContent>{[1, 5, 7, 10, 15, 20, 25].map((d) => <SelectItem key={d} value={String(d)}>{ordinal(d)}</SelectItem>)}</SelectContent>
                      </Select>
                      <span className="text-sm">of every chargeable month</span>
                    </div>
                    <div className="mt-3 rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-[11px] text-blue-900 flex items-start gap-2">
                      <Info className="h-3.5 w-3.5 mt-0.5 text-blue-700 shrink-0" />
                      <span>Parents can pay until the <b>last day</b> of the month. After that the fee will be marked as <b>Overdue</b>.</span>
                    </div>
                  </SectionCard>
                </div>
                <div className="md:col-span-2">
                  <SectionCard number="5" title="Remarks" hint="Optional">
                    <div className="relative">
                      <Textarea rows={4} value={remarks} onChange={(e) => setRemarks(e.target.value.slice(0, 250))} placeholder="Enter remarks (optional)" className="resize-none" />
                      <div className="absolute right-3 bottom-1.5 text-[10px] text-muted-foreground">{remarks.length}/250</div>
                    </div>
                  </SectionCard>
                </div>
              </div>

              {/* Section 6 — Fee Timeline */}
              <SectionCard number="6" title={isOneTimeOnly ? 'Payment Timeline (One Time)' : `Monthly Fee Timeline (${activeCount} Months Collection)`}>
                {errors.months && <ErrLine msg={errors.months} />}
                {isOneTimeOnly && (
                  <div className="mb-3 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-900 flex items-start gap-2">
                    <Info className="h-3.5 w-3.5 mt-0.5 text-amber-700 shrink-0" />
                    <span>All fee items are <b>One Time</b> — the full amount is charged only in the due month below. It is <b>not</b> divided into monthly installments.</span>
                  </div>
                )}
                <div className="overflow-x-auto -mx-4 md:mx-0">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border">
                        <th className="pl-4 md:pl-0 py-2 font-medium">Month</th>
                        <th className="py-2 font-medium">Installment Amount</th>
                        <th className="py-2 font-medium">Due Date</th>
                        <th className="py-2 font-medium">Last Payment Date</th>
                        <th className="py-2 font-medium text-center pr-4 md:pr-0">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(isOneTimeOnly ? installments.filter((r) => r.status === 'active') : installments).map((row) => {
                        const idx = installments.indexOf(row);
                        return (
                          <TimelineRow
                            key={`${row.month}-${row.year}`}
                            row={row}
                            hideSkip={isOneTimeOnly}
                            onAmountChange={(v) => editInstallmentAmount(idx, v)}
                            onToggleSkip={() => toggleInstallmentSkip(idx)}
                          />
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <Info className="h-3 w-3" />
                  {isOneTimeOnly
                    ? 'One-time payment — charged in the first collection month of the session.'
                    : (<span>Click <b>No Fee</b> beside any month to skip it (e.g. Summer Vacation, Session End). Installment amounts can be edited individually.</span>)}
                </div>
              </SectionCard>
            </div>

            {/* RIGHT — Sticky Fee Summary */}
            <aside className="border-t lg:border-t-0 lg:border-l border-border bg-white lg:overflow-y-auto min-h-0">
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <IndianRupee className="h-4 w-4 text-[#0B2F4A]" />
                  <h3 className="text-sm font-semibold">Fee Summary</h3>
                </div>

                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
                    <span className="text-[13px] text-slate-700">Annual Tuition Fee (Gross)</span>
                    <span className="text-sm font-semibold tabular-nums" data-testid="assign-summary-gross">{money(grossTotal)}</span>
                  </div>
                  {structureDisc > 0 && (
                    <div className="px-3 py-2.5 border-b border-border space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] text-slate-700">Structure Discount</span>
                        <span className="text-sm font-semibold tabular-nums text-emerald-700" data-testid="assign-summary-structure-discount">- {money(structureDisc)}</span>
                      </div>
                      {planBaked?.planDisc > 0 && <div className="flex items-center justify-between text-[11px] text-muted-foreground"><span>· Plan discount</span><span className="tabular-nums">- {money(planBaked.planDisc)}</span></div>}
                      {planBaked?.yearlyDisc > 0 && <div className="flex items-center justify-between text-[11px] text-muted-foreground"><span>· Yearly discount</span><span className="tabular-nums">- {money(planBaked.yearlyDisc)}</span></div>}
                      {planBaked?.monthDisc > 0 && <div className="flex items-center justify-between text-[11px] text-muted-foreground"><span>· Monthly discounts</span><span className="tabular-nums">- {money(planBaked.monthDisc)}</span></div>}
                    </div>
                  )}
                  <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
                    <span className="text-[13px] text-slate-700">
                      {structureDisc > 0 ? 'Extra Concession' : 'Discount'}{effectivePercent > 0 && discountKind !== 'amount' ? ` (${effectivePercent}%)` : ''}
                    </span>
                    <span className={`text-sm font-semibold tabular-nums ${discountAmt > 0 ? 'text-emerald-700' : ''}`} data-testid="assign-summary-discount">
                      {discountAmt > 0 ? `- ${money(discountAmt)}` : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-3 bg-[#0B2F4A]/5">
                    <span className="text-sm font-semibold text-[#0B2F4A]">Net Payable</span>
                    <span className="text-xl font-bold tabular-nums text-[#0B2F4A]" data-testid="assign-summary-net">
                      {money(netPayable)}
                    </span>
                  </div>
                </div>

                <div className="rounded-lg border border-border p-3 space-y-2 text-[13px]">
                  {isOneTimeOnly ? (
                    <>
                      <SumRow label="Payment Type" value="One Time" strong />
                      <SumRow label="One-Time Payment" value={money(netPayable)} strong testId="assign-summary-monthly" />
                      <SumRow label="Total Installments" value="1" strong />
                      <SumRow
                        label="Due Month"
                        value={firstActiveMonth != null ? MONTH_LABELS[firstActiveMonth] : '—'}
                        strong
                      />
                    </>
                  ) : (
                    <>
                      <SumRow label={`Monthly Installment (${activeCount} Months)`} value={money(monthlyAmount)} strong testId="assign-summary-monthly" />
                      {oneTimeNet > 0 && (
                        <SumRow
                          label="One-Time Charges (first month)"
                          value={`+ ${money(oneTimeNet)}`}
                          strong
                          sub={firstActiveMonth != null ? `added to ${MONTH_LABELS[firstActiveMonth]}` : null}
                        />
                      )}
                      <SumRow label="Total Installments" value={String(activeCount)} strong />
                      <SumRow
                        label="Collection Months"
                        value={collectionMonthsLabel}
                        strong
                        sub={skipMonthsLabel ? `(No Fee in ${skipMonthsLabel})` : null}
                      />
                    </>
                  )}
                  <SumRow label="Due Date Rule" value={`${ordinal(dueDay)} of every month`} />
                  <SumRow label="Payment Window" value={`${ordinal(dueDay)} to Last Day`} />
                  <SumRow label="Overdue" value="After last day of month" />
                </div>

                <div className="rounded-lg border border-border p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Monthly status explained</div>
                  <div className="space-y-1.5 text-[12px]">
                    <LegendRow color="#0F766E" label="Upcoming" desc={`Before ${ordinal(dueDay)}`} />
                    <LegendRow color="#F59E0B" label="Due" desc={`${ordinal(dueDay)} to Last Day`} />
                    <LegendRow color="#0F766E" filled label="Paid" desc="After successful payment" />
                    <LegendRow color="#B42318" filled label="Overdue" desc="After last day if not paid" />
                  </div>
                </div>

                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 flex items-start gap-2">
                  <ShieldCheck className="h-4 w-4 text-slate-600 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-[12px] font-semibold text-slate-800">Duplicate Fee Check</div>
                    <div className="text-[11px] text-muted-foreground leading-snug">
                      The system will check for existing fee plan before assigning.
                    </div>
                  </div>
                </div>

                {/* Parent view button */}
                <button
                  type="button"
                  onClick={() => setPreviewOpen(true)}
                  className="w-full text-xs flex items-center justify-center gap-1.5 py-2 rounded-md border border-border hover:bg-secondary transition-colors"
                  data-testid="assign-parent-preview-btn"
                >
                  <Eye className="h-3.5 w-3.5" /> Preview what the parent will see
                </button>
              </div>
            </aside>
          </div>

          {/* ------------- Footer ------------- */}
          <div className="px-5 py-3 border-t border-border bg-white flex items-center justify-end gap-2 flex-wrap shrink-0">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} data-testid="assign-cancel-btn">Cancel</Button>
            <Button variant="outline" onClick={() => submit({ asDraft: true })} disabled={saving} className="gap-1.5" data-testid="assign-savedraft-btn">
              <Save className="h-3.5 w-3.5" /> Save Draft
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  disabled={saving || (mode === 'plan' ? !planId : items.length === 0)}
                  className="gap-1.5 bg-[#0B2F4A] hover:bg-[#0B2F4A]/90"
                  data-testid="assign-fee-submit"
                >
                  {saving ? 'Saving…' : (isEdit ? 'Update Assignment' : 'Assign Fees')}
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => submit({ notify: false })} data-testid="assign-menu-only">
                  <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-600" /> {isEdit ? 'Update Only' : 'Assign Only'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => submit({ notify: true })} data-testid="assign-menu-notify">
                  <Bell className="h-4 w-4 mr-2 text-blue-600" /> {isEdit ? 'Update & Notify Parent' : 'Assign & Notify Parent'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => submit({ asDraft: true })}>
                  <Save className="h-4 w-4 mr-2 text-slate-500" /> Save as Draft
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </DialogContent>
      </Dialog>

      {/* Parent view preview modal */}
      <ParentPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        student={student}
        session={session}
        grossTotal={grossTotal}
        discountAmt={structureDisc + discountAmt}
        netPayable={netPayable}
        monthlyAmount={monthlyAmount}
        activeCount={activeCount}
        installments={installments}
        dueDay={dueDay}
        oneTimeOnly={isOneTimeOnly}
      />
    </>
  );
}

// -------------------- SUB COMPONENTS --------------------
function StudentInfoCard({ student, classes = [], session, onCopyPrev, copyingPrev, hasActivePlan, onSessionChange }) {
  const s = student || {};
  const guardian = s.father_name || s.mother_name || s.guardian_name || '—';
  const phone = s.phone || '—';
  const cls = s.class_name || classes.find((c) => c.id === s.class_id)?.name || '—';
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-3">Student Information</div>
      <div className="grid grid-cols-12 gap-4">
        {/* Photo */}
        <div className="col-span-12 sm:col-span-2 md:col-span-2 flex sm:block justify-center">
          {s.photo_url ? (
            <img src={s.photo_url} alt={s.full_name} className="h-20 w-20 rounded-lg object-cover border border-border shadow-sm" />
          ) : (
            <div className="h-20 w-20 rounded-lg bg-gradient-to-br from-[#0B2F4A] to-[#0B2F4A]/70 text-white flex items-center justify-center text-xl font-semibold border border-border shadow-sm">
              {initials(s.full_name)}
            </div>
          )}
        </div>
        {/* Info grid */}
        <div className="col-span-12 sm:col-span-6 md:col-span-7 min-w-0">
          <div className="text-lg font-semibold leading-tight">{s.full_name}</div>
          <div className="text-xs text-[#0B2F4A] font-mono mt-0.5">
            Admission No. <span className="font-semibold">{s.admission_number || '—'}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 mt-3">
            <MiniField icon={GraduationCap} label="Class &amp; Section">
              {cls !== '—' ? `${cls}${s.section ? `-${s.section}` : ''}` : '—'}
            </MiniField>
            <MiniField icon={User2} label="Parent Name">{guardian}</MiniField>
            <MiniField icon={CalendarDays} label="Academic Session">
              <Select value={session} onValueChange={onSessionChange}>
                <SelectTrigger className="h-7 w-32 -ml-1 px-2 text-xs" data-testid="assign-session-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['2024-25', '2025-26', '2026-27', '2027-28'].map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </MiniField>
            <MiniField icon={PhoneIcon} label="Mobile Number">{phone}</MiniField>
          </div>
        </div>
        {/* Status + copy button */}
        <div className="col-span-12 md:col-span-3">
          <div className={`rounded-lg p-3 border ${hasActivePlan ? 'border-amber-300 bg-amber-50' : 'border-emerald-300 bg-emerald-50'}`}>
            <div className="flex items-center gap-1.5 text-sm font-medium">
              {hasActivePlan
                ? (<><AlertTriangle className="h-4 w-4 text-amber-700" /><span className="text-amber-900">Active Fee Plan</span></>)
                : (<><CheckCircle2 className="h-4 w-4 text-emerald-700" /><span className="text-emerald-900">No Active Fee Plan</span></>)}
            </div>
            <div className={`text-[11px] mt-1 ${hasActivePlan ? 'text-amber-800' : 'text-emerald-800'}`}>
              {hasActivePlan
                ? 'Saving will overwrite the current plan.'
                : 'No fee plan is currently assigned.'}
            </div>
            <Button
              size="sm" variant="outline"
              onClick={onCopyPrev}
              disabled={copyingPrev}
              className="mt-2 h-auto min-h-8 py-1.5 w-full text-xs gap-1.5 bg-white whitespace-normal leading-snug"
              data-testid="assign-copy-previous-btn"
            >
              <Copy className="h-3.5 w-3.5 shrink-0" /> {copyingPrev ? 'Loading…' : "Copy Previous Year's Fee Structure"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniField({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-2 min-w-0">
      <Icon className="h-3.5 w-3.5 mt-1 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{label}</div>
        <div className="text-sm font-medium truncate">{children}</div>
      </div>
    </div>
  );
}

function SectionCard({ number, title, hint, actions, children }) {
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-6 w-6 rounded-md bg-[#0B2F4A] text-white text-[11px] font-bold flex items-center justify-center shrink-0">{number}</div>
          <div className="text-sm font-semibold truncate">{title}</div>
          {hint && <span className="text-[11px] text-muted-foreground truncate hidden sm:inline">({hint})</span>}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

function TypeCard({ selected, onClick, icon, title, desc, testId }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={`text-left rounded-lg border-2 p-3.5 flex items-start gap-3 transition-all ${
        selected ? 'border-[#0B2F4A] bg-[#0B2F4A]/5 shadow-sm'
                 : 'border-border hover:border-[#0B2F4A]/40 bg-white'
      }`}
    >
      <div className={`h-4 w-4 rounded-full border-2 mt-1 shrink-0 ${selected ? 'border-[#0B2F4A]' : 'border-slate-300'}`}>
        {selected && <div className="h-full w-full rounded-full bg-[#0B2F4A] scale-50" />}
      </div>
      <div className={`h-9 w-9 rounded-md flex items-center justify-center shrink-0 ${selected ? 'bg-[#0B2F4A]/10 text-[#0B2F4A]' : 'bg-slate-100 text-slate-600'}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{desc}</div>
      </div>
    </button>
  );
}

function RadioBox({ selected, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-md border px-3 py-2.5 flex items-center gap-2 transition-colors ${selected ? 'border-[#0B2F4A] bg-[#0B2F4A]/5' : 'border-border hover:bg-secondary bg-white'}`}
    >
      <span className={`h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center ${selected ? 'border-[#0B2F4A]' : 'border-slate-300'}`}>
        {selected && <span className="h-2 w-2 rounded-full bg-[#0B2F4A]" />}
      </span>
      <span className="text-sm">{label}</span>
    </button>
  );
}

function TimelineRow({ row, onAmountChange, onToggleSkip, hideSkip }) {
  const isSkip = row.status === 'skip';
  const monthLabel = MONTH_LABELS[row.month];
  return (
    <tr className={`border-b border-border/50 last:border-0 ${isSkip ? 'bg-slate-50/70' : ''}`}>
      <td className="pl-4 md:pl-0 py-2.5">
        <span className="inline-flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${isSkip ? 'bg-slate-300' : 'bg-emerald-500'}`} />
          <span className="font-medium">{monthLabel}</span>
        </span>
      </td>
      <td className="py-2.5">
        {isSkip ? (
          <span className="text-xs text-muted-foreground italic">
            No Fee{row.label ? ` (${row.label})` : ''}
          </span>
        ) : (
          <div className="relative max-w-[140px]">
            <IndianRupee className="h-3 w-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="number" min={0}
              value={row.amount || ''}
              onChange={(e) => onAmountChange(e.target.value)}
              className="pl-6 h-8 text-xs"
              data-testid={`installment-amount-${row.month}`}
            />
          </div>
        )}
      </td>
      <td className="py-2.5 text-xs text-slate-700">{fmtLongDate(row.due_date)}</td>
      <td className="py-2.5 text-xs text-slate-700">{fmtLongDate(row.last_payment_date)}</td>
      <td className="py-2.5 text-center pr-4 md:pr-0">
        <StatusButton row={row} onToggleSkip={onToggleSkip} hideSkip={hideSkip} />
      </td>
    </tr>
  );
}

function StatusButton({ row, onToggleSkip, hideSkip }) {
  if (row.status === 'skip') {
    return (
      <button
        type="button"
        onClick={onToggleSkip}
        className="inline-flex items-center px-2 py-0.5 text-[11px] rounded-full bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors"
        data-testid={`installment-toggle-${row.month}`}
      >
        No Fee
      </button>
    );
  }
  // For an active row, determine the current-week status based on today.
  const today = new Date();
  const due = new Date(row.due_date);
  const lastPay = new Date(row.last_payment_date);
  let label = 'Upcoming', cls = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (today > lastPay) { label = 'Overdue'; cls = 'bg-red-50 text-red-700 border-red-200'; }
  else if (today >= due) { label = 'Due'; cls = 'bg-amber-50 text-amber-800 border-amber-200'; }
  return (
    <div className="flex items-center justify-center gap-1.5">
      <span className={`inline-flex items-center px-2 py-0.5 text-[11px] rounded-full border ${cls}`}>{label}</span>
      {!hideSkip && (
        <button
          type="button"
          onClick={onToggleSkip}
          className="text-[10px] text-muted-foreground hover:text-red-600 hover:underline"
          title="Mark as No Fee (skip this month)"
          data-testid={`installment-toggle-${row.month}`}
        >
          skip
        </button>
      )}
    </div>
  );
}

function SumRow({ label, value, strong, sub, testId }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className={`text-[13px] text-slate-700 leading-tight ${strong ? '' : 'text-muted-foreground'}`}>{label}</span>
      <div className="text-right min-w-0">
        <div className={`tabular-nums ${strong ? 'text-sm font-semibold text-slate-900' : 'text-sm'}`} data-testid={testId}>{value}</div>
        {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
      </div>
    </div>
  );
}

function LegendRow({ color, filled, label, desc }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5">
        {filled
          ? <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
          : <span className="h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: color }} />}
        <span className="font-medium">{label}</span>
      </span>
      <span className="text-muted-foreground text-[11.5px]">{desc}</span>
    </div>
  );
}

function ErrLine({ msg }) {
  return (
    <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
      <AlertTriangle className="h-3 w-3" /> {msg}
    </p>
  );
}

// -------------------- Parent Preview Modal --------------------
function ParentPreviewDialog({
  open, onOpenChange, student, session, grossTotal, discountAmt, netPayable, monthlyAmount, activeCount, installments, dueDay, oneTimeOnly,
}) {
  const scheduleRows = oneTimeOnly ? installments.filter((r) => r.status === 'active') : installments;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="parent-preview-dialog">
        <DialogTitle className="sr-only">Parent portal fee preview</DialogTitle>
        <div className="border-b border-border pb-3 mb-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Parent Portal — Preview</div>
          <div className="h-font text-lg font-semibold mt-0.5">Fee Structure — {session}</div>
          <div className="text-xs text-muted-foreground">This is what {student?.full_name || 'the parent'} will see in the portal.</div>
        </div>
        <div className="space-y-3">
          <div className="rounded-md border border-border overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <span className="text-xs text-muted-foreground">Annual Fee</span>
              <span className="tabular-nums text-sm font-semibold">{money(grossTotal)}</span>
            </div>
            {discountAmt > 0 && (
              <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                <span className="text-xs text-emerald-700">Discount</span>
                <span className="tabular-nums text-sm font-semibold text-emerald-700">- {money(discountAmt)}</span>
              </div>
            )}
            <div className="flex items-center justify-between px-3 py-2.5 bg-[#0B2F4A]/5">
              <span className="text-sm font-semibold text-[#0B2F4A]">Net Payable</span>
              <span className="text-lg font-bold tabular-nums text-[#0B2F4A]">{money(netPayable)}</span>
            </div>
            <div className="flex items-center justify-between px-3 py-2 border-t border-border">
              <span className="text-xs text-muted-foreground">{oneTimeOnly ? 'One-Time Payment' : `Monthly · ${activeCount} installments`}</span>
              <span className="tabular-nums text-sm font-semibold">{money(monthlyAmount)}</span>
            </div>
          </div>
          <div className="rounded-md border border-border overflow-hidden">
            <div className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground font-medium border-b border-border bg-slate-50">Payment Schedule</div>
            <div className="max-h-56 overflow-y-auto">
              {scheduleRows.map((row) => (
                <div key={`${row.month}-${row.year}`} className={`flex items-center justify-between px-3 py-1.5 text-sm border-b border-border/50 last:border-0 ${row.status === 'skip' ? 'text-muted-foreground italic' : ''}`}>
                  <span>{MONTH_LABELS[row.month]}{row.status === 'skip' ? ` — ${row.label || 'No Fee'}` : ''}</span>
                  <span className="tabular-nums font-medium">{row.status === 'skip' ? '—' : money(row.amount)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-[11px] text-blue-900">
            Due day: <b>{ordinal(dueDay)}</b> of every month. Payment window: {ordinal(dueDay)} to last day of month.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
