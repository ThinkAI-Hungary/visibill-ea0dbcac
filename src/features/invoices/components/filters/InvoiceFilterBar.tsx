import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Search, CalendarIcon, CalendarCheck, Calendar as CalendarGlyph, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { getActiveLocale } from '@/lib/locale/formatters';
import { useInvoiceContext } from '../../context/useInvoiceContext';
import { useCompanyJurisdiction } from '@/hooks/useCompanyJurisdiction';

export function InvoiceFilterBar() {
  const { t } = useTranslation(['invoices', 'common']);
  const isHr = getActiveLocale() === 'hr';
  const dateFormat = isHr ? 'dd.MM.yyyy.' : 'yyyy. MMM dd.';

  const {
    filters,
    setFilters,
    setDateBasis,
    activeTab,
    isSubmittedTab,
    categories,
    projects,
    submittedInvoices,
    getPaymentMethodLabel,
    hasAnyActiveFilter,
    clearAllFilters,
  } = useInvoiceContext();
  const { hasNavIntegration } = useCompanyJurisdiction();

  const [dateFromOpen, setDateFromOpen] = useState(false);
  const [dateToOpen, setDateToOpen] = useState(false);

  const isDeliveryBasis = filters.dateBasis === 'teljesites';
  const activeDateFrom = isDeliveryBasis ? filters.deliveryDateFrom : filters.issueDateFrom;
  const activeDateTo = isDeliveryBasis ? filters.deliveryDateTo : filters.issueDateTo;

  // Inactive date filter values (for indicator badge if both are filtered)
  const inactiveIsDelivery = !isDeliveryBasis;
  const inactiveFrom = inactiveIsDelivery ? filters.deliveryDateFrom : filters.issueDateFrom;
  const inactiveTo = inactiveIsDelivery ? filters.deliveryDateTo : filters.issueDateTo;
  const hasInactiveDateFilter = Boolean(inactiveFrom || inactiveTo);

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

      {/* Date Basis Segmented Control (Kibocsátás vs Teljesítés) */}
      <div className="inline-flex h-9 items-center rounded-lg border border-border/80 bg-muted/40 p-1 shadow-2xs text-xs select-none">
        <button
          type="button"
          onClick={() => (setDateBasis ? setDateBasis('kibocsatas') : setFilters(prev => ({ ...prev, dateBasis: 'kibocsatas' })))}
          className={cn(
            "inline-flex px-2.5 h-7 items-center justify-center gap-1.5 rounded-md text-xs transition-all cursor-pointer border",
            !isDeliveryBasis
              ? "bg-background text-foreground shadow-xs border-border/60 font-semibold"
              : "text-muted-foreground hover:text-foreground border-transparent hover:bg-muted/50 font-medium"
          )}
          title={t('invoices:filters.date_basis_issue_tooltip', { defaultValue: 'Kibocsátás kelte: számlák hivatalos kiállítási dátuma alapján gyűjti és szűri az adatokat' })}
        >
          <CalendarGlyph className="w-3.5 h-3.5 shrink-0" />
          <span>{t('invoices:filters.date_basis_issue', { defaultValue: 'Kibocsátás' })}</span>
        </button>
        <button
          type="button"
          onClick={() => (setDateBasis ? setDateBasis('teljesites') : setFilters(prev => ({ ...prev, dateBasis: 'teljesites' })))}
          className={cn(
            "inline-flex px-2.5 h-7 items-center justify-center gap-1.5 rounded-md text-xs transition-all cursor-pointer border",
            isDeliveryBasis
              ? "bg-background text-foreground shadow-xs border-border/60 font-semibold text-primary"
              : "text-muted-foreground hover:text-foreground border-transparent hover:bg-muted/50 font-medium"
          )}
          title={t('invoices:filters.date_basis_delivery_tooltip', { defaultValue: 'Teljesítés dátuma: a gazdasági teljesítés napja alapján gyűjti és szűri az adatokat (áfa és főkönyv összhang)' })}
        >
          <CalendarCheck className="w-3.5 h-3.5 shrink-0 text-primary" />
          <span>{t('invoices:filters.date_basis_delivery', { defaultValue: 'Teljesítés' })}</span>
        </button>
      </div>

      {/* Date Range Popovers */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
          {isDeliveryBasis
            ? t('invoices:filters.delivery_date_label', { defaultValue: 'Teljesítés:' })
            : t('invoices:filters.issue_date', { defaultValue: 'Kibocsátás:' })}
        </span>
        <Popover open={dateFromOpen} onOpenChange={setDateFromOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'h-9 text-xs px-2.5 justify-start font-normal min-w-[130px]',
                activeDateFrom &&
                  'bg-primary/10 border-primary/50 text-primary dark:bg-primary/10 dark:border-primary dark:text-primary'
              )}
            >
              <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
              {activeDateFrom
                ? format(new Date(activeDateFrom), dateFormat, { locale: getDateFnsLocale() })
                : t('invoices:filters.date_from', { defaultValue: 'Dátum -tól' })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={activeDateFrom ? new Date(activeDateFrom) : undefined}
              onSelect={(date) => {
                const dateStr = date ? format(date, 'yyyy-MM-dd') : '';
                setFilters(prev => {
                  if (isDeliveryBasis) {
                    return {
                      ...prev,
                      deliveryDateFrom: dateStr,
                      deliveryDateTo: dateStr && !prev.deliveryDateTo ? format(new Date(), 'yyyy-MM-dd') : prev.deliveryDateTo,
                    };
                  } else {
                    return {
                      ...prev,
                      issueDateFrom: dateStr,
                      issueDateTo: dateStr && !prev.issueDateTo ? format(new Date(), 'yyyy-MM-dd') : prev.issueDateTo,
                    };
                  }
                });
                setDateFromOpen(false);
              }}
              disabled={activeDateTo ? { after: new Date(activeDateTo) } : undefined}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>

        <span className="text-xs text-muted-foreground">–</span>

        <Popover open={dateToOpen} onOpenChange={setDateToOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'h-9 text-xs px-2.5 justify-start font-normal min-w-[130px]',
                activeDateTo &&
                  'bg-primary/10 border-primary/50 text-primary dark:bg-primary/10 dark:border-primary dark:text-primary'
              )}
            >
              <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
              {activeDateTo
                ? format(new Date(activeDateTo), dateFormat, { locale: getDateFnsLocale() })
                : t('invoices:filters.date_to', { defaultValue: 'Dátum -ig' })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={activeDateTo ? new Date(activeDateTo) : undefined}
              onSelect={(date) => {
                const dateStr = date ? format(date, 'yyyy-MM-dd') : '';
                setFilters(prev => ({
                  ...prev,
                  [isDeliveryBasis ? 'deliveryDateTo' : 'issueDateTo']: dateStr,
                }));
                setDateToOpen(false);
              }}
              disabled={activeDateFrom ? { before: new Date(activeDateFrom) } : undefined}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>

        {(activeDateFrom || activeDateTo) && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setFilters(prev => ({
              ...prev,
              [isDeliveryBasis ? 'deliveryDateFrom' : 'issueDateFrom']: '',
              [isDeliveryBasis ? 'deliveryDateTo' : 'issueDateTo']: '',
            }))}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Secondary / Inactive Date Chip Indicator */}
      {hasInactiveDateFilter && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/60 text-xs text-muted-foreground border border-border/60">
          <span className="text-[11px] font-medium">
            {isDeliveryBasis
              ? t('invoices:filters.issue_date_chip', { defaultValue: 'Kibocsátás:' })
              : t('invoices:filters.delivery_date_chip', { defaultValue: 'Teljesítés:' })}
          </span>
          <span className="font-semibold text-foreground text-[11px]">
            {inactiveFrom ? format(new Date(inactiveFrom), dateFormat, { locale: getDateFnsLocale() }) : '...'}
            {' – '}
            {inactiveTo ? format(new Date(inactiveTo), dateFormat, { locale: getDateFnsLocale() }) : '...'}
          </span>
          <button
            type="button"
            onClick={() => setFilters(prev => ({
              ...prev,
              [inactiveIsDelivery ? 'deliveryDateFrom' : 'issueDateFrom']: '',
              [inactiveIsDelivery ? 'deliveryDateTo' : 'issueDateTo']: '',
            }))}
            className="p-0.5 hover:text-foreground text-muted-foreground ml-0.5 rounded-full hover:bg-muted"
            title={t('invoices:filters.clear_secondary_date', { defaultValue: 'Dátumszűrő törlése' })}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

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
      {isSubmittedTab && hasNavIntegration && (
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
                : getPaymentMethodLabel(filters.paymentMethod)}
          </span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('invoices:filters.all_payment_methods', { defaultValue: 'Minden fiz. mód' })}</SelectItem>
          <SelectItem value="none">{t('invoices:filters.not_specified', { defaultValue: 'Nem megadott' })}</SelectItem>
          {isSubmittedTab ? (
            <>
              <SelectItem value="Átutalás">{getPaymentMethodLabel('Átutalás')}</SelectItem>
              <SelectItem value="Készpénz">{getPaymentMethodLabel('Készpénz')}</SelectItem>
              <SelectItem value="Bankkártya">{getPaymentMethodLabel('Bankkártya')}</SelectItem>
              <SelectItem value="Utalvány">{getPaymentMethodLabel('Utalvány')}</SelectItem>
              <SelectItem value="Egyéb">{getPaymentMethodLabel('Egyéb')}</SelectItem>
            </>
          ) : (
            <>
              <SelectItem value="TRANSFER">{getPaymentMethodLabel('TRANSFER')}</SelectItem>
              <SelectItem value="CASH">{getPaymentMethodLabel('CASH')}</SelectItem>
              <SelectItem value="CARD">{getPaymentMethodLabel('CARD')}</SelectItem>
              <SelectItem value="VOUCHER">{getPaymentMethodLabel('VOUCHER')}</SelectItem>
              <SelectItem value="OTHER">{getPaymentMethodLabel('OTHER')}</SelectItem>
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

      {/* VAT Rate Select */}
      <Select
        value={filters.vatRate || 'all'}
        onValueChange={(value) => setFilters(prev => ({ ...prev, vatRate: value }))}
      >
        <SelectTrigger
          className={cn(
            'h-9 w-[150px]',
            filters.vatRate && filters.vatRate !== 'all' &&
              'bg-primary/10 border-primary/50 text-primary dark:bg-primary/10 dark:border-primary dark:text-primary'
          )}
        >
          <span className="truncate">
            {filters.vatRate === 'all' || !filters.vatRate
              ? t('invoices:filters.vat_rate', { defaultValue: 'ÁFA-kulcs' })
              : `ÁFA: ${filters.vatRate}`}
          </span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('invoices:filters.vat_rate_all', { defaultValue: 'Minden ÁFA-kulcs' })}</SelectItem>
          <SelectItem value="27%">27%</SelectItem>
          <SelectItem value="18%">18%</SelectItem>
          <SelectItem value="5%">5%</SelectItem>
          <SelectItem value="0%">0%</SelectItem>
          <SelectItem value="AAM">AAM (alanyi mentes)</SelectItem>
          <SelectItem value="TAM">TAM (tárgyi mentes)</SelectItem>
          <SelectItem value="FAD">FAD (fordított adózás)</SelectItem>
        </SelectContent>
      </Select>

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
