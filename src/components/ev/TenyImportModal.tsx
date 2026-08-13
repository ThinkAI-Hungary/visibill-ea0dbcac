import React, { useState, useMemo } from 'react';
import { X, Download, Search, Package, Check, AlertTriangle, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatHuf } from '@/lib/evCalculations';
import {
  useTenyAssetsForImport,
  useImportTenyToEcs,
  type TenyImportItem,
} from '@/hooks/useEvData';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

// ─── Suggested SZJA depreciation rates by asset category ────────────────────
const SZJA_RATE_SUGGESTIONS: Record<string, number> = {
  'Számítástechnikai': 33.3,
  'Szoftver': 50,
  'Bútor': 14.5,
  'Gépjármű': 20,
  'Ingatlan': 2,
  'Irodai': 14.5,
};

function suggestSzjaRate(name: string, taoRate: number | null): number {
  const lower = name.toLowerCase();
  if (/laptop|pc|számítógép|monitor|webcam|logitech|billentyű|egér|mouse|keyboard|headset/i.test(lower)) return 33.3;
  if (/szoftver|google|workspace|licen[sc]/i.test(lower)) return 50;
  if (/bútor|asztal|szék|polc/i.test(lower)) return 14.5;
  if (/autó|gépjármű|kocsi/i.test(lower)) return 20;
  if (/ingatlan|épület|iroda/i.test(lower)) return 2;
  return taoRate ?? 14.5;
}

// ─── Component ──────────────────────────────────────────────────────────────

interface TenyImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  taxYear: number;
}

export default function TenyImportModal({ isOpen, onClose, companyId, taxYear }: TenyImportModalProps) {
  const { data: tenyAssets = [], isLoading } = useTenyAssetsForImport(companyId, taxYear);
  const importMutation = useImportTenyToEcs();
  const { session } = useAuth();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rateOverrides, setRateOverrides] = useState<Record<string, number>>({});
  const [methodOverrides, setMethodOverrides] = useState<Record<string, string>>({});
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, { method: string; rate: number; explanation: string }>>({});
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  const THRESHOLD = 200_000; // 200 000 Ft alatti eszközök egyben leírhatók

  // Filter by search
  const filtered = useMemo(() => {
    if (!search.trim()) return tenyAssets;
    const q = search.toLowerCase();
    return tenyAssets.filter((a: TenyImportItem) =>
      a.name.toLowerCase().includes(q) ||
      a.inventoryNumber?.toLowerCase().includes(q)
    );
  }, [tenyAssets, search]);

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((a: TenyImportItem) => a.id)));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const getRate = (asset: TenyImportItem) =>
    rateOverrides[asset.id] ?? suggestSzjaRate(asset.name, asset.taoRatePercent);

  const setRate = (id: string, rate: number) => {
    setRateOverrides(prev => ({ ...prev, [id]: rate }));
  };

  const getMethod = (asset: TenyImportItem) =>
    methodOverrides[asset.id] ?? (asset.acquisitionValue < THRESHOLD ? 'immediate' : 'linear');

  const setMethod = (id: string, method: string) => {
    setMethodOverrides(prev => ({ ...prev, [id]: method }));
  };

  const runAiSuggestions = async () => {
    const targetAssets = filtered.filter(a => selectedIds.has(a.id));
    if (targetAssets.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nincs kijelölt tétel',
        description: 'Kérlek jelölj ki legalább egy eszközt az AI módszer javaslathoz!'
      });
      return;
    }
    setIsAiLoading(true);
    setImportError(null);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://vxxgvdlqvvchtlmqnrqf.supabase.co';
      
      const assetsList = targetAssets.map(a => ({
        id: a.id,
        name: a.name,
        cost: a.acquisitionValue,
        description: a.inventoryNumber || '',
      }));
      const systemPrompt = `You are a professional Hungarian tax advisor AI. Your task is to recommend the most optimal Individual Entrepreneur (Egyéni Vállalkozó) depreciation (Értékcsökkenés / ÉCS) method and rate for a list of assets based on Szja tv. 11. sz. melléklet.
      
      IMPORTANT - Asset categorization rules:
      1. "immediate": Azonnali leírás (100% write-off). If cost is between 1 and 200,000 HUF, you MUST suggest method: "immediate" and rate: 100.
      2. "progressive": Progresszív (növekvő leírás). If the asset is a factory, new plant, production workshop, or greenfield manufacturing project (e.g. contains "gyár", "üzem", "gyártócsarnok", "termelő egység" in the name), you MUST suggest method: "progressive" (with base rate: 2% representing the building base) and explain that as a ramp-up phase facility, a progressive schedule is optimal for matching future capacity growth.
      3. "performance": Teljesítményarányos. If the asset's name or notes indicate direct performance measurement, like trucks, shipping vehicles (km-based), or high-intensity production machinery with hours/pieces, suggest "performance".
      4. "linear" with rate 14.5% (Egyéb gép, berendezés, irodai bútor):
         - This category is split into two distinct sub-groups. Do NOT mix them up:
           a) Ipari gépek, gyártóeszközök, termelő berendezések, műhely szerszámok, célszerszámok, megmunkáló gépek (pl. pinbeültető, beültető gép, eszterga, marógép, kompresszor, hegesztő, prés, nyomdagép, gyártósor, CNC gép, mérőműszer). If the asset is industrial/factory machinery, explicitly identify it as "ipari gép / gyártó berendezés" (do NOT call it office furniture!).
           b) Irodai bútorok, berendezések, széfek, klímák, asztalok, székek. Only classify as "irodai bútor" if it is actually office furniture.
      5. "declining_balance" with rate 33.3%: Számítástechnikai eszközök (laptop, PC, telefon, monitor, nyomtató, szerver, switch, router) and modern electronic control systems. Because IT assets suffer from very fast technological obsolescence, a degressive (declining balance) depreciation schedule is optimal.
      6. "declining_balance" with rate 50%: Szoftverek, licencek, szellemi termékek. Because software has a very short lifecycle, a degressive depreciation schedule is optimal.
      7. "linear" with rate 20%: Járművek, gépjárművek, autók, kisteherautók.
      8. "linear" with rate 2%: Ingatlanok, épületek, irodák, műhelyek (not in a ramp-up phase).

      Return the predictions in JSON format as an array of objects containing the asset id, suggested method (method), suggested annual rate percent (rate), and a brief Hungarian explanation (explanation) justifying your decision (citing Szja tv. 11. sz. melléklet).`;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/accounty-ai-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'user',
                content: `${systemPrompt}
                
                Here are the assets:
                ${JSON.stringify(assetsList)}
                
                Please respond strictly in the following JSON format. Do not include any other markdown decoration or text, just the raw JSON structure:
                {
                  "suggestions": [
                    { "id": "asset_id", "method": "linear | declining_balance | sum_of_years_digits | progressive | performance | multiplier | absolute | immediate", "rate": rate_number, "explanation": "Brief Hungarian explanation (1-2 sentences) citing Szja tv. or the 200k limit." }
                  ]
                }`
              }
            ],
            context: { page: 'teny-import-ai' }
          })
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Ismeretlen hiba' }));
        throw new Error(err.error || `HTTP ${response.status}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const dataStr = trimmed.slice(6);
          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.done) break;
            if (parsed.content) {
              accumulated += parsed.content;
            }
          } catch {}
        }
      }

      const jsonStart = accumulated.indexOf('{');
      const jsonEnd = accumulated.lastIndexOf('}');
      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error('Az AI nem adott vissza érvényes JSON javaslatot.');
      }
      
      const jsonText = accumulated.slice(jsonStart, jsonEnd + 1);
      const data = JSON.parse(jsonText);

      if (data?.suggestions) {
        const nextRates = { ...rateOverrides };
        const nextMethods = { ...methodOverrides };
        const suggestionsMap: typeof aiSuggestions = {};

        data.suggestions.forEach((s: any) => {
          if (s.id) {
            nextMethods[s.id] = s.method;
            nextRates[s.id] = s.rate;
            suggestionsMap[s.id] = {
              method: s.method,
              rate: s.rate,
              explanation: s.explanation || '',
            };
          }
        });

        setRateOverrides(nextRates);
        setMethodOverrides(nextMethods);
        setAiSuggestions(suggestionsMap);
        
        // Auto-select all assets that got an AI suggestion
        const nextSelected = new Set(selectedIds);
        data.suggestions.forEach((s: any) => {
          if (s.id) nextSelected.add(s.id);
        });
        setSelectedIds(nextSelected);

        toast({
          title: 'AI javaslatok betöltve',
          description: `Sikeresen elemeztünk ${data.suggestions.length} eszközt.`
        });
      }
    } catch (err: any) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'AI javaslat sikertelen',
        description: err.message || 'Hiba történt az AI hívás során.'
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleImport = async () => {
    const items = filtered
      .filter((a: TenyImportItem) => selectedIds.has(a.id))
      .map((a: TenyImportItem) => {
        const rate = getRate(a);
        const method = getMethod(a);
        const isBelow = a.acquisitionValue < THRESHOLD || method === 'immediate';

        // Serialize notes JSON
        const notesSerialized = JSON.stringify({
          method,
          notes: `Importálva a TÉNY nyilvántartásból (${a.inventoryNumber || ''})`,
          total_performance: method === 'performance' ? 100000 : 0, 
          current_performance: 0,
          multipliers: method === 'multiplier' ? '1.5, 1.2, 1.0' : '',
          annual_dep_amount: method === 'absolute' ? rate : 0,
        });

        return {
          sourceId: a.id,
          name: a.name,
          acquisitionDate: a.activationDate || a.purchaseDate,
          acquisitionCost: a.acquisitionValue,
          depreciationRate: isBelow ? 100 : rate,
          isBelowThreshold: isBelow,
          notes: notesSerialized,
        };
      });

    if (items.length === 0) return;
    setImportError(null);

    try {
      await importMutation.mutateAsync({
        companyId,
        taxYear,
        items,
      });
      setSelectedIds(new Set());
      onClose();
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes('source_fixed_asset_id') || msg.includes('column')) {
        try {
          await importWithoutLink(items);
          setSelectedIds(new Set());
          onClose();
        } catch (retryErr: any) {
          setImportError(retryErr?.message || 'Ismeretlen hiba az importálás során.');
        }
      } else {
        setImportError(msg);
      }
    }
  };

  const importWithoutLink = async (items: Array<{
    sourceId: string; name: string; acquisitionDate: string;
    acquisitionCost: number; depreciationRate: number; isBelowThreshold: boolean;
    notes?: string;
  }>) => {
    const { supabase } = await import('@/integrations/supabase/client');
    const rows = items.map(item => ({
      company_id: companyId,
      tax_year: taxYear,
      asset_name: item.name,
      acquisition_date: item.acquisitionDate,
      acquisition_cost: Math.round(item.acquisitionCost),
      depreciation_rate: item.depreciationRate,
      accumulated_depreciation: 0,
      net_value: Math.round(item.acquisitionCost),
      is_below_threshold: item.isBelowThreshold,
      notes: item.notes ?? null,
    }));
    const { error } = await supabase
      .from('accounty_ev_records_fixed_assets')
      .insert(rows);
    if (error) throw error;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-lg">
              <Download className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Importálás TÉNY-ből
              </h2>
              <p className="text-xs text-slate-500">Tárgyi eszközök áthúzása az ÉCS nyilvántartásba — {taxYear}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={runAiSuggestions}
              disabled={isAiLoading || filtered.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50 rounded-lg hover:bg-indigo-100/70 transition-colors disabled:opacity-50"
            >
              {isAiLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
              )}
              {isAiLoading ? 'AI elemzés...' : 'AI módszer javaslat'}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-border/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Keresés eszköznév vagy leltári szám alapján..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <Package className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="text-sm text-slate-500">
                {tenyAssets.length === 0
                  ? 'Nincs importálható eszköz a TÉNY nyilvántartásban, vagy már mind importálva van.'
                  : 'Nincs a keresésnek megfelelő eszköz.'}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {/* Select all */}
              <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/30 mb-2">
                <input
                  type="checkbox"
                  checked={selectedIds.size === filtered.length && filtered.length > 0}
                  onChange={toggleAll}
                  className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <span className="text-xs font-medium text-slate-500">
                  Összes kiválasztása ({filtered.length} eszköz)
                </span>
              </div>

              {/* Asset rows */}
              {filtered.map((asset: TenyImportItem) => {
                const isSelected = selectedIds.has(asset.id);
                const isBelowThreshold = asset.acquisitionValue < THRESHOLD;
                const rate = getRate(asset);
                const method = getMethod(asset);
                const hasAiSuggestion = !!aiSuggestions[asset.id];

                const defaultRate = aiSuggestions[asset.id]?.rate ?? suggestSzjaRate(asset.name, asset.taoRatePercent);
                const defaultMethod = aiSuggestions[asset.id]?.method ?? (asset.acquisitionValue < THRESHOLD ? 'immediate' : 'linear');

                const isMethodOverridden = methodOverrides[asset.id] !== undefined && methodOverrides[asset.id] !== defaultMethod;
                const isRateOverridden = rateOverrides[asset.id] !== undefined && rateOverrides[asset.id] !== defaultRate;
                const isAnyOverridden = isMethodOverridden || isRateOverridden;

                const isInvalidImmediate = method === 'immediate' && asset.acquisitionValue >= THRESHOLD;

                return (
                  <div
                    key={asset.id}
                    className={cn(
                      'flex flex-col gap-2 p-3 rounded-xl transition-colors border',
                      isSelected
                        ? 'bg-teal-50/50 dark:bg-teal-900/10 border-teal-200 dark:border-teal-800/60'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/20 border-border/40 bg-card'
                    )}
                    onClick={() => toggleOne(asset.id)}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOne(asset.id)}
                        onClick={e => e.stopPropagation()}
                        className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 shrink-0"
                      />

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {asset.name}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {asset.inventoryNumber} · {new Date(asset.activationDate || asset.purchaseDate).toLocaleDateString('hu-HU')}
                        </p>
                      </div>

                      <div className="text-right shrink-0 mr-4">
                        <p className="text-sm font-mono font-bold tabular-nums text-slate-700 dark:text-slate-300">
                          {formatHuf(asset.acquisitionValue)}
                        </p>
                        {asset.taoRatePercent && (
                          <p className="text-[10px] text-slate-400">TAO: {asset.taoRatePercent}%</p>
                        )}
                      </div>

                      {/* SZJA ÉCS Method & Rate input */}
                      <div className="shrink-0 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        {isAnyOverridden && (
                          <div 
                            className="w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400 animate-pulse shrink-0" 
                            title="Manuálisan módosított érték" 
                          />
                        )}

                        {isInvalidImmediate && (
                          <div 
                            className="text-amber-500 dark:text-amber-400 shrink-0 flex items-center" 
                            title="Figyelem: 200 000 Ft feletti értékű eszköz nem írható le azonnal 100%-ban!"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </div>
                        )}

                        <select
                          value={method}
                          onChange={e => setMethod(asset.id, e.target.value)}
                          className={cn(
                            "text-xs border rounded px-1.5 py-1 bg-card text-foreground focus:ring-2 focus:ring-teal-500",
                            hasAiSuggestion ? "border-indigo-300 dark:border-indigo-800 ring-1 ring-indigo-500/20" : "border-border",
                            isAnyOverridden && "border-blue-400 dark:border-blue-700 focus:ring-blue-500/35"
                          )}
                        >
                          <option value="linear">Lineáris</option>
                          <option value="declining_balance">Degresszív (Nettó)</option>
                          <option value="sum_of_years_digits">Degresszív (Évek)</option>
                          <option value="progressive">Progresszív</option>
                          <option value="performance">Teljesítmény</option>
                          <option value="multiplier">Szorzószámos</option>
                          <option value="absolute">Abszolút</option>
                          <option value="immediate">Azonnali</option>
                        </select>

                        {method === 'immediate' || isBelowThreshold ? (
                          <span className="text-xs text-amber-600 font-semibold flex items-center gap-1 w-16 justify-end">
                            {isBelowThreshold ? <Check className="w-3 h-3 text-emerald-500" /> : <AlertTriangle className="w-3.5 h-3.5" />} 100%
                          </span>
                        ) : method === 'absolute' ? (
                          <div className="relative w-20">
                            <input
                              type="number"
                              value={rate}
                              onChange={e => setRate(asset.id, Number(e.target.value) || 0)}
                              placeholder="Összeg"
                              className={cn(
                                "w-full text-xs border rounded px-2 py-1 bg-card text-right font-mono focus:ring-2 focus:ring-teal-500",
                                hasAiSuggestion ? "border-indigo-300 dark:border-indigo-800" : "border-border",
                                isAnyOverridden && "border-blue-400 dark:border-blue-700 focus:ring-blue-500/35"
                              )}
                            />
                          </div>
                        ) : (
                          <div className="relative w-16">
                            <input
                              type="number"
                              value={rate}
                              onChange={e => setRate(asset.id, Number(e.target.value) || 0)}
                              min={0}
                              max={100}
                              step={0.1}
                              className={cn(
                                "w-full text-xs border rounded pl-2 pr-5 py-1 bg-card text-right font-mono focus:ring-2 focus:ring-teal-500",
                                hasAiSuggestion ? "border-indigo-300 dark:border-indigo-800" : "border-border",
                                isAnyOverridden && "border-blue-400 dark:border-blue-700 focus:ring-blue-500/35"
                              )}
                            />
                            <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-slate-400">%</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* AI suggestion indicator */}
                    {hasAiSuggestion && (
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/60 dark:border-indigo-900/30 rounded-lg ml-7 text-[10px] text-indigo-600 dark:text-indigo-400 animate-in slide-in-from-top-1 duration-200">
                        <Sparkles className="w-3 h-3 text-indigo-500 shrink-0" />
                        <span className="font-semibold">AI javaslat:</span>
                        <span>{aiSuggestions[asset.id].explanation}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-slate-50/50 dark:bg-slate-800/20 rounded-b-2xl">
          <div className="text-xs text-slate-500">
            {importError ? (
              <span className="font-medium text-red-500 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {importError}
              </span>
            ) : selectedIds.size > 0 ? (
              <span className="font-medium text-teal-600">
                <Check className="w-3.5 h-3.5 inline mr-1" />
                {selectedIds.size} eszköz kiválasztva
              </span>
            ) : (
              'Válasszon ki eszközöket az importáláshoz'
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
            >
              Mégse
            </button>
            <button
              onClick={handleImport}
              disabled={selectedIds.size === 0 || importMutation.isPending}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                selectedIds.size > 0
                  ? 'bg-teal-600 text-white hover:bg-teal-700'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed dark:bg-slate-700 dark:text-slate-500'
              )}
            >
              {importMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              Importálás ({selectedIds.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
