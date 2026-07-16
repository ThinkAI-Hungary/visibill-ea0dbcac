import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { 
  Check, Edit2, Eye, Search, AlertCircle, RefreshCw, HelpCircle, 
  ExternalLink, FileText, ChevronRight, CheckCircle2, Save, X 
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { UnifiedPagination } from '@/components/ui/unified-pagination';
import { useEaisybillPermissions } from '@/hooks/useEaisybillPermissions';
import InvoiceImageDialog from '@/components/InvoiceImageDialog';

export default function ApprovalTab() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id || '';
  const qc = useQueryClient();
  const { canWrite: canWriteModule } = useEaisybillPermissions();
  const writable = canWriteModule('petty_cash');

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  // Dialog state for previewing the receipt image/PDF only
  const [previewInvoice, setPreviewInvoice] = useState<any | null>(null);
  
  // Dialog state for editing the receipt details
  const [editingInvoice, setEditingInvoice] = useState<any | null>(null);
  
  // Local edit form state
  const [editForm, setEditForm] = useState({
    bizonylatsorszam: '',
    kibocsatas_datuma: '',
    elado_nev: '',
    vevo_nev: '',
    brutto_vegosszeg: 0,
    penznem: 'HUF',
    adojogi_megjegyzes: '',
    invoice_direction: 'INBOUND',
  });

  // Fetch low-confidence invoices waiting for approval
  const { data: pendingInvoices = [], isLoading, refetch } = useQuery({
    queryKey: ['pettyCashPendingInvoices', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('company_id', companyId)
        .eq('statusz', 'jovahagyasra_var')
        .in('invoice_type', ['penztarbizonylat', 'egyszerusitett_szla'])
        .order('kibocsatas_datuma', { ascending: false })
        .order('letrehozva', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('invoices')
        .update({ statusz: 'feldolgozott' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pettyCashPendingInvoices', companyId] });
      qc.invalidateQueries({ queryKey: ['pettyCashEntries', companyId] });
      toast({
        title: 'Bizonylat sikeresen jóváhagyva!',
        description: 'A tétel bekerült az éles házipénztár sorok közé.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Hiba történt a jóváhagyás során',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Save changes mutation
  const saveMutation = useMutation({
    mutationFn: async ({ id, data, approveAfterSave }: { id: string; data: any; approveAfterSave?: boolean }) => {
      const updatePayload: any = {
        bizonylatsorszam: data.bizonylatsorszam,
        kibocsatas_datuma: data.kibocsatas_datuma,
        elado_nev: data.elado_nev,
        vevo_nev: data.vevo_nev,
        brutto_vegosszeg: data.brutto_vegosszeg,
        adoalap_osszesen: data.brutto_vegosszeg, // Net matches gross since VAT is 0 in receipts
        penznem: data.penznem,
        adojogi_megjegyzes: data.adojogi_megjegyzes,
        invoice_direction: data.invoice_direction,
      };

      if (approveAfterSave) {
        updatePayload.statusz = 'feldolgozott';
      }

      const { error } = await supabase
        .from('invoices')
        .update(updatePayload)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['pettyCashPendingInvoices', companyId] });
      qc.invalidateQueries({ queryKey: ['pettyCashEntries', companyId] });
      setEditingInvoice(null);
      toast({
        title: variables.approveAfterSave ? 'Tétel mentve és jóváhagyva' : 'Változtatások sikeresen elmentve',
        description: variables.approveAfterSave ? 'A bizonylat élesítve lett.' : 'A tétel továbbra is jóváhagyásra vár.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Nem sikerült menteni a változtatásokat',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Handle opening the edit dialog
  const handleStartEdit = (inv: any) => {
    setEditingInvoice(inv);
    setEditForm({
      bizonylatsorszam: inv.bizonylatsorszam || '',
      kibocsatas_datuma: inv.kibocsatas_datuma || '',
      elado_nev: inv.elado_nev || '',
      vevo_nev: inv.vevo_nev || '',
      brutto_vegosszeg: inv.brutto_vegosszeg || 0,
      penznem: inv.penznem || 'HUF',
      adojogi_megjegyzes: inv.adojogi_megjegyzes || '',
      invoice_direction: inv.invoice_direction || 'INBOUND',
    });
  };

  // Filter list locally
  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return pendingInvoices;
    const term = searchTerm.toLowerCase();
    return pendingInvoices.filter(inv => {
      const sorszam = (inv.bizonylatsorszam || '').toLowerCase();
      const elado = (inv.elado_nev || '').toLowerCase();
      const vevo = (inv.vevo_nev || '').toLowerCase();
      const megjegyzes = (inv.adojogi_megjegyzes || '').toLowerCase();
      const osszeg = (inv.brutto_vegosszeg || '').toString();
      
      return sorszam.includes(term) || elado.includes(term) || vevo.includes(term) || megjegyzes.includes(term) || osszeg.includes(term);
    });
  }, [pendingInvoices, searchTerm]);

  // Paginated list
  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  // Format helper for confidence score
  const getConfidenceBadge = (score: number | null) => {
    const actualScore = score !== null ? score : 0.8;
    const pct = Math.round(actualScore * 100);
    
    if (actualScore >= 0.9) {
      return (
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-medium">
          {pct}% - Jó minőség
        </Badge>
      );
    } else if (actualScore >= 0.7) {
      return (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 font-medium">
          {pct}% - Kérdéses
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="bg-rose-500/10 text-rose-500 border-rose-500/20 font-medium animate-pulse">
          {pct}% - Olvashatatlan
        </Badge>
      );
    }
  };

  const getInvoiceTypeBadge = (type: string) => {
    if (type === 'penztarbizonylat') {
      return <Badge className="bg-blue-500/15 text-blue-400 hover:bg-blue-500/15 border-transparent font-normal">Készpénz bizonylat</Badge>;
    }
    return <Badge className="bg-purple-500/15 text-purple-400 hover:bg-purple-500/15 border-transparent font-normal">Nyugta / Blokk</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <Card className="border-amber-500/20 bg-amber-500/5 shadow-none overflow-hidden">
        <CardContent className="p-4 flex gap-3 items-start">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-semibold text-sm text-amber-500">Manuális jóváhagyásra váró bizonylatok</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Az AI által bizonytalanul vagy kézírás miatt alacsony megbízhatósággal kinyert tételek itt kerülnek összegyűjtésre.
              Ellenőrizd a beolvasott adatokat a bizonylat képével összevetve, javítsd az esetleges hibákat, majd hagyd jóvá őket,
              hogy bekerülhessenek az éles házipénztár egyenlegbe.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Filter and Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-card p-3 rounded-lg border border-border/40">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Keresés sorszám, partner vagy összeg alapján..."
            className="pl-9 h-9"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
        <div className="flex gap-2 shrink-0 items-center text-xs text-muted-foreground">
          <span>Összesen: <strong className="text-foreground">{filtered.length} db</strong> bizonylat</span>
          <Button variant="ghost" size="icon" onClick={() => refetch()} className="h-8 w-8 hover:bg-muted">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-md border border-border/40 bg-card/40 overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="w-12 text-center">Nézet</TableHead>
              <TableHead className="w-44">AI Bizonyosság</TableHead>
              <TableHead className="w-32">Kibocsátás</TableHead>
              <TableHead className="w-44">Típus</TableHead>
              <TableHead className="w-40">Bizonylatszám</TableHead>
              <TableHead className="min-w-[180px]">Eladó (Kibocsátó)</TableHead>
              <TableHead className="min-w-[180px]">Vevő</TableHead>
              <TableHead className="w-[180px] text-right font-semibold">Összeg</TableHead>
              <TableHead className="w-24 text-center">Művelet</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-16 text-muted-foreground">
                  <div className="flex flex-col items-center gap-3">
                    <span className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                    <p className="text-sm">Bizonylatok betöltése...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-muted-foreground text-sm">
                  <div className="flex flex-col items-center gap-2 py-4">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500/40" />
                    <p className="font-medium text-foreground">Nincs jóváhagyásra váró bizonylat</p>
                    <p className="text-xs">Minden beolvasott cash bizonylat sikeresen feldolgozásra került!</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((inv) => (
                <TableRow key={inv.id} className="hover:bg-muted/10 transition-colors">
                  <TableCell className="text-center p-2">
                    {(inv.image_url || inv.melleklet_url) ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-primary hover:bg-primary/10 hover:text-primary transition-all"
                        onClick={() => setPreviewInvoice(inv)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    ) : (
                      <span className="text-muted-foreground/30">-</span>
                    )}
                  </TableCell>
                  <TableCell className="py-2">
                    {getConfidenceBadge(inv.confidence_score)}
                  </TableCell>
                  <TableCell className="font-mono text-sm py-2">
                    {inv.kibocsatas_datuma ? format(parseISO(inv.kibocsatas_datuma), 'yyyy.MM.dd') : 'N/A'}
                  </TableCell>
                  <TableCell className="py-2">
                    {getInvoiceTypeBadge(inv.invoice_type)}
                  </TableCell>
                  <TableCell className="font-mono text-sm font-semibold py-2">
                    {inv.bizonylatsorszam || 'N/A'}
                  </TableCell>
                  <TableCell className="truncate max-w-[200px] py-2">
                    {inv.elado_nev || 'Ismeretlen'}
                  </TableCell>
                  <TableCell className="truncate max-w-[200px] py-2">
                    {inv.vevo_nev || 'Ismeretlen'}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm font-bold text-foreground py-2">
                    <span className={cn(
                      inv.invoice_direction === 'INBOUND' ? 'text-rose-400' : 'text-emerald-400'
                    )}>
                      {inv.invoice_direction === 'INBOUND' ? '-' : '+'}
                    </span>
                    {' '}{inv.brutto_vegosszeg?.toLocaleString('hu-HU')}{' '}{inv.penznem}
                  </TableCell>
                  <TableCell className="p-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
                        onClick={() => handleStartEdit(inv)}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      {writable && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10"
                          disabled={approveMutation.isPending}
                          onClick={() => approveMutation.mutate(inv.id)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <UnifiedPagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
        />
      )}

      {/* Image Preview Modal */}
      {previewInvoice && (
        <InvoiceImageDialog
          invoice={previewInvoice}
          open={!!previewInvoice}
          onClose={() => setPreviewInvoice(null)}
        />
      )}

      {/* Side-by-Side Edit Dialog */}
      {editingInvoice && (
        <Dialog open={!!editingInvoice} onOpenChange={() => setEditingInvoice(null)}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col transition-all duration-200">
            <DialogHeader className="border-b border-border/20 pb-4">
              <div className="flex justify-between items-center">
                <div>
                  <DialogTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    Bizonylat ellenőrzése és javítása
                  </DialogTitle>
                  <DialogDescription className="mt-1">
                    Hasonlítsd össze az AI által kinyert adatokat a bal oldali bizonylatképpel, majd mentsd vagy élesítsd a javított tétel adatokat.
                  </DialogDescription>
                </div>
                <div className="mr-8">
                  {getConfidenceBadge(editingInvoice.confidence_score)}
                </div>
              </div>
            </DialogHeader>

            {/* Content: Side-by-Side layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-hidden flex-1 py-4">
              
              {/* Left Side: Document Preview */}
              <div className="overflow-hidden border border-border/40 rounded-lg bg-muted/10 flex flex-col justify-center items-center relative h-[35vh] md:h-full min-h-[300px]">
                {editingInvoice.image_url || editingInvoice.melleklet_url ? (
                  <>
                    {editingInvoice.image_url || editingInvoice.melleklet_url ? (
                      editingInvoice.image_url?.toLowerCase().endsWith('.pdf') || editingInvoice.melleklet_url?.toLowerCase().endsWith('.pdf') ? (
                        <iframe
                          src={editingInvoice.image_url || editingInvoice.melleklet_url}
                          className="w-full h-full border-0"
                          title="Bizonylat kép"
                        />
                      ) : (
                        <div className="w-full h-full flex justify-center items-center p-2">
                          <img
                            src={editingInvoice.image_url || editingInvoice.melleklet_url}
                            alt="Bizonylat kép"
                            className="max-w-full max-h-full object-contain rounded shadow-md"
                          />
                        </div>
                      )
                    ) : null}
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute bottom-3 right-3 bg-background/90 backdrop-blur-sm shadow hover:bg-background"
                      onClick={() => window.open(editingInvoice.image_url || editingInvoice.melleklet_url, '_blank')}
                    >
                      <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Megnyitás új lapon
                    </Button>
                  </>
                ) : (
                  <div className="text-center p-6 text-muted-foreground flex flex-col items-center gap-2">
                    <HelpCircle className="w-10 h-10 text-muted-foreground/30" />
                    <p className="text-sm font-medium">Nincs elérhető kép ehhez a bizonylathoz</p>
                  </div>
                )}
              </div>

              {/* Right Side: Form */}
              <div className="overflow-y-auto pr-1 flex flex-col gap-4 max-h-[45vh] md:max-h-full">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="direction">Tranzakció Iránya</Label>
                    <Select
                      value={editForm.invoice_direction}
                      onValueChange={(val) => setEditForm(prev => ({ ...prev, invoice_direction: val }))}
                    >
                      <SelectTrigger id="direction" className="h-9">
                        <SelectValue placeholder="Válassz irányt" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INBOUND">Kiadás (Befizetés partnernek)</SelectItem>
                        <SelectItem value="OUTBOUND">Bevétel (Partner befizetése)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sorszam">Bizonylatszám / Sorszám</Label>
                    <Input
                      id="sorszam"
                      className="h-9 font-mono"
                      value={editForm.bizonylatsorszam}
                      onChange={(e) => setEditForm(prev => ({ ...prev, bizonylatsorszam: e.target.value }))}
                      placeholder="pl. KK-2026-0001"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="datum">Kibocsátás Dátuma</Label>
                    <Input
                      id="datum"
                      type="date"
                      className="h-9"
                      value={editForm.kibocsatas_datuma}
                      onChange={(e) => setEditForm(prev => ({ ...prev, kibocsatas_datuma: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="brutto">Bruttó Összeg</Label>
                      <span className="text-[10px] text-muted-foreground">Készpénzes ÁFA: 0% / mentes</span>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        id="brutto"
                        type="number"
                        className="h-9 font-mono flex-1"
                        value={editForm.brutto_vegosszeg}
                        onChange={(e) => setEditForm(prev => ({ ...prev, brutto_vegosszeg: parseFloat(e.target.value) || 0 }))}
                      />
                      <Select
                        value={editForm.penznem}
                        onValueChange={(val) => setEditForm(prev => ({ ...prev, penznem: val }))}
                      >
                        <SelectTrigger className="w-24 h-9">
                          <SelectValue placeholder="Pénznem" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="HUF">HUF</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="elado">Eladó (Pénzt kiadó vagy Számlát adó)</Label>
                  <Input
                    id="elado"
                    className="h-9"
                    value={editForm.elado_nev}
                    onChange={(e) => setEditForm(prev => ({ ...prev, elado_nev: e.target.value }))}
                    placeholder="Eladó teljes neve..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vevo">Vevő (Pénzt átvevő vagy Befizető cég)</Label>
                  <Input
                    id="vevo"
                    className="h-9"
                    value={editForm.vevo_nev}
                    onChange={(e) => setEditForm(prev => ({ ...prev, vevo_nev: e.target.value }))}
                    placeholder="Vevő teljes neve..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="leiras">Megjegyzés / Jogcím leírása</Label>
                  <Textarea
                    id="leiras"
                    rows={3}
                    className="resize-none text-sm"
                    value={editForm.adojogi_megjegyzes}
                    onChange={(e) => setEditForm(prev => ({ ...prev, adojogi_megjegyzes: e.target.value }))}
                    placeholder="Írd le a pénztári tranzakció gazdasági eseményét vagy célját..."
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="border-t border-border/20 pt-4 flex sm:justify-between items-center gap-2">
              <div className="text-xs text-muted-foreground flex items-center gap-1.5 shrink-0">
                <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" />
                A mentett értékek azonnal frissülnek az adatbázisban.
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setEditingInvoice(null)} 
                  disabled={saveMutation.isPending}
                  className="h-9"
                >
                  <X className="h-4 w-4 mr-1.5" /> Mégse
                </Button>
                <Button 
                  variant="secondary"
                  onClick={() => saveMutation.mutate({ id: editingInvoice.id, data: editForm, approveAfterSave: false })} 
                  disabled={saveMutation.isPending}
                  className="h-9"
                >
                  <Save className="h-4 w-4 mr-1.5" /> Csak mentés
                </Button>
                {writable && (
                  <Button 
                    variant="default"
                    onClick={() => saveMutation.mutate({ id: editingInvoice.id, data: editForm, approveAfterSave: true })} 
                    disabled={saveMutation.isPending}
                    className="h-9 bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    <Check className="h-4 w-4 mr-1.5" /> Mentés és Élesítés
                  </Button>
                )}
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
