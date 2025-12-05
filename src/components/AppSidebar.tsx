import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
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
  TestTube,
  Tags,
  TrendingUp,
  Wallet
} from "lucide-react";
import CompanySelector from "./CompanySelector";

const navigationItems = [
  {
    title: "Irányítópult",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Kategóriák",
    url: "/onboarding",
    icon: Tags,
  },
  {
    title: "Projektek",
    url: "/projects",
    icon: FolderKanban,
  },
  {
    title: "Számlák",
    url: "/invoices", 
    icon: FileText,
  },
  {
    title: "Feltöltés",
    url: "/upload",
    icon: Upload,
  },
  {
    title: "Bérek/járulékok",
    url: "/salaries",
    icon: Wallet,
  },
  {
    title: "Integrációk",
    url: "/integrations",
    icon: Plug,
  },
  {
    title: "NAV Tesztelés",
    url: "/nav-testing",
    icon: TestTube,
  },
  {
    title: "Árfolyamok",
    url: "/exchange-rates",
    icon: TrendingUp,
  },
  {
    title: "Elemzések",
    url: "/analytics",
    icon: BarChart3,
  },
  {
    title: "Előfizetés",
    url: "/pricing",
    icon: CreditCard,
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const currentPath = location.pathname;

  const isCollapsed = state === "collapsed";

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
    <Sidebar className={isCollapsed ? "w-14" : "w-72"} collapsible="icon">
      <SidebarContent>
        {/* Header */}
        <div className="p-4 border-b">
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
          <div className="p-3 border-b">
            <CompanySelector />
          </div>
        )}

        {/* Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Navigáció</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                  >
                    <Link
                      to={item.url}
                      className={`flex items-center w-full px-3 py-2 rounded-md text-sm transition-colors ${
                        isActive(item.url) 
                          ? 'bg-primary/10 text-primary font-medium' 
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <item.icon className={`h-4 w-4 ${isCollapsed ? '' : 'mr-3'}`} />
                      {!isCollapsed && (
                        <span>{item.title}</span>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* User Section */}
        <div className="mt-auto border-t">
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
              </div>
              <div className="flex gap-2">
                <Link 
                  to="/settings"
                  className="flex-1 inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Beállítások
                </Link>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleSignOut}
                  className="flex-1"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Kilépés
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-2 space-y-2">
              <Avatar className="h-8 w-8 mx-auto">
                <AvatarImage src={user?.user_metadata?.avatar_url} />
                <AvatarFallback className="text-xs">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleSignOut}
                className="w-full"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
          
          {/* Sidebar Toggle */}
          <div className="p-2 border-t">
            <SidebarTrigger className="w-full hover:bg-muted" />
          </div>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}