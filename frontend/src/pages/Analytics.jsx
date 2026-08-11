import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { api, money, shortMoney } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useSchool } from '@/contexts/SchoolContext';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts';
import {
  Calendar, IndianRupee, AlertCircle, Wallet, Users, CalendarCheck,
  TrendingDown, Search, FileText, Download, User, CheckCircle2, Clock,
  Receipt, ChevronLeft, ChevronRight, X,
} from 'lucide-react';
import { toast } from 'sonner';

const MODE_COLORS = { cash: '#0F766E', upi: '#1D4ED8', card: '#7C3AED', cheque: '#B45309', bank_transfer: '#0891B2', razorpay: '#DC2626' };

function fmtDate(d) { return d.toISOString().slice(0, 10); }

function computePreset(preset) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  const sessionStart = new Date(today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1, 3, 1); // Apr 1
  const sessionEnd = new Date(sessionStart.getFullYear() + 1, 2, 31); // Mar 31 next year
  switch (preset) {
    case 'today': return [fmtDate(today), fmtDate(today)];
    case 'yesterday': return [fmtDate(yesterday), fmtDate(yesterday)];
    case 'last_7': { const s = new Date(today); s.setDate(today.getDate() - 6); return [fmtDate(s), fmtDate(today)]; }
    case 'last_30': { const s = new Date(today); s.setDate(today.getDate() - 29); return [fmtDate(s), fmtDate(today)]; }
    case 'this_month': return [fmtDate(monthStart), fmtDate(monthEnd)];
    case 'last_month': return [fmtDate(lastMonthStart), fmtDate(lastMonthEnd)];
    case 'session': return [fmtDate(sessionStart), fmtDate(sessionEnd)];
    default: return [null, null];
  }
}

const PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last_7', label: 'Last 7 Days' },
  { id: 'last_30', label: 'Last 30 Days' },
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'session', label: 'Current Session' },
  { id: 'custom', label: 'Custom' },
];

