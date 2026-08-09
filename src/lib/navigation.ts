import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useCompany } from '@/contexts/CompanyContext';
import { useDateRange } from '@/contexts/DateRangeContext';
import { useCallback } from 'react';

// ─── URL format: /:companyId/:dateRange/page ───
// dateRange format: YYYY-MM-DD_YYYY-MM-DD (from_to)

/**
 * Build a fully-qualified scoped path.
 *
 *   generateScopedPath('abc-123', '2026-01-01', '2026-12-31', 'invoices')
 *   → '/abc-123/2026-01-01_2026-12-31/invoices'
 */
export function generateScopedPath(
  companyId: string,
  dateFrom: string,
  dateTo: string,
  page: string = '',
): string {
  const dateRange = `${dateFrom}_${dateTo}`;
  const suffix = page ? `/${page}` : '';
  return `/${companyId}/${dateRange}${suffix}`;
}

/**
 * Parse a `:dateRange` URL param back into two Date objects.
 * Returns null if the param is malformed.
 */
export function parseDateRange(dateRange: string): { from: Date; to: Date } | null {
  if (!dateRange || !dateRange.includes('_')) return null;
  const [fromStr, toStr] = dateRange.split('_');
  const from = new Date(fromStr + 'T00:00:00');
  const to = new Date(toStr + 'T00:00:00');
  if (isNaN(from.getTime()) || isNaN(to.getTime())) return null;
  return { from, to };
}

/**
 * Extract the "page" segment from a full scoped pathname.
 *
 *   extractPage('/abc-123/2026-01-01_2026-12-31/invoices')
 *   → '/invoices'
 *
 *   extractPage('/abc-123/2026-01-01_2026-12-31')
 *   → '/'
 */
export function extractPageSegment(pathname: string): string {
  // Strip /:companyId/:dateRange prefix  →  the remainder is the page
  const parts = pathname.split('/').filter(Boolean); // ['companyId','dateRange','invoices']
  if (parts.length >= 3) {
    return '/' + parts.slice(2).join('/');
  }
  if (parts.length === 2) {
    return '/'; // root dashboard within scoped route
  }
  return pathname; // fallback for unscoped paths
}

// ─── Known page paths (the path segment AFTER /:companyId/:dateRange) ───
export const PAGE_PATHS = {
  dashboard: '',
  invoices: 'invoices',
  salaries: 'salaries',
  transactions: 'transactions',
  partners: 'partners',
  generalLedger: 'general-ledger',
  kintlevo: 'kintlevo',
  pettyCash: 'petty-cash',
  teny: 'teny',
  upload: 'upload',
  settings: 'settings',
  projects: 'projects',
  integrations: 'integrations',
  exchangeRates: 'exchange-rates',

  analytics: 'analytics',
  workingTime: 'working-time',
  categories: 'categories',
} as const;

/**
 * Hook that returns a navigate function which automatically scopes
 * paths with the current companyId + dateRange.
 *
 * Usage:
 *   const scopedNavigate = useScopedNavigate();
 *   scopedNavigate('invoices');            // → /:companyId/:dateRange/invoices
 *   scopedNavigate('invoices', { replace: true });
 */
export function useScopedNavigate() {
  const navigate = useNavigate();
  const { selectedCompany } = useCompany();
  const { dateFromFormatted, dateToFormatted } = useDateRange();

  return useCallback(
    (page: string, options?: { replace?: boolean; state?: any }) => {
      if (!selectedCompany) {
        // Fallback: if no company selected, navigate to root
        navigate('/', options);
        return;
      }
      const path = generateScopedPath(
        selectedCompany.id,
        dateFromFormatted,
        dateToFormatted,
        page,
      );
      navigate(path, options);
    },
    [navigate, selectedCompany, dateFromFormatted, dateToFormatted],
  );
}

/**
 * Build the current scoped base path from context values.
 * Useful for generating sidebar links.
 */
export function useScopedBasePath(): string {
  const { selectedCompany } = useCompany();
  const { dateFromFormatted, dateToFormatted } = useDateRange();
  if (!selectedCompany) return '/';
  return `/${selectedCompany.id}/${dateFromFormatted}_${dateToFormatted}`;
}

/**
 * Global hook: sync a page's active tab/filter into the URL path.
 *
 * Route must have an optional `:tab?` param, e.g.:
 *   <Route path="invoices/:tab?" element={<InvoicesPage />} />
 *
 * Usage:
 *   const [tab, setTab] = useUrlTab('invoices', 'outbound_nav', VALID_TABS);
 *   // URL: /:companyId/:dateRange/invoices/outbound_nav
 *
 * @param pagePath  The page's route segment (e.g. 'invoices', 'upload')
 * @param defaultTab  Default tab if none is in the URL
 * @param validTabs  Array of valid tab slugs — invalid values fall back to default
 */
export function useUrlTab<T extends string>(
  pagePath: string,
  defaultTab: T,
  validTabs: readonly T[],
): [T, (tab: T) => void] {
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const basePath = useScopedBasePath();
  const location = useLocation();

  const currentTab = (tab && (validTabs as readonly string[]).includes(tab))
    ? (tab as T)
    : defaultTab;

  const setTab = useCallback(
    (newTab: T) => {
      // Defer to microtask so this never runs during a render phase
      // (e.g. Radix Tabs may invoke onValueChange synchronously in some
      // edge cases, which would trigger a BrowserRouter setState mid-render).
      queueMicrotask(() => {
        navigate(
          {
            pathname: `${basePath}/${pagePath}/${newTab}`,
            search: location.search, // preserve ?invoice= etc.
          },
          { replace: true },
        );
      });
    },
    [navigate, basePath, pagePath, location.search],
  );

  return [currentTab, setTab];
}

/**
 * Build a fully-qualified scoped path for Eaisybooks (Accounty).
 *
 *   generateAccountyScopedPath('abc-123', '2026-01-01', '2026-12-31', 'invoices')
 *   → '/accounty/abc-123/2026-01-01_2026-12-31/invoices'
 */
export function generateAccountyScopedPath(
  companyId: string,
  dateFrom: string,
  dateTo: string,
  page: string = '',
): string {
  const dateRange = `${dateFrom}_${dateTo}`;
  const suffix = page ? `/${page}` : '';
  return `/accounty/${companyId}/${dateRange}${suffix}`;
}

/**
 * Extract the "page" segment from a full scoped Eaisybooks pathname.
 *
 *   extractAccountyPageSegment('/accounty/abc-123/2026-01-01_2026-12-31/invoices')
 *   → '/invoices'
 */
export function extractAccountyPageSegment(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean); // ['accounty', 'companyId', 'dateRange', 'invoices']
  if (parts.length >= 4 && parts[0] === 'accounty') {
    return '/' + parts.slice(3).join('/');
  }
  if (parts.length === 3 && parts[0] === 'accounty') {
    return '/';
  }
  return pathname;
}
