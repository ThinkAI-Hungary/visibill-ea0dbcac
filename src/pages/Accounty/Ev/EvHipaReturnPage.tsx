import React, { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  Building2, ArrowLeft, ChevronRight, Info, CheckCircle2,
  Clock, AlertTriangle, Send, Download, Calendar, FileText, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccountyClient, useAccountyCommunicationPrefs } from '@/hooks/accounty';
import { formatHuf } from '@/lib/evCalculations';
import { useEvTaxReturns, useEvHipaCalc, useUpdateEvTaxReturn } from '@/hooks/useEvData';
import { toast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  submitted: { label: 'Benyújtva', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
  accepted: { label: 'Elfogadva', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
  draft: { label: 'Vázlat', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: FileText },
  upcoming: { label: 'Közelgő', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', icon: Clock },
  overdue: { label: 'Lejárt!', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: AlertTriangle },
};

function escapeXml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export default function EvHipaReturnPage() {
  const { companyId, dateRange } = useParams<{ companyId: string; dateRange: string }>();
  const id = companyId;
  const { data: client } = useAccountyClient(id);
  const { data: company } = useQuery({
    queryKey: ['company-detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
  const { data: commPrefs } = useAccountyCommunicationPrefs(id || '');

  const updateReturn = useUpdateEvTaxReturn();
  const [searchParams] = useSearchParams();
  const taxYear = Number(searchParams.get('year') || '2026');

  // Real data
  const { data: allReturns, isLoading } = useEvTaxReturns(id, taxYear);
  const { data: hipaCalc } = useEvHipaCalc(id, taxYear);

  const hipaReturns = useMemo(() => {
    const dbReturns = (allReturns || [])
      .filter((r: any) => r.return_type === 'hipa')
      .map((r: any) => {
        const now = new Date();
        const isOverdue = r.status !== 'submitted' && r.status !== 'accepted' && r.deadline && new Date(r.deadline) < now;
        const status = isOverdue ? 'overdue'
          : r.status === 'submitted' || r.status === 'accepted' ? 'submitted'
          : r.status === 'draft' ? 'draft' : 'upcoming';
        return {
          id: r.id,
          period: r.period_key || `${r.tax_year}. adóév`,
          deadline: r.deadline || '',
          status,
          amount: r.calculated_tax || 0,
          submittedDate: r.submitted_at,
          xmlData: r.xml_data,
        };
      });

    // Generate expected HIPA entries and merge with DB records
    const now = new Date();
    const hipaAmount = hipaCalc?.hipa_amount || 0;

    const getStatus = (deadline: string) => {
      const d = new Date(deadline);
      if (now > d) return 'overdue';
      const days = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return days <= 30 ? 'draft' : 'upcoming';
    };

    const expectedEntries = [
      {
        id: 'gen-hipa-eloleg-1',
        period: `${taxYear} I. félévi adóelőleg`,
        deadline: `${taxYear}-03-15`,
        defaultStatus: getStatus(`${taxYear}-03-15`),
        amount: Math.round(hipaAmount / 2),
      },
      {
        id: 'gen-hipa-annual',
        period: `${taxYear}. adóévi HIPA bevallás`,
        deadline: `${taxYear}-05-31`,
        defaultStatus: getStatus(`${taxYear}-05-31`),
        amount: hipaAmount,
      },
      {
        id: 'gen-hipa-eloleg-2',
        period: `${taxYear} II. félévi adóelőleg`,
        deadline: `${taxYear}-09-15`,
        defaultStatus: getStatus(`${taxYear}-09-15`),
        amount: Math.round(hipaAmount / 2),
      },
    ];

    return expectedEntries.map(ee => {
      const dbMatch = dbReturns.find(r => r.period === ee.period);
      if (dbMatch) {
        return dbMatch;
      }
      return {
        id: ee.id,
        period: ee.period,
        deadline: ee.deadline,
        status: ee.defaultStatus,
        amount: ee.amount,
        submittedDate: null,
        xmlData: null,
      };
    });
  }, [allReturns, hipaCalc]);

  const handlePrepareAndDownload = async (ret: any) => {
    if (!id) return;
    try {
      // 1. Generate XML
      const yearMatch = ret.period.match(/\d{4}/);
      const selectedYear = yearMatch ? Number(yearMatch[0]) : taxYear;
      
      let periodFrom = `${selectedYear}-01-01`;
      let periodTo = `${selectedYear}-12-31`;
      
      if (ret.period.includes('I. félévi')) {
        periodFrom = `${selectedYear}-01-01`;
        periodTo = `${selectedYear}-06-30`;
      } else if (ret.period.includes('II. félévi')) {
        periodFrom = `${selectedYear}-07-01`;
        periodTo = `${selectedYear}-12-31`;
      }

      const currentDate = new Date().toISOString().slice(0, 10);

      const taxNum = company?.tax_number || client?.taxNumber || '';
      const taxParts = taxNum.split('-');
      const taxNum8 = taxParts[0] || '';
      const taxNumVat = taxParts[1] || '';
      const taxNumCounty = taxParts[2] || '';

      const taxId = (company as any)?.tax_id || '8329900747';
      const clientName = company?.name || client?.name || 'Egyéni Vállalkozó';
      const clientAddress = company?.address || '1054 Budapest, Alkotmány utca 4.';
      const clientEmail = commPrefs?.contactEmail || `${clientName.toLowerCase().replace(/[^a-z0-9]/g, '')}@gmail.com`;
      const clientPhone = commPrefs?.contactPhone || '+36 30 123 4567';

      const taxBase = hipaCalc?.tax_base || 0;
      const municipalityRate = hipaCalc?.municipality_rate || 2;

      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<!-- Nemzeti Adó- és Vámhivatal ÁNYK XML Export -->\n`;
      xml += `<nyomtatvanyok xmlns="http://www.nav.gov.hu/nyomtatvanyok" verzio="1.0">\n`;
      xml += `  <nyomtatvany>\n`;
      xml += `    <nyomtatvanyinformacio>\n`;
      xml += `      <nyomtatvanyazonosito>${selectedYear}HIPA</nyomtatvanyazonosito>\n`;
      xml += `      <verzio>1.0</verzio>\n`;
      xml += `    </nyomtatvanyinformacio>\n`;
      xml += `    <mezok>\n`;
      xml += `      <!-- ========================================== -->\n`;
      xml += `      <!-- A) FŐLAP - AZONOSÍTÓ ÉS KAPCSOLATTARTÁSI ADATOK -->\n`;
      xml += `      <!-- ========================================== -->\n`;
      xml += `      <mezo eazon="01_0001_adoszam_torzs">${taxNum8}</mezo>\n`;
      xml += `      <mezo eazon="01_0002_adoszam_afa">${taxNumVat}</mezo>\n`;
      xml += `      <mezo eazon="01_0003_adoszam_megye">${taxNumCounty}</mezo>\n`;
      xml += `      <mezo eazon="01_0004_adoszam_teljes">${taxNum}</mezo>\n`;
      xml += `      <mezo eazon="01_0005_adoazonosito">${taxId}</mezo>\n`;
      xml += `      <mezo eazon="01_0006_adozo_nev">${escapeXml(clientName)}</mezo>\n`;
      xml += `      <mezo eazon="01_0007_szekhely_cim">${escapeXml(clientAddress)}</mezo>\n`;
      xml += `      <mezo eazon="01_0008_email">${escapeXml(clientEmail)}</mezo>\n`;
      xml += `      <mezo eazon="01_0009_telefon">${escapeXml(clientPhone)}</mezo>\n`;
      xml += `\n`;
      xml += `      <!-- ========================================== -->\n`;
      xml += `      <!-- B) IDŐSZAK ÉS NYILATKOZAT TÍPUSA -->\n`;
      xml += `      <!-- ========================================== -->\n`;
      xml += `      <mezo eazon="01_0010_adoev">${selectedYear}</mezo>\n`;
      xml += `      <mezo eazon="01_0011_idoszak_tol">${periodFrom}</mezo>\n`;
      xml += `      <mezo eazon="01_0012_idoszak_ig">${periodTo}</mezo>\n`;
      xml += `      <mezo eazon="01_0013_bevallastipus">M</mezo>\n`;
      xml += `      <mezo eazon="01_0014_idoszak_megnevezes">${escapeXml(ret.period)}</mezo>\n`;
      xml += `\n`;
      xml += `      <!-- ========================================== -->\n`;
      xml += `      <!-- C) ADÓKÖTELEZETTSÉG RÉSZLETEZÉSE (BEVÉTEL ÉS ADÓ) -->\n`;
      xml += `      <!-- ========================================== -->\n`;
      xml += `      <mezo eazon="02_0001_hipa_adoalap">${taxBase}</mezo>\n`;
      xml += `      <mezo eazon="02_0002_hipa_adomertek">${municipalityRate}%</mezo>\n`;
      xml += `      <mezo eazon="02_0003_hipa_adoosszeg">${ret.amount}</mezo>\n`;
      xml += `\n`;
      xml += `      <!-- ========================================== -->\n`;
      xml += `      <!-- D) NYILATKOZAT ÉS KELTEZÉS -->\n`;
      xml += `      <!-- ========================================== -->\n`;
      xml += `      <mezo eazon="03_0001_nyilatkozat_adat_valos">1</mezo>\n`;
      xml += `      <mezo eazon="03_0002_kelt_hely">Budapest</mezo>\n`;
      xml += `      <mezo eazon="03_0003_kelt_datum">${currentDate}</mezo>\n`;
      xml += `    </mezok>\n`;
      xml += `  </nyomtatvany>\n`;
      xml += `</nyomtatvanyok>\n`;

      // 2. Save/upsert return to db
      await updateReturn.mutateAsync({
        company_id: id,
        tax_year: selectedYear,
        return_type: 'hipa',
        form_code: 'HIPAK',
        period_key: ret.period,
        status: 'submitted',
        calculated_tax: ret.amount,
        paid_amount: 0,
        deadline: ret.deadline || null,
        submitted_at: new Date().toISOString(),
        xml_data: xml,
        data: {
          period: ret.period,
          amount: ret.amount,
          tax_base: hipaCalc?.tax_base || 0,
          rate: hipaCalc?.municipality_rate || 2,
        }
      });

      // 3. Download the file
      const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `NAV_HIPA_${ret.period.replace(/\s+/g, '_')}.xml`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: 'Siker',
        description: `${ret.period} HIPA bevallás sikeresen elkészítve és beküldöttként mentve, az XML letöltése elindult.`,
      });
    } catch (err: any) {
      toast({
        title: 'Hiba történt',
        description: err.message || 'Nem sikerült menteni a bevallást.',
        variant: 'destructive',
      });
    }
  };

  const lastPaidAmount = hipaReturns.find(r => r.status === 'submitted')?.amount || 0;
  const municipalityRate = hipaCalc?.municipality_rate || 2;

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/accounty?tab=ev" className="hover:text-indigo-600 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> EV Portfólió
        </Link>
        <ChevronRight className="w-3 h-3" />
        <Link to={`/accounty/${id}/${dateRange}/ev`} className="hover:text-indigo-600 transition-colors">{client?.name || 'Ügyfél'}</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-900 dark:text-slate-100 font-medium">HIPA bevallás</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg shadow-amber-500/25">
          <Building2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">HIPA bevallás</h1>
          <p className="text-sm text-slate-500">Htv. 39/A. § – helyi iparűzési adó bevallás</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Utolsó befizetett</p>
          <p className="text-lg font-bold text-amber-600 tabular-nums">{isLoading ? '...' : formatHuf(lastPaidAmount)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Adókulcs (önkorm.)</p>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{municipalityRate}%</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Gyakoriság</p>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100">Éves</p>
        </div>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-8 h-8 mb-3 animate-spin text-amber-400" />
            <p className="text-sm">Betöltés...</p>
          </div>
        ) : (
          hipaReturns.map(ret => {
            const cfg = STATUS_CFG[ret.status] || STATUS_CFG.upcoming;
            const Icon = cfg.icon;
            return (
              <div key={ret.id} className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-xs font-bold text-amber-600">HIPA</div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{ret.period}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full', cfg.color)}>
                          <Icon className="w-3 h-3" />{cfg.label}
                        </span>
                        {ret.deadline && (
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />{new Date(ret.deadline).toLocaleDateString('hu-HU')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">{ret.amount > 0 ? formatHuf(ret.amount) : '–'}</p>
                    {ret.status !== 'submitted' && (
                      <button
                        onClick={() => handlePrepareAndDownload(ret)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-sm shadow-indigo-600/10"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Bevallás elkészítése</span>
                      </button>
                    )}
                    {ret.status === 'submitted' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            if (!ret.xmlData) {
                              toast({ title: 'Hiba', description: 'Nincs társított XML adat ehhez a bevalláshoz.' });
                              return;
                            }
                            const blob = new Blob([ret.xmlData], { type: 'application/xml;charset=utf-8' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `NAV_HIPA_${ret.period.replace(/\s+/g, '_')}.xml`;
                            a.click();
                            URL.revokeObjectURL(url);
                            toast({ title: 'Siker', description: 'HIPA XML letöltve.' });
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 rounded-lg transition-colors shadow-sm"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>XML letöltése</span>
                        </button>
                        <button
                          onClick={() => handlePrepareAndDownload(ret)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:hover:bg-indigo-900 dark:text-indigo-400 rounded-lg transition-colors shadow-sm"
                          title="Újragenerálás"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Újragenerálás</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-xs text-blue-600 dark:text-blue-400">
            <p className="font-semibold">HIPA bevallás</p>
            <p>Az éves HIPA bevallás határideje a tárgyévet követő május 31. EV-k a sávos egyszerűsített módot választhatják – adóelőleg fizetése félévkor (márc 15. és szept 15.).</p>
          </div>
        </div>
      </div>
    </div>
  );
}
