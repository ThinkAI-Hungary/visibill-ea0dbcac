import React, { useMemo } from 'react';
import {
  calculatePayroll,
  calculateGarnishments,
  type PayrollCalculationInput,
  type EmployeeDeclarations,
  type TaxParameters,
} from '@/lib/payroll/taxEngine';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Sparkles, ArrowRight, ShieldCheck, Car, Bus, Home, AlertCircle, Briefcase, CreditCard, Moon } from 'lucide-react';
import { formatJobTitleWithFeor } from '@/lib/payroll/feorCodes';

export interface WorksheetLivePayslipProps {
  employee: any;
  employment: any;
  attendance: {
    workDays: number;
    workedHours?: number;
    overtime: number;
    sickDays: number;
    leaveDays: number;
  };
  defaultWorkDays?: number;
  commuteInput: {
    commuteType: 'none' | 'car' | 'public_transit';
    distanceKm: number;
    passCost: number;
    pct: number;
    carRate: number;
  };
  bonus: number;
  serviceCharge: number;
  nightShift?: number;
  otherExtras?: number;
  itemDeductions?: number;
  homeOffice?: number;
  cafeteriaItems?: any[];
  garnishments?: any[];
  declarations?: EmployeeDeclarations;
  isKiva: boolean;
  taxParams: TaxParameters;
  className?: string;
}

export default function WorksheetLivePayslip({
  employee,
  employment,
  attendance,
  commuteInput,
  bonus,
  serviceCharge,
  nightShift = 0,
  otherExtras = 0,
  itemDeductions = 0,
  homeOffice = 0,
  cafeteriaItems = [],
  garnishments = [],
  declarations = {},
  isKiva,
  taxParams,
  defaultWorkDays = 21,
  className,
}: WorksheetLivePayslipProps) {
  const calculationResult = useMemo(() => {
    if (!employment || !employee) return null;

    const baseSalary = Number(employment.base_salary || 0);
    const isHourly = employment.salary_type === 'hourly';
    const weeklyHours = Number(employment.weekly_hours || 40);
    const dailyHours = weeklyHours / 5;

    let hourlyRate = 0;
    let dailyRate = 0;
    let calcOvertime = 0;
    let calcSickLeave = 0;
    let calcLeave = 0;
    let calcBase = 0;

    if (isHourly) {
      hourlyRate = baseSalary;
      dailyRate = hourlyRate * dailyHours;
      const actualWorkedHours = (attendance.workedHours !== undefined && attendance.workedHours !== null && attendance.workedHours > 0)
        ? Number(attendance.workedHours)
        : (attendance.workDays || 0) * dailyHours;

      calcBase = Math.round(actualWorkedHours * hourlyRate);
      calcOvertime = Math.round(hourlyRate * (attendance.overtime || 0) * 1.5);
      calcSickLeave = Math.round(hourlyRate * (attendance.sickDays || 0) * dailyHours * 0.70);
      calcLeave = Math.round(hourlyRate * (attendance.leaveDays || 0) * dailyHours);
    } else {
      const currentWorkDays = attendance.workDays || defaultWorkDays;
      dailyRate = baseSalary / currentWorkDays;
      hourlyRate = baseSalary / (dailyHours * currentWorkDays);

      const baseReduction = Math.round(dailyRate * (attendance.sickDays || 0));
      calcBase = Math.max(0, baseSalary - baseReduction);
      calcOvertime = Math.round(hourlyRate * (attendance.overtime || 0) * 1.5);
      calcSickLeave = Math.round(dailyRate * (attendance.sickDays || 0) * 0.70);
      calcLeave = 0; // benne van a havi alapbérben
    }

    const actualWorkedDays = Math.max(
      0,
      (attendance.workDays || defaultWorkDays) - (attendance.sickDays || 0) - (attendance.leaveDays || 0)
    );

    // Calculate birth age
    let employeeAge = 35;
    if (employee.birth_date) {
      const birthYear = new Date(employee.birth_date).getFullYear();
      employeeAge = new Date().getFullYear() - birthYear;
    }

    const calcInput: PayrollCalculationInput = {
      grossComponents: {
        baseSalary: calcBase,
        overtime: calcOvertime,
        nightShift: Number(nightShift || 0),
        sundayPremium: 0,
        holidayPremium: 0,
        bonus: Number(bonus || 0),
        sickLeave: calcSickLeave,
        serviceCharge: Number(serviceCharge || 0),
        otherIncome: calcLeave + Number(otherExtras || 0),
      },
      declarations: declarations || {},
      employeeAge,
      employeeGender: employee.gender || 'other',
      isInsured: employment.is_insured ?? true,
      jobCode: employment.job_code || '',
      weeklyHours,
      params: taxParams,
      isPensioner: !!employment.is_pensioner,
      ekhoCategory: employment.ekho_category || 'normal',
      ekhoPayer: employment.ekho_payer || 'employee',
      isEkho: !!employment.is_ekho,
      isSzochoDiscount: !!employment.is_szocho_discount,
      szochoDiscountType: employment.szocho_discount_type || 'none',
      szochoDiscountMonthsElapsed: 0,
      cafeteria: (cafeteriaItems || []).map((c: any) => ({
        amount: Number(c.amount || 0),
        subType: (c.benefit_type === 'szep_recreation' || c.benefit_type?.startsWith('szep_')) ? 'recreation' : 'basic',
        isHousingAllowance: c.benefit_type === 'housing',
      })),
      minimumContributionBaseRule: (employment.minimum_contribution_base_rule || 'none') as any,
      hasMinimumBase: !!employment.has_minimum_base,
      isMinBaseExemptGyesGyed: !!employment.is_min_base_exempt_gyes_gyed,
      isMinBaseExemptStudent: !!employment.is_min_base_exempt_student,
      isMinBasePaidElsewhere: !!employment.is_min_base_paid_elsewhere,
      isKiva,
      travelReimbursement: {
        commuteType: commuteInput.commuteType,
        commuteKm: commuteInput.distanceKm,
        commuteDays: actualWorkedDays,
        commuteCarRate: commuteInput.carRate || 30,
        commuteTransitPassCost: commuteInput.passCost,
        commuteReimbursementPct: commuteInput.pct || 86,
      },
    };

    const taxResult = calculatePayroll(calcInput);

    // Calculate garnishments
    const parsedGarnishments = (garnishments || []).map((g: any) => ({
      type: (g.garnishment_type || 'private_debt') as any,
      monthlyDeduction: Number(g.monthly_deduction || 0),
      maxDeductionPct: Number(g.max_deduction_pct || 0.33),
      priority: Number(g.priority || 1),
    }));

    const garnishResult = calculateGarnishments(taxResult.netSalary, parsedGarnishments);
    const commuteReimbursement = taxResult.travelReimbursementAmount || 0;
    const finalNetPayout = taxResult.netSalary - garnishResult.total - Number(itemDeductions || 0) + Number(homeOffice || 0) + commuteReimbursement;

    return {
      calcBase,
      calcOvertime,
      calcSickLeave,
      calcNightShift: Number(nightShift || 0),
      bonus: Number(bonus || 0),
      serviceCharge: Number(serviceCharge || 0),
      taxResult,
      garnishResult,
      commuteReimbursement,
      finalNetPayout,
      actualWorkedDays,
      isHourly,
    };
  }, [
    employee,
    employment,
    attendance,
    commuteInput,
    bonus,
    serviceCharge,
    nightShift,
    otherExtras,
    itemDeductions,
    homeOffice,
    cafeteriaItems,
    garnishments,
    declarations,
    isKiva,
    taxParams,
  ]);

  if (!calculationResult) {
    return (
      <div className={cn('p-4 text-center text-xs text-muted-foreground', className)}>
        Válassz ki egy munkavállalót a bérszámfejtéshez.
      </div>
    );
  }

  const {
    calcBase,
    calcOvertime,
    calcSickLeave,
    calcNightShift,
    bonus: calcBonus,
    serviceCharge: calcSC,
    taxResult,
    garnishResult,
    commuteReimbursement,
    finalNetPayout,
  } = calculationResult;

  return (
    <Card className={cn('border-border/80 shadow-md bg-card flex flex-col', className)}>
      <CardHeader className="p-4 border-b border-border/60 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <CardTitle className="text-sm font-bold tracking-tight">Élő Bérszalvéta</CardTitle>
          </div>
          <Badge variant="outline" className="text-[10px] h-5 px-2 bg-primary/5 text-primary border-primary/20">
            Valós idejű adómotor
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4 text-xs">
        {/* Dolgozó és Munkakör fejléc */}
        <div className="pb-1 text-left border-b border-border/40">
          <div className="font-extrabold text-sm text-foreground uppercase tracking-tight">
            {employee.last_name} {employee.first_name}
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
            <Briefcase className="w-3 h-3 text-primary shrink-0" />
            <span>{formatJobTitleWithFeor(employment?.job_title, employment?.feor_code || employment?.job_code)}</span>
            {employment?.cost_center && (
              <>
                <span>•</span>
                <span className="text-primary font-medium">Költséghely: {employment.cost_center}</span>
              </>
            )}
          </div>
        </div>

        {/* Kiemelt Nettó Kifizetendő doboz */}
        <div className="p-3.5 rounded-lg bg-gradient-to-br from-green-500/10 via-emerald-500/10 to-teal-500/10 border border-green-500/30 dark:border-green-500/20 text-center space-y-1">
          <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
            Kifizetendő Nettó Összeg
          </span>
          <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
            {finalNetPayout.toLocaleString('hu-HU')} Ft
          </div>
          <p className="text-[10px] text-muted-foreground">
            Bérátutalás összege (térítésekkel & levonásokkal)
          </p>
        </div>

        {/* Bruttó Jövedelem blokk */}
        <div className="space-y-1.5 bg-muted/40 p-3 rounded-lg border border-border/50">
          <div className="flex items-center justify-between font-semibold text-foreground pb-1 border-b border-border/50">
            <span>Összes Bruttó Bér</span>
            <span className="font-mono">{taxResult.grossSalary.toLocaleString('hu-HU')} Ft</span>
          </div>
          <div className="space-y-1 pt-1 text-[11px] text-muted-foreground">
            <div className="flex justify-between">
              <span>Alapbér / Órabér</span>
              <span className="font-mono">{calcBase.toLocaleString('hu-HU')} Ft</span>
            </div>
            {calcOvertime > 0 && (
              <div className="flex justify-between text-blue-600 dark:text-blue-400">
                <span>Túlóra pótlék (150%)</span>
                <span className="font-mono">+{calcOvertime.toLocaleString('hu-HU')} Ft</span>
              </div>
            )}
            {calcSickLeave > 0 && (
              <div className="flex justify-between text-amber-600 dark:text-amber-400">
                <span>Betegszabadság (70%)</span>
                <span className="font-mono">+{calcSickLeave.toLocaleString('hu-HU')} Ft</span>
              </div>
            )}
            {calcNightShift > 0 && (
              <div className="flex justify-between text-indigo-600 dark:text-indigo-400">
                <span>Éjszakai pótlék (15%)</span>
                <span className="font-mono">+{calcNightShift.toLocaleString('hu-HU')} Ft</span>
              </div>
            )}
            {calcBonus > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>Prémium / Jutalom</span>
                <span className="font-mono">+{calcBonus.toLocaleString('hu-HU')} Ft</span>
              </div>
            )}
            {calcSC > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>Felszolgálási díj</span>
                <span className="font-mono">+{calcSC.toLocaleString('hu-HU')} Ft</span>
              </div>
            )}
          </div>
        </div>

        {/* Levonások & Járulékok blokk */}
        <div className="space-y-1.5 bg-muted/40 p-3 rounded-lg border border-border/50">
          <div className="flex items-center justify-between font-semibold text-foreground pb-1 border-b border-border/50">
            <span>Munkavállalói Levonások</span>
            <span className="font-mono text-red-600 dark:text-red-400">
              {(taxResult.szjaAmount + taxResult.tbAmount + garnishResult.total + itemDeductions).toLocaleString('hu-HU')} Ft
            </span>
          </div>
          <div className="space-y-1 pt-1 text-[11px] text-muted-foreground">
            <div className="flex justify-between">
              <span className="flex items-center gap-1">
                SZJA (15%)
                {taxResult.taxCredits.length > 0 && (
                  <Badge variant="outline" className="text-[9px] h-4 px-1 bg-green-500/10 text-green-600 border-none">
                    Kedvezménnyel
                  </Badge>
                )}
              </span>
              <span className="font-mono text-red-600 dark:text-red-400">
                {taxResult.szjaAmount.toLocaleString('hu-HU')} Ft
              </span>
            </div>

            <div className="flex justify-between">
              <span className="flex items-center gap-1">
                TB járulék (18.5%)
                {employment?.is_pensioner && (
                  <Badge variant="outline" className="text-[9px] h-4 px-1 bg-blue-500/10 text-blue-600 border-none">
                    Nyugdíjas (0 Ft)
                  </Badge>
                )}
              </span>
              <span className="font-mono text-blue-600 dark:text-blue-400">
                {taxResult.tbAmount.toLocaleString('hu-HU')} Ft
              </span>
            </div>

            {garnishResult.total > 0 && (
              <div className="flex justify-between text-orange-600 dark:text-orange-400">
                <span>Végrehajtói letiltás</span>
                <span className="font-mono">{garnishResult.total.toLocaleString('hu-HU')} Ft</span>
              </div>
            )}

            {itemDeductions > 0 && (
              <div className="flex justify-between text-orange-600 dark:text-orange-400">
                <span>Egyéb bérlevonás</span>
                <span className="font-mono">{itemDeductions.toLocaleString('hu-HU')} Ft</span>
              </div>
            )}
          </div>
        </div>

        {/* Adómentes térítések blokk */}
        {(commuteReimbursement > 0 || homeOffice > 0) && (
          <div className="space-y-1.5 bg-emerald-500/5 p-3 rounded-lg border border-emerald-500/20">
            <div className="flex items-center justify-between font-semibold text-emerald-800 dark:text-emerald-300 pb-1 border-b border-emerald-500/20">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Adómentes Juttatások
              </span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400">
                +{(commuteReimbursement + homeOffice).toLocaleString('hu-HU')} Ft
              </span>
            </div>
            <div className="space-y-1 pt-1 text-[11px] text-muted-foreground">
              {commuteReimbursement > 0 && (
                <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                  <span className="flex items-center gap-1">
                    {commuteInput.commuteType === 'car' ? <Car className="w-3 h-3" /> : <Bus className="w-3 h-3" />}
                    Munkába járás ({commuteInput.commuteType === 'car' ? `${commuteInput.distanceKm} km/nap` : 'Bérlet'})
                  </span>
                  <span className="font-mono font-semibold">+{commuteReimbursement.toLocaleString('hu-HU')} Ft</span>
                </div>
              )}
              {homeOffice > 0 && (
                <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                  <span className="flex items-center gap-1">
                    <Home className="w-3 h-3" />
                    Home Office átalány
                  </span>
                  <span className="font-mono font-semibold">+{homeOffice.toLocaleString('hu-HU')} Ft</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Cafeteria / SZÉP Kártya blokk */}
        {cafeteriaItems && cafeteriaItems.filter((c: any) => c.benefit_type !== 'home_office' && c.sub_type !== 'home_office').length > 0 && (
          <div className="space-y-1.5 bg-teal-500/5 p-3 rounded-lg border border-teal-500/20">
            <div className="flex items-center justify-between font-semibold text-teal-800 dark:text-teal-300 pb-1 border-b border-teal-500/20">
              <span className="flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-teal-600" />
                Béren kívüli juttatás (SZÉP)
              </span>
              <span className="font-mono text-teal-600 dark:text-teal-400">
                +{cafeteriaItems
                  .filter((c: any) => c.benefit_type !== 'home_office' && c.sub_type !== 'home_office')
                  .reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0)
                  .toLocaleString('hu-HU')} Ft
              </span>
            </div>
            <div className="space-y-1 pt-1 text-[11px] text-muted-foreground">
              {cafeteriaItems
                .filter((c: any) => c.benefit_type !== 'home_office' && c.sub_type !== 'home_office')
                .map((c: any, idx: number) => {
                  const isSzep = c.benefit_type === 'szep_recreation' || c.benefit_type?.startsWith('szep_');
                  const subTypeLabel = c.sub_type === 'vendeglatas' ? 'Vendéglátás' :
                                       c.sub_type === 'szallashely' ? 'Szálláshely' :
                                       c.sub_type === 'szabadido' ? 'Szabadidő' : (c.sub_type || '');
                  const title = isSzep ? `SZÉP (${subTypeLabel || 'Rekreáció'})` : (c.benefit_type === 'housing' ? 'Lakhatási tám.' : c.benefit_type);

                  const empMeta = (employment?.metadata as any) || {};
                  const effectiveProvider = c.provider || (isSzep ? empMeta.szep_provider : null);

                  return (
                    <div key={c.id || idx} className="flex justify-between items-center text-teal-700 dark:text-teal-300">
                      <span className="truncate max-w-[170px]" title={title}>
                        {title} {effectiveProvider ? `(${effectiveProvider})` : ''}
                      </span>
                      <span className="font-mono font-semibold">
                        +{Number(c.amount || 0).toLocaleString('hu-HU')} Ft
                      </span>
                    </div>
                  );
                })}
              <p className="text-[10px] text-muted-foreground italic pt-0.5">
                Külön kártyaszámlára utalandó, a nettó bérátutalást nem növeli.
              </p>
            </div>
          </div>
        )}

        {/* Munkáltatói Költségek blokk */}
        <div className="p-3 rounded-lg bg-muted/60 border border-border/50 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
            <span>Munkáltatói Terhek</span>
            {isKiva ? (
              <Badge variant="outline" className="text-[9px] h-4 px-1 bg-amber-500/10 text-amber-600 border-amber-500/20">
                KIVA Adózó (0 Ft SZOCHO)
              </Badge>
            ) : employment?.is_pensioner ? (
              <Badge variant="outline" className="text-[9px] h-4 px-1 bg-blue-500/10 text-blue-600 border-blue-500/20">
                Nyugdíjas (0 Ft SZOCHO)
              </Badge>
            ) : null}
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>SZOCHO (13%)</span>
            <span className="font-mono font-medium text-foreground">
              {taxResult.szochoAmount.toLocaleString('hu-HU')} Ft
            </span>
          </div>
          <div className="flex justify-between text-xs font-bold text-foreground pt-1 border-t border-border/60">
            <span>Teljes bérköltség (Superbruttó)</span>
            <span className="font-mono">
              {(taxResult.grossSalary + taxResult.szochoAmount + commuteReimbursement + homeOffice).toLocaleString('hu-HU')} Ft
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
