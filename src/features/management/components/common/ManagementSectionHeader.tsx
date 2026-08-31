import React from 'react';
import { CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

export function SectionHeader({
  icon: Icon,
  title,
  searchValue,
  onSearch,
  placeholder,
}: {
  icon: React.ElementType;
  title: string;
  searchValue: string;
  onSearch: (v: string) => void;
  placeholder: string;
}) {
  return (
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between gap-4">
        <CardTitle className="text-base font-semibold flex items-center gap-2 shrink-0">
          <Icon className="h-4 w-4 text-primary" aria-hidden="true" /> {title}
        </CardTitle>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder={placeholder}
            value={searchValue}
            onChange={e => onSearch(e.target.value)}
            className="pl-9 h-8 text-xs"
            aria-label={placeholder}
          />
        </div>
      </div>
    </CardHeader>
  );
}
