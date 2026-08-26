import { useState, useEffect, useMemo } from 'react';
import { computeMatchStatus, getPaymentStatusBadge } from '@/hooks/useComputedStatus';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { Search, Check, AlertTriangle, FileText, CheckCircle2, HelpCircle, Link2, Eye, Wallet, Package, Ban, UploadCloud, Undo2, Lock, Users, Loader2, Plus, ClipboardCheck, Pencil } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { format, subDays, addDays } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { useScopedNavigate } from '@/lib/navigation';
import { InvoiceDetailPopup } from '@/components/InvoiceDetailPopup';
import { reportError } from '@/lib/errorReporter';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useActivePreset } from '@/hooks/useActivePreset';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useAuth } from '@/contexts/AuthContext';

interface Transaction {
  id: string;
  transaction_date: string;
  description: string | null;
  amount: number;
  currency: string | null;
  type: string | null;
  matched_invoice_id: string | null;
  confidence_score: number | null;
  is_verified: boolean | null;
  match_type: string | null;
  reason: string | null;
  created_at: string | null;
  company_id: string | null;
  gl_account_id: string | null;
  gl_accounts?: {
    id: string;
    gl_number: string;
    short_name: string;
  } | null;
}

// Matched invoice from the 'invoices' table
interface MatchedInvoice {
  id: string;
  bizonylatsorszam: string | null;
  kibocsatas_datuma: string;
  teljesites_datuma: string | null;
  elado_nev: string;
  vevo_nev: string;
  brutto_vegosszeg: number;
  penznem: string | null;
  invoice_type: string;
}

// Matched invoice from the 'nav_invoices' table
interface MatchedNavInvoice {
  id: string;
  invoice_number: string;
  invoice_issue_date: string | null;
  supplier_name: string | null;
  customer_name: string | null;
  invoice_gross_amount: number | null;
  currency: string | null;
  invoice_direction: string | null;
  transaction_id: string | null;
  submitted: boolean | null;
}

// Matched salary record
interface MatchedSalary {
  id: string;
  név: string;
  összeg: number;
  tipus: string;
  fizetesi_mod: string;
  transaction_id: string | null;
  dátum: string | null;
  munkavallalo_neve: string | null;
  megjegyzes: string | null;
}

// Matched courier report
interface MatchedCourierReport {
  id: string;
  report_type: string;
  package_number: string | null;
  reference_number: string | null;
  delivery_date: string | null;
  cod_amount: number | null;
  recipient_name: string | null;
  match_status: string;
  match_confidence: number | null;
}

// Available invoices for manual matching (from invoices table)
interface AvailableInvoice {
  id: string;
  bizonylatsorszam: string;
  brutto_vegosszeg: number;
  elado_nev: string;
  penznem: string | null;
  kibocsatas_datuma: string;
  already_paid: number;
  remaining: number;
}

interface TransactionDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  companyId: string;
  onUpdate: () => void;
}

