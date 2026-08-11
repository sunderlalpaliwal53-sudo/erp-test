import React, { useState } from 'react';
import { useSchool } from '@/contexts/SchoolContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Building2, Check, ChevronsUpDown } from 'lucide-react';
import { toast } from 'sonner';

export const SchoolSwitcher = () => {
  const { schools, activeSchool, switchSchool } = useSchool();
  const [open, setOpen] = useState(false);
  if (!schools?.length) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          data-testid="school-switcher-trigger"
          className="flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-card hover:bg-secondary transition-colors text-sm"
        >
          <Building2 className="h-4 w-4 text-[hsl(var(--primary))]" />
          <span className="font-medium max-w-[180px] truncate">{activeSchool ? activeSchool.name.replace('Stanvard School - ', '') : 'Select School'}</span>
          {activeSchool?.code && <span className="text-xs text-muted-foreground">• {activeSchool.code}</span>}
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="end">
        <Command>
          <CommandInput data-testid="school-switcher-search-input" placeholder="Search branches…" />
          <CommandList>
            <CommandEmpty>No branches found.</CommandEmpty>
            <CommandGroup heading="Branches">
              {schools.map((s) => (
                <CommandItem
                  key={s.id}
                  data-testid={`school-switcher-option-${s.code?.toLowerCase() || s.id}`}
                  onSelect={() => {
                    switchSchool(s.id);
                    setOpen(false);
                    toast.success(`Switched to ${s.name.replace('Stanvard School - ', '')}`);
                  }}
                  className="flex items-center justify-between"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{s.name.replace('Stanvard School - ', '')}</span>
                    <span className="text-xs text-muted-foreground">{s.city} • {s.code}</span>
                  </div>
                  {activeSchool?.id === s.id && <Check className="h-4 w-4 text-[hsl(var(--primary))]" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
