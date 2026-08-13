import React, { useMemo } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useAccountyClients, AccountyClient } from '@/hooks/accounty';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Building2, ChevronDown, Check, Search } from 'lucide-react';

/**
 * CompanySwitcher — Dropdown in the Accounty header that lets
 * users quickly switch between their assigned companies.
 * 
 * Shows the currently selected company (extracted from URL) and
 * a searchable list of all assigned companies.
 */
export function CompanySwitcher() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: clients, isLoading } = useAccountyClients();
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');

  // Extract current company ID from URL patterns:
  // /accounty/client/:id, /accounty/payroll/:id, /accounty/missing-invoices/:id, /accounty/client/:id/...
  // and the dynamic scoped pattern: /accounty/:companyId/:dateRange/...
  const currentCompanyId = useMemo(() => {
    // 1. Check scoped layout format: /accounty/:companyId/:dateRange/...
    // companyId is the first parameter after /accounty/ and it's a UUID
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts.length >= 3 && parts[0] === 'accounty') {
      const possibleUuid = parts[1];
      const uuidRegex = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
      if (uuidRegex.test(possibleUuid)) {
        return possibleUuid;
      }
    }

    // 2. Legacy fallback
    const match = location.pathname.match(/\/eaisybooks\/(?:client|payroll|missing-invoices)\/([^/]+)/);
    return match?.[1] ?? null;
  }, [location.pathname]);

  // Find current company details
  const currentCompany = useMemo(() => {
    if (!currentCompanyId || !clients) return null;
    return clients.find(c => c.id === currentCompanyId) ?? null;
  }, [currentCompanyId, clients]);

  // Filter companies by search
  const filteredClients = useMemo(() => {
    if (!clients) return [];
    if (!searchQuery) return clients;
    const q = searchQuery.toLowerCase();
    return clients.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.taxNumber && c.taxNumber.toLowerCase().includes(q))
    );
  }, [clients, searchQuery]);

  // Navigate to the selected company, maintaining the current sub-route pattern
  function handleSelect(client: AccountyClient) {
    const uuidRegex = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i;
    if (uuidRegex.test(location.pathname)) {
      const newPath = location.pathname.replace(uuidRegex, client.id);
      navigate(newPath);
    } else {
      navigate(`/eaisybooks/client/${client.id}`);
    }
    setOpen(false);
    setSearchQuery('');
  }

  // Don't show the switcher if we're on a non-company page (portfolio, etc.)
  if (!currentCompanyId) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg
                     bg-muted hover:bg-accent/80
                     border border-border
                     text-sm font-medium text-foreground
                     transition-all duration-150 max-w-[260px] group"
        >
          <Building2 className="w-4 h-4 shrink-0 text-primary" />
          <span className="truncate">
            {isLoading ? '...' : (currentCompany?.name ?? 'Cég kiválasztása')}
          </span>
          <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground group-hover:text-foreground transition-transform duration-200" style={{ transform: open ? 'rotate(180deg)' : undefined }} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-0 border-border shadow-xl rounded-xl overflow-hidden dark:bg-card"
        align="start"
        sideOffset={6}
      >
        {/* Search */}
        <div className="px-3 py-2 border-b border-border">
          <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/40 rounded-md border border-border">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cég keresése..."
              className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none flex-1 min-w-0"
              autoFocus
            />
          </div>
        </div>

        {/* Company list */}
        <div className="max-h-64 overflow-y-auto py-1">
          {filteredClients.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              {isLoading ? 'Betöltés...' : 'Nincs találat'}
            </div>
          ) : (
            filteredClients.map(client => {
              const isSelected = client.id === currentCompanyId;
              return (
                <button
                  key={client.id}
                  onClick={() => handleSelect(client)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors text-left
                    ${isSelected
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'hover:bg-accent text-foreground'
                    }`}
                >
                  <Building2 className={`w-4 h-4 shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{client.name}</div>
                    {client.taxNumber && (
                      <div className="text-[11px] text-muted-foreground truncate">{client.taxNumber}</div>
                    )}
                  </div>
                  {isSelected && <Check className="w-4 h-4 shrink-0 text-primary" />}
                  {client.missingCount > 0 && (
                    <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full
                      ${client.missingCount > 3
                        ? 'bg-red-500/10 text-red-500'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      }`}>
                      {client.missingCount}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer: back to portfolio */}
        <div className="border-t border-border px-3 py-2">
          <button
            onClick={() => { navigate('/eaisybooks'); setOpen(false); }}
            className="w-full text-center text-xs font-medium text-primary hover:text-primary/80 transition-colors py-1"
          >
            ← Vissza a portfólióhoz
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
