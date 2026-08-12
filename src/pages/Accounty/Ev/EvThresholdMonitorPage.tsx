import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams, useParams } from 'react-router-dom';
import {
  Gauge, ArrowLeft, ChevronRight, AlertTriangle, CheckCircle2,
  TrendingUp, Zap, Info, ArrowUpRight, Loader2, Mail, Send
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  formatHuf, formatPercent, formatMillionHuf,
  getEvThresholds, DEFAULT_2026_PARAMS, DEFAULT_2025_PARAMS,
  type ThresholdCheck, type ThresholdStatus, checkThresholdStatus
} from '@/lib/evCalculations';
import { useAllEvClientSettings, useEvYtdRevenue } from '@/hooks/useEvData';
import { useEvTaxParams, useGeneratePortalToken } from '@/hooks/accounty';
import { UnifiedPagination } from '@/components/ui/unified-pagination';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { addToApprovalQueue, type OutgoingMessage } from '@/pages/Accounty/generateRequestEmail';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { AamTransitionModal } from '@/components/accounty/ev/AamTransitionModal';

// ─── Types & Constants ──────────────────────────────────────────────────────

interface ProjectedThresholdCheck extends ThresholdCheck {
  projectedValue: number;
  projectedPercentage: number;
  projectedStatus: ThresholdStatus;
}

interface ClientThresholdRow {
  clientId: string;
  clientName: string;
  taxNumber: string;
  taxpayerForm: 'atalany' | 'vszja' | 'kata';
  isRetail: boolean;
  ytdRevenue: number;
  thresholds: ProjectedThresholdCheck[];
  worstStatus: ThresholdStatus;
}

function worstOf(checks: ProjectedThresholdCheck[]): ThresholdStatus {
  if (checks.some(c => c.status === 'red' || c.projectedStatus === 'red')) return 'red';
  if (checks.some(c => c.status === 'yellow' || c.projectedStatus === 'yellow')) return 'yellow';
  return 'green';
}

const STATUS_CONFIG = {
  red: { label: 'Kritikus', color: 'text-red-600', bgColor: 'bg-red-50 dark:bg-red-900/20', borderColor: 'border-red-200 dark:border-red-800', icon: AlertTriangle },
  yellow: { label: 'Figyelmeztetés', color: 'text-amber-600', bgColor: 'bg-amber-50 dark:bg-amber-900/20', borderColor: 'border-amber-200 dark:border-amber-800', icon: AlertTriangle },
  green: { label: 'Rendben', color: 'text-green-600', bgColor: 'bg-green-50 dark:bg-green-900/20', borderColor: 'border-green-200 dark:border-green-800', icon: CheckCircle2 },
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function EvThresholdMonitorPage() {
  const { companyId, dateRange } = useParams<{ companyId?: string; dateRange?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const taxYear = Number(searchParams.get('year') || '2026');
  const [filter, setFilter] = useState<ThresholdStatus | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const { toast } = useToast();
  const [predictionModel, setPredictionModel] = useState<'linear' | 'seasonal' | 'manual'>('linear');
  const [manualTarget, setManualTarget] = useState<number>(18000000);
  const [transitionClient, setTransitionClient] = useState<ClientThresholdRow | null>(null);
  const generateTokenMutation = useGeneratePortalToken();

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, taxYear]);

  // Calculate days elapsed in the year
  const daysElapsed = useMemo(() => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const diffMs = now.getTime() - startOfYear.getTime();
    return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }, []);

  // ─── Real data from Supabase ───────────────────────────────────────────────
  const { data: rawSettings, isLoading: settingsLoading } = useAllEvClientSettings(taxYear);
  const { data: revenueMap, isLoading: revenueLoading } = useEvYtdRevenue(taxYear);
  const { data: dbParams, isLoading: paramsLoading } = useEvTaxParams(taxYear);
  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: ['company-details', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, tax_number')
        .eq('id', companyId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });
  const isLoading = settingsLoading || revenueLoading || paramsLoading || (!!companyId && companyLoading);

  const params = dbParams || (taxYear === 2026 ? DEFAULT_2026_PARAMS : DEFAULT_2025_PARAMS);

  const seasonalProgressRatio = useMemo(() => {
    const currentMonth = new Date().getMonth() + 1; // 1-12
    const weights = [0.05, 0.06, 0.08, 0.09, 0.10, 0.11, 0.11, 0.10, 0.10, 0.08, 0.06, 0.06]; // sum = 1.0
    let cumulative = 0;
    for (let i = 0; i < currentMonth - 1; i++) {
      cumulative += weights[i];
    }
    const currentDate = new Date().getDate();
    const daysInMonth = new Date(new Date().getFullYear(), currentMonth, 0).getDate();
    const monthWeight = weights[currentMonth - 1] || 0.08;
    cumulative += monthWeight * (currentDate / daysInMonth);
    return Math.max(0.01, Math.min(1.0, cumulative));
  }, []);

  const clients = useMemo((): ClientThresholdRow[] => {
    const list = (rawSettings || []).map((s: any) => {
      const companyName = s.companies?.name || 'Ismeretlen ügyfél';
      const taxNumber = s.companies?.tax_number || '';
      const form = s.taxpayer_form || 'atalany';
      const isRetail = s.cost_ratio_category === 'retail_90';
      const ytdRevenue = revenueMap?.get(s.company_id) || 0;
      
      const thresholds = getEvThresholds(ytdRevenue, form, isRetail, params).map(t => {
        let projectedValue = 0;
        if (predictionModel === 'linear') {
          projectedValue = (t.currentValue / daysElapsed) * 365;
        } else if (predictionModel === 'seasonal') {
          projectedValue = t.currentValue / seasonalProgressRatio;
        } else {
          projectedValue = manualTarget;
        }

        const projectedPercentage = t.limit > 0 ? (projectedValue / t.limit) * 100 : 0;
        const projectedStatus = checkThresholdStatus(projectedValue, t.limit);
        return {
          ...t,
          projectedValue,
          projectedPercentage,
          projectedStatus,
        };
      });

      return {
        clientId: s.company_id,
        clientName: companyName,
        taxNumber,
        taxpayerForm: form,
        isRetail,
        ytdRevenue,
        thresholds,
        worstStatus: worstOf(thresholds),
      };
    });

    if (companyId && company && !list.some(c => c.clientId === companyId)) {
      const form = 'atalany';
      const isRetail = false;
      const ytdRevenue = revenueMap?.get(companyId) || 0;
      
      const thresholds = getEvThresholds(ytdRevenue, form, isRetail, params).map(t => {
        let projectedValue = 0;
        if (predictionModel === 'linear') {
          projectedValue = (t.currentValue / daysElapsed) * 365;
        } else if (predictionModel === 'seasonal') {
          projectedValue = t.currentValue / seasonalProgressRatio;
        } else {
          projectedValue = manualTarget;
        }

        const projectedPercentage = t.limit > 0 ? (projectedValue / t.limit) * 100 : 0;
        const projectedStatus = checkThresholdStatus(projectedValue, t.limit);
        return {
          ...t,
          projectedValue,
          projectedPercentage,
          projectedStatus,
        };
      });

      list.push({
        clientId: companyId,
        clientName: company.name || 'Ismeretlen ügyfél',
        taxNumber: company.tax_number || '',
        taxpayerForm: form,
        isRetail,
        ytdRevenue,
        thresholds,
        worstStatus: worstOf(thresholds),
      });
    }

    return list;
  }, [rawSettings, revenueMap, daysElapsed, params, companyId, company, predictionModel, seasonalProgressRatio, manualTarget]);

  const handleSendAlert = async (client: ClientThresholdRow) => {
    try {
      toast({
        title: 'Token generálása...',
        description: 'Magic Link létrehozása az ügyfél számára.',
      });

      const tokenResult = await generateTokenMutation.mutateAsync({
        companyId: client.clientId,
      });

      const portalLink = `https://app.visibill.hu/portal/${tokenResult.token}`;
      
      // Look up contact email for this company from preferences
      const { data: commPrefs } = await supabase
        .from('accounty_communication_preferences')
        .select('contact_email, contact_name')
        .eq('company_id', client.clientId)
        .maybeSingle();

      const contactEmail = commPrefs?.contact_email || 'client@example.com';
      const contactName = commPrefs?.contact_name || client.clientName;

      // Find the threshold that is critical or warning
      const criticalCheck = client.thresholds.find(t => t.percentage >= 80) || client.thresholds[0];
      const limitVal = criticalCheck?.limit || 12000000;
      const currentValue = criticalCheck?.currentValue || client.ytdRevenue;
      const projectedVal = (currentValue / daysElapsed) * 365;

      const subject = `⚠️ Keret túllépési figyelmeztetés – ${client.clientName}`;
      
      const greeting = contactName ? `Kedves ${contactName}!` : `Tisztelt ${client.clientName}!`;
      const body = `${greeting}

Ezúton értesítjük, hogy könyvelője értékhatár-ellenőrzést futtatott le vállalkozásánál. 
A jelenlegi adatok alapján a(z) "${criticalCheck.name}" keretének túllépése várható az év végéig:

• Eddigi (YTD) bevétel: ${formatHuf(currentValue)}
• Éves keret / limit: ${formatHuf(limitVal)}
• Év végére vetített (projektált) bevétel: ${formatHuf(projectedVal)} (${((projectedVal / limitVal) * 100).toFixed(0)}%)

Kérjük, egyeztesse könyvelőjével a szükséges teendőket. Számláit az alábbi Magic Linken keresztül tudja feltölteni:
${portalLink}

Üdvözlettel,
eaisybooks`;

      const htmlPreview = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#111827;padding:24px 28px;border-radius:8px 8px 0 0">
          <div style="color:#ffffff;font-size:20px;font-weight:700">eaisybooks</div>
          <div style="color:#9ca3af;font-size:12px;margin-top:2px">Riasztás és Figyelmeztetés</div>
        </div>
        <div style="padding:28px;background:#ffffff;border:1px solid #e5e7eb;border-top:none">
          <p style="font-size:15px;color:#374151">${greeting}</p>
          <p style="font-size:14px;color:#374151;line-height:1.6">
            Ezúton értesítjük, hogy könyvelője értékhatár-ellenőrzést futtatott le vállalkozásánál. 
            A jelenlegi adatok alapján a(z) <strong>${criticalCheck.name}</strong> keretének túllépése várható az év végéig:
          </p>
          <div style="margin:20px 0;border-radius:6px;overflow:hidden;border:1px solid #e5e7eb">
            <table style="width:100%;border-collapse:collapse">
              <tbody>
                <tr style="background:#f3f4f6"><td style="padding:10px 12px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase">Bevétel YTD</td><td style="padding:10px 12px;font-size:14px;color:#111827;font-weight:500">${formatHuf(currentValue)}</td></tr>
                <tr><td style="padding:10px 12px;border-top:1px solid #e5e7eb;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase">Limithatár</td><td style="padding:10px 12px;border-top:1px solid #e5e7eb;font-size:14px;color:#111827;font-weight:500">${formatHuf(limitVal)}</td></tr>
                <tr style="background:#fee2e2"><td style="padding:10px 12px;border-top:1px solid #e5e7eb;font-size:12px;font-weight:600;color:#991b1b;text-transform:uppercase">Projektált Éves</td><td style="padding:10px 12px;border-top:1px solid #e5e7eb;font-size:14px;color:#991b1b;font-weight:700">${formatHuf(projectedVal)} (${((projectedVal / limitVal) * 100).toFixed(0)}%)</td></tr>
              </tbody>
            </table>
          </div>
          <div style="text-align:center;margin:28px 0">
            <a href="${portalLink}" style="display:inline-block;padding:14px 32px;background:#dc2626;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600">
               Ügyfélportál megnyitása
            </a>
          </div>
          <p style="font-size:14px;color:#374151">
            Üdvözlettel,<br/><strong>eaisybooks</strong>
          </p>
        </div>
      </div>`;

      const message: OutgoingMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        companyId: client.clientId,
        companyName: client.clientName,
        contactEmail,
        channel: 'email',
        category: 'urgent',
        subject,
        originalContext: `Keret túllépési riasztás – YTD: ${formatHuf(currentValue)} (limit: ${formatHuf(limitVal)})`,
        aiGeneratedBody: body,
        htmlPreview,
        portalLink,
        status: 'pending',
        createdAt: new Date().toISOString(),
        missingItemIds: [],
      };

      addToApprovalQueue(message);

      toast({
        title: '✉ Riasztás a jóváhagyási sorban',
        description: `A riasztási levél sikeresen bekerült az Approval Queue-ba.`,
      });
    } catch (err) {
      console.error(err);
      toast({
        title: 'Hiba',
        description: 'Nem sikerült legenerálni a riasztó levelet.',
        variant: 'destructive'
      });
    }
  };

  const filtered = useMemo(() => {
    let list = clients;
    if (companyId) {
      list = list.filter(c => c.clientId === companyId);
    }
    if (filter === 'all') return list;
    return list.filter(c => c.worstStatus === filter);
  }, [clients, filter, companyId]);

  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const countByStatus = useMemo(() => ({
    red: clients.filter(c => c.worstStatus === 'red').length,
    yellow: clients.filter(c => c.worstStatus === 'yellow').length,
    green: clients.filter(c => c.worstStatus === 'green').length,
  }), [clients]);

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        {companyId ? (
          <Link to={`/accounty/${companyId}/${dateRange || '2026-01-01_2026-12-31'}/ev`} className="hover:text-indigo-600 transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Egyéni vállalkozás (EV)
          </Link>
        ) : (
          <Link to="/accounty/ev" className="hover:text-indigo-600 transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> EV Portfólió
          </Link>
        )}
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-900 dark:text-slate-100 font-medium">Értékhatár-figyelő</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl shadow-lg shadow-orange-500/25">
          <Gauge className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Értékhatár-figyelő</h1>
          <p className="text-sm text-slate-500">KATA keret, átalány bevételi határ, ÁFA alanyi mentesség – portfólió szintű monitoring</p>
        </div>
      </div>

      {/* Prediction Model Toolbar */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-soft">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-indigo-500" />
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Vetítési modell beállítása</h3>
            <p className="text-xs text-slate-400">Válaszd ki, hogyan becsülje meg a rendszer az év végi bevételeket</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Select value={predictionModel} onValueChange={(v: any) => setPredictionModel(v)}>
            <SelectTrigger className="w-48 bg-card border-border h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="linear" className="text-xs">Lineáris (pro-rata)</SelectItem>
              <SelectItem value="seasonal" className="text-xs">Szezonális (Q4 súlyozott)</SelectItem>
              <SelectItem value="manual" className="text-xs">Manuális célbevétel</SelectItem>
            </SelectContent>
          </Select>

          {predictionModel === 'manual' && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-500">Célösszeg:</label>
              <Input
                type="number"
                value={manualTarget}
                onChange={(e) => setManualTarget(Number(e.target.value))}
                className="w-36 h-9 text-xs bg-card border-border font-mono"
                placeholder="Célbevétel Ft"
              />
            </div>
          )}
        </div>
      </div>
 
      {/* Status cards */}
      {!companyId && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <button
            onClick={() => setFilter('all')}
            className={cn(
              'bg-card rounded-xl border p-4 shadow-soft text-left transition-all hover:shadow-md',
              filter === 'all' ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-border'
            )}
          >
            <p className="text-xs text-slate-500 mb-1">Összes ügyfél</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{isLoading ? '...' : clients.length}</p>
          </button>
          {(['red', 'yellow', 'green'] as ThresholdStatus[]).map(status => {
            const cfg = STATUS_CONFIG[status];
            const Icon = cfg.icon;
            return (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={cn(
                  'rounded-xl border p-4 shadow-soft text-left transition-all hover:shadow-md',
                  cfg.bgColor, cfg.borderColor,
                  filter === status ? 'ring-2 ring-indigo-500/20' : ''
                )}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className={cn('w-3.5 h-3.5', cfg.color)} />
                  <p className={cn('text-xs font-medium', cfg.color)}>{cfg.label}</p>
                </div>
                <p className={cn('text-2xl font-bold', cfg.color)}>{isLoading ? '...' : countByStatus[status]}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Table */}
      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-slate-50/50 dark:bg-slate-800/30">
                <th className="text-left py-3 px-4 font-medium text-slate-500 text-xs uppercase tracking-wider">Ügyfél</th>
                <th className="text-left py-3 px-4 font-medium text-slate-500 text-xs uppercase tracking-wider">Adóforma</th>
                <th className="text-right py-3 px-4 font-medium text-slate-500 text-xs uppercase tracking-wider">YTD bevétel</th>
                <th className="text-left py-3 px-4 font-medium text-slate-500 text-xs uppercase tracking-wider">Értékhatárok</th>
                <th className="text-center py-3 px-4 font-medium text-slate-500 text-xs uppercase tracking-wider">Státusz</th>
                <th className="w-10 py-3 px-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-sm text-slate-400">
                    <Loader2 className="w-8 h-8 mx-auto mb-3 text-orange-400 animate-spin" />
                    Betöltés...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-sm text-slate-400">
                    <Gauge className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                    Nincs EV ügyfél ebben a kategóriában
                  </td>
                </tr>
              ) : (
                paginated.map(c => {
                  const worstCfg = STATUS_CONFIG[c.worstStatus];
                  return (
                    <tr key={c.clientId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{c.clientName}</p>
                        {c.taxNumber && <p className="text-[10px] text-slate-400 font-mono">{c.taxNumber}</p>}
                      </td>
                      <td className="py-3 px-4">
                        <span className={cn(
                          'text-xs font-bold px-2 py-0.5 rounded-full',
                          c.taxpayerForm === 'atalany' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : c.taxpayerForm === 'kata' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        )}>
                          {c.taxpayerForm === 'atalany' ? 'Átalány' : c.taxpayerForm === 'kata' ? 'KATA' : 'VSZJA'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300 font-medium">
                        {formatMillionHuf(c.ytdRevenue)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-3">
                          {c.thresholds.map(t => {
                            const isProjectedDanger = t.projectedPercentage >= 100;
                            const isProjectedWarning = t.projectedPercentage >= 80 && t.projectedPercentage < 100;
                            return (
                              <div key={t.name} className="space-y-1.5">
                                <div className="flex items-center justify-between text-[10px] w-full max-w-[280px]">
                                  <span className="font-semibold text-slate-700 dark:text-slate-300">{t.name}</span>
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                    Limit: {formatMillionHuf(t.limit)}
                                  </span>
                                </div>
                                <div className="flex flex-col gap-1 w-full max-w-[280px]">
                                  {/* Single stacked progress bar */}
                                  <div className="relative w-full h-2.5 bg-slate-100 dark:bg-slate-800/60 rounded-full overflow-hidden border border-slate-200/50 dark:border-slate-850 shadow-inner">
                                    {/* Projected Part: Semi-transparent background that extends further */}
                                    <div
                                      className={cn(
                                        'absolute left-0 top-0 bottom-0 transition-all duration-500 opacity-40',
                                        t.projectedStatus === 'red' ? 'bg-red-500'
                                          : t.projectedStatus === 'yellow' ? 'bg-amber-500'
                                          : 'bg-emerald-500'
                                      )}
                                      style={{ width: `${Math.min(100, t.projectedPercentage)}%` }}
                                    />
                                    {/* YTD Part: Solid, bright color indicating actual progress */}
                                    <div
                                      className={cn(
                                        'absolute left-0 top-0 bottom-0 rounded-full transition-all duration-500 shadow-[inset_-1px_0_2px_rgba(0,0,0,0.1)]',
                                        t.status === 'red' ? 'bg-red-500'
                                          : t.status === 'yellow' ? 'bg-amber-500'
                                          : 'bg-emerald-500'
                                      )}
                                      style={{ width: `${Math.min(100, t.percentage)}%` }}
                                    />
                                  </div>
                                  
                                  {/* Dynamic badges / percentages right under the bar */}
                                  <div className="flex items-center justify-between text-[9px] text-slate-500 dark:text-slate-400 font-medium font-sans">
                                    <span className="flex items-center gap-1">
                                      <span className={cn(
                                        'w-1.5 h-1.5 rounded-full',
                                        t.status === 'red' ? 'bg-red-500' : t.status === 'yellow' ? 'bg-amber-500' : 'bg-emerald-500'
                                      )} />
                                      Tény (YTD): <strong className="text-slate-700 dark:text-slate-200">{t.percentage.toFixed(0)}%</strong>
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <span className={cn(
                                        'w-1.5 h-1.5 rounded-full border border-dashed opacity-60',
                                        t.projectedStatus === 'red' ? 'bg-red-400 border-red-500' : t.projectedStatus === 'yellow' ? 'bg-amber-400 border-amber-500' : 'bg-emerald-400 border-emerald-500'
                                      )} />
                                      Projektált: <strong className={cn(
                                        isProjectedDanger ? "text-red-600 dark:text-red-400 font-bold" 
                                          : isProjectedWarning ? "text-amber-600 dark:text-amber-400 font-bold" 
                                          : "text-slate-700 dark:text-slate-200"
                                      )}>{t.projectedPercentage.toFixed(0)}%</strong>
                                    </span>
                                    {isProjectedDanger && (
                                      <span className="px-1 py-0.2 rounded bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 text-[8px] font-bold uppercase shrink-0">
                                        Túllépés
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={cn(
                          'inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase',
                          worstCfg.bgColor, worstCfg.color, worstCfg.borderColor, 'border'
                        )}>
                          <worstCfg.icon className="w-3 h-3" />
                          {worstCfg.label}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 justify-center">
                          {c.worstStatus !== 'green' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/20 gap-1 font-bold"
                              onClick={() => setTransitionClient(c)}
                              title="ÁFA-kör átlépési transition workflow"
                            >
                              <Zap className="w-3.5 h-3.5" />
                              Átlépés
                            </Button>
                          )}
                          {c.thresholds.some(t => t.projectedPercentage >= 80) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                              onClick={() => handleSendAlert(c)}
                              title="Riasztó levél küldése az ügyfélnek"
                            >
                              <Mail className="w-4 h-4" />
                            </Button>
                          )}
                          <Link
                            to={`/accounty/client/${c.clientId}/ev?year=${taxYear}`}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-400 hover:text-indigo-600 inline-flex"
                          >
                            <ArrowUpRight className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="border-t border-border px-4 py-3 bg-card">
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

      {/* Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
            <p className="font-semibold">Figyelő működése</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li><span className="font-bold text-green-600">Rendben</span>: bevétel a határ 80%-a alatt</li>
              <li><span className="font-bold text-amber-600">Figyelmeztetés</span>: bevétel a határ 80–100% között</li>
              <li><span className="font-bold text-red-600">Kritikus</span>: határ túllépve – azonnali teendő</li>
            </ul>
          </div>
        </div>
      </div>
      {transitionClient && (
        <AamTransitionModal
          open={transitionClient !== null}
          onOpenChange={(open) => !open && setTransitionClient(null)}
          clientName={transitionClient.clientName}
          clientTaxNumber={transitionClient.taxNumber}
          ytdRevenue={transitionClient.ytdRevenue}
        />
      )}
    </div>
  );
}
