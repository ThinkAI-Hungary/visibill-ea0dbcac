import { Suspense, memo } from "react";
import { Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Building2, LogOut, Moon, Sun } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useTheme } from "@/contexts/ThemeContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function getInitials(name?: string | null, email?: string | null) {
  const source = (name || email || "").trim();
  if (!source) return "?";
  return source
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * EmployeeHeader - minimal, mobile-first top bar for the `employee` (Munkavallalo) role.
 * No sidebar, no date picker: company name, language, theme and a user menu with logout.
 */
const EmployeeHeader = memo(function EmployeeHeader() {
  const { t } = useTranslation(["common"]);
  const { user, signOut } = useAuth();
  const { selectedCompany } = useCompany();
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  const displayName = user?.user_metadata?.name as string | undefined;

  return (
    <header
      data-testid="employee-header"
      className="print:hidden shrink-0 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    >
      <div className="flex h-14 items-center justify-between gap-2 px-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <Building2 className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <span
            data-testid="employee-header-company"
            className="truncate text-sm font-semibold sm:text-base"
          >
            {selectedCompany?.name ?? ""}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <LanguageSwitcher />
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            title={isDark ? t("common:user.light_mode", "Világos mód") : t("common:user.dark_mode", "Sötét mód")}
            aria-label={isDark ? t("common:user.light_mode", "Világos mód") : t("common:user.dark_mode", "Sötét mód")}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full"
                data-testid="employee-user-menu"
                aria-label={t("common:user.menu", "Felhasználói menü")}
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.user_metadata?.avatar_url} />
                  <AvatarFallback className="text-xs">{getInitials(displayName, user?.email)}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <p className="truncate text-sm font-medium">
                  {displayName || t("common:user.default_name", { defaultValue: "Felhasználó" })}
                </p>
                <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                data-testid="employee-logout"
                className="cursor-pointer gap-2"
                onSelect={() => {
                  void signOut();
                }}
              >
                <LogOut className="h-4 w-4" />
                {t("common:user.logout", "Kilépés")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
});

/**
 * EmployeeShell - sidebar-less layout for the `employee` role (RBAC Csomag C, A-247).
 */
export function EmployeeShell({ children }: { children?: React.ReactNode }) {
  return (
    <div
      data-testid="employee-shell"
      className="flex h-screen w-full min-h-0 flex-col overflow-hidden bg-background print:h-auto print:overflow-visible"
    >
      <EmployeeHeader />
      <main className="flex-1 overflow-y-auto p-3 sm:p-6 print:p-0 print:overflow-visible">
        <Suspense fallback={<div className="h-full w-full" aria-busy="true" />}>
          {children || <Outlet />}
        </Suspense>
      </main>
    </div>
  );
}
