import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Search, CalendarIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { getDateFnsLocale, getActiveLocale } from '@/lib/locale/formatters';
import { useInvoiceContext } from '../../context/useInvoiceContext';

export function InvoiceFilterBar() {
  const { t } = useTranslation(['invoices', 'common']);
  const isHr = getActiveLocale() === 'hr';
  const dateFormat = isHr ? 'dd.MM.yyyy.' : 'yyyy. MMM dd.';

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
          placeholder={t('invoices:filters.search_placeholder', { defaultValue: 'Keresés (partner, bizonylat, összeg...)' })}
          value={filters.search}
          onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
          className="pl-9"
        />
      </div>

      {/* Date Range Popovers */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">{t('invoices:filters.issue_date', { defaultValue: 'Kibocsátás:' })}</span>
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
                ? format(new Date(filters.issueDateFrom), dateFormat, { locale: getDateFnsLocale() })
                : t('invoices:filters.date_from', { defaultValue: 'Dátum -tól' })}
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
                ? format(new Date(filters.issueDateTo), dateFormat, { locale: getDateFnsLocale() })
                : t('invoices:filters.date_to', { defaultValue: 'Dátum -ig' })}
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
          <span className="truncate">{filters.currency === 'all' ? t('invoices:filters.currency', { defaultValue: 'Pénznem' }) : filters.currency}</span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('invoices:filters.all_currencies', { defaultValue: 'Minden pénznem' })}</SelectItem>
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
                ? t('invoices:filters.status', { defaultValue: 'Állapot' })
                : filters.paid === 'yes'
                  ? t('invoices:filters.paid', { defaultValue: 'Kifizetve' })
                  : filters.paid === 'partial'
                    ? t('invoices:filters.partial', { defaultValue: 'Részben fizetve' })
                    : t('invoices:filters.open', { defaultValue: 'Nyitott' })}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('invoices:filters.all_statuses', { defaultValue: 'Összes állapot' })}</SelectItem>
            <SelectItem value="yes">{t('invoices:filters.paid', { defaultValue: 'Kifizetve' })}</SelectItem>
            <SelectItem value="partial">{t('invoices:filters.partial', { defaultValue: 'Részben fizetve' })}</SelectItem>
            <SelectItem value="no">{t('invoices:filters.open', { defaultValue: 'Nyitott' })}</SelectItem>
          </SelectContent>
        </Select>
      )}

      {/* Számlakép (Submitted Invoice Image) Status Select (NAV invoices: OUTBOUND and INBOUND) */}
      {!isSubmittedTab && (
        <Select
          value={filters.submitted}
          onValueChange={(value) => setFilters(prev => ({ ...prev, submitted: value }))}
        >
          <SelectTrigger
            className={cn(
              'h-9 w-[180px]',
              filters.submitted !== 'all' &&
                'bg-primary/10 border-primary/50 text-primary dark:bg-primary/10 dark:border-primary dark:text-primary'
            )}
          >
            <span className="truncate">
              {filters.submitted === 'all'
                ? t('invoices:filters.submitted_all', { defaultValue: 'Számlakép: Mind' })
                : filters.submitted === 'yes'
                  ? t('invoices:filters.submitted_has', { defaultValue: 'Számlakép: Van' })
                  : t('invoices:filters.submitted_missing', { defaultValue: 'Számlakép: Hiányzik' })}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('invoices:filters.submitted_all', { defaultValue: 'Számlakép: Mind' })}</SelectItem>
            <SelectItem value="yes">{t('invoices:filters.submitted_has', { defaultValue: 'Számlakép: Van' })}</SelectItem>
            <SelectItem value="no">{t('invoices:filters.submitted_missing', { defaultValue: 'Számlakép: Hiányzik' })}</SelectItem>
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
                ? t('invoices:filters.nav_status', { defaultValue: 'NAV státusz' })
                : filters.navStatus === 'verified'
                  ? t('invoices:filters.nav_verified', { defaultValue: 'NAV megerősítve' })
                  : filters.navStatus === 'missing_nav'
                    ? t('invoices:filters.nav_missing', { defaultValue: 'NAV hiányzik' })
                    : t('invoices:filters.nav_not_applicable', { defaultValue: 'Nem alkalmazandó' })}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('invoices:filters.nav_all', { defaultValue: 'NAV státusz: Mind' })}</SelectItem>
            <SelectItem value="verified">{t('invoices:filters.nav_verified', { defaultValue: 'NAV megerősítve' })}</SelectItem>
            <SelectItem value="missing_nav">{t('invoices:filters.nav_missing', { defaultValue: 'NAV hiányzik' })}</SelectItem>
            <SelectItem value="not_applicable">{t('invoices:filters.nav_not_applicable', { defaultValue: 'Nem alkalmazandó (külföldi)' })}</SelectItem>
          </SelectContent>
        </Select>
      )}

      {/* Category Select (INBOUND NAV only) */}
      {activeTab === 'INBOUND' && (
        <Select value={filters.category} onValueChange={(value) => setFilters(prev => ({ ...prev, category: value }))}>
          <SelectTrigger className="h-9 w-[180px]">
            <span className="truncate">
              {filters.category === 'all'
                ? t('invoices:filters.category', { defaultValue: 'Kategória' })
                : filters.category === 'none'
                  ? t('invoices:filters.no_category', { defaultValue: 'Nincs kategória' })
                  : categories.find(c => c.id === filters.category)?.name || t('invoices:filters.category', { defaultValue: 'Kategória' })}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('invoices:filters.all_categories', { defaultValue: 'Minden kategória' })}</SelectItem>
            <SelectItem value="none">{t('invoices:filters.no_category', { defaultValue: 'Nincs kategória' })}</SelectItem>
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
                ? t('invoices:filters.project', { defaultValue: 'Projekt' })
                : filters.project === 'none'
                  ? t('invoices:filters.no_project', { defaultValue: 'Nincs projekt' })
                  : projects.find(p => p.id === filters.project)?.name || t('invoices:filters.project', { defaultValue: 'Projekt' })}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('invoices:filters.all_projects', { defaultValue: 'Minden projekt' })}</SelectItem>
            <SelectItem value="none">{t('invoices:filters.no_project', { defaultValue: 'Nincs projekt' })}</SelectItem>
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
              ? t('invoices:filters.payment_method', { defaultValue: 'Fiz. mód' })
              : filters.paymentMethod === 'none'
                ? t('invoices:filters.not_specified', { defaultValue: 'Nem megadott' })
                : isSubmittedTab
                  ? filters.paymentMethod
                  : getPaymentMethodLabel(filters.paymentMethod)}
          </span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('invoices:filters.all_payment_methods', { defaultValue: 'Minden fiz. mód' })}</SelectItem>
          <SelectItem value="none">{t('invoices:filters.not_specified', { defaultValue: 'Nem megadott' })}</SelectItem>
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
                ? t('invoices:filters.continuous', { defaultValue: 'Foly. szolg.' })
                : filters.continuous === 'yes'
                  ? t('invoices:filters.continuous_yes', { defaultValue: '🔄 Igen' })
                  : t('invoices:filters.continuous_no', { defaultValue: 'Nem' })}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('invoices:filters.continuous_all', { defaultValue: 'Foly. szolg. (mind)' })}</SelectItem>
            <SelectItem value="yes">{t('invoices:filters.continuous_yes', { defaultValue: '🔄 Folyamatos' })}</SelectItem>
            <SelectItem value="no">{t('invoices:filters.continuous_no', { defaultValue: 'Nem folyamatos' })}</SelectItem>
          </SelectContent>
        </Select>
      )}

      {/* Clear Filters Button */}
      {hasAnyActiveFilter && (
        <Button variant="ghost" size="sm" onClick={clearAllFilters}>
          <X className="h-4 w-4 mr-1" />
          {t('invoices:filters.clear_filters', { defaultValue: 'Szűrők törlése' })}
        </Button>
      )}
    </div>
  );
}
