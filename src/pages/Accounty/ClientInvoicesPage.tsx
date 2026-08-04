import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronDown, RefreshCcw, Upload, Search, MoreVertical, Cloud, Clock, Calendar, Download, Settings, Check, ShieldAlert, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCompanyInvoices } from '@/hooks/accounty';
import { useAccountyClients } from '@/hooks/accounty';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import NavSyncSettingsDialog from '@/components/nav/NavSyncSettingsDialog';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/integrations/supabase/client';
import { UnifiedPagination } from '@/components/ui/unified-pagination';

export default function ClientInvoicesPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  
  const { data: supabaseClients } = useAccountyClients();
  const client = useMemo(() => {
    const found = supabaseClients?.find((c) => c.id === id);
    if (found) return { id: found.id, name: found.name, taxNumber: found.taxNumber || '' };
    return { id: id || '1', name: 'Betöltés...', taxNumber: '' };
  }, [supabaseClients, id]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [fadFilter, setFadFilter] = useState(false);
  
  const [isNavSyncOpen, setIsNavSyncOpen] = useState(false);
  const [isSyncSettingsOpen, setIsSyncSettingsOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [syncDateFrom, setSyncDateFrom] = useState('2024-01-01');
  const [syncDateTo, setSyncDateTo] = useState('2024-01-31');
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  const handleManualSync = async () => {
    setSyncing(true);
    toast({
      title: 'Szinkronizálás folyamatban',
      description: 'NAV számlák letöltése a megadott időszakra...',
    });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Nem sikerült lekérni a hitelesítést.');

      // 1. Outbound sync
      const { data: outboundData, error: outboundError } = await supabase.functions.invoke('nav-query-outbound-invoices', {
        body: {
          dateFrom: syncDateFrom,
          dateTo: syncDateTo,
          invoiceDirection: 'OUTBOUND',
          companyId: id
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (outboundError) throw outboundError;
      if (outboundData?.error) throw new Error(outboundData.error);
      const totalOutbound = outboundData?.totalInvoices || 0;

      // 2. Inbound sync
      const { data: inboundData, error: inboundError } = await supabase.functions.invoke('nav-query-outbound-invoices', {
        body: {
          dateFrom: syncDateFrom,
          dateTo: syncDateTo,
          invoiceDirection: 'INBOUND',
          companyId: id
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (inboundError) throw inboundError;
      if (inboundData?.error) throw new Error(inboundData.error);
      const totalInbound = inboundData?.totalInvoices || 0;

      // 3. Webhook/Categorization call (optional)
      if (totalOutbound > 0 || totalInbound > 0) {
        await supabase.functions.invoke('trigger-nav-categorization', {
          body: {
            companyId: id,
            syncType: 'manual'
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        }).catch(err => console.error('Categorization webhook failed:', err));
      }

      // 4. Invalidate caches
      queryClient.invalidateQueries({ queryKey: queryKeys.accountyCompanyInvoices(id || '') });
      queryClient.invalidateQueries({ queryKey: ['navInvoices', id] });
      queryClient.invalidateQueries({ queryKey: ['filteredNavInvoices', id] });

      toast({
        title: 'Sikeres szinkronizálás',
        description: `NAV számlák sikeresen importálva: ${totalOutbound} kimenő, ${totalInbound} bejövő.`,
      });

      setIsNavSyncOpen(false);
    } catch (err: any) {
      console.error('Manual sync failed:', err);
      toast({
        title: 'Szinkronizálási hiba',
        description: err.message || 'Nem sikerült letölteni a számlákat a NAV-tól.',
        variant: 'destructive'
      });
    } finally {
      setSyncing(false);
    }
  };

  const { data: invoicesData, isLoading: invoicesLoading } = useCompanyInvoices(id || '');

  const filteredInvoices = useMemo(() => {
    if (!invoicesData) return [];
    return invoicesData.filter((inv) => {
      const matchSearch = inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          inv.partnerName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
      const matchType = typeFilter === 'all' || inv.type === typeFilter;
      const matchFad = !fadFilter || inv.isReverseCharge === true;
      return matchSearch && matchStatus && matchType && matchFad;
    });
  }, [invoicesData, searchQuery, statusFilter, typeFilter, fadFilter]);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, typeFilter, fadFilter]);

  const totalItems = filteredInvoices.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredInvoices.slice(start, start + pageSize);
  }, [filteredInvoices, currentPage, pageSize]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', minimumFractionDigits: 0 }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Új':
        return <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-semibold">Új</span>;
      case 'Kontírozásra vár':
        return <span className="px-2.5 py-1 rounded-md bg-amber-100 text-amber-700 text-xs font-semibold">Kontírozásra vár</span>;
      case 'Kontírozott':
        return <span className="px-2.5 py-1 rounded-md bg-accent text-accent-foreground text-xs font-semibold">Kontírozott</span>;
      case 'Exportálva':
        return <span className="px-2.5 py-1 rounded-md bg-blue-100 text-blue-700 text-xs font-semibold">Exportálva</span>;
      case 'Problémás':
        return <span className="px-2.5 py-1 rounded-md bg-red-100 text-red-700 text-xs font-semibold">Problémás</span>;
      default:
        return <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-semibold">{status}</span>;
    }
  };

  const totalGross = filteredInvoices.reduce((sum, inv) => sum + inv.grossAmount, 0);
  const totalVat = filteredInvoices.reduce((sum, inv) => sum + inv.vatAmount, 0);
  const fadCount = filteredInvoices.filter(inv => inv.isReverseCharge).length;
  const fadNetTotal = filteredInvoices.filter(inv => inv.isReverseCharge).reduce((sum, inv) => sum + (inv.grossAmount - inv.vatAmount), 0);

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-start gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className="w-8 h-8 mt-1.5 shrink-0 hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800"
            onClick={() => navigate(-1)}
          >
            <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </Button>
          <div>
            <div className="flex items-center gap-1.5 mb-1 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800 px-2 py-0.5 -ml-2 rounded-md transition-colors w-max">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{client.name}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Számlák</h1>
          </div>
        </div>

        <div className="flex gap-3">
          <Dialog open={isNavSyncOpen} onOpenChange={setIsNavSyncOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 bg-card border-border text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <RefreshCcw className="w-4 h-4" /> NAV szinkron
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden bg-card">
              <div className="p-6">
                <DialogHeader className="mb-6">
                  <DialogTitle className="flex items-center gap-2 text-lg text-slate-900 dark:text-slate-100 font-bold">
                    <RefreshCcw className="w-5 h-5" />
                    NAV Online Számla szinkronizálás
                  </DialogTitle>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Számlák importálása a NAV Online Számla rendszerből</p>
                </DialogHeader>

                {/* Status Box */}
                <div className="bg-slate-50 dark:bg-slate-800/50 border border-border rounded-xl p-4 mb-6">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400">
                      <Clock className="w-4 h-4 text-slate-400" />
                      Utolsó szinkronizálás:
                    </div>
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100">2024-01-15 10:30</span>
                  </div>
                  <div className="flex gap-4 text-sm font-medium">
                    <span className="text-primary">12 importálva</span>
                    <span className="text-amber-500">2 duplikált</span>
                    <span className="text-red-500">0 hiba</span>
                  </div>
                </div>

                {/* Time Range */}
                <div className="space-y-3 mb-6">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Időszak</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Kezdő dátum</label>
                      <Input
                        type="date"
                        value={syncDateFrom}
                        onChange={(e) => setSyncDateFrom(e.target.value)}
                        className="bg-card border-border"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Záró dátum</label>
                      <Input
                        type="date"
                        value={syncDateTo}
                        onChange={(e) => setSyncDateTo(e.target.value)}
                        className="bg-card border-border"
                      />
                    </div>
                  </div>
                </div>

                {/* Invoice Types */}
                <div className="space-y-3 mb-8">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Számla típusok</h3>
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-card flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                      <Download className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Bejövő számlák (vásárlások)</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-card flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                      <Upload className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Kimenő számlák (értékesítések)</span>
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-between pt-2">
                  <DialogTrigger asChild>
                    <Button variant="outline" className="bg-card border-border text-slate-700 dark:text-slate-300 px-6 h-10">
                      Mégse
                    </Button>
                  </DialogTrigger>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      className="gap-2 bg-card border-border text-slate-700 dark:text-slate-300 h-10"
                      onClick={() => {
                        setIsNavSyncOpen(false);
                        setIsSyncSettingsOpen(true);
                      }}
                    >
                      <Settings className="w-4 h-4" /> Beállítások
                    </Button>
                    <Button
                      className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-6 h-10"
                      onClick={handleManualSync}
                      disabled={syncing}
                    >
                      {syncing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Szinkronizálás...
                        </>
                      ) : (
                        <>
                          <RefreshCcw className="w-4 h-4" /> Szinkronizálás
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <NavSyncSettingsDialog
            open={isSyncSettingsOpen}
            onOpenChange={setIsSyncSettingsOpen}
            companyId={id || ''}
          />
          
          <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
                <Upload className="w-4 h-4" /> Számla feltöltése
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] p-6">
              <DialogHeader>
                <DialogTitle className="text-lg text-slate-900 dark:text-slate-100 font-semibold mb-2">Számlák feltöltése</DialogTitle>
              </DialogHeader>

              {/* Drag & Drop Area */}
              <div className="border border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center bg-transparent mt-2 mb-6">
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                  <Cloud className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1.5 text-sm">Húzd ide a fájlokat vagy kattints a tallózáshoz</h3>
                <p className="text-xs text-slate-400 mb-4">PDF, JPG, PNG (max 10 MB / fájl)</p>
                <Button variant="outline" className="bg-card border-border text-slate-700 dark:text-slate-300 h-9 px-6 font-medium text-xs">
                  Tallózás
                </Button>
              </div>

              {/* Email Option */}
              <div className="space-y-4 mb-2">
                <div className="flex items-center gap-3 cursor-pointer group">
                  <div className="w-4 h-4 rounded-full border border-slate-400 group-hover:border-slate-500 transition-colors flex items-center justify-center shrink-0"></div>
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">E-mailből importálás</span>
                </div>
                <button 
                  onClick={() => {
                    setIsUploadOpen(false);
                    setTimeout(() => setIsNavSyncOpen(true), 150); // slight delay to allow smooth transition
                  }}
                  className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200 transition-colors text-left flex items-center gap-2 font-medium"
                >
                  NAV szinkronizálás indítása
                </button>
              </div>

              {/* Footer Actions */}
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-50">
                <DialogTrigger asChild>
                  <Button variant="outline" className="bg-card border-border text-slate-700 dark:text-slate-300 px-6">
                    Mégse
                  </Button>
                </DialogTrigger>
                <Button disabled className="bg-[#8A95A5] text-white hover:bg-[#8A95A5] cursor-not-allowed px-6 opacity-80">
                  Feltöltés
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-card border border-border rounded-xl shadow-soft overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="p-4 border-b border-border flex justify-between items-center bg-card">
          <div className="w-96 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Keresés számla szám, szállító..." 
              className="pl-9 bg-card border-border" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-48 bg-card border-border">
                <SelectValue placeholder="Minden típus" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Minden típus</SelectItem>
                <SelectItem value="bejovo">Bejövő</SelectItem>
                <SelectItem value="kimeno">Kimenő</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48 bg-card border-border">
                <SelectValue placeholder="Minden státusz" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Minden státusz</SelectItem>
                <SelectItem value="Új">Új</SelectItem>
                <SelectItem value="Kontírozásra vár">Kontírozásra vár</SelectItem>
                <SelectItem value="Kontírozott">Kontírozott</SelectItem>
                <SelectItem value="Exportálva">Exportálva</SelectItem>
                <SelectItem value="Problémás">Problémás</SelectItem>
              </SelectContent>
            </Select>

            <button
              onClick={() => setFadFilter(!fadFilter)}
              className={cn(
                'flex items-center gap-1.5 px-3 h-10 rounded-md border text-xs font-semibold transition-colors',
                fadFilter
                  ? 'bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-950/30 dark:border-amber-700 dark:text-amber-400'
                  : 'bg-card border-border text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              )}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              FAD
              {fadCount > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 text-[10px] font-bold">{fadCount}</span>}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-card border-b border-border text-slate-500 dark:text-slate-400 font-medium text-xs">
              <tr>
                <th className="px-6 py-4 w-12 text-center font-medium"><input type="checkbox" className="rounded border-slate-300 w-4 h-4 accent-slate-900" /></th>
                <th className="px-6 py-4 font-medium">Számla sorszám</th>
                <th className="px-6 py-4 font-medium">Szállító/Vevő</th>
                <th className="px-6 py-4 font-medium">Dátum</th>
                <th className="px-6 py-4 font-medium text-right">Bruttó</th>
                <th className="px-6 py-4 font-medium text-right">ÁFA</th>
                <th className="px-6 py-4 font-medium">Státusz</th>
                <th className="px-6 py-4 w-12 text-center font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoicesLoading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500 dark:text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"></div>
                      Számlák betöltése...
                    </div>
                  </td>
                </tr>
              ) : filteredInvoices.length > 0 ? (
                paginatedInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/50 dark:bg-slate-900/50 transition-colors group">
                    <td className="px-6 py-4 text-center"><input type="checkbox" className="rounded border-slate-300 w-4 h-4 accent-slate-900" /></td>
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">{inv.invoiceNumber}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{inv.partnerName}</td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{inv.date}</td>
                    <td className="px-6 py-4 text-slate-900 dark:text-slate-100 font-semibold text-right">{formatCurrency(inv.grossAmount)}</td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-right">{formatCurrency(inv.vatAmount)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        {getStatusBadge(inv.status)}
                        {inv.isReverseCharge && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold border border-amber-500/20 whitespace-nowrap">
                            FAD
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 dark:text-slate-400 p-1 transition-colors opacity-0 group-hover:opacity-100">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="cursor-pointer">Megtekintés</DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer">Kontírozás</DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-600">Törlés</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500 dark:text-slate-400">
                    Nincs találat a megadott szűrésre.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="border-t border-border px-6 py-3 bg-card">
            <UnifiedPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[25, 50, 100]}
            />
          </div>
        )}

        {/* Footer Summary */}
        <div className="bg-slate-50/50 dark:bg-slate-900/50 p-4 border-t border-border flex items-center gap-6 text-xs text-slate-600 dark:text-slate-400">
          <div>Számlák: <span className="font-bold text-slate-900 dark:text-slate-100">{filteredInvoices.length}</span></div>
          <div>Összesen: <span className="font-bold text-slate-900 dark:text-slate-100">{formatCurrency(totalGross)}</span></div>
          <div>ÁFA: <span className="font-bold text-slate-900 dark:text-slate-100">{formatCurrency(totalVat)}</span></div>
          {fadCount > 0 && (
            <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20">
              <ShieldAlert className="w-3 h-3 text-amber-600 dark:text-amber-400" />
              <span className="text-amber-700 dark:text-amber-400 font-semibold">{fadCount} FAD számla</span>
              <span className="text-amber-600/70 dark:text-amber-400/70">({formatCurrency(fadNetTotal)} nettó)</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
