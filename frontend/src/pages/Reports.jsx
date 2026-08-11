import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { api, money, shortMoney } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  FileText, Download, FileSpreadsheet, Search, Filter, ChevronDown, X, Layers,
  CheckCircle2, AlertTriangle, Circle, ListChecks, CalendarDays,
} from 'lucide-react';
import { useSchool } from '@/contexts/SchoolContext';
import { toast } from 'sonner';

// -------------- Helpers --------------
const buildClassSectionsParam = (selections) => {
  // selections: [{ class_id, section }] — section may be null (means "all sections of that class")
  if (!selections || selections.length === 0) return '';
  return selections.map((s) => `${s.class_id}:${s.section || ''}`).join(',');
};

const dedupeSelections = (list) => {
  const seen = new Set();
  const out = [];
  list.forEach((s) => {
    const k = `${s.class_id}:${s.section || ''}`;
    if (!seen.has(k)) { seen.add(k); out.push(s); }
  });
  return out;
};

export default function ReportsPage() {
  const { activeSchoolId } = useSchool();

  // Fee Collection tab state (unchanged)
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [mode, setMode] = useState('all');

  // Fee Status tab state
  const [classes, setClasses] = useState([]);
  const [selections, setSelections] = useState([]); // [{class_id, class_name, section}]
  const [statusFilter, setStatusFilter] = useState('all');
  const [quickView, setQuickView] = useState('all'); // all|has_dues|fully_paid
  const [search, setSearch] = useState('');
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorSearch, setSelectorSearch] = useState('');
  // Payment date range for fee-status (filters students by last payment date)
  const [fsStartDate, setFsStartDate] = useState('');
  const [fsEndDate, setFsEndDate] = useState('');

  const [collectionData, setCollectionData] = useState(null);
  const [feeStatusData, setFeeStatusData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dlLoading, setDlLoading] = useState(false);

  // Due Export tab state
  const todayISO = new Date().toISOString().slice(0, 10);
  const sessionStart = '2026-04-01';
  const [dueAsOf, setDueAsOf] = useState(todayISO);
  const [dueFrom, setDueFrom] = useState('');
  const [dueTo, setDueTo] = useState('');
  const [dueOnlyWithDues, setDueOnlyWithDues] = useState(true);
  const [dueRangePreset, setDueRangePreset] = useState('all');

  const loadClasses = useCallback(async () => {
    if (!activeSchoolId) return;
    const { data } = await api.get('/classes');
    setClasses(data);
  }, [activeSchoolId]);

  const runCollection = useCallback(async () => {
    setLoading(true);
    try {
      const params = { start_date: startDate, end_date: endDate };
      if (mode !== 'all') params.mode = mode;
      const { data } = await api.get('/reports/collection', { params });
      setCollectionData(data);
    } finally { setLoading(false); }
  }, [startDate, endDate, mode]);

  const runFeeStatus = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      const csParam = buildClassSectionsParam(selections);
      if (csParam) params.class_sections = csParam;
      if (statusFilter !== 'all') params.status_filter = statusFilter;
      if (fsStartDate) params.payment_date_start = fsStartDate;
      if (fsEndDate) params.payment_date_end = fsEndDate;
      // quick-view is applied client-side now (fully_paid / has_dues) so the
      // report data always includes every student and month.
      const { data } = await api.get('/reports/fee-status', { params });
      setFeeStatusData(data);
    } finally { setLoading(false); }
  }, [selections, statusFilter, fsStartDate, fsEndDate]);

  useEffect(() => { loadClasses(); }, [loadClasses]);
  useEffect(() => { if (activeSchoolId) { runCollection(); runFeeStatus(); } }, [activeSchoolId, runCollection, runFeeStatus]);
  useEffect(() => {
    const h = () => {
      loadClasses();
      setSelections([]);
      runCollection();
      runFeeStatus();
    };
    window.addEventListener('stv:school-changed', h);
    return () => window.removeEventListener('stv:school-changed', h);
  }, [runCollection, runFeeStatus, loadClasses]);

  // Selection helpers
  const isSectionSelected = (classId, section) =>
    selections.some((s) => s.class_id === classId && s.section === section);

  const isClassAllSelected = (klass) => {
    const secs = klass.sections || [];
    if (secs.length === 0) return isSectionSelected(klass.id, null);
    return secs.every((sec) => isSectionSelected(klass.id, sec));
  };

  const toggleSection = (klass, section) => {
    setSelections((prev) => {
      const exists = prev.some((s) => s.class_id === klass.id && s.section === section);
      if (exists) return prev.filter((s) => !(s.class_id === klass.id && s.section === section));
      return dedupeSelections([...prev, { class_id: klass.id, class_name: klass.name, section }]);
    });
  };

  const toggleClassAllSections = (klass) => {
    const secs = klass.sections || [];
    const allSelected = isClassAllSelected(klass);
    setSelections((prev) => {
      const withoutClass = prev.filter((s) => s.class_id !== klass.id);
      if (allSelected) return withoutClass;
      if (secs.length === 0) {
        return dedupeSelections([...withoutClass, { class_id: klass.id, class_name: klass.name, section: null }]);
      }
      const additions = secs.map((sec) => ({ class_id: klass.id, class_name: klass.name, section: sec }));
      return dedupeSelections([...withoutClass, ...additions]);
    });
  };

  const removeSelection = (item) => {
    setSelections((prev) => prev.filter((s) => !(s.class_id === item.class_id && s.section === item.section)));
  };

  const clearSelections = () => setSelections([]);

  const filteredClassesForSelector = useMemo(() => {
    const q = selectorSearch.trim().toLowerCase();
    if (!q) return classes;
    return classes.filter((c) => (c.name || '').toLowerCase().includes(q));
  }, [classes, selectorSearch]);

  // Download for fee-status
  const dlFeeStatus = async (ext, opts = {}) => {
    setDlLoading(true);
    try {
      const params = {};
      const csParam = buildClassSectionsParam(selections);
      if (csParam) params.class_sections = csParam;
      if (statusFilter !== 'all') params.status_filter = statusFilter;
      if (fsStartDate) params.payment_date_start = fsStartDate;
      if (fsEndDate) params.payment_date_end = fsEndDate;
      if (opts.overrideQuick) params.quick_view = opts.overrideQuick;
      const resp = await api.get(`/reports/fee-status.${ext}`, { params, responseType: 'blob' });
      const mime = ext === 'pdf' ? 'application/pdf'
        : ext === 'csv' ? 'text/csv'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const blob = new Blob([resp.data], { type: mime });
      const url = window.URL.createObjectURL(blob);
      const fname = opts.filename || `fee_status_report.${ext}`;
      if (ext === 'pdf') {
        window.open(url, '_blank');
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = fname;
        a.click();
        a.remove();
      }
      toast.success(`Downloaded ${ext.toUpperCase()}`);
    } catch (err) {
      toast.error(`Failed to download ${ext.toUpperCase()}: ${err?.response?.data?.detail || err.message}`);
    } finally {
      setDlLoading(false);
    }
  };

  // Download the Monthly Due List — respects current class/section selections.
  // Optional filters (as_of, from, to, only_with_dues) let the Due Export tab
  // produce a filtered snapshot.
  const dlDueList = async (opts = {}) => {
    setDlLoading(true);
    try {
      const params = {
        only_with_dues: opts.only_with_dues !== undefined ? opts.only_with_dues : true,
      };
      const csParam = buildClassSectionsParam(selections);
      if (csParam) params.class_sections = csParam;
      if (opts.as_of_date) params.as_of_date = opts.as_of_date;
      if (opts.from_date) params.from_date = opts.from_date;
      if (opts.to_date) params.to_date = opts.to_date;
      const resp = await api.get('/reports/monthly-dues.xlsx', { params, responseType: 'blob' });
      const blob = new Blob([resp.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const parts = [];
      if (opts.from_date || opts.to_date) parts.push(`${opts.from_date || 'start'}_to_${opts.to_date || 'end'}`);
      else if (opts.as_of_date) parts.push(`as_of_${opts.as_of_date}`);
      const suffix = parts.length ? `_${parts.join('_')}` : '';
      a.download = (selections.length === 0 ? 'due_list_all_classes' : 'due_list') + suffix + '.xlsx';
      a.click(); a.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
      toast.success('Due list downloaded');
    } catch (err) {
      toast.error(`Failed to download due list: ${err?.response?.data?.detail || err.message}`);
    } finally { setDlLoading(false); }
  };

  // Apply preset date ranges for Due Export
  const applyDuePreset = (preset) => {
    setDueRangePreset(preset);
    const today = new Date();
    const iso = (d) => d.toISOString().slice(0, 10);
    if (preset === 'all') { setDueFrom(''); setDueTo(''); return; }
    if (preset === 'session') { setDueFrom('2026-04-01'); setDueTo('2027-03-31'); return; }
    if (preset === 'this_month') {
      setDueFrom(iso(new Date(today.getFullYear(), today.getMonth(), 1)));
      setDueTo(iso(new Date(today.getFullYear(), today.getMonth() + 1, 0)));
      return;
    }
    if (preset === 'last_3_months') {
      setDueFrom(iso(new Date(today.getFullYear(), today.getMonth() - 2, 1)));
      setDueTo(iso(new Date(today.getFullYear(), today.getMonth() + 1, 0)));
      return;
    }
    if (preset === 'q1') { setDueFrom('2026-04-01'); setDueTo('2026-06-30'); return; }
    if (preset === 'q2') { setDueFrom('2026-07-01'); setDueTo('2026-09-30'); return; }
    if (preset === 'q3') { setDueFrom('2026-10-01'); setDueTo('2026-12-31'); return; }
    if (preset === 'q4') { setDueFrom('2027-01-01'); setDueTo('2027-03-31'); return; }
  };

  const dlDueExport = () => {
    if (dueFrom && dueTo && dueFrom > dueTo) {
      toast.error('From date must be before To date');
      return;
    }
    dlDueList({
      as_of_date: dueAsOf || undefined,
      from_date: dueFrom || undefined,
      to_date: dueTo || undefined,
      only_with_dues: dueOnlyWithDues,
    });
  };

  const dl = async (ext) => {
    const resp = await api.get(`/reports/collection.${ext}`, {
      params: { start_date: startDate, end_date: endDate },
      responseType: 'blob',
    });
    const mime = ext === 'pdf' ? 'application/pdf' : ext === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const blob = new Blob([resp.data], { type: mime });
    const url = window.URL.createObjectURL(blob);
    if (ext === 'pdf') window.open(url, '_blank');
    else { const a = document.createElement('a'); a.href = url; a.download = `collection.${ext}`; a.click(); a.remove(); }
  };

  const searchQ = search.toLowerCase();
  const filteredRows = (feeStatusData?.rows || []).filter((r) => {
    if (quickView === 'has_dues' && (r.due || 0) <= 0) return false;
    if (quickView === 'fully_paid' && !r.fully_paid) return false;
    if (!search) return true;
    return (r.full_name || '').toLowerCase().includes(searchQ) || (r.admission_number || '').toLowerCase().includes(searchQ);
  });

  const selectionSummary = useMemo(() => {
    if (selections.length === 0) return 'All Classes & Sections';
    // Group by class
    const byClass = {};
    selections.forEach((s) => {
      if (!byClass[s.class_id]) byClass[s.class_id] = { name: s.class_name, sections: [] };
      byClass[s.class_id].sections.push(s.section || 'All');
    });
    return Object.values(byClass)
      .map((c) => `${c.name} (${c.sections.join(', ')})`)
      .join(' · ');
  }, [selections]);

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="h-font text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground">Fee collection, pending dues, and detailed financial analytics.</p>
      </div>

      <Tabs defaultValue="collection">
        <TabsList>
          <TabsTrigger value="collection" data-testid="report-tab-collection">Fee Collection</TabsTrigger>
          <TabsTrigger value="fee-status" data-testid="report-tab-fee-status">Student Fee Status</TabsTrigger>
          <TabsTrigger value="due-export" data-testid="report-tab-due-export">Due Export</TabsTrigger>
        </TabsList>

        {/* --------- Fee Collection --------- */}
        <TabsContent value="collection">
          <Card className="p-4 border-border mb-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="grid gap-1.5"><Label className="text-xs">Start Date</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
              <div className="grid gap-1.5"><Label className="text-xs">End Date</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
              <div className="grid gap-1.5"><Label className="text-xs">Payment Mode</Label>
                <Select value={mode} onValueChange={setMode}>
                  <SelectTrigger data-testid="report-mode-filter"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Modes</SelectItem>
                    {['cash', 'upi', 'card', 'cheque', 'bank_transfer', 'razorpay'].map((m) => <SelectItem key={m} value={m}>{m.replace('_', ' ')}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end"><Button onClick={runCollection} disabled={loading} className="w-full">{loading ? 'Loading…' : 'Run Report'}</Button></div>
              <div className="flex items-end gap-1">
                <Button variant="outline" size="sm" onClick={() => dl('pdf')} className="gap-1 flex-1"><FileText className="h-3.5 w-3.5" /> PDF</Button>
                <Button variant="outline" size="sm" onClick={() => dl('csv')} className="gap-1 flex-1"><Download className="h-3.5 w-3.5" /> CSV</Button>
                <Button variant="outline" size="sm" onClick={() => dl('xlsx')} className="gap-1 flex-1"><FileSpreadsheet className="h-3.5 w-3.5" /> XLSX</Button>
              </div>
            </div>
          </Card>

          {collectionData && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <Card className="p-4 border-border"><div className="text-xs uppercase text-muted-foreground">Total Collection</div><div className="h-font text-xl font-semibold tabular-nums">{shortMoney(collectionData.total)}</div></Card>
                <Card className="p-4 border-border"><div className="text-xs uppercase text-muted-foreground">Transactions</div><div className="h-font text-xl font-semibold">{collectionData.count}</div></Card>
                {Object.entries(collectionData.by_mode || {}).slice(0, 2).map(([k, v]) => (
                  <Card key={k} className="p-4 border-border"><div className="text-xs uppercase text-muted-foreground capitalize">{k.replace('_', ' ')}</div><div className="h-font text-xl font-semibold tabular-nums">{shortMoney(v)}</div></Card>
                ))}
              </div>
              <Card className="border-border">
                <Table>
                  <TableHeader><TableRow><TableHead>Receipt No</TableHead><TableHead>Date</TableHead><TableHead>Student</TableHead><TableHead>Mode</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {collectionData.payments.length === 0 && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground text-sm">No transactions.</TableCell></TableRow>}
                    {collectionData.payments.slice(0, 100).map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs">{p.receipt_number}</TableCell>
                        <TableCell>{(p.paid_at || '').slice(0, 10)}</TableCell>
                        <TableCell className="font-medium">{p.student_name}</TableCell>
                        <TableCell className="capitalize">{String(p.payment_mode).replace('_', ' ')}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(p.total_paid)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </>
          )}
        </TabsContent>

        {/* --------- Student Fee Status --------- */}
        <TabsContent value="fee-status">
          <Card className="p-4 border-border mb-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-3 grid gap-1.5">
                <Label className="text-xs">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Name / Admission no." value={search} onChange={(e) => setSearch(e.target.value)} data-testid="report-search-input" />
                </div>
              </div>

              <div className="md:col-span-5 grid gap-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <Layers className="h-3 w-3" /> Classes &amp; Sections
                </Label>
                <Popover open={selectorOpen} onOpenChange={setSelectorOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="w-full flex items-center justify-between gap-2 h-10 px-3 rounded-md border border-border bg-card hover:bg-secondary text-sm text-left transition-colors"
                      data-testid="report-classes-multiselect"
                    >
                      <span className="truncate">
                        {selections.length === 0 ? (
                          <span className="text-muted-foreground">All classes &amp; sections</span>
                        ) : (
                          <span className="font-medium">{selections.length} selection{selections.length === 1 ? '' : 's'}</span>
                        )}
                      </span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[420px] p-0" align="start">
                    <div className="p-3 border-b border-border">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          value={selectorSearch}
                          onChange={(e) => setSelectorSearch(e.target.value)}
                          placeholder="Search class name…"
                          className="pl-9 h-9"
                          data-testid="class-selector-search"
                        />
                      </div>
                      <div className="flex items-center justify-between mt-2 text-xs">
                        <div className="text-muted-foreground">
                          {selections.length} selected of {classes.reduce((n, c) => n + (c.sections?.length || 1), 0)} available
                        </div>
                        {selections.length > 0 && (
                          <button
                            className="text-[hsl(var(--primary))] hover:underline"
                            onClick={clearSelections}
                            data-testid="class-selector-clear"
                          >
                            Clear all
                          </button>
                        )}
                      </div>
                    </div>
                    <div
                      className="max-h-[360px] overflow-y-auto overscroll-contain"
                      data-testid="class-selector-scroll"
                      style={{ scrollbarGutter: 'stable' }}
                    >
                      <div className="p-2">
                        {filteredClassesForSelector.length === 0 && (
                          <div className="py-6 text-center text-sm text-muted-foreground">No classes match.</div>
                        )}
                        {filteredClassesForSelector.map((klass) => {
                          const secs = klass.sections || [];
                          const allSel = isClassAllSelected(klass);
                          return (
                            <div key={klass.id} className="py-2 px-2 rounded-md hover:bg-secondary/60">
                              <div className="flex items-center justify-between">
                                <label className="flex items-center gap-2 cursor-pointer flex-1">
                                  <Checkbox
                                    checked={allSel}
                                    onCheckedChange={() => toggleClassAllSections(klass)}
                                    data-testid={`class-toggle-${klass.name.replace(/\s+/g, '-')}`}
                                  />
                                  <span className="font-medium text-sm">{klass.name}</span>
                                </label>
                                <span className="text-xs text-muted-foreground">
                                  {secs.length ? `${secs.length} section${secs.length === 1 ? '' : 's'}` : 'no sections'}
                                </span>
                              </div>
                              {secs.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2 pl-6">
                                  {secs.map((sec) => {
                                    const on = isSectionSelected(klass.id, sec);
                                    return (
                                      <button
                                        key={sec}
                                        type="button"
                                        onClick={() => toggleSection(klass, sec)}
                                        data-testid={`section-toggle-${klass.name.replace(/\s+/g, '-')}-${sec}`}
                                        className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                                          on
                                            ? 'bg-[hsl(var(--primary))] text-white border-[hsl(var(--primary))]'
                                            : 'border-border hover:bg-secondary'
                                        }`}
                                      >
                                        Sec {sec}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="p-2 border-t border-border flex justify-end">
                      <Button size="sm" onClick={() => setSelectorOpen(false)} data-testid="class-selector-done">
                        Done
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="md:col-span-2 grid gap-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger data-testid="report-status-filter"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2 flex items-end">
                <Button onClick={runFeeStatus} disabled={loading} className="w-full gap-1" data-testid="report-apply-btn">
                  <Filter className="h-3.5 w-3.5" />{loading ? 'Loading…' : 'Apply'}
                </Button>
              </div>
            </div>

            {/* Payment date range — filters students by last payment date */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end mt-3">
              <div className="md:col-span-3 grid gap-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" /> Payment Date From
                </Label>
                <Input
                  type="date"
                  value={fsStartDate}
                  onChange={(e) => setFsStartDate(e.target.value)}
                  data-testid="fee-status-start-date"
                  placeholder="From"
                />
              </div>
              <div className="md:col-span-3 grid gap-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" /> Payment Date To
                </Label>
                <Input
                  type="date"
                  value={fsEndDate}
                  onChange={(e) => setFsEndDate(e.target.value)}
                  data-testid="fee-status-end-date"
                  placeholder="To"
                />
              </div>
              <div className="md:col-span-4 flex flex-wrap items-center gap-1.5">
                <Label className="text-xs text-muted-foreground mr-1">Presets:</Label>
                {[
                  { label: 'This Month', from: new Date(new Date().getFullYear(), new Date().getMonth(), 1), to: new Date() },
                  { label: 'Last 30 days', from: new Date(Date.now() - 30 * 86400000), to: new Date() },
                  { label: 'Last 90 days', from: new Date(Date.now() - 90 * 86400000), to: new Date() },
                  { label: 'Session', from: new Date('2026-04-01'), to: new Date() },
                ].map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      setFsStartDate(p.from.toISOString().slice(0, 10));
                      setFsEndDate(p.to.toISOString().slice(0, 10));
                    }}
                    className="px-2 py-1 text-[11px] rounded-md border border-border hover:bg-secondary transition-colors"
                    data-testid={`fs-preset-${p.label.replace(/\s+/g, '-').toLowerCase()}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="md:col-span-2 flex items-end">
                {(fsStartDate || fsEndDate) && (
                  <Button
                    variant="outline"
                    onClick={() => { setFsStartDate(''); setFsEndDate(''); }}
                    className="w-full gap-1 h-10"
                    data-testid="fs-date-clear"
                  >
                    <X className="h-3.5 w-3.5" /> Clear dates
                  </Button>
                )}
              </div>
            </div>

            {/* Selected chips */}
            {selections.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground mr-1">Selected:</span>
                  {selections.map((s) => (
                    <Badge
                      key={`${s.class_id}:${s.section || ''}`}
                      variant="secondary"
                      className="gap-1 pl-2 pr-1 h-6 text-xs"
                      data-testid={`selection-chip-${s.class_name.replace(/\s+/g, '-')}-${s.section || 'All'}`}
                    >
                      {s.class_name}{s.section ? ` · ${s.section}` : ' · All'}
                      <button
                        type="button"
                        onClick={() => removeSelection(s)}
                        className="ml-0.5 hover:bg-muted rounded p-0.5"
                        aria-label={`Remove ${s.class_name} ${s.section || 'All'}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  <button
                    onClick={clearSelections}
                    className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 ml-1"
                  >
                    clear
                  </button>
                </div>
              </div>
            )}

            {/* Download row */}
            <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground truncate max-w-[70%]">
                Showing: <b>{selectionSummary}</b>
                {statusFilter !== 'all' && <> · Status: <b className="capitalize">{statusFilter}</b></>}
                {(fsStartDate || fsEndDate) && (
                  <> · Payment dates: <b>{fsStartDate || '…'}</b> to <b>{fsEndDate || '…'}</b></>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  onClick={dlDueList}
                  disabled={dlLoading || loading}
                  className="gap-1 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90"
                  data-testid="dl-due-list"
                >
                  <ListChecks className="h-3.5 w-3.5" /> Export Due List (XLSX)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => dlFeeStatus('pdf')}
                  disabled={dlLoading || loading}
                  className="gap-1"
                  data-testid="fee-status-download-pdf"
                >
                  <FileText className="h-3.5 w-3.5" /> PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => dlFeeStatus('xlsx')}
                  disabled={dlLoading || loading}
                  className="gap-1"
                  data-testid="fee-status-download-xlsx"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" /> XLSX
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => dlFeeStatus('csv')}
                  disabled={dlLoading || loading}
                  className="gap-1"
                  data-testid="fee-status-download-csv"
                >
                  <Download className="h-3.5 w-3.5" /> CSV
                </Button>
              </div>
            </div>
          </Card>

          {feeStatusData && (
            <>
              {/* Summary cards — simplified, plain-English labels */}
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
                <KpiCard
                  testId="fs-card-students"
                  label="Students"
                  value={feeStatusData.count}
                  hint="in this view"
                />
                <KpiCard
                  testId="fs-card-total-fees"
                  label="Total Fees"
                  value={shortMoney(feeStatusData.summary.total_gross_expected || feeStatusData.summary.total_expected)}
                  hint="before discount"
                />
                <KpiCard
                  testId="fs-card-discount"
                  label="Discount Given"
                  value={shortMoney(feeStatusData.summary.total_discount || 0)}
                  hint={
                    (feeStatusData.summary.total_gross_expected || 0) > 0
                      ? `${Math.round(((feeStatusData.summary.total_discount || 0) / feeStatusData.summary.total_gross_expected) * 1000) / 10}% of total`
                      : 'concessions applied'
                  }
                  tone="amber"
                />
                <KpiCard
                  testId="fs-card-paid"
                  label="Collected"
                  value={shortMoney(feeStatusData.summary.total_paid)}
                  hint={`${feeStatusData.summary.fully_paid_count || 0} students fully paid`}
                  tone="green"
                />
                <KpiCard
                  testId="fs-card-due"
                  label="Outstanding"
                  value={shortMoney(feeStatusData.summary.total_due)}
                  hint={
                    (feeStatusData.summary.students_with_dues || 0) > 0
                      ? `Due till today: ${shortMoney(feeStatusData.summary.total_due_till_date || 0)} · ${feeStatusData.summary.students_with_dues} students`
                      : 'no dues pending'
                  }
                  tone="red"
                />
                <KpiCard
                  testId="fs-card-collection"
                  label="Collection %"
                  value={`${feeStatusData.summary.collection_percent}%`}
                  hint={`${feeStatusData.summary.paid_count} paid · ${feeStatusData.summary.partial_count} partial · ${feeStatusData.summary.unpaid_count} unpaid`}
                />
              </div>

              {/* Quick views & legend */}
              <div className="flex flex-wrap items-center gap-1.5 mb-3">
                <span className="text-xs text-muted-foreground mr-1">Show:</span>
                {[
                  { v: 'all', label: `All students (${feeStatusData.count})` },
                  { v: 'has_dues', label: `Has dues (${feeStatusData.summary.students_with_dues || 0})` },
                  { v: 'fully_paid', label: `Fully paid (${feeStatusData.summary.fully_paid_count || 0})` },
                ].map((q) => (
                  <button
                    key={q.v}
                    type="button"
                    onClick={() => setQuickView(q.v)}
                    data-testid={`quickview-${q.v}`}
                    className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                      quickView === q.v
                        ? 'bg-[hsl(var(--primary))] text-white border-[hsl(var(--primary))]'
                        : 'border-border hover:bg-secondary'
                    }`}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3 mb-4 text-[11px]">
                <span className="text-muted-foreground">Legend:</span>
                <LegendSwatch cls="bg-[#0F766E] text-white" label="Fully paid (all months)" />
                <LegendSwatch cls="bg-[#A7F3D0] text-[#065F46]" label="Month paid" />
                <LegendSwatch cls="bg-[#FDE68A] text-[#92400E]" label="Partial" />
                <LegendSwatch cls="bg-[#FCA5A5] text-[#B42318]" label="Overdue / Due" />
                <LegendSwatch cls="bg-slate-100 text-slate-500 border border-slate-200" label="Upcoming" />
              </div>

              {/* Class/Section rollup */}
              {(feeStatusData.by_class || []).length > 0 && (
                <Card className="border-border overflow-hidden mb-4" data-testid="fs-by-class-table">
                  <div className="px-4 py-2 border-b border-border bg-secondary/60 text-xs font-medium">
                    Class-wise / Section-wise Summary ({feeStatusData.by_class.length} row{feeStatusData.by_class.length === 1 ? '' : 's'})
                  </div>
                  <div className="max-h-[280px] overflow-y-auto">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Class</TableHead>
                        <TableHead>Section</TableHead>
                        <TableHead className="text-right">Students</TableHead>
                        <TableHead className="text-right">Expected</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                        <TableHead className="text-right">Due</TableHead>
                        <TableHead className="text-right">Coll %</TableHead>
                        <TableHead className="text-right">Fully / With Dues</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {feeStatusData.by_class.map((b) => (
                          <TableRow key={`${b.class_id}::${b.section}`}>
                            <TableCell className="font-medium">{b.class_name}</TableCell>
                            <TableCell>{b.section}</TableCell>
                            <TableCell className="text-right tabular-nums">{b.students}</TableCell>
                            <TableCell className="text-right tabular-nums">{money(b.expected)}</TableCell>
                            <TableCell className="text-right tabular-nums text-emerald-700">{money(b.paid)}</TableCell>
                            <TableCell className="text-right tabular-nums text-[#B42318] font-medium">{money(b.due)}</TableCell>
                            <TableCell className="text-right tabular-nums">{b.collection_percent}%</TableCell>
                            <TableCell className="text-right text-xs">
                              <span className="text-[#0F766E] font-medium">{b.fully_paid_count || 0}</span>
                              {' / '}
                              <span className="text-[#B42318] font-medium">{b.students_with_dues || 0}</span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              )}

              {/* Student table — MONTHLY VIEW */}
              <Card className="border-border overflow-hidden" data-testid="report-fee-status-table">
                <div className="px-4 py-2 border-b border-border bg-secondary/60 text-xs font-medium flex items-center justify-between">
                  <span>Students ({filteredRows.length}) — {feeStatusData.academic_session || ''}</span>
                  <span className="text-[10px] text-muted-foreground hidden md:inline">Hover a month cell for details</span>
                </div>
                <div className="overflow-x-auto">
                  <Table className="min-w-[1200px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 bg-secondary/60 z-10 min-w-[180px]">Student</TableHead>
                        <TableHead className="min-w-[80px]">Class</TableHead>
                        {(feeStatusData.rows?.[0]?.monthly_status || []).map((m) => (
                          <TableHead key={m.i} className="text-center px-1 text-[11px]">
                            {(m.label || '').split(' ')[0].slice(0, 3)}
                          </TableHead>
                        ))}
                        <TableHead className="text-right whitespace-nowrap min-w-[110px] pr-3">
                          <div>Due Till Date</div>
                          <div className="text-[9px] font-normal text-muted-foreground normal-case">
                            (past + this month if&gt;15th)
                          </div>
                        </TableHead>
                        <TableHead className="text-right whitespace-nowrap min-w-[110px] pr-4">Total Due</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRows.length === 0 && (
                        <TableRow><TableCell colSpan={17} className="py-8 text-center text-muted-foreground text-sm">
                          No students match filters.
                        </TableCell></TableRow>
                      )}
                      {filteredRows.slice(0, 500).map((r) => (
                        <TableRow key={r.student_id} className="hover:bg-secondary/40" data-testid={`fs-row-${r.student_id}`}>
                          <TableCell className="sticky left-0 bg-card z-10">
                            <div className="font-medium leading-tight">{r.full_name}</div>
                            <div className="text-[11px] text-muted-foreground font-mono">{r.admission_number}</div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs">
                            {r.class_name}{r.section ? `·${r.section}` : ''}
                          </TableCell>
                          {(r.monthly_status || []).map((m) => (
                            <TableCell key={m.i} className="p-0.5 text-center">
                              <MonthCell m={m} fullyPaid={r.fully_paid} monthlyAmount={r.monthly_amount} />
                            </TableCell>
                          ))}
                          <TableCell
                            className={`text-right tabular-nums whitespace-nowrap pr-3 ${(r.due_till_date || 0) > 0 ? 'text-[#B45309] font-semibold' : 'text-slate-400'}`}
                            data-testid={`fs-due-till-date-${r.student_id}`}
                            title={
                              (r.due_till_date || 0) > 0
                                ? `${r.overdue_months || 0} month(s) overdue as of today (school policy: due by 15th)`
                                : 'On track — no monthly instalments overdue'
                            }
                          >
                            {(r.due_till_date || 0) > 0 ? (
                              <div className="leading-tight">
                                <div>{money(r.due_till_date)}</div>
                                {r.overdue_months > 0 && (
                                  <div className="text-[9px] font-normal text-[#B45309]/70">
                                    {r.overdue_months} mo overdue
                                  </div>
                                )}
                              </div>
                            ) : '—'}
                          </TableCell>
                          <TableCell className={`text-right tabular-nums font-semibold whitespace-nowrap pr-4 ${r.due > 0 ? 'text-[#B42318]' : 'text-[#0F766E]'}`}>
                            {r.due > 0 ? money(r.due) : '✓'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {filteredRows.length > 500 && (
                  <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border">
                    Showing first 500 of {filteredRows.length}. Refine filters to narrow down further.
                  </div>
                )}
              </Card>
            </>
          )}
        </TabsContent>

        {/* --------- Due Export --------- */}
        <TabsContent value="due-export">
          <Card className="p-4 md:p-5 border-border mb-4">
            <div className="mb-4">
              <h2 className="h-font text-lg font-semibold flex items-center gap-2">
                <ListChecks className="h-5 w-5" /> Export Due List
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Download an Excel workbook of all students with pending fees, colour-coded month by month.
                Use the filters below to narrow the export by date, classes and sections.
              </p>
            </div>

            {/* Row 1 — Dates */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">As-of Date</Label>
                <Input
                  type="date"
                  value={dueAsOf}
                  onChange={(e) => setDueAsOf(e.target.value)}
                  max={sessionStart > todayISO ? sessionStart : undefined}
                  data-testid="due-as-of-date"
                />
                <span className="text-[10px] text-muted-foreground">Dues are computed as of this date.</span>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">From Date (custom range)</Label>
                <Input
                  type="date"
                  value={dueFrom}
                  onChange={(e) => { setDueFrom(e.target.value); setDueRangePreset('custom'); }}
                  data-testid="due-from-date"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">To Date (custom range)</Label>
                <Input
                  type="date"
                  value={dueTo}
                  onChange={(e) => { setDueTo(e.target.value); setDueRangePreset('custom'); }}
                  data-testid="due-to-date"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Quick Range</Label>
                <Select value={dueRangePreset} onValueChange={applyDuePreset}>
                  <SelectTrigger data-testid="due-range-preset"><SelectValue placeholder="Select range" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Months</SelectItem>
                    <SelectItem value="session">Full Session (Apr–Mar)</SelectItem>
                    <SelectItem value="this_month">This Month</SelectItem>
                    <SelectItem value="last_3_months">Last 3 Months</SelectItem>
                    <SelectItem value="q1">Q1 (Apr–Jun)</SelectItem>
                    <SelectItem value="q2">Q2 (Jul–Sep)</SelectItem>
                    <SelectItem value="q3">Q3 (Oct–Dec)</SelectItem>
                    <SelectItem value="q4">Q4 (Jan–Mar)</SelectItem>
                    <SelectItem value="custom" disabled>Custom (edit dates above)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 2 — Classes & sections */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3 items-end">
              <div className="md:col-span-3 grid gap-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <Layers className="h-3 w-3" /> Classes &amp; Sections
                </Label>
                <Popover open={selectorOpen} onOpenChange={setSelectorOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="w-full flex items-center justify-between gap-2 h-10 px-3 rounded-md border border-border bg-card hover:bg-secondary text-sm text-left transition-colors"
                      data-testid="due-classes-multiselect"
                    >
                      <span className="truncate">
                        {selections.length === 0
                          ? <span className="text-muted-foreground">All classes &amp; sections</span>
                          : <span className="font-medium">{selectionSummary}</span>}
                      </span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[420px] p-0" align="start">
                    {/* Reuse the same content markup — kept inline for simplicity */}
                    <div className="p-3 border-b border-border">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          value={selectorSearch}
                          onChange={(e) => setSelectorSearch(e.target.value)}
                          placeholder="Search class name…"
                          className="pl-9 h-9"
                        />
                      </div>
                      <div className="flex items-center justify-between mt-2 text-xs">
                        <div className="text-muted-foreground">
                          {selections.length} selected of {classes.reduce((n, c) => n + (c.sections?.length || 1), 0)} available
                        </div>
                        {selections.length > 0 && (
                          <button className="text-[hsl(var(--primary))] hover:underline" onClick={clearSelections}>
                            Clear all
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="max-h-[320px] overflow-y-auto p-2">
                      {filteredClassesForSelector.length === 0 && (
                        <div className="py-6 text-center text-sm text-muted-foreground">No classes match.</div>
                      )}
                      {filteredClassesForSelector.map((klass) => {
                        const secs = klass.sections || [];
                        const allSel = isClassAllSelected(klass);
                        return (
                          <div key={klass.id} className="py-2 px-2 rounded-md hover:bg-secondary/60">
                            <div className="flex items-center justify-between">
                              <label className="flex items-center gap-2 cursor-pointer flex-1">
                                <Checkbox checked={allSel} onCheckedChange={() => toggleClassAllSections(klass)} />
                                <span className="font-medium text-sm">{klass.name}</span>
                              </label>
                              <span className="text-xs text-muted-foreground">
                                {secs.length ? `${secs.length} section${secs.length === 1 ? '' : 's'}` : 'no sections'}
                              </span>
                            </div>
                            {secs.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2 pl-6">
                                {secs.map((sec) => {
                                  const on = isSectionSelected(klass.id, sec);
                                  return (
                                    <button
                                      key={sec}
                                      type="button"
                                      onClick={() => toggleSection(klass, sec)}
                                      className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                                        on
                                          ? 'bg-[hsl(var(--primary))] text-white border-[hsl(var(--primary))]'
                                          : 'border-border hover:bg-secondary'
                                      }`}
                                    >
                                      Sec {sec}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="p-2 border-t border-border flex justify-end">
                      <Button size="sm" onClick={() => setSelectorOpen(false)}>Done</Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex items-center gap-2 h-10 pb-0.5">
                <Checkbox
                  id="due-only-with-dues"
                  checked={dueOnlyWithDues}
                  onCheckedChange={(v) => setDueOnlyWithDues(!!v)}
                  data-testid="due-only-with-dues"
                />
                <label htmlFor="due-only-with-dues" className="text-sm cursor-pointer">Only students with dues</label>
              </div>
            </div>

            {/* Selected chips */}
            {selections.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground mr-1">Selected:</span>
                  {selections.map((s) => (
                    <Badge key={`${s.class_id}:${s.section || ''}`} variant="secondary" className="gap-1 pl-2 pr-1 h-6 text-xs">
                      {s.class_name}{s.section ? ` · ${s.section}` : ' · All'}
                      <button type="button" onClick={() => removeSelection(s)} className="ml-1 hover:bg-muted rounded p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Applied summary + Export button */}
            <div className="mt-5 pt-4 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
              <div className="text-xs text-muted-foreground leading-relaxed">
                <div>
                  <span className="font-medium text-slate-700">As-of:</span> {dueAsOf || todayISO}
                </div>
                <div>
                  <span className="font-medium text-slate-700">Range:</span>{' '}
                  {dueFrom || dueTo
                    ? <>{dueFrom || 'session start'} → {dueTo || 'session end'}</>
                    : <>All 12 months</>}
                </div>
                <div>
                  <span className="font-medium text-slate-700">Classes:</span>{' '}
                  {selections.length === 0 ? 'All classes' : selectionSummary}
                </div>
              </div>
              <div className="flex md:justify-end">
                <Button
                  onClick={dlDueExport}
                  disabled={dlLoading}
                  className="gap-2 w-full md:w-auto h-11 px-6"
                  data-testid="due-export-btn"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  {dlLoading ? 'Preparing…' : 'Export Due List (XLSX)'}
                </Button>
              </div>
            </div>
          </Card>

          {/* Guidance card */}
          <Card className="p-4 border-border bg-muted/30">
            <div className="text-xs text-muted-foreground leading-relaxed space-y-1">
              <div className="font-semibold text-slate-700 text-sm mb-1">How this works</div>
              <div>• Every row shows a student's 12-month fee schedule, colour-coded by status.</div>
              <div>• The <span className="font-medium">As-of date</span> tells the system which months should count as overdue vs upcoming.</div>
              <div>• The <span className="font-medium">custom range</span> restricts which month columns are exported and re-sums Total Due for that window.</div>
              <div>• Leaving classes empty exports all classes; otherwise the selected class/section combinations are used.</div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

// ---- Monthly status cell used inside the fee-status table ----
function MonthCell({ m, fullyPaid, monthlyAmount }) {
  const isFullyPaid = fullyPaid && m.status === 'paid';
  const cls = isFullyPaid
    ? 'bg-[#0F766E] text-white border-[#0F766E]'
    : m.status === 'paid'
      ? 'bg-[#A7F3D0] text-[#065F46] border-[#6EE7B7]'
      : m.status === 'partial'
        ? 'bg-[#FDE68A] text-[#92400E] border-[#FCD34D]'
        : m.status === 'overdue'
          ? 'bg-[#FCA5A5] text-[#B42318] border-[#F87171]'
          : 'bg-slate-100 text-slate-500 border-slate-200';
  const icon = isFullyPaid ? <CheckCircle2 className="h-3.5 w-3.5" />
    : m.status === 'paid' ? <CheckCircle2 className="h-3.5 w-3.5" />
    : m.status === 'overdue' ? <AlertTriangle className="h-3.5 w-3.5" />
    : m.status === 'partial' ? <Circle className="h-3.5 w-3.5" />
    : <Circle className="h-3.5 w-3.5 opacity-40" />;
  const dueRs = Math.max(Math.round((monthlyAmount || 0) - (m.paid || 0)), 0);
  const title = `${m.label}\nStatus: ${m.status}\nPaid: ₹${(m.paid || 0).toLocaleString('en-IN')}` +
    ((m.status === 'overdue' || m.status === 'partial') ? `\nDue: ₹${dueRs.toLocaleString('en-IN')}` : '');
  return (
    <div
      title={title}
      className={`w-8 h-8 mx-auto rounded-md border flex items-center justify-center text-[10px] font-medium ${cls}`}
    >
      {icon}
    </div>
  );
}

function LegendSwatch({ cls, label }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-3.5 w-3.5 rounded ${cls}`} />
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

// Simple KPI card used on the Student Fee Status tab.
// Colour tones give quick recognition: green = collected, red = outstanding,
// amber = discount, neutral = counts/percent.
function KpiCard({ label, value, hint, tone = 'neutral', testId }) {
  const styles = {
    neutral: { card: 'bg-white', label: 'text-muted-foreground', value: 'text-slate-900', hint: 'text-muted-foreground' },
    green:   { card: 'bg-[#E6F6F4] border-[#B7E4DC]', label: 'text-[#0F766E]', value: 'text-[#0F766E]', hint: 'text-[#0F766E]/80' },
    red:     { card: 'bg-[#FEE4E2] border-[#FBB4AB]', label: 'text-[#B42318]', value: 'text-[#B42318]', hint: 'text-[#B42318]/80' },
    amber:   { card: 'bg-[#FEF3C7] border-[#FDE68A]', label: 'text-[#92400E]', value: 'text-[#92400E]', hint: 'text-[#92400E]/80' },
  }[tone] || { card: 'bg-white', label: 'text-muted-foreground', value: 'text-slate-900', hint: 'text-muted-foreground' };
  // truncate long values to keep numbers inside the card at all viewport widths;
  // full value is available in the tooltip.
  const valueStr = value == null ? '—' : String(value);
  return (
    <div
      data-testid={testId}
      className={`p-3.5 rounded-lg border ${styles.card} transition-shadow hover:shadow-sm overflow-hidden min-w-0`}
      title={typeof value === 'string' || typeof value === 'number' ? String(value) : undefined}
    >
      <div className={`text-[11px] font-medium uppercase tracking-wide truncate ${styles.label}`}>{label}</div>
      <div
        className={`h-font text-lg sm:text-xl md:text-[1.35rem] font-semibold tabular-nums leading-tight mt-1 truncate ${styles.value}`}
      >
        {valueStr}
      </div>
      {hint && (
        <div className={`text-[11px] mt-1 truncate ${styles.hint}`} title={typeof hint === 'string' ? hint : undefined}>
          {hint}
        </div>
      )}
    </div>
  );
}
