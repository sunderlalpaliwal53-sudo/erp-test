import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { api, money } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { User, Receipt, Trash2, IndianRupee, CalendarDays, CheckCircle2, AlertCircle, Clock, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useSchool } from '@/contexts/SchoolContext';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';

const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'razorpay', label: 'Online (Razorpay)' },
];

export default function FeeCollection() {
  const [params] = useSearchParams();
  const { activeSchoolId } = useSchool();
  const { user } = useAuth();
  const isAccountant = user?.role === 'accountant';
  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState(params.get('student') || '');
  const [selected, setSelected] = useState(null);
  const [sched, setSched] = useState(null);
  const [selectedMonths, setSelectedMonths] = useState({}); // {index: true}

  // Manual items (for custom/annual mode)
  const [items, setItems] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [discountReason, setDiscountReason] = useState('');
  const [applicationImage, setApplicationImage] = useState(''); // base64 data URL for owner review
  const [applicationImageName, setApplicationImageName] = useState('');
  const [lateFee, setLateFee] = useState(0);
  const [mode, setMode] = useState('cash');
  const [txnRef, setTxnRef] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tab, setTab] = useState('monthly'); // monthly | full | custom
  const [awaitingCount, setAwaitingCount] = useState(0);

  const loadAwaitingCount = useCallback(async () => {
    try {
      const { data } = await api.get('/discount-approvals/awaiting-collection-count');
      setAwaitingCount(data?.count || 0);
    } catch (_) { /* silent */ }
  }, []);
  useEffect(() => { loadAwaitingCount(); }, [loadAwaitingCount]);

  const loadStudents = useCallback(async () => {
    if (!activeSchoolId) return;
    const { data } = await api.get('/students', { params: { limit: 5000 } });
    setStudents(data);
  }, [activeSchoolId]);
  useEffect(() => { loadStudents(); }, [loadStudents]);
  useEffect(() => {
    const h = () => { loadStudents(); setStudentId(''); setSelected(null); setSched(null); setItems([]); };
    window.addEventListener('stv:school-changed', h);
    return () => window.removeEventListener('stv:school-changed', h);
  }, [loadStudents]);

  const loadSchedule = useCallback(async (sid) => {
    if (!sid) return;
    const { data } = await api.get(`/fees/student/${sid}/fee-schedule`);
    setSched(data);
    setSelected(data.student);
    setSelectedMonths({});
    // Pre-fill custom items list from due items (for the custom tab)
    const now = new Date();
    const monthLabel = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    try {
      const { data: dues } = await api.get(`/fees/student/${sid}/dues`);
      setItems((dues.dues || []).slice(0, 5).map((d, i) => ({
        key: `pre-${d.fee_head_id || 'x'}-${i}`,
        fee_head_id: d.fee_head_id, fee_head_name: d.fee_head_name,
        period: d.frequency === 'yearly' ? '2026-27' : monthLabel,
        amount: d.amount, selected: true,
      })));
    } catch (_e) { setItems([]); }
  }, []);

  useEffect(() => {
    if (!studentId) { setSelected(null); setSched(null); setSelectedMonths({}); setItems([]); return; }
    loadSchedule(studentId);
  }, [studentId, loadSchedule]);

  // ----- Monthly tab helpers -----
  const monthlyItems = useMemo(() => {
    if (!sched) return [];
    return (sched.schedule || [])
      .filter((m) => selectedMonths[m.index] && m.status !== 'paid')
      .map((m) => ({
        fee_head_id: null,
        fee_head_name: (sched.fee_head_names || ['Tuition Fee'])[0],
        period: m.label,
        amount: Math.max((m.amount || 0) - (m.paid_amount || 0), 0),
      }));
  }, [sched, selectedMonths]);
  const monthlySubtotal = monthlyItems.reduce((s, i) => s + Number(i.amount || 0), 0);
  const monthlyTotal = monthlySubtotal + Number(lateFee || 0) - Number(discount || 0);

  const toggleMonth = (m) => {
    if (m.status === 'paid') return;
    setSelectedMonths((s) => ({ ...s, [m.index]: !s[m.index] }));
  };
  const selectAllPending = () => {
    const preset = {};
    (sched?.schedule || []).forEach((m) => { if (m.status !== 'paid') preset[m.index] = true; });
    setSelectedMonths(preset);
  };

  // ----- Full tab helpers -----
  const fullItem = useMemo(() => {
    if (!sched || sched.remaining_balance <= 0) return null;
    return [{
      fee_head_id: null,
      fee_head_name: (sched.fee_head_names || ['Tuition Fee'])[0],
      period: `${sched.academic_session} (Annual)`,
      amount: sched.remaining_balance,
    }];
  }, [sched]);
  // For full mode, prefill discount with plan discount unless admin edited.
  // Accountants get NO discount — even the plan's auto full-payment discount is
  // suppressed for them (they must ask a School Admin to raise a discount request).
  useEffect(() => {
    if (isAccountant) {
      setDiscount(0);
      return;
    }
    if (tab === 'full' && sched && sched.full_payment_discount > 0) {
      setDiscount(sched.full_payment_discount);
    } else if (tab !== 'full') {
      // keep as-is when leaving full tab
    }
  }, [tab, sched, isAccountant]);
  const fullTotal = (sched?.remaining_balance || 0) + Number(lateFee || 0) - Number(discount || 0);

  // ----- Custom tab helpers -----
  const toggleItem = (key) => setItems((prev) => prev.map((it) => it.key === key ? { ...it, selected: !it.selected } : it));
  const updateAmount = (key, v) => setItems((prev) => prev.map((it) => it.key === key ? { ...it, amount: Number(v) } : it));
  const updateField = (key, field, v) => setItems((prev) => prev.map((it) => it.key === key ? { ...it, [field]: v } : it));
  const removeItem = (key) => setItems((prev) => prev.filter((it) => it.key !== key));
  const activeCustomItems = items.filter((i) => i.selected);
  const customSubtotal = activeCustomItems.reduce((s, i) => s + Number(i.amount || 0), 0);
  const customTotal = customSubtotal + Number(lateFee || 0) - Number(discount || 0);

  // ----- Which payload to send -----
  const currentItems =
    tab === 'monthly' ? monthlyItems :
      tab === 'full' ? (fullItem || []) :
        activeCustomItems.map((i) => ({ fee_head_id: i.fee_head_id, fee_head_name: i.fee_head_name, period: i.period, amount: Number(i.amount) }));
  const currentTotal = tab === 'monthly' ? monthlyTotal : tab === 'full' ? fullTotal : customTotal;
  const canSubmit = studentId && currentItems.length > 0 && currentTotal >= 0;

  const submit = async () => {
    if (!canSubmit) { toast.error('Select student and at least one fee item'); return; }
    // Accountants cannot apply discounts — force 0 regardless of state
    const discountNum = isAccountant ? 0 : Number(discount || 0);
    if (discountNum > 0 && !discountReason.trim()) {
      toast.error('Discount reason is required for owner approval');
      return;
    }
    if (discountNum > 0 && !applicationImage) {
      toast.error("Please attach the parent's written application image — it is mandatory for a discount request.");
      return;
    }
    setSaving(true);
    const payload = {
      student_id: studentId,
      items: currentItems,
      discount: discountNum,
      late_fee: Number(lateFee || 0),
      payment_mode: mode,
      txn_ref: txnRef,
      remarks: remarks || (tab === 'monthly' ? `Monthly fee: ${monthlyItems.map((i) => i.period).join(', ')}` : (tab === 'full' ? 'Annual/Full-year payment' : remarks)),
      discount_reason: discountNum > 0 ? discountReason.trim() : undefined,
      application_image: discountNum > 0 ? applicationImage : undefined,
    };
    try {
      if (mode === 'razorpay') {
        const { data: order } = await api.post('/payments/razorpay/order', payload);
        const rzp = new window.Razorpay({
          key: order.key_id, amount: order.amount, currency: order.currency,
          order_id: order.order_id, name: 'Stanvard School',
          description: `Fee payment for ${order.student_name}`,
          prefill: { name: order.student_name },
          handler: async (r) => {
            try {
              const { data: payment } = await api.post('/payments/razorpay/verify', {
                razorpay_order_id: r.razorpay_order_id,
                razorpay_payment_id: r.razorpay_payment_id,
                razorpay_signature: r.razorpay_signature,
              });
              toast.success(`Payment successful! Receipt: ${payment.receipt_number}`, {
                action: { label: 'Download Receipt', onClick: () => downloadReceipt(payment.id, payment.receipt_number) },
              });
              // Auto-download the 2-up A4 landscape receipt for admin office + parent copy
              downloadReceipt(payment.id, payment.receipt_number);
              resetForm();
            } catch (_e) { toast.error('Verification failed'); }
          },
          theme: { color: '#0B2F4A' },
        });
        rzp.open();
      } else {
        const { data: payment } = await api.post('/payments/collect', payload);
        if (payment?.status === 'pending_approval') {
          toast.success('Sent to Owner for approval', {
            description: `Discount ${money(discountNum)} on ${selected?.full_name || 'student'} — the Owner will review the application. Once approved, come to "Awaiting Collection" to collect the money and print the receipt.`,
            duration: 8000,
          });
          resetForm();
        } else {
          toast.success(`Receipt ${payment.receipt_number} downloaded`, {
            description: 'One page with Office copy + Parent copy (A4 landscape).',
            action: { label: 'Re-download', onClick: () => downloadReceipt(payment.id, payment.receipt_number) },
          });
          // Auto-download the 2-up A4 landscape receipt for admin office + parent copy
          downloadReceipt(payment.id, payment.receipt_number);
          resetForm();
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to collect payment');
    } finally { setSaving(false); }
  };

  const downloadReceipt = async (id, receiptNumber) => {
    try {
      const resp = await api.get(`/payments/${id}/receipt.pdf`, { responseType: 'blob' });
      const blob = new Blob([resp.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      // Trigger a download with a friendly filename.
      const a = document.createElement('a');
      a.href = url;
      a.download = `Receipt-${receiptNumber || id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Also open in a new tab so the admin can preview / print immediately.
      window.open(url, '_blank');
      // Revoke the object URL after some time to free memory.
      setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
    } catch (_e) {
      toast.error('Failed to download receipt PDF');
    }
  };

  const openReceipt = (id) => downloadReceipt(id);

  const resetForm = () => {
    setDiscount(0); setDiscountReason(''); setLateFee(0); setMode('cash'); setTxnRef(''); setRemarks('');
    setApplicationImage(''); setApplicationImageName('');
    setSelectedMonths({});
    if (studentId) loadSchedule(studentId);
  };

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="h-font text-2xl font-semibold">Collect Fee</h1>
          <p className="text-sm text-muted-foreground">Select student, choose Monthly / Full / Custom mode and collect payment.</p>
        </div>
        {awaitingCount > 0 && (
          <Link
            to="/approvals?tab=approved"
            className="inline-flex items-center gap-2 rounded-md border-2 border-blue-300 bg-blue-50 hover:bg-blue-100 px-4 py-2 text-sm font-medium text-blue-900 transition-colors"
            data-testid="fee-collect-awaiting-badge"
          >
            <AlertCircle className="h-4 w-4" />
            {awaitingCount} approval{awaitingCount === 1 ? '' : 's'} awaiting collection →
          </Link>
        )}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          {/* STUDENT PICKER */}
          <Card className="p-5 border-border">
            <Label className="mb-2 block">Student</Label>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <button data-testid="fee-collect-student-picker" className="w-full flex items-center gap-2 h-11 px-3 rounded-md border border-border bg-card hover:bg-secondary text-sm text-left">
                  <User className="h-4 w-4 text-muted-foreground" />
                  {selected ? (
                    <span><span className="font-medium">{selected.full_name}</span> <span className="text-muted-foreground">· {selected.admission_number}</span></span>
                  ) : <span className="text-muted-foreground">Search & select student</span>}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[92vw] sm:w-[420px] p-0">
                <Command>
                  <CommandInput placeholder="Search by name or admission number…" />
                  <CommandList>
                    <CommandEmpty>No students found</CommandEmpty>
                    <CommandGroup>
                      {students.slice(0, 200).map((s) => (
                        <CommandItem key={s.id} value={`${s.full_name} ${s.admission_number}`} onSelect={() => { setStudentId(s.id); setPickerOpen(false); }}>
                          <div className="flex flex-col">
                            <span className="font-medium">{s.full_name}</span>
                            <span className="text-xs text-muted-foreground">{s.admission_number}</span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {sched && (
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <StatMini label="Annual" value={money(sched.annual_total)} />
                <StatMini label="Paid" value={money(sched.total_paid)} tone="emerald" />
                <StatMini label="Remaining" value={money(sched.remaining_balance)} tone={sched.remaining_balance > 0 ? 'amber' : 'emerald'} />
                <StatMini label="Monthly (÷12)" value={money(sched.monthly_amount)} />
              </div>
            )}
          </Card>

          {/* PAYMENT MODES */}
          {sched && (
            <Card className="p-5 border-border">
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="monthly" data-testid="tab-monthly" className="gap-1.5 text-xs sm:text-sm">
                    <CalendarDays className="h-4 w-4" /> <span className="hidden xs:inline sm:inline">Monthly</span><span className="xs:hidden sm:hidden">Month</span>
                  </TabsTrigger>
                  <TabsTrigger value="full" data-testid="tab-full" className="gap-1.5 text-xs sm:text-sm">
                    <Receipt className="h-4 w-4" /> <span className="hidden sm:inline">Full (Annual)</span><span className="sm:hidden">Full</span>
                  </TabsTrigger>
                  <TabsTrigger value="custom" data-testid="tab-custom" className="gap-1.5 text-xs sm:text-sm">
                    <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Custom Items</span><span className="sm:hidden">Custom</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="monthly">
                  <div className="flex items-center justify-between mb-3 mt-4 flex-wrap gap-2">
                    <div className="text-sm font-medium">Select months to collect</div>
                    <div className="flex items-center gap-2 text-xs">
                      <Button size="sm" variant="outline" onClick={selectAllPending} data-testid="select-all-pending">Select all pending</Button>
                      <Button size="sm" variant="ghost" onClick={() => setSelectedMonths({})}>Clear</Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {(sched.schedule || []).map((m) => (
                      <MonthTile key={m.index} m={m} selected={!!selectedMonths[m.index]} onToggle={() => toggleMonth(m)} />
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="full">
                  <div className="mt-4 space-y-2">
                    <Row label="Annual fee" value={money(sched.annual_total)} />
                    {sched.concession > 0 && <Row label="Concession" value={`- ${money(sched.concession)}`} />}
                    <Row label="Net annual" value={money(sched.net_annual)} />
                    <Row label="Paid so far" value={`- ${money(sched.total_paid)}`} />
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <span className="text-sm font-semibold">Remaining balance</span>
                      <span className="tabular-nums font-semibold">{money(sched.remaining_balance)}</span>
                    </div>
                    {sched.annual_discount_percent > 0 && sched.full_payment_discount > 0 && (
                      <div className="mt-2 rounded-md bg-[#F0FDF4] border border-[#BBF7D0] p-3 text-xs text-[#166534]">
                        <div className="font-semibold">Full-payment discount: {sched.annual_discount_percent}% ({money(sched.full_payment_discount)}) auto-applied.</div>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="custom">
                  <div className="flex items-center justify-between mb-3 mt-4">
                    <div className="text-sm font-medium">Custom Fee Items</div>
                    <Button type="button" variant="outline" size="sm" onClick={() => setItems([...items, { key: `add-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, fee_head_name: 'Custom', period: '', amount: 0, selected: true }])}>+ Add Item</Button>
                  </div>
                  <div className="divide-y divide-border">
                    {items.length === 0 && <div className="py-6 text-sm text-muted-foreground text-center">No items yet.</div>}
                    {items.map((it) => (
                      <div key={it.key} className="py-3 grid grid-cols-12 items-center gap-2">
                        <input type="checkbox" checked={it.selected} onChange={() => toggleItem(it.key)} className="col-span-1" />
                        <Input className="col-span-5" value={it.fee_head_name} onChange={(e) => updateField(it.key, 'fee_head_name', e.target.value)} />
                        <Input className="col-span-3" placeholder="Period" value={it.period} onChange={(e) => updateField(it.key, 'period', e.target.value)} />
                        <div className="col-span-2 relative">
                          <IndianRupee className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <Input className="pl-7 tabular-nums text-right" type="number" value={it.amount} onChange={(e) => updateAmount(it.key, e.target.value)} />
                        </div>
                        <button className="col-span-1 text-muted-foreground hover:text-destructive" onClick={() => removeItem(it.key)}><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </Card>
          )}
        </div>

        {/* RIGHT: SUMMARY */}
        <div>
          <Card className="p-5 border-border sticky top-20">
            <div className="text-sm font-semibold mb-3">Payment Summary</div>
            <div className="space-y-2 text-sm">
              {tab === 'monthly' && (
                <>
                  <Row label="Months selected" value={monthlyItems.length} />
                  <Row label="Subtotal" value={money(monthlySubtotal)} />
                </>
              )}
              {tab === 'full' && (
                <Row label="Remaining balance" value={money(sched?.remaining_balance || 0)} />
              )}
              {tab === 'custom' && (
                <Row label="Subtotal" value={money(customSubtotal)} />
              )}
              <div className="grid gap-1.5">
                <Label className="text-xs">Discount (₹)</Label>
                {isAccountant ? (
                  <div className="rounded-md border border-border bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
                    Discounts are disabled for accountants. Please ask a School Admin
                    or Super Admin to raise a discount request.
                  </div>
                ) : (
                  <Input data-testid="fee-collect-discount-input" type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} />
                )}
              </div>
              {!isAccountant && Number(discount || 0) > 0 && (
                <div className="grid gap-1.5 rounded-md border border-amber-300 bg-amber-50 p-2.5">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 text-amber-700 shrink-0" />
                    <div className="text-[11px] text-amber-900 leading-snug">
                      <div className="font-semibold">Owner approval required</div>
                      <div>The discount is sent to the Owner along with the parent's written application. Once approved, come back to <b>Fee Collection → Awaiting Collection</b> to collect the money and print the receipt.</div>
                    </div>
                  </div>
                  <Label className="text-xs mt-1">Reason for Discount <span className="text-red-600">*</span></Label>
                  <Textarea
                    data-testid="fee-collect-discount-reason-input"
                    rows={2}
                    placeholder="e.g. Sibling concession, scholarship, staff ward…"
                    value={discountReason}
                    onChange={(e) => setDiscountReason(e.target.value)}
                    className="bg-white"
                  />
                  <Label className="text-xs mt-2">
                    Parent's written application (image/PDF) <span className="text-red-600">*</span>
                  </Label>
                  <div className="text-[10px] text-amber-900 -mt-0.5">
                    Scan or photograph the plain-paper application. This will be shown to the Owner during review.
                  </div>
                  {!applicationImage ? (
                    <label
                      className="flex items-center justify-center gap-2 h-24 rounded-md border-2 border-dashed border-amber-400 bg-white cursor-pointer hover:bg-amber-50 transition text-xs text-amber-800"
                      data-testid="fee-collect-application-upload"
                    >
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          if (f.size > 3 * 1024 * 1024) {
                            toast.error('File too large — please upload a file under 3 MB');
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = () => {
                            setApplicationImage(String(reader.result || ''));
                            setApplicationImageName(f.name);
                          };
                          reader.onerror = () => toast.error('Could not read the file');
                          reader.readAsDataURL(f);
                        }}
                      />
                      <Plus className="h-4 w-4" />
                      <span>Upload application (JPG, PNG, or PDF · max 3 MB)</span>
                    </label>
                  ) : (
                    <div className="rounded-md border border-amber-300 bg-white p-2 flex items-start gap-2">
                      {applicationImage.startsWith('data:image/') ? (
                        <img
                          src={applicationImage}
                          alt="Application preview"
                          className="h-20 w-20 object-cover rounded border border-border"
                          data-testid="fee-collect-application-preview"
                        />
                      ) : (
                        <div className="h-20 w-20 rounded border border-border bg-secondary/50 flex items-center justify-center text-[10px] font-semibold text-muted-foreground">
                          PDF
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{applicationImageName || 'application.pdf'}</div>
                        <div className="text-[10px] text-muted-foreground">
                          Attached — will be shown to the Owner
                        </div>
                        <button
                          type="button"
                          onClick={() => { setApplicationImage(''); setApplicationImageName(''); }}
                          className="text-[11px] text-red-700 hover:underline mt-1"
                          data-testid="fee-collect-application-remove"
                        >
                          Remove &amp; upload another
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="grid gap-1.5">
                <Label className="text-xs">Late Fee (₹)</Label>
                <Input data-testid="fee-collect-latefee-input" type="number" value={lateFee} onChange={(e) => setLateFee(e.target.value)} />
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className="text-sm font-medium">Total Payable</span>
                <span className="h-font text-xl font-semibold tabular-nums">{money(Math.max(currentTotal, 0))}</span>
              </div>
            </div>
            <div className="mt-4">
              <Label className="text-xs mb-2 block">Payment Mode</Label>
              <RadioGroup value={mode} onValueChange={setMode} className="grid grid-cols-2 gap-1.5" data-testid="fee-collect-payment-mode">
                {PAYMENT_MODES.map((m) => (
                  <label key={m.value} className={`flex items-center gap-2 rounded-md border border-border px-3 py-2 cursor-pointer text-sm ${mode === m.value ? 'bg-secondary border-[hsl(var(--primary))]' : ''}`}>
                    <RadioGroupItem value={m.value} />
                    <span>{m.label}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>
            {(mode !== 'cash' && mode !== 'razorpay') && (
              <div className="mt-3 grid gap-1.5">
                <Label className="text-xs">Reference / Cheque No.</Label>
                <Input value={txnRef} onChange={(e) => setTxnRef(e.target.value)} />
              </div>
            )}
            <div className="mt-3 grid gap-1.5">
              <Label className="text-xs">Remarks</Label>
              <Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </div>
            <Button data-testid="fee-collect-generate-receipt-button" onClick={submit} disabled={saving || !canSubmit} className="w-full mt-4 h-11 gap-2">
              <Receipt className="h-4 w-4" /> {saving ? 'Processing…' : mode === 'razorpay' ? 'Pay Online' : (Number(discount || 0) > 0 ? 'Send for Owner Approval' : 'Generate Receipt')}
            </Button>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

const Row = ({ label, value }) => (
  <div className="flex items-center justify-between"><span className="text-muted-foreground">{label}</span><span className="tabular-nums font-medium">{value}</span></div>
);

function StatMini({ label, value, tone }) {
  const t = tone === 'emerald' ? 'text-emerald-600' : tone === 'amber' ? 'text-[#B45309]' : '';
  return (
    <div className="rounded-md border border-border px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`h-font tabular-nums font-semibold text-sm ${t}`}>{value}</div>
    </div>
  );
}

function MonthTile({ m, selected, onToggle }) {
  const isPaid = m.status === 'paid';
  const isPartial = m.status === 'partial';
  const isOverdue = m.status === 'overdue';
  const badge = isPaid ? (
    <Badge className="bg-[#E6F6F4] text-[#0F766E] border border-[#BFEAE6] gap-1"><CheckCircle2 className="h-3 w-3" /> Paid</Badge>
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
      type="button" onClick={onToggle} disabled={isPaid}
      data-testid={`month-tile-${m.index}`}
      className={`text-left rounded-lg border p-3 transition ${
        isPaid ? 'bg-muted/40 border-border cursor-default opacity-80'
          : selected ? 'border-[#0B2F4A] ring-2 ring-[#0B2F4A]/20 bg-[#F1F5F9]'
          : 'border-border hover:border-[#0B2F4A]/40 hover:bg-muted/40'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-sm font-semibold">{m.label}</div>
        {badge}
      </div>
      <div className="text-xs text-muted-foreground">Due: <span className="tabular-nums text-foreground">{money(due)}</span></div>
      {m.paid_amount > 0 && !isPaid && (
        <div className="text-[11px] text-emerald-600 mt-1">Paid so far: {money(m.paid_amount)}</div>
      )}
    </button>
  );
}
