import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { api, money } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, Wallet, Receipt as ReceiptIcon, Pencil, Plus, Trash2,
  CalendarDays, CheckCircle2, AlertCircle, Clock, CircleDashed,
  Ban, History, RotateCcw,
} from 'lucide-react';
import { EditStudentDialog } from '@/components/EditStudentDialog';
import { AssignFeeDialog } from '@/components/AssignFeeDialog';
import { planDiscountBreakdown } from '@/lib/feeCalc';
import EditReceiptDialog from '@/components/EditReceiptDialog';
import VoidReceiptDialog from '@/components/VoidReceiptDialog';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function StudentDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [student, setStudent] = useState(null);
  const [dues, setDues] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [payments, setPayments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [feePlans, setFeePlans] = useState([]);
  const [feeHeads, setFeeHeads] = useState([]);
  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [editingReceipt, setEditingReceipt] = useState(null);
  const [voidingReceipt, setVoidingReceipt] = useState(null);

  const canEdit = ['super_admin', 'school_admin'].includes(user?.role);

  const load = useCallback(async () => {
    const { data: s } = await api.get(`/students/${id}`);
    setStudent(s);
    const [{ data: d }, { data: a }, { data: p }, { data: c }, { data: fp }, { data: fh }, sched] = await Promise.all([
      api.get(`/fees/student/${id}/dues`),
      api.get('/attendance', { params: { student_id: id } }),
      api.get('/payments', { params: { student_id: id } }),
      api.get('/classes'),
      api.get('/fees/plans'),
      api.get('/fees/heads'),
      api.get(`/fees/student/${id}/fee-schedule`).catch(() => ({ data: null })),
    ]);
    setDues(d); setAttendance(a); setPayments(p); setClasses(c); setFeePlans(fp); setFeeHeads(fh);
    setSchedule(sched.data || null);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (!student) return <AppShell><div className="text-sm text-muted-foreground">Loading…</div></AppShell>;

  const deleteAssignment = async (aid) => {
    if (!window.confirm('Remove this fee assignment?')) return;
    await api.delete(`/fees/assignments/${aid}`);
    toast.success('Assignment removed');
    load();
  };

  const openAssign = (assignment = null) => { setEditingAssignment(assignment); setAssignOpen(true); };

  const classMap = Object.fromEntries(classes.map((c) => [c.id, c.name]));

  return (
    <AppShell>
      <button onClick={() => nav(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <Card className="p-6 border-border mb-4">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={student.photo_url} />
              <AvatarFallback className="bg-secondary">{(student.full_name || 'S').split(' ').map((x) => x[0]).slice(0, 2).join('')}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="h-font text-2xl font-semibold">{student.full_name}</h1>
              <div className="flex items-center flex-wrap gap-2 mt-1">
                <Badge variant="secondary">{student.admission_number}</Badge>
                <Badge variant="secondary">{student.gender}</Badge>
                {student.category && <Badge variant="secondary">{student.category}</Badge>}
                {student.blood_group && <Badge variant="secondary">Blood: {student.blood_group}</Badge>}
                <Badge variant="secondary">{classMap[student.class_id] || '-'} {student.section && `• ${student.section}`}</Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                DOB: {student.dob || '—'} • Admitted: {student.admission_date || '—'}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <Button variant="outline" onClick={() => setEditOpen(true)} className="gap-2" data-testid="student-edit-button">
                <Pencil className="h-4 w-4" /> Edit Details
              </Button>
            )}
            {canEdit && (
              <Button variant="outline" onClick={() => openAssign(null)} className="gap-2" data-testid="student-assign-fee-button">
                <Plus className="h-4 w-4" /> Assign Fee
              </Button>
            )}
            {['super_admin', 'school_admin', 'accountant'].includes(user?.role) && (
              <Button onClick={() => nav(`/fees/collect?student=${student.id}`)} className="gap-2" data-testid="student-collect-fee">
                <Wallet className="h-4 w-4" /> Collect Fee
              </Button>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
        <Card className="p-4 border-border"><div className="text-xs uppercase text-muted-foreground">Total Expected</div><div className="h-font text-xl font-semibold tabular-nums">{money(dues?.total_expected || 0)}</div></Card>
        <Card className="p-4 border-border bg-[#E6F6F4]"><div className="text-xs uppercase text-[#0F766E]">Total Paid</div><div className="h-font text-xl font-semibold tabular-nums">{money(dues?.total_paid || 0)}</div></Card>
        <Card className="p-4 border-border bg-[#FFF3E0]"><div className="text-xs uppercase text-[#B45309]">Discount</div><div className="h-font text-xl font-semibold tabular-nums">{money(dues?.total_discount || 0)}</div></Card>
        <Card
          className={`p-4 border-2 ${((dues?.due_till_date || 0) > 0) ? 'border-[#F59E0B] bg-[#FFFBEB]' : 'border-[#0F766E] bg-[#ECFDF5]'}`}
          data-testid="student-due-till-date-card"
        >
          <div className={`text-xs uppercase font-semibold ${((dues?.due_till_date || 0) > 0) ? 'text-[#B45309]' : 'text-[#0F766E]'}`}>
            Amount Due Till Date
          </div>
          <div className="h-font text-xl font-semibold tabular-nums" data-testid="student-due-till-date-value">
            {money(dues?.due_till_date || 0)}
          </div>
          <div className="text-[10px] mt-1 text-muted-foreground leading-tight">
            {dues?.months_elapsed
              ? `${dues.months_elapsed}/${dues.months_total || 12} months elapsed · ${money(dues?.monthly_amount || 0)}/mo`
              : 'as of today'}
          </div>
        </Card>
        <Card className="p-4 border-border bg-[#FEE4E2]"><div className="text-xs uppercase text-[#B42318]">Balance Due (Annual)</div><div className="h-font text-xl font-semibold tabular-nums">{money(dues?.balance || 0)}</div></Card>
      </div>

      <Tabs defaultValue="info" data-testid="student-profile-tabs">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="info">Information</TabsTrigger>
          <TabsTrigger value="fees" data-testid="student-profile-fees-tab">Fee Assignments</TabsTrigger>
          <TabsTrigger value="monthly" data-testid="student-profile-monthly-tab" className="gap-1">
            <CalendarDays className="h-3.5 w-3.5" /> Monthly Fees
          </TabsTrigger>
          <TabsTrigger value="attendance" data-testid="student-profile-attendance-tab">Attendance</TabsTrigger>
          <TabsTrigger value="payments">Payment History</TabsTrigger>
        </TabsList>
        <TabsContent value="info">
          <Card className="p-6 border-border grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {[
              ['Father', student.father_name], ['Mother', student.mother_name], ['Guardian', student.guardian_name],
              ['Phone', student.phone], ['Email', student.email], ['Address', student.address],
              ['Religion', student.religion], ['Transport', student.transport_route],
              ['Previous School', student.previous_school], ['Medical', student.medical_info],
              ['Scholarship', student.scholarship], ['Fee Category', student.fee_category],
              ['Remarks', student.remarks],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="text-xs uppercase text-muted-foreground tracking-wide">{k}</div>
                <div className="mt-0.5">{v || '—'}</div>
              </div>
            ))}
          </Card>
        </TabsContent>
        <TabsContent value="fees">
          <Card className="p-6 border-border">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-medium">{dues?.assignments?.length || 0} fee assignments</div>
              {canEdit && <Button onClick={() => openAssign(null)} className="gap-2" size="sm"><Plus className="h-3.5 w-3.5" /> New Assignment</Button>}
            </div>
            <div className="space-y-3">
              {(dues?.assignments || []).length === 0 && (
                <div className="text-sm text-muted-foreground py-6 text-center">No fee assignments yet. Click "New Assignment" to add.</div>
              )}
              {(dues?.assignments || []).map((a) => {
                const plan = feePlans.find((p) => p.id === a.fee_plan_id);
                const items = a.custom_items?.length ? a.custom_items : (plan?.items || []);
                const gross = items.reduce((s, it) => s + (it.amount || 0), 0);
                const bd = (plan && !a.custom_items?.length) ? planDiscountBreakdown(plan) : null;
                const structureDisc = bd ? bd.totalDisc : 0;
                const concession = a.discount_amount > 0
                  ? a.discount_amount
                  : (a.discount_percent > 0 ? Math.round((gross - structureDisc) * a.discount_percent / 100) : 0);
                const net = Math.max(gross - structureDisc - concession, 0);
                const hasDisc = structureDisc > 0 || concession > 0;
                return (
                  <Card key={a.id} className="p-4 border-border" data-testid={`fee-assignment-${a.id}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{plan ? plan.name : 'Custom Assignment'}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {items.length} items • Session {a.academic_session}
                          {a.due_date && ` • Due: ${a.due_date}`}
                        </div>
                        {a.remarks && <div className="text-xs text-muted-foreground mt-1">{a.remarks}</div>}
                      </div>
                      <div className="text-right">
                        {hasDisc && <div className="text-xs text-muted-foreground line-through tabular-nums">{money(gross)}</div>}
                        <div className="tabular-nums font-semibold text-base" data-testid={`fee-assignment-net-${a.id}`}>{money(net)}</div>
                        {canEdit && (
                          <div className="flex gap-1 mt-2 justify-end">
                            <Button size="sm" variant="ghost" onClick={() => openAssign(a)}><Pencil className="h-3 w-3" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => deleteAssignment(a.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 border-t border-border pt-2 space-y-1">
                      {items.slice(0, 6).map((it, i) => (
                        <div key={`${it.fee_head_id || it.fee_head_name}-${i}`} className="flex items-center justify-between text-xs">
                          <span>{it.fee_head_name} <span className="text-muted-foreground">({it.frequency})</span></span>
                          <span className="tabular-nums">{money(it.amount)}</span>
                        </div>
                      ))}
                    </div>
                    {hasDisc && (
                      <div className="mt-2 border-t border-border pt-2 space-y-1" data-testid={`fee-assignment-discounts-${a.id}`}>
                        <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">Gross Annual</span><span className="tabular-nums">{money(gross)}</span></div>
                        {bd?.planDisc > 0 && <div className="flex items-center justify-between text-xs text-emerald-700"><span>Plan Discount</span><span className="tabular-nums">- {money(bd.planDisc)}</span></div>}
                        {bd?.yearlyDisc > 0 && <div className="flex items-center justify-between text-xs text-emerald-700"><span>Yearly Discount</span><span className="tabular-nums">- {money(bd.yearlyDisc)}</span></div>}
                        {bd?.monthDisc > 0 && <div className="flex items-center justify-between text-xs text-emerald-700"><span>Monthly Discounts</span><span className="tabular-nums">- {money(bd.monthDisc)}</span></div>}
                        {concession > 0 && <div className="flex items-center justify-between text-xs text-emerald-700"><span>Concession{a.discount_reason ? ` (${a.discount_reason})` : ''}</span><span className="tabular-nums">- {money(concession)}</span></div>}
                        <div className="flex items-center justify-between text-xs font-semibold border-t border-border pt-1"><span>Net Payable</span><span className="tabular-nums">{money(net)}</span></div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="monthly">
          <MonthlyFeesTab schedule={schedule} />
        </TabsContent>
        <TabsContent value="attendance">
          <Card className="p-6 border-border">
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[['Present', attendance.filter((a) => a.status === 'present').length, 'bg-[#E6F6F4] text-[#0F766E]'],
                ['Absent', attendance.filter((a) => a.status === 'absent').length, 'bg-[#FEE4E2] text-[#B42318]'],
                ['Leave', attendance.filter((a) => a.status === 'leave').length, 'bg-[#FFF3E0] text-[#B45309]']].map(([label, val, cls]) => (
                <div key={label} className={`p-4 rounded-md ${cls}`}>
                  <div className="text-xs">{label}</div>
                  <div className="h-font text-xl font-semibold">{val}</div>
                </div>
              ))}
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead>Remarks</TableHead></TableRow></TableHeader>
              <TableBody>
                {attendance.slice(0, 20).map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.date}</TableCell>
                    <TableCell><Badge className={a.status === 'present' ? 'bg-[#E6F6F4] text-[#0F766E] border border-[#BFEAE6]' : a.status === 'absent' ? 'bg-[#FEE4E2] text-[#B42318] border border-[#FECACA]' : 'bg-[#FFF3E0] text-[#B45309] border border-[#FFD7A8]'}>{a.status}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{a.remarks || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
        <TabsContent value="payments">
          <Card className="p-4 sm:p-6 border-border">
            <Table>
              <TableHeader><TableRow><TableHead>Receipt</TableHead><TableHead>Date</TableHead><TableHead className="hidden sm:table-cell">Mode</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {payments.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">No payments yet.</TableCell></TableRow>
                )}
                {payments.map((p) => {
                  const isVoided = (p.status || 'success') === 'voided';
                  return (
                    <TableRow key={p.id} className={isVoided ? 'opacity-70' : ''}>
                      <TableCell className={`font-mono text-xs ${isVoided ? 'line-through' : ''}`}>{p.receipt_number}</TableCell>
                      <TableCell>{(p.paid_at || '').slice(0, 10)}</TableCell>
                      <TableCell className="hidden sm:table-cell capitalize">{String(p.payment_mode).replace('_', ' ')}</TableCell>
                      <TableCell>
                        {isVoided ? (
                          <Badge className="bg-[#FEE4E2] text-[#B42318] border border-[#FECACA] gap-1"><Ban className="h-3 w-3" /> VOIDED</Badge>
                        ) : p.edited_at ? (
                          <Badge className="bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] gap-1"><History className="h-3 w-3" /> Revised</Badge>
                        ) : (
                          <Badge className="bg-[#E6F6F4] text-[#0F766E] border border-[#BFEAE6]">Success</Badge>
                        )}
                      </TableCell>
                      <TableCell className={`text-right font-semibold tabular-nums ${isVoided ? 'line-through text-muted-foreground' : ''}`}>{money(p.total_paid)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1 flex-wrap">
                          <Button size="sm" variant="outline" onClick={async () => {
                            const resp = await api.get(`/payments/${p.id}/receipt.pdf`, { responseType: 'blob' });
                            const url = window.URL.createObjectURL(new Blob([resp.data], { type: 'application/pdf' }));
                            window.open(url, '_blank');
                            setTimeout(() => window.URL.revokeObjectURL(url), 60000);
                          }} className="h-8 gap-1"><ReceiptIcon className="h-3.5 w-3.5" /> PDF</Button>
                          {user?.role === 'super_admin' && !isVoided && (
                            <>
                              <Button data-testid={`sd-receipt-edit-${p.id}`} size="sm" variant="outline" onClick={() => setEditingReceipt(p)} className="h-8 gap-1"><Pencil className="h-3.5 w-3.5" /><span className="hidden sm:inline">Edit</span></Button>
                              <Button data-testid={`sd-receipt-void-${p.id}`} size="sm" variant="outline" onClick={() => setVoidingReceipt(p)} className="h-8 gap-1 text-destructive hover:text-destructive hover:bg-destructive/5"><Ban className="h-3.5 w-3.5" /><span className="hidden sm:inline">Void</span></Button>
                            </>
                          )}
                          {user?.role === 'super_admin' && isVoided && (
                            <Button data-testid={`sd-receipt-restore-${p.id}`} size="sm" variant="outline" onClick={async () => {
                              if (!window.confirm(`Restore voided receipt ${p.receipt_number}?`)) return;
                              try {
                                await api.post(`/payments/${p.id}/restore`);
                                toast.success('Receipt restored');
                                load();
                              } catch (e) { toast.error(e.response?.data?.detail || 'Failed to restore'); }
                            }} className="h-8 gap-1"><RotateCcw className="h-3.5 w-3.5" /><span className="hidden sm:inline">Restore</span></Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <EditStudentDialog open={editOpen} onOpenChange={setEditOpen} student={student} classes={classes} onSaved={load} />
      <AssignFeeDialog open={assignOpen} onOpenChange={setAssignOpen} student={student} feePlans={feePlans} feeHeads={feeHeads} classes={classes} existingAssignment={editingAssignment} onSaved={load} />
      <EditReceiptDialog open={!!editingReceipt} onOpenChange={(v) => !v && setEditingReceipt(null)}
                         payment={editingReceipt} onSaved={() => { setEditingReceipt(null); load(); }} />
      <VoidReceiptDialog open={!!voidingReceipt} onOpenChange={(v) => !v && setVoidingReceipt(null)}
                         payment={voidingReceipt} onVoided={() => { setVoidingReceipt(null); load(); }} />
    </AppShell>
  );
}

// -------- Monthly Fees --------
function MonthlyFeesTab({ schedule }) {
  if (!schedule) {
    return (
      <Card className="p-6 border-border">
        <div className="text-sm text-muted-foreground">Loading monthly summary…</div>
      </Card>
    );
  }
  const months = schedule.schedule || [];
  const paidCount = months.filter((m) => m.status === 'paid').length;
  const overdueCount = months.filter((m) => m.status === 'overdue').length;
  const partialCount = months.filter((m) => m.status === 'partial').length;
  const pendingCount = months.filter((m) => m.status === 'pending').length;
  const activeMonths = schedule.active_months || months.filter((m) => m.status !== 'no_fee').length;

  return (
    <Card className="p-4 md:p-6 border-border">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
        <div>
          <h3 className="h-font text-lg font-semibold">Monthly Fee Summary</h3>
          <div className="text-xs text-muted-foreground">
            Session {schedule.academic_session} • Monthly ₹{schedule.monthly_amount?.toLocaleString('en-IN')} • {activeMonths} collection months (as per fee assignment)
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <LegendChip icon={<CheckCircle2 className="h-3 w-3" />} label={`Paid (${paidCount})`} cls="bg-[#E6F6F4] text-[#0F766E] border-[#BFEAE6]" />
          <LegendChip icon={<Clock className="h-3 w-3" />} label={`Partial (${partialCount})`} cls="bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]" />
          <LegendChip icon={<AlertCircle className="h-3 w-3" />} label={`Overdue (${overdueCount})`} cls="bg-[#FEE4E2] text-[#B42318] border-[#FECACA]" />
          <LegendChip icon={<CircleDashed className="h-3 w-3" />} label={`Upcoming (${pendingCount})`} cls="bg-muted text-muted-foreground border-border" />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-3">
        {months.map((m) => <MonthCard key={m.index} m={m} />)}
      </div>

      <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <MiniStat label="Annual Fee" value={`₹${(schedule.annual_total || 0).toLocaleString('en-IN')}`} />
        <MiniStat label="Concession" value={`₹${(schedule.concession || 0).toLocaleString('en-IN')}`} tone="amber" />
        <MiniStat label="Total Paid" value={`₹${(schedule.total_paid || 0).toLocaleString('en-IN')}`} tone="emerald" />
        <MiniStat label="Balance" value={`₹${(schedule.remaining_balance || 0).toLocaleString('en-IN')}`} tone={schedule.remaining_balance > 0 ? 'red' : 'emerald'} />
      </div>
    </Card>
  );
}

function MonthCard({ m }) {
  const status = m.status; // paid | partial | overdue | pending
  const due = Math.max((m.amount || 0) - (m.paid_amount || 0), 0);
  const cfg = {
    paid:    { icon: <CheckCircle2 className="h-4 w-4" />, cls: 'bg-[#E6F6F4] border-[#BFEAE6] text-[#0F766E]', tag: 'Paid' },
    partial: { icon: <Clock className="h-4 w-4" />,        cls: 'bg-[#FEF3C7] border-[#FDE68A] text-[#92400E]', tag: 'Partial' },
    overdue: { icon: <AlertCircle className="h-4 w-4" />,  cls: 'bg-[#FEE4E2] border-[#FECACA] text-[#B42318]', tag: 'Overdue' },
    pending: { icon: <CircleDashed className="h-4 w-4" />, cls: 'bg-muted/40 border-border text-muted-foreground', tag: 'Upcoming' },
    no_fee:  { icon: <Ban className="h-4 w-4" />,          cls: 'bg-slate-50 border-dashed border-slate-200 text-slate-400', tag: 'No Fee' },
  }[status] || { icon: null, cls: 'bg-muted border-border text-muted-foreground', tag: status };
  // Compact month label — "Apr 2026"
  const short = (m.label || '').split(' ');
  const shortLabel = short.length === 2 ? `${short[0].slice(0, 3)} ${short[1]}` : m.label;
  return (
    <div className={`rounded-lg border p-3 ${cfg.cls}`} data-testid={`sd-month-${m.index}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold">{shortLabel}</div>
        <span className="opacity-90">{cfg.icon}</span>
      </div>
      <div className="mt-1 text-[11px] uppercase tracking-wide opacity-80">{cfg.tag}</div>
      <div className="mt-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="opacity-70">Fee</span>
          <span className="tabular-nums">₹{(m.amount || 0).toLocaleString('en-IN')}</span>
        </div>
        {status !== 'pending' && status !== 'no_fee' && (
          <div className="flex items-center justify-between">
            <span className="opacity-70">Paid</span>
            <span className="tabular-nums">₹{(m.paid_amount || 0).toLocaleString('en-IN')}</span>
          </div>
        )}
        {due > 0 && status !== 'pending' && status !== 'no_fee' && (
          <div className="flex items-center justify-between font-medium">
            <span className="opacity-80">Due</span>
            <span className="tabular-nums">₹{due.toLocaleString('en-IN')}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function LegendChip({ icon, label, cls }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${cls}`}>
      {icon}{label}
    </span>
  );
}

function MiniStat({ label, value, tone }) {
  const toneCls = tone === 'emerald' ? 'text-[#0F766E]'
    : tone === 'amber' ? 'text-[#B45309]'
    : tone === 'red' ? 'text-[#B42318]' : '';
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-[11px] uppercase text-muted-foreground tracking-wide">{label}</div>
      <div className={`mt-0.5 h-font text-lg font-semibold tabular-nums ${toneCls}`}>{value}</div>
    </div>
  );
}
