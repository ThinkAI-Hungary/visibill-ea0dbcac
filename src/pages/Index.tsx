import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useDashboardPreferences } from '@/hooks/useDashboardPreferences';
import { useActivePreset } from '@/hooks/useActivePreset';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import EmptyStateDashboard from '@/components/dashboard/EmptyStateDashboard';
import { ProductTour } from '@/components/ProductTour';
import DashboardPageSkeleton from '@/components/dashboard/DashboardPageSkeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import DashboardWelcome from '@/components/dashboard/DashboardWelcome';
import DashboardMetrics from '@/components/dashboard/DashboardMetrics';
import VatSection from '@/components/dashboard/VatSection';
import FxDifferencesSection from '@/components/dashboard/FxDifferencesSection';
import RevenueExpensesChart from '@/components/dashboard/RevenueExpensesChart';
import RecentInvoices from '@/components/dashboard/RecentInvoices';
import ProjectBreakdown from '@/components/dashboard/ProjectBreakdown';

import InvoiceImageDialog from '@/components/InvoiceImageDialog';
import InvoiceStatusTables from '@/components/dashboard/InvoiceStatusTables';
import UnmatchedSection from '@/components/dashboard/UnmatchedItemsModal';
import ProfileSummary from '@/components/dashboard/ProfileSummary';
import QuickActions from '@/components/dashboard/QuickActions';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import type { Invoice } from '@/hooks/useDashboardData';

/**
 * Wrapper that isolates dialog state so opening/closing the image preview
 * does NOT re-render the entire Dashboard (P0-3 fix).
 */
function RecentInvoicesWithDialog({ invoices }: { invoices: Invoice[] }) {
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleViewInvoice = useCallback((invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsDialogOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setIsDialogOpen(false);
    setSelectedInvoice(null);
  }, []);

  return (
    <>
      <RecentInvoices invoices={invoices} onViewInvoice={handleViewInvoice} />
      <InvoiceImageDialog
        invoice={selectedInvoice}
        open={isDialogOpen}
        onClose={handleClose}
      />
    </>
  );
}

