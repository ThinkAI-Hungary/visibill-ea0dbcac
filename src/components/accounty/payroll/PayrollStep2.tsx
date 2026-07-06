import React, { useState } from 'react';
import { CheckCircle2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PayrollStep2Props {
  activeEmployees: any[];
  allEmployments: any[];
  EMPLOYMENT_TYPE_LABELS: Record<string, string>;
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">{label}</span>
      <span className={cn('text-[11px] font-medium text-slate-900 dark:text-slate-100 text-right', mono && 'font-mono')}>{value}</span>
    </div>
  );
}

export default function PayrollStep2({
  activeEmployees,
  allEmployments,
  EMPLOYMENT_TYPE_LABELS,
}: PayrollStep2Props) {
  const [expandedReviewRows, setExpandedReviewRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    setExpandedReviewRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Ellenőrizd a beérkezett adatokat: változások, új belépők, kilépők, módosítások.
      </p>
      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
        <p className="text-sm text-amber-700 dark:text-amber-300">
          <strong>{activeEmployees.length}</strong> aktív foglalkoztatott · Kattints egy sorra a részletes adatokért.
        </p>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        {activeEmployees.map((emp) => {
          const isOpen = expandedReviewRows.has(emp.id);
          const employment = allEmployments.find((e: any) => e.employee_id === emp.id);

          return (
            <div key={emp.id} className="border-b border-border/50 last:border-b-0">
              <button
                onClick={() => toggleRow(emp.id)}
                className={cn(
                  'w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors',
                  isOpen && 'bg-slate-50/50 dark:bg-slate-800/30'
                )}
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {emp.last_name?.[0]}{emp.first_name?.[0]}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {emp.last_name} {emp.first_name}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {employment && (
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {EMPLOYMENT_TYPE_LABELS[employment.employment_type] || employment.employment_type} · Kód: {employment.job_code}
                      </span>
                    )}
                    {employment?.base_salary && (
                      <span className="text-[11px] font-mono text-primary font-semibold">
                        {Number(employment.base_salary).toLocaleString('hu-HU')} Ft
                      </span>
                    )}
                    {emp.taj_number && (
                      <span className="text-[11px] font-mono text-slate-400">
                        TAJ: {emp.taj_number}
                      </span>
                    )}
                    {employment?.start_date && (
                      <span className="text-[11px] text-slate-400">
                        {employment.start_date}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <ChevronDown className={cn('w-4 h-4 text-slate-400 transition-transform duration-200', isOpen && 'rotate-180')} />
                </div>
              </button>

              {isOpen && (
                <div className="px-4 pb-4 pt-1 dark:bg-slate-800/20 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 ml-12">
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Személyes adatok</p>
                      <DetailRow label="Teljes név" value={`${emp.last_name} ${emp.first_name}`} />
                      {emp.birth_name && <DetailRow label="Szül. név" value={emp.birth_name} />}
                      {emp.birth_date && <DetailRow label="Szül. dátum" value={emp.birth_date} />}
                      {emp.birth_place && <DetailRow label="Szül. hely" value={emp.birth_place} />}
                      {emp.mothers_name && <DetailRow label="Anyja neve" value={emp.mothers_name} />}
                      {emp.gender && <DetailRow label="Nem" value={emp.gender === 'male' ? 'Férfi' : emp.gender === 'female' ? 'Nő' : 'Egyéb'} />}
                      {emp.nationality && <DetailRow label="Állampolgárság" value={emp.nationality} />}
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Azonosítók & elérhetőség</p>
                      {emp.taj_number && <DetailRow label="TAJ-szám" value={emp.taj_number} mono />}
                      {emp.tax_id && <DetailRow label="Adóazonosító" value={emp.tax_id} mono />}
                      {emp.id_card_number && <DetailRow label="Személyi ig." value={emp.id_card_number} mono />}
                      {emp.email && <DetailRow label="Email" value={emp.email} />}
                      {emp.phone && <DetailRow label="Telefon" value={emp.phone} />}
                      {emp.bank_account && <DetailRow label="Bankszámla" value={emp.bank_account} mono />}
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Jogviszony</p>
                      {employment ? (
                        <>
                          <DetailRow label="Típus" value={EMPLOYMENT_TYPE_LABELS[employment.employment_type] || employment.employment_type} />
                          <DetailRow label="Jogv. kód" value={employment.job_code} mono />
                          <DetailRow label="Belépés" value={employment.start_date} />
                          {employment.end_date && <DetailRow label="Kilépés" value={employment.end_date} />}
                          {employment.job_title && <DetailRow label="Munkakör" value={employment.job_title} />}
                          {employment.feor_code && <DetailRow label="FEOR" value={employment.feor_code} mono />}
                          <DetailRow label="Heti óra" value={`${employment.weekly_hours}h`} />
                          <DetailRow label="Alapbér" value={employment.base_salary ? `${Number(employment.base_salary).toLocaleString('hu-HU')} Ft` : '–'} mono />
                          <DetailRow label="Bérezés" value={employment.salary_type === 'monthly' ? 'Havibér' : employment.salary_type === 'hourly' ? 'Órabér' : employment.salary_type} />
                          <DetailRow label="Biztosított" value={employment.is_insured ? ' Igen' : ' Nem'} />
                          {employment.is_fixed_term && <DetailRow label="Határozat" value="Határozott idejű" />}
                        </>
                      ) : (
                        <p className="text-xs text-slate-400 italic">Nincs aktív jogviszony</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
