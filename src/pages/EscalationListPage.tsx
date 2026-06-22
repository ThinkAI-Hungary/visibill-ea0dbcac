import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { 
  AlertTriangle, 
  Check, 
  X, 
  ArrowLeftRight, 
  FileText, 
  Truck,
  HelpCircle,
  Inbox,
  Link,
  ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';

interface EscalatedMatch {
  id: string;
  confidence_score: number;
  discrepancies: string[];
  status: string;
  invoice_id: string;
  shipment_id: string;
  created_at: string;
  invoice: {
    id: string;
    bizonylatsorszam: string;
    elado_nev: string;
    brutto_vegosszeg: number;
    penznem: string;
    kibocsatas_datuma: string;
    planned_payment_date: string | null;
    position_numbers: string[] | null;
  };
  shipment: {
    id: string;
    position_number: string;
    carrier_name: string | null;
    pickup_date: string | null;
    delivery_date: string | null;
    calculated_amount_huf: number | null;
    calculated_amount_eur: number | null;
  };
}

export default function EscalationListPage() {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedMatch, setSelectedMatch] = useState<EscalatedMatch | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [reassignPos, setReassignPos] = useState('');
  const [showReassignInput, setShowReassignInput] = useState(false);

  // Fetch escalated/review matches
  const { data: matches = [], isLoading } = useQuery<EscalatedMatch[]>({
    queryKey: ['escalated-matches', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      
      const { data, error } = await supabase
        .from('shipment_matches' as any)
        .select(`
          id,
          confidence_score,
          discrepancies,
          status,
          invoice_id,
          shipment_id,
          created_at,
          invoice:invoices(
            id,
            bizonylatsorszam,
            elado_nev,
            brutto_vegosszeg,
            penznem,
            kibocsatas_datuma,
            planned_payment_date,
            position_numbers
          ),
          shipment:shipments(
            id,
            position_number,
            carrier_name,
            pickup_date,
            delivery_date,
            calculated_amount_huf,
            calculated_amount_eur
          )
        `)
        .eq('company_id', selectedCompany.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as EscalatedMatch[];
    },
    enabled: !!selectedCompany?.id,
  });

  const handleAcceptMatch = async (match: EscalatedMatch) => {
    setIsActionLoading(true);
    try {
      // 1. Confirm the match
      const { error: matchError } = await supabase
        .from('shipment_matches' as any)
        .update({ status: 'confirmed' })
        .eq('id', match.id);

      if (matchError) throw matchError;

      // 2. Link shipment to invoice
      const { error: shipError } = await supabase
        .from('shipments' as any)
        .update({ 
          match_status: 'matched',
          matched_invoice_id: match.invoice.id 
        })
        .eq('id', match.shipment.id);

      if (shipError) throw shipError;

      // 3. Update invoice matching status
      const { error: invError } = await supabase
        .from('invoices')
        .update({ 
          shipment_match_status: 'matched'
        })
        .eq('id', match.invoice.id);

      if (invError) throw invError;

      toast({
        title: "Párosítás elfogadva",
        description: "A számla és fuvar manuális párosítása sikeresen rögzítve lett.",
      });

      setSelectedMatch(null);
      queryClient.invalidateQueries({ queryKey: ['escalated-matches', selectedCompany?.id] });
      queryClient.invalidateQueries({ queryKey: ['shipments-matching', selectedCompany?.id] });
      queryClient.invalidateQueries({ queryKey: ['shipments', selectedCompany?.id] });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Sikertelen mentés",
        description: err.message || "Hiba történt a párosítás mentése során."
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRejectMatch = async (match: EscalatedMatch) => {
    setIsActionLoading(true);
    try {
      // 1. Reject the match
      const { error: matchError } = await supabase
        .from('shipment_matches' as any)
        .update({ status: 'rejected' })
        .eq('id', match.id);

      if (matchError) throw matchError;

      // 2. Unlink shipment
      const { error: shipError } = await supabase
        .from('shipments' as any)
        .update({ 
          match_status: 'unmatched',
          matched_invoice_id: null 
        })
        .eq('id', match.shipment.id);

      if (shipError) throw shipError;

      // 3. Update invoice status
      const { error: invError } = await supabase
        .from('invoices')
        .update({ 
          shipment_match_status: 'unmatched'
        })
        .eq('id', match.invoice.id);

      if (invError) throw invError;

      toast({
        title: "Párosítás elutasítva",
        description: "A javasolt párosítás elutasításra került.",
      });

      setSelectedMatch(null);
      queryClient.invalidateQueries({ queryKey: ['escalated-matches', selectedCompany?.id] });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Művelet sikertelen",
        description: err.message || "Hiba történt."
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleReassignMatch = async (match: EscalatedMatch) => {
    if (!reassignPos.trim()) return;
    setIsActionLoading(true);
    try {
      // Find the shipment by position number
      const { data: newShipment, error: findError } = await supabase
        .from('shipments' as any)
        .select('id, carrier_name')
        .eq('company_id', selectedCompany?.id)
        .eq('position_number', reassignPos.trim())
        .maybeSingle();

      if (findError) throw findError;

      if (!newShipment) {
        toast({
          variant: "destructive",
          title: "Pozíció nem található",
          description: `Nem található "${reassignPos.trim()}" pozíciószámú fuvar a Selexped importban.`
        });
        setIsActionLoading(false);
        return;
      }

      // 1. Delete or reject old match
      await supabase
        .from('shipment_matches' as any)
        .delete()
        .eq('id', match.id);

      // 2. Create new match entry manually confirmed
      const { error: matchError } = await supabase
        .from('shipment_matches' as any)
        .insert({
          company_id: selectedCompany?.id,
          invoice_id: match.invoice.id,
          shipment_id: newShipment.id,
          match_type: 'manual',
          confidence_score: 100,
          status: 'confirmed',
          match_details: { reassigned_from: match.shipment.position_number }
        });

      if (matchError) throw matchError;

      // 3. Link new shipment
      await supabase
        .from('shipments' as any)
        .update({ 
          match_status: 'matched',
          matched_invoice_id: match.invoice.id 
        })
        .eq('id', newShipment.id);

      // 4. Update invoice status
      await supabase
        .from('invoices')
        .update({ 
          shipment_match_status: 'matched'
        })
        .eq('id', match.invoice.id);

      toast({
        title: "Sikeres átirányítás",
        description: `A számla sikeresen hozzárendelve a "${reassignPos.trim()}" pozícióhoz.`,
      });

      setSelectedMatch(null);
      setReassignPos('');
      setShowReassignInput(false);
      queryClient.invalidateQueries({ queryKey: ['escalated-matches', selectedCompany?.id] });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Átirányítás sikertelen",
        description: err.message || "Hiba történt."
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 page-animate">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Eszkalációs lista</h1>
          <p className="text-muted-foreground font-medium text-sm">Felülvizsgálatra váró számla-fuvar párosítások — emberi döntés szükséges</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Matches List */}
          <div className="md:col-span-1 space-y-4">
            <Card className="border border-border/50 bg-card shadow-sm h-[calc(100vh-220px)] flex flex-col">
              <CardHeader className="p-4 border-b border-border/40 shrink-0">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <AlertTriangle className="h-4.5 w-4.5 text-warning" />
                  Eltérések ({matches.length} db)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2 overflow-y-auto flex-1 space-y-2 min-h-0">
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))
                ) : matches.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground italic py-10 flex flex-col items-center justify-center gap-2">
                    <Inbox className="h-8 w-8 text-muted-foreground" />
                    Nincs felülvizsgálandó tétel.
                  </div>
                ) : (
                  matches.map((m) => (
                    <div
                      key={m.id}
                      className={`p-3 rounded-lg border text-left cursor-pointer transition-all duration-150 flex items-center justify-between group ${
                        selectedMatch?.id === m.id 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border/50 hover:bg-muted/40 hover:border-primary/20'
                      }`}
                      onClick={() => { setSelectedMatch(m); setShowReassignInput(false); }}
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm truncate block">{m.invoice.bizonylatsorszam}</span>
                          <Badge variant="outline" className="text-[9px] px-1 py-0 border-destructive/20 text-destructive bg-destructive/5 font-semibold shrink-0">
                            {m.confidence_score}% Match
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground truncate block">{m.invoice.elado_nev}</span>
                        <span className="text-[10px] font-mono text-primary font-semibold block">{m.shipment.position_number}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 ml-2" />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Details / Comparison View */}
          <div className="md:col-span-2">
            {selectedMatch ? (
              <Card className="border border-border/50 bg-card shadow-sm h-[calc(100vh-220px)] flex flex-col overflow-hidden">
                <CardHeader className="p-5 border-b border-border/40 shrink-0">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <CardTitle className="text-lg font-bold">Összehasonlító panel</CardTitle>
                      <CardDescription>Vizsgáld meg az eltéréseket a számla és a Selexped kalkuláció között</CardDescription>
                    </div>
                    <Badge className="bg-warning/10 text-warning border-warning/20 font-semibold shrink-0">
                      Felülvizsgálat szükséges
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-6 flex-1 overflow-y-auto space-y-6">
                  {/* Discrepancies Alert */}
                  {selectedMatch.discrepancies?.length > 0 && (
                    <div className="bg-destructive/5 border border-destructive/10 text-destructive p-4 rounded-lg flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <span className="font-bold text-sm block">Detektált eltérések</span>
                        <ul className="list-disc pl-4 text-xs font-semibold space-y-1">
                          {selectedMatch.discrepancies.map((d, i) => (
                            <li key={i}>{d}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Comparison Grid */}
                  <div className="grid md:grid-cols-7 gap-4 items-stretch">
                    {/* Invoice Info */}
                    <div className="md:col-span-3 border border-border/40 p-4 rounded-lg bg-muted/10 space-y-4">
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
                        <FileText className="h-4 w-4 text-info" />
                        Számla Adatok (OCR)
                      </h4>
                      <div className="space-y-3 text-xs">
                        <div>
                          <span className="text-muted-foreground font-semibold">Számlaszám</span>
                          <p className="font-bold text-foreground mt-0.5">{selectedMatch.invoice.bizonylatsorszam}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground font-semibold">
                            Kinyert Pozíciószám
                            {(selectedMatch.invoice.position_numbers?.length ?? 0) > 1 && (
                              <Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0 border-info/30 text-info bg-info/5 font-semibold align-middle">
                                Gyűjtő számla · {selectedMatch.invoice.position_numbers!.length} pozíció
                              </Badge>
                            )}
                          </span>
                          <p className="font-mono font-bold text-primary mt-0.5">
                            {selectedMatch.invoice.position_numbers?.length
                              ? selectedMatch.shipment.position_number
                              : <span className="text-muted-foreground font-normal italic">Nem található</span>
                            }
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground font-semibold">Partner / Szállító</span>
                          <p className="font-bold text-foreground mt-0.5">{selectedMatch.invoice.elado_nev}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground font-semibold">Számla Összege</span>
                          <p className="font-mono font-bold text-foreground mt-0.5">
                            {formatCurrency(selectedMatch.invoice.brutto_vegosszeg, selectedMatch.invoice.penznem)}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground font-semibold">Teljesítés Dátuma</span>
                          <p className="font-bold text-foreground mt-0.5">
                            {selectedMatch.invoice.kibocsatas_datuma ? format(new Date(selectedMatch.invoice.kibocsatas_datuma), 'yyyy. MM. dd.') : '—'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Divider Icon */}
                    <div className="md:col-span-1 flex md:flex-col items-center justify-center gap-2 py-4">
                      <div className="h-px w-8 md:h-8 md:w-px bg-border/60" />
                      <ArrowLeftRight className="h-5 w-5 text-muted-foreground" />
                      <div className="h-px w-8 md:h-8 md:w-px bg-border/60" />
                    </div>

                    {/* Shipment Info */}
                    <div className="md:col-span-3 border border-border/40 p-4 rounded-lg bg-muted/10 space-y-4">
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
                        <Truck className="h-4 w-4 text-primary" />
                        Selexped Kalkuláció
                      </h4>
                      <div className="space-y-3 text-xs">
                        <div>
                          <span className="text-muted-foreground font-semibold">Pozíciószám</span>
                          <p className="font-mono font-bold text-primary mt-0.5">{selectedMatch.shipment.position_number}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground font-semibold">Fuvaros</span>
                          <p className="font-bold text-foreground mt-0.5">{selectedMatch.shipment.carrier_name || '—'}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground font-semibold">Kalkulált Összegek</span>
                          <p className="font-mono font-bold text-foreground mt-0.5">
                            {/* Show invoice-currency amount first (bold), then other currency (muted) */}
                            {selectedMatch.invoice.penznem === 'EUR' ? (
                              <>
                                {selectedMatch.shipment.calculated_amount_eur !== null 
                                  ? formatCurrency(Math.abs(selectedMatch.shipment.calculated_amount_eur), 'EUR') 
                                  : '—'}
                                {selectedMatch.shipment.calculated_amount_huf !== null && (
                                  <span className="text-muted-foreground font-normal text-[10px] ml-1.5">
                                    ({formatCurrency(Math.abs(selectedMatch.shipment.calculated_amount_huf), 'HUF')})
                                  </span>
                                )}
                              </>
                            ) : (
                              <>
                                {selectedMatch.shipment.calculated_amount_huf !== null 
                                  ? formatCurrency(Math.abs(selectedMatch.shipment.calculated_amount_huf), 'HUF') 
                                  : '—'}
                                {selectedMatch.shipment.calculated_amount_eur !== null && (
                                  <span className="text-muted-foreground font-normal text-[10px] ml-1.5">
                                    ({formatCurrency(Math.abs(selectedMatch.shipment.calculated_amount_eur), 'EUR')})
                                  </span>
                                )}
                              </>
                            )}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground font-semibold">Lerakás Dátuma</span>
                          <p className="font-bold text-foreground mt-0.5">
                            {selectedMatch.shipment.delivery_date ? format(new Date(selectedMatch.shipment.delivery_date), 'yyyy. MM. dd.') : '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Reassign Panel */}
                  {showReassignInput && (
                    <div className="border border-primary/20 bg-primary/5 p-4 rounded-lg space-y-3 animate-in slide-in-from-top-2 duration-200">
                      <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                        <Link className="h-4 w-4" />
                        Számla átirányítása másik pozícióra
                      </span>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Új pozíciószám (pl. B/2627471)..."
                          value={reassignPos}
                          onChange={(e) => setReassignPos(e.target.value)}
                          className="bg-card font-mono"
                        />
                        <Button size="sm" onClick={() => handleReassignMatch(selectedMatch)} disabled={isActionLoading}>
                          Hozzárendelés
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowReassignInput(false)}>
                          Mégse
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Actions buttons */}
                  <div className="flex flex-wrap gap-2 pt-4 border-t justify-end">
                    <Button 
                      variant="outline"
                      className="border-primary/30 hover:bg-primary/10 text-primary"
                      onClick={() => setShowReassignInput(true)}
                      disabled={isActionLoading}
                    >
                      <Link className="h-4 w-4 mr-2" />
                      Másik fuvarhoz rendelés
                    </Button>
                    <Button 
                      variant="outline" 
                      className="border-destructive/30 hover:bg-destructive/10 text-destructive"
                      onClick={() => handleRejectMatch(selectedMatch)}
                      disabled={isActionLoading}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Párosítás elutasítása
                    </Button>
                    <Button 
                      className="bg-success hover:bg-success/90 text-success-foreground"
                      onClick={() => handleAcceptMatch(selectedMatch)}
                      disabled={isActionLoading}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Elfogadás (manuális match)
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border border-border/50 bg-card shadow-sm h-[calc(100vh-220px)] flex flex-col justify-center items-center text-center p-10">
                <HelpCircle className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-bold">Válassz ki egy eszkalált tételt</h3>
                <p className="text-muted-foreground text-sm max-w-sm mt-1">
                  A bal oldali listából válaszd ki a felülvizsgálandó számlát a részletes adatok megtekintéséhez és a feloldáshoz.
                </p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
