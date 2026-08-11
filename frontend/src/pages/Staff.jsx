import React, { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useSchool } from '@/contexts/SchoolContext';
import { useAuth } from '@/contexts/AuthContext';

export default function StaffPage() {
  const { activeSchoolId } = useSchool();
  const { user } = useAuth();
  const [staff, setStaff] = useState([]);
  const [open, setOpen] = useState(false);
  const load = useCallback(async () => { if (!activeSchoolId) return; const { data } = await api.get('/staff'); setStaff(data); }, [activeSchoolId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const h = () => load(); window.addEventListener('stv:school-changed', h); return () => window.removeEventListener('stv:school-changed', h); }, [load]);
  const canCreate = ['super_admin', 'school_admin'].includes(user?.role);
  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="h-font text-2xl font-semibold">Staff</h1><p className="text-sm text-muted-foreground">Teachers and office staff at this branch.</p></div>
        {canCreate && <Button onClick={() => setOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Add Staff</Button>}
      </div>
      <Card className="border-border">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Designation</TableHead><TableHead>Department</TableHead><TableHead>Phone</TableHead><TableHead>Email</TableHead></TableRow></TableHeader>
          <TableBody>
            {staff.length === 0 && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground text-sm">No staff.</TableCell></TableRow>}
            {staff.map((s) => (
              <TableRow key={s.id}>
                <TableCell><div className="flex items-center gap-3"><Avatar className="h-8 w-8"><AvatarImage src={s.photo_url} /><AvatarFallback>{(s.full_name || 'S').split(' ').map((x) => x[0]).slice(0, 2).join('')}</AvatarFallback></Avatar><span className="font-medium">{s.full_name}</span></div></TableCell>
                <TableCell>{s.designation}</TableCell>
                <TableCell>{s.department || '—'}</TableCell>
                <TableCell>{s.phone || '—'}</TableCell>
                <TableCell className="text-muted-foreground">{s.email || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <AddStaff open={open} onOpenChange={setOpen} onSaved={load} />
    </AppShell>
  );
}

function AddStaff({ open, onOpenChange, onSaved }) {
  const [form, setForm] = useState({ full_name: '', designation: 'Teacher', department: '', phone: '', email: '' });
  const [saving, setSaving] = useState(false);
  const submit = async (e) => { e.preventDefault(); setSaving(true);
    try { await api.post('/staff', form); toast.success('Staff added'); onOpenChange(false); onSaved(); }
    catch (err) { toast.error(err.response?.data?.detail || 'Failed'); } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent><DialogHeader><DialogTitle>Add Staff</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-1.5"><Label>Full Name</Label><Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Designation</Label><Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></div>
            <div className="grid gap-1.5"><Label>Department</Label><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
            <div className="grid gap-1.5"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="grid gap-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          </div>
          <DialogFooter><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
