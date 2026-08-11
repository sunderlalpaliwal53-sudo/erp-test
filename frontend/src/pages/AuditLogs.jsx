import React, { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSchool } from '@/contexts/SchoolContext';

export default function AuditLogsPage() {
  const { activeSchoolId } = useSchool();
  const [logs, setLogs] = useState([]);
  const load = useCallback(async () => { if (!activeSchoolId) return; const { data } = await api.get('/audit-logs'); setLogs(data); }, [activeSchoolId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const h = () => load(); window.addEventListener('stv:school-changed', h); return () => window.removeEventListener('stv:school-changed', h); }, [load]);
  return (
    <AppShell>
      <div className="mb-6"><h1 className="h-font text-2xl font-semibold">Audit Logs</h1><p className="text-sm text-muted-foreground">Complete activity trail for the selected school.</p></div>
      <Card className="border-border">
        <Table>
          <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>User</TableHead><TableHead>Role</TableHead><TableHead>Action</TableHead><TableHead>Details</TableHead></TableRow></TableHeader>
          <TableBody>
            {logs.length === 0 && <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No logs.</TableCell></TableRow>}
            {logs.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="text-xs">{(l.created_at || '').slice(0, 19).replace('T', ' ')}</TableCell>
                <TableCell className="font-medium">{l.user_name || '—'}</TableCell>
                <TableCell><Badge variant="secondary" className="capitalize">{(l.role || '').replace('_', ' ')}</Badge></TableCell>
                <TableCell className="font-mono text-xs">{l.action}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{JSON.stringify(l.details)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </AppShell>
  );
}
