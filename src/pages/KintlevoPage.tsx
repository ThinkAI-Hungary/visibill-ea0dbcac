import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Mail, AlertTriangle, Clock, CheckCircle2, Skull,
  ChevronDown, ChevronUp, Send, Search, Building2
} from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { hu } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

type AgingCategory = 'green' | 'yellow' | 'red' | 'purple';

interface UnifiedInvoice {
  id: string;
  invoiceNumber: string;
  issueDate: string | null;
  dueDate: string;          // resolved due date
  amount: number;
  currency: string;
  companyName: string;
  taxNumber: string | null;
  source: 'nav' | 'manual';
  attachmentUrl: string | null;
  daysOverdue: number;
  category: AgingCategory;
}

interface CompanyGroup {
  companyName: string;
  taxNumber: string | null;
  partnerId: string | null;
  partnerEmail: string | null;
  invoices: UnifiedInvoice[];
  totalAmount: number;
  worstCategory: AgingCategory;
  lastSent: string | null;   // ISO timestamp
}

// ─── Config ──────────────────────────────────────────────────────────────────

const CATEGORY_ORDER: AgingCategory[] = ['green', 'yellow', 'red', 'purple'];

const CAT = {
  green: {
    label: 'Nem lejárt',
    rowBg: 'bg-emerald-500/5',
    border: 'border-emerald-500/25',
    text: 'text-emerald-400',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    card: 'bg-emerald-500/5 border-emerald-500/20',
    icon: CheckCircle2,
  },
  yellow: {
    label: '1–30 napos',
    rowBg: 'bg-amber-500/5',
    border: 'border-amber-500/25',
    text: 'text-amber-400',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    card: 'bg-amber-500/5 border-amber-500/20',
    icon: Clock,
  },
  red: {
    label: '31–180 napos',
    rowBg: 'bg-red-500/5',
    border: 'border-red-500/25',
    text: 'text-red-400',
    badge: 'bg-red-500/15 text-red-300 border-red-500/30',
    card: 'bg-red-500/5 border-red-500/20',
    icon: AlertTriangle,
  },
  purple: {
    label: '180+ napos',
    rowBg: 'bg-purple-500/5',
    border: 'border-purple-500/25',
    text: 'text-purple-400',
    badge: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    card: 'bg-purple-500/5 border-purple-500/20',
    icon: Skull,
  },
} satisfies Record<AgingCategory, {
  label: string; rowBg: string; border: string;
  text: string; badge: string; card: string; icon: React.ComponentType<any>;
}>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCategory(daysOverdue: number): AgingCategory {
  if (daysOverdue <= 0) return 'green';
  if (daysOverdue <= 30) return 'yellow';
  if (daysOverdue <= 180) return 'red';
  return 'purple';
}

function worstOf(invoices: UnifiedInvoice[]): AgingCategory {
  let worst: AgingCategory = 'green';
  for (const inv of invoices) {
    if (CATEGORY_ORDER.indexOf(inv.category) > CATEGORY_ORDER.indexOf(worst)) {
      worst = inv.category;
    }
  }
  return worst;
}

