import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useDateRange } from '@/contexts/DateRangeContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useAccountyKpis, useAccountyClients, type AccountyClient } from '@/hooks/accounty';
import { useAccountyPermissions, PATH_TO_MODULE } from '@/hooks/useAccountyPermissions';
import { useHasEaisybillAccess } from '@/hooks/useHasEaisybillAccess';
import { useUnreadTicketCount } from '@/hooks/useTickets';

function useSafeCompany() {
  try {
    return useCompany();
  } catch {
    return null;
  }
}
import { 
  Settings, 
  User, 
  Shield, 
  Users, 
  FileText, 
  BookOpen, 
  Calculator, 
  Scale, 
  ShieldCheck, 
  HelpCircle, 
  Bot, 
  TicketCheck 
} from 'lucide-react';

export interface SubGroupItem {
  to: string;
  icon: any;
  label: string;
  id?: string;
  badge?: number;
}

export interface SubGroup {
  id: string;
  label: string;
  icon: any;
  items: SubGroupItem[];
}

export interface AccountyShellContextType {
  // Mode & Scoped Client
  mode: 'portfolio' | 'client';
  selectedClientId: string | null;
  selectedClient: AccountyClient | null;
  setSelectedClientId: (id: string | null) => void;
  currentDateRange: string;
  
  // Navigation & Prefetching
  pathname: string;
  isActive: (path: string) => boolean;
  isPathActive: (to: string, exact?: boolean) => boolean;
  handlePrefetch: (to: string) => void;
  handleBackToPortfolio: () => void;
  navigate: (path: string) => void;

  // Sidebar Controls
  isCollapsed: boolean;
  toggleSidebarCollapse: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  isNavigatingToPortfolio: boolean;

  // Command Palette & Súgó
  cmdOpen: boolean;
  setCmdOpen: React.Dispatch<React.SetStateAction<boolean>>;
  cmdQuery: string;
  setCmdQuery: (q: string) => void;
  helpDrawerOpen: boolean;
  setHelpDrawerOpen: (open: boolean) => void;
  hoveredHelpSection: string | null;
  setHoveredHelpSection: (section: string | null) => void;

  // Tour
  runTour: boolean;
  setRunTour: (run: boolean) => void;

  // Notifications
  notifDismissed: boolean;
  setNotifDismissed: (dismissed: boolean) => void;

  // Permissions & Access
  canAccess: (module: any) => boolean;
  hasEaisybillAccess: boolean;

  // Data & Auth
  allClients: AccountyClient[] | null;
  isClientsLoading: boolean;
  kpis: any;
  unreadTicketCount: number;
  user: any;
  signOut: () => Promise<void>;
  theme: string;
  setTheme: (t: string) => void;
  getUserInitials: () => string;

  // Accordions & Sections
  expandedSections: Set<string>;
  toggleSection: (key: string) => void;
  expandedSubSections: Set<string>;
  toggleSubSection: (key: string) => void;
  expandedPayroll: Set<string>;
  togglePayrollClient: (companyId: string) => void;
  payrollSearch: string;
  setPayrollSearch: (s: string) => void;
  showAllPayroll: boolean;
  setShowAllPayroll: React.Dispatch<React.SetStateAction<boolean>>;
  subGroups: SubGroup[];
}

const SHELL_CONTEXT_KEY = Symbol.for('visibill.accounty_shell_context');
export const AccountyShellContext: React.Context<AccountyShellContextType | undefined> =
  (globalThis as any)[SHELL_CONTEXT_KEY] ||
  ((globalThis as any)[SHELL_CONTEXT_KEY] = createContext<AccountyShellContextType | undefined>(undefined));

export function extractCompanyIdFromPath(pathname: string): string | null {
  const match = pathname.match(/\/eaisybooks\/(?:(?:client|payroll|missing-invoices)\/)?([a-f0-9-]{36})/i);
  return match ? match[1] : null;
}

const accountyPrefetchMap: Record<string, () => Promise<unknown>> = {
  "/eaisybooks/missing-invoices": () => import("@/pages/Accounty/MissingInvoicesPage"),
  "/eaisybooks/tax-calendar": () => import("@/pages/Accounty/TaxCalendarPage"),
  "/eaisybooks/reports": () => import("@/pages/Accounty/ReportsPage"),
  "/eaisybooks/approval-queue": () => import("@/pages/Accounty/ApprovalQueuePage"),
  "/eaisybooks/alerts": () => import("@/pages/Accounty/AlertsCenterPage"),
  "/eaisybooks/onboarding": () => import("@/pages/Accounty/OnboardingPage"),
  "/eaisybooks/settings": () => import("@/pages/Accounty/SettingsPage"),
  "/eaisybooks/profile/settings": () => import("@/pages/Accounty/ProfileSettingsPage"),
  "/eaisybooks/tickets": () => import("@/pages/TicketsPage"),
  "/eaisybooks/help": () => import("@/pages/Accounty/HelpPage"),
  "/eaisybooks/ai-assistant": () => import("@/pages/Accounty/AiAssistantPage"),
  "/eaisybooks/admin/permissions": () => import("@/pages/Accounty/PermissionMatrixPage"),
  "/eaisybooks/admin/accountants": () => import("@/pages/Accounty/AccountantManagementPage"),
  "/eaisybooks/admin/templates": () => import("@/pages/Accounty/TemplatesPage"),
  "/eaisybooks/admin/job-codes": () => import("@/pages/Accounty/JobCodesPage"),
  "/eaisybooks/admin/tax-parameters": () => import("@/pages/Accounty/AdminTaxParametersPage"),
  "/eaisybooks/admin/legal-updates": () => import("@/pages/Accounty/LegalUpdatesPage"),
  "/eaisybooks/admin/audit": () => import("@/pages/Accounty/AuditLogPage"),
  "/eaisybooks/admin/gdpr": () => import("@/pages/Accounty/GdprPage"),
  "overview": () => import("@/pages/Accounty/ClientDetailsPage"),
  "profile": () => import("@/pages/Accounty/ClientDetailsPage"),
  "invoices": () => import("@/pages/Accounty/ClientInvoicesPage"),
  "ev": () => import("@/pages/Accounty/Ev/ClientEvMainPage"),
  "tao": () => import("@/pages/Accounty/Tao/ClientTaoMainPage"),
  "payroll": () => import("@/pages/Accounty/PayrollDashboardPage"),
  "payroll/filings": () => import("@/pages/Accounty/FilingsPage"),
  "prompts": () => import("@/pages/Accounty/PromptsPage"),
};

export function AccountyShellProvider({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const pathname = location.pathname;
  const navigate = useNavigate();

  const { dateFromFormatted, dateToFormatted } = useDateRange();
  const currentDateRange = `${dateFromFormatted}_${dateToFormatted}`;

  const companyContext = useSafeCompany();
  const { data: kpis } = useAccountyKpis();
  const { data: unreadTicketCount = 0 } = useUnreadTicketCount();
  const { canAccess } = useAccountyPermissions();
  const { hasAccess: hasEaisybillAccess } = useHasEaisybillAccess();
  const { data: allClients = null, isLoading: isClientsLoading } = useAccountyClients();

  // Explicit or derived selected client
  const [explicitClientId, setExplicitClientId] = useState<string | null>(() => {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        const switchPending = localStorage.getItem('visibill_switch_pending');
        if (switchPending === 'eaisybooks') {
          return localStorage.getItem('eaisybill_selected_company_id') ||
                 localStorage.getItem('eaisybooks_selected_company_id') ||
                 null;
        }
      }
    } catch { /* ignore */ }
    return null;
  });

  const derivedClientId = useMemo(() => {
    const match = pathname.match(/\/eaisybooks\/(?:(?:client|payroll|missing-invoices)\/)?([a-f0-9-]{36})/i);
    return match ? match[1] : null;
  }, [pathname]);

  // Derived URL client ID is primary source of truth; explicitClientId acts as synchronous initial fallback
  const selectedClientId = derivedClientId || explicitClientId;
  const mode: 'portfolio' | 'client' = selectedClientId ? 'client' : 'portfolio';

  const fallbackCompany = useMemo(() => {
    if (!selectedClientId || !companyContext) return null;
    if (companyContext.selectedCompany?.id === selectedClientId) {
      return companyContext.selectedCompany;
    }
    return companyContext.companies?.find(c => c.id === selectedClientId) || null;
  }, [selectedClientId, companyContext]);

  const selectedClient = useMemo(() => {
    if (!selectedClientId) return null;
    if (allClients) {
      const found = allClients.find(c => c.companyId === selectedClientId || c.id === selectedClientId);
      if (found) return found;
    }
    if (fallbackCompany) {
      return {
        id: fallbackCompany.id,
        companyId: fallbackCompany.id,
        name: fallbackCompany.name,
        taxNumber: fallbackCompany.tax_number,
        status: 'Rendben',
        unprocessedCount: 0,
        missingCount: 0,
        deadlineDate: null,
        progress: 100,
        assignedToMe: true,
        isPrimary: true,
        accountantRole: 'senior',
        ownerId: '',
        isMainAccountant: true,
      } as AccountyClient;
    }
    return null;
  }, [selectedClientId, allClients, fallbackCompany]);

  // Sidebar collapse state (persisted via cookie & localStorage)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      if (typeof document !== 'undefined') {
        const cookies = document.cookie.split(';');
        const sidebarCookie = cookies.find(c => c.trim().startsWith('sidebar:state='));
        if (sidebarCookie) {
          return sidebarCookie.split('=')[1]?.trim() === 'false';
        }
      }
      return localStorage.getItem('visibill:sidebar-collapsed') === 'true' || 
             localStorage.getItem('visibill:accounty-sidebar-collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebarCollapse = useCallback(() => {
    setIsCollapsed(prev => {
      const next = !prev;
      try {
        const maxAge = 60 * 60 * 24 * 7;
        document.cookie = `sidebar:state=${!next}; path=/; max-age=${maxAge}`;
        localStorage.setItem('visibill:accounty-sidebar-collapsed', String(next));
        localStorage.setItem('visibill:sidebar-collapsed', String(next));
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState('');
  const [helpDrawerOpen, setHelpDrawerOpen] = useState(false);
  const [hoveredHelpSection, setHoveredHelpSection] = useState<string | null>(null);
  const [runTour, setRunTour] = useState(false);
  const [notifDismissed, setNotifDismissed] = useState(false);

  // Transition smoothing between client and portfolio
  const [isNavigatingToPortfolio, setIsNavigatingToPortfolio] = useState(false);
  const prevSelectedClientIdRef = useRef<string | null>(selectedClientId);

  useEffect(() => {
    if (selectedClientId) {
      setIsNavigatingToPortfolio(false);
    } else if (prevSelectedClientIdRef.current && !selectedClientId) {
      setIsNavigatingToPortfolio(true);
      const timer = setTimeout(() => setIsNavigatingToPortfolio(false), 250);
      return () => clearTimeout(timer);
    }
    prevSelectedClientIdRef.current = selectedClientId;
  }, [selectedClientId]);

  const handleBackToPortfolio = useCallback(() => {
    setIsNavigatingToPortfolio(true);
    setExplicitClientId(null);
    try {
      localStorage.removeItem('visibill_switch_pending');
      localStorage.removeItem('eaisybooks_selected_company_id');
    } catch { /* ignore */ }
    navigate('/eaisybooks');
    const timer = setTimeout(() => setIsNavigatingToPortfolio(false), 250);
  }, [navigate]);

  // Collapsible section states
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => new Set(['portfolio']));
  const toggleSection = useCallback((key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const [expandedSubSections, setExpandedSubSections] = useState<Set<string>>(new Set());
  const toggleSubSection = useCallback((key: string) => {
    setExpandedSubSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const [expandedPayroll, setExpandedPayroll] = useState<Set<string>>(new Set());
  const togglePayrollClient = useCallback((companyId: string) => {
    setExpandedPayroll(prev => {
      const next = new Set(prev);
      if (next.has(companyId)) next.delete(companyId);
      else next.add(companyId);
      return next;
    });
  }, []);

  const [payrollSearch, setPayrollSearch] = useState('');
  const [showAllPayroll, setShowAllPayroll] = useState(false);

  // Sub-groups configuration for admin & portfolio
  const subGroups = useMemo<SubGroup[]>(() => [
    {
      id: 'office',
      label: 'Iroda & Beállítások',
      icon: Settings,
      items: [
        { to: '/eaisybooks/settings', icon: Settings, label: 'Beállítások', id: 'settings' },
        { to: '/eaisybooks/profile/settings', icon: User, label: 'Profilbeállítások' },
        { to: '/eaisybooks/admin/permissions', icon: Shield, label: 'Jogosultságkezelő' },
        { to: '/eaisybooks/admin/accountants', icon: Users, label: 'Könyvelők kezelése' },
      ].filter(item => {
        const module = PATH_TO_MODULE[item.to];
        return !module || canAccess(module);
      })
    },
    {
      id: 'professional',
      label: 'Szakmai Törzsadatok',
      icon: BookOpen,
      items: [
        { to: '/eaisybooks/admin/templates', icon: FileText, label: 'Sablonok' },
        { to: '/eaisybooks/admin/job-codes', icon: BookOpen, label: 'Jogviszonykódok' },
        { to: '/eaisybooks/admin/tax-parameters', icon: Calculator, label: 'Adómértékek' },
        { to: '/eaisybooks/admin/legal-updates', icon: Scale, label: 'Jogszabály-frissítések' },
      ].filter(item => {
        const module = PATH_TO_MODULE[item.to];
        return !module || canAccess(module);
      })
    },
    {
      id: 'security',
      label: 'Biztonság & GDPR',
      icon: ShieldCheck,
      items: [
        { to: '/eaisybooks/admin/audit', icon: ShieldCheck, label: 'Audit napló' },
        { to: '/eaisybooks/admin/gdpr', icon: ShieldCheck, label: 'GDPR' },
      ].filter(item => {
        const module = PATH_TO_MODULE[item.to];
        return !module || canAccess(module);
      })
    },
    {
      id: 'support',
      label: 'Támogatás & AI',
      icon: HelpCircle,
      items: [
        { to: '/eaisybooks/ai-assistant', icon: Bot, label: 'AI Asszisztens' },
        { to: '/eaisybooks/tickets', icon: TicketCheck, label: 'Hibajegyek', badge: unreadTicketCount },
        { to: '/eaisybooks/help', icon: HelpCircle, label: 'Segítség' },
      ].filter(item => {
        const module = PATH_TO_MODULE[item.to];
        return !module || canAccess(module);
      })
    }
  ], [unreadTicketCount, canAccess]);

  const isActive = useCallback((path: string) => {
    if (path === '/eaisybooks') {
      return pathname === '/eaisybooks' || pathname.startsWith('/eaisybooks/client');
    }
    if (path === '/eaisybooks/tao') {
      return pathname === '/eaisybooks/tao';
    }
    if (path === '/eaisybooks/ev') {
      return pathname === '/eaisybooks/ev';
    }
    return pathname.startsWith(path);
  }, [pathname]);

  const isPathActive = useCallback((to: string, exact?: boolean) => {
    const cleanTo = to.split('?')[0];
    const itemParams = new URLSearchParams(to.split('?')[1] || '');
    const itemTab = itemParams.get('tab');
    
    const queryParams = new URLSearchParams(location.search);
    const currentTab = queryParams.get('tab');
    
    if (itemTab) {
      return pathname.startsWith(cleanTo) && currentTab === itemTab;
    }
    if (to === '/eaisybooks') {
      return pathname === '/eaisybooks' && !currentTab;
    }
    return exact ? pathname === cleanTo : isActive(cleanTo);
  }, [pathname, location.search, isActive]);

  const handlePrefetch = useCallback((to: string) => {
    const cleanTo = to.split('?')[0].split('#')[0];
    const loader = accountyPrefetchMap[cleanTo];
    if (loader) {
      void loader();
    } else {
      const parts = cleanTo.split('/');
      const lastPart = parts[parts.length - 1];
      const clientLoader = accountyPrefetchMap[lastPart];
      if (clientLoader) void clientLoader();
    }
  }, []);

  const getUserInitials = useCallback(() => {
    if (user?.user_metadata?.name) {
      return user.user_metadata.name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase();
    }
    return user?.email?.substring(0, 2).toUpperCase() || 'U';
  }, [user]);

  // Global Ctrl+K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Set page document title dynamically based on missing items
  useEffect(() => {
    const count = kpis?.missingItems ?? 0;
    document.title = count > 0 ? `(${count}) eaisybooks` : 'eaisybooks';
    return () => { document.title = 'eaisybill'; };
  }, [kpis?.missingItems]);

  const value = useMemo<AccountyShellContextType>(() => ({
    mode,
    selectedClientId,
    selectedClient,
    setSelectedClientId: setExplicitClientId,
    currentDateRange,
    pathname,
    isActive,
    isPathActive,
    handlePrefetch,
    handleBackToPortfolio,
    navigate,
    isCollapsed,
    toggleSidebarCollapse,
    sidebarOpen,
    setSidebarOpen,
    isNavigatingToPortfolio,
    cmdOpen,
    setCmdOpen,
    cmdQuery,
    setCmdQuery,
    helpDrawerOpen,
    setHelpDrawerOpen,
    hoveredHelpSection,
    setHoveredHelpSection,
    runTour,
    setRunTour,
    notifDismissed,
    setNotifDismissed,
    canAccess,
    hasEaisybillAccess: hasEaisybillAccess || false,
    allClients,
    isClientsLoading,
    kpis,
    unreadTicketCount,
    user,
    signOut,
    theme,
    setTheme,
    getUserInitials,
    expandedSections,
    toggleSection,
    expandedSubSections,
    toggleSubSection,
    expandedPayroll,
    togglePayrollClient,
    payrollSearch,
    setPayrollSearch,
    showAllPayroll,
    setShowAllPayroll,
    subGroups,
  }), [
    mode,
    selectedClientId,
    selectedClient,
    currentDateRange,
    pathname,
    isActive,
    isPathActive,
    handlePrefetch,
    handleBackToPortfolio,
    navigate,
    isCollapsed,
    toggleSidebarCollapse,
    sidebarOpen,
    isNavigatingToPortfolio,
    cmdOpen,
    cmdQuery,
    helpDrawerOpen,
    hoveredHelpSection,
    runTour,
    notifDismissed,
    canAccess,
    hasEaisybillAccess,
    allClients,
    isClientsLoading,
    kpis,
    unreadTicketCount,
    user,
    signOut,
    theme,
    setTheme,
    getUserInitials,
    expandedSections,
    toggleSection,
    expandedSubSections,
    toggleSubSection,
    expandedPayroll,
    togglePayrollClient,
    payrollSearch,
    showAllPayroll,
    subGroups,
  ]);

  return (
    <AccountyShellContext.Provider value={value}>
      {children}
    </AccountyShellContext.Provider>
  );
}

export function createDefaultAccountyShellContext(): AccountyShellContextType {
  const effectivePathname = typeof window !== 'undefined' ? window.location?.pathname || '' : '';
  const derivedClientId = extractCompanyIdFromPath(effectivePathname);
  return {
    mode: derivedClientId ? 'client' : 'portfolio',
    selectedClientId: derivedClientId,
    selectedClient: null,
    setSelectedClientId: () => {},
    currentDateRange: '2026-01-01_2026-12-31',
    pathname: effectivePathname,
    isActive: () => false,
    isPathActive: () => false,
    handlePrefetch: () => {},
    handleBackToPortfolio: () => {
      if (typeof window !== 'undefined') window.location.href = '/eaisybooks';
    },
    navigate: () => {},
    isCollapsed: false,
    toggleSidebarCollapse: () => {},
    sidebarOpen: false,
    setSidebarOpen: () => {},
    isNavigatingToPortfolio: false,
    cmdOpen: false,
    setCmdOpen: () => {},
    cmdQuery: '',
    setCmdQuery: () => {},
    helpDrawerOpen: false,
    setHelpDrawerOpen: () => {},
    hoveredHelpSection: null,
    setHoveredHelpSection: () => {},
    runTour: false,
    setRunTour: () => {},
    notifDismissed: false,
    setNotifDismissed: () => {},
    canAccess: () => true,
    hasEaisybillAccess: true,
    allClients: null,
    isClientsLoading: false,
    kpis: {},
    unreadTicketCount: 0,
    user: null,
    signOut: async () => {},
    theme: 'light',
    setTheme: () => {},
    getUserInitials: () => 'U',
    expandedSections: new Set(['portfolio']),
    toggleSection: () => {},
    expandedSubSections: new Set(),
    toggleSubSection: () => {},
    expandedPayroll: new Set(),
    togglePayrollClient: () => {},
    payrollSearch: '',
    setPayrollSearch: () => {},
    showAllPayroll: false,
    setShowAllPayroll: () => {},
    subGroups: [],
  };
}

export function useAccountyShellOptional(): AccountyShellContextType | null {
  return useContext(AccountyShellContext) ?? null;
}

export function useAccountyShell(): AccountyShellContextType {
  const ctx = useContext(AccountyShellContext);
  if (!ctx) {
    console.warn('[AccountyShell] useAccountyShell called outside AccountyShellProvider; using fallback to prevent crash');
    return createDefaultAccountyShellContext();
  }
  return ctx;
}
