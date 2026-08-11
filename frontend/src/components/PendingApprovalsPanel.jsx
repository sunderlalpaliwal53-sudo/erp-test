import React, { useCallback, useEffect, useState } from 'react';
import { api, money } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BadgeCheck, ChevronRight, ClipboardCheck, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { ApprovalReviewDialog } from '@/components/ApprovalReviewDialog';

// Only OWNERS can approve/reject discount requests. Super admins can view all
// requests but cannot act on them.
const REVIEWER_ROLES = new Set(['owner']);
const VIEW_ALL_ROLES = new Set(['owner', 'super_admin']);

/**
 * PendingApprovalsPanel — dashboard card showing pending discount approvals.
 * For owners/super_admin: shows all pending in scope with Approve/Reject.
 * For admin/accountant: shows their own pending submissions (read-only preview).
 */
export function PendingApprovalsPanel() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/discount-approvals', { params: { status: 'pending' } });
      setRows(Array.isArray(data) ? data : []);
    } catch (_) {
      setRows([]);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const h = () => load();
    window.addEventListener('stv:school-changed', h);
    return () => window.removeEventListener('stv:school-changed', h);
  }, [load]);

  const canReview = REVIEWER_ROLES.has(user?.role);
  const seesAll = VIEW_ALL_ROLES.has(user?.role);

  const openReview = (row) => { setSelected(row); setDialogOpen(true); };

  const handleApprove = async ({ remark, approved_discount } = {}) => {
    try {
      await api.post(`/discount-approvals/${selected.id}/approve`, { remark, approved_discount });
      toast.success('Approved — the admin will now collect the money and generate the receipt.', { duration: 5500 });
      setDialogOpen(false);
      setSelected(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Approve failed');
    }
  };
  const handleReject = async (remark) => {
    try {
      await api.post(`/discount-approvals/${selected.id}/reject`, { remark });
      toast.success('Request rejected');
      setDialogOpen(false);
      setSelected(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Reject failed');
    }
  };

  return (
    <Card className="p-5 border-border">
      <CardHeader className="p-0 mb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-[hsl(var(--primary))]" />
          {seesAll ? 'Approval Requests' : 'My Discount Requests (Pending)'}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-normal" data-testid="pending-approvals-count">{rows.length}</Badge>
          <Button variant="ghost" size="sm" onClick={load} className="h-7 px-2">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border" data-testid="pending-approvals-list">
          {rows.length === 0 && (
            <div className="py-8 text-center">
              <BadgeCheck className="h-8 w-8 mx-auto text-muted-foreground opacity-40 mb-2" />
              <div className="text-sm text-muted-foreground">
                {seesAll ? 'No pending approval requests.' : 'You have no pending discount requests.'}
              </div>
            </div>
          )}
          {rows.slice(0, 6).map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => openReview(r)}
              data-testid={`approval-row-${r.id}`}
              className="w-full flex items-center justify-between py-3 hover:bg-muted/40 px-1 -mx-1 rounded transition text-left"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{r.student_name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {r.class_name}{r.section ? ' ' + r.section : ''} · Discount: <span className="text-amber-700 font-medium">{money(r.discount)}</span>
                  {r.requested_by_name && !seesAll ? '' : <> · by {r.requested_by_name}</>}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5 truncate italic">"{r.discount_reason || '—'}"</div>
              </div>
              <div className="flex items-center gap-3 shrink-0 pl-3">
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Net</div>
                  <div className="text-sm font-semibold tabular-nums">{money(r.total)}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </button>
          ))}
        </div>
        {rows.length > 6 && (
          <div className="text-xs text-muted-foreground pt-2 text-center">
            +{rows.length - 6} more. Open <span className="font-medium">Approvals</span> to see all.
          </div>
        )}
      </CardContent>
      <ApprovalReviewDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        approval={selected}
        onApprove={handleApprove}
        onReject={handleReject}
        canReview={canReview}
      />
    </Card>
  );
}