export default function AnalyticsPage() {
  const { activeSchoolId, activeSchool } = useSchool();
  const [preset, setPreset] = useState('last_30');
  const [startDate, setStartDate] = useState(computePreset('last_30')[0]);
  const [endDate, setEndDate] = useState(computePreset('last_30')[1]);
  const [classes, setClasses] = useState([]);
  const [classFilter, setClassFilter] = useState('all');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [modeFilter, setModeFilter] = useState('all');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Student search
  const [students, setStudents] = useState([]);
  const [query, setQuery] = useState('');
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [feeReport, setFeeReport] = useState(null);

  // Transactions table state (in-range)
  const [txnQuery, setTxnQuery] = useState('');
  const [txnPage, setTxnPage] = useState(1);
  const [txnPageSize, setTxnPageSize] = useState(25);
  const [txnModeFilter, setTxnModeFilter] = useState('all');

  const applyPreset = (id) => {
    setPreset(id);
    if (id === 'custom') return;
    const [s, e] = computePreset(id);
    setStartDate(s); setEndDate(e);
  };

  const loadClasses = useCallback(async () => {
    if (!activeSchoolId) return;
    const { data: c } = await api.get('/classes');
    setClasses(c);
  }, [activeSchoolId]);

  const loadData = useCallback(async () => {
    if (!activeSchoolId || !startDate || !endDate) return;
    setLoading(true);
    try {
      const params = { start_date: startDate, end_date: endDate };
      if (classFilter !== 'all') params.class_id = classFilter;
      if (sectionFilter !== 'all') params.section = sectionFilter;
      if (modeFilter !== 'all') params.payment_mode = modeFilter;
      const { data: d } = await api.get('/analytics/fees', { params });
      setData(d);
    } finally { setLoading(false); }
  }, [activeSchoolId, startDate, endDate, classFilter, sectionFilter, modeFilter]);

  const loadStudents = useCallback(async () => {
    if (!activeSchoolId) return;
    const { data: s } = await api.get('/students', { params: { limit: 1000 } });
    setStudents(s);
  }, [activeSchoolId]);

  useEffect(() => { loadClasses(); loadStudents(); }, [loadClasses, loadStudents]);
  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    const h = () => { loadClasses(); loadStudents(); loadData(); setSelectedStudentId(null); setFeeReport(null); };
    window.addEventListener('stv:school-changed', h);
    return () => window.removeEventListener('stv:school-changed', h);
  }, [loadClasses, loadStudents, loadData]);

  useEffect(() => {
    if (!selectedStudentId) { setFeeReport(null); return; }
    (async () => {
      const { data: fr } = await api.get(`/analytics/student/${selectedStudentId}/fee-report`);
      setFeeReport(fr);
    })();
  }, [selectedStudentId]);

  const filteredStudents = useMemo(() => {
    if (!query || query.length < 1) return students.slice(0, 30);
    const q = query.toLowerCase();
    return students.filter((s) =>
      (s.full_name || '').toLowerCase().includes(q) ||
      (s.admission_number || '').toLowerCase().includes(q) ||
      (s.phone || '').toLowerCase().includes(q) ||
      (s.father_name || '').toLowerCase().includes(q)
    ).slice(0, 50);
  }, [students, query]);

  const modeData = data ? Object.entries(data.by_mode).map(([name, v]) => ({ name: name.replace('_', ' '), value: v.amount, count: v.count })) : [];

  // Transactions filtered & paginated
  const allTxns = data?.transactions || [];
  const filteredTxns = useMemo(() => {
    let list = allTxns;
    if (txnModeFilter !== 'all') list = list.filter((t) => t.payment_mode === txnModeFilter);
    if (txnQuery.trim()) {
      const q = txnQuery.trim().toLowerCase();
      list = list.filter((t) =>
        (t.receipt_number || '').toLowerCase().includes(q) ||
        (t.student_name || '').toLowerCase().includes(q) ||
        (t.admission_number || '').toLowerCase().includes(q) ||
        (t.father_name || '').toLowerCase().includes(q) ||
        (t.phone || '').toLowerCase().includes(q) ||
        (t.class_name || '').toLowerCase().includes(q) ||
        (t.txn_ref || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [allTxns, txnQuery, txnModeFilter]);
  const txnTotalPages = Math.max(1, Math.ceil(filteredTxns.length / txnPageSize));
  const currentTxnPage = Math.min(txnPage, txnTotalPages);
  const pagedTxns = filteredTxns.slice((currentTxnPage - 1) * txnPageSize, currentTxnPage * txnPageSize);
  const txnRangeAmount = filteredTxns.reduce((sum, t) => sum + (t.total_paid || 0), 0);

  useEffect(() => { setTxnPage(1); }, [txnQuery, txnModeFilter, txnPageSize, startDate, endDate, classFilter, sectionFilter, modeFilter]);

  const dlTxnsCsv = () => {
    if (!filteredTxns.length) { toast.error('No transactions to export'); return; }
    const rows = [[
      'Receipt No', 'Date', 'Time', 'Admission No', 'Student Name', 'Class', 'Section',
      'Father Name', 'Phone', 'Fee Heads', 'Subtotal', 'Discount', 'Late Fee', 'Amount Paid',
      'Payment Mode', 'Txn Ref', 'Status', 'Collected By', 'Remarks',
    ]];
    filteredTxns.forEach((t) => {
      const dt = t.paid_at || '';
      rows.push([
        t.receipt_number, dt.slice(0, 10), dt.slice(11, 19), t.admission_number, t.student_name,
        t.class_name, t.section, t.father_name, t.phone, t.fee_heads, t.subtotal, t.discount,
        t.late_fee, t.total_paid, t.payment_mode, t.txn_ref, t.status, t.collected_by_name, t.remarks,
      ]);
    });
    const escape = (v) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = rows.map((r) => r.map(escape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `transactions_${startDate}_to_${endDate}.csv`; a.click(); a.remove();
  };

  const dlReport = async (fmt) => {
    if (!feeReport) { toast.error('Select a student first'); return; }
    if (fmt === 'pdf') {
      const resp = await api.get(`/analytics/student/${selectedStudentId}/fee-report.pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([resp.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
    } else {
      // CSV of payment history
      const rows = [['Receipt No', 'Date', 'Mode', 'Late Fee', 'Discount', 'Amount']];
      feeReport.payments.forEach((p) => rows.push([p.receipt_number, (p.paid_at || '').slice(0, 10), p.payment_mode, p.late_fee, p.discount, p.total_paid]));
      const csv = rows.map((r) => r.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `fee_report_${feeReport.student.admission_number}.csv`; a.click(); a.remove();
    }
  };

  const dlCollectionReport = async (fmt) => {
    const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
    if (modeFilter !== 'all') params.set('mode', modeFilter);
    const resp = await api.get(`/reports/collection.${fmt}?${params.toString()}`, { responseType: 'blob' });
    const mime = fmt === 'pdf' ? 'application/pdf' : fmt === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const blob = new Blob([resp.data], { type: mime });
    const url = window.URL.createObjectURL(blob);
    if (fmt === 'pdf') window.open(url, '_blank');
    else { const a = document.createElement('a'); a.href = url; a.download = `fee_collection.${fmt}`; a.click(); a.remove(); }
  };

  const kpis = data?.kpis;

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="h-font text-2xl font-semibold">Fees Analytics</h1>
        <p className="text-sm text-muted-foreground">Complete fee-management insights for {activeSchool?.name || 'your school'}</p>
      </div>

      {/* Sticky Filter Bar */}
      <Card className="p-4 border-border mb-4 sticky top-14 z-30 bg-card shadow-sm" data-testid="analytics-filter-bar">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
          <div className="grid gap-1.5 md:col-span-2">
            <Label className="text-xs">Date Range</Label>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button key={p.id} onClick={() => applyPreset(p.id)} data-testid={`preset-${p.id}`}
                  className={`px-2.5 py-1.5 text-xs rounded-md border transition-colors ${preset === p.id ? 'bg-[hsl(var(--primary))] text-white border-[hsl(var(--primary))]' : 'border-border hover:bg-secondary'}`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Start Date</Label>
            <Input type="date" value={startDate || ''} onChange={(e) => { setStartDate(e.target.value); setPreset('custom'); }} data-testid="analytics-start-date" />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">End Date</Label>
            <Input type="date" value={endDate || ''} onChange={(e) => { setEndDate(e.target.value); setPreset('custom'); }} data-testid="analytics-end-date" />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Class</Label>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger data-testid="analytics-class-filter"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Classes</SelectItem>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Payment Mode</Label>
            <Select value={modeFilter} onValueChange={setModeFilter}>
              <SelectTrigger data-testid="analytics-mode-filter"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Modes</SelectItem>{['cash', 'upi', 'card', 'cheque', 'bank_transfer', 'razorpay'].map((m) => <SelectItem key={m} value={m}>{m.replace('_', ' ')}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-border">
          <div className="text-xs text-muted-foreground">Showing data for <b>{startDate}</b> to <b>{endDate}</b>{classFilter !== 'all' && ' · filtered by class'}{modeFilter !== 'all' && ` · ${modeFilter.replace('_', ' ')} only`}</div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => dlCollectionReport('pdf')} className="gap-1" data-testid="download-pdf"><FileText className="h-3.5 w-3.5" /> PDF</Button>
            <Button variant="outline" size="sm" onClick={() => dlCollectionReport('xlsx')} className="gap-1" data-testid="download-xlsx"><Download className="h-3.5 w-3.5" /> Excel</Button>
            <Button variant="outline" size="sm" onClick={() => dlCollectionReport('csv')} className="gap-1"><Download className="h-3.5 w-3.5" /> CSV</Button>
          </div>
        </div>
      </Card>

      {loading && !data && <div className="text-sm text-muted-foreground">Loading fees analytics…</div>}

      {kpis && (
        <>
          {/* KPI Cards - 8 required cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <KPI icon={IndianRupee} label="Total Fees Collected" value={shortMoney(kpis.total_collected)} accent="green" testid="kpi-collected" />
            <KPI icon={AlertCircle} label="Total Pending Fees" value={shortMoney(kpis.total_pending)} accent="red" testid="kpi-pending" />
            <KPI icon={CheckCircle2} label="Students Paid" value={kpis.total_paid_students} accent="green" testid="kpi-paid-students" />
            <KPI icon={Users} label="Students Pending" value={kpis.total_pending_students + kpis.total_partial_students} accent="amber" testid="kpi-pending-students" />
            <KPI icon={CalendarCheck} label="Today's Collection" value={shortMoney(kpis.today_collection)} sub={`${kpis.today_transactions} txn`} testid="kpi-today" />
            <KPI icon={Wallet} label="This Month" value={shortMoney(kpis.monthly_collection)} sub={`${kpis.monthly_transactions} txn`} testid="kpi-month" />
            <KPI icon={TrendingDown} label="Discounts Given" value={shortMoney(kpis.total_discount)} accent="blue" testid="kpi-discount" />
            <KPI icon={Clock} label="Late Fees Collected" value={shortMoney(kpis.total_late_fee)} accent="amber" testid="kpi-late-fee" />
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
            <Card className="xl:col-span-2 p-5 border-border">
              <CardHeader className="p-0 mb-3"><CardTitle className="text-sm font-semibold">Daily Collection</CardTitle></CardHeader>
              <CardContent className="p-0 h-[280px]" data-testid="chart-daily">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.daily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E6EAF0" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => money(v)} contentStyle={{ background: '#fff', border: '1px solid #E6EAF0', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="amount" name="Collected" fill="#0F766E" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="p-5 border-border">
              <CardHeader className="p-0 mb-3"><CardTitle className="text-sm font-semibold">Payment Method Breakdown</CardTitle></CardHeader>
              <CardContent className="p-0 h-[280px]" data-testid="chart-mode">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={modeData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
                      {modeData.map((m) => <Cell key={m.name} fill={MODE_COLORS[m.name.replace(' ', '_')] || '#0B2F4A'} />)}
                    </Pie>
                    <Tooltip formatter={(v) => money(v)} contentStyle={{ background: '#fff', border: '1px solid #E6EAF0', borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
            <Card className="p-5 border-border">
              <CardHeader className="p-0 mb-3"><CardTitle className="text-sm font-semibold">Monthly Collection Trend (This Year)</CardTitle></CardHeader>
              <CardContent className="p-0 h-[260px]" data-testid="chart-monthly">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.monthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E6EAF0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => money(v)} contentStyle={{ background: '#fff', border: '1px solid #E6EAF0', borderRadius: 8, fontSize: 12 }} />
                    <Line type="monotone" dataKey="amount" name="Collection" stroke="#1D4ED8" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="p-5 border-border">
              <CardHeader className="p-0 mb-3"><CardTitle className="text-sm font-semibold">Class-wise Collection</CardTitle></CardHeader>
              <CardContent className="p-0 h-[260px]" data-testid="chart-class">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.by_class.slice(0, 12)} layout="vertical" margin={{ left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E6EAF0" />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <YAxis dataKey="class_name" type="category" tick={{ fontSize: 11 }} width={80} />
                    <Tooltip formatter={(v) => money(v)} contentStyle={{ background: '#fff', border: '1px solid #E6EAF0', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="amount" name="Collected" fill="#0B2F4A" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Transactions Table (in selected date range) */}
      {data && (
        <Card className="p-5 border-border mb-4" data-testid="analytics-transactions">
          <CardHeader className="p-0 mb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-md bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] flex items-center justify-center">
                  <Receipt className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold">Transactions in Selected Range</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {filteredTxns.length} transaction{filteredTxns.length === 1 ? '' : 's'} · Total {money(txnRangeAmount)} · {startDate} to {endDate}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input
                    value={txnQuery}
                    onChange={(e) => setTxnQuery(e.target.value)}
                    placeholder="Search receipt / student / admission / phone…"
                    className="h-9 pl-8 pr-8 w-[280px] text-sm"
                    data-testid="txn-search-input"
                  />
                  {txnQuery && (
                    <button
                      onClick={() => setTxnQuery('')}
                      className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
                      aria-label="Clear search"
                      data-testid="txn-search-clear"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <Select value={txnModeFilter} onValueChange={setTxnModeFilter}>
                  <SelectTrigger className="h-9 w-[150px] text-sm" data-testid="txn-mode-filter">
                    <SelectValue placeholder="All Modes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Modes</SelectItem>
                    {['cash', 'upi', 'card', 'cheque', 'bank_transfer', 'razorpay'].map((m) => (
                      <SelectItem key={m} value={m}>{m.replace('_', ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" className="gap-1" onClick={dlTxnsCsv} data-testid="txn-download-csv">
                  <Download className="h-3.5 w-3.5" /> CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="rounded-md border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/50">
                    <TableHead className="whitespace-nowrap">Receipt No.</TableHead>
                    <TableHead className="whitespace-nowrap">Date &amp; Time</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead className="whitespace-nowrap">Class / Sec</TableHead>
                    <TableHead>Fee Heads</TableHead>
                    <TableHead className="whitespace-nowrap">Mode</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Discount</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Late Fee</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Amount</TableHead>
                    <TableHead className="whitespace-nowrap">Collected By</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedTxns.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={11} className="py-10 text-center">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Receipt className="h-8 w-8 opacity-40" />
                          <div className="text-sm">No transactions found for the selected filters.</div>
                          <div className="text-xs">Try adjusting the date range or filters above.</div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  {pagedTxns.map((t) => (
                    <TableRow key={t.id} data-testid={`txn-row-${t.receipt_number}`}>
                      <TableCell className="font-mono text-xs">{t.receipt_number}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        <div>{(t.paid_at || '').slice(0, 10)}</div>
                        <div className="text-muted-foreground">{(t.paid_at || '').slice(11, 16)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{t.student_name}</div>
                        <div className="text-xs text-muted-foreground">{t.admission_number} · {t.father_name}</div>
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{t.class_name}{t.section && t.section !== '—' ? ` · ${t.section}` : ''}</TableCell>
                      <TableCell className="text-xs max-w-[220px] truncate" title={t.fee_heads}>{t.fee_heads}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className="capitalize text-[10px] font-medium"
                          style={{
                            backgroundColor: `${MODE_COLORS[t.payment_mode] || '#0B2F4A'}1A`,
                            color: MODE_COLORS[t.payment_mode] || '#0B2F4A',
                            borderColor: `${MODE_COLORS[t.payment_mode] || '#0B2F4A'}33`,
                          }}
                        >
                          {String(t.payment_mode).replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{t.discount ? money(t.discount) : '—'}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{t.late_fee ? money(t.late_fee) : '—'}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{money(t.total_paid)}</TableCell>
                      <TableCell className="text-xs">{t.collected_by_name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate" title={t.remarks}>{t.remarks || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {filteredTxns.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 mt-3 text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>Rows per page:</span>
                  <Select value={String(txnPageSize)} onValueChange={(v) => setTxnPageSize(Number(v))}>
                    <SelectTrigger className="h-8 w-[70px]" data-testid="txn-page-size"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[10, 25, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <span>
                    Showing <b>{(currentTxnPage - 1) * txnPageSize + 1}</b>–
                    <b>{Math.min(currentTxnPage * txnPageSize, filteredTxns.length)}</b> of <b>{filteredTxns.length}</b>
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline" size="sm" className="h-8 gap-1"
                    disabled={currentTxnPage <= 1}
                    onClick={() => setTxnPage((p) => Math.max(1, p - 1))}
                    data-testid="txn-prev-page"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Prev
                  </Button>
                  <div className="px-2 tabular-nums">Page {currentTxnPage} / {txnTotalPages}</div>
                  <Button
                    variant="outline" size="sm" className="h-8 gap-1"
                    disabled={currentTxnPage >= txnTotalPages}
                    onClick={() => setTxnPage((p) => Math.min(txnTotalPages, p + 1))}
                    data-testid="txn-next-page"
                  >
                    Next <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Student Fee Search */}
      <Card className="p-5 border-border mb-4" data-testid="student-fee-search">
        <div className="flex items-center justify-between mb-3">
          <div><CardTitle className="text-base font-semibold">Student Fee Search</CardTitle><p className="text-xs text-muted-foreground mt-0.5">Search by name, admission number, mobile or father's name to view a complete fee profile.</p></div>
          {feeReport && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => dlReport('pdf')} className="gap-1" data-testid="student-report-pdf"><FileText className="h-3.5 w-3.5" /> PDF</Button>
              <Button variant="outline" size="sm" onClick={() => dlReport('csv')} className="gap-1" data-testid="student-report-csv"><Download className="h-3.5 w-3.5" /> CSV</Button>
            </div>
          )}
        </div>
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <button className="w-full flex items-center gap-2 h-11 px-3 rounded-md border border-border bg-card hover:bg-secondary text-sm text-left" data-testid="student-search-input">
              <Search className="h-4 w-4 text-muted-foreground" />
              {feeReport ? (
                <span><span className="font-medium">{feeReport.student.full_name}</span> <span className="text-muted-foreground">· {feeReport.student.admission_number}</span></span>
              ) : (
                <span className="text-muted-foreground">Search student by name / admission no / mobile / father's name…</span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[520px] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput placeholder="Type to search…" value={query} onValueChange={setQuery} />
              <CommandList>
                <CommandEmpty>No students found.</CommandEmpty>
                <CommandGroup heading={`${filteredStudents.length} results`}>
                  {filteredStudents.map((s) => (
                    <CommandItem key={s.id} value={s.id} onSelect={() => { setSelectedStudentId(s.id); setPopoverOpen(false); setQuery(''); }}>
                      <div className="flex items-center gap-2 w-full">
                        <Avatar className="h-7 w-7"><AvatarImage src={s.photo_url} /><AvatarFallback className="text-xs bg-secondary">{(s.full_name || 'S').split(' ').map((x) => x[0]).slice(0, 2).join('')}</AvatarFallback></Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{s.full_name}</div>
                          <div className="text-xs text-muted-foreground truncate">{s.admission_number} · {s.father_name || '—'} · {s.phone || '—'}</div>
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </Card>

      {/* Student Fee Profile */}
      {feeReport && (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
            <Card className="p-5 border-border">
              <CardHeader className="p-0 mb-3"><CardTitle className="text-sm font-semibold">Student Information</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar className="h-14 w-14"><AvatarImage src={feeReport.student.photo_url} /><AvatarFallback className="bg-secondary">{(feeReport.student.full_name || 'S').split(' ').map((x) => x[0]).slice(0, 2).join('')}</AvatarFallback></Avatar>
                  <div>
                    <div className="font-semibold">{feeReport.student.full_name}</div>
                    <div className="text-xs text-muted-foreground">{feeReport.student.admission_number}</div>
                    <div className="text-xs text-muted-foreground">{feeReport.student.class_name} {feeReport.student.section && `· ${feeReport.student.section}`} {feeReport.student.roll_number && `· Roll ${feeReport.student.roll_number}`}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Father:</span> {feeReport.student.father_name || '—'}</div>
                  <div><span className="text-muted-foreground">Mobile:</span> {feeReport.student.phone || '—'}</div>
                  <div><span className="text-muted-foreground">Gender:</span> {feeReport.student.gender || '—'}</div>
                  <div><span className="text-muted-foreground">Category:</span> {feeReport.student.category || '—'}</div>
                </div>
              </CardContent>
            </Card>

            <Card className="xl:col-span-2 p-5 border-border">
              <CardHeader className="p-0 mb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold">Fee Summary</CardTitle>
                <Badge className={feeReport.summary.status === 'paid' ? 'bg-[#E6F6F4] text-[#0F766E] border border-[#BFEAE6]' : feeReport.summary.status === 'partial' ? 'bg-[#FFF3E0] text-[#B45309] border border-[#FFD7A8]' : 'bg-[#FEE4E2] text-[#B42318] border border-[#FECACA]'}>{feeReport.summary.status}</Badge>
              </CardHeader>
              <CardContent className="p-0 grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Total Fee" value={money(feeReport.summary.total_expected)} />
                <Stat label="Total Paid" value={money(feeReport.summary.total_paid)} className="text-[#0F766E]" />
                <Stat label="Discount" value={money(feeReport.summary.total_discount)} className="text-[hsl(var(--accent))]" />
                <Stat label="Late Fee Paid" value={money(feeReport.summary.total_late_paid)} className="text-[#B45309]" />
                <Stat label="Pending" value={money(feeReport.summary.balance)} className={feeReport.summary.balance > 0 ? 'text-[#B42318]' : ''} big />
                <Stat label="Last Payment" value={feeReport.summary.last_payment_date || '—'} />
                <Stat label="Next Due Date" value={feeReport.summary.next_due_date || '—'} />
                <Stat label="Days Overdue" value={feeReport.summary.days_overdue > 0 ? `${feeReport.summary.days_overdue} days` : '—'} className={feeReport.summary.days_overdue > 0 ? 'text-[#B42318] font-semibold' : ''} />
              </CardContent>
            </Card>
          </div>

          {feeReport.summary.balance > 0 && (
            <Card className="p-4 border-[#FECACA] bg-[#FEE4E2] mb-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-[#B42318] flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-[#B42318]">Outstanding Balance: {money(feeReport.summary.balance)}</div>
                  <div className="text-sm text-[#B42318]/90 mt-1">
                    {feeReport.summary.next_due_date && `Next due: ${feeReport.summary.next_due_date}`}
                    {feeReport.summary.days_overdue > 0 && ` · Overdue by ${feeReport.summary.days_overdue} days`}
                  </div>
                </div>
              </div>
            </Card>
          )}

          <Card className="p-5 border-border" data-testid="student-payment-history">
            <CardHeader className="p-0 mb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold">Payment History</CardTitle>
              <Badge variant="secondary">{feeReport.payments.length} payments</Badge>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Receipt No.</TableHead><TableHead>Date</TableHead><TableHead>Mode</TableHead><TableHead className="text-right">Late Fee</TableHead><TableHead className="text-right">Discount</TableHead><TableHead className="text-right">Amount Paid</TableHead><TableHead>Collected By</TableHead><TableHead>Remarks</TableHead></TableRow></TableHeader>
                <TableBody>
                  {feeReport.payments.length === 0 && <TableRow><TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">No payments yet.</TableCell></TableRow>}
                  {feeReport.payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.receipt_number}</TableCell>
                      <TableCell>{(p.paid_at || '').slice(0, 10)}</TableCell>
                      <TableCell className="capitalize">{String(p.payment_mode).replace('_', ' ')}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(p.late_fee || 0)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(p.discount || 0)}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{money(p.total_paid)}</TableCell>
                      <TableCell className="text-xs">{p.collected_by_name || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.remarks || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </AppShell>
  );
}

const KPI = ({ icon: Icon, label, value, sub, accent, testid }) => {
  const cls = accent === 'green' ? 'bg-[#E6F6F4] text-[#0F766E]' : accent === 'red' ? 'bg-[#FEE4E2] text-[#B42318]' : accent === 'blue' ? 'bg-[#E8F0FF] text-[#1D4ED8]' : accent === 'amber' ? 'bg-[#FFF3E0] text-[#B45309]' : 'bg-secondary text-foreground';
  return (
    <Card className="p-4 border-border" data-testid={testid}>
      <div className="flex items-start gap-3">
        <div className={`h-9 w-9 rounded-md flex items-center justify-center flex-shrink-0 ${cls}`}><Icon className="h-4 w-4" /></div>
        <div className="min-w-0">
          <div className="text-xs uppercase text-muted-foreground tracking-wide truncate">{label}</div>
          <div className="h-font text-lg font-semibold tabular-nums">{value}</div>
          {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
        </div>
      </div>
    </Card>
  );
};

const Stat = ({ label, value, className = '', big }) => (
  <div>
    <div className="text-xs uppercase text-muted-foreground tracking-wide">{label}</div>
    <div className={`h-font ${big ? 'text-xl' : 'text-base'} font-semibold tabular-nums ${className}`}>{value}</div>
  </div>
);
