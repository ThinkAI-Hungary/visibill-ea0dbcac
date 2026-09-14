import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileWarning, AlertTriangle, FileText, CheckCircle2, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CompanyInvoice, AccountyMissingItem, AccountyDeadline } from '@/hooks/accounty';

interface ClientReportsTabProps {
  client: { id: string; name: string };
  companyInvoices?: CompanyInvoice[] | null;
  supabaseMissing?: AccountyMissingItem[] | null;
  companyDeadlines: AccountyDeadline[];
}

export default function ClientReportsTab({
  client,
  companyInvoices,
  supabaseMissing,
  companyDeadlines,
}: ClientReportsTabProps) {
  const navigate = useNavigate();

  const currentMonthInvoices = (companyInvoices || []).filter((inv: CompanyInvoice) => {
    const d = new Date(inv.rawDate || inv.date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const currentMonthIncomingCount = currentMonthInvoices.filter(inv => inv.type === 'bejovo').length;
  const missingCount = (supabaseMissing || []).length;
  const urgentMissingCount = (supabaseMissing || []).filter(mi => mi.priority === 'urgent').length;
  const pendingDeadlinesCount = (companyDeadlines || []).filter(d => d.status === 'pending' || d.status === 'in_progress').length;

  return (
    <div className="space-y-6 page-animate slide-in-from-bottom-4 duration-500">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-lg border border-border p-5 shadow-soft">
          <p className="text-xs font-medium text-muted-foreground mb-1">Számlák (aktuális hó)</p>
          <p className="text-2xl font-bold text-foreground">
            {currentMonthInvoices.length}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            ebből bejövő: {currentMonthIncomingCount}
          </p>
        </div>
        <div className="bg-card rounded-lg border border-border p-5 shadow-soft">
          <p className="text-xs font-medium text-muted-foreground mb-1">Hiányzó tételek</p>
          <p className={cn('text-2xl font-bold', missingCount > 0 ? 'text-red-600' : 'text-green-600')}>
            {missingCount}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            sürgős: {urgentMissingCount}
          </p>
        </div>
        <div className="bg-card rounded-lg border border-border p-5 shadow-soft">
          <p className="text-xs font-medium text-muted-foreground mb-1">Határidők</p>
          <p className="text-2xl font-bold text-foreground">
            {pendingDeadlinesCount}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            aktív / {(companyDeadlines || []).length} összesen
          </p>
        </div>
      </div>

      {/* Missing items by category */}
      <div className="bg-card rounded-lg border border-border shadow-soft overflow-hidden">
        <div className="p-5 border-b border-border">
          <h3 className="font-semibold text-foreground">Hiányzó tételek kategóriánként</h3>
        </div>
        <div className="p-5">
          {missingCount === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-400" />
              Nincs hiányzó tétel — minden rendben!
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {['bejovo', 'kimeno', 'bank', 'ber'].map(cat => {
                const items = (supabaseMissing || []).filter(mi => mi.category === cat);
                const catLabels: Record<string, string> = { bejovo: 'Bejövő számlák', kimeno: 'Kimenő számlák', bank: 'Banki tételek', ber: 'Bérszámfejtés' };
                const catColors: Record<string, string> = { bejovo: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800', kimeno: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800', bank: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800', ber: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' };
                return (
                  <div key={cat} className={cn('rounded-lg border p-4', catColors[cat])}>
                    <p className="text-xs font-medium text-muted-foreground mb-1">{catLabels[cat]}</p>
                    <p className="text-xl font-bold text-foreground">{items.length}</p>
                    {items.filter(mi => mi.priority === 'urgent').length > 0 && (
                      <p className="text-[10px] text-red-500 mt-0.5">{items.filter(mi => mi.priority === 'urgent').length} sürgős</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Invoice breakdown */}
      <div className="bg-card rounded-lg border border-border shadow-soft overflow-hidden">
        <div className="p-5 border-b border-border">
          <h3 className="font-semibold text-foreground">Számla forgalom (utolsó 6 hónap)</h3>
        </div>
        <div className="p-5">
          {(() => {
            const now = new Date();
            const months: { label: string; incoming: number; outgoing: number }[] = [];
            for (let i = 5; i >= 0; i--) {
              const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
              const label = d.toLocaleDateString('hu-HU', { month: 'short' });
              const incoming = (companyInvoices || []).filter((inv: CompanyInvoice) => {
                const idDate = new Date(inv.rawDate || inv.date);
                return idDate.getMonth() === d.getMonth() && idDate.getFullYear() === d.getFullYear() && inv.type === 'bejovo';
              }).length;
              const outgoing = (companyInvoices || []).filter((inv: CompanyInvoice) => {
                const idDate = new Date(inv.rawDate || inv.date);
                return idDate.getMonth() === d.getMonth() && idDate.getFullYear() === d.getFullYear() && inv.type === 'kimeno';
              }).length;
              months.push({ label, incoming, outgoing });
            }
            const maxVal = Math.max(1, ...months.map(m => Math.max(m.incoming, m.outgoing)));
            return (
              <div className="flex items-end gap-3 h-32">
                {months.map((m, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex gap-0.5 items-end justify-center h-24">
                      <div className="w-3 bg-blue-400 dark:bg-blue-500 rounded-t transition-all" style={{ height: `${(m.incoming / maxVal) * 100}%`, minHeight: m.incoming > 0 ? '4px' : '0px' }} />
                      <div className="w-3 bg-purple-400 dark:bg-purple-500 rounded-t transition-all" style={{ height: `${(m.outgoing / maxVal) * 100}%`, minHeight: m.outgoing > 0 ? '4px' : '0px' }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{m.label}</span>
                  </div>
                ))}
              </div>
            );
          })()}
          <div className="flex items-center justify-center gap-4 mt-3">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <div className="w-2 h-2 bg-blue-400 rounded" /> Bejövő
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <div className="w-2 h-2 bg-purple-400 rounded" /> Kimenő
            </div>
          </div>
        </div>
      </div>

      {/* Quick links to reports */}
      <div className="bg-card rounded-lg border border-border shadow-soft overflow-hidden">
        <div className="p-5 border-b border-border">
          <h3 className="font-semibold text-foreground">Részletes riportok</h3>
        </div>
        <div className="grid grid-cols-2 gap-3 p-5">
          {[
            { label: 'Hiányzó számlák riport', path: '/eaisybooks/reports/missing-invoices', icon: FileWarning },
            { label: 'AI Anomália riport', path: '/eaisybooks/reports/ai-anomaly', icon: AlertTriangle },
            { label: 'Összes riport', path: '/eaisybooks/reports', icon: FileText },
          ].map(link => (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              className="flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left group"
            >
              <div className="p-2 bg-muted rounded-lg">
                <link.icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{link.label}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-primary transition-colors" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
