import React, { useCallback } from 'react';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import {
  Calculator,
  CalendarRange,
  Layers,
  Scale,
  ShieldCheck,
  BookOpen,
  FileSpreadsheet,
  UtensilsCrossed,
  Settings2,
  AlertTriangle,
} from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { VatCodeConfigTab } from '@/components/vat/VatCodeConfigTab';
import { VatReturnViewTab } from './VatReturnViewTab';
import { VatCollectorAnalyticsView } from './VatCollectorAnalyticsView';
import { VatMLineMasterDetail } from './VatMLineMasterDetail';
import { VatAnnualMatrixView } from './VatAnnualMatrixView';
import { VatSteelProductsSection } from './VatSteelProductsSection';
import { VatA60Table } from './VatA60Table';
import { VatItemizedJournalView } from './VatItemizedJournalView';
import { VatTourismTaxSection } from './VatTourismTaxSection';
import { VatScopeRadioGroup } from './VatScopeRadioGroup';
import { useVatScope } from '../hooks/useVatScope';
import type { VatScope } from '../types';
import { useVatReturnData } from '../hooks/useVatReturnData';
import { useTranslation } from 'react-i18next';

class VatReturnErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <Card className="border-destructive/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-destructive mb-2">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-medium">Hiba történt a renderelés során</span>
            </div>
            <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-40">
              {this.state.error.message}
              {'\n'}
              {this.state.error.stack}
            </pre>
            <Button
              className="mt-3"
              variant="outline"
              size="sm"
              onClick={() => this.setState({ error: null })}
            >
              Újrapróbálás
            </Button>
          </CardContent>
        </Card>
      );
    }
    return this.props.children;
  }
}

