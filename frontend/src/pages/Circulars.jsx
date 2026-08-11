import React, { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Megaphone, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useSchool } from '@/contexts/SchoolContext';
import { useAuth } from '@/contexts/AuthContext';

const PRI = { low: 'bg-secondary text-muted-foreground', normal: 'bg-[#E8F0FF] text-[#1D4ED8]', high: 'bg-[#FFF3E0] text-[#B45309]', urgent: 'bg-[#FEE4E2] text-[#B42318]' };

export default function Circulars() {
  const { activeSchoolId } = useSchool();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const load = useCallback(async () => { if (!activeSchoolId) return; const { data } = await api.get('/circulars'); setItems(data); }, [activeSchoolId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const h = () => load(); window.addEventListener('stv:school-changed', h); return () => window.removeEventListener('stv:school-changed', h); }, [load]);
  const canCreate = ['super_admin', 'school_admin'].includes(user?.role);

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="h-font text-2xl font-semibold">Circulars</h1><p className="text-sm text-muted-foreground">Official announcements published by the school.</p></div>
        {canCreate && <Button data-testid="circulars-add" onClick={() => setOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> New Circular</Button>}
      </div>
      <div className="space-y-3">
        {items.length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground">No circulars yet.</Card>}
        {items.map((c) => (
          <Card key={c.id} className="p-5 border-border">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-md bg-[hsl(var(--primary))]/10 flex items-center justify-center flex-shrink-0"><Megaphone className="h-4 w-4 text-[hsl(var(--primary))]" /></div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="font-semibold">{c.title}</div>
                  <Badge className={PRI[c.priority] || PRI.normal}>{c.priority}</Badge>
                  <Badge variant="secondary" className="capitalize">{c.audience}</Badge>
                </div>
                <div className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{c.body}</div>
                <div className="text-xs text-muted-foreground mt-2">Posted by {c.created_by_name || 'Admin'} · {(c.created_at || '').slice(0, 10)}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <AddCircular open={open} onOpenChange={setOpen} onSaved={load} />
    </AppShell>
  );
}

function AddCircular({ open, onOpenChange, onSaved }) {
  const [form, setForm] = useState({ title: '', body: '', priority: 'normal', audience: 'all', status: 'published' });
  const [saving, setSaving] = useState(false);
  const submit = async (e) => { e.preventDefault(); setSaving(true);
    try { await api.post('/circulars', form); toast.success('Circular published'); onOpenChange(false); onSaved(); }
    catch (err) { toast.error(err.response?.data?.detail || 'Failed'); } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent><DialogHeader><DialogTitle>New Circular</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-1.5"><Label>Title</Label><Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label>Body</Label><Textarea rows={5} required value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['low', 'normal', 'high', 'urgent'].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="grid gap-1.5"><Label>Audience</Label>
              <Select value={form.audience} onValueChange={(v) => setForm({ ...form, audience: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['all', 'parents', 'teachers', 'students'].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
          <DialogFooter><Button type="submit" disabled={saving}>{saving ? 'Publishing…' : 'Publish'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
