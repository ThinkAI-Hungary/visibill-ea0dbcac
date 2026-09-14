import React from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Briefcase, 
  User, 
  FileText, 
  FileWarning, 
  Coins, 
  Landmark, 
  Calculator, 
  ClipboardList, 
  Brain, 
  Settings, 
  Building2 
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAccountyShell } from '@/pages/Accounty/AccountyShellContext';
import { useEvClientSettings } from '@/hooks/useEvData';
import AccountyCompanySelector from './AccountyCompanySelector';

export default function ClientNav() {
  const {
    isCollapsed,
    selectedClientId,
    selectedClient,
    currentDateRange,
    pathname,
    handlePrefetch,
    handleBackToPortfolio,
  } = useAccountyShell();

  const { data: evSettings } = useEvClientSettings(selectedClientId || undefined);

  const isEv = React.useMemo(() => {
    return pathname.split('/').includes('ev') || 
           !!evSettings || 
           (selectedClient?.name ? (
             selectedClient.name.toUpperCase().includes('EV') || 
             selectedClient.name.toUpperCase().includes('E.V.') ||
             selectedClient.name.toLowerCase().includes('egyéni vállalkozó')
           ) : false);
  }, [pathname, evSettings, selectedClient]);

  if (!selectedClientId) return null;

  const clientNavItems = [
    { 
      path: `/eaisybooks/${selectedClientId}/${currentDateRange}/overview`, 
      name: 'Áttekintés', 
      icon: Briefcase, 
      exact: true 
    },
    { 
      path: `/eaisybooks/${selectedClientId}/${currentDateRange}/profile`, 
      name: 'Profil', 
      icon: User 
    },
    { 
      path: `/eaisybooks/${selectedClientId}/${currentDateRange}/invoices`, 
      name: 'Számlák', 
      icon: FileText 
    },
    { 
      path: `/eaisybooks/${selectedClientId}/${currentDateRange}/missing-invoices`, 
      name: 'Hiányzó számlák', 
      icon: FileWarning 
    },
    { 
      path: `/eaisybooks/${selectedClientId}/${currentDateRange}/ev`, 
      name: 'Egyéni Vállalkozás', 
      icon: Coins 
    },
    { 
      path: `/eaisybooks/${selectedClientId}/${currentDateRange}/tao`, 
      name: 'Társasági Adó', 
      icon: Landmark 
    },
    { 
      path: `/eaisybooks/${selectedClientId}/${currentDateRange}/payroll`, 
      name: 'Bérszámfejtés', 
      icon: Calculator 
    },
    { 
      path: `/eaisybooks/${selectedClientId}/${currentDateRange}/payroll/filings`, 
      name: 'NAV bevallások', 
      icon: ClipboardList 
    },
    { 
      path: `/eaisybooks/${selectedClientId}/${currentDateRange}/prompts`, 
      name: 'Könyvelési Szabályok', 
      icon: Brain 
    },
    { 
      path: `/eaisybooks/${selectedClientId}/${currentDateRange}/settings#notifications`, 
      name: 'Beállítások / Cégkapu', 
      icon: Settings 
    },
  ];

  if (isCollapsed) {
    return (
      <ul className="flex w-full min-w-0 flex-col gap-1 page-animate">
        <li className="relative flex justify-center">
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleBackToPortfolio}
                style={{ outline: 'none' }}
                className={cn(
                  "relative flex items-center justify-center rounded-md transition-all duration-200 w-8 h-8",
                  "hover:bg-primary/10 hover:text-primary text-sidebar-foreground",
                  "outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ring-0 focus-visible:ring-offset-0",
                  "[outline:none!important] focus:[outline:none!important] focus-visible:[outline:none!important]",
                  "[box-shadow:none!important] focus:[box-shadow:none!important] focus-visible:[box-shadow:none!important]"
                )}
              >
                <ArrowLeft className="h-4 w-4 shrink-0 text-primary" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Vissza a portfólióhoz</TooltipContent>
          </Tooltip>
        </li>
        <li className="relative flex justify-center">
          <AccountyCompanySelector isCollapsed isEv={isEv} />
        </li>
        <li className="my-1 mx-2 h-px bg-border/50" />
        {clientNavItems.map((item) => {
          const pathWithoutHash = item.path.split('#')[0];
          const active = item.exact ? pathname === pathWithoutHash : pathname.startsWith(pathWithoutHash);
          return (
            <li key={item.path} className="relative flex justify-center">
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Link
                    to={item.path}
                    onMouseEnter={() => handlePrefetch(item.path)}
                    onFocus={() => handlePrefetch(item.path)}
                    onTouchStart={() => handlePrefetch(item.path)}
                    className={cn(
                      "relative flex items-center justify-center rounded-md transition-all duration-200 w-8 h-8",
                      active ? "bg-primary/15 text-primary font-semibold" : "hover:bg-primary/10 hover:text-primary text-sidebar-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{item.name}</TooltipContent>
              </Tooltip>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="space-y-3 page-animate duration-200">
      {/* Back to Portfolio Button & Active Client Card */}
      <div className="px-1 space-y-2">
        <button
          type="button"
          onClick={handleBackToPortfolio}
          style={{ outline: 'none' }}
          className={cn(
            "flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 transition-colors group",
            "outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ring-0 focus-visible:ring-offset-0",
            "[outline:none!important] focus:[outline:none!important] focus-visible:[outline:none!important]",
            "[box-shadow:none!important] focus:[box-shadow:none!important] focus-visible:[box-shadow:none!important]"
          )}
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
          <span>Vissza a portfólióhoz</span>
        </button>

        <div data-tour="company-selector">
          <AccountyCompanySelector isEv={isEv} />
        </div>
      </div>

      {/* Client Context Items */}
      <ul className="flex w-full min-w-0 flex-col gap-1">
        {clientNavItems.map(item => {
          const pathWithoutHash = item.path.split('#')[0];
          const active = item.exact ? pathname === pathWithoutHash : pathname.startsWith(pathWithoutHash);
          return (
            <li key={item.path}>
              <Link
                to={item.path}
                onMouseEnter={() => handlePrefetch(item.path)}
                onFocus={() => handlePrefetch(item.path)}
                onTouchStart={() => handlePrefetch(item.path)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-primary/10 font-semibold text-primary shadow-sm ring-1 ring-primary/20"
                    : "hover:bg-primary/5 hover:text-primary text-sidebar-foreground/80"
                )}
              >
                <item.icon className={cn("h-4 w-4 shrink-0 transition-colors", active ? "text-primary" : "text-muted-foreground")} />
                <span className="truncate flex-1">{item.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
