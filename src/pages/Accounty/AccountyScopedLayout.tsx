import { useEffect, useRef, useState } from 'react';
import { Outlet, useParams, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAccountyClients } from '@/hooks/accounty';
import { useDateRange } from '@/contexts/DateRangeContext';
import { parseDateRange, generateAccountyScopedPath, extractAccountyPageSegment } from '@/lib/navigation';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AccountyScopedLayout() {
  const { companyId: urlCompanyId, dateRange: urlDateRange } = useParams<{
    companyId: string;
    dateRange: string;
  }>();

  const navigate = useNavigate();
  const location = useLocation();

  const { data: clients, isLoading: clientsLoading } = useAccountyClients();
  const { dateFromFormatted, dateToFormatted, setDateFrom, setDateTo } = useDateRange();
  const parsedUrlDateRange = urlDateRange ? parseDateRange(urlDateRange) : null;

  // Sync guard lock to prevent infinite redirect loops
  const syncingFromUrl = useRef(false);
  const [accessDenied, setAccessDenied] = useState(false);

  // Clear switch pending flag on mount when landing on a valid scoped route
  useEffect(() => {
    localStorage.removeItem('visibill_switch_pending');
  }, []);

  const isLegacyKeyword = ['payroll', 'client', 'missing-invoices'].includes(urlCompanyId || '');

  // 1. URL ➔ Context Sync & Legacy Redirect
  useEffect(() => {
    if (!urlCompanyId || !urlDateRange || clientsLoading || !clients) return;

    // Intercept legacy keywords matched as companyId and redirect to the correct scoped layout
    if (isLegacyKeyword) {
      const uuidRegex = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
      const isDateRangeUuid = uuidRegex.test(urlDateRange);

      if (isDateRangeUuid) {
        const pageSegment = extractAccountyPageSegment(location.pathname);
        const cleanPage = pageSegment.startsWith('/') ? pageSegment.slice(1) : pageSegment;
        
        let targetPath = '';
        if (urlCompanyId === 'payroll') {
          targetPath = `/eaisybooks/${urlDateRange}/${dateFromFormatted}_${dateToFormatted}/payroll/${cleanPage}`;
        } else if (urlCompanyId === 'client') {
          targetPath = `/eaisybooks/${urlDateRange}/${dateFromFormatted}_${dateToFormatted}/${cleanPage || 'overview'}`;
        } else if (urlCompanyId === 'missing-invoices') {
          targetPath = `/eaisybooks/${urlDateRange}/${dateFromFormatted}_${dateToFormatted}/missing-invoices/${cleanPage}`;
        }

        if (targetPath) {
          navigate(targetPath, { replace: true });
          return;
        }
      } else {
        // Fallback for corrupted URLs (e.g. /accounty/payroll/2026-01-01_2026-12-31/settings)
        navigate('/eaisybooks', { replace: true });
        return;
      }
    }

    syncingFromUrl.current = true;

    // Check client permission
    const hasClient = clients.some(c => c.id === urlCompanyId || c.companyId === urlCompanyId);
    if (!hasClient && clients.length > 0) {
      setAccessDenied(true);
      syncingFromUrl.current = false;
      return;
    }

    setAccessDenied(false);

    // Sync date range
    const parsed = parseDateRange(urlDateRange);
    if (parsed) {
      const urlFrom = formatCompact(parsed.from);
      const urlTo = formatCompact(parsed.to);
      if (urlFrom !== dateFromFormatted) setDateFrom(parsed.from);
      if (urlTo !== dateToFormatted) setDateTo(parsed.to);
    }

    // Release synchronization lock after a frame
    requestAnimationFrame(() => {
      syncingFromUrl.current = false;
    });
  }, [urlCompanyId, urlDateRange, clients, clientsLoading, isLegacyKeyword, dateFromFormatted, dateToFormatted, location.pathname, navigate]);

  // 1b. Store selected Accounty company in localStorage to remember it when switching to eaisybill
  useEffect(() => {
    if (urlCompanyId && !isLegacyKeyword && !accessDenied) {
      localStorage.setItem('eaisybooks_selected_company_id', urlCompanyId);
    }
  }, [urlCompanyId, isLegacyKeyword, accessDenied]);

  // 2. Context ➔ URL Sync (when date changes via UI)
  useEffect(() => {
    if (syncingFromUrl.current || accessDenied || !urlCompanyId || isLegacyKeyword) return;

    const currentDateRange = `${dateFromFormatted}_${dateToFormatted}`;
    const expectedPrefix = `/eaisybooks/${urlCompanyId}/${currentDateRange}`;

    if (!location.pathname.startsWith(expectedPrefix)) {
      const page = extractAccountyPageSegment(location.pathname);
      const newPath =
        generateAccountyScopedPath(
          urlCompanyId,
          dateFromFormatted,
          dateToFormatted,
          page === '/' ? '' : page.slice(1),
        ) + location.search + location.hash;
      navigate(newPath, { replace: true });
    }
  }, [urlCompanyId, dateFromFormatted, dateToFormatted, location.pathname, accessDenied, isLegacyKeyword, navigate]);

  if (clientsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-slate-400 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> Betöltés...
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] px-4">
        <div className="text-center max-w-md space-y-6">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">
              Hozzáférés megtagadva
            </h1>
            <p className="text-muted-foreground leading-relaxed">
              A keresett ügyfél nem található, vagy nincs hozzáférése az adataihoz.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setAccessDenied(false);
              navigate('/eaisybooks', { replace: true });
            }}
            className="px-6"
          >
            Vissza a portfólióhoz
          </Button>
        </div>
      </div>
    );
  }

  const isDateSynced = !parsedUrlDateRange || `${dateFromFormatted}_${dateToFormatted}` === urlDateRange;
  const isSyncing = !isDateSynced;

  return (
    <div style={isSyncing ? { opacity: 0, pointerEvents: 'none', minHeight: '50vh' } : undefined}>
      <Outlet />
    </div>
  );
}

function formatCompact(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
