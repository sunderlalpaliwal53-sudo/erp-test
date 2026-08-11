import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api, money } from '@/lib/api';
import { Plus, Trash2, IndianRupee, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'razorpay', label: 'Razorpay (Online)' },
];

/**
 * Super-admin only dialog to correct a wrongly generated receipt.
 * The `receipt_number` is preserved for financial continuity; a new PDF is
 * generated from the updated data and can be downloaded immediately.
 */
export default function EditReceiptDialog({ open, onOpenChange, payment, onSaved }) {
  const [items, setItems] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [lateFee, setLateFee] = useState(0);
  const [mode, setMode] = useState('cash');
  const [txnRef, setTxnRef] = useState('');
  const [remarks, setRemarks] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!payment) return;
    setItems((payment.items || []).map((it, i) => ({
      key: `it-${i}`,
      fee_head_name: it.fee_head_name || '',
      period: it.period || '',
      amount: Number(it.amount || 0),
    })));
    setDiscount(Number(payment.discount || 0));
    setLateFee(Number(payment.late_fee || 0));
    setMode(payment.payment_mode || 'cash');
    setTxnRef(payment.txn_ref || '');
    setRemarks(payment.remarks || '');
    setReason('');
  }, [payment]);

  const subtotal = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const total = Math.max(subtotal + Number(lateFee || 0) - Number(discount || 0), 0);

  const setField = (key, field, val) =>
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, [field]: val } : it)));
  const addItem = () =>
    setItems([...items, { key: `new-${Date.now()}`, fee_head_name: '', period: '', amount: 0 }]);
  const removeItem = (key) =>
    setItems((prev) => prev.filter((it) => it.key !== key));

  const submit = async () => {
    if (!reason.trim()) { toast.error('Please enter a reason for the edit'); return; }
    if (items.length === 0) { toast.error('Add at least one fee item'); return; }
    for (const it of items) {
      if (!it.fee_head_name.trim() || !(Number(it.amount) > 0)) {
        toast.error('Every item needs a fee head and amount > 0'); return;
      }
    }
    setSaving(true);
    try {
      const payload = {
        items: items.map((it) => ({
          fee_head_name: it.fee_head_name.trim(),
          period: it.period.trim(),
          amount: Number(it.amount),
        })),
        discount: Number(discount || 0),
        late_fee: Number(lateFee || 0),
        payment_mode: mode,
        txn_ref: txnRef.trim() || null,
        remarks: remarks.trim() || null,
        reason: reason.trim(),
      };
      const { data: updated } = await api.patch(`/payments/${payment.id}`, payload);
      toast.success(`Receipt ${updated.receipt_number} updated`, {
        description: `New total ${money(updated.total_paid)}. PDF regenerated.`,
      });
      // Auto-download the corrected PDF for admin office + parent copy
      try {
        const resp = await api.get(`/payments/${updated.id}/receipt.pdf`, { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([resp.data], { type: 'application/pdf' }));
        const a = document.createElement('a');
        a.href = url; a.download = `Receipt-${updated.receipt_number}.pdf`;
        document.body.appendChild(a); a.click(); a.remove();
        window.open(url, '_blank');
        setTimeout(() => window.URL.revokeObjectURL(url), 60000);
      } catch (_e) { /* non-fatal */ }
      onSaved?.(updated);
      onOpenChange(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update receipt');
    } finally { setSaving(false); }
  };

  if (!payment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Edit Receipt{' '}
            <span className="font-mono text-sm text-muted-foreground">
              {payment.receipt_number}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-900 p-3 text-xs flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            You are correcting an existing receipt. The receipt number is retained.
            The old PDF will be replaced by the new one, and the student's dues
            &amp; monthly summary will update automatically. All changes are audited.
          </div>
        </div>

        <div className="grid gap-4 mt-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
            <div><span className="text-muted-foreground">Student</span><div className="font-medium">{payment.student_name}</div></div>
            <div><span className="text-muted-foreground">Date</span><div>{(payment.paid_at || '').slice(0, 16).replace('T', ' ')}</div></div>
            <div><span className="text-muted-foreground">Collected by</span><div>{payment.collected_by_name || '-'}</div></div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm">Fee Items</Label>
              <Button type="button" size="sm" variant="outline" onClick={addItem} className="h-8 gap-1"><Plus className="h-3.5 w-3.5" />Add item</Button>
            </div>
            <div className="border border-border rounded-md divide-y divide-border">
              {items.length === 0 && (<div className="p-3 text-sm text-muted-foreground text-center">No items — add at least one</div>)}
              {items.map((it) => (
                <div key={it.key} className="p-2.5 grid grid-cols-12 items-center gap-2">
                  <Input className="col-span-6 sm:col-span-5" value={it.fee_head_name}
                         placeholder="Fee head (e.g. Tuition)"
                         onChange={(e) => setField(it.key, 'fee_head_name', e.target.value)} />
                  <Input className="col-span-6 sm:col-span-4" value={it.period}
                         placeholder="Period (e.g. April 2026)"
                         onChange={(e) => setField(it.key, 'period', e.target.value)} />
                  <div className="col-span-10 sm:col-span-2 relative">
                    <IndianRupee className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input type="number" min="0" step="0.01" className="pl-7 tabular-nums text-right"
                           value={it.amount}
                           onChange={(e) => setField(it.key, 'amount', e.target.value)} />
                  </div>
                  <button type="button" className="col-span-2 sm:col-span-1 text-muted-foreground hover:text-destructive flex justify-center"
                          onClick={() => removeItem(it.key)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Late Fee</Label>
              <Input type="number" min="0" step="0.01" value={lateFee} onChange={(e) => setLateFee(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Discount</Label>
              <Input type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </div>
            <div className="rounded-md border border-border p-2 text-right">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">New Total</div>
              <div className="h-font text-xl font-semibold tabular-nums">{money(total)}</div>
              <div className="text-[10px] text-muted-foreground">
                (was {money(payment.total_paid)})
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Payment Mode</Label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_MODES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Reference / Cheque No.</Label>
              <Input value={txnRef} onChange={(e) => setTxnRef(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Remarks (optional)</Label>
            <Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs text-destructive">Reason for edit (required — audited)</Label>
            <Input data-testid="edit-receipt-reason" value={reason} onChange={(e) => setReason(e.target.value)}
                   placeholder="e.g. Wrong fee head selected, corrected on request of accountant" />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button data-testid="edit-receipt-save" onClick={submit} disabled={saving || !reason.trim() || items.length === 0}>
            {saving ? 'Saving…' : 'Save & Regenerate Receipt'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
