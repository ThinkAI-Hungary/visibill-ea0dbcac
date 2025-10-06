import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
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
import { CalendarIcon, Search, Filter, Download, Eye, ArrowUpDown, FileText, ArrowLeft, X, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { Invoice, InvoiceType, getInvoiceTypeLabel, getInvoiceTypeColor } from '@/types/invoices';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface Category {
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
}

const InvoicesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
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
    amountMax: ''
  });

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    
    try {
      // Fetch invoices with category data
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select(`
          *,
          categories(id, name)
        `)
        .eq('user_id', user.id);

      if (invoicesError) throw invoicesError;

      const formattedInvoices = (invoicesData || []).map(invoice => ({
        ...invoice,
        category_name: invoice.categories?.name || 'Nincs kategória'
      })) as any[];
      
      setInvoices(formattedInvoices);

      // Fetch categories for filter dropdown
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('id, name')
        .eq('user_id', user.id);

      if (categoriesError) throw categoriesError;
      setCategories(categoriesData || []);

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
        const matchesSearch = 
          (invoice.invoice_type === 'sima_szamla' && invoice.szamlaszam?.toLowerCase().includes(searchLower)) ||
          (invoice.invoice_type === 'vegszamla' && invoice.szamlaszam?.toLowerCase().includes(searchLower)) ||
          (invoice.invoice_type === 'proforma' && invoice.dokumentum_azonosito?.toLowerCase().includes(searchLower)) ||
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
      let invoiceAmount = 0;
      if (invoice.invoice_type === 'sima_szamla' || invoice.invoice_type === 'vegszamla') {
        invoiceAmount = invoice.brutto_vegosszeg;
      } else if (invoice.invoice_type === 'proforma') {
        invoiceAmount = invoice.fizetendo_osszeg || 0;
      } else if (invoice.invoice_type === 'egyszerusitett_szamla') {
        invoiceAmount = invoice.afa_osszeg || 0;
      }

      if (filters.amountMin && invoiceAmount < parseFloat(filters.amountMin)) {
        return false;
      }
      if (filters.amountMax && invoiceAmount > parseFloat(filters.amountMax)) {
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
      amountMax: ''
    });
    setActiveTab('all');
  };

  const getInvoiceAmount = (invoice: any) => {
    switch (invoice.invoice_type) {
      case 'sima_szamla':
      case 'vegszamla':
        return invoice.brutto_vegosszeg || 0;
      case 'proforma':
        return invoice.fizetendo_osszeg || 0;
      case 'egyszerusitett_szamla':
        return invoice.afa_osszeg || 0;
      default:
        return 0;
    }
  };

  const getInvoiceIdentifier = (invoice: any) => {
    switch (invoice.invoice_type) {
      case 'sima_szamla':
      case 'vegszamla':
        return invoice.szamlaszam || 'N/A';
      case 'proforma':
        return invoice.dokumentum_azonosito || 'N/A';
      case 'egyszerusitett_szamla':
        return 'Egyszerűsített';
      default:
        return 'N/A';
    }
  };

  const handleViewInvoice = (invoice: Invoice) => {
    const mellekletUrl = 'melleklet_url' in invoice ? invoice.melleklet_url : undefined;
    
    if (mellekletUrl) {
      window.open(mellekletUrl, '_blank');
    } else {
      toast.info("Nincs elérhető melléklet ehhez a számlához");
    }
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
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
          <p className="mt-2 text-muted-foreground">Betöltés...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-2xl font-bold">Számlák</CardTitle>
                <CardDescription>
                  Számláinak áttekintése és kezelése - {filteredAndSortedInvoices.length} találat
                </CardDescription>
              </div>
              <div className="flex gap-2">
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
                    </div>
                  </div>

                  <div className="flex items-end gap-2">
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
                        <TableHead>Státusz</TableHead>
                        <TableHead>Kategória</TableHead>
                        <TableHead className="text-right">Műveletek</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAndSortedInvoices.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
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
                              {new Intl.NumberFormat('hu-HU', { 
                                style: 'currency', 
                                currency: 'HUF' 
                              }).format(getInvoiceAmount(invoice))}
                            </TableCell>
                            <TableCell>
                              {invoice.invoice_type === 'sima_szamla' && (
                                <Badge variant={getStatusVariant(invoice.statusz)}>
                                  {getStatusLabel(invoice.statusz)}
                                </Badge>
                              )}
                              {invoice.invoice_type !== 'sima_szamla' && (
                                <Badge variant="secondary">
                                  Aktív
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {invoice.category_name || 'Nincs kategória'}
                            </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleViewInvoice(invoice)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
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
    </div>
  );
};

export default InvoicesPage;