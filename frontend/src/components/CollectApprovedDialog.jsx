import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { api, money } from '@/lib/api';
import { toast } from 'sonner';
import { CheckCircle2, Receipt, User2, Wallet, IndianRupee } from 'lucide-react';

const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
];

/**
 * CollectApprovedDialog — final step of the discount-approval workflow.
 * Shows the owner-approved amount, lets the admin pick payment mode and
 * txn ref, then calls POST /discount-approvals/{id}/collect which creates
 * the Payment + receipt.
 *
 * Props:
 *   open, onOpenChange, approval, onCollected(payment)
 */
export function CollectApprovedDialog({ open, onOpenChange, approval, onCollected }) {
  const [mode, setMode] = useState('cash');
  const [txnRef, setTxnRef] = useState('');
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (approval) {
      setMode(approval.payment_mode || 'cash');
      setTxnRef(approval.txn_ref || '');
      setRemarks(approval.remarks || '');
    }
  }, [approval?.id]);

  if (!approval) return null;

  const subtotal = Number(approval.subtotal || 0);
  const lateFee = Number(approval.late_fee || 0);
  const approvedDisc = Number(approval.approved_discount ?? approval.discount ?? 0);
  const net = Math.max(subtotal + lateFee - approvedDisc, 0);

  const submit = async () => {
    if ((mode !== 'cash' && mode !== 'razorpay') && !txnRef.trim()) {
      toast.error('Please enter the reference / cheque number for this payment mode.');
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post(`/discount-approvals/${approval.id}/collect`, {
        payment_mode: mode,
        txn_ref: txnRef.trim() || undefined,
        remarks: remarks.trim() || undefined,
      });
      toast.success(`Receipt ${data.receipt_number} generated`, {
        description: 'Downloading the receipt PDF…',
      });
      // Auto-download receipt
      try {
        const resp = await api.get(`/payments/${data.payment_id}/receipt.pdf`, { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([resp.data], { type: 'application/pdf' }));
        const a = document.createElement('a');
        a.href = url; a.download = `Receipt-${data.receipt_number}.pdf`;
        document.body.appendChild(a); a.click(); a.remove();
        window.open(url, '_blank');
        setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
      } catch (_) { /* silent */ }
      onCollected?.(data);
      onOpenChange(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to collect payment');
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            Collect &amp; Generate Receipt
            <Badge className="bg-blue-100 text-blue-800 border border-blue-200">Approved by Owner</Badge>
          </DialogTitle>
          <DialogDescription>
            The owner has approved the discount. Once you collect the money from the parent,
            click <b>Collect &amp; Generate Receipt</b> to record the payment and print the receipt.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Student + approved amounts */}
          <div className="rounded-md border border-border p-3 bg-muted/30">
            <div className="flex items-center gap-2 text-sm font-semibold mb-1">
              <User2 className="h-4 w-4" /> {approval.student_name}
              <span className="text-xs text-muted-foreground font-normal">
                · {approval.admission_number || '—'}
                · {approval.class_name || '—'}{approval.section ? ' ' + approval.section : ''}
              </span>
            </div>
            {approval.reviewed_by_name && (
              <div className="text-[11px] text-muted-foreground">
                Approved by {approval.reviewed_by_name}
                {approval.review_remark ? ` — "${approval.review_remark}"` : ''}
              </div>
            )}
          </div>

          {/* Amount breakdown */}
          <div className="rounded-md border border-border overflow-hidden">
            <div className="divide-y divide-border">
              <Row label="Subtotal" value={money(subtotal)} />
              {lateFee > 0 && <Row label="Late fee" value={`+${money(lateFee)}`} />}
              <Row label="Approved discount" value={`-${money(approvedDisc)}`} tone="emerald" />
              <div className="flex items-center justify-between px-3 py-2.5 bg-[hsl(var(--primary))]/5">
                <span className="font-semibold flex items-center gap-1.5">
                  <Wallet className="h-4 w-4" /> Amount to collect
                </span>
                <span className="h-font text-xl font-semibold tabular-nums" data-testid="collect-approved-net">{money(net)}</span>
              </div>
            </div>
          </div>

          {/* Payment mode */}
          <div className="grid gap-1.5">
            <Label className="text-xs">Payment Mode</Label>
            <RadioGroup value={mode} onValueChange={setMode} className="grid grid-cols-2 gap-1.5" data-testid="collect-approved-mode">
              {PAYMENT_MODES.map((m) => (
                <label key={m.value} className={`flex items-center gap-2 rounded-md border border-border px-3 py-2 cursor-pointer text-sm ${mode === m.value ? 'bg-secondary border-[hsl(var(--primary))]' : ''}`}>
                  <RadioGroupItem value={m.value} />
                  <span>{m.label}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          {mode !== 'cash' && (
            <div className="grid gap-1.5">
              <Label className="text-xs">Reference / Cheque No. <span className="text-red-600">*</span></Label>
              <Input value={txnRef} onChange={(e) => setTxnRef(e.target.value)} placeholder="e.g. UPI txn id or cheque no." data-testid="collect-approved-txnref" />
            </div>
          )}

          <div className="grid gap-1.5">
            <Label className="text-xs">Remarks (optional)</Label>
            <Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button
            onClick={submit}
            disabled={busy}
            className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 gap-1.5"
            data-testid="collect-approved-submit"
          >
            <Receipt className="h-4 w-4" />
            {busy ? 'Collecting…' : 'Collect & Generate Receipt'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, tone }) {
  const cls = tone === 'emerald' ? 'bg-emerald-50 text-emerald-800'
    : tone === 'amber' ? 'bg-amber-50 text-amber-800'
      : '';
  return (
    <div className={`flex items-center justify-between px-3 py-2 text-sm ${cls}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

export default CollectApprovedDialog;
