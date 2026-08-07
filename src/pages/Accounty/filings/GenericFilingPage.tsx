import React, { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, FileText, Download, Send, Eye, CheckCircle, Clock,
  AlertTriangle, Info, Save, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExportButton } from '@/components/accounty/ExportButton';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAccountyClients } from '@/hooks/accounty';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

type FilingType = 't1042e' | 't1041int' | 't101e' | 't34' | 'ujegyke' | '2658' | 'm30' | 'ny' | 'rehab' | 'kata';

interface FilingConfig {
  title: string;
  subtitle: string;
  legalRef: string;
  frequency: string;
  deadline: string;
  dbType: string; // matches the DB filing_type CHECK constraint
  sections: { title: string; rows: { label: string; key: string; editable?: boolean; suffix?: string }[] }[];
}

const CONFIGS: Record<FilingType, FilingConfig> = {
  t1042e: {
    title: 'T1042E — EFO foglalkoztatotti bejelentés',
    subtitle: 'Egyszerűsített foglalkoztatás bejelentés/kijelentés',
    legalRef: 'Efo tv. 11. §', frequency: 'Eseti', deadline: 'A foglalkoztatás megkezdése előtt',
    dbType: 't1042e',
    sections: [
      { title: 'Foglalkoztató adatai', rows: [{ label: 'Munkáltató adószáma', key: 'employer_tax_id' }, { label: 'Munkáltató neve', key: 'employer_name' }] },
      { title: 'Foglalkoztatott adatai', rows: [{ label: 'Név', key: 'employee_name', editable: true }, { label: 'TAJ szám', key: 'employee_taj', editable: true }, { label: 'Adóazonosító', key: 'employee_tax_id', editable: true }] },
      { title: 'Foglalkoztatás adatai', rows: [{ label: 'EFO típus', key: 'efo_type', editable: true }, { label: 'Foglalkoztatás kezdete', key: 'start_date', editable: true }, { label: 'Foglalkoztatás vége', key: 'end_date', editable: true }] },
    ],
  },
  t1041int: {
    title: 'T1041INT — Külföldi bejelentés',
    subtitle: 'Külföldi személy adóügyi bejelentkezése/változás-bejelentése',
    legalRef: 'Art. 17/A. §', frequency: 'Eseti', deadline: '15 napon belül',
    dbType: 't1041int',
    sections: [
      { title: 'Külföldi személy adatai', rows: [{ label: 'Családi név', key: 'family_name', editable: true }, { label: 'Utónév', key: 'given_name', editable: true }, { label: 'Születési ország', key: 'birth_country', editable: true }, { label: 'Útlevél / okmányszám', key: 'passport_number', editable: true }] },
      { title: 'Magyarországi adatok', rows: [{ label: 'Magyar adóazonosító (ha van)', key: 'hu_tax_id', editable: true }, { label: 'Tartózkodási cím', key: 'hu_address', editable: true }] },
    ],
  },
  t101e: {
    title: 'T101E — Adóazonosító jel igénylés',
    subtitle: 'Adóazonosító jel igénylés a NAV-tól',
    legalRef: 'Art. 17. §', frequency: 'Eseti', deadline: 'A jogviszony létesítésekor',
    dbType: 't101e',
    sections: [
      { title: 'Igénylő adatai', rows: [{ label: 'Név', key: 'name', editable: true }, { label: 'Születési hely', key: 'birth_place', editable: true }, { label: 'Születési idő', key: 'birth_date', editable: true }, { label: 'Anyja neve', key: 'mothers_name', editable: true }] },
    ],
  },
  t34: {
    title: 'T34 — Adómérséklési kérelem',
    subtitle: 'Adómérséklés, fizetési könnyítés kérelme',
    legalRef: 'Art. 133-134. §', frequency: 'Eseti', deadline: 'Nincs fix határidő',
    dbType: 't34',
    sections: [
      { title: 'Kérelem adatai', rows: [{ label: 'Kérelem típusa', key: 'request_type', editable: true }, { label: 'Érintett adónem', key: 'tax_type', editable: true }, { label: 'Összeg', key: 'amount', editable: true, suffix: 'Ft' }, { label: 'Indoklás', key: 'reason', editable: true }] },
    ],
  },
  ujegyke: {
    title: 'UJEGYKE — Jegyzőkönyv',
    subtitle: 'NAV felé küldendő jegyzőkönyvi adatok',
    legalRef: 'Art. 31. §', frequency: 'Eseti', deadline: 'Felszólításra',
    dbType: 'ujegyke',
    sections: [
      { title: 'Jegyzőkönyv adatai', rows: [{ label: 'Tárgy', key: 'subject', editable: true }, { label: 'Érintett időszak', key: 'period', editable: true }, { label: 'Jegyzőkönyv szövege', key: 'body', editable: true }] },
    ],
  },
  '2658': {
    title: '2658 — Összesítő járulékbevallás',
    subtitle: 'Éves összesítő járulékbevallás a NAV felé',
    legalRef: 'Art. 50. §', frequency: 'Éves', deadline: 'Tárgyévet követő év február 25.',
    dbType: '2658',
    sections: [
      { title: 'Éves összesítő', rows: [{ label: 'Tárgyév', key: 'year', editable: true }, { label: 'Biztosítottak száma (év végi)', key: 'employee_count', editable: true }, { label: 'Éves bruttó bér összesen', key: 'annual_gross', editable: true, suffix: 'Ft' }, { label: 'Éves SZJA összesen', key: 'annual_szja', editable: true, suffix: 'Ft' }, { label: 'Éves TB járulék', key: 'annual_tb', editable: true, suffix: 'Ft' }, { label: 'Éves SZOCHO', key: 'annual_szocho', editable: true, suffix: 'Ft' }] },
    ],
  },
  m30: {
    title: 'M30 — Jövedelemigazolás',
    subtitle: 'Munkáltatói igazolás a magánszemély jövedelméről',
    legalRef: 'Szja tv. 46. § (4)', frequency: 'Éves + eseti', deadline: 'Január 31.',
    dbType: 'm30',
    sections: [
      { title: 'Magánszemély adatai', rows: [{ label: 'Név', key: 'name', editable: true }, { label: 'Adóazonosító jel', key: 'tax_id', editable: true }] },
      { title: 'Jövedelem adatok', rows: [{ label: 'Összevonás alá eső jövedelem', key: 'consolidated_income', editable: true, suffix: 'Ft' }, { label: 'Külön adózó jövedelem', key: 'separate_income', editable: true, suffix: 'Ft' }, { label: 'Levont SZJA', key: 'szja_withheld', editable: true, suffix: 'Ft' }, { label: 'Levont járulékok', key: 'contributions_withheld', editable: true, suffix: 'Ft' }] },
    ],
  },
  ny: {
    title: 'NY — Nyilatkozat a nyugdíjszolgáltatások igényléshez',
    subtitle: 'Nyugdíj előtti adatszolgáltatás',
    legalRef: 'Tny. 96. §', frequency: 'Eseti', deadline: 'Kérésre',
    dbType: 'ny',
    sections: [
      { title: 'Foglalkoztató nyilatkozata', rows: [{ label: 'Munkavállaló neve', key: 'employee_name', editable: true }, { label: 'TAJ szám', key: 'taj', editable: true }, { label: 'Szolgálati idő kezdete', key: 'service_start', editable: true }, { label: 'Utolsó munkanap', key: 'last_workday', editable: true }] },
    ],
  },
  rehab: {
    title: 'REHAB — Rehabilitációs hozzájárulás',
    subtitle: 'Megváltozott munkaképességű személyek foglalkoztatási kötelezettség',
    legalRef: 'Mmtv. 23. §', frequency: 'Éves', deadline: 'Március 31.',
    dbType: 'rehab',
    sections: [
      { title: 'Létszámadatok', rows: [{ label: 'Átlagos stat. létszám', key: 'avg_headcount', editable: true }, { label: 'Kötelező foglalkoztatási arány (5%)', key: 'required_ratio' }, { label: 'Ténylegesen foglalkoztatott', key: 'actual_disabled', editable: true }, { label: 'Hiányzó létszám', key: 'missing_headcount' }] },
      { title: 'Rehab hozzájárulás', rows: [{ label: 'Napi összeg (2026)', key: 'daily_amount' }, { label: 'Éves hozzájárulás', key: 'annual_contribution' }] },
    ],
  },
  kata: {
    title: 'KATA — Kisadózó tételes adó bevallás',
    subtitle: 'Kisadózó vállalkozások tételes adójának bevallása',
    legalRef: 'Katv.', frequency: 'Éves', deadline: 'Február 25.',
    dbType: 'kata',
    sections: [
      { title: 'KATA adatok', rows: [{ label: 'KATA alany neve', key: 'name', editable: true }, { label: 'Adószám', key: 'tax_number', editable: true }, { label: 'Havi tételes adó', key: 'monthly_tax', editable: true, suffix: 'Ft' }, { label: 'Fizetett hónapok', key: 'months_paid', editable: true }, { label: 'Éves adó összesen', key: 'annual_tax', suffix: 'Ft' }] },
      { title: '3M feletti bevétel', rows: [{ label: 'Éves bevétel', key: 'annual_revenue', editable: true, suffix: 'Ft' }, { label: '3M feletti rész 40% adó', key: 'excess_tax', suffix: 'Ft' }] },
    ],
  },
};

