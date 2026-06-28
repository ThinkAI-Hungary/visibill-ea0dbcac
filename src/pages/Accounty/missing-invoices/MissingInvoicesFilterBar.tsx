import React from 'react';
import { Search } from 'lucide-react';

interface MissingInvoicesFilterBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  sourceFilter: string;
  onSourceFilterChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
}

export function MissingInvoicesFilterBar({
  searchTerm,
  onSearchChange,
  sourceFilter,
  onSourceFilterChange,
  statusFilter,
  onStatusFilterChange,
}: MissingInvoicesFilterBarProps) {
  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="relative w-full md:w-[400px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input 
          type="text" 
          placeholder="Keresés szállító, leírás..." 
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-soft"
        />
      </div>
      <div className="flex items-center gap-3 w-full md:w-auto">
        <select 
          value={sourceFilter}
          onChange={(e) => onSourceFilterChange(e.target.value)}
          className="px-3 py-2 bg-card border border-border rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-soft cursor-pointer min-w-[140px]"
        >
          <option value="Minden forrás">Minden forrás</option>
          <option value="NAV">NAV</option>
          <option value="Bank">Bank</option>
          <option value="Bér">Bér</option>
          <option value="Kézi">Kézi</option>
        </select>
        <select 
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          className="px-3 py-2 bg-card border border-border rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-soft cursor-pointer min-w-[120px]"
        >
          <option value="Minden">Minden</option>
          <option value="Sürgős">Sürgős</option>
          <option value="Bekérésre vár">Bekérésre vár</option>
        </select>
      </div>
    </div>
  );
}
