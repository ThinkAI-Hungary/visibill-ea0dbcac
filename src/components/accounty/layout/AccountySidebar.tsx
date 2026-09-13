import React, { useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Building2, 
  Search, 
  Sun, 
  Moon, 
  Settings, 
  LogOut 
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
      sidebarOpen ? "translate-x-0" : "-translate-x-full"
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

      {/* Company Selector Dropdown — placed and styled exactly like eaisyBill */}
      {!isCollapsed && (
        <div className="p-3 border-b border-border shrink-0 flex items-center gap-2" data-tour="company-selector">
          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select
            value={selectedClientId || '_portfolio'}
            onValueChange={(val) => {
              if (val === '_portfolio') {
                handleBackToPortfolio();
              } else {
                navigate(`/eaisybooks/${val}/${currentDateRange}/overview`);
              }
            }}
          >
            <SelectTrigger className="flex-1 h-9 text-sm font-medium bg-transparent border-border hover:bg-sidebar-foreground/5 text-sidebar-foreground [&>span]:text-left [&>span]:flex-1 focus:ring-1 focus:ring-primary/30">
              <SelectValue placeholder="Válassz céget">
                {selectedClientId ? (selectedClient?.name || 'Ügyfél betöltése...') : 'Teljes Portfólió'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-64 overflow-y-auto">
              <SelectItem value="_portfolio" className="text-xs font-bold text-primary">
                Teljes Portfólió
              </SelectItem>
              {selectedClientId && selectedClient && !allClients?.some(c => c.companyId === selectedClientId) && (
                <SelectItem value={selectedClientId} className="text-xs">
                  {selectedClient.name}
                </SelectItem>
              )}
              {(allClients || []).map((client) => (
                <SelectItem key={client.companyId} value={client.companyId} className="text-xs">
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

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
            <span className="truncate flex-1">Keresés...</span>
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
      <div className="mt-auto border-t border-border shrink-0">
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
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} 
                  className="w-8 h-8 hover:bg-primary/10 hover:text-primary"
                >
                  <div className="relative h-4 w-4">
                    <Sun className={`h-4 w-4 absolute transition-all ${theme === 'dark' ? 'animate-rotate-out' : 'animate-rotate-in'}`} />
                    <Moon className={`h-4 w-4 absolute transition-all ${theme === 'dark' ? 'animate-rotate-in' : 'animate-rotate-out'}`} />
                  </div>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{theme === 'dark' ? 'Világos mód' : 'Sötét mód'}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" asChild className="w-8 h-8 p-0 hover:bg-primary/10 hover:text-primary hover:border-primary/30">
                  <Link to="/eaisybooks/profile/settings">
                    <Settings className="h-4 w-4" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Beállítások</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={async () => { await signOut(); navigate('/auth?app=eaisybooks'); }} 
                  className="w-8 h-8 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Kilépés</TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.user_metadata?.avatar_url} />
                <AvatarFallback className="text-xs">{getUserInitials()}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs font-semibold truncate text-foreground">
                  {user?.user_metadata?.name || user?.email?.split('@')[0] || 'Felhasználó'}
                </span>
                <span className="text-[10px] text-muted-foreground truncate">{user?.email}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-border/40">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} 
                className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                title={theme === 'dark' ? 'Világos mód' : 'Sötét mód'}
              >
                <div className="relative h-4 w-4">
                  <Sun className={`h-4 w-4 absolute transition-all ${theme === 'dark' ? 'animate-rotate-out' : 'animate-rotate-in'}`} />
                  <Moon className={`h-4 w-4 absolute transition-all ${theme === 'dark' ? 'animate-rotate-in' : 'animate-rotate-out'}`} />
                </div>
              </Button>

              <Button 
                variant="ghost" 
                size="icon" 
                asChild 
                className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                title="Profilbeállítások"
              >
                <Link to="/eaisybooks/profile/settings">
                  <Settings className="h-4 w-4" />
                </Link>
              </Button>

              <Button 
                variant="ghost" 
                size="icon" 
                onClick={async () => { await signOut(); navigate('/auth?app=eaisybooks'); }} 
                className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                title="Kijelentkezés"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