export default function GenericFilingPage() {
  const { companyId, filingType } = useParams<{ companyId: string; filingType: string }>();
  const config = CONFIGS[filingType as FilingType];
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: clients } = useAccountyClients();
  const company = useMemo(() => clients?.find(c => c.id === companyId), [clients, companyId]);

  // Load existing filing from DB
  const { data: existingFiling } = useQuery({
    queryKey: ['generic-filing', companyId, filingType],
    queryFn: async () => {
      if (!companyId || !config) return null;
      const { data, error } = await supabase
        .from('accounty_filings')
        .select('*')
        .eq('company_id', companyId)
        .eq('filing_type', config.dbType)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] || null;
    },
    enabled: !!companyId && !!config,
  });

  // Pre-fill company data and load saved form data
  React.useEffect(() => {
    if (!config || !company) return;
    const prefilled: Record<string, string> = {};
    // Auto-fill employer info
    if (company?.name) prefilled['employer_name'] = company.name;
    if (company?.taxNumber) prefilled['employer_tax_id'] = company.taxNumber;

    // Load saved data from DB
    if (existingFiling?.xml_data) {
      try {
        const saved = JSON.parse(existingFiling.xml_data);
        Object.assign(prefilled, saved);
      } catch { /* ignore */ }
    }
    setFormData(prev => ({ ...prefilled, ...prev }));
  }, [config, company, existingFiling]);

  // Computed values for REHAB
  const computedValues = useMemo(() => {
    const avg = parseFloat(formData['avg_headcount'] || '0');
    const actual = parseFloat(formData['actual_disabled'] || '0');
    const required = Math.ceil(avg * 0.05 * 10) / 10;
    const missing = Math.max(0, required - actual);
    const dailyAmount = 2685;
    const annual = Math.round(missing * dailyAmount * 365);

    // KATA computed
    const monthlyTax = parseFloat(formData['monthly_tax'] || '0');
    const monthsPaid = parseFloat(formData['months_paid'] || '0');
    const annualRevenue = parseFloat(formData['annual_revenue'] || '0');
    const excessTax = Math.max(0, annualRevenue - 3000000) * 0.4;

    return {
      required_ratio: `${required} fő`,
      missing_headcount: `${missing} fő`,
      daily_amount: `${dailyAmount.toLocaleString('hu-HU')} Ft`,
      annual_contribution: `${annual.toLocaleString('hu-HU')} Ft`,
      annual_tax: `${(monthlyTax * monthsPaid).toLocaleString('hu-HU')} Ft`,
      excess_tax: `${Math.round(excessTax).toLocaleString('hu-HU')} Ft`,
    };
  }, [formData]);

  const getValue = (key: string) => formData[key] || (computedValues as any)[key] || '';

  const handleSave = async () => {
    if (!companyId || !config) return;
    setSaving(true);
    try {
      if (existingFiling) {
        const { error } = await supabase.from('accounty_filings')
          .update({ xml_data: JSON.stringify(formData), updated_at: new Date().toISOString() })
          .eq('id', existingFiling.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('accounty_filings').insert({
          company_id: companyId,
          filing_type: config.dbType,
          period_year: new Date().getFullYear(),
          status: 'draft',
          xml_data: JSON.stringify(formData),
          channel: 'onya',
        });
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ['generic-filing', companyId, filingType] });
      toast({ title: 'Mentve', description: `${config.title} adatai mentve.` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (!config) {
    return (
      <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
        <div className="flex items-center gap-3">
          <button onClick={() => window.history.back()} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="text-2xl font-bold">Bevallás típusok</h1>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(CONFIGS).map(([key, cfg]) => (
            <Link key={key} to={`/accounty/payroll/${companyId}/filings/${key}`}
              className="p-4 rounded-xl border border-border hover:border-violet-300 hover:shadow-lg hover:-translate-y-0.5 transition-all bg-card">
              <p className="text-sm font-bold">{cfg.title}</p>
              <p className="text-xs text-slate-400 mt-0.5">{cfg.subtitle}</p>
              <div className="flex gap-2 mt-2">
                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{cfg.frequency}</span>
                <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 px-2 py-0.5 rounded">{cfg.deadline}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  // Collect all editable rows for export
  const allRows = config.sections.flatMap(s => s.rows);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => window.history.back()} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></button>
          <div className="p-2.5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-violet-500/25"><FileText className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-xl font-bold">{config.title}</h1>
            <p className="text-sm text-slate-500">{company?.name || '–'} — {config.legalRef}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <ExportButton
            filename={`${filingType}_${company?.name || 'ceg'}`}
            headers={['Mező', 'Érték']}
            getRows={() => allRows.map(r => [r.label, getValue(r.key)])}
            size="sm"
          />
          <Button variant="outline" size="sm" className="gap-1.5 text-sm" onClick={() => {
            const xmlSections = config.sections.map(s =>
              `  <${s.title.replace(/\s+/g, '_')}>\n` +
              s.rows.map(r => `    <${r.key}>${getValue(r.key) || ''}</${r.key}>`).join('\n') +
              `\n  </${s.title.replace(/\s+/g, '_')}>`
            ).join('\n');
            const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<${config.dbType} xmlns="http://nav.gov.hu/bevallas/${config.dbType}" verzio="2026.1">\n  <BevallasAdatok>\n    <Tipus>${config.dbType}</Tipus>\n    <GeneraltDatum>${new Date().toISOString().slice(0, 10)}</GeneraltDatum>\n    <Foglalkoztato>${company?.name || ''}</Foglalkoztato>\n    <Adoszam>${company?.taxNumber || ''}</Adoszam>\n  </BevallasAdatok>\n${xmlSections}\n</${config.dbType}>`;
            const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${filingType}_${company?.name || 'ceg'}_${new Date().toISOString().slice(0, 10)}.xml`;
            a.click();
            URL.revokeObjectURL(url);
            toast({ title: 'XML letöltve', description: `${config.title} XML exportálva.` });
          }}>
            <Download className="w-4 h-4" /> XML
          </Button>
          <Button variant="outline" className="gap-1.5 text-sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Mentés...' : 'Mentés'}
          </Button>
          <Button className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-sm" onClick={() => {
            toast({ title: 'Demo mód', description: 'NAV beküldés éles környezetben az ÁNYK/ONYA integráción keresztül történik.' });
          }}>
            <Send className="w-4 h-4" /> Beküldés (demo)
          </Button>
        </div>
      </div>

      {/* Meta info */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-xl border border-border p-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" />
          <div><p className="text-[10px] text-slate-400">Gyakoriság</p><p className="text-xs font-bold">{config.frequency}</p></div>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <div><p className="text-[10px] text-slate-400">Határidő</p><p className="text-xs font-bold">{config.deadline}</p></div>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-500" />
          <div><p className="text-[10px] text-slate-400">Jogszabály</p><p className="text-xs font-bold">{config.legalRef}</p></div>
        </div>
      </div>

      {existingFiling && (
        <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-3 text-sm text-blue-800 dark:text-blue-300 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-blue-600" />
          Korábban mentett adatok betöltve — utolsó módosítás: {new Date(existingFiling.updated_at).toLocaleString('hu-HU')}
        </div>
      )}

      {/* Sections */}
      {config.sections.map((section, si) => (
        <div key={si} className="bg-card rounded-xl border border-border p-6 space-y-3">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">{section.title}</h2>
          <div className="space-y-2">
            {section.rows.map((row) => (
              <div key={row.key} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <span className="text-sm text-slate-600 dark:text-slate-400">{row.label}</span>
                {row.editable ? (
                  <input
                    type="text"
                    value={formData[row.key] || ''}
                    onChange={e => setFormData(prev => ({ ...prev, [row.key]: e.target.value }))}
                    className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm font-mono text-right focus:ring-2 focus:ring-violet-500 outline-none w-48"
                    placeholder="Kitöltendő"
                  />
                ) : (
                  <span className="text-sm font-mono font-bold">{getValue(row.key) || '–'}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
