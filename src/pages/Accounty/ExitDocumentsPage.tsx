import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, FileText, Download, Printer, CheckCircle, Clock,
  Eye, Shield, Users, AlertTriangle, Package, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useEmployeeJobs } from '@/hooks/useAccountyData';

interface ExitDocument {
  id: string;
  title: string;
  legalRef: string;
  description: string;
  required: boolean;
  status: 'generated' | 'pending' | 'na';
  template: string;
}

// These are static document TYPES (not data), so they stay as constants
const DOCUMENT_TEMPLATES: ExitDocument[] = [
  { id: 'cert', title: 'Munkáltatói igazolás', legalRef: 'Mt. 80. § (2)', description: 'Foglalkoztatás időtartama, munkakör, bérre vonatkozó adatok', required: true, status: 'pending', template: 'Tartalmazza a jogviszony kezdetét, végét, munkaköri leírást, az utolsó 6 havi bruttó átlagkeresetet.' },
  { id: 'tb', title: 'TB igazolás (OEP)', legalRef: 'Tbj. 50. §', description: 'Társadalombiztosítási jogviszony záró igazolás', required: true, status: 'pending', template: 'Igazolja a biztosítási jogviszony megszűnését, az utolsó TB járulék befizetés dátumát.' },
  { id: 'jövedelemigazolás', title: 'Jövedelemigazolás (M30)', legalRef: 'Szja tv. 46. § (4)', description: 'Éves jövedelem adatok a kilépés napjáig', required: true, status: 'pending', template: 'Az adott évi összes jövedelem, levont adó, járulékok összesítése január 1-től az utolsó napig.' },
  { id: 'leave', title: 'Szabadság-elszámolás', legalRef: 'Mt. 125. §', description: 'Ki nem vett szabadság megváltás kalkuláció', required: true, status: 'pending', template: 'Éves szabadságkeret felhasználtság és megváltás kalkuláció.' },
  { id: 'severance', title: 'Végkielégítés számfejtés', legalRef: 'Mt. 77. §', description: 'Végkielégítés összegének kiszámítása (ha jár)', required: false, status: 'na', template: 'A felek megállapodhatnak végkielégítésben.' },
  { id: 'final_payslip', title: 'Záró bérjegyzék', legalRef: 'Mt. 155. §', description: 'Az utolsó munkahónap bérjegyzéke', required: true, status: 'pending', template: 'Tartalmazza az arányos bért, szabadság-megváltást, végkielégítést, és a végső nettó összeget.' },
  { id: 'deregister', title: '08E kijelentés', legalRef: 'Art. 50. §', description: 'NAV felé történő biztosítotti kijelentés', required: true, status: 'pending', template: 'Változáskód: 02 (Jogviszony megszűnése). Határidő: utolsó naptól 15 nap.' },
  { id: 'pension', title: 'Szolgálati idő igazolás', legalRef: 'Tny. 96. §', description: 'Nyugdíjszolgáltatáshoz szükséges adatszolgáltatás', required: false, status: 'na', template: 'Tartalmazza a teljes jogviszony alatti biztosításban töltött napokat.' },
  { id: 'training', title: 'Tanulmányi szerződés elszámolás', legalRef: 'Mt. 229. §', description: 'Tanulmányi szerződés alapján fennálló visszafizetési kötelezettség', required: false, status: 'na', template: 'Nem alkalmazandó — nincs aktív tanulmányi szerződés.' },
  { id: 'competition', title: 'Versenytilalmi megállapodás', legalRef: 'Mt. 228. §', description: 'Kilépés utáni versenytilalmi kötelezettség és kompenzáció', required: false, status: 'na', template: 'Nem alkalmazandó — nincs versenytilalmi megállapodás.' },
];

