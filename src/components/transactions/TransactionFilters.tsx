import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, X } from 'lucide-react';
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
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Keresés (leírás, partner, összeg...)"
          value={filters.search}
          onChange={(e) => onFilterChange(prev => ({ ...prev, search: e.target.value }))}
          className="pl-9"
        />
      </div>

      {/* Currency */}
      <Select
        value={filters.currency}
        onValueChange={(value) => onFilterChange(prev => ({ ...prev, currency: value }))}
      >
        <SelectTrigger className="w-[180px]">
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
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Státusz" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Összes státusz</SelectItem>
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
        <SelectTrigger className="w-[180px]">
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
        <Button variant="ghost" size="sm" onClick={onClearFilters}>
          <X className="h-4 w-4 mr-1" /> Szűrők törlése
        </Button>
      )}
    </div>
  );
});

export default TransactionFilters;
