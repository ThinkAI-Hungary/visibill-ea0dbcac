import React, { useMemo, useCallback } from "react";
import { useLocation, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useScopedBasePath, extractPageSegment } from "@/lib/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
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
  CreditCard,
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
  ClipboardCheck
} from "lucide-react";
import CompanySelector from "./CompanySelector";

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  tourId: string;
  employeeVisible?: boolean;
}

const navigationItems: NavItem[] = [
  { title: "Irányítópult", url: "/", icon: LayoutDashboard, tourId: "dashboard" },
  { title: "Kategóriák", url: "/categories", icon: Tags, tourId: "categories" },
  { title: "Projektek", url: "/projects", icon: FolderKanban, tourId: "projects" },
  { title: "Partnertörzs", url: "/partners", icon: Users, tourId: "partners" },
  { title: "Számlák", url: "/invoices", icon: FileText, tourId: "invoices" },
  { title: "Kintlévőség", url: "/kintlevo", icon: ReceiptText, tourId: "kintlevo" },
  { title: "Tranzakciók", url: "/transactions", icon: Landmark, tourId: "transactions" },
  { title: "Főkönyv", url: "/general-ledger", icon: BookOpen, tourId: "general-ledger" },
  { title: "Eredménykimutatás", url: "/profit-and-loss", icon: BarChart3, tourId: "profit-and-loss" },
  { title: "Mérleg", url: "/balance-sheet", icon: Scale, tourId: "balance-sheet" },
  { title: "Beszámoló", url: "/annual-report", icon: ClipboardCheck, tourId: "annual-report" },
  { title: "Feltöltés", url: "/upload", icon: Upload, tourId: "upload" },
  { title: "Bérek/járulékok", url: "/salaries", icon: Wallet, tourId: "salaries" },
  { title: "Munkaidő", url: "/working-time", icon: Clock, tourId: "working-time", employeeVisible: true },
  { title: "Házipénztár", url: "/petty-cash", icon: Banknote, tourId: "petty-cash" },
  { title: "TENY", url: "/teny", icon: Package2, tourId: "teny" },
  { title: "Integrációk", url: "/integrations", icon: Plug, tourId: "integrations" },
  { title: "Árfolyamok", url: "/exchange-rates", icon: TrendingUp, tourId: "exchange-rates" },
  { title: "Előfizetés", url: "/pricing", icon: CreditCard, tourId: "subscription" },
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
  "/upload": () => import("@/pages/ManualUpload"),
  "/salaries": () => import("@/pages/SalariesPage"),
  "/working-time": () => import("@/pages/WorkingTimePage"),
  "/petty-cash": () => import("@/pages/PettyCashPage"),
  "/teny": () => import("@/pages/FixedAssetsPage"),
  "/integrations": () => import("@/pages/Integrations"),
  "/exchange-rates": () => import("@/pages/ExchangeRates"),
  "/pricing": () => import("@/pages/Pricing"),
};

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

  const currentPath = location.pathname;
  const basePath = useScopedBasePath();
  // Extract just the page segment for active state matching
  const pageSegment = extractPageSegment(currentPath);

  const isCollapsed = state === "collapsed";
  const hasNoCompany = !selectedCompany;
  const isDark = theme === "dark";

  // Role is already resolved — direct filter, no loading state.
  // Memoized with resolved `to` paths so <Link> props stay referentially stable.
  const visibleNavItems = useMemo(() => {
    const items = isEmployee
      ? navigationItems.filter((item) => item.employeeVisible)
      : navigationItems;
    return items.map((item) => ({
      ...item,
      to: item.url === "/" ? basePath : `${basePath}${item.url}`,
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
      <SidebarContent className="select-none">
        {/* Header */}
        <div className={`p-4 border-b border-primary/30 ${isCollapsed ? 'flex justify-center' : ''}`}>
          {!isCollapsed ? (
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black bg-gradient-to-br from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent tracking-tight">
                Visibill
              </span>
              <span className="text-xl font-light text-muted-foreground">|</span>
              <Link to="/accounty" className="text-2xl font-black bg-gradient-to-br from-red-500 via-red-600 to-red-700 bg-clip-text text-transparent tracking-tight hover:opacity-80 transition-opacity">
                Accounty
              </Link>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2">
              <span className="text-2xl font-black bg-gradient-to-br from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent tracking-tight">
                V
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
          <div className="p-3 border-b border-primary/30" data-tour="company-selector">
            <CompanySelector />
          </div>
        )}

        {/* Navigation */}
        <SidebarGroup>
          {!isCollapsed && <SidebarGroupLabel>Navigáció</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu className="select-none">
              {visibleNavItems.map((item) => {
                const isDisabled = hasNoCompany;
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
                        <div className="flex items-center gap-2 w-full">
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                        </div>
                      ) : (
                        <Link
                          to={item.to}
                          onMouseEnter={() => handlePrefetch(item.url)}
                          onFocus={() => handlePrefetch(item.url)}
                          onTouchStart={() => handlePrefetch(item.url)}
                          className="flex items-center gap-2 w-full"
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                        </Link>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* User Section */}
        <div className="mt-auto border-t border-primary/30">
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
          <div className={`p-2 border-t border-primary/30 ${isCollapsed ? 'flex justify-center' : ''}`}>
            <SidebarTrigger className={`hover:bg-primary/10 hover:text-primary ${isCollapsed ? '' : 'w-full'}`} />
          </div>
        </div>
      </SidebarContent>
    </Sidebar>
  );
});