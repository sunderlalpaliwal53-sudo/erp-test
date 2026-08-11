import React, { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { api, money } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Download, ExternalLink, Pencil, Ban, RotateCcw, History } from 'lucide-react';
import { useSchool } from '@/contexts/SchoolContext';
import { useAuth } from '@/contexts/AuthContext';
import EditReceiptDialog from '@/components/EditReceiptDialog';
import VoidReceiptDialog from '@/components/VoidReceiptDialog';
import { toast } from 'sonner';

export default function Receipts() {
  const { activeSchoolId } = useSchool();
  const { user } = useAuth();
  const [payments, setPayments] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(false);

  const [editing, setEditing] = useState(null);
  const [voiding, setVoiding] = useState(null);

  const canManage = user?.role === 'super_admin';

  const load = useCallback(async () => {
    if (!activeSchoolId) return;
    setLoading(true);
    try {
      const { data } = await api.get('/payments', { params: { limit: 500 } });
      setPayments(data);
    } finally { setLoading(false); }
  }, [activeSchoolId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const h = () => load();
    window.addEventListener('stv:school-changed', h);
    return () => window.removeEventListener('stv:school-changed', h);
  }, [load]);

  const filtered = payments.filter((p) => {
    if (statusFilter !== 'all' && (p.status || 'success') !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (p.receipt_number || '').toLowerCase().includes(q) ||
           (p.student_name || '').toLowerCase().includes(q);
  });

  const openPdf = async (p) => {
    const resp = await api.get(`/payments/${p.id}/receipt.pdf`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([resp.data], { type: 'application/pdf' }));
    window.open(url, '_blank');
    setTimeout(() => window.URL.revokeObjectURL(url), 60000);
  };

  const downloadPdf = async (p) => {
    const resp = await api.get(`/payments/${p.id}/receipt.pdf`, { responseType: 'blob' });
    const blob = new Blob([resp.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Receipt-${p.receipt_number}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => window.URL.revokeObjectURL(url), 60000);
  };

  const restore = async (p) => {
    if (!window.confirm(`Restore voided receipt ${p.receipt_number}? The amount ${money(p.total_paid)} will be added back to the ledger.`)) return;
    try {
      const { data: updated } = await api.post(`/payments/${p.id}/restore`);
      toast.success(`Receipt ${updated.receipt_number} restored`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to restore receipt');
    }
  };

  const applyUpdatedRow = (updated) => {
    setPayments((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
  };

  const statusBadge = (p) => {
    const st = p.status || 'success';
    if (st === 'voided') {
      return <Badge className="bg-[#FEE4E2] text-[#B42318] border border-[#FECACA] gap-1"><Ban className="h-3 w-3" /> VOIDED</Badge>;
    }
    if (p.edited_at) {
      return <Badge className="bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] gap-1"><History className="h-3 w-3" /> Revised</Badge>;
    }
    return <Badge className="bg-[#E6F6F4] text-[#0F766E] border border-[#BFEAE6]">Success</Badge>;
  };

  const voidedCount = payments.filter((p) => (p.status || 'success') === 'voided').length;
  const revisedCount = payments.filter((p) => p.edited_at && (p.status || 'success') !== 'voided').length;

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="h-font text-2xl font-semibold">Receipts</h1>
        <p className="text-sm text-muted-foreground">All fee payment records with downloadable PDF receipts.</p>
      </div>

      <Card className="p-3 sm:p-4 border-border mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <div className="relative flex-1 sm:min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input data-testid="receipts-search" className="pl-9" placeholder="Search by receipt number or student…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger data-testid="receipts-status-filter" className="w-full sm:w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="success">Success only</SelectItem>
              <SelectItem value="voided">Voided ({voidedCount})</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{filtered.length} shown</span>
            {revisedCount > 0 && <span className="hidden sm:inline">· {revisedCount} revised</span>}
          </div>
        </div>
      </Card>

      <Card className="border-border" data-testid="receipts-table">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/60">
              <TableHead>Receipt No</TableHead>
              <TableHead>Student</TableHead>
              <TableHead className="hidden sm:table-cell">Date</TableHead>
              <TableHead className="hidden sm:table-cell">Mode</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && !loading && (
              <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground text-sm">No receipts found.</TableCell></TableRow>
            )}
            {filtered.map((p) => {
              const isVoided = (p.status || 'success') === 'voided';
              return (
                <TableRow key={p.id} className={`hover:bg-secondary/40 ${isVoided ? 'opacity-70' : ''}`}
                          data-testid={`receipt-row-${p.id}`}>
                  <TableCell className={`font-mono text-xs ${isVoided ? 'line-through' : ''}`}>{p.receipt_number}</TableCell>
                  <TableCell className={`font-medium ${isVoided ? 'line-through' : ''}`}>{p.student_name}</TableCell>
                  <TableCell className="hidden sm:table-cell">{(p.paid_at || '').slice(0, 10)}</TableCell>
                  <TableCell className="hidden sm:table-cell capitalize">{String(p.payment_mode).replace('_', ' ')}</TableCell>
                  <TableCell>{statusBadge(p)}</TableCell>
                  <TableCell className={`text-right font-semibold tabular-nums ${isVoided ? 'line-through text-muted-foreground' : ''}`}>{money(p.total_paid)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1 flex-wrap">
                      <Button data-testid={`receipt-view-${p.id}`} size="sm" variant="outline" onClick={() => openPdf(p)} className="h-8 gap-1"><ExternalLink className="h-3.5 w-3.5" /><span className="hidden sm:inline">View</span></Button>
                      <Button data-testid={`receipt-download-${p.id}`} size="sm" variant="outline" onClick={() => downloadPdf(p)} className="h-8 gap-1"><Download className="h-3.5 w-3.5" /><span className="hidden sm:inline">PDF</span></Button>
                      {canManage && !isVoided && (
                        <Button data-testid={`receipt-edit-${p.id}`} size="sm" variant="outline" onClick={() => setEditing(p)} className="h-8 gap-1"><Pencil className="h-3.5 w-3.5" /><span className="hidden sm:inline">Edit</span></Button>
                      )}
                      {canManage && !isVoided && (
                        <Button data-testid={`receipt-void-${p.id}`} size="sm" variant="outline" onClick={() => setVoiding(p)} className="h-8 gap-1 text-destructive hover:text-destructive hover:bg-destructive/5"><Ban className="h-3.5 w-3.5" /><span className="hidden sm:inline">Void</span></Button>
                      )}
                      {canManage && isVoided && (
                        <Button data-testid={`receipt-restore-${p.id}`} size="sm" variant="outline" onClick={() => restore(p)} className="h-8 gap-1"><RotateCcw className="h-3.5 w-3.5" /><span className="hidden sm:inline">Restore</span></Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <EditReceiptDialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}
                         payment={editing} onSaved={(u) => { applyUpdatedRow(u); setEditing(null); }} />
      <VoidReceiptDialog open={!!voiding} onOpenChange={(v) => !v && setVoiding(null)}
                         payment={voiding} onVoided={(u) => { applyUpdatedRow(u); setVoiding(null); }} />
    </AppShell>
  );
}
