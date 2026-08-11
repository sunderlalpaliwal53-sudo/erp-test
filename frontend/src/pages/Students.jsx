import React, { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Search, Plus, GraduationCap, Filter, Pencil, Upload } from 'lucide-react';
import { useSchool } from '@/contexts/SchoolContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { EditStudentDialog } from '@/components/EditStudentDialog';
import { ImportStudentsDialog } from '@/components/ImportStudentsDialog';

export default function StudentsPage() {
  const { activeSchoolId } = useSchool();
  const { user } = useAuth();
  const nav = useNavigate();
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState(() => sessionStorage.getItem('students_class_filter') || 'all');
  useEffect(() => { sessionStorage.setItem('students_class_filter', classFilter); }, [classFilter]);
  const [sectionFilter, setSectionFilter] = useState(() => sessionStorage.getItem('students_section_filter') || 'all');
  useEffect(() => { sessionStorage.setItem('students_section_filter', sectionFilter); }, [sectionFilter]);
  const [loading, setLoading] = useState(false);
  const [openAdd, setOpenAdd] = useState(false);
  const [openImport, setOpenImport] = useState(false);
  const [editStudent, setEditStudent] = useState(null);

  const load = useCallback(async () => {
    if (!activeSchoolId) return;
    setLoading(true);
    try {
      const params = { limit: 500 };
      if (search) params.search = search;
      if (classFilter !== 'all') params.class_id = classFilter;
      if (sectionFilter !== 'all') params.section = sectionFilter;
      const [{ data: s }, { data: c }] = await Promise.all([
        api.get('/students', { params }),
        api.get('/classes'),
      ]);
      setStudents(s); setClasses(c);
    } finally { setLoading(false); }
  }, [activeSchoolId, search, classFilter, sectionFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const h = () => load();
    window.addEventListener('stv:school-changed', h);
    return () => window.removeEventListener('stv:school-changed', h);
  }, [load]);

  const classMap = Object.fromEntries(classes.map((c) => [c.id, c.name]));
  const canEdit = ['super_admin', 'school_admin'].includes(user?.role);

  return (
    <AppShell>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <div>
          <h1 className="h-font text-2xl font-semibold">Students</h1>
          <p className="text-sm text-muted-foreground">Manage student admissions, profiles, and records.</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" data-testid="students-import-button" onClick={() => setOpenImport(true)} className="gap-2">
              <Upload className="h-4 w-4" /> Import CSV
            </Button>
            <Button data-testid="students-add-button" onClick={() => setOpenAdd(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Add Student
            </Button>
          </div>
        )}
      </div>
      <ImportStudentsDialog open={openImport} onOpenChange={setOpenImport} onDone={load} />

      <Card className="p-3 sm:p-4 border-border mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <div className="relative flex-1 sm:min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              data-testid="students-search-input"
              placeholder="Search by name, admission number, phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2 sm:gap-3">
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger data-testid="students-filter-class-select" className="w-full sm:w-[180px]">
                <Filter className="h-3.5 w-3.5 mr-1" /><SelectValue placeholder="Class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sectionFilter} onValueChange={setSectionFilter}>
              <SelectTrigger className="w-full sm:w-[140px]"><SelectValue placeholder="Section" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sections</SelectItem>
                <SelectItem value="A">Section A</SelectItem>
                <SelectItem value="B">Section B</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="border-border overflow-hidden">
        <div className="overflow-x-auto" data-testid="students-table">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/60">
                <TableHead className="text-xs uppercase tracking-wide">Student</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Admission No</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Class</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Guardian</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Phone</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Status</TableHead>
                {canEdit && <TableHead className="text-xs uppercase tracking-wide text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.length === 0 && !loading && (
                <TableRow><TableCell colSpan={canEdit ? 7 : 6} className="py-8 text-center text-muted-foreground text-sm">No students found.</TableCell></TableRow>
              )}
              {students.map((s) => (
                <TableRow key={s.id} data-testid={`student-row-${s.id}`} className="hover:bg-secondary/40 cursor-pointer" onClick={() => nav(`/students/${s.id}`)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={s.photo_url} />
                        <AvatarFallback className="bg-secondary text-xs">{(s.full_name || 'S').split(' ').map((x) => x[0]).slice(0, 2).join('')}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-sm">{s.full_name}</div>
                        <div className="text-xs text-muted-foreground">{s.gender} • {s.category || 'General'}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{s.admission_number}</TableCell>
                  <TableCell>{classMap[s.class_id] || '-'} {s.section && `• ${s.section}`}</TableCell>
                  <TableCell className="text-sm">{s.father_name || '-'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.phone || '-'}</TableCell>
                  <TableCell>
                    <Badge className={s.status === 'active' ? 'bg-[#E6F6F4] text-[#0F766E] border border-[#BFEAE6]' : 'bg-secondary text-muted-foreground'}>
                      {s.status || 'active'}
                    </Badge>
                  </TableCell>
                  {canEdit && (
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="ghost" onClick={() => setEditStudent(s)} data-testid={`student-edit-${s.id}`}><Pencil className="h-3.5 w-3.5" /></Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <AddStudentDialog open={openAdd} onOpenChange={setOpenAdd} classes={classes} onSaved={load} />
      <EditStudentDialog open={!!editStudent} onOpenChange={(v) => !v && setEditStudent(null)} student={editStudent} classes={classes} onSaved={load} />
    </AppShell>
  );
}

function AddStudentDialog({ open, onOpenChange, classes, onSaved }) {
  const [form, setForm] = useState({ full_name: '', class_id: '', section: 'A', gender: 'Male', father_name: '', mother_name: '', phone: '', email: '', address: '' });
  const [saving, setSaving] = useState(false);
  const update = (k, v) => setForm({ ...form, [k]: v });
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/students', form);
      toast.success('Student added');
      onOpenChange(false);
      onSaved();
      setForm({ full_name: '', class_id: '', section: 'A', gender: 'Male', father_name: '', mother_name: '', phone: '', email: '', address: '' });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add');
    } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><GraduationCap className="h-4 w-4" /> Add New Student</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="grid gap-1.5"><Label>Full Name</Label><Input required data-testid="student-add-name" value={form.full_name} onChange={(e) => update('full_name', e.target.value)} /></div>
          <div className="grid gap-1.5"><Label>Class</Label>
            <Select value={form.class_id} onValueChange={(v) => update('class_id', v)}>
              <SelectTrigger data-testid="student-add-class"><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5"><Label>Section</Label>
            <Select value={form.section} onValueChange={(v) => update('section', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="A">A</SelectItem><SelectItem value="B">B</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5"><Label>Gender</Label>
            <Select value={form.gender} onValueChange={(v) => update('gender', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5"><Label>Father Name</Label><Input value={form.father_name} onChange={(e) => update('father_name', e.target.value)} /></div>
          <div className="grid gap-1.5"><Label>Mother Name</Label><Input value={form.mother_name} onChange={(e) => update('mother_name', e.target.value)} /></div>
          <div className="grid gap-1.5"><Label>Phone</Label><Input value={form.phone} onChange={(e) => update('phone', e.target.value)} /></div>
          <div className="grid gap-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} /></div>
          <div className="grid gap-1.5 md:col-span-2"><Label>Address</Label><Input value={form.address} onChange={(e) => update('address', e.target.value)} /></div>
          <DialogFooter className="md:col-span-2">
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button data-testid="student-add-submit" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add Student'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
