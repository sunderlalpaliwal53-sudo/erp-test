import React, { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useSchool } from '@/contexts/SchoolContext';
import { useAuth } from '@/contexts/AuthContext';

export default function GalleryPage() {
  const { activeSchoolId } = useSchool();
  const { user } = useAuth();
  const [albums, setAlbums] = useState([]);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const load = useCallback(async () => { if (!activeSchoolId) return; const { data } = await api.get('/gallery'); setAlbums(data); }, [activeSchoolId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const h = () => load(); window.addEventListener('stv:school-changed', h); return () => window.removeEventListener('stv:school-changed', h); }, [load]);
  const canCreate = ['super_admin', 'school_admin'].includes(user?.role);

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="h-font text-2xl font-semibold">Gallery</h1><p className="text-sm text-muted-foreground">Photo albums from school events.</p></div>
        {canCreate && <Button data-testid="gallery-add" onClick={() => setOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> New Album</Button>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {albums.length === 0 && <Card className="p-8 text-center text-muted-foreground text-sm md:col-span-2 xl:col-span-3">No albums yet.</Card>}
        {albums.map((a) => (
          <Card key={a.id} className="border-border overflow-hidden cursor-pointer" onClick={() => setPreview(a)}>
            <div className="h-40 bg-secondary" style={{ backgroundImage: `url(${a.cover_url || a.photos?.[0]})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
            <div className="p-4">
              <div className="flex items-center gap-2"><ImageIcon className="h-4 w-4 text-muted-foreground" /><div className="font-medium">{a.title}</div></div>
              <div className="text-xs text-muted-foreground mt-1">{a.photos?.length || 0} photos</div>
            </div>
          </Card>
        ))}
      </div>

      {preview && (
        <Dialog open={!!preview} onOpenChange={() => setPreview(null)}>
          <DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>{preview.title}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-2">
              {(preview.photos || []).map((p, i) => <img key={`${p}-${i}`} src={p} alt="" className="w-full rounded-md" />)}
            </div>
          </DialogContent>
        </Dialog>
      )}
      <AddAlbum open={open} onOpenChange={setOpen} onSaved={load} />
    </AppShell>
  );
}

function AddAlbum({ open, onOpenChange, onSaved }) {
  const [form, setForm] = useState({ title: '', description: '', cover_url: '', photos: '' });
  const [saving, setSaving] = useState(false);
  const submit = async (e) => { e.preventDefault(); setSaving(true);
    try {
      const payload = { title: form.title, description: form.description, cover_url: form.cover_url,
        photos: form.photos.split(/\n|,/).map((s) => s.trim()).filter(Boolean) };
      await api.post('/gallery', payload); toast.success('Album created'); onOpenChange(false); onSaved();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent><DialogHeader><DialogTitle>New Album</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-1.5"><Label>Title</Label><Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label>Cover Image URL</Label><Input value={form.cover_url} onChange={(e) => setForm({ ...form, cover_url: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label>Photo URLs (one per line)</Label><Textarea rows={4} value={form.photos} onChange={(e) => setForm({ ...form, photos: e.target.value })} /></div>
          <DialogFooter><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