export function VatReturnContainer() {
  const { t } = useTranslation(['accounting', 'common']);
  const { selectedCompany } = useCompany();
  const { tab: pathTab } = useParams<{ tab?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const rawTab = searchParams.get('tab') || pathTab || 'return';
  const currentTab = rawTab === 'replica' ? 'return' : rawTab;

  const vatData = useVatReturnData();
  const {
    year,
    setYear,
    month,
    frequency,
    mLines,
    getVal,
    a60Calculations,
    viesStatuses,
    isValidatingVies,
    handleViesCheck,
    setEuTypeOverrides,
    calculate,
  } = vatData;

  const {
    vatScope,
    setVatScope,
    totalInboundCount,
    withImageInboundCount,
    missingImageCount,
    isLoadingCounts,
  } = useVatScope({
    companyId: selectedCompany?.id,
    year,
    month,
    frequency,
  });

  const handleScopeChange = useCallback(
    (newScope: VatScope) => {
      setVatScope(newScope);
    },
    [setVatScope]
  );

  const handleTabChange = useCallback(
    (newTab: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (newTab === 'return') {
            next.delete('tab');
          } else {
            next.set('tab', newTab);
          }
          return next;
        },
        { replace: true }
      );
      if (pathTab) {
        navigate(`../vat-return${newTab === 'return' ? '' : `/${newTab}`}`, { replace: true });
      }
    },
    [navigate, pathTab, setSearchParams]
  );

  if (!selectedCompany) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Válassz céget a folytatáshoz</p>
      </div>
    );
  }

  const isCroatia = selectedCompany?.country_code === 'HR';

  return (
    <div className="w-full max-w-none mx-auto px-2 sm:px-4 lg:px-6 pt-2 sm:pt-3 pb-24 space-y-4 print:py-0 print:p-0 print:m-0 page-animate">
      <PageHeader
        className="print:hidden"
        companyName={selectedCompany?.name}
        breadcrumb={
          isCroatia
            ? t('accounting:vat_return.breadcrumb_hr', 'Prijava PDV-a (Obrazac PDV)')
            : t('accounting:vat_return.breadcrumb', 'ÁFA Bevallás (2665)')
        }
        title={
          isCroatia
            ? t('accounting:vat_return.title_hr', 'Prijava PDV-a i Analitika')
            : t('accounting:vat_return.title', 'ÁFA Bevallás & Analitika')
        }
        description={
          currentTab === 'matrix'
            ? undefined
            : isCroatia
            ? t(
                'accounting:vat_return.description_hr',
                'Obrazac PDV — Generiranje prijave PDV-a i porezni izvještaji'
              )
            : t(
                'accounting:vat_return.description',
                '2665-ös nyomtatvány — Hivatalos ÁFA bevallás, M-lapok, éves mátrix és tételes analitikus kimutatások'
              )
        }
      />

      {/* Prominent VAT Processing Scope Selector ("NAGY rádiógomb") */}
      <VatScopeRadioGroup
        className="print:hidden"
        value={vatScope}
        onChange={handleScopeChange}
        totalCount={totalInboundCount}
        withImageCount={withImageInboundCount}
        missingCount={missingImageCount}
        isLoading={isLoadingCounts}
        onOpenOsaCheck={() => handleTabChange('teteles_m')}
      />

      <Tabs value={currentTab} onValueChange={handleTabChange} className="space-y-3 print:space-y-0">
        {/* Navigation Tabs Bar */}
        <TabsList className="print:hidden bg-muted/60 p-1 flex flex-wrap lg:flex-nowrap overflow-x-auto justify-start h-auto gap-1 border border-border/60 rounded-xl scrollbar-none shadow-sm">
          {/* 1. 65-ös Bevallás */}
          <TabsTrigger
            value="return"
            className="gap-1.5 text-xs py-2 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg whitespace-nowrap"
          >
            <Calculator className="w-4 h-4 text-primary" />
            {t('accounting:vat_return.tabs.return', '65-ös Bevallás')}
          </TabsTrigger>

          {/* 2. Éves ÁFA Mátrix */}
          <TabsTrigger
            value="matrix"
            className="gap-1.5 text-xs py-2 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg whitespace-nowrap"
          >
            <CalendarRange className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Éves Mátrix
          </TabsTrigger>

          {/* 3. Tételes M-lapok (NAV 65M) */}
          {!isCroatia && (
            <TabsTrigger
              value="teteles_m"
              className="gap-1.5 text-xs py-2 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg whitespace-nowrap"
            >
              <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Tételes M-lap
            </TabsTrigger>
          )}

          {/* 4. Fordított ÁFA (07/08 lapok) */}
          {!isCroatia && (
            <TabsTrigger
              value="forditott"
              className="gap-1.5 text-xs py-2 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg whitespace-nowrap"
            >
              <Scale className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              Fordított ÁFA (07/08)
            </TabsTrigger>
          )}

          {/* 5. A60 Közösségi összesítő */}
          {!isCroatia && (
            <TabsTrigger
              value="a60"
              className="gap-1.5 text-xs py-2 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg whitespace-nowrap"
            >
              <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              A60 Közösségi
            </TabsTrigger>
          )}

          {/* 6. ÁFA Tétellista (Analitikus napló) */}
          <TabsTrigger
            value="journal"
            className="gap-1.5 text-xs py-2 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg whitespace-nowrap"
          >
            <BookOpen className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            ÁFA Tétellista
          </TabsTrigger>

          {/* 7. Gyűjtőkódos & Bevallási soros Analitika */}
          <TabsTrigger
            value="analytics"
            className="gap-1.5 text-xs py-2 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg whitespace-nowrap"
          >
            <FileSpreadsheet className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            Gyűjtőkódok & Sorok
          </TabsTrigger>

          {/* 8. 26TFEJLH Turizmusfejlesztési hozzájárulás */}
          {!isCroatia && (
            <TabsTrigger
              value="tourism"
              className="gap-1.5 text-xs py-2 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg whitespace-nowrap"
            >
              <UtensilsCrossed className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              26TFEJLH
            </TabsTrigger>
          )}

          {/* 9. Beállítások */}
          <TabsTrigger
            value="config"
            className="gap-1.5 text-xs py-2 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg whitespace-nowrap"
          >
            <Settings2 className="w-4 h-4 text-muted-foreground" />
            {t('accounting:vat_return.tabs.config', 'Beállítás')}
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: 65-ös Bevallás & Főlap */}
        <TabsContent value="return" className="mt-0">
          <VatReturnErrorBoundary>
            <VatReturnViewTab />
          </VatReturnErrorBoundary>
        </TabsContent>

        {/* Tab 2: Éves ÁFA Mátrix */}
        <TabsContent value="matrix" className="mt-0">
          <VatReturnErrorBoundary>
            <VatAnnualMatrixView
              companyId={selectedCompany.id}
              year={year}
              onYearChange={setYear}
              selectedCompany={selectedCompany}
              vatScope={vatScope}
            />
          </VatReturnErrorBoundary>
        </TabsContent>

        {/* Tab 3: Tételes M-lapok (65M) + [NAV OSA Ellenőrzés] */}
        {!isCroatia && (
          <TabsContent value="teteles_m" className="mt-0">
            <VatReturnErrorBoundary>
              <VatMLineMasterDetail
                mLines={mLines}
                companyId={selectedCompany.id}
                year={year}
                month={month}
                frequency={frequency}
                selectedCompany={selectedCompany}
                vatScope={vatScope}
              />
            </VatReturnErrorBoundary>
          </TabsContent>
        )}

        {/* Tab 4: Fordított ÁFA (07/08 lapok) */}
        {!isCroatia && (
          <TabsContent value="forditott" className="mt-0">
            <VatReturnErrorBoundary>
              <VatSteelProductsSection
                selectedCompany={selectedCompany}
                year={year}
                month={month}
                frequency={frequency}
              />
            </VatReturnErrorBoundary>
          </TabsContent>
        )}

        {/* Tab 5: A60 Közösségi nyilatkozat */}
        {!isCroatia && (
          <TabsContent value="a60" className="mt-0">
            <VatReturnErrorBoundary>
              <VatA60Table
                a60Calculations={a60Calculations}
                viesStatuses={viesStatuses}
                isValidatingVies={isValidatingVies}
                handleViesCheck={handleViesCheck}
                setEuTypeOverrides={setEuTypeOverrides}
              />
            </VatReturnErrorBoundary>
          </TabsContent>
        )}

        {/* Tab 6: ÁFA Tétellista (Analitikus napló) */}
        <TabsContent value="journal" className="mt-0">
          <VatReturnErrorBoundary>
            <VatItemizedJournalView
              companyId={selectedCompany.id}
              year={year}
              month={month}
              frequency={frequency}
              selectedCompany={selectedCompany}
              vatScope={vatScope}
            />
          </VatReturnErrorBoundary>
        </TabsContent>

        {/* Tab 7: Gyűjtőkódos Analitika */}
        <TabsContent value="analytics" className="mt-0">
          <VatReturnErrorBoundary>
            <VatCollectorAnalyticsView
              year={year}
              periodMonth={month}
              vatScope={vatScope}
            />
          </VatReturnErrorBoundary>
        </TabsContent>

        {/* Tab 8: 26TFEJLH Turizmus */}
        {!isCroatia && (
          <TabsContent value="tourism" className="mt-0">
            <VatReturnErrorBoundary>
              <VatTourismTaxSection
                companyId={selectedCompany.id}
                year={year}
                month={month}
                frequency={frequency}
                selectedCompany={selectedCompany}
              />
            </VatReturnErrorBoundary>
          </TabsContent>
        )}

        {/* Tab 9: Beállítások */}
        <TabsContent value="config" className="mt-0">
          <VatCodeConfigTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
