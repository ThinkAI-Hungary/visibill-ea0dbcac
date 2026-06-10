import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, FileText, Download, Send, Eye, CheckCircle, Clock,
  AlertTriangle, Plus, Trash2, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type FilingType = 't1042e' | 't1041int' | 't101e' | 't34' | 'ujegyke' | '2658' | 'm30' | 'ny' | 'rehab' | 'kata';

interface FilingConfig {
  title: string;
  subtitle: string;
  legalRef: string;
  frequency: string;
  deadline: string;
  sections: { title: string; rows: { label: string; value: string; editable?: boolean }[] }[];
}

const CONFIGS: Record<FilingType, FilingConfig> = {
  t1042e: {
    title: 'T1042E — EFO foglalkoztatotti bejelentés',
    subtitle: 'Egyszerűsített foglalkoztatás bejelentés/kijelentés',
    legalRef: 'Efo tv. 11. §', frequency: 'Eseti', deadline: 'A foglalkoztatás megkezdése előtt',
    sections: [
      { title: 'Foglalkoztató adatai', rows: [{ label: 'Munkáltató adószáma', value: '12345678-2-41' }, { label: 'Munkáltató neve', value: 'Teszt Kft.' }] },
      { title: 'Foglalkoztatott adatai', rows: [{ label: 'Név', value: '', editable: true }, { label: 'TAJ szám', value: '', editable: true }, { label: 'Adóazonosító', value: '', editable: true }] },
      { title: 'Foglalkoztatás adatai', rows: [{ label: 'EFO típus', value: 'Alkalmi munka' }, { label: 'Foglalkoztatás kezdete', value: '', editable: true }, { label: 'Foglalkoztatás vége', value: '', editable: true }] },
    ],
  },
  t1041int: {
    title: 'T1041INT — Külföldi bejelentés',
    subtitle: 'Külföldi személy adóügyi bejelentkezése/változás-bejelentése',
    legalRef: 'Art. 17/A. §', frequency: 'Eseti', deadline: '15 napon belül',
    sections: [
      { title: 'Külföldi személy adatai', rows: [{ label: 'Családi név', value: '', editable: true }, { label: 'Utónév', value: '', editable: true }, { label: 'Születési ország', value: '', editable: true }, { label: 'Útlevél / okmányszám', value: '', editable: true }] },
      { title: 'Magyarországi adatok', rows: [{ label: 'Magyar adóazonosító (ha van)', value: '', editable: true }, { label: 'Tartózkodási cím', value: '', editable: true }] },
    ],
  },
  t101e: {
    title: 'T101E — Adóazonosító jel igénylés',
    subtitle: 'Adóazonosító jel igénylés a NAV-tól',
    legalRef: 'Art. 17. §', frequency: 'Eseti', deadline: 'A jogviszony létesítésekor',
    sections: [
      { title: 'Igénylő adatai', rows: [{ label: 'Név', value: '', editable: true }, { label: 'Születési hely', value: '', editable: true }, { label: 'Születési idő', value: '', editable: true }, { label: 'Anyja neve', value: '', editable: true }] },
    ],
  },
  t34: {
    title: 'T34 — Adómérséklési kérelem',
    subtitle: 'Adómérséklés, fizetési könnyítés kérelme',
    legalRef: 'Art. 133-134. §', frequency: 'Eseti', deadline: 'Nincs fix határidő',
    sections: [
      { title: 'Kérelem adatai', rows: [{ label: 'Kérelem típusa', value: 'Adómérséklés' }, { label: 'Érintett adónem', value: '', editable: true }, { label: 'Összeg', value: '', editable: true }, { label: 'Indoklás', value: '', editable: true }] },
    ],
  },
  ujegyke: {
    title: 'UJEGYKE — Jegyzőkönyv',
    subtitle: 'NAV felé küldendő jegyzőkönyvi adatok',
    legalRef: 'Art. 31. §', frequency: 'Eseti', deadline: 'Felszólításra',
    sections: [
      { title: 'Jegyzőkönyv adatai', rows: [{ label: 'Tárgy', value: '', editable: true }, { label: 'Érintett időszak', value: '', editable: true }, { label: 'Jegyzőkönyv szövege', value: '', editable: true }] },
    ],
  },
  '2658': {
    title: '2658 — Összesítő járulékbevallás',
    subtitle: 'Éves összesítő járulékbevallás a NAV felé',
    legalRef: 'Art. 50. §', frequency: 'Éves', deadline: 'Tárgyévet követő év február 25.',
    sections: [
      { title: 'Éves összesítő', rows: [{ label: 'Tárgyév', value: '2026' }, { label: 'Biztosítottak száma (év végi)', value: '42' }, { label: 'Éves bruttó bér összesen', value: '185 040 000' }, { label: 'Éves SZJA összesen', value: '27 756 000' }, { label: 'Éves TB járulék', value: '34 232 400' }, { label: 'Éves SZOCHO', value: '24 055 200' }] },
    ],
  },
  m30: {
    title: 'M30 — Jövedelemigazolás',
    subtitle: 'Munkáltatói igazolás a magánszemély jövedelméről',
    legalRef: 'Szja tv. 46. § (4)', frequency: 'Éves + eseti', deadline: 'Január 31.',
    sections: [
      { title: 'Magánszemély adatai', rows: [{ label: 'Név', value: '', editable: true }, { label: 'Adóazonosító jel', value: '', editable: true }] },
      { title: 'Jövedelem adatok', rows: [{ label: 'Összevonás alá eső jövedelem', value: '', editable: true }, { label: 'Külön adózó jövedelem', value: '', editable: true }, { label: 'Levont SZJA', value: '', editable: true }, { label: 'Levont járulékok', value: '', editable: true }] },
    ],
  },
  ny: {
    title: 'NY — Nyilatkozat a nyugdíjszolgáltatások igényléshez',
    subtitle: 'Nyugdíj előtti adatszolgáltatás',
    legalRef: 'Tny. 96. §', frequency: 'Eseti', deadline: 'Kérésre',
    sections: [
      { title: 'Foglalkoztató nyilatkozata', rows: [{ label: 'Munkavállaló neve', value: '', editable: true }, { label: 'TAJ szám', value: '', editable: true }, { label: 'Szolgálati idő kezdete', value: '', editable: true }, { label: 'Utolsó munkanap', value: '', editable: true }] },
    ],
  },
  rehab: {
    title: 'REHAB — Rehabilitációs hozzájárulás',
    subtitle: 'Megváltozott munkaképességű személyek foglalkoztatási kötelezettség',
    legalRef: 'Mmtv. 23. §', frequency: 'Éves', deadline: 'Március 31.',
    sections: [
      { title: 'Létszámadatok', rows: [{ label: 'Átlagos stat. létszám', value: '42' }, { label: 'Kötelező foglalkoztatási arány (5%)', value: '2.1 fő' }, { label: 'Ténylegesen foglalkoztatott', value: '1 fő', editable: true }, { label: 'Hiányzó létszám', value: '1.1 fő' }] },
      { title: 'Rehab hozzájárulás', rows: [{ label: 'Napi összeg (2026)', value: '2 685 Ft' }, { label: 'Éves hozzájárulás', value: '981 025 Ft' }] },
    ],
  },
  kata: {
    title: 'KATA — Kisadózó tételes adó bevallás',
    subtitle: 'Kisadózó vállalkozások tételes adójának bevallása',
    legalRef: 'Katv.', frequency: 'Éves', deadline: 'Február 25.',
    sections: [
      { title: 'KATA adatok', rows: [{ label: 'KATA alany neve', value: '', editable: true }, { label: 'Adószám', value: '', editable: true }, { label: 'Havi tételes adó', value: '50 000 Ft' }, { label: 'Fizetett hónapok', value: '12', editable: true }, { label: 'Éves adó összesen', value: '600 000 Ft' }] },
      { title: '3M feletti bevétel', rows: [{ label: 'Éves bevétel', value: '', editable: true }, { label: '3M feletti rész 40% adó', value: '0 Ft' }] },
    ],
  },
};

