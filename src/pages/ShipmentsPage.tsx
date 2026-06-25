import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Truck, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  Search, 
  Upload, 
  ArrowRight,
  FileText,
  FileDown,
  Info,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useScopedBasePath } from '@/lib/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface Shipment {
  id: string;
  position_number: string;
  pickup_date: string | null;
  delivery_date: string | null;
  carrier_name: string | null;
  calculated_amount_huf: number | null;
  calculated_amount_eur: number | null;
  match_status: string;
  matched_invoice_id: string | null;
  created_at: string;
}

export default function ShipmentsPage() {
  const { selectedCompany } = useCompany();
  const navigate = useNavigate();
  const basePath = useScopedBasePath();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'matched' | 'unmatched'>('all');
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  // Fetch Shipments
  const { data: shipments = [], isLoading } = useQuery<Shipment[]>({
    queryKey: ['shipments', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase
        .from('shipments' as any)
        .select('*')
        .eq('company_id', selectedCompany.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCompany?.id,
  });

  // Fetch Linked Invoice details if a shipment is selected
  const { data: linkedInvoice = null } = useQuery({
    queryKey: ['shipment-invoice', selectedShipment?.matched_invoice_id],
    queryFn: async () => {
      if (!selectedShipment?.matched_invoice_id) return null;
      const { data, error } = await supabase
        .from('invoices')
        .select('id, bizonylatsorszam, elado_nev, brutto_vegosszeg, penznem, kibocsatas_datuma, planned_payment_date, selexped_registry_number')
        .eq('id', selectedShipment.matched_invoice_id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedShipment?.matched_invoice_id,
  });

  // Fetch Linked transport documents if a shipment is selected
  const { data: linkedCmrs = [] } = useQuery({
    queryKey: ['shipment-cmrs', selectedShipment?.id],
    queryFn: async () => {
      if (!selectedShipment?.id) return [];
      const { data, error } = await supabase
        .from('transport_documents' as any)
        .select('*')
        .eq('linked_shipment_id', selectedShipment.id);

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedShipment?.id,
  });

  // Statistics
  const stats = useMemo(() => {
    const total = shipments.length;
    const matched = shipments.filter(s => s.match_status === 'matched').length;
    const unmatched = total - matched;
    
    // Find last import date
    const lastImport = shipments.length > 0 
      ? format(new Date(shipments[0].created_at), 'yyyy. MM. dd. HH:mm', { locale: hu })
      : 'Nincs importálva';

    return { total, matched, unmatched, lastImport };
  }, [shipments]);

  // Filtered shipments
  const filteredShipments = useMemo(() => {
    return shipments.filter(s => {
      const matchesSearch = 
        s.position_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.carrier_name && s.carrier_name.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = 
        statusFilter === 'all' ||
        (statusFilter === 'matched' && s.match_status === 'matched') ||
        (statusFilter === 'unmatched' && s.match_status !== 'matched');

      return matchesSearch && matchesStatus;
    });
  }, [shipments, searchQuery, statusFilter]);

  // Reset page when filters change
  useMemo(() => { setCurrentPage(1); }, [searchQuery, statusFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredShipments.length / PAGE_SIZE));
  const pagedShipments = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredShipments.slice(start, start + PAGE_SIZE);
  }, [filteredShipments, currentPage]);
  const emptyRowCount = PAGE_SIZE - pagedShipments.length;

  const handleRowClick = (shipment: Shipment) => {
    setSelectedShipment(shipment);
  };

  return (
    <div className="container mx-auto px-4 py-8 page-animate">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Fuvarok</h1>
            <p className="text-muted-foreground font-medium text-sm">Selexped import — aktuális fuvaradatok</p>
          </div>
          <Button onClick={() => navigate(`${basePath}/shipments/import`)}>
            <Upload className="h-4 w-4 mr-2" />
            Új import
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border border-border/50 shadow-sm bg-card hover:border-primary/20 transition-all duration-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Truck className="h-4 w-4 text-primary" />
                  Összes fuvar
                </p>
              </div>
              <div className="text-3xl font-bold text-foreground mt-2">{stats.total}</div>
            </CardContent>
          </Card>
          
          <Card className="border border-border/50 shadow-sm bg-card hover:border-success/20 transition-all duration-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Párosított
                </p>
              </div>
              <div className="text-3xl font-bold text-success mt-2">{stats.matched}</div>
            </CardContent>
          </Card>

          <Card className="border border-border/50 shadow-sm bg-card hover:border-warning/20 transition-all duration-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-warning" />
                  Várakozó
                </p>
              </div>
              <div className="text-3xl font-bold text-warning mt-2">{stats.unmatched}</div>
            </CardContent>
          </Card>

          <Card className="border border-border/50 shadow-sm bg-card hover:border-info/20 transition-all duration-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-info" />
                  Utolsó import
                </p>
              </div>
              <div className="text-lg font-bold text-foreground mt-3 truncate">{stats.lastImport}</div>
            </CardContent>
          </Card>
        </div>

        {/* Table controls */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-card p-4 rounded-lg border border-border/50 shadow-sm">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Keresés pozíciószám, fuvaros..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button 
              variant={statusFilter === 'all' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setStatusFilter('all')}
            >
              Mind
            </Button>
            <Button 
              variant={statusFilter === 'matched' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setStatusFilter('matched')}
            >
              Párosított
            </Button>
            <Button 
              variant={statusFilter === 'unmatched' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setStatusFilter('unmatched')}
            >
              Várakozó
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border/50 overflow-x-auto bg-card shadow-sm">
          <table className="w-full border-collapse text-sm compact-table min-w-max">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="h-11 px-4 text-left font-semibold text-muted-foreground text-xs">Pozíciószám</th>
                <th className="h-11 px-4 text-left font-semibold text-muted-foreground text-xs">Felrakás</th>
                <th className="h-11 px-4 text-left font-semibold text-muted-foreground text-xs">Lerakás</th>
                <th className="h-11 px-4 text-left font-semibold text-muted-foreground text-xs">Fuvaros</th>
                <th className="h-11 px-4 text-right font-semibold text-muted-foreground text-xs">Kalk. HUF</th>
                <th className="h-11 px-4 text-right font-semibold text-muted-foreground text-xs">Kalk. EUR</th>
                <th className="h-11 px-4 text-left font-semibold text-muted-foreground text-xs">Matching státusz</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: PAGE_SIZE }).map((_, idx) => (
                  <tr key={idx} className="border-b border-border/40">
                    <td className="p-4"><Skeleton className="h-4 w-28" /></td>
                    <td className="p-4"><Skeleton className="h-4 w-24" /></td>
                    <td className="p-4"><Skeleton className="h-4 w-24" /></td>
                    <td className="p-4"><Skeleton className="h-4 w-32" /></td>
                    <td className="p-4"><Skeleton className="h-4 w-20 ml-auto" /></td>
                    <td className="p-4"><Skeleton className="h-4 w-20 ml-auto" /></td>
                    <td className="p-4"><Skeleton className="h-5 w-24" /></td>
                  </tr>
                ))
              ) : filteredShipments.length === 0 ? (
                <>
                  <tr>
                    <td colSpan={7} className="h-24 text-center text-muted-foreground font-medium">
                      Nem található fuvar.
                    </td>
                  </tr>
                  {/* Fill remaining rows to maintain layout */}
                  {Array.from({ length: PAGE_SIZE - 1 }).map((_, idx) => (
                    <tr key={`empty-${idx}`} className="border-b border-border/10">
                      <td className="px-4 py-3" colSpan={7}>&nbsp;</td>
                    </tr>
                  ))}
                </>
              ) : (
                <>
                  {pagedShipments.map((s) => (
                    <tr 
                      key={s.id} 
                      className="border-b border-border/30 hover:bg-muted/30 cursor-pointer transition-colors duration-150"
                      onClick={() => handleRowClick(s)}
                    >
                      <td className="px-4 py-3 font-mono font-semibold text-primary">{s.position_number}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {s.pickup_date ? format(new Date(s.pickup_date), 'yyyy. MM. dd.') : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {s.delivery_date ? format(new Date(s.delivery_date), 'yyyy. MM. dd.') : '—'}
                      </td>
                      <td className="px-4 py-3 font-medium truncate max-w-[180px]">{s.carrier_name || '—'}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        {s.calculated_amount_huf !== null ? `${formatCurrency(s.calculated_amount_huf, 'HUF')}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        {s.calculated_amount_eur !== null ? `${formatCurrency(s.calculated_amount_eur, 'EUR')}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge 
                          variant={s.match_status === 'matched' ? 'default' : 'outline'}
                          className={s.match_status === 'matched' ? 'bg-success/10 text-success border-success/20 font-semibold' : 'text-warning border-warning/20 font-semibold bg-warning/5'}
                        >
                          {s.match_status === 'matched' ? '✓ Párosított' : '○ Várakozó'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {/* Fill empty rows on last page to prevent layout shift */}
                  {emptyRowCount > 0 && Array.from({ length: emptyRowCount }).map((_, idx) => (
                    <tr key={`empty-${idx}`} className="border-b border-border/10">
                      <td className="px-4 py-3" colSpan={7}>&nbsp;</td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {!isLoading && filteredShipments.length > 0 && (
          <div className="flex items-center justify-between bg-card px-4 py-3 rounded-lg border border-border/50 shadow-sm">
            <p className="text-xs text-muted-foreground font-medium">
              {filteredShipments.length} tételből {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, filteredShipments.length)} megjelenítve
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => { setCurrentPage(1); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50); }}
                disabled={currentPage === 1}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50); }}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-3 text-sm font-semibold tabular-nums">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50); }}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => { setCurrentPage(totalPages); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50); }}
                disabled={currentPage === totalPages}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Detail Dialog */}
        <Dialog open={!!selectedShipment} onOpenChange={(open) => !open && setSelectedShipment(null)}>
          <DialogContent className="sm:max-w-2xl border-border bg-card">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                <Truck className="h-5 w-5 text-primary" />
                Fuvar Részletei: {selectedShipment?.position_number}
              </DialogTitle>
              <DialogDescription>
                Selexped importált fuvar adatok és kapcsolódó dokumentumok
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {!selectedShipment ? null : (<>
              {/* Shipment Details Grid */}
              <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg border border-border/40">
                <div>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Fuvaros</span>
                  <span className="text-sm font-semibold text-foreground mt-1 block">{selectedShipment?.carrier_name || '—'}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Matching státusz</span>
                  <div className="mt-1">
                    <Badge 
                      variant={selectedShipment?.match_status === 'matched' ? 'default' : 'outline'}
                      className={selectedShipment?.match_status === 'matched' ? 'bg-success/10 text-success border-success/20' : 'text-warning border-warning/20 bg-warning/5'}
                    >
                      {selectedShipment?.match_status === 'matched' ? '✓ Párosított' : '○ Várakozó'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Felrakás dátuma</span>
                  <span className="text-sm font-medium mt-1 block">
                    {selectedShipment?.pickup_date ? format(new Date(selectedShipment.pickup_date), 'yyyy. MM. dd.', { locale: hu }) : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Lerakás dátuma</span>
                  <span className="text-sm font-medium mt-1 block">
                    {selectedShipment?.delivery_date ? format(new Date(selectedShipment.delivery_date), 'yyyy. MM. dd.', { locale: hu }) : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Kalkulált összeg (HUF)</span>
                  <span className="text-sm font-mono mt-1 block">
                    {selectedShipment.calculated_amount_huf != null ? formatCurrency(selectedShipment.calculated_amount_huf, 'HUF') : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Kalkulált összeg (EUR)</span>
                  <span className="text-sm font-mono mt-1 block">
                    {selectedShipment.calculated_amount_eur != null ? formatCurrency(selectedShipment.calculated_amount_eur, 'EUR') : '—'}
                  </span>
                </div>
              </div>

              {/* Linked Invoice */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <FileText className="h-4 w-4 text-info" />
                  Kapcsolódó Számla
                </h4>
                {selectedShipment?.match_status === 'matched' && linkedInvoice ? (
                  <div className="flex items-center justify-between border border-border/50 rounded-lg p-3 bg-card shadow-sm hover:border-primary/20 transition-colors">
                    <div>
                      <p className="text-sm font-semibold">{linkedInvoice.bizonylatsorszam} — {linkedInvoice.elado_nev}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Bruttó: <strong className="text-foreground">{formatCurrency(linkedInvoice.brutto_vegosszeg, linkedInvoice.penznem)}</strong> | Dátum: {format(new Date(linkedInvoice.kibocsatas_datuma), 'yyyy. MM. dd.')}
                      </p>
                      {linkedInvoice.selexped_registry_number && (
                        <p className="text-xs text-muted-foreground mt-0.5">Selexped Reg: <strong className="text-foreground font-mono">{linkedInvoice.selexped_registry_number}</strong></p>
                      )}
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        setSelectedShipment(null);
                        navigate(`${basePath}/invoices?invoiceId=${linkedInvoice.id}`);
                      }}
                    >
                      Megtekintés
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground italic bg-muted/10 p-3 rounded-lg border border-dashed border-border flex items-center gap-1.5">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    Ehhez a fuvarhoz még nem lett számla párosítva.
                  </div>
                )}
              </div>

              {/* Linked CMRs */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Truck className="h-4 w-4 text-primary" />
                  CMR és egyéb dokumentumok ({linkedCmrs.length} db)
                </h4>
                {linkedCmrs.length > 0 ? (
                  <div className="space-y-2">
                    {linkedCmrs.map((cmr: any) => (
                      <div key={cmr.id} className="flex items-center justify-between border border-border/50 rounded-lg p-3 bg-card hover:border-primary/20 transition-colors">
                        <div>
                          <p className="text-sm font-semibold">{cmr.file_name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Méret: {(cmr.file_size / 1024).toFixed(0)} KB | Feltöltve: {format(new Date(cmr.created_at), 'yyyy. MM. dd.')}
                          </p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => window.open(cmr.file_path, '_blank')}>
                          <FileDown className="h-4 w-4 text-muted-foreground hover:text-primary" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground italic bg-muted/10 p-3 rounded-lg border border-dashed border-border flex items-center gap-1.5">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    Nincs csatolva CMR szállítólevél ehhez a fuvarhoz.
                  </div>
                )}
              </div>
              </>)}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