export const TransactionDetailsDialog = ({
  open,
  onOpenChange,
  transaction,
  companyId,
  onUpdate
}: TransactionDetailsDialogProps) => {
  const scopedNavigate = useScopedNavigate();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const invalidateAllMatches = () => {
    queryClient.invalidateQueries({ queryKey: ['transactions', companyId] });
    queryClient.invalidateQueries({ queryKey: ['navInvoices', companyId] });
    queryClient.invalidateQueries({ queryKey: ['navInvoicesLookup', companyId] });
    queryClient.invalidateQueries({ queryKey: ['submittedInvoices', companyId] });
    queryClient.invalidateQueries({ queryKey: ['linkedInvoices', companyId] });
    queryClient.invalidateQueries({ queryKey: ['invoiceTransactions', companyId] });
    queryClient.invalidateQueries({ queryKey: ['transactionInvoiceMatches', companyId] });
    queryClient.invalidateQueries({ queryKey: ['filteredNavInvoices', companyId] });
    queryClient.invalidateQueries({ queryKey: ['filteredSubmittedInvoices', companyId] });
    queryClient.invalidateQueries({ queryKey: ['salaries', companyId] });
    queryClient.invalidateQueries({ queryKey: ['due-transfer-invoices', companyId] });
    queryClient.invalidateQueries({ queryKey: ['payment-transfers-history', companyId] });
  };
  const [matchedInvoice, setMatchedInvoice] = useState<MatchedInvoice | null>(null);
  const [matchedNavInvoice, setMatchedNavInvoice] = useState<MatchedNavInvoice | null>(null);
  const [matchedSalary, setMatchedSalary] = useState<MatchedSalary | null>(null);
  const [matchedCourierReports, setMatchedCourierReports] = useState<MatchedCourierReport[]>([]);
  const [availableInvoices, setAvailableInvoices] = useState<AvailableInvoice[]>([]);
  const [serverSearchResults, setServerSearchResults] = useState<AvailableInvoice[]>([]);
  const [isSearchingServer, setIsSearchingServer] = useState(false);
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showManualMatch, setShowManualMatch] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [invoiceDetailOpen, setInvoiceDetailOpen] = useState(false);
  const [invoiceDetailId, setInvoiceDetailId] = useState<string | null>(null);
  const [extraMatches, setExtraMatches] = useState<Array<{id: string; invoice_id: string; invoice_source: string; invoice?: MatchedInvoice | null; navInvoice?: MatchedNavInvoice | null}>>([]);
  const [showAddExtraMatch, setShowAddExtraMatch] = useState(false);

  // Notes state
  const [notes, setNotes] = useState<any[]>([]);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteText, setNewNoteText] = useState('');
  const [newNotePrivate, setNewNotePrivate] = useState(true);
  const [addingNote, setAddingNote] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);

  const [selectedGlId, setSelectedGlId] = useState('');
  const [isEditingGl, setIsEditingGl] = useState(false);
  const [glSearchQuery, setGlSearchQuery] = useState('');

  const { activePresetId } = useActivePreset(companyId);

  const { data: glAccounts = [] } = useQuery({
    queryKey: ['glAccounts', activePresetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gl_accounts')
        .select('id, gl_number, short_name')
        .eq('preset_id', activePresetId!)
        .order('gl_number');
      if (error) throw error;
      return data || [];
    },
    enabled: !!activePresetId && open,
  });

  const cleanGlNum = (num: any) => num ? String(num).replace(/\./g, '') : '';

  const fetchNotes = async () => {
    if (!transaction) return;
    setLoadingNotes(true);
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .or(`transaction_id.eq.${transaction.id},transaction_ids.ov.{${transaction.id}}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Fetch profile names
      if (data && data.length > 0) {
        const userIds = Array.from(new Set(data.map((n: any) => n.user_id)));
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, name')
          .in('user_id', userIds);
        
        const profileMap = new Map<string, string>();
        if (profiles) {
          profiles.forEach(p => profileMap.set(p.user_id, p.name || 'Névtelen'));
        }

        const enriched = data.map(n => ({
          ...n,
          profile_name: profileMap.get(n.user_id) || 'Ismeretlen'
        }));
        setNotes(enriched);
      } else {
        setNotes([]);
      }
    } catch (err) {
      console.error('Error fetching transaction notes:', err);
    } finally {
      setLoadingNotes(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim() || !transaction) return;
    setAddingNote(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) throw new Error('Unauthenticated');

      const { error } = await supabase
        .from('notes')
        .insert({
          company_id: companyId,
          user_id: userId,
          title: newNoteTitle.trim() || 'Tranzakció feljegyzés',
          content: newNoteText.trim(),
          is_private: newNotePrivate,
          transaction_id: transaction.id,
        });

      if (error) throw error;
      setNewNoteText('');
      setNewNoteTitle('');
      setNewNotePrivate(true);
      fetchNotes();
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    } catch (err) {
      console.error('Error adding note:', err);
    } finally {
      setAddingNote(false);
    }
  };

  useEffect(() => {
    if (open && transaction) {
      setShowManualMatch(false);
      setShowAddExtraMatch(false);
      setSearch('');
      setSelectedInvoiceId(null);
      
      // Initialize direct GL booking state
      setSelectedGlId(transaction.gl_account_id || '');
      setIsEditingGl(false);
      setGlSearchQuery('');
      
      // Always fetch courier reports for this transaction
      fetchCourierReports();
      // Always fetch extra matches from join table
      fetchExtraMatches();
      // Always fetch notes
      fetchNotes();
      
      if (transaction.matched_invoice_id) {
        fetchMatchedInvoice();
      } else {
        setMatchedInvoice(null);
        setMatchedNavInvoice(null);
        // Auto-load available invoices for unmatched transactions
        fetchAvailableInvoices();
      }
    }
  }, [open, transaction]);

  const handleBookTransaction = async () => {
    if (!transaction || !selectedGlId || !session?.user?.id || !activePresetId) return;
    setSaving(true);
    try {
      const newGlItem = glAccounts.find(gl => gl.id === selectedGlId);
      const newGlNumber = newGlItem?.gl_number || '';

      // Step A: Update jsonb mapping in database
      const { error: rpcError } = await supabase.rpc('override_gl_classifications_batch', {
        p_items: [{
          item_id: transaction.id,
          source_table: 'transactions',
          original_gl_account_id: transaction.gl_account_id || null,
        }],
        p_new_gl_account_id: selectedGlId,
        p_company_id: companyId,
        p_user_id: session.user.id,
        p_preset_id: activePresetId,
        p_new_gl_number: newGlNumber,
      });
      if (rpcError) throw rpcError;

      // Step B: Update base transaction fields
      const { error } = await supabase
        .from('transactions')
        .update({
          gl_account_id: selectedGlId,
          gl_is_manually_overridden: true,
          is_verified: true,
          matched_invoice_id: null,
          match_type: null,
        })
        .eq('id', transaction.id);

      if (error) throw error;

      toast({ title: 'Tranzakció közvetlenül kontírozva!' });
      setIsEditingGl(false);
      setGlSearchQuery('');
      invalidateAllMatches();
      queryClient.invalidateQueries({ queryKey: ['glBalances'] });
      queryClient.invalidateQueries({ queryKey: ['glItems'] });
      onUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error('Error booking transaction directly:', error);
      toast({ title: 'Hiba a kontírozás mentésekor', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleUnbookTransaction = async () => {
    if (!transaction || !session?.user?.id || !activePresetId) return;
    setSaving(true);
    try {
      // Step A: Remove jsonb mapping in database
      const { error: rpcError } = await supabase.rpc('override_gl_classifications_batch', {
        p_items: [{
          item_id: transaction.id,
          source_table: 'transactions',
          original_gl_account_id: transaction.gl_account_id || null,
        }],
        p_new_gl_account_id: null,
        p_company_id: companyId,
        p_user_id: session.user.id,
        p_preset_id: activePresetId,
        p_new_gl_number: '',
      });
      if (rpcError) throw rpcError;

      // Step B: Clear base transaction fields
      const { error } = await supabase
        .from('transactions')
        .update({
          gl_account_id: null,
          gl_is_manually_overridden: false,
          is_verified: false,
        })
        .eq('id', transaction.id);

      if (error) throw error;

      toast({ title: 'Közvetlen kontírozás törölve!' });
      setIsEditingGl(false);
      setSelectedGlId('');
      setGlSearchQuery('');
      invalidateAllMatches();
      queryClient.invalidateQueries({ queryKey: ['glBalances'] });
      queryClient.invalidateQueries({ queryKey: ['glItems'] });
      onUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error('Error unbooking transaction:', error);
      toast({ title: 'Hiba a törlés során', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Fetch matched invoice - try 'invoices' first, then fallback to 'nav_invoices'
  const fetchMatchedInvoice = async () => {
    if (!transaction?.matched_invoice_id) return;
    
    setLoadingInvoice(true);
    setMatchedNavInvoice(null);
    setMatchedInvoice(null);
    setMatchedSalary(null);
    try {
      // Try invoices table first
      const { data, error } = await supabase
        .from('invoices')
        .select('id, bizonylatsorszam, kibocsatas_datuma, teljesites_datuma, elado_nev, vevo_nev, brutto_vegosszeg, penznem, invoice_type')
        .eq('id', transaction.matched_invoice_id)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setMatchedInvoice(data);
      } else {
        // Fallback: try nav_invoices table
        const { data: navData, error: navError } = await supabase
          .from('nav_invoices')
          .select('id, invoice_number, invoice_issue_date, supplier_name, customer_name, invoice_gross_amount, currency, invoice_direction, transaction_id, submitted')
          .eq('id', transaction.matched_invoice_id)
          .maybeSingle();

        if (navError) throw navError;
        
        if (navData) {
          setMatchedNavInvoice(navData);
        } else {
          // Fallback: try salary table
          const { data: salaryData, error: salaryError } = await supabase
            .from('salary')
            .select('id, "név", "összeg", tipus, fizetesi_mod, statusz, "dátum", munkavallalo_neve, megjegyzes, kifizetes_ideje, transaction_id')
            .eq('id', transaction.matched_invoice_id)
            .maybeSingle();

          if (salaryError) throw salaryError;
          if (salaryData) {
            setMatchedSalary({
              id: salaryData.id,
              név: salaryData['név'],
              összeg: salaryData['összeg'],
              tipus: salaryData.tipus,
              fizetesi_mod: salaryData.fizetesi_mod,
              transaction_id: salaryData.transaction_id,
              dátum: salaryData['dátum'],
              munkavallalo_neve: salaryData.munkavallalo_neve,
              megjegyzes: salaryData.megjegyzes,
            });
          }
        }
      }
    } catch (error) {
      reportError({ type: 'db_query', component: 'TransactionDetailsDialog', action: 'error', message: 'Error fetching matched invoice:', error: error });
      setMatchedInvoice(null);
      setMatchedNavInvoice(null);
    } finally {
      setLoadingInvoice(false);
    }
  };

  // Fetch courier reports matched to this transaction
  const fetchCourierReports = async () => {
    if (!transaction) return;
    try {
      const { data, error } = await supabase
        .from('courier_reports')
        .select('id, report_type, package_number, reference_number, delivery_date, cod_amount, recipient_name, match_status, match_confidence')
        .eq('matched_transaction_id', transaction.id);

      if (error) throw error;
      setMatchedCourierReports(data || []);
    } catch (error) {
      reportError({ type: 'db_query', component: 'TransactionDetailsDialog', action: 'error', message: 'Error fetching courier reports:', error: error });
      setMatchedCourierReports([]);
    }
  };

  // Helper to resolve payments and cross-references for any list of candidate invoices
  const buildAvailableInvoicesList = async (invoices: any[], navInvoices: any[]): Promise<AvailableInvoice[]> => {
    const allInvoiceIds = [
      ...(invoices || []).map(i => i.id),
      ...(navInvoices || []).map(n => n.id),
    ];

    const submittedByNumber = new Map<string, string[]>();
    (invoices || []).forEach(inv => {
      if (inv.bizonylatsorszam) {
        const existing = submittedByNumber.get(inv.bizonylatsorszam) || [];
        existing.push(inv.id);
        submittedByNumber.set(inv.bizonylatsorszam, existing);
      }
    });
    const navByNumber = new Map<string, string[]>();
    (navInvoices || []).forEach(nav => {
      if (nav.invoice_number) {
        const existing = navByNumber.get(nav.invoice_number) || [];
        existing.push(nav.id);
        navByNumber.set(nav.invoice_number, existing);
      }
    });

    (invoices || []).forEach(inv => {
      if (inv.bizonylatsorszam) {
        const navIds = navByNumber.get(inv.bizonylatsorszam);
        if (navIds) allInvoiceIds.push(...navIds);
      }
    });
    (navInvoices || []).forEach(nav => {
      if (nav.invoice_number) {
        const subIds = submittedByNumber.get(nav.invoice_number);
        if (subIds) allInvoiceIds.push(...subIds);
      }
    });

    const uniqueIds = [...new Set(allInvoiceIds)];
    const paidByInvoiceId = new Map<string, number>();

    if (uniqueIds.length > 0) {
      const CHUNK = 500;
      for (let i = 0; i < uniqueIds.length; i += CHUNK) {
        const chunk = uniqueIds.slice(i, i + CHUNK);
        const { data: matchedTxs } = await supabase
          .from('transactions')
          .select('matched_invoice_id, amount')
          .eq('company_id', companyId)
          .in('matched_invoice_id', chunk);

        (matchedTxs || []).forEach(tx => {
          if (tx.matched_invoice_id) {
            const prev = paidByInvoiceId.get(tx.matched_invoice_id) || 0;
            paidByInvoiceId.set(tx.matched_invoice_id, prev + Math.abs(tx.amount || 0));
          }
        });
      }
    }

    const combined: AvailableInvoice[] = [];

    for (const inv of (invoices || [])) {
      let alreadyPaid = paidByInvoiceId.get(inv.id) || 0;
      if (inv.bizonylatsorszam) {
        const navIds = navByNumber.get(inv.bizonylatsorszam);
        if (navIds) {
          navIds.forEach(nid => { alreadyPaid += paidByInvoiceId.get(nid) || 0; });
        }
      }
      combined.push({
        id: inv.id,
        bizonylatsorszam: inv.bizonylatsorszam,
        brutto_vegosszeg: inv.brutto_vegosszeg,
        elado_nev: inv.elado_nev,
        penznem: inv.penznem,
        kibocsatas_datuma: inv.kibocsatas_datuma,
        already_paid: alreadyPaid,
        remaining: Math.abs(inv.brutto_vegosszeg || 0) - alreadyPaid,
      });
    }

    for (const nav of (navInvoices || [])) {
      let navAlreadyPaid = paidByInvoiceId.get(nav.id) || 0;
      if (nav.invoice_number) {
        const subIds = submittedByNumber.get(nav.invoice_number);
        if (subIds) {
          subIds.forEach(sid => { navAlreadyPaid += paidByInvoiceId.get(sid) || 0; });
        }
      }
      const navBrutto = Math.abs(nav.invoice_gross_amount || 0);
      combined.push({
        id: nav.id,
        bizonylatsorszam: nav.invoice_number,
        brutto_vegosszeg: nav.invoice_gross_amount || 0,
        elado_nev: nav.supplier_name || nav.customer_name || '',
        penznem: nav.currency,
        kibocsatas_datuma: nav.invoice_issue_date || '',
        already_paid: navAlreadyPaid,
        remaining: navBrutto - navAlreadyPaid,
      });
    }

    return combined;
  };

  const fetchAvailableInvoices = async () => {
    if (!transaction || !companyId) return;

    setLoadingAvailable(true);
    try {
      const transactionDate = new Date(transaction.transaction_date);
      const dateFrom = format(subDays(transactionDate, 180), 'yyyy-MM-dd');
      const dateTo = format(addDays(transactionDate, 30), 'yyyy-MM-dd');

      // 1. Fetch candidate invoices from both tables (2 parallel queries)
      const [{ data: invoices }, { data: navInvoices }] = await Promise.all([
        supabase
          .from('invoices')
          .select('id, bizonylatsorszam, brutto_vegosszeg, elado_nev, penznem, kibocsatas_datuma')
          .eq('company_id', companyId)
          .gte('kibocsatas_datuma', dateFrom)
          .lte('kibocsatas_datuma', dateTo)
          .order('kibocsatas_datuma', { ascending: false })
          .limit(200),
        supabase
          .from('nav_invoices')
          .select('id, invoice_number, invoice_gross_amount, supplier_name, customer_name, currency, invoice_issue_date, invoice_direction')
          .eq('company_id', companyId)
          .gte('invoice_issue_date', dateFrom)
          .lte('invoice_issue_date', dateTo)
          .order('invoice_issue_date', { ascending: false })
          .limit(200),
      ]);

      const combined = await buildAvailableInvoicesList(invoices || [], navInvoices || []);
      setAvailableInvoices(combined);
    } catch (error) {
      reportError({ type: 'db_query', component: 'TransactionDetailsDialog', action: 'error', message: 'Error fetching invoices:', error: error });
      toast({ title: 'Hiba a számlák betöltésekor', variant: 'destructive' });
    } finally {
      setLoadingAvailable(false);
    }
  };

  // Debounced full-database search for invoices across both invoices and nav_invoices
  useEffect(() => {
    if (!companyId) return;
    const query = search.trim();
    if (query.length < 2) {
      setServerSearchResults([]);
      setIsSearchingServer(false);
      return;
    }

    // Immediately set searching state so "Nincs találat" never flashes during debounce
    setIsSearchingServer(true);

    const timer = setTimeout(async () => {
      try {
        const cleanTerm = query.replace(/[%_]/g, '\\$&');

        const [{ data: invoices }, { data: navInvoices }] = await Promise.all([
          supabase
            .from('invoices')
            .select('id, bizonylatsorszam, brutto_vegosszeg, elado_nev, vevo_nev, penznem, kibocsatas_datuma')
            .eq('company_id', companyId)
            .or(`bizonylatsorszam.ilike.%${cleanTerm}%,elado_nev.ilike.%${cleanTerm}%,vevo_nev.ilike.%${cleanTerm}%`)
            .order('kibocsatas_datuma', { ascending: false })
            .limit(50),
          supabase
            .from('nav_invoices')
            .select('id, invoice_number, invoice_gross_amount, supplier_name, customer_name, currency, invoice_issue_date, invoice_direction')
            .eq('company_id', companyId)
            .or(`invoice_number.ilike.%${cleanTerm}%,supplier_name.ilike.%${cleanTerm}%,customer_name.ilike.%${cleanTerm}%`)
            .order('invoice_issue_date', { ascending: false })
            .limit(50),
        ]);

        const resolved = await buildAvailableInvoicesList(invoices || [], navInvoices || []);
        setServerSearchResults(resolved);
      } catch (err) {
        console.error('Server invoice search error:', err);
      } finally {
        setIsSearchingServer(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [search, companyId]);

  const handleShowManualMatch = () => {
    setShowManualMatch(true);
    fetchAvailableInvoices();
  };

  const handleVerify = async () => {
    if (!transaction) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ is_verified: true })
        .eq('id', transaction.id);

      if (error) throw error;

      toast({ title: 'Tranzakció jóváhagyva!' });
      invalidateAllMatches();
      onUpdate();
      onOpenChange(false);
    } catch (error) {
      reportError({ type: 'db_query', component: 'TransactionDetailsDialog', action: 'error', message: 'Error verifying transaction:', error: error });
      toast({ title: 'Hiba a jóváhagyás során', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ── Override logging for few-shot learning ──
  const logMatchOverride = async (
    correctedInvoiceId: string | null,
    correctedMatchType: string,
  ) => {
    if (!transaction || !companyId) return;
    try {
      // Get the original partner name from currently matched invoice
      const originalPartner = matchedInvoice?.elado_nev
        || matchedNavInvoice?.supplier_name
        || matchedNavInvoice?.customer_name
        || matchedSalary?.név
        || matchedSalary?.munkavallalo_neve
        || null;

      // Get the corrected partner name from the selected invoice in availableInvoices
      const correctedInv = correctedInvoiceId
        ? availableInvoices.find(inv => inv.id === correctedInvoiceId)
        : null;
      const correctedPartner = correctedInv?.elado_nev || null;

      const { data: { user } } = await supabase.auth.getUser();

      await supabase.from('match_transaction_overrides_log').insert({
        company_id: companyId,
        transaction_id: transaction.id,
        original_invoice_id: transaction.matched_invoice_id || null,
        original_match_type: transaction.match_type || null,
        corrected_invoice_id: correctedInvoiceId,
        corrected_match_type: correctedMatchType,
        transaction_description: transaction.description || '',
        transaction_amount: transaction.amount,
        original_partner_name: originalPartner,
        corrected_partner_name: correctedPartner,
        created_by: user?.id || null,
      });
    } catch (e) {
      // Fire-and-forget: don't block the main flow
      reportError({ type: 'db_query', severity: 'warning', component: 'TransactionDetailsDialog', action: 'warn', message: 'Failed to log match override', error: e });
    }
  };

  const handleMatch = async () => {
    if (!transaction || !selectedInvoiceId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          matched_invoice_id: selectedInvoiceId,
          is_verified: true,
          match_type: 'manual',
          confidence_score: 1.0
        })
        .eq('id', transaction.id);

      if (error) throw error;

      // Log the override for AI learning (fire-and-forget)
      logMatchOverride(selectedInvoiceId, 'manual');

      toast({ title: 'Tranzakció sikeresen párosítva!' });
      invalidateAllMatches();
      onUpdate();
      onOpenChange(false);
    } catch (error) {
      reportError({ type: 'db_query', component: 'TransactionDetailsDialog', action: 'error', message: 'Error matching transaction:', error: error });
      toast({ title: 'Hiba a párosítás mentésekor', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleUnmatch = async () => {
    if (!transaction) return;

    setSaving(true);
    try {
      // 1. Clear match on transactions table
      const { error } = await supabase
        .from('transactions')
        .update({
          matched_invoice_id: null,
          is_verified: false,
          match_type: null
        })
        .eq('id', transaction.id);

      if (error) throw error;

      // 2. Clear transaction_id on related invoices and salary records
      await supabase
        .from('invoices')
        .update({ transaction_id: null, fizetve: false })
        .eq('transaction_id', transaction.id);

      await supabase
        .from('nav_invoices')
        .update({ transaction_id: null, paid: false })
        .eq('transaction_id', transaction.id);

      await supabase
        .from('salary')
        .update({ transaction_id: null, statusz: 'Nyitott' })
        .eq('transaction_id', transaction.id);

      // 3. Delete from join table (transaction_invoice_matches)
      await supabase
        .from('transaction_invoice_matches')
        .delete()
        .eq('transaction_id', transaction.id);

      toast({ title: 'Párosítás megszüntetve!' });
      invalidateAllMatches();
      onUpdate();
      onOpenChange(false);
    } catch (error) {
      reportError({ type: 'db_query', component: 'TransactionDetailsDialog', action: 'error', message: 'Error unmatching transaction:', error: error });
      toast({ title: 'Hiba a párosítás megszüntetésekor', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleMarkNoInvoice = async () => {
    if (!transaction) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          match_type: 'no_invoice',
          matched_invoice_id: null,
          is_verified: false,
        })
        .eq('id', transaction.id);

      if (error) throw error;

      toast({ title: 'Tranzakció megjelölve: Nincs hozzá számla' });
      invalidateAllMatches();
      onUpdate();
      onOpenChange(false);
    } catch (error) {
      reportError({ type: 'db_query', component: 'TransactionDetailsDialog', action: 'error', message: 'Error marking no invoice:', error: error });
      toast({ title: 'Hiba a jelölés mentésekor', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleMarkInvoiceMissing = async () => {
    if (!transaction) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          match_type: 'invoice_missing',
          matched_invoice_id: null,
          is_verified: false,
        })
        .eq('id', transaction.id);

      if (error) throw error;

      toast({ title: 'Tranzakció megjelölve: Számla nincs feltöltve' });
      invalidateAllMatches();
      onUpdate();
      onOpenChange(false);
    } catch (error) {
      reportError({ type: 'db_query', component: 'TransactionDetailsDialog', action: 'error', message: 'Error marking invoice missing:', error: error });
      toast({ title: 'Hiba a jelölés mentésekor', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleRevertStatus = async () => {
    if (!transaction) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          match_type: null,
        })
        .eq('id', transaction.id);

      if (error) throw error;

      toast({ title: 'Státusz visszavonva' });
      invalidateAllMatches();
      onUpdate();
      onOpenChange(false);
    } catch (error) {
      reportError({ type: 'db_query', component: 'TransactionDetailsDialog', action: 'error', message: 'Error reverting status:', error: error });
      toast({ title: 'Hiba a visszavonás során', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ── Extra matches (join table) ──
  const fetchExtraMatches = async () => {
    if (!transaction) return;
    const { data } = await supabase
      .from('transaction_invoice_matches')
      .select('id, invoice_id, invoice_source')
      .eq('transaction_id', transaction.id);
    
    if (!data || data.length === 0) {
      setExtraMatches([]);
      return;
    }

    // Fetch invoice details for each extra match
    const enriched = await Promise.all(data.map(async (m) => {
      if (m.invoice_source === 'submitted') {
        const { data: inv } = await supabase
          .from('invoices')
          .select('id, bizonylatsorszam, kibocsatas_datuma, teljesites_datuma, elado_nev, vevo_nev, brutto_vegosszeg, penznem, invoice_type')
          .eq('id', m.invoice_id)
          .maybeSingle();
        return { ...m, invoice: inv as MatchedInvoice | null, navInvoice: null };
      } else {
        const { data: nav } = await supabase
          .from('nav_invoices')
          .select('id, invoice_number, invoice_issue_date, supplier_name, customer_name, invoice_gross_amount, currency, invoice_direction, transaction_id, submitted')
          .eq('id', m.invoice_id)
          .maybeSingle();
        return { ...m, invoice: null, navInvoice: nav as MatchedNavInvoice | null };
      }
    }));
    setExtraMatches(enriched);
  };

  const handleAddExtraMatch = async () => {
    if (!transaction || !selectedInvoiceId) return;
    setSaving(true);
    try {
      // Determine source: check if it's a submitted invoice or NAV
      const { data: submittedCheck } = await supabase
        .from('invoices')
        .select('id')
        .eq('id', selectedInvoiceId)
        .maybeSingle();

      const source = submittedCheck ? 'submitted' : 'nav';

      const { error } = await supabase
        .from('transaction_invoice_matches')
        .insert({
          transaction_id: transaction.id,
          invoice_id: selectedInvoiceId,
          invoice_source: source,
          created_by: 'manual',
        });

      if (error) throw error;

      // Log the override for AI learning (fire-and-forget)
      logMatchOverride(selectedInvoiceId, 'manual_extra');

      toast({ title: 'További számla sikeresen hozzáadva!' });
      invalidateAllMatches();
      setShowAddExtraMatch(false);
      setSelectedInvoiceId(null);
      setSearch('');
      fetchExtraMatches();
      onUpdate();
    } catch (error: any) {
      if (error?.code === '23505') {
        toast({ title: 'Ez a számla már hozzá van rendelve ehhez a tranzakcióhoz', variant: 'destructive' });
      } else {
        reportError({ type: 'db_query', component: 'TransactionDetailsDialog', action: 'error', message: 'Error adding extra match:', error: error });
        toast({ title: 'Hiba a számla hozzáadásakor', variant: 'destructive' });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveExtraMatch = async (matchId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('transaction_invoice_matches')
        .delete()
        .eq('id', matchId);

      if (error) throw error;

      toast({ title: 'További számla eltávolítva' });
      invalidateAllMatches();
      fetchExtraMatches();
      onUpdate();
    } catch (error) {
      reportError({ type: 'db_query', component: 'TransactionDetailsDialog', action: 'error', message: 'Error removing extra match:', error: error });
      toast({ title: 'Hiba az eltávolításkor', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Approximate exchange rates for frontend filtering only
  const approxRates: Record<string, number> = { EUR: 395, USD: 370, GBP: 470, CHF: 420 };
  const toHuf = (amount: number, currency?: string) => {
    const ccy = (currency || 'HUF').toUpperCase();
    if (ccy !== 'HUF' && approxRates[ccy]) return amount * approxRates[ccy];
    return amount;
  };

  const filteredInvoices = useMemo(() => {
    const txAmt = Math.abs(transaction?.amount || 0);
    const query = search.trim();

    // When no search: only show candidate invoices within tolerance of transaction amount
    if (!query) {
      let list = [...availableInvoices];
      if (txAmt > 0) {
        const txCcy = (transaction?.currency || 'HUF').toUpperCase();

        const filtered = list.filter(inv => {
          const invCcy = (inv.penznem || 'HUF').toUpperCase();
          const isSameCcy = txCcy === invCcy;

          // Compare in the same unit
          const invAmt = isSameCcy
            ? Math.abs(inv.brutto_vegosszeg || 0)
            : Math.abs(toHuf(inv.brutto_vegosszeg || 0, inv.penznem));
          const txComp = isSameCcy
            ? txAmt
            : toHuf(txAmt, transaction?.currency);

          const diff = Math.abs(invAmt - txComp);
          // Use wider tolerance (50%) for cross-currency, 30% for same currency
          const tolerance = isSameCcy ? 0.30 : 0.50;
          return diff / txComp <= tolerance;
        });

        // Always show at least 10 invoices (sorted by proximity) so the UI
        // never appears completely empty — which can confuse users.
        const MIN_SHOW = 10;
        if (filtered.length >= MIN_SHOW) {
          list = filtered;
        } else {
          // Sort full list by amount proximity, take top MIN_SHOW
          // Prioritize same-currency invoices
          const sorted = [...list].sort((a, b) => {
            const aSame = (a.penznem || 'HUF').toUpperCase() === txCcy;
            const bSame = (b.penznem || 'HUF').toUpperCase() === txCcy;
            if (aSame !== bSame) return aSame ? -1 : 1;

            const aAmt = aSame ? Math.abs(a.brutto_vegosszeg || 0) : toHuf(Math.abs(a.brutto_vegosszeg || 0), a.penznem);
            const bAmt = bSame ? Math.abs(b.brutto_vegosszeg || 0) : toHuf(Math.abs(b.brutto_vegosszeg || 0), b.penznem);
            const txComp = aSame ? txAmt : toHuf(txAmt, transaction?.currency);
            return Math.abs(aAmt - txComp) - Math.abs(bAmt - txComp);
          });
          list = sorted.slice(0, Math.max(MIN_SHOW, filtered.length));
        }
      }
      return list;
    }

    // When searching: merge serverSearchResults and local filtered availableInvoices
    const searchLower = query.toLowerCase();
    const searchNormalized = query.replace(',', '.');

    const localMatches = availableInvoices.filter(inv => {
      // Text match on invoice number or vendor name
      if (inv.bizonylatsorszam?.toLowerCase().includes(searchLower)) return true;
      if (inv.elado_nev?.toLowerCase().includes(searchLower)) return true;

      // Amount match: compare as formatted string and as number
      if (inv.brutto_vegosszeg != null) {
        const amt = inv.brutto_vegosszeg;
        const amtStr = amt.toString();
        const amtFixed2 = amt.toFixed(2);
        const amtInt = Math.round(amt).toString();
        if (amtStr.includes(searchNormalized) || amtFixed2.includes(searchNormalized) || amtInt.includes(searchNormalized)) return true;
        if (amtStr.includes(query) || amtFixed2.includes(query)) return true;
      }
      return false;
    });

    // Combine server and local matches, deduplicated by ID
    const seenIds = new Set<string>();
    const merged: AvailableInvoice[] = [];
    [...serverSearchResults, ...localMatches].forEach(item => {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        merged.push(item);
      }
    });

    // Always sort by proximity to transaction amount (currency-aware)
    const txCcyFinal = (transaction?.currency || 'HUF').toUpperCase();
    merged.sort((a, b) => {
      const aCcy = (a.penznem || 'HUF').toUpperCase();
      const bCcy = (b.penznem || 'HUF').toUpperCase();
      // Same-currency invoices get priority
      const aSame = aCcy === txCcyFinal;
      const bSame = bCcy === txCcyFinal;
      if (aSame !== bSame) return aSame ? -1 : 1;

      const aAmt = aSame ? Math.abs(a.brutto_vegosszeg || 0) : toHuf(Math.abs(a.brutto_vegosszeg || 0), a.penznem);
      const bAmt = bSame ? Math.abs(b.brutto_vegosszeg || 0) : toHuf(Math.abs(b.brutto_vegosszeg || 0), b.penznem);
      const txComp = aSame ? txAmt : toHuf(txAmt, transaction?.currency);
      const diffA = Math.abs(aAmt - txComp);
      const diffB = Math.abs(bAmt - txComp);
      return diffA - diffB;
    });

    return merged;
  }, [availableInvoices, serverSearchResults, search, transaction?.amount, transaction?.currency]);

  const transactionAmount = transaction?.amount || 0;
  const matchStatus = transaction ? computeMatchStatus(transaction) : 'unmatched';

  if (!transaction) return null;

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-[540px] max-h-screen overflow-y-auto flex flex-col p-6">
        <SheetHeader className="pb-2 text-left">
          <SheetTitle className="flex items-center gap-2 text-base justify-start">
            <FileText className="h-4 w-4" />
            Tranzakció részletei
          </SheetTitle>
          <SheetDescription className="text-xs text-left">
            Tranzakció és párosított számla adatai
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {/* Transaction Details - Compact */}
        <Card className="bg-muted/30 border-border/50">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-medium flex items-center justify-between">
              <span>Tranzakció</span>
              {matchStatus === 'matched' && (
                <Badge variant="success" className="gap-1 text-[10px] h-5">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  Párosított
                </Badge>
              )}
              {matchStatus === 'suggested' && (
                <Badge className="gap-1 text-[10px] h-5 bg-yellow-500/15 text-yellow-600 border-yellow-500/30 hover:bg-yellow-500/15">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  Javasolt
                </Badge>
              )}
              {matchStatus === 'unmatched' && (
                <Badge variant="destructive" className="gap-1 text-[10px] h-5">
                  <HelpCircle className="h-2.5 w-2.5" />
                  Párosítatlan
                </Badge>
              )}
              {matchStatus === 'no_invoice' && (
                <Badge className="gap-1 text-[10px] h-5 bg-purple-500/15 text-purple-600 border-purple-500/30 hover:bg-purple-500/15">
                  <Ban className="h-2.5 w-2.5" />
                  Nincs hozzá számla
                </Badge>
              )}
              {matchStatus === 'invoice_missing' && (
                <Badge className="gap-1 text-[10px] h-5 bg-sky-500/15 text-sky-600 border-sky-500/30 hover:bg-sky-500/15">
                  <UploadCloud className="h-2.5 w-2.5" />
                  Számla nincs feltöltve
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Dátum:</span>
                <span className="ml-1 font-medium">
                  {format(new Date(transaction.transaction_date), 'yyyy.MM.dd')}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Összeg:</span>
                <span className={cn(
                  "ml-1 font-medium font-mono",
                  transaction.amount >= 0 ? "text-success" : "text-destructive"
                )}>
                  {formatCurrency(transaction.amount, transaction.currency || 'HUF')}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Leírás:</span>
                <span className="ml-1">{transaction.description || '-'}</span>
              </div>
              {transaction.reason && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">AI indoklás:</span>
                  <p className="mt-1 text-[10px] bg-background/50 p-1.5 rounded border border-border/30 max-h-[80px] overflow-y-auto">
                    {transaction.reason}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Undo status button for no_invoice / invoice_missing */}
        {(matchStatus === 'no_invoice' || matchStatus === 'invoice_missing') && (
          <div className="flex items-center justify-between px-1">
            <p className="text-[11px] text-muted-foreground">
              {matchStatus === 'no_invoice'
                ? 'Megjelölve: nincs hozzá számla — könyvelő feladata'
                : 'Megjelölve: számla nincs feltöltve — fel kell tölteni'}
            </p>
            <Button
              variant="ghost"
              size="sm"
              disabled={saving}
              onClick={handleRevertStatus}
              className="text-xs h-7 gap-1 text-muted-foreground hover:text-foreground"
            >
              <Undo2 className="h-3 w-3" />
              Visszavonás
            </Button>
          </div>
        )}

        {/* Matched Courier Reports */}
        {matchedCourierReports.length > 0 && (
          <>
            <Separator className="my-1" />
            <Card className="bg-muted/30 border-border/50">
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-xs font-medium flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5" />
                    Futár riport
                  </span>
                  <Badge variant="outline" className="text-[10px] h-5">
                    {matchedCourierReports.length} tétel
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {matchedCourierReports.map((report) => (
                    <div key={report.id} className="rounded-md border border-border/50 bg-background/50 p-2.5 text-xs">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-medium font-mono">
                          {report.package_number || 'Összesítő sor'}
                        </span>
                        <Badge variant="outline" className={cn(
                          "text-[10px] h-4",
                          report.report_type === 'gls' && 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30',
                          report.report_type === 'mpl' && 'bg-blue-500/10 text-blue-700 border-blue-500/30',
                          report.report_type === 'mixpack' && 'bg-purple-500/10 text-purple-700 border-purple-500/30'
                        )}>
                          {report.report_type === 'gls' ? 'GLS' : report.report_type === 'mpl' ? 'MPL / Posta' : 'Mixpack'}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-[11px]">
                        {report.reference_number && (
                          <div>
                            <span className="text-muted-foreground">Hivatkozás:</span>
                            <span className="ml-1 font-mono">{report.reference_number}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-muted-foreground">Kézbesítés:</span>
                          <span className="ml-1">
                            {report.delivery_date
                              ? format(new Date(report.delivery_date), 'yyyy.MM.dd')
                              : '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Utánvét:</span>
                          <span className="ml-1 font-mono font-medium">
                            {report.cod_amount != null
                              ? formatCurrency(report.cod_amount)
                              : '-'}
                          </span>
                        </div>
                        {report.recipient_name && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Címzett:</span>
                            <span className="ml-1">{report.recipient_name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <Separator className="my-1" />

        {/* Matched Invoice Section - Simplified */}
        {transaction.matched_invoice_id && !showManualMatch && (
          <>
            <Card 
              className={cn(
                "bg-muted/30 border-border/50 transition-colors",
                (matchedInvoice || matchedSalary) && "cursor-pointer hover:border-primary/50"
              )}
              onClick={() => {
                if (matchedInvoice) {
                  setInvoiceDetailId(matchedInvoice.id);
                  setInvoiceDetailOpen(true);
                } else if (matchedSalary) {
                  onOpenChange(false);
                  scopedNavigate('salaries');
                }
              }}
            >
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-xs font-medium flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    {matchedSalary ? <Wallet className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                    {matchedSalary ? 'Párosított bértétel' : matchedNavInvoice ? 'Párosított NAV számla' : 'Párosított számla'}
                    {matchedNavInvoice && (
                      <Badge className="text-[9px] h-4 px-1.5 bg-indigo-500/15 text-indigo-600 border-indigo-500/30">NAV</Badge>
                    )}
                    {matchedInvoice && !matchedNavInvoice && (
                      <Badge className="text-[9px] h-4 px-1.5 bg-teal-500/15 text-teal-600 border-teal-500/30">Beküldött</Badge>
                    )}
                  </span>
                  {(matchedInvoice || matchedSalary) && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {matchedSalary ? 'Kattints a bérek oldalhoz' : 'Kattints a részletekért'}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                {loadingInvoice ? (
                  <div className="flex items-center justify-center py-2">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : matchedInvoice ? (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Bizonylatsorszám:</span>
                      <span className="ml-1 font-mono font-medium">{matchedInvoice.bizonylatsorszam || '-'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Eladó:</span>
                      <span className="ml-1 font-medium">{matchedInvoice.elado_nev || '-'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Vevő:</span>
                      <span className="ml-1 font-medium">{matchedInvoice.vevo_nev || '-'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Kiállítás:</span>
                      <span className="ml-1">
                        {matchedInvoice.kibocsatas_datuma 
                          ? format(new Date(matchedInvoice.kibocsatas_datuma), 'yyyy.MM.dd')
                          : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Bruttó:</span>
                      <span className="ml-1 font-mono font-medium">
                        {formatCurrency(matchedInvoice.brutto_vegosszeg || 0, matchedInvoice.penznem || 'HUF')}
                      </span>
                    </div>
                  </div>
                ) : matchedNavInvoice ? (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Számlaszám:</span>
                      <span className="ml-1 font-mono font-medium">{matchedNavInvoice.invoice_number}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Szállító:</span>
                      <span className="ml-1 font-medium">{matchedNavInvoice.supplier_name || '-'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Vevő:</span>
                      <span className="ml-1 font-medium">{matchedNavInvoice.customer_name || '-'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Kiállítás:</span>
                      <span className="ml-1">
                        {matchedNavInvoice.invoice_issue_date 
                          ? format(new Date(matchedNavInvoice.invoice_issue_date), 'yyyy.MM.dd')
                          : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Bruttó:</span>
                      <span className="ml-1 font-mono font-medium">
                        {formatCurrency(matchedNavInvoice.invoice_gross_amount || 0, matchedNavInvoice.currency || 'HUF')}
                      </span>
                    </div>
                    <div className="col-span-2 flex gap-1">
                      {matchedNavInvoice.invoice_direction && (
                        <Badge variant="outline" className="text-[10px] h-5">
                          {matchedNavInvoice.invoice_direction === 'INBOUND' ? 'Bejövő' : 'Kimenő'}
                        </Badge>
                      )}
                      {!!matchedNavInvoice.transaction_id && (
                        <Badge variant="success" className="text-[10px] h-5">Fizetve</Badge>
                      )}
                      {matchedNavInvoice.submitted && (
                        <Badge variant="outline" className="text-[10px] h-5">Beküldve</Badge>
                      )}
                    </div>
                  </div>
                ) : matchedSalary ? (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Megnevezés:</span>
                      <span className="ml-1 font-medium">{matchedSalary.név}</span>
                    </div>
                    {matchedSalary.munkavallalo_neve && (
                      <div>
                        <span className="text-muted-foreground">Munkavállaló:</span>
                        <span className="ml-1 font-medium">{matchedSalary.munkavallalo_neve}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground">Típus:</span>
                      <span className="ml-1">{matchedSalary.tipus}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Dátum:</span>
                      <span className="ml-1">
                        {matchedSalary.dátum 
                          ? format(new Date(matchedSalary.dátum), 'yyyy.MM.dd')
                          : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Összeg:</span>
                      <span className="ml-1 font-mono font-medium">
                        {formatCurrency(matchedSalary.összeg)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Fizetési mód:</span>
                      <span className="ml-1">{matchedSalary.fizetesi_mod}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Státusz:</span>
                      {(() => {
                        const badge = getPaymentStatusBadge(matchedSalary.transaction_id);
                        return <Badge variant="outline" className={cn("ml-1 text-[10px] h-5", badge.className)}>{badge.label}</Badge>;
                      })()}
                    </div>
                    {matchedSalary.megjegyzes && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Megjegyzés:</span>
                        <span className="ml-1">{matchedSalary.megjegyzes}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 py-1">
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-amber-500">Törölt bizonylat</p>
                      <p className="text-[10px] text-muted-foreground">A párosított bizonylat már nem létezik az adatbázisban (árva hivatkozás).</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex flex-col gap-2 pt-4 w-full mt-4 border-t border-border/40 bg-background sticky bottom-0">
              {matchStatus === 'suggested' && (
                <Button 
                  size="sm" 
                  onClick={handleVerify} 
                  disabled={saving} 
                  className="text-xs h-10 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex items-center justify-center gap-1.5"
                >
                  <Check className="h-3.5 w-3.5" />
                  {saving ? 'Mentés...' : 'Elfogadás (Rendben)'}
                </Button>
              )}
              
              <div className="grid grid-cols-2 gap-2 w-full">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleShowManualMatch} 
                  className="text-xs h-10 w-full flex items-center justify-center gap-1"
                >
                  <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                  Másik számla
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => { setShowAddExtraMatch(true); fetchAvailableInvoices(); }} 
                  className="text-xs h-10 w-full flex items-center justify-center gap-1"
                >
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  További számla
                </Button>
              </div>

              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleUnmatch} 
                disabled={saving} 
                className="text-xs h-10 w-full text-red-500 hover:text-red-600 border-red-500/30 hover:border-red-500/50 hover:bg-red-500/10 mt-1 flex items-center justify-center"
              >
                Párosítás bontása
              </Button>
            </div>

            {/* Extra matches from join table */}
            {extraMatches.length > 0 && (
              <div className="space-y-1.5 mt-2">
                <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">További párosított számlák</h4>
                {extraMatches.map((em) => (
                  <Card key={em.id} className="bg-muted/20 border-border/40">
                    <CardContent className="p-2 flex items-center justify-between">
                      <div className="text-xs space-y-0.5">
                        {em.invoice ? (
                          <>
                            <span className="font-mono font-medium">{em.invoice.bizonylatsorszam || '-'}</span>
                            <span className="text-muted-foreground mx-1">·</span>
                            <span>{em.invoice.elado_nev}</span>
                            <span className="text-muted-foreground mx-1">·</span>
                            <span className="font-mono">{formatCurrency(em.invoice.brutto_vegosszeg, em.invoice.penznem || 'HUF')}</span>
                            <Badge className="ml-1.5 text-[8px] h-3.5 px-1 bg-teal-500/15 text-teal-600 border-teal-500/30">Beküldött</Badge>
                          </>
                        ) : em.navInvoice ? (
                          <>
                            <span className="font-mono font-medium">{em.navInvoice.invoice_number || '-'}</span>
                            <span className="text-muted-foreground mx-1">·</span>
                            <span>{em.navInvoice.supplier_name || em.navInvoice.customer_name || '-'}</span>
                            <span className="text-muted-foreground mx-1">·</span>
                            <span className="font-mono">{formatCurrency(em.navInvoice.invoice_gross_amount || 0, em.navInvoice.currency || 'HUF')}</span>
                            <Badge className="ml-1.5 text-[8px] h-3.5 px-1 bg-indigo-500/15 text-indigo-600 border-indigo-500/30">NAV</Badge>
                          </>
                        ) : (
                          <span className="text-muted-foreground">Törölt bizonylat</span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs text-destructive hover:text-destructive"
                        onClick={() => handleRemoveExtraMatch(em.id)}
                        disabled={saving}
                      >
                        Eltávolítás
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {/* Direct Ledger Classification (Unmatched only) */}
        {!transaction.matched_invoice_id && (
          <>
            <Separator className="my-1" />
            <Card className="bg-muted/30 border-border/50">
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                  <ClipboardCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  Közvetlen könyvelés (Számla nélkül)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 space-y-3">
                {transaction.gl_account_id ? (
                  <div className="space-y-2">
                    <div className="bg-emerald-500/10 dark:bg-emerald-950/20 border border-emerald-500/20 rounded-md p-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                          Lekönyvelt számlaosztály:
                        </p>
                        <p className="text-xs font-mono font-bold mt-1 truncate">
                          {(() => {
                            const gl = glAccounts.find(g => g.id === transaction.gl_account_id);
                            return gl ? `${gl.gl_number} ${gl.short_name}` : transaction.gl_account_id;
                          })()}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-emerald-800 hover:text-emerald-900 shrink-0"
                        onClick={() => {
                          setSelectedGlId(transaction.gl_account_id || '');
                          setIsEditingGl(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {!isEditingGl && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={saving}
                        onClick={handleUnbookTransaction}
                        className="text-xs w-full text-red-500 hover:text-red-600 border-red-500/30 hover:bg-red-500/10 h-8"
                      >
                        <Undo2 className="h-3.5 w-3.5 mr-1" />
                        Könyvelés törlése
                      </Button>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Ha a tételhez nem tartozik bizonylat (pl. biztosítási díj, banki jutalék), közvetlenül kontírozhatod egy főkönyvi számra.
                  </p>
                )}

                {(isEditingGl || !transaction.gl_account_id) && (
                  <div className="space-y-2 pt-1">
                    <div className="relative">
                      <Command className="rounded-lg border shadow-sm w-full overflow-hidden h-[180px]" shouldFilter={false}>
                        <CommandInput 
                          placeholder="Keresés főkönyvi szám vagy név alapján..." 
                          value={glSearchQuery}
                          onValueChange={setGlSearchQuery}
                          className="h-8 text-xs w-full border-none focus:ring-0"
                        />
                        <CommandList className="h-[140px] max-h-[140px] overflow-y-auto w-full overflow-x-hidden">
                          <CommandEmpty className="py-2 text-xs text-center text-muted-foreground">Nincs találat.</CommandEmpty>
                          <CommandGroup>
                            {glAccounts
                              ?.filter(gl => !glSearchQuery || `${gl.gl_number} ${gl.short_name}`.toLowerCase().includes(glSearchQuery.toLowerCase()))
                              .sort((a, b) => cleanGlNum(a.gl_number).localeCompare(cleanGlNum(b.gl_number)))
                              .map(gl => {
                                // Only show leaf nodes
                                const isLeaf = !glAccounts.some(sub => cleanGlNum(sub.gl_number).startsWith(cleanGlNum(gl.gl_number)) && sub.id !== gl.id);
                                if (!isLeaf) return null;
                                
                                return (
                                  <CommandItem
                                    key={gl.id}
                                    value={`${gl.gl_number} ${gl.short_name}`}
                                    onSelect={() => setSelectedGlId(gl.id)}
                                    className="cursor-pointer py-1.5 px-2.5 text-xs flex items-center justify-between hover:bg-muted/50"
                                  >
                                    <span className={cn("truncate", selectedGlId === gl.id ? "font-bold text-foreground" : "")}>
                                      {gl.gl_number} {gl.short_name}
                                    </span>
                                    {selectedGlId === gl.id && <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
                                  </CommandItem>
                                );
                              })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </div>

                    <div className="flex gap-2">
                      {isEditingGl && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setIsEditingGl(false);
                            setSelectedGlId('');
                            setGlSearchQuery('');
                          }}
                          className="text-xs flex-1 h-8"
                        >
                          Mégse
                        </Button>
                      )}
                      <Button
                        size="sm"
                        disabled={!selectedGlId || saving || (transaction.gl_account_id === selectedGlId)}
                        onClick={handleBookTransaction}
                        className="text-xs flex-1 h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                      >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                        {transaction.gl_account_id ? 'Módosítás mentése' : 'Kontírozás közvetlenül'}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Manual Match Section - Smart Matching */}
        {(showManualMatch || !transaction.matched_invoice_id) && (
          <>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-medium flex items-center gap-1.5">
                    <Link2 className="h-3.5 w-3.5 text-primary" />
                    {transaction.matched_invoice_id ? 'Másik számla választása' : 'Manuális párosítás'}
                  </h4>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Összeg alapján rendezve · keresett: <span className="font-mono font-medium">{formatCurrency(transactionAmount, transaction.currency || 'HUF')}</span>
                  </p>
                </div>
                {transaction.matched_invoice_id && (
                  <Button variant="ghost" size="sm" onClick={() => setShowManualMatch(false)} className="h-6 text-xs">
                    Vissza
                  </Button>
                )}
              </div>

              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder={`Keresés számlaszám, partner vagy összeg alapján...`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 pr-8 h-8 text-xs"
                  autoFocus
                />
                {isSearchingServer && (
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Results count */}
              {!loadingAvailable && (
                <div className="flex items-center justify-between text-[10px] text-muted-foreground px-0.5">
                  <span>{search ? `${filteredInvoices.length} találat` : `${filteredInvoices.length} számla az időszakban (±180 nap)`}</span>
                </div>
              )}

              <div className="min-h-[240px] max-h-[240px] overflow-y-auto border rounded-md">
                {loadingAvailable ? (
                  <div className="flex items-center justify-center h-20">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : filteredInvoices.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-20 text-muted-foreground">
                    {isSearchingServer ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        <p className="text-xs mt-2">Keresés a számlák között...</p>
                      </>
                    ) : (
                      <>
                        <FileText className="h-5 w-5 mb-1" />
                        <p className="text-xs">{search ? 'Nincs találat a keresésre' : 'Nincs elérhető számla az időszakban'}</p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="p-1.5 space-y-1">
                    {filteredInvoices.map((invoice) => {
                      const isSelected = selectedInvoiceId === invoice.id;
                      const invoiceAmt = invoice.brutto_vegosszeg || 0;
                      const txCurrency = (transaction.currency || 'HUF').toUpperCase();
                      const invCurrency = (invoice.penznem || 'HUF').toUpperCase();
                      const isSameCurrency = txCurrency === invCurrency;

                      // Compare in the same unit: if same currency, compare directly;
                      // otherwise convert both to HUF for comparison
                      const txAbs = Math.abs(transactionAmount);
                      let compareInvAmt: number;
                      let compareTxAmt: number;
                      let diffCurrency: string;

                      if (isSameCurrency) {
                        compareInvAmt = Math.abs(invoiceAmt);
                        compareTxAmt = txAbs;
                        diffCurrency = invCurrency;
                      } else {
                        compareInvAmt = toHuf(Math.abs(invoiceAmt), invoice.penznem);
                        compareTxAmt = toHuf(txAbs, transaction.currency);
                        diffCurrency = 'HUF';
                      }

                      const diff = compareInvAmt - compareTxAmt;
                      const absDiff = Math.abs(diff);
                      const isExact = absDiff < (isSameCurrency ? 0.01 : 1);
                      const isNear = !isExact && compareTxAmt > 0 && absDiff < compareTxAmt * 0.05;
                      const pctDiff = compareTxAmt > 0 ? (absDiff / compareTxAmt * 100) : 0;

                      const partnerName = invoice.elado_nev?.toLowerCase() || '';
                      const txDesc = transaction.description?.toLowerCase() || '';
                      const cleanPartnerName = partnerName.replace(/\b(kft|zrt|bt|s\.r\.o\.|ev\.)\b/g, '').trim();
                      const hasPartnerMatch = cleanPartnerName.length > 2 && txDesc.includes(cleanPartnerName);

                      return (
                        <div
                          key={invoice.id}
                          className={cn(
                            "rounded-md border p-2.5 cursor-pointer transition-all",
                            isSelected
                              ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                              : "hover:bg-muted/40 hover:border-border",
                            isExact && !isSelected && "border-emerald-500/40 bg-emerald-500/5",
                            isNear && !isSelected && "border-amber-500/30 bg-amber-500/5"
                          )}
                          onClick={() => setSelectedInvoiceId(invoice.id)}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                {isSelected && <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />}
                                <p className="font-medium font-mono text-xs truncate">{invoice.bizonylatsorszam}</p>
                              </div>
                              <p className="text-muted-foreground text-[10px] mt-0.5 truncate flex items-center gap-1.5">
                                <span className="truncate">{invoice.elado_nev || '-'}</span>
                                {hasPartnerMatch && (
                                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[8px] h-3.5 px-1 font-semibold leading-none shrink-0 hover:bg-emerald-500/10">
                                    Partner egyezik
                                  </Badge>
                                )}
                              </p>
                              <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                                {invoice.kibocsatas_datuma ? format(new Date(invoice.kibocsatas_datuma), 'yyyy.MM.dd') : ''}
                              </p>
                              {(() => {
                                const brutto = Math.abs(invoice.brutto_vegosszeg || 0);
                                const paid = invoice.already_paid || 0;
                                const rem = brutto - paid;
                                if (paid >= brutto && brutto > 0) {
                                  return (
                                    <Badge className="text-[8px] h-3.5 px-1 mt-0.5 bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/10">
                                      Kifizetve
                                    </Badge>
                                  );
                                } else if (paid > 0) {
                                  return (
                                    <Badge className="text-[8px] h-3.5 px-1 mt-0.5 bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/10">
                                      Részben fizetve, fennmaradó: {formatCurrency(rem, invoice.penznem || 'HUF')}
                                    </Badge>
                                  );
                                } else {
                                  return (
                                    <Badge className="text-[8px] h-3.5 px-1 mt-0.5 bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500/10">
                                      Nincs fizetve
                                    </Badge>
                                  );
                                }
                              })()}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-mono font-medium text-xs">
                                {formatCurrency(invoice.brutto_vegosszeg || 0, invoice.penznem || 'HUF')}
                              </p>
                              {isExact ? (
                                <Badge variant="success" className="text-[9px] h-4 mt-0.5">✓ Egyező</Badge>
                              ) : isNear ? (
                                <Badge className="text-[9px] h-4 mt-0.5 bg-amber-500/20 text-amber-600 border-amber-500/30 hover:bg-amber-500/20">
                                  ~{pctDiff.toFixed(0)}% elt.
                                </Badge>
                              ) : (
                                <span className="text-[10px] text-muted-foreground/60 mt-0.5 block">
                                  {diff > 0 ? '+' : ''}{formatCurrency(diff, diffCurrency)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-4 w-full mt-4 border-t border-border/40 bg-background sticky bottom-0">
              {/* Status marking buttons */}
              <div className="flex items-center gap-2 w-full">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={saving}
                  onClick={handleMarkNoInvoice}
                  className={cn(
                    "text-xs h-10 flex-1 border-purple-500/30 hover:bg-purple-500/10",
                    matchStatus === 'no_invoice' && "bg-purple-500/15 border-purple-500/50"
                  )}
                >
                  <Ban className="h-3 w-3 mr-1 text-purple-500" />
                  Nincs hozzá számla
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={saving}
                  onClick={handleMarkInvoiceMissing}
                  className={cn(
                    "text-xs h-10 flex-1 border-sky-500/30 hover:bg-sky-500/10",
                    matchStatus === 'invoice_missing' && "bg-sky-500/15 border-sky-500/50"
                  )}
                >
                  <UploadCloud className="h-3 w-3 mr-1 text-sky-500" />
                  Számla nincs feltöltve
                </Button>
              </div>
              {/* Match action */}
              <div className="flex justify-end w-full">
                <Button
                  size="sm"
                  disabled={!selectedInvoiceId || saving}
                  onClick={handleMatch}
                  className="text-xs h-10 w-full"
                >
                  <Check className="h-3 w-3 mr-1" />
                  {saving ? 'Mentés...' : 'Párosítás mentése'}
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Add Extra Match Section */}
        {showAddExtraMatch && (
          <>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-medium flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    További számla hozzáadása
                  </h4>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    A kiválasztott számla kiegészítő párosításként kerül a tranzakcióhoz
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setShowAddExtraMatch(false); setSelectedInvoiceId(null); setSearch(''); }} className="h-6 text-xs">
                  Vissza
                </Button>
              </div>

              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Keresés számlaszám, partner vagy összeg alapján..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 pr-8 h-8 text-xs"
                  autoFocus
                />
                {isSearchingServer && (
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>

              <div className="min-h-[200px] max-h-[200px] overflow-y-auto border rounded-md">
                {loadingAvailable ? (
                  <div className="flex items-center justify-center h-20">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : filteredInvoices.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-20 text-muted-foreground">
                    {isSearchingServer ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        <p className="text-xs mt-2">Keresés a számlák között...</p>
                      </>
                    ) : (
                      <>
                        <FileText className="h-5 w-5 mb-1" />
                        <p className="text-xs">{search ? 'Nincs találat' : 'Nincs elérhető számla'}</p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="p-1.5 space-y-1">
                    {filteredInvoices.map((invoice) => {
                      const isSelected = selectedInvoiceId === invoice.id;
                      const isAlreadyPrimary = transaction.matched_invoice_id === invoice.id;
                      const isAlreadyExtra = extraMatches.some(em => em.invoice_id === invoice.id);

                      if (isAlreadyPrimary || isAlreadyExtra) return null;

                      return (
                        <div
                          key={invoice.id}
                          className={cn(
                            "rounded-md border p-2 cursor-pointer transition-all text-xs",
                            isSelected
                              ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                              : "hover:bg-muted/40"
                          )}
                          onClick={() => setSelectedInvoiceId(invoice.id)}
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {isSelected && <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />}
                              <span className="font-mono font-medium truncate">{invoice.bizonylatsorszam}</span>
                              <span className="text-muted-foreground">·</span>
                              <span className="truncate">{invoice.elado_nev || '-'}</span>
                            </div>
                            <span className="font-mono font-medium shrink-0 ml-2">{formatCurrency(invoice.brutto_vegosszeg, invoice.penznem || 'HUF')}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end w-full pt-4 mt-4 border-t border-border/40 bg-background sticky bottom-0">
              <Button
                size="sm"
                disabled={!selectedInvoiceId || saving}
                onClick={handleAddExtraMatch}
                className="text-xs h-10 w-full"
              >
                <Check className="h-3 w-3 mr-1" />
                {saving ? 'Mentés...' : 'Hozzáadás'}
              </Button>
            </div>
          </>
        )}
        {/* Transaction Notes Section */}
        {!showManualMatch && !showAddExtraMatch && (
          <>
            <Separator className="my-2" />
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <ClipboardCheck className="h-3.5 w-3.5 text-primary" />
                Kapcsolódó feljegyzések
              </div>

              {loadingNotes ? (
                <div className="flex items-center justify-center py-2">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : notes.length > 0 ? (
                <div className="space-y-2">
                  {notes.map((note: any) => (
                    <Card key={note.id} className="bg-primary/[0.01] border-primary/10">
                      <CardHeader className="py-2 px-3 border-b border-border/10">
                        <CardTitle className="text-xs font-semibold flex items-center justify-between text-foreground">
                          <span className="truncate max-w-[200px]">{note.title || 'Névtelen jegyzet'}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            {note.is_private ? (
                              <Badge variant="outline" className="text-[9px] h-4.5 px-1.5 gap-1 bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400">
                                <Lock className="h-2.5 w-2.5" />
                                Privát
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[9px] h-4.5 px-1.5 gap-1 bg-primary/10 text-primary border-primary/20">
                                <Users className="h-2.5 w-2.5" />
                                Közös
                              </Badge>
                            )}
                            <span className="text-[9px] text-muted-foreground font-mono">
                              {format(new Date(note.created_at), 'yyyy.MM.dd')}
                            </span>
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 space-y-1">
                        <p className="text-muted-foreground text-xs whitespace-pre-wrap leading-normal font-sans">{note.content}</p>
                        <div className="text-[9px] text-muted-foreground/80 pt-1">
                          Rögzítette: {note.profile_name}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic pl-1">Nincs kapcsolódó feljegyzés ehhez a tranzakcióhoz.</p>
              )}

              {/* Add Note Form */}
              <form onSubmit={handleAddNote} className="space-y-3 pt-3 border-t border-border/10">
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Jegyzet címe</span>
                  <Input
                    placeholder="pl. Határidő, Megjegyzés..."
                    value={newNoteTitle}
                    onChange={(e) => setNewNoteTitle(e.target.value)}
                    className="h-8 text-xs bg-background/30 border-border/50"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Tartalom</span>
                  <Textarea
                    placeholder="Írd ide a jegyzet szöveges tartalmát..."
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    required
                    rows={2}
                    className="text-xs bg-background/30 border-border/50 resize-none min-h-[56px]"
                  />
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Láthatóság</span>
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Private Card Button */}
                    <button
                      type="button"
                      onClick={() => setNewNotePrivate(true)}
                      className={cn(
                        "flex items-start gap-2.5 p-2 rounded-lg border text-left transition-all",
                        newNotePrivate
                          ? "border-primary/60 bg-primary/5 dark:bg-primary/10 shadow-sm"
                          : "border-border bg-transparent hover:bg-muted/30"
                      )}
                    >
                      <Lock className={cn("h-4 w-4 mt-0.5 shrink-0", newNotePrivate ? "text-primary" : "text-muted-foreground")} />
                      <div>
                        <p className="text-[11px] font-semibold">Privát</p>
                        <p className="text-[9px] text-muted-foreground">Csak te látod</p>
                      </div>
                    </button>

                    {/* Public Card Button */}
                    <button
                      type="button"
                      onClick={() => setNewNotePrivate(false)}
                      className={cn(
                        "flex items-start gap-2.5 p-2 rounded-lg border text-left transition-all",
                        !newNotePrivate
                          ? "border-primary/60 bg-primary/5 dark:bg-primary/10 shadow-sm"
                          : "border-border bg-transparent hover:bg-muted/30"
                      )}
                    >
                      <Users className={cn("h-4 w-4 mt-0.5 shrink-0", !newNotePrivate ? "text-primary" : "text-muted-foreground")} />
                      <div>
                        <p className="text-[11px] font-semibold">Közös</p>
                        <p className="text-[9px] text-muted-foreground">Cégtagok látják</p>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <Button
                    type="submit"
                    size="sm"
                    className="h-8 px-4 gap-1.5"
                    disabled={addingNote || !newNoteText.trim()}
                  >
                    {addingNote ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    Mentés
                  </Button>
                </div>
              </form>
            </div>
          </>
        )}
        </div>
      </SheetContent>
    </Sheet>

    <InvoiceDetailPopup
      open={invoiceDetailOpen}
      onOpenChange={setInvoiceDetailOpen}
      invoiceId={invoiceDetailId}
    />
    </>
  );
};
