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
      <ul className="flex w-full min-w-0 flex-col gap-1 animate-in fade-in duration-300">
        <li className="relative flex justify-center">
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                onClick={handleBackToPortfolio}
                className="relative flex items-center justify-center rounded-md transition-all duration-200 w-8 h-8 hover:bg-primary/10 hover:text-primary text-sidebar-foreground"
              >
                <ArrowLeft className="h-4 w-4 shrink-0 text-primary" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Vissza a portfólióhoz</TooltipContent>
          </Tooltip>
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
    <div className="space-y-3 animate-in fade-in duration-200">
      {/* Back to Portfolio Button & Active Client Card */}
      <div className="px-1 space-y-2">
        <button
          onClick={handleBackToPortfolio}
          className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 transition-colors group"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
          <span>Vissza a portfólióhoz</span>
        </button>

        {selectedClient && (
          <div className="px-2 py-1.5 rounded-lg bg-sidebar-foreground/5 border border-border/50">
            <div className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="font-semibold text-xs text-foreground truncate flex-1">
                {selectedClient.name}
              </div>
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-0.5 pl-5">
              <span>{selectedClient.taxNumber || 'Nincs adószám'}</span>
              <span className="px-1 py-0.2 rounded bg-sidebar-foreground/10 text-[9px] font-mono uppercase">
                {isEv ? 'EV' : 'Társaság'}
              </span>
            </div>
          </div>
        )}
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
