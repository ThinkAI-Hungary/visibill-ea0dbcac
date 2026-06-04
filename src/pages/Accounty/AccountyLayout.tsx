import React, { useEffect, useState, useCallback } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AccountyRoleProvider } from './AccountyRoleContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { FeedbackFab } from '@/components/FeedbackFab';
import { GlobalDatePicker } from '@/components/GlobalDatePicker';
import { useAccountyKpis, useAccountyClients } from '@/hooks/useAccountyData';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  Briefcase, 
  FileWarning, 
  Calendar, 
  BarChart2, 
  Settings, 
  HelpCircle,
  Search,
  Bell,
  Sun,
  Moon,
  User,
  LogOut,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Clock,
  MailCheck,
  Calculator,
  FileText,
  TrendingUp,
  Building2,
  Users,
  X,
  Menu,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';

export default function AccountyLayout() {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const pathname = location.pathname;
  const navigate = useNavigate();
  const { data: kpis } = useAccountyKpis();

  // #16 Favicon badge — show missing items count in browser tab
  useEffect(() => {
    const count = kpis?.missingItems ?? 0;
    document.title = count > 0 ? `(${count}) Accounty — eaisybill` : 'Accounty — eaisybill';
    return () => { document.title = 'eaisybill'; };
  }, [kpis?.missingItems]);

  const getUserInitials = () => {
    if (user?.user_metadata?.name) {
      return user.user_metadata.name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase();
    }
    return user?.email?.substring(0, 2).toUpperCase() || 'U';
  };

  const isActive = (path: string) => {
    if (path === '/accounty') {
      return pathname === '/accounty' || pathname.startsWith('/accounty/client');
    }
    return pathname.startsWith(path);
  };

  // #7 Command palette (Ctrl+K)
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState('');
  const { data: allClients } = useAccountyClients();
  const [expandedPayroll, setExpandedPayroll] = useState<Set<string>>(new Set());
  const [payrollInitialized, setPayrollInitialized] = useState(false);
  const [payrollSearch, setPayrollSearch] = useState('');
  const [showAllPayroll, setShowAllPayroll] = useState(false);
  const [notifDismissed, setNotifDismissed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Auto-expand the active client's submenu on first render
  useEffect(() => {
    if (payrollInitialized || !allClients) return;
    const activeClient = allClients.find(c => location.pathname.startsWith(`/accounty/payroll/${c.companyId}`));
    if (activeClient) {
      setExpandedPayroll(new Set([activeClient.companyId]));
    }
    setPayrollInitialized(true);
  }, [allClients, location.pathname, payrollInitialized]);

  const togglePayrollClient = (companyId: string) => {
    setExpandedPayroll(prev => {
      const next = new Set(prev);
      if (next.has(companyId)) {
        next.delete(companyId);
      } else {
        next.add(companyId);
      }
      return next;
    });
  };

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

  const cmdPages = [
    { name: 'Portfólió', path: '/accounty', icon: Briefcase },
    { name: 'Hiányzó számlák', path: '/accounty/missing-invoices', icon: FileWarning },
    { name: 'Adó naptár', path: '/accounty/tax-calendar', icon: Calendar },
    { name: 'Riportok', path: '/accounty/reports', icon: BarChart2 },
    { name: 'Jóváhagyó rendszer', path: '/accounty/approval-queue', icon: MailCheck },
    { name: 'Beállítások', path: '/accounty/settings', icon: Settings },
    { name: 'Segítség', path: '/accounty/help', icon: HelpCircle },
  ];

  const filteredPages = cmdQuery ? cmdPages.filter(p => p.name.toLowerCase().includes(cmdQuery.toLowerCase())) : cmdPages;
  const filteredClients = cmdQuery && allClients ? allClients.filter(c => c.name.toLowerCase().includes(cmdQuery.toLowerCase())).slice(0, 5) : [];


  return (
    <>
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden font-sans">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      {/* Sidebar */}
      <aside className={cn(
        "w-64 flex flex-col bg-sidebar text-sidebar-foreground transition-transform duration-300 z-50",
        "fixed inset-y-0 left-0 lg:static lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo Area */}
        <div className="p-4 border-b border-primary/30 shrink-0">
          <div className="flex items-center gap-2">
            <Link to="/" className="text-2xl tracking-tight select-none hover:opacity-80 transition-opacity" title="Vissza az eaisybillbe">
              <span className="font-medium text-foreground/80">e</span>
              <span className="font-bold text-primary">ai</span>
              <span className="font-medium text-foreground/80">sy</span>
              <span className="font-medium text-primary">bill</span>
            </Link>
            <span className="text-xl font-light text-muted-foreground">|</span>
            <Link to="/accounty" className="relative text-2xl font-black bg-gradient-to-br from-red-500 via-red-600 to-red-700 bg-clip-text text-transparent tracking-tight hover:opacity-80 transition-opacity">
              Accounty
              <span className="absolute -bottom-1.5 left-0 right-0 h-[2px] rounded-full bg-gradient-to-r from-red-500 via-red-600 to-red-700" />
            </Link>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 overflow-y-auto">
          <div className="flex h-8 shrink-0 items-center justify-between rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 mb-1">
            Navigáció
          </div>
          {/* Search trigger */}
          <button
            onClick={() => setCmdOpen(true)}
            className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm transition-colors h-8 hover:bg-primary/10 text-sidebar-foreground/60 mb-1"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="truncate flex-1">Keresés...</span>
            <kbd className="px-1.5 py-0.5 text-[9px] font-mono bg-sidebar-foreground/10 text-sidebar-foreground/50 rounded">Ctrl K</kbd>
          </button>
          <ul className="flex w-full min-w-0 flex-col gap-1">
            <li>
              <Link 
                to="/accounty" 
                className={cn(
                  "flex w-full items-center gap-2 rounded-md p-2 text-left text-sm transition-colors h-8",
                  isActive('/accounty') ? "bg-primary/15 font-medium text-primary" : "hover:bg-primary/10 hover:text-primary text-sidebar-foreground"
                )}
              >
                <Briefcase className="h-4 w-4 shrink-0" />
                <span className="truncate">Portfólió</span>
              </Link>
            </li>
            <li>
              <Link 
                to="/accounty/missing-invoices" 
                className={cn(
                  "flex w-full items-center gap-2 rounded-md p-2 text-left text-sm transition-colors h-8",
                  isActive('/accounty/missing-invoices') ? "bg-primary/15 font-medium text-primary" : "hover:bg-primary/10 hover:text-primary text-sidebar-foreground"
                )}
              >
                <FileWarning className="h-4 w-4 shrink-0" />
                <span className="truncate flex-1">Hiányzó számlák</span>
                {(kpis?.missingItems ?? 0) > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md min-w-5 text-center tabular-nums">{kpis?.missingItems}</span>
                )}
              </Link>
            </li>
            <li>
              <Link 
                to="/accounty/tax-calendar" 
                className={cn(
                  "flex w-full items-center gap-2 rounded-md p-2 text-left text-sm transition-colors h-8",
                  isActive('/accounty/tax-calendar') ? "bg-primary/15 font-medium text-primary" : "hover:bg-primary/10 hover:text-primary text-sidebar-foreground"
                )}
              >
                <Calendar className="h-4 w-4 shrink-0" />
                <span className="truncate">Adó naptár</span>
              </Link>
            </li>
            <li>
              <Link 
                to="/accounty/reports" 
                className={cn(
                  "flex w-full items-center gap-2 rounded-md p-2 text-left text-sm transition-colors h-8",
                  isActive('/accounty/reports') ? "bg-primary/15 font-medium text-primary" : "hover:bg-primary/10 hover:text-primary text-sidebar-foreground"
                )}
              >
                <BarChart2 className="h-4 w-4 shrink-0" />
                <span className="truncate">Riportok</span>
              </Link>
            </li>
            <li>
              <Link 
                to="/accounty/approval-queue" 
                className={cn(
                  "flex w-full items-center gap-2 rounded-md p-2 text-left text-sm transition-colors h-8",
                  isActive('/accounty/approval-queue') ? "bg-primary/15 font-medium text-primary" : "hover:bg-primary/10 hover:text-primary text-sidebar-foreground"
                )}
              >
                <MailCheck className="h-4 w-4 shrink-0" />
                <span className="truncate">Jóváhagyó rendszer</span>
              </Link>
            </li>
          </ul>

          {/* Bérszámfejtés section */}
          <div className="flex h-8 shrink-0 items-center justify-between rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 mt-4 mb-1">
            Bérszámfejtés
            <span className="text-[10px] text-sidebar-foreground/40">{(allClients || []).length}</span>
          </div>
          {(allClients || []).length > 5 && (
            <div className="px-2 mb-1">
              <input
                type="text"
                placeholder="Cég keresés..."
                value={payrollSearch}
                onChange={(e) => setPayrollSearch(e.target.value)}
                className="w-full h-7 px-2 text-xs bg-sidebar-foreground/5 border border-sidebar-foreground/10 rounded-md text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
          )}
          <ul className="flex w-full min-w-0 flex-col gap-1 max-h-[280px] overflow-y-auto scrollbar-thin">
            {(() => {
              const clients = allClients || [];
              const filtered = payrollSearch
                ? clients.filter(c => c.name.toLowerCase().includes(payrollSearch.toLowerCase()))
                : clients;
              const activeClientId = clients.find(c => location.pathname.startsWith(`/accounty/payroll/${c.companyId}`))?.companyId;
              const shown = showAllPayroll ? filtered : filtered.slice(0, 5);
              // Always include active client
              const activeInShown = shown.some(c => c.companyId === activeClientId);
              const activeClient = !activeInShown && activeClientId ? clients.find(c => c.companyId === activeClientId) : null;
              const finalList = activeClient ? [activeClient, ...shown] : shown;
              
              return (
                <>
                  {finalList.map((client) => {
                    const basePath = `/accounty/payroll/${client.companyId}`;
                    const isPayrollActive = location.pathname.startsWith(basePath);
                    const isExpanded = expandedPayroll.has(client.companyId);
                    return (
                      <li key={`payroll-${client.id}`}>
                        <div
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md p-2 text-left text-sm transition-colors h-8 cursor-pointer",
                            isPayrollActive ? "bg-primary/15 font-medium text-primary" : "hover:bg-primary/10 hover:text-primary text-sidebar-foreground"
                          )}
                          onClick={() => togglePayrollClient(client.companyId)}
                        >
                          <Link to={basePath} className="flex items-center gap-2 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                            <Calculator className="h-4 w-4 shrink-0" />
                            <span className="truncate">{client.name}</span>
                          </Link>
                          <ChevronDown className={cn("h-3 w-3 shrink-0 transition-transform duration-200", isExpanded ? "rotate-0" : "-rotate-90")} />
                        </div>
                        {isExpanded && (
                          <ul className="ml-6 mt-0.5 flex flex-col gap-0.5 border-l border-border pl-2 animate-in slide-in-from-top-1 duration-200">
                            {[
                              { to: `${basePath}/employees`, icon: Users, label: 'Foglalkoztatottak' },
                              { to: `${basePath}/reports`, icon: TrendingUp, label: 'Riportok' },
                              { to: `${basePath}/filings`, icon: FileText, label: 'NAV bevallások' },
                              { to: `${basePath}/portal`, icon: Building2, label: 'Ügyfélportál' },
                              { to: `${basePath}/tax-params`, icon: Settings, label: 'Paraméterek' },
                            ].map((sub) => (
                              <li key={sub.to}>
                                <Link
                                  to={sub.to}
                                  className={cn(
                                    "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition-colors",
                                    isActive(sub.to) ? "font-semibold text-primary" : "text-sidebar-foreground/60 hover:text-primary"
                                  )}
                                >
                                  <sub.icon className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate">{sub.label}</span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                  {!showAllPayroll && filtered.length > 5 && !payrollSearch && (
                    <li>
                      <button
                        onClick={() => setShowAllPayroll(true)}
                        className="w-full flex items-center justify-center gap-1 py-1.5 text-[11px] text-sidebar-foreground/50 hover:text-primary transition-colors"
                      >
                        + {filtered.length - 5} további cég
                      </button>
                    </li>
                  )}
                </>
              );
            })()}
          </ul>

          {/* Adminisztráció */}
          <div className="flex h-8 shrink-0 items-center justify-between rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 mt-4 mb-1">
            Adminisztráció
          </div>
          <ul className="flex w-full min-w-0 flex-col gap-1">
            <li>
              <Link 
                to="/accounty/settings" 
                className={cn(
                  "flex w-full items-center gap-2 rounded-md p-2 text-left text-sm transition-colors h-8",
                  isActive('/accounty/settings') ? "bg-primary/15 font-medium text-primary" : "hover:bg-primary/10 hover:text-primary text-sidebar-foreground"
                )}
              >
                <Settings className="h-4 w-4 shrink-0" />
                <span className="truncate">Beállítások</span>
              </Link>
            </li>
            <li>
              <Link 
                to="/accounty/help" 
                className={cn(
                  "flex w-full items-center gap-2 rounded-md p-2 text-left text-sm transition-colors h-8",
                  isActive('/accounty/help') ? "bg-primary/15 font-medium text-primary" : "hover:bg-primary/10 hover:text-primary text-sidebar-foreground"
                )}
              >
                <HelpCircle className="h-4 w-4 shrink-0" />
                <span className="truncate">Segítség</span>
              </Link>
            </li>
          </ul>
        </nav>

        {/* User Profile Footer — matching eaisybill sidebar style */}
        <div className="mt-auto border-t border-border">
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.user_metadata?.avatar_url} />
                <AvatarFallback className="text-xs">{getUserInitials()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {user?.user_metadata?.name || 'Felhasználó'}
                </p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
              >
                <div className="relative h-4 w-4">
                  <Sun className={`h-4 w-4 absolute transition-all ${theme === 'dark' ? 'animate-rotate-out' : 'animate-rotate-in'}`} />
                  <Moon className={`h-4 w-4 absolute transition-all ${theme === 'dark' ? 'animate-rotate-in' : 'animate-rotate-out'}`} />
                </div>
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" asChild className="w-full aspect-square justify-center hover:bg-primary/10 hover:text-primary hover:border-primary/30">
                    <Link to="/accounty/settings">
                      <Settings className="h-5 w-5" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Beállítások</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" onClick={async () => { await signOut(); navigate('/auth'); }} className="w-full aspect-square justify-center hover:bg-primary/10 hover:text-primary hover:border-primary/30">
                    <LogOut className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Kilépés</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 lg:px-8 shrink-0 relative z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-md"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Szia, <span className="font-semibold text-slate-900 dark:text-slate-100">{user?.user_metadata?.name?.split(' ')[0] || 'Könyvelő'}</span>! 👋
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{new Date().toLocaleDateString('hu-HU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Popover>
              <PopoverTrigger asChild>
                <button className="relative p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-md">
                  <Bell className="w-5 h-5" />
                  {!notifDismissed && ((kpis?.criticalClients ?? 0) > 0 || (kpis?.missingItems ?? 0) > 0 || (kpis?.todayDeadlines ?? 0) > 0 || (kpis?.upcomingDeadlines ?? 0) > 0) && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-slate-900"></span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0 mt-2 border-border shadow-lg rounded-xl overflow-hidden dark:bg-card" align="end" sideOffset={8}>
                <div className="px-4 py-3 border-b border-border bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Értesítések</h3>
                  {((kpis?.criticalClients ?? 0) > 0 || (kpis?.missingItems ?? 0) > 0 || (kpis?.todayDeadlines ?? 0) > 0 || (kpis?.upcomingDeadlines ?? 0) > 0) && (
                    <button
                      onClick={() => setNotifDismissed(true)}
                      className="text-[10px] font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      Mind olvasott
                    </button>
                  )}
                </div>
                {(kpis?.criticalClients ?? 0) > 0 || (kpis?.missingItems ?? 0) > 0 || (kpis?.todayDeadlines ?? 0) > 0 || (kpis?.upcomingDeadlines ?? 0) > 0 ? (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto">
                    {(kpis?.criticalClients ?? 0) > 0 && (
                      <div className="px-4 py-3 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer" onClick={() => navigate('/accounty')}>
                        <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0 mt-0.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Kritikus ügyfelek</p>
                          <p className="text-xs text-slate-500 mt-0.5">{kpis?.criticalClients} ügyfélnél kritikus elmaradás</p>
                        </div>
                      </div>
                    )}
                    {(kpis?.todayDeadlines ?? 0) > 0 && (
                      <div className="px-4 py-3 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer" onClick={() => navigate('/accounty/tax-calendar')}>
                        <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0 mt-0.5">
                          <Clock className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Mai határidők</p>
                          <p className="text-xs text-slate-500 mt-0.5">{kpis?.todayDeadlines} deadline ma lejár</p>
                        </div>
                      </div>
                    )}
                    {(kpis?.missingItems ?? 0) > 0 && (
                      <div className="px-4 py-3 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer" onClick={() => navigate('/accounty/missing-invoices')}>
                        <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center shrink-0 mt-0.5">
                          <FileWarning className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Hiányzó dokumentumok</p>
                          <p className="text-xs text-slate-500 mt-0.5">{kpis?.missingItems} tétel vár bekérésre</p>
                        </div>
                      </div>
                    )}
                    {(kpis?.upcomingDeadlines ?? 0) > 0 && (
                      <div className="px-4 py-3 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer" onClick={() => navigate('/accounty/tax-calendar')}>
                        <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0 mt-0.5">
                          <Calendar className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Közelgő határidők</p>
                          <p className="text-xs text-slate-500 mt-0.5">{kpis?.upcomingDeadlines} deadline 7 napon belül</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-8 flex items-center justify-center">
                    <span className="text-sm text-slate-500">Nincs új értesítés</span>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
        </header>

        {/* Date Range Picker — same as eaisybill */}
        <GlobalDatePicker />

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-8">
          <AccountyRoleProvider>
            <Outlet />
          </AccountyRoleProvider>
        </div>
      </main>
    </div>

      {/* Command Palette */}
      <Dialog open={cmdOpen} onOpenChange={(v) => { setCmdOpen(v); if (!v) setCmdQuery(''); }}>
        <DialogContent className="sm:max-w-[480px] p-0 gap-0 overflow-hidden [&>button]:hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              autoFocus
              placeholder="Keresés oldal vagy ügyfél..."
              value={cmdQuery}
              onChange={(e) => setCmdQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              onKeyDown={(e) => {
                if (e.key === 'Escape') setCmdOpen(false);
              }}
            />
            <button
              onClick={() => { setCmdOpen(false); setCmdQuery(''); }}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="max-h-[320px] overflow-y-auto p-2">
            {filteredPages.length > 0 && (
              <div className="mb-2">
                <p className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Oldalak</p>
                {filteredPages.map((p) => (
                  <button
                    key={p.path}
                    onClick={() => { navigate(p.path); setCmdOpen(false); setCmdQuery(''); }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors text-left"
                  >
                    <p.icon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-foreground">{p.name}</span>
                  </button>
                ))}
              </div>
            )}
            {filteredClients.length > 0 && (
              <div>
                <p className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ügyfelek</p>
                {filteredClients.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { navigate(`/accounty/client/${c.id}`); setCmdOpen(false); setCmdQuery(''); }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors text-left"
                  >
                    <Briefcase className="w-4 h-4 text-primary" />
                    <div>
                      <span className="text-foreground font-medium">{c.name}</span>
                      <span className="text-muted-foreground text-xs ml-2">{c.taxNumber}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {filteredPages.length === 0 && filteredClients.length === 0 && cmdQuery && (
              <div className="py-8 text-center text-muted-foreground text-sm">
                Nincs találat: "{cmdQuery}"
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <FeedbackFab />
    </>
  );
}
