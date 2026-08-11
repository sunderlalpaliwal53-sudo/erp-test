import React from 'react';
import { useChild } from '@/contexts/ChildContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown, Check, Users2 } from 'lucide-react';

const initials = (name) => (name || '').split(/\s+/).filter(Boolean).map((x) => x[0]).slice(0, 2).join('').toUpperCase() || 'S';

export function ChildSwitcher() {
  const { children, activeChild, selectChild, hasMultiple } = useChild();
  if (!activeChild) return null;

  // Single-child parents: just show a static badge.
  if (!hasMultiple) {
    return (
      <div className="flex items-center gap-2 text-sm" data-testid="child-switcher-single">
        <Avatar className="h-7 w-7">
          <AvatarFallback className="bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] text-xs font-medium">
            {initials(activeChild.full_name)}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="font-medium leading-tight">{activeChild.full_name}</div>
          <div className="text-[11px] text-muted-foreground">{activeChild.admission_number}</div>
        </div>
      </div>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 h-10 px-2 pr-3 rounded-md border border-border bg-card hover:bg-secondary/60 transition-colors"
          data-testid="child-switcher-trigger"
        >
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] text-xs font-medium">
              {initials(activeChild.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="text-left">
            <div className="text-sm font-medium leading-tight">{activeChild.full_name}</div>
            <div className="text-[11px] text-muted-foreground">
              {activeChild.admission_number} · {children.length} kids
            </div>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-1" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="end">
        <div className="p-2 border-b border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground px-2 py-1">
            <Users2 className="h-3.5 w-3.5" />
            <span>Switch between your children</span>
          </div>
        </div>
        <div className="p-1 max-h-72 overflow-y-auto">
          {children.map((c) => {
            const isActive = c.id === activeChild.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => selectChild(c.id)}
                className={`w-full flex items-center gap-2 px-2 py-2 rounded-md text-left hover:bg-secondary/60 transition-colors ${isActive ? 'bg-secondary/60' : ''}`}
                data-testid={`child-option-${c.id}`}
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] text-xs font-medium">
                    {initials(c.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{c.full_name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{c.admission_number}</div>
                </div>
                {isActive && <Check className="h-4 w-4 text-[hsl(var(--primary))]" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
