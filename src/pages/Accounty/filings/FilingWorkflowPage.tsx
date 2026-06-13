import React, { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Eye, Shield, Send, CheckCircle, FileText, Download,
  AlertTriangle, Clock, Stamp, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { exportPdf, exportReceiptPdf } from '@/lib/exportPdf';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAccountyClients } from '@/hooks/useAccountyData';
import { useToast } from '@/hooks/use-toast';

type Step = 'preview' | 'sign' | 'submit' | 'receipt';

const STEPS: { id: Step; label: string; icon: React.ElementType }[] = [
  { id: 'preview', label: 'Előnézet', icon: Eye },
  { id: 'sign', label: 'Aláírás (AVDH)', icon: Stamp },
  { id: 'submit', label: 'Beküldés', icon: Send },
  { id: 'receipt', label: 'Nyugta', icon: CheckCircle },
];

const FILING_TYPE_LABELS: Record<string, string> = {
  '08e': '08E — Biztosítotti bejelentés',
  '2608': '2608 — Havi járulékbevallás',
  '2658': '2658 — Összesítő járulékbevallás',
  'm30': 'M30 — Jövedelemigazolás',
  'rehab': 'REHAB — Rehabilitációs hozzájárulás',
  'kata': 'KATA — Kisadózó tételes adó',
};

const fmt = (n: number) => n.toLocaleString('hu-HU') + ' Ft';