function fmt(n: number): string {
  return new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 0 }).format(n) + ' Ft';
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function KintlevoPage() {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCats, setSelectedCats] = useState<Set<AgingCategory>>(
    new Set(['yellow', 'red', 'purple'])
  );
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const [emailMap, setEmailMap] = useState<Record<string, string>>({});
  const [emailErrors, setEmailErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: navInvoices = [], isLoading: loadingNav } = useQuery({
    queryKey: ['kintlevo-nav', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase
        .from('nav_invoices')
        .select('id,invoice_number,invoice_issue_date,payment_date,customer_name,customer_tax_number,invoice_gross_amount,currency,transaction_id')
        .eq('company_id', selectedCompany.id)
        .eq('invoice_direction', 'OUTBOUND')
        .is('transaction_id', null);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id && !!selectedCompany?.id,
  });

  const { data: manualInvoices = [], isLoading: loadingManual } = useQuery({
    queryKey: ['kintlevo-manual', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase
        .from('invoices')
        .select('id,bizonylatsorszam,kibocsatas_datuma,fizetesi_hatarido,vevo_nev,vevo_vat_id,brutto_vegosszeg,penznem,fizetve,melleklet_url')
        .eq('company_id', selectedCompany.id)
        .eq('invoice_direction', 'OUTBOUND')
        .or('fizetve.is.null,fizetve.eq.false');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id && !!selectedCompany?.id,
  });

  const { data: partners = [] } = useQuery({
    queryKey: ['partners', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase
        .from('partners')
        .select('id,name,tax_number,email')
        .eq('company_id', selectedCompany.id);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id && !!selectedCompany?.id,
  });

  const { data: dunningSends = [] } = useQuery({
    queryKey: ['dunning-sends', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase
        .from('dunning_sends')
        .select('id,debtor_company_name,sent_at')
        .eq('company_id', selectedCompany.id)
        .order('sent_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id && !!selectedCompany?.id,
  });

  // Update partner email mutation
  const updatePartnerEmail = useMutation({
    mutationFn: async ({ partnerId, email }: { partnerId: string; email: string }) => {
      const { error } = await supabase
        .from('partners')
        .update({ email })
        .eq('id', partnerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partners'] });
    },
  });

  // ── Data processing ─────────────────────────────────────────────────────────

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const allInvoices = useMemo((): UnifiedInvoice[] => {
    const result: UnifiedInvoice[] = [];

    // NAV invoices
    for (const inv of navInvoices) {
      let dueDate: Date;
      if (inv.payment_date) {
        dueDate = parseISO(inv.payment_date);
      } else if (inv.invoice_issue_date) {
        dueDate = parseISO(inv.invoice_issue_date);
        dueDate.setDate(dueDate.getDate() + 30);
      } else {
        dueDate = new Date(today);
      }
      dueDate.setHours(0, 0, 0, 0);
      const daysOverdue = differenceInDays(today, dueDate);
      result.push({
        id: inv.id,
        invoiceNumber: inv.invoice_number,
        issueDate: inv.invoice_issue_date,
        dueDate: format(dueDate, 'yyyy-MM-dd'),
        amount: inv.invoice_gross_amount ?? 0,
        currency: inv.currency ?? 'HUF',
        companyName: inv.customer_name ?? 'Ismeretlen partner',
        taxNumber: inv.customer_tax_number,
        source: 'nav',
        attachmentUrl: null,
        daysOverdue,
        category: getCategory(daysOverdue),
      });
    }

    // Manual invoices
    for (const inv of manualInvoices) {
      let dueDate: Date;
      if (inv.fizetesi_hatarido) {
        dueDate = parseISO(inv.fizetesi_hatarido);
      } else if (inv.kibocsatas_datuma) {
        dueDate = parseISO(inv.kibocsatas_datuma);
        dueDate.setDate(dueDate.getDate() + 30);
      } else {
        dueDate = new Date(today);
      }
      dueDate.setHours(0, 0, 0, 0);
      const daysOverdue = differenceInDays(today, dueDate);
      result.push({
        id: inv.id,
        invoiceNumber: inv.bizonylatsorszam,
        issueDate: inv.kibocsatas_datuma,
        dueDate: format(dueDate, 'yyyy-MM-dd'),
        amount: inv.brutto_vegosszeg ?? 0,
        currency: inv.penznem ?? 'HUF',
        companyName: inv.vevo_nev ?? 'Ismeretlen partner',
        taxNumber: inv.vevo_vat_id,
        source: 'manual',
        attachmentUrl: inv.melleklet_url ?? null,
        daysOverdue,
        category: getCategory(daysOverdue),
      });
    }

    return result;
  }, [navInvoices, manualInvoices, today]);

  // Group by company
  const companyGroups = useMemo((): CompanyGroup[] => {
    const map = new Map<string, UnifiedInvoice[]>();
    for (const inv of allInvoices) {
      if (!map.has(inv.companyName)) map.set(inv.companyName, []);
      map.get(inv.companyName)!.push(inv);
    }

    const groups: CompanyGroup[] = [];
    map.forEach((invs, companyName) => {
      const sorted = [...invs].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      const taxNumber = invs[0]?.taxNumber ?? null;

      // Find matching partner by tax_number or name
      const partner = partners.find(p =>
        (taxNumber && p.tax_number === taxNumber) ||
        p.name.toLowerCase() === companyName.toLowerCase()
      ) ?? null;

      // Last dunning send for this company
      const lastSendRecord = dunningSends.find(d => d.debtor_company_name === companyName);

      groups.push({
        companyName,
        taxNumber,
        partnerId: partner?.id ?? null,
        partnerEmail: partner?.email ?? null,
        invoices: sorted,
        totalAmount: invs.reduce((s, i) => s + i.amount, 0),
        worstCategory: worstOf(sorted),
        lastSent: lastSendRecord?.sent_at ?? null,
      });
    });

    return groups.sort((a, b) => a.companyName.localeCompare(b.companyName, 'hu'));
  }, [allInvoices, partners, dunningSends]);

  const filteredGroups = useMemo(() =>
    search.trim()
      ? companyGroups.filter(g => g.companyName.toLowerCase().includes(search.toLowerCase()))
      : companyGroups,
    [companyGroups, search]
  );

  // Summary totals
  const totals = useMemo(() => {
    const t: Record<AgingCategory, number> = { green: 0, yellow: 0, red: 0, purple: 0 };
    for (const inv of allInvoices) t[inv.category] += inv.amount;
    return t;
  }, [allInvoices]);

  const grandTotal = useMemo(() => Object.values(totals).reduce((a, b) => a + b, 0), [totals]);

  // ── Dialog logic ───────────────────────────────────────────────────────────

  const openDialog = () => {
    // Pre-select companies matching active categories
    const keys = new Set<string>();
    const emails: Record<string, string> = {};
    for (const g of companyGroups) {
      if (selectedCats.has(g.worstCategory)) keys.add(g.companyName);
      emails[g.companyName] = g.partnerEmail ?? '';
    }
    setSelectedCompanies(keys);
    setEmailMap(emails);
    setEmailErrors({});
    setDialogOpen(true);
  };

  const toggleCat = (cat: AgingCategory) => {
    setSelectedCats(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      // Sync company selection
      const keys = new Set<string>();
      for (const g of companyGroups) {
        if (next.has(g.worstCategory)) keys.add(g.companyName);
      }
      setSelectedCompanies(keys);
      return next;
    });
  };

  const toggleCompanySelect = (name: string) => {
    setSelectedCompanies(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const handleSend = async () => {
    const targets = companyGroups.filter(g => selectedCompanies.has(g.companyName));
    if (targets.length === 0) { toast.error('Nincs kiválasztott cég'); return; }

    // Validate emails
    const errors: Record<string, string> = {};
    for (const t of targets) {
      const email = (emailMap[t.companyName] ?? '').trim();
      if (!email) errors[t.companyName] = 'Email-cím megadása kötelező';
      else if (!validateEmail(email)) errors[t.companyName] = 'Érvénytelen email-cím';
    }
    if (Object.keys(errors).length > 0) { setEmailErrors(errors); return; }

    setSending(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Nincs munkamenet');

      for (const target of targets) {
        const email = emailMap[target.companyName].trim();
        try {
          // Save email back to partners table if changed
          if (target.partnerId && email !== (target.partnerEmail ?? '')) {
            await updatePartnerEmail.mutateAsync({ partnerId: target.partnerId, email });
          }

          const { error } = await supabase.functions.invoke('send-dunning-email', {
            body: {
              companyId: selectedCompany!.id,
              senderCompanyName: selectedCompany!.name,
              debtorCompanyName: target.companyName,
              debtorTaxNumber: target.taxNumber,
              debtorEmail: email,
              invoices: target.invoices.map(inv => ({
                id: inv.id,
                invoiceNumber: inv.invoiceNumber,
                issueDate: inv.issueDate,
                dueDate: inv.dueDate,
                amount: inv.amount,
                currency: inv.currency,
                daysOverdue: inv.daysOverdue,
                category: inv.category,
                source: inv.source,
                attachmentUrl: inv.source === 'manual' ? inv.attachmentUrl : null,
              })),
              totalAmount: target.totalAmount,
              worstCategory: target.worstCategory,
            },
          });
          if (error) throw error;
          successCount++;
        } catch (err: any) {
          console.error('Dunning send error for', target.companyName, err);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} felszólítás sikeresen elküldve!`);
        queryClient.invalidateQueries({ queryKey: ['dunning-sends'] });
      }
      if (errorCount > 0) toast.error(`${errorCount} levél küldése sikertelen`);
      if (successCount > 0) setDialogOpen(false);
    } catch (err: any) {
      toast.error('Hiba: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const isLoading = loadingNav || loadingManual;
  if (isLoading) return <LoadingSpinner message="Kintlévőségek betöltése..." />;

  return (
    <TooltipProvider>
      <div className="h-full space-y-4 px-4 pt-4 pb-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Kintlévőség</h1>
            <p className="text-muted-foreground text-sm">
              Kifizetetlen kimenő számlák cégenként csoportosítva
            </p>
          </div>
          <Button size="lg" className="gap-2 shrink-0" onClick={openDialog}>
            <Mail className="h-4 w-4" />
            Felszólítás küldése
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Card className="col-span-2 lg:col-span-1">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Összes kintlévőség</p>
              <p className="text-xl font-bold">{fmt(grandTotal)}</p>
              <p className="text-xs text-muted-foreground">{companyGroups.length} cég · {allInvoices.length} számla</p>
            </CardContent>
          </Card>
          {(Object.keys(CAT) as AgingCategory[]).map(cat => {
            const c = CAT[cat];
            const Icon = c.icon;
            const invCount = allInvoices.filter(i => i.category === cat).length;
            return (
              <Card key={cat} className={cn('border', c.card)}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Icon className={cn('h-3.5 w-3.5', c.text)} />
                    <p className={cn('text-xs font-medium uppercase tracking-wide', c.text)}>{c.label}</p>
                  </div>
                  <p className={cn('text-xl font-bold', c.text)}>{fmt(totals[cat])}</p>
                  <p className="text-xs text-muted-foreground">{invCount} számla</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cég neve..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Company list */}
        {filteredGroups.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-500/30" />
            <p className="text-lg font-medium">Nincs kintlévőség</p>
            <p className="text-sm">Minden számla ki van egyenlítve!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredGroups.map(group => {
              const c = CAT[group.worstCategory];
              const Icon = c.icon;
              const isOpen = expanded.has(group.companyName);
              const daysSince = group.lastSent
                ? differenceInDays(new Date(), parseISO(group.lastSent))
                : null;

              return (
                <div key={group.companyName} className={cn('rounded-lg border overflow-hidden', c.border, c.rowBg)}>
                  {/* Company header row */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:brightness-110 transition-all select-none"
                    onClick={() => setExpanded(prev => {
                      const n = new Set(prev);
                      n.has(group.companyName) ? n.delete(group.companyName) : n.add(group.companyName);
                      return n;
                    })}
                  >
                    {/* Avatar */}
                    <div className={cn('h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold border', c.border, c.rowBg, c.text)}>
                      {group.companyName.slice(0, 2).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold truncate text-sm">{group.companyName}</span>
                        {group.taxNumber && (
                          <span className="text-xs text-muted-foreground hidden sm:inline shrink-0">{group.taxNumber}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        <span>{group.invoices.length} számla</span>
                        <span>·</span>
                        <span className={c.text}>{c.label}</span>
                      </div>
                    </div>

                    {/* Right side */}
                    <div className="shrink-0 flex items-center gap-3">
                      {daysSince !== null && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
                              <Mail className="h-3 w-3" />
                              <span>{daysSince === 0 ? 'Ma' : `${daysSince} napja`}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            Utolsó felszólítás: {format(parseISO(group.lastSent!), 'yyyy. MMM d.', { locale: hu })}
                          </TooltipContent>
                        </Tooltip>
                      )}
                      <span className="font-bold text-sm">{fmt(group.totalAmount)}</span>
                      {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {/* Invoice table */}
                  {isOpen && (
                    <div className="border-t border-current/10 bg-background/50">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent border-current/10">
                            <TableHead className="pl-4 text-xs w-[25%]">Számlaszám</TableHead>
                            <TableHead className="text-xs w-[15%]">Kiállítva</TableHead>
                            <TableHead className="text-xs w-[15%]">Lejárat</TableHead>
                            <TableHead className="text-xs w-[12%]">Késés</TableHead>
                            <TableHead className="text-right text-xs w-[18%]">Összeg</TableHead>
                            <TableHead className="text-xs w-[10%]">Forrás</TableHead>
                            <TableHead className="text-xs w-[15%]">Kategória</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.invoices.map(inv => {
                            const ic = CAT[inv.category];
                            const IIcon = ic.icon;
                            return (
                              <TableRow key={inv.id} className={cn('border-current/5', ic.rowBg)}>
                                <TableCell className="pl-4 font-mono text-xs">{inv.invoiceNumber}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {inv.issueDate ? format(parseISO(inv.issueDate), 'yyyy.MM.dd') : '—'}
                                </TableCell>
                                <TableCell className="text-xs">{inv.dueDate.replace(/-/g, '.')}</TableCell>
                                <TableCell className="text-xs">
                                  {inv.daysOverdue <= 0
                                    ? <span className="text-emerald-400">Nem lejárt</span>
                                    : <span className={ic.text}>{inv.daysOverdue} nap</span>
                                  }
                                </TableCell>
                                <TableCell className="text-right text-sm font-medium">
                                  {fmt(inv.amount)}
                                </TableCell>
                                <TableCell>
                                  <span className="text-xs text-muted-foreground">
                                    {inv.source === 'nav' ? 'NAV' : 'Feltöltött'}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={cn('text-xs gap-1', ic.badge)}>
                                    <IIcon className="h-3 w-3" />
                                    {ic.label}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Send Dialog ─────────────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Felszólítólevelek küldése
            </DialogTitle>
            <DialogDescription>
              Minden kijelölt cégnek <strong>egyetlen levelet</strong> küldünk az összes tartozó számlájával.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-1">
            {/* Category toggles */}
            <div>
              <p className="text-sm font-medium mb-2">Kategória szűrő:</p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(CAT) as AgingCategory[]).map(cat => {
                  const c = CAT[cat];
                  const Icon = c.icon;
                  const active = selectedCats.has(cat);
                  return (
                    <button
                      key={cat}
                      onClick={() => toggleCat(cat)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                        active ? c.badge : 'border-border text-muted-foreground hover:bg-muted'
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Company list with email */}
            <div>
              <p className="text-sm font-medium mb-2">
                Cégek ({selectedCompanies.size} kijelölve):
              </p>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {companyGroups.map(g => {
                  const c = CAT[g.worstCategory];
                  const Icon = c.icon;
                  const isSel = selectedCompanies.has(g.companyName);
                  const emailVal = emailMap[g.companyName] ?? '';
                  const emailErr = emailErrors[g.companyName];

                  return (
                    <div
                      key={g.companyName}
                      className={cn(
                        'p-3 rounded-lg border transition-all',
                        isSel ? cn(c.rowBg, c.border) : 'border-border bg-muted/10 opacity-50'
                      )}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <Checkbox
                          id={`chk-${g.companyName}`}
                          checked={isSel}
                          onCheckedChange={() => toggleCompanySelect(g.companyName)}
                        />
                        <Icon className={cn('h-3.5 w-3.5 shrink-0', c.text)} />
                        <Label
                          htmlFor={`chk-${g.companyName}`}
                          className="flex-1 font-medium text-sm cursor-pointer truncate"
                        >
                          {g.companyName}
                        </Label>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {fmt(g.totalAmount)} · {g.invoices.length} db
                        </span>
                      </div>
                      {isSel && (
                        <div className="pl-7">
                          <Input
                            type="email"
                            placeholder={g.partnerEmail ? g.partnerEmail : 'partner@example.com'}
                            value={emailVal}
                            onChange={e => {
                              setEmailMap(prev => ({ ...prev, [g.companyName]: e.target.value }));
                              if (emailErrors[g.companyName]) {
                                setEmailErrors(prev => { const n = { ...prev }; delete n[g.companyName]; return n; });
                              }
                            }}
                            className={cn('h-7 text-xs', emailErr ? 'border-destructive' : '')}
                          />
                          {emailErr && <p className="text-xs text-destructive mt-1">{emailErr}</p>}
                          {!g.partnerEmail && (
                            <p className="text-xs text-amber-400 mt-1">
                              ⚠️ Nincs mentett email — ha megad egyet, elmentjük a Partnertörzsbe
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Info */}
            <div className="rounded-lg bg-muted/30 border p-3 text-xs text-muted-foreground space-y-1">
              <p>📧 A levelek a <strong>Visibill rendszeréből</strong> mennek ki — a partner Önnek tud visszaírni.</p>
              <p>📎 Manuálisan feltöltött számlákhoz PDF melléklet is kerül a levélbe.</p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={sending}>
              Mégse
            </Button>
            <Button onClick={handleSend} disabled={sending || selectedCompanies.size === 0} className="gap-2">
              {sending ? 'Küldés...' : (
                <><Send className="h-4 w-4" />{selectedCompanies.size} felszólítás küldése</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
