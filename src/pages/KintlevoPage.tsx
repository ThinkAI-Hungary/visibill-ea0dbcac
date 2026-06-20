import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useKintlevoData } from '@/hooks/useKintlevoData';
import { useEaisybillPermissions } from '@/hooks/useEaisybillPermissions';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Mail, Search } from 'lucide-react';
import { KintlevoSummaryCards } from '@/components/kintlevo/KintlevoSummaryCards';
import { KintlevoCompanyTable } from '@/components/kintlevo/KintlevoCompanyTable';
import { DunningDialog } from '@/components/kintlevo/DunningDialog';

function KintlevoSkeleton() {
  return (
    <div className="h-full space-y-4 px-4 pt-4 pb-6 page-animate">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Kintlévőség</h1>
        <p className="text-muted-foreground text-sm">Kifizetetlen kimenő számlák cégenként csoportosítva</p>
      </div>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-10 max-w-sm rounded-lg" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export default function KintlevoPage() {
  const {
    selectedCompany, queryClient,
    search, setSearch, expanded, setExpanded,
    isLoading, allInvoices, companyGroups, filteredGroups, totals, grandTotal,
    updatePartnerEmail,
  } = useKintlevoData();

  const [searchParams, setSearchParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { canWrite: canWriteModule } = useEaisybillPermissions();
  const writable = canWriteModule('receivables');

  // ── URL param helpers ──
  const setDunningParam = useCallback((open: boolean) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (open) next.set('action', 'dunning');
      else next.delete('action');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const handleOpenDunning = useCallback(() => {
    setDialogOpen(true);
    setDunningParam(true);
  }, [setDunningParam]);

  const handleCloseDunning = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open) setDunningParam(false);
  }, [setDunningParam]);

  // Auto-open from URL
  const actionFromUrl = searchParams.get('action');
  useEffect(() => {
    if (actionFromUrl === 'dunning' && !dialogOpen) setDialogOpen(true);
  }, [actionFromUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <KintlevoSkeleton />;

  return (
    <TooltipProvider>
      <div className="h-full space-y-4 px-4 pt-4 pb-6 page-animate">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Kintlévőség</h1>
            <p className="text-muted-foreground text-sm">
              Kifizetetlen kimenő számlák cégenként csoportosítva
            </p>
          </div>
          <Button size="lg" className="gap-2 shrink-0" onClick={handleOpenDunning} disabled={!writable} title={!writable ? 'Nincs írási jogosultságod' : undefined}>
            <Mail className="h-4 w-4" />
            Felszólítás küldése
          </Button>
        </div>

        {/* Summary cards */}
        <KintlevoSummaryCards
          totals={totals}
          grandTotal={grandTotal}
          companyGroups={companyGroups}
          allInvoices={allInvoices}
        />

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cég neve..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Company list */}
        <KintlevoCompanyTable
          filteredGroups={filteredGroups}
          expanded={expanded}
          setExpanded={setExpanded}
        />
      </div>

      {/* Dunning Dialog */}
      <DunningDialog
        open={dialogOpen}
        onOpenChange={handleCloseDunning}
        companyGroups={companyGroups}
        selectedCompanyId={selectedCompany?.id || ''}
        selectedCompanyName={selectedCompany?.name || ''}
        queryClient={queryClient}
        updatePartnerEmail={async (args) => { await updatePartnerEmail.mutateAsync(args); }}
      />
    </TooltipProvider>
  );
}
