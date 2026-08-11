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
import { Plus, BookOpen, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useSchool } from '@/contexts/SchoolContext';
import { useAuth } from '@/contexts/AuthContext';

export default function HomeworkPage() {
  const { activeSchoolId } = useSchool();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [classes, setClasses] = useState([]);
  const [open, setOpen] = useState(false);
  const load = useCallback(async () => {
    if (!activeSchoolId) return;
    const [{ data }, { data: c }] = await Promise.all([api.get('/homework'), api.get('/classes')]);
    setItems(data); setClasses(c);
  }, [activeSchoolId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const h = () => load();
    window.addEventListener('stv:school-changed', h);
    return () => window.removeEventListener('stv:school-changed', h);
  }, [load]);

  const classMap = Object.fromEntries(classes.map((c) => [c.id, c.name]));
  const canCreate = ['super_admin', 'school_admin', 'teacher'].includes(user?.role);

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="h-font text-2xl font-semibold">Homework</h1><p className="text-sm text-muted-foreground">Assignments assigned by teachers.</p></div>
        {canCreate && <Button data-testid="homework-add" onClick={() => setOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> New Homework</Button>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {items.length === 0 && <Card className="p-8 text-center text-muted-foreground text-sm md:col-span-2 xl:col-span-3">No homework yet.</Card>}
        {items.map((h) => (
          <Card key={h.id} className="p-5 border-border">
            <div className="flex items-start justify-between mb-2">
              <div className="h-9 w-9 rounded-md bg-[hsl(var(--primary))]/10 flex items-center justify-center"><BookOpen className="h-4 w-4 text-[hsl(var(--primary))]" /></div>
              <Badge variant="secondary">{classMap[h.class_id] || 'Class'} {h.section && `• ${h.section}`}</Badge>
            </div>
            <div className="text-xs uppercase text-muted-foreground tracking-wide">{h.subject}</div>
            <div className="font-semibold mt-0.5">{h.title}</div>
            <div className="text-sm text-muted-foreground mt-1 line-clamp-3">{h.description}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-3">
              <Calendar className="h-3 w-3" /> Due: {h.due_date || '—'} • by {h.created_by_name || 'Teacher'}
            </div>
          </Card>
        ))}
      </div>
      <AddHomework open={open} onOpenChange={setOpen} classes={classes} onSaved={load} />
    </AppShell>
  );
}

function AddHomework({ open, onOpenChange, classes, onSaved }) {
  const [form, setForm] = useState({ class_id: '', section: 'A', subject: '', title: '', description: '', due_date: '' });
  const [saving, setSaving] = useState(false);
  const submit = async (e) => { e.preventDefault(); setSaving(true);
    try { await api.post('/homework', form); toast.success('Homework created'); onOpenChange(false); onSaved(); setForm({ class_id: '', section: 'A', subject: '', title: '', description: '', due_date: '' }); }
    catch (err) { toast.error(err.response?.data?.detail || 'Failed'); } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>New Homework</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Class</Label>
              <Select value={form.class_id} onValueChange={(v) => setForm({ ...form, class_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5"><Label>Section</Label>
              <Select value={form.section} onValueChange={(v) => setForm({ ...form, section: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="A">A</SelectItem><SelectItem value="B">B</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5"><Label>Subject</Label><Input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label>Title</Label><Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label>Description</Label><Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label>Due Date</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
          <DialogFooter><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Publish'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
