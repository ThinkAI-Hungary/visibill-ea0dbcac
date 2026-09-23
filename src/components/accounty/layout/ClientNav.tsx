import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('accounty');
  const {
    isCollapsed,
    selectedClientId,
    selectedClient,
    currentDateRange,
    pathname,
    handlePrefetch,
    handleBackToPortfolio,
  } = useAccountyShell();

  const prefix = pathname.startsWith('/hr') ? '/hr' : '';
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
      path: `${prefix}/eaisybooks/${selectedClientId}/${currentDateRange}/overview`, 
      name: t('nav.items.overview', 'Áttekintés'), 
      icon: Briefcase, 
      exact: true 
    },
    { 
      path: `${prefix}/eaisybooks/${selectedClientId}/${currentDateRange}/profile`, 
      name: t('nav.items.profile', 'Profil'), 
      icon: User 
    },
    { 
      path: `${prefix}/eaisybooks/${selectedClientId}/${currentDateRange}/invoices`, 
      name: t('nav.items.invoices', 'Számlák'), 
      icon: FileText 
    },
    { 
      path: `${prefix}/eaisybooks/${selectedClientId}/${currentDateRange}/missing-invoices`, 
      name: t('nav.items.missing_invoices', 'Hiányzó számlák'), 
      icon: FileWarning 
    },
    { 
      path: `${prefix}/eaisybooks/${selectedClientId}/${currentDateRange}/ev`, 
      name: t('nav.items.ev', 'Egyéni Vállalkozás'), 
      icon: Coins 
    },
    { 
      path: `${prefix}/eaisybooks/${selectedClientId}/${currentDateRange}/tao`, 
      name: t('nav.items.tao', 'Társasági Adó'), 
      icon: Landmark 
    },
    { 
      path: `${prefix}/eaisybooks/${selectedClientId}/${currentDateRange}/payroll`, 
      name: t('nav.items.payroll', 'Bérszámfejtés'), 
      icon: Calculator 
    },
    { 
      path: `${prefix}/eaisybooks/${selectedClientId}/${currentDateRange}/payroll/filings`, 
      name: t('nav.items.nav_filings', 'NAV bevallások'), 
      icon: ClipboardList 
    },
    { 
      path: `${prefix}/eaisybooks/${selectedClientId}/${currentDateRange}/prompts`, 
      name: t('nav.items.prompts', 'Könyvelési Szabályok'), 
      icon: Brain 
    },
    { 
      path: `${prefix}/eaisybooks/${selectedClientId}/${currentDateRange}/settings#notifications`, 
      name: t('nav.items.cegkapu_settings', 'Beállítások / Cégkapu'), 
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
            <TooltipContent side="right">{t('nav.tooltips.back_to_portfolio', 'Vissza a portfólióhoz')}</TooltipContent>
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
          <span>{t('nav.tooltips.back_to_portfolio', 'Vissza a portfólióhoz')}</span>
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
