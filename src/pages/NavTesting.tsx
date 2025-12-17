import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, Shield, Database, ArrowDownLeft, ArrowUpRight, FileCheck, Clock, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';

interface NavInvoice {
  id: string;
  invoice_number: string;
  invoice_direction: string;
  supplier_tax_number: string;
  customer_tax_number: string;
  supplier_name: string | null;
  customer_name: string | null;
  invoice_issue_date: string;
  invoice_net_amount: number;
  invoice_vat_amount: number;
  invoice_gross_amount: number;
  currency: string;
  fetched_at: string;
  submitted: boolean | null;
  details_fetched: boolean | null;
}

const PAGE_SIZE = 20;

const NavTesting: React.FC = () => {
  const { toast } = useToast();
  const { selectedCompany } = useCompany();
  const [loading, setLoading] = useState(false);
  const [navInvoices, setNavInvoices] = useState<NavInvoice[]>([]);
  const [credentialsExist, setCredentialsExist] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  const [filters, setFilters] = useState({
    direction: 'ALL' as 'ALL' | 'OUTBOUND' | 'INBOUND',
    dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (selectedCompany) {
      checkCredentialsExist();
    }
  }, [selectedCompany]);

  useEffect(() => {
    if (credentialsExist && selectedCompany) {
      setCurrentPage(1);
    }
  }, [filters, credentialsExist, selectedCompany]);

  useEffect(() => {
    if (credentialsExist && selectedCompany) {
      loadNavInvoices();
    }
  }, [currentPage, filters, credentialsExist, selectedCompany]);

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

  const loadNavInvoices = async () => {
    if (!selectedCompany) return;
    try {
      // First get total count
      let countQuery = supabase
        .from('nav_invoices')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', selectedCompany.id)
        .gte('invoice_issue_date', filters.dateFrom)
        .lte('invoice_issue_date', filters.dateTo);

      if (filters.direction !== 'ALL') {
        countQuery = countQuery.eq('invoice_direction', filters.direction);
      }

      const { count } = await countQuery;
      setTotalCount(count || 0);

      // Then get paginated data
      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('nav_invoices')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .gte('invoice_issue_date', filters.dateFrom)
        .lte('invoice_issue_date', filters.dateTo)
        .order('invoice_issue_date', { ascending: false })
        .range(from, to);

      if (filters.direction !== 'ALL') {
        query = query.eq('invoice_direction', filters.direction);
      }

      const { data, error } = await query;

      if (error) throw error;
      setNavInvoices(data || []);
    } catch (error: any) {
      console.error('Error loading nav invoices:', error);
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handleSync = async () => {
    if (!selectedCompany) {
      toast({
        title: 'Nincs kiválasztott cég',
        description: 'Kérlek válassz ki egy céget a szinkronizáláshoz',
        variant: 'destructive'
      });
      return;
    }
    
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const [outboundResult, inboundResult] = await Promise.allSettled([
        supabase.functions.invoke('nav-query-outbound-invoices', {
          body: {
            invoiceDirection: 'OUTBOUND',
            dateFrom: filters.dateFrom,
            dateTo: filters.dateTo,
            companyId: selectedCompany.id
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        }),
        supabase.functions.invoke('nav-query-outbound-invoices', {
          body: {
            invoiceDirection: 'INBOUND',
            dateFrom: filters.dateFrom,
            dateTo: filters.dateTo,
            companyId: selectedCompany.id
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        })
      ]);

      let totalInvoices = 0;
      const errors: string[] = [];

      if (outboundResult.status === 'fulfilled') {
        const { data, error } = outboundResult.value;
        if (error || data?.error) {
          errors.push(`Kimenő: ${error?.message || data?.error}`);
        } else if (data?.success) {
          totalInvoices += data.totalInvoices || 0;
        }
      } else {
        errors.push(`Kimenő: ${outboundResult.reason?.message || 'Ismeretlen hiba'}`);
      }

      if (inboundResult.status === 'fulfilled') {
        const { data, error } = inboundResult.value;
        if (error || data?.error) {
          errors.push(`Bejövő: ${error?.message || data?.error}`);
        } else if (data?.success) {
          totalInvoices += data.totalInvoices || 0;
        }
      } else {
        errors.push(`Bejövő: ${inboundResult.reason?.message || 'Ismeretlen hiba'}`);
      }

      if (errors.length === 2) {
        throw new Error(errors.join('; '));
      } else if (errors.length === 1) {
        toast({
          title: 'Szinkronizálás részben sikeres',
          description: `${totalInvoices} számla letöltve. Hibák: ${errors.join('; ')}`,
          variant: 'default'
        });
      } else {
        toast({
          title: 'Szinkronizálás befejezve',
          description: `${totalInvoices} számla letöltve (kimenő és bejövő)`,
        });
      }
      
      loadNavInvoices();

    } catch (error: any) {
      console.error('Sync error:', error);
      toast({
        title: 'Szinkronizálási hiba',
        description: error.message || 'Nem sikerült szinkronizálni a számlákat',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount: number | null) => {
    if (amount === null || amount === undefined) return '—';
    return new Intl.NumberFormat('hu-HU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return dateStr.split('T')[0];
  };

  const decodeHtmlEntities = (str: string | null) => {
    if (!str) return '—';
    const textarea = document.createElement('textarea');
    textarea.innerHTML = str;
    return textarea.value;
  };

  const getInvoiceStatus = (invoice: NavInvoice) => {
    if (invoice.submitted) {
      return { label: 'Feldolgozva', variant: 'success' as const };
    }
    if (invoice.details_fetched) {
      return { label: 'Importálva', variant: 'info' as const };
    }
    return { label: 'Új', variant: 'warning' as const };
  };

  const getPartnerName = (invoice: NavInvoice) => {
    if (invoice.invoice_direction === 'OUTBOUND') {
      return decodeHtmlEntities(invoice.customer_name || invoice.customer_tax_number || null);
    }
    return decodeHtmlEntities(invoice.supplier_name || invoice.supplier_tax_number || null);
  };

  if (!credentialsExist) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">NAV Számlák</h1>
        
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardContent className="py-16">
            <div className="text-center">
              <Shield className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">NAV hitelesítő adatok szükségesek</h2>
              <p className="text-muted-foreground mb-6">
                A számlák megtekintéséhez állítsa be a NAV API hozzáférési adatokat
              </p>
              <Button asChild>
                <a href="/integrations">Ugrás az Integrációkhoz</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardContent className="p-6">
          {/* Header Row - Title + Filters */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-primary" />
              <h1 className="text-xl font-semibold">
                NAV Számlák <span className="text-muted-foreground font-normal">({totalCount})</span>
              </h1>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={filters.direction}
                onValueChange={(value: 'ALL' | 'OUTBOUND' | 'INBOUND') => 
                  setFilters(prev => ({ ...prev, direction: value }))
                }
              >
                <SelectTrigger className="w-[140px] bg-background/50">
                  <SelectValue placeholder="Irány" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Mindkettő</SelectItem>
                  <SelectItem value="OUTBOUND">Kimenő</SelectItem>
                  <SelectItem value="INBOUND">Bejövő</SelectItem>
                </SelectContent>
              </Select>
              
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                className="w-[150px] bg-background/50 pr-3"
              />
              
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                className="w-[150px] bg-background/50 pr-3"
              />
              
              <Button onClick={handleSync} disabled={loading}>
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Szinkronizálás...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Szinkronizálás
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Table */}
          {navInvoices.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Még nincsenek letöltött számlák</p>
              <p className="text-sm mt-1">Kattints a Szinkronizálás gombra a számlák letöltéséhez</p>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-border/50 overflow-hidden flex flex-col">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Számlaszám
                      </TableHead>
                      <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Irány
                      </TableHead>
                      <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Partner
                      </TableHead>
                      <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Keltezés
                      </TableHead>
                      <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
                        Nettó (Ft)
                      </TableHead>
                      <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
                        ÁFA (Ft)
                      </TableHead>
                      <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
                        Bruttó (Ft)
                      </TableHead>
                      <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Státusz
                      </TableHead>
                      <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Letöltve
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="min-h-[960px]">
                    {navInvoices.map((invoice) => {
                      const status = getInvoiceStatus(invoice);
                      return (
                        <TableRow key={invoice.id} className="hover:bg-muted/50 transition-colors h-12">
                          <TableCell className="py-3 px-4 font-medium">
                            {invoice.invoice_number}
                          </TableCell>
                          <TableCell className="py-3 px-4">
                            {invoice.invoice_direction === 'OUTBOUND' ? (
                              <Badge className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-0">
                                <ArrowUpRight className="w-3 h-3 mr-1" />
                                Kimenő
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-0">
                                <ArrowDownLeft className="w-3 h-3 mr-1" />
                                Bejövő
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="py-3 px-4 max-w-[200px] truncate" title={getPartnerName(invoice)}>
                            {getPartnerName(invoice)}
                          </TableCell>
                          <TableCell className="py-3 px-4 tabular-nums">
                            {formatDate(invoice.invoice_issue_date)}
                          </TableCell>
                          <TableCell className="py-3 px-4 text-right tabular-nums">
                            {formatAmount(invoice.invoice_net_amount)}
                          </TableCell>
                          <TableCell className="py-3 px-4 text-right tabular-nums">
                            {formatAmount(invoice.invoice_vat_amount)}
                          </TableCell>
                          <TableCell className="py-3 px-4 text-right tabular-nums">
                            {formatAmount(invoice.invoice_gross_amount)}
                          </TableCell>
                          <TableCell className="py-3 px-4">
                            {status.variant === 'success' ? (
                              <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-0 min-w-[100px] justify-center">
                                <FileCheck className="w-3 h-3 mr-1" />
                                {status.label}
                              </Badge>
                            ) : status.variant === 'info' ? (
                              <Badge className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-0 min-w-[100px] justify-center">
                                <FileCheck className="w-3 h-3 mr-1" />
                                {status.label}
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-0 min-w-[100px] justify-center">
                                <Clock className="w-3 h-3 mr-1" />
                                {status.label}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="py-3 px-4 text-sm text-muted-foreground tabular-nums">
                            {formatDate(invoice.fetched_at)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Controls - Always visible at bottom */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 mt-auto">
                  <div className="text-sm text-muted-foreground">
                    {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, totalCount)} / {totalCount} számla
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="px-3 text-sm tabular-nums">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default NavTesting;
