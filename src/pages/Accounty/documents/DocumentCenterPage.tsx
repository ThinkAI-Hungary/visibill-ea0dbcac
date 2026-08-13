import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, FileText, Download, Printer, CheckCircle, Clock, RefreshCw,
  Folder, FileSpreadsheet, CreditCard, Users, AlertTriangle, Archive, Eye,
  Loader2, Database
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAccountyDocuments, useGenerateDocuments, type AccountyDocument } from '@/hooks/accounty';
import { ExportButton } from '@/components/accounty/ExportButton';
import { useToast } from '@/components/ui/use-toast';

// Document categories — these are static navigation items, not user data
const DOC_CATEGORIES = [
  { id: 'payslip', title: 'Bérjegyzékek', icon: FileText, color: 'from-blue-500 to-indigo-500', route: 'payslips' },
  { id: 'transfer', title: 'Utalási lista', icon: CreditCard, color: 'from-emerald-500 to-teal-500', route: 'transfer' },
  { id: 'e-payslip', title: 'E-bérjegyzék portál', icon: Users, color: 'from-cyan-500 to-blue-500', route: 'e-payslip' },
  { id: 'cash', title: 'Készpénzes kifizetési lista', icon: FileSpreadsheet, color: 'from-amber-500 to-orange-500', route: 'cash' },
  { id: 'garnishment', title: 'Letiltások jegyzéke', icon: AlertTriangle, color: 'from-red-500 to-pink-500', route: 'garnishment' },
  { id: 'cafeteria', title: 'Cafeteria feltöltési fájlok', icon: Archive, color: 'from-violet-500 to-purple-500', route: 'cafeteria' },
  { id: 'summary', title: 'Munkáltatói összesítő', icon: Users, color: 'from-slate-500 to-slate-600', route: 'summary' },
  { id: 'certificate', title: 'Igazolások', icon: Folder, color: 'from-green-500 to-emerald-500', route: 'certificates' },
];

export default function DocumentCenterPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const id = companyId;
  const { toast } = useToast();
  const { data: allDocs, isLoading } = useAccountyDocuments(id || '');
  const generateDocs = useGenerateDocuments();
  const [generatingAll, setGeneratingAll] = useState(false);

  const docList = allDocs || [];

  // Count by type
  const countByType = (docType: string) => docList.filter(d => d.docType === docType).length;
  const readyByType = (docType: string) => docList.filter(d => d.docType === docType && (d.status === 'generated' || d.status === 'sent')).length;

  const totalCategories = DOC_CATEGORIES.length;
  const readyCats = DOC_CATEGORIES.filter(c => countByType(c.id) > 0 && readyByType(c.id) === countByType(c.id)).length;

  const STATUS_BADGE: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    ready: { label: 'Kész', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400', icon: CheckCircle },
    generating: { label: 'Generálás...', color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400', icon: RefreshCw },
    pending: { label: 'Üres', color: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400', icon: Clock },
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => window.history.back()} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></button>
          <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/25"><Folder className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold">Dokumentum-központ</h1>
            <p className="text-sm text-slate-500">Havi kimeneti állományok</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/eaisybooks/payroll/${id}/documents/all`}>
            <Button variant="outline" className="gap-1.5"><Eye className="w-4 h-4" /> Összes dokumentum</Button>
          </Link>
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={async () => {
              setGeneratingAll(true);
              try {
                await generateDocs.mutateAsync({ companyId: id || '', docType: 'all' });
                toast({ title: 'Sikeres generálás', description: 'Az összes dokumentum generálása befejeződött.', variant: 'default' });
              } catch (error: any) {
                toast({ title: 'Hiba a generálás során', description: error.message || 'Kérjük próbálja újra később.', variant: 'destructive' });
              } finally {
                setGeneratingAll(false);
              }
            }}
            disabled={generatingAll || generateDocs.isPending}
          >
            {(generatingAll || generateDocs.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {(generatingAll || generateDocs.isPending) ? 'Generálás...' : 'Generálás'}
          </Button>
          <ExportButton
            filename="dokumentum_kozpont"
            headers={['Típus', 'Dokumentumok', 'Kész']}
            getRows={() => DOC_CATEGORIES.map(c => [c.title, countByType(c.id), readyByType(c.id)])}
            size="sm"
            pdfOptions={{
              title: 'Dokumentum-központ összesítő',
            }}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Betöltés...</div>
      ) : (
        <>
          <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500">Dokumentumok</span>
                <span className="text-xs font-bold">{docList.length} db összesen</span>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: docList.length > 0 ? `${(docList.filter(d => d.status === 'generated' || d.status === 'sent').length / docList.length) * 100}%` : '0%' }} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {DOC_CATEGORIES.map(cat => {
              const count = countByType(cat.id);
              const readyCount = readyByType(cat.id);
              const status = count === 0 ? 'pending' : readyCount === count ? 'ready' : 'generating';
              const badge = STATUS_BADGE[status];

              return (
                <Link key={cat.id} to={`/eaisybooks/payroll/${id}/documents/${cat.route}`} className="bg-card rounded-xl border border-border shadow-soft overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer">
                  <div className="p-5 flex items-start gap-4">
                    <div className={cn('w-12 h-12 rounded-xl bg-gradient-to-br text-white flex items-center justify-center shrink-0', cat.color)}>
                      <cat.icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{cat.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1', badge.color)}>
                          <badge.icon className="w-3 h-3" />
                          {badge.label}
                        </span>
                        <span className="text-xs text-slate-400">{count} db</span>
                      </div>
                    </div>
                  </div>
                  <div className="px-5 pb-4 flex items-center gap-2">
                    <Button variant="outline" size="sm" className="text-xs gap-1" disabled={count === 0} onClick={(e) => { e.preventDefault(); window.location.href = `/eaisybooks/payroll/${id}/documents/${cat.route}`; }}><Eye className="w-3 h-3" /> Előnézet</Button>
                    <Button variant="outline" size="sm" className="text-xs gap-1" disabled={count === 0} onClick={(e) => { e.preventDefault(); window.location.href = `/eaisybooks/payroll/${id}/documents/${cat.route}`; }}><Download className="w-3 h-3" /> Letöltés</Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs gap-1 ml-auto text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                      onClick={async (e) => {
                        e.preventDefault();
                        toast({ title: 'Generálás indítva', description: `${cat.title} dokumentumok elkészítése folyamatban.` });
                        try {
                          await generateDocs.mutateAsync({ companyId: id || '', docType: cat.id });
                          toast({ title: 'Kész', description: `${cat.title} dokumentumok sikeresen generálva.` });
                        } catch (error: any) {
                          toast({ title: 'Hiba a generálás során', description: error.message || 'Sikertelen generálás.', variant: 'destructive' });
                        }
                      }}
                      disabled={generateDocs.isPending}
                    >
                      <RefreshCw className={cn("w-3 h-3", generateDocs.isPending && generateDocs.variables?.docType === cat.id && "animate-spin")} /> Generálás
                    </Button>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
