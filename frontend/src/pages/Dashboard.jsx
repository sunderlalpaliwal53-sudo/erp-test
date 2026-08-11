import React, { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { api, money, shortMoney } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSchool } from '@/contexts/SchoolContext';
import { useAuth } from '@/contexts/AuthContext';
import { Users, IndianRupee, CalendarCheck, UserPlus, Wallet, Sparkles, Megaphone, CalendarDays } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area, PieChart, Pie, Cell, Legend } from 'recharts';
import { PendingApprovalsPanel } from '@/components/PendingApprovalsPanel';

const APPROVAL_ROLES = new Set(['owner', 'super_admin', 'school_admin', 'accountant']);
const FINANCE_ROLES = new Set(['owner', 'super_admin', 'school_admin', 'accountant']);

const KPI = ({ icon: Icon, label, value, sub, accent = 'primary', testid }) => (
  <Card data-testid={testid} className="p-5 border-border">
    <div className="flex items-start justify-between">
      <div>
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className="h-font text-2xl md:text-3xl font-semibold tabular-nums mt-1">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </div>
      <div className={`h-9 w-9 rounded-md flex items-center justify-center ${
        accent === 'accent' ? 'bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))]' :
        accent === 'warn' ? 'bg-[#FFF3E0] text-[#B45309]' :
        'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]'
      }`}>
        <Icon className="h-4 w-4" />
      </div>
    </div>
  </Card>
);

export default function Dashboard() {
  const { activeSchoolId, activeSchool } = useSchool();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeSchoolId) return;
    setLoading(true);
    try {
      const { data: d } = await api.get('/dashboard/summary');
      setData(d);
    } finally { setLoading(false); }
  }, [activeSchoolId]);

  useEffect(() => { load(); }, [activeSchoolId, load]);
  useEffect(() => {
    const h = () => load();
    window.addEventListener('stv:school-changed', h);
    return () => window.removeEventListener('stv:school-changed', h);
  }, [load]);

  const trend = data?.collection_trend || [];
  const canSeeFinance = FINANCE_ROLES.has(user?.role);
  const attendancePie = data ? [
    { name: 'Present', value: data.present_today, color: '#0F766E' },
    { name: 'Absent', value: data.absent_today, color: '#B42318' },
  ] : [];

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="h-font text-2xl md:text-3xl font-semibold">Welcome back, {user?.full_name?.split(' ')[0]}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {activeSchool ? `Overview for ${activeSchool.name}` : 'Loading school…'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        <KPI testid="kpi-total-students" icon={Users} label="Total Students" value={data?.total_students ?? '-'} sub="Active enrolment" />
        {canSeeFinance && <KPI testid="kpi-today-collection" icon={IndianRupee} label="Today's Collection" value={shortMoney(data?.today_collection || 0)} sub={`${data?.recent_payments?.length || 0} transactions`} accent="accent" />}
        {canSeeFinance && <KPI testid="kpi-monthly-collection" icon={Wallet} label="Monthly Collection" value={shortMoney(data?.monthly_collection || 0)} sub="This month" />}
        <KPI testid="kpi-attendance-today" icon={CalendarCheck} label="Attendance Today" value={`${data?.present_today || 0}/${(data?.present_today || 0) + (data?.absent_today || 0)}`} sub={`${data?.absent_today || 0} absent`} accent="warn" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KPI icon={UserPlus} label="New Admissions" value={data?.new_admissions ?? '-'} sub="This month" />
        {canSeeFinance && <KPI icon={Sparkles} label="Pending Fees" value={data?.pending_students ?? '-'} sub="Students with dues" accent="warn" />}
        <KPI icon={CalendarDays} label="Upcoming Events" value={data?.upcoming_events?.length ?? '-'} sub="Next 30 days" />
        <KPI icon={Megaphone} label="Recent Circulars" value={data?.recent_circulars?.length ?? '-'} sub="Latest published" />
      </div>

      {APPROVAL_ROLES.has(user?.role) && (
        <div className="mb-4">
          <PendingApprovalsPanel />
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        {canSeeFinance && (
        <Card className="xl:col-span-2 p-5 border-border">
          <CardHeader className="p-0 mb-3">
            <CardTitle className="text-sm font-semibold">Fee Collection Trend (7 days)</CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-[280px]" data-testid="dashboard-fee-collection-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="collGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--chart-2))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E6EAF0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => money(v)} contentStyle={{ background: '#fff', border: '1px solid #E6EAF0', borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="amount" stroke="hsl(var(--chart-2))" fill="url(#collGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        )}
        <Card className="p-5 border-border">
          <CardHeader className="p-0 mb-3">
            <CardTitle className="text-sm font-semibold">Attendance Today</CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-[280px]" data-testid="dashboard-attendance-chart">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={attendancePie} dataKey="value" innerRadius={60} outerRadius={90} paddingAngle={2}>
                  {attendancePie.map((entry) => <Cell key={entry.color} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#fff', border: '1px solid #E6EAF0', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {canSeeFinance && (
        <Card className="p-5 border-border">
          <CardHeader className="p-0 mb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Recent Payments</CardTitle>
            <Badge variant="secondary" className="font-normal">{data?.recent_payments?.length || 0}</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border" data-testid="dashboard-recent-payments">
              {(data?.recent_payments || []).length === 0 && <div className="py-6 text-sm text-muted-foreground">No payments yet.</div>}
              {(data?.recent_payments || []).map((p) => (
                <div key={p.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm font-medium">{p.student_name}</div>
                    <div className="text-xs text-muted-foreground">{p.receipt_number} • {String(p.payment_mode).replace('_', ' ')}</div>
                  </div>
                  <div className="text-sm font-semibold tabular-nums">{shortMoney(p.total_paid)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        )}
        <Card className="p-5 border-border">
          <CardHeader className="p-0 mb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Upcoming Events</CardTitle>
            <Badge variant="secondary" className="font-normal">{data?.upcoming_events?.length || 0}</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {(data?.upcoming_events || []).length === 0 && <div className="py-6 text-sm text-muted-foreground">No upcoming events.</div>}
              {(data?.upcoming_events || []).map((e) => (
                <div key={e.id} className="flex items-center gap-3 py-3">
                  <div className="h-10 w-10 rounded-md bg-[hsl(var(--accent))]/10 flex flex-col items-center justify-center text-[hsl(var(--accent))]">
                    <div className="text-[10px] uppercase">{new Date(e.event_date).toLocaleString('en-US', { month: 'short' })}</div>
                    <div className="text-sm font-semibold leading-none">{new Date(e.event_date).getDate()}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{e.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{e.location || '—'}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {loading && <div className="mt-4 text-xs text-muted-foreground">Loading dashboard…</div>}
    </AppShell>
  );
}
