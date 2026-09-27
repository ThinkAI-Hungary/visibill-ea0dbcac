import { useState, useMemo, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { useCompany } from '@/contexts/CompanyContext';
import { useDateRange } from '@/contexts/DateRangeContext';
import { useRelatedPartyTurnover } from '@/hooks/useRelatedPartyTurnover';
import {
  RELATION_TYPE_LABELS,
  RELATION_TYPE_COLORS,
  type RelationType,
  type RelatedPartyTurnoverItem,
  type RelatedPartyInvoiceItem,
} from '@/types/related-parties';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { TableEmptyState } from '@/components/ui/table-empty-state';
import { cn, formatCurrency } from '@/lib/utils';
import { decodeHtmlEntities, getAvatarColor, getInitials } from '@/lib/helpers';
import {
  Building2,
  TrendingUp,
  TrendingDown,
  Scale,
  Banknote,
  AlertTriangle,
  FileSpreadsheet,
  Search,
  ChevronDown,
  ChevronRight,
  Info,
  ShieldAlert,
  CheckCircle2,
  Pencil,
  Coins,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
import { format } from 'date-fns';
import { getDateFnsLocale, formatDateLocale } from '@/lib/locale/formatters';

interface RelatedPartyTurnoverTabProps {
  onEditPartner?: (partnerId: string) => void;
  onSelectPartner?: (partnerId: string) => void;
}

export function RelatedPartyTurnoverTab({
  onEditPartner,
  onSelectPartner,
}: RelatedPartyTurnoverTabProps) {
  const { t } = useTranslation(['partners', 'common']);
  const { selectedCompany } = useCompany();
  const { dateFrom, dateTo, dateFromFormatted, dateToFormatted } = useDateRange();

  const [searchQuery, setSearchQuery] = useState('');
  const [relationFilter, setRelationFilter] = useState<string>('all');
  const [expandedPartnerIds, setExpandedPartnerIds] = useState<Set<string>>(new Set());

  // Period label for export & cards
  const periodLabel = useMemo(() => {
    if (!dateFrom || !dateTo) return '';
    return `${format(dateFrom, 'yyyy. MMM dd.', { locale: getDateFnsLocale() })} – ${format(dateTo, 'yyyy. MMM dd.', { locale: getDateFnsLocale() })}`;
  }, [dateFrom, dateTo]);

  // Hook fetching aggregated turnover
  const { data, isLoading } = useRelatedPartyTurnover({
    companyId: selectedCompany?.id,
    dateFrom: dateFromFormatted,
    dateTo: dateToFormatted,
  });

  const items = data?.items || [];
  const totals = data?.totals;

  // Toggle invoice details expansion
  const toggleExpand = (partnerId: string) => {
    setExpandedPartnerIds((prev) => {
      const next = new Set(prev);
      if (next.has(partnerId)) {
        next.delete(partnerId);
      } else {
        next.add(partnerId);
      }
      return next;
    });
  };

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (relationFilter !== 'all' && item.relationType !== relationFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = item.partnerName.toLowerCase().includes(q);
        const matchTax = item.taxNumber.toLowerCase().includes(q);
        if (!matchName && !matchTax) return false;
      }
      return true;
    });
  }, [items, relationFilter, searchQuery]);

  // Export to CSV (with Excel-friendly BOM and semicolon separator)
  const handleExportCsv = () => {
    if (filteredItems.length === 0) return;

    const headers = [
      'Partner neve',
      'Adószám',
      'Kapcsolati típus',
      'Részesedés %',
      'Szülő partner',
      'Kiszámlázott db',
      'Kiszámlázott nettó (Ft)',
      'Kiszámlázott bruttó (Ft)',
      'Befogadott db',
      'Befogadott nettó (Ft)',
      'Befogadott bruttó (Ft)',
      'Összes bruttó forgalom (Ft)',
      'Nettó egyenleg (Ft)',
      'Havi KP forgalom (Ft)',
      'KP limit túllépve (Art. 114. §)',
      'TP kötelezett (Tao. 18. §)',
    ];

    const rows = filteredItems.map((item) => [
      `"${decodeHtmlEntities(item.partnerName).replace(/"/g, '""')}"`,
      `"${item.taxNumber}"`,
      `"${RELATION_TYPE_LABELS[item.relationType] || item.relationType}"`,
      item.ownershipPercent != null ? item.ownershipPercent : '',
      `"${(item.parentPartnerName || '').replace(/"/g, '""')}"`,
      item.outboundCount,
      Math.round(item.outboundNet),
      Math.round(item.outboundGross),
      item.inboundCount,
      Math.round(item.inboundNet),
      Math.round(item.inboundGross),
      Math.round(item.totalGrossTurnover),
      Math.round(item.netBalance),
      Math.round(item.monthlyCashGross),
      item.isCashLimitExceeded ? 'IGEN (1.5M túllépve)' : 'NEM',
      item.isTransferPricingDocRequired ? 'KÖTELEZŐ (>100M)' : 'NEM',
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kapcsolt_vallalkozasok_forgalom_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* ── KPI Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Outbound Sales */}
        <Card className="rounded-xl border-border/50 bg-card/60 backdrop-blur-sm relative overflow-hidden shadow-xs">
          <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500/80" />
          <CardContent className="p-3.5 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium flex items-center gap-1.5">
                <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
                Kiszámlázott árbevétel (912)
              </span>
              <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                Eladások
              </Badge>
            </div>
            <p className="text-xl font-bold font-mono tracking-tight text-foreground">
              {formatCurrency(totals?.totalOutboundGross || 0, 'HUF')}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Kapcsolt vállalkozások felé számlázva
            </p>
          </CardContent>
        </Card>

        {/* Inbound Purchases */}
        <Card className="rounded-xl border-border/50 bg-card/60 backdrop-blur-sm relative overflow-hidden shadow-xs">
          <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500/80" />
          <CardContent className="p-3.5 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium flex items-center gap-1.5">
                <ArrowDownLeft className="h-3.5 w-3.5 text-blue-500" />
                Befogadott számlák (4551)
              </span>
              <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-blue-500/10 text-blue-600 border-blue-500/20">
                Beszerzések
              </Badge>
            </div>
            <p className="text-xl font-bold font-mono tracking-tight text-foreground">
              {formatCurrency(totals?.totalInboundGross || 0, 'HUF')}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Kapcsolt partnerek felé fizetendő
            </p>
          </CardContent>
        </Card>

        {/* Net Balance */}
        <Card className="rounded-xl border-border/50 bg-card/60 backdrop-blur-sm relative overflow-hidden shadow-xs">
          <div
            className={cn(
              'absolute top-0 left-0 right-0 h-1',
              (totals?.totalNetBalance || 0) >= 0 ? 'bg-emerald-500/80' : 'bg-rose-500/80'
            )}
          />
          <CardContent className="p-3.5 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium flex items-center gap-1.5">
                <Scale className="h-3.5 w-3.5 text-primary" />
                Nettó egyenleg
              </span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground/60 cursor-pointer" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs max-w-xs">
                    Kiszámlázott bruttó mínusz befogadott bruttó. Pozitív: a kapcsolt partnerek tartoznak nekünk. Negatív: mi tartozunk nekik.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p
              className={cn(
                'text-xl font-bold font-mono tracking-tight',
                (totals?.totalNetBalance || 0) > 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : (totals?.totalNetBalance || 0) < 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-foreground'
              )}
            >
              {formatCurrency(totals?.totalNetBalance || 0, 'HUF')}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {(totals?.totalNetBalance || 0) >= 0 ? 'Követelés többlet' : 'Kötelezettség többlet'}
            </p>
          </CardContent>
        </Card>

        {/* Art. 114 Cash & TP monitoring */}
        <Card className="rounded-xl border-border/50 bg-card/60 backdrop-blur-sm relative overflow-hidden shadow-xs">
          <div
            className={cn(
              'absolute top-0 left-0 right-0 h-1',
              (totals?.cashExceededPartnerCount || 0) > 0 || (totals?.transferPricingRequiredCount || 0) > 0
                ? 'bg-amber-500'
                : 'bg-emerald-500/80'
            )}
          />
          <CardContent className="p-3.5 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium flex items-center gap-1.5">
                <Coins className="h-3.5 w-3.5 text-amber-500" />
                Törvényi figyelések
              </span>
              {(totals?.cashExceededPartnerCount || 0) > 0 ? (
                <Badge variant="destructive" className="text-[10px] h-4 px-1.5 animate-pulse">
                  Figyelmeztetés
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                  Rendben
                </Badge>
              )}
            </div>
            <div className="flex items-baseline justify-between pt-0.5">
              <div>
                <span className="text-xs font-semibold text-muted-foreground">1,5M KP limit: </span>
                <span className={cn('text-sm font-bold font-mono', (totals?.cashExceededPartnerCount || 0) > 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400')}>
                  {(totals?.cashExceededPartnerCount || 0) > 0 ? `${totals?.cashExceededPartnerCount} cég túllépte` : 'Betartva'}
                </span>
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-0.5">
              <span>Tao. 18. § (&gt;100M):</span>
              <span className="font-semibold text-foreground font-mono">
                {totals?.transferPricingRequiredCount || 0} partner
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Toolbar: Search, Filter & Export ── */}
      <Card className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Keresés név vagy adószám alapján..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs bg-background/50"
              />
            </div>

            {/* Relation filter */}
            <Select value={relationFilter} onValueChange={setRelationFilter}>
              <SelectTrigger className="h-8 text-xs w-[200px] bg-background/50">
                <SelectValue placeholder="Minden kapcsolati típus" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Minden kapcsolati típus</SelectItem>
                <SelectItem value="parent" className="text-xs">Anyavállalat</SelectItem>
                <SelectItem value="subsidiary" className="text-xs">Leányvállalat</SelectItem>
                <SelectItem value="sister" className="text-xs">Közös vezetésű / Testvér</SelectItem>
                <SelectItem value="owner_interest" className="text-xs">Tulajdonosi érdekeltség</SelectItem>
                <SelectItem value="other" className="text-xs">Egyéb</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={filteredItems.length === 0}
              className="h-8 text-xs gap-1.5"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              <span>CSV Export</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Main Turnover Table ── */}
      <Card className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="compact-table min-w-full">
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-muted/30">
                <TableHead className="w-8"></TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground min-w-[220px]">
                  Partner & Viszony
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right min-w-[130px]">
                  Kiszámlázott (912)
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right min-w-[130px]">
                  Befogadott (4551)
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right min-w-[130px]">
                  Összforgalom
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right min-w-[130px]">
                  Egyenleg
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center min-w-[120px]">
                  KP Forgalom (Havi)
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center min-w-[100px]">
                  TP Státusz
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right w-16">
                  Művelet
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <LoadingSpinner className="h-6 w-6 text-primary" />
                      <p className="text-xs text-muted-foreground">Forgalmi adatok számítása...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-12">
                    <TableEmptyState
                      title="Nincs kapcsolt vállalkozási forgalom"
                      description="Jelölj meg partnereket kapcsolt vállalkozásként a partnertörzsben, vagy módosítsd a szűrőket."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item) => {
                  const isExpanded = expandedPartnerIds.has(item.partnerId);
                  const colorConfig = RELATION_TYPE_COLORS[item.relationType] || RELATION_TYPE_COLORS.other;

                  return (
                    <Fragment key={item.partnerId}>
                      <TableRow
                        className={cn(
                          'cursor-pointer transition-colors border-b border-border/40',
                          isExpanded ? 'bg-muted/30' : 'hover:bg-muted/20'
                        )}
                        onClick={() => toggleExpand(item.partnerId)}
                      >
                        {/* Expand chevron */}
                        <TableCell className="py-2.5 px-2 text-center">
                          {item.invoices.length > 0 ? (
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-foreground transition-colors p-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(item.partnerId);
                              }}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                          ) : (
                            <span className="inline-block w-4" />
                          )}
                        </TableCell>

                        {/* Partner info */}
                        <TableCell className="py-2.5">
                          <div className="flex items-center gap-2.5">
                            <Avatar className="h-8 w-8 shrink-0">
                              <AvatarFallback className={`text-xs font-semibold ${getAvatarColor(item.partnerName)}`}>
                                {getInitials(item.partnerName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-xs text-foreground truncate max-w-[200px]" title={item.partnerName}>
                                  {decodeHtmlEntities(item.partnerName)}
                                </span>
                                <Badge
                                  variant="outline"
                                  className={cn('text-[9px] h-4 px-1.5 font-medium border', colorConfig.bg, colorConfig.text, colorConfig.border)}
                                >
                                  {RELATION_TYPE_LABELS[item.relationType] || item.relationType}
                                </Badge>
                                {item.ownershipPercent != null && (
                                  <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1 rounded">
                                    {item.ownershipPercent}%
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                                {item.taxNumber || 'Nincs adószám'}
                                {item.parentPartnerName && (
                                  <span className="text-[10px] text-muted-foreground ml-1.5">
                                    (Szülő: {decodeHtmlEntities(item.parentPartnerName)})
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                        </TableCell>

                        {/* Outbound (Kiszámlázott) */}
                        <TableCell className="py-2.5 text-right font-mono">
                          <p className="font-semibold text-xs text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(item.outboundGross, 'HUF')}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {item.outboundCount} db · Nettó: {formatCurrency(item.outboundNet, 'HUF')}
                          </p>
                        </TableCell>

                        {/* Inbound (Befogadott) */}
                        <TableCell className="py-2.5 text-right font-mono">
                          <p className="font-semibold text-xs text-blue-600 dark:text-blue-400">
                            {formatCurrency(item.inboundGross, 'HUF')}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {item.inboundCount} db · Nettó: {formatCurrency(item.inboundNet, 'HUF')}
                          </p>
                        </TableCell>

                        {/* Total gross turnover */}
                        <TableCell className="py-2.5 text-right font-mono">
                          <p className="font-bold text-xs text-foreground">
                            {formatCurrency(item.totalGrossTurnover, 'HUF')}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {item.invoices.length} tétel
                          </p>
                        </TableCell>

                        {/* Net balance */}
                        <TableCell className="py-2.5 text-right font-mono">
                          <p
                            className={cn(
                              'font-bold text-xs',
                              item.netBalance > 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : item.netBalance < 0
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-muted-foreground'
                            )}
                          >
                            {formatCurrency(item.netBalance, 'HUF')}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {item.netBalance > 0 ? 'Követelés' : item.netBalance < 0 ? 'Tartozás' : '0 Ft'}
                          </p>
                        </TableCell>

                        {/* Monthly cash limit */}
                        <TableCell className="py-2.5 text-center">
                          {item.monthlyCashGross > 0 ? (
                            <div className="inline-flex flex-col items-center">
                              <span className="font-mono text-xs font-semibold">
                                {formatCurrency(item.monthlyCashGross, 'HUF')}
                              </span>
                              {item.isCashLimitExceeded ? (
                                <Badge variant="destructive" className="text-[9px] h-4 px-1 gap-0.5 mt-0.5">
                                  <AlertTriangle className="h-2.5 w-2.5" />
                                  1,5M felett!
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[9px] h-4 px-1 text-emerald-600 bg-emerald-500/10 border-emerald-500/20 mt-0.5">
                                  Limit alatt
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Transfer pricing status */}
                        <TableCell className="py-2.5 text-center">
                          {item.isTransferPricingDocRequired ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge className="text-[9px] h-4 px-1.5 bg-amber-500/15 text-amber-600 border border-amber-500/30 hover:bg-amber-500/25">
                                    <ShieldAlert className="h-2.5 w-2.5 mr-0.5" />
                                    &gt;100M TP
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs max-w-xs">
                                  Az éves ügyleti érték meghaladja a 100 millió Ft-ot. Tao. tv. 18. § szerinti transzferár dokumentáció készítése szükséges!
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              Nem éri el
                            </span>
                          )}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="py-2.5 text-right px-2" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => onEditPartner?.(item.partnerId)}
                            title="Kapcsolt adatok szerkesztése"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>

                      {/* Expanded Invoices List */}
                      {isExpanded && (
                        <TableRow className="bg-muted/15 border-b border-border/40">
                          <TableCell colSpan={9} className="p-3 pl-10">
                            <div className="rounded-lg border border-border/50 bg-background/80 overflow-hidden shadow-2xs">
                              <div className="p-2.5 bg-muted/30 border-b border-border/40 flex items-center justify-between text-xs">
                                <span className="font-semibold text-foreground flex items-center gap-1.5">
                                  Számlák listája ({item.invoices.length} db bizonylat)
                                </span>
                                <span className="text-[11px] text-muted-foreground">
                                  {decodeHtmlEntities(item.partnerName)}
                                </span>
                              </div>

                              {item.invoices.length === 0 ? (
                                <div className="p-4 text-center text-xs text-muted-foreground">
                                  Nincsenek bizonylatok a kijelölt időszakban.
                                </div>
                              ) : (
                                <div className="max-h-[300px] overflow-y-auto">
                                  <Table className="compact-table">
                                    <TableHeader className="sticky top-0 bg-muted/40">
                                      <TableRow>
                                        <TableHead className="text-[10px] font-semibold text-muted-foreground">Irány</TableHead>
                                        <TableHead className="text-[10px] font-semibold text-muted-foreground">Számlaszám</TableHead>
                                        <TableHead className="text-[10px] font-semibold text-muted-foreground">Kelt</TableHead>
                                        <TableHead className="text-[10px] font-semibold text-muted-foreground">Teljesítés</TableHead>
                                        <TableHead className="text-[10px] font-semibold text-muted-foreground">Fizetési mód</TableHead>
                                        <TableHead className="text-[10px] font-semibold text-muted-foreground text-right">Nettó</TableHead>
                                        <TableHead className="text-[10px] font-semibold text-muted-foreground text-right">ÁFA</TableHead>
                                        <TableHead className="text-[10px] font-semibold text-muted-foreground text-right">Bruttó</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {item.invoices.map((inv) => {
                                        const isOutbound = inv.direction === 'outbound';
                                        return (
                                          <TableRow key={inv.id} className="hover:bg-muted/20 text-xs">
                                            <TableCell className="py-1.5">
                                              <Badge
                                                variant="outline"
                                                className={cn(
                                                  'text-[9px] h-4 px-1 font-semibold',
                                                  isOutbound
                                                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                                    : 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                                                )}
                                              >
                                                {isOutbound ? 'Kimenő (912)' : 'Bejövő (4551)'}
                                              </Badge>
                                            </TableCell>
                                            <TableCell className="py-1.5 font-mono font-medium">
                                              {inv.invoice_number}
                                            </TableCell>
                                            <TableCell className="py-1.5 text-muted-foreground">
                                              {inv.issue_date ? formatDateLocale(inv.issue_date, 'yyyy. MM. dd.') : '—'}
                                            </TableCell>
                                            <TableCell className="py-1.5 text-muted-foreground">
                                              {inv.delivery_date ? formatDateLocale(inv.delivery_date, 'yyyy. MM. dd.') : '—'}
                                            </TableCell>
                                            <TableCell className="py-1.5">
                                              <div className="flex items-center gap-1">
                                                <span>{inv.payment_method || 'Átutalás'}</span>
                                                {inv.is_cash && (
                                                  <Badge variant="outline" className="text-[9px] h-3.5 px-1 bg-amber-500/10 text-amber-600 border-amber-500/20 font-mono">
                                                    KP
                                                  </Badge>
                                                )}
                                              </div>
                                            </TableCell>
                                            <TableCell className="py-1.5 text-right font-mono text-muted-foreground">
                                              {formatCurrency(inv.net_amount, inv.currency)}
                                            </TableCell>
                                            <TableCell className="py-1.5 text-right font-mono text-muted-foreground">
                                              {formatCurrency(inv.vat_amount, inv.currency)}
                                            </TableCell>
                                            <TableCell className="py-1.5 text-right font-mono font-semibold">
                                              {formatCurrency(inv.gross_amount, inv.currency)}
                                            </TableCell>
                                          </TableRow>
                                        );
                                      })}
                                    </TableBody>
                                  </Table>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
