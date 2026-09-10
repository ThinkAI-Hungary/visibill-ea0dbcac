import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Hungarian resources
import huCommon from '@/locales/hu/common.json';
import huNavigation from '@/locales/hu/navigation.json';
import huDashboard from '@/locales/hu/dashboard.json';
import huInvoices from '@/locales/hu/invoices.json';
import huTransactions from '@/locales/hu/transactions.json';
import huPartners from '@/locales/hu/partners.json';
import huUpload from '@/locales/hu/upload.json';
import huSettings from '@/locales/hu/settings.json';
import huReceivables from '@/locales/hu/receivables.json';
import huCategories from '@/locales/hu/categories.json';
import huProjects from '@/locales/hu/projects.json';
import huPettyCash from '@/locales/hu/pettyCash.json';
import huTransfers from '@/locales/hu/transfers.json';
import huAccounting from '@/locales/hu/accounting.json';
import huHr from '@/locales/hu/hr.json';
import huTickets from '@/locales/hu/tickets.json';
import huAuth from '@/locales/hu/auth.json';

// Croatian resources
import hrCommon from '@/locales/hr/common.json';
import hrNavigation from '@/locales/hr/navigation.json';
import hrDashboard from '@/locales/hr/dashboard.json';
import hrInvoices from '@/locales/hr/invoices.json';
import hrTransactions from '@/locales/hr/transactions.json';
import hrPartners from '@/locales/hr/partners.json';
import hrUpload from '@/locales/hr/upload.json';
import hrSettings from '@/locales/hr/settings.json';
import hrReceivables from '@/locales/hr/receivables.json';
import hrCategories from '@/locales/hr/categories.json';
import hrProjects from '@/locales/hr/projects.json';
import hrPettyCash from '@/locales/hr/pettyCash.json';
import hrTransfers from '@/locales/hr/transfers.json';
import hrAccounting from '@/locales/hr/accounting.json';
import hrHr from '@/locales/hr/hr.json';
import hrTickets from '@/locales/hr/tickets.json';
import hrAuth from '@/locales/hr/auth.json';

export const defaultNS = 'common';

export const resources = {
  hu: {
    common: huCommon,
    navigation: huNavigation,
    dashboard: huDashboard,
    invoices: huInvoices,
    transactions: huTransactions,
    partners: huPartners,
    upload: huUpload,
    settings: huSettings,
    receivables: huReceivables,
    categories: huCategories,
    projects: huProjects,
    pettyCash: huPettyCash,
    transfers: huTransfers,
    accounting: huAccounting,
    hr: huHr,
    tickets: huTickets,
    auth: huAuth,
  },
  hr: {
    common: hrCommon,
    navigation: hrNavigation,
    dashboard: hrDashboard,
    invoices: hrInvoices,
    transactions: hrTransactions,
    partners: hrPartners,
    upload: hrUpload,
    settings: hrSettings,
    receivables: hrReceivables,
    categories: hrCategories,
    projects: hrProjects,
    pettyCash: hrPettyCash,
    transfers: hrTransfers,
    accounting: hrAccounting,
    hr: hrHr,
    tickets: hrTickets,
    auth: hrAuth,
  },
} as const;

// Custom path detector: checks if the current URL starts with /hr or /hr/
const pathDetector = {
  name: 'pathPrefix',
  lookup() {
    if (typeof window === 'undefined') return undefined;
    const pathname = window.location.pathname;
    if (pathname === '/hr' || pathname.startsWith('/hr/')) {
      return 'hr';
    }
    return 'hu';
  },
  cacheUserLanguage(_lng: string) {
    // Do not persist language to localStorage
  },
};

// Clean up any stale localStorage visibill_lang entry so users are not stuck in hr
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('visibill_lang');
  } catch {}
}

const languageDetector = new LanguageDetector();
languageDetector.addDetector(pathDetector);

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'hu',
    supportedLngs: ['hu', 'hr'],
    defaultNS,
    ns: ['common', 'navigation', 'dashboard', 'invoices', 'transactions', 'partners', 'upload', 'settings', 'receivables', 'categories', 'projects', 'pettyCash', 'transfers', 'accounting', 'hr', 'tickets', 'auth'],
    detection: {
      order: ['pathPrefix'],
      caches: [],
    },
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    react: {
      useSuspense: false, // Prevent unwanted suspense boundaries during language change
    },
  });

export default i18n;
