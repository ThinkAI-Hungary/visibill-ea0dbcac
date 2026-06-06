import React, { useMemo, useCallback, useState, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useScopedBasePath, extractPageSegment } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  LayoutDashboard, 
  FileText, 
  Upload, 
  Settings, 
  LogOut, 
  FolderKanban,
  Plug,
  // CreditCard,
  Tags,
  TrendingUp,
  Wallet,
  Sun,
  Landmark,
  Moon,
  Users,
  Banknote,
  ReceiptText,
  BookOpen,
  Clock,
  Package2,
  BarChart3,
  Scale,
  ClipboardCheck,
  FileSpreadsheet,
  ChevronRight,
  Wrench,
  TicketCheck,
} from "lucide-react";
import { useUnreadTicketCount } from "@/hooks/useTickets";
import CompanySelector from "./CompanySelector";

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  tourId: string;
  employeeVisible?: boolean;
}

interface NavGroup {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
}

const navigationGroups: NavGroup[] = [
  {
    key: 'overview',
    label: 'Áttekintés',
    icon: LayoutDashboard,
    items: [
      { title: "Irányítópult", url: "/", icon: LayoutDashboard, tourId: "dashboard" },
      { title: "Kategóriák", url: "/categories", icon: Tags, tourId: "categories" },
      { title: "Projektek", url: "/projects", icon: FolderKanban, tourId: "projects" },
      { title: "Partnertörzs", url: "/partners", icon: Users, tourId: "partners" },
    ],
  },
  {
    key: 'finance',
    label: 'Pénzügyek',
    icon: Landmark,
    items: [
      { title: "Számlák", url: "/invoices", icon: FileText, tourId: "invoices" },
      { title: "Kintlévőség", url: "/kintlevo", icon: ReceiptText, tourId: "kintlevo" },
      { title: "Tranzakciók", url: "/transactions", icon: Landmark, tourId: "transactions" },
      { title: "Házipénztár", url: "/petty-cash", icon: Banknote, tourId: "petty-cash" },
    ],
  },
  {
    key: 'accounting',
    label: 'Könyvelés',
    icon: BookOpen,
    items: [
      { title: "Főkönyv", url: "/general-ledger", icon: BookOpen, tourId: "general-ledger" },
      { title: "Eredménykimutatás", url: "/profit-and-loss", icon: BarChart3, tourId: "profit-and-loss" },
      { title: "Mérleg", url: "/balance-sheet", icon: Scale, tourId: "balance-sheet" },
      { title: "Beszámoló", url: "/annual-report", icon: ClipboardCheck, tourId: "annual-report" },
      { title: "ÁFA Bevallás", url: "/vat-return", icon: FileSpreadsheet, tourId: "vat-return" },
    ],
  },
  {
    key: 'hr',
    label: 'HR & Eszközök',
    icon: Users,
    items: [
      { title: "Bérek/járulékok", url: "/salaries", icon: Wallet, tourId: "salaries" },
      { title: "Munkaidő", url: "/working-time", icon: Clock, tourId: "working-time", employeeVisible: true },
      { title: "TENY", url: "/teny", icon: Package2, tourId: "teny" },
    ],
  },
  {
    key: 'system',
    label: 'Rendszer',
    icon: Wrench,
    items: [
      { title: "Integrációk", url: "/integrations", icon: Plug, tourId: "integrations" },
      { title: "Árfolyamok", url: "/exchange-rates", icon: TrendingUp, tourId: "exchange-rates" },
      // { title: "Előfizetés", url: "/pricing", icon: CreditCard, tourId: "subscription" },
    ],
  },
];

/**
 * Hover/focus prefetch map — kicks off the lazy chunk import when the
 * user merely hovers (or keyboard-focuses) a sidebar item, so by the
 * time they click the chunk is already in cache.
 */
