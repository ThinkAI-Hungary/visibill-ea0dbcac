import React, { useState, useEffect, useMemo } from 'react';
import { useRealtimeInvalidation } from '@/hooks/useRealtimeInvalidation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useDateRange } from '@/contexts/DateRangeContext';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { cn, formatCurrency } from '@/lib/utils';
import { CalendarIcon, Search, Download, ArrowUpDown, FileText, X, ChevronDown, Info, Eye, Pencil, Package, ChevronLeft, ChevronRight, RefreshCw, Shield } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { InvoiceImagePreview } from '@/components/InvoiceImagePreview';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import InvoiceImageDialog from '@/components/InvoiceImageDialog';
import InvoiceFullEditDialog from '@/components/InvoiceFullEditDialog';
import { InvoiceItemsDialog } from '@/components/InvoiceItemsDialog';
import { UnifiedPagination } from '@/components/ui/unified-pagination';
import { CopyableCell } from '@/components/ui/copyable-cell';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { TableEmptyState } from '@/components/ui/table-empty-state';
import { TablePlaceholderRows } from '@/components/ui/table-placeholder-rows';
import ExpandedInvoiceRow from '@/components/ExpandedInvoiceRow';

interface TransactionRecord {
  id: string;
  matched_invoice_id: string;
  transaction_date: string;
  amount: number;
  description: string | null;
  currency: string | null;
  type: string | null;
}


