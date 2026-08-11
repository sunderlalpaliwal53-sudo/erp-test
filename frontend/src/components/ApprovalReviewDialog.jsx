import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { money } from '@/lib/api';
import { CheckCircle2, XCircle, User2, Receipt, Wallet, FileImage, ExternalLink, Wallet as WalletIcon } from 'lucide-react';

/**
 * ApprovalReviewDialog — shows full approval details and lets an owner
 * approve or reject. Used from Dashboard panel and Approvals page.
 *
 * NEW workflow (Jul 2026):
 *   - Owner can edit the discount amount before approving.
 *   - The parent's written application image is displayed (mandatory upload).
 *   - Approving no longer creates a receipt; the admin must resume the
 *     transaction via a separate "Collect" step.
 *
 * Props:
 *   open, onOpenChange, approval,
 *   onApprove({ remark, approved_discount }),
 *   onReject(remark),
 *   canReview
 */
export function ApprovalReviewDialog({ open, onOpenChange, approval, onApprove, onReject, canReview = true }) {
  const [remark, setRemark] = useState('');
  const [approvedDiscount, setApprovedDiscount] = useState('');
  const [busy, setBusy] = useState(null);
  const [imageOpen, setImageOpen] = useState(false);

  useEffect(() => {
    if (approval) {
      // Prefill with the already-approved discount if reviewed, else the requested amount.
      const initial = approval.approved_discount != null ? approval.approved_discount : approval.discount;
      setApprovedDiscount(String(initial ?? ''));
      setRemark('');
    }
  }, [approval?.id]);

  if (!approval) return null;

  const subtotal = Number(approval.subtotal || 0);
  const lateFee = Number(approval.late_fee || 0);
  const proposedDiscount = Math.max(Number(approvedDiscount || 0), 0);
  const recomputedNet = Math.max(subtotal + lateFee - proposedDiscount, 0);

  const doApprove = async () => {
    if (proposedDiscount <= 0) {
      alert('Approved discount must be greater than zero. To decline the discount entirely, use Reject.');
      return;
    }
    if (proposedDiscount > subtotal + lateFee) {
      alert('Approved discount cannot exceed subtotal + late fee.');
      return;
    }
    setBusy('approve');
    try {
      await onApprove?.({
        remark: remark.trim(),
        approved_discount: proposedDiscount,
      });
    } finally {
      setBusy(null);
    }
  };

  const doReject = async () => {
    if (!remark.trim()) { alert('Please add a rejection remark.'); return; }
    setBusy('reject');
    try { await onReject?.(remark.trim()); } finally { setBusy(null); }
  };

  const dt = approval.requested_at
    ? new Date(approval.requested_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : '';

  const statusBadge = (
    approval.status === 'pending'
      ? <Badge className="bg-amber-100 text-amber-800 border border-amber-200">Pending</Badge>
      : approval.status === 'approved'
        ? <Badge className="bg-blue-100 text-blue-800 border border-blue-200">Approved · Awaiting Collection</Badge>
        : approval.status === 'collected'
          ? <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200">Collected</Badge>
          : <Badge className="bg-red-100 text-red-800 border border-red-200">Rejected</Badge>
  );

  const isImage = (approval.application_image || '').startsWith('data:image/');
  const isPdf = (approval.application_image || '').startsWith('data:application/pdf');

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              Discount Approval Request
              {statusBadge}
            </DialogTitle>
            <DialogDescription>Raised {dt} by {approval.requested_by_name} ({approval.requested_by_role})</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Student summary */}
            <div className="rounded-md border border-border p-3 bg-muted/30">
              <div className="flex items-center gap-2 mb-2 text-sm font-semibold">
                <User2 className="h-4 w-4" /> {approval.student_name}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                <Field label="Admission #" value={approval.admission_number || '—'} />
                <Field label="Class" value={approval.class_name ? `${approval.class_name}${approval.section ? ' ' + approval.section : ''}` : '—'} />
                <Field label="Payment Mode" value={String(approval.payment_mode || '').replace('_', ' ')} />
              </div>
            </div>

            {/* Application image */}
            {approval.application_image && (
              <div className="rounded-md border border-border">
                <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <FileImage className="h-3.5 w-3.5" /> Parent's Written Application
                  </div>
                  <button
                    type="button"
                    onClick={() => setImageOpen(true)}
                    className="text-xs text-[hsl(var(--primary))] hover:underline flex items-center gap-1"
                    data-testid="approval-view-application"
                  >
                    <ExternalLink className="h-3 w-3" /> Open full-size
                  </button>
                </div>
                <div className="p-3 flex items-start gap-3">
                  {isImage ? (
                    <img
                      src={approval.application_image}
                      alt="Parent's written application"
                      className="max-h-48 rounded border border-border object-contain bg-white cursor-zoom-in"
                      onClick={() => setImageOpen(true)}
                      data-testid="approval-application-thumbnail"
                    />
                  ) : isPdf ? (
                    <a
                      href={approval.application_image}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-3 rounded-md border border-border bg-white hover:bg-secondary text-sm"
                    >
                      <FileImage className="h-5 w-5" /> Open application PDF
                    </a>
                  ) : (
                    <div className="text-xs text-muted-foreground">Attachment attached (open full-size to view).</div>
                  )}
                </div>
              </div>
            )}

            {/* Fee items */}
            <div className="rounded-md border border-border">
              <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Receipt className="h-3.5 w-3.5" /> Fee Items
              </div>
              <div className="divide-y divide-border">
                {(approval.items || []).map((it, idx) => (
                  <div key={it.fee_head_id ? `${it.fee_head_id}-${it.period || idx}` : idx} className="flex items-center justify-between px-3 py-2 text-sm">
                    <div>
                      <div>{it.fee_head_name}</div>
                      {it.period && <div className="text-xs text-muted-foreground">{it.period}</div>}
                    </div>
                    <div className="tabular-nums">{money(it.amount)}</div>
                  </div>
                ))}
                <div className="flex items-center justify-between px-3 py-2 text-sm bg-muted/30">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">{money(subtotal)}</span>
                </div>
                {lateFee > 0 && (
                  <div className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="text-muted-foreground">Late fee</span>
                    <span className="tabular-nums">+{money(lateFee)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between px-3 py-2 text-sm bg-amber-50">
                  <span className="text-amber-800">Discount requested</span>
                  <span className="tabular-nums text-amber-800">-{money(approval.discount)}</span>
                </div>
                {approval.status !== 'pending' && approval.approved_discount != null && (
                  <div className="flex items-center justify-between px-3 py-2 text-sm bg-emerald-50">
                    <span className="font-semibold text-emerald-800">Discount approved</span>
                    <span className="tabular-nums font-semibold text-emerald-800">-{money(approval.approved_discount)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between px-3 py-2 text-sm bg-[hsl(var(--primary))]/5 font-semibold">
                  <span className="flex items-center gap-1"><Wallet className="h-4 w-4" /> Net Payable {canReview && approval.status === 'pending' ? '(preview)' : ''}</span>
                  <span className="tabular-nums">{money(canReview && approval.status === 'pending' ? recomputedNet : approval.total)}</span>
                </div>
              </div>
            </div>

            {/* Discount reason */}
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Reason for Discount</div>
              <div className="rounded-md border border-border bg-white p-3 text-sm whitespace-pre-wrap">{approval.discount_reason || '—'}</div>
            </div>

            {approval.remarks && (
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Collection Remark</div>
                <div className="rounded-md border border-border bg-white p-3 text-sm whitespace-pre-wrap">{approval.remarks}</div>
              </div>
            )}

            {(approval.status === 'approved' || approval.status === 'collected' || approval.status === 'rejected') && (
              <div className="rounded-md border border-border p-3 text-sm">
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Reviewed by</div>
                <div className="font-medium">{approval.reviewed_by_name || '—'}</div>
                {approval.review_remark && <div className="text-xs text-muted-foreground mt-1">"{approval.review_remark}"</div>}
                {approval.status === 'approved' && (
                  <div className="text-xs mt-2 text-blue-700 flex items-center gap-1">
                    <WalletIcon className="h-3.5 w-3.5" />
                    Awaiting collection. The admin who raised this must now collect the money and generate the receipt.
                  </div>
                )}
                {approval.status === 'collected' && approval.receipt_number && (
                  <div className="text-xs mt-2">
                    <span className="text-muted-foreground">Receipt: </span>
                    <span className="font-mono font-medium">{approval.receipt_number}</span>
                    {approval.collected_by_name && (
                      <> · collected by {approval.collected_by_name}</>
                    )}
                  </div>
                )}
              </div>
            )}

            {canReview && approval.status === 'pending' && (
              <>
                <div className="grid gap-1.5 rounded-md border-2 border-emerald-300 bg-emerald-50 p-3">
                  <Label className="text-xs font-semibold text-emerald-900">
                    Approved Discount (₹) — you may adjust the amount before approving
                  </Label>
                  <Input
                    data-testid="approval-approved-discount-input"
                    type="number"
                    min={0}
                    max={subtotal + lateFee}
                    value={approvedDiscount}
                    onChange={(e) => setApprovedDiscount(e.target.value)}
                    className="bg-white h-10"
                  />
                  <div className="text-[11px] text-emerald-900">
                    Requested: {money(approval.discount)} · Preview net payable: <b className="tabular-nums">{money(recomputedNet)}</b>
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Owner Remark (required to Reject, optional for Approve)</Label>
                  <Textarea rows={2} value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Add a short remark…" />
                </div>
              </>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
            {canReview && approval.status === 'pending' && (
              <>
                <Button variant="destructive" onClick={doReject} disabled={!!busy} data-testid="approval-reject-btn">
                  <XCircle className="h-4 w-4 mr-1.5" /> {busy === 'reject' ? 'Rejecting…' : 'Reject'}
                </Button>
                <Button onClick={doApprove} disabled={!!busy} className="bg-emerald-600 hover:bg-emerald-700" data-testid="approval-approve-btn">
                  <CheckCircle2 className="h-4 w-4 mr-1.5" /> {busy === 'approve' ? 'Approving…' : 'Approve'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full-size image viewer */}
      {approval.application_image && isImage && (
        <Dialog open={imageOpen} onOpenChange={setImageOpen}>
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <DialogTitle>Parent's Written Application — {approval.student_name}</DialogTitle>
            </DialogHeader>
            <div className="max-h-[75vh] overflow-auto flex items-center justify-center bg-black/5 rounded-md">
              <img src={approval.application_image} alt="Application" className="max-w-full h-auto" />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium truncate">{value}</div>
    </div>
  );
}
