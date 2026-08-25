import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { TableBody, TableRow, TableCell, TableHead, TableHeader } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn, formatCurrency } from '@/lib/utils';
import { CheckCircle2, AlertCircle, HelpCircle, ArrowUpDown, Eye, Settings, Ban, UploadCloud, ChevronDown, Link2, Link2Off, Copy, Download, FileText, X, Trash2, Lock, Users, Loader2, Plus, ClipboardCheck, Pencil, Check, Undo2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { computeMatchStatus } from '@/hooks/useComputedStatus';
import { TransactionReasonCell } from '@/components/TransactionReasonCell';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { TableEmptyState } from '@/components/ui/table-empty-state';
import { TablePlaceholderRows } from '@/components/ui/table-placeholder-rows';
import type { Transaction } from '@/hooks/useTransactionData';
import { useExchangeRates } from '@/hooks/useExchangeRates';
import { supabase } from '@/integrations/supabase/client';
import { reportError } from '@/lib/errorReporter';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { hu } from 'date-fns/locale';
import { useActivePreset } from '@/hooks/useActivePreset';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useAuth } from '@/contexts/AuthContext';


// ── Row styling helpers (static, outside component) ──

const getRowBackgroundClass = (transaction: Transaction): string => {
  if (transaction.gl_account_id) {
    return 'bg-emerald-500/5 hover:bg-emerald-500/10 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20';
  }
  const status = computeMatchStatus(transaction);
  if (status === 'matched') {
    return 'bg-[var(--row-matched-bg)]';
  }
  if (status === 'suggested') {
    const score = transaction.confidence_score || 0;
    const norm = score > 1 ? score / 100 : score;
    if (norm >= 0.8) {
      return 'bg-emerald-500/5 hover:bg-emerald-500/10 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 border-l-[3px] border-l-emerald-500/80';
    } else if (norm >= 0.5) {
      return 'bg-amber-500/5 hover:bg-amber-500/10 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 border-l-[3px] border-l-amber-500/80';
    } else {
      return 'bg-rose-500/5 hover:bg-rose-500/10 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 border-l-[3px] border-l-rose-500/80';
    }
  }
  if (status === 'auto_settled') {
    return 'bg-[var(--row-settled-bg)]';
  }
  if (status === 'no_invoice') {
    return 'bg-[var(--row-noinvoice-bg)]';
  }
  if (status === 'invoice_missing') {
    return 'bg-[var(--row-missing-bg)]';
  }
  return 'bg-[var(--row-unmatched-bg)]';
};

const getTypeBgClass = (type: string | null): string => {
  if (!type) return '';
  const t = type.toLowerCase().trim();

  if (t === 'szállítói tranzakció') return 'bg-[hsl(var(--tr-supplier-bg)/0.6)] text-[hsl(var(--tr-supplier-text))]';
  if (t === 'vevői tranzakció') return 'bg-[hsl(var(--tr-customer-bg)/0.6)] text-[hsl(var(--tr-customer-text))]';
  if (t === 'számlák közötti átvezetés') return 'bg-[hsl(var(--tr-transfer-bg)/0.6)] text-[hsl(var(--tr-transfer-text))]';
  if (t === 'banki számlavezetési díj') return 'bg-[hsl(var(--tr-bankfee-bg)/0.6)] text-[hsl(var(--tr-bankfee-text))]';
  if (t === 'kártyadíj') return 'bg-[hsl(var(--tr-cardfee-bg)/0.6)] text-[hsl(var(--tr-cardfee-text))]';
  if (t === 'hiteltörlesztés' || t === 'tranzakciós illeték' || t === 'kamat') return 'bg-[hsl(var(--tr-loan-bg)/0.6)] text-[hsl(var(--tr-loan-text))]';
  if (t === 'atm pénzfelvét') return 'bg-[hsl(var(--tr-atm-bg)/0.6)] text-[hsl(var(--tr-atm-text))]';
  if (t === 'pénztári kp felvét') return 'bg-[hsl(var(--tr-cashout-bg)/0.6)] text-[hsl(var(--tr-cashout-text))]';
  if (t === 'pénztári kp befizetés' || t === 'kp befizetés atm-en keresztül') return 'bg-[hsl(var(--tr-cashin-bg)/0.6)] text-[hsl(var(--tr-cashin-text))]';
  if (t === 'bérek') return 'bg-[hsl(var(--tr-salary-bg)/0.6)] text-[hsl(var(--tr-salary-text))]';
  if (t === 'járulékok/adók') return 'bg-[hsl(var(--tr-tax-bg)/0.6)] text-[hsl(var(--tr-tax-text))]';
  if (t === 'bankköltség') return 'bg-[hsl(var(--tr-bankcost-bg)/0.6)] text-[hsl(var(--tr-bankcost-text))]';
  if (t === 'kamatjóváírás') return 'bg-[hsl(var(--tr-interest-bg)/0.6)] text-[hsl(var(--tr-interest-text))]';
  if (t === 'atm készpénzfelvét') return 'bg-[hsl(var(--tr-atmcash-bg)/0.6)] text-[hsl(var(--tr-atmcash-text))]';

  return '';
};


