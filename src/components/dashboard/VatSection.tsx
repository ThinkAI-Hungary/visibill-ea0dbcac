import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import type { NavVatData, VatCategoryData } from '@/hooks/useDashboardData';
import type { VatRegime } from '@/contexts/CompanyContext';

interface VatSectionProps {
  navVatData: NavVatData | undefined;
  vatBreakdown: {
    outboundVatCategories: VatCategoryData[];
    inboundVatCategories: VatCategoryData[];
    totalOutboundVat: number;
    totalInboundVat: number;
  } | undefined;
  selectedCurrency: string;
  displayedPeriod: string;
  convertToSelectedCurrency: (amount: number, fromCurrency: string, selectedCurrency: string) => number;
  vatSectionOpen: boolean;
  onVatSectionOpenChange: (open: boolean) => void;
  vatRegime?: VatRegime;
}

const VatSection = React.memo(function VatSection({
  navVatData,
  vatBreakdown,
  selectedCurrency,
  displayedPeriod,
  convertToSelectedCurrency,
  vatSectionOpen,
  onVatSectionOpenChange,
  vatRegime,
}: VatSectionProps) {
  const { t } = useTranslation(['dashboard', 'common']);
  const outboundVatCategories = vatBreakdown?.outboundVatCategories || [];
  const inboundVatCategories = vatBreakdown?.inboundVatCategories || [];

  const outboundTotalVat = useMemo(() => outboundVatCategories.reduce((sum, c) => sum + c.vatAmount, 0), [outboundVatCategories]);
  const outboundTotalNet = useMemo(() => outboundVatCategories.reduce((sum, c) => sum + c.netAmount, 0), [outboundVatCategories]);
  const inboundTotalVat = useMemo(() => inboundVatCategories.reduce((sum, c) => sum + c.vatAmount, 0), [inboundVatCategories]);
  const inboundTotalNet = useMemo(() => inboundVatCategories.reduce((sum, c) => sum + c.netAmount, 0), [inboundVatCategories]);

  const displayOutboundVat = useMemo(() => {
    if (outboundVatCategories.length > 0) {
      return convertToSelectedCurrency(outboundTotalVat, 'HUF', selectedCurrency);
    }
    if (navVatData?.outboundVat) {
      if (typeof navVatData.outboundVat === 'number') {
        return convertToSelectedCurrency(navVatData.outboundVat, 'HUF', selectedCurrency);
      }
      return Object.entries(navVatData.outboundVat).reduce((total, [currency, amount]) => {
        return total + convertToSelectedCurrency(Number(amount) || 0, currency, selectedCurrency);
      }, 0);
    }
    return 0;
  }, [outboundVatCategories.length, outboundTotalVat, navVatData?.outboundVat, convertToSelectedCurrency, selectedCurrency]);

  const displayInboundVat = useMemo(() => {
    if (inboundVatCategories.length > 0) {
      return convertToSelectedCurrency(inboundTotalVat, 'HUF', selectedCurrency);
    }
    if (navVatData?.inboundVat) {
      if (typeof navVatData.inboundVat === 'number') {
        return convertToSelectedCurrency(navVatData.inboundVat, 'HUF', selectedCurrency);
      }
      return Object.entries(navVatData.inboundVat).reduce((total, [currency, amount]) => {
        return total + convertToSelectedCurrency(Number(amount) || 0, currency, selectedCurrency);
      }, 0);
    }
    return 0;
  }, [inboundVatCategories.length, inboundTotalVat, navVatData?.inboundVat, convertToSelectedCurrency, selectedCurrency]);

  const displayVatPosition = useMemo(() => {
    return displayOutboundVat - displayInboundVat;
  }, [displayOutboundVat, displayInboundVat]);

  const maxVatValue = Math.max(displayOutboundVat, displayInboundVat, Math.abs(displayVatPosition));
  const isRefundable = displayVatPosition < 0;

  const vatBarData = useMemo(() => [
    { name: t('vat.total_vat', 'Összes ÁFA'), value: displayOutboundVat, color: "#F59E0B" },
    { name: t('vat.deductible_vat', 'Levonható ÁFA'), value: displayInboundVat, color: "#8B5CF6" },
    {
      name: isRefundable ? t('vat.refundable_vat', 'Visszaigényelhető ÁFA') : t('vat.payable_vat', 'Fizetendő ÁFA'),
      value: Math.abs(displayVatPosition),
      color: isRefundable ? "#10B981" : "#A78BFA"
    }
  ], [displayOutboundVat, displayInboundVat, displayVatPosition, isRefundable, t]);

  return (
    <Collapsible open={vatSectionOpen} onOpenChange={onVatSectionOpenChange}>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-lg font-medium">{t('vat.title', 'ÁFA kimutatás')}</span>
              {vatRegime === 'penzforgalmi' && (
                <Badge variant="outline" className="bg-violet-500/10 text-violet-600 border-violet-500/20 text-xs">
                  {t('vat.regimes.penzforgalmi', 'Pénzforgalmi')}
                </Badge>
              )}
              {vatRegime === 'alanyi_mentes' && (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs">
                  {t('vat.regimes.alanyi_mentes', 'Alanyi adómentes')}
                </Badge>
              )}
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                <ChevronUp className={`h-4 w-4 transition-transform ${vatSectionOpen ? '' : 'rotate-180'}`} />
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left side - VAT bar chart */}
              <div>
                <h3 className={`text-lg font-semibold mb-6 ${isRefundable ? 'text-emerald-600 dark:text-emerald-400' : 'text-purple-600 dark:text-purple-400'}`}>
                  {formatCurrency(Math.abs(displayVatPosition), selectedCurrency)}{' '}
                  {isRefundable ? t('vat.refundable_vat', 'Visszaigényelhető ÁFA') : t('vat.payable_vat', 'Fizetendő ÁFA')}{' '}
                  ({displayedPeriod})
                </h3>
                <div className="space-y-6">
                  {vatBarData.map((item) => (
                    <div key={item.name} className="space-y-2">
                      <div className="flex items-center gap-4">
                        <div className="w-3 rounded" style={{ minHeight: '40px', backgroundColor: item.color }} />
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-muted-foreground">{item.name}</span>
                            <span className="font-semibold">{formatCurrency(item.value, selectedCurrency)}</span>
                          </div>
                          <div className="h-8 bg-muted rounded overflow-hidden">
                            <div
                              className="h-full rounded transition-all"
                              style={{
                                width: maxVatValue > 0 ? `${(Math.abs(item.value) / maxVatValue) * 100}%` : '0%',
                                backgroundColor: item.color
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right side - VAT breakdown tables */}
              <div>
                <h3 className="text-lg font-semibold mb-6">{t('vat.analytics', 'ÁFA analitika')} ({displayedPeriod})</h3>

                {/* Outbound */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-1 h-5 bg-purple-600 rounded" />
                    <h4 className="font-medium">{t('vat.outbound_vat_content', 'Bevételek ÁFA tartalma')}</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-muted-foreground">
                          <th className="text-left py-2">{t('vat.categories', 'ÁFA kategóriák:')}</th>
                          <th className="text-right py-2">{t('vat.total_vat', 'Összes ÁFA:')}</th>
                          <th className="text-right py-2">{t('vat.revenue', 'Árbevétel:')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {outboundVatCategories.length > 0 ? (
                          <>
                            {outboundVatCategories.map(cat => (
                              <tr key={cat.rate}>
                                <td className="py-1">{cat.rate}:</td>
                                <td className="text-right">{formatCurrency(convertToSelectedCurrency(cat.vatAmount, 'HUF', selectedCurrency), selectedCurrency)}</td>
                                <td className="text-right">{formatCurrency(convertToSelectedCurrency(cat.netAmount + cat.vatAmount, 'HUF', selectedCurrency), selectedCurrency)}</td>
                              </tr>
                            ))}
                            <tr className="font-medium border-t">
                              <td className="py-1">{t('vat.total', 'Összesen:')}</td>
                              <td className="text-right">{formatCurrency(convertToSelectedCurrency(outboundTotalVat, 'HUF', selectedCurrency), selectedCurrency)}</td>
                              <td className="text-right">{formatCurrency(convertToSelectedCurrency(outboundTotalNet + outboundTotalVat, 'HUF', selectedCurrency), selectedCurrency)}</td>
                            </tr>
                          </>
                        ) : (
                          <tr>
                            <td colSpan={3} className="text-center py-4 text-muted-foreground">{t('vat.no_data', 'Nincs adat')}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Inbound */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-1 h-5 bg-purple-600 rounded" />
                    <h4 className="font-medium">{t('vat.inbound_vat_content', 'Kiadások ÁFA tartalma')}</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-muted-foreground">
                          <th className="text-left py-2">{t('vat.categories', 'ÁFA kategóriák:')}</th>
                          <th className="text-right py-2">{t('vat.deductible_vat', 'Levonható ÁFA:')}</th>
                          <th className="text-right py-2">{t('vat.costs', 'Költségek:')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inboundVatCategories.length > 0 ? (
                          <>
                            {inboundVatCategories.map(cat => (
                              <tr key={cat.rate}>
                                <td className="py-1">{cat.rate}:</td>
                                <td className="text-right">{formatCurrency(convertToSelectedCurrency(cat.vatAmount, 'HUF', selectedCurrency), selectedCurrency)}</td>
                                <td className="text-right">{formatCurrency(convertToSelectedCurrency(cat.netAmount + cat.vatAmount, 'HUF', selectedCurrency), selectedCurrency)}</td>
                              </tr>
                            ))}
                            <tr className="font-medium border-t">
                              <td className="py-1">{t('vat.total', 'Összesen:')}</td>
                              <td className="text-right">{formatCurrency(convertToSelectedCurrency(inboundTotalVat, 'HUF', selectedCurrency), selectedCurrency)}</td>
                              <td className="text-right">{formatCurrency(convertToSelectedCurrency(inboundTotalNet + inboundTotalVat, 'HUF', selectedCurrency), selectedCurrency)}</td>
                            </tr>
                          </>
                        ) : (
                          <tr>
                            <td colSpan={3} className="text-center py-4 text-muted-foreground">{t('vat.no_data', 'Nincs adat')}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
});

export default VatSection;
