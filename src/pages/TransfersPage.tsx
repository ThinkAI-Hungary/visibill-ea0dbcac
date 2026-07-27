import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { reportError } from '@/lib/errorReporter';
import {
  Landmark,
  Search,
  Filter,
  Download,
  AlertTriangle,
  ArrowRight,
  Info,
  Calendar,
  CheckCircle2,
  FileText,
  User,
  CreditCard,
  Building,
  HelpCircle,
  History,
  Trash2
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { CopyableCell } from '@/components/ui/copyable-cell';
import { UnifiedPagination } from '@/components/ui/unified-pagination';


interface TransferInvoice {
  id: string;
  source: 'manual' | 'nav';
  invoice_number: string;
  partner_name: string;
  partner_tax_number?: string;
  due_date: string;
  amount: number;
  currency: string;
  partner_bank_account: string;
}

interface CompanyBankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  currency: string;
}

export default function TransfersPage() {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const { companyId, dateRange } = useParams<{ companyId: string; dateRange: string }>();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'overdue' | 'due_today'>('all');
  const [groupByPartner, setGroupByPartner] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingBankAccounts, setEditingBankAccounts] = useState<Record<string, string>>({});

  // Export Wizard Dialog State
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [senderAccountId, setSenderAccountId] = useState<string>('');
  const [exportFormat, setExportFormat] = useState<string>('otp');
  const [exporting, setExporting] = useState(false);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<string[]>([]);

  // Pagination State
  const [activePage, setActivePage] = useState(1);
  const [activePageSize, setActivePageSize] = useState(50);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(50);


  // 1. Fetch own bank accounts
  const { data: bankAccounts = [], refetch: refetchBankAccounts } = useQuery<CompanyBankAccount[]>({
    queryKey: ['company-bank-accounts', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany) return [];
      const { data, error } = await supabase
        .from('company_bank_accounts')
        .select('id, bank_name, account_number, currency')
        .eq('company_id', selectedCompany.id);
      if (error) throw error;
      return data as CompanyBankAccount[];
    },
    enabled: !!selectedCompany
  });

  const displayBankAccounts = useMemo(() => {
    if (bankAccounts.length > 0) return bankAccounts;
    return [{
      id: 'dummy-test-id',
      bank_name: 'Minta Céges Bankszámla (Teszt)',
      account_number: '11773000-11111111-22222222',
      currency: 'HUF'
    }];
  }, [bankAccounts]);

  // 2. Fetch unpaid inbound manual invoices + inbound NAV invoices
  const { data: invoices = [], isLoading, refetch: refetchInvoices } = useQuery<TransferInvoice[]>({
    queryKey: ['due-transfer-invoices', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany) return [];

      const today = new Date().toISOString().split('T')[0];

      // Fetch manual inbound invoices
      const { data: manualData, error: manualErr } = await supabase
        .from('invoices')
        .select('id, bizonylatsorszam, elado_nev, elado_vat_id, fizetesi_hatarido, brutto_vegosszeg, penznem, bankszamlaszam_iban, fizetesi_mod, reference_number, elolegszamla_hivatkozas')
        .eq('company_id', selectedCompany.id)
        .eq('invoice_direction', 'INBOUND')
        .is('transaction_id', null)
        .eq('fizetve', false);

      if (manualErr) throw manualErr;

      // Fetch NAV inbound invoices
      const { data: navData, error: navErr } = await supabase
        .from('nav_invoices')
        .select('id, invoice_number, supplier_name, supplier_tax_number, payment_date, invoice_gross_amount, currency, transaction_id, paid, payment_method')
        .eq('company_id', selectedCompany.id)
        .eq('invoice_direction', 'INBOUND')
        .is('transaction_id', null)
        .eq('paid', false);

      if (navErr) throw navErr;

      // Fetch all historic manual invoices for this company
      const { data: historicInvoices } = await supabase
        .from('invoices')
        .select('id, elado_nev, elado_vat_id, bankszamlaszam_iban, bizonylatsorszam, fizetve, transaction_id, fizetesi_mod, reference_number, elolegszamla_hivatkozas')
        .eq('company_id', selectedCompany.id)
        .eq('invoice_direction', 'INBOUND');

      // Fetch all historic NAV invoices for this company
      const { data: historicNavInvoices } = await supabase
        .from('nav_invoices')
        .select('id, supplier_name, supplier_tax_number, invoice_number, paid, payment_method, transaction_id')
        .eq('company_id', selectedCompany.id)
        .eq('invoice_direction', 'INBOUND');

      // Fetch all transactions with a matched invoice to extract bank accounts from description
      const { data: matchedTxs, error: txErr } = await supabase
        .from('transactions')
        .select('description, matched_invoice_id')
        .eq('company_id', selectedCompany.id)
        .not('matched_invoice_id', 'is', null);

      if (txErr) console.error("Error fetching matched transactions:", txErr);

      // Build invoice-to-partner lookup mapping
      const invoicePartnerMap: Record<string, { name: string; tax_number?: string }> = {};
      (historicInvoices || []).forEach(inv => {
        invoicePartnerMap[inv.id] = {
          name: inv.elado_nev || '',
          tax_number: inv.elado_vat_id || undefined
        };
      });
      (historicNavInvoices || []).forEach(inv => {
        invoicePartnerMap[inv.id] = {
          name: inv.supplier_name || '',
          tax_number: inv.supplier_tax_number || undefined
        };
      });

      // Build lookup map from historic invoices first
      const bankAccountLookupMap: Record<string, string> = {};
      (historicInvoices || []).forEach(inv => {
        if (inv.bankszamlaszam_iban) {
          if (inv.elado_vat_id) {
            bankAccountLookupMap[inv.elado_vat_id] = inv.bankszamlaszam_iban;
          }
          if (inv.elado_nev) {
            bankAccountLookupMap[inv.elado_nev.toLowerCase()] = inv.bankszamlaszam_iban;
          }
        }
      });

      // Regular expressions for bank accounts
      const giroRegex = /\b(\d{8}-\d{8}(?:-\d{8})?)\b/;
      const ibanRegex = /\b([A-Z]{2}\d{2}[A-Z0-9]{12,30})\b/i;

      // Extract bank accounts from matched transaction descriptions
      (matchedTxs || []).forEach(tx => {
        const partnerInfo = invoicePartnerMap[tx.matched_invoice_id!];
        if (!partnerInfo) return;

        let bankAcc = '';
        if (tx.description) {
          const matchGiro = tx.description.match(giroRegex);
          if (matchGiro) {
            bankAcc = matchGiro[1];
          } else {
            const matchIban = tx.description.match(ibanRegex);
            if (matchIban) {
              bankAcc = matchIban[1];
            }
          }
        }

        if (bankAcc) {
          if (partnerInfo.tax_number) {
            bankAccountLookupMap[partnerInfo.tax_number] = bankAcc;
          }
          if (partnerInfo.name) {
            bankAccountLookupMap[partnerInfo.name.toLowerCase()] = bankAcc;
          }
        }
      });

      // ── ADVANCED PAIRING & STATUS SYNC LOGIC ──
      const normalizeInvNum = (num: string) => (num || '').replace(/[^A-Za-z0-9]/g, '').toLowerCase();

      const matchedInvoiceIds = new Set<string>();
      const submittedIdToTransactionsMap = new Map<string, any[]>();
      (matchedTxs || []).forEach(tx => {
        if (tx.matched_invoice_id) {
          matchedInvoiceIds.add(tx.matched_invoice_id);
          if (!submittedIdToTransactionsMap.has(tx.matched_invoice_id)) {
            submittedIdToTransactionsMap.set(tx.matched_invoice_id, []);
          }
          submittedIdToTransactionsMap.get(tx.matched_invoice_id)!.push(tx);
        }
      });

      const manualByNumber = new Map<string, any[]>();
      const manualById = new Map<string, any>();
      (historicInvoices || []).forEach(inv => {
        manualById.set(inv.id, inv);
        if (inv.bizonylatsorszam) {
          const norm = normalizeInvNum(inv.bizonylatsorszam);
          if (!manualByNumber.has(norm)) manualByNumber.set(norm, []);
          manualByNumber.get(norm)!.push(inv);
        }
      });

      const navByNumber = new Map<string, any[]>();
      (historicNavInvoices || []).forEach(inv => {
        if (inv.invoice_number) {
          const norm = normalizeInvNum(inv.invoice_number);
          if (!navByNumber.has(norm)) navByNumber.set(norm, []);
          navByNumber.get(norm)!.push(inv);
        }
      });

      // Build linked invoices maps for proforma/final chains
      const linkedInvoicesByBizonylat = new Map<string, any[]>();
      const linkedInvoicesByReference = new Map<string, any[]>();
      (historicInvoices || []).forEach(inv => {
        if (inv.bizonylatsorszam) {
          const norm = normalizeInvNum(inv.bizonylatsorszam);
          if (!linkedInvoicesByBizonylat.has(norm)) linkedInvoicesByBizonylat.set(norm, []);
          linkedInvoicesByBizonylat.get(norm)!.push(inv);
        }
        if (inv.reference_number) {
          inv.reference_number.split(',').map((r: string) => normalizeInvNum(r)).forEach((normRef: string) => {
            if (normRef) {
              if (!linkedInvoicesByReference.has(normRef)) linkedInvoicesByReference.set(normRef, []);
              linkedInvoicesByReference.get(normRef)!.push(inv);
            }
          });
        }
        if (inv.elolegszamla_hivatkozas) {
          inv.elolegszamla_hivatkozas.split(',').map((r: string) => normalizeInvNum(r)).forEach((normRef: string) => {
            if (normRef) {
              if (!linkedInvoicesByReference.has(normRef)) linkedInvoicesByReference.set(normRef, []);
              linkedInvoicesByReference.get(normRef)!.push(inv);
            }
          });
        }
      });

      // Recursive helper to get all linked manual invoices
      const getLinkedInvoices = (invoice: any): any[] => {
        const linked: any[] = [];
        const visited = new Set([invoice.id]);
        
        const getParentRefs = (inv: any): string[] => {
          const refs: string[] = [];
          if (inv.reference_number) {
            inv.reference_number.split(',').map((r: string) => r.trim()).filter(Boolean).forEach((r: string) => refs.push(r));
          }
          if (inv.elolegszamla_hivatkozas) {
            inv.elolegszamla_hivatkozas.split(',').map((r: string) => r.trim()).filter(Boolean).forEach((r: string) => refs.push(r));
          }
          return refs;
        };

        const parentQueue = getParentRefs(invoice);
        while (parentQueue.length > 0) {
          const ref = parentQueue.shift();
          if (!ref) continue;
          const parents = linkedInvoicesByBizonylat.get(normalizeInvNum(ref)) || [];
          for (const parent of parents) {
            if (visited.has(parent.id)) continue;
            visited.add(parent.id);
            linked.push(parent);
            getParentRefs(parent).forEach(r => parentQueue.push(r));
          }
        }

        const queue = [invoice.bizonylatsorszam];
        while (queue.length > 0) {
          const bizSorszam = queue.shift();
          if (!bizSorszam) continue;
          const children = linkedInvoicesByReference.get(normalizeInvNum(bizSorszam)) || [];
          for (const child of children) {
            if (visited.has(child.id)) continue;
            visited.add(child.id);
            linked.push(child);
            if (child.bizonylatsorszam) queue.push(child.bizonylatsorszam);
          }
        }
        return linked;
      };

      // Helper to check if a specific manual/NAV invoice is paid
      const isInvoicePaid = (inv: any, isNav: boolean): boolean => {
        if (isNav) {
          const directlyMatched = matchedInvoiceIds.has(inv.id);
          const submittedMatches = manualByNumber.get(normalizeInvNum(inv.invoice_number)) || [];
          const indirectlyMatched = submittedMatches.some(sub => submittedIdToTransactionsMap.has(sub.id));
          const linkedChainMatched = !indirectlyMatched && submittedMatches.some(sub => {
            const linked = getLinkedInvoices(sub);
            return linked.some(l => submittedIdToTransactionsMap.has(l.id));
          });
          return inv.paid === true || !!inv.transaction_id || directlyMatched || indirectlyMatched || linkedChainMatched;
        } else {
          // Manual invoice
          const directlyMatched = matchedInvoiceIds.has(inv.id);
          const hasLinkedTx = getLinkedInvoices(inv).some(l => submittedIdToTransactionsMap.has(l.id));
          let hasPaidNav = false;
          if (inv.bizonylatsorszam) {
            const navMatches = navByNumber.get(normalizeInvNum(inv.bizonylatsorszam)) || [];
            hasPaidNav = navMatches.some(nav => nav.paid === true || !!nav.transaction_id || matchedInvoiceIds.has(nav.id));
          }
          return inv.fizetve === true || !!inv.transaction_id || directlyMatched || hasLinkedTx || hasPaidNav;
        }
      };

      // 2. Filter out already paid invoices
      const unpaidManual = (manualData || []).filter(inv => !isInvoicePaid(inv, false));
      const unpaidNav = (navData || []).filter(inv => !isInvoicePaid(inv, true));

      // 3. Filter out non-transfer payment methods (bankkártya, készpénz, etc.)
      const isTransferPaymentMethod = (pm: string | null | undefined): boolean => {
        if (!pm) return true; // default to transfer if not specified
        const clean = pm.toLowerCase().trim();
        if (
          clean.includes('kártya') || clean.includes('card') || 
          clean.includes('készpénz') || clean.includes('cash') || 
          clean.includes('payu') || clean.includes('revolut') || 
          clean.includes('paypal') || clean.includes('barion')
        ) {
          return false;
        }
        return true;
      };

      const transferManual = unpaidManual.filter(inv => isTransferPaymentMethod(inv.fizetesi_mod));
      const transferNav = unpaidNav.filter(inv => {
        const pm = inv.payment_method;
        if (!pm) return true;
        const clean = pm.toUpperCase().trim();
        if (clean === 'CASH' || clean === 'CARD' || clean === 'VOUCHER') return false;
        return true;
      });

      // 4. Map to TransferInvoice structures
      const manualTransfers: TransferInvoice[] = transferManual.map(inv => {
        const resolvedAccount = inv.bankszamlaszam_iban || 
          (inv.elado_vat_id ? bankAccountLookupMap[inv.elado_vat_id] : '') || 
          (inv.elado_nev ? bankAccountLookupMap[inv.elado_nev.toLowerCase()] : '') || '';

        return {
          id: inv.id,
          source: 'manual',
          invoice_number: inv.bizonylatsorszam || '',
          partner_name: inv.elado_nev || 'Ismeretlen partner',
          partner_tax_number: inv.elado_vat_id || undefined,
          due_date: inv.fizetesi_hatarido ? new Date(inv.fizetesi_hatarido).toISOString().split('T')[0] : today,
          amount: inv.brutto_vegosszeg || 0,
          currency: inv.penznem || 'HUF',
          partner_bank_account: resolvedAccount
        };
      });

      const navTransfers: TransferInvoice[] = transferNav.map(inv => {
        const taxNumber = inv.supplier_tax_number || '';
        const resolvedAccount = (taxNumber ? bankAccountLookupMap[taxNumber] : '') || 
          (inv.supplier_name ? bankAccountLookupMap[inv.supplier_name.toLowerCase()] : '') || '';

        return {
          id: inv.id,
          source: 'nav',
          invoice_number: inv.invoice_number || '',
          partner_name: inv.supplier_name || 'Ismeretlen partner',
          partner_tax_number: taxNumber || undefined,
          due_date: inv.payment_date ? new Date(inv.payment_date).toISOString().split('T')[0] : today,
          amount: inv.invoice_gross_amount || 0,
          currency: inv.currency || 'HUF',
          partner_bank_account: resolvedAccount
        };
      });

      // 5. Combine and Deduplicate by normalized invoice number
      const combinedTransfers = [...manualTransfers, ...navTransfers];
      const seenInvoiceNumbers = new Set<string>();
      const deduplicatedTransfers: TransferInvoice[] = [];

      combinedTransfers.sort((a, b) => {
        if (a.source === b.source) return 0;
        return a.source === 'manual' ? -1 : 1;
      });

      combinedTransfers.forEach(inv => {
        const norm = normalizeInvNum(inv.invoice_number);
        if (!seenInvoiceNumbers.has(norm)) {
          seenInvoiceNumbers.add(norm);
          deduplicatedTransfers.push(inv);
        }
      });

      // Filter only due today or overdue
      const allTransfers = [...manualTransfers, ...navTransfers];
      return deduplicatedTransfers.filter(t => t.due_date <= today);
    },
    enabled: !!selectedCompany
  });

  // Fetch previous transfers history
  const { data: transferHistory = [], refetch: refetchTransferHistory } = useQuery({
    queryKey: ['payment-transfers-history', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany) return [];
      const { data, error } = await supabase
        .from('payment_transfers')
        .select('id, created_at, partner_name, partner_account, amount, currency, narrative, status, matched_transaction_id, invoice_ids')
        .eq('company_id', selectedCompany.id)
        .order('created_at', { ascending: false });
      if (error) throw error;

      if (!data || data.length === 0) return [];

      // Gather all invoice_ids across all transfers to check their paid status
      const allInvoiceIds = Array.from(
        new Set((data as any[]).flatMap(item => item.invoice_ids || []))
      );

      const paidInvoiceIds = new Set<string>();
      const invoiceIdToTxIdMap = new Map<string, string>();

      if (allInvoiceIds.length > 0) {
        // Fetch manual invoices
        const { data: manualPaid } = await supabase
          .from('invoices')
          .select('id, fizetve, transaction_id')
          .in('id', allInvoiceIds);

        // Fetch NAV invoices
        const { data: navPaid } = await supabase
          .from('nav_invoices')
          .select('id, paid, transaction_id')
          .in('id', allInvoiceIds);

        (manualPaid || []).forEach(inv => {
          if (inv.fizetve || inv.transaction_id) {
            paidInvoiceIds.add(inv.id);
            if (inv.transaction_id) {
              invoiceIdToTxIdMap.set(inv.id, inv.transaction_id);
            }
          }
        });

        (navPaid || []).forEach(inv => {
          if (inv.paid || inv.transaction_id) {
            paidInvoiceIds.add(inv.id);
            if (inv.transaction_id) {
              invoiceIdToTxIdMap.set(inv.id, inv.transaction_id);
            }
          }
        });
      }

      // Map and update status dynamically (Read-Repair)
      const mappedData = data.map((item: any) => {
        const itemInvoiceIds = item.invoice_ids || [];
        if (item.status === 'pending' && itemInvoiceIds.length > 0) {
          const allPaid = itemInvoiceIds.every((id: string) => paidInvoiceIds.has(id));
          if (allPaid) {
            // Find matched transaction ID
            const txId = itemInvoiceIds.map((id: string) => invoiceIdToTxIdMap.get(id)).find(Boolean) || null;

            // Update database asynchronously
            supabase
              .from('payment_transfers')
              .update({ status: 'matched', matched_transaction_id: txId })
              .eq('id', item.id)
              .then(({ error: updateErr }) => {
                if (updateErr) console.error("Error updating payment transfer status:", updateErr);
              });

            return {
              ...item,
              status: 'matched',
              matched_transaction_id: txId
            };
          }
        }
        return item;
      });

      return mappedData;
    },
    enabled: !!selectedCompany
  });

  // Automatically select first sender account if available
  useEffect(() => {
    if (displayBankAccounts.length > 0 && !senderAccountId) {
      setSenderAccountId(displayBankAccounts[0].id);
    }
  }, [displayBankAccounts, senderAccountId]);

  // Handle bank account inline modification
  const handleBankChange = (id: string, value: string) => {
    let formatted = value;
    if (!/^[a-zA-Z]/u.test(value)) {
      const digits = value.replace(/\D/g, '').slice(0, 24);
      if (digits.length <= 8) {
        formatted = digits.length === 8 && value.endsWith('-') ? `${digits}-` : digits;
      } else if (digits.length <= 16) {
        formatted = digits.length === 16 && value.endsWith('-') 
          ? `${digits.slice(0, 8)}-${digits.slice(8)}-` 
          : `${digits.slice(0, 8)}-${digits.slice(8)}`;
      } else {
        formatted = `${digits.slice(0, 8)}-${digits.slice(8, 16)}-${digits.slice(16)}`;
      }
    } else {
      formatted = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    }

    setEditingBankAccounts(prev => ({ ...prev, [id]: formatted }));
  };

  const handleBankBlur = async (id: string, invoice: TransferInvoice) => {
    const value = editingBankAccounts[id]?.trim();
    if (value === undefined || value === invoice.partner_bank_account) return;

    // Format if looks like bank account
    const clean = value.replace(/[^0-9]/g, '');
    let formatted = value;
    if (clean.length === 16) {
      formatted = `${clean.slice(0, 8)}-${clean.slice(8)}`;
    } else if (clean.length === 24) {
      formatted = `${clean.slice(0, 8)}-${clean.slice(8, 16)}-${clean.slice(16)}`;
    }

    // Save back if it's a manual invoice
    if (invoice.source === 'manual') {
      try {
        await supabase
          .from('invoices')
          .update({ bankszamlaszam_iban: formatted })
          .eq('id', invoice.id);
        toast({ title: 'Mentve', description: 'Bankszámlaszám sikeresen frissítve.' });
      } catch (err) {
        reportError({ type: 'db_query', component: 'TransfersPage', action: 'handleBankBlur', message: 'Failed to update manual invoice bank account', error: err });
      }
    } else {
      // Just visually save for now in state
      toast({ title: 'Ideiglenesen frissítve', description: 'Bankszámlaszám frissítve a generáláshoz.' });
    }

    // Update query cache inline so we don't have to trigger a full refresh
    setEditingBankAccounts(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });

    if (invoices) {
      const idx = invoices.findIndex(inv => inv.id === id);
      if (idx !== -1) {
        invoices[idx].partner_bank_account = formatted;
      }
    }
  };

  const handleDeleteTransfer = async (id: string) => {
    try {
      const { error } = await supabase
        .from('payment_transfers')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Sikeres törlés',
        description: 'A tétel sikeresen törölve lett az utalási előzményekből.',
      });

      refetchTransferHistory();
    } catch (err: any) {
      reportError({ type: 'db_query', component: 'TransfersPage', action: 'handleDeleteTransfer', message: 'Failed to delete payment transfer', error: err });
      toast({
        title: 'Hiba',
        description: 'Nem sikerült a tétel törlése.',
        variant: 'destructive'
      });
    }
  };

  const handleBulkDeleteTransfers = async () => {
    if (selectedHistoryIds.length === 0) return;
    try {
      const { error } = await supabase
        .from('payment_transfers')
        .delete()
        .in('id', selectedHistoryIds);

      if (error) throw error;

      toast({
        title: 'Sikeres törlés',
        description: `${selectedHistoryIds.length} tétel sikeresen törölve lett az utalási előzményekből.`,
      });

      setSelectedHistoryIds([]);
      refetchTransferHistory();
    } catch (err: any) {
      reportError({ type: 'db_query', component: 'TransfersPage', action: 'handleBulkDeleteTransfers', message: 'Failed to bulk delete payment transfers', error: err });
      toast({
        title: 'Hiba',
        description: 'Nem sikerült a tételek törlése.',
        variant: 'destructive'
      });
    }
  };

  // 3. Filter invoices
  const filteredInvoices = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return invoices.filter(inv => {
      // Search filter
      const searchLower = search.toLowerCase();
      const matchSearch =
        inv.partner_name.toLowerCase().includes(searchLower) ||
        inv.invoice_number.toLowerCase().includes(searchLower);

      if (!matchSearch) return false;

      // Tab filter
      if (filterTab === 'overdue') {
        return inv.due_date < today;
      }
      if (filterTab === 'due_today') {
        return inv.due_date === today;
      }
      return true;
    });
  }, [invoices, search, filterTab]);

  // 4. Compute grouped invoices if checked
  const displayItems = useMemo(() => {
    if (!groupByPartner) {
      const items = filteredInvoices.map(inv => ({
        key: inv.id,
        invoice_ids: [inv.id],
        invoice_sources: [inv.source],
        invoice_numbers: [inv.invoice_number],
        partner_name: inv.partner_name,
        due_date: inv.due_date,
        amount: inv.amount,
        currency: inv.currency,
        partner_bank_account: editingBankAccounts[inv.id] !== undefined ? editingBankAccounts[inv.id] : inv.partner_bank_account,
        original_invoices: [inv]
      }));

      // Sort individual items by due_date ascending, then partner_name alphabetically
      return items.sort((a, b) => {
        if (a.due_date !== b.due_date) {
          return a.due_date.localeCompare(b.due_date);
        }
        return a.partner_name.localeCompare(b.partner_name);
      });
    }

    // Group by partner name and currency
    const groups: Record<string, typeof filteredInvoices> = {};
    filteredInvoices.forEach(inv => {
      const key = `${inv.partner_name.toLowerCase()}_${inv.currency}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(inv);
    });

    const mappedGroups = Object.values(groups).map((group, idx) => {
      const totalAmount = group.reduce((sum, inv) => sum + inv.amount, 0);
      const invoiceNumbers = group.map(inv => inv.invoice_number);
      const invoiceIds = group.map(inv => inv.id);
      const invoiceSources = group.map(inv => inv.source);
      // Pick earliest due date
      const earliestDue = group.map(inv => inv.due_date).sort()[0];
      // Pick bank account (prefer first non-empty)
      const bankAccount = group.find(inv => inv.partner_bank_account)?.partner_bank_account || '';

      const key = `group_${idx}_${group[0].partner_name}`;

      return {
        key,
        invoice_ids: invoiceIds,
        invoice_sources: invoiceSources,
        invoice_numbers: invoiceNumbers,
        partner_name: group[0].partner_name,
        due_date: earliestDue,
        amount: totalAmount,
        currency: group[0].currency,
        partner_bank_account: editingBankAccounts[key] !== undefined ? editingBankAccounts[key] : bankAccount,
        original_invoices: group
      };
    });

    // Sort grouped items by earliest due_date ascending, then partner_name alphabetically
    return mappedGroups.sort((a, b) => {
      if (a.due_date !== b.due_date) {
        return a.due_date.localeCompare(b.due_date);
      }
      return a.partner_name.localeCompare(b.partner_name);
    });
  }, [filteredInvoices, groupByPartner, editingBankAccounts]);

  const paginatedActiveItems = useMemo(() => {
    const start = (activePage - 1) * activePageSize;
    return displayItems.slice(start, start + activePageSize);
  }, [displayItems, activePage, activePageSize]);

  useEffect(() => {
    setActivePage(1);
  }, [search, filterTab, groupByPartner]);

  const paginatedHistoryItems = useMemo(() => {
    const start = (historyPage - 1) * historyPageSize;
    return transferHistory.slice(start, start + historyPageSize);
  }, [transferHistory, historyPage, historyPageSize]);

  useEffect(() => {
    setHistoryPage(1);
  }, [transferHistory.length]);


  // 5. Statistics
  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    let overdueCount = 0;
    let overdueSum = 0;
    let todayCount = 0;
    let todaySum = 0;

    invoices.forEach(inv => {
      if (inv.currency === 'HUF') {
        if (inv.due_date < today) {
          overdueCount++;
          overdueSum += inv.amount;
        } else if (inv.due_date === today) {
          todayCount++;
          todaySum += inv.amount;
        }
      }
    });

    // Count selected values
    let selectedCount = 0;
    let selectedSumHuf = 0;
    const selectedList = displayItems.filter(item => selectedIds.includes(item.key));
    selectedList.forEach(item => {
      selectedCount += item.invoice_ids.length;
      if (item.currency === 'HUF') {
        selectedSumHuf += item.amount;
      }
    });

    return {
      overdueCount,
      overdueSum,
      todayCount,
      todaySum,
      selectedCount,
      selectedSumHuf
    };
  }, [invoices, displayItems, selectedIds]);

  const handleSelectRow = (key: string) => {
    setSelectedIds(prev =>
      prev.includes(key) ? prev.filter(id => id !== key) : [...prev, key]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(displayItems.map(item => item.key));
    } else {
      setSelectedIds([]);
    }
  };

  const hasMissingBankAccounts = useMemo(() => {
    const selectedList = displayItems.filter(item => selectedIds.includes(item.key));
    return selectedList.some(item => !item.partner_bank_account.trim());
  }, [displayItems, selectedIds]);

  // 6. Bank transfer file export helper
  const triggerFileExport = () => {
    if (selectedIds.length === 0) return;
    if (hasMissingBankAccounts) {
      toast({
        title: 'Hiányzó bankszámlaszám',
        description: 'Minden kijelölt tételhez meg kell adni a partner bankszámlaszámát a fájl generálásához.',
        variant: 'destructive'
      });
      return;
    }

    // If the user has exactly 1 real corporate bank account, we skip the dialog!
    if (bankAccounts.length === 1) {
      const singleAcc = bankAccounts[0];
      const bName = singleAcc.bank_name.toLowerCase();
      let format = 'otp'; // default
      if (bName.includes('otp')) format = 'otp';
      else if (bName.includes('cib')) format = 'cib';
      else if (bName.includes('erste')) format = 'erste';
      else if (bName.includes('k&h') || bName.includes('kh') || bName.includes('kereskedelmi')) format = 'kh';
      else if (bName.includes('raiffeisen')) format = 'raiffeisen';
      else if (bName.includes('mbh')) format = 'mbh';
      else if (bName.includes('sepa')) format = 'sepa';
      
      // Directly generate without opening dialog
      handleGenerateFile(singleAcc.id, format);
      return;
    }

    setExportDialogOpen(true);
  };

  const handleGenerateFile = async (overrideSenderId?: string, overrideFormat?: string) => {
    const activeSenderId = overrideSenderId || senderAccountId;
    const activeFormat = overrideFormat || exportFormat;

    const sender = displayBankAccounts.find(acc => acc.id === activeSenderId);
    if (!sender) {
      toast({ title: 'Hiba', description: 'Kérjük, válaszd ki a céges indító bankszámlát!', variant: 'destructive' });
      return;
    }

    setExporting(true);
    try {
      const selectedItems = displayItems.filter(item => selectedIds.includes(item.key));
      const todayStr = new Date().toISOString().split('T')[0];

      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const formattedDateTime = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}_${pad(now.getHours())}.${pad(now.getMinutes())}`;
      const companyName = selectedCompany?.name || 'Visibill';
      const rawBankLabel = sender.bank_name || activeFormat.toUpperCase();
      const bankLabel = rawBankLabel
        .replace(/(Minta|Céges|Bankszámla|\(Teszt\))/ig, '')
        .trim() || activeFormat.toUpperCase();

      let fileContent = '';
      let filename = `${companyName} - ${bankLabel} - Utalási lista - ${formattedDateTime}`;
      // Clean forbidden filename characters
      filename = filename.replace(/[/\\?%*:|"<>\r\n\t]+/g, '').trim();

      if (activeFormat === 'sepa') {
        // Generate SEPA XML pain.001.001.03
        const msgId = `MSG${Date.now()}`;
        const pmtInfId = `PMTINF${Date.now()}`;

        let trfInfos = '';
        selectedItems.forEach((item, idx) => {
          const cleanIban = item.partner_bank_account.replace(/[^A-Z0-9]/ig, '');
          trfInfos += `
      <CdtTrfTxInf>
        <PmtId>
          <EndToEndId>E2E${idx}-${Date.now()}</EndToEndId>
        </PmtId>
        <Amt>
          <InstdAmt Ccy="${item.currency}">${item.amount.toFixed(2)}</InstdAmt>
        </Amt>
        <Cdtr>
          <Nm>${item.partner_name.slice(0, 70)}</Nm>
        </Cdtr>
        <CdtrAcct>
          <Id>
            <Othr>
              <Id>${cleanIban}</Id>
            </Othr>
          </Id>
        </CdtrAcct>
        <RmtInf>
          <Ustrd>Szamlak: ${item.invoice_numbers.join(', ').slice(0, 140)}</Ustrd>
        </RmtInf>
      </CdtTrfTxInf>`;
        });

        const senderIban = sender.account_number.replace(/[^A-Z0-9]/ig, '');

        fileContent = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${msgId}</MsgId>
      <CreDtTm>${new Date().toISOString()}</CreDtTm>
      <NbOfTxs>${selectedItems.length}</NbOfTxs>
      <CtrlSum>${selectedItems.reduce((sum, item) => sum + item.amount, 0).toFixed(2)}</CtrlSum>
      <InitgPty>
        <Nm>${selectedCompany?.name || 'Visibill Client'}</Nm>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${pmtInfId}</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <PmtTpInf>
        <SvcLvl>
          <Cd>SEPA</Cd>
        </SvcLvl>
      </PmtTpInf>
      <ReqdExctnDt>${todayStr}</ReqdExctnDt>
      <Dbtr>
        <Nm>${selectedCompany?.name || 'Visibill Client'}</Nm>
      </Dbtr>
      <DbtrAcct>
        <Id>
          <Othr>
            <Id>${senderIban}</Id>
          </Othr>
        </Id>
      </DbtrAcct>
      <DbtrAgt>
        <FinInstnId>
          <Othr>
            <Id>GIROHU</Id>
          </Othr>
        </FinInstnId>
      </DbtrAgt>${trfInfos}
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;
        filename += '.xml';
      } else if (activeFormat === 'cib') {
        // CIB Business Online CSV Format (19 columns, semicolon separated, no header)
        fileContent = '';
        selectedItems.forEach(item => {
          const cleanSender = sender.account_number.replace(/[^0-9]/g, '');
          const cleanPartner = item.partner_bank_account.replace(/[^0-9]/g, '');
          const narrative = `Szamlak: ${item.invoice_numbers.join(', ')}`.slice(0, 140);
          
          // Columns: 1.Terhelendo szamla, 2.Kedvezmenyezett nev, 3.Kedvezmenyezett szamla, 4.Osszeg (egeszresz), 5.Kozlemeny, 6-19.Ures
          fileContent += `${cleanSender};${item.partner_name.slice(0, 70)};${cleanPartner};${item.amount.toFixed(0)};${narrative};;;;;;;;;;;;;;\r\n`;
        });
        filename += '.csv';
      } else if (activeFormat === 'erste' || activeFormat === 'raiffeisen') {
        // Erste/Raiffeisen Electra CSV Sablon Format
        const header = 'NAME;COMMENT;CtgyPurpCd;CtgyPurpPrtry;DbtrOrgId;DbtrPrvtId;UltmtDbtrNm;UltmtDbtrOrgId;UltmtDbtrPrvtId;CdtrNm;CdtrOrgId;CdtrPrvtId;CdtrAcct;UltmtCdtrNm;UltmtCdtrOrgId;UltmtCdtrPrvtId;PurpCd;PurpPrtry;Ustrd;PostaStrd;OtherStrd;LclInstrm;SchmeNmPrtry;CdtrAcctIdOthrId';
        const rows = [header];

        selectedItems.forEach(item => {
          const cleanPartner = item.partner_bank_account.replace(/[^0-9]/g, '');
          const narrative = `Szamlak: ${item.invoice_numbers.join(', ')}`.slice(0, 140);
          const name = `Utalas - ${item.partner_name.slice(0, 20)}`;
          const comment = 'Visibill atutalas';
          
          // 24 columns total
          const row = `${name};${comment};;;;;;;;${item.partner_name.slice(0, 70)};;;${cleanPartner};;;;;;${narrative};;;INST;;`;
          rows.push(row);
        });

        fileContent = rows.join('\r\n') + '\r\n';
        filename += '.csv';
      } else if (activeFormat === 'mbh') {
        // MBH Fixed-Width TXT Format (293 bytes per row)
        fileContent = '';
        selectedItems.forEach((item, idx) => {
          const cleanSender = sender.account_number.replace(/[^0-9]/g, '');
          const cleanPartner = item.partner_bank_account.replace(/[^0-9]/g, '');
          const formattedDate = todayStr.replace(/-/g, ''); // YYYYMMDD
          const narrative = `Szamlak: ${item.invoice_numbers.join(', ')}`;

          const refNum = (item.invoice_numbers[0] || `UT${idx}`).slice(0, 20).padEnd(20, ' ');
          const txCode = '410';
          const senderAcc = cleanSender.padEnd(24, ' ');
          const senderName = (sender.bank_name || 'Visibill Client').slice(0, 32).padEnd(32, ' ');
          const spaces4 = '    ';
          const partnerAcc = cleanPartner.padEnd(24, ' ');
          const partnerName = item.partner_name.slice(0, 32).padEnd(32, ' ');
          const valDate = formattedDate;
          const amtStr = item.amount.toFixed(2).padStart(15, '0'); // xxxxxxxxxxxx.xx format
          const ccy = 'HUF';
          const comm1 = narrative.slice(0, 32).padEnd(32, ' ');
          const comm2 = narrative.slice(32, 64).padEnd(32, ' ');
          const comm3 = narrative.slice(64, 96).padEnd(32, ' ');
          const dueDate = formattedDate;
          const spaces12 = '            ';
          const reason = '1';
          const spaces5 = '     ';
          const reserve = '    ';

          fileContent += `${refNum}${txCode}${senderAcc}${senderName}${spaces4}${partnerAcc}${partnerName}${valDate}${amtStr}${ccy}${comm1}${comm2}${comm3}${dueDate}${spaces12}${reason}${spaces5}${reserve}\r\n`;
        });
        // Append EOF character (ASCII 26 / 0x1A) at the very end
        fileContent += '\x1A';
        filename += '.txt';
      } else {
        // Generate Semicolon separated CSV (Domestic GIRO CSV) for OTP and K&H
        fileContent = '';
        selectedItems.forEach(item => {
          const cleanSender = sender.account_number.replace(/[^0-9]/g, '');
          const cleanPartner = item.partner_bank_account.replace(/[^0-9]/g, '');
          const formattedDate = todayStr.replace(/-/g, ''); // YYYYMMDD format
          const narrative = `Szamlak: ${item.invoice_numbers.join(', ')}`.slice(0, 140);
          fileContent += `${cleanSender};${cleanPartner};${item.partner_name};${item.amount.toFixed(0)};${item.currency};${formattedDate};${narrative}\r\n`;
        });
        filename += '.csv';
      }

      // Download file in browser
      const mimeType = activeFormat === 'sepa' 
        ? 'application/xml' 
        : (activeFormat === 'mbh' ? 'text/plain;charset=utf-8;' : 'text/csv;charset=utf-8;');
      const blob = new Blob([fileContent], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // 7. Save transfers logs to Supabase (only if it's a real bank account, not the dummy test ID)
      if (activeSenderId !== 'dummy-test-id') {
        const insertRows = selectedItems.map(item => ({
          company_id: selectedCompany!.id,
          bank_account_id: activeSenderId,
          partner_name: item.partner_name,
          partner_account: item.partner_bank_account,
          amount: item.amount,
          currency: item.currency,
          narrative: `Szamlak: ${item.invoice_numbers.join(', ')}`,
          invoice_ids: item.invoice_ids,
          invoice_sources: item.invoice_sources,
          status: 'pending'
        }));

        const { error: logErr } = await supabase
          .from('payment_transfers')
          .insert(insertRows);

        if (logErr) throw logErr;

        toast({
          title: 'Siker',
          description: 'Átutalási állomány generálva és letöltve! Az utalások elmentve párosításra.',
        });
      } else {
        toast({
          title: 'Minta letöltve',
          description: 'A minta átutalási állomány sikeresen generálva és letöltve!',
        });
      }

      setSelectedIds([]);
      setExportDialogOpen(false);
      refetchInvoices();
      refetchTransferHistory();
    } catch (err: any) {
      reportError({ type: 'db_query', component: 'TransfersPage', action: 'handleGenerateFile', message: 'Failed to generate transfer file', error: err });
      toast({ title: 'Hiba', description: 'Nem sikerült az utalások mentése a rendszerben.', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-6 page-animate space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-card/90 to-card/40 p-6 rounded-2xl border border-border/40 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
              <Landmark className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">Utalások</h1>
              <p className="text-muted-foreground text-sm mt-1">Mit kell utaljak ma? Átutalási listák generálása és letöltése egy kattintással.</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-muted/60 px-4 py-2.5 rounded-xl border self-start md:self-center font-medium text-sm">
          <Calendar className="h-4 w-4 text-primary" />
          <span>Ma: {new Date().toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-border/60 bg-gradient-to-br from-card to-destructive/5 hover:shadow-md transition-all duration-300">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lejárt fizetési határidejű</CardDescription>
            <CardTitle className="text-2xl font-black text-destructive mt-1">
              {stats.overdueCount} db
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium text-muted-foreground">
              Összesen: <span className="font-bold text-foreground">{stats.overdueSum.toLocaleString('hu-HU')} Ft</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-gradient-to-br from-card to-amber-500/5 hover:shadow-md transition-all duration-300">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ma lejáró</CardDescription>
            <CardTitle className="text-2xl font-black text-amber-600 mt-1">
              {stats.todayCount} db
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium text-muted-foreground">
              Összesen: <span className="font-bold text-foreground">{stats.todaySum.toLocaleString('hu-HU')} Ft</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-primary/5 hover:shadow-md transition-all duration-300 relative overflow-hidden">
          {/* Glass effect */}
          <div className="absolute right-[-10px] bottom-[-10px] w-24 h-24 bg-primary/10 rounded-full blur-xl pointer-events-none" />
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-primary">Kijelölve utalásra</CardDescription>
            <CardTitle className="text-2xl font-black text-primary mt-1">
              {stats.selectedCount} db
            </CardTitle>
          </CardHeader>
          <CardContent className="flex justify-between items-end">
            <p className="text-sm font-medium text-muted-foreground">
              Összesen: <span className="font-bold text-foreground">{stats.selectedSumHuf.toLocaleString('hu-HU')} Ft</span>
            </p>
            {selectedIds.length > 0 && (
              <Button size="sm" onClick={triggerFileExport} className="gap-1.5 shadow-md z-10">
                Letöltés
                <Download className="h-4 w-4" />
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main View */}
      <Card className="border-border/60 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Filters / Search */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-72">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Keresés partnerre vagy számlára..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 bg-background/50 focus:bg-background h-9 rounded-lg"
                />
              </div>

              {/* Tabs */}
              <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border text-xs">
                <button
                  onClick={() => setFilterTab('all')}
                  className={`px-3 py-1.5 rounded-md font-medium transition-all ${filterTab === 'all' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Összes esedékes
                </button>
                <button
                  onClick={() => setFilterTab('overdue')}
                  className={`px-3 py-1.5 rounded-md font-medium transition-all ${filterTab === 'overdue' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Csak lejárt
                </button>
                <button
                  onClick={() => setFilterTab('due_today')}
                  className={`px-3 py-1.5 rounded-md font-medium transition-all ${filterTab === 'due_today' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Mai esedékes
                </button>
              </div>
            </div>

            {/* Toggle grouping */}
            <div className="flex items-center gap-2 bg-muted/30 px-3 py-1.5 rounded-lg border border-border/40">
              <Switch
                id="group-toggle"
                checked={groupByPartner}
                onCheckedChange={(checked) => {
                  setGroupByPartner(checked);
                  setSelectedIds([]);
                }}
              />
              <Label htmlFor="group-toggle" className="text-xs font-semibold text-muted-foreground cursor-pointer">
                Számlák összevonása partnerenként
              </Label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground animate-pulse">Számlák betöltése...</div>
          ) : displayItems.length === 0 ? (
            <div className="py-16 text-center border-t border-border/40">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-semibold">Minden számla rendezve!</p>
              <p className="text-xs text-muted-foreground mt-1">Nincs lejárt vagy ma esedékes kifizetetlen számlád.</p>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-border/50 overflow-x-auto">
                <Table className="compact-table min-w-max">
                  <TableHeader>
                    <TableRow className="bg-muted/40 text-muted-foreground font-medium text-xs select-none hover:bg-muted/40">
                      <TableHead className="w-12 text-center">
                        <Checkbox
                          checked={displayItems.length > 0 && selectedIds.length === displayItems.length}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Partner</TableHead>
                      <TableHead className="min-w-[200px] whitespace-nowrap">Számlaszám(ok)</TableHead>
                      <TableHead className="w-32 whitespace-nowrap">Határidő</TableHead>
                      <TableHead className="w-40 text-right whitespace-nowrap">Összeg</TableHead>
                      <TableHead className="w-72">Partner Bankszámlaszáma</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedActiveItems.map(item => {
                      const isSelected = selectedIds.includes(item.key);
                      const todayStr = new Date().toISOString().split('T')[0];
                      const isOverdue = item.due_date < todayStr;
                      const hasBank = item.partner_bank_account.trim().length > 0;

                      return (
                        <TableRow
                          key={item.key}
                          className={isSelected ? 'bg-primary/10 hover:bg-primary/15' : ''}
                        >
                          <TableCell className="text-center">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => handleSelectRow(item.key)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground/80" />
                              <CopyableCell
                                value={item.partner_name}
                                displayValue={item.partner_name.length > 13 ? item.partner_name.slice(0, 13) + '…' : item.partner_name}
                                truncate
                                maxWidth="100%"
                                className="font-semibold text-foreground text-xs"
                                ariaLabel={`${item.partner_name} másolása`}
                              />
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono mt-1 max-w-[200px] truncate" title={`Szamlak: ${item.invoice_numbers.join(', ')}`}>
                              Közlemény: {`Szamlak: ${item.invoice_numbers.join(', ')}`.slice(0, 140)}
                            </div>
                          </TableCell>
                          <TableCell className="min-w-[200px] whitespace-nowrap">
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {item.invoice_numbers.map((num, i) => (
                                <span key={i} className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded text-xs text-muted-foreground font-mono">
                                  <FileText className="h-3 w-3" />
                                  {num || 'Sorszám nélkül'}
                                </span>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold ${isOverdue ? 'bg-destructive/10 text-destructive' : 'bg-amber-500/10 text-amber-700'}`}>
                              <Calendar className="h-3.5 w-3.5" />
                              {new Date(item.due_date).toLocaleDateString('hu-HU')}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono tabular-nums text-right whitespace-nowrap font-bold text-foreground">
                            {item.amount.toLocaleString('hu-HU')} {item.currency}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1 w-full max-w-[240px]">
                              <div className="relative flex items-center">
                                <Input
                                  value={editingBankAccounts[item.key] !== undefined ? editingBankAccounts[item.key] : item.partner_bank_account}
                                  onChange={e => handleBankChange(item.key, e.target.value)}
                                  onBlur={() => handleBankBlur(item.key, item.original_invoices[0])}
                                  placeholder="Pl: 11773000-00000000"
                                  className={`h-8 font-mono text-xs pl-2.5 pr-8 rounded w-full ${!hasBank && !editingBankAccounts[item.key] ? 'border-destructive/40 bg-destructive/5 focus-visible:ring-destructive' : 'bg-background'}`}
                                />
                                {!hasBank && !editingBankAccounts[item.key] && (
                                  <AlertTriangle className="absolute right-2.5 h-3.5 w-3.5 text-destructive pointer-events-none animate-pulse" />
                                )}
                              </div>
                              {!hasBank && !editingBankAccounts[item.key] && (
                                <span className="text-[10px] text-destructive/80 font-bold flex items-center gap-1 px-1">
                                  Hiányzó bankszámlaszám!
                                </span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}

                  </TableBody>
                </Table>
              </div>
              <div className="p-4 border-t border-border/40">
                <UnifiedPagination
                  currentPage={activePage}
                  totalPages={Math.ceil(displayItems.length / activePageSize)}
                  totalItems={displayItems.length}
                  pageSize={activePageSize}
                  onPageChange={setActivePage}
                  onPageSizeChange={(size) => { setActivePageSize(size); setActivePage(1); }}
                />
              </div>
            </>


          )}
        </CardContent>
      </Card>

      {/* Export History Card */}
      <Card className="border-border/60 shadow-lg mt-8">
        <CardHeader className="pb-4 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Korábbi utalási állományok és párosítási státusz
            </CardTitle>
            <CardDescription className="text-xs">
              Az eddig kiexportált utalási tételek és a hozzájuk tartozó banki tranzakció-párosítások nyomon követése.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {selectedHistoryIds.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={handleBulkDeleteTransfers}
              >
                <Trash2 className="h-4 w-4" />
                Kijelöltek törlése ({selectedHistoryIds.length})
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => refetchTransferHistory()} className="h-8 text-xs gap-1.5">
              Frissítés
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {transferHistory.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground border-t border-border/40">
              Még nem történt utalási fájl exportálás.
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-border/50 overflow-x-auto">
                <Table className="compact-table min-w-max">
                  <TableHeader>
                    <TableRow className="bg-muted/20 text-muted-foreground text-xs font-semibold hover:bg-muted/20">
                      <TableHead className="w-12 text-center">
                        <Checkbox
                          checked={transferHistory.length > 0 && selectedHistoryIds.length === transferHistory.length}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedHistoryIds(transferHistory.map((item: any) => item.id));
                            } else {
                              setSelectedHistoryIds([]);
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead className="whitespace-nowrap">Dátum</TableHead>
                      <TableHead>Partner</TableHead>
                      <TableHead className="whitespace-nowrap">Partner bankszámla</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Összeg</TableHead>
                      <TableHead>Közlemény</TableHead>
                      <TableHead className="text-center whitespace-nowrap">Státusz</TableHead>
                      <TableHead className="text-center w-20 whitespace-nowrap">Művelet</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedHistoryItems.map((item: any) => {
                      const statusConfig = {
                        pending: {
                          label: 'Párosításra vár',
                          className: 'bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse'
                        },
                        sent: {
                          label: 'Elküldve',
                          className: 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                        },
                        matched: {
                          label: 'Párosítva',
                          className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                        }
                      }[item.status as 'pending' | 'sent' | 'matched'] || {
                        label: item.status,
                        className: 'bg-muted text-muted-foreground'
                      };

                      const isSelected = selectedHistoryIds.includes(item.id);

                      return (
                        <TableRow key={item.id} className={isSelected ? 'bg-primary/10 hover:bg-primary/15' : ''}>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => {
                                setSelectedHistoryIds(prev =>
                                  prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]
                                );
                              }}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(item.created_at).toLocaleString('hu-HU')}
                          </TableCell>
                          <TableCell>
                            <CopyableCell
                              value={item.partner_name}
                              displayValue={item.partner_name.length > 13 ? item.partner_name.slice(0, 13) + '…' : item.partner_name}
                              truncate
                              maxWidth="100%"
                              className="font-semibold text-foreground text-xs"
                              ariaLabel={`${item.partner_name} másolása`}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-xs whitespace-nowrap">
                            {item.partner_account}
                          </TableCell>
                          <TableCell className="font-mono tabular-nums text-right whitespace-nowrap font-bold text-foreground">
                            {item.amount.toLocaleString('hu-HU')} {item.currency}
                          </TableCell>
                          <TableCell className="text-xs max-w-xs truncate" title={item.narrative}>
                            {item.narrative}
                          </TableCell>
                          <TableCell className="text-center whitespace-nowrap">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusConfig.className}`}>
                              {statusConfig.label}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                              onClick={() => handleDeleteTransfer(item.id)}
                              title="Törlés"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}

                  </TableBody>
                </Table>
              </div>
              <div className="p-4 border-t border-border/40">
                <UnifiedPagination
                  currentPage={historyPage}
                  totalPages={Math.ceil(transferHistory.length / historyPageSize)}
                  totalItems={transferHistory.length}
                  pageSize={historyPageSize}
                  onPageChange={setHistoryPage}
                  onPageSizeChange={(size) => { setHistoryPageSize(size); setHistoryPage(1); }}
                />
              </div>
            </>

          )}
        </CardContent>
      </Card>

      {/* Export Dialog Wizard */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Landmark className="h-5 w-5 text-primary" />
              Átutalási állomány generálása
            </DialogTitle>
            <DialogDescription>
              Válaszd ki a küldő céges számlát és a kívánt netbank fájlformátumot.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-3">
            {/* Sender Account */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-sm font-semibold">Indító céges bankszámla</Label>
                {bankAccounts.length === 0 && (
                  <button
                    onClick={() => {
                      setExportDialogOpen(false);
                      navigate(`/${companyId}/${dateRange}/settings/bank-accounts`);
                    }}
                    className="text-xs text-primary hover:underline font-semibold"
                  >
                    Saját hozzáadása
                  </button>
                )}
              </div>
              {bankAccounts.length === 0 && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl text-[11px] leading-relaxed font-medium flex items-start gap-2 shadow-sm">
                  <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    Minta bankszámlát használunk a fájl kipróbálásához. Valódi utaláshoz rögzítsd saját bankszámládat a Beállításokban!
                  </div>
                </div>
              )}
              <Select value={senderAccountId} onValueChange={setSenderAccountId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Válassz indító számlát" />
                </SelectTrigger>
                <SelectContent>
                  {displayBankAccounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.bank_name} — {acc.account_number} ({acc.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Format Selection Card Grid */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Fájlformátum</Label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'otp', name: 'OTP Bank', desc: 'Giro CSV' },
                  { id: 'cib', name: 'CIB Bank', desc: 'Pozíciós CSV' },
                  { id: 'erste', name: 'Erste Bank', desc: 'Electra CSV' },
                  { id: 'kh', name: 'K&H Bank', desc: 'Giro CSV' },
                  { id: 'raiffeisen', name: 'Raiffeisen', desc: 'Electra CSV' },
                  { id: 'mbh', name: 'MBH Bank', desc: 'Pozíciós TXT' },
                  { id: 'sepa', name: 'SEPA XML', desc: 'pain.001 standard' },
                ].map(fmt => (
                  <div
                    key={fmt.id}
                    onClick={() => setExportFormat(fmt.id)}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      exportFormat === fmt.id
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border hover:bg-muted/40'
                    }`}
                  >
                    <p className="font-semibold text-xs text-foreground">{fmt.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{fmt.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setExportDialogOpen(false)} disabled={exporting}>
              Mégse
            </Button>
            <Button
              onClick={() => handleGenerateFile()}
              disabled={exporting || displayBankAccounts.length === 0 || !senderAccountId}
              className="gap-1.5"
            >
              {exporting ? 'Fájl generálása...' : 'Fájl letöltése és mentése'}
              <Download className="h-4 w-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Floating Bottom Action Bar for Selected Invoices (Portaled to body to bypass dashboard transform/clipping) */}
      {selectedIds.length > 0 && !exportDialogOpen && createPortal(
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-4xl bg-card border border-primary/30 shadow-2xl rounded-2xl px-6 py-4 flex items-center justify-between z-[9999] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3">
            <div className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
            <p className="text-sm font-semibold text-foreground">
              Kijelölt tételek: <span className="font-extrabold text-primary">{selectedIds.length} db</span>
            </p>
            <span className="text-muted-foreground/30 text-xs">|</span>
            <p className="text-xs text-muted-foreground font-medium">
              Összesen: <span className="font-bold text-foreground">{stats.selectedSumHuf.toLocaleString('hu-HU')} Ft</span>
            </p>
          </div>
          <Button onClick={triggerFileExport} className="gap-2 shadow-lg hover:shadow-primary/20 transition-all font-semibold h-9 text-xs rounded-xl">
            <Download className="h-4 w-4" />
            Utalási lista letöltése
          </Button>
        </div>,
        document.body
      )}
    </div>
  );
}
