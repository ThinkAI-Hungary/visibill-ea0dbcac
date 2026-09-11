import React from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation(['transactions', 'common']);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('transactions:filters.search_placeholder', 'Keresés (leírás, partner, összeg...)')}
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
          <SelectValue placeholder={t('transactions:filters.currency_placeholder', 'Pénznem')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('transactions:filters.all_currencies', 'Minden pénznem')}</SelectItem>
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
          <SelectValue placeholder={t('transactions:filters.status_placeholder', 'Státusz')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('transactions:filters.all_statuses', 'Összes státusz')}</SelectItem>
          <SelectItem value="matched">{t('transactions:status.matched', 'Párosított')}</SelectItem>
          <SelectItem value="suggested">{t('transactions:status.suggested', 'Javasolt')}</SelectItem>
          <SelectItem value="auto_settled">{t('transactions:status.auto_settled', 'Rendezett (nincs számla)')}</SelectItem>
          <SelectItem value="unmatched">{t('transactions:status.unmatched', 'Párosítatlan')}</SelectItem>
          <SelectItem value="no_invoice">{t('transactions:status.no_invoice', 'Nincs hozzá számla')}</SelectItem>
          <SelectItem value="invoice_missing">{t('transactions:status.invoice_missing', 'Számla nincs feltöltve')}</SelectItem>
        </SelectContent>
      </Select>

      {/* Type */}
      <Select
        value={filters.type}
        onValueChange={(value) => onFilterChange(prev => ({ ...prev, type: value }))}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder={t('transactions:filters.type_placeholder', 'Típus')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('transactions:filters.all_types', 'Minden típus')}</SelectItem>
          {uniqueTypes.map(type => (
            <SelectItem key={type} value={type}>{type}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Clear button */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onClearFilters}>
          <X className="h-4 w-4 mr-1" /> {t('transactions:filters.clear_filters', 'Szűrők törlése')}
        </Button>
      )}
    </div>
  );
});

export default TransactionFilters;
