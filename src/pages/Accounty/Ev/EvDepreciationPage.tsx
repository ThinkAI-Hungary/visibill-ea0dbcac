import React, { useState, useMemo, useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  BarChart3, ArrowLeft, ChevronRight, Plus, Edit3, Trash2,
  Calculator, Info, Calendar, Tag, Loader2, Download, ExternalLink,
  X, Save, AlertTriangle, Sparkles
} from 'lucide-react';
import TenyImportModal from '@/components/ev/TenyImportModal';
import { cn } from '@/lib/utils';
import { useAccountyClient } from '@/hooks/accounty';
import { formatHuf } from '@/lib/evCalculations';
import { useEvFixedAssets, type EvFixedAsset, useCreateEvRecord, useUpdateEvRecord, useDeleteEvRecord } from '@/hooks/useEvData';
import { UnifiedPagination } from '@/components/ui/unified-pagination';
import { toast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

// ─── Method labels mapping ──────────────────────────────────────────────────

const METHOD_LABELS: Record<string, string> = {
  linear: 'Lineáris',
  declining_balance: 'Degresszív (Nettó érték)',
  sum_of_years_digits: 'Degresszív (Évek számának összege)',
  progressive: 'Progresszív',
  performance: 'Teljesítményarányos',
  multiplier: 'Szorzószámos',
  absolute: 'Abszolút összegű',
  immediate: 'Azonnali (egyösszegű)',
};

// ─── Modal Components ───────────────────────────────────────────────────────

interface AssetFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  initialValues: any | null;
  saving: boolean;
}