const prefetchMap: Record<string, () => Promise<unknown>> = {
  "/": () => import("@/pages/Index"),
  "/categories": () => import("@/pages/Onboarding"),
  "/projects": () => import("@/pages/Projects"),
  "/partners": () => import("@/pages/PartnersPage"),
  "/invoices": () => import("@/pages/InvoicesPage"),
  "/kintlevo": () => import("@/pages/KintlevoPage"),
  "/transactions": () => import("@/pages/TransactionsPage"),
  "/general-ledger": () => import("@/pages/GeneralLedgerPage"),
  "/profit-and-loss": () => import("@/pages/ProfitAndLoss"),
  "/balance-sheet": () => import("@/pages/BalanceSheet"),
  "/annual-report": () => import("@/pages/AnnualReportPage"),
  "/vat-return": () => import("@/pages/VatReturnPage"),
  "/upload": () => import("@/pages/ManualUpload"),
  "/salaries": () => import("@/pages/SalariesPage"),
  "/working-time": () => import("@/pages/WorkingTimePage"),
  "/petty-cash": () => import("@/pages/PettyCashPage"),
  "/teny": () => import("@/pages/FixedAssetsPage"),
  "/integrations": () => import("@/pages/Integrations"),
  "/exchange-rates": () => import("@/pages/ExchangeRates"),
  // "/pricing": () => import("@/pages/Pricing"),
  "/tickets": () => import("@/pages/TicketsPage"),
};

const STORAGE_KEY = "visibill:sidebar-groups";

/** Find which group key contains a given URL */
function findGroupForUrl(url: string): string | null {
  for (const group of navigationGroups) {
    if (group.items.some(item => item.url === url)) {
      return group.key;
    }
  }
  return null;
}

/**
 * AppSidebar — Static Shell.
 *
 * This component is ONLY rendered after useAppReady() returns true,
 * meaning auth, company, and role are ALL resolved.
 *
 * No skeleton logic needed. No conditional rendering.
 * The nav items are immediately correct on first render.
 */
