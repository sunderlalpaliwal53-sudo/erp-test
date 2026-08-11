import React from 'react';
import '@/App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { SchoolProvider } from '@/contexts/SchoolContext';
import { ChildProvider } from '@/contexts/ChildContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';

import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Students from '@/pages/Students';
import StudentDetail from '@/pages/StudentDetail';
import FeesStructure from '@/pages/FeesStructure';
import FeeCollection from '@/pages/FeeCollection';
import Receipts from '@/pages/Receipts';
import Attendance from '@/pages/Attendance';
import Homework from '@/pages/Homework';
import Timetable from '@/pages/Timetable';
import Events from '@/pages/Events';
import Circulars from '@/pages/Circulars';
import Gallery from '@/pages/Gallery';
import Staff from '@/pages/Staff';
import Notifications from '@/pages/Notifications';
import Reports from '@/pages/Reports';
import AuditLogs from '@/pages/AuditLogs';
import Settings from '@/pages/Settings';
import Schools from '@/pages/Schools';
import Users from '@/pages/Users';
import Analytics from '@/pages/Analytics';
import Approvals from '@/pages/Approvals';
import Exams from '@/pages/Exams';

import ParentHome from '@/pages/parent/ParentHome';
import ParentPay from '@/pages/parent/ParentPay';
import ParentReceipts from '@/pages/parent/ParentReceipts';
import ParentAttendance from '@/pages/parent/ParentAttendance';
import ParentResults from '@/pages/parent/ParentResults';
import { ParentHomework, ParentTimetable, ParentEvents, ParentCirculars, ParentGallery, ParentNotifications } from '@/pages/parent/ParentReuse';

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'parent') return <Navigate to="/parent" replace />;
  return <Dashboard />;
}

function App() {
  return (
    <AuthProvider>
      <SchoolProvider>
        <ChildProvider>
          <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><HomeRedirect /></ProtectedRoute>} />

            {/* Admin/Staff routes */}
            <Route path="/students" element={<ProtectedRoute roles={['super_admin', 'school_admin', 'accountant', 'teacher']}><Students /></ProtectedRoute>} />
            <Route path="/students/:id" element={<ProtectedRoute roles={['super_admin', 'school_admin', 'accountant', 'teacher']}><StudentDetail /></ProtectedRoute>} />
            <Route path="/fees" element={<ProtectedRoute roles={['super_admin', 'school_admin', 'accountant']}><FeesStructure /></ProtectedRoute>} />
            <Route path="/fees/collect" element={<ProtectedRoute roles={['super_admin', 'school_admin', 'accountant']}><FeeCollection /></ProtectedRoute>} />
            <Route path="/receipts" element={<ProtectedRoute roles={['super_admin', 'school_admin', 'accountant']}><Receipts /></ProtectedRoute>} />
            <Route path="/attendance" element={<ProtectedRoute roles={['super_admin', 'school_admin', 'teacher']}><Attendance /></ProtectedRoute>} />
            <Route path="/homework" element={<ProtectedRoute roles={['super_admin', 'school_admin', 'teacher']}><Homework /></ProtectedRoute>} />
            <Route path="/exams" element={<ProtectedRoute roles={['super_admin', 'school_admin', 'teacher']}><Exams /></ProtectedRoute>} />
            <Route path="/timetable" element={<ProtectedRoute roles={['super_admin', 'school_admin', 'teacher']}><Timetable /></ProtectedRoute>} />
            <Route path="/events" element={<ProtectedRoute roles={['super_admin', 'school_admin']}><Events /></ProtectedRoute>} />
            <Route path="/circulars" element={<ProtectedRoute roles={['super_admin', 'school_admin']}><Circulars /></ProtectedRoute>} />
            <Route path="/gallery" element={<ProtectedRoute roles={['super_admin', 'school_admin']}><Gallery /></ProtectedRoute>} />
            <Route path="/staff" element={<ProtectedRoute roles={['super_admin', 'school_admin']}><Staff /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute roles={['super_admin', 'school_admin', 'teacher']}><Notifications /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute roles={['super_admin', 'school_admin', 'accountant', 'owner']}><Reports /></ProtectedRoute>} />
            <Route path="/audit-logs" element={<ProtectedRoute roles={['super_admin', 'school_admin']}><AuditLogs /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute roles={['super_admin', 'school_admin']}><Settings /></ProtectedRoute>} />
            <Route path="/schools" element={<ProtectedRoute roles={['super_admin']}><Schools /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute roles={['super_admin', 'school_admin', 'owner']}><Users /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute roles={['super_admin', 'school_admin', 'accountant', 'owner']}><Analytics /></ProtectedRoute>} />
            <Route path="/approvals" element={<ProtectedRoute roles={['super_admin', 'school_admin', 'accountant', 'owner']}><Approvals /></ProtectedRoute>} />

            {/* Parent portal */}
            <Route path="/parent" element={<ProtectedRoute roles={['parent']}><ParentHome /></ProtectedRoute>} />
            <Route path="/parent/pay" element={<ProtectedRoute roles={['parent']}><ParentPay /></ProtectedRoute>} />
            <Route path="/parent/receipts" element={<ProtectedRoute roles={['parent']}><ParentReceipts /></ProtectedRoute>} />
            <Route path="/parent/attendance" element={<ProtectedRoute roles={['parent']}><ParentAttendance /></ProtectedRoute>} />
            <Route path="/parent/homework" element={<ProtectedRoute roles={['parent']}><ParentHomework /></ProtectedRoute>} />
            <Route path="/parent/results" element={<ProtectedRoute roles={['parent']}><ParentResults /></ProtectedRoute>} />
            <Route path="/parent/timetable" element={<ProtectedRoute roles={['parent']}><ParentTimetable /></ProtectedRoute>} />
            <Route path="/parent/events" element={<ProtectedRoute roles={['parent']}><ParentEvents /></ProtectedRoute>} />
            <Route path="/parent/circulars" element={<ProtectedRoute roles={['parent']}><ParentCirculars /></ProtectedRoute>} />
            <Route path="/parent/gallery" element={<ProtectedRoute roles={['parent']}><ParentGallery /></ProtectedRoute>} />
            <Route path="/parent/notifications" element={<ProtectedRoute roles={['parent']}><ParentNotifications /></ProtectedRoute>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster position="top-right" richColors closeButton />
        </BrowserRouter>
        </ChildProvider>
      </SchoolProvider>
    </AuthProvider>
  );
}

export default App;
