import React, { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { api, downloadAsPdf } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Award, Trash2, PenLine, Trophy, FileDown, X, Megaphone } from 'lucide-react';
import { toast } from 'sonner';
import { useSchool } from '@/contexts/SchoolContext';
import { useAuth } from '@/contexts/AuthContext';

export default function ExamsPage() {
  const { activeSchoolId } = useSchool();
  const { user } = useAuth();
  const [exams, setExams] = useState([]);
  const [classes, setClasses] = useState([]);
  const [openAdd, setOpenAdd] = useState(false);
  const [marksExamId, setMarksExamId] = useState(null);
  const [resultsExamId, setResultsExamId] = useState(null);

  const load = useCallback(async () => {
    if (!activeSchoolId) return;
    const [{ data: e }, { data: c }] = await Promise.all([api.get('/exams'), api.get('/classes')]);
    setExams(e); setClasses(c);
  }, [activeSchoolId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const h = () => load();
    window.addEventListener('stv:school-changed', h);
    return () => window.removeEventListener('stv:school-changed', h);
  }, [load]);

  const classMap = Object.fromEntries(classes.map((c) => [c.id, c.name]));
  const canManage = ['super_admin', 'school_admin'].includes(user?.role);
  const canMarks = canManage || user?.role === 'teacher';

  const togglePublish = async (ex) => {
    try {
      const next = ex.status === 'published' ? 'completed' : 'published';
      await api.patch(`/exams/${ex.id}`, { status: next });
      toast.success(next === 'published' ? 'Results published to parents' : 'Results unpublished');
      load();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const removeExam = async (ex) => {
    if (!window.confirm(`Delete "${ex.name}" and all entered marks?`)) return;
    try { await api.delete(`/exams/${ex.id}`); toast.success('Exam deleted'); load(); }
    catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="h-font text-2xl font-semibold">Examinations</h1>
          <p className="text-sm text-muted-foreground">Create exams, enter marks and publish report cards.</p>
        </div>
        {canManage && (
          <Button data-testid="exams-add-button" onClick={() => setOpenAdd(true)} className="gap-2">
            <Plus className="h-4 w-4" /> New Exam
          </Button>
        )}
      </div>

      <Card className="border-border overflow-hidden">
        <div className="overflow-x-auto" data-testid="exams-table">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/60">
                <TableHead className="text-xs uppercase tracking-wide">Exam</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Class</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Date</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Subjects</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Status</TableHead>
                <TableHead className="text-xs uppercase tracking-wide text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exams.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10" data-testid="exams-empty">
                    No exams yet. Create your first exam to start entering marks.
                  </TableCell>
                </TableRow>
              )}
              {exams.map((ex) => (
                <TableRow key={ex.id} data-testid={`exam-row-${ex.id}`}>
                  <TableCell>
                    <div className="font-medium flex items-center gap-2">
                      <Award className="h-4 w-4 text-[hsl(var(--primary))]" />{ex.name}
                    </div>
                    {ex.term && <div className="text-xs text-muted-foreground ml-6">{ex.term}</div>}
                  </TableCell>
                  <TableCell>{classMap[ex.class_id] || '—'}{ex.section ? ` • ${ex.section}` : ' • All sections'}</TableCell>
                  <TableCell>{ex.exam_date || '—'}</TableCell>
                  <TableCell><Badge variant="secondary">{(ex.subjects || []).length} subjects</Badge></TableCell>
                  <TableCell>
                    <Badge variant={ex.status === 'published' ? 'default' : 'secondary'} data-testid={`exam-status-${ex.id}`}>{ex.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1 flex-wrap">
                      {canMarks && (
                        <Button size="sm" variant="outline" data-testid={`exam-marks-${ex.id}`} onClick={() => setMarksExamId(ex.id)}>
                          <PenLine className="h-3.5 w-3.5 mr-1" />Marks
                        </Button>
                      )}
                      <Button size="sm" variant="outline" data-testid={`exam-results-${ex.id}`} onClick={() => setResultsExamId(ex.id)}>
                        <Trophy className="h-3.5 w-3.5 mr-1" />Results
                      </Button>
                      {canManage && (
                        <Button size="sm" variant="outline" data-testid={`exam-publish-${ex.id}`} onClick={() => togglePublish(ex)}>
                          <Megaphone className="h-3.5 w-3.5 mr-1" />{ex.status === 'published' ? 'Unpublish' : 'Publish'}
                        </Button>
                      )}
                      {canManage && (
                        <Button size="sm" variant="ghost" data-testid={`exam-delete-${ex.id}`} onClick={() => removeExam(ex)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <AddExam open={openAdd} onOpenChange={setOpenAdd} classes={classes} onSaved={load} />
      {marksExamId && <EnterMarks examId={marksExamId} onClose={() => setMarksExamId(null)} />}
      {resultsExamId && <ExamResults examId={resultsExamId} onClose={() => setResultsExamId(null)} />}
    </AppShell>
  );
}

function AddExam({ open, onOpenChange, classes, onSaved }) {
  const empty = { name: '', term: '', class_id: '', section: 'all', exam_date: '', academic_session: '2025-26' };
  const [form, setForm] = useState(empty);
  const [subjects, setSubjects] = useState([{ name: '', max_marks: 100 }]);
  const [saving, setSaving] = useState(false);
  const setSubj = (i, k, v) => setSubjects(subjects.map((s, j) => (j === i ? { ...s, [k]: v } : s)));

  const submit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = {
        ...form,
        section: form.section === 'all' ? null : form.section,
        subjects: subjects.filter((s) => s.name.trim()).map((s) => ({ name: s.name.trim(), max_marks: Number(s.max_marks) || 100 })),
      };
      await api.post('/exams', payload);
      toast.success('Exam created');
      onOpenChange(false); onSaved();
      setForm(empty); setSubjects([{ name: '', max_marks: 100 }]);
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl" data-testid="exam-create-dialog">
        <DialogHeader><DialogTitle>New Exam</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Exam Name</Label>
              <Input data-testid="exam-name-input" required placeholder="Half-Yearly Examination" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-1.5"><Label>Term</Label>
              <Input placeholder="Term 1" value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5"><Label>Class</Label>
              <Select value={form.class_id} onValueChange={(v) => setForm({ ...form, class_id: v })}>
                <SelectTrigger data-testid="exam-class-select"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5"><Label>Section</Label>
              <Select value={form.section} onValueChange={(v) => setForm({ ...form, section: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sections</SelectItem>
                  <SelectItem value="A">A</SelectItem>
                  <SelectItem value="B">B</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5"><Label>Exam Date</Label>
              <Input type="date" value={form.exam_date} onChange={(e) => setForm({ ...form, exam_date: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Subjects &amp; Max Marks</Label>
            {subjects.map((s, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input data-testid={`exam-subject-name-${i}`} placeholder={`Subject ${i + 1}`} value={s.name} onChange={(e) => setSubj(i, 'name', e.target.value)} />
                <Input data-testid={`exam-subject-max-${i}`} type="number" min="1" className="w-28" value={s.max_marks} onChange={(e) => setSubj(i, 'max_marks', e.target.value)} />
                <Button type="button" variant="ghost" size="sm" onClick={() => setSubjects(subjects.filter((_, j) => j !== i))} disabled={subjects.length === 1}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" data-testid="exam-add-subject" className="w-fit gap-1" onClick={() => setSubjects([...subjects, { name: '', max_marks: 100 }])}>
              <Plus className="h-3.5 w-3.5" /> Add Subject
            </Button>
          </div>
          <DialogFooter>
            <Button type="submit" data-testid="exam-create-submit" disabled={saving || !form.class_id}>{saving ? 'Saving…' : 'Create Exam'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EnterMarks({ examId, onClose }) {
  const [data, setData] = useState(null);
  const [grid, setGrid] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/exams/${examId}`);
        setData(data);
        const g = {};
        for (const s of data.students) {
          const m = (data.marks[s.id] || {}).marks || {};
          g[s.id] = Object.fromEntries((data.exam.subjects || []).map((sub) => [
            sub.name, m[sub.name] === null || m[sub.name] === undefined ? '' : String(m[sub.name]),
          ]));
        }
        setGrid(g);
      } catch (err) {
        toast.error(err.response?.data?.detail || 'Failed to load exam');
        onClose();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  const save = async () => {
    setSaving(true);
    try {
      const subjects = data.exam.subjects || [];
      const entries = data.students.map((s) => ({
        student_id: s.id,
        marks: Object.fromEntries(subjects.map((sub) => {
          const raw = String(grid[s.id]?.[sub.name] ?? '').trim();
          return [sub.name, raw === '' || raw.toUpperCase() === 'AB' ? null : Number(raw)];
        })),
      }));
      await api.post(`/exams/${examId}/marks`, { entries });
      toast.success('Marks saved');
      onClose();
    } catch (err) { toast.error(err.response?.data?.detail || 'Save failed'); }
    finally { setSaving(false); }
  };

  const subjects = data?.exam?.subjects || [];
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl" data-testid="marks-entry-dialog">
        <DialogHeader><DialogTitle>Enter Marks — {data?.exam?.name || 'Loading…'}</DialogTitle><DialogDescription className="sr-only">Marks entry grid for all students in this exam</DialogDescription></DialogHeader>
        {!data ? (
          <div className="p-6 text-sm text-muted-foreground">Loading students…</div>
        ) : (
          <div className="overflow-auto max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/60">
                  <TableHead className="text-xs uppercase tracking-wide">Student</TableHead>
                  {subjects.map((s) => (
                    <TableHead key={s.name} className="text-xs uppercase tracking-wide text-center">{s.name}<span className="block text-[10px] text-muted-foreground normal-case">/{s.max_marks}</span></TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.students.length === 0 && (
                  <TableRow><TableCell colSpan={subjects.length + 1} className="text-center text-sm text-muted-foreground py-8">No active students in this class/section.</TableCell></TableRow>
                )}
                {data.students.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{s.full_name}</div>
                      <div className="text-xs text-muted-foreground">{s.admission_number}{s.roll_number ? ` • Roll ${s.roll_number}` : ''}</div>
                    </TableCell>
                    {subjects.map((sub) => (
                      <TableCell key={sub.name} className="text-center">
                        <Input
                          data-testid={`marks-input-${s.id}-${sub.name.replace(/\s+/g, '-').toLowerCase()}`}
                          className="w-20 mx-auto text-center"
                          placeholder="AB"
                          value={grid[s.id]?.[sub.name] ?? ''}
                          onChange={(e) => setGrid({ ...grid, [s.id]: { ...grid[s.id], [sub.name]: e.target.value } })}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <DialogFooter>
          <div className="text-xs text-muted-foreground mr-auto self-center">Leave blank or type AB for absent.</div>
          <Button data-testid="marks-save-button" onClick={save} disabled={saving || !data}>{saving ? 'Saving…' : 'Save Marks'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExamResults({ examId, onClose }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/exams/${examId}/results`);
        setData(data);
      } catch (err) {
        toast.error(err.response?.data?.detail || 'Failed to load results');
        onClose();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  const subjects = data?.exam?.subjects || [];
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-5xl" data-testid="exam-results-dialog">
        <DialogHeader><DialogTitle>Results — {data?.exam?.name || 'Loading…'}</DialogTitle><DialogDescription className="sr-only">Ranked results table with per-student report card downloads</DialogDescription></DialogHeader>
        {!data ? (
          <div className="p-6 text-sm text-muted-foreground">Loading results…</div>
        ) : (
          <div className="overflow-auto max-h-[65vh]">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/60">
                  <TableHead className="text-xs uppercase tracking-wide">Rank</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide">Student</TableHead>
                  {subjects.map((s) => <TableHead key={s.name} className="text-xs uppercase tracking-wide text-center">{s.name}</TableHead>)}
                  <TableHead className="text-xs uppercase tracking-wide text-center">Total</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide text-center">%</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide text-center">Grade</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide text-right">Report Card</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.results.length === 0 && (
                  <TableRow><TableCell colSpan={subjects.length + 6} className="text-center text-sm text-muted-foreground py-8">No students found for this exam.</TableCell></TableRow>
                )}
                {data.results.map((r) => (
                  <TableRow key={r.student_id} data-testid={`result-row-${r.student_id}`}>
                    <TableCell>{r.rank ? <Badge variant="secondary">#{r.rank}</Badge> : '—'}</TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{r.full_name}</div>
                      <div className="text-xs text-muted-foreground">{r.admission_number}</div>
                    </TableCell>
                    {subjects.map((sub) => (
                      <TableCell key={sub.name} className="text-center">
                        {r.has_marks ? (r.marks[sub.name] === null || r.marks[sub.name] === undefined ? <span className="text-muted-foreground">AB</span> : r.marks[sub.name]) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                    ))}
                    <TableCell className="text-center font-medium">{r.has_marks ? `${r.total}/${r.max_total}` : '—'}</TableCell>
                    <TableCell className="text-center">{r.has_marks ? `${r.percentage}%` : '—'}</TableCell>
                    <TableCell className="text-center">{r.grade ? <Badge>{r.grade}</Badge> : '—'}</TableCell>
                    <TableCell className="text-right">
                      {r.has_marks && (
                        <Button size="sm" variant="ghost" data-testid={`report-card-pdf-${r.student_id}`}
                          onClick={() => downloadAsPdf(`/students/${r.student_id}/report-card.pdf?exam_id=${examId}`, `report_card_${r.admission_number || r.student_id}.pdf`)}>
                          <FileDown className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
