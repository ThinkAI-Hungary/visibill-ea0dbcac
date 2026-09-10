import React from 'react';
import MetricCard from './MetricCard';
import { Upload, ArrowUpRight, ArrowDownLeft, TrendingUp, Banknote, Wallet, Euro } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { getActiveLocale } from '@/lib/locale/formatters';
import type { DashboardMetrics as Metrics, NavVatData } from '@/hooks/useDashboardData';

interface PettyCashCurrencyBalance {
  currency: string;
  balance: number;
}

interface DashboardMetricsProps {
  metrics: Metrics;
  navVatData: NavVatData | undefined;
  showBrutto: boolean;
  selectedCurrency: string;
  pettyCashBalances: PettyCashCurrencyBalance[];
  convertToSelectedCurrency: (amount: number, fromCurrency: string, selectedCurrency: string) => number;
}

const DashboardMetrics = React.memo(function DashboardMetrics({
  metrics,
  navVatData,
  showBrutto,
  selectedCurrency,
  pettyCashBalances,
  convertToSelectedCurrency,
}: DashboardMetricsProps) {
  const { t } = useTranslation(['dashboard', 'invoices', 'navigation', 'common']);
  const isHr = getActiveLocale() === 'hr';

  let payableVat = 0;
  if (navVatData) {
    const inboundTotal = Object.entries(navVatData.inboundVat || {}).reduce((total, [currency, amount]) => {
      return total + convertToSelectedCurrency(amount, currency, selectedCurrency);
    }, 0);
    const outboundTotal = Object.entries(navVatData.outboundVat || {}).reduce((total, [currency, amount]) => {
      return total + convertToSelectedCurrency(amount, currency, selectedCurrency);
    }, 0);
    payableVat = outboundTotal - inboundTotal;
  }

  const revenueData = showBrutto ? navVatData?.revenueGross : navVatData?.revenueNet;
  const expensesData = showBrutto ? navVatData?.expensesGross : navVatData?.expensesNet;
  const unpaidInboundData = showBrutto ? navVatData?.unpaidInboundGross : navVatData?.unpaidInboundNet;
  const unpaidOutboundData = showBrutto ? navVatData?.unpaidOutboundGross : navVatData?.unpaidOutboundNet;

  // Helper to filter out zero-value currencies and format the remaining ones
  const formatMultiCurrency = (data: Record<string, number> | undefined) => {
    const zeroFallback = isHr ? '0 €' : '0 Ft';
    if (!data || Object.keys(data).length === 0) return zeroFallback;
    const activeEntries = Object.entries(data).filter(([_, amount]) => Math.abs(amount) > 0.01);
    if (activeEntries.length === 0) return zeroFallback;
    return activeEntries
      .map(([currency, amount]) => formatCurrency(amount, currency))
      .join(' | ');
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 items-stretch">
      <MetricCard
        title={t('invoices:actions.upload_invoice', { defaultValue: 'Feltöltött számlák' })}
        value={metrics.totalInvoices}
        description={`${metrics.completedCount} ${t('common:status.completed', { defaultValue: 'feldolgozva' })}`}
        icon={Upload}
        variant="default"
      />
      <MetricCard
        title={`${t('dashboard:kpis.income', { defaultValue: 'Bevétel' })} (${showBrutto ? 'bruto' : 'neto'})`}
        value={formatMultiCurrency(revenueData)}
        description="OUTBOUND"
        icon={ArrowUpRight}
        variant="success"
      />
      <MetricCard
        title={`${t('navigation:items.kintlevo', { defaultValue: 'Kintlévőség' })} (${showBrutto ? 'bruto' : 'neto'})`}
        value={formatMultiCurrency(unpaidOutboundData)}
        description={t('dashboard:kpis.unpaid_outgoing', { defaultValue: 'Kifizetetlen kimenő számlák' })}
        icon={TrendingUp}
        variant="info"
      />
      <MetricCard
        title={t('navigation:items.petty_cash', { defaultValue: 'Házipénztár' })}
        value={
          pettyCashBalances.length > 0
            ? pettyCashBalances.map(b => formatCurrency(Math.round(b.currency === 'HUF' ? Math.round(b.balance / 5) * 5 : b.balance * 100) / (b.currency === 'HUF' ? 1 : 100), b.currency)).join(' | ')
            : '—'
        }
        description={t('dashboard:kpis.cash_balance', { defaultValue: 'Összesített készpénz egyenleg' })}
        icon={Banknote}
        variant={pettyCashBalances.length > 0 && pettyCashBalances.every(b => b.balance >= 0) ? 'success' : pettyCashBalances.length === 0 ? 'default' : 'destructive'}
      />
      <MetricCard
        title={`${t('dashboard:kpis.expenses', { defaultValue: 'Kiadás' })} (${showBrutto ? 'bruto' : 'neto'})`}
        value={formatMultiCurrency(expensesData)}
        description="INBOUND"
        icon={ArrowDownLeft}
        variant="destructive"
      />
      <MetricCard
        title={t('invoices:columns.vat_amount', { defaultValue: 'Fizetendő ÁFA' })}
        value={formatCurrency(payableVat, selectedCurrency)}
        description={isHr ? "Ukupno - Odbitno" : "Összes - Levonható"}
        icon={Euro}
        variant={payableVat >= 0 ? 'destructive' : 'success'}
      />
      <MetricCard
        title={`${t('dashboard:kpis.unpaid_incoming', { defaultValue: 'Szállítói köt.' })} (${showBrutto ? 'bruto' : 'neto'})`}
        value={formatMultiCurrency(unpaidInboundData)}
        description={isHr ? "Neplaćeni ulazni računi" : "Kifizetetlen bejövő számlák"}
        icon={Wallet}
        variant="destructive"
      />
    </div>
  );
});

export default DashboardMetrics;
