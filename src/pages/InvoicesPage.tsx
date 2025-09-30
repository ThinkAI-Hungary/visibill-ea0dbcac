import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn, formatCurrency } from '@/lib/utils';
import { CalendarIcon, Search, Filter, Download, Eye, ArrowUpDown, FileText, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface Invoice {
  id: string;
  szamlaszam: string;
  elado_nev: string;
  vevo_nev: string;
  brutto_vegosszeg: number;
  kibocsatas_datuma: string;
  teljesites_datuma: string;
  statusz: string;
  project_id?: string;
  penznem: string;
  project_name?: string;
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
}

const InvoicesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<keyof Invoice>('kibocsatas_datuma');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
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
      // Fetch invoices with project data
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select(`
          *,
          projects(id, name)
        `)
        .eq('user_id', user.id);

      if (invoicesError) throw invoicesError;

      const formattedInvoices = (invoicesData || []).map(invoice => ({
        ...invoice,
        project_name: invoice.projects?.name || 'Nincs projekt'
      }));
      
      setInvoices(formattedInvoices);

      // Fetch projects for filter dropdown
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('id, name')
        .eq('user_id', user.id);

      if (projectsError) throw projectsError;
      setProjects(projectsData || []);

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedInvoices = useMemo(() => {
    let filtered = invoices.filter(invoice => {
      // Text search
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        if (
          !invoice.szamlaszam.toLowerCase().includes(searchLower) &&
          !invoice.elado_nev.toLowerCase().includes(searchLower) &&
          !invoice.vevo_nev.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }

      // Status filter
      if (filters.status && filters.status !== 'all' && invoice.statusz !== filters.status) {
        return false;
      }

      // Project filter
      if (filters.project && filters.project !== 'all' && invoice.project_id !== filters.project) {
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
      if (filters.amountMin && invoice.brutto_vegosszeg < parseFloat(filters.amountMin)) {
        return false;
      }
      if (filters.amountMax && invoice.brutto_vegosszeg > parseFloat(filters.amountMax)) {
        return false;
      }

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];

      if (sortField === 'kibocsatas_datuma' || sortField === 'teljesites_datuma') {
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
  }, [invoices, filters, sortField, sortDirection]);

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
      case 'feldolgozva': return 'success';
      case 'feldolgozas_alatt': return 'warning';
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
        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Szűrők
            </CardTitle>
            <CardDescription>
              {filteredAndSortedInvoices.length} számla {invoices.length !== filteredAndSortedInvoices.length && `(${invoices.length} összesen)`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Search */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Keresés</label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Számlaszám, eladó, vevő..."
                    value={filters.search}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Status */}
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

              {/* Project */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Projekt</label>
                <Select
                  value={filters.project}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, project: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Minden projekt" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Minden projekt</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date From */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Dátum-tól</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !filters.dateFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.dateFrom ? format(filters.dateFrom, "yyyy. MM. dd.", { locale: hu }) : "Válassz dátumot"}
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
              </div>

              {/* Date To */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Dátum-ig</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !filters.dateTo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.dateTo ? format(filters.dateTo, "yyyy. MM. dd.", { locale: hu }) : "Válassz dátumot"}
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

              {/* Amount Min */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Minimum összeg</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={filters.amountMin}
                  onChange={(e) => setFilters(prev => ({ ...prev, amountMin: e.target.value }))}
                />
              </div>

              {/* Amount Max */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Maximum összeg</label>
                <Input
                  type="number"
                  placeholder="∞"
                  value={filters.amountMax}
                  onChange={(e) => setFilters(prev => ({ ...prev, amountMax: e.target.value }))}
                />
              </div>

              {/* Clear Filters */}
              <div className="flex items-end">
                <Button variant="outline" onClick={clearFilters} className="w-full">
                  Szűrők törlése
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Számlák listája</CardTitle>
                <CardDescription>
                  {filteredAndSortedInvoices.length} számla megjelenítve
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('szamlaszam')}
                    >
                      <div className="flex items-center gap-2">
                        Számlaszám
                        <ArrowUpDown className="h-4 w-4" />
                      </div>
                    </TableHead>
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
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('brutto_vegosszeg')}
                    >
                      <div className="flex items-center gap-2">
                        Összeg
                        <ArrowUpDown className="h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('kibocsatas_datuma')}
                    >
                      <div className="flex items-center gap-2">
                        Kibocsátás
                        <ArrowUpDown className="h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead>Projekt</TableHead>
                    <TableHead>Státusz</TableHead>
                    <TableHead className="text-right">Műveletek</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedInvoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Nincs megjeleníthető számla a jelenlegi szűrők alapján.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAndSortedInvoices.map((invoice) => (
                      <TableRow key={invoice.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">{invoice.szamlaszam}</TableCell>
                        <TableCell>{invoice.elado_nev}</TableCell>
                        <TableCell>{invoice.vevo_nev}</TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(invoice.brutto_vegosszeg, invoice.penznem)}
                        </TableCell>
                        <TableCell>
                          {format(new Date(invoice.kibocsatas_datuma), "yyyy. MM. dd.", { locale: hu })}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {invoice.project_name}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(invoice.statusz)}>
                            {getStatusLabel(invoice.statusz)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default InvoicesPage;