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
import { CalendarIcon, Search, Download, ArrowUpDown, FileText, X, ChevronDown, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface NavInvoice {
  id: string;
  invoice_number: string;
  invoice_direction: string | null;
  invoice_issue_date: string | null;
  invoice_delivery_date: string | null;
  supplier_tax_number: string | null;
  customer_tax_number: string | null;
  invoice_net_amount: number | null;
  invoice_gross_amount: number | null;
  invoice_vat_amount: number | null;
  currency: string | null;
  payment_method: string | null;
  invoice_operation: string | null;
  paid: boolean | null;
  submitted: boolean | null;
  company_id: string | null;
  user_id: string | null;
  created_at: string | null;
  fetched_at: string | null;
}

interface Partner {
  tax_number: string;
  name: string;
}

interface Filters {
  search: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  amountMin: string;
  amountMax: string;
  currency: string;
  paid: string;
  submitted: string;
}

type InvoiceTab = 'OUTBOUND' | 'INBOUND';

const InvoicesPage = () => {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const [invoices, setInvoices] = useState<NavInvoice[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<InvoiceTab>('OUTBOUND');
  const [sortField, setSortField] = useState<keyof NavInvoice>('invoice_issue_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  const [filters, setFilters] = useState<Filters>({
    search: '',
    dateFrom: undefined,
    dateTo: undefined,
    amountMin: '',
    amountMax: '',
    currency: 'all',
    paid: 'all',
    submitted: 'all'
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

      // Fetch partners for name lookup
      const { data: partnersData, error: partnersError } = await supabase
        .from('partners')
        .select('tax_number, name')
        .eq('company_id', selectedCompany.id);

      if (partnersError) throw partnersError;
      setPartners(partnersData || []);

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

  const getPartnerTaxNumber = (invoice: NavInvoice): string | null => {
    // For INBOUND invoices, the supplier is the partner
    // For OUTBOUND invoices, the customer is the partner
    if (invoice.invoice_direction === 'INBOUND') {
      return invoice.supplier_tax_number;
    } else {
      return invoice.customer_tax_number;
    }
  };

  const filteredAndSortedInvoices = useMemo(() => {
    let filtered = invoices.filter(invoice => {
      // Tab filtering - filter by direction based on active tab
      if (invoice.invoice_direction !== activeTab) {
        return false;
      }

      // Text search
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const partnerTaxNumber = getPartnerTaxNumber(invoice);
        const partnerName = getPartnerName(partnerTaxNumber);
        const matchesSearch = 
          invoice.invoice_number?.toLowerCase().includes(searchLower) ||
          partnerTaxNumber?.toLowerCase().includes(searchLower) ||
          partnerName.toLowerCase().includes(searchLower);
        
        if (!matchesSearch) return false;
      }

      // Date range filter
      if (filters.dateFrom && invoice.invoice_issue_date) {
        if (new Date(invoice.invoice_issue_date) < filters.dateFrom) {
          return false;
        }
      }
      if (filters.dateTo && invoice.invoice_issue_date) {
        if (new Date(invoice.invoice_issue_date) > filters.dateTo) {
          return false;
        }
      }

      // Amount range filter
      const invoiceAmount = invoice.invoice_gross_amount || 0;
      if (filters.amountMin && invoiceAmount < parseFloat(filters.amountMin)) {
        return false;
      }
      if (filters.amountMax && invoiceAmount > parseFloat(filters.amountMax)) {
        return false;
      }

      // Currency filter
      if (filters.currency && filters.currency !== 'all' && invoice.currency !== filters.currency) {
        return false;
      }

      // Paid filter
      if (filters.paid !== 'all') {
        const isPaid = invoice.paid === true;
        if (filters.paid === 'yes' && !isPaid) return false;
        if (filters.paid === 'no' && isPaid) return false;
      }

      // Submitted filter
      if (filters.submitted !== 'all') {
        const isSubmitted = invoice.submitted === true;
        if (filters.submitted === 'yes' && !isSubmitted) return false;
        if (filters.submitted === 'no' && isSubmitted) return false;
      }

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

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
  }, [invoices, filters, sortField, sortDirection, partners, activeTab]);

  const handleSort = (field: keyof NavInvoice) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const clearFilters = () => {
    setFilters({
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
    const getExportData = (invoice: NavInvoice) => {
      const partnerTaxNumber = getPartnerTaxNumber(invoice);
      return [
        invoice.invoice_direction || '',
        invoice.invoice_number || '',
        invoice.invoice_issue_date || '',
        invoice.invoice_delivery_date || '',
        getPartnerName(partnerTaxNumber),
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
      'Irány',
      'Számlaszám',
      'Kibocsátás dátuma',
      'Teljesítés dátuma',
      'Partner név',
      'Partner adószám',
      'Nettó összeg',
      'Bruttó összeg',
      'ÁFA összeg',
      'Pénznem',
      'Fizetve',
      'Beküldve'
    ];

    const exportData = filteredAndSortedInvoices.map(invoice => getExportData(invoice));
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');

    if (exportFormat === 'csv') {
      const csvContent = [
        headers.join(','),
        ...exportData.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `nav_szamlak_${timestamp}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success("Számlák exportálva CSV formátumban");
    } else {
      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...exportData]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'NAV Számlák');
      
      XLSX.writeFile(workbook, `nav_szamlak_${timestamp}.xlsx`);
      
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
                        <p>Itt láthatod a NAV-ból szinkronizált számláidat. Szűrj irány, dátum, összeg vagy állapot szerint. Exportálhatod CSV vagy Excel formátumban.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <CardDescription>
                  NAV számlák áttekintése és kezelése - {filteredAndSortedInvoices.length} találat
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
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="OUTBOUND">Kimenő számlák</TabsTrigger>
                <TabsTrigger value="INBOUND">Bejövő számlák</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="space-y-6 mt-4">
                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Keresés</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input
                        placeholder="Számlaszám, partner..."
                        value={filters.search}
                        onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                        className="pl-10"
                      />
                    </div>
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
                      value={filters.paid}
                      onValueChange={(value) => setFilters(prev => ({ ...prev, paid: value }))}
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
                        value={filters.submitted}
                        onValueChange={(value) => setFilters(prev => ({ ...prev, submitted: value }))}
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

                  <div className="space-y-2 lg:col-span-2">
                    <label className="text-sm font-medium">Dátum tartomány</label>
                    <div className="flex gap-2 flex-wrap">
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
                            {filters.dateFrom ? format(filters.dateFrom, "yyyy. MM. dd.", { locale: hu }) : "Kezdő"}
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
                            {filters.dateTo ? format(filters.dateTo, "yyyy. MM. dd.", { locale: hu }) : "Befejező"}
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
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAndSortedInvoices.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={activeTab === 'INBOUND' ? 9 : 8} className="text-center py-8 text-muted-foreground">
                            Nincs megjeleníthető számla a megadott szűrők alapján.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredAndSortedInvoices.map((invoice) => {
                          const partnerTaxNumber = getPartnerTaxNumber(invoice);
                          const partnerName = getPartnerName(partnerTaxNumber);
                          
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
                            </TableRow>
                          );
                        })
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