// Helper to generate initials from name
const getInitials = (name: string): string => {
  if (!name || name === '-') return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// Helper to generate consistent color from name
const getAvatarColor = (name: string): string => {
  const colors = [
    'bg-blue-500/20 text-blue-400',
    'bg-emerald-500/20 text-emerald-400',
    'bg-amber-500/20 text-amber-400',
    'bg-purple-500/20 text-purple-400',
    'bg-rose-500/20 text-rose-400',
    'bg-cyan-500/20 text-cyan-400',
    'bg-orange-500/20 text-orange-400',
    'bg-indigo-500/20 text-indigo-400',
  ];
  if (!name) return colors[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

interface NavInvoice {
  id: string;
  invoice_number: string;
  invoice_direction: string | null;
  invoice_issue_date: string | null;
  invoice_delivery_date: string | null;
  supplier_tax_number: string | null;
  supplier_name: string | null;
  supplier_address: string | null;
  customer_tax_number: string | null;
  customer_name: string | null;
  customer_address: string | null;
  invoice_net_amount: number | null;
  invoice_gross_amount: number | null;
  invoice_vat_amount: number | null;
  currency: string | null;
  payment_method: string | null;
  invoice_operation: string | null;
  payment_date: string | null;
  paid: boolean | null;
  submitted: boolean | null;
  details_fetched: boolean | null;
  company_id: string | null;
  user_id: string | null;
  created_at: string | null;
  fetched_at: string | null;
  project_id: string | null;
  category_id: string | null;
  transaction_id: string | null;
}

interface SubmittedInvoice {
  id: string;
  bizonylatsorszam: string | null;
  kibocsatas_datuma: string;
  teljesites_datuma: string | null;
  elado_nev: string;
  vevo_nev: string;
  adoalap_osszesen: number;
  brutto_vegosszeg: number;
  afa_osszeg_osszesen: number;
  penznem: string | null;
  category_id: string | null;
  project_id: string | null;
  image_url: string | null;
  melleklet_url: string | null;
  invoice_direction: string | null;
  reference_number: string | null;
}

interface Partner {
  tax_number: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
}

interface NavFilters {
  search: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  amountMin: string;
  amountMax: string;
  currency: string;
  paid: string;
  submitted: string;
  project: string;
  category: string;
  paymentMethod: string;
}

interface SubmittedFilters {
  search: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  amountMin: string;
  amountMax: string;
  currency: string;
  category: string;
  project: string;
}

type InvoiceTab = 'OUTBOUND' | 'INBOUND' | 'SUBMITTED_INBOUND' | 'SUBMITTED_OUTBOUND';

const InvoicesPage = () => {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const { dateFrom, dateTo, dateFromFormatted, dateToFormatted } = useDateRange();
  const queryClient = useQueryClient();
  useRealtimeInvalidation(selectedCompany?.id);
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<InvoiceTab>('OUTBOUND');
  const [sortField, setSortField] = useState<string>('invoice_issue_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // NAV sync state
  const [syncing, setSyncing] = useState(false);
  const SYNC_COOLDOWN_SECONDS = 10;

  // Server-side cooldown state
  const [serverLastSyncTime, setServerLastSyncTime] = useState<Date | null>(null);
  const [cooldownCheckLoading, setCooldownCheckLoading] = useState(true);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);

  // Check server-side cooldown on load and periodically
  const checkServerCooldown = async () => {
    if (!selectedCompany?.id) {
      setServerLastSyncTime(null);
      setCooldownCheckLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('nav_sync_logs')
        .select('started_at')
        .eq('company_id', selectedCompany.id)
        .in('status', ['completed', 'running'])
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data?.started_at) {
        setServerLastSyncTime(new Date(data.started_at));
      } else {
        setServerLastSyncTime(null);
      }
    } catch (err) {
      console.error('Failed to check cooldown:', err);
    } finally {
      setCooldownCheckLoading(false);
    }
  };

  useEffect(() => {
    checkServerCooldown();
    const interval = setInterval(checkServerCooldown, 30000);
    return () => clearInterval(interval);
  }, [selectedCompany?.id]);

  // Real-time countdown effect
  useEffect(() => {
    if (!serverLastSyncTime) {
      setCooldownSeconds(0);
      return;
    }

    const calculateRemaining = () => {
      const diffMs = Date.now() - serverLastSyncTime.getTime();
      const cooldownMs = SYNC_COOLDOWN_SECONDS * 1000;
      const remaining = Math.max(0, Math.ceil((cooldownMs - diffMs) / 1000));
      setCooldownSeconds(remaining);
    };

    calculateRemaining();
    const interval = setInterval(calculateRemaining, 1000);

    return () => clearInterval(interval);
  }, [serverLastSyncTime]);

  const canSync = useMemo(() => cooldownSeconds === 0, [cooldownSeconds]);

  const formatCooldown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Pagination state
  const [navPageSize, setNavPageSize] = useState(50);
  const [submittedPageSize, setSubmittedPageSize] = useState(50);
  const [navCurrentPage, setNavCurrentPage] = useState(1);
  const [submittedCurrentPage, setSubmittedCurrentPage] = useState(1);

  // Dialog states
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [itemsDialogOpen, setItemsDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<SubmittedInvoice | null>(null);
  const [selectedNavInvoice, setSelectedNavInvoice] = useState<NavInvoice | null>(null);

  // Row selection state for recategorization
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
  const [selectedSubmittedIds, setSelectedSubmittedIds] = useState<Set<string>>(new Set());
  


  const [navFilters, setNavFilters] = useState<NavFilters>({
    search: '',
    dateFrom: undefined,
    dateTo: undefined,
    amountMin: '',
    amountMax: '',
    currency: 'all',
    paid: 'all',
    submitted: 'all',
    project: 'all',
    category: 'all',
    paymentMethod: 'all'
  });

  const [submittedFilters, setSubmittedFilters] = useState<SubmittedFilters>({
    search: '',
    dateFrom: undefined,
    dateTo: undefined,
    amountMin: '',
    amountMax: '',
    currency: 'all',
    category: 'all',
    project: 'all'
  });

  // ── useQuery hooks replacing fetchInvoiceData ──
  const companyId = selectedCompany?.id || '';
  const enabled = !!user && !!selectedCompany;

  const { data: invoices = [], isLoading: navLoading } = useQuery({
    queryKey: queryKeys.navInvoices(companyId, dateFromFormatted, dateToFormatted),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nav_invoices')
        .select('*')
        .eq('company_id', companyId)
        .gte('invoice_issue_date', dateFromFormatted)
        .lte('invoice_issue_date', dateToFormatted)
        .order('invoice_issue_date', { ascending: false });
      if (error) throw error;
      return (data || []) as NavInvoice[];
    },
    enabled,
  });

  const { data: submittedInvoices = [], isLoading: submittedLoading } = useQuery({
    queryKey: queryKeys.submittedInvoices(companyId, dateFromFormatted, dateToFormatted),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, bizonylatsorszam, kibocsatas_datuma, teljesites_datuma, elado_nev, vevo_nev, adoalap_osszesen, brutto_vegosszeg, afa_osszeg_osszesen, penznem, category_id, project_id, image_url, melleklet_url, invoice_direction, reference_number')
        .eq('company_id', companyId)
        .gte('kibocsatas_datuma', dateFromFormatted)
        .lte('kibocsatas_datuma', dateToFormatted)
        .order('kibocsatas_datuma', { ascending: false });
      if (error) throw error;
      return (data || []) as SubmittedInvoice[];
    },
    enabled,
  });

  const { data: linkedInvoicesPool = [] } = useQuery({
    queryKey: queryKeys.linkedInvoices(companyId, dateFromFormatted, dateToFormatted),
    queryFn: async () => {
      const submittedList = submittedInvoices;
      const knownIds = new Set(submittedList.map(inv => inv.id));
      const allExtra: SubmittedInvoice[] = [];

      let pendingBizonylat = new Set(
        submittedList.map(inv => inv.bizonylatsorszam).filter(Boolean) as string[]
      );
      let pendingReference = new Set(
        submittedList.map(inv => inv.reference_number).filter(Boolean) as string[]
      );
      const queriedBizonylat = new Set<string>();
      const queriedReference = new Set<string>();

      for (let depth = 0; depth < 20; depth++) {
        const newBiz = [...pendingBizonylat].filter(k => !queriedBizonylat.has(k));
        const newRef = [...pendingReference].filter(k => !queriedReference.has(k));
        if (newBiz.length === 0 && newRef.length === 0) break;

        newBiz.forEach(k => queriedBizonylat.add(k));
        newRef.forEach(k => queriedReference.add(k));

        const orParts: string[] = [];
        if (newBiz.length > 0) orParts.push(`reference_number.in.(${newBiz.join(',')})`);
        if (newRef.length > 0) orParts.push(`bizonylatsorszam.in.(${newRef.join(',')})`);

        const { data: linkedData } = await supabase
          .from('invoices')
          .select('id, bizonylatsorszam, kibocsatas_datuma, teljesites_datuma, elado_nev, vevo_nev, adoalap_osszesen, brutto_vegosszeg, afa_osszeg_osszesen, penznem, category_id, project_id, image_url, melleklet_url, invoice_direction, reference_number')
          .eq('company_id', companyId)
          .or(orParts.join(','));

        const newInvoices = (linkedData || []).filter(inv => !knownIds.has(inv.id));
        if (newInvoices.length === 0) break;

        pendingBizonylat = new Set<string>();
        pendingReference = new Set<string>();
        for (const inv of newInvoices) {
          knownIds.add(inv.id);
          allExtra.push(inv as SubmittedInvoice);
          if (inv.bizonylatsorszam) pendingBizonylat.add(inv.bizonylatsorszam);
          if (inv.reference_number) pendingReference.add(inv.reference_number);
        }
      }
      return allExtra;
    },
    enabled: enabled && submittedInvoices.length >= 0 && !submittedLoading,
  });

  const { data: partners = [] } = useQuery({
    queryKey: queryKeys.partners(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partners')
        .select('tax_number, name')
        .eq('company_id', companyId);
      if (error) throw error;
      return (data || []) as Partner[];
    },
    enabled,
  });

  const { data: categories = [] } = useQuery({
    queryKey: queryKeys.categories(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name')
        .eq('company_id', companyId);
      if (error) throw error;
      return (data || []) as Category[];
    },
    enabled,
  });

  const { data: projects = [] } = useQuery({
    queryKey: queryKeys.projectsList(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .eq('company_id', companyId);
      if (error) throw error;
      return (data || []) as Project[];
    },
    enabled,
  });

  const { data: allTransactions = [], isLoading: txLoading } = useQuery({
    queryKey: queryKeys.invoiceTransactions(companyId),
    queryFn: async () => {
      const { data } = await supabase
        .from('transactions')
        .select('id, matched_invoice_id, transaction_date, amount, description, currency, type')
        .eq('company_id', companyId)
        .not('matched_invoice_id', 'is', null);
      return (data || []) as TransactionRecord[];
    },
    enabled,
  });

  const matchedInvoiceIds = useMemo(
    () => new Set(allTransactions.map(t => t.matched_invoice_id).filter(Boolean)),
    [allTransactions]
  );

  const loading = navLoading || submittedLoading || txLoading;

  // Invalidation helper — triggers refetch of all invoice queries
  const invalidateInvoiceData = () => {
    queryClient.invalidateQueries({ queryKey: ['navInvoices', companyId] });
    queryClient.invalidateQueries({ queryKey: ['submittedInvoices', companyId] });
    queryClient.invalidateQueries({ queryKey: ['linkedInvoices', companyId] });
    queryClient.invalidateQueries({ queryKey: ['partners', companyId] });
    queryClient.invalidateQueries({ queryKey: ['categories', companyId] });
    queryClient.invalidateQueries({ queryKey: ['projectsList', companyId] });
    queryClient.invalidateQueries({ queryKey: ['invoiceTransactions', companyId] });
  };

  // Reset pagination, selection, and expanded row when company changes
  useEffect(() => {
    setNavCurrentPage(1);
    setSubmittedCurrentPage(1);
    setSelectedInvoiceIds(new Set());
    setSelectedSubmittedIds(new Set());
    setExpandedRowIds(new Set());
  }, [selectedCompany?.id]);

  // Clear selection and expanded row when tab changes
  useEffect(() => {
    setSelectedInvoiceIds(new Set());
    setSelectedSubmittedIds(new Set());
    setExpandedRowIds(new Set());
  }, [activeTab]);

  // NAV credentials check
  const { data: credentialsExist = false } = useQuery({
    queryKey: queryKeys.navCredentials(selectedCompany?.id || ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_nav_credentials')
        .select('id')
        .eq('company_id', selectedCompany!.id)
        .maybeSingle();
      return !error && !!data;
    },
    enabled: !!selectedCompany?.id,
  });

  // Row selection helpers
  const handleRowSelect = (invoiceId: string, checked: boolean) => {
    setSelectedInvoiceIds(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(invoiceId);
      } else {
        newSet.delete(invoiceId);
      }
      return newSet;
    });
  };

  const handleSync = async () => {
    if (!selectedCompany) {
      toast.error('Nincs kiválasztott cég');
      return;
    }

    if (!canSync) {
      toast.error(`Kérlek várj még ${formatCooldown(cooldownSeconds)} a következő szinkronizálásig`);
      return;
    }

    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Helper function to split date range into 35-day chunks (NAV API limit)
      const splitDateRange = (startDate: Date, endDate: Date, maxDays: number = 35): Array<{ from: string, to: string }> => {
        const chunks: Array<{ from: string, to: string }> = [];
        let currentStart = new Date(startDate);

        while (currentStart < endDate) {
          const chunkEnd = new Date(currentStart);
          chunkEnd.setDate(chunkEnd.getDate() + maxDays - 1);

          const actualEnd = chunkEnd > endDate ? endDate : chunkEnd;

          chunks.push({
            from: currentStart.toISOString().split('T')[0],
            to: actualEnd.toISOString().split('T')[0]
          });

          currentStart = new Date(actualEnd);
          currentStart.setDate(currentStart.getDate() + 1);
        }

        return chunks;
      };

      // Last 90 days - split into 35-day chunks due to NAV API limit
      const endDate = new Date();
      const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const dateChunks = splitDateRange(startDate, endDate);

      console.log('[InvoicesPage] NAV sync: splitting 90 days into', dateChunks.length, 'chunks');

      // Process each chunk sequentially, running OUTBOUND and INBOUND in parallel per chunk
      let totalOutbound = 0;
      let totalInbound = 0;
      const errors: string[] = [];

      for (const chunk of dateChunks) {
        console.log('[InvoicesPage] Processing chunk:', chunk);

        const [outboundResult, inboundResult] = await Promise.allSettled([
          supabase.functions.invoke('nav-query-outbound-invoices', {
            body: {
              invoiceDirection: 'OUTBOUND',
              dateFrom: chunk.from,
              dateTo: chunk.to,
              companyId: selectedCompany.id
            },
            headers: {
              Authorization: `Bearer ${session.access_token}`
            }
          }),
          supabase.functions.invoke('nav-query-outbound-invoices', {
            body: {
              invoiceDirection: 'INBOUND',
              dateFrom: chunk.from,
              dateTo: chunk.to,
              companyId: selectedCompany.id
            },
            headers: {
              Authorization: `Bearer ${session.access_token}`
            }
          })
        ]);

        if (outboundResult.status === 'fulfilled') {
          const { data, error } = outboundResult.value;
          if (error || data?.error) {
            errors.push(`Kimenő (${chunk.from}): ${error?.message || data?.error}`);
          } else if (data?.success) {
            totalOutbound += data.totalInvoices || 0;
          }
        }

        if (inboundResult.status === 'fulfilled') {
          const { data, error } = inboundResult.value;
          if (error || data?.error) {
            errors.push(`Bejövő (${chunk.from}): ${error?.message || data?.error}`);
          } else if (data?.success) {
            totalInbound += data.totalInvoices || 0;
          }
        }
      }

      const outboundCount = totalOutbound;
      const inboundCount = totalInbound;

      const totalInvoices = outboundCount + inboundCount;

      // Update server-side cooldown state
      setServerLastSyncTime(new Date());

      if (errors.length === 2) {
        throw new Error(errors.join('; '));
      } else if (errors.length === 1) {
        toast.info(`Szinkronizálás részben sikeres`, {
          description: `${totalInvoices} számla letöltve (${outboundCount} kimenő, ${inboundCount} bejövő). Hibák: ${errors.join('; ')}`
        });
      } else {
        toast.success(`Sikeres szinkronizálás!`, {
          description: `Összesen ${totalInvoices} számla: ${outboundCount} kimenő, ${inboundCount} bejövő`
        });
      }

      // Capture selected invoice IDs for force recategorization
      const forceRecategorizeIds = Array.from(selectedInvoiceIds);

      // Trigger categorization webhook - include force recategorize IDs
      if (totalInvoices > 0 || forceRecategorizeIds.length > 0) {
        try {
          await supabase.functions.invoke('trigger-nav-categorization', {
            body: {
              companyId: selectedCompany.id,
              syncType: 'manual',
              forceRecategorizeIds
            },
            headers: {
              Authorization: `Bearer ${session.access_token}`
            }
          });
          console.log('Categorization webhook triggered', { forceRecategorizeIds: forceRecategorizeIds.length });
        } catch (categorizationError) {
          console.error('Categorization webhook failed:', categorizationError);
        }
      }

      // Clear selection after sync
      setSelectedInvoiceIds(new Set());

      invalidateInvoiceData();

    } catch (error: any) {
      console.error('Sync error:', error);
      toast.error(error.message || 'Nem sikerült szinkronizálni a számlákat');
    } finally {
      setSyncing(false);
    }
  };

  const getPartnerName = (taxNumber: string | null): string => {
    if (!taxNumber) return '-';
    const partner = partners.find(p => p.tax_number === taxNumber);
    return partner?.name || taxNumber;
  };

  // Get partner name from invoice - prefers direct name fields, falls back to partners lookup
  const getInvoicePartnerName = (invoice: NavInvoice): string => {
    if (invoice.invoice_direction === 'INBOUND') {
      // For inbound, the partner is the supplier
      if (invoice.supplier_name) return invoice.supplier_name;
      return getPartnerName(invoice.supplier_tax_number);
    } else {
      // For outbound, the partner is the customer
      if (invoice.customer_name) return invoice.customer_name;
      return getPartnerName(invoice.customer_tax_number);
    }
  };

  const getPartnerTaxNumber = (invoice: NavInvoice): string | null => {
    if (invoice.invoice_direction === 'INBOUND') {
      return invoice.supplier_tax_number;
    } else {
      return invoice.customer_tax_number;
    }
  };

  const getCategoryName = (categoryId: string | null): string => {
    if (!categoryId) return '-';
    return categories.find(c => c.id === categoryId)?.name || '-';
  };

  const getProjectName = (projectId: string | null): string => {
    if (!projectId) return '-';
    return projects.find(p => p.id === projectId)?.name || '-';
  };

  const filteredAndSortedNavInvoices = useMemo(() => {
    const direction = activeTab === 'OUTBOUND' ? 'OUTBOUND' : 'INBOUND';

    let filtered = invoices.filter(invoice => {
      if (invoice.invoice_direction !== direction) return false;

      if (navFilters.search) {
        const searchLower = navFilters.search.toLowerCase();
        const partnerTaxNumber = getPartnerTaxNumber(invoice);
        const partnerName = getInvoicePartnerName(invoice);
        const matchesSearch =
          invoice.invoice_number?.toLowerCase().includes(searchLower) ||
          partnerTaxNumber?.toLowerCase().includes(searchLower) ||
          partnerName.toLowerCase().includes(searchLower);

        if (!matchesSearch) return false;
      }

      if (navFilters.dateFrom && invoice.invoice_issue_date) {
        if (new Date(invoice.invoice_issue_date) < navFilters.dateFrom) return false;
      }
      if (navFilters.dateTo && invoice.invoice_issue_date) {
        if (new Date(invoice.invoice_issue_date) > navFilters.dateTo) return false;
      }

      const invoiceAmount = invoice.invoice_gross_amount || 0;
      if (navFilters.amountMin && invoiceAmount < parseFloat(navFilters.amountMin)) return false;
      if (navFilters.amountMax && invoiceAmount > parseFloat(navFilters.amountMax)) return false;

      if (navFilters.currency && navFilters.currency !== 'all' && invoice.currency !== navFilters.currency) return false;

      if (navFilters.paid !== 'all') {
        const isPaid = !!invoice.transaction_id;
        if (navFilters.paid === 'yes' && !isPaid) return false;
        if (navFilters.paid === 'no' && isPaid) return false;
      }

      if (navFilters.submitted !== 'all') {
        const isSubmitted = invoice.submitted === true;
        if (navFilters.submitted === 'yes' && !isSubmitted) return false;
        if (navFilters.submitted === 'no' && isSubmitted) return false;
      }

      if (navFilters.project !== 'all') {
        if (navFilters.project === 'none' && invoice.project_id !== null) return false;
        if (navFilters.project !== 'none' && invoice.project_id !== navFilters.project) return false;
      }

      if (navFilters.category !== 'all') {
        if (navFilters.category === 'none' && invoice.category_id !== null) return false;
        if (navFilters.category !== 'none' && invoice.category_id !== navFilters.category) return false;
      }

      if (navFilters.paymentMethod !== 'all') {
        if (navFilters.paymentMethod === 'none' && invoice.payment_method) return false;
        if (navFilters.paymentMethod !== 'none' && invoice.payment_method !== navFilters.paymentMethod) return false;
      }

      return true;
    });

    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      if (sortField === 'partner_name') {
        aValue = getInvoicePartnerName(a)?.toLowerCase() || '';
        bValue = getInvoicePartnerName(b)?.toLowerCase() || '';
      } else if (sortField === 'invoice_issue_date' || sortField === 'invoice_delivery_date') {
        aValue = a[sortField as keyof NavInvoice] ? new Date(a[sortField as keyof NavInvoice] as string).getTime() : 0;
        bValue = b[sortField as keyof NavInvoice] ? new Date(b[sortField as keyof NavInvoice] as string).getTime() : 0;
      } else {
        aValue = a[sortField as keyof NavInvoice];
        bValue = b[sortField as keyof NavInvoice];
      }

      // Handle nulls - push to end
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [invoices, navFilters, sortField, sortDirection, partners, activeTab]);

  // Paginated NAV invoices
  const paginatedNavInvoices = useMemo(() => {
    const startIndex = (navCurrentPage - 1) * navPageSize;
    return filteredAndSortedNavInvoices.slice(startIndex, startIndex + navPageSize);
  }, [filteredAndSortedNavInvoices, navCurrentPage, navPageSize]);

  const navTotalPages = Math.ceil(filteredAndSortedNavInvoices.length / navPageSize);

  // Row selection helpers (must be after paginatedNavInvoices)
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const newSet = new Set(selectedInvoiceIds);
      paginatedNavInvoices.forEach(inv => newSet.add(inv.id));
      setSelectedInvoiceIds(newSet);
    } else {
      const newSet = new Set(selectedInvoiceIds);
      paginatedNavInvoices.forEach(inv => newSet.delete(inv.id));
      setSelectedInvoiceIds(newSet);
    }
  };

  const allVisibleSelected = useMemo(() => {
    if (paginatedNavInvoices.length === 0) return false;
    return paginatedNavInvoices.every(inv => selectedInvoiceIds.has(inv.id));
  }, [paginatedNavInvoices, selectedInvoiceIds]);

  const isSubmittedTab = activeTab === 'SUBMITTED_INBOUND' || activeTab === 'SUBMITTED_OUTBOUND';

  // Submitted row selection helpers
  const handleSubmittedRowSelect = (invoiceId: string, checked: boolean) => {
    setSelectedSubmittedIds(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(invoiceId);
      } else {
        newSet.delete(invoiceId);
      }
      return newSet;
    });
  };


  const filteredAndSortedSubmittedInvoices = useMemo(() => {
    const submittedDirection = activeTab === 'SUBMITTED_OUTBOUND' ? 'OUTBOUND' : 'INBOUND';

    let filtered = submittedInvoices.filter(invoice => {
      if (invoice.invoice_direction !== submittedDirection) return false;

      if (submittedFilters.search) {
        const searchLower = submittedFilters.search.toLowerCase();
        const matchesSearch =
          invoice.elado_nev?.toLowerCase().includes(searchLower) ||
          invoice.vevo_nev?.toLowerCase().includes(searchLower);

        if (!matchesSearch) return false;
      }

      if (submittedFilters.dateFrom && invoice.kibocsatas_datuma) {
        if (new Date(invoice.kibocsatas_datuma) < submittedFilters.dateFrom) return false;
      }
      if (submittedFilters.dateTo && invoice.kibocsatas_datuma) {
        if (new Date(invoice.kibocsatas_datuma) > submittedFilters.dateTo) return false;
      }

      const invoiceAmount = invoice.brutto_vegosszeg || 0;
      if (submittedFilters.amountMin && invoiceAmount < parseFloat(submittedFilters.amountMin)) return false;
      if (submittedFilters.amountMax && invoiceAmount > parseFloat(submittedFilters.amountMax)) return false;

      if (submittedFilters.currency && submittedFilters.currency !== 'all' && invoice.penznem !== submittedFilters.currency) return false;

      if (submittedFilters.category !== 'all') {
        if (submittedFilters.category === 'none' && invoice.category_id !== null) return false;
        if (submittedFilters.category !== 'none' && invoice.category_id !== submittedFilters.category) return false;
      }

      if (submittedFilters.project !== 'all') {
        if (submittedFilters.project === 'none' && invoice.project_id !== null) return false;
        if (submittedFilters.project !== 'none' && invoice.project_id !== submittedFilters.project) return false;
      }

      return true;
    });

    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      if (sortField === 'kibocsatas_datuma' || sortField === 'invoice_issue_date') {
        aValue = a.kibocsatas_datuma ? new Date(a.kibocsatas_datuma).getTime() : 0;
        bValue = b.kibocsatas_datuma ? new Date(b.kibocsatas_datuma).getTime() : 0;
      } else if (sortField === 'teljesites_datuma' || sortField === 'invoice_delivery_date') {
        aValue = a.teljesites_datuma ? new Date(a.teljesites_datuma).getTime() : 0;
        bValue = b.teljesites_datuma ? new Date(b.teljesites_datuma).getTime() : 0;
      } else if (sortField === 'brutto_vegosszeg' || sortField === 'invoice_gross_amount') {
        aValue = a.brutto_vegosszeg || 0;
        bValue = b.brutto_vegosszeg || 0;
      } else if (sortField === 'adoalap_osszesen' || sortField === 'invoice_net_amount') {
        aValue = a.adoalap_osszesen || 0;
        bValue = b.adoalap_osszesen || 0;
      } else if (sortField === 'afa_osszeg_osszesen' || sortField === 'invoice_vat_amount') {
        aValue = a.afa_osszeg_osszesen || 0;
        bValue = b.afa_osszeg_osszesen || 0;
      } else if (sortField === 'elado_nev' || sortField === 'partner_name') {
        aValue = a.elado_nev?.toLowerCase() || '';
        bValue = b.elado_nev?.toLowerCase() || '';
      } else if (sortField === 'vevo_nev') {
        aValue = a.vevo_nev?.toLowerCase() || '';
        bValue = b.vevo_nev?.toLowerCase() || '';
      } else if (sortField === 'bizonylatsorszam' || sortField === 'invoice_number') {
        aValue = a.bizonylatsorszam?.toLowerCase() || '';
        bValue = b.bizonylatsorszam?.toLowerCase() || '';
      } else {
        aValue = a.kibocsatas_datuma ? new Date(a.kibocsatas_datuma).getTime() : 0;
        bValue = b.kibocsatas_datuma ? new Date(b.kibocsatas_datuma).getTime() : 0;
      }

      // Handle nulls - push to end
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [submittedInvoices, submittedFilters, sortField, sortDirection, activeTab]);

  // Paginated submitted invoices
  const paginatedSubmittedInvoices = useMemo(() => {
    const startIndex = (submittedCurrentPage - 1) * submittedPageSize;
    return filteredAndSortedSubmittedInvoices.slice(startIndex, startIndex + submittedPageSize);
  }, [filteredAndSortedSubmittedInvoices, submittedCurrentPage, submittedPageSize]);

  const submittedTotalPages = Math.ceil(filteredAndSortedSubmittedInvoices.length / submittedPageSize);

  const handleSubmittedSelectAll = (checked: boolean) => {
    if (checked) {
      const newSet = new Set(selectedSubmittedIds);
      paginatedSubmittedInvoices.forEach(inv => newSet.add(inv.id));
      setSelectedSubmittedIds(newSet);
    } else {
      const newSet = new Set(selectedSubmittedIds);
      paginatedSubmittedInvoices.forEach(inv => newSet.delete(inv.id));
      setSelectedSubmittedIds(newSet);
    }
  };

  const allVisibleSubmittedSelected = useMemo(() => {
    if (paginatedSubmittedInvoices.length === 0) return false;
    return paginatedSubmittedInvoices.every(inv => selectedSubmittedIds.has(inv.id));
  }, [paginatedSubmittedInvoices, selectedSubmittedIds]);

  // Lookup maps for expandable rows
  const navToSubmittedMap = useMemo(() => {
    const map = new Map<string, typeof submittedInvoices>();
    submittedInvoices.forEach(inv => {
      if (inv.bizonylatsorszam) {
        const existing = map.get(inv.bizonylatsorszam) || [];
        existing.push(inv);
        map.set(inv.bizonylatsorszam, existing);
      }
    });
    return map;
  }, [submittedInvoices]);

  const submittedToNavMap = useMemo(() => {
    const map = new Map<string, NavInvoice[]>();
    invoices.forEach(inv => {
      const existing = map.get(inv.invoice_number) || [];
      existing.push(inv);
      map.set(inv.invoice_number, existing);
    });
    return map;
  }, [invoices]);

  const submittedIdToTransactionsMap = useMemo(() => {
    const map = new Map<string, TransactionRecord[]>();
    allTransactions.forEach(tx => {
      if (tx.matched_invoice_id) {
        const existing = map.get(tx.matched_invoice_id) || [];
        existing.push(tx);
        map.set(tx.matched_invoice_id, existing);
      }
    });
    return map;
  }, [allTransactions]);

  // Linked invoices maps (reference_number based)
  const linkedInvoicesMap = useMemo(() => {
    // Combine date-filtered invoices with extra linked invoices fetched without date filter
    const allInvoices = [...submittedInvoices, ...linkedInvoicesPool];
    const byBizonylat = new Map<string, SubmittedInvoice[]>();
    const byReference = new Map<string, SubmittedInvoice[]>();
    allInvoices.forEach(inv => {
      if (inv.bizonylatsorszam) {
        const key = inv.bizonylatsorszam.toUpperCase();
        const arr = byBizonylat.get(key) || [];
        arr.push(inv);
        byBizonylat.set(key, arr);
      }
      if (inv.reference_number) {
        const key = inv.reference_number.toUpperCase();
        const arr = byReference.get(key) || [];
        arr.push(inv);
        byReference.set(key, arr);
      }
    });
    return { byBizonylat, byReference };
  }, [submittedInvoices, linkedInvoicesPool]);

  const getLinkedInvoices = (invoice: SubmittedInvoice): (SubmittedInvoice & { relationDirection: 'parent' | 'child' })[] => {
    const linked: (SubmittedInvoice & { relationDirection: 'parent' | 'child' })[] = [];
    const visited = new Set([invoice.id]);

    // Walk up: follow reference_number chain recursively
    let currentRef = invoice.reference_number;
    while (currentRef) {
      const parents = linkedInvoicesMap.byBizonylat.get(currentRef.toUpperCase()) || [];
      const parent = parents.find(p => !visited.has(p.id));
      if (!parent) break;
      visited.add(parent.id);
      linked.push({ ...parent, relationDirection: 'parent' });
      currentRef = parent.reference_number;
    }

    // Walk down: follow children recursively (BFS)
    const queue = [invoice.bizonylatsorszam];
    while (queue.length > 0) {
      const bizSorszam = queue.shift();
      if (!bizSorszam) continue;
      const children = linkedInvoicesMap.byReference.get(bizSorszam.toUpperCase()) || [];
      for (const child of children) {
        if (visited.has(child.id)) continue;
        visited.add(child.id);
        linked.push({ ...child, relationDirection: 'child' });
        if (child.bizonylatsorszam) queue.push(child.bizonylatsorszam);
      }
    }

    return linked;
  };

  // Get matched data for a NAV invoice row
  const getNavInvoiceMatches = (navInvoice: NavInvoice) => {
    const matchedSubmitted = navToSubmittedMap.get(navInvoice.invoice_number) || [];
    const matchedTx: TransactionRecord[] = [];
    // Transactions matched via submitted invoices
    matchedSubmitted.forEach(sub => {
      const txs = submittedIdToTransactionsMap.get(sub.id) || [];
      matchedTx.push(...txs);
    });
    // Transactions matched DIRECTLY to this NAV invoice
    const directTxs = submittedIdToTransactionsMap.get(navInvoice.id) || [];
    directTxs.forEach(tx => {
      if (!matchedTx.some(t => t.id === tx.id)) matchedTx.push(tx);
    });
    // Linked invoices from matched submitted
    const linkedInvs: SubmittedInvoice[] = [];
    matchedSubmitted.forEach(sub => {
      getLinkedInvoices(sub).forEach(l => {
        if (!linkedInvs.some(x => x.id === l.id) && !matchedSubmitted.some(x => x.id === l.id)) linkedInvs.push(l);
      });
    });
    return { matchedSubmitted, matchedTransactions: matchedTx, matchedNav: [] as NavInvoice[], linkedInvoices: linkedInvs };
  };

  // Get matched data for a submitted invoice row
  const getSubmittedInvoiceMatches = (submitted: SubmittedInvoice) => {
    const matchedNav = submitted.bizonylatsorszam ? (submittedToNavMap.get(submitted.bizonylatsorszam) || []) : [];
    const matchedTx = submittedIdToTransactionsMap.get(submitted.id) || [];
    const linkedInvs = getLinkedInvoices(submitted);
    return { matchedSubmitted: [] as SubmittedInvoice[], matchedTransactions: matchedTx, matchedNav, linkedInvoices: linkedInvs };
  };

  const handleRowClick = (invoiceId: string, e: React.MouseEvent) => {
    // Don't toggle if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, [role="checkbox"], [role="combobox"], [data-radix-collection-item]')) return;
    setExpandedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(invoiceId)) next.delete(invoiceId);
      else next.add(invoiceId);
      return next;
    });
  };

  // Reset page when filters change
  useEffect(() => {
    setNavCurrentPage(1);
  }, [navFilters, activeTab]);

  useEffect(() => {
    setSubmittedCurrentPage(1);
  }, [submittedFilters]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getPaymentMethodLabel = (method: string | null) => {
    switch (method) {
      case 'TRANSFER': return 'Átutalás';
      case 'CASH': return 'Készpénz';
      case 'CARD': return 'Bankkártya';
      case 'VOUCHER': return 'Utalvány';
      case 'OTHER': return 'Egyéb';
      default: return 'Nem megadott';
    }
  };

  const clearNavFilters = () => {
    setNavFilters({
      search: '',
      dateFrom: undefined,
      dateTo: undefined,
      amountMin: '',
      amountMax: '',
      currency: 'all',
      paid: 'all',
      submitted: 'all',
      project: 'all',
      category: 'all',
      paymentMethod: 'all'
    });
  };

  const handleProjectChange = async (invoiceId: string, projectId: string | null) => {
    try {
      const { error } = await supabase
        .from('nav_invoices')
        .update({ project_id: projectId === 'none' ? null : projectId })
        .eq('id', invoiceId);

      if (error) throw error;

      invalidateInvoiceData();
      toast.success('Projekt hozzárendelve');
    } catch (error) {
      console.error('Error updating project:', error);
      toast.error('Hiba a projekt hozzárendelésekor');
    }
  };

  const handleCategoryChange = async (invoiceId: string, categoryId: string | null) => {
    try {
      const { error } = await supabase
        .from('nav_invoices')
        .update({ category_id: categoryId === 'none' ? null : categoryId })
        .eq('id', invoiceId);

      if (error) throw error;

      invalidateInvoiceData();
      toast.success('Kategória hozzárendelve');
    } catch (error) {
      console.error('Error updating category:', error);
      toast.error('Hiba a kategória hozzárendelésekor');
    }
  };

  const clearSubmittedFilters = () => {
    setSubmittedFilters({
      search: '',
      dateFrom: undefined,
      dateTo: undefined,
      amountMin: '',
      amountMax: '',
      currency: 'all',
      category: 'all',
      project: 'all'
    });
  };


  const handleToggleSubmitted = async (invoice: NavInvoice) => {
    try {
      const newValue = !invoice.submitted;
      const { error } = await supabase
        .from('nav_invoices')
        .update({ submitted: newValue })
        .eq('id', invoice.id);

      if (error) throw error;

      invalidateInvoiceData();
      toast.success(newValue ? 'Beküldve megjelölve' : 'Beküldve visszavonva');
    } catch (error) {
      console.error('Error updating submitted status:', error);
      toast.error('Hiba a státusz frissítésekor');
    }
  };

  const handleExport = (exportFormat: 'csv' | 'xlsx') => {
    if (isSubmittedTab) {
      handleExportSubmitted(exportFormat);
    } else {
      handleExportNav(exportFormat);
    }
  };

  const handleExportNav = (exportFormat: 'csv' | 'xlsx') => {
    const getExportData = (invoice: NavInvoice) => {
      const partnerTaxNumber = getPartnerTaxNumber(invoice);
      return [
        invoice.invoice_direction || '',
        invoice.invoice_number || '',
        invoice.invoice_issue_date || '',
        invoice.invoice_delivery_date || '',
        getInvoicePartnerName(invoice),
        partnerTaxNumber || '',
        invoice.invoice_net_amount?.toString() || '0',
        invoice.invoice_gross_amount?.toString() || '0',
        invoice.invoice_vat_amount?.toString() || '0',
        invoice.currency || 'HUF',
        invoice.transaction_id ? 'Igen' : 'Nem',
        invoice.submitted ? 'Igen' : 'Nem'
      ];
    };

    const headers = [
      'Irány', 'Bizonylatsorszám', 'Kibocsátás dátuma', 'Teljesítés dátuma',
      'Partner név', 'Partner adószám', 'Nettó összeg', 'Bruttó összeg',
      'ÁFA összeg', 'Pénznem', 'Fizetve', 'Beküldve'
    ];

    const exportData = filteredAndSortedNavInvoices.map(invoice => getExportData(invoice));
    exportToFile(headers, exportData, exportFormat, 'nav_szamlak');
  };

  const handleExportSubmitted = (exportFormat: 'csv' | 'xlsx') => {
    const getExportData = (invoice: SubmittedInvoice) => {
      return [
        invoice.kibocsatas_datuma || '',
        invoice.teljesites_datuma || '',
        invoice.elado_nev || '',
        invoice.vevo_nev || '',
        invoice.adoalap_osszesen?.toString() || '0',
        invoice.brutto_vegosszeg?.toString() || '0',
        invoice.afa_osszeg_osszesen?.toString() || '0',
        invoice.penznem || 'HUF',
        getCategoryName(invoice.category_id),
        getProjectName(invoice.project_id)
      ];
    };

    const headers = [
      'Kibocsátás dátuma', 'Teljesítés dátuma', 'Eladó', 'Vevő',
      'Nettó összeg', 'Bruttó összeg', 'ÁFA összeg', 'Pénznem',
      'Kategória', 'Projekt'
    ];

    const exportData = filteredAndSortedSubmittedInvoices.map(invoice => getExportData(invoice));
    exportToFile(headers, exportData, exportFormat, 'bekuldott_szamlak');
  };

  const exportToFile = (headers: string[], data: string[][], exportFormat: 'csv' | 'xlsx', filename: string) => {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');

    if (exportFormat === 'csv') {
      const csvContent = [
        headers.join(','),
        ...data.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${filename}_${timestamp}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Számlák exportálva CSV formátumban");
    } else {
      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Számlák');

      XLSX.writeFile(workbook, `${filename}_${timestamp}.xlsx`);

      toast.success("Számlák exportálva XLSX formátumban");
    }
  };

  const openImageDialog = (invoice: SubmittedInvoice) => {
    setSelectedInvoice(invoice);
    setImageDialogOpen(true);
  };

  const openEditDialog = (invoice: SubmittedInvoice) => {
    setSelectedInvoice(invoice);
    setEditDialogOpen(true);
  };

  const handleEditSave = () => {
    invalidateInvoiceData();
  };

  const getResultCount = () => {
    if (isSubmittedTab) {
      return filteredAndSortedSubmittedInvoices.length;
    }
    return filteredAndSortedNavInvoices.length;
  };

  return (
    <div className="h-full bg-background">
      <main className="w-full max-w-none px-4 py-4">
        <Card>
          <CardHeader>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-2xl font-bold">Számlák</CardTitle>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-5 w-5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Itt láthatod a NAV-ból szinkronizált és a beküldött számláidat. Szűrj irány, dátum, összeg vagy állapot szerint. Exportálhatod CSV vagy Excel formátumban.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <CardDescription>
                  Számlák áttekintése és kezelése - {getResultCount()} találat
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSync}
                        disabled={syncing || !credentialsExist || !canSync}
                      >
                        <RefreshCw className={cn("h-4 w-4 mr-2", syncing && "animate-spin")} />
                        {syncing ? 'Szinkronizálás...' : !canSync ? `Várj ${formatCooldown(cooldownSeconds)}` : 'Szinkronizálás'}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {!credentialsExist
                        ? 'Állítsd be a NAV integrációt az Integrációk oldalon'
                        : !canSync
                          ? `Legközelebb ${formatCooldown(cooldownSeconds)} múlva szinkronizálhatsz`
                          : selectedInvoiceIds.size > 0
                            ? `NAV szinkronizálás + ${selectedInvoiceIds.size} kijelölt számla újrakategorizálása`
                            : 'NAV számlák szinkronizálása (utolsó 30 nap)'
                      }
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Download className="h-4 w-4 mr-2" />
                              Export
                              <ChevronDown className="h-4 w-4 ml-2" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => handleExport('csv')}>
                              <FileText className="h-4 w-4 mr-2" />
                              Export CSV
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExport('xlsx')}>
                              <FileText className="h-4 w-4 mr-2" />
                              Export XLSX
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Exportálhatod a számlákat CSV vagy Excel formátumban</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as InvoiceTab)}>
              <TabsList className="grid w-full max-w-2xl grid-cols-4">
                <TabsTrigger value="OUTBOUND">Kimenő (NAV)</TabsTrigger>
                <TabsTrigger value="INBOUND">Bejövő (NAV)</TabsTrigger>
                <TabsTrigger value="SUBMITTED_OUTBOUND">Beküldött (Kimenő)</TabsTrigger>
                <TabsTrigger value="SUBMITTED_INBOUND">Beküldött (Bejövő)</TabsTrigger>
              </TabsList>

              {/* NAV Invoice Tabs (OUTBOUND & INBOUND) */}
              {(activeTab === 'OUTBOUND' || activeTab === 'INBOUND') && (
                <TabsContent value={activeTab} className="space-y-4 mt-4">
                  {/* NAV Filters - Compact Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3 p-4 bg-muted/20 rounded-lg border border-border/30">
                    <div className="relative col-span-2 md:col-span-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input
                        placeholder="Keresés..."
                        value={navFilters.search}
                        onChange={(e) => setNavFilters(prev => ({ ...prev, search: e.target.value }))}
                        className="pl-9 h-9 bg-secondary/50 border border-white/10 focus:border-primary/50"
                      />
                    </div>

                    <Select
                      value={navFilters.currency}
                      onValueChange={(value) => setNavFilters(prev => ({ ...prev, currency: value }))}
                    >
                      <SelectTrigger className="h-9 bg-secondary/50 border border-white/10">
                        <SelectValue placeholder="Pénznem" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Minden pénznem</SelectItem>
                        {Array.from(new Set(invoices.map(inv => inv.currency).filter(Boolean))).sort().map((currency) => (
                          <SelectItem key={currency} value={currency!}>
                            {currency}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={navFilters.paid}
                      onValueChange={(value) => setNavFilters(prev => ({ ...prev, paid: value }))}
                    >
                      <SelectTrigger className="h-9 bg-secondary/50 border border-white/10">
                        <SelectValue placeholder="Fizetve" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Mind</SelectItem>
                        <SelectItem value="yes">Kifizetve</SelectItem>
                        <SelectItem value="no">Nyitott</SelectItem>
                      </SelectContent>
                    </Select>

                    {activeTab === 'INBOUND' && (
                      <Select
                        value={navFilters.submitted}
                        onValueChange={(value) => setNavFilters(prev => ({ ...prev, submitted: value }))}
                      >
                        <SelectTrigger className="h-9 bg-secondary/50 border border-white/10">
                          <SelectValue placeholder="Beküldve" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Mind</SelectItem>
                          <SelectItem value="yes">Igen</SelectItem>
                          <SelectItem value="no">Nem</SelectItem>
                        </SelectContent>
                      </Select>
                    )}

                    {activeTab === 'INBOUND' && (
                      <Select
                        value={navFilters.category}
                        onValueChange={(value) => setNavFilters(prev => ({ ...prev, category: value }))}
                      >
                        <SelectTrigger className="h-9 bg-secondary/50 border border-white/10">
                          <SelectValue placeholder="Kategória" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Minden kategória</SelectItem>
                          <SelectItem value="none">Nincs kategória</SelectItem>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    <Select
                      value={navFilters.project}
                      onValueChange={(value) => setNavFilters(prev => ({ ...prev, project: value }))}
                    >
                      <SelectTrigger className="h-9 bg-secondary/50 border border-white/10">
                        <SelectValue placeholder="Projekt" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Minden projekt</SelectItem>
                        <SelectItem value="none">Nincs projekt</SelectItem>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={navFilters.paymentMethod}
                      onValueChange={(value) => setNavFilters(prev => ({ ...prev, paymentMethod: value }))}
                    >
                      <SelectTrigger className="h-9 bg-secondary/50 border border-white/10">
                        <SelectValue placeholder="Fiz. mód" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Minden fiz. mód</SelectItem>
                        <SelectItem value="none">Nem megadott</SelectItem>
                        <SelectItem value="TRANSFER">Átutalás</SelectItem>
                        <SelectItem value="CASH">Készpénz</SelectItem>
                        <SelectItem value="CARD">Bankkártya</SelectItem>
                        <SelectItem value="VOUCHER">Utalvány</SelectItem>
                        <SelectItem value="OTHER">Egyéb</SelectItem>
                      </SelectContent>
                    </Select>


                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearNavFilters}
                      className="h-9 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Törlés
                    </Button>
                  </div>

                  {/* Top Pagination */}
                  <UnifiedPagination
                    currentPage={navCurrentPage}
                    totalPages={navTotalPages}
                    totalItems={filteredAndSortedNavInvoices.length}
                    pageSize={navPageSize}
                    onPageChange={setNavCurrentPage}
                    onPageSizeChange={(size) => { setNavPageSize(size); setNavCurrentPage(1); }}
                    className="mb-3"
                  />

                  {/* NAV Invoice Table */}
                  <div className="rounded-lg border border-border/50 overflow-x-auto">
                    <Table className="table-fixed compact-table">
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableHead className="w-[60px] pl-6">
                            <div className="flex items-center gap-3">
                              <div className="w-3.5" />
                              <Checkbox
                                checked={allVisibleSelected}
                                onCheckedChange={(checked) => handleSelectAll(!!checked)}
                                aria-label="Összes kijelölése"
                              />
                            </div>
                          </TableHead>
                          <TableHead
                            className="cursor-pointer hover:bg-muted/50 font-semibold w-[150px]"
                            onClick={() => handleSort('invoice_number')}
                          >
                            <div className="flex items-center gap-2">
                              Bizonylatsorszám
                              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                          </TableHead>
                          <TableHead
                            className="cursor-pointer hover:bg-muted/50 font-semibold w-28 text-center"
                            onClick={() => handleSort('invoice_issue_date')}
                          >
                            <div className="flex items-center justify-center gap-2">
                              Kibocsátás
                              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                          </TableHead>
                          <TableHead
                            className="cursor-pointer hover:bg-muted/50 font-semibold w-28 text-center"
                            onClick={() => handleSort('invoice_delivery_date')}
                          >
                            <div className="flex items-center justify-center gap-2">
                              Teljesítés
                              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                          </TableHead>
                          <TableHead
                            className="cursor-pointer hover:bg-muted/50 font-semibold"
                            onClick={() => handleSort('partner_name')}
                          >
                            <div className="flex items-center gap-2">
                              Partner
                              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                          </TableHead>
                          <TableHead
                            className="text-right cursor-pointer hover:bg-muted/50 font-semibold w-32"
                            onClick={() => handleSort('invoice_net_amount')}
                          >
                            <div className="flex items-center justify-end gap-2">
                              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                              Nettó
                            </div>
                          </TableHead>
                          <TableHead
                            className="text-right cursor-pointer hover:bg-muted/50 font-semibold w-32"
                            onClick={() => handleSort('invoice_gross_amount')}
                          >
                            <div className="flex items-center justify-end gap-2">
                              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                              Bruttó
                            </div>
                          </TableHead>
                          <TableHead
                            className="text-right cursor-pointer hover:bg-muted/50 font-semibold w-32"
                            onClick={() => handleSort('invoice_vat_amount')}
                          >
                            <div className="flex items-center justify-end gap-2">
                              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                              ÁFA
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold w-24 text-center">
                            <div className="flex items-center justify-center gap-1">
                              Státusz
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    <p>A számla fizetési állapota automatikusan változik: „Kifizetve" lesz, ha a számlához tartozó tranzakció párosítva van.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </TableHead>
                          {activeTab === 'INBOUND' && (
                            <TableHead className="font-semibold w-20 text-center">Beküldve</TableHead>
                          )}
                          {activeTab === 'INBOUND' && (
                            <TableHead className="font-semibold w-[140px] text-center">Kategória</TableHead>
                          )}
                          <TableHead className="font-semibold w-[140px] text-center">Projekt</TableHead>
                          <TableHead className="font-semibold w-[110px] text-center">Fiz. mód</TableHead>
                          <TableHead className="font-semibold w-20 text-center">Tételek</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading ? (
                          <TableSkeleton rows={10} columns={activeTab === 'INBOUND' ? 14 : 12} />
                        ) : paginatedNavInvoices.length === 0 ? (
                          <TableEmptyState
                            colSpan={activeTab === 'INBOUND' ? 14 : 12}
                            title="Nincs megjeleníthető számla"
                            description="Próbáld módosítani a szűrőket vagy keresési feltételeket."
                            onClearFilters={clearNavFilters}
                          />
                        ) : (
                          paginatedNavInvoices.map((invoice) => {
                            const partnerTaxNumber = getPartnerTaxNumber(invoice);
                            const partnerName = getInvoicePartnerName(invoice);

                            return (
                              <React.Fragment key={invoice.id}>
                                <TableRow className={cn(
                                  "group cursor-pointer",
                                  selectedInvoiceIds.has(invoice.id) && "bg-primary/5",
                                  !selectedInvoiceIds.has(invoice.id) && !!invoice.transaction_id && "bg-[hsl(var(--success-row-bg))] text-[hsl(var(--success-row-text))] border-l-4 border-l-success border-b border-border/40 hover:shadow-[inset_0_0_0_100vw_rgba(0,0,0,0.04)] dark:hover:shadow-[inset_0_0_0_100vw_rgba(255,255,255,0.06)]",
                                  !selectedInvoiceIds.has(invoice.id) && !invoice.transaction_id && "bg-[hsl(var(--error-row-bg))] text-[hsl(var(--error-row-text))] border-l-4 border-l-destructive border-b border-border/40 hover:shadow-[inset_0_0_0_100vw_rgba(0,0,0,0.04)] dark:hover:shadow-[inset_0_0_0_100vw_rgba(255,255,255,0.06)]",
                                  expandedRowIds.has(invoice.id) && "border-b-0"
                                )} onClick={(e) => handleRowClick(invoice.id, e)}>
                                  <TableCell className="pl-6">
                                    <div className="flex items-center gap-3">
                                      <ChevronDown className={cn(
                                        "h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200",
                                        expandedRowIds.has(invoice.id) && "rotate-180"
                                      )} />
                                      <Checkbox
                                        checked={selectedInvoiceIds.has(invoice.id)}
                                        onCheckedChange={(checked) => handleRowSelect(invoice.id, !!checked)}
                                        aria-label={`${invoice.invoice_number} kijelölése`}
                                      />
                                    </div>
                                  </TableCell>
                                  <TableCell className="font-mono text-sm font-medium">
                                    <CopyableCell
                                      value={invoice.invoice_number}
                                      truncate
                                      maxWidth="105px"
                                      ariaLabel={`${invoice.invoice_number} bizonylatsorszám másolása`}
                                    />
                                  </TableCell>
                                  <TableCell className="text-center text-muted-foreground tabular-nums">
                                    {invoice.invoice_issue_date
                                      ? format(new Date(invoice.invoice_issue_date), 'yyyy. MM. dd.', { locale: hu })
                                      : '-'}
                                  </TableCell>
                                  <TableCell className="text-center text-muted-foreground tabular-nums">
                                    {invoice.invoice_delivery_date
                                      ? format(new Date(invoice.invoice_delivery_date), 'yyyy. MM. dd.', { locale: hu })
                                      : '-'}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <div className={cn(
                                        "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0",
                                        getAvatarColor(partnerName)
                                      )}>
                                        {getInitials(partnerName)}
                                      </div>
                                      <CopyableCell
                                        value={partnerName}
                                        truncate
                                        maxWidth="100%"
                                        className="font-medium text-xs"
                                        ariaLabel={`${partnerName} másolása`}
                                      />
                                    </div>
                                  </TableCell>
                                  <TableCell className={cn("text-right font-mono tabular-nums", activeTab === 'INBOUND' ? "text-destructive" : "text-success")}>
                                    <CopyableCell
                                      value={(invoice.invoice_net_amount || 0).toString()}
                                      displayValue={formatCurrency(invoice.invoice_net_amount || 0, invoice.currency || 'HUF')}
                                      className="justify-end"
                                      ariaLabel="Nettó összeg másolása"
                                    />
                                  </TableCell>
                                  <TableCell className={cn("text-right font-mono tabular-nums font-medium", activeTab === 'INBOUND' ? "text-destructive" : "text-success")}>
                                    <CopyableCell
                                      value={(invoice.invoice_gross_amount || 0).toString()}
                                      displayValue={formatCurrency(invoice.invoice_gross_amount || 0, invoice.currency || 'HUF')}
                                      className="justify-end"
                                      ariaLabel="Bruttó összeg másolása"
                                    />
                                  </TableCell>
                                  <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                                    <CopyableCell
                                      value={(invoice.invoice_vat_amount || 0).toString()}
                                      displayValue={formatCurrency(invoice.invoice_vat_amount || 0, invoice.currency || 'HUF')}
                                      className="justify-end"
                                      align="right"
                                      ariaLabel="ÁFA összeg másolása"
                                    />
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${invoice.transaction_id ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                                      }`}>
                                      {invoice.transaction_id ? 'Kifizetve' : 'Nyitott'}
                                    </span>
                                  </TableCell>
                                  {activeTab === 'INBOUND' && (
                                    <TableCell className="text-center">
                                      <Checkbox
                                        checked={invoice.submitted === true}
                                        disabled
                                        className="cursor-default opacity-70"
                                      />
                                    </TableCell>
                                  )}
                                  {activeTab === 'INBOUND' && (
                                    <TableCell className="text-center">
                                      <Select
                                        value={invoice.category_id || 'none'}
                                        onValueChange={(value) => handleCategoryChange(invoice.id, value)}
                                      >
                                        <SelectTrigger className="w-[120px] h-8 mx-auto bg-transparent border-transparent hover:border-border/50 focus:border-primary/50 transition-colors [&>span]:truncate [&>span]:flex-1 [&>svg]:shrink-0">
                                          <SelectValue placeholder="Válassz..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="none">-</SelectItem>
                                          {categories.map((category) => (
                                            <SelectItem key={category.id} value={category.id}>
                                              {category.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </TableCell>
                                  )}
                                  <TableCell className="text-center">
                                    <Select
                                      value={invoice.project_id || 'none'}
                                      onValueChange={(value) => handleProjectChange(invoice.id, value)}
                                    >
                                      <SelectTrigger className="w-[120px] h-8 mx-auto bg-transparent border-transparent hover:border-border/50 focus:border-primary/50 transition-colors [&>span]:truncate [&>span]:flex-1 [&>svg]:shrink-0">
                                        <SelectValue placeholder="Válassz..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="none">-</SelectItem>
                                        {projects.map((project) => (
                                          <SelectItem key={project.id} value={project.id}>
                                            {project.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-muted/50 text-muted-foreground">
                                      {getPaymentMethodLabel(invoice.payment_method)}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 opacity-70 group-hover:opacity-100"
                                            onClick={() => {
                                              setSelectedNavInvoice(invoice);
                                              setItemsDialogOpen(true);
                                            }}
                                          >
                                            <Package className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Számlatételek megtekintése</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </TableCell>
                                </TableRow>
                                {expandedRowIds.has(invoice.id) && (() => {
                                  const matches = getNavInvoiceMatches(invoice);
                                  return (
                                    <ExpandedInvoiceRow
                                      colSpan={activeTab === 'INBOUND' ? 14 : 12}
                                      matchedSubmittedInvoices={matches.matchedSubmitted}
                                      matchedNavInvoices={[]}
                                      matchedTransactions={matches.matchedTransactions}
                                      linkedInvoices={matches.linkedInvoices}
                                      onViewInvoice={(inv) => {
                                        setSelectedInvoice(inv as any);
                                        setImageDialogOpen(true);
                                      }}
                                    />
                                  );
                                })()}
                              </React.Fragment>
                            );
                          })
                        )}
                        <TablePlaceholderRows currentCount={paginatedNavInvoices.length} pageSize={navPageSize} columns={activeTab === 'INBOUND' ? 14 : 12} />
                      </TableBody>
                    </Table>
                  </div>

                  {/* Bottom Pagination */}
                  <UnifiedPagination
                    currentPage={navCurrentPage}
                    totalPages={navTotalPages}
                    totalItems={filteredAndSortedNavInvoices.length}
                    pageSize={navPageSize}
                    onPageChange={setNavCurrentPage}
                    onPageSizeChange={(size) => { setNavPageSize(size); setNavCurrentPage(1); }}
                    className="mt-3"
                  />

                  {/* Selection indicator */}
                  {selectedInvoiceIds.size > 0 && (
                    <div className="flex items-center gap-2 text-sm text-primary px-2">
                      <span className="font-medium">{selectedInvoiceIds.size} számla kijelölve újrakategorizálásra</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-muted-foreground hover:text-foreground"
                        onClick={() => setSelectedInvoiceIds(new Set())}
                      >
                        <X className="h-3 w-3 mr-1" />
                        Törlés
                      </Button>
                    </div>
                  )}
                </TabsContent>
              )}

              {/* Submitted Invoices Tabs (INBOUND & OUTBOUND) */}
              {isSubmittedTab && (
                <TabsContent value={activeTab} className="space-y-4 mt-4">
                  {/* Submitted Filters - Compact Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 p-4 bg-muted/20 rounded-lg border border-border/30">
                    <div className="relative col-span-2 md:col-span-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input
                        placeholder="Keresés..."
                        value={submittedFilters.search}
                        onChange={(e) => setSubmittedFilters(prev => ({ ...prev, search: e.target.value }))}
                        className="pl-9 h-9 bg-secondary/50 border border-white/10 focus:border-primary/50"
                      />
                    </div>

                    <Select
                      value={submittedFilters.currency}
                      onValueChange={(value) => setSubmittedFilters(prev => ({ ...prev, currency: value }))}
                    >
                      <SelectTrigger className="h-9 bg-secondary/50 border border-white/10">
                        <SelectValue placeholder="Pénznem" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Minden pénznem</SelectItem>
                        {Array.from(new Set(submittedInvoices.map(inv => inv.penznem).filter(Boolean))).sort().map((currency) => (
                          <SelectItem key={currency} value={currency!}>
                            {currency}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>



                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearSubmittedFilters}
                      className="h-9 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Törlés
                    </Button>
                  </div>

                  {/* Top Pagination */}
                  <UnifiedPagination
                    currentPage={submittedCurrentPage}
                    totalPages={submittedTotalPages}
                    totalItems={filteredAndSortedSubmittedInvoices.length}
                    pageSize={submittedPageSize}
                    onPageChange={setSubmittedCurrentPage}
                    onPageSizeChange={(size) => { setSubmittedPageSize(size); setSubmittedCurrentPage(1); }}
                    className="mb-3"
                  />

                  {/* Submitted Invoice Table */}
                  <div className="rounded-lg border border-border/50 overflow-x-auto">
                    <Table className="table-fixed compact-table">
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableHead className="w-[60px] pl-6">
                            <div className="flex items-center gap-3">
                              <div className="w-3.5" />
                              <Checkbox
                                checked={allVisibleSubmittedSelected}
                                onCheckedChange={(checked) => handleSubmittedSelectAll(!!checked)}
                                aria-label="Összes kijelölése"
                              />
                            </div>
                          </TableHead>
                          <TableHead
                            className="cursor-pointer hover:bg-muted/50 font-semibold w-[150px]"
                            onClick={() => handleSort('bizonylatsorszam')}
                          >
                            <div className="flex items-center gap-2">
                              Bizonylatsorszám
                              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                          </TableHead>
                          <TableHead
                            className="cursor-pointer hover:bg-muted/50 font-semibold w-28 text-center"
                            onClick={() => handleSort('kibocsatas_datuma')}
                          >
                            <div className="flex items-center justify-center gap-2">
                              Kibocsátás
                              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                          </TableHead>
                          <TableHead
                            className="cursor-pointer hover:bg-muted/50 font-semibold w-28 text-center"
                            onClick={() => handleSort('teljesites_datuma')}
                          >
                            <div className="flex items-center justify-center gap-2">
                              Teljesítés
                              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                          </TableHead>
                          <TableHead
                            className="cursor-pointer hover:bg-muted/50 font-semibold"
                            onClick={() => handleSort('elado_nev')}
                          >
                            <div className="flex items-center gap-2">
                              Eladó
                              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                          </TableHead>
                          <TableHead
                            className="cursor-pointer hover:bg-muted/50 font-semibold"
                            onClick={() => handleSort('vevo_nev')}
                          >
                            <div className="flex items-center gap-2">
                              Vevő
                              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                          </TableHead>
                          <TableHead
                            className="text-right cursor-pointer hover:bg-muted/50 font-semibold w-32"
                            onClick={() => handleSort('adoalap_osszesen')}
                          >
                            <div className="flex items-center justify-end gap-2">
                              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                              Nettó
                            </div>
                          </TableHead>
                          <TableHead
                            className="text-right cursor-pointer hover:bg-muted/50 font-semibold w-32"
                            onClick={() => handleSort('brutto_vegosszeg')}
                          >
                            <div className="flex items-center justify-end gap-2">
                              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                              Bruttó
                            </div>
                          </TableHead>
                          <TableHead
                            className="text-right cursor-pointer hover:bg-muted/50 font-semibold w-32"
                            onClick={() => handleSort('afa_osszeg_osszesen')}
                          >
                            <div className="flex items-center justify-end gap-2">
                              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                              ÁFA
                            </div>
                          </TableHead>
                          <TableHead className="text-center font-semibold w-20">Műveletek</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading ? (
                          <TableSkeleton rows={10} columns={10} />
                        ) : paginatedSubmittedInvoices.length === 0 ? (
                          <TableEmptyState
                            colSpan={10}
                            title="Nincs megjeleníthető számla"
                            description="Próbáld módosítani a szűrőket vagy keresési feltételeket."
                          />
                        ) : (
                          paginatedSubmittedInvoices.map((invoice) => (
                            <React.Fragment key={invoice.id}>
                              <TableRow className={cn(
                                "group cursor-pointer",
                                selectedSubmittedIds.has(invoice.id) && "bg-primary/5",
                                !selectedSubmittedIds.has(invoice.id) && activeTab === 'SUBMITTED_INBOUND' && matchedInvoiceIds.has(invoice.id) && "bg-[hsl(var(--success-row-bg))] text-[hsl(var(--success-row-text))] border-l-4 border-l-success border-b border-border/40 hover:shadow-[inset_0_0_0_100vw_rgba(0,0,0,0.04)] dark:hover:shadow-[inset_0_0_0_100vw_rgba(255,255,255,0.06)]",
                                !selectedSubmittedIds.has(invoice.id) && activeTab === 'SUBMITTED_INBOUND' && !matchedInvoiceIds.has(invoice.id) && "bg-[hsl(var(--error-row-bg))] text-[hsl(var(--error-row-text))] border-l-4 border-l-destructive border-b border-border/40 hover:shadow-[inset_0_0_0_100vw_rgba(0,0,0,0.04)] dark:hover:shadow-[inset_0_0_0_100vw_rgba(255,255,255,0.06)]",
                                !selectedSubmittedIds.has(invoice.id) && activeTab === 'SUBMITTED_OUTBOUND' && matchedInvoiceIds.has(invoice.id) && "bg-[hsl(var(--success-row-bg))] text-[hsl(var(--success-row-text))] border-l-4 border-l-success border-b border-border/40 hover:shadow-[inset_0_0_0_100vw_rgba(0,0,0,0.04)] dark:hover:shadow-[inset_0_0_0_100vw_rgba(255,255,255,0.06)]",
                                !selectedSubmittedIds.has(invoice.id) && activeTab === 'SUBMITTED_OUTBOUND' && !matchedInvoiceIds.has(invoice.id) && "bg-[hsl(var(--error-row-bg))] text-[hsl(var(--error-row-text))] border-l-4 border-l-destructive border-b border-border/40 hover:shadow-[inset_0_0_0_100vw_rgba(0,0,0,0.04)] dark:hover:shadow-[inset_0_0_0_100vw_rgba(255,255,255,0.06)]",
                                expandedRowIds.has(invoice.id) && "border-b-0"
                              )} onClick={(e) => handleRowClick(invoice.id, e)}>
                                <TableCell className="pl-6">
                                  <div className="flex items-center gap-3">
                                    <ChevronDown className={cn(
                                      "h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200",
                                      expandedRowIds.has(invoice.id) && "rotate-180"
                                    )} />
                                    <Checkbox
                                      checked={selectedSubmittedIds.has(invoice.id)}
                                      onCheckedChange={(checked) => handleSubmittedRowSelect(invoice.id, !!checked)}
                                      aria-label={`${invoice.bizonylatsorszam || invoice.id} kijelölése`}
                                    />
                                  </div>
                                </TableCell>
                                <TableCell className="font-medium font-mono">
                                  <CopyableCell
                                    value={invoice.bizonylatsorszam || '-'}
                                    truncate
                                    maxWidth="105px"
                                    ariaLabel={`${invoice.bizonylatsorszam} bizonylatsorszám másolása`}
                                  />
                                </TableCell>
                                <TableCell className="text-center text-muted-foreground tabular-nums">
                                  {invoice.kibocsatas_datuma
                                    ? format(new Date(invoice.kibocsatas_datuma), 'yyyy. MM. dd.', { locale: hu })
                                    : '-'}
                                </TableCell>
                                <TableCell className="text-center text-muted-foreground tabular-nums">
                                  {invoice.teljesites_datuma
                                    ? format(new Date(invoice.teljesites_datuma), 'yyyy. MM. dd.', { locale: hu })
                                    : '-'}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className={cn(
                                      "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0",
                                      getAvatarColor(invoice.elado_nev)
                                    )}>
                                      {getInitials(invoice.elado_nev)}
                                    </div>
                                    <CopyableCell
                                      value={invoice.elado_nev || '-'}
                                      truncate
                                      maxWidth="100%"
                                      className="font-medium text-xs"
                                      ariaLabel={`${invoice.elado_nev} másolása`}
                                    />
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className={cn(
                                      "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0",
                                      getAvatarColor(invoice.vevo_nev)
                                    )}>
                                      {getInitials(invoice.vevo_nev)}
                                    </div>
                                    <CopyableCell
                                      value={invoice.vevo_nev || '-'}
                                      truncate
                                      maxWidth="100%"
                                      className="font-medium text-xs"
                                      ariaLabel={`${invoice.vevo_nev} másolása`}
                                    />
                                  </div>
                                </TableCell>
                                <TableCell className={cn("text-right font-mono tabular-nums", invoice.reference_number ? "text-muted-foreground italic" : activeTab === 'SUBMITTED_INBOUND' ? "text-destructive" : "text-success")}>
                                  <CopyableCell
                                    value={(invoice.adoalap_osszesen || 0).toString()}
                                    displayValue={formatCurrency(invoice.adoalap_osszesen || 0, invoice.penznem || 'HUF')}
                                    className="justify-end"
                                    ariaLabel="Nettó összeg másolása"
                                  />
                                </TableCell>
                                <TableCell className={cn("text-right font-mono tabular-nums font-medium", invoice.reference_number ? "text-muted-foreground italic" : activeTab === 'SUBMITTED_INBOUND' ? "text-destructive" : "text-success")}>
                                  <CopyableCell
                                    value={(invoice.brutto_vegosszeg || 0).toString()}
                                    displayValue={formatCurrency(invoice.brutto_vegosszeg || 0, invoice.penznem || 'HUF')}
                                    className="justify-end"
                                    ariaLabel="Bruttó összeg másolása"
                                  />
                                </TableCell>
                                <TableCell className={cn("text-right font-mono tabular-nums text-muted-foreground", invoice.reference_number && "italic")}>
                                  <CopyableCell
                                    value={(invoice.afa_osszeg_osszesen || 0).toString()}
                                    displayValue={formatCurrency(invoice.afa_osszeg_osszesen || 0, invoice.penznem || 'HUF')}
                                    className="justify-end"
                                    align="right"
                                    ariaLabel="ÁFA összeg másolása"
                                  />
                                </TableCell>
                                <TableCell>
                                  <div className="flex justify-center gap-1">
                                    {(invoice.image_url || invoice.melleklet_url) && (
                                      <HoverCard openDelay={300} closeDelay={100}>
                                        <HoverCardTrigger asChild>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 w-8 opacity-70 group-hover:opacity-100"
                                            onClick={() => openImageDialog(invoice)}
                                          >
                                            <Eye className="h-4 w-4" />
                                          </Button>
                                        </HoverCardTrigger>
                                        <HoverCardContent side="left" align="center" className="w-64 p-1.5">
                                          <InvoiceImagePreview
                                            invoiceId={invoice.id}
                                            imageUrl={invoice.image_url}
                                            mellekletUrl={invoice.melleklet_url}
                                            isOpen={true}
                                          />
                                        </HoverCardContent>
                                      </HoverCard>
                                    )}
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 w-8 opacity-70 group-hover:opacity-100"
                                            onClick={() => openEditDialog(invoice)}
                                          >
                                            <Pencil className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Számla szerkesztése</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </div>
                                </TableCell>
                              </TableRow>
                              {expandedRowIds.has(invoice.id) && (() => {
                                const matches = getSubmittedInvoiceMatches(invoice);
                                return (
                                  <ExpandedInvoiceRow
                                    colSpan={10}
                                    matchedSubmittedInvoices={[]}
                                    matchedNavInvoices={matches.matchedNav}
                                    matchedTransactions={matches.matchedTransactions}
                                    linkedInvoices={matches.linkedInvoices}
                                    onViewInvoice={(inv) => {
                                      setSelectedInvoice(inv as any);
                                      setImageDialogOpen(true);
                                    }}
                                  />
                                );
                              })()}
                            </React.Fragment>
                          ))
                        )}
                        <TablePlaceholderRows currentCount={paginatedSubmittedInvoices.length} pageSize={submittedPageSize} columns={10} />
                      </TableBody>
                    </Table>
                  </div>

                  {/* Bottom Pagination */}
                  <UnifiedPagination
                    currentPage={submittedCurrentPage}
                    totalPages={submittedTotalPages}
                    totalItems={filteredAndSortedSubmittedInvoices.length}
                    pageSize={submittedPageSize}
                    onPageChange={setSubmittedCurrentPage}
                    onPageSizeChange={(size) => { setSubmittedPageSize(size); setSubmittedCurrentPage(1); }}
                    className="mt-3"
                  />

                  {/* Selection indicator */}
                  {selectedSubmittedIds.size > 0 && (
                    <div className="flex items-center gap-2 text-sm text-primary px-2">
                      <span className="font-medium">{selectedSubmittedIds.size} számla kijelölve</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-muted-foreground hover:text-foreground"
                        onClick={() => setSelectedSubmittedIds(new Set())}
                      >
                        <X className="h-3 w-3 mr-1" />
                        Törlés
                      </Button>
                    </div>
                  )}
                </TabsContent>
              )}
            </Tabs>
          </CardContent>
        </Card>
      </main>

      {/* Image Dialog */}
      <InvoiceImageDialog
        invoice={selectedInvoice ? {
          id: selectedInvoice.id,
          bizonylatsorszam: selectedInvoice.bizonylatsorszam || '',
          image_url: selectedInvoice.image_url,
          melleklet_url: selectedInvoice.melleklet_url,
          elado_nev: selectedInvoice.elado_nev,
          vevo_nev: selectedInvoice.vevo_nev,
        } : null}
        open={imageDialogOpen}
        onClose={() => {
          setImageDialogOpen(false);
          setSelectedInvoice(null);
        }}
      />

      {/* Edit Dialog */}
      <InvoiceFullEditDialog
        invoice={selectedInvoice}
        categories={categories}
        projects={projects}
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setSelectedInvoice(null);
        }}
        onSave={handleEditSave}
      />

      {/* Invoice Items Dialog */}
      <InvoiceItemsDialog
        open={itemsDialogOpen}
        onOpenChange={(open) => {
          setItemsDialogOpen(open);
          if (!open) setSelectedNavInvoice(null);
        }}
        invoiceId={selectedNavInvoice?.id || ''}
        invoiceNumber={selectedNavInvoice?.invoice_number || ''}
        currency={selectedNavInvoice?.currency || 'HUF'}
      />
    </div>
  );
};

export default InvoicesPage;
