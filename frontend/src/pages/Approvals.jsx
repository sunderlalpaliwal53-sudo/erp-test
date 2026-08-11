import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { api, money } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { BadgeCheck, RefreshCw, Search, CheckCircle2, XCircle, Clock, Download, Wallet } from 'lucide-react';
import { ApprovalReviewDialog } from '@/components/ApprovalReviewDialog';
import { CollectApprovedDialog } from '@/components/CollectApprovedDialog';

// Only OWNERS can approve/reject discount requests. Super admins can view but not act.
const OWNER_ROLES = new Set(['owner']);
const ADMIN_ROLES = new Set(['super_admin', 'school_admin', 'accountant']);

export default function Approvals() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [tab, setTab] = useState('pending');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);

  const [selected, setSelected] = useState(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  const [collectSel, setCollectSel] = useState(null);
  const [collectOpen, setCollectOpen] = useState(false);

  const canReview = OWNER_ROLES.has(user?.role);
  const canCollect = ADMIN_ROLES.has(user?.role);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = tab === 'all' ? {} : { status: tab };
      const { data } = await api.get('/discount-approvals', { params });
      setRows(Array.isArray(data) ? data : []);
    } catch (_) {
      setRows([]);
    } finally { setLoading(false); }
  }, [tab]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const h = () => load();
    window.addEventListener('stv:school-changed', h);
    return () => window.removeEventListener('stv:school-changed', h);
  }, [load]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      (r.student_name || '').toLowerCase().includes(s) ||
      (r.admission_number || '').toLowerCase().includes(s) ||
      (r.requested_by_name || '').toLowerCase().includes(s) ||
      (r.discount_reason || '').toLowerCase().includes(s)
    );
  }, [rows, q]);

  const openReview = (r) => { setSelected(r); setReviewOpen(true); };
  const openCollect = (r) => { setCollectSel(r); setCollectOpen(true); };

  const handleApprove = async ({ remark, approved_discount }) => {
    try {
      await api.post(`/discount-approvals/${selected.id}/approve`, { remark, approved_discount });
      toast.success('Approved — the admin can now collect the money & generate the receipt.', { duration: 5500 });
      setReviewOpen(false); setSelected(null); load();
    } catch (err) { toast.error(err.response?.data?.detail || 'Approve failed'); }
  };
  const handleReject = async (remark) => {
    try {
      await api.post(`/discount-approvals/${selected.id}/reject`, { remark });
      toast.success('Request rejected');
      setReviewOpen(false); setSelected(null); load();
    } catch (err) { toast.error(err.response?.data?.detail || 'Reject failed'); }
  };

  const downloadReceipt = async (paymentId, receiptNo) => {
    try {
      const res = await api.get(`/payments/${paymentId}/receipt.pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = `${receiptNo || 'receipt'}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (_) { toast.error('Could not download receipt'); }
  };

  // stat mini cards (compute across ALL rows for context — currently only shows tab data)
  const stat = useMemo(() => ({
    pending: rows.filter((r) => r.status === 'pending').length,
    approved: rows.filter((r) => r.status === 'approved').length,
    collected: rows.filter((r) => r.status === 'collected').length,
    rejected: rows.filter((r) => r.status === 'rejected').length,
  }), [rows]);

  const description = canReview
    ? 'Review, approve or reject discount requests raised during fee collection. After you approve, the admin who raised the request will collect the money and generate the receipt.'
    : user?.role === 'super_admin'
      ? 'Track discount requests. Only the school Owner can approve or reject a discount. Once approved, use "Collect" to collect the money and print the receipt.'
      : 'Track your discount requests. Once the Owner approves, use "Awaiting Collection" to collect the money and print the receipt.';

  return (
    <AppShell>
      <div className="mb-4 md:mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="h-font text-2xl font-semibold flex items-center gap-2">
            <BadgeCheck className="h-6 w-6" /> Discount Approvals
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">{description}</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-1.5"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh</Button>
      </div>

      {/* Stat mini cards for current tab data */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard label="Pending" value={tab === 'pending' ? filtered.length : stat.pending} icon={Clock} tone="amber" testId="stat-pending" />
        <StatCard label="Awaiting Collection" value={tab === 'approved' ? filtered.length : stat.approved} icon={Wallet} tone="blue" testId="stat-approved" />
        <StatCard label="Collected" value={tab === 'collected' ? filtered.length : stat.collected} icon={CheckCircle2} tone="emerald" testId="stat-collected" />
        <StatCard label="Rejected" value={tab === 'rejected' ? filtered.length : stat.rejected} icon={XCircle} tone="red" testId="stat-rejected" />
      </div>

      <Card className="p-4 md:p-5 border-border">
        <div className="flex items-center gap-3 flex-wrap mb-3">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="pending" data-testid="approvals-tab-pending">Pending</TabsTrigger>
              <TabsTrigger value="approved" data-testid="approvals-tab-approved">Awaiting Collection</TabsTrigger>
              <TabsTrigger value="collected" data-testid="approvals-tab-collected">Collected</TabsTrigger>
              <TabsTrigger value="rejected" data-testid="approvals-tab-rejected">Rejected</TabsTrigger>
              <TabsTrigger value="all" data-testid="approvals-tab-all">All</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative ml-auto w-full sm:w-64">
            <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search student / reason" className="pl-8 h-9" />
          </div>
        </div>

        {loading && rows.length === 0 && <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>}
        {!loading && filtered.length === 0 && (
          <div className="py-12 text-center">
            <BadgeCheck className="h-10 w-10 mx-auto text-muted-foreground opacity-40 mb-2" />
            <div className="text-sm text-muted-foreground">
              No {tab === 'all' ? '' : tab === 'approved' ? 'awaiting-collection' : tab} approval requests.
            </div>
          </div>
        )}

        <div className="grid gap-2">
          {filtered.map((r) => (
            <ApprovalRow
              key={r.id}
              row={r}
              currentUser={user}
              canReview={canReview}
              canCollect={canCollect}
              onOpen={openReview}
              onCollect={openCollect}
              onDownload={downloadReceipt}
            />
          ))}
        </div>
      </Card>

      <ApprovalReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        approval={selected}
        onApprove={handleApprove}
        onReject={handleReject}
        canReview={canReview}
      />

      <CollectApprovedDialog
        open={collectOpen}
        onOpenChange={setCollectOpen}
        approval={collectSel}
        onCollected={() => { setCollectSel(null); load(); }}
      />
    </AppShell>
  );
}

function ApprovalRow({ row, currentUser, canReview, canCollect, onOpen, onCollect, onDownload }) {
  const dt = row.requested_at ? new Date(row.requested_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '';
  const statusBadge = row.status === 'pending' ? (
    <Badge className="bg-amber-100 text-amber-800 border border-amber-200">Pending</Badge>
  ) : row.status === 'approved' ? (
    <Badge className="bg-blue-100 text-blue-800 border border-blue-200">Awaiting Collection</Badge>
  ) : row.status === 'collected' ? (
    <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200">Collected</Badge>
  ) : (
    <Badge className="bg-red-100 text-red-800 border border-red-200">Rejected</Badge>
  );

  // Only the original requester (or super_admin) can Collect the approved request.
  const isMine = row.requested_by_id === currentUser?.id;
  const showCollect = row.status === 'approved' && canCollect && (isMine || currentUser?.role === 'super_admin');
  const approvedDisc = row.approved_discount != null ? row.approved_discount : row.discount;

  return (
    <div className="rounded-lg border border-border p-3 hover:border-[#0B2F4A]/30 hover:shadow-sm transition bg-white" data-testid={`approval-list-row-${row.id}`}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-sm font-semibold truncate">{row.student_name}</div>
            {statusBadge}
            {row.application_image && (
              <Badge variant="secondary" className="text-[10px]">Application attached</Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {row.admission_number || '—'} · {row.class_name}{row.section ? ' ' + row.section : ''} · {String(row.payment_mode || '').replace('_', ' ')}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Raised by {row.requested_by_name} · {dt}
            {row.reviewed_by_name && <> · Reviewed by {row.reviewed_by_name}</>}
          </div>
          <div className="text-xs mt-1.5 italic text-slate-700 line-clamp-2">"{row.discount_reason || '—'}"</div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {row.status === 'pending' ? 'Requested' : 'Approved'}
            </div>
            <div className="text-sm font-semibold tabular-nums text-amber-700">-{money(approvedDisc || 0)}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Net</div>
            <div className="text-sm font-semibold tabular-nums">{money(row.total)}</div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Button size="sm" onClick={() => onOpen(row)} className="h-8 gap-1.5" data-testid={`approval-open-${row.id}`}>
              {row.status === 'pending' && canReview ? <>Review</> : <>View</>}
            </Button>
            {showCollect && (
              <Button
                size="sm"
                onClick={() => onCollect(row)}
                className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                data-testid={`approval-collect-${row.id}`}
              >
                <Wallet className="h-3.5 w-3.5" /> Collect
              </Button>
            )}
            {row.status === 'collected' && row.payment_id && (
              <Button size="sm" variant="outline" onClick={() => onDownload(row.payment_id, row.receipt_number)} className="h-8 gap-1.5" data-testid={`approval-download-${row.id}`}>
                <Download className="h-3.5 w-3.5" /> Receipt
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone, testId }) {
  const toneCls = tone === 'emerald' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : tone === 'red' ? 'bg-red-50 text-red-700 border-red-200'
      : tone === 'blue' ? 'bg-blue-50 text-blue-700 border-blue-200'
        : 'bg-amber-50 text-amber-700 border-amber-200';
  return (
    <Card className="p-4 border-border" data-testid={testId}>
      <div className="flex items-center gap-3">
        <div className={`h-9 w-9 rounded-md border flex items-center justify-center ${toneCls}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="h-font text-xl font-semibold tabular-nums">{value}</div>
        </div>
      </div>
    </Card>
  );
}
