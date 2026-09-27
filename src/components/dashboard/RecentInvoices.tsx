import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Eye, FileText, ArrowDownLeft, ArrowUpRight, ChevronRight } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { useScopedNavigate } from '@/lib/navigation';
import { format } from 'date-fns';
import { getDateFnsLocale, getActiveLocale } from '@/lib/locale/formatters';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { InvoiceImagePreview } from '@/components/InvoiceImagePreview';

export interface Invoice {
  id: string;
  bizonylatsorszam: string;
  elado_nev: string;
  vevo_nev: string;
  brutto_vegosszeg: number;
  adoalap_osszesen?: number;
  afa_osszeg_osszesen?: number;
  kibocsatas_datuma: string;
  teljesites_datuma?: string;
  statusz: string;
  penznem?: string;
  project_name?: string;
  category_id?: string;
  company_id?: string;
  image_url?: string;
  melleklet_url?: string;
  attachments?: any[];
  invoice_uploads_id?: string;
  reference_number?: string;
  elolegszamla_hivatkozas?: string;
  invoice_direction?: string;
  invoice_type?: string;
  nav_status?: string;
}

interface RecentInvoicesProps {
  invoices: Invoice[];
  onViewInvoice?: (invoice: Invoice) => void;
  onRowClick?: (invoice: Invoice) => void;
}

const RecentInvoices = ({
  invoices,
  onViewInvoice,
  onRowClick,
}: RecentInvoicesProps) => {
  const { t } = useTranslation(['dashboard', 'common']);
  const scopedNavigate = useScopedNavigate();

  const isHr = getActiveLocale() === 'hr';
  const dateFormatPattern = isHr ? 'dd.MM.yyyy.' : 'yyyy. MM. dd.';

  return (
    <Card className="h-[520px] flex flex-col overflow-hidden border-border/80 shadow-card">
      <CardHeader className="px-5 py-3.5 border-b border-border/40 shrink-0 space-y-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md bg-primary-subtle text-primary flex items-center justify-center shrink-0">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold leading-tight text-foreground">
                {t('dashboard:recent_invoices.title', 'Legutóbbi számlák')}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                {t('dashboard:recent_invoices.description', 'Az utoljára feldolgozott számlák áttekintése')}
              </CardDescription>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 text-xs font-medium"
            onClick={() => scopedNavigate('invoices')}
          >
            {t('dashboard:recent_invoices.view_all', 'Összes megtekintése')}
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 pb-3.5 sm:pb-4 overflow-hidden">
        {invoices.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium text-foreground">
              {t('dashboard:recent_invoices.empty', 'Még nincsenek feldolgozott számlák')}
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[260px]">
              {t('dashboard:recent_invoices.empty_desc', 'A beérkező számlák a feldolgozás után automatikusan itt fognak megjelenni.')}
            </p>
          </div>
        ) : (
          <ScrollArea className="h-full px-3 py-1 [&>div>div[style]]:!block">
            <div className="divide-y divide-border/30 w-full min-w-0 pb-1">
              {invoices.map((invoice) => {
                const isOutbound = invoice.invoice_direction === 'OUTBOUND';
                const partnerTooltip = `${invoice.elado_nev || ''} → ${invoice.vevo_nev || ''}${invoice.project_name ? ` • ${invoice.project_name}` : ''}`;
                return (
                  <div
                    key={invoice.id}
                    onClick={() => {
                      if (onRowClick) {
                        onRowClick(invoice);
                      } else {
                        onViewInvoice?.(invoice);
                      }
                    }}
                    className="flex items-center justify-between py-2 px-1.5 sm:px-2 rounded-lg hover:bg-muted/40 transition-colors group cursor-pointer w-full max-w-full overflow-hidden gap-2"
                  >
                    {/* Left: Direction icon & metadata */}
                    <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                      <div
                        className={cn(
                          "w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-xs font-semibold transition-transform group-hover:scale-105",
                          isOutbound
                            ? "bg-success-subtle text-success border border-success/20"
                            : "bg-info-subtle text-info border border-info/20"
                        )}
                        title={isOutbound ? t('common:labels.outbound', 'Kimenő számla') : t('common:labels.inbound', 'Bejövő számla')}
                      >
                        {isOutbound ? (
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowDownLeft className="h-3.5 w-3.5" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1 overflow-hidden">
                        <div className="flex items-center gap-1.5 mb-0.5 min-w-0">
                          <span className="font-semibold text-xs sm:text-sm truncate text-foreground group-hover:text-primary transition-colors block">
                            {invoice.bizonylatsorszam}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate w-full block" title={partnerTooltip}>
                          <span>{invoice.elado_nev} → {invoice.vevo_nev}</span>
                          {invoice.project_name && (
                            <>
                              <span className="opacity-40 mx-1">•</span>
                              <span className="text-primary/80 font-medium">{invoice.project_name}</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Right: Gross amount, Date & Eye action */}
                    <div className="flex items-center gap-1.5 shrink-0 text-right ml-auto">
                      <div className="shrink-0">
                        <p className="font-semibold text-xs sm:text-sm tabular-nums text-foreground whitespace-nowrap">
                          {formatCurrency(invoice.brutto_vegosszeg, invoice.penznem || 'HUF')}
                        </p>
                        <p className="text-[11px] text-muted-foreground whitespace-nowrap">
                          {format(new Date(invoice.kibocsatas_datuma), dateFormatPattern, { locale: getDateFnsLocale() })}
                        </p>
                      </div>

                      {onViewInvoice && (
                        <HoverCard openDelay={200} closeDelay={100}>
                          <HoverCardTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0 text-muted-foreground/70 hover:text-primary hover:bg-primary-subtle rounded-md"
                              onClick={(e) => {
                                e.stopPropagation();
                                onViewInvoice(invoice);
                              }}
                              aria-label={t('dashboard:recent_invoices.preview_title', 'Számlakép megtekintése')}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </HoverCardTrigger>
                          <HoverCardContent side="left" align="center" className="w-64 p-1.5 z-50">
                            <InvoiceImagePreview
                              invoiceId={invoice.id}
                              imageUrl={invoice.image_url}
                              mellekletUrl={invoice.melleklet_url}
                              attachments={invoice.attachments}
                              isOpen={true}
                            />
                          </HoverCardContent>
                        </HoverCard>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default RecentInvoices;