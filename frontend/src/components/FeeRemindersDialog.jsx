import React, { useState } from 'react';
import { api, money } from '@/lib/api';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, Loader2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

const REMINDER_MONTHS = [
  { n: 4, label: 'April' }, { n: 5, label: 'May' }, { n: 6, label: 'June' },
  { n: 7, label: 'July' }, { n: 8, label: 'August' }, { n: 9, label: 'September' },
  { n: 10, label: 'October' }, { n: 11, label: 'November' }, { n: 12, label: 'December' },
  { n: 1, label: 'January' }, { n: 2, label: 'February' }, { n: 3, label: 'March' },
];

export function FeeRemindersDialog({ open, onOpenChange, classes }) {
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [classId, setClassId] = useState('all');
  const [channel, setChannel] = useState('sms');
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const classParam = classId === 'all' ? undefined : classId;

  const loadPreview = async () => {
    setBusy(true); setResult(null);
    try {
      const { data } = await api.get('/messaging/pending', {
        params: { month: Number(month), class_id: classParam },
      });
      setPreview(data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Preview failed');
    } finally { setBusy(false); }
  };

  const send = async () => {
    setBusy(true);
    try {
      const { data } = await api.post('/messaging/fee-reminders', {
        month: Number(month), channel, class_id: classParam || null,
      });
      setResult(data);
      if (data.sent > 0) toast.success(`${data.sent} reminder(s) sent via ${channel.toUpperCase()}`);
      if (data.failed > 0) toast.warning(`${data.failed} failed — trial accounts deliver only to Twilio-verified numbers`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Send failed');
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="fee-reminders-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5" /> Send Fee Reminders</DialogTitle>
          <DialogDescription>SMS / WhatsApp reminders to parents with pending fees for the selected month.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">Month</Label>
              <Select value={month} onValueChange={(v) => { setMonth(v); setPreview(null); setResult(null); }}>
                <SelectTrigger data-testid="reminder-month-select"><SelectValue /></SelectTrigger>
                <SelectContent>{REMINDER_MONTHS.map((m) => <SelectItem key={m.n} value={String(m.n)}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Class</Label>
              <Select value={classId} onValueChange={(v) => { setClassId(v); setPreview(null); setResult(null); }}>
                <SelectTrigger data-testid="reminder-class-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {(classes || []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Channel</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger data-testid="reminder-channel-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
            Trial account: SMS delivers only to numbers <b>verified in the Twilio console</b>; WhatsApp requires parents to <b>join the sandbox</b> first.
          </div>

          <Button variant="outline" size="sm" onClick={loadPreview} disabled={busy} className="w-fit gap-2" data-testid="reminder-preview-button">
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Preview recipients
          </Button>

          {preview && !result && (
            <div className="rounded-md border border-border bg-secondary/40 p-3 text-sm" data-testid="reminder-preview">
              <div><b>{preview.count}</b> parent(s) with pending fees — total <b>{money(preview.total_amount)}</b></div>
              {preview.rows?.length > 0 && (
                <ul className="mt-2 max-h-36 overflow-y-auto text-xs text-muted-foreground space-y-1">
                  {preview.rows.slice(0, 12).map((r) => (
                    <li key={r.student_id}>{r.student_name} ({r.class_name}) — {money(r.remaining)} {r.phone ? '' : '· no phone'}</li>
                  ))}
                  {preview.rows.length > 12 && <li>…and {preview.rows.length - 12} more</li>}
                </ul>
              )}
            </div>
          )}

          {result && (
            <div className="rounded-md border border-border bg-secondary/40 p-3 text-sm" data-testid="reminder-result">
              <div className="flex gap-2 mb-2">
                <Badge data-testid="reminder-sent-count">Sent: {result.sent}</Badge>
                <Badge variant="secondary" data-testid="reminder-failed-count">Failed: {result.failed}</Badge>
                <Badge variant="secondary">Skipped: {result.skipped}</Badge>
              </div>
              <ul className="max-h-40 overflow-y-auto text-xs text-muted-foreground space-y-1">
                {(result.results || []).filter((r) => !r.sent).slice(0, 10).map((r) => (
                  <li key={r.student_id}>{r.student_name}: {r.error || Object.values(r.channels || {}).map((c) => c.error).filter(Boolean)[0] || 'failed'}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={send} disabled={busy || !preview || preview.count === 0} className="gap-2" data-testid="reminder-send-button">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {busy ? 'Sending…' : 'Send Reminders'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
