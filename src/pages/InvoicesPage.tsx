import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn, formatCurrency } from '@/lib/utils';
import { CalendarIcon, Search, Filter, Download, Eye, ArrowUpDown, FileText, ArrowLeft, X, ChevronDown, Info, Pencil } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { Invoice, InvoiceType, getInvoiceTypeLabel, getInvoiceTypeColor } from '@/types/invoices';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import InvoiceImageDialog from '@/components/InvoiceImageDialog';
import InvoiceEditDialog from '@/components/InvoiceEditDialog';

interface Category {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
}

interface Filters {
  search: string;
  status: string;
  project: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  amountMin: string;
  amountMax: string;
  currency: string;
}

const InvoicesPage = () => {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<keyof Invoice>('kibocsatas_datuma');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [activeTab, setActiveTab] = useState<InvoiceType | 'all'>('all');
  
  const [filters, setFilters] = useState<Filters>({
    search: '',
    status: 'all',
    project: 'all',
    dateFrom: undefined,
    dateTo: undefined,
    amountMin: '',
    amountMax: '',
    currency: 'all'
  });

  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, [user, selectedCompany]);

  const getInvoiceAmount = (invoice: any) => {
    switch (invoice.invoice_type) {
      case 'sima_szamla':
      case 'sima_szla':
      case 'vegszamla':
      case 'egyszerusitett_szamla':
        return invoice.brutto_vegosszeg || 0;
      case 'proforma':
      case 'dijbekero_proforma':
        return invoice.fizetendo_osszeg || 0;
      default:
        return invoice.brutto_vegosszeg || invoice.fizetendo_osszeg || 0;
    }
  };

  const getInvoiceIdentifier = (invoice: any) => {
    switch (invoice.invoice_type) {
      case 'sima_szamla':
      case 'sima_szla':
      case 'vegszamla':
        return invoice.szamlaszam || 'N/A';
      case 'proforma':
      case 'dijbekero_proforma':
        return invoice.dokumentum_azonosito || 'N/A';
      case 'egyszerusitett_szamla':
        return 'Egyszerűsített';
      default:
        return invoice.szamlaszam || invoice.dokumentum_azonosito || 'N/A';
    }
  };

  const fetchData = async () => {
    if (!user || !selectedCompany) return;
    
    try {
      // Fetch invoices with category data (company-based)
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select(`
          *,
          categories(id, name)
        `)
        .eq('company_id', selectedCompany.id);

      if (invoicesError) throw invoicesError;

      // Fetch categories for filter dropdown (user-based, not company-based)
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('id, name')
        .eq('user_id', user.id);

      if (categoriesError) throw categoriesError;
      setCategories(categoriesData || []);

      // Fetch projects for filter and edit dropdown (user-based, not company-based)
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('id, name')
        .eq('user_id', user.id);

      if (projectsError) throw projectsError;
      setProjects(projectsData || []);

      // Map project names to invoices
      const projectMap = new Map(projectsData?.map(p => [p.id, p.name]) || []);
      const formattedInvoices = (invoicesData || []).map(invoice => ({
        ...invoice,
        category_name: invoice.categories?.name || 'Nincs kategória',
        project_name: invoice.project_id ? projectMap.get(invoice.project_id) || 'Nincs projekt' : 'Nincs projekt'
      })) as any[];
      
      setInvoices(formattedInvoices);

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedInvoices = useMemo(() => {
    let filtered = invoices.filter(invoice => {
      // Tab filtering
      const matchesTab = activeTab === 'all' || invoice.invoice_type === activeTab;
      
      // Text search
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const inv = invoice as any;
        const matchesSearch = 
          (['sima_szamla', 'sima_szla', 'vegszamla'].includes(invoice.invoice_type) && inv.szamlaszam?.toLowerCase().includes(searchLower)) ||
          (['proforma', 'dijbekero_proforma'].includes(invoice.invoice_type) && inv.dokumentum_azonosito?.toLowerCase().includes(searchLower)) ||
          invoice.elado_nev?.toLowerCase().includes(searchLower) ||
          invoice.vevo_nev?.toLowerCase().includes(searchLower);
        
        if (!matchesSearch) return false;
      }

      // Status filter (only for sima_szamla)
      if (filters.status && filters.status !== 'all' && invoice.invoice_type === 'sima_szamla' && invoice.statusz !== filters.status) {
        return false;
      }

      // Category filter
      if (filters.project && filters.project !== 'all' && invoice.category_id !== filters.project) {
        return false;
      }

      // Date range filter
      if (filters.dateFrom) {
        if (new Date(invoice.kibocsatas_datuma) < filters.dateFrom) {
          return false;
        }
      }
      if (filters.dateTo) {
        if (new Date(invoice.kibocsatas_datuma) > filters.dateTo) {
          return false;
        }
      }

      // Amount range filter
      const invoiceAmount = getInvoiceAmount(invoice);

      if (filters.amountMin && invoiceAmount < parseFloat(filters.amountMin)) {
        return false;
      }
      if (filters.amountMax && invoiceAmount > parseFloat(filters.amountMax)) {
        return false;
      }

      // Currency filter
      if (filters.currency && filters.currency !== 'all' && invoice.penznem !== filters.currency) {
        return false;
      }

      return matchesTab;
    });

    // Sort
    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      if (sortField === 'kibocsatas_datuma') {
        aValue = new Date(aValue as string).getTime();
        bValue = new Date(bValue as string).getTime();
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
  }, [invoices, filters, sortField, sortDirection, activeTab]);

  const handleSort = (field: keyof Invoice) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'feldolgozva': return 'default';
      case 'feldolgozas_alatt': return 'secondary';
      case 'hiba': return 'destructive';
      default: return 'secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'feldolgozva': return 'Feldolgozva';
      case 'feldolgozas_alatt': return 'Feldolgozás alatt';
      case 'hiba': return 'Hiba';
      default: return status;
    }
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      status: 'all',
      project: 'all',
      dateFrom: undefined,
      dateTo: undefined,
      amountMin: '',
      amountMax: '',
      currency: 'all'
    });
    setActiveTab('all');
  };

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsDialogOpen(true);
  };

  const handleEditInvoice = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setIsEditDialogOpen(true);
  };

  const handleExport = (format: 'csv' | 'xlsx') => {
    const getExportData = (invoice: any) => {
      const baseData = [
        getInvoiceTypeLabel(invoice.invoice_type),
        getInvoiceIdentifier(invoice),
        invoice.kibocsatas_datuma,
        invoice.elado_nev,
        invoice.vevo_nev,
        getInvoiceAmount(invoice).toString(),
        invoice.penznem || 'HUF',
        invoice.category_name || 'Nincs kategória'
      ];

      return baseData;
    };

    const headers = [
      'Típus',
      'Azonosító',
      'Kibocsátás dátuma',
      'Eladó',
      'Vevő',
      'Összeg',
      'Pénznem',
      'Kategória'
    ];

    const exportData = filteredAndSortedInvoices.map(invoice => getExportData(invoice));
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');

    if (format === 'csv') {
      const csvContent = [
        headers.join(','),
        ...exportData.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `szamlak_${timestamp}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success("Számlák exportálva CSV formátumban");
    } else {
      // XLSX export
      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...exportData]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Számlák');
      
      XLSX.writeFile(workbook, `szamlak_${timestamp}.xlsx`);
      
      toast.success("Számlák exportálva XLSX formátumban");
    }
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
                        <p>Itt láthatod az összes feldolgozott számládat. Szűrj típus, státusz, projekt vagy összeg szerint. Exportálhatod CSV vagy Excel formátumban.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <CardDescription>
                  Számláinak áttekintése és kezelése - {filteredAndSortedInvoices.length} találat
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
            {/* Invoice Type Tabs */}
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as InvoiceType | 'all')}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="all">Összes</TabsTrigger>
                <TabsTrigger value="sima_szamla">Sima számla</TabsTrigger>
                <TabsTrigger value="vegszamla">Végszámla</TabsTrigger>
                <TabsTrigger value="proforma">Proforma</TabsTrigger>
                <TabsTrigger value="egyszerusitett_szamla">Egyszerűsített</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="space-y-6">
                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Keresés</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input
                        placeholder="Számlaszám, eladó, vevő..."
                        value={filters.search}
                        onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Státusz</label>
                    <Select
                      value={filters.status}
                      onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Minden státusz" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Minden státusz</SelectItem>
                        <SelectItem value="feldolgozva">Feldolgozva</SelectItem>
                        <SelectItem value="feldolgozas_alatt">Feldolgozás alatt</SelectItem>
                        <SelectItem value="hiba">Hiba</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Kategória</label>
                    <Select
                      value={filters.project}
                      onValueChange={(value) => setFilters(prev => ({ ...prev, project: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Minden kategória" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Minden kategória</SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Pénznem</label>
                    <Select
                      value={filters.currency}
                      onValueChange={(value) => setFilters(prev => ({ ...prev, currency: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Minden pénznem" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Minden pénznem</SelectItem>
                        {Array.from(new Set(invoices.map(inv => inv.penznem).filter(Boolean))).sort().map((currency) => (
                          <SelectItem key={currency} value={currency}>
                            {currency}
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
                        value={filters.amountMin}
                        onChange={(e) => setFilters(prev => ({ ...prev, amountMin: e.target.value }))}
                      />
                      <Input
                        type="number"
                        placeholder="Max"
                        value={filters.amountMax}
                        onChange={(e) => setFilters(prev => ({ ...prev, amountMax: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Dátum tartomány</label>
                    <div className="flex gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "justify-start text-left font-normal",
                              !filters.dateFrom && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {filters.dateFrom ? format(filters.dateFrom, "MM/dd", { locale: hu }) : "Kezdő"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={filters.dateFrom}
                            onSelect={(date) => setFilters(prev => ({ ...prev, dateFrom: date }))}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "justify-start text-left font-normal",
                              !filters.dateTo && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {filters.dateTo ? format(filters.dateTo, "MM/dd", { locale: hu }) : "Befejező"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={filters.dateTo}
                            onSelect={(date) => setFilters(prev => ({ ...prev, dateTo: date }))}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>

                      <Button 
                        variant="outline" 
                        onClick={clearFilters}
                        className="flex items-center gap-2"
                      >
                        <X className="h-4 w-4" />
                        Szűrők törlése
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Invoice Table */}
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Típus</TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort('kibocsatas_datuma')}
                        >
                          <div className="flex items-center gap-2">
                            Kibocsátás dátuma
                            <ArrowUpDown className="h-4 w-4" />
                          </div>
                        </TableHead>
                        <TableHead>Dokumentum azonosító</TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort('elado_nev')}
                        >
                          <div className="flex items-center gap-2">
                            Eladó
                            <ArrowUpDown className="h-4 w-4" />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort('vevo_nev')}
                        >
                          <div className="flex items-center gap-2">
                            Vevő
                            <ArrowUpDown className="h-4 w-4" />
                          </div>
                        </TableHead>
                         <TableHead className="text-right">Összeg</TableHead>
                         <TableHead>Fizetve?</TableHead>
                         <TableHead>Kategória</TableHead>
                         <TableHead>Projekt</TableHead>
                         <TableHead className="text-right">Műveletek</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                       {filteredAndSortedInvoices.length === 0 ? (
                         <TableRow>
                           <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                             Nincs megjeleníthető számla a megadott szűrők alapján.
                           </TableCell>
                         </TableRow>
                      ) : (
                        filteredAndSortedInvoices.map((invoice) => (
                          <TableRow key={invoice.id}>
                            <TableCell>
                              <Badge className={getInvoiceTypeColor(invoice.invoice_type)}>
                                {getInvoiceTypeLabel(invoice.invoice_type)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {format(new Date(invoice.kibocsatas_datuma), 'yyyy. MM. dd.', { locale: hu })}
                            </TableCell>
                            <TableCell className="font-medium">
                              {getInvoiceIdentifier(invoice)}
                            </TableCell>
                            <TableCell>{invoice.elado_nev}</TableCell>
                            <TableCell>{invoice.vevo_nev}</TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(getInvoiceAmount(invoice), invoice.penznem || 'HUF')}
                            </TableCell>
                            <TableCell>
                              <Badge variant={invoice.fizetve ? 'success' : 'secondary'}>
                                {invoice.fizetve ? 'Igen' : 'Nem'}
                              </Badge>
                            </TableCell>
                             <TableCell>
                               {invoice.category_name || 'Nincs kategória'}
                             </TableCell>
                             <TableCell>
                               {invoice.project_name || 'Nincs projekt'}
                             </TableCell>
                             <TableCell className="text-right">
                               <div className="flex gap-1 justify-end">
                                 <Button 
                                   variant="ghost" 
                                   size="sm"
                                   onClick={() => handleEditInvoice(invoice)}
                                 >
                                   <Pencil className="h-4 w-4" />
                                 </Button>
                                 <Button 
                                   variant="ghost" 
                                   size="sm"
                                   onClick={() => handleViewInvoice(invoice)}
                                 >
                                   <Eye className="h-4 w-4" />
                                 </Button>
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

      <InvoiceImageDialog 
        invoice={selectedInvoice}
        open={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          setSelectedInvoice(null);
        }}
      />

      <InvoiceEditDialog
        invoice={editingInvoice}
        categories={categories}
        projects={projects}
        open={isEditDialogOpen}
        onClose={() => {
          setIsEditDialogOpen(false);
          setEditingInvoice(null);
        }}
        onSave={fetchData}
      />
    </div>
  );
};

export default InvoicesPage;