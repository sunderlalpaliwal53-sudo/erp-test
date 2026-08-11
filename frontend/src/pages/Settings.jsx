import React, { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useSchool } from '@/contexts/SchoolContext';
import { useAuth } from '@/contexts/AuthContext';

export default function SettingsPage() {
  const { activeSchoolId, activeSchool, refresh } = useSchool();
  const { user } = useAuth();
  const [form, setForm] = useState({ name: '', address: '', phone: '', email: '', principal_name: '', academic_session: '' });
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    if (!activeSchool) return;
    setForm({ name: activeSchool.name || '', address: activeSchool.address || '', phone: activeSchool.phone || '',
              email: activeSchool.email || '', principal_name: activeSchool.principal_name || '', academic_session: activeSchool.academic_session || '' });
  }, [activeSchool]);
  useEffect(() => { load(); }, [load]);

  const canEdit = ['super_admin', 'school_admin'].includes(user?.role);
  const submit = async (e) => { e.preventDefault(); setSaving(true);
    try { await api.patch(`/schools/${activeSchoolId}`, form); toast.success('Settings updated'); refresh(); }
    catch (err) { toast.error(err.response?.data?.detail || 'Failed'); } finally { setSaving(false); }
  };
  return (
    <AppShell>
      <div className="mb-6"><h1 className="h-font text-2xl font-semibold">School Settings</h1><p className="text-sm text-muted-foreground">Configure branding and details for {activeSchool?.name || 'this branch'}.</p></div>
      <Card className="p-6 border-border max-w-3xl">
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="grid gap-1.5"><Label>School Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={!canEdit} /></div>
          <div className="grid gap-1.5"><Label>Principal</Label><Input value={form.principal_name} onChange={(e) => setForm({ ...form, principal_name: e.target.value })} disabled={!canEdit} /></div>
          <div className="grid gap-1.5 md:col-span-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} disabled={!canEdit} /></div>
          <div className="grid gap-1.5"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} disabled={!canEdit} /></div>
          <div className="grid gap-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={!canEdit} /></div>
          <div className="grid gap-1.5"><Label>Academic Session</Label><Input value={form.academic_session} onChange={(e) => setForm({ ...form, academic_session: e.target.value })} disabled={!canEdit} /></div>
          {canEdit && <div className="md:col-span-2 flex justify-end"><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button></div>}
        </form>
      </Card>
    </AppShell>
  );
}
