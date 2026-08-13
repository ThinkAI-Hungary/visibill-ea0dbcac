import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronDown, RefreshCcw, Upload, Search, MoreVertical, Cloud, Clock, Calendar, Download, Settings, Check, ShieldAlert, Loader2, FileText, Coins, Percent } from 'lucide-react';
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
import InvoiceImageDialog from '@/components/InvoiceImageDialog';
import { exportToRLB60, exportToKulcsSoft, exportToNovitax } from '@/lib/bookkeepingExports';
import { TAccountLedger } from '@/components/accounty/invoices/TAccountLedger';
import { ArrowLeftRight } from 'lucide-react';

export default function ClientInvoicesPage() {
  const navigate = useNavigate();
  const { companyId, dateRange } = useParams<{ companyId: string; dateRange: string }>();
  const id = companyId;
  
  const { data: supabaseClients, isLoading: clientLoading } = useAccountyClients();
  const client = useMemo(() => {
    const found = supabaseClients?.find((c) => c.id === id);
    if (found) return { id: found.id, name: found.name, taxNumber: found.taxNumber || '' };
    return { id: id || '1', name: 'Betöltés...', taxNumber: '' };
  }, [supabaseClients, id]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [fadFilter, setFadFilter] = useState(false);
  const [missingImageFilter, setMissingImageFilter] = useState(false);
  
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
      const matchMissingImage = !missingImageFilter || (inv.isNav && inv.submitted !== true);
      return matchSearch && matchStatus && matchType && matchFad && matchMissingImage;
    });
  }, [invoicesData, searchQuery, statusFilter, typeFilter, fadFilter, missingImageFilter]);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [previewInvoice, setPreviewInvoice] = useState<any>(null);
  const [selectedLedgerInvoice, setSelectedLedgerInvoice] = useState<CompanyInvoice | null>(null);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, typeFilter, fadFilter, missingImageFilter]);

  const totalItems = filteredInvoices.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredInvoices.slice(start, start + pageSize);
  }, [filteredInvoices, currentPage, pageSize]);

  const formatCurrency = (amount: number, currencyCode: string = 'HUF') => {
    const curr = (currencyCode || 'HUF').toUpperCase();
    return new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency: curr,
      minimumFractionDigits: curr === 'HUF' ? 0 : 2,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Új':
        return <span className="px-2.5 py-1 rounded-md bg-muted text-muted-foreground text-xs font-semibold">Új</span>;
      case 'Kontírozásra vár':
        return <span className="px-2.5 py-1 rounded-md bg-amber-100 text-amber-700 text-xs font-semibold">Kontírozásra vár</span>;
      case 'Kontírozott':
        return <span className="px-2.5 py-1 rounded-md bg-accent text-accent-foreground text-xs font-semibold">Kontírozott</span>;
      case 'Exportálva':
        return <span className="px-2.5 py-1 rounded-md bg-blue-100 text-blue-700 text-xs font-semibold">Exportálva</span>;
      case 'Problémás':
        return <span className="px-2.5 py-1 rounded-md bg-red-100 text-red-700 text-xs font-semibold">Problémás</span>;
      default:
        return <span className="px-2.5 py-1 rounded-md bg-muted text-muted-foreground text-xs font-semibold">{status}</span>;
    }
  };

  // Group totals by currency
  const totalsByCurrency = useMemo(() => {
    const map: Record<string, { gross: number; vat: number; fadNet: number }> = {};
    filteredInvoices.forEach((inv) => {
      const c = (inv.currency || 'HUF').toUpperCase();
      if (!map[c]) map[c] = { gross: 0, vat: 0, fadNet: 0 };
      map[c].gross += inv.grossAmount;
      map[c].vat += inv.vatAmount;
      if (inv.isReverseCharge) {
        map[c].fadNet += (inv.grossAmount - inv.vatAmount);
      }
    });
    return map;
  }, [filteredInvoices]);

  const fadCount = filteredInvoices.filter(inv => inv.isReverseCharge).length;

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-start gap-4">
          <button 
            onClick={() => navigate(`/eaisybooks/${companyId}/${dateRange}/overview`)}
            className="flex items-center justify-center w-8 h-8 mt-1 shrink-0 rounded-lg border border-border bg-card text-foreground hover:bg-accent transition-colors shadow-sm"
            title="Vissza az áttekintéshez"
          >
            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              {clientLoading ? (
                <div className="h-3.5 w-24 bg-muted rounded animate-pulse" />
              ) : (
                <span className="text-xs font-semibold text-muted-foreground">{client.name}</span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Számlák</h1>
          </div>
        </div>

        <div className="flex gap-3">
          <Dialog open={isNavSyncOpen} onOpenChange={setIsNavSyncOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 bg-card border-border text-foreground hover:bg-accent">
                <RefreshCcw className="w-4 h-4" /> NAV szinkron
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden bg-card">
              <div className="p-6">
                <DialogHeader className="mb-6">
                  <DialogTitle className="flex items-center gap-2 text-lg text-foreground font-bold">
                    <RefreshCcw className="w-5 h-5" />
                    NAV Online Számla szinkronizálás
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground mt-1">Számlák importálása a NAV Online Számla rendszerből</p>
                </DialogHeader>

                {/* Status Box */}
                <div className="bg-muted/10 border border-border rounded-xl p-4 mb-6">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Clock className="w-4 h-4 text-muted-foreground/60" />
                      Utolsó szinkronizálás:
                    </div>
                    <span className="text-sm font-bold text-foreground">2024-01-15 10:30</span>
                  </div>
                  <div className="flex gap-4 text-sm font-medium">
                    <span className="text-primary">12 importálva</span>
                    <span className="text-amber-500">2 duplikált</span>
                    <span className="text-red-500">0 hiba</span>
                  </div>
                </div>

                {/* Time Range */}
                <div className="space-y-3 mb-6">
                  <h3 className="text-sm font-bold text-foreground">Időszak</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Kezdő dátum</label>
                      <Input
                        type="date"
                        value={syncDateFrom}
                        onChange={(e) => setSyncDateFrom(e.target.value)}
                        className="bg-card border-border"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Záró dátum</label>
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
                  <h3 className="text-sm font-bold text-foreground">Számla típusok</h3>
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-card flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                      <Download className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium text-foreground">Bejövő számlák (vásárlások)</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-card flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                      <Upload className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-foreground">Kimenő számlák (értékesítések)</span>
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-between pt-2">
                  <DialogTrigger asChild>
                    <Button variant="outline" className="bg-card border-border text-foreground px-6 h-10">
                      Mégse
                    </Button>
                  </DialogTrigger>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      className="gap-2 bg-card border-border text-foreground h-10"
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 bg-card border-border text-foreground hover:bg-accent">
                <Download className="w-4 h-4" /> Könyvelési export <ChevronDown className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-card border-border">
              <DropdownMenuItem 
                className="cursor-pointer gap-2 hover:bg-accent focus:bg-accent"
                onClick={() => {
                  if (filteredInvoices.length === 0) {
                    toast({ title: 'Hiba', description: 'Nincsenek exportálható számlák a jelenlegi szűrésben.', variant: 'destructive' });
                    return;
                  }
                  exportToRLB60(filteredInvoices);
                  toast({ title: 'RLB60 export sikeres', description: `${filteredInvoices.length} számla exportálva.` });
                }}
              >
                <FileText className="w-4 h-4 text-muted-foreground" />
                RLB60 formátum (.csv)
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="cursor-pointer gap-2 hover:bg-accent focus:bg-accent"
                onClick={() => {
                  if (filteredInvoices.length === 0) {
                    toast({ title: 'Hiba', description: 'Nincsenek exportálható számlák a jelenlegi szűrésben.', variant: 'destructive' });
                    return;
                  }
                  exportToKulcsSoft(filteredInvoices);
                  toast({ title: 'Kulcs-Soft export sikeres', description: `${filteredInvoices.length} számla exportálva.` });
                }}
              >
                <Cloud className="w-4 h-4 text-muted-foreground" />
                Kulcs-Soft formátum (.xml)
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="cursor-pointer gap-2 hover:bg-accent focus:bg-accent"
                onClick={() => {
                  if (filteredInvoices.length === 0) {
                    toast({ title: 'Hiba', description: 'Nincsenek exportálható számlák a jelenlegi szűrésben.', variant: 'destructive' });
                    return;
                  }
                  exportToNovitax(filteredInvoices);
                  toast({ title: 'Novitax export sikeres', description: `${filteredInvoices.length} számla exportálva.` });
                }}
              >
                <FileText className="w-4 h-4 text-muted-foreground" />
                Novitax formátum (.csv)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

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
                <DialogTitle className="text-lg text-foreground font-semibold mb-2">Számlák feltöltése</DialogTitle>
              </DialogHeader>

              {/* Drag & Drop Area */}
              <div className="border border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center bg-muted/5 mt-2 mb-6">
                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
                  <Cloud className="w-5 h-5 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-foreground mb-1.5 text-sm">Húzd ide a fájlokat vagy kattints a tallózáshoz</h3>
                <p className="text-xs text-muted-foreground mb-4">PDF, JPG, PNG (max 10 MB / fájl)</p>
                <Button variant="outline" className="bg-card border-border text-foreground h-9 px-6 font-medium text-xs">
                  Tallózás
                </Button>
              </div>

              {/* Email Option */}
              <div className="space-y-4 mb-2">
                <div className="flex items-center gap-3 cursor-pointer group">
                  <div className="w-4 h-4 rounded-full border border-border group-hover:border-border/80 transition-colors flex items-center justify-center shrink-0"></div>
                  <span className="text-sm font-semibold text-foreground">E-mailből importálás</span>
                </div>
                <button 
                  onClick={() => {
                    setIsUploadOpen(false);
                    setTimeout(() => setIsNavSyncOpen(true), 150); // slight delay to allow smooth transition
                  }}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left flex items-center gap-2 font-medium"
                >
                  NAV szinkronizálás indítása
                </button>
              </div>

              {/* Footer Actions */}
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
                <DialogTrigger asChild>
                  <Button variant="outline" className="bg-card border-border text-foreground px-6">
                    Mégse
                  </Button>
                </DialogTrigger>
                <Button disabled className="bg-muted text-muted-foreground hover:bg-muted cursor-not-allowed px-6 opacity-80">
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
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
                  ? 'bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-300'
                  : 'bg-card border-border text-muted-foreground hover:bg-accent'
              )}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              FAD
              {fadCount > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[10px] font-bold">{fadCount}</span>}
            </button>

            <button
              onClick={() => setMissingImageFilter(!missingImageFilter)}
              className={cn(
                'flex items-center gap-1.5 px-3 h-10 rounded-md border text-xs font-semibold transition-colors',
                missingImageFilter
                  ? 'bg-rose-100 border-rose-300 text-rose-800 dark:bg-rose-900/30 dark:border-rose-700 dark:text-rose-300'
                  : 'bg-card border-border text-muted-foreground hover:bg-accent'
              )}
              title="Csak a bizonylatkép nélküli NAV számlák mutatása"
            >
              <Cloud className="w-3.5 h-3.5 animate-pulse text-rose-500" />
              Hiányzó kép
              {invoicesData?.filter(inv => inv.isNav && inv.submitted !== true).length ? (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-855 dark:text-rose-300 text-[10px] font-bold">
                  {invoicesData.filter(inv => inv.isNav && inv.submitted !== true).length}
                </span>
              ) : null}
            </button>
          </div>
        </div>

        {/* Summary Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 border-b border-border bg-muted/5">
          {/* Card 1: Számlák száma */}
          <div className="bg-card border border-border/60 rounded-xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="bg-primary/10 text-primary p-2.5 rounded-lg shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Számlák száma</div>
              <div className="text-xl font-bold tabular-nums text-foreground mt-0.5">
                {filteredInvoices.length} <span className="text-xs font-normal text-muted-foreground">db</span>
              </div>
            </div>
          </div>

          {/* Card 2: Bruttó összesen */}
          <div className="bg-card border border-border/60 rounded-xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 p-2.5 rounded-lg shrink-0">
              <Coins className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Bruttó összesen</div>
              <div className="text-sm font-bold tabular-nums text-foreground mt-1 space-y-0.5">
                {Object.entries(totalsByCurrency).map(([curr, val]) => (
                  <div key={curr} className="truncate">{formatCurrency(val.gross, curr)}</div>
                )) || <div className="text-muted-foreground font-medium">0 Ft</div>}
              </div>
            </div>
          </div>

          {/* Card 3: ÁFA összesen */}
          <div className="bg-card border border-border/60 rounded-xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="bg-violet-500/10 text-violet-600 dark:text-violet-500 p-2.5 rounded-lg shrink-0">
              <Percent className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">ÁFA összesen</div>
              <div className="text-sm font-bold tabular-nums text-foreground mt-1 space-y-0.5">
                {Object.entries(totalsByCurrency).map(([curr, val]) => (
                  <div key={curr} className="truncate">{formatCurrency(val.vat, curr)}</div>
                )) || <div className="text-muted-foreground font-medium">0 Ft</div>}
              </div>
            </div>
          </div>

          {/* Card 4: Fordított adózás (FAD) */}
          <div className="bg-card border border-border/60 rounded-xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
            <div className={cn(
              "p-2.5 rounded-lg shrink-0 transition-colors",
              fadCount > 0 ? "bg-amber-500/10 text-amber-600 dark:text-amber-500" : "bg-muted text-muted-foreground"
            )}>
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Fordított adózás</div>
              <div className="mt-0.5">
                <div className="text-sm font-bold tabular-nums text-foreground">
                  {fadCount} <span className="text-xs font-normal text-muted-foreground">db FAD számla</span>
                </div>
                {fadCount > 0 && (
                  <div className="text-[10px] text-amber-600 dark:text-amber-500 font-medium truncate mt-0.5">
                    Nettó: {Object.entries(totalsByCurrency)
                      .filter(([_, val]) => val.fadNet > 0)
                      .map(([curr, val]) => formatCurrency(val.fadNet, curr))
                      .join(', ') || '0 Ft'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold text-xs">
              <tr>
                <th className="px-6 py-4 w-12 text-center font-semibold"><input type="checkbox" className="rounded border-border w-4 h-4 accent-primary" /></th>
                <th className="px-6 py-4 font-semibold">Számla sorszám</th>
                <th className="px-6 py-4 font-semibold">Szállító/Vevő</th>
                <th className="px-6 py-4 font-semibold">Dátum</th>
                <th className="px-6 py-4 font-semibold text-right">Bruttó</th>
                <th className="px-6 py-4 font-semibold text-right">ÁFA</th>
                <th className="px-6 py-4 font-semibold">Státusz</th>
                <th className="px-6 py-4 w-12 text-center font-semibold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {invoicesLoading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-border border-t-primary rounded-full animate-spin"></div>
                      Számlák betöltése...
                    </div>
                  </td>
                </tr>
              ) : filteredInvoices.length > 0 ? (
                paginatedInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-accent/50 transition-colors group">
                    <td className="px-6 py-4 text-center"><input type="checkbox" className="rounded border-border w-4 h-4 accent-primary" /></td>
                    <td className="px-6 py-4 font-medium text-foreground">{inv.invoiceNumber}</td>
                    <td className="px-6 py-4 text-muted-foreground">{inv.partnerName}</td>
                    <td className="px-6 py-4 text-muted-foreground">{inv.date}</td>
                    <td className="px-6 py-4 text-foreground font-semibold text-right">{formatCurrency(inv.grossAmount, inv.currency)}</td>
                    <td className="px-6 py-4 text-muted-foreground text-right">{formatCurrency(inv.vatAmount, inv.currency)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        {getStatusBadge(inv.status)}
                        {inv.isReverseCharge && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] font-bold border border-amber-200 dark:border-amber-800 whitespace-nowrap">
                            FAD
                          </span>
                        )}
                        {inv.isNav && inv.submitted !== true && (
                          <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 text-[10px] font-bold border border-rose-200 dark:border-rose-800 whitespace-nowrap flex items-center gap-1" title="A fizikai bizonylatkép hiányzik a NAV adathoz képest">
                            ⚠️ Hiányzó kép
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="text-muted-foreground hover:text-foreground p-1 transition-colors opacity-0 group-hover:opacity-100">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            className="cursor-pointer"
                            onClick={() => {
                              const url = inv.imageUrl || inv.mellekletUrl;
                              if (url) {
                                setPreviewInvoice({
                                  id: inv.id,
                                  elado_nev: inv.type === 'bejovo' ? inv.partnerName : '',
                                  vevo_nev: inv.type === 'kimeno' ? inv.partnerName : '',
                                  bizonylatsorszam: inv.invoiceNumber,
                                  image_url: inv.imageUrl || undefined,
                                  melleklet_url: inv.mellekletUrl || undefined,
                                });
                              } else {
                                toast({
                                  title: 'Nincs elérhető bizonylatkép',
                                  description: 'A NAV Online Számla rendszerből lekérdezett számlákhoz nem tartozik szkennelt bizonylatkép.',
                                  variant: 'default',
                                });
                              }
                            }}
                          >
                            Megtekintés
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="cursor-pointer gap-2"
                            onClick={() => setSelectedLedgerInvoice(inv)}
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5 text-muted-foreground" />
                            Főkönyvi napló (T-számlák)
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer">Kontírozás</DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive">Törlés</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground">
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

      </div>
      
      <InvoiceImageDialog
        invoice={previewInvoice}
        open={previewInvoice !== null}
        onClose={() => setPreviewInvoice(null)}
      />

      <Dialog open={selectedLedgerInvoice !== null} onOpenChange={(open) => !open && setSelectedLedgerInvoice(null)}>
        <DialogContent className="sm:max-w-[700px] p-6 bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-indigo-500" />
              Számla főkönyvi tételei – {selectedLedgerInvoice?.invoiceNumber}
            </DialogTitle>
          </DialogHeader>
          {selectedLedgerInvoice && (
            <TAccountLedger invoice={selectedLedgerInvoice} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
