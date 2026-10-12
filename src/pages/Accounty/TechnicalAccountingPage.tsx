/**
 * Technical Accounting & Analytics Page (Module 22)
 * Intelligens főkönyvi adminisztráció, auditbiztos tömeges korrekció
 * és partneri 360°-os pénzügyi rálátás motorja.
 */

import React, { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Wrench,
  ArrowLeftRight,
  Users2,
  ListTree,
  ShieldAlert,
  History,
  Info,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useCompany } from '@/contexts/CompanyContext';
import { useDateRange } from '@/contexts/DateRangeContext';
import { useAccountingAnomalies } from '@/hooks/useTechnicalAccounting';

// 5 Core Tabs
import { ReclassificationTab } from '@/components/technical-accounting/ReclassificationTab';
import { Partner360DossierTab } from '@/components/technical-accounting/Partner360DossierTab';
import { OmniPartnerLedgerTab } from '@/components/technical-accounting/OmniPartnerLedgerTab';
import { AiAuditGuardTab } from '@/components/technical-accounting/AiAuditGuardTab';
import { ReclassificationAuditLogTab } from '@/components/technical-accounting/ReclassificationAuditLogTab';

export default function TechnicalAccountingPage() {
  const { companyId: routeCompanyId, clientId, tab: routeTab } = useParams<{
    companyId?: string;
    clientId?: string;
    tab?: string;
  }>();

  const { selectedCompany } = useCompany();
  const { dateFromFormatted: dateFrom, dateToFormatted: dateTo } = useDateRange();
  const [searchParams, setSearchParams] = useSearchParams();

  // Resolve active companyId
  const effectiveCompanyId = useMemo(() => {
    return routeCompanyId || clientId || selectedCompany?.id || '';
  }, [routeCompanyId, clientId, selectedCompany?.id]);

  // Resolve active tab from query param or route param
  const activeTab = searchParams.get('tab') || routeTab || 'reclassification';

  // Anomaly count for badge
  const { data: anomalies } = useAccountingAnomalies(
    effectiveCompanyId,
    dateFrom,
    dateTo
  );
  const anomalyCount = anomalies?.total_anomalies_count || 0;

  const handleTabChange = (value: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', value);
    setSearchParams(newParams);
  };

  if (!effectiveCompanyId) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Info className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
        <h3 className="font-semibold text-foreground text-lg">Nincs kiválasztott cég</h3>
        <p className="text-sm mt-1">
          Kérjük, válasszon ki egy céget a technikai műveletek és elemzések megtekintéséhez.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6 max-w-7xl animate-in fade-in duration-300">
      <PageHeader
        title="Technikai Műveletek & Elemzések"
        description="Főkönyvi tételek auditbiztos tömeges átsorolása, Partner 360° likviditási mátrix és mesterséges intelligencia által támogatott anomália-ellenőrzés."
      >
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs gap-1 py-1 px-2.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20">
            <Wrench className="h-3.5 w-3.5" />
            Modul 22 · Sztv. 165–169. §
          </Badge>
          {anomalyCount > 0 && (
            <Badge variant="destructive" className="gap-1 py-1 px-2.5 animate-pulse text-xs">
              <ShieldAlert className="h-3.5 w-3.5" />
              {anomalyCount} db anomália
            </Badge>
          )}
        </div>
      </PageHeader>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <div className="border-b border-border/60 pb-px">
          <TabsList className="bg-muted/50 p-1 h-auto flex flex-wrap gap-1">
            <TabsTrigger
              value="reclassification"
              className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm py-2 px-3 text-xs sm:text-sm font-medium"
            >
              <ArrowLeftRight className="h-4 w-4 text-primary" />
              <span>Tömeges Átsorolás</span>
            </TabsTrigger>

            <TabsTrigger
              value="partner-dossier"
              className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm py-2 px-3 text-xs sm:text-sm font-medium"
            >
              <Users2 className="h-4 w-4 text-emerald-500" />
              <span>Partner 360° Dosszié</span>
            </TabsTrigger>

            <TabsTrigger
              value="omni-ledger"
              className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm py-2 px-3 text-xs sm:text-sm font-medium"
            >
              <ListTree className="h-4 w-4 text-blue-500" />
              <span>Omni Partnerbontás</span>
            </TabsTrigger>

            <TabsTrigger
              value="ai-audit"
              className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm py-2 px-3 text-xs sm:text-sm font-medium"
            >
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              <span>AI Audit & Anomáliák</span>
              {anomalyCount > 0 && (
                <Badge
                  variant="secondary"
                  className="h-5 px-1.5 min-w-[20px] text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-full"
                >
                  {anomalyCount}
                </Badge>
              )}
            </TabsTrigger>

            <TabsTrigger
              value="audit-log"
              className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm py-2 px-3 text-xs sm:text-sm font-medium"
            >
              <History className="h-4 w-4 text-indigo-500" />
              <span>Audit Napló & Rollback</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* 1. Tömeges Átsorolás Varázsló */}
        <TabsContent value="reclassification" className="focus-visible:outline-none">
          <ReclassificationTab
            companyId={effectiveCompanyId}
            onOpenPartnerDossier={(partnerId) => {
              const newParams = new URLSearchParams(searchParams);
              newParams.set('tab', 'partner-dossier');
              newParams.set('partnerId', partnerId);
              setSearchParams(newParams);
            }}
          />
        </TabsContent>

        {/* 2. Partner 360° Dosszié */}
        <TabsContent value="partner-dossier" className="focus-visible:outline-none">
          <Partner360DossierTab
            companyId={effectiveCompanyId}
            initialPartnerId={searchParams.get('partnerId') || undefined}
          />
        </TabsContent>

        {/* 3. Omni Partnerbontás */}
        <TabsContent value="omni-ledger" className="focus-visible:outline-none">
          <OmniPartnerLedgerTab
            companyId={effectiveCompanyId}
            onSelectPartner={(partnerId) => {
              const newParams = new URLSearchParams(searchParams);
              newParams.set('tab', 'partner-dossier');
              newParams.set('partnerId', partnerId);
              setSearchParams(newParams);
            }}
          />
        </TabsContent>

        {/* 4. AI Audit & Anomália Vizsgáló */}
        <TabsContent value="ai-audit" className="focus-visible:outline-none">
          <AiAuditGuardTab companyId={effectiveCompanyId} />
        </TabsContent>

        {/* 5. Átvezetési Audit Napló & Visszagörgetés */}
        <TabsContent value="audit-log" className="focus-visible:outline-none">
          <ReclassificationAuditLogTab companyId={effectiveCompanyId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
