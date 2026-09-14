import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAccountyShellOptional, type AccountyShellContextType } from '@/pages/Accounty/AccountyShellContext';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  active?: boolean;
}

export interface AccountyBreadcrumbsOptions {
  /** Explicit override items. If provided, these are used directly instead of auto-generation. */
  items?: Array<BreadcrumbItem | string>;
  /** Extra items to append to the end of the auto-generated breadcrumbs chain. */
  append?: Array<BreadcrumbItem | string>;
}

export function normalizeBreadcrumbItem(item: BreadcrumbItem | string): BreadcrumbItem {
  if (typeof item === 'string') {
    return { label: item };
  }
  return item;
}

const STATIC_PORTFOLIO_ROUTES: Record<string, Array<{ label: string; href?: string }>> = {
  '/eaisybooks': [{ label: 'Portfólió Menedzsment' }],
  '/eaisybooks/missing-invoices': [{ label: 'Portfólió', href: '/eaisybooks' }, { label: 'Hiányzó számlák' }],
  '/eaisybooks/tax-calendar': [{ label: 'Portfólió', href: '/eaisybooks' }, { label: 'Naptár & Határidők' }],
  '/eaisybooks/reports': [{ label: 'Portfólió', href: '/eaisybooks' }, { label: 'Riportok' }],
  '/eaisybooks/reports/missing-invoices': [{ label: 'Portfólió', href: '/eaisybooks' }, { label: 'Riportok', href: '/eaisybooks/reports' }, { label: 'Hiányzó számlák riport' }],
  '/eaisybooks/reports/ai-anomaly': [{ label: 'Portfólió', href: '/eaisybooks' }, { label: 'Riportok', href: '/eaisybooks/reports' }, { label: 'AI Anomália riport' }],
  '/eaisybooks/alerts': [{ label: 'Portfólió', href: '/eaisybooks' }, { label: 'Riasztások' }],
  '/eaisybooks/approval-queue': [{ label: 'Portfólió', href: '/eaisybooks' }, { label: 'Jóváhagyási sor' }],
  '/eaisybooks/nav-deadlines': [{ label: 'Portfólió', href: '/eaisybooks' }, { label: 'NAV Határidők' }],
  '/eaisybooks/onboarding': [{ label: 'Portfólió', href: '/eaisybooks' }, { label: 'Onboarding' }],
  '/eaisybooks/new-client': [{ label: 'Portfólió', href: '/eaisybooks' }, { label: 'Új ügyfél felvétele' }],
  '/eaisybooks/settings': [{ label: 'Iroda', href: '/eaisybooks/settings' }, { label: 'Beállítások' }],
  '/eaisybooks/profile/settings': [{ label: 'Iroda', href: '/eaisybooks/settings' }, { label: 'Profilbeállítások' }],
  '/eaisybooks/privacy-policy': [{ label: 'Adatkezelési tájékoztató' }],
  '/eaisybooks/help': [{ label: 'Segítség' }],
  '/eaisybooks/tickets': [{ label: 'Hibajegyek' }],
  '/eaisybooks/ai-assistant': [{ label: 'AI Asszisztens' }],
  '/eaisybooks/admin/permissions': [{ label: 'Iroda', href: '/eaisybooks/settings' }, { label: 'Jogosultságkezelő' }],
  '/eaisybooks/admin/accountants': [{ label: 'Iroda', href: '/eaisybooks/settings' }, { label: 'Könyvelők kezelése' }],
  '/eaisybooks/admin/office-settings': [{ label: 'Iroda', href: '/eaisybooks/settings' }, { label: 'Irodai beállítások' }],
  '/eaisybooks/admin/templates': [{ label: 'Törzsadatok', href: '/eaisybooks/admin/templates' }, { label: 'Sablonok' }],
  '/eaisybooks/admin/job-codes': [{ label: 'Törzsadatok', href: '/eaisybooks/admin/job-codes' }, { label: 'Jogviszonykódok' }],
  '/eaisybooks/admin/tax-parameters': [{ label: 'Törzsadatok', href: '/eaisybooks/admin/tax-parameters' }, { label: 'Adómértékek és küszöbök' }],
  '/eaisybooks/admin/legal-updates': [{ label: 'Törzsadatok', href: '/eaisybooks/admin/legal-updates' }, { label: 'Jogszabály-frissítések' }],
  '/eaisybooks/admin/audit': [{ label: 'Biztonság', href: '/eaisybooks/admin/audit' }, { label: 'Audit napló' }],
  '/eaisybooks/admin/gdpr': [{ label: 'Biztonság', href: '/eaisybooks/admin/gdpr' }, { label: 'GDPR' }],
  '/eaisybooks/tao/calendar': [{ label: 'Portfólió', href: '/eaisybooks?tab=tao' }, { label: 'TAO Naptár' }],
  '/eaisybooks/tao/taxpayer-types': [{ label: 'Portfólió', href: '/eaisybooks?tab=tao' }, { label: 'Adózói típusok' }],
  '/eaisybooks/ev/calendar': [{ label: 'Portfólió', href: '/eaisybooks?tab=ev' }, { label: 'EV Naptár' }],
  '/eaisybooks/ev/forms': [{ label: 'Portfólió', href: '/eaisybooks?tab=ev' }, { label: 'Nyomtatványok' }],
  '/eaisybooks/ev/thresholds': [{ label: 'Portfólió', href: '/eaisybooks?tab=ev' }, { label: 'Keretfigyelő' }],
};

