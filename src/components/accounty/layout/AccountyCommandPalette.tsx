import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Search, 
  X, 
  Briefcase, 
  FileWarning, 
  Calendar, 
  BarChart2, 
  MailCheck, 
  AlertTriangle, 
  Clock, 
  Calculator, 
  Rocket, 
  Settings, 
  User, 
  HelpCircle, 
  Bot, 
  ShieldCheck, 
  FileText, 
  BookOpen, 
  Scale, 
  Landmark, 
  Users, 
  PiggyBank 
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useAccountyShellOptional } from '@/pages/Accounty/AccountyShellContext';

export interface AccountyCommandPaletteProps {
  cmdOpen?: boolean;
  setCmdOpen?: (v: boolean) => void;
  cmdQuery?: string;
  setCmdQuery?: (q: string) => void;
  filteredPages?: any[];
  filteredClients?: any[];
  navigate?: (path: string) => void;
}

export default function AccountyCommandPalette(props: AccountyCommandPaletteProps) {
  const { t } = useTranslation('accounty');
  const location = useLocation();
  const prefix = location.pathname.startsWith('/hr') ? '/hr' : '';
  const shell = useAccountyShellOptional();

  const cmdOpen = props.cmdOpen ?? shell?.cmdOpen ?? false;
  const setCmdOpen = props.setCmdOpen ?? shell?.setCmdOpen ?? (() => {});
  const cmdQuery = props.cmdQuery ?? shell?.cmdQuery ?? '';
  const setCmdQuery = props.setCmdQuery ?? shell?.setCmdQuery ?? (() => {});
  const navigate = props.navigate ?? shell?.navigate ?? (() => {});

  const defaultCmdPages = useMemo(() => [
    { name: t('nav.items.portfolio', 'Portfólió'), path: `${prefix}/eaisybooks`, icon: Briefcase },
    { name: t('nav.items.missing_invoices', 'Hiányzó számlák'), path: `${prefix}/eaisybooks/missing-invoices`, icon: FileWarning },
    { name: t('nav.items.tax_calendar', 'Adó naptár'), path: `${prefix}/eaisybooks/tax-calendar`, icon: Calendar },
    { name: t('nav.items.reports', 'Riportok'), path: `${prefix}/eaisybooks/reports`, icon: BarChart2 },
    { name: t('nav.items.approval_queue', 'Jóváhagyó rendszer'), path: `${prefix}/eaisybooks/approval-queue`, icon: MailCheck },
    { name: t('nav.items.alerts', 'Riasztások'), path: `${prefix}/eaisybooks/alerts`, icon: AlertTriangle },
    { name: t('nav.items.nav_filings', 'NAV határidők'), path: `${prefix}/eaisybooks/nav-deadlines`, icon: Clock },
    { name: t('nav.items.payroll_cycles', 'Bérszámfejtés portfólió'), path: `${prefix}/eaisybooks?tab=payroll`, icon: Calculator },
    { name: t('nav.items.onboarding', 'Onboarding'), path: `${prefix}/eaisybooks/onboarding`, icon: Rocket },
    { name: t('nav.items.settings', 'Beállítások'), path: `${prefix}/eaisybooks/settings`, icon: Settings },
    { name: t('nav.items.profile_settings', 'Felhasználói beállítások'), path: `${prefix}/eaisybooks/profile/settings`, icon: User },
    { name: t('nav.items.help', 'Segítség'), path: `${prefix}/eaisybooks/help`, icon: HelpCircle },
    { name: t('nav.items.ai_assistant', 'AI Asszisztens'), path: `${prefix}/eaisybooks/ai-assistant`, icon: Bot },
    { name: t('nav.items.audit', 'Audit napló'), path: `${prefix}/eaisybooks/admin/audit`, icon: ShieldCheck },
    { name: t('nav.items.gdpr', 'GDPR'), path: `${prefix}/eaisybooks/admin/gdpr`, icon: ShieldCheck },
    { name: t('nav.items.templates', 'Sablonok'), path: `${prefix}/eaisybooks/admin/templates`, icon: FileText },
    { name: t('nav.items.job_codes', 'Jogviszonykódok'), path: `${prefix}/eaisybooks/admin/job-codes`, icon: BookOpen },
    { name: t('nav.items.tax_parameters', 'Adómértékek'), path: `${prefix}/eaisybooks/admin/tax-parameters`, icon: Calculator },
    { name: t('nav.items.legal_updates', 'Jogszabály-frissítések'), path: `${prefix}/eaisybooks/admin/legal-updates`, icon: Scale },
    { name: 'TAO ' + t('nav.items.portfolio', 'Portfólió'), path: `${prefix}/eaisybooks?tab=tao`, icon: Landmark },
    { name: 'TAO ' + t('tax_calendar.title', 'Naptár'), path: `${prefix}/eaisybooks/tao/calendar`, icon: Calendar },
    { name: 'TAO ' + t('nav.items.accountants', 'Adózói Körök'), path: `${prefix}/eaisybooks/tao/taxpayer-types`, icon: Users },
    { name: 'EV ' + t('nav.items.portfolio', 'Portfólió'), path: `${prefix}/eaisybooks?tab=ev`, icon: PiggyBank },
  ], [t, prefix]);

  const defaultFilteredPages = useMemo(() => {
    return cmdQuery 
      ? defaultCmdPages.filter(p => p.name.toLowerCase().includes(cmdQuery.toLowerCase())) 
      : defaultCmdPages;
  }, [cmdQuery, defaultCmdPages]);

  const defaultFilteredClients = useMemo(() => {
    return cmdQuery && shell?.allClients 
      ? shell.allClients.filter(c => c.name.toLowerCase().includes(cmdQuery.toLowerCase())).slice(0, 5) 
      : [];
  }, [cmdQuery, shell?.allClients]);

  const filteredPages = props.filteredPages ?? defaultFilteredPages;
  const filteredClients = props.filteredClients ?? defaultFilteredClients;

  const [selectedIndex, setSelectedIndex] = useState(0);

  // Combine items to enable unified keyboard index tracking
  const combinedItems = useMemo(() => {
    const items: Array<{ name: string; path?: string; id?: string; companyId?: string; type: 'page' | 'client'; icon?: any; taxNumber?: string }> = [];
    filteredPages.forEach(p => {
      items.push({ name: p.name, path: p.path, type: 'page', icon: p.icon });
    });
    filteredClients.forEach(c => {
      items.push({ name: c.name, id: c.id, companyId: c.companyId, type: 'client', taxNumber: c.taxNumber });
    });
    return items;
  }, [filteredPages, filteredClients]);

  // Reset selectedIndex whenever the search query or items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [combinedItems]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setCmdOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(1, combinedItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + combinedItems.length) % Math.max(1, combinedItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = combinedItems[selectedIndex];
      if (selected) {
        if (selected.type === 'page' && selected.path) {
          navigate(selected.path);
        } else if (selected.type === 'client') {
          const clientId = selected.companyId || selected.id;
          if (clientId) {
            const dateRange = shell?.currentDateRange || '2026-01-01_2026-12-31';
            navigate(`${prefix}/eaisybooks/${clientId}/${dateRange}/overview`);
          }
        }
        setCmdOpen(false);
        setCmdQuery('');
      }
    }
  };

  return (
    <Dialog open={cmdOpen} onOpenChange={(v) => { setCmdOpen(v); if (!v) setCmdQuery(''); }}>
      <DialogContent className="sm:max-w-[480px] p-0 gap-0 overflow-hidden [&>button]:hidden bg-background/80 dark:bg-background/80 backdrop-blur-md border border-border shadow-2xl">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            autoFocus
            placeholder={t('command_palette.placeholder', 'Keresés oldal vagy ügyfél...')}
            value={cmdQuery}
            onChange={(e) => setCmdQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground text-foreground"
            onKeyDown={handleKeyDown}
          />
          <button
            onClick={() => { setCmdOpen(false); setCmdQuery(''); }}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="max-h-[320px] overflow-y-auto p-2">
          {filteredPages.length > 0 && (
            <div className="mb-2">
              <p className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t('command_palette.groups.navigation', 'Oldalak')}</p>
              {filteredPages.map((p, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={p.path}
                    onClick={() => { navigate(p.path); setCmdOpen(false); setCmdQuery(''); }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-all duration-150 text-left",
                      isSelected
                        ? "bg-primary text-primary-foreground font-semibold shadow-sm scale-[1.01]"
                        : "hover:bg-accent text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <p.icon className={cn("w-4 h-4 shrink-0", isSelected ? "text-primary-foreground" : "text-muted-foreground")} />
                      <span>{p.name}</span>
                    </div>
                    {isSelected && <span className="text-[10px] opacity-75 font-mono">↵</span>}
                  </button>
                );
              })}
            </div>
          )}
          {filteredClients.length > 0 && (
            <div>
              <p className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t('command_palette.groups.clients', 'Ügyfelek')}</p>
              {filteredClients.map((c, idx) => {
                const globalIdx = filteredPages.length + idx;
                const isSelected = globalIdx === selectedIndex;
                const clientId = c.companyId || c.id;
                return (
                  <button
                    key={clientId}
                    onClick={() => { 
                      navigate(`${prefix}/eaisybooks/${clientId}/${shell?.currentDateRange || '2026-01-01_2026-12-31'}/overview`); 
                      setCmdOpen(false); 
                      setCmdQuery(''); 
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-all duration-150 text-left",
                      isSelected
                        ? "bg-primary text-primary-foreground font-semibold shadow-sm scale-[1.01]"
                        : "hover:bg-accent text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Briefcase className={cn("w-4 h-4 shrink-0", isSelected ? "text-primary-foreground" : "text-primary")} />
                      <div>
                        <span>{c.name}</span>
                        <span className={cn("text-xs ml-2", isSelected ? "text-primary-foreground/75" : "text-muted-foreground")}>{c.taxNumber}</span>
                      </div>
                    </div>
                    {isSelected && <span className="text-[10px] opacity-75 font-mono">↵</span>}
                  </button>
                );
              })}
            </div>
          )}
          {filteredPages.length === 0 && filteredClients.length === 0 && cmdQuery && (
            <div className="py-8 text-center text-muted-foreground text-sm">
              {t('command_palette.no_results', 'Nincs találat.')}
            </div>
          )}
        </div>
        {combinedItems.length > 0 && (
          <div className="border-t border-border px-4 py-2 bg-muted/40 dark:bg-muted/10 flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="px-1.5 py-0.5 bg-card border border-border rounded font-mono shadow-sm">↑↓</span> {t('command_palette.hints.navigate', 'navigálás')}
            </span>
            <span className="flex items-center gap-1">
              <span className="px-1.5 py-0.5 bg-card border border-border rounded font-mono shadow-sm">Enter</span> {t('command_palette.hints.select', 'kiválasztás')}
            </span>
            <span className="flex items-center gap-1">
              <span className="px-1.5 py-0.5 bg-card border border-border rounded font-mono shadow-sm">Esc</span> {t('command_palette.hints.close', 'bezárás')}
            </span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
