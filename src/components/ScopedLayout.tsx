import { useEffect, useRef, useState } from 'react';
import { Outlet, useParams, useNavigate, useLocation } from 'react-router-dom';
import { useCompany } from '@/contexts/CompanyContext';
import { useDateRange } from '@/contexts/DateRangeContext';
import { parseDateRange, generateScopedPath, extractPageSegment } from '@/lib/navigation';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * ScopedLayout — URL ↔ Context Synchronization Layer.
 *
 * Sits inside `/:companyId/:dateRange/*` routes.
 *
 * Responsibilities:
 * 1. On mount (bookmarked/shared URL): read URL params → update CompanyContext + DateRangeContext
 * 2. When user changes company or date (via UI): update URL to reflect new context
 * 3. Validate companyId belongs to the user's companies list
 *
 * Renders <Outlet /> so child routes render inside it.
 */
export function ScopedLayout() {
  const { companyId: urlCompanyId, dateRange: urlDateRange } = useParams<{
    companyId: string;
    dateRange: string;
  }>();

  const navigate = useNavigate();
  const location = useLocation();

  const { selectedCompany, companies, setSelectedCompany } = useCompany();
  const { dateFromFormatted, dateToFormatted, setDateFrom, setDateTo } = useDateRange();
  const parsedUrlDateRange = urlDateRange ? parseDateRange(urlDateRange) : null;

  // ── Guard: prevent infinite sync loops ──
  const syncingFromUrl = useRef(false);

  // ── Access denied state ──
  // Ref provides a synchronous signal so the Context→URL effect below
  // can read the latest value without waiting for a React re-render.
  const accessDeniedRef = useRef(false);
  const [accessDenied, setAccessDenied] = useState(false);

  /** Set both ref (sync) and state (triggers re-render). */
  const markAccessDenied = (denied: boolean) => {
    accessDeniedRef.current = denied;
    setAccessDenied(denied);
  };

  // ── 1. URL → Context sync (on mount / URL change) ──
  useEffect(() => {
    if (!urlCompanyId || !urlDateRange) return;
    syncingFromUrl.current = true;

    // Sync company
    if (selectedCompany?.id !== urlCompanyId) {
      const target = companies.find((c) => c.id === urlCompanyId);
      if (target) {
        markAccessDenied(false);
        setSelectedCompany(target);
      } else if (companies.length > 0) {
        // URL companyId doesn't belong to this user → show access denied
        markAccessDenied(true);
        syncingFromUrl.current = false;
        return;
      } else {
        // No companies at all (last one was deleted) → redirect to onboarding
        syncingFromUrl.current = false;
        navigate('/', { replace: true });
        return;
      }
    } else {
      markAccessDenied(false);
    }

    // Sync date range
    const parsed = parseDateRange(urlDateRange);
    if (parsed) {
      const urlFrom = formatCompact(parsed.from);
      const urlTo = formatCompact(parsed.to);
      if (urlFrom !== dateFromFormatted) setDateFrom(parsed.from);
      if (urlTo !== dateToFormatted) setDateTo(parsed.to);
    }

    // Release lock after a tick so Context → URL effect doesn't fire
    requestAnimationFrame(() => {
      syncingFromUrl.current = false;
    });
  }, [urlCompanyId, urlDateRange]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 2. Context → URL sync (date or company changed via UI) ──
  useEffect(() => {
    if (syncingFromUrl.current) return;
    if (accessDeniedRef.current) return; // Don't redirect away from access-denied screen
    if (!selectedCompany) return;

    const currentDateRange = `${dateFromFormatted}_${dateToFormatted}`;
    const expectedPrefix = `/${selectedCompany.id}/${currentDateRange}`;

    // Only update if the URL doesn't already match
    if (!location.pathname.startsWith(expectedPrefix)) {
      const page = extractPageSegment(location.pathname);
      const newPath =
        generateScopedPath(
          selectedCompany.id,
          dateFromFormatted,
          dateToFormatted,
          page === '/' ? '' : page.slice(1),
        ) + location.search + location.hash;
      navigate(newPath, { replace: true });
    }
  }, [selectedCompany?.id, dateFromFormatted, dateToFormatted]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Access Denied Screen ──
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
              A keresett oldal nem található, vagy nincs a megtekintéshez szükséges jogosultsága.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              markAccessDenied(false);
              navigate('/', { replace: true });
            }}
            className="px-6"
          >
            Vissza a főoldalra
          </Button>
        </div>
      </div>
    );
  }

  const isCompanySynced = !urlCompanyId || selectedCompany?.id === urlCompanyId;
  const isDateSynced = !parsedUrlDateRange || `${dateFromFormatted}_${dateToFormatted}` === urlDateRange;

  if (!isCompanySynced || !isDateSynced) {
    return null;
  }

  return <Outlet />;
}

// ── Helpers ──

function formatCompact(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
