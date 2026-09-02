import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Search, CalendarIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { useInvoiceContext } from '../../context/useInvoiceContext';

export function InvoiceFilterBar() {
  const {
    filters,
    setFilters,
    activeTab,
    isSubmittedTab,
    categories,
    projects,
    submittedInvoices,
    getPaymentMethodLabel,
    hasAnyActiveFilter,
    clearAllFilters,
  } = useInvoiceContext();

  const [issueDateFromOpen, setIssueDateFromOpen] = useState(false);
  const [issueDateToOpen, setIssueDateToOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-3 min-h-[88px]">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 dark:text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Keresés (partner, bizonylat, összeg...)"
          value={filters.search}
          onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
          className="pl-9"
        />
      </div>

      {/* Date Range Popovers */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Kibocsátás:</span>
        <Popover open={issueDateFromOpen} onOpenChange={setIssueDateFromOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'h-9 text-xs px-2.5 justify-start font-normal min-w-[130px]',
                filters.issueDateFrom &&
                  'bg-primary/10 border-primary/50 text-primary dark:bg-primary/10 dark:border-primary dark:text-primary'
              )}
            >
              <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
              {filters.issueDateFrom
                ? format(new Date(filters.issueDateFrom), 'yyyy. MMM dd.', { locale: hu })
                : 'Dátum -tól'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={filters.issueDateFrom ? new Date(filters.issueDateFrom) : undefined}
              onSelect={(date) => {
                const dateStr = date ? format(date, 'yyyy-MM-dd') : '';
                setFilters(prev => ({
                  ...prev,
                  issueDateFrom: dateStr,
                  issueDateTo: dateStr && !prev.issueDateTo ? format(new Date(), 'yyyy-MM-dd') : prev.issueDateTo,
                }));
                setIssueDateFromOpen(false);
              }}
              disabled={filters.issueDateTo ? { after: new Date(filters.issueDateTo) } : undefined}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>

        <span className="text-xs text-muted-foreground">–</span>

        <Popover open={issueDateToOpen} onOpenChange={setIssueDateToOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'h-9 text-xs px-2.5 justify-start font-normal min-w-[130px]',
                filters.issueDateTo &&
                  'bg-primary/10 border-primary/50 text-primary dark:bg-primary/10 dark:border-primary dark:text-primary'
              )}
            >
              <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
              {filters.issueDateTo
                ? format(new Date(filters.issueDateTo), 'yyyy. MMM dd.', { locale: hu })
                : 'Dátum -ig'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={filters.issueDateTo ? new Date(filters.issueDateTo) : undefined}
              onSelect={(date) => {
                setFilters(prev => ({ ...prev, issueDateTo: date ? format(date, 'yyyy-MM-dd') : '' }));
                setIssueDateToOpen(false);
              }}
              disabled={filters.issueDateFrom ? { before: new Date(filters.issueDateFrom) } : undefined}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>

        {(filters.issueDateFrom || filters.issueDateTo) && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setFilters(prev => ({ ...prev, issueDateFrom: '', issueDateTo: '' }))}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Currency Select */}
      <Select value={filters.currency} onValueChange={(value) => setFilters(prev => ({ ...prev, currency: value }))}>
        <SelectTrigger className="h-9 w-[180px]">
          <span className="truncate">{filters.currency === 'all' ? 'Pénznem' : filters.currency}</span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Minden pénznem</SelectItem>
          {isSubmittedTab
            ? Array.from(new Set(submittedInvoices.map(inv => inv.penznem).filter(Boolean)))
                .sort()
                .map((currency) => (
                  <SelectItem key={currency} value={currency!}>
                    {currency}
                  </SelectItem>
                ))
            : ['HUF', 'EUR', 'USD', 'GBP', 'CHF', 'CZK', 'PLN', 'RON'].map((currency) => (
                <SelectItem key={currency} value={currency}>
                  {currency}
                </SelectItem>
              ))}
        </SelectContent>
      </Select>

      {/* Paid Status Select (NAV only) */}
      {!isSubmittedTab && (
        <Select value={filters.paid} onValueChange={(value) => setFilters(prev => ({ ...prev, paid: value }))}>
          <SelectTrigger className="h-9 w-[150px]">
            <span className="truncate">
              {filters.paid === 'all'
                ? 'Állapot'
                : filters.paid === 'yes'
                  ? 'Kifizetve'
                  : filters.paid === 'partial'
                    ? 'Részben fizetve'
                    : 'Nyitott'}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Összes állapot</SelectItem>
            <SelectItem value="yes">Kifizetve</SelectItem>
            <SelectItem value="partial">Részben fizetve</SelectItem>
            <SelectItem value="no">Nyitott</SelectItem>
          </SelectContent>
        </Select>
      )}

      {/* Submitted Status Select (INBOUND NAV only) */}
      {activeTab === 'INBOUND' && (
        <Select value={filters.submitted} onValueChange={(value) => setFilters(prev => ({ ...prev, submitted: value }))}>
          <SelectTrigger className="h-9 w-[140px]">
            <span className="truncate">
              {filters.submitted === 'all' ? 'Beküldve' : filters.submitted === 'yes' ? 'Igen' : 'Nem'}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Beküldve (mind)</SelectItem>
            <SelectItem value="yes">Igen</SelectItem>
            <SelectItem value="no">Nem</SelectItem>
          </SelectContent>
        </Select>
      )}

      {/* NAV Online Számla Status Select (Submitted Invoices only) */}
      {isSubmittedTab && (
        <Select
          value={filters.navStatus || 'all'}
          onValueChange={(value) => setFilters(prev => ({ ...prev, navStatus: value }))}
        >
          <SelectTrigger className="h-9 w-[180px]">
            <span className="truncate">
              {filters.navStatus === 'all'
                ? 'NAV státusz'
                : filters.navStatus === 'verified'
                  ? 'NAV megerősítve'
                  : filters.navStatus === 'missing_nav'
                    ? 'NAV hiányzik'
                    : 'Nem alkalmazandó'}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">NAV státusz: Mind</SelectItem>
            <SelectItem value="verified">NAV megerősítve</SelectItem>
            <SelectItem value="missing_nav">NAV hiányzik</SelectItem>
            <SelectItem value="not_applicable">Nem alkalmazandó (külföldi)</SelectItem>
          </SelectContent>
        </Select>
      )}

      {/* Category Select (INBOUND NAV only) */}
      {activeTab === 'INBOUND' && (
        <Select value={filters.category} onValueChange={(value) => setFilters(prev => ({ ...prev, category: value }))}>
          <SelectTrigger className="h-9 w-[180px]">
            <span className="truncate">
              {filters.category === 'all'
                ? 'Kategória'
                : filters.category === 'none'
                  ? 'Nincs kategória'
                  : categories.find(c => c.id === filters.category)?.name || 'Kategória'}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Minden kategória</SelectItem>
            <SelectItem value="none">Nincs kategória</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Project Select (NAV only) */}
      {!isSubmittedTab && (
        <Select value={filters.project} onValueChange={(value) => setFilters(prev => ({ ...prev, project: value }))}>
          <SelectTrigger className="h-9 w-[180px]">
            <span className="truncate">
              {filters.project === 'all'
                ? 'Projekt'
                : filters.project === 'none'
                  ? 'Nincs projekt'
                  : projects.find(p => p.id === filters.project)?.name || 'Projekt'}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Minden projekt</SelectItem>
            <SelectItem value="none">Nincs projekt</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Payment Method Select */}
      <Select
        value={filters.paymentMethod}
        onValueChange={(value) => setFilters(prev => ({ ...prev, paymentMethod: value }))}
      >
        <SelectTrigger className="h-9 w-[180px]">
          <span className="truncate">
            {filters.paymentMethod === 'all'
              ? 'Fiz. mód'
              : filters.paymentMethod === 'none'
                ? 'Nem megadott'
                : isSubmittedTab
                  ? filters.paymentMethod
                  : getPaymentMethodLabel(filters.paymentMethod)}
          </span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Minden fiz. mód</SelectItem>
          <SelectItem value="none">Nem megadott</SelectItem>
          {isSubmittedTab ? (
            <>
              <SelectItem value="Átutalás">Átutalás</SelectItem>
              <SelectItem value="Készpénz">Készpénz</SelectItem>
              <SelectItem value="Bankkártya">Bankkártya</SelectItem>
              <SelectItem value="Utalvány">Utalvány</SelectItem>
              <SelectItem value="Egyéb">Egyéb</SelectItem>
            </>
          ) : (
            <>
              <SelectItem value="TRANSFER">Átutalás</SelectItem>
              <SelectItem value="CASH">Készpénz</SelectItem>
              <SelectItem value="CARD">Bankkártya</SelectItem>
              <SelectItem value="VOUCHER">Utalvány</SelectItem>
              <SelectItem value="OTHER">Egyéb</SelectItem>
            </>
          )}
        </SelectContent>
      </Select>

      {/* Continuous Service Select (NAV only) */}
      {!isSubmittedTab && (
        <Select
          value={filters.continuous}
          onValueChange={(value) => setFilters(prev => ({ ...prev, continuous: value }))}
        >
          <SelectTrigger className="h-9 w-[160px]">
            <span className="truncate">
              {filters.continuous === 'all'
                ? 'Foly. szolg.'
                : filters.continuous === 'yes'
                  ? '🔄 Igen'
                  : 'Nem'}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Foly. szolg. (mind)</SelectItem>
            <SelectItem value="yes">🔄 Folyamatos</SelectItem>
            <SelectItem value="no">Nem folyamatos</SelectItem>
          </SelectContent>
        </Select>
      )}

      {/* Clear Filters Button */}
      {hasAnyActiveFilter && (
        <Button variant="ghost" size="sm" onClick={clearAllFilters}>
          <X className="h-4 w-4 mr-1" />
          Szűrők törlése
        </Button>
      )}
    </div>
  );
}
