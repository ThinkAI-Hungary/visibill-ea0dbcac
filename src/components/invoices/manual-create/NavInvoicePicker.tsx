import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/search-input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Sparkles, ChevronsUpDown, Check, X, FileText, Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/locale/formatters';
import { useTranslation } from 'react-i18next';
import type { NavInvoice } from '@/features/invoices/types';

interface NavInvoicePickerProps {
  companyId: string;
  direction: 'INBOUND' | 'OUTBOUND';
  selectedNavInvoice: NavInvoice | null;
  onSelect: (navInvoice: NavInvoice | null) => void;
  disabled?: boolean;
}

export function NavInvoicePicker({
  companyId,
  direction,
  selectedNavInvoice,
  onSelect,
  disabled = false,
}: NavInvoicePickerProps) {
  const { t } = useTranslation(['invoices', 'common']);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showAllNav, setShowAllNav] = useState(false);

  // Fetch recent open/unmatched or all NAV invoices for the company and direction
  const { data: navInvoices = [], isLoading } = useQuery({
    queryKey: ['nav-invoices-picker', companyId, direction],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nav_invoices')
        .select('*')
        .eq('company_id', companyId)
        .eq('invoice_direction', direction)
        .order('invoice_issue_date', { ascending: false })
        .limit(60);

      if (error) throw error;
      return (data || []) as NavInvoice[];
    },
    enabled: Boolean(companyId) && open,
    staleTime: 30000,
  });

  const sortedNavInvoices = useMemo(() => {
    return [...navInvoices].sort((a, b) => {
      // Prioritize unsubmitted (not yet matched) invoices
      if (!a.submitted && b.submitted) return -1;
      if (a.submitted && !b.submitted) return 1;
      const dateA = a.invoice_issue_date || '';
      const dateB = b.invoice_issue_date || '';
      return dateB.localeCompare(dateA);
    });
  }, [navInvoices]);

  const filteredInvoices = useMemo(() => {
    let list = sortedNavInvoices;
    // By default, if not searching, only show open/unsubmitted invoices
    if (!search.trim() && !showAllNav) {
      list = list.filter(inv => !inv.submitted);
    }
    if (!search.trim()) return list;

    const q = search.toLowerCase().trim();
    return sortedNavInvoices.filter(inv => {
      const num = (inv.invoice_number || '').toLowerCase();
      const supp = (inv.supplier_name || '').toLowerCase();
      const cust = (inv.customer_name || '').toLowerCase();
      const amount = String(inv.invoice_gross_amount || '');
      return num.includes(q) || supp.includes(q) || cust.includes(q) || amount.includes(q);
    });
  }, [sortedNavInvoices, search, showAllNav]);

  const displayedInvoices = useMemo(() => {
    return filteredInvoices.slice(0, 20);
  }, [filteredInvoices]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          {t('invoices:manual_create.nav_picker.label')}
        </label>
        {selectedNavInvoice && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onSelect(null)}
            className="h-6 px-1.5 text-xs text-muted-foreground hover:text-destructive"
          >
            <X className="h-3.5 w-3.5 mr-1" />
            {t('invoices:manual_create.nav_picker.unlink')}
          </Button>
        )}
      </div>

      <Popover open={open} onOpenChange={setOpen} modal={true}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "w-full justify-between h-auto py-2 px-3 text-left font-normal border-dashed border-border/80 hover:border-primary/60 transition-colors",
              selectedNavInvoice ? "border-solid border-primary/40 bg-primary/5" : "text-muted-foreground"
            )}
          >
            {selectedNavInvoice ? (
              <div className="flex items-center gap-2 overflow-hidden text-sm">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <div className="truncate flex items-center gap-1.5 font-medium text-foreground">
                  <span className="font-mono">{selectedNavInvoice.invoice_number}</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="truncate">
                    {direction === 'INBOUND' ? selectedNavInvoice.supplier_name : selectedNavInvoice.customer_name}
                  </span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-emerald-500 font-semibold tabular-nums">
                    {formatCurrency(selectedNavInvoice.invoice_gross_amount || 0, selectedNavInvoice.currency || 'HUF')}
                  </span>
                </div>
              </div>
            ) : (
              <span className="flex items-center gap-2 text-xs">
                <span>{t('invoices:manual_create.nav_picker.placeholder')}</span>
              </span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          className="w-[500px] p-0 flex flex-col h-[350px] shadow-lg border-border/80"
          align="start"
          sideOffset={6}
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <SearchInput
            variant="borderless"
            placeholder={t('invoices:manual_create.nav_picker.search_placeholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            autoFocus
            rightElement={
              <span className="text-[10px] text-muted-foreground tabular-nums px-1.5 py-0.5 rounded bg-muted/60">
                {filteredInvoices.length} db
              </span>
            }
          />

          <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b border-border/40 text-[11px] text-muted-foreground shrink-0">
            <span>
              {showAllNav ? t('invoices:manual_create.nav_picker.filter_all') : t('invoices:manual_create.nav_picker.filter_open_only')}
            </span>
            <button
              type="button"
              onClick={() => setShowAllNav(!showAllNav)}
              className="text-primary hover:underline font-medium hover:text-primary/80 transition-colors"
            >
              {showAllNav ? t('invoices:manual_create.nav_picker.toggle_open') : t('invoices:manual_create.nav_picker.toggle_all')}
            </button>
          </div>

          <div
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-1 divide-y divide-border/20"
            onWheel={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            {isLoading ? (
              <div className="h-full flex items-center justify-center py-6 text-xs text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span>{t('invoices:manual_create.nav_picker.loading')}</span>
              </div>
            ) : displayedInvoices.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground">
                <Search className="h-7 w-7 text-muted-foreground/30 mb-2" />
                <span className="font-medium text-foreground/80">{t('invoices:manual_create.nav_picker.empty_title')}</span>
                <span className="text-[11px] text-muted-foreground mt-0.5">
                  {search ? t('invoices:manual_create.nav_picker.empty_search', { search }) : t('invoices:manual_create.nav_picker.empty_desc')}
                </span>
              </div>
            ) : (
              displayedInvoices.map((nav) => {
                const isSelected = selectedNavInvoice?.id === nav.id;
                const partnerName = direction === 'INBOUND' ? nav.supplier_name : nav.customer_name;
                const partnerTax = direction === 'INBOUND' ? nav.supplier_tax_number : nav.customer_tax_number;

                return (
                  <button
                    key={nav.id}
                    type="button"
                    onClick={() => {
                      onSelect(isSelected ? null : nav);
                      setOpen(false);
                    }}
                    className={cn(
                      "w-full text-left p-2.5 rounded-md hover:bg-accent/50 transition-colors flex items-center justify-between gap-3 text-xs",
                      isSelected && "bg-primary/10 text-primary font-medium"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-foreground text-xs">
                          {nav.invoice_number}
                        </span>
                        {nav.paid && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 border-emerald-500/30 text-emerald-500">
                            {t('invoices:manual_create.nav_picker.badge_paid')}
                          </Badge>
                        )}
                        {nav.submitted && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 border-blue-500/30 text-blue-500">
                            {t('invoices:manual_create.nav_picker.badge_submitted')}
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {partnerName || t('invoices:manual_create.nav_picker.unnamed_partner')} {partnerTax ? `(${partnerTax})` : ''}
                      </div>
                      <div className="text-[10px] text-muted-foreground/80 mt-0.5">
                        {t('invoices:manual_create.nav_picker.meta_issue')} {nav.invoice_issue_date || '-'} • {t('invoices:manual_create.nav_picker.meta_delivery')} {nav.invoice_delivery_date || '-'}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-semibold text-foreground tabular-nums text-xs">
                        {formatCurrency(nav.invoice_gross_amount || 0, nav.currency || 'HUF')}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {t('invoices:manual_create.nav_picker.net_label')} {formatCurrency(nav.invoice_net_amount || 0, nav.currency || 'HUF')}
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="h-4 w-4 text-primary shrink-0 ml-1" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {filteredInvoices.length > displayedInvoices.length && (
            <div className="p-2 border-t border-border/40 bg-muted/20 text-center text-[11px] text-muted-foreground shrink-0">
              {t('invoices:manual_create.nav_picker.more_invoices', { count: filteredInvoices.length - displayedInvoices.length })}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
