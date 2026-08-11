import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { SchoolSwitcher } from './SchoolSwitcher';
import { MobileSidebar } from './Sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { LogOut, GraduationCap, Bell } from 'lucide-react';

const roleLabel = {
  super_admin: 'Super Admin',
  school_admin: 'School Admin',
  accountant: 'Accountant',
  teacher: 'Teacher',
  parent: 'Parent',
  owner: 'Owner',
};

export const Header = () => {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const initials = (user?.full_name || 'U').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();
  return (
    <header className="h-14 sticky top-0 z-40 bg-card border-b border-border flex items-center gap-2 sm:gap-3 px-3 sm:px-4 lg:px-6">
      <MobileSidebar />
      <Link to={user?.role === 'parent' ? '/parent' : '/'} className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-md bg-[hsl(var(--primary))] flex items-center justify-center shrink-0">
          <GraduationCap className="h-5 w-5 text-[hsl(var(--primary-foreground))]" />
        </div>
        <div className="leading-tight hidden xs:block sm:block">
          <div className="h-font text-sm font-semibold text-foreground">Stanvard</div>
          <div className="text-[10px] text-muted-foreground -mt-0.5">School ERP</div>
        </div>
      </Link>
      <div className="flex-1" />
      <div className="hidden md:block">
        <SchoolSwitcher />
      </div>
      <button data-testid="header-notifications" className="h-9 w-9 rounded-md hover:bg-secondary flex items-center justify-center shrink-0">
        <Bell className="h-4 w-4 text-muted-foreground" />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button data-testid="header-user-menu" className="flex items-center gap-2 h-9 px-2 rounded-md hover:bg-secondary shrink-0">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-[hsl(var(--primary))] text-white text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="hidden sm:block text-left leading-tight">
              <div className="text-sm font-medium">{user?.full_name}</div>
              <div className="text-[10px] text-muted-foreground">{roleLabel[user?.role] || user?.role}</div>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="text-sm font-medium">{user?.full_name}</div>
            <div className="text-xs text-muted-foreground font-normal">{user?.email}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <div className="md:hidden px-2 py-1.5">
            <SchoolSwitcher />
          </div>
          <DropdownMenuSeparator className="md:hidden" />
          <DropdownMenuItem data-testid="header-logout" onClick={() => { logout(); nav('/login'); }}>
            <LogOut className="h-4 w-4 mr-2" /> Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
};
