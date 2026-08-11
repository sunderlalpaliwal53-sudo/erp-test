import React, { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { api, money } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ChildSwitcher } from '@/components/ChildSwitcher';
import { Wallet, CalendarCheck, BookOpen, Megaphone } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useChild } from '@/contexts/ChildContext';
import { useNavigate } from 'react-router-dom';

export default function ParentHome() {
  const { user } = useAuth();
  const { activeChild, activeChildId, children, hasMultiple, loading: childLoading } = useChild();
  const nav = useNavigate();
  const [dues, setDues] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [homework, setHomework] = useState([]);
  const [circulars, setCirculars] = useState([]);

  useEffect(() => {
    if (!activeChildId) {
      setDues(null); setAttendance([]); setHomework([]); setCirculars([]);
      return;
    }
    (async () => {
      const [{ data: d }, { data: a }, { data: hw }, { data: c }] = await Promise.all([
        api.get(`/fees/student/${activeChildId}/dues`),
        api.get('/attendance', { params: { student_id: activeChildId } }),
        api.get('/homework'),
        api.get('/circulars'),
      ]);
      setDues(d); setAttendance(a); setHomework(hw.slice(0, 3)); setCirculars(c.slice(0, 3));
    })();
  }, [activeChildId]);

  const student = activeChild;
  const totalDiscount = dues?.total_discount || 0;
  const paidTotal = dues?.total_paid || 0;
  const balance = dues?.balance || 0;
  const nextDueDate = (dues?.dues || []).map((d) => d.due_date).filter(Boolean).sort()[0];
  const presentPct = attendance.length ? Math.round((attendance.filter((a) => a.status === 'present').length / attendance.length) * 100) : 0;

  return (
    <AppShell>
      <div className="login-band -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-6 mb-6 rounded-none">
        <div className="max-w-[1400px] mx-auto">
          {/* Child switcher row */}
          {children.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="text-sm">
                {hasMultiple ? (
                  <span className="text-muted-foreground">Viewing details for:</span>
                ) : (
                  <span className="text-muted-foreground">Your child:</span>
                )}
              </div>
              <ChildSwitcher />
            </div>
          )}
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-white shadow-sm">
              <AvatarImage src={student?.photo_url} />
              <AvatarFallback className="bg-[hsl(var(--primary))] text-white">{(student?.full_name || 'S').split(' ').map((x) => x[0]).slice(0, 2).join('')}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="h-font text-xl sm:text-2xl font-semibold">Hello, {user?.full_name?.split(' ')[0]}!</div>
              <div className="text-sm text-muted-foreground">
                {childLoading ? 'Loading your children…' :
                  student ? `Here's an overview for ${student.full_name}` :
                  'No children linked to your account yet. Please contact the school.'}
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs">
                {student?.admission_number && <Badge variant="secondary">{student.admission_number}</Badge>}
                {student?.gender && <Badge variant="secondary">{student.gender}</Badge>}
                {hasMultiple && <Badge variant="secondary" data-testid="parent-kids-badge">{children.length} children linked</Badge>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {!student && !childLoading && (
        <Card className="p-6 border-border text-center text-sm text-muted-foreground">
          Your parent account has no linked children. Please contact the school office to link your child(ren).
        </Card>
      )}

      {student && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="p-5 border-border bg-[#E7F0F7]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase text-[hsl(var(--primary))] font-medium tracking-wide">Balance Due</div>
                  <div className="h-font text-2xl font-semibold mt-1">{money(balance)}</div>
                  <div className="text-xs text-muted-foreground mt-1">Paid so far: {money(paidTotal)}{totalDiscount > 0 && ` • Discount: ${money(totalDiscount)}`}</div>
                  {nextDueDate && <div className="text-xs text-[#B45309] mt-1 font-medium">Next due: {nextDueDate}</div>}
                </div>
                <Wallet className="h-5 w-5 text-[hsl(var(--primary))]" />
              </div>
              <Button data-testid="parent-pay-fees-button" onClick={() => nav('/parent/pay')} className="mt-4 w-full h-11 gap-2">
                <Wallet className="h-4 w-4" /> Pay Fees
              </Button>
            </Card>
            <Card className="p-5 border-border bg-[#E6F6F4]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase text-[hsl(var(--accent))] font-medium tracking-wide">Attendance</div>
                  <div className="h-font text-2xl font-semibold mt-1">{presentPct}%</div>
                  <div className="text-xs text-muted-foreground mt-1">Last {attendance.length} school days</div>
                </div>
                <CalendarCheck className="h-5 w-5 text-[hsl(var(--accent))]" />
              </div>
              <Button variant="outline" onClick={() => nav('/parent/attendance')} className="mt-4 w-full h-11">View Details</Button>
            </Card>
            <Card className="p-5 border-border bg-[#FFF3E0]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase text-[#B45309] font-medium tracking-wide">Homework</div>
                  <div className="h-font text-2xl font-semibold mt-1">{homework.length}</div>
                  <div className="text-xs text-muted-foreground mt-1">Recent assignments</div>
                </div>
                <BookOpen className="h-5 w-5 text-[#B45309]" />
              </div>
              <Button variant="outline" onClick={() => nav('/parent/homework')} className="mt-4 w-full h-11">View Homework</Button>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card className="p-5 border-border" data-testid="parent-homework-card">
              <div className="flex items-center justify-between mb-3"><div className="font-semibold">Recent Homework</div><Button size="sm" variant="ghost" onClick={() => nav('/parent/homework')}>See all</Button></div>
              {homework.length === 0 && <div className="text-sm text-muted-foreground py-4">No homework yet.</div>}
              {homework.map((h) => (
                <div key={h.id} className="py-3 border-t border-border first:border-t-0">
                  <div className="text-xs uppercase text-muted-foreground">{h.subject}</div>
                  <div className="font-medium mt-0.5">{h.title}</div>
                  <div className="text-sm text-muted-foreground line-clamp-2">{h.description}</div>
                  <div className="text-xs text-muted-foreground mt-1">Due: {h.due_date || '—'}</div>
                </div>
              ))}
            </Card>
            <Card className="p-5 border-border">
              <div className="flex items-center justify-between mb-3"><div className="font-semibold">Latest Circulars</div><Button size="sm" variant="ghost" onClick={() => nav('/parent/circulars')}>See all</Button></div>
              {circulars.length === 0 && <div className="text-sm text-muted-foreground py-4">No circulars.</div>}
              {circulars.map((c) => (
                <div key={c.id} className="py-3 border-t border-border first:border-t-0">
                  <div className="flex items-center gap-2"><Megaphone className="h-3.5 w-3.5 text-muted-foreground" /><div className="font-medium">{c.title}</div></div>
                  <div className="text-sm text-muted-foreground line-clamp-2 mt-1">{c.body}</div>
                </div>
              ))}
            </Card>
          </div>
        </>
      )}
    </AppShell>
  );
}
