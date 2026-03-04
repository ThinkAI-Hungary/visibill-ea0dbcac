import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
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
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import InvoiceImageDialog from '@/components/InvoiceImageDialog';
import InvoiceFullEditDialog from '@/components/InvoiceFullEditDialog';
import { InvoiceItemsDialog } from '@/components/InvoiceItemsDialog';
import { UnifiedPagination } from '@/components/ui/unified-pagination';
import { CopyableCell } from '@/components/ui/copyable-cell';
import { IosToggle } from '@/components/ui/ios-toggle';

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
}

interface SubmittedInvoice {
  id: string;
  szamlaszam: string | null;
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
  const [invoices, setInvoices] = useState<NavInvoice[]>([]);
  const [submittedInvoices, setSubmittedInvoices] = useState<SubmittedInvoice[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<InvoiceTab>('OUTBOUND');
  const [sortField, setSortField] = useState<string>('invoice_issue_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // NAV sync state
  const [credentialsExist, setCredentialsExist] = useState(false);
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
  const [navPageSize, setNavPageSize] = useState(20);
  const [submittedPageSize, setSubmittedPageSize] = useState(20);
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
    category: 'all'
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

  useEffect(() => {
    fetchData();
    checkCredentialsExist();
  }, [user, selectedCompany, navFilters.dateFrom, navFilters.dateTo, submittedFilters.dateFrom, submittedFilters.dateTo]);

  // Clear selection when tab changes
  useEffect(() => {
    setSelectedInvoiceIds(new Set());
    setSelectedSubmittedIds(new Set());
  }, [activeTab]);

  const checkCredentialsExist = async () => {
    if (!selectedCompany) {
      setCredentialsExist(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('user_nav_credentials')
        .select('id')
        .eq('company_id', selectedCompany.id)
        .maybeSingle();

      setCredentialsExist(!error && !!data);
    } catch (error) {
      setCredentialsExist(false);
    }
  };

  // Row selection helpers - defined after paginatedNavInvoices
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

      fetchData();

    } catch (error: any) {
      console.error('Sync error:', error);
      toast.error(error.message || 'Nem sikerült szinkronizálni a számlákat');
    } finally {
      setSyncing(false);
    }
  };

  const fetchData = async () => {
    if (!user || !selectedCompany) return;

    try {
      // Calculate date range for query - no default filter, show all invoices
      const queryDateFrom = navFilters.dateFrom
        ? format(navFilters.dateFrom, 'yyyy-MM-dd')
        : undefined;

      const queryDateTo = navFilters.dateTo
        ? format(navFilters.dateTo, 'yyyy-MM-dd')
        : undefined;

      // Fetch NAV invoices with optional date filtering
      let navQuery = supabase
        .from('nav_invoices')
        .select('*')
        .eq('company_id', selectedCompany.id);

      if (queryDateFrom) {
        navQuery = navQuery.gte('invoice_issue_date', queryDateFrom);
      }
      if (queryDateTo) {
        navQuery = navQuery.lte('invoice_issue_date', queryDateTo);
      }

      const { data: invoicesData, error: invoicesError } = await navQuery
        .order('invoice_issue_date', { ascending: false });

      if (invoicesError) throw invoicesError;
      setInvoices(invoicesData || []);

      // Fetch submitted invoices with optional date filtering
      const submittedQueryDateFrom = submittedFilters.dateFrom
        ? format(submittedFilters.dateFrom, 'yyyy-MM-dd')
        : undefined;

      const submittedQueryDateTo = submittedFilters.dateTo
        ? format(submittedFilters.dateTo, 'yyyy-MM-dd')
        : undefined;

      let submittedQuery = supabase
        .from('invoices')
        .select('id, szamlaszam, kibocsatas_datuma, teljesites_datuma, elado_nev, vevo_nev, adoalap_osszesen, brutto_vegosszeg, afa_osszeg_osszesen, penznem, category_id, project_id, image_url, melleklet_url, invoice_direction')
        .eq('company_id', selectedCompany.id);

      if (submittedQueryDateFrom) {
        submittedQuery = submittedQuery.gte('kibocsatas_datuma', submittedQueryDateFrom);
      }
      if (submittedQueryDateTo) {
        submittedQuery = submittedQuery.lte('kibocsatas_datuma', submittedQueryDateTo);
      }

      const { data: submittedData, error: submittedError } = await submittedQuery
        .order('kibocsatas_datuma', { ascending: false });

      if (submittedError) throw submittedError;
      setSubmittedInvoices(submittedData || []);

      // Fetch partners for name lookup
      const { data: partnersData, error: partnersError } = await supabase
        .from('partners')
        .select('tax_number, name')
        .eq('company_id', selectedCompany.id);

      if (partnersError) throw partnersError;
      setPartners(partnersData || []);

      // Fetch categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('id, name')
        .eq('company_id', selectedCompany.id);

      if (categoriesError) throw categoriesError;
      setCategories(categoriesData || []);

      // Fetch projects
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('id, name')
        .eq('company_id', selectedCompany.id);

      if (projectsError) throw projectsError;
      setProjects(projectsData || []);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Hiba az adatok betöltésekor');
    } finally {
      setLoading(false);
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
        const isPaid = invoice.paid === true;
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

      return true;
    });

    filtered.sort((a, b) => {
      let aValue: any = a[sortField as keyof NavInvoice];
      let bValue: any = b[sortField as keyof NavInvoice];

      if (sortField === 'invoice_issue_date' || sortField === 'invoice_delivery_date') {
        aValue = aValue ? new Date(aValue as string).getTime() : 0;
        bValue = bValue ? new Date(bValue as string).getTime() : 0;
      }

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
      } else if (sortField === 'brutto_vegosszeg' || sortField === 'invoice_gross_amount') {
        aValue = a.brutto_vegosszeg || 0;
        bValue = b.brutto_vegosszeg || 0;
      } else {
        aValue = a.kibocsatas_datuma ? new Date(a.kibocsatas_datuma).getTime() : 0;
        bValue = b.kibocsatas_datuma ? new Date(b.kibocsatas_datuma).getTime() : 0;
      }

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
      category: 'all'
    });
  };

  const handleProjectChange = async (invoiceId: string, projectId: string | null) => {
    try {
      const { error } = await supabase
        .from('nav_invoices')
        .update({ project_id: projectId === 'none' ? null : projectId })
        .eq('id', invoiceId);

      if (error) throw error;

      setInvoices(prev => prev.map(inv =>
        inv.id === invoiceId ? { ...inv, project_id: projectId === 'none' ? null : projectId } : inv
      ));
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

      setInvoices(prev => prev.map(inv =>
        inv.id === invoiceId ? { ...inv, category_id: categoryId === 'none' ? null : categoryId } : inv
      ));
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

  const handleTogglePaid = async (invoice: NavInvoice) => {
    try {
      const newValue = !invoice.paid;
      const { error } = await supabase
        .from('nav_invoices')
        .update({ paid: newValue })
        .eq('id', invoice.id);

      if (error) throw error;

      setInvoices(prev => prev.map(inv =>
        inv.id === invoice.id ? { ...inv, paid: newValue } : inv
      ));
      toast.success(newValue ? 'Fizetve megjelölve' : 'Fizetve visszavonva');
    } catch (error) {
      console.error('Error updating paid status:', error);
      toast.error('Hiba a státusz frissítésekor');
    }
  };

  const handleToggleSubmitted = async (invoice: NavInvoice) => {
    try {
      const newValue = !invoice.submitted;
      const { error } = await supabase
        .from('nav_invoices')
        .update({ submitted: newValue })
        .eq('id', invoice.id);

      if (error) throw error;

      setInvoices(prev => prev.map(inv =>
        inv.id === invoice.id ? { ...inv, submitted: newValue } : inv
      ));
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
        invoice.paid ? 'Igen' : 'Nem',
        invoice.submitted ? 'Igen' : 'Nem'
      ];
    };

    const headers = [
      'Irány', 'Számlaszám', 'Kibocsátás dátuma', 'Teljesítés dátuma',
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
    fetchData();
  };

  const getResultCount = () => {
    if (isSubmittedTab) {
      return filteredAndSortedSubmittedInvoices.length;
    }
    return filteredAndSortedNavInvoices.length;
  };

  if (loading) {
    return <LoadingSpinner />;
  }

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

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "h-9 justify-start text-left font-normal bg-secondary/50 border border-white/10",
                            !navFilters.dateFrom && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {navFilters.dateFrom ? format(navFilters.dateFrom, "MM.dd.", { locale: hu }) : "Kezdő"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={navFilters.dateFrom}
                          onSelect={(date) => setNavFilters(prev => ({ ...prev, dateFrom: date }))}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "h-9 justify-start text-left font-normal bg-secondary/50 border border-white/10",
                            !navFilters.dateTo && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {navFilters.dateTo ? format(navFilters.dateTo, "MM.dd.", { locale: hu }) : "Befejező"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={navFilters.dateTo}
                          onSelect={(date) => setNavFilters(prev => ({ ...prev, dateTo: date }))}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>

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
                          <TableHead className="w-[40px]">
                            <Checkbox
                              checked={allVisibleSelected}
                              onCheckedChange={(checked) => handleSelectAll(!!checked)}
                              aria-label="Összes kijelölése"
                            />
                          </TableHead>
                          <TableHead
                            className="cursor-pointer hover:bg-muted/50 font-semibold min-w-[150px] w-[11%]"
                            onClick={() => handleSort('invoice_number')}
                          >
                            <div className="flex items-center gap-2">
                              Bizonylatsorszám
                              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                          </TableHead>
                          <TableHead
                            className="cursor-pointer hover:bg-muted/50 font-semibold w-[9%]"
                            onClick={() => handleSort('invoice_issue_date')}
                          >
                            <div className="flex items-center gap-2">
                              Kibocsátás
                              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                          </TableHead>
                          <TableHead
                            className="cursor-pointer hover:bg-muted/50 font-semibold w-[9%]"
                            onClick={() => handleSort('invoice_delivery_date')}
                          >
                            <div className="flex items-center gap-2">
                              Teljesítés
                              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold w-[11%]">Partner</TableHead>
                          <TableHead className="text-right font-semibold w-[9%]">Nettó</TableHead>
                          <TableHead className="text-right font-semibold w-[9%]">Bruttó</TableHead>
                          <TableHead className="text-right font-semibold w-[8%]">ÁFA</TableHead>
                          <TableHead className="font-semibold w-[8%]">
                            <div className="flex items-center gap-1">
                              Státusz
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    <p>Itt tudod beállítani a számla fizetési állapotát. Ha „Nyitott", akkor még nincs kiegyenlítve a rendszerben, míg „Kifizetve" beállításnál már rendezettnek tekintjük a számlát.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </TableHead>
                          {activeTab === 'INBOUND' && (
                            <TableHead className="font-semibold w-[6%]">Beküldve</TableHead>
                          )}
                          {activeTab === 'INBOUND' && (
                            <TableHead className="font-semibold w-[10%]">Kategória</TableHead>
                          )}
                          <TableHead className="font-semibold w-[10%]">Projekt</TableHead>
                          <TableHead className="font-semibold w-[5%]">Tételek</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedNavInvoices.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={activeTab === 'INBOUND' ? 13 : 11} className="text-center py-8 text-muted-foreground">
                              Nincs megjeleníthető számla a megadott szűrők alapján.
                            </TableCell>
                          </TableRow>
                        ) : (
                          paginatedNavInvoices.map((invoice) => {
                            const partnerTaxNumber = getPartnerTaxNumber(invoice);
                            const partnerName = getInvoicePartnerName(invoice);

                            return (
                              <TableRow key={invoice.id} className={cn(
                                "group",
                                selectedInvoiceIds.has(invoice.id) && "bg-primary/5",
                                !selectedInvoiceIds.has(invoice.id) && activeTab === 'INBOUND' && "bg-destructive/10 hover:bg-destructive/15",
                                !selectedInvoiceIds.has(invoice.id) && activeTab === 'OUTBOUND' && "bg-success/10 hover:bg-success/15"
                              )}>
                                <TableCell>
                                  <Checkbox
                                    checked={selectedInvoiceIds.has(invoice.id)}
                                    onCheckedChange={(checked) => handleRowSelect(invoice.id, !!checked)}
                                    aria-label={`${invoice.invoice_number} kijelölése`}
                                  />
                                </TableCell>
                                <TableCell className="font-mono text-sm font-medium min-w-[150px]">
                                  <CopyableCell
                                    value={invoice.invoice_number}
                                    truncate
                                    maxWidth="140px"
                                    ariaLabel={`${invoice.invoice_number} számlaszám másolása`}
                                  />
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {invoice.invoice_issue_date
                                    ? format(new Date(invoice.invoice_issue_date), 'yyyy. MM. dd.', { locale: hu })
                                    : '-'}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {invoice.invoice_delivery_date
                                    ? format(new Date(invoice.invoice_delivery_date), 'yyyy. MM. dd.', { locale: hu })
                                    : '-'}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1.5">
                                    <div className={cn(
                                      "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0",
                                      getAvatarColor(partnerName)
                                    )}>
                                      {getInitials(partnerName)}
                                    </div>
                                    <CopyableCell
                                      value={partnerName}
                                      truncate
                                      maxWidth="100px"
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
                                    ariaLabel="ÁFA összeg másolása"
                                  />
                                </TableCell>
                                <TableCell className="text-center">
                                  <IosToggle
                                    checked={invoice.paid === true}
                                    onCheckedChange={() => handleTogglePaid(invoice)}
                                    aria-label={invoice.paid ? 'Számla fizetettnek jelölve' : 'Számla nyitottnak jelölve'}
                                  />
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
                                  <TableCell>
                                    <Select
                                      value={invoice.category_id || 'none'}
                                      onValueChange={(value) => handleCategoryChange(invoice.id, value)}
                                    >
                                      <SelectTrigger className="w-[120px] h-8 bg-transparent border-transparent hover:border-border/50 focus:border-primary/50 transition-colors [&>span]:truncate [&>span]:flex-1 [&>svg]:shrink-0">
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
                                <TableCell>
                                  <Select
                                    value={invoice.project_id || 'none'}
                                    onValueChange={(value) => handleProjectChange(invoice.id, value)}
                                  >
                                    <SelectTrigger className="w-[120px] h-8 bg-transparent border-transparent hover:border-border/50 focus:border-primary/50 transition-colors [&>span]:truncate [&>span]:flex-1 [&>svg]:shrink-0">
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
                            );
                          })
                        )}
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



                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "h-9 justify-start text-left font-normal bg-secondary/50 border border-white/10",
                            !submittedFilters.dateFrom && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {submittedFilters.dateFrom ? format(submittedFilters.dateFrom, "MM.dd.", { locale: hu }) : "Kezdő"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={submittedFilters.dateFrom}
                          onSelect={(date) => setSubmittedFilters(prev => ({ ...prev, dateFrom: date }))}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "h-9 justify-start text-left font-normal bg-secondary/50 border border-white/10",
                            !submittedFilters.dateTo && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {submittedFilters.dateTo ? format(submittedFilters.dateTo, "MM.dd.", { locale: hu }) : "Befejező"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={submittedFilters.dateTo}
                          onSelect={(date) => setSubmittedFilters(prev => ({ ...prev, dateTo: date }))}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>

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
                          <TableHead className="w-[40px]">
                            <Checkbox
                              checked={allVisibleSubmittedSelected}
                              onCheckedChange={(checked) => handleSubmittedSelectAll(!!checked)}
                              aria-label="Összes kijelölése"
                            />
                          </TableHead>
                          <TableHead className="font-semibold min-w-[150px] w-[12%]">Bizonylatsorszám</TableHead>
                          <TableHead
                            className="cursor-pointer hover:bg-muted/50 font-semibold w-[10%]"
                            onClick={() => handleSort('kibocsatas_datuma')}
                          >
                            <div className="flex items-center gap-2">
                              Kibocsátás
                              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold w-[10%]">Teljesítés</TableHead>
                          <TableHead className="font-semibold w-[14%]">Eladó</TableHead>
                          <TableHead className="font-semibold w-[14%]">Vevő</TableHead>
                          <TableHead className="text-right font-semibold w-[10%]">Nettó</TableHead>
                          <TableHead
                            className="text-right cursor-pointer hover:bg-muted/50 font-semibold w-[10%]"
                            onClick={() => handleSort('brutto_vegosszeg')}
                          >
                            <div className="flex items-center justify-end gap-2">
                              Bruttó
                              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                          </TableHead>
                          <TableHead className="text-right font-semibold w-[10%]">ÁFA</TableHead>
                          <TableHead className="text-center font-semibold w-[10%]">Műveletek</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedSubmittedInvoices.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                              Nincs megjeleníthető számla a megadott szűrők alapján.
                            </TableCell>
                          </TableRow>
                        ) : (
                          paginatedSubmittedInvoices.map((invoice) => (
                            <TableRow key={invoice.id} className={cn(
                              "group",
                              selectedSubmittedIds.has(invoice.id) && "bg-primary/5",
                              !selectedSubmittedIds.has(invoice.id) && activeTab === 'SUBMITTED_INBOUND' && "bg-destructive/10 hover:bg-destructive/15",
                              !selectedSubmittedIds.has(invoice.id) && activeTab === 'SUBMITTED_OUTBOUND' && "bg-success/10 hover:bg-success/15"
                            )}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedSubmittedIds.has(invoice.id)}
                                  onCheckedChange={(checked) => handleSubmittedRowSelect(invoice.id, !!checked)}
                                  aria-label={`${invoice.szamlaszam || invoice.id} kijelölése`}
                                />
                              </TableCell>
                              <TableCell className="font-medium min-w-[150px]">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="block truncate max-w-[140px] cursor-help">
                                        {invoice.szamlaszam || '-'}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="font-mono">{invoice.szamlaszam || '-'}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {invoice.kibocsatas_datuma
                                  ? format(new Date(invoice.kibocsatas_datuma), 'yyyy. MM. dd.', { locale: hu })
                                  : '-'}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {invoice.teljesites_datuma
                                  ? format(new Date(invoice.teljesites_datuma), 'yyyy. MM. dd.', { locale: hu })
                                  : '-'}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2.5">
                                  <div className={cn(
                                    "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0",
                                    getAvatarColor(invoice.elado_nev)
                                  )}>
                                    {getInitials(invoice.elado_nev)}
                                  </div>
                                  <span className="font-medium truncate max-w-[140px]">{invoice.elado_nev || '-'}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2.5">
                                  <div className={cn(
                                    "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0",
                                    getAvatarColor(invoice.vevo_nev)
                                  )}>
                                    {getInitials(invoice.vevo_nev)}
                                  </div>
                                  <span className="font-medium truncate max-w-[140px]">{invoice.vevo_nev || '-'}</span>
                                </div>
                              </TableCell>
                              <TableCell className={cn("text-right font-mono tabular-nums", activeTab === 'SUBMITTED_INBOUND' ? "text-destructive" : "text-success")}>
                                {formatCurrency(invoice.adoalap_osszesen || 0, invoice.penznem || 'HUF')}
                              </TableCell>
                              <TableCell className={cn("text-right font-mono tabular-nums font-medium", activeTab === 'SUBMITTED_INBOUND' ? "text-destructive" : "text-success")}>
                                {formatCurrency(invoice.brutto_vegosszeg || 0, invoice.penznem || 'HUF')}
                              </TableCell>
                              <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                                {formatCurrency(invoice.afa_osszeg_osszesen || 0, invoice.penznem || 'HUF')}
                              </TableCell>
                              <TableCell>
                                <div className="flex justify-center gap-1">
                                  {(invoice.image_url || invoice.melleklet_url) && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 w-8 opacity-70 group-hover:opacity-100"
                                            onClick={() => openImageDialog(invoice)}
                                          >
                                            <Eye className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Számla megtekintése</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
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
                          ))
                        )}
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
          szamlaszam: '',
          dokumentum_azonosito: null,
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
