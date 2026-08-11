import React, { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { api, money } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarDays, CreditCard, CheckCircle2, AlertCircle, Clock, BadgePercent } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useChild } from '@/contexts/ChildContext';
import { ChildSwitcher } from '@/components/ChildSwitcher';

export default function ParentPay() {
  useAuth(); // ensure auth context is initialized
  const { activeChild, activeChildId, children } = useChild();
  const [sched, setSched] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState({}); // {index: true}
  const [tab, setTab] = useState('monthly');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!activeChildId) { setSched(null); setSelected({}); return; }
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/fees/student/${activeChildId}/fee-schedule`);
        setSched(data);
        // Auto-select all pending/overdue months (helpful default for parents)
        const preset = {};
        (data.schedule || []).forEach((m) => {
          if (m.status === 'overdue' || m.status === 'pending' || m.status === 'partial') preset[m.index] = false;
        });
        setSelected(preset);
      } catch (err) {
        toast.error('Failed to load fee schedule');
      } finally { setLoading(false); }
    })();
  }, [activeChildId]);

  const selectedMonths = useMemo(
    () => (sched?.schedule || []).filter((m) => selected[m.index]),
    [selected, sched],
  );
  const monthlyPayable = useMemo(() => {
    // For partial months, only the remaining portion is payable.
    return selectedMonths.reduce((acc, m) => {
      const due = Math.max((m.amount || 0) - (m.paid_amount || 0), 0);
      return acc + due;
    }, 0);
  }, [selectedMonths]);

  const toggleMonth = (m) => {
    if (m.status === 'paid' || m.status === 'no_fee') return; // can't select fully paid / no-fee months
    setSelected((s) => ({ ...s, [m.index]: !s[m.index] }));
  };
  const selectAllPending = () => {
    const preset = {};
    (sched?.schedule || []).forEach((m) => {
      if (m.status !== 'paid' && m.status !== 'no_fee') preset[m.index] = true;
    });
    setSelected(preset);
  };
  const clearSelection = () => setSelected({});

  const payMonthly = async () => {
    if (!activeChildId) return toast.error('Select a child first');
    if (selectedMonths.length === 0) return toast.error('Select at least one month to pay');
    setSaving(true);
    try {
      const feeHeadName = (sched?.fee_head_names || ['Tuition Fee'])[0];
      const items = selectedMonths.map((m) => ({
        fee_head_name: feeHeadName,
        period: m.label,
        amount: Math.max((m.amount || 0) - (m.paid_amount || 0), 0),
      }));
      const { data: order } = await api.post('/payments/razorpay/order', {
        student_id: activeChildId, items, discount: 0, late_fee: 0,
      });
      await openRazorpay(order, `Monthly Fee: ${selectedMonths.map((m) => m.label).join(', ')}`);
    } catch (err) {
      handlePayError(err);
    } finally { setSaving(false); }
  };

  const payFull = async () => {
    if (!activeChildId) return toast.error('Select a child first');
    if (!sched || sched.remaining_balance <= 0) return toast.error('Nothing to pay – balance is already ₹0');
    setSaving(true);
    try {
      const feeHeadName = (sched.fee_head_names || ['Tuition Fee'])[0];
      // Send one line item at gross remaining, and let discount reduce final total.
      const items = [{
        fee_head_name: feeHeadName,
        period: `${sched.academic_session} (Annual)`,
        amount: sched.remaining_balance,
      }];
      const { data: order } = await api.post('/payments/razorpay/order', {
        student_id: activeChildId,
        items,
        discount: sched.full_payment_discount || 0,
        late_fee: 0,
      });
      await openRazorpay(order, `Annual Fee ${sched.academic_session}`);
    } catch (err) {
      handlePayError(err);
    } finally { setSaving(false); }
  };

  const openRazorpay = (order, description) => new Promise((resolve) => {
    if (!window.Razorpay) {
      toast.error('Razorpay checkout script not loaded');
      resolve(); return;
    }
    const rzp = new window.Razorpay({
      key: order.key_id, amount: order.amount, currency: order.currency, order_id: order.order_id,
      name: 'Stanvard School', description, prefill: { name: order.student_name },
      handler: async (r) => {
        try {
          const { data: payment } = await api.post('/payments/razorpay/verify', {
            razorpay_order_id: r.razorpay_order_id,
            razorpay_payment_id: r.razorpay_payment_id,
            razorpay_signature: r.razorpay_signature,
          });
          toast.success(`Payment successful! Receipt: ${payment.receipt_number}`, {
            action: { label: 'View Receipt', onClick: () => openReceipt(payment.id) },
          });
          // Reload schedule
          const { data } = await api.get(`/fees/student/${activeChildId}/fee-schedule`);
          setSched(data);
          setSelected({});
        } catch (e) { toast.error('Verification failed'); }
        resolve();
      },
      modal: { ondismiss: resolve },
      theme: { color: '#0B2F4A' },
    });
    rzp.open();
  });

  const handlePayError = (err) => {
    const detail = err.response?.data?.detail || 'Failed to initiate payment';
    if (String(detail).toLowerCase().includes('razorpay not configured')) {
      toast.error('Online payments are being configured. Please contact the school office to pay offline for now.', { duration: 6000 });
    } else {
      toast.error(detail);
    }
  };

  const openReceipt = async (id) => {
    try {
      const resp = await api.get(`/payments/${id}/receipt.pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([resp.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
    } catch (e) { toast.error('Failed to open receipt'); }
  };

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="h-font text-2xl font-semibold">Pay Fees</h1>
          <p className="text-sm text-muted-foreground">
            {activeChild
              ? `Choose between Monthly or Full-Year payment for ${activeChild.full_name} (${activeChild.admission_number}).`
              : 'Select a child to view their pending fees.'}
          </p>
        </div>
        {children.length > 0 && <ChildSwitcher />}
      </div>

      {!activeChild && (
        <Card className="p-6 border-border text-center text-sm text-muted-foreground" data-testid="parent-pay-no-child">
          Your account has no linked children. Please contact the school office.
        </Card>
      )}

      {activeChild && loading && (
        <Card className="p-6 border-border text-center text-sm text-muted-foreground">Loading fee details…</Card>
      )}

      {activeChild && !loading && sched && (
        <>
          <SummaryStrip sched={sched} />

          {sched.you_saved > 0 && (
            <div className="mt-3 rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] p-3 flex items-center gap-2 text-sm text-[#065F46]" data-testid="you-saved-banner">
              <BadgePercent className="h-4 w-4" />
              <span>You saved <span className="font-semibold tabular-nums">{money(sched.you_saved)}</span> this session with plan discounts.</span>
            </div>
          )}

          <Tabs value={tab} onValueChange={setTab} className="mt-4">
            <TabsList className="grid grid-cols-2 w-full max-w-md">
              <TabsTrigger value="monthly" data-testid="tab-monthly" className="gap-2"><CalendarDays className="h-4 w-4" /> Pay Monthly</TabsTrigger>
              <TabsTrigger value="full" data-testid="tab-full" className="gap-2"><CreditCard className="h-4 w-4" /> Pay Full (Annual)</TabsTrigger>
            </TabsList>

            <TabsContent value="monthly">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-4">
                <div className="xl:col-span-2">
                  <Card className="p-5 border-border">
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                      <div className="font-medium">Select months to pay</div>
                      <div className="flex items-center gap-2 text-xs">
                        <Button size="sm" variant="outline" onClick={selectAllPending} data-testid="select-all-pending">Select all pending</Button>
                        <Button size="sm" variant="ghost" onClick={clearSelection}>Clear</Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {(sched.schedule || []).map((m) => (
                        <MonthTile
                          key={m.index} m={m}
                          selected={!!selected[m.index]}
                          onToggle={() => toggleMonth(m)}
                        />
                      ))}
                    </div>
                  </Card>
                </div>

                <div>
                  <Card className="p-5 border-border sticky top-20">
                    <div className="text-sm font-semibold mb-3">Monthly Payment Summary</div>
                    <SummaryRow label="Months selected" value={selectedMonths.length} />
                    <SummaryRow label="Monthly amount" value={money(sched.monthly_amount)} />
                    <div className="flex items-center justify-between pt-3 border-t border-border mt-3">
                      <span className="text-sm font-medium">Total Payable</span>
                      <span className="h-font text-xl font-semibold tabular-nums">{money(monthlyPayable)}</span>
                    </div>
                    <Button data-testid="pay-monthly-btn" onClick={payMonthly}
                      disabled={saving || monthlyPayable <= 0}
                      className="w-full mt-4 h-11 gap-2">
                      <CreditCard className="h-4 w-4" /> {saving ? 'Processing…' : 'Pay Selected Months'}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-3">
                      Secure payments powered by Razorpay. UPI, Cards, Netbanking, Wallets accepted.
                    </p>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="full">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-4">
                <div className="xl:col-span-2">
                  <Card className="p-5 border-border">
                    <div className="font-medium mb-4">Annual Fee — Session {sched.academic_session}</div>
                    <SummaryRow label="Annual fee" value={money(sched.annual_total)} />
                    {sched.plan_discount_total > 0 && (
                      <SummaryRow label="Plan discount" value={`- ${money(sched.plan_discount_total)}`} />
                    )}
                    {sched.concession > 0 && (
                      <SummaryRow label="Concession (per assignment)" value={`- ${money(sched.concession)}`} />
                    )}
                    <SummaryRow label="Net annual" value={money(sched.net_annual)} />
                    <SummaryRow label="Paid so far" value={`- ${money(sched.total_paid)}`} />
                    <div className="flex items-center justify-between py-2 border-t border-border mt-2">
                      <span className="text-sm font-medium">Remaining balance</span>
                      <span className="tabular-nums font-semibold">{money(sched.remaining_balance)}</span>
                    </div>
                    {sched.annual_discount_percent > 0 && sched.full_payment_discount > 0 && (
                      <div className="mt-3 rounded-md bg-[#F0FDF4] border border-[#BBF7D0] p-3 text-sm text-[#166534]">
                        <div className="font-semibold">Full-payment discount: {sched.annual_discount_percent}%</div>
                        <div className="text-xs mt-1">Pay the full remaining balance in one go and save {money(sched.full_payment_discount)}.</div>
                      </div>
                    )}
                  </Card>
                </div>

                <div>
                  <Card className="p-5 border-border sticky top-20">
                    <div className="text-sm font-semibold mb-3">Full-Year Payment Summary</div>
                    <SummaryRow label="Remaining balance" value={money(sched.remaining_balance)} />
                    {sched.full_payment_discount > 0 && (
                      <SummaryRow label={`Discount (${sched.annual_discount_percent}%)`} value={`- ${money(sched.full_payment_discount)}`} />
                    )}
                    <div className="flex items-center justify-between pt-3 border-t border-border mt-3">
                      <span className="text-sm font-medium">Total Payable</span>
                      <span className="h-font text-xl font-semibold tabular-nums">{money(sched.payable_full)}</span>
                    </div>
                    <Button data-testid="pay-full-btn" onClick={payFull}
                      disabled={saving || sched.remaining_balance <= 0}
                      className="w-full mt-4 h-11 gap-2">
                      <CreditCard className="h-4 w-4" /> {saving ? 'Processing…' : 'Pay Full Amount'}
                    </Button>
                    {sched.remaining_balance <= 0 && (
                      <p className="text-xs text-emerald-600 mt-3 text-center">All fees fully paid for this session. </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-3">
                      Secure payments powered by Razorpay. UPI, Cards, Netbanking, Wallets accepted.
                    </p>
                  </Card>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </AppShell>
  );
}

// ------------------------------- helpers -------------------------------

function SummaryStrip({ sched }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard label="Annual Fee" value={money(sched.annual_total)} />
      <StatCard label="Paid" value={money(sched.total_paid)} tone="emerald" />
      <StatCard label="Remaining" value={money(sched.remaining_balance)} tone={sched.remaining_balance > 0 ? 'amber' : 'emerald'} />
      <StatCard label="Monthly" value={money(sched.monthly_amount)} />
    </div>
  );
}

function StatCard({ label, value, tone }) {
  const t = tone === 'emerald' ? 'text-emerald-600' : tone === 'amber' ? 'text-[#B45309]' : '';
  return (
    <Card className="p-4 border-border">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`h-font text-xl font-semibold tabular-nums mt-1 ${t}`}>{value}</div>
    </Card>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground py-1">
      <span>{label}</span>
      <span className="tabular-nums text-foreground">{value}</span>
    </div>
  );
}