export default function FilingWorkflowPage() {
  const { id: companyId, filingId } = useParams<{ id: string; filingId: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('preview');
  const [signing, setSigning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [receiptId, setReceiptId] = useState<string | null>(null);

  const { data: clients } = useAccountyClients();
  const company = useMemo(() => clients?.find(c => c.id === companyId), [clients, companyId]);

  // Fetch filing from DB
  const { data: filing, isLoading } = useQuery({
    queryKey: ['filing-detail', filingId],
    queryFn: async () => {
      if (!filingId) return null;
      const { data, error } = await supabase
        .from('accounty_filings')
        .select('*')
        .eq('id', filingId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!filingId,
  });

  // Parse filing data
  const filingData = useMemo(() => {
    if (!filing) return null;
    let parsedXml: any = {};
    if (filing.xml_data) {
      try { parsedXml = JSON.parse(filing.xml_data); } catch { parsedXml = { rawXml: filing.xml_data }; }
    }
    return {
      type: filing.filing_type,
      typeLabel: FILING_TYPE_LABELS[filing.filing_type] || filing.filing_type,
      year: filing.period_year,
      month: filing.period_month,
      status: filing.status,
      navReceiptId: filing.nav_receipt_id,
      submittedAt: filing.submitted_at,
      data: parsedXml,
    };
  }, [filing]);

  const stepIndex = STEPS.findIndex(s => s.id === step);

  const handleSign = () => {
    setSigning(true);
    setTimeout(() => { setSigning(false); setStep('submit'); }, 2000);
  };

  const handleSubmit = async () => {
    if (!filingId) return;
    setSubmitting(true);
    try {
      const navReceipt = `NAV-${filing?.filing_type?.toUpperCase()}-${filing?.period_year}-${String(filing?.period_month || 0).padStart(2, '0')}-${Date.now().toString(36).toUpperCase()}`;
      const { error } = await supabase
        .from('accounty_filings')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          nav_receipt_id: navReceipt,
        })
        .eq('id', filingId);

      if (error) throw error;
      setReceiptId(navReceipt);
      setStep('receipt');
      queryClient.invalidateQueries({ queryKey: ['filing-detail', filingId] });
      queryClient.invalidateQueries({ queryKey: ['payroll', 'filings'] });
      toast({ title: 'Bevallás beküldve', description: `NAV hivatkozás: ${navReceipt}` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-4xl mx-auto flex items-center justify-center h-64 gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" /> Betöltés...
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <button onClick={() => window.history.back()} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></button>
        <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl shadow-lg shadow-indigo-500/25"><Send className="w-5 h-5 text-white" /></div>
        <div>
          <h1 className="text-2xl font-bold">Bevallás beküldés</h1>
          <p className="text-sm text-slate-500">{filingData?.typeLabel || 'Betöltés...'} — {filingData?.year}/{filingData?.month ? String(filingData.month).padStart(2, '0') : '–'}</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 px-4">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.id}>
            <button onClick={() => i <= stepIndex && setStep(s.id)} className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all',
              stepIndex > i ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' :
              step === s.id ? 'bg-indigo-600 text-white ring-2 ring-indigo-300' :
              'bg-slate-100 text-slate-500 dark:bg-slate-700'
            )}>
              {stepIndex > i ? <CheckCircle className="w-3.5 h-3.5" /> : <s.icon className="w-3.5 h-3.5" />}
              {s.label}
            </button>
            {i < STEPS.length - 1 && <div className={cn('w-8 h-0.5', stepIndex > i ? 'bg-emerald-500' : 'bg-slate-200')} />}
          </React.Fragment>
        ))}
      </div>

      {/* Preview step */}
      {step === 'preview' && (
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-sm font-bold mb-4">Bevallás előnézet</h2>
            <div className="bg-white dark:bg-slate-950 border border-border rounded-lg p-8 min-h-[300px] font-mono text-xs space-y-4">
              <div className="text-center border-b border-border pb-4">
                <p className="text-lg font-bold">NEMZETI ADÓ- ÉS VÁMHIVATAL</p>
                <p className="text-sm mt-1">{filingData?.typeLabel || 'Bevallás'}</p>
                <p className="text-xs text-slate-500 mt-2">
                  Időszak: {filingData?.year}. {filingData?.month ? ['', 'január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'][filingData.month] : '–'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div><span className="text-slate-500">Adóalany neve:</span> <strong>{company?.name || '–'}</strong></div>
                <div><span className="text-slate-500">Adószám:</span> <strong>{company?.taxNumber || '–'}</strong></div>
              </div>
              {filingData?.data?.rawXml ? (
                <div className="border-t border-border pt-4">
                  <p className="text-[10px] text-slate-400 uppercase font-bold mb-2">XML tartalom (részlet)</p>
                  <pre className="text-[10px] text-slate-600 dark:text-slate-400 overflow-auto max-h-40 bg-slate-50 dark:bg-slate-900 p-3 rounded">
                    {filingData.data.rawXml.slice(0, 800)}
                    {filingData.data.rawXml.length > 800 ? '\n...' : ''}
                  </pre>
                </div>
              ) : filingData?.data?.name ? (
                <div className="border-t border-border pt-4 space-y-1.5">
                  <div className="flex justify-between"><span>Munkavállaló:</span><span className="font-bold">{filingData.data.name}</span></div>
                  <div className="flex justify-between"><span>TAJ szám:</span><span className="font-bold">{filingData.data.tajNumber || '–'}</span></div>
                  <div className="flex justify-between"><span>Változáskód:</span><span className="font-bold">{filingData.data.changeCode || '–'}</span></div>
                  <div className="flex justify-between"><span>Hatályba lépés:</span><span className="font-bold">{filingData.data.effectiveDate || '–'}</span></div>
                </div>
              ) : (
                <div className="border-t border-border pt-4 text-center text-slate-400">
                  <p>Nincs részletes adat ehhez a bevalláshoz.</p>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-between">
            <Button variant="outline" className="gap-1.5" onClick={() => exportPdf(`bevallas_${filing?.filing_type || 'pdf'}`, {
              title: `Bevallás előnézet — ${filing?.filing_type?.toUpperCase() || ''}`,
              subtitle: `Időszak: ${filing?.period_year || ''}/${String(filing?.period_month || '').padStart(2, '0')}`,
              headers: ['Mező', 'Érték'],
              rows: Object.entries(parsedXml || {}).map(([k, v]) => [k, String(v)]),
            })}><Download className="w-4 h-4" /> PDF letöltés</Button>
            <Button onClick={() => setStep('sign')} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700">
              Tovább az aláíráshoz <Stamp className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Sign step */}
      {step === 'sign' && (
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border p-8 text-center space-y-6">
            <Stamp className="w-16 h-16 mx-auto text-indigo-500" />
            <div>
              <h2 className="text-lg font-bold">Elektronikus aláírás (AVDH)</h2>
              <p className="text-sm text-slate-500 mt-1">A bevallás beküldéséhez AVDH (Azonosításra Visszavezetett Dokumentumhitelesítés) szükséges.</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg p-4 text-left text-sm text-blue-800 dark:text-blue-300">
              <strong>Aláírási módok:</strong>
              <ul className="mt-2 space-y-1 list-disc pl-4 text-xs">
                <li>Ügyfélkapu+ (FIDO2 kulccsal)</li>
                <li>DÁP — Digitális Állampolgárság mobilalkalmazás</li>
                <li>eSzemélyi kártyával (NFC olvasó szükséges)</li>
              </ul>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-lg p-4 text-sm text-yellow-800 dark:text-yellow-300">
              <AlertTriangle className="w-4 h-4 inline mr-1" />
              <strong>Demo mód:</strong> Valós AVDH aláírás a NAV API integrációt igényli. Most szimulált aláírás történik.
            </div>
            <Button onClick={handleSign} disabled={signing} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700">
              {signing ? <><Loader2 className="w-4 h-4 animate-spin" /> Aláírás folyamatban...</> : <><Shield className="w-4 h-4" /> AVDH Aláírás indítása</>}
            </Button>
          </div>
        </div>
      )}

      {/* Submit step */}
      {step === 'submit' && (
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border p-8 text-center space-y-6">
            <div className="w-16 h-16 mx-auto bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Bevallás aláírva — beküldésre kész</h2>
              <p className="text-sm text-slate-500 mt-1">Az elektronikus aláírás sikeres. A bevallás beküldése a NAV ÁNYK rendszerébe történik.</p>
            </div>
            <div className="bg-card rounded-lg border border-border p-4 text-left text-sm grid grid-cols-2 gap-3">
              <div><span className="text-slate-500">Bevallás típus:</span> <strong>{filingData?.typeLabel || '–'}</strong></div>
              <div><span className="text-slate-500">Időszak:</span> <strong>{filingData?.year}/{filingData?.month ? String(filingData.month).padStart(2, '0') : '–'}</strong></div>
              <div><span className="text-slate-500">Cég:</span> <strong>{company?.name || '–'}</strong></div>
              <div><span className="text-slate-500">Aláírás időpont:</span> <strong>{new Date().toLocaleString('hu-HU')}</strong></div>
            </div>
            <Button onClick={handleSubmit} disabled={submitting} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Beküldés a NAV-nak...</> : <><Send className="w-4 h-4" /> Beküldés megerősítése</>}
            </Button>
          </div>
        </div>
      )}

      {/* Receipt step */}
      {step === 'receipt' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-500/10 dark:to-green-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/20 p-10 text-center space-y-6">
            <div className="w-20 h-20 mx-auto bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <CheckCircle className="w-10 h-10 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-emerald-800 dark:text-emerald-300">Bevallás sikeresen beküldve!</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">A NAV rendszere befogadta a bevallást.</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-border p-5 text-left text-sm max-w-md mx-auto space-y-2">
              <div className="flex justify-between"><span className="text-slate-500">Hivatkozási szám:</span><span className="font-mono font-bold">{receiptId || filing?.nav_receipt_id || '–'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Beküldés időpont:</span><span>{filing?.submitted_at ? new Date(filing.submitted_at).toLocaleString('hu-HU') : new Date().toLocaleString('hu-HU')}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Státusz:</span><span className="text-emerald-600 font-bold">Befogadva</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Feldolgozás várható:</span><span>24 órán belül</span></div>
            </div>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" className="gap-1.5" onClick={() => exportReceiptPdf(`nyugta_${filing?.filing_type || ''}`, {
                title: 'NAV Bevallás — Beküldési Nyugta',
                fields: [
                  { label: 'Hivatkozási szám', value: receiptId || filing?.nav_receipt_id || '–' },
                  { label: 'Bevallás típusa', value: filing?.filing_type?.toUpperCase() || '–' },
                  { label: 'Időszak', value: `${filing?.period_year || ''}/${String(filing?.period_month || '').padStart(2, '0')}` },
                  { label: 'Beküldés időpont', value: filing?.submitted_at ? new Date(filing.submitted_at).toLocaleString('hu-HU') : new Date().toLocaleString('hu-HU') },
                  { label: 'Státusz', value: 'Befogadva' },
                  { label: 'Feldolgozás várható', value: '24 órán belül' },
                ],
              })}><Download className="w-4 h-4" /> Nyugta letöltése</Button>
              <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
                <Link to={`/accounty/payroll/${companyId}/filings`}>Vissza a bevallásokhoz</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
