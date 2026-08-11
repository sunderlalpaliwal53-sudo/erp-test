import React, { useRef, useState } from 'react';
import { api, downloadBlob } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Upload, FileDown } from 'lucide-react';

const TEMPLATE = [
  'full_name,class_name,section,roll_number,dob,gender,father_name,mother_name,phone,email,admission_number',
  '"Rahul Sharma","Class I",A,1,2018-05-12,Male,Rajesh Sharma,Sunita Sharma,+91 9810012345,rahul@example.com,',
].join('\n');

export function ImportStudentsDialog({ open, onOpenChange, onDone }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  const close = (v) => {
    if (!v) { setFile(null); setResult(null); }
    onOpenChange(v);
  };

  const submit = async () => {
    if (!file) { toast.error('Choose a CSV file first'); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post('/students/import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(data);
      toast.success(`Imported ${data.created} student(s)`);
      if (data.created > 0 && onDone) onDone();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Import failed');
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-lg" data-testid="students-import-dialog">
        <DialogHeader><DialogTitle>Import Students from CSV</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            Upload a CSV with columns: <code className="text-xs">full_name, class_name, section, roll_number, dob, gender, father_name, mother_name, phone, email, admission_number</code>.
            Only <code className="text-xs">full_name</code> is required. Class names must match existing classes; admission numbers are auto-generated when empty.
          </p>
          <Button variant="outline" size="sm" className="w-fit gap-2" data-testid="import-template-download"
            onClick={() => downloadBlob(new Blob([TEMPLATE], { type: 'text/csv' }), 'students_import_template.csv')}>
            <FileDown className="h-4 w-4" /> Download Template
          </Button>
          <input ref={inputRef} type="file" accept=".csv" data-testid="import-file-input"
            className="text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-secondary file:px-3 file:py-1.5 file:text-sm"
            onChange={(e) => setFile(e.target.files?.[0] || null)} />
          {result && (
            <div className="rounded-md border border-border bg-secondary/40 p-3 text-sm" data-testid="import-result">
              <div><b>{result.created}</b> student(s) imported, <b>{result.skipped}</b> skipped.</div>
              {result.errors?.length > 0 && (
                <ul className="mt-2 max-h-32 overflow-y-auto text-xs text-muted-foreground list-disc pl-4">
                  {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button data-testid="import-submit-button" onClick={submit} disabled={busy || !file} className="gap-2">
            <Upload className="h-4 w-4" /> {busy ? 'Importing…' : 'Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