function AssetFormModal({ isOpen, onClose, onSave, initialValues, saving }: AssetFormModalProps) {
  const { session } = useAuth();
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiExplanation, setAiExplanation] = useState('');

  const [form, setForm] = useState({
    asset_name: '',
    acquisition_date: '',
    acquisition_cost: '',
    depreciation_rate: '',
    accumulated_depreciation: '',
    is_below_threshold: false,
    notes: '',
    depreciation_method: 'linear',
    total_performance: '',
    current_performance: '',
    multipliers: '',
    annual_dep_amount: '',
  });

  useEffect(() => {
    setAiExplanation('');
    if (initialValues) {
      let method = 'linear';
      let notesText = initialValues.notes || '';
      let total_performance = '';
      let current_performance = '';
      let multipliers = '';
      let annual_dep_amount = '';

      if (initialValues.notes && initialValues.notes.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(initialValues.notes);
          method = parsed.method || 'linear';
          notesText = parsed.notes || '';
          total_performance = parsed.total_performance !== undefined ? String(parsed.total_performance) : '';
          current_performance = parsed.current_performance !== undefined ? String(parsed.current_performance) : '';
          multipliers = parsed.multipliers || '';
          annual_dep_amount = parsed.annual_dep_amount !== undefined ? String(parsed.annual_dep_amount) : '';
        } catch (e) {
          // ignore
        }
      } else if (initialValues.is_below_threshold) {
        method = 'immediate';
      }

      setForm({
        asset_name: initialValues.asset_name || '',
        acquisition_date: initialValues.acquisition_date ? initialValues.acquisition_date.substring(0, 10) : '',
        acquisition_cost: initialValues.acquisition_cost !== undefined ? String(initialValues.acquisition_cost) : '',
        depreciation_rate: initialValues.depreciation_rate !== undefined ? String(initialValues.depreciation_rate) : '',
        accumulated_depreciation: initialValues.accumulated_depreciation !== undefined ? String(initialValues.accumulated_depreciation) : '',
        is_below_threshold: !!initialValues.is_below_threshold,
        notes: notesText,
        depreciation_method: method,
        total_performance,
        current_performance,
        multipliers,
        annual_dep_amount,
      });
    } else {
      setForm({
        asset_name: '',
        acquisition_date: new Date().toISOString().substring(0, 10),
        acquisition_cost: '',
        depreciation_rate: '',
        accumulated_depreciation: '0',
        is_below_threshold: false,
        notes: '',
        depreciation_method: 'linear',
        total_performance: '',
        current_performance: '',
        multipliers: '',
        annual_dep_amount: '',
      });
    }
  }, [initialValues, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.asset_name || !form.acquisition_date || !form.acquisition_cost) {
      toast({
        variant: 'destructive',
        title: 'Hiányzó adatok',
        description: 'A név, beszerzés dátuma és bruttó érték mezők kitöltése kötelező!'
      });
      return;
    }
    const cost = Number(form.acquisition_cost);
    const accum = Number(form.accumulated_depreciation || 0);
    const isBelow = form.is_below_threshold || form.depreciation_method === 'immediate';

    const notesSerialized = JSON.stringify({
      method: form.depreciation_method,
      notes: form.notes,
      total_performance: form.depreciation_method === 'performance' ? Number(form.total_performance || 0) : 0,
      current_performance: form.depreciation_method === 'performance' ? Number(form.current_performance || 0) : 0,
      multipliers: form.depreciation_method === 'multiplier' ? form.multipliers : '',
      annual_dep_amount: form.depreciation_method === 'absolute' ? Number(form.annual_dep_amount || 0) : 0,
    });

    onSave({
      asset_name: form.asset_name,
      acquisition_date: form.acquisition_date,
      acquisition_cost: cost,
      depreciation_rate: form.depreciation_rate ? Number(form.depreciation_rate) : 0,
      accumulated_depreciation: accum,
      net_value: cost - accum,
      is_below_threshold: isBelow,
      notes: notesSerialized,
    });
  };

  const runAiSuggestion = async () => {
    if (!form.asset_name) return;
    setIsAiLoading(true);
    setAiExplanation('');
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://vxxgvdlqvvchtlmqnrqf.supabase.co';
      
      const assetData = {
        name: form.asset_name,
        cost: Number(form.acquisition_cost || 0),
        description: form.notes || '',
      };

      const systemPrompt = `You are a professional Hungarian tax advisor AI. Your task is to recommend the most optimal Individual Entrepreneur (Egyéni Vállalkozó) depreciation (Értékcsökkenés / ÉCS) method and rate for an asset based on Szja tv. 11. sz. melléklet.
      
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

      Return the prediction strictly in JSON format containing the suggested method (method), suggested annual rate percent (rate), and a brief Hungarian explanation (explanation) justifying your decision (citing Szja tv. 11. sz. melléklet).`;

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
                
                Here is the asset:
                ${JSON.stringify(assetData)}
                
                Please respond strictly in the following JSON format. Do not include any other markdown decoration or text, just the raw JSON structure:
                {
                  "method": "linear | declining_balance | sum_of_years_digits | progressive | performance | multiplier | absolute | immediate",
                  "rate": rate_number,
                  "explanation": "Brief Hungarian explanation (1-2 sentences) citing Szja tv. or the 200k limit."
                }`
              }
            ],
            context: { page: 'asset-form-ai' }
          })
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
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
      if (jsonStart !== -1 && jsonEnd !== -1) {
        const jsonText = accumulated.slice(jsonStart, jsonEnd + 1);
        const data = JSON.parse(jsonText);
        
        setForm(f => ({
          ...f,
          depreciation_method: data.method || 'linear',
          depreciation_rate: data.rate !== undefined ? String(data.rate) : f.depreciation_rate,
          is_below_threshold: data.method === 'immediate' || f.is_below_threshold,
        }));
        setAiExplanation(data.explanation || '');
        toast({
          title: 'AI javaslat sikeres',
          description: 'A leírási módszer és kulcs sikeresen kitöltve.'
        });
      }
    } catch (err: any) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Hiba a javaslat során',
        description: err.message || 'Nem sikerült betölteni az AI javaslatot.'
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in duration-200">
      <div className="bg-card rounded-xl border border-border shadow-xl p-6 max-w-lg w-full mx-4 space-y-4 animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {initialValues ? 'Eszköz módosítása' : 'Új eszköz rögzítése'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Eszköz neve *</label>
              <Input
                placeholder="Pl. Dell XPS 15 laptop"
                value={form.asset_name}
                onChange={e => setForm(f => ({ ...f, asset_name: e.target.value }))}
                required
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Beszerzés dátuma *</label>
              <Input
                type="date"
                value={form.acquisition_date}
                onChange={e => setForm(f => ({ ...f, acquisition_date: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Bruttó érték (Ft) *</label>
              <Input
                type="number"
                placeholder="Pl. 450000"
                value={form.acquisition_cost}
                onChange={e => setForm(f => ({ ...f, acquisition_cost: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Leírási módszer *</label>
                <button
                  type="button"
                  onClick={runAiSuggestion}
                  disabled={isAiLoading || !form.asset_name}
                  className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 disabled:opacity-40 transition-colors"
                >
                  {isAiLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  {isAiLoading ? 'Elemzés...' : 'AI javaslat'}
                </button>
              </div>
              <select
                value={form.depreciation_method}
                onChange={e => setForm(f => {
                  const nextMethod = e.target.value;
                  return {
                    ...f,
                    depreciation_method: nextMethod,
                    is_below_threshold: nextMethod === 'immediate'
                  };
                })}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-card text-foreground focus:ring-2 focus:ring-teal-500"
              >
                <option value="linear">Lineáris (Egyenletes leírás)</option>
                <option value="declining_balance">Degresszív - Nettó érték szerinti</option>
                <option value="sum_of_years_digits">Degresszív - Évek számának összege</option>
                <option value="progressive">Progresszív (Növekvő leírás)</option>
                <option value="performance">Teljesítményarányos</option>
                <option value="multiplier">Szorzószámos</option>
                <option value="absolute">Abszolút összegű</option>
                <option value="immediate">Azonnali (egyösszegű, kisértékű)</option>
              </select>
            </div>

            {aiExplanation && (
              <div className="sm:col-span-2 p-2.5 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/60 dark:border-indigo-900/30 rounded-lg text-xs text-indigo-600 dark:text-indigo-400 flex items-start gap-1.5 animate-in slide-in-from-top-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">AI Javaslat indoklása:</span>{' '}
                  <span>{aiExplanation}</span>
                </div>
              </div>
            )}

            {form.depreciation_method !== 'absolute' && form.depreciation_method !== 'performance' && form.depreciation_method !== 'immediate' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">ÉCS kulcs (%)</label>
                <Input
                  type="number"
                  step="any"
                  placeholder="Pl. 33.3"
                  value={form.depreciation_rate}
                  onChange={e => setForm(f => ({ ...f, depreciation_rate: e.target.value }))}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Halmozott ÉCS (Ft)</label>
              <Input
                type="number"
                placeholder="Pl. 0"
                value={form.accumulated_depreciation}
                onChange={e => setForm(f => ({ ...f, accumulated_depreciation: e.target.value }))}
              />
            </div>

            {form.depreciation_method === 'performance' && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Tervezett teljesítmény (pl. km, óra, db) *</label>
                  <Input
                    type="number"
                    placeholder="Pl. 200000"
                    value={form.total_performance}
                    onChange={e => setForm(f => ({ ...f, total_performance: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Tárgyévi teljesítmény *</label>
                  <Input
                    type="number"
                    placeholder="Pl. 15000"
                    value={form.current_performance}
                    onChange={e => setForm(f => ({ ...f, current_performance: e.target.value }))}
                    required
                  />
                </div>
              </>
            )}

            {form.depreciation_method === 'multiplier' && (
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Éves szorzók (vesszővel elválasztva) *</label>
                <Input
                  placeholder="Pl. 1.5, 1.2, 1.0, 0.8, 0.5"
                  value={form.multipliers}
                  onChange={e => setForm(f => ({ ...f, multipliers: e.target.value }))}
                  required
                />
                <span className="text-[10px] text-slate-400 block">
                  A megadott szorzót alkalmazza a lineáris kulccsal számított amortizációra az eszköz életkora alapján.
                </span>
              </div>
            )}

            {form.depreciation_method === 'absolute' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Fix tárgyévi ÉCS összeg (Ft) *</label>
                <Input
                  type="number"
                  placeholder="Pl. 150000"
                  value={form.annual_dep_amount}
                  onChange={e => setForm(f => ({ ...f, annual_dep_amount: e.target.value }))}
                  required
                />
              </div>
            )}

            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Megjegyzés</label>
              <Input
                placeholder="Opcionális megjegyzés"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>

            {form.depreciation_method !== 'immediate' && (
              <div className="sm:col-span-2 flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="is_below_threshold"
                  checked={form.is_below_threshold}
                  onChange={e => setForm(f => ({ ...f, is_below_threshold: e.target.checked }))}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="is_below_threshold" className="text-xs font-medium text-slate-600 dark:text-slate-400 cursor-pointer">
                  Kisértékű tárgyi eszköz (100% azonnali amortizáció)
                </label>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose}>
              Mégse
            </Button>
            <Button type="submit" disabled={saving} className="bg-teal-600 hover:bg-teal-700 text-white font-semibold flex items-center gap-1">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Mentés
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  deleting: boolean;
}

function DeleteConfirmModal({ isOpen, onClose, onConfirm, deleting }: DeleteConfirmModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in duration-200">
      <div className="bg-card rounded-xl border border-border shadow-xl p-6 max-w-sm w-full mx-4 space-y-4 animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Biztosan törli az eszközt?</h3>
            <p className="text-xs text-slate-500">Ez a művelet nem vonható vissza.</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Mégse</Button>
          <Button onClick={onConfirm} disabled={deleting} className="bg-red-600 hover:bg-red-700 text-white font-semibold flex items-center gap-1">
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Törlés
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function EvDepreciationPage() {
  const { companyId, dateRange } = useParams<{ companyId: string; dateRange: string }>();
  const id = companyId;
  const { data: client } = useAccountyClient(id);
  const [searchParams] = useSearchParams();
  const taxYear = Number(searchParams.get('year') || '2026');
  const [importOpen, setImportOpen] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // CRUD States & Hooks
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<any | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const createRecord = useCreateEvRecord();
  const updateRecord = useUpdateEvRecord();
  const deleteRecord = useDeleteEvRecord();

  // ─── Real data from Supabase ───────────────────────────────────────────────
  const { data: rawAssets, isLoading } = useEvFixedAssets(id, taxYear);

  const assets = useMemo(() => {
    return (rawAssets || []).map((a: EvFixedAsset) => {
      const depRate = a.depreciation_rate || 0;
      
      // Deserialize notes JSON
      let method = 'linear';
      let notesText = a.notes || '';
      let total_performance = 0;
      let current_performance = 0;
      let multipliersStr = '';
      let annual_dep_amount = 0;

      if (a.notes && a.notes.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(a.notes);
          method = parsed.method || 'linear';
          notesText = parsed.notes || '';
          total_performance = Number(parsed.total_performance) || 0;
          current_performance = Number(parsed.current_performance) || 0;
          multipliersStr = parsed.multipliers || '';
          annual_dep_amount = Number(parsed.annual_dep_amount) || 0;
        } catch (e) {
          // ignore
        }
      } else if (a.is_below_threshold) {
        method = 'immediate';
      }

      let currentYearDep = 0;

      switch (method) {
        case 'immediate':
          currentYearDep = a.acquisition_cost;
          break;
        case 'declining_balance':
          currentYearDep = Math.round((a.acquisition_cost - a.accumulated_depreciation) * (depRate / 100));
          break;
        case 'sum_of_years_digits': {
          const n = depRate > 0 ? Math.round(100 / depRate) : 5;
          const S = (n * (n + 1)) / 2;
          const acqYear = new Date(a.acquisition_date).getFullYear();
          const t = taxYear - acqYear + 1;
          if (t >= 1 && t <= n) {
            currentYearDep = Math.round(a.acquisition_cost * (n - t + 1) / S);
          }
          break;
        }
        case 'progressive': {
          const n = depRate > 0 ? Math.round(100 / depRate) : 5;
          const S = (n * (n + 1)) / 2;
          const acqYear = new Date(a.acquisition_date).getFullYear();
          const t = taxYear - acqYear + 1;
          if (t >= 1 && t <= n) {
            currentYearDep = Math.round(a.acquisition_cost * t / S);
          }
          break;
        }
        case 'performance': {
          if (total_performance > 0) {
            currentYearDep = Math.round(a.acquisition_cost * (current_performance / total_performance));
          }
          break;
        }
        case 'multiplier': {
          const acqYear = new Date(a.acquisition_date).getFullYear();
          const t = taxYear - acqYear + 1;
          const mults = multipliersStr.split(',').map(m => Number(m.trim())).filter(m => !isNaN(m));
          let mult = 1.0;
          if (t >= 1 && t <= mults.length) {
            mult = mults[t - 1];
          }
          currentYearDep = Math.round(a.acquisition_cost * (depRate / 100) * mult);
          break;
        }
        case 'absolute':
          currentYearDep = annual_dep_amount;
          break;
        case 'linear':
        default:
          currentYearDep = Math.round(a.acquisition_cost * (depRate / 100));
          break;
      }

      // Ensure current year depreciation doesn't exceed net book value before current year
      const maxAllowedDep = a.acquisition_cost - a.accumulated_depreciation;
      currentYearDep = Math.max(0, Math.min(currentYearDep, maxAllowedDep));

      const netBookValue = a.net_value ?? (a.acquisition_cost - a.accumulated_depreciation - currentYearDep);

      return {
        id: a.id,
        name: a.asset_name,
        category: notesText || 'Egyéb',
        acquisitionDate: a.acquisition_date,
        acquisitionCost: a.acquisition_cost,
        residualValue: 0,
        usefulLifeYears: depRate > 0 ? Math.round(100 / depRate) : 0,
        annualRate: depRate,
        method,
        methodLabel: METHOD_LABELS[method] || 'Lineáris',
        cumulativeDepreciation: a.accumulated_depreciation,
        currentYearDepreciation: currentYearDep,
        netBookValue,
        isLinked: !!a.source_fixed_asset_id,
        _raw: a,
        _deserialized: {
          method,
          notes: notesText,
          total_performance,
          current_performance,
          multipliers: multipliersStr,
          annual_dep_amount,
        }
      };
    });
  }, [rawAssets, taxYear]);

  const totalAcquisition = assets.reduce((s, a) => s + a.acquisitionCost, 0);
  const totalCurrentYear = assets.reduce((s, a) => s + a.currentYearDepreciation, 0);
  const totalCumulative = assets.reduce((s, a) => s + a.cumulativeDepreciation, 0);
  const totalNetBook = assets.reduce((s, a) => s + a.netBookValue, 0);

  const totalItems = assets.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  const paginatedAssets = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return assets.slice(start, start + pageSize);
  }, [assets, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [assets.length]);

  const handleSave = async (data: Record<string, any>) => {
    if (!id) return;
    try {
      if (editingRow) {
        await updateRecord.mutateAsync({
          recordType: 'tao-kesz',
          id: editingRow.id,
          data,
        });
        toast({ title: 'Eszköz frissítve', description: 'A módosítások sikeresen mentve.' });
      } else {
        await createRecord.mutateAsync({
          recordType: 'tao-kesz',
          data: { ...data, company_id: id, tax_year: taxYear },
        });
        toast({ title: 'Eszköz rögzítve', description: 'Az új eszköz sikeresen hozzáadva.' });
      }
      queryClient.invalidateQueries({ queryKey: ['ev-fixed-assets', id, taxYear] });
      setFormOpen(false);
      setEditingRow(null);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hiba történt', description: err.message || 'Sikertelen mentés.' });
    }
  };

  const handleDelete = async () => {
    if (!deletingId || !id) return;
    try {
      await deleteRecord.mutateAsync({ recordType: 'tao-kesz', id: deletingId });
      toast({ title: 'Eszköz törölve', description: 'Az eszköz sikeresen törölve lett.' });
      queryClient.invalidateQueries({ queryKey: ['ev-fixed-assets', id, taxYear] });
      setDeletingId(null);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hiba történt', description: err.message || 'Sikertelen törlés.' });
    }
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to={`/accounty/ev?year=${taxYear}`} className="hover:text-indigo-600 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> EV Portfólió
        </Link>
        <ChevronRight className="w-3 h-3" />
        <Link to={`/accounty/${id}/${dateRange}/ev?year=${taxYear}`} className="hover:text-indigo-600 transition-colors">
          {client?.name || 'Ügyfél'}
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-900 dark:text-slate-100 font-medium">Értékcsökkenés</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl shadow-lg shadow-teal-500/25">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Értékcsökkenési leírás (ÉCS)</h1>
            <p className="text-sm text-slate-500">Szja tv. 11. sz. melléklet – tárgyi eszközök amortizációja</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Importálás TÉNY-ből
          </button>
          <button 
            onClick={() => {
              setEditingRow(null);
              setFormOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Új eszköz
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Bruttó érték összesen</p>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">{formatHuf(totalAcquisition)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Tárgyévi ÉCS</p>
          <p className="text-lg font-bold text-teal-600 tabular-nums">{formatHuf(totalCurrentYear)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Halmozott ÉCS</p>
          <p className="text-lg font-bold text-amber-600 tabular-nums">{formatHuf(totalCumulative)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Nettó könyv szerinti ért.</p>
          <p className="text-lg font-bold text-green-600 tabular-nums">{formatHuf(totalNetBook)}</p>
        </div>
      </div>

      {/* Assets table */}
      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-slate-50/50 dark:bg-slate-800/30">
                <th className="text-left py-3 px-4 font-medium text-slate-500 text-xs uppercase tracking-wider">Eszköz</th>
                <th className="text-left py-3 px-4 font-medium text-slate-500 text-xs uppercase tracking-wider">Beszerzés</th>
                <th className="text-right py-3 px-4 font-medium text-slate-500 text-xs uppercase tracking-wider">Bruttó érték</th>
                <th className="text-left py-3 px-4 font-medium text-slate-500 text-xs uppercase tracking-wider">Módszer & Kulcs</th>
                <th className="text-right py-3 px-4 font-medium text-slate-500 text-xs uppercase tracking-wider">Tárgyévi ÉCS</th>
                <th className="text-right py-3 px-4 font-medium text-slate-500 text-xs uppercase tracking-wider">Halm. ÉCS</th>
                <th className="text-right py-3 px-4 font-medium text-slate-500 text-xs uppercase tracking-wider">Nettó ért.</th>
                <th className="text-center py-3 px-4 font-medium text-slate-500 text-xs uppercase tracking-wider w-20">Műv.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-sm text-slate-400">
                    <Loader2 className="w-8 h-8 mx-auto mb-3 text-teal-400 animate-spin" />
                    Betöltés...
                  </td>
                </tr>
              ) : assets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <BarChart3 className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm text-slate-400 mb-3">Nincs még rögzített tárgyi eszköz</p>
                    <button
                      onClick={() => setImportOpen(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> Importálás a TÉNY nyilvántartásból
                    </button>
                  </td>
                </tr>
              ) : (
                paginatedAssets.map(asset => {
                  const depPercentage = asset.acquisitionCost > 0
                    ? (asset.cumulativeDepreciation / asset.acquisitionCost) * 100
                    : 0;
                  return (
                    <tr key={asset.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">{asset.name}</p>
                          {asset.isLinked && (
                            <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 border border-emerald-200 dark:border-emerald-800" title="Importálva a TÉNY nyilvántartásból">
                              TÉNY
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                          <Tag className="w-3 h-3" /> {asset.category}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(asset.acquisitionDate).toLocaleDateString('hu-HU')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {formatHuf(asset.acquisitionCost)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {asset.methodLabel}
                          </span>
                          {asset.method !== 'absolute' && asset.method !== 'performance' && asset.method !== 'immediate' && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              Kulcs: {asset.annualRate}%
                            </span>
                          )}
                          {asset.method === 'performance' && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              {asset._deserialized.current_performance?.toLocaleString('hu-HU')} / {asset._deserialized.total_performance?.toLocaleString('hu-HU')} egység
                            </span>
                          )}
                          {asset.method === 'multiplier' && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              Szorzósor: [{asset._deserialized.multipliers}]
                            </span>
                          )}
                          {asset.method === 'absolute' && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              Fix összeg: {formatHuf(asset._deserialized.annual_dep_amount)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-teal-600 font-medium">
                        {formatHuf(asset.currentYearDepreciation)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <div className="w-12 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-500 rounded-full"
                              style={{ width: `${Math.min(100, depPercentage)}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
                            {formatHuf(asset.cumulativeDepreciation)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-green-600 font-medium">
                        {formatHuf(asset.netBookValue)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center gap-1 justify-center">
                          <button 
                            onClick={() => {
                              setEditingRow(asset._raw);
                              setFormOpen(true);
                            }}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-400 hover:text-slate-600"
                            title="Módosítás"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => setDeletingId(asset.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-slate-400 hover:text-red-600"
                            title="Törlés"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {assets.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border bg-slate-50/30 dark:bg-slate-800/20 font-bold">
                  <td className="py-3 px-4 text-slate-900 dark:text-slate-100" colSpan={2}>Összesen</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">{formatHuf(totalAcquisition)}</td>
                  <td className="py-3 px-4" />
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-teal-600">{formatHuf(totalCurrentYear)}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-amber-600">{formatHuf(totalCumulative)}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-green-600">{formatHuf(totalNetBook)}</td>
                  <td className="py-3 px-4" />
                </tr>
              </tfoot>
            )}
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
              pageSizeOptions={[10, 25, 50]}
            />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
            <p className="font-semibold">ÉCS szabályok (Szja tv. 11. sz. melléklet)</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Számítástechnikai eszközök: max. 33,3% (3 év)</li>
              <li>Bútorok, berendezések: max. 14,5% (7 év)</li>
              <li>Járművek: max. 20% (5 év)</li>
              <li>Ingatlanok: 2-6% (típustól függően)</li>
              <li>100 ezer Ft alatti eszközök: egyben leírhatók</li>
            </ul>
          </div>
        </div>
      </div>

      {/* TÉNY Import Modal */}
      {id && (
        <TenyImportModal
          isOpen={importOpen}
          onClose={() => setImportOpen(false)}
          companyId={id}
          taxYear={taxYear}
        />
      )}

      {/* Asset Form Modal */}
      <AssetFormModal
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setEditingRow(null); }}
        onSave={handleSave}
        initialValues={editingRow}
        saving={createRecord.isPending || updateRecord.isPending}
      />

      {/* Delete Confirm Modal */}
      <DeleteConfirmModal
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        deleting={deleteRecord.isPending}
      />
    </div>
  );
}