// ── Expanded invoice inline (lazy-loaded, reuses ExpandedInvoiceRow) ──

import ExpandedInvoiceRow from '@/components/ExpandedInvoiceRow';

const ExpandedTransactionInvoice = React.memo(function ExpandedTransactionInvoice({
  matchedInvoiceId,
  transaction,
  onOpenDetails,
  colSpan,
}: {
  matchedInvoiceId: string | null;
  transaction: Transaction;
  onOpenDetails: (transaction: Transaction) => void;
  colSpan: number;
}) {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const [matchedSubmitted, setMatchedSubmitted] = useState<any[]>([]);
  const [matchedNav, setMatchedNav] = useState<any[]>([]);
  const [siblingTransactions, setSiblingTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const { activePresetId } = useActivePreset(transaction.company_id || undefined);
  const [selectedGlId, setSelectedGlId] = useState(transaction.gl_account_id || '');
  const [isEditingGl, setIsEditingGl] = useState(false);
  const [glSearchQuery, setGlSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);

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
    enabled: !!activePresetId,
  });

  const cleanGlNum = (num: any) => num ? String(num).replace(/\./g, '') : '';

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
        p_company_id: transaction.company_id || '',
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

      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['glBalances'] });
      queryClient.invalidateQueries({ queryKey: ['glItems'] });
      setIsEditingGl(false);
      setGlSearchQuery('');
    } catch (error) {
      console.error('Error booking transaction directly inline:', error);
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
        p_company_id: transaction.company_id || '',
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

      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['glBalances'] });
      queryClient.invalidateQueries({ queryKey: ['glItems'] });
      setIsEditingGl(false);
      setSelectedGlId('');
      setGlSearchQuery('');
    } catch (error) {
      console.error('Error unbooking transaction inline:', error);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    setSelectedGlId(transaction.gl_account_id || '');
    setIsEditingGl(false);
    setGlSearchQuery('');
  }, [transaction.gl_account_id]);

  // Notes state
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteText, setNewNoteText] = useState('');
  const [newNotePrivate, setNewNotePrivate] = useState(true);
  const [addingNote, setAddingNote] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const submittedList: any[] = [];
      const navList: any[] = [];

      // 1. Fetch primary AI match (from matched_invoice_id)
      if (matchedInvoiceId) {
        const { data: submitted, error: subErr } = await supabase
          .from('invoices')
          .select('id, bizonylatsorszam, kibocsatas_datuma, teljesites_datuma, elado_nev, vevo_nev, adoalap_osszesen, brutto_vegosszeg, afa_osszeg_osszesen, penznem, image_url, melleklet_url, invoice_type, reference_number, fizetesi_mod')
          .eq('id', matchedInvoiceId)
          .maybeSingle();

        if (subErr) {
          reportError({
            type: 'db_query',
            component: 'ExpandedTransactionInvoice',
            action: 'fetch_primary_submitted',
            message: `Failed to fetch primary matched submitted invoice: ${matchedInvoiceId}`,
            error: subErr
          });
        }

        if (cancelled) return;

        if (submitted) {
          submittedList.push(submitted);
        } else {
          const { data: nav, error: navErr } = await supabase
            .from('nav_invoices')
            .select('id, invoice_number, invoice_issue_date, invoice_delivery_date, supplier_name, customer_name, supplier_tax_number, customer_tax_number, invoice_net_amount, invoice_gross_amount, invoice_vat_amount, currency, transaction_id, submitted')
            .eq('id', matchedInvoiceId)
            .maybeSingle();

          if (navErr) {
            reportError({
              type: 'db_query',
              component: 'ExpandedTransactionInvoice',
              action: 'fetch_primary_nav',
              message: `Failed to fetch primary matched NAV invoice: ${matchedInvoiceId}`,
              error: navErr
            });
          }

          if (cancelled) return;
          if (nav) navList.push(nav);
        }
      }

      // 2. Fetch additional manual matches from join table
      const { data: extraMatchesRaw, error: extraErr } = await supabase
        .from('transaction_invoice_matches')
        .select('invoice_id, invoice_source')
        .eq('transaction_id', transaction.id);

      if (extraErr) {
        reportError({
          type: 'db_query',
          component: 'ExpandedTransactionInvoice',
          action: 'fetch_extra_matches',
          message: `Failed to fetch extra matches for transaction: ${transaction.id}`,
          error: extraErr
        });
      }
      const extraMatches = extraMatchesRaw as Array<{ invoice_id: string; invoice_source: string }> | null;

      if (cancelled) return;

      if (extraMatches && extraMatches.length > 0) {
        // Separate by source, exclude already-fetched primary
        const extraSubmittedIds = extraMatches
          .filter(m => m.invoice_source === 'submitted' && m.invoice_id !== matchedInvoiceId)
          .map(m => m.invoice_id);
        const extraNavIds = extraMatches
          .filter(m => m.invoice_source === 'nav' && m.invoice_id !== matchedInvoiceId)
          .map(m => m.invoice_id);


        if (extraSubmittedIds.length > 0) {
          const { data, error: extraSubFetchErr } = await supabase
            .from('invoices')
            .select('id, bizonylatsorszam, kibocsatas_datuma, teljesites_datuma, elado_nev, vevo_nev, adoalap_osszesen, brutto_vegosszeg, afa_osszeg_osszesen, penznem, image_url, melleklet_url, invoice_type, reference_number, fizetesi_mod')
            .in('id', extraSubmittedIds);
          if (extraSubFetchErr) {
            reportError({
              type: 'db_query',
              component: 'ExpandedTransactionInvoice',
              action: 'fetch_extra_submitted_details',
              message: `Failed to fetch details for extra submitted invoices: ${extraSubmittedIds.join(', ')}`,
              error: extraSubFetchErr
            });
          }
          if (!cancelled && data) submittedList.push(...data);
        }

        if (extraNavIds.length > 0) {
          const { data, error: extraNavFetchErr } = await supabase
            .from('nav_invoices')
            .select('id, invoice_number, invoice_issue_date, invoice_delivery_date, supplier_name, customer_name, supplier_tax_number, customer_tax_number, invoice_net_amount, invoice_gross_amount, invoice_vat_amount, currency, transaction_id, submitted')
            .in('id', extraNavIds);
          if (extraNavFetchErr) {
            reportError({
              type: 'db_query',
              component: 'ExpandedTransactionInvoice',
              action: 'fetch_extra_nav_details',
              message: `Failed to fetch details for extra NAV invoices: ${extraNavIds.join(', ')}`,
              error: extraNavFetchErr
            });
          }
          if (!cancelled && data) navList.push(...data);
        }
      }

      // 3. Fetch sibling transactions matched to the same invoice(s)
      const allInvoiceIds = [
        ...submittedList.map(s => s.id),
        ...navList.map(n => n.id),
      ];

      if (allInvoiceIds.length > 0) {
        const { data: siblingTx, error: siblingErr } = await supabase
          .from('transactions')
          .select('id, transaction_date, amount, description, currency, type, confidence_score, match_type, is_verified')
          .in('matched_invoice_id', allInvoiceIds);

        if (siblingErr) {
          reportError({
            type: 'db_query',
            component: 'ExpandedTransactionInvoice',
            action: 'fetch_sibling_transactions',
            message: `Failed to fetch sibling transactions for invoice IDs: ${allInvoiceIds.join(', ')}`,
            error: siblingErr
          });
        }

        if (!cancelled && siblingTx) {
          setSiblingTransactions(siblingTx);
        }
      }

      if (!cancelled) {
        setMatchedSubmitted(submittedList);
        setMatchedNav(navList);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [matchedInvoiceId, transaction.id]);

  // Fetch notes for this unmatched transaction
  const { data: notes = [], refetch: refetchNotes } = useQuery({
    queryKey: ['transaction-notes', transaction.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .or(`transaction_id.eq.${transaction.id},transaction_ids.ov.{${transaction.id}}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const userIds = Array.from(new Set(data.map((n) => n.user_id)));
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, name')
          .in('user_id', userIds);

        const nameMap: Record<string, string> = {};
        (profiles || []).forEach((p) => {
          nameMap[p.user_id] = p.name || 'Névtelen';
        });

        return data.map((n) => ({
          ...n,
          profile_name: nameMap[n.user_id] || 'Ismeretlen',
        }));
      }
      return [];
    },
    enabled: !matchedInvoiceId && !!transaction.id,
  });

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim() || !transaction.id) return;
    setAddingNote(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) throw new Error('Unauthenticated');

      const { error } = await supabase
        .from('notes')
        .insert({
          company_id: transaction.company_id || '',
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
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['transaction-notes', transaction.id] });
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    } catch (err: any) {
      console.error('Error adding note:', err);
    } finally {
      setAddingNote(false);
    }
  };

  if (loading) {
    return (
      <TableRow>
        <TableCell colSpan={colSpan} className="bg-muted/20 py-3">
          <div className="flex items-center justify-center py-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="ml-2 text-xs text-muted-foreground">Számla betöltése...</span>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  if (matchedSubmitted.length === 0 && matchedNav.length === 0) {
    return (
      <>
        {/* Top spacer row */}
        <TableRow className="bg-transparent hover:bg-transparent border-none">
          <TableCell colSpan={colSpan} className="p-0 h-1 border-none" />
        </TableRow>
        <TableRow className="bg-muted/40 dark:bg-card hover:bg-muted/40 dark:hover:bg-card border-t border-b border-border/30">
          <TableCell colSpan={colSpan} className="p-0">
            <div className="py-6 px-8 space-y-4 max-w-5xl ml-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                
                {/* Left column: Related items (unmatched card) */}
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <Link2Off className="h-3.5 w-3.5" />
                    Kapcsolódó tételek
                  </div>
                  <Card className="bg-muted/30 border-border/50">
                    <CardContent className="p-4 flex flex-col items-center justify-center gap-3">
                      <p className="text-sm text-muted-foreground italic">Nincs párosított tétel ehhez a tranzakcióhoz.</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); onOpenDetails(transaction); }}
                        className="h-8 text-xs gap-1.5"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                        Számla hozzárendelése
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                {/* Middle column: Direct GL Classification */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <ClipboardCheck className="h-3.5 w-3.5 text-primary" />
                    Közvetlen könyvelés (Számla nélkül)
                  </div>
                  <Card className="bg-muted/30 border-border/50">
                    <CardContent className="p-4 space-y-3">
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
                              onClick={(e) => {
                                e.stopPropagation();
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
                              onClick={(e) => { e.stopPropagation(); handleUnbookTransaction(); }}
                              className="text-xs w-full text-red-500 hover:text-red-600 border-red-500/30 hover:bg-red-500/10 h-8"
                            >
                              <Undo2 className="h-3.5 w-3.5 mr-1" />
                              Könyvelés törlése
                            </Button>
                          )}
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Ha a tételhez nem tartozik bizonylat, közvetlenül kontírozhatod egy főkönyvi számra.
                        </p>
                      )}

                      {(isEditingGl || !transaction.gl_account_id) && (
                        <div className="space-y-2 pt-1" onClick={(e) => e.stopPropagation()}>
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
                              {transaction.gl_account_id ? 'Módosítás mentése' : 'Kontírozás'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Right column: Notes */}
                <div className="space-y-4 max-w-md">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <ClipboardCheck className="h-3.5 w-3.5 text-primary" />
                    Kapcsolódó feljegyzések
                  </div>

                  {notes && notes.length > 0 ? (
                    <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                      {notes.map((note: any) => (
                        <Card key={note.id} className="bg-primary/[0.02] border-primary/20">
                          <CardHeader className="py-1.5 px-2.5 border-b border-border/10">
                            <CardTitle className="text-[11px] font-semibold flex items-center justify-between text-foreground">
                              <span className="truncate max-w-[150px]">{note.title || 'Névtelen jegyzet'}</span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {note.is_private ? (
                                  <Badge variant="outline" className="text-[8px] h-4 px-1 gap-0.5 bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400">
                                    <Lock className="h-2 w-2" />
                                    Privát
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[8px] h-4 px-1 gap-0.5 bg-primary/10 text-primary border-primary/20">
                                    <Users className="h-2 w-2" />
                                    Közös
                                  </Badge>
                                )}
                                <span className="text-[8px] text-muted-foreground font-mono">
                                  {format(new Date(note.created_at), 'yyyy.MM.dd', { locale: hu })}
                                </span>
                              </div>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-2.5 space-y-1">
                            <p className="text-muted-foreground text-xs whitespace-pre-wrap leading-normal font-sans pl-0.5">{note.content}</p>
                            <div className="text-[9px] text-muted-foreground/80 pl-0.5 pt-0.5">
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
                  <form onSubmit={handleAddNote} className="space-y-3 pt-3 border-t border-border/20">
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Jegyzet címe</span>
                      <Input
                        placeholder="pl. Emlékeztető..."
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
                            "flex items-start gap-2 p-1.5 rounded-lg border text-left transition-all",
                            newNotePrivate
                              ? "border-primary/60 bg-primary/5 dark:bg-primary/10 shadow-sm"
                              : "border-border bg-transparent hover:bg-muted/30"
                          )}
                        >
                          <Lock className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", newNotePrivate ? "text-primary" : "text-muted-foreground")} />
                          <div>
                            <p className="text-[10px] font-semibold">Privát</p>
                            <p className="text-[8px] text-muted-foreground">Csak te látod</p>
                          </div>
                        </button>

                        {/* Public Card Button */}
                        <button
                          type="button"
                          onClick={() => setNewNotePrivate(false)}
                          className={cn(
                            "flex items-start gap-2 p-1.5 rounded-lg border text-left transition-all",
                            !newNotePrivate
                              ? "border-primary/60 bg-primary/5 dark:bg-primary/10 shadow-sm"
                              : "border-border bg-transparent hover:bg-muted/30"
                          )}
                        >
                          <Users className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", !newNotePrivate ? "text-primary" : "text-muted-foreground")} />
                          <div>
                            <p className="text-[10px] font-semibold">Közös</p>
                            <p className="text-[8px] text-muted-foreground">Cégtagok látják</p>
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

              </div>
            </div>
          </TableCell>
        </TableRow>
      </>
    );
  }

  return (
    <ExpandedInvoiceRow
      colSpan={colSpan}
      matchedSubmittedInvoices={matchedSubmitted}
      matchedNavInvoices={matchedNav}
      matchedTransactions={siblingTransactions}
      linkedInvoices={[]}
      hideStandaloneTransactions
      invoiceId={matchedInvoiceId || undefined}
      companyId={transaction.company_id || undefined}
      transactionId={transaction.id}
      invoiceSource={matchedSubmitted.length > 0 ? 'submitted' : 'nav'}
    />
  );
});

// ── Individual Row ──

interface TransactionRowProps {
  transaction: Transaction;
  exchangeRates?: Record<string, number>;
  isExpanded?: boolean;
  onToggleExpand?: (id: string) => void;
  onOpenDetails: (transaction: Transaction) => void;
  bankLabel?: string | null;
  bankFullName?: string | null;
  bankBgClass?: string;
  isDuplicate?: boolean;
  isSelected?: boolean;
  onSelect?: (id: string, shiftKey: boolean) => void;
  showCheckbox?: boolean;
}

const TransactionRow = React.memo(function TransactionRow({ transaction, exchangeRates, isExpanded, onToggleExpand, onOpenDetails, bankLabel, bankFullName, bankBgClass, isDuplicate, isSelected, onSelect, showCheckbox }: TransactionRowProps) {
  const matchStatus = computeMatchStatus(transaction);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const current = e.targetTouches[0].clientX;
    const diff = current - touchStart;
    setSwipeOffset(Math.max(-80, Math.min(80, diff)));
  };

  const handleTouchEnd = () => {
    if (touchStart === null) return;
    if (swipeOffset > 50) {
      if (matchStatus === 'suggested' && transaction.matched_invoice_id) {
        (async () => {
          try {
            const { error } = await supabase
              .from('transactions')
              .update({ is_verified: true })
              .eq('id', transaction.id);
            if (error) throw error;
            toast({ title: 'Sikeres jóváhagyás', description: 'A tranzakció párosítása jóváhagyva.' });
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            queryClient.invalidateQueries({ queryKey: ['tx-kpis'] });
          } catch (err) {
            console.error('Failed to verify match via swipe:', err);
            toast({ title: 'Hiba', description: 'Nem sikerült a jóváhagyás.', variant: 'destructive' });
          }
        })();
      } else {
        toast({ title: 'Jóváhagyás', description: 'Csak javasolt párosítások hagyhatóak jóvá így.' });
      }
    } else if (swipeOffset < -50) {
      onOpenDetails(transaction);
    }
    setSwipeOffset(0);
    setTouchStart(null);
  };

  return (
    <>
    <TableRow
      data-row-hover
      className={cn(
        "h-10 cursor-pointer transition-transform duration-200 select-none",
        getRowBackgroundClass(transaction),
        isExpanded && "border-b-0",
        isSelected && "ring-1 ring-primary/40 ring-inset"
      )}
      style={{
        transform: swipeOffset !== 0 ? `translateX(${swipeOffset}px)` : undefined,
        transition: touchStart === null ? 'transform 0.2s ease-out' : 'none'
      }}
      onClick={() => onToggleExpand?.(transaction.id)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* F1: Checkbox cell */}
      {showCheckbox && (
        <TableCell className="w-8 px-2">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => {}}
            onClick={(e) => {
              e.stopPropagation();
              onSelect?.(transaction.id, (e as any).shiftKey || false);
            }}
            className="translate-y-[1px]"
          />
        </TableCell>
      )}
      <TableCell className="font-medium text-xs whitespace-nowrap">
        <div className="flex items-center gap-2">
            <ChevronDown className={cn(
              "h-3 w-3 text-muted-foreground shrink-0 transition-transform duration-200",
              isExpanded && "rotate-180"
            )} />
          {transaction.transaction_date
            ? format(new Date(transaction.transaction_date), 'yyyy.MM.dd')
            : '-'}
          {/* F2: Duplicate warning icon */}
          {isDuplicate && (
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Copy className="h-3 w-3 text-amber-500 shrink-0" />
                </TooltipTrigger>
                <TooltipContent>Lehetséges duplikátum — azonos dátum és összeg</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </TableCell>
      <TableCell className="overflow-hidden">
        <div className="flex items-center gap-1.5">
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="block truncate text-xs cursor-default flex-1 min-w-0">
                  {transaction.description || '-'}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[500px]">
                <p className="whitespace-pre-wrap text-sm">{transaction.description}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {bankLabel && (
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={cn(
                    "text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0 border cursor-default",
                    bankBgClass || 'bg-muted text-muted-foreground'
                  )}>
                    {bankLabel}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{bankFullName || bankLabel}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </TableCell>
      <TableCell className={cn(
        "text-right font-mono text-xs whitespace-nowrap [text-shadow:_0_0_3px_rgba(255,255,255,0.8)] dark:[text-shadow:_0_0_3px_rgba(0,0,0,0.6)]",
        transaction.amount >= 0 ? "text-success" : "text-destructive"
      )}>
        <div className="flex flex-col items-end">
          <span className="font-medium">{formatCurrency(transaction.amount, transaction.currency || 'HUF')}</span>
          {transaction.currency && transaction.currency !== 'HUF' && exchangeRates && (
            <span className="text-[10px] text-muted-foreground font-normal leading-tight">
              ({formatCurrency(transaction.amount * (exchangeRates[transaction.currency] || 1), 'HUF')})
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-xs whitespace-nowrap">
        <span className={cn(
          "inline-block w-[3rem] text-center font-semibold px-1.5 py-0.5 rounded text-[10px] border border-black/10 dark:border-white/10 text-foreground",
          transaction.currency && transaction.currency !== 'HUF'
            ? "bg-amber-500/20 dark:bg-yellow-500/10"
            : "bg-muted/60"
        )}>
          {transaction.currency || 'HUF'}
        </span>
      </TableCell>
      <TableCell className="overflow-hidden">
        {transaction.type ? (
          <span className={cn(
            "text-[11px] font-semibold px-1.5 py-0.5 rounded-md inline-block w-[10.5rem] text-center whitespace-nowrap overflow-hidden text-ellipsis border border-black/10 dark:border-white/10",
            getTypeBgClass(transaction.type) || "text-muted-foreground"
          )}>
            {transaction.type}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </TableCell>
      {/* Számlaosztály cell */}
      <TableCell className="text-center overflow-hidden">
        {transaction.gl_accounts?.gl_number ? (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-600/15 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400 border border-emerald-500/20 max-w-[120px] truncate cursor-default">
                  {transaction.gl_accounts.gl_number}
                </span>
              </TooltipTrigger>
              <TooltipContent>{transaction.gl_accounts.short_name}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell className="text-center whitespace-nowrap">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger>
              <div className="flex items-center justify-center">
                {matchStatus === 'matched' && (
                  <span className="inline-flex items-center gap-1 w-[5.5rem] justify-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-600/15 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400 border border-black/10 dark:border-white/10">
                    <CheckCircle2 className="h-3 w-3" />Párosított
                  </span>
                )}
                {matchStatus === 'suggested' && (() => {
                  const score = transaction.confidence_score || 0;
                  const norm = score > 1 ? score / 100 : score;
                  if (norm >= 0.8) {
                    return (
                      <span className="inline-flex items-center gap-1 w-[5.5rem] justify-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/15 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />Javasolt ({Math.round(norm * 100)}%)
                      </span>
                    );
                  }
                  if (norm >= 0.5) {
                    return (
                      <span className="inline-flex items-center gap-1 w-[5.5rem] justify-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/15 text-amber-800 dark:bg-yellow-500/15 dark:text-yellow-400 border border-amber-500/20">
                        <AlertCircle className="h-3 w-3 text-amber-600" />Javasolt ({Math.round(norm * 100)}%)
                      </span>
                    );
                  }
                  return (
                    <span className="inline-flex items-center gap-1 w-[5.5rem] justify-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-rose-500/15 text-rose-800 dark:bg-rose-500/15 dark:text-rose-400 border border-rose-500/20">
                      <HelpCircle className="h-3 w-3 text-rose-600" />Javasolt ({Math.round(norm * 100)}%)
                    </span>
                  );
                })()}
                {matchStatus === 'auto_settled' && (
                  <span className="inline-flex items-center gap-1 w-[5.5rem] justify-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-blue-500/15 text-blue-800 dark:bg-blue-500/15 dark:text-blue-400 border border-black/10 dark:border-white/10">
                    <Settings className="h-3 w-3" />Rendezett
                  </span>
                )}
                {matchStatus === 'unmatched' && (
                  <span className="inline-flex items-center gap-1 w-[5.5rem] justify-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-rose-500/15 text-rose-800 dark:bg-rose-500/15 dark:text-rose-400 border border-black/10 dark:border-white/10">
                    <HelpCircle className="h-3 w-3" />Nincs
                  </span>
                )}
                {matchStatus === 'no_invoice' && (
                  <span className="inline-flex items-center gap-1 w-[5.5rem] justify-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-purple-500/15 text-purple-800 dark:bg-purple-500/15 dark:text-purple-400 border border-black/10 dark:border-white/10">
                    <Ban className="h-3 w-3" />Nincs számla
                  </span>
                )}
                {matchStatus === 'invoice_missing' && (
                  <span className="inline-flex items-center gap-1 w-[5.5rem] justify-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-sky-500/15 text-sky-800 dark:bg-sky-500/15 dark:text-sky-400 border border-black/10 dark:border-white/10">
                    <UploadCloud className="h-3 w-3" />Feltöltendő
                  </span>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs space-y-1">
              <p className="font-semibold text-xs">
                {matchStatus === 'matched' && 'Párosított és jóváhagyott'}
                {matchStatus === 'suggested' && `Javasolt párosítás ${transaction.confidence_score ? `(${Math.round(transaction.confidence_score * 100)}%)` : ''}`}
                {matchStatus === 'auto_settled' && 'Rendezett — nem igényel számlát (bankköltség, ATM, stb.)'}
                {matchStatus === 'unmatched' && 'Nincs párosítva'}
                {matchStatus === 'no_invoice' && 'Nincs hozzá számla — könyvelő feladata'}
                {matchStatus === 'invoice_missing' && 'Számla nincs feltöltve — fel kell tölteni'}
              </p>
              {transaction.reason && (
                <p className="text-[11px] text-muted-foreground border-t border-border/30 pt-1 mt-1 font-normal leading-normal">
                  Indok: {transaction.reason}
                </p>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TableCell>
      <TableCell className="overflow-hidden">
        <TransactionReasonCell reason={transaction.reason} />
      </TableCell>
      <TableCell className="text-center">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => { e.stopPropagation(); onOpenDetails(transaction); }}
              >
                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Tranzakció és számla részletei</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TableCell>
    </TableRow>
    {isExpanded && (
      <ExpandedTransactionInvoice
        matchedInvoiceId={transaction.matched_invoice_id}
        transaction={transaction}
        onOpenDetails={onOpenDetails}
        colSpan={showCheckbox ? 10 : 9}
      />
    )}
    </>
  );
});

// ── Table ──

interface TransactionTableProps {
  transactions: Transaction[];
  loading: boolean;
  pageSize: number;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onSort: (field: string) => void;
  onOpenDetails: (transaction: Transaction) => void;
  uploadBankMap?: Record<string, string>;
  bankConfig?: Record<string, { label: string; fullName?: string; bgClass: string }>;
  duplicateTxIds?: Set<string>;
  onBulkStatusChange?: (ids: string[], matchType: string) => void;
  onBulkExport?: (ids: string[], format: 'csv' | 'xlsx') => void;
  onBulkDelete?: (ids: string[]) => void;
}

const TransactionTable = React.memo(function TransactionTable({
  transactions,
  loading,
  pageSize,
  hasActiveFilters,
  onClearFilters,
  onSort,
  onOpenDetails,
  uploadBankMap,
  bankConfig,
  duplicateTxIds,
  onBulkStatusChange,
  onBulkExport,
  onBulkDelete,
}: TransactionTableProps) {
  const { data: exchangeRates } = useExchangeRates();
  const [expandedTxIds, setExpandedTxIds] = useState<Set<string>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');

  // F1: Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedIdx, setLastSelectedIdx] = useState<number | null>(null);

  const showBulkMode = duplicateTxIds !== undefined || onBulkStatusChange !== undefined || onBulkExport !== undefined;

  // Clear selection when transactions change (page change, filter change)
  useEffect(() => {
    setSelectedIds(new Set());
    setLastSelectedIdx(null);
  }, [transactions]);

  const handleSelect = useCallback((id: string, shiftKey: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const currentIdx = transactions.findIndex(t => t.id === id);

      if (shiftKey && lastSelectedIdx !== null && currentIdx !== -1) {
        // Shift+click: range selection
        const start = Math.min(lastSelectedIdx, currentIdx);
        const end = Math.max(lastSelectedIdx, currentIdx);
        for (let i = start; i <= end; i++) {
          next.add(transactions[i].id);
        }
      } else {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      }

      setLastSelectedIdx(currentIdx);
      return next;
    });
  }, [transactions, lastSelectedIdx]);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      if (prev.size === transactions.length) return new Set();
      return new Set(transactions.map(t => t.id));
    });
  }, [transactions]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setLastSelectedIdx(null);
  }, []);

  const toggleExpand = React.useCallback((id: string) => {
    setExpandedTxIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const colCount = showBulkMode ? 10 : 9;

  return (
    <div className="space-y-0 relative">
      {/* F1: Floating bulk action bar */}
      {selectedIds.size > 0 && createPortal(
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-5xl bg-card border border-primary/30 shadow-2xl rounded-2xl px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-3 z-[9999] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex flex-wrap items-center gap-3 justify-center md:justify-start">
            <div className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse shrink-0" />
            <p className="text-sm font-semibold text-foreground whitespace-nowrap">
              Kijelölt tranzakciók: <span className="font-extrabold text-primary">{selectedIds.size} db</span>
            </p>
            {(() => {
              const selectedTxs = transactions.filter(t => selectedIds.has(t.id));
              let inflow = 0;
              let outflow = 0;
              selectedTxs.forEach(t => {
                const currency = t.currency || 'HUF';
                const rate = exchangeRates?.[currency] ?? 1;
                const hufAmount = t.amount * rate;
                if (hufAmount > 0) inflow += hufAmount;
                else outflow += Math.abs(hufAmount);
              });
              
              if (selectedTxs.length === 0) return null;
              
              return (
                <>
                  <span className="text-muted-foreground/30 text-xs hidden sm:inline">|</span>
                  <p className="text-xs text-muted-foreground font-medium flex items-center gap-3">
                    {inflow > 0 && (
                      <span>Bevétel: <span className="font-bold text-success">+{formatCurrency(inflow, 'HUF')}</span></span>
                    )}
                    {inflow > 0 && outflow > 0 && <span className="text-muted-foreground/30 text-[10px]">|</span>}
                    {outflow > 0 && (
                      <span>Kiadás: <span className="font-bold text-destructive">-{formatCurrency(outflow, 'HUF')}</span></span>
                    )}
                  </p>
                </>
              );
            })()}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {onBulkExport && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 text-xs gap-1.5 rounded-xl border-border/60 hover:bg-muted"
                  >
                    <Download className="w-3.5 h-3.5" /> Exportálás <ChevronDown className="w-3 h-3 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onBulkExport(Array.from(selectedIds), 'csv')} className="cursor-pointer gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" /> CSV (.csv)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onBulkExport(Array.from(selectedIds), 'xlsx')} className="cursor-pointer gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" /> Excel (.xlsx)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {onBulkStatusChange && (
              <>
                <div className="w-px h-6 bg-border/60 mx-1 hidden sm:block" />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 text-xs gap-1.5 rounded-xl border-border/60 hover:bg-muted"
                  onClick={() => onBulkStatusChange(Array.from(selectedIds), 'no_match_category')}
                >
                  <Settings className="w-3.5 h-3.5" /> Rendezett
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 text-xs gap-1.5 rounded-xl border-border/60 hover:bg-muted"
                  onClick={() => onBulkStatusChange(Array.from(selectedIds), 'no_invoice')}
                >
                  <Ban className="w-3.5 h-3.5" /> Nincs számla
                </Button>
              </>
            )}
            {onBulkDelete && (
              <>
                <div className="w-px h-6 bg-border/60 mx-1 hidden sm:block" />
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-9 text-xs gap-1.5 rounded-xl font-semibold"
                  onClick={() => { setDeleteConfirmInput(''); setDeleteConfirmOpen(true); }}
                >
                  <Trash2 className="w-3.5 h-3.5" /> Törlés
                </Button>
              </>
            )}
            <div className="w-px h-6 bg-border/60 mx-1 hidden sm:block" />
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-xs text-muted-foreground hover:text-foreground rounded-xl"
              onClick={clearSelection}
            >
              Mégse
            </Button>
          </div>
        </div>,
        document.body
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Tranzakciók végleges törlése
            </DialogTitle>
            <DialogDescription>
              <strong className="text-destructive">{selectedIds.size}</strong> tranzakció véglegesen törlődik. Ez a művelet nem vonható vissza.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <label className="text-sm font-medium text-foreground">
              A megerősítéshez írd be a kijelölt tranzakciók számát: <strong>{selectedIds.size}</strong>
            </label>
            <Input
              className="mt-2"
              placeholder={`${selectedIds.size}`}
              value={deleteConfirmInput}
              onChange={e => setDeleteConfirmInput(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Mégse</Button>
            <Button
              variant="destructive"
              disabled={deleteConfirmInput !== String(selectedIds.size)}
              onClick={() => {
                onBulkDelete!(Array.from(selectedIds));
                setDeleteConfirmOpen(false);
                clearSelection();
              }}
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              Törlés ({selectedIds.size} db)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="rounded-xl border border-border/50 overflow-x-auto">
        <table className="w-full caption-bottom text-sm compact-table min-w-[1000px]" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            {showBulkMode && <col style={{ width: '3%' }} />}
            <col style={{ width: showBulkMode ? '8%' : '8%' }} />
            <col style={{ width: showBulkMode ? '22%' : '25%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '5%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: showBulkMode ? '13%' : '13%' }} />
            <col style={{ width: '7%' }} />
          </colgroup>
          <TableHeader>
            <TableRow className="bg-muted hover:bg-muted">
              {/* F1: Select all checkbox */}
              {showBulkMode && (
                <TableHead className="w-8 px-2">
                  <Checkbox
                    checked={transactions.length > 0 && selectedIds.size === transactions.length}
                    onCheckedChange={handleSelectAll}
                    aria-label="Összes kijelölése"
                    className="translate-y-[1px]"
                  />
                </TableHead>
              )}
              <TableHead
                className="cursor-pointer hover:bg-muted/50 font-semibold"
                onClick={() => onSort('transaction_date')}
              >
                <div className="flex items-center gap-1">
                  Dátum
                  <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                </div>
              </TableHead>
              <TableHead className="font-semibold">Leírás</TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 text-right font-semibold"
                onClick={() => onSort('amount')}
              >
                <div className="flex items-center justify-end gap-1">
                  Összeg
                  <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                </div>
              </TableHead>
              <TableHead className="font-semibold">Pénznem</TableHead>
              <TableHead className="font-semibold">Típus</TableHead>
              <TableHead className="font-semibold text-center">Számlaosztály</TableHead>
              <TableHead className="font-semibold text-center">Státusz</TableHead>
              <TableHead className="font-semibold">Indoklás</TableHead>
              <TableHead className="font-semibold text-center">Tételek</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeleton rows={10} columns={colCount} />
            ) : transactions.length === 0 ? (
              <TableEmptyState
                colSpan={colCount}
                title="Nincs tranzakció"
                description="Tölts fel bankkivonatot a Feltöltés oldalon, vagy módosítsd a szűrőket."
                onClearFilters={hasActiveFilters ? onClearFilters : undefined}
              />
            ) : (
              transactions.map((transaction) => {
                const bankKey = uploadBankMap && transaction.upload_id ? uploadBankMap[transaction.upload_id] : undefined;
                const cfg = bankKey && bankConfig ? bankConfig[bankKey] : undefined;
                return (
                  <TransactionRow
                    key={transaction.id}
                    transaction={transaction}
                    exchangeRates={exchangeRates}
                    isExpanded={expandedTxIds.has(transaction.id)}
                    onToggleExpand={toggleExpand}
                    onOpenDetails={onOpenDetails}
                    bankLabel={cfg?.label}
                    bankFullName={cfg?.fullName}
                    bankBgClass={cfg?.bgClass}
                    isDuplicate={duplicateTxIds?.has(transaction.id)}
                    isSelected={selectedIds.has(transaction.id)}
                    onSelect={handleSelect}
                    showCheckbox={showBulkMode}
                  />
                );
              })
            )}
            <TablePlaceholderRows currentCount={transactions.length} pageSize={pageSize} columns={colCount} />
          </TableBody>
        </table>
      </div>
    </div>
  );
});

export { TransactionRow };
export default TransactionTable;
