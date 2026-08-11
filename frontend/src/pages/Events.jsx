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
import { CalendarDays, MapPin, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useSchool } from '@/contexts/SchoolContext';
import { useAuth } from '@/contexts/AuthContext';

export default function EventsPage() {
  const { activeSchoolId } = useSchool();
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [open, setOpen] = useState(false);
  const load = useCallback(async () => {
    if (!activeSchoolId) return;
    const { data } = await api.get('/events'); setEvents(data);
  }, [activeSchoolId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const h = () => load(); window.addEventListener('stv:school-changed', h); return () => window.removeEventListener('stv:school-changed', h); }, [load]);
  const canCreate = ['super_admin', 'school_admin'].includes(user?.role);

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="h-font text-2xl font-semibold">Events</h1><p className="text-sm text-muted-foreground">Upcoming and past school events.</p></div>
        {canCreate && <Button data-testid="events-add" onClick={() => setOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> New Event</Button>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {events.length === 0 && <Card className="p-8 text-center text-muted-foreground text-sm md:col-span-2 xl:col-span-3">No events yet.</Card>}
        {events.map((e) => {
          const upcoming = e.event_date >= new Date().toISOString().slice(0, 10);
          return (
            <Card key={e.id} className="border-border overflow-hidden">
              {e.image_url && <div className="h-40 bg-secondary" style={{ backgroundImage: `url(${e.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />}
              <div className="p-5">
                <div className="flex items-center gap-2 mb-2"><Badge variant="secondary">{new Date(e.event_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</Badge>{upcoming && <Badge className="bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))] border border-[hsl(var(--accent))]/20">Upcoming</Badge>}</div>
                <div className="font-semibold">{e.title}</div>
                <div className="text-sm text-muted-foreground mt-1 line-clamp-2">{e.description}</div>
                {e.location && <div className="flex items-center gap-1 text-xs text-muted-foreground mt-3"><MapPin className="h-3 w-3" /> {e.location}</div>}
              </div>
            </Card>
          );
        })}
      </div>
      <AddEvent open={open} onOpenChange={setOpen} onSaved={load} />
    </AppShell>
  );
}

function AddEvent({ open, onOpenChange, onSaved }) {
  const [form, setForm] = useState({ title: '', description: '', event_date: '', location: '', image_url: '' });
  const [saving, setSaving] = useState(false);
  const submit = async (e) => { e.preventDefault(); setSaving(true);
    try { await api.post('/events', form); toast.success('Event created'); onOpenChange(false); onSaved(); }
    catch (err) { toast.error(err.response?.data?.detail || 'Failed'); } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent><DialogHeader><DialogTitle>New Event</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-1.5"><Label>Title</Label><Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label>Description</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Date</Label><Input type="date" required value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} /></div>
            <div className="grid gap-1.5"><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
          </div>
          <div className="grid gap-1.5"><Label>Image URL (optional)</Label><Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} /></div>
          <DialogFooter><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Publish'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
