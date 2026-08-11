import React, { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, User as UserIcon, Pencil, Trash2, KeyRound, Search, X, UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useSchool } from '@/contexts/SchoolContext';

const ROLES = ['super_admin', 'school_admin', 'accountant', 'teacher', 'parent'];

// Merge legacy `linked_student_id` with `linked_student_ids` for backwards compat.
const mergedChildIds = (u) => {
  const ids = new Set(u?.linked_student_ids || []);
  if (u?.linked_student_id) ids.add(u.linked_student_id);
  return Array.from(ids).filter(Boolean);
};

export default function UsersPage() {
  const { user } = useAuth();
  const { activeSchoolId } = useSchool();
  const [users, setUsers] = useState([]);
  const [schools, setSchools] = useState([]);
  const [students, setStudents] = useState([]);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [openAdd, setOpenAdd] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [resetUser, setResetUser] = useState(null);

  const load = async () => {
    const [{ data: u }, { data: s }, { data: st }] = await Promise.all([
      api.get('/users'), api.get('/schools'), api.get('/students', { params: { limit: 2000 } }),
    ]);
    setUsers(u); setSchools(s); setStudents(st);
  };
  // Trigger a load whenever the active school changes (super-admin branch
  // switch) AND on the initial hydration when activeSchoolId flips from null
  // to the real ID. This eliminates the timing race where /students runs
  // before the school context populates the X-School-Id header.
  useEffect(() => { load(); }, [activeSchoolId]);
  useEffect(() => {
    const h = () => load();
    window.addEventListener('stv:school-changed', h);
    return () => window.removeEventListener('stv:school-changed', h);
  }, []);
  const schoolMap = Object.fromEntries(schools.map((s) => [s.id, s.name.replace('Stanvard School - ', '')]));
  const studentMap = Object.fromEntries(students.map((s) => [s.id, `${s.full_name} (${s.admission_number})`]));

  const roleTabs = { all: 'All', school_admin: 'Admins', accountant: 'Accountants', teacher: 'Teachers', parent: 'Parents' };
  const filtered = users.filter((u) => {
    if (tab !== 'all' && u.role !== tab) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!(u.full_name || '').toLowerCase().includes(q) && !(u.email || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const del = async (u) => {
    if (!window.confirm(`Deactivate user ${u.full_name}? (This soft-deletes them.)`)) return;
    try { await api.delete(`/users/${u.id}`); toast.success('User deactivated'); load(); }
    catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="h-font text-2xl font-semibold">Users</h1><p className="text-sm text-muted-foreground">Administrators, staff, teachers, and parents.</p></div>
        <Button onClick={() => setOpenAdd(true)} className="gap-2" data-testid="users-add-button"><Plus className="h-4 w-4" /> New User</Button>
      </div>

      <Card className="p-4 border-border mb-4">
        <Tabs value={tab} onValueChange={setTab}>
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <TabsList>
              {Object.entries(roleTabs).map(([k, v]) => <TabsTrigger key={k} value={k} data-testid={`users-tab-${k}`}>{v}</TabsTrigger>)}
            </TabsList>
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search name or email…" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="users-search" />
            </div>
          </div>
        </Tabs>
      </Card>

      <Card className="border-border">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>School</TableHead><TableHead>Linked</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground text-sm">No users found.</TableCell></TableRow>}
            {filtered.map((u) => (
              <TableRow key={u.id} className="hover:bg-secondary/40">
                <TableCell><div className="flex items-center gap-2"><div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center"><UserIcon className="h-3.5 w-3.5" /></div><span className="font-medium">{u.full_name}</span></div></TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell><Badge variant="secondary" className="capitalize">{(u.role || '').replace('_', ' ')}</Badge></TableCell>
                <TableCell>{schoolMap[u.school_id] || '—'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {u.role === 'parent' ? (() => {
                    const ids = mergedChildIds(u);
                    if (ids.length === 0) return '—';
                    const names = ids.map((sid) => studentMap[sid]).filter(Boolean);
                    const first = names[0] || '—';
                    return ids.length > 1 ? (
                      <span title={names.join(', ')}>
                        <b>{first}</b>
                        <Badge variant="secondary" className="ml-1 text-[10px]">+{ids.length - 1}</Badge>
                      </span>
                    ) : first;
                  })() : (
                    u.role === 'teacher' && (u.linked_class_ids || []).length > 0
                      ? `${u.linked_class_ids.length} class${u.linked_class_ids.length === 1 ? '' : 'es'}`
                      : '—'
                  )}
                </TableCell>
                <TableCell><Badge className={u.status === 'active' ? 'bg-[#E6F6F4] text-[#0F766E] border border-[#BFEAE6]' : 'bg-secondary'}>{u.status}</Badge></TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditUser(u)} data-testid={`user-edit-${u.id}`} title="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setResetUser(u)} title="Reset password"><KeyRound className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => del(u)} title="Deactivate"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <UserFormDialog
        open={openAdd || !!editUser}
        onOpenChange={(v) => { setOpenAdd(v); if (!v) setEditUser(null); }}
        schools={schools}
        students={students}
        isSuper={user?.role === 'super_admin'}
        editUser={editUser}
        onSaved={load}
      />
      <ResetPasswordDialog user={resetUser} onOpenChange={() => setResetUser(null)} />
    </AppShell>
  );
}

function UserFormDialog({ open, onOpenChange, schools, students, isSuper, editUser, onSaved }) {
  const [form, setForm] = useState({ email: '', password: '', full_name: '', role: 'teacher', school_id: '', phone: '', linked_student_ids: [] });
  const [saving, setSaving] = useState(false);
  const [childSearch, setChildSearch] = useState('');
  // Locally-fetched student docs for linked children that aren't in the parent
  // `students` prop (e.g. large schools or school-context timing races).
  const [extraStudents, setExtraStudents] = useState({});

  useEffect(() => {
    if (editUser) {
      setForm({
        email: editUser.email, password: '', full_name: editUser.full_name || '',
        role: editUser.role, school_id: editUser.school_id || '',
        phone: editUser.phone || '', linked_student_ids: mergedChildIds(editUser),
      });
    } else if (open) {
      setForm({ email: '', password: '', full_name: '', role: 'teacher', school_id: '', phone: '', linked_student_ids: [] });
    }
    setChildSearch('');
    setExtraStudents({});
  }, [editUser, open]);

  // Backfill missing children (linked but not in `students` prop)
  useEffect(() => {
    const known = new Set(students.map((s) => s.id));
    const missing = form.linked_student_ids.filter((id) => !known.has(id) && !extraStudents[id]);
    if (missing.length === 0) return;
    (async () => {
      const results = await Promise.all(
        missing.map((id) => api.get(`/students/${id}`).then((r) => r.data).catch(() => null)),
      );
      const map = { ...extraStudents };
      results.forEach((doc) => { if (doc) map[doc.id] = doc; });
      setExtraStudents(map);
    })();
  }, [form.linked_student_ids, students]); // eslint-disable-line react-hooks/exhaustive-deps

  const allStudents = [...students, ...Object.values(extraStudents)];
  const filteredStudents = allStudents.filter((s) => !form.school_id || s.school_id === form.school_id);
  const linkedStudents = useMemo(
    () => form.linked_student_ids.map((id) => allStudents.find((s) => s.id === id)).filter(Boolean),
    [form.linked_student_ids, allStudents.length], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const searchLower = childSearch.trim().toLowerCase();
  const suggestions = useMemo(() => {
    if (!searchLower) return [];
    const selected = new Set(form.linked_student_ids);
    return filteredStudents
      .filter((s) => !selected.has(s.id))
      .filter((s) => (
        (s.full_name || '').toLowerCase().includes(searchLower) ||
        (s.admission_number || '').toLowerCase().includes(searchLower) ||
        (s.father_name || '').toLowerCase().includes(searchLower) ||
        (s.phone || '').toLowerCase().includes(searchLower)
      ))
      .slice(0, 8);
  }, [searchLower, filteredStudents, form.linked_student_ids]);

  const addChild = (student) => {
    if (form.linked_student_ids.includes(student.id)) return;
    setForm((f) => ({ ...f, linked_student_ids: [...f.linked_student_ids, student.id] }));
    setChildSearch('');
  };
  const removeChild = (studentId) => {
    setForm((f) => ({ ...f, linked_student_ids: f.linked_student_ids.filter((id) => id !== studentId) }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editUser) {
        const payload = {
          full_name: form.full_name,
          role: form.role,
          school_id: form.school_id || null,
          phone: form.phone,
          linked_student_ids: form.role === 'parent' ? form.linked_student_ids : [],
        };
        if (form.password) payload.password = form.password;
        await api.patch(`/users/${editUser.id}`, payload);
        toast.success('User updated');
      } else {
        const payload = { ...form };
        if (form.role !== 'parent') payload.linked_student_ids = [];
        await api.post('/users', payload);
        toast.success('User created');
      }
      onOpenChange(false); onSaved();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editUser ? `Edit ${editUser.full_name}` : 'New User'}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-1.5"><Label>Full Name</Label><Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} data-testid="user-form-name" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Email</Label><Input required type="email" disabled={!!editUser} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="user-form-email" /></div>
            <div className="grid gap-1.5"><Label>{editUser ? 'New Password (optional)' : 'Password'}</Label><Input type="password" required={!editUser} minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} data-testid="user-form-password" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger data-testid="user-form-role"><SelectValue /></SelectTrigger>
                <SelectContent>{(isSuper ? ROLES : ROLES.filter((r) => r !== 'super_admin')).map((r) => <SelectItem key={r} value={r}>{r.replace('_', ' ')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {isSuper && form.role !== 'super_admin' && (
              <div className="grid gap-1.5"><Label>School</Label>
                <Select value={form.school_id} onValueChange={(v) => setForm({ ...form, school_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Assign school" /></SelectTrigger>
                  <SelectContent>{schools.map((s) => <SelectItem key={s.id} value={s.id}>{s.name.replace('Stanvard School - ', '')}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label>Phone {form.role === 'parent' && <span className="text-xs text-muted-foreground">(used as parent login username)</span>}</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="user-form-phone" />
          </div>

          {form.role === 'parent' && (
            <div className="grid gap-2 rounded-md border border-border bg-secondary/30 p-3">
              <div className="flex items-center gap-2">
                <UsersRound className="h-4 w-4 text-[hsl(var(--primary))]" />
                <Label className="text-sm font-medium">Linked Children ({linkedStudents.length})</Label>
              </div>
              <p className="text-xs text-muted-foreground -mt-1">
                Search and add every child that belongs to this parent — one account can hold multiple siblings.
              </p>

              {linkedStudents.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {linkedStudents.map((s) => (
                    <Badge key={s.id} variant="secondary" className="gap-1 pl-2 pr-1 h-6 text-xs" data-testid={`parent-child-chip-${s.id}`}>
                      {s.full_name}
                      <span className="text-muted-foreground">· {s.admission_number}</span>
                      <button
                        type="button" onClick={() => removeChild(s.id)}
                        className="ml-0.5 rounded p-0.5 hover:bg-muted"
                        aria-label={`Remove ${s.full_name}`}
                        data-testid={`parent-child-remove-${s.id}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search by name, admission no, father, phone…"
                  value={childSearch}
                  onChange={(e) => setChildSearch(e.target.value)}
                  data-testid="parent-child-search"
                />
                {suggestions.length > 0 && (
                  <div className="absolute z-30 left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-md max-h-56 overflow-y-auto">
                    {suggestions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => addChild(s)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-secondary flex items-center justify-between gap-2 border-b border-border/50 last:border-0"
                        data-testid={`parent-child-suggestion-${s.id}`}
                      >
                        <div>
                          <div className="font-medium">{s.full_name}</div>
                          <div className="text-xs text-muted-foreground">{s.admission_number} · {s.father_name || '—'} · {s.phone || '—'}</div>
                        </div>
                        <Plus className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {linkedStudents.length === 0 && (
                <p className="text-xs text-[#B45309]">This parent has no children linked yet — they won't see anything after login.</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving} data-testid="user-form-submit">{saving ? 'Saving…' : editUser ? 'Save Changes' : 'Create User'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ user, onOpenChange }) {
  const [pw, setPw] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (user) setPw(''); }, [user]);
  const submit = async (e) => {
    e.preventDefault(); setSaving(true);
    try { await api.post(`/users/${user.id}/reset-password`, { password: pw }); toast.success(`Password reset for ${user.email}`); onOpenChange(); }
    catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={!!user} onOpenChange={() => onOpenChange()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Reset Password</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="text-sm text-muted-foreground">Set a new password for <b>{user?.email}</b>. The user should change it after next login.</div>
          <div className="grid gap-1.5"><Label>New Password</Label><Input required minLength={6} type="text" value={pw} onChange={(e) => setPw(e.target.value)} data-testid="reset-password-input" /></div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={onOpenChange}>Cancel</Button>
            <Button type="submit" disabled={saving} data-testid="reset-password-submit">{saving ? 'Saving…' : 'Reset Password'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
