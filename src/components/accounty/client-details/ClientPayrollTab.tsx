import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Settings, Clock, ChevronRight } from 'lucide-react';

interface ClientPayrollTabProps {
  client: { id: string; name: string };
}

export default function ClientPayrollTab({ client }: ClientPayrollTabProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => navigate(`/accounty/payroll/${client.id}`)}
          className="bg-card rounded-xl border border-border shadow-soft p-6 text-left hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5 transition-all group"
        >
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Bérszámfejtés Dashboard</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">KPI-k, ciklusok, foglalkoztatottak áttekintése</p>
        </button>

        <button
          onClick={() => navigate(`/accounty/payroll/${client.id}/employees`)}
          className="bg-card rounded-xl border border-border shadow-soft p-6 text-left hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5 transition-all group"
        >
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <Settings className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Foglalkoztatottak</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Személyi nyilvántartás, jogviszonyok kezelése</p>
        </button>

        <button
          onClick={() => navigate(`/accounty/payroll/${client.id}/cycle/new`)}
          className="bg-card rounded-xl border border-border shadow-soft p-6 text-left hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5 transition-all group"
        >
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Új havi ciklus</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Bérszámfejtési időszak indítása</p>
        </button>
      </div>

      {/* Info box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-5">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          A bérszámfejtés modul teljes funkcionalitása az ügyfél-specifikus dashboard-on érhető el.
          Kattints a <strong>Bérszámfejtés Dashboard</strong> kártyára a teljes kezelőfelülethez.
        </p>
      </div>

      {/* Quick links */}
      <div className="bg-card rounded-xl border border-border shadow-soft p-5">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Gyors navigáció</h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Paramétertábla 2026', path: `/accounty/payroll/${client.id}/tax-params` },
            { label: 'NAV bevallások', path: `/accounty/payroll/${client.id}/filings` },
            { label: 'Új foglalkoztatott', path: `/accounty/payroll/${client.id}/employees/new` },
            { label: 'Cégkapu / KÜNY-tárhely', path: `/accounty/client/${client.id}/settings#cegkapu` },
            { label: 'NAV-meghatalmazás', path: `/accounty/client/${client.id}/representation` },
            { label: 'Iratkezelés és GDPR', path: `/accounty/client/${client.id}/data-retention` },
            { label: 'Bérezési struktúra', path: `/accounty/client/${client.id}/structure` },
          ].map((link) => (
            <button
              key={link.label}
              onClick={() => navigate(link.path)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              {link.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
