import React, { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { api, money } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Pencil, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { useSchool } from '@/contexts/SchoolContext';

const EMPTY_PLAN = {
  name: '', class_id: '', academic_session: '2026-27', annual_discount_percent: 10,
  late_fee_amount: 50, late_fee_after_day: 10, items: [],
  plan_discount_type: 'none', plan_discount_value: 0,
  yearly_discount_type: 'none', yearly_discount_value: 0,
  month_discounts: [], month_amounts: [],
};
const EMPTY_HEAD = { name: '', category: 'general' };

// Fees split across 10 months only — June & March are NOT collected.
const EXCLUDED_MONTHS = [6, 3];

// Session months in Apr→Mar order (matches backend _session_months)
const MONTHS = [
  { n: 4, l: 'April' }, { n: 5, l: 'May' }, { n: 6, l: 'June' }, { n: 7, l: 'July' },
  { n: 8, l: 'August' }, { n: 9, l: 'September' }, { n: 10, l: 'October' }, { n: 11, l: 'November' },
  { n: 12, l: 'December' }, { n: 1, l: 'January' }, { n: 2, l: 'February' }, { n: 3, l: 'March' },
];
const MONTH_LABEL = Object.fromEntries(MONTHS.map((m) => [m.n, m.l]));

// Client-side mirror of the backend discount computation (compute_plan_discount_breakdown)
function discAmt(type, value, base) {
  if (!type || type === 'none') return 0;
  const v = Number(value || 0);
  if (v <= 0 || base <= 0) return 0;
  if (type === 'percent') return +(base * Math.min(Math.max(v, 0), 100) / 100).toFixed(2);
  return +Math.min(v, base).toFixed(2); // flat
}
function computeBreakdown(form) {
  const allItems = form.items || [];
  const grossAll = allItems.reduce((s, it) => s + Number(it.amount || 0), 0);
  const recurring = allItems.filter((it) => (it.frequency || 'monthly') !== 'one_time');
  const oneTime = allItems.filter((it) => (it.frequency || 'monthly') === 'one_time');
  const gross = recurring.reduce((s, it) => s + Number(it.amount || 0), 0); // recurring only -> equal split
  const planDisc = discAmt(form.plan_discount_type, form.plan_discount_value, gross);
  const afterPlan = Math.max(gross - planDisc, 0);
  const yearlyDisc = discAmt(form.yearly_discount_type, form.yearly_discount_value, afterPlan);
  const afterLump = Math.max(gross - planDisc - yearlyDisc, 0);
  const collMonths = MONTHS.filter((m) => !EXCLUDED_MONTHS.includes(m.n));
  const firstColl = collMonths.length ? collMonths[0].n : null;
  const baseMonth = afterLump > 0 ? +(afterLump / collMonths.length).toFixed(2) : 0;
  const mdMap = {};
  (form.month_discounts || []).forEach((md) => { mdMap[Number(md.month)] = { type: md.type, value: md.value }; });
  const overrideMap = {};
  (form.month_amounts || []).forEach((o) => { overrideMap[Number(o.month)] = Number(o.amount || 0); });
  // One-time charges land fully in their chosen month (default first collection month).
  const oneTimeByMonth = {};
  oneTime.forEach((it) => {
    let tm = Number(it.one_time_month);
    if (!collMonths.some((m) => m.n === tm)) tm = firstColl;
    if (tm != null) oneTimeByMonth[tm] = (oneTimeByMonth[tm] || 0) + Number(it.amount || 0);
  });
  let monthTotal = 0;
  let netTotal = 0;
  const perMonth = MONTHS.map((m) => {
    const ot = oneTimeByMonth[m.n] || 0;
    const hasOverride = overrideMap[m.n] !== undefined;
    // June & March default to ₹0 / No Fee — UNLESS the user overrides them.
    if (EXCLUDED_MONTHS.includes(m.n) && ot <= 0 && !hasOverride) return { month: m.n, label: m.l, net: 0, discount: 0, noFee: true, override: false, oneTime: 0 };
    const base = hasOverride ? overrideMap[m.n] : (EXCLUDED_MONTHS.includes(m.n) ? 0 : baseMonth);
    const md = mdMap[m.n];
    const d = (!hasOverride && md && !EXCLUDED_MONTHS.includes(m.n)) ? discAmt(md.type, md.value, base) : 0;
    monthTotal += d;
    const net = Math.max(+(base - d + ot).toFixed(2), 0);
    netTotal += net;
    // A zero override on a collection month = month skipped (No Fee).
    return { month: m.n, label: m.l, net, discount: +d.toFixed(2), override: hasOverride, oneTime: +ot.toFixed(2), noFee: net <= 0 };
  });
  const netAnnual = +netTotal.toFixed(2);
  const totalDisc = Math.max(+(grossAll - netAnnual).toFixed(2), 0);
  return { gross: grossAll, planDisc, yearlyDisc, monthTotal: +monthTotal.toFixed(2), totalDisc, netAnnual, baseMonth, perMonth };
}

function PlanDiscountBadges({ plan }) {
  const badges = [];
  if (plan.plan_discount_type && plan.plan_discount_value > 0) {
    badges.push(`Plan ${plan.plan_discount_type === 'percent' ? plan.plan_discount_value + '%' : '₹' + plan.plan_discount_value}`);
  }
  if (plan.yearly_discount_type && plan.yearly_discount_value > 0) {
    badges.push(`Yearly ${plan.yearly_discount_type === 'percent' ? plan.yearly_discount_value + '%' : '₹' + plan.yearly_discount_value}`);
  }
  const mCount = (plan.month_discounts || []).length + (plan.installment_discounts || []).length;
  if (mCount > 0) badges.push(`${mCount} month${mCount > 1 ? 's' : ''}`);
  if (badges.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {badges.map((b) => (
        <Badge key={b} className="bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0] text-[10px]">{b}</Badge>
      ))}
    </div>
  );
}

export default function FeesStructure() {
  const { activeSchoolId } = useSchool();
  const [heads, setHeads] = useState([]);
  const [plans, setPlans] = useState([]);
  const [classes, setClasses] = useState([]);
  const [headDialog, setHeadDialog] = useState({ open: false, initial: null });
  const [planDialog, setPlanDialog] = useState({ open: false, initial: null });
  const [confirm, setConfirm] = useState({ open: false, kind: null, item: null });

  const load = useCallback(async () => {
    if (!activeSchoolId) return;
    const [{ data: h }, { data: p }, { data: c }] = await Promise.all([
      api.get('/fees/heads'), api.get('/fees/plans'), api.get('/classes'),
    ]);
    setHeads(h); setPlans(p); setClasses(c);
  }, [activeSchoolId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const h = () => load();
    window.addEventListener('stv:school-changed', h);
    return () => window.removeEventListener('stv:school-changed', h);
  }, [load]);

  const classMap = Object.fromEntries(classes.map((c) => [c.id, c.name]));

  const doDelete = async () => {
    const { kind, item } = confirm;
    try {
      if (kind === 'head') {
        await api.delete(`/fees/heads/${item.id}`);
        toast.success('Fee head deleted');
      } else if (kind === 'plan') {
        await api.delete(`/fees/plans/${item.id}`);
        toast.success('Fee plan deleted');
      }
      setConfirm({ open: false, kind: null, item: null });
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Delete failed');
    }
  };

  const setLive = async (plan) => {
    try {
      const { data } = await api.post(`/fees/plans/${plan.id}/set-live`);
      const n = data?.assigned_students || 0;
      toast.success(`"${plan.name}" is now LIVE${n > 0 ? ` — applied to ${n} student${n > 1 ? 's' : ''}` : ''}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not set live');
    }
  };

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="h-font text-2xl font-semibold">Fee Structures</h1>
        <p className="text-sm text-muted-foreground">Configure fee heads and fee plans. Click a row to edit.</p>
      </div>
      <Tabs defaultValue="plans">
        <TabsList><TabsTrigger value="plans">Fee Plans</TabsTrigger><TabsTrigger value="heads">Fee Heads</TabsTrigger></TabsList>

        <TabsContent value="plans">
          <Card className="p-4 border-border">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium">{plans.length} plans configured</div>
              <Button data-testid="add-fee-plan" onClick={() => setPlanDialog({ open: true, initial: null })} className="gap-2">
                <Plus className="h-4 w-4" /> Add Plan
              </Button>
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Plan Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Session</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Annual Discount</TableHead>
                <TableHead>Plan Discounts</TableHead>
                <TableHead>Late Fee</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {plans.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>
                      {p.status === 'live'
                        ? <Badge data-testid={`plan-status-${p.id}`} className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50">● LIVE</Badge>
                        : <Badge data-testid={`plan-status-${p.id}`} variant="secondary" className="text-muted-foreground">Draft</Badge>}
                    </TableCell>
                    <TableCell>{classMap[p.class_id] || '—'}</TableCell>
                    <TableCell>{p.academic_session}</TableCell>
                    <TableCell><Badge variant="secondary">{p.items?.length || 0} items</Badge></TableCell>
                    <TableCell className="tabular-nums">{p.annual_discount_percent}%</TableCell>
                    <TableCell><PlanDiscountBadges plan={p} /></TableCell>
                    <TableCell className="tabular-nums">{money(p.late_fee_amount)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {p.status !== 'live' && p.class_id && (
                          <Button size="sm" variant="outline" className="h-8 px-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                            data-testid={`set-live-plan-${p.id}`} onClick={() => setLive(p)} title="Make this the live plan for the class">
                            Set Live
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" data-testid={`edit-plan-${p.id}`}
                          onClick={() => setPlanDialog({ open: true, initial: p })}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" data-testid={`delete-plan-${p.id}`}
                          onClick={() => setConfirm({ open: true, kind: 'plan', item: p })}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {plans.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-6">
                    No fee plans yet. Click <b>Add Plan</b> to create one.
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="heads">
          <Card className="p-4 border-border">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium">{heads.length} fee heads</div>
              <Button data-testid="add-fee-head" onClick={() => setHeadDialog({ open: true, initial: null })} className="gap-2">
                <Plus className="h-4 w-4" /> Add Head
              </Button>
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {heads.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="font-medium">{h.name}</TableCell>
                    <TableCell className="capitalize">{h.category}</TableCell>
                    <TableCell>{h.is_active ? <Badge className="bg-[#E6F6F4] text-[#0F766E] border border-[#BFEAE6]">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" data-testid={`edit-head-${h.id}`}
                          onClick={() => setHeadDialog({ open: true, initial: h })}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" data-testid={`delete-head-${h.id}`}
                          onClick={() => setConfirm({ open: true, kind: 'head', item: h })}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {heads.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">
                    No fee heads yet.
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <FeeHeadDialog state={headDialog} onOpenChange={(o) => setHeadDialog((s) => ({ ...s, open: o }))} onSaved={load} />
      <FeePlanDialog state={planDialog} onOpenChange={(o) => setPlanDialog((s) => ({ ...s, open: o }))} heads={heads} classes={classes} onSaved={load} />

      <AlertDialog open={confirm.open} onOpenChange={(o) => setConfirm((s) => ({ ...s, open: o }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirm.kind === 'plan' ? 'fee plan' : 'fee head'}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <b>{confirm.item?.name}</b>. Records referencing it will block the delete for safety.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction data-testid="confirm-delete" onClick={doDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

// -------------------------------------------------------------------
// Fee Head (create + edit) dialog
// -------------------------------------------------------------------
function FeeHeadDialog({ state, onOpenChange, onSaved }) {
  const isEdit = !!state.initial;
  const [form, setForm] = useState(EMPTY_HEAD);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (state.open) setForm(state.initial ? { name: state.initial.name, category: state.initial.category } : EMPTY_HEAD);
  }, [state.open, state.initial]);

  const submit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (isEdit) {
        await api.patch(`/fees/heads/${state.initial.id}`, form);
        toast.success('Fee head updated');
      } else {
        await api.post('/fees/heads', form);
        toast.success('Fee head added');
      }
      onOpenChange(false); onSaved();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Fee Head' : 'Add Fee Head'}</DialogTitle>
          <DialogDescription>Fee heads are the categories under which fees are charged (Tuition, Transport, etc.)</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-1.5"><Label>Name</Label>
            <Input data-testid="head-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid gap-1.5"><Label>Category</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger data-testid="head-category"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['general', 'transport', 'hostel', 'exam', 'activity'].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" data-testid="save-head" disabled={saving}>{saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Add Head')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// -------------------------------------------------------------------
// Fee Plan (create + edit) dialog
// -------------------------------------------------------------------
function FeePlanDialog({ state, onOpenChange, heads, classes, onSaved }) {
  const isEdit = !!state.initial;
  const [form, setForm] = useState(EMPTY_PLAN);
  const [item, setItem] = useState({ fee_head_id: '', amount: '', frequency: 'monthly', one_time_month: '4' });
  const [mDraft, setMDraft] = useState({ month: '4', type: 'flat', value: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (state.open) {
      if (state.initial) {
        const mds = [
          ...(state.initial.month_discounts || []),
          ...(state.initial.installment_discounts || []),
        ].map((md) => ({ month: Number(md.month), type: md.type || 'flat', value: Number(md.value || 0) }));
        setForm({
          name: state.initial.name || '',
          class_id: state.initial.class_id || '',
          academic_session: state.initial.academic_session || '2026-27',
          annual_discount_percent: state.initial.annual_discount_percent || 0,
          late_fee_amount: state.initial.late_fee_amount || 0,
          late_fee_after_day: state.initial.late_fee_after_day || 10,
          items: (state.initial.items || []).map((it) => ({ ...it })),
          plan_discount_type: state.initial.plan_discount_type || 'none',
          plan_discount_value: state.initial.plan_discount_value || 0,
          yearly_discount_type: state.initial.yearly_discount_type || 'none',
          yearly_discount_value: state.initial.yearly_discount_value || 0,
          month_discounts: mds,
          month_amounts: (state.initial.month_amounts || []).map((o) => ({ month: Number(o.month), amount: Number(o.amount || 0) })),
        });
      } else setForm(EMPTY_PLAN);
      setItem({ fee_head_id: '', amount: '', frequency: 'monthly' });
      setMDraft({ month: '4', type: 'flat', value: '' });
    }
  }, [state.open, state.initial]);

  const addItem = () => {
    if (!item.fee_head_id || !item.amount) return;
    const h = heads.find((x) => x.id === item.fee_head_id);
    const isOneTime = item.frequency === 'one_time';
    setForm((f) => ({
      ...f,
      items: [...f.items, {
        fee_head_id: item.fee_head_id, fee_head_name: h.name,
        amount: Number(item.amount), frequency: item.frequency,
        installments: item.frequency === 'monthly' ? 12 : item.frequency === 'quarterly' ? 4 : item.frequency === 'half_yearly' ? 2 : 1,
        one_time_month: isOneTime ? Number(item.one_time_month || 4) : null,
      }],
    }));
    setItem({ fee_head_id: '', amount: '', frequency: 'monthly', one_time_month: '4' });
  };
  const removeItem = (i) => setForm((f) => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const updateItemAmount = (i, v) => setForm((f) => ({
    ...f, items: f.items.map((it, idx) => idx === i ? { ...it, amount: Number(v || 0) } : it),
  }));

  const addMonthDiscount = () => {
    const m = Number(mDraft.month);
    const v = Number(mDraft.value || 0);
    if (!v || v <= 0) { toast.error('Enter a discount value greater than 0'); return; }
    if (mDraft.type === 'percent' && v > 100) { toast.error('Percent must be between 0 and 100'); return; }
    setForm((f) => ({
      ...f,
      month_discounts: [
        ...f.month_discounts.filter((md) => Number(md.month) !== m), // one rule per month
        { month: m, type: mDraft.type, value: v },
      ].sort((a, b) => MONTHS.findIndex((x) => x.n === a.month) - MONTHS.findIndex((x) => x.n === b.month)),
    }));
    setMDraft({ month: String(m), type: 'flat', value: '' });
  };
  const removeMonthDiscount = (month) => setForm((f) => ({
    ...f, month_discounts: f.month_discounts.filter((md) => Number(md.month) !== Number(month)),
  }));

  // Override a single month's payable amount (empty = revert to auto split).
  const setMonthAmount = (month, v) => setForm((f) => {
    const others = (f.month_amounts || []).filter((o) => Number(o.month) !== Number(month));
    if (v === '' || v === null || v === undefined) return { ...f, month_amounts: others };
    return { ...f, month_amounts: [...others, { month: Number(month), amount: Number(v || 0) }] };
  });
  const clearMonthAmounts = () => setForm((f) => ({ ...f, month_amounts: [] }));

  const bd = computeBreakdown(form);

  const submit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const body = {
        ...form,
        plan_discount_type: form.plan_discount_type === 'none' ? null : form.plan_discount_type,
        plan_discount_value: Number(form.plan_discount_value || 0),
        yearly_discount_type: form.yearly_discount_type === 'none' ? null : form.yearly_discount_type,
        yearly_discount_value: Number(form.yearly_discount_value || 0),
        month_discounts: (form.month_discounts || []).map((md) => ({
          month: Number(md.month), type: md.type, value: Number(md.value || 0),
        })),
        month_amounts: (form.month_amounts || []).map((o) => ({
          month: Number(o.month), amount: Number(o.amount || 0),
        })),
        installment_discounts: [], // unified into month_discounts
      };
      let res;
      if (isEdit) {
        res = await api.patch(`/fees/plans/${state.initial.id}`, body);
      } else {
        res = await api.post('/fees/plans', body);
      }
      const n = res?.data?.assigned_students || 0;
      toast.success(`${isEdit ? 'Fee plan updated' : 'Fee plan added'}${n > 0 ? ` — auto-assigned to ${n} student${n > 1 ? 's' : ''}` : ''}`);
      onOpenChange(false); onSaved();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Fee Plan' : 'Add Fee Plan'}</DialogTitle>
          <DialogDescription>Define the annual fee items and any plan-level discounts. Discounts here flow straight into student schedules — no owner approval needed.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Plan Name</Label>
              <Input data-testid="plan-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-1.5"><Label>Class</Label>
              <Select value={form.class_id} onValueChange={(v) => setForm({ ...form, class_id: v })}>
                <SelectTrigger data-testid="plan-class"><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">Saving auto-assigns this plan to all active students of the selected class.</p>
            </div>
            <div className="grid gap-1.5"><Label>Academic Session</Label>
              <Input value={form.academic_session} onChange={(e) => setForm({ ...form, academic_session: e.target.value })} />
            </div>
            <div className="grid gap-1.5"><Label>Full-Payment Discount % <span className="text-xs text-muted-foreground">(pay-full only)</span></Label>
              <Input type="number" value={form.annual_discount_percent} onChange={(e) => setForm({ ...form, annual_discount_percent: Number(e.target.value) })} />
            </div>
            <div className="grid gap-1.5"><Label>Late Fee (₹)</Label>
              <Input type="number" value={form.late_fee_amount} onChange={(e) => setForm({ ...form, late_fee_amount: Number(e.target.value) })} />
            </div>
            <div className="grid gap-1.5"><Label>Late Fee After Day</Label>
              <Input type="number" value={form.late_fee_after_day} onChange={(e) => setForm({ ...form, late_fee_after_day: Number(e.target.value) })} />
            </div>
          </div>

          <div>
            <div className="text-sm font-medium mb-2">Fee Items</div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <Select value={item.fee_head_id} onValueChange={(v) => setItem({ ...item, fee_head_id: v })}>
                <SelectTrigger data-testid="new-item-head"><SelectValue placeholder="Fee Head" /></SelectTrigger>
                <SelectContent>{heads.map((h) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}</SelectContent>
              </Select>
              <Input data-testid="new-item-amount" type="number" placeholder="Amount" value={item.amount} onChange={(e) => setItem({ ...item, amount: e.target.value })} />
              <Select value={item.frequency} onValueChange={(v) => setItem({ ...item, frequency: v })}>
                <SelectTrigger data-testid="new-item-freq"><SelectValue /></SelectTrigger>
                <SelectContent>{['monthly', 'quarterly', 'half_yearly', 'yearly', 'one_time'].map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
              <Button type="button" variant="outline" onClick={addItem} data-testid="add-item-btn">Add Item</Button>
            </div>
            {item.frequency === 'one_time' && (
              <div className="mt-2 flex items-center gap-2" data-testid="one-time-month-row">
                <Label className="text-xs whitespace-nowrap">Charge one-time fee in</Label>
                <Select value={String(item.one_time_month)} onValueChange={(v) => setItem({ ...item, one_time_month: v })}>
                  <SelectTrigger data-testid="one-time-month-select" className="w-40 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS.filter((m) => !EXCLUDED_MONTHS.includes(m.n)).map((m) => <SelectItem key={m.n} value={String(m.n)}>{m.l}</SelectItem>)}</SelectContent>
                </Select>
                <span className="text-[11px] text-muted-foreground">One-time fees are charged fully in this month — not divided across months.</span>
              </div>
            )}
            <div className="mt-3 divide-y divide-border">
              {form.items.map((it, i) => (
                <div key={`${it.fee_head_id || 'x'}-${it.frequency || 'f'}-${i}`} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{it.fee_head_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {it.frequency}
                      {it.frequency === 'one_time' && it.one_time_month ? ` · ${MONTH_LABEL[it.one_time_month]}` : ''}
                    </div>
                  </div>
                  <Input type="number" className="w-28 tabular-nums" value={it.amount}
                    onChange={(e) => updateItemAmount(i, e.target.value)} data-testid={`edit-item-amount-${i}`} />
                  <button type="button" onClick={() => removeItem(i)} data-testid={`remove-item-${i}`}>
                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              ))}
              {form.items.length === 0 && (
                <div className="py-4 text-center text-xs text-muted-foreground">No items yet. Add at least one.</div>
              )}
            </div>
          </div>

          {/* ---------------- DISCOUNTS CARD ---------------- */}
          <Card className="p-4 border-[#BFEAE6] bg-[#F7FDFC]" data-testid="discounts-card">
            <div className="flex items-center gap-2 mb-1">
              <Tag className="h-4 w-4 text-[#0F766E]" />
              <div className="text-sm font-semibold">Discounts</div>
              <Badge variant="secondary" className="text-[10px]">No approval needed</Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Baked into the plan. Applied automatically to every student assigned this plan.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label className="text-xs">Plan-level discount (on annual total)</Label>
                <div className="flex gap-2">
                  <Select value={form.plan_discount_type} onValueChange={(v) => setForm({ ...form, plan_discount_type: v })}>
                    <SelectTrigger data-testid="plan-discount-type" className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No discount</SelectItem>
                      <SelectItem value="flat">Flat ₹</SelectItem>
                      <SelectItem value="percent">Percent %</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="number" data-testid="plan-discount-value" placeholder="Value"
                    disabled={form.plan_discount_type === 'none'} className="flex-1 tabular-nums"
                    value={form.plan_discount_value}
                    onChange={(e) => setForm({ ...form, plan_discount_value: Number(e.target.value) })} />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label className="text-xs">Yearly / full-session discount (lump)</Label>
                <div className="flex gap-2">
                  <Select value={form.yearly_discount_type} onValueChange={(v) => setForm({ ...form, yearly_discount_type: v })}>
                    <SelectTrigger data-testid="yearly-discount-type" className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No discount</SelectItem>
                      <SelectItem value="flat">Flat ₹</SelectItem>
                      <SelectItem value="percent">Percent %</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="number" data-testid="yearly-discount-value" placeholder="Value"
                    disabled={form.yearly_discount_type === 'none'} className="flex-1 tabular-nums"
                    value={form.yearly_discount_value}
                    onChange={(e) => setForm({ ...form, yearly_discount_value: Number(e.target.value) })} />
                </div>
              </div>
            </div>

            {/* Month-specific discount builder */}
            <div className="mt-4">
              <Label className="text-xs">Add discount on specific months</Label>
              <div className="grid grid-cols-12 gap-2 mt-1.5">
                <Select value={mDraft.month} onValueChange={(v) => setMDraft({ ...mDraft, month: v })}>
                  <SelectTrigger data-testid="month-discount-month" className="col-span-5"><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS.map((m) => <SelectItem key={m.n} value={String(m.n)}>{m.l}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={mDraft.type} onValueChange={(v) => setMDraft({ ...mDraft, type: v })}>
                  <SelectTrigger data-testid="month-discount-type" className="col-span-3"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flat">₹ Amount</SelectItem>
                    <SelectItem value="percent">% Percent</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="number" placeholder="Value" data-testid="month-discount-value" className="col-span-2 tabular-nums"
                  value={mDraft.value} onChange={(e) => setMDraft({ ...mDraft, value: e.target.value })} />
                <Button type="button" variant="outline" className="col-span-2" data-testid="add-month-discount" onClick={addMonthDiscount}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2" data-testid="month-discount-list">
                {form.month_discounts.map((md) => (
                  <Badge key={md.month} variant="secondary" className="gap-1 pr-1" data-testid={`month-discount-chip-${md.month}`}>
                    {MONTH_LABEL[md.month]}: {md.type === 'percent' ? `${md.value}%` : `₹${md.value}`}
                    <button type="button" onClick={() => removeMonthDiscount(md.month)} className="ml-1 rounded hover:bg-black/10" data-testid={`remove-month-discount-${md.month}`}>
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {form.month_discounts.length === 0 && (
                  <span className="text-xs text-muted-foreground">No month-specific discounts.</span>
                )}
              </div>
            </div>

            {/* Live preview strip */}
            <div className="mt-4 rounded-lg border border-[#BFEAE6] bg-white p-3" data-testid="discount-preview">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div><div className="text-[11px] text-muted-foreground">Annual (gross)</div><div className="tabular-nums font-semibold" data-testid="preview-gross">{money(bd.gross)}</div></div>
                <div><div className="text-[11px] text-muted-foreground">Total discount</div><div className="tabular-nums font-semibold text-[#B45309]" data-testid="preview-discount">- {money(bd.totalDisc)}</div></div>
                <div><div className="text-[11px] text-muted-foreground">Net annual</div><div className="tabular-nums font-semibold text-[#0F766E]" data-testid="preview-net">{money(bd.netAnnual)}</div></div>
                <div><div className="text-[11px] text-muted-foreground">You save</div><div className="tabular-nums font-semibold text-[#0F766E]" data-testid="preview-saved">{bd.gross > 0 ? Math.round((bd.totalDisc / bd.gross) * 100) : 0}%</div></div>
              </div>
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-xs">Monthly amounts — total ÷ 10 months (June &amp; March default ₹0 / No Fee). Edit any month to override; set 0 to skip a month, or add an amount in June/March to charge them.</Label>
                  {(form.month_amounts || []).length > 0 && (
                    <Button type="button" size="sm" variant="ghost" className="h-6 text-[11px]" onClick={clearMonthAmounts} data-testid="reset-month-amounts">Reset to auto</Button>
                  )}
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {bd.perMonth.map((m) => (
                    <div key={m.month} className={`rounded-md border p-1.5 text-center ${m.noFee && !m.override ? 'border-dashed border-border bg-muted/40' : m.override ? 'border-[#FCD34D] bg-[#FFFBEB]' : m.discount > 0 ? 'border-[#A7F3D0] bg-[#ECFDF5]' : 'border-border'}`} data-testid={`preview-month-${m.month}`}>
                      <div className="text-[10px] text-muted-foreground">{MONTH_LABEL[m.month].slice(0, 3)}</div>
                      <Input type="number" min="0" data-testid={`month-amount-${m.month}`}
                        className="h-7 px-1 text-xs tabular-nums text-center"
                        placeholder="0"
                        value={m.override ? m.net : (m.noFee ? '' : m.net)}
                        onChange={(e) => setMonthAmount(m.month, e.target.value)} />
                      {m.noFee && !m.override && <div className="text-[9px] text-muted-foreground">No Fee</div>}
                      {m.noFee && m.override && <div className="text-[9px] text-[#B45309]">Skipped</div>}
                      {!m.noFee && m.discount > 0 && <div className="text-[9px] text-[#0F766E]">-{money(m.discount)}</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <DialogFooter>
            <Button type="submit" data-testid="save-plan" disabled={saving}>{saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Add Plan')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