const Index = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { role } = useUserRole();

  const {
    selectedCompany, companies, companyLoading,
    dateFrom, dateTo,
    profile, tourCompleted,
    metrics, metricsLoading,
    navVatData, pettyCashBalances,
    fxDifferences, fxMonthlySummary, fxGlSettings,
    invoices, analyticsLoading,
    vatBreakdown, exchangeRates,
    categoryBreakdownData,
    convertToSelectedCurrency,
    buildMonthlyData,
  } = useDashboardData();

  const prefs = useDashboardPreferences();
  const queryClient = useQueryClient();

  // GL accounts for FX mapping
  const { activePresetId } = useActivePreset(selectedCompany?.id);
  const { data: glAccounts = [] } = useQuery<{ id: string; gl_number: string; short_name: string }[]>({
    queryKey: ['fx-gl-accounts', activePresetId],
    queryFn: async () => {
      const { data } = await supabase
        .from('gl_accounts')
        .select('id, gl_number, short_name')
        .eq('preset_id', activePresetId!)
        .order('gl_number');
      return (data || []) as { id: string; gl_number: string; short_name: string }[];
    },
    enabled: !!activePresetId,
  });

  // FX GL settings mutation
  const updateFxGlMutation = useMutation({
    mutationFn: async ({ gainGl, lossGl }: { gainGl: string; lossGl: string }) => {
      const { error } = await supabase
        .from('company_fx_settings')
        .upsert({
          company_id: selectedCompany!.id,
          fx_gain_gl_number: gainGl,
          fx_loss_gl_number: lossGl,
        } as any, { onConflict: 'company_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fx-gl-settings'] });
      queryClient.invalidateQueries({ queryKey: ['glItems'] });
      queryClient.invalidateQueries({ queryKey: ['glItems_bs'] });
      queryClient.invalidateQueries({ queryKey: ['bs_report'] });
      queryClient.invalidateQueries({ queryKey: ['pnl_report'] });
    },
  });

  const handleSaveFxGl = useCallback((gainGl: string, lossGl: string) => {
    updateFxGlMutation.mutate({ gainGl, lossGl });
  }, [updateFxGlMutation]);

  // Tour state — skip for support_admin (impersonation sessions)
  const [showTour, setShowTour] = useState(false);
  useEffect(() => {
    if (tourCompleted === false && role !== 'support_admin') {
      const timer = setTimeout(() => setShowTour(true), 500);
      return () => clearTimeout(timer);
    }
  }, [tourCompleted, role]);

  // Invoice image dialog state is now isolated in RecentInvoicesWithDialog (P0-3)

  // Computed
  const displayedPeriod = useMemo(
    () => `${format(dateFrom, 'yyyy. MMM dd.', { locale: hu })} - ${format(dateTo, 'yyyy. MMM dd.', { locale: hu })}`,
    [dateFrom, dateTo]
  );

  const monthlyData = useMemo(
    () => buildMonthlyData(prefs.showBrutto),
    [buildMonthlyData, prefs.showBrutto]
  );

  const handleOnboardingComplete = () => {
    setTimeout(() => setShowTour(true), 500);
  };

  // Empty / loading states
  if (!companyLoading && companies.length === 0) {
    return <EmptyStateDashboard onOnboardingComplete={handleOnboardingComplete} />;
  }
  if (companyLoading || (metricsLoading && !metrics)) {
    return <DashboardPageSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background page-animate">
      <main className="container mx-auto px-4 py-8 space-y-8">
        <DashboardWelcome
          profileName={profile?.name}
          selectedCurrency={prefs.selectedCurrency}
          onCurrencyChange={prefs.setSelectedCurrency}
          showBrutto={prefs.showBrutto}
          onShowBruttoChange={prefs.setShowBrutto}
        />

        {metrics && (
          <DashboardMetrics
            metrics={metrics}
            navVatData={navVatData}
            showBrutto={prefs.showBrutto}
            selectedCurrency={prefs.selectedCurrency}
            pettyCashBalances={pettyCashBalances}
            convertToSelectedCurrency={convertToSelectedCurrency}
          />
        )}

        <VatSection
          navVatData={navVatData}
          vatBreakdown={vatBreakdown}
          selectedCurrency={prefs.selectedCurrency}
          displayedPeriod={displayedPeriod}
          convertToSelectedCurrency={convertToSelectedCurrency}
          vatSectionOpen={prefs.vatSectionOpen}
          onVatSectionOpenChange={prefs.setVatSectionOpen}
          vatRegime={selectedCompany?.vat_regime}
        />

        <FxDifferencesSection
          fxDifferences={fxDifferences}
          fxMonthlySummary={fxMonthlySummary}
          isOpen={prefs.fxSectionOpen}
          onOpenChange={prefs.setFxSectionOpen}
          fxGlSettings={fxGlSettings}
          glAccounts={glAccounts}
          onSaveFxGl={handleSaveFxGl}
        />

        <UnmatchedSection />

        <InvoiceStatusTables />

        <RevenueExpensesChart
          monthlyData={monthlyData}
          chartLines={prefs.chartLines}
          showBrutto={prefs.showBrutto}
          analyticsLoading={analyticsLoading}
          dateFrom={dateFrom}
          revenueSectionOpen={prefs.revenueSectionOpen}
          onRevenueSectionOpenChange={prefs.setRevenueSectionOpen}
          onSetChartLine={prefs.setChartLine}
          onSetShowBrutto={prefs.setShowBrutto}
        />

        {/* Main Dashboard Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="lg:col-span-2">
                  <RecentInvoicesWithDialog invoices={invoices} />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>A legutóbb feldolgozott számlák listája</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="space-y-6">

            <ProjectBreakdown
              projects={categoryBreakdownData}
              totalAmount={Object.values(metrics?.totalAmountByCurrency || {}).reduce((sum, val) => sum + val, 0)}
            />
          </div>
        </div>

        <ProfileSummary profile={profile} email={user?.email} />
        <QuickActions />
      </main>

      {/* InvoiceImageDialog is now inside RecentInvoicesWithDialog */}

      <ProductTour
        run={showTour}
        onComplete={() => setShowTour(false)}
      />
    </div>
  );
};

export default Index;