export const AppSidebar = React.memo(function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { selectedCompany } = useCompany();
  const { theme, setTheme } = useTheme();
  const { isEmployee } = useUserRole();
  const { data: unreadTicketCount = 0 } = useUnreadTicketCount();

  const currentPath = location.pathname;
  const basePath = useScopedBasePath();
  // Extract just the page segment for active state matching
  const pageSegment = extractPageSegment(currentPath);

  const isCollapsed = state === "collapsed";
  const hasNoCompany = !selectedCompany;
  const isDark = theme === "dark";

  // ── Open/closed state for collapsible groups ──
  // Initialize from localStorage, fallback to opening the active group
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return new Set(parsed);
        }
      }
    } catch { /* ignore */ }
    // Default: open the group containing the current page
    const activeGroup = findGroupForUrl(pageSegment);
    return new Set(activeGroup ? [activeGroup] : ['overview']);
  });

  // Persist open groups to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...openGroups]));
    } catch { /* ignore */ }
  }, [openGroups]);

  // Auto-open the group containing the active page on navigation
  useEffect(() => {
    const activeGroup = findGroupForUrl(pageSegment);
    if (activeGroup && !openGroups.has(activeGroup)) {
      setOpenGroups(prev => new Set([...prev, activeGroup]));
    }
  }, [pageSegment]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleGroup = useCallback((key: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // Role-based filtering: for employees, only show groups that have visible items
  const visibleGroups = useMemo(() => {
    return navigationGroups
      .map(group => {
        const items = isEmployee
          ? group.items.filter(item => item.employeeVisible)
          : group.items;
        return { ...group, items };
      })
      .filter(group => group.items.length > 0)
      .map(group => ({
        ...group,
        items: group.items.map(item => ({
          ...item,
          to: item.url === "/" ? basePath : `${basePath}${item.url}`,
        })),
      }));
  }, [isEmployee, basePath]);

  const handlePrefetch = useCallback((url: string) => {
    const loader = prefetchMap[url];
    if (loader) void loader();
  }, []);

  const toggleTheme = () => setTheme(isDark ? "light" : "dark");

  const isActive = (path: string) => {
    if (path === "/") return pageSegment === "/";
    return pageSegment === path || pageSegment.startsWith(path + '/');
  };

  const handleSignOut = async () => {
    await signOut();
  };

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

  return (
    <Sidebar collapsible="icon" className="print:hidden">
      <SidebarContent className="select-none flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className={`p-4 border-b border-border ${isCollapsed ? 'flex justify-center' : ''}`}>
          {!isCollapsed ? (
            <div className="flex items-center gap-2">
              <span className="relative text-2xl tracking-tight select-none">
                <span className="font-medium text-foreground/80">e</span>
                <span className="font-bold text-primary">ai</span>
                <span className="font-medium text-foreground/80">sy</span>
                <span className="font-medium text-primary">bill</span>
                <span className="absolute -bottom-1.5 left-0 right-0 h-[2px] rounded-full bg-primary" />
              </span>
              <span className="text-xl font-light text-muted-foreground">|</span>
              <Link to="/accounty" className="text-2xl font-black bg-gradient-to-br from-red-500 via-red-600 to-red-700 bg-clip-text text-transparent tracking-tight hover:opacity-80 transition-opacity">
                Accounty
              </Link>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2">
              <span className="text-2xl tracking-tight select-none">
                <span className="font-medium text-foreground/80">e</span>
                <span className="font-bold text-primary">ai</span>
              </span>
              <div className="w-4 h-px bg-muted-foreground/30 rounded-full" />
              <Link to="/accounty" className="text-2xl font-black bg-gradient-to-br from-red-500 via-red-600 to-red-700 bg-clip-text text-transparent tracking-tight hover:opacity-80 transition-opacity" title="Accounty">
                A
              </Link>
            </div>
          )}
        </div>

        {/* Company Selector — hidden for employees */}
        {!isCollapsed && !isEmployee && (
          <div className="p-3 border-b border-border" data-tour="company-selector">
            <CompanySelector />
          </div>
        )}

        {/* Navigation — Collapsible Groups — scrollable */}
        <SidebarGroup className="flex-1 overflow-y-auto min-h-0">
          <SidebarGroupContent>
            {isCollapsed ? (
              /* ── Collapsed mode: Category menu groups with side-flyout dropdowns ── */
              <SidebarMenu className="select-none flex flex-col gap-2">
                {visibleGroups.map(group => {
                  const isDisabled = hasNoCompany;
                  const active = group.items.some(item => isActive(item.url));
                  
                  return (
                    <SidebarMenuItem key={group.key}>
                      <DropdownMenu>
                        <Tooltip delayDuration={0}>
                          <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                              <SidebarMenuButton
                                isActive={active}
                                disabled={isDisabled}
                                className={cn(
                                  "w-8 h-8 p-0 flex items-center justify-center rounded-md transition-all duration-200",
                                  isDisabled 
                                    ? 'grayscale opacity-50 cursor-not-allowed' 
                                    : 'hover:bg-primary/10 hover:text-primary data-[state=open]:bg-primary/10 data-[state=open]:text-primary'
                                )}
                              >
                                <group.icon className="h-4 w-4 shrink-0" />
                                <span className="sr-only">{group.label}</span>
                              </SidebarMenuButton>
                            </DropdownMenuTrigger>
                          </TooltipTrigger>
                          <TooltipContent side="right" align="center" className="text-xs">
                            {group.label}
                          </TooltipContent>
                        </Tooltip>

                        {!isDisabled && (
                          <DropdownMenuContent
                            side="right"
                            align="start"
                            sideOffset={8}
                            className="w-48 bg-popover/95 backdrop-blur-md border border-border/60 shadow-lg shadow-primary/5 select-none p-1.5 animate-in slide-in-from-left-1 fade-in-50 duration-200"
                          >
                            <DropdownMenuLabel className="px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                              {group.label}
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator className="my-1 bg-border/40" />
                            <div className="flex flex-col gap-0.5">
                              {group.items.map(item => {
                                const itemActive = isActive(item.url);
                                return (
                                  <DropdownMenuItem
                                    key={item.title}
                                    asChild
                                    className={cn(
                                      "flex items-center gap-2.5 w-full cursor-pointer select-none py-2 px-2.5 rounded-md text-sm transition-colors",
                                      itemActive
                                        ? "bg-primary/15 text-primary font-medium focus:bg-primary/20 focus:text-primary"
                                        : "text-sidebar-foreground hover:bg-primary/10 hover:text-primary focus:bg-primary/10 focus:text-primary"
                                    )}
                                  >
                                    <Link
                                      to={item.to}
                                      onMouseEnter={() => handlePrefetch(item.url)}
                                      onFocus={() => handlePrefetch(item.url)}
                                      onTouchStart={() => handlePrefetch(item.url)}
                                    >
                                      <item.icon className="h-4 w-4 shrink-0" />
                                      <span>{item.title}</span>
                                    </Link>
                                  </DropdownMenuItem>
                                );
                              })}
                            </div>
                          </DropdownMenuContent>
                        )}
                      </DropdownMenu>
                    </SidebarMenuItem>
                  );
                })}
                {/* Standalone Feltöltés as the very last menu item in collapsed mode */}
                {!isEmployee && (
                  <SidebarMenuItem key="upload" data-tour="upload">
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton
                          isActive={isActive("/upload")}
                          disabled={hasNoCompany}
                          asChild={!hasNoCompany}
                          className={cn(
                            "w-8 h-8 p-0 flex items-center justify-center rounded-md transition-all duration-200",
                            hasNoCompany 
                              ? 'grayscale opacity-50 cursor-not-allowed' 
                              : 'hover:bg-primary/10 hover:text-primary'
                          )}
                        >
                          {hasNoCompany ? (
                            <Upload className="h-4 w-4 shrink-0" />
                          ) : (
                            <Link
                              to={`${basePath}/upload`}
                              onMouseEnter={() => handlePrefetch("/upload")}
                              onFocus={() => handlePrefetch("/upload")}
                              onTouchStart={() => handlePrefetch("/upload")}
                              className="flex items-center justify-center w-full h-full"
                            >
                              <Upload className="h-4 w-4 shrink-0" />
                            </Link>
                          )}
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      <TooltipContent side="right" align="center" className="text-xs">
                        Feltöltés
                      </TooltipContent>
                    </Tooltip>
                  </SidebarMenuItem>
                )}
                {/* Standalone Hibajegyek in collapsed mode */}
                {!isEmployee && (
                  <SidebarMenuItem key="tickets" data-tour="tickets">
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton
                          isActive={isActive("/tickets")}
                          disabled={hasNoCompany}
                          asChild={!hasNoCompany}
                          className={cn(
                            "w-8 h-8 p-0 flex items-center justify-center rounded-md transition-all duration-200 relative",
                            hasNoCompany 
                              ? 'grayscale opacity-50 cursor-not-allowed' 
                              : 'hover:bg-primary/10 hover:text-primary'
                          )}
                        >
                          {hasNoCompany ? (
                            <TicketCheck className="h-4 w-4 shrink-0" />
                          ) : (
                            <Link
                              to={`${basePath}/tickets`}
                              onMouseEnter={() => handlePrefetch("/tickets")}
                              onFocus={() => handlePrefetch("/tickets")}
                              onTouchStart={() => handlePrefetch("/tickets")}
                              className="flex items-center justify-center w-full h-full"
                            >
                              <TicketCheck className="h-4 w-4 shrink-0" />
                              {unreadTicketCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 flex items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                                  {unreadTicketCount > 9 ? '9+' : unreadTicketCount}
                                </span>
                              )}
                            </Link>
                          )}
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      <TooltipContent side="right" align="center" className="text-xs">
                        Hibajegyek{unreadTicketCount > 0 ? ` (${unreadTicketCount})` : ''}
                      </TooltipContent>
                    </Tooltip>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            ) : (
              /* ── Expanded mode: collapsible groups ── */
              <div className="flex flex-col gap-1">
                {visibleGroups.map(group => {
                  const isOpen = openGroups.has(group.key);
                  const groupHasActive = group.items.some(item => isActive(item.url));
                  const isDisabled = hasNoCompany;
                  
                  return (
                    <Collapsible
                      key={group.key}
                      open={isOpen}
                      onOpenChange={() => toggleGroup(group.key)}
                    >
                      {/* Group header trigger */}
                      <CollapsibleTrigger className={cn(
                        "relative flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm font-medium transition-colors select-none group/trigger",
                        !isOpen && groupHasActive
                          ? "bg-primary/8 text-primary font-semibold"
                          : "text-sidebar-foreground/70 hover:bg-primary/10 hover:text-primary"
                      )}>
                        <group.icon className={cn(
                          "h-4 w-4 shrink-0 transition-colors",
                          !isOpen && groupHasActive
                            ? "text-primary"
                            : "text-muted-foreground group-hover/trigger:text-primary"
                        )} />
                        <span className="flex-1 text-left text-xs font-medium uppercase tracking-wider">
                          {group.label}
                        </span>
                        <ChevronRight
                          className={cn(
                            "h-3.5 w-3.5 transition-transform duration-200",
                            isOpen ? 'rotate-90' : '',
                            !isOpen && groupHasActive ? 'text-primary' : 'text-muted-foreground'
                          )}
                        />
                        {/* Option 2: Active left vertical accent line when group is collapsed but contains active page */}
                        {!isOpen && groupHasActive && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-3/5 rounded-r-md bg-primary" />
                        )}
                      </CollapsibleTrigger>

                      {/* Collapsible content with animation */}
                      <CollapsibleContent className="nav-collapsible-content pb-1.5">
                        <SidebarMenu className="mt-0.5 select-none">
                          {group.items.map(item => {
                            const active = isActive(item.url);

                            return (
                              <SidebarMenuItem key={item.title} data-tour={item.tourId}>
                                <SidebarMenuButton
                                  asChild={!isDisabled}
                                  isActive={active}
                                  tooltip={item.title}
                                  className={isDisabled ? 'grayscale opacity-50 cursor-not-allowed' : ''}
                                >
                                  {isDisabled ? (
                                    <div className="flex items-center gap-2 w-full pl-2">
                                      <item.icon className="h-4 w-4 shrink-0" />
                                      <span>{item.title}</span>
                                    </div>
                                  ) : (
                                    <Link
                                      to={item.to}
                                      onMouseEnter={() => handlePrefetch(item.url)}
                                      onFocus={() => handlePrefetch(item.url)}
                                      onTouchStart={() => handlePrefetch(item.url)}
                                      className="flex items-center gap-2 w-full pl-2"
                                    >
                                      <item.icon className="h-4 w-4 shrink-0" />
                                      <span>{item.title}</span>
                                    </Link>
                                  )}
                                </SidebarMenuButton>
                              </SidebarMenuItem>
                            );
                          })}
                        </SidebarMenu>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
                {/* Standalone Feltöltés as the very last menu item in expanded mode */}
                {!isEmployee && (
                  hasNoCompany ? (
                    <div
                      key="upload"
                      className="relative flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm font-medium transition-colors select-none grayscale opacity-50 cursor-not-allowed"
                    >
                      <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 text-left text-xs font-medium uppercase tracking-wider">
                        Feltöltés
                      </span>
                    </div>
                  ) : (
                    <Link
                      key="upload"
                      to={`${basePath}/upload`}
                      onMouseEnter={() => handlePrefetch("/upload")}
                      onFocus={() => handlePrefetch("/upload")}
                      onTouchStart={() => handlePrefetch("/upload")}
                      className={cn(
                        "relative flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm font-medium transition-colors select-none group/trigger",
                        isActive("/upload")
                          ? "bg-primary/8 text-primary font-semibold"
                          : "text-sidebar-foreground/70 hover:bg-primary/10 hover:text-primary"
                      )}
                    >
                      <Upload className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        isActive("/upload") ? "text-primary" : "text-muted-foreground group-hover/trigger:text-primary"
                      )} />
                      <span className="flex-1 text-left text-xs font-medium uppercase tracking-wider">
                        Feltöltés
                      </span>
                      {/* Option 2 style active bar for standalone */}
                      {isActive("/upload") && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-3/5 rounded-r-md bg-primary" />
                      )}
                    </Link>
                  )
                )}
                {/* Standalone Hibajegyek in expanded mode */}
                {!isEmployee && (
                  hasNoCompany ? (
                    <div
                      key="tickets"
                      className="relative flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm font-medium transition-colors select-none grayscale opacity-50 cursor-not-allowed"
                    >
                      <TicketCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 text-left text-xs font-medium uppercase tracking-wider">
                        Hibajegyek
                      </span>
                    </div>
                  ) : (
                    <Link
                      key="tickets"
                      to={`${basePath}/tickets`}
                      onMouseEnter={() => handlePrefetch("/tickets")}
                      onFocus={() => handlePrefetch("/tickets")}
                      onTouchStart={() => handlePrefetch("/tickets")}
                      className={cn(
                        "relative flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm font-medium transition-colors select-none group/trigger",
                        isActive("/tickets")
                          ? "bg-primary/8 text-primary font-semibold"
                          : "text-sidebar-foreground/70 hover:bg-primary/10 hover:text-primary"
                      )}
                    >
                      <TicketCheck className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        isActive("/tickets") ? "text-primary" : "text-muted-foreground group-hover/trigger:text-primary"
                      )} />
                      <span className="flex-1 text-left text-xs font-medium uppercase tracking-wider">
                        Hibajegyek
                      </span>
                      {unreadTicketCount > 0 && (
                        <span className="h-5 min-w-5 px-1 flex items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                          {unreadTicketCount > 9 ? '9+' : unreadTicketCount}
                        </span>
                      )}
                      {/* Active bar */}
                      {isActive("/tickets") && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-3/5 rounded-r-md bg-primary" />
                      )}
                    </Link>
                  )
                )}
              </div>
            )}
          </SidebarGroupContent>
        </SidebarGroup>

        {/* User Section — pinned to bottom */}
        <div className="shrink-0 border-t border-border">
          {!isCollapsed ? (
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
                  onClick={toggleTheme}
                  className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                >
                  <div className="relative h-4 w-4">
                    <Sun className={`h-4 w-4 absolute transition-all ${isDark ? 'animate-rotate-out' : 'animate-rotate-in'}`} />
                    <Moon className={`h-4 w-4 absolute transition-all ${isDark ? 'animate-rotate-in' : 'animate-rotate-out'}`} />
                  </div>
                </Button>
              </div>
              <div className={`grid ${isEmployee ? 'grid-cols-1' : 'grid-cols-2'} gap-2 w-full`}>
                {!isEmployee && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" asChild className="w-full aspect-square justify-center hover:bg-primary/10 hover:text-primary hover:border-primary/30">
                        <Link to="/settings">
                          <Settings className="h-5 w-5" />
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Beállítások</TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" onClick={handleSignOut} className="w-full aspect-square justify-center hover:bg-primary/10 hover:text-primary hover:border-primary/30">
                      <LogOut className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Kilépés</TooltipContent>
                </Tooltip>
              </div>
            </div>
          ) : (
            <div className="p-2 space-y-2 flex flex-col items-center">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.user_metadata?.avatar_url} />
                <AvatarFallback className="text-xs">{getUserInitials()}</AvatarFallback>
              </Avatar>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={toggleTheme} className="w-8 h-8 hover:bg-primary/10 hover:text-primary">
                    <div className="relative h-4 w-4">
                      <Sun className={`h-4 w-4 absolute transition-all ${isDark ? 'animate-rotate-out' : 'animate-rotate-in'}`} />
                      <Moon className={`h-4 w-4 absolute transition-all ${isDark ? 'animate-rotate-in' : 'animate-rotate-out'}`} />
                    </div>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">{isDark ? 'Világos mód' : 'Sötét mód'}</TooltipContent>
              </Tooltip>

              {!isEmployee && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" asChild className="w-8 h-8 p-0 hover:bg-primary/10 hover:text-primary hover:border-primary/30">
                      <Link to="/settings">
                        <Settings className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Beállítások</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={handleSignOut} className="w-8 h-8 hover:bg-primary/10 hover:text-primary hover:border-primary/30">
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Kilépés</TooltipContent>
              </Tooltip>
            </div>
          )}
          
          {/* Sidebar Toggle */}
          <div className={`p-2 border-t border-border ${isCollapsed ? 'flex justify-center' : ''}`}>
            <SidebarTrigger className={`hover:bg-primary/10 hover:text-primary ${isCollapsed ? '' : 'w-full'}`} />
          </div>
        </div>
      </SidebarContent>
    </Sidebar>
  );
});