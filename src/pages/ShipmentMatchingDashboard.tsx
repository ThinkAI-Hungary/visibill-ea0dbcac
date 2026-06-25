import { useState, useMemo, Fragment } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import InvoiceImageDialog from '@/components/InvoiceImageDialog';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Truck, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Search, 
  ChevronRight, 
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  FileText,
  User,
  Banknote,
  Calendar,
  PieChart,
  TrendingUp,
  Inbox,
  Link,
  ExternalLink,
  Upload,
  Unlink,
} from 'lucide-react';
import { format, getDaysInMonth, startOfMonth, addDays } from 'date-fns';
import { hu } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import { ResponsiveContainer, PieChart as ReChartsPie, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useScopedBasePath } from '@/lib/navigation';
import { useDateRange } from '@/contexts/DateRangeContext';
import { useTheme } from '@/contexts/ThemeContext';

interface ShipmentMatchDetail {
  id: string;
  confidence_score: number;
  status: string;
  discrepancies: string[];
  invoice: {
    id: string;
    bizonylatsorszam: string;
    elado_nev: string;
    brutto_vegosszeg: number;
    penznem: string;
    kibocsatas_datuma: string;
    teljesites_datuma: string | null;
    position_numbers: string[] | null;
  } | null;
}

interface DashboardShipment {
  id: string;
  position_number: string;
  carrier_name: string | null;
  pickup_date: string | null;
  delivery_date: string | null;
  calculated_amount_huf: number | null;
  calculated_amount_eur: number | null;
  match_status: string;
  created_at: string;
  shipment_matches: ShipmentMatchDetail[];
  transport_documents: {
    id: string;
    file_name: string;
    file_size: number;
    document_type: string;
    created_at: string;
    file_path: string;
  }[];
}

export default function ShipmentMatchingDashboard() {
  const { selectedCompany } = useCompany();
  const navigate = useNavigate();
  const basePath = useScopedBasePath();
  const { dateFrom } = useDateRange();
  const { theme } = useTheme();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── Chart colors ──
  // Explicit vibrant HSL values per theme — CSS var tokens are too muted for Recharts SVG.
  // Colors are chosen for maximum perceptual distinctness in both light and dark mode.
  const chartColors = useMemo(() => {
    const isDark = theme === 'dark';
    return {
      // Párosított: design primary teal
      primary:     isDark ? 'hsl(170 82% 52%)' : 'hsl(174 80% 34%)',
      // Felülvizsgálat: vivid amber (clearly different from teal)
      warning:     isDark ? 'hsl(36 95% 58%)'  : 'hsl(36 92% 42%)',
      // Eszkalált: coral-red (high contrast against amber and teal)
      destructive: isDark ? 'hsl(4 88% 65%)'   : 'hsl(4 74% 52%)',
      // Függőben: cool slate-indigo (not gray → readable in both modes)
      muted:       isDark ? 'hsl(220 30% 52%)' : 'hsl(220 20% 64%)',
      // Tooltip
      tooltipBg:   isDark ? '#1e293b' : '#ffffff',
      tooltipText: isDark ? '#e2e8f0' : '#1e293b',
      border:      isDark ? 'hsl(225 9% 20%)' : 'hsl(222 10% 88%)',
    };
  }, [theme]);

  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'matched' | 'review' | 'pending' | 'escalated'>('all');
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  // Invoice image dialog state
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [invoiceDialogData, setInvoiceDialogData] = useState<{
    id: string; elado_nev: string; vevo_nev: string;
    bizonylatsorszam?: string; image_url?: string; melleklet_url?: string;
  } | null>(null);
  const [invoiceDialogLoading, setInvoiceDialogLoading] = useState<string | null>(null);

  /** Open dialog immediately with placeholder, then fetch URLs in background */
  const openInvoiceDialog = async (invoiceId: string, bizonylat?: string, eladoNev?: string) => {
    if (invoiceDialogLoading) return;
    // Open the modal right away — spinner will show inside
    setInvoiceDialogData({
      id: invoiceId,
      elado_nev: eladoNev || '',
      vevo_nev: '',
      bizonylatsorszam: bizonylat,
    });
    setInvoiceDialogOpen(true);
    setInvoiceDialogLoading(invoiceId);
    try {
      const { data } = await supabase
        .from('invoices')
        .select('id, elado_nev, vevo_nev, bizonylatsorszam, image_url, melleklet_url')
        .eq('id', invoiceId)
        .maybeSingle();
      if (data) setInvoiceDialogData(data);
    } finally {
      setInvoiceDialogLoading(null);
    }
  };

  // ── Detach state ──
  const [invoiceDetachTarget, setInvoiceDetachTarget] = useState<{
    matchId: string; shipmentId: string; invoiceId: string; bizonylat: string;
  } | null>(null);
  const [docDetachTarget, setDocDetachTarget] = useState<{
    docId: string; shipmentId: string; fileName: string; uploadId?: string;
  } | null>(null);
  const [isDetachingInvoice, setIsDetachingInvoice] = useState(false);
  const [isDetachingDoc, setIsDetachingDoc] = useState(false);

  // Detach invoice from shipment → send back to escalation
  const handleDetachInvoice = async () => {
    if (!invoiceDetachTarget || !selectedCompany?.id) return;
    setIsDetachingInvoice(true);
    try {
      const { matchId, shipmentId, invoiceId } = invoiceDetachTarget;
      // 1. Update match status → pending_shipment (keep the record so escalation list can find it)
      //    Also clear shipment_id so the match is no longer tied to this shipment
      await supabase.from('shipment_matches' as any)
        .update({ status: 'pending_shipment', shipment_id: null, confidence_score: 0 })
        .eq('id', matchId);
      // 2. Reset shipment status
      await supabase.from('shipments' as any)
        .update({ match_status: 'unmatched', matched_invoice_id: null })
        .eq('id', shipmentId);
      // 3. Reset invoice status → pending_shipment (escalation queue)
      await supabase.from('invoices')
        .update({ shipment_match_status: 'pending_shipment' })
        .eq('id', invoiceId);
      // 4. Detach any transport_docs linked to this invoice (CMR goes back to escalated)
      await supabase.from('transport_documents')
        .update({ linked_invoice_id: null, status: 'orphaned' } as any)
        .eq('linked_invoice_id', invoiceId);
      toast({ title: 'Számla leválasztva', description: `${invoiceDetachTarget.bizonylat} visszakerül az eszkalációs sorba.` });
      setInvoiceDetachTarget(null);
      queryClient.invalidateQueries({ queryKey: ['shipments-matching', selectedCompany.id] });
      queryClient.invalidateQueries({ queryKey: ['escalated-matches', selectedCompany.id] });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Leválasztás sikertelen', description: err.message });
    } finally {
      setIsDetachingInvoice(false);
    }
  };

  // Detach a transport document from shipment → send back to escalation
  const handleDetachDoc = async () => {
    if (!docDetachTarget || !selectedCompany?.id) return;
    setIsDetachingDoc(true);
    try {
      const { docId, shipmentId, uploadId } = docDetachTarget;
      // 1. Unlink transport_document from shipment
      await supabase.from('transport_documents')
        .update({ linked_shipment_id: null, linked_invoice_id: null, status: 'orphaned' } as any)
        .eq('id', docId);
      // 2. If there's a corresponding invoice_upload, set it back to cmr_escalated (with manual_detach flag)
      if (uploadId) {
        const { data: uRow } = await supabase.from('invoice_uploads').select('metadata').eq('id', uploadId).single();
        const mergedMeta = { ...((uRow as any)?.metadata ?? {}), manual_detach: true };
        await supabase.from('invoice_uploads')
          .update({ processing_status: 'cmr_escalated', metadata: mergedMeta } as any)
          .eq('id', uploadId);
      } else {
        // Fallback: find invoice_uploads linked via metadata->cmr_result->cmr_id, then merge manual_detach flag
        const { data: matchedUploads } = await (supabase as any)
          .from('invoice_uploads')
          .select('id, metadata')
          .eq('company_id', selectedCompany.id)
          .filter('metadata->cmr_result->>cmr_id', 'eq', docId);
        for (const u of (matchedUploads ?? []) as { id: string; metadata: Record<string, unknown> | null }[]) {
          const mergedMeta = { ...(u.metadata ?? {}), manual_detach: true };
          await supabase.from('invoice_uploads')
            .update({ processing_status: 'cmr_escalated', metadata: mergedMeta } as any)
            .eq('id', u.id);
        }
      }
      toast({ title: 'Dokumentum leválasztva', description: `${docDetachTarget.fileName} visszakerül az eszkalált dokumentumok közé.` });
      setDocDetachTarget(null);
      queryClient.invalidateQueries({ queryKey: ['shipments-matching', selectedCompany.id] });
      queryClient.invalidateQueries({ queryKey: ['escalated-uploads', selectedCompany.id] });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Leválasztás sikertelen', description: err.message });
    } finally {
      setIsDetachingDoc(false);
    }
  };

  // Fetch Shipments with joined Matches and CMRs
  const { data: shipments = [], isLoading } = useQuery<DashboardShipment[]>({
    queryKey: ['shipments-matching', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase
        .from('shipments' as any)
        .select(`
          *,
          shipment_matches(
            id,
            confidence_score,
            status,
            discrepancies,
            invoice:invoices(
              id,
              bizonylatsorszam,
              elado_nev,
              brutto_vegosszeg,
              penznem,
              kibocsatas_datuma,
              teljesites_datuma,
              position_numbers
            )
          ),
          transport_documents(*)
        `)
        .eq('company_id', selectedCompany.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCompany?.id,
    staleTime: 0,                 // Always refetch on invalidation or mount
    refetchOnWindowFocus: true,   // Refetch when user switches back to tab (no continuous polling)
  });

  // Calculate Statistics
  const stats = useMemo(() => {
    const total = shipments.length;
    const matched = shipments.filter(s => s.match_status === 'matched').length;
    const review = shipments.filter(s => s.match_status === 'review').length;
    const escalated = shipments.filter(s => s.match_status === 'escalated').length;
    const pending = total - matched - review - escalated;
    
    const autoMatchRate = total > 0 ? Math.round((matched / total) * 100) : 0;
    
    return { total, matched, review, escalated, pending, autoMatchRate };
  }, [shipments]);

  // Donut chart data
  const pieData = useMemo(() => {
    return [
      { name: 'Párosított',    value: stats.matched,   color: chartColors.primary },
      { name: 'Felülvizsgálat', value: stats.review,    color: chartColors.warning },
      { name: 'Eszkalált',     value: stats.escalated, color: chartColors.destructive },
      { name: 'Függőben',     value: stats.pending,   color: chartColors.muted },
    ].filter(d => d.value > 0);
  }, [stats, chartColors]);


  // Havi matching trend — az aktuális hónap minden napját megjeleníti
  const trendData = useMemo(() => {
    // The reference month: first day of dateFrom (or current month as fallback)
    const refDate = dateFrom ? new Date(dateFrom) : new Date();
    const monthStart = startOfMonth(refDate);
    const daysInMonth = getDaysInMonth(refDate);

    // Build day buckets for every day of the month
    const buckets: Record<string, { date: string; 'Párosított': number; 'Felülvizsgálat': number; 'Függőben': number }> = {};
    for (let d = 0; d < daysInMonth; d++) {
      const day = addDays(monthStart, d);
      const key = format(day, 'yyyy-MM-dd');
      const label = format(day, 'dd.', { locale: hu });
      buckets[key] = { date: label, 'Párosított': 0, 'Felülvizsgálat': 0, 'Függőben': 0 };
    }

    // Aggregate shipments into buckets by created_at date
    for (const s of shipments) {
      const dayKey = format(new Date(s.created_at), 'yyyy-MM-dd');
      if (!buckets[dayKey]) continue; // outside the month window
      if (s.match_status === 'matched') {
        buckets[dayKey]['Párosított']++;
      } else if (s.match_status === 'review' || s.match_status === 'escalated') {
        buckets[dayKey]['Felülvizsgálat']++;
      } else {
        buckets[dayKey]['Függőben']++;
      }
    }

    return Object.values(buckets);
  }, [shipments, dateFrom]);

  // Trend chart month label for the header
  const trendMonthLabel = useMemo(() => {
    const refDate = dateFrom ? new Date(dateFrom) : new Date();
    return format(refDate, 'yyyy. MMMM', { locale: hu });
  }, [dateFrom]);


  // Filtered shipments
  const filteredShipments = useMemo(() => {
    return shipments.filter(s => {
      const matchesSearch = 
        s.position_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.carrier_name && s.carrier_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        s.shipment_matches.some(m => m.invoice?.bizonylatsorszam.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = 
        statusFilter === 'all' ||
        (statusFilter === 'matched' && s.match_status === 'matched') ||
        (statusFilter === 'review' && s.match_status === 'review') ||
        (statusFilter === 'escalated' && s.match_status === 'escalated') ||
        (statusFilter === 'pending' && s.match_status === 'unmatched');

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

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'matched':
        return <Badge className="bg-success/10 text-success border-success/20 font-semibold">✓ Párosított</Badge>;
      case 'review':
        return <Badge className="bg-warning/10 text-warning border-warning/20 font-semibold">⚠ Felülvizsgálat</Badge>;
      case 'escalated':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20 font-semibold">✕ Eszkaláció</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground border-border font-semibold bg-muted/5">○ Várakozó</Badge>;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 page-animate">
      {isLoading ? (
        /* ── Loading Skeleton ── */
        <div className="space-y-6">
          {/* Header skeleton */}
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-9 w-36" />
              <Skeleton className="h-4 w-72" />
            </div>
            <Skeleton className="h-9 w-32" />
          </div>

          {/* Stats cards skeleton */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="border border-border/50 shadow-sm">
                <CardContent className="p-6">
                  <Skeleton className="h-4 w-24 mb-4" />
                  <Skeleton className="h-9 w-16 mb-2" />
                  <Skeleton className="h-3 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Chart + filter skeleton */}
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="border border-border/50 shadow-sm">
              <CardContent className="p-6 flex items-center justify-center">
                <Skeleton className="h-40 w-40 rounded-full" />
              </CardContent>
            </Card>
            <Card className="lg:col-span-2 border border-border/50 shadow-sm">
              <CardContent className="p-6 space-y-3">
                <Skeleton className="h-9 w-full" />
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-8" />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Table skeleton */}
          <Card className="border border-border/50 shadow-sm">
            <CardContent className="p-0">
              <div className="divide-y divide-border/50">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-6 py-4">
                    <Skeleton className="h-4 w-4 shrink-0" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-32 flex-1" />
                    <Skeleton className="h-6 w-24 rounded-full" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-4 shrink-0" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Fuvarok</h1>
            <p className="text-muted-foreground font-medium text-sm">Selexped import — fuvar-számla párosítás áttekintése</p>
          </div>
          <Button variant="outline" onClick={() => navigate(`${basePath}/shipments/import`)}>
            <Upload className="h-4 w-4 mr-2" />
            Excel Import
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border border-border/50 shadow-sm bg-card hover:border-primary/20 transition-all duration-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Truck className="h-4 w-4 text-primary" />
                  Fuvarok
                </p>
              </div>
              <div className="text-3xl font-bold text-foreground mt-2">{stats.total}</div>
              <p className="text-xs text-muted-foreground mt-2 font-medium">Selexped-ből betöltve</p>
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
              <p className="text-xs text-success mt-2 font-semibold">↑ {stats.autoMatchRate}% arány</p>
            </CardContent>
          </Card>

          <Card className="border border-border/50 shadow-sm bg-card hover:border-warning/20 transition-all duration-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Felülvizsgálat / Eszkalált
                </p>
              </div>
              <div className="text-3xl font-bold text-warning mt-2">{stats.review + stats.escalated}</div>
              <p className="text-xs text-muted-foreground mt-2 font-medium">Emberi ellenőrzés szükséges</p>
            </CardContent>
          </Card>

          <Card className="border border-border/50 shadow-sm bg-card hover:border-info/20 transition-all duration-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-info" />
                  Várakozó
                </p>
              </div>
              <div className="text-3xl font-bold text-muted-foreground mt-2">{stats.pending}</div>
              <p className="text-xs text-muted-foreground mt-2 font-medium">Számla még nem érkezett</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Donut Chart */}
          <Card className="border border-border/50 bg-card shadow-sm col-span-1">
            <CardHeader className="p-5 border-b border-border/40">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <PieChart className="h-4 w-4 text-primary" />
                Matching megoszlás
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 flex flex-col items-center justify-center min-h-[220px]">
              {stats.total > 0 ? (
                <div className="w-full flex items-center gap-4">
                  <div className="w-32 h-32 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <ReChartsPie>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={36}
                          outerRadius={50}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </ReChartsPie>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-2 text-xs font-semibold">
                    {pieData.map((entry, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: entry.color }} />
                        <span className="text-muted-foreground">{entry.name}:</span>
                        <span className="text-foreground">{entry.value} db</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground italic">Nincs adat diagramhoz</div>
              )}
            </CardContent>
          </Card>

          {/* Bar Chart */}
          <Card className="border border-border/50 bg-card shadow-sm md:col-span-2">
            <CardHeader className="p-5 border-b border-border/40">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Napi matching trend &mdash; {trendMonthLabel}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 min-h-[220px]">
              {stats.total > 0 ? (
                <div className="w-full h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendData} barCategoryGap="35%" barGap={1} maxBarSize={12}>
                      <XAxis
                        dataKey="date"
                        stroke="transparent"
                        tick={{ fill: chartColors.muted, fontSize: 9, fontWeight: 500 }}
                        tickLine={false}
                        axisLine={false}
                        interval={2}
                      />
                      <YAxis
                        stroke="transparent"
                        tick={{ fill: chartColors.muted, fontSize: 10, fontWeight: 500 }}
                        tickLine={false}
                        axisLine={false}
                        width={22}
                        allowDecimals={false}
                      />
                      <Tooltip
                        cursor={{ fill: chartColors.muted, opacity: 0.08, rx: 4 }}
                        contentStyle={{
                          background: chartColors.tooltipBg,
                          border: `1px solid ${chartColors.border}`,
                          borderRadius: '6px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                          color: chartColors.tooltipText,
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '8px 12px',
                        }}
                        labelStyle={{ color: chartColors.tooltipText, marginBottom: 4, fontWeight: 700 }}
                        itemStyle={{ color: chartColors.tooltipText, fontSize: 11 }}
                      />
                      <Legend
                        iconType="square"
                        iconSize={8}
                        wrapperStyle={{ fontSize: '10px', fontWeight: 600, paddingTop: '8px', color: chartColors.muted }}
                      />
                      <Bar dataKey="Párosított"    stackId="a" fill={chartColors.primary}     radius={[0, 0, 0, 0]} />
                      <Bar dataKey="Felülvizsgálat" stackId="a" fill={chartColors.warning}     radius={[0, 0, 0, 0]} />
                      <Bar dataKey="Függőben"      stackId="a" fill={chartColors.muted}       radius={[3, 3, 0, 0]} opacity={0.45} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground italic flex items-center justify-center h-44">Nincs adat trend diagramhoz</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Table Section */}
        <Card className="border border-border/50 bg-card shadow-sm">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center p-4 border-b border-border/40 bg-muted/10">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Keresés pozíciószám, fuvaros, számlaszám..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
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
                ✓ Párosított
              </Button>
              <Button 
                variant={statusFilter === 'review' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setStatusFilter('review')}
              >
                ⚠ Felülvizsgálat
              </Button>
              <Button 
                variant={statusFilter === 'escalated' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setStatusFilter('escalated')}
              >
                ✕ Eszkalált
              </Button>
              <Button 
                variant={statusFilter === 'pending' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setStatusFilter('pending')}
              >
                ○ Várakozó
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm compact-table table-fixed">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-xs">
                  <th className="h-10 px-4 text-left font-semibold text-muted-foreground w-8"></th>
                  <th className="h-10 px-4 text-left font-semibold text-muted-foreground">Pozíciószám</th>
                  <th className="h-10 px-4 text-left font-semibold text-muted-foreground">Fuvaros</th>
                  <th className="h-10 px-4 text-left font-semibold text-muted-foreground">Felrakás</th>
                  <th className="h-10 px-4 text-left font-semibold text-muted-foreground">Lerakás</th>
                  <th className="h-10 px-4 text-right font-semibold text-muted-foreground">Kalk. összeg</th>
                  <th className="h-10 px-4 text-left font-semibold text-muted-foreground">Konfidencia</th>
                  <th className="h-10 px-4 text-left font-semibold text-muted-foreground">Státusz</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: PAGE_SIZE }).map((_, idx) => (
                    <tr key={idx} className="border-b border-border/30">
                      <td></td>
                      <td className="p-4"><Skeleton className="h-4 w-28" /></td>
                      <td className="p-4"><Skeleton className="h-4 w-36" /></td>
                      <td className="p-4"><Skeleton className="h-4 w-24" /></td>
                      <td className="p-4"><Skeleton className="h-4 w-24" /></td>
                      <td className="p-4"><Skeleton className="h-4 w-20 ml-auto" /></td>
                      <td className="p-4"><Skeleton className="h-4 w-24" /></td>
                      <td className="p-4"><Skeleton className="h-5 w-24" /></td>
                    </tr>
                  ))
                ) : filteredShipments.length === 0 ? (
                  <>
                    <tr>
                      <td colSpan={8} className="h-24 text-center text-muted-foreground font-medium">
                        Nem található párosítás.
                      </td>
                    </tr>
                    {Array.from({ length: PAGE_SIZE - 1 }).map((_, idx) => (
                      <tr key={`empty-${idx}`} className="border-b border-border/10">
                        <td className="px-4 py-3" colSpan={8}>&nbsp;</td>
                      </tr>
                    ))}
                  </>
                ) : (
                  <>
                  {pagedShipments.map((s) => {
                    const isExpanded = !!expandedRows[s.id];
                    const activeMatch = s.shipment_matches?.[0] || null;
                    const amountStr = s.calculated_amount_eur !== null 
                      ? formatCurrency(s.calculated_amount_eur, 'EUR')
                      : s.calculated_amount_huf !== null
                        ? formatCurrency(s.calculated_amount_huf, 'HUF')
                        : '—';

                  return (
                    <Fragment key={s.id}>
                      <tr
                        className={`border-b border-border/30 hover:bg-muted/30 cursor-pointer transition-colors duration-150 ${
                          isExpanded ? 'bg-muted/10' : ''
                        }`}
                        onClick={() => toggleRow(s.id)}
                      >
                        <td className="px-4 py-3 text-center">
                          {activeMatch && (
                            isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono font-semibold text-primary">{s.position_number}</td>
                        <td className="px-4 py-3 font-medium">{s.carrier_name || '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {s.pickup_date ? format(new Date(s.pickup_date), 'yyyy. MM. dd.') : '—'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {s.delivery_date ? format(new Date(s.delivery_date), 'yyyy. MM. dd.') : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs">{amountStr}</td>
                        <td className="px-4 py-3">
                          {activeMatch ? (
                            <div className="flex items-center gap-2 w-28">
                              <Progress
                                value={activeMatch.confidence_score}
                                className={`h-1.5 w-16 ${
                                  activeMatch.confidence_score >= 90 ? '[&>div]:bg-success' : activeMatch.confidence_score >= 70 ? '[&>div]:bg-warning' : '[&>div]:bg-destructive'
                                }`}
                              />
                              <span className={`text-xs font-bold ${
                                activeMatch.confidence_score >= 90 ? 'text-success' : activeMatch.confidence_score >= 70 ? 'text-warning' : 'text-destructive'
                              }`}>
                                {activeMatch.confidence_score}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">{getStatusBadge(s.match_status)}</td>
                      </tr>

                        {/* Expanded details row */}
                        {isExpanded && activeMatch && (
                          <tr className="bg-muted/5 border-b border-border/30">
                            <td colSpan={8} className="p-0 overflow-hidden">
                              <div className="px-12 py-4 space-y-4 max-w-full overflow-hidden">
                                {/* Linked Invoice card */}
                                <div className="space-y-1.5">
                                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                    <FileText className="h-3 w-3 text-info" />
                                    Párosított Számla
                                  </span>
                                  {activeMatch.invoice ? (
                                    <div className="border border-border/50 rounded-lg bg-card shadow-sm overflow-hidden">
                                      {/* Invoice detail grid */}
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 p-4 text-xs">
                                        <div>
                                          <span className="text-muted-foreground font-semibold">Bizonylatsorszám</span>
                                          <p className="font-bold text-foreground mt-0.5">{activeMatch.invoice.bizonylatsorszam}</p>
                                        </div>
                                        <div>
                                          <span className="text-muted-foreground font-semibold">Pozíciószám</span>
                                          <p className="font-mono font-bold text-primary mt-0.5">
                                            {activeMatch.invoice.position_numbers?.length
                                              ? activeMatch.invoice.position_numbers.join(', ')
                                              : '—'}
                                          </p>
                                        </div>
                                        <div>
                                          <span className="text-muted-foreground font-semibold">Partner / Szállító</span>
                                          <p className="font-bold text-foreground mt-0.5 truncate" title={activeMatch.invoice.elado_nev}>{activeMatch.invoice.elado_nev}</p>
                                        </div>
                                        <div>
                                          <span className="text-muted-foreground font-semibold">Számla összege</span>
                                          <p className="font-mono font-bold text-foreground mt-0.5">
                                            {formatCurrency(activeMatch.invoice.brutto_vegosszeg, activeMatch.invoice.penznem)}
                                          </p>
                                        </div>
                                        <div>
                                          <span className="text-muted-foreground font-semibold">Kibocsátás dátuma</span>
                                          <p className="font-bold text-foreground mt-0.5">
                                            {activeMatch.invoice.kibocsatas_datuma ? format(new Date(activeMatch.invoice.kibocsatas_datuma), 'yyyy. MM. dd.') : '—'}
                                          </p>
                                        </div>
                                        <div>
                                          <span className="text-muted-foreground font-semibold">Teljesítés dátuma</span>
                                          <p className="font-bold text-foreground mt-0.5">
                                            {activeMatch.invoice.teljesites_datuma ? format(new Date(activeMatch.invoice.teljesites_datuma), 'yyyy. MM. dd.') : '—'}
                                          </p>
                                        </div>
                                      </div>
                                      {/* Discrepancies */}
                                      {activeMatch.discrepancies?.length > 0 && (
                                        <div className="mx-4 mb-3 text-xs text-warning bg-warning/5 border border-warning/10 p-2 rounded flex items-start gap-1.5">
                                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                          <span className="break-words whitespace-normal min-w-0">Figyelmeztetések: {activeMatch.discrepancies.join('; ')}</span>
                                        </div>
                                      )}
                                      {/* Action bar */}
                                      <div className="flex justify-between items-center px-4 pb-3">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs h-7 px-2"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (activeMatch.invoice?.id) {
                                              setInvoiceDetachTarget({
                                                matchId: activeMatch.id,
                                                shipmentId: s.id,
                                                invoiceId: activeMatch.invoice.id,
                                                bizonylat: activeMatch.invoice.bizonylatsorszam,
                                              });
                                            }
                                          }}
                                        >
                                          <Unlink className="h-3 w-3 mr-1" /> Számla leválasztása
                                        </Button>
                                        <Button 
                                          variant="ghost" 
                                          size="sm"
                                          disabled={!!invoiceDialogLoading}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (activeMatch.invoice?.id) {
                                              openInvoiceDialog(
                                                activeMatch.invoice.id,
                                                activeMatch.invoice.bizonylatsorszam,
                                                activeMatch.invoice.elado_nev,
                                              );
                                            }
                                          }}
                                        >
                                          <span className="flex items-center gap-1.5">
                                            Számla megtekintése
                                            <FileText className="h-3 w-3" />
                                          </span>
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-xs text-muted-foreground italic p-2 border border-dashed rounded">
                                      Számla adatai nem elérhetők.
                                    </div>
                                  )}
                                </div>

                                {/* Transport documents */}
                                <div className="space-y-1.5">
                                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                    <Truck className="h-3.5 w-3.5 text-primary" />
                                    Dokumentumok ({s.transport_documents.length} db)
                                  </span>
                                  {s.transport_documents.length > 0 ? (
                                    <div className="grid gap-2 sm:grid-cols-2">
                                      {s.transport_documents.map(doc => (
                                        <div key={doc.id} className="flex items-center justify-between border border-border/50 rounded-lg p-2.5 bg-card hover:border-primary/20 transition-colors">
                                          <div>
                                            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                                doc.document_type === 'cmr' ? 'bg-blue-500/15 text-blue-400' :
                                                doc.document_type === 'nalog' ? 'bg-amber-500/15 text-amber-400' :
                                                doc.document_type === 'pod' ? 'bg-green-500/15 text-green-400' :
                                                'bg-gray-500/15 text-gray-400'
                                              }`}>
                                                {doc.document_type === 'cmr' ? 'CMR' :
                                                 doc.document_type === 'nalog' ? 'Megrendelés' :
                                                 doc.document_type === 'pod' ? 'POD' :
                                                 doc.document_type?.toUpperCase() || 'DOK'}
                                              </span>
                                              {doc.file_name}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground mt-0.5">
                                              {doc.file_size > 0 && <>Méret: {(doc.file_size / 1024).toFixed(0)} KB | </>}Feltöltve: {format(new Date(doc.created_at), 'yyyy. MM. dd.')}
                                            </p>
                                          </div>
                                          <div className="flex items-center gap-1 shrink-0">
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-7 px-2 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10"
                                              title="Dokumentum leválasztása"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setDocDetachTarget({ docId: doc.id, shipmentId: s.id, fileName: doc.file_name });
                                              }}
                                            >
                                              <Unlink className="h-3 w-3 mr-1" /> Leválaszt
                                            </Button>
                                            <Button 
                                              variant="ghost" 
                                              size="icon" 
                                              className="h-7 w-7" 
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                window.open(doc.file_path, '_blank');
                                              }}
                                            >
                                              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                                            </Button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-xs text-muted-foreground italic p-2 border border-dashed rounded flex items-center gap-1">
                                      <Inbox className="h-3.5 w-3.5" />
                                      Ehhez a fuvarhoz nincs csatolt dokumentum.
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                    </Fragment>
                  );
                })}
                  {/* Fill empty rows on last page to prevent layout shift */}
                  {emptyRowCount > 0 && Array.from({ length: emptyRowCount }).map((_, idx) => (
                    <tr key={`empty-${idx}`} className="border-b border-border/10">
                      <td className="px-4 py-3" colSpan={8}>&nbsp;</td>
                    </tr>
                  ))}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </Card>

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
              <span className="px-3 text-sm font-semibold tabular-nums">
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
      </div>
      )}

      {/* Invoice image popup — shared with InvoicesPage */}
      <InvoiceImageDialog
        invoice={invoiceDialogData}
        open={invoiceDialogOpen}
        isLoading={!!invoiceDialogLoading}
        onClose={() => {
          setInvoiceDialogOpen(false);
          setInvoiceDialogData(null);
          setInvoiceDialogLoading(null);
        }}
      />

      {/* Invoice leválasztás AlertDialog */}
      <AlertDialog open={!!invoiceDetachTarget} onOpenChange={(open) => { if (!open) setInvoiceDetachTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Számla leválasztása a fuvarról</AlertDialogTitle>
            <AlertDialogDescription>
              Biztosan leválasztod a <strong>{invoiceDetachTarget?.bizonylat}</strong> számlát erről a fuvarról?
              A számla visszakerül az eszkalációs sorba (várakozó futarriport állapotba). A csatolt CMR dokumentum is leválasztódik.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDetachingInvoice}>Mégse</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleDetachInvoice}
              disabled={isDetachingInvoice}
            >
              {isDetachingInvoice ? <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin mr-1.5" /> : null}
              Leválaszt
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dokumentum leválasztás AlertDialog */}
      <AlertDialog open={!!docDetachTarget} onOpenChange={(open) => { if (!open) setDocDetachTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dokumentum leválasztása</AlertDialogTitle>
            <AlertDialogDescription>
              Biztosan leválasztod a <strong>{docDetachTarget?.fileName}</strong> dokumentumot erről a fuvarról?
              A dokumentum visszakerül az eszkalált dokumentumok közé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDetachingDoc}>Mégse</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleDetachDoc}
              disabled={isDetachingDoc}
            >
              {isDetachingDoc ? <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin mr-1.5" /> : null}
              Leválaszt
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
