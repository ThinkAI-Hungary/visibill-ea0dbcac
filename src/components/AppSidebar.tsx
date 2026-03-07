import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useTheme } from "@/contexts/ThemeContext";
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
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  LayoutDashboard, 
  FileText, 
  Upload, 
  Settings, 
  LogOut, 
  User,
  BarChart3,
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
  Banknote
} from "lucide-react";
import CompanySelector from "./CompanySelector";

const navigationItems = [
  {
    title: "Irányítópult",
    url: "/",
    icon: LayoutDashboard,
    tourId: "dashboard",
  },
  {
    title: "Kategóriák",
    url: "/onboarding",
    icon: Tags,
    tourId: "categories",
  },
  {
    title: "Projektek",
    url: "/projects",
    icon: FolderKanban,
    tourId: "projects",
  },
  {
    title: "Partnertörzs",
    url: "/partners",
    icon: Users,
    tourId: "partners",
  },
  {
    title: "Számlák",
    url: "/invoices", 
    icon: FileText,
    tourId: "invoices",
  },
  {
    title: "Tranzakciók",
    url: "/transactions",
    icon: Landmark,
    tourId: "transactions",
  },
  {
    title: "Feltöltés",
    url: "/upload",
    icon: Upload,
    tourId: "upload",
  },
  {
    title: "Bérek/járulékok",
    url: "/salaries",
    icon: Wallet,
    tourId: "salaries",
  },
  {
    title: "Házipénztár",
    url: "/petty-cash",
    icon: Banknote,
    tourId: "petty-cash",
  },
  {
    title: "Integrációk",
    url: "/integrations",
    icon: Plug,
    tourId: "integrations",
  },
  {
    title: "Árfolyamok",
    url: "/exchange-rates",
    icon: TrendingUp,
    tourId: "exchange-rates",
  },
  {
    title: "Előfizetés",
    url: "/pricing",
    icon: CreditCard,
    tourId: "subscription",
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { selectedCompany } = useCompany();
  const { theme, setTheme } = useTheme();
  const currentPath = location.pathname;

  const isCollapsed = state === "collapsed";
  const hasNoCompany = !selectedCompany;
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  const isActive = (path: string) => {
    if (path === "/") {
      return currentPath === "/";
    }
    return currentPath.startsWith(path);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  // Get user initials for avatar
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
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Header */}
        <div className={`p-4 border-b border-primary/30 ${isCollapsed ? 'flex justify-center' : ''}`}>
          {!isCollapsed ? (
            <div className="flex items-center gap-3">
              <span className="text-2xl font-black bg-gradient-to-br from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent tracking-tight">
                Visibill
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <span className="text-2xl font-black bg-gradient-to-br from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent tracking-tight">
                V
              </span>
            </div>
          )}
        </div>

        {/* Company Selector */}
        {!isCollapsed && (
          <div className="p-3 border-b border-primary/30" data-tour="company-selector">
            <CompanySelector />
          </div>
        )}

        {/* Navigation */}
        <SidebarGroup>
          {!isCollapsed && <SidebarGroupLabel>Navigáció</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => {
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
                        <Link to={item.url} className="flex items-center gap-2 w-full">
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
                  <AvatarFallback className="text-xs">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {user?.user_metadata?.name || 'Felhasználó'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user?.email}
                  </p>
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
              <div className="grid grid-cols-2 gap-2 w-full">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      asChild
                      className="w-full aspect-square justify-center hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                    >
                      <Link to="/settings">
                        <Settings className="h-5 w-5" />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Beállítások</TooltipContent>
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
                  <TooltipContent side="top">Kilépés</TooltipContent>
                </Tooltip>
              </div>
            </div>
          ) : (
            <div className="p-2 space-y-2 flex flex-col items-center">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.user_metadata?.avatar_url} />
                <AvatarFallback className="text-xs">
                  {getUserInitials()}
                </AvatarFallback>
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
                <TooltipContent side="right">{isDark ? 'Világos mód' : 'Sötét mód'}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    asChild
                    className="w-8 h-8 p-0 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                  >
                    <Link to="/settings">
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
                    onClick={handleSignOut}
                    className="w-8 h-8 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                  >
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
}