import React, { useState, useMemo } from 'react';
import { Info, SlidersHorizontal, Sparkles, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MiniStat } from './EmployeeHelpers';
import type { calculateLeaveBalance } from '@/lib/payroll/leaveCalculator';
import { isMtEmployment, getNonMtNotice } from '@/lib/payroll/employmentUtils';
import { LeaveEntitlementDialog } from './LeaveEntitlementDialog';

interface Leave {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
  status: string;
}

interface EmployeeLeaveTabProps {
  leaves: Leave[];
  leaveBalance: ReturnType<typeof calculateLeaveBalance> | null;
  employmentType?: string | null;
  employmentId?: string;
  employmentMetadata?: any;
  onRefresh?: () => void;
}

export function EmployeeLeaveTab({
  leaves,
  leaveBalance,
  employmentType,
  employmentId,
  employmentMetadata,
  onRefresh,
}: EmployeeLeaveTabProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const isMt = isMtEmployment(employmentType);

  // Mt. 123. § (1)-(2): Előző évről áthozott szabadság kiadási határideje a tárgyév március 31.
  // getMonth() >= 3: 0=Jan, 1=Feb, 2=Mar, 3=Apr -> április 1-től lejárt
  const [isPastMarch31] = useState(() => new Date().getMonth() >= 3);
  const isPreviousYearCarried = (leaveBalance?.carriedOver || 0) > 0 && leaveBalance?.carriedOverSource === 'previous_year';

  if (!isMt) {
    return (
      <div className="p-6 space-y-4">
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-amber-500">Nem értelmezett szabadság-nyilvántartás</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {getNonMtNotice(employmentType) || 'A kiválasztott foglalkoztatási formában (pl. Egyéni vállalkozó / Megbízás) nem értelmezett az Mt. szerinti fizetett szabadság és betegszabadság, így nem szükséges nyilvántartani vagy könyvelni.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const carriedLabel = leaveBalance?.carriedOverSource === 'previous_job'
    ? 'Előző munkahelyről áthozott szabadság'
    : 'Előző évről áthozott szabadság';

  const categories: Array<{ label: string; days: number; hours: number; badge?: React.ReactNode }> = [
    { label: 'Alap-szabadság', days: leaveBalance?.baseLeave || 0, hours: leaveBalance?.baseLeaveHours || 0 },
    { label: 'Életkori pótszabadság (Mt. 117. §)', days: leaveBalance?.ageSupplement || 0, hours: leaveBalance?.ageSupplementHours || 0 },
    { label: 'Gyermek utáni pótszabadság (Mt. 118. §)', days: leaveBalance?.childSupplement || 0, hours: leaveBalance?.childSupplementHours || 0 },
    { label: 'Fogyatékos gyermek pótszabadság', days: leaveBalance?.disabledChildSupplement || 0, hours: leaveBalance?.disabledChildSupplementHours || 0 },
    { label: 'Megváltozott munkaképesség / Rehab pótszabadság (Mt. 120. §)', days: leaveBalance?.rehabLeave || 0, hours: leaveBalance?.rehabLeaveHours || 0 },
    { label: 'Apai szabadság', days: leaveBalance?.paternityLeave || 0, hours: (leaveBalance?.paternityLeave || 0) * 8 },
    { label: 'Szülői szabadság', days: leaveBalance?.parentalLeave || 0, hours: (leaveBalance?.parentalLeave || 0) * 8 },
    { label: 'Tanulmányi szabadság', days: leaveBalance?.studyLeave || 0, hours: (leaveBalance?.studyLeave || 0) * 8 },
    { label: 'Rendkívüli / egyéb pótszabadság', days: leaveBalance?.extraLeave || 0, hours: (leaveBalance?.extraLeave || 0) * 8 },
    {
      label: carriedLabel,
      days: leaveBalance?.carriedOver || 0,
      hours: leaveBalance?.carriedOverHours || 0,
      badge: isPreviousYearCarried ? (
        isPastMarch31 ? (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30">
            Mt. 123. §: Határidő lejárt (márc. 31.)
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            Mt. 123. § (2): Határidő: márc. 31.
          </span>
        )
      ) : null,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {leaveBalance && (
        <>
          {/* Quick Stats Banner */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MiniStat label="Éves keret összesen" value={`${leaveBalance.totalAvailable} nap`} />
            <MiniStat label="Felhasznált eddig" value={`${leaveBalance.used} nap`} />
            <MiniStat label="Fennmaradó kiadható" value={`${leaveBalance.remaining} nap`} color={leaveBalance.remaining < 5 ? 'red' : 'green'} />
            <MiniStat label="Órakeret összesen" value={`${leaveBalance.totalAvailableHours} óra`} />
          </div>

          {/* Mt. 123. § Lejárt határidő figyelmeztető banner */}
          {isPreviousYearCarried && isPastMarch31 && (
            <div className="p-3.5 rounded-lg border border-amber-500/30 bg-amber-500/10 flex items-start gap-3 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <strong className="block font-semibold">Törvényi határidő figyelmeztetés (Mt. 123. § (1)-(2)):</strong>
                <p className="mt-0.5 text-muted-foreground leading-relaxed">
                  A munkavállalónál {leaveBalance.carriedOver} nap előző évről áthozott szabadság van nyilvántartva. A Munka Törvénykönyve 123. § (2) bekezdése alapján az előző évi szabadságot legkésőbb a tárgyév március 31-ig kötelező kiadni. Kérjük, ellenőrizze a dolgozó távolléteit és szabadság-elszámolását!
                </p>
              </div>
            </div>
          )}

          {/* Tabular breakdown */}
          <div className="border border-border rounded-lg overflow-hidden bg-card/40">
            <div className="bg-background/40 px-4 py-3 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-foreground/90">Részletes Szabadság Nyilvántartás (Mt.)</h3>
                {leaveBalance.hasOverrides && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    Egyedi felülbírálás
                  </span>
                )}
                {leaveBalance.rehabLeave > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                    Rehab +5 nap
                  </span>
                )}
              </div>

              {employmentId && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(true)}
                  className="h-8 text-xs gap-1.5"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
                  Szabadságkeret & Áthozott napok szerkesztése
                </Button>
              )}
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground font-medium text-xs uppercase">
                  <th className="px-4 py-2.5 text-left">Jogcím</th>
                  <th className="px-4 py-2.5 text-right">Napok</th>
                  <th className="px-4 py-2.5 text-right">Órák</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {categories.map((cat, idx) => (
                  <tr key={idx} className="hover:bg-muted/40/30">
                    <td className="px-4 py-2.5 font-medium text-foreground/90">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>{cat.label}</span>
                        {cat.badge}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold">{cat.days} nap</td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{cat.hours} óra</td>
                  </tr>
                ))}
                <tr className="font-bold border-t-2 border-border bg-muted/40/10 dark:bg-card/30">
                  <td className="px-4 py-3 text-foreground">ÖSSZESÍTÉS</td>
                  <td className="px-4 py-3 text-right font-mono text-primary">{leaveBalance.totalAvailable} nap</td>
                  <td className="px-4 py-3 text-right font-mono text-foreground/90">{leaveBalance.totalAvailableHours} óra</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Tájékoztató útmutató a pótszabadságok számításáról */}
          <div className="p-3.5 rounded-lg border border-border bg-muted/30 text-xs text-muted-foreground space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <Info className="w-4 h-4 text-primary shrink-0" />
              <span>Pótszabadságok és áthozott szabadság jogszabályi nyilvántartása (Mt.):</span>
            </div>
            <p>
              • <strong>Életkori pótszabadság (Mt. 117. §):</strong> Nem kell kézzel megadni; a rendszer a dolgozó születési dátuma alapján automatikusan állapítja meg (25 éves kortól 1 nap… 45 éves kortól 10 nap).
            </p>
            <p>
              • <strong>Gyermekek utáni pótszabadság (Mt. 118. §):</strong> A családi kedvezmény és eltartott gyermekek adatai alapján kalkulálódik (1 gyermek: 2 nap, 2 gyermek: 4 nap, 3+ gyermek: 7 nap, tartósan beteg/fogyatékos gyermekenként további 2 nap).
            </p>
            <p>
              • <strong>Megváltozott munkaképesség (Mt. 120. §):</strong> A fogyatékos vagy megváltozott munkaképességű dolgozót évi 5 munkanap pótszabadság illeti meg.
            </p>
            <p>
              • <strong>Áthozott szabadság (Mt. 123. §):</strong> Az előző évről jogszerűen áthozott szabadságot a munkáltatónak legkésőbb a tárgyév március 31-ig kell kiadnia. A fejlécben található <em>"Szabadságkeret & Áthozott napok szerkesztése"</em> gombbal rögzíthető az előző évről vagy előző munkahelyről hozott szabadságnap, illetve manuálisan felülbírálható bármelyik tétel.
            </p>
          </div>
        </>
      )}

      {/* Leave history */}
      <div>
        <h3 className="text-sm font-bold text-foreground/90 mb-3">Távollét Történet</h3>
        {leaves.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
            Nincs rögzített távollét ebben az évben.
          </div>
        ) : (
          <div className="space-y-2">
            {leaves.map((l) => (
              <div key={l.id} className="p-3 rounded-lg border border-border flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground capitalize">
                    {l.leave_type.replace(/_/g, ' ')}
                  </p>
                  <p className="text-xs text-muted-foreground">{l.start_date} – {l.end_date} · {l.days} nap ({l.days * 8} óra)</p>
                </div>
                <span className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
                  l.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                )}>
                  {l.status === 'approved' ? 'Jóváhagyva' : l.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialog for editing entitlements */}
      <LeaveEntitlementDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        employmentId={employmentId}
        employmentMetadata={employmentMetadata}
        leaveBalance={leaveBalance}
        onSuccess={() => onRefresh?.()}
      />
    </div>
  );
}
