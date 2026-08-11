import React, { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { api, downloadAsPdf } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Award, FileDown } from 'lucide-react';
import { toast } from 'sonner';

export default function ParentResults() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: kids } = await api.get('/students');
        const all = await Promise.all(kids.map(async (k) => ({
          kid: k,
          card: (await api.get(`/students/${k.id}/report-card`)).data,
        })));
        setCards(all);
      } catch (err) {
        toast.error(err.response?.data?.detail || 'Failed to load results');
      } finally { setLoading(false); }
    })();
  }, []);

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="h-font text-2xl font-semibold">Exam Results</h1>
        <p className="text-sm text-muted-foreground">Published report cards for your children.</p>
      </div>
      {loading && <Card className="p-8 text-center text-sm text-muted-foreground">Loading results…</Card>}
      {!loading && cards.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground" data-testid="parent-results-empty">No children linked to this account.</Card>
      )}
      {cards.map(({ kid, card }) => {
        const published = (card.exams || []).filter((e) => e.exam.status === 'published' && e.marks_entered);
        return (
          <div key={kid.id} className="mb-8" data-testid={`parent-results-child-${kid.id}`}>
            <div className="flex items-center gap-2 mb-3">
              <Award className="h-5 w-5 text-[hsl(var(--primary))]" />
              <h2 className="font-semibold">{kid.full_name}</h2>
              <span className="text-xs text-muted-foreground">{kid.admission_number}</span>
            </div>
            {published.length === 0 && (
              <Card className="p-6 text-sm text-muted-foreground">No results published yet.</Card>
            )}
            {published.map((e) => (
              <Card key={e.exam.id} className="p-4 sm:p-5 border-border mb-4" data-testid={`report-card-${e.exam.id}`}>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div>
                    <div className="font-medium">{e.exam.name}</div>
                    <div className="text-xs text-muted-foreground">{e.exam.term} {e.exam.exam_date ? `• ${e.exam.exam_date}` : ''}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{e.percentage}%</Badge>
                    <Badge>{e.grade}</Badge>
                    <Button size="sm" variant="outline" data-testid={`parent-report-pdf-${e.exam.id}`}
                      onClick={() => downloadAsPdf(`/students/${kid.id}/report-card.pdf?exam_id=${e.exam.id}`, `report_card_${kid.admission_number || kid.id}.pdf`)}>
                      <FileDown className="h-3.5 w-3.5 mr-1" /> PDF
                    </Button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-secondary/60">
                        <TableHead className="text-xs uppercase tracking-wide">Subject</TableHead>
                        <TableHead className="text-xs uppercase tracking-wide text-center">Max</TableHead>
                        <TableHead className="text-xs uppercase tracking-wide text-center">Marks</TableHead>
                        <TableHead className="text-xs uppercase tracking-wide text-center">Grade</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {e.rows.map((r) => (
                        <TableRow key={r.subject}>
                          <TableCell>{r.subject}</TableCell>
                          <TableCell className="text-center">{r.max_marks}</TableCell>
                          <TableCell className="text-center">{r.marks === null || r.marks === undefined ? 'AB' : r.marks}</TableCell>
                          <TableCell className="text-center">{r.grade}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-secondary/40 font-medium">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-center">{e.max_total}</TableCell>
                        <TableCell className="text-center">{e.total}</TableCell>
                        <TableCell className="text-center">{e.grade}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </Card>
            ))}
          </div>
        );
      })}
    </AppShell>
  );
}
