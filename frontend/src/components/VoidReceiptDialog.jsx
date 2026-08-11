import React, { useEffect, useState } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, money } from '@/lib/api';
import { toast } from 'sonner';

/**
 * Super-admin only. Void / cancel a receipt with a mandatory reason.
 * The payment is retained for audit; status becomes `voided` which
 * automatically excludes it from all reports & fee-schedule aggregations.
 */
export default function VoidReceiptDialog({ open, onOpenChange, payment, onVoided }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) setReason(''); }, [open]);

  const confirm = async () => {
    if (!reason.trim()) { toast.error('Reason is required to void a receipt'); return; }
    setBusy(true);
    try {
      const { data: updated } = await api.post(`/payments/${payment.id}/void`, { reason: reason.trim() });
      toast.success(`Receipt ${updated.receipt_number} has been VOIDED`, {
        description: `${money(payment.total_paid)} reversed from student's ledger.`,
      });
      onVoided?.(updated);
      onOpenChange(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to void receipt');
    } finally { setBusy(false); }
  };

  if (!payment) return null;
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Void this receipt?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-foreground/80">
              <div>
                Receipt <span className="font-mono">{payment.receipt_number}</span> ·
                {' '}<b>{payment.student_name}</b> ·
                {' '}<b>{money(payment.total_paid)}</b>
              </div>
              <div className="text-destructive">
                This will mark the transaction as VOIDED and restore this amount
                back to the student's outstanding dues. The receipt PDF will
                carry a red "VOIDED" watermark. This action is fully audited but
                can be reversed by a Super Admin via "Restore".
              </div>
              {payment.payment_mode === 'razorpay' && (
                <div className="rounded bg-amber-50 border border-amber-200 text-amber-900 p-2 text-xs">
                  Note: this was an online (Razorpay) payment. Voiding here only
                  reverses the ledger entry — any actual refund to the payer must
                  be processed separately from the Razorpay dashboard.
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-1.5 mt-2">
          <Label className="text-xs text-destructive">Reason (required — audited)</Label>
          <Input data-testid="void-receipt-reason" value={reason} onChange={(e) => setReason(e.target.value)}
                 placeholder="e.g. Duplicate entry, wrong student, incorrect amount…" />
        </div>

        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction data-testid="void-receipt-confirm" onClick={(e) => { e.preventDefault(); confirm(); }}
                             disabled={busy || !reason.trim()}
                             className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {busy ? 'Voiding…' : 'Void Receipt'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