function MonthTile({ m, selected, onToggle }) {
  const isPaid = m.status === 'paid';
  const isPartial = m.status === 'partial';
  const isOverdue = m.status === 'overdue';
  const isNoFee = m.status === 'no_fee';
  const badge = isPaid ? (
    <Badge className="bg-[#E6F6F4] text-[#0F766E] border border-[#BFEAE6] gap-1"><CheckCircle2 className="h-3 w-3" /> Paid</Badge>
  ) : isNoFee ? (
    <Badge variant="secondary" className="text-slate-400">No Fee</Badge>
  ) : isOverdue ? (
    <Badge className="bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA] gap-1"><AlertCircle className="h-3 w-3" /> Overdue</Badge>
  ) : isPartial ? (
    <Badge className="bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] gap-1"><Clock className="h-3 w-3" /> Partial</Badge>
  ) : (
    <Badge variant="secondary">Pending</Badge>
  );
  const due = Math.max((m.amount || 0) - (m.paid_amount || 0), 0);
  return (
    <button
      type="button" onClick={onToggle} disabled={isPaid || isNoFee}
      data-testid={`month-tile-${m.index}`}
      className={`text-left rounded-lg border p-3 transition ${
        isPaid ? 'bg-muted/40 border-border cursor-default opacity-80'
          : isNoFee ? 'bg-slate-50 border-dashed border-slate-200 cursor-default opacity-60'
          : selected ? 'border-[#0B2F4A] ring-2 ring-[#0B2F4A]/20 bg-[#F1F5F9]'
          : 'border-border hover:border-[#0B2F4A]/40 hover:bg-muted/40'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-sm font-semibold">{m.label}</div>
        {badge}
      </div>
      <div className="text-xs text-muted-foreground">{isNoFee ? 'No fee this month' : (<>Due: <span className="tabular-nums text-foreground">{money(due)}</span></>)}</div>
      {m.paid_amount > 0 && !isPaid && (
        <div className="text-[11px] text-emerald-600 mt-1">Paid so far: {money(m.paid_amount)}</div>
      )}
    </button>
  );
}
