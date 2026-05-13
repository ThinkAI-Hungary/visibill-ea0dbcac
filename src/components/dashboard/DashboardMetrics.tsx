import React from 'react';
import MetricCard from './MetricCard';
import { Upload, ArrowUpRight, ArrowDownLeft, TrendingUp, Banknote, Wallet, Euro } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { DashboardMetrics as Metrics, NavVatData } from '@/hooks/useDashboardData';

interface DashboardMetricsProps {
  metrics: Metrics;
  navVatData: NavVatData | undefined;
  showBrutto: boolean;
  selectedCurrency: string;
  pettyCashBalance: number | null;
  convertToSelectedCurrency: (amount: number, fromCurrency: string, selectedCurrency: string) => number;
}

const DashboardMetrics = React.memo(function DashboardMetrics({
  metrics,
  navVatData,
  showBrutto,
  selectedCurrency,
  pettyCashBalance,
  convertToSelectedCurrency,
}: DashboardMetricsProps) {
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

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 items-stretch">
      <MetricCard
        title="Feltöltött számlák"
        value={metrics.totalInvoices}
        description={`${metrics.completedCount} feldolgozva`}
        icon={Upload}
        variant="default"
      />
      <MetricCard
        title={`Bevétel (${showBrutto ? 'bruttó' : 'nettó'})`}
        value={
          revenueData && Object.keys(revenueData).length > 0
            ? Object.entries(revenueData)
                .map(([currency, amount]) => formatCurrency(amount, currency))
                .join(' | ')
            : '0 Ft'
        }
        description="NAV OUTBOUND"
        icon={ArrowUpRight}
        variant="success"
      />
      <MetricCard
        title={`Kintlévőség (${showBrutto ? 'bruttó' : 'nettó'})`}
        value={
          unpaidOutboundData && Object.keys(unpaidOutboundData).length > 0
            ? Object.entries(unpaidOutboundData)
                .map(([currency, amount]) => formatCurrency(amount, currency))
                .join(' | ')
            : '0 Ft'
        }
        description="Kifizetetlen kimenő számlák"
        icon={TrendingUp}
        variant="info"
      />
      <MetricCard
        title="Házipénztár"
        value={formatCurrency(pettyCashBalance ?? 0)}
        description="Aktuális készpénz egyenleg"
        icon={Banknote}
        variant={pettyCashBalance !== null && pettyCashBalance >= 0 ? 'success' : 'destructive'}
      />
      <MetricCard
        title={`Kiadás (${showBrutto ? 'bruttó' : 'nettó'})`}
        value={
          expensesData && Object.keys(expensesData).length > 0
            ? Object.entries(expensesData)
                .map(([currency, amount]) => formatCurrency(amount, currency))
                .join(' | ')
            : '0 Ft'
        }
        description="NAV INBOUND"
        icon={ArrowDownLeft}
        variant="destructive"
      />
      <MetricCard
        title="Fizetendő ÁFA"
        value={formatCurrency(payableVat, selectedCurrency)}
        description="Összes - Levonható"
        icon={Euro}
        variant={payableVat >= 0 ? 'destructive' : 'success'}
      />
      <MetricCard
        title={`Szállítói köt. (${showBrutto ? 'bruttó' : 'nettó'})`}
        value={
          unpaidInboundData && Object.keys(unpaidInboundData).length > 0
            ? Object.entries(unpaidInboundData)
                .map(([currency, amount]) => formatCurrency(amount, currency))
                .join(' | ')
            : '0 Ft'
        }
        description="Kifizetetlen bejövő számlák"
        icon={Wallet}
        variant="destructive"
      />
    </div>
  );
});

export default DashboardMetrics;
