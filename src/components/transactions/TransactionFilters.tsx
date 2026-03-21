import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, RotateCcw } from 'lucide-react';
import type { TransactionFilters as Filters } from '@/hooks/useTransactionData';

interface TransactionFiltersProps {
  filters: Filters;
  onFilterChange: (updater: (prev: Filters) => Filters) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  uniqueCurrencies: string[];
  uniqueTypes: string[];
}

const TransactionFilters = React.memo(function TransactionFilters({
  filters,
  onFilterChange,
  onClearFilters,
  hasActiveFilters,
  uniqueCurrencies,
  uniqueTypes,
}: TransactionFiltersProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 p-4 bg-white dark:bg-muted/20 rounded-lg border border-slate-200 dark:border-border/30 shadow-sm">
      {/* Search */}
      <div className="relative col-span-2 md:col-span-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 dark:text-muted-foreground" />
        <Input
          placeholder="Keresés..."
          value={filters.search}
          onChange={(e) => onFilterChange(prev => ({ ...prev, search: e.target.value }))}
          className="pl-9 h-9 bg-white dark:bg-secondary/50 border border-slate-200 dark:border-white/10 focus:border-primary"
        />
      </div>

      {/* Currency */}
      <Select
        value={filters.currency}
        onValueChange={(value) => onFilterChange(prev => ({ ...prev, currency: value }))}
      >
        <SelectTrigger className="h-9 bg-white dark:bg-secondary/50 border border-slate-200 dark:border-white/10">
          <SelectValue placeholder="Pénznem" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Minden pénznem</SelectItem>
          {uniqueCurrencies.map(currency => (
            <SelectItem key={currency} value={currency}>{currency}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Match Status */}
      <Select
        value={filters.matchStatus}
        onValueChange={(value) => onFilterChange(prev => ({ ...prev, matchStatus: value }))}
      >
        <SelectTrigger className="h-9 bg-white dark:bg-secondary/50 border border-slate-200 dark:border-white/10">
          <SelectValue placeholder="Státusz" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Minden státusz</SelectItem>
          <SelectItem value="matched">Párosított</SelectItem>
          <SelectItem value="suggested">Javasolt</SelectItem>
          <SelectItem value="unmatched">Párosítatlan</SelectItem>
        </SelectContent>
      </Select>

      {/* Type */}
      <Select
        value={filters.type}
        onValueChange={(value) => onFilterChange(prev => ({ ...prev, type: value }))}
      >
        <SelectTrigger className="h-9 bg-white dark:bg-secondary/50 border border-slate-200 dark:border-white/10">
          <SelectValue placeholder="Típus" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Minden típus</SelectItem>
          {uniqueTypes.map(type => (
            <SelectItem key={type} value={type}>{type}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Clear button */}
      {hasActiveFilters && (
        <Button
          variant="outline"
          size="sm"
          onClick={onClearFilters}
          className="h-9 text-red-500 dark:text-red-400 border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600"
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Szűrők törlése
        </Button>
      )}
    </div>
  );
});

export default TransactionFilters;
