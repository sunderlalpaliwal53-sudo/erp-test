import React, { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useSchool } from '@/contexts/SchoolContext';

export default function Attendance() {
  const { activeSchoolId } = useSchool();
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');
  const [section, setSection] = useState('A');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [students, setStudents] = useState([]);
  const [existing, setExisting] = useState({});  // student_id -> status
  const [status, setStatus] = useState({});  // student_id -> status (local)
  const [saving, setSaving] = useState(false);

  const loadClasses = useCallback(async () => {
    if (!activeSchoolId) return;
    const { data } = await api.get('/classes');
    setClasses(data);
    setClassId((prev) => prev || (data[0]?.id ?? ''));
  }, [activeSchoolId]);
  useEffect(() => { loadClasses(); }, [loadClasses]);
  useEffect(() => {
    const h = () => { loadClasses(); setClassId(''); setStudents([]); };
    window.addEventListener('stv:school-changed', h);
    return () => window.removeEventListener('stv:school-changed', h);
  }, [loadClasses]);

  useEffect(() => {
    if (!classId) return;
    (async () => {
      const { data: s } = await api.get('/students', { params: { class_id: classId, section, limit: 500 } });
      setStudents(s);
      const { data: att } = await api.get('/attendance', { params: { class_id: classId, section, date } });
      const map = {};
      att.forEach((a) => { map[a.student_id] = a.status; });
      setExisting(map);
      setStatus({ ...map });
    })();
  }, [classId, section, date]);

  const setStudentStatus = (sid, val) => setStatus({ ...status, [sid]: val });

  const save = async () => {
    setSaving(true);
    try {
      const entries = students.map((s) => ({ student_id: s.id, status: status[s.id] || 'present' }));
      await api.post('/attendance/mark', { date, class_id: classId, section, entries });
      toast.success(`Attendance saved for ${students.length} students`);
      setExisting({ ...status });
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); } finally { setSaving(false); }
  };

  const markAll = (val) => {
    const next = {}; students.forEach((s) => { next[s.id] = val; }); setStatus(next);
  };

  const presentCount = students.filter((s) => (status[s.id] || 'present') === 'present').length;

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="h-font text-2xl font-semibold">Attendance</h1>
        <p className="text-sm text-muted-foreground">Mark daily attendance for a class.</p>
      </div>
      <Card className="p-4 border-border mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="grid gap-1.5"><Label className="text-xs">Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="grid gap-1.5"><Label className="text-xs">Class</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger data-testid="attendance-class-select"><SelectValue /></SelectTrigger>
              <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5"><Label className="text-xs">Section</Label>
            <Select value={section} onValueChange={setSection}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="A">A</SelectItem><SelectItem value="B">B</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="flex items-end justify-end gap-2">
            <Button variant="outline" onClick={() => markAll('present')} className="h-9">Mark All Present</Button>
          </div>
        </div>
      </Card>

      <Card className="border-border" data-testid="attendance-grid">
        <div className="px-4 py-3 flex items-center justify-between border-b border-border">
          <div className="text-sm"><span className="font-medium">{students.length}</span> students • <span className="text-[#0F766E] font-medium">{presentCount} present</span></div>
          <Button data-testid="attendance-save-button" onClick={save} disabled={saving || !students.length}>{saving ? 'Saving…' : 'Save Attendance'}</Button>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Student</TableHead><TableHead>Admission No</TableHead><TableHead className="text-right">Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {students.length === 0 && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground text-sm">No students in this class/section.</TableCell></TableRow>}
            {students.map((s, i) => {
              const st = status[s.id] || 'present';
              return (
                <TableRow key={s.id}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium">{s.full_name}</TableCell>
                  <TableCell className="font-mono text-xs">{s.admission_number}</TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex rounded-md overflow-hidden border border-border">
                      {[['present', CheckCircle2, 'bg-[#E6F6F4] text-[#0F766E]'], ['absent', XCircle, 'bg-[#FEE4E2] text-[#B42318]'], ['leave', Clock, 'bg-[#FFF3E0] text-[#B45309]']].map(([val, Ico, cls]) => (
                        <button key={val} data-testid={`attendance-${s.id}-${val}`} onClick={() => setStudentStatus(s.id, val)} className={`px-3 py-1.5 flex items-center gap-1 text-xs ${st === val ? cls : 'bg-card text-muted-foreground hover:bg-secondary'}`}>
                          <Ico className="h-3.5 w-3.5" /> {val}
                        </button>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </AppShell>
  );
}
