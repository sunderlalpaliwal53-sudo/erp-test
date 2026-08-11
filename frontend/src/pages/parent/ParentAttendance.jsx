import React, { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function ParentAttendance() {
  const [rows, setRows] = useState([]);
  useEffect(() => { (async () => { const { data } = await api.get('/attendance'); setRows(data.sort((a, b) => (b.date || '').localeCompare(a.date || ''))); })(); }, []);
  const total = rows.length; const present = rows.filter((r) => r.status === 'present').length; const absent = rows.filter((r) => r.status === 'absent').length; const leave = rows.filter((r) => r.status === 'leave').length;
  return (
    <AppShell>
      <div className="mb-6"><h1 className="h-font text-2xl font-semibold">My Attendance</h1><p className="text-sm text-muted-foreground">Attendance summary and history.</p></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card className="p-4 border-border"><div className="text-xs uppercase text-muted-foreground">Total Days</div><div className="h-font text-2xl font-semibold">{total}</div></Card>
        <Card className="p-4 border-border bg-[#E6F6F4]"><div className="text-xs uppercase text-[#0F766E]">Present</div><div className="h-font text-2xl font-semibold">{present}</div></Card>
        <Card className="p-4 border-border bg-[#FEE4E2]"><div className="text-xs uppercase text-[#B42318]">Absent</div><div className="h-font text-2xl font-semibold">{absent}</div></Card>
        <Card className="p-4 border-border bg-[#FFF3E0]"><div className="text-xs uppercase text-[#B45309]">Leave</div><div className="h-font text-2xl font-semibold">{leave}</div></Card>
      </div>
      <Card className="border-border">
        <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead>Remarks</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">No records.</TableCell></TableRow>}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.date}</TableCell>
                <TableCell><Badge className={r.status === 'present' ? 'bg-[#E6F6F4] text-[#0F766E] border border-[#BFEAE6]' : r.status === 'absent' ? 'bg-[#FEE4E2] text-[#B42318] border border-[#FECACA]' : 'bg-[#FFF3E0] text-[#B45309] border border-[#FFD7A8]'}>{r.status}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.remarks || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </AppShell>
  );
}
