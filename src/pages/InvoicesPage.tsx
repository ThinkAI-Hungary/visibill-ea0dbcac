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
import { cn, formatCurrency } from '@/lib/utils';
import { CalendarIcon, Search, Download, ArrowUpDown, FileText, X, ChevronDown, Info, Eye, Pencil, Package } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import InvoiceImageDialog from '@/components/InvoiceImageDialog';
import InvoiceFullEditDialog from '@/components/InvoiceFullEditDialog';
import { InvoiceItemsDialog } from '@/components/InvoiceItemsDialog';

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
}

interface SubmittedInvoice {
  id: string;
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

type InvoiceTab = 'OUTBOUND' | 'INBOUND' | 'SUBMITTED';

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
  
  // Dialog states
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [itemsDialogOpen, setItemsDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<SubmittedInvoice | null>(null);
  const [selectedNavInvoice, setSelectedNavInvoice] = useState<NavInvoice | null>(null);
  
  const [navFilters, setNavFilters] = useState<NavFilters>({
    search: '',
    dateFrom: undefined,
    dateTo: undefined,
    amountMin: '',
    amountMax: '',
    currency: 'all',
    paid: 'all',
    submitted: 'all'
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
  }, [user, selectedCompany]);

  const fetchData = async () => {
    if (!user || !selectedCompany) return;
    
    try {
      // Fetch NAV invoices
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('nav_invoices')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .order('invoice_issue_date', { ascending: false });

      if (invoicesError) throw invoicesError;
      setInvoices(invoicesData || []);

      // Fetch submitted invoices from invoices table
      const { data: submittedData, error: submittedError } = await supabase
        .from('invoices')
        .select('id, kibocsatas_datuma, teljesites_datuma, elado_nev, vevo_nev, adoalap_osszesen, brutto_vegosszeg, afa_osszeg_osszesen, penznem, category_id, project_id, image_url, melleklet_url')
        .eq('company_id', selectedCompany.id)
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
        .eq('user_id', user.id);

      if (categoriesError) throw categoriesError;
      setCategories(categoriesData || []);

      // Fetch projects
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('id, name')
        .eq('user_id', user.id);

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

  const filteredAndSortedSubmittedInvoices = useMemo(() => {
    let filtered = submittedInvoices.filter(invoice => {
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
  }, [submittedInvoices, submittedFilters, sortField, sortDirection]);

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
      submitted: 'all'
    });
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
    if (activeTab === 'SUBMITTED') {
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
    if (activeTab === 'SUBMITTED') {
      return filteredAndSortedSubmittedInvoices.length;
    }
    return filteredAndSortedNavInvoices.length;
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
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
              <TabsList className="grid w-full max-w-lg grid-cols-3">
                <TabsTrigger value="OUTBOUND">Kimenő</TabsTrigger>
                <TabsTrigger value="INBOUND">Bejövő</TabsTrigger>
                <TabsTrigger value="SUBMITTED">Beküldött</TabsTrigger>
              </TabsList>

              {/* NAV Invoice Tabs (OUTBOUND & INBOUND) */}
              {(activeTab === 'OUTBOUND' || activeTab === 'INBOUND') && (
                <TabsContent value={activeTab} className="space-y-6 mt-4">
                  {/* NAV Filters */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Keresés</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                        <Input
                          placeholder="Számlaszám, partner..."
                          value={navFilters.search}
                          onChange={(e) => setNavFilters(prev => ({ ...prev, search: e.target.value }))}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Pénznem</label>
                      <Select
                        value={navFilters.currency}
                        onValueChange={(value) => setNavFilters(prev => ({ ...prev, currency: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Minden pénznem" />
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
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Fizetve</label>
                      <Select
                        value={navFilters.paid}
                        onValueChange={(value) => setNavFilters(prev => ({ ...prev, paid: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Mind" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Mind</SelectItem>
                          <SelectItem value="yes">Igen</SelectItem>
                          <SelectItem value="no">Nem</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {activeTab === 'INBOUND' && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Beküldve</label>
                        <Select
                          value={navFilters.submitted}
                          onValueChange={(value) => setNavFilters(prev => ({ ...prev, submitted: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Mind" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Mind</SelectItem>
                            <SelectItem value="yes">Igen</SelectItem>
                            <SelectItem value="no">Nem</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Összeg tartomány</label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="Min"
                          value={navFilters.amountMin}
                          onChange={(e) => setNavFilters(prev => ({ ...prev, amountMin: e.target.value }))}
                        />
                        <Input
                          type="number"
                          placeholder="Max"
                          value={navFilters.amountMax}
                          onChange={(e) => setNavFilters(prev => ({ ...prev, amountMax: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="space-y-2 lg:col-span-2">
                      <label className="text-sm font-medium">Dátum tartomány</label>
                      <div className="flex gap-2 flex-wrap">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "justify-start text-left font-normal",
                                !navFilters.dateFrom && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {navFilters.dateFrom ? format(navFilters.dateFrom, "yyyy. MM. dd.", { locale: hu }) : "Kezdő"}
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
                              className={cn(
                                "justify-start text-left font-normal",
                                !navFilters.dateTo && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {navFilters.dateTo ? format(navFilters.dateTo, "yyyy. MM. dd.", { locale: hu }) : "Befejező"}
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
                          variant="outline" 
                          onClick={clearNavFilters}
                          className="flex items-center gap-2"
                        >
                          <X className="h-4 w-4" />
                          Szűrők törlése
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* NAV Invoice Table */}
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleSort('invoice_number')}
                          >
                            <div className="flex items-center gap-2">
                              Számlaszám
                              <ArrowUpDown className="h-4 w-4" />
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleSort('invoice_issue_date')}
                          >
                            <div className="flex items-center gap-2">
                              Kibocsátás
                              <ArrowUpDown className="h-4 w-4" />
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleSort('invoice_delivery_date')}
                          >
                            <div className="flex items-center gap-2">
                              Teljesítés
                              <ArrowUpDown className="h-4 w-4" />
                            </div>
                          </TableHead>
                          <TableHead>Partner</TableHead>
                          <TableHead className="text-right">Nettó</TableHead>
                          <TableHead className="text-right">Bruttó</TableHead>
                          <TableHead className="text-right">ÁFA</TableHead>
                          <TableHead className="text-center">Fizetve</TableHead>
                          {activeTab === 'INBOUND' && (
                            <TableHead className="text-center">Beküldve</TableHead>
                          )}
                          <TableHead className="text-center">Tételek</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAndSortedNavInvoices.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={activeTab === 'INBOUND' ? 10 : 9} className="text-center py-8 text-muted-foreground">
                              Nincs megjeleníthető számla a megadott szűrők alapján.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredAndSortedNavInvoices.map((invoice) => {
                            const partnerTaxNumber = getPartnerTaxNumber(invoice);
                            const partnerName = getInvoicePartnerName(invoice);
                            
                            return (
                              <TableRow key={invoice.id}>
                                <TableCell className="font-medium">
                                  {invoice.invoice_number}
                                </TableCell>
                                <TableCell>
                                  {invoice.invoice_issue_date 
                                    ? format(new Date(invoice.invoice_issue_date), 'yyyy. MM. dd.', { locale: hu })
                                    : '-'}
                                </TableCell>
                                <TableCell>
                                  {invoice.invoice_delivery_date 
                                    ? format(new Date(invoice.invoice_delivery_date), 'yyyy. MM. dd.', { locale: hu })
                                    : '-'}
                                </TableCell>
                                <TableCell>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="cursor-help">{partnerName}</span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Adószám: {partnerTaxNumber || '-'}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatCurrency(invoice.invoice_net_amount || 0, invoice.currency || 'HUF')}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {formatCurrency(invoice.invoice_gross_amount || 0, invoice.currency || 'HUF')}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatCurrency(invoice.invoice_vat_amount || 0, invoice.currency || 'HUF')}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Checkbox
                                    checked={invoice.paid === true}
                                    onCheckedChange={() => handleTogglePaid(invoice)}
                                  />
                                </TableCell>
                                {activeTab === 'INBOUND' && (
                                  <TableCell className="text-center">
                                    <Checkbox
                                      checked={invoice.submitted === true}
                                      onCheckedChange={() => handleToggleSubmitted(invoice)}
                                    />
                                  </TableCell>
                                )}
                                <TableCell className="text-center">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8"
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
                </TabsContent>
              )}

              {/* Submitted Invoices Tab */}
              <TabsContent value="SUBMITTED" className="space-y-6 mt-4">
                {/* Submitted Filters */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Keresés</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input
                        placeholder="Eladó, vevő neve..."
                        value={submittedFilters.search}
                        onChange={(e) => setSubmittedFilters(prev => ({ ...prev, search: e.target.value }))}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Pénznem</label>
                    <Select
                      value={submittedFilters.currency}
                      onValueChange={(value) => setSubmittedFilters(prev => ({ ...prev, currency: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Minden pénznem" />
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
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Kategória</label>
                    <Select
                      value={submittedFilters.category}
                      onValueChange={(value) => setSubmittedFilters(prev => ({ ...prev, category: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Mind" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Mind</SelectItem>
                        <SelectItem value="none">Nincs kategória</SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Projekt</label>
                    <Select
                      value={submittedFilters.project}
                      onValueChange={(value) => setSubmittedFilters(prev => ({ ...prev, project: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Mind" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Mind</SelectItem>
                        <SelectItem value="none">Nincs projekt</SelectItem>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Összeg tartomány</label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Min"
                        value={submittedFilters.amountMin}
                        onChange={(e) => setSubmittedFilters(prev => ({ ...prev, amountMin: e.target.value }))}
                      />
                      <Input
                        type="number"
                        placeholder="Max"
                        value={submittedFilters.amountMax}
                        onChange={(e) => setSubmittedFilters(prev => ({ ...prev, amountMax: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-2 lg:col-span-2">
                    <label className="text-sm font-medium">Dátum tartomány</label>
                    <div className="flex gap-2 flex-wrap">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "justify-start text-left font-normal",
                              !submittedFilters.dateFrom && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {submittedFilters.dateFrom ? format(submittedFilters.dateFrom, "yyyy. MM. dd.", { locale: hu }) : "Kezdő"}
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
                            className={cn(
                              "justify-start text-left font-normal",
                              !submittedFilters.dateTo && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {submittedFilters.dateTo ? format(submittedFilters.dateTo, "yyyy. MM. dd.", { locale: hu }) : "Befejező"}
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
                        variant="outline" 
                        onClick={clearSubmittedFilters}
                        className="flex items-center gap-2"
                      >
                        <X className="h-4 w-4" />
                        Szűrők törlése
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Submitted Invoice Table */}
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort('kibocsatas_datuma')}
                        >
                          <div className="flex items-center gap-2">
                            Kibocsátás
                            <ArrowUpDown className="h-4 w-4" />
                          </div>
                        </TableHead>
                        <TableHead>Teljesítés</TableHead>
                        <TableHead>Eladó</TableHead>
                        <TableHead>Vevő</TableHead>
                        <TableHead className="text-right">Nettó</TableHead>
                        <TableHead 
                          className="text-right cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort('brutto_vegosszeg')}
                        >
                          <div className="flex items-center justify-end gap-2">
                            Bruttó
                            <ArrowUpDown className="h-4 w-4" />
                          </div>
                        </TableHead>
                        <TableHead className="text-right">ÁFA</TableHead>
                        <TableHead>Kategória</TableHead>
                        <TableHead>Projekt</TableHead>
                        <TableHead className="text-center">Műveletek</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAndSortedSubmittedInvoices.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                            Nincs megjeleníthető számla a megadott szűrők alapján.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredAndSortedSubmittedInvoices.map((invoice) => (
                          <TableRow key={invoice.id}>
                            <TableCell>
                              {invoice.kibocsatas_datuma 
                                ? format(new Date(invoice.kibocsatas_datuma), 'yyyy. MM. dd.', { locale: hu })
                                : '-'}
                            </TableCell>
                            <TableCell>
                              {invoice.teljesites_datuma 
                                ? format(new Date(invoice.teljesites_datuma), 'yyyy. MM. dd.', { locale: hu })
                                : '-'}
                            </TableCell>
                            <TableCell>{invoice.elado_nev || '-'}</TableCell>
                            <TableCell>{invoice.vevo_nev || '-'}</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(invoice.adoalap_osszesen || 0, invoice.penznem || 'HUF')}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(invoice.brutto_vegosszeg || 0, invoice.penznem || 'HUF')}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(invoice.afa_osszeg_osszesen || 0, invoice.penznem || 'HUF')}
                            </TableCell>
                            <TableCell>{getCategoryName(invoice.category_id)}</TableCell>
                            <TableCell>{getProjectName(invoice.project_id)}</TableCell>
                            <TableCell>
                              <div className="flex justify-center gap-1">
                                {(invoice.image_url || invoice.melleklet_url) && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button 
                                          size="sm" 
                                          variant="ghost" 
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
              </TabsContent>
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