export default function GenericFilingPage() {
  const { id, filingType } = useParams<{ id: string; filingType: string }>();
  const config = CONFIGS[filingType as FilingType];
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  if (!config) {
    return (
      <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
        <div className="flex items-center gap-3">
          <Link to={`/accounty/payroll/${id}/filings`} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="text-2xl font-bold">Bevallás típusok</h1>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(CONFIGS).map(([key, cfg]) => (
            <Link key={key} to={`/accounty/payroll/${id}/filings/${key}`}
              className="p-4 rounded-xl border border-border hover:border-violet-300 hover:shadow-lg hover:-translate-y-0.5 transition-all">
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

  const handleSubmit = () => { setSubmitted(true); setTimeout(() => setSubmitted(false), 3000); };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to={`/accounty/payroll/${id}/filings/all`} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
          <div className="p-2.5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-violet-500/25"><FileText className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-xl font-bold">{config.title}</h1>
            <p className="text-sm text-slate-500">{config.legalRef}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-1.5 text-sm"><Download className="w-4 h-4" /> XML</Button>
          <Button variant="outline" className="gap-1.5 text-sm"><Eye className="w-4 h-4" /> Előnézet</Button>
          <Button onClick={handleSubmit} className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-sm">
            {submitted ? <CheckCircle className="w-4 h-4" /> : <Send className="w-4 h-4" />}
            {submitted ? 'Beküldve ✓' : 'Beküldés'}
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

      {/* Sections */}
      {config.sections.map((section, si) => (
        <div key={si} className="bg-card rounded-xl border border-border p-6 space-y-3">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">{section.title}</h2>
          <div className="space-y-2">
            {section.rows.map((row, ri) => (
              <div key={ri} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <span className="text-sm text-slate-600 dark:text-slate-400">{row.label}</span>
                {row.editable ? (
                  <input
                    type="text"
                    value={formData[`${si}-${ri}`] || row.value}
                    onChange={e => setFormData(prev => ({ ...prev, [`${si}-${ri}`]: e.target.value }))}
                    className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm font-mono text-right focus:ring-2 focus:ring-violet-500 outline-none w-48"
                    placeholder="Kitöltendő"
                  />
                ) : (
                  <span className="text-sm font-mono font-bold">{row.value}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
