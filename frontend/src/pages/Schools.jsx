import React, { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, School as SchoolIcon } from 'lucide-react';
import { toast } from 'sonner';

export default function SchoolsPage() {
  const [schools, setSchools] = useState([]);
  const [open, setOpen] = useState(false);
  const load = async () => { const { data } = await api.get('/schools'); setSchools(data); };
  useEffect(() => { load(); }, []);
  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="h-font text-2xl font-semibold">Schools</h1><p className="text-sm text-muted-foreground">All Stanvard branches across cities.</p></div>
        <Button data-testid="schools-add" onClick={() => setOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> New School</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {schools.map((s) => (
          <Card key={s.id} className="p-5 border-border">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-md bg-[hsl(var(--primary))]/10 flex items-center justify-center flex-shrink-0"><SchoolIcon className="h-5 w-5 text-[hsl(var(--primary))]" /></div>
              <div className="flex-1">
                <div className="flex items-center gap-2"><div className="font-semibold">{s.name}</div><Badge variant="secondary">{s.code}</Badge></div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.city}</div>
                <div className="text-sm text-muted-foreground mt-2 line-clamp-2">{s.address || '—'}</div>
                <div className="text-xs text-muted-foreground mt-2">Principal: {s.principal_name || '—'}</div>
                <div className="text-xs text-muted-foreground">Session: {s.academic_session}</div>
                <div className="mt-3"><Badge className={s.status === 'active' ? 'bg-[#E6F6F4] text-[#0F766E] border border-[#BFEAE6]' : 'bg-secondary'}>{s.status}</Badge></div>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <AddSchool open={open} onOpenChange={setOpen} onSaved={load} />
    </AppShell>
  );
}

function AddSchool({ open, onOpenChange, onSaved }) {
  const [form, setForm] = useState({ name: '', code: '', city: '', address: '', phone: '', email: '', principal_name: '', academic_session: '2025-26' });
  const [saving, setSaving] = useState(false);
  const submit = async (e) => { e.preventDefault(); setSaving(true);
    try { await api.post('/schools', form); toast.success('School created'); onOpenChange(false); onSaved(); }
    catch (err) { toast.error(err.response?.data?.detail || 'Failed'); } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent><DialogHeader><DialogTitle>New School</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="grid gap-1.5 md:col-span-2"><Label>Full Name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label>Short Code</Label><Input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} /></div>
          <div className="grid gap-1.5"><Label>City</Label><Input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
          <div className="grid gap-1.5 md:col-span-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label>Principal</Label><Input value={form.principal_name} onChange={(e) => setForm({ ...form, principal_name: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label>Session</Label><Input value={form.academic_session} onChange={(e) => setForm({ ...form, academic_session: e.target.value })} /></div>
          <DialogFooter className="md:col-span-2"><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create School'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