/** Pure calculation function to generate breadcrumb items from pathname and shell context */
export function getAccountyBreadcrumbs(
  pathname: string,
  shell?: AccountyShellContextType | null,
  options?: AccountyBreadcrumbsOptions
): { breadcrumbs: BreadcrumbItem[] } {
  // 1. Explicit override items take precedence
  if (options?.items && options.items.length > 0) {
    const list = options.items.map(normalizeBreadcrumbItem);
    return {
      breadcrumbs: list.map((item, idx) => ({
        ...item,
        active: item.active ?? idx === list.length - 1,
      })),
    };
  }

  // Clean path
  const cleanPath = pathname.replace(/\/$/, '') || '/';
  if (!cleanPath.startsWith('/eaisybooks')) {
    return { breadcrumbs: [] };
  }

  const result: BreadcrumbItem[] = [
    { label: 'eaisyBooks', href: '/eaisybooks' },
  ];

  // 2. Client-scoped match: /eaisybooks/:companyId/:dateRange(/subpath)?
  const clientMatch = cleanPath.match(/^\/eaisybooks\/([a-f0-9-]{36})\/([^/]+)(?:\/(.*))?$/i);
  // Also check legacy client paths e.g. /eaisybooks/client/:id/...
  const legacyClientMatch = cleanPath.match(/^\/eaisybooks\/(?:client|payroll|missing-invoices)\/([a-f0-9-]{36})(?:\/(.*))?$/i);

  const matchedCompanyId = clientMatch ? clientMatch[1] : (legacyClientMatch ? legacyClientMatch[1] : shell?.selectedClientId);
  const matchedDateRange = clientMatch ? clientMatch[2] : (shell?.currentDateRange || '2026-01-01_2026-12-31');
  const subpath = clientMatch ? (clientMatch[3] || '') : (legacyClientMatch ? (legacyClientMatch[2] || '') : '');

  if (matchedCompanyId) {
    // Find client name
    let clientName = shell?.selectedClient?.name;
    if (!clientName && shell?.allClients) {
      const found = shell.allClients.find(c => c.id === matchedCompanyId || c.companyId === matchedCompanyId);
      if (found) clientName = found.name;
    }
    clientName = clientName || 'Ügyfél';

    const clientOverviewHref = `/eaisybooks/${matchedCompanyId}/${matchedDateRange}/overview`;
    result.push({
      label: clientName,
      href: clientOverviewHref,
    });

    // Subpath resolution
    if (!subpath || subpath === 'overview' || subpath === 'profile') {
      result.push({ label: 'Áttekintés' });
    } else if (subpath === 'invoices') {
      result.push({ label: 'Számlák' });
    } else if (subpath === 'missing-invoices') {
      result.push({ label: 'Hiányzó számlák' });
    } else if (subpath === 'reports') {
      result.push({ label: 'Riportok' });
    } else if (subpath === 'reports/missing-invoices') {
      result.push({ label: 'Riportok', href: `/eaisybooks/${matchedCompanyId}/${matchedDateRange}/reports` });
      result.push({ label: 'Hiányzó számlák riport' });
    } else if (subpath === 'settings') {
      result.push({ label: 'Beállítások' });
    } else if (subpath === 'cegkapu') {
      result.push({ label: 'Cégkapu' });
    } else if (subpath === 'representation') {
      result.push({ label: 'Képviselet' });
    } else if (subpath === 'data-retention') {
      result.push({ label: 'Adatmegőrzés' });
    } else if (subpath === 'structure') {
      result.push({ label: 'Cégstruktúra' });
    } else if (subpath.startsWith('payroll')) {
      const payrollBaseHref = `/eaisybooks/${matchedCompanyId}/${matchedDateRange}/payroll`;
      if (subpath === 'payroll') {
        result.push({ label: 'Bérszámfejtés' });
      } else {
        result.push({ label: 'Bérszámfejtés', href: payrollBaseHref });
        const pSub = subpath.replace(/^payroll\/?/, '');
        if (pSub === 'employees') {
          result.push({ label: 'Foglalkoztatottak' });
        } else if (pSub === 'employees/new') {
          result.push({ label: 'Foglalkoztatottak', href: `${payrollBaseHref}/employees` });
          result.push({ label: 'Új munkavállaló' });
        } else if (pSub === 'employees/import') {
          result.push({ label: 'Foglalkoztatottak', href: `${payrollBaseHref}/employees` });
          result.push({ label: 'Munkavállalók importálása' });
        } else if (pSub.startsWith('employees/')) {
          result.push({ label: 'Foglalkoztatottak', href: `${payrollBaseHref}/employees` });
          result.push({ label: 'Munkavállaló adatlap' });
        } else if (pSub === 'cycle/new') {
          result.push({ label: 'Új havi ciklus' });
        } else if (pSub.startsWith('cycle/')) {
          result.push({ label: 'Számfejtési ciklus' });
        } else if (pSub === 'filings') {
          result.push({ label: 'NAV Bevallások' });
        } else if (pSub === 'filings/08e') {
          result.push({ label: 'NAV Bevallások', href: `${payrollBaseHref}/filings` });
          result.push({ label: '08E bevallás' });
        } else if (pSub === 'filings/2608') {
          result.push({ label: 'NAV Bevallások', href: `${payrollBaseHref}/filings` });
          result.push({ label: '2608 bevallás' });
        } else if (pSub.startsWith('filings/')) {
          result.push({ label: 'NAV Bevallások', href: `${payrollBaseHref}/filings` });
          result.push({ label: 'Bevallás részletek' });
        } else if (pSub === 'tax-params') {
          result.push({ label: 'Paramétertábla' });
        } else if (pSub === 'reports') {
          result.push({ label: 'Bér riportok' });
        } else if (pSub === 'portal') {
          result.push({ label: 'Munkavállalói portál' });
        } else if (pSub === 'settings') {
          result.push({ label: 'Bérbeállítások' });
        } else if (pSub.startsWith('declarations')) {
          result.push({ label: 'Nyilatkozatok' });
        } else if (pSub.startsWith('documents')) {
          result.push({ label: 'Dokumentumok' });
        } else if (pSub === 'year-end') {
          result.push({ label: 'Év végi teendők' });
        } else {
          result.push({ label: pSub });
        }
      }
    } else if (subpath.startsWith('ev')) {
      const evBaseHref = `/eaisybooks/${matchedCompanyId}/${matchedDateRange}/ev`;
      if (subpath === 'ev') {
        result.push({ label: 'Egyéni vállalkozás' });
      } else {
        result.push({ label: 'Egyéni vállalkozás', href: evBaseHref });
        const evSub = subpath.replace(/^ev\/?/, '');
        if (evSub === 'cashbook') {
          result.push({ label: 'Pénztárkönyv' });
        } else if (evSub === 'cashbook/ledger') {
          result.push({ label: 'Pénztárkönyv', href: `${evBaseHref}/cashbook` });
          result.push({ label: 'Főkönyvi karton' });
        } else if (evSub === 'cashbook/close') {
          result.push({ label: 'Pénztárkönyv', href: `${evBaseHref}/cashbook` });
          result.push({ label: 'Időszak zárás' });
        } else if (evSub === 'flat-rate') {
          result.push({ label: 'Átalányadó' });
        } else if (evSub === 'kata') {
          result.push({ label: 'KATA' });
        } else if (evSub === 'depreciation') {
          result.push({ label: 'Értékcsökkenés' });
        } else if (evSub === 'thresholds') {
          result.push({ label: 'Keretfigyelő' });
        } else if (evSub === 'compare') {
          result.push({ label: 'Adónem összehasonlítás' });
        } else if (evSub === 'contributions') {
          result.push({ label: 'Járulékok' });
        } else if (evSub === 'hipa') {
          result.push({ label: 'HIPA' });
        } else if (evSub === 'vat') {
          result.push({ label: 'ÁFA' });
        } else if (evSub === 'returns') {
          result.push({ label: 'Bevallások' });
        } else if (evSub === 'records') {
          result.push({ label: 'Nyilvántartások' });
        } else if (evSub === 'income-report') {
          result.push({ label: 'Bevételi nyilvántartás' });
        } else if (evSub === 'optimization') {
          result.push({ label: 'Adóoptimalizálás' });
        } else {
          result.push({ label: evSub });
        }
      }
    } else if (subpath.startsWith('tao')) {
      const taoBaseHref = `/eaisybooks/${matchedCompanyId}/${matchedDateRange}/tao`;
      if (subpath === 'tao') {
        result.push({ label: 'Társasági adó' });
      } else {
        result.push({ label: 'Társasági adó', href: taoBaseHref });
        const taoSub = subpath.replace(/^tao\/?/, '');
        if (taoSub === 'setup') {
          result.push({ label: 'Beállítás varázsló' });
        } else if (taoSub === 'master-data') {
          result.push({ label: 'Törzsadatok' });
        } else if (taoSub === 'lifecycle') {
          result.push({ label: 'Életciklus' });
        } else if (taoSub === 'business-year') {
          result.push({ label: 'Üzleti év' });
        } else if (taoSub === 'accounting-regime') {
          result.push({ label: 'Számviteli rend' });
        } else if (taoSub === 'currency') {
          result.push({ label: 'Pénznem' });
        } else if (taoSub === 'kiva') {
          result.push({ label: 'KIVA kalkulátor' });
        } else if (taoSub === 'compare') {
          result.push({ label: 'TAO vs. KIVA' });
        } else {
          result.push({ label: taoSub });
        }
      }
    } else {
      result.push({ label: subpath });
    }
  } else {
    // 3. Portfolio / Admin Level routes
    const staticItems = STATIC_PORTFOLIO_ROUTES[cleanPath];
    if (staticItems) {
      staticItems.forEach(item => result.push({ ...item }));
    } else {
      // Fallback for non-mapped /eaisybooks/* subroutes
      const parts = cleanPath.replace(/^\/eaisybooks\/?/, '').split('/').filter(Boolean);
      let accumulated = '/eaisybooks';
      parts.forEach((p, idx) => {
        accumulated += `/${p}`;
        const isLastPart = idx === parts.length - 1;
        const formatted = p.charAt(0).toUpperCase() + p.slice(1).replace(/-/g, ' ');
        result.push({
          label: formatted,
          href: isLastPart ? undefined : accumulated,
        });
      });
    }
  }

  // 4. Append extra items if provided
  if (options?.append && options.append.length > 0) {
    options.append.forEach(item => {
      result.push(normalizeBreadcrumbItem(item));
    });
  }

  // 5. Ensure last item has active: true and no href if active
  return {
    breadcrumbs: result.map((item, idx) => {
      const isLast = idx === result.length - 1;
      const isActive = item.active ?? isLast;
      return {
        ...item,
        active: isActive,
        href: isActive ? undefined : item.href,
      };
    }),
  };
}

/**
 * Hook to get breadcrumbs inside an Accounty view.
 */
export function useAccountyBreadcrumbs(options?: AccountyBreadcrumbsOptions): { breadcrumbs: BreadcrumbItem[] } {
  const location = useLocation();
  const shell = useAccountyShellOptional();

  return useMemo(() => {
    return getAccountyBreadcrumbs(location.pathname, shell, options);
  }, [location.pathname, shell, options]);
}

/**
 * Optional hook variant that returns null if outside router or outside /eaisybooks.
 */
export function useAccountyBreadcrumbsOptional(options?: AccountyBreadcrumbsOptions): { breadcrumbs: BreadcrumbItem[] } | null {
  const shell = useAccountyShellOptional();
  let pathname = '';
  try {
    const location = useLocation();
    pathname = location.pathname;
  } catch {
    pathname = '';
  }

  return useMemo(() => {
    if (!shell && !pathname.startsWith('/eaisybooks')) {
      return null;
    }
    return getAccountyBreadcrumbs(pathname, shell, options);
  }, [pathname, shell, options]);
}
