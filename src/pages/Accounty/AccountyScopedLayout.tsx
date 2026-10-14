import { useEffect, useRef, useState } from 'react';
import { Outlet, useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useAccountyClients } from '@/hooks/accounty';
import { useDateRange } from '@/contexts/DateRangeContext';
import { parseDateRange, generateAccountyScopedPath, extractAccountyPageSegment } from '@/lib/navigation';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAccountyShell } from '@/pages/Accounty/AccountyShellContext';

export default function AccountyScopedLayout() {
  const { t } = useTranslation('accounty');
  const { companyId: urlCompanyId, dateRange: urlDateRange } = useParams<{
    companyId: string;
    dateRange: string;
  }>();

  const navigate = useNavigate();
  const location = useLocation();
  const prefix = location.pathname.startsWith('/hr') ? '/hr' : '';

  const { user } = useAuth();
  const { data: clients, isLoading: clientsLoading } = useAccountyClients();
  const { dateFromFormatted, dateToFormatted, setDateFrom, setDateTo } = useDateRange();
  const { setSelectedClientId } = useAccountyShell();
  const parsedUrlDateRange = urlDateRange ? parseDateRange(urlDateRange) : null;

  // Sync guard refs to prevent fighting between URL ➔ Context and Context ➔ URL
  const isNavigatingFromContext = useRef(false);
  const lastSyncedUrlRange = useRef<string | null>(null);
  const [deniedCompanyId, setDeniedCompanyId] = useState<string | null>(null);
  const accessDenied = Boolean(urlCompanyId && deniedCompanyId === urlCompanyId);

  // Keep a ref of current context range so Effect 1 can read it without subscribing to its re-renders
  const contextRange = `${dateFromFormatted}_${dateToFormatted}`;
  const contextRangeRef = useRef(contextRange);
  useEffect(() => {
    contextRangeRef.current = contextRange;
  }, [contextRange]);

  // Clear switch pending flag on mount when landing on a valid scoped route
  useEffect(() => {
    localStorage.removeItem('visibill_switch_pending');
  }, []);

  const isLegacyKeyword = ['payroll', 'client', 'missing-invoices'].includes(urlCompanyId || '');

  // Inform the AccountyShellContext about the active scoped client
  useEffect(() => {
    if (urlCompanyId && !isLegacyKeyword && !accessDenied) {
      setSelectedClientId(urlCompanyId);
    }
    return () => {
      setSelectedClientId(null);
    };
  }, [urlCompanyId, isLegacyKeyword, accessDenied, setSelectedClientId]);

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
          targetPath = `/eaisybooks/${urlDateRange}/${contextRangeRef.current}/payroll/${cleanPage}`;
        } else if (urlCompanyId === 'client') {
          targetPath = `/eaisybooks/${urlDateRange}/${contextRangeRef.current}/${cleanPage || 'overview'}`;
        } else if (urlCompanyId === 'missing-invoices') {
          targetPath = `/eaisybooks/${urlDateRange}/${contextRangeRef.current}/missing-invoices/${cleanPage}`;
        }

        if (targetPath) {
          navigate(targetPath, { replace: true });
          return;
        }
      } else {
        // Fallback for corrupted URLs (e.g. /accounty/payroll/2026-01-01_2026-12-31/settings)
        navigate(`${prefix}/eaisybooks`, { replace: true });
        return;
      }
    }

    // If the URL dateRange is already what we synced, or if it was navigated by Context, skip!
    if (isNavigatingFromContext.current && urlDateRange === lastSyncedUrlRange.current) {
      isNavigatingFromContext.current = false;
      return;
    }

    if (urlDateRange === contextRangeRef.current) {
      lastSyncedUrlRange.current = urlDateRange;
      return;
    }

    const syncDateAndFinish = () => {
      const parsed = parseDateRange(urlDateRange);
      if (parsed) {
        lastSyncedUrlRange.current = urlDateRange;
        setDateFrom(parsed.from);
        setDateTo(parsed.to);
      }
    };

    // Check client permission
    const hasClient = clients.some(c => c.id === urlCompanyId || c.companyId === urlCompanyId);
    if (hasClient) {
      syncDateAndFinish();
    } else if (clients.length > 0) {
      if (user?.id && urlCompanyId) {
        supabase
          .from('company_members')
          .select('role')
          .eq('company_id', urlCompanyId)
          .eq('user_id', user.id)
          .maybeSingle()
          .then(({ data: member }) => {
            if (member) {
              setDeniedCompanyId(null);
              syncDateAndFinish();
            } else {
              setDeniedCompanyId(urlCompanyId);
            }
          });
        return;
      }
      Promise.resolve().then(() => setDeniedCompanyId(urlCompanyId));
      return;
    } else {
      syncDateAndFinish();
    }
  }, [urlCompanyId, urlDateRange, clients, clientsLoading, isLegacyKeyword, navigate, user?.id, prefix, location.pathname, setDateFrom, setDateTo]);

  // 1b. Store selected Accounty company in localStorage to remember it when switching to eaisybill
  useEffect(() => {
    if (urlCompanyId && !isLegacyKeyword && !accessDenied) {
      localStorage.setItem('eaisybooks_selected_company_id', urlCompanyId);
    }
  }, [urlCompanyId, isLegacyKeyword, accessDenied]);

  // 2. Context ➔ URL Sync (when date changes via UI)
  useEffect(() => {
    if (accessDenied || !urlCompanyId || isLegacyKeyword) return;

    const currentDateRange = `${dateFromFormatted}_${dateToFormatted}`;
    if (currentDateRange === urlDateRange) return;

    const expectedPrefix = `${prefix}/eaisybooks/${urlCompanyId}/${currentDateRange}`;

    if (!location.pathname.startsWith(expectedPrefix)) {
      isNavigatingFromContext.current = true;
      lastSyncedUrlRange.current = currentDateRange;
      const page = extractAccountyPageSegment(location.pathname);
      const newPath =
        generateAccountyScopedPath(
          urlCompanyId,
          dateFromFormatted,
          dateToFormatted,
          page === '/' ? '' : page.slice(1),
          Boolean(prefix),
        ) + location.search + location.hash;
      navigate(newPath, { replace: true });
    }
  }, [urlCompanyId, dateFromFormatted, dateToFormatted, location.pathname, location.search, location.hash, accessDenied, isLegacyKeyword, navigate, urlDateRange, prefix]);

  if (clientsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> Betöltés...
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] px-4">
        <div className="text-center max-w-md space-y-6">
          <div className="mx-auto w-16 h-16 rounded-lg bg-destructive/10 flex items-center justify-center">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">
              {t('access_denied.title', 'Hozzáférés megtagadva')}
            </h1>
            <p className="text-muted-foreground leading-relaxed">
              {t('access_denied.message', 'A keresett ügyfél nem található, vagy nincs hozzáférése az adataihoz.')}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setDeniedCompanyId(null);
              navigate(`${prefix}/eaisybooks`, { replace: true });
            }}
            className="px-6"
          >
            {t('access_denied.back_button', 'Vissza a portfólióhoz')}
          </Button>
        </div>
      </div>
    );
  }

  const isDateSynced = !parsedUrlDateRange || `${dateFromFormatted}_${dateToFormatted}` === urlDateRange;
  const isSyncing = !isDateSynced;

  return (
    <div 
      className="min-h-full flex flex-col flex-1"
      style={isSyncing ? { opacity: 0, pointerEvents: 'none', minHeight: '50vh' } : undefined}
    >
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
