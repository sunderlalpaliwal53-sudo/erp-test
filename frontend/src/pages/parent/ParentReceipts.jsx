import React, { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { api, money } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download } from 'lucide-react';

export default function ParentReceipts() {
  const [payments, setPayments] = useState([]);
  useEffect(() => { (async () => { const { data } = await api.get('/payments', { params: { limit: 200 } }); setPayments(data); })(); }, []);
  const dl = async (p) => {
    const resp = await api.get(`/payments/${p.id}/receipt.pdf`, { responseType: 'blob' });
    const blob = new Blob([resp.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `receipt_${p.receipt_number}.pdf`; a.click(); a.remove();
  };
  return (
    <AppShell>
      <div className="mb-6"><h1 className="h-font text-2xl font-semibold">My Receipts</h1><p className="text-sm text-muted-foreground">Download PDF copies of your fee payments.</p></div>
      <Card className="border-border">
        <Table>
          <TableHeader><TableRow><TableHead>Receipt No</TableHead><TableHead>Date</TableHead><TableHead>Mode</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
          <TableBody>
            {payments.length === 0 && <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No receipts yet.</TableCell></TableRow>}
            {payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">{p.receipt_number}</TableCell>
                <TableCell>{(p.paid_at || '').slice(0, 10)}</TableCell>
                <TableCell className="capitalize">{String(p.payment_mode).replace('_', ' ')}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{money(p.total_paid)}</TableCell>
                <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => dl(p)} className="gap-1"><Download className="h-3.5 w-3.5" /> PDF</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </AppShell>
  );
}
