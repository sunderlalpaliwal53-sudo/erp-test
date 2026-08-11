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
import { Bell, Send, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useSchool } from '@/contexts/SchoolContext';
import { useAuth } from '@/contexts/AuthContext';

export default function NotificationsPage() {
  const { activeSchoolId } = useSchool();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const load = useCallback(async () => { if (!activeSchoolId) return; const { data } = await api.get('/notifications'); setItems(data); }, [activeSchoolId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const h = () => load(); window.addEventListener('stv:school-changed', h); return () => window.removeEventListener('stv:school-changed', h); }, [load]);
  const canSend = ['super_admin', 'school_admin', 'teacher'].includes(user?.role);

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="h-font text-2xl font-semibold">Notifications</h1><p className="text-sm text-muted-foreground">Announcements sent to your audience.</p></div>
        {canSend && <Button data-testid="notification-send" onClick={() => setOpen(true)} className="gap-2"><Send className="h-4 w-4" /> Send Notification</Button>}
      </div>
      <div className="space-y-3">
        {items.length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground">No notifications.</Card>}
        {items.map((n) => (
          <Card key={n.id} className="p-4 border-border flex gap-3">
            <div className="h-9 w-9 rounded-md bg-[hsl(var(--primary))]/10 flex items-center justify-center flex-shrink-0"><Bell className="h-4 w-4 text-[hsl(var(--primary))]" /></div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap"><div className="font-medium">{n.title}</div><Badge variant="secondary" className="capitalize">{n.kind}</Badge><Badge variant="secondary" className="capitalize">{n.audience}</Badge></div>
              <div className="text-sm text-muted-foreground mt-1">{n.body}</div>
              <div className="text-xs text-muted-foreground mt-1">{(n.created_at || '').slice(0, 16).replace('T', ' ')}</div>
            </div>
          </Card>
        ))}
      </div>
      <SendDialog open={open} onOpenChange={setOpen} onSaved={load} />
    </AppShell>
  );
}

function SendDialog({ open, onOpenChange, onSaved }) {
  const [form, setForm] = useState({ title: '', body: '', audience: 'all', kind: 'announcement' });
  const [saving, setSaving] = useState(false);
  const submit = async (e) => { e.preventDefault(); setSaving(true);
    try { await api.post('/notifications', form); toast.success('Notification sent'); onOpenChange(false); onSaved(); setForm({ title: '', body: '', audience: 'all', kind: 'announcement' }); }
    catch (err) { toast.error(err.response?.data?.detail || 'Failed'); } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent><DialogHeader><DialogTitle>Send Notification</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-1.5"><Label>Title</Label><Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label>Message</Label><Textarea rows={4} required value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Audience</Label>
              <Select value={form.audience} onValueChange={(v) => setForm({ ...form, audience: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['all', 'parents', 'teachers'].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="grid gap-1.5"><Label>Type</Label>
              <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['announcement', 'homework', 'fee_reminder', 'exam', 'emergency'].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
          <DialogFooter><Button type="submit" disabled={saving}>{saving ? 'Sending…' : 'Send'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
