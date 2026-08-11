import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';

export function EditStudentDialog({ open, onOpenChange, student, classes, onSaved }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (student) setForm({ ...student });
  }, [student]);

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        admission_number: form.admission_number, roll_number: form.roll_number, full_name: form.full_name,
        dob: form.dob, gender: form.gender, blood_group: form.blood_group, religion: form.religion,
        category: form.category, class_id: form.class_id, section: form.section,
        father_name: form.father_name, mother_name: form.mother_name, guardian_name: form.guardian_name,
        phone: form.phone, email: form.email, address: form.address,
        transport_route: form.transport_route, medical_info: form.medical_info,
        previous_school: form.previous_school, scholarship: form.scholarship,
        fee_category: form.fee_category, photo_url: form.photo_url,
        remarks: form.remarks, admission_date: form.admission_date, status: form.status,
      };
      await api.patch(`/students/${student.id}`, payload);
      toast.success('Student updated');
      onOpenChange(false);
      onSaved && onSaved();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  if (!student) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit Student — {student.full_name}</DialogTitle></DialogHeader>
        <form onSubmit={submit}>
          <Tabs defaultValue="basic">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="family">Family</TabsTrigger>
              <TabsTrigger value="academic">Academic</TabsTrigger>
              <TabsTrigger value="other">Other</TabsTrigger>
            </TabsList>
            <TabsContent value="basic" className="grid grid-cols-2 gap-4 pt-4">
              <div className="grid gap-1.5"><Label>Full Name</Label><Input required value={form.full_name || ''} onChange={(e) => upd('full_name', e.target.value)} data-testid="edit-student-name" /></div>
              <div className="grid gap-1.5"><Label>Admission No.</Label><Input value={form.admission_number || ''} onChange={(e) => upd('admission_number', e.target.value)} /></div>
              <div className="grid gap-1.5"><Label>Roll No.</Label><Input value={form.roll_number || ''} onChange={(e) => upd('roll_number', e.target.value)} /></div>
              <div className="grid gap-1.5"><Label>Date of Birth</Label><Input type="date" value={form.dob || ''} onChange={(e) => upd('dob', e.target.value)} /></div>
              <div className="grid gap-1.5"><Label>Gender</Label>
                <Select value={form.gender || ''} onValueChange={(v) => upd('gender', v)}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent></Select>
              </div>
              <div className="grid gap-1.5"><Label>Blood Group</Label>
                <Select value={form.blood_group || ''} onValueChange={(v) => upd('blood_group', v)}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="grid gap-1.5"><Label>Religion</Label><Input value={form.religion || ''} onChange={(e) => upd('religion', e.target.value)} /></div>
              <div className="grid gap-1.5"><Label>Category</Label>
                <Select value={form.category || ''} onValueChange={(v) => upd('category', v)}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{['General', 'OBC', 'SC', 'ST', 'EWS'].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="grid gap-1.5"><Label>Status</Label>
                <Select value={form.status || 'active'} onValueChange={(v) => upd('status', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select>
              </div>
              <div className="grid gap-1.5"><Label>Photo URL</Label><Input value={form.photo_url || ''} onChange={(e) => upd('photo_url', e.target.value)} /></div>
            </TabsContent>
            <TabsContent value="family" className="grid grid-cols-2 gap-4 pt-4">
              <div className="grid gap-1.5"><Label>Father's Name</Label><Input value={form.father_name || ''} onChange={(e) => upd('father_name', e.target.value)} /></div>
              <div className="grid gap-1.5"><Label>Mother's Name</Label><Input value={form.mother_name || ''} onChange={(e) => upd('mother_name', e.target.value)} /></div>
              <div className="grid gap-1.5"><Label>Guardian's Name</Label><Input value={form.guardian_name || ''} onChange={(e) => upd('guardian_name', e.target.value)} /></div>
              <div className="grid gap-1.5"><Label>Phone</Label><Input value={form.phone || ''} onChange={(e) => upd('phone', e.target.value)} /></div>
              <div className="grid gap-1.5"><Label>Email</Label><Input type="email" value={form.email || ''} onChange={(e) => upd('email', e.target.value)} /></div>
              <div className="grid gap-1.5 col-span-2"><Label>Address</Label><Textarea rows={2} value={form.address || ''} onChange={(e) => upd('address', e.target.value)} /></div>
            </TabsContent>
            <TabsContent value="academic" className="grid grid-cols-2 gap-4 pt-4">
              <div className="grid gap-1.5"><Label>Class</Label>
                <Select value={form.class_id || ''} onValueChange={(v) => upd('class_id', v)}><SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger><SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="grid gap-1.5"><Label>Section</Label>
                <Select value={form.section || ''} onValueChange={(v) => upd('section', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['A', 'B', 'C', 'D'].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="grid gap-1.5"><Label>Admission Date</Label><Input type="date" value={form.admission_date || ''} onChange={(e) => upd('admission_date', e.target.value)} /></div>
              <div className="grid gap-1.5"><Label>Previous School</Label><Input value={form.previous_school || ''} onChange={(e) => upd('previous_school', e.target.value)} /></div>
              <div className="grid gap-1.5"><Label>Scholarship</Label><Input value={form.scholarship || ''} onChange={(e) => upd('scholarship', e.target.value)} /></div>
              <div className="grid gap-1.5"><Label>Fee Category</Label><Input value={form.fee_category || ''} onChange={(e) => upd('fee_category', e.target.value)} /></div>
            </TabsContent>
            <TabsContent value="other" className="grid grid-cols-2 gap-4 pt-4">
              <div className="grid gap-1.5"><Label>Transport Route</Label><Input value={form.transport_route || ''} onChange={(e) => upd('transport_route', e.target.value)} /></div>
              <div className="grid gap-1.5 col-span-2"><Label>Medical Info</Label><Textarea rows={2} value={form.medical_info || ''} onChange={(e) => upd('medical_info', e.target.value)} /></div>
              <div className="grid gap-1.5 col-span-2"><Label>Remarks</Label><Textarea rows={2} value={form.remarks || ''} onChange={(e) => upd('remarks', e.target.value)} /></div>
            </TabsContent>
          </Tabs>
          <DialogFooter className="mt-6">
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving} data-testid="edit-student-submit">{saving ? 'Saving…' : 'Save Changes'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