const STATUS_BADGE: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  generated: { label: 'Elkészült', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400', icon: CheckCircle },
  pending: { label: 'Készítendő', color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400', icon: Clock },
  na: { label: 'Nem alkalmazandó', color: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400', icon: Clock },
};

export default function ExitDocumentsPage() {
  const { id, empId } = useParams<{ id: string; empId: string }>();
  const { data: jobs, isLoading } = useEmployeeJobs(id || '', empId || '');
  const [docs, setDocs] = useState(DOCUMENT_TEMPLATES);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);

  const activeJob = (jobs || []).find(j => j.status === 'active');
  const empLabel = activeJob ? `${activeJob.position} — FEOR: ${activeJob.feor}` : 'Munkavállaló';

  const generatedCount = docs.filter(d => d.status === 'generated').length;
  const requiredCount = docs.filter(d => d.required).length;
  const requiredDoneCount = docs.filter(d => d.required && d.status === 'generated').length;

  if (isLoading) return <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Betöltés...</div>;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => window.history.back()} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></button>
          <div className="p-2.5 bg-gradient-to-br from-red-500 to-pink-600 rounded-xl shadow-lg shadow-red-500/25"><Package className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold">Kilépő dokumentumcsomag</h1>
            <p className="text-sm text-slate-500">{empLabel}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-1.5"><Printer className="w-4 h-4" /> Nyomtatás</Button>
          <Button className="gap-1.5 bg-red-600 hover:bg-red-700" onClick={() => window.print()}><Download className="w-4 h-4" /> Teljes csomag (ZIP)</Button>
        </div>
      </div>

      <div className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-500/10 dark:to-pink-500/10 rounded-xl border border-red-200 dark:border-red-500/20 p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-red-800 dark:text-red-300">Kötelező dokumentumok</h3>
          <span className="text-sm font-bold">{requiredDoneCount}/{requiredCount}</span>
        </div>
        <div className="w-full h-2 bg-red-100 dark:bg-red-500/20 rounded-full overflow-hidden">
          <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${requiredCount > 0 ? (requiredDoneCount / requiredCount) * 100 : 0}%` }} />
        </div>
        {requiredDoneCount < requiredCount && (
          <p className="text-xs text-red-600 mt-2 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {requiredCount - requiredDoneCount} kötelező dokumentum még hiányzik</p>
        )}
      </div>

      <div className="space-y-2">
        {docs.map(doc => {
          const badge = STATUS_BADGE[doc.status];
          const isExpanded = expandedDoc === doc.id;
          return (
            <div key={doc.id} className={cn('bg-card rounded-xl border shadow-soft overflow-hidden transition-all', doc.status === 'na' ? 'border-border/50 opacity-60' : 'border-border')}>
              <button onClick={() => setExpandedDoc(isExpanded ? null : doc.id)} className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', doc.status === 'generated' ? 'bg-emerald-100 dark:bg-emerald-500/20' : doc.status === 'pending' ? 'bg-blue-100 dark:bg-blue-500/20' : 'bg-slate-100 dark:bg-slate-800')}>
                  <FileText className={cn('w-4 h-4', doc.status === 'generated' ? 'text-emerald-600' : doc.status === 'pending' ? 'text-blue-600' : 'text-slate-400')} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold">{doc.title}</p>
                    {doc.required && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">KÖTELEZŐ</span>}
                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold', badge.color)}>{badge.label}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{doc.legalRef} — {doc.description}</p>
                </div>
                {doc.status === 'generated' && (
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={e => e.stopPropagation()}><Eye className="w-3 h-3" /></Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={e => e.stopPropagation()}><Download className="w-3 h-3" /></Button>
                  </div>
                )}
              </button>
              {isExpanded && (
                <div className="px-5 pb-4 pl-[68px] border-t border-border/50 pt-3">
                  <p className="text-xs text-slate-600 dark:text-slate-400">{doc.template}</p>
                  {doc.status === 'pending' && (
                    <Button size="sm" className="mt-3 gap-1 text-xs bg-blue-600 hover:bg-blue-700" onClick={() => setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, status: 'generated' as const } : d))}>
                      <FileText className="w-3 h-3" /> Generálás most
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
