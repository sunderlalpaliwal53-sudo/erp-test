import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, Users, GraduationCap, Wallet, Receipt, CalendarCheck,
  BookOpen, CalendarDays, Megaphone, Image, Users2, Bell, FileBarChart,
  Settings, ShieldCheck, School, ClipboardList, HeartHandshake, BarChart3, Menu,
  BadgeCheck, Award,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';

const navFor = {
  super_admin: [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/analytics', icon: BarChart3, label: 'Analytics' },
    { to: '/schools', icon: School, label: 'Schools' },
    { to: '/users', icon: Users, label: 'Users' },
    { to: '/students', icon: GraduationCap, label: 'Students' },
    { to: '/fees', icon: Wallet, label: 'Fee Structures' },
    { to: '/fees/collect', icon: Receipt, label: 'Collect Fee' },
    { to: '/approvals', icon: BadgeCheck, label: 'Approvals' },
    { to: '/receipts', icon: Receipt, label: 'Receipts' },
    { to: '/attendance', icon: CalendarCheck, label: 'Attendance' },
    { to: '/homework', icon: BookOpen, label: 'Homework' },
    { to: '/exams', icon: Award, label: 'Exams' },
    { to: '/timetable', icon: ClipboardList, label: 'Timetable' },
    { to: '/events', icon: CalendarDays, label: 'Events' },
    { to: '/circulars', icon: Megaphone, label: 'Circulars' },
    { to: '/gallery', icon: Image, label: 'Gallery' },
    { to: '/staff', icon: Users2, label: 'Staff' },
    { to: '/notifications', icon: Bell, label: 'Notifications' },
    { to: '/reports', icon: FileBarChart, label: 'Reports' },
    { to: '/audit-logs', icon: ShieldCheck, label: 'Audit Logs' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ],
  school_admin: [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/analytics', icon: BarChart3, label: 'Analytics' },
    { to: '/users', icon: Users, label: 'Users' },
    { to: '/students', icon: GraduationCap, label: 'Students' },
    { to: '/fees', icon: Wallet, label: 'Fee Structures' },
    { to: '/fees/collect', icon: Receipt, label: 'Collect Fee' },
    { to: '/approvals', icon: BadgeCheck, label: 'Approvals' },
    { to: '/receipts', icon: Receipt, label: 'Receipts' },
    { to: '/attendance', icon: CalendarCheck, label: 'Attendance' },
    { to: '/homework', icon: BookOpen, label: 'Homework' },
    { to: '/exams', icon: Award, label: 'Exams' },
    { to: '/timetable', icon: ClipboardList, label: 'Timetable' },
    { to: '/events', icon: CalendarDays, label: 'Events' },
    { to: '/circulars', icon: Megaphone, label: 'Circulars' },
    { to: '/gallery', icon: Image, label: 'Gallery' },
    { to: '/staff', icon: Users2, label: 'Staff' },
    { to: '/notifications', icon: Bell, label: 'Notifications' },
    { to: '/reports', icon: FileBarChart, label: 'Reports' },
    { to: '/audit-logs', icon: ShieldCheck, label: 'Audit Logs' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ],
  accountant: [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/analytics', icon: BarChart3, label: 'Analytics' },
    { to: '/fees/collect', icon: Receipt, label: 'Collect Fee' },
    { to: '/approvals', icon: BadgeCheck, label: 'My Approvals' },
    { to: '/receipts', icon: Receipt, label: 'Receipts' },
    { to: '/students', icon: GraduationCap, label: 'Students' },
    { to: '/reports', icon: FileBarChart, label: 'Reports' },
  ],
  owner: [
    { to: '/', icon: LayoutDashboard, label: 'Home' },
    { to: '/approvals', icon: BadgeCheck, label: 'Approvals' },
    { to: '/analytics', icon: BarChart3, label: 'Analytics' },
    { to: '/reports', icon: FileBarChart, label: 'Reports' },
    { to: '/users', icon: Users, label: 'Users' },
  ],
  teacher: [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/attendance', icon: CalendarCheck, label: 'Attendance' },
    { to: '/homework', icon: BookOpen, label: 'Homework' },
    { to: '/exams', icon: Award, label: 'Exams' },
    { to: '/students', icon: GraduationCap, label: 'Students' },
    { to: '/timetable', icon: ClipboardList, label: 'Timetable' },
    { to: '/notifications', icon: Bell, label: 'Notifications' },
  ],
  parent: [
    { to: '/parent', icon: HeartHandshake, label: 'Home' },
    { to: '/parent/pay', icon: Wallet, label: 'Pay Fees' },
    { to: '/parent/receipts', icon: Receipt, label: 'Receipts' },
    { to: '/parent/attendance', icon: CalendarCheck, label: 'Attendance' },
    { to: '/parent/homework', icon: BookOpen, label: 'Homework' },
    { to: '/parent/results', icon: Award, label: 'Results' },
    { to: '/parent/timetable', icon: ClipboardList, label: 'Timetable' },
    { to: '/parent/events', icon: CalendarDays, label: 'Events' },
    { to: '/parent/circulars', icon: Megaphone, label: 'Circulars' },
    { to: '/parent/gallery', icon: Image, label: 'Gallery' },
    { to: '/parent/notifications', icon: Bell, label: 'Notifications' },
  ],
};

export const Sidebar = () => {
  const { user } = useAuth();
  const items = navFor[user?.role] || [];
  return (
    <aside className="hidden lg:flex w-[260px] flex-col border-r border-border bg-[hsl(var(--secondary))]/40 h-[calc(100vh-56px)] sticky top-14 overflow-y-auto">
      <div className="px-3 py-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground px-2 mb-2">Navigation</div>
        <NavList items={items} />
      </div>
    </aside>
  );
};

const NavList = ({ items, onNavigate }) => (
  <nav className="flex flex-col gap-0.5">
    {items.map((it) => (
      <NavLink
        key={it.to}
        to={it.to}
        end={it.to === '/' || it.to === '/parent'}
        onClick={onNavigate}
        data-testid={`nav-${it.label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
        className={({ isActive }) =>
          `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
            isActive
              ? 'bg-card text-foreground font-medium shadow-[0_1px_2px_rgba(16,24,40,0.06)] border border-border'
              : 'text-foreground/75 hover:bg-card hover:text-foreground'
          }`
        }
      >
        <it.icon className="h-4 w-4 text-[hsl(var(--primary))]" />
        <span>{it.label}</span>
      </NavLink>
    ))}
  </nav>
);

/**
 * MobileSidebar — hamburger-triggered drawer that shows the same nav on small screens.
 * Placed in the Header for mobile/tablet (<lg) breakpoints.
 */
export const MobileSidebar = () => {
  const { user } = useAuth();
  const items = navFor[user?.role] || [];
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          data-testid="mobile-nav-trigger"
          aria-label="Open navigation"
          className="lg:hidden h-9 w-9 -ml-1 rounded-md hover:bg-secondary flex items-center justify-center"
        >
          <Menu className="h-5 w-5 text-foreground" />
        </button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[280px] p-0 flex flex-col bg-card"
      >
        <SheetHeader className="px-4 py-3 border-b border-border">
          <SheetTitle className="text-left h-font text-base font-semibold">Navigation</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <NavList items={items} onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
};
