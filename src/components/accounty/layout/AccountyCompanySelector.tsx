import React, { useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Building2, 
  ChevronDown, 
  Check, 
  Search, 
  Briefcase 
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAccountyShell } from '@/pages/Accounty/AccountyShellContext';
import type { AccountyClient } from '@/hooks/accounty';

export interface AccountyCompanySelectorProps {
  isCollapsed?: boolean;
  isEv?: boolean;
  className?: string;
}

export default function AccountyCompanySelector({
  isCollapsed = false,
  isEv: propIsEv,
  className,
}: AccountyCompanySelectorProps) {
  const {
    selectedClientId,
    selectedClient,
    allClients,
    currentDateRange,
    handleBackToPortfolio,
    navigate,
  } = useAccountyShell();

  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isClientMode = Boolean(selectedClientId);

  const isEv = useMemo(() => {
    if (propIsEv !== undefined) return propIsEv;
    if (!selectedClient) return false;
    const name = selectedClient.name?.toUpperCase() || '';
    return (
      (selectedClient as any).entityType === 'ev' ||
      name.includes('EV') ||
      name.includes('E.V.') ||
      name.toLowerCase().includes('egyéni vállalkozó')
    );
  }, [propIsEv, selectedClient]);

  // Filter clients by search term (name or tax number)
  const filteredClients = useMemo(() => {
    if (!allClients || allClients.length === 0) return [];
    if (!searchQuery.trim()) return allClients;
    const q = searchQuery.toLowerCase().trim();
    return allClients.filter(c => {
      const nameMatch = c.name?.toLowerCase().includes(q);
      const taxMatch = c.taxNumber?.toLowerCase().includes(q);
      return nameMatch || taxMatch;
    });
  }, [allClients, searchQuery]);

  const handleSelectClient = (client: AccountyClient) => {
    const targetId = client.companyId || (client as any).id;
    if (!targetId) return;

    const uuidRegex = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i;
    if (uuidRegex.test(location.pathname)) {
      const newPath = location.pathname.replace(uuidRegex, targetId);
      navigate(newPath);
    } else {
      navigate(`/eaisybooks/${targetId}/${currentDateRange}/overview`);
    }

    setOpen(false);
    setSearchQuery('');
  };

  const handleSelectPortfolio = () => {
    handleBackToPortfolio();
    setOpen(false);
    setSearchQuery('');
  };

  const displayName = isClientMode
    ? (selectedClient?.name || 'Kiválasztott cég')
    : 'Portfólió nézet';

  const subtitle = isClientMode
    ? (selectedClient?.taxNumber || 'Nincs adószám')
    : (allClients?.length ? `${allClients.length} ügyfélcég` : 'Összes ügyfél');

  const badgeText = isClientMode
    ? (isEv ? 'EV' : 'Társaság')
    : 'Portfólió';

  // Collapsed Mode Trigger
  if (isCollapsed) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                type="button"
                style={{ outline: 'none' }}
                className={cn(
                  "relative flex items-center justify-center rounded-md transition-all duration-200 w-8 h-8",
                  "outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ring-0 focus-visible:ring-offset-0",
                  "[outline:none!important] focus:[outline:none!important] focus-visible:[outline:none!important]",
                  "[box-shadow:none!important] focus:[box-shadow:none!important] focus-visible:[box-shadow:none!important]",
                  open
                    ? "bg-primary/20 text-primary"
                    : "hover:bg-primary/10 hover:text-primary text-sidebar-foreground",
                  isClientMode ? "text-primary" : "text-sidebar-foreground/80"
                )}
                aria-label={displayName}
              >
                {isClientMode ? (
                  <Building2 className="h-4 w-4 shrink-0 text-primary" />
                ) : (
                  <Briefcase className="h-4 w-4 shrink-0 text-primary" />
                )}
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="right">
            <span className="font-semibold">{displayName}</span>
            <span className="block text-[10px] text-muted-foreground">{subtitle}</span>
          </TooltipContent>
        </Tooltip>

        <PopoverContent
          className="w-72 p-0 border-border shadow-xl rounded-xl overflow-hidden bg-card z-[60] outline-none focus:outline-none [outline:none!important]"
          align="start"
          side="right"
          sideOffset={8}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
          }}
        >
          {renderPopoverBody()}
        </PopoverContent>
      </Popover>
    );
  }

  // Expanded Mode Trigger
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="accounty-company-selector"
          style={{ outline: 'none' }}
          className={cn(
            "w-full text-left px-2 py-1.5 rounded-lg bg-sidebar-foreground/5 border border-border/50",
            "hover:bg-sidebar-foreground/10 hover:border-border transition-all duration-150 group select-none",
            "flex flex-col gap-0.5",
            "outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ring-0 focus-visible:ring-offset-0",
            "[outline:none!important] focus:[outline:none!important] focus-visible:[outline:none!important]",
            "[box-shadow:none!important] focus:[box-shadow:none!important] focus-visible:[box-shadow:none!important]",
            open && "bg-sidebar-foreground/10 border-primary/40",
            className
          )}
        >
          <div className="flex items-center gap-1.5 w-full">
            <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="font-semibold text-xs text-foreground truncate flex-1">
              {displayName}
            </span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-transform duration-200",
                open && "rotate-180 text-foreground"
              )}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground pl-5 w-full">
            <span className="truncate">{subtitle}</span>
            <span className="px-1 py-0.2 rounded text-[9px] font-mono uppercase font-semibold shrink-0 ml-1 bg-primary/10 text-primary">
              {badgeText}
            </span>
          </div>
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-72 p-0 border-border shadow-xl rounded-xl overflow-hidden bg-card z-[60] outline-none focus:outline-none [outline:none!important]"
        align="start"
        sideOffset={6}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
        }}
      >
        {renderPopoverBody()}
      </PopoverContent>
    </Popover>
  );

  function renderPopoverBody() {
    return (
      <div className="flex flex-col">
        {/* Search Header */}
        <div className="p-2 border-b border-border/60 bg-muted/20">
          <div className="flex items-center gap-2 px-2.5 py-1.5 bg-background rounded-lg border border-border/60 focus-within:border-primary/50 transition-colors">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cég vagy adószám keresése..."
              style={{ outline: 'none' }}
              className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 [outline:none!important] [box-shadow:none!important] flex-1 min-w-0"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{ outline: 'none' }}
                className="text-[10px] text-muted-foreground hover:text-foreground p-0.5 rounded outline-none focus:outline-none focus:ring-0 [outline:none!important] [box-shadow:none!important]"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Portfolio Option */}
        <div className="p-1 border-b border-border/50">
          <button
            type="button"
            onClick={handleSelectPortfolio}
            style={{ outline: 'none' }}
            className={cn(
              "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors text-left",
              "outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ring-0 focus-visible:ring-offset-0",
              "[outline:none!important] focus:[outline:none!important] focus-visible:[outline:none!important]",
              "[box-shadow:none!important] focus:[box-shadow:none!important] focus-visible:[box-shadow:none!important]",
              !isClientMode
                ? "bg-primary/10 text-primary font-semibold shadow-sm"
                : "hover:bg-primary/5 text-foreground hover:text-primary"
            )}
          >
            <Briefcase className={cn("w-4 h-4 shrink-0", !isClientMode ? "text-primary" : "text-muted-foreground")} />
            <div className="flex-1 min-w-0">
              <div className="truncate font-semibold">Teljes Portfólió</div>
              <div className="text-[10px] text-muted-foreground truncate">Portfólió áttekintés és teendők</div>
            </div>
            {!isClientMode && <Check className="w-4 h-4 shrink-0 text-primary" />}
          </button>
        </div>

        {/* Company List */}
        <div className="max-h-60 overflow-y-auto p-1 space-y-0.5" tabIndex={-1}>
          {filteredClients.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              Nincs találat
            </div>
          ) : (
            filteredClients.map(client => {
              const clientId = client.companyId || (client as any).id;
              const isSelected = clientId === selectedClientId;
              const clientIsEv = (client as any).entityType === 'ev' || 
                client.name.toUpperCase().includes('EV') || 
                client.name.toUpperCase().includes('E.V.') ||
                client.name.toLowerCase().includes('egyéni vállalkozó');

              return (
                <button
                  key={clientId}
                  type="button"
                  onClick={() => handleSelectClient(client)}
                  style={{ outline: 'none' }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors text-left group/item",
                    "outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ring-0 focus-visible:ring-offset-0",
                    "[outline:none!important] focus:[outline:none!important] focus-visible:[outline:none!important]",
                    "[box-shadow:none!important] focus:[box-shadow:none!important] focus-visible:[box-shadow:none!important]",
                    isSelected
                      ? "bg-primary/10 text-primary font-semibold shadow-sm"
                      : "hover:bg-primary/5 text-foreground hover:text-primary"
                  )}
                >
                  <Building2 className={cn("w-4 h-4 shrink-0", isSelected ? "text-primary" : "text-muted-foreground group-hover/item:text-primary")} />
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{client.name}</div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <span>{client.taxNumber || 'Nincs adószám'}</span>
                      <span className="text-[8px] font-mono uppercase px-1 rounded font-semibold bg-primary/10 text-primary">
                        {clientIsEv ? 'EV' : 'Társaság'}
                      </span>
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 shrink-0 text-primary" />}
                </button>
              );
            })
          )}
        </div>
      </div>
    );
  }
}
