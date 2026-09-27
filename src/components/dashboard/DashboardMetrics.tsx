import React from 'react';
import MetricCard, { type CurrencyRowItem } from './MetricCard';
import { Upload, ArrowUpRight, ArrowDownLeft, TrendingUp, Banknote, Wallet, Euro, Scale } from 'lucide-react';
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

  // Helper to extract clean structured rows per currency
  const getCurrencyRows = (
    data: Record<string, number> | undefined,
    defaultCurrency: string
  ): CurrencyRowItem[] => {
    if (!data || Object.keys(data).length === 0) {
      return [{
        currency: defaultCurrency,
        amount: 0,
        formatted: formatCurrency(0, defaultCurrency),
        isNegative: false,
      }];
    }
    const activeEntries = Object.entries(data).filter(([_, amount]) => Math.abs(amount) > 0.01);
    if (activeEntries.length === 0) {
      return [{
        currency: defaultCurrency,
        amount: 0,
        formatted: formatCurrency(0, defaultCurrency),
        isNegative: false,
      }];
    }
    return activeEntries.map(([currency, amount]) => ({
      currency,
      amount,
      formatted: formatCurrency(amount, currency),
      isNegative: amount < 0,
    }));
  };

  const revenueRows = getCurrencyRows(revenueData, selectedCurrency);
  const expensesRows = getCurrencyRows(expensesData, selectedCurrency);
  const unpaidOutboundRows = getCurrencyRows(unpaidOutboundData, selectedCurrency);
  const unpaidInboundRows = getCurrencyRows(unpaidInboundData, selectedCurrency);

  const pettyCashRows: CurrencyRowItem[] = pettyCashBalances.map(b => {
    const rounded = Math.round(b.currency === 'HUF' ? Math.round(b.balance / 5) * 5 : b.balance * 100) / (b.currency === 'HUF' ? 1 : 100);
    return {
      currency: b.currency,
      amount: rounded,
      formatted: formatCurrency(rounded, b.currency),
      isNegative: rounded < 0,
    };
  });

  // Calculate consolidated net operating balance (Revenue - Expenses) in selected currency
  const totalRevenueConverted = Object.entries(revenueData || {}).reduce((total, [currency, amount]) => {
    return total + convertToSelectedCurrency(amount, currency, selectedCurrency);
  }, 0);

  const totalExpensesConverted = Object.entries(expensesData || {}).reduce((total, [currency, amount]) => {
    return total + convertToSelectedCurrency(amount, currency, selectedCurrency);
  }, 0);

  const netOperatingBalance = totalRevenueConverted - totalExpensesConverted;

  const grossNetLabel = showBrutto
    ? t('dashboard:welcome.gross', { defaultValue: isHr ? 'bruto' : 'bruttó' })
    : t('dashboard:welcome.net', { defaultValue: isHr ? 'neto' : 'nettó' });

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 items-stretch">
      {/* 1. Összes bevétel */}
      <MetricCard
        title={`${t('dashboard:kpis.income', { defaultValue: 'Összes bevétel' })} (${grossNetLabel})`}
        currencyRows={revenueRows}
        description="OUTBOUND"
        icon={ArrowUpRight}
        variant="success"
      />

      {/* 2. Összes kiadás */}
      <MetricCard
        title={`${t('dashboard:kpis.expenses', { defaultValue: 'Összes kiadás' })} (${grossNetLabel})`}
        currencyRows={expensesRows}
        description="INBOUND"
        icon={ArrowDownLeft}
        variant="slate"
      />

      {/* 3. Operatív egyenleg / Cash-Flow balance */}
      <MetricCard
        title={`${t('dashboard:kpis.profit', { defaultValue: 'Operatív eredmény' })} (${grossNetLabel})`}
        value={formatCurrency(netOperatingBalance, selectedCurrency)}
        description={t('dashboard:kpis.revenue_minus_expenses', { defaultValue: isHr ? 'Prihodi - Rashodi' : 'Bevétel - Kiadás' })}
        footerBadge={t('dashboard:kpis.consolidated', { defaultValue: isHr ? 'Konsolidirano' : 'Konszolidált' })}
        icon={Scale}
        variant={netOperatingBalance >= 0 ? 'primary' : 'destructive'}
      />

      {/* 4. Feltöltött számlák */}
      <MetricCard
        title={t('invoices:actions.upload_invoice', { defaultValue: 'Feltöltött számlák' })}
        value={`${metrics.totalInvoices} db`}
        description={t('common:status.invoices_uploaded', { defaultValue: 'Bizonylat összesen' })}
        footerBadge={`${metrics.completedCount} ${t('common:status.completed', { defaultValue: 'feldolgozva' })}`}
        icon={Upload}
        variant="default"
      />

      {/* 5. Kintlévőség */}
      <MetricCard
        title={`${t('navigation:items.kintlevo', { defaultValue: 'Kintlévőség' })} (${grossNetLabel})`}
        currencyRows={unpaidOutboundRows}
        description={t('dashboard:kpis.unpaid_outgoing', { defaultValue: 'Kifizetetlen kimenő számlák' })}
        icon={TrendingUp}
        variant="info"
      />

      {/* 6. Kifizetetlen bejövő számlák (Szállítói köt.) */}
      <MetricCard
        title={`${t('dashboard:kpis.unpaid_incoming', { defaultValue: 'Szállítói köt.' })} (${grossNetLabel})`}
        currencyRows={unpaidInboundRows}
        description={t('dashboard:kpis.unpaid_inbound_desc', { defaultValue: isHr ? "Neplaćeni ulazni računi" : "Kifizetetlen bejövő számlák" })}
        icon={Wallet}
        variant="warning"
      />

      {/* 7. Fizetendő ÁFA */}
      <MetricCard
        title={t('invoices:columns.vat_amount', { defaultValue: 'Fizetendő ÁFA' })}
        value={formatCurrency(payableVat, selectedCurrency)}
        description={t('dashboard:kpis.vat_diff_desc', { defaultValue: isHr ? "Ukupno - Odbitno" : "Összes - Levonható" })}
        footerBadge={payableVat >= 0 ? t('common:status.payable', { defaultValue: 'Fizetendő' }) : t('common:status.claimable', { defaultValue: 'Visszaigényelhető' })}
        icon={Euro}
        variant={payableVat >= 0 ? 'purple' : 'success'}
      />

      {/* 8. Házipénztár */}
      <MetricCard
        title={t('navigation:items.petty_cash', { defaultValue: 'Házipénztár' })}
        currencyRows={pettyCashRows.length > 0 ? pettyCashRows : undefined}
        value={pettyCashRows.length === 0 ? '—' : undefined}
        description={t('dashboard:kpis.cash_balance', { defaultValue: 'Pénztár egyenleg' })}
        footerBadge={
          pettyCashRows.some(r => r.isNegative)
            ? t('dashboard:kpis.cash_negative', { defaultValue: 'Negatív' })
            : pettyCashRows.length > 0
              ? t('dashboard:kpis.cash_ok', { defaultValue: 'Rendben' })
              : undefined
        }
        icon={Banknote}
        variant={
          pettyCashRows.length > 0 && pettyCashRows.every(r => !r.isNegative)
            ? 'success'
            : pettyCashRows.length === 0
              ? 'default'
              : 'destructive'
        }
      />
    </div>
  );
});

export default DashboardMetrics;

