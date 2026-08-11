import React, { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useSchool } from '@/contexts/SchoolContext';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export default function TimetablePage() {
  const { activeSchoolId } = useSchool();
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');
  const [section, setSection] = useState('A');
  const [timetable, setTimetable] = useState(null);
  const load = useCallback(async () => {
    if (!activeSchoolId) return;
    const { data } = await api.get('/classes'); setClasses(data);
    setClassId((prev) => prev || (data[0]?.id ?? ''));
  }, [activeSchoolId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!classId) return;
    (async () => {
      const { data } = await api.get('/timetable', { params: { class_id: classId, section } });
      setTimetable(data[0] || null);
    })();
  }, [classId, section]);

  const slotsByDayPeriod = {};
  (timetable?.slots || []).forEach((s) => {
    slotsByDayPeriod[`${s.day}_${s.period}`] = s;
  });
  const periods = [1, 2, 3, 4, 5, 6];

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="h-font text-2xl font-semibold">Timetable</h1>
        <p className="text-sm text-muted-foreground">Class-wise weekly schedule.</p>
      </div>
      <Card className="p-4 border-border mb-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div><Label className="text-xs">Class</Label>
            <Select value={classId} onValueChange={setClassId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div><Label className="text-xs">Section</Label>
            <Select value={section} onValueChange={setSection}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="A">A</SelectItem><SelectItem value="B">B</SelectItem></SelectContent></Select>
          </div>
        </div>
      </Card>
      <Card className="p-0 border-border overflow-x-auto">
        {!timetable && <div className="p-8 text-center text-sm text-muted-foreground">No timetable set for this class.</div>}
        {timetable && (
          <table className="min-w-full">
            <thead>
              <tr className="bg-secondary/60"><th className="px-3 py-2 text-xs text-left uppercase tracking-wide">Day</th>{periods.map((p) => <th key={p} className="px-3 py-2 text-xs uppercase tracking-wide">Period {p}</th>)}</tr>
            </thead>
            <tbody>
              {DAYS.map((d) => (
                <tr key={d} className="border-t border-border">
                  <td className="px-3 py-3 text-sm font-medium">{d}</td>
                  {periods.map((p) => {
                    const s = slotsByDayPeriod[`${d}_${p}`];
                    return (
                      <td key={p} className="px-3 py-3">
                        {s ? (
                          <div>
                            <div className="text-sm font-medium">{s.subject}</div>
                            <div className="text-xs text-muted-foreground">{s.start_time}–{s.end_time}</div>
                            {s.teacher_name && <div className="text-xs text-muted-foreground">{s.teacher_name}</div>}
                          </div>
                        ) : <div className="text-xs text-muted-foreground">—</div>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </AppShell>
  );
}
