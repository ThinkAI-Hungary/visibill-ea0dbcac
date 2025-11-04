import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
import visibillLogo from '@/assets/visibill-logo.png';

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
    title: "Előfizetés",
    url: "/pricing",
    icon: CreditCard,
  },
  {
    title: "Elemzések",
    url: "/analytics",
    icon: BarChart3,
    disabled: true,
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
    <Sidebar className={isCollapsed ? "w-14" : "w-64"} collapsible="icon">
      <SidebarContent>
        {/* Header */}
        <div className="p-4 border-b">
          {!isCollapsed ? (
            <div className="flex items-center gap-3">
              <img src={visibillLogo} alt="Visibill" className="h-8 w-auto" />
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <img src={visibillLogo} alt="Visibill" className="h-8 w-auto" />
            </div>
          )}
        </div>

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
                    disabled={item.disabled}
                  >
                    <Button
                      variant="ghost"
                      className={`w-full justify-start ${
                        isActive(item.url) 
                          ? 'bg-primary/10 text-primary font-medium' 
                          : 'hover:bg-muted/50'
                      } ${item.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                      onClick={() => !item.disabled && navigate(item.url)}
                      disabled={item.disabled}
                    >
                      <item.icon className={`h-4 w-4 ${isCollapsed ? '' : 'mr-3'}`} />
                      {!isCollapsed && (
                        <span className={item.disabled ? 'line-through' : ''}>
                          {item.title}
                          {item.disabled && ' (Hamarosan)'}
                        </span>
                      )}
                    </Button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* User Section */}
        <div className="mt-auto p-4 border-t">
          {!isCollapsed ? (
            <div className="space-y-3">
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
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => navigate('/settings')}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Beállítások
                </Button>
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
            <div className="space-y-2">
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
        </div>
      </SidebarContent>
    </Sidebar>
  );
}