import React, { useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Search, 
  Sun, 
  Moon, 
  Settings, 
  LogOut,
  PanelLeft
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import AppModeSwitcher from '@/components/AppModeSwitcher';
import AccountyNavSkeleton from './AccountyNavSkeleton';
import PortfolioNav from './PortfolioNav';
import ClientNav from './ClientNav';
import { 
  AccountyShellContext, 
  extractCompanyIdFromPath, 
  useAccountyShellOptional, 
  type AccountyShellContextType 
} from '@/pages/Accounty/AccountyShellContext';

export interface AccountySidebarProps {
  isCollapsed?: boolean;
  toggleSidebarCollapse?: () => void;
  sidebarOpen?: boolean;
  setSidebarOpen?: (v: boolean) => void;
  hasEaisybillAccess?: boolean;
  kpis?: any;
  unreadTicketCount?: number;
  canAccess?: (module: string) => boolean;
  pathname?: string;
  user?: any;
  signOut?: () => Promise<void>;
  setCmdOpen?: (v: boolean) => void;
  theme?: string;
  setTheme?: (t: string) => void;
  allClients?: any[] | null;
  isClientsLoading?: boolean;
  expandedPayroll?: Set<string>;
  togglePayrollClient?: (id: string) => void;
  payrollSearch?: string;
  setPayrollSearch?: (s: string) => void;
  showAllPayroll?: boolean;
  setShowAllPayroll?: (v: boolean) => void;
  expandedSections?: Set<string>;
  toggleSection?: (key: string) => void;
  isActive?: (path: string) => boolean;
  navigate?: (path: string) => void;
  hoveredHelpSection?: string | null;
}

export default function AccountySidebar(props: AccountySidebarProps) {
  const shell = useAccountyShellOptional();

  if (!shell) {
    return <AccountySidebarStandalone {...props} />;
  }

  return <AccountySidebarInner shell={shell} props={props} />;
}

function AccountySidebarStandalone(props: AccountySidebarProps) {
  let locationPathname = '';
  try {
    const location = useLocation();
    locationPathname = location?.pathname || '';
  } catch {
    // Router not mounted
  }
  const effectivePathname = props.pathname ?? locationPathname;
  const derivedClientId = extractCompanyIdFromPath(effectivePathname);
  const selectedClientId = derivedClientId;
  const mode: 'portfolio' | 'client' = selectedClientId ? 'client' : 'portfolio';

  const selectedClient = useMemo(() => {
    if (!selectedClientId || !props.allClients) return null;
    return props.allClients.find(c => c.companyId === selectedClientId || (c as any).id === selectedClientId) || null;
  }, [selectedClientId, props.allClients]);

  const [isCollapsed, setIsCollapsed] = useState(props.isCollapsed ?? false);
  const [sidebarOpen, setSidebarOpen] = useState(props.sidebarOpen ?? false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState('');
  const [helpDrawerOpen, setHelpDrawerOpen] = useState(false);
  const [hoveredHelpSection, setHoveredHelpSection] = useState<string | null>(props.hoveredHelpSection ?? null);
  const [runTour, setRunTour] = useState(false);
  const [notifDismissed, setNotifDismissed] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(props.expandedSections ?? new Set(['portfolio']));
  const [expandedSubSections, setExpandedSubSections] = useState<Set<string>>(new Set());
  const [expandedPayroll, setExpandedPayroll] = useState<Set<string>>(props.expandedPayroll ?? new Set());
  const [payrollSearch, setPayrollSearch] = useState(props.payrollSearch ?? '');
  const [showAllPayroll, setShowAllPayroll] = useState(props.showAllPayroll ?? false);

  const fallbackValue: AccountyShellContextType = {
    mode,
    selectedClientId,
    selectedClient,
    setSelectedClientId: () => {},
    currentDateRange: '2026-01-01_2026-12-31',
    pathname: effectivePathname,
    isActive: props.isActive ?? ((p: string) => effectivePathname.startsWith(p)),
    isPathActive: (to: string, exact?: boolean) => exact ? effectivePathname === to : effectivePathname.startsWith(to),
    handlePrefetch: () => {},
    handleBackToPortfolio: () => props.navigate?.('/eaisybooks/dashboard'),
    navigate: props.navigate ?? (() => {}),
    isCollapsed: props.isCollapsed ?? isCollapsed,
    toggleSidebarCollapse: props.toggleSidebarCollapse ?? (() => setIsCollapsed(p => !p)),
    sidebarOpen: props.sidebarOpen ?? sidebarOpen,
    setSidebarOpen: props.setSidebarOpen ?? setSidebarOpen,
    isNavigatingToPortfolio: false,
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
    canAccess: props.canAccess ?? (() => true),
    hasEaisybillAccess: props.hasEaisybillAccess ?? true,
    allClients: props.allClients ?? null,
    isClientsLoading: props.isClientsLoading ?? false,
    kpis: props.kpis ?? {},
    unreadTicketCount: props.unreadTicketCount ?? 0,
    user: props.user ?? null,
    signOut: props.signOut ?? (async () => {}),
    theme: props.theme ?? 'light',
    setTheme: props.setTheme ?? (() => {}),
    getUserInitials: () => {
      if (props.user?.user_metadata?.full_name) {
        return props.user.user_metadata.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
      }
      return props.user?.email ? props.user.email.slice(0, 2).toUpperCase() : 'U';
    },
    expandedSections: props.expandedSections ?? expandedSections,
    toggleSection: props.toggleSection ?? ((k: string) => setExpandedSections(prev => {
      const n = new Set(prev);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    })),
    expandedSubSections,
    toggleSubSection: (k: string) => setExpandedSubSections(prev => {
      const n = new Set(prev);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    }),
    expandedPayroll: props.expandedPayroll ?? expandedPayroll,
    togglePayrollClient: props.togglePayrollClient ?? ((id: string) => setExpandedPayroll(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    })),
    payrollSearch: props.payrollSearch ?? payrollSearch,
    setPayrollSearch: props.setPayrollSearch ?? setPayrollSearch,
    showAllPayroll: props.showAllPayroll ?? showAllPayroll,
    setShowAllPayroll: props.setShowAllPayroll ?? setShowAllPayroll,
    subGroups: [],
  };

  return (
    <AccountyShellContext.Provider value={fallbackValue}>
      <AccountySidebarInner shell={fallbackValue} props={props} />
    </AccountyShellContext.Provider>
  );
}

function AccountySidebarInner({ shell, props }: { shell: AccountyShellContextType; props: AccountySidebarProps }) {
  const { t } = useTranslation('accounty');
  const pathname = shell.pathname || '';
  const prefix = pathname.startsWith('/hr') ? '/hr' : '';

  // Prefer context values with optional prop fallbacks for backwards compatibility
  const isCollapsed = props.isCollapsed ?? shell.isCollapsed;
  const sidebarOpen = props.sidebarOpen ?? shell.sidebarOpen;
  const setCmdOpen = props.setCmdOpen ?? shell.setCmdOpen;
  const hasEaisybillAccess = props.hasEaisybillAccess ?? shell.hasEaisybillAccess;
  const allClients = props.allClients ?? shell.allClients;
  const user = props.user ?? shell.user;
  const theme = props.theme ?? shell.theme;
  const setTheme = props.setTheme ?? shell.setTheme;
  const signOut = props.signOut ?? shell.signOut;
  const navigate = props.navigate ?? shell.navigate;
  const toggleSidebarCollapse = props.toggleSidebarCollapse ?? shell.toggleSidebarCollapse;

  const isDark = theme === 'dark';
  const toggleTheme = () => setTheme(isDark ? 'light' : 'dark');
  const handleSignOut = async () => {
    try {
      if (signOut) {
        await signOut();
      }
    } finally {
      if (navigate) {
        navigate('/auth?app=eaisybooks');
      }
    }
  };

  const {
    mode,
    selectedClientId,
    selectedClient,
    currentDateRange,
    isNavigatingToPortfolio,
    handleBackToPortfolio,
    getUserInitials,
  } = shell;

  return (
    <aside className={cn(
      "flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 z-50",
      isCollapsed ? "w-12" : "w-64",
      "fixed inset-y-0 left-0 lg:static lg:translate-x-0",
      sidebarOpen ? "translate-x-0" : "-translate-x-full",
      "border-r border-border h-full"
    )}>
      {/* Logo Area */}
      <div 
        data-tour="app-mode-switcher"
        className={cn(
          "border-b border-border shrink-0",
          isCollapsed ? "p-2 py-4 flex justify-center" : "p-4"
        )}
      >
        <AppModeSwitcher
          activeMode="accounty"
          isCollapsed={isCollapsed}
          showToggle={hasEaisybillAccess === true}
        />
      </div>


      {/* Navigation Area */}
      <nav className="flex-1 p-2 overflow-y-auto" data-sidebar-nav>
        {/* Search trigger */}
        {isCollapsed ? (
          <div className="flex justify-center mb-2">
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setCmdOpen(true)}
                  className="flex items-center justify-center rounded-md transition-colors w-8 h-8 hover:bg-primary/10 text-sidebar-foreground/60"
                >
                  <Search className="h-4 w-4 shrink-0" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Keresés... (Ctrl K)</TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <button
            onClick={() => setCmdOpen(true)}
            className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm transition-colors h-8 hover:bg-primary/10 text-sidebar-foreground/60 mb-1"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="truncate flex-1">{t('sidebar.search_placeholder', 'Keresés...')}</span>
            <kbd className="px-1.5 py-0.5 text-[9px] font-mono bg-sidebar-foreground/10 text-sidebar-foreground/50 rounded">Ctrl K</kbd>
          </button>
        )}

        {/* Dynamic Nav Branch based on Mode */}
        {isNavigatingToPortfolio && !selectedClientId ? (
          <AccountyNavSkeleton isCollapsed={isCollapsed} count={isCollapsed ? 8 : 6} />
        ) : mode === 'client' ? (
          <ClientNav />
        ) : (
          <PortfolioNav />
        )}
      </nav>

      {/* User Profile Footer */}
      <div className="mt-auto shrink-0 border-t border-border">
        {isCollapsed ? (
          <div className="p-2 space-y-2 flex flex-col items-center">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.user_metadata?.avatar_url} />
              <AvatarFallback className="text-xs">{getUserInitials()}</AvatarFallback>
            </Avatar>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={toggleTheme} 
                  className="w-8 h-8 hover:bg-primary/10 hover:text-primary"
                >
                  <div className="relative h-4 w-4">
                    <Sun className={`h-4 w-4 absolute transition-all ${isDark ? 'animate-rotate-out' : 'animate-rotate-in'}`} />
                    <Moon className={`h-4 w-4 absolute transition-all ${isDark ? 'animate-rotate-in' : 'animate-rotate-out'}`} />
                  </div>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{isDark ? t('sidebar.light_mode', 'Világos mód') : t('sidebar.dark_mode', 'Sötét mód')}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button data-tour="settings" variant="outline" asChild className="w-8 h-8 p-0 hover:bg-primary/10 hover:text-primary hover:border-primary/30">
                  <Link to={`${prefix}/eaisybooks/profile/settings`}>
                    <Settings className="h-4 w-4" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{t('sidebar.settings', 'Beállítások')}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={handleSignOut} 
                  className="w-8 h-8 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{t('sidebar.sign_out', 'Kijelentkezés')}</TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.user_metadata?.avatar_url} />
                <AvatarFallback className="text-xs">{getUserInitials()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {user?.user_metadata?.name || user?.email?.split('@')[0] || t('sidebar.user', 'Felhasználó')}
                </p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={toggleTheme} 
                  className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                  title={isDark ? t('sidebar.light_mode', 'Világos mód') : t('sidebar.dark_mode', 'Sötét mód')}
                >
                  <div className="relative h-4 w-4">
                    <Sun className={`h-4 w-4 absolute transition-all ${isDark ? 'animate-rotate-out' : 'animate-rotate-in'}`} />
                    <Moon className={`h-4 w-4 absolute transition-all ${isDark ? 'animate-rotate-in' : 'animate-rotate-out'}`} />
                  </div>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 w-full">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button data-tour="settings" variant="outline" asChild className="w-full aspect-square justify-center hover:bg-primary/10 hover:text-primary hover:border-primary/30">
                    <Link to={`${prefix}/eaisybooks/profile/settings`}>
                      <Settings className="h-5 w-5" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">{t('sidebar.settings', 'Beállítások')}</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    onClick={handleSignOut} 
                    className="w-full aspect-square justify-center hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                  >
                    <LogOut className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">{t('sidebar.sign_out', 'Kijelentkezés')}</TooltipContent>
              </Tooltip>
            </div>
          </div>
        )}

        {/* Sidebar Toggle */}
        <div className={cn("p-2 border-t border-border", isCollapsed ? "flex justify-center" : "")}>
          <Button
            data-tour="sidebar-trigger"
            variant="ghost"
            size="icon"
            onClick={toggleSidebarCollapse}
            className={cn("hover:bg-primary/10 hover:text-primary h-7", isCollapsed ? "w-7" : "w-full")}
            title={isCollapsed ? t('sidebar.open_sidebar', 'Oldalsáv kinyitása') : t('sidebar.collapse_sidebar', 'Oldalsáv összecsukása')}
          >
            <PanelLeft className="h-4 w-4" />
            <span className="sr-only">Toggle Sidebar</span>
          </Button>
        </div>
      </div>
    </aside>
  );
}
