import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, FileText } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useScopedNavigate } from '@/lib/navigation';
import { format } from 'date-fns';
import { getDateFnsLocale, getActiveLocale } from '@/lib/locale/formatters';

interface Invoice {
  id: string;
  bizonylatsorszam: string;
  elado_nev: string;
  vevo_nev: string;
  brutto_vegosszeg: number;
  kibocsatas_datuma: string;
  statusz: string;
  penznem?: string;
  project_name?: string;
  image_url?: string;
}

interface RecentInvoicesProps {
  invoices: Invoice[];
  onViewInvoice?: (invoice: Invoice) => void;
}

const RecentInvoices = ({
  invoices,
  onViewInvoice
}: RecentInvoicesProps) => {
  const { t } = useTranslation(['dashboard', 'common']);
  const scopedNavigate = useScopedNavigate();

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'feldolgozott':
        return 'success';
      case 'feldolgozas_alatt':
        return 'warning';
      case 'hiba':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'feldolgozott':
        return t('dashboard:recent_invoices.status.processed', 'Feldolgozva');
      case 'feldolgozas_alatt':
        return t('dashboard:recent_invoices.status.processing', 'Feldolgozás alatt');
      case 'hiba':
        return t('dashboard:recent_invoices.status.error', 'Hiba');
      default:
        return status;
    }
  };

  const isHr = getActiveLocale() === 'hr';
  const dateFormatPattern = isHr ? 'dd.MM.yyyy.' : 'yyyy. MM. dd.';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 px-0 py-[4px]">
              <FileText className="h-5 w-5" />
              {t('dashboard:recent_invoices.title', 'Legutóbbi számlák')}
            </CardTitle>
            <CardDescription>
              {t('dashboard:recent_invoices.description', 'Az utoljára feldolgozott számlák áttekintése')}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => scopedNavigate('invoices')}>
            {t('dashboard:recent_invoices.view_all', 'Összes megtekintése')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {invoices.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="px-0">{t('dashboard:recent_invoices.empty', 'Még nincsenek feldolgozott számlák')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {invoices.map(invoice => (
              <div key={invoice.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="mb-1 flex items-center gap-2">
                    <h4 className="font-medium truncate">{invoice.bizonylatsorszam}</h4>
                    <Badge variant={getStatusVariant(invoice.statusz) as any} className="text-[10px] px-1.5 py-0">
                      {getStatusLabel(invoice.statusz)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {invoice.elado_nev} → {invoice.vevo_nev}
                  </p>
                  {invoice.project_name && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('dashboard:recent_invoices.project', 'Projekt:')} {invoice.project_name}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(invoice.kibocsatas_datuma), dateFormatPattern, { locale: getDateFnsLocale() })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(invoice.brutto_vegosszeg, invoice.penznem || 'HUF')}</p>
                  </div>
                  {onViewInvoice && (
                    <Button variant="ghost" size="sm" onClick={() => onViewInvoice(invoice)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RecentInvoices;