import React from 'react';
import {
  Calendar,
  Clock,
  Car,
  Bus,
  ShieldCheck,
  Percent,
  Banknote,
  Briefcase,
  User,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Printer,
  Save,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface WorksheetEmployeeFormProps {
  employee: any;
  employment: any;
  attendance: {
    workDays: number;
    workedHours?: number;
    overtime: number;
    sickDays: number;
    leaveDays: number;
  };
  onAttendanceChange: (field: 'workDays' | 'workedHours' | 'overtime' | 'sickDays' | 'leaveDays', value: number) => void;
  commuteInput: {
    commuteType: 'none' | 'car' | 'public_transit';
    distanceKm: number;
    passCost: number;
    pct: number;
    carRate: number;
  };
  onCommuteChange: (field: keyof WorksheetEmployeeFormProps['commuteInput'], value: any) => void;
  onSaveCommuteToMaster: () => Promise<void>;
  bonus: number;
  onBonusChange: (value: number) => void;
  serviceCharge: number;
  onServiceChargeChange: (value: number) => void;
  homeOffice: number;
  onHomeOfficeChange: (value: number) => void;
  itemDeductions: number;
  onItemDeductionsChange: (value: number) => void;
  garnishments: any[];
  isCompleted: boolean;
  onToggleCompleted: () => void;
  onPrevEmployee: () => void;
  onNextEmployee: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  onPrintPayslip: () => void;
  isSavingCommute?: boolean;
}

export default function WorksheetEmployeeForm({
  employee,
  employment,
  attendance,
  onAttendanceChange,
  commuteInput,
  onCommuteChange,
  onSaveCommuteToMaster,
  bonus,
  onBonusChange,
  serviceCharge,
  onServiceChargeChange,
  homeOffice,
  onHomeOfficeChange,
  itemDeductions,
  onItemDeductionsChange,
  garnishments,
  isCompleted,
  onToggleCompleted,
  onPrevEmployee,
  onNextEmployee,
  hasPrev,
  hasNext,
  onPrintPayslip,
  isSavingCommute = false,
}: WorksheetEmployeeFormProps) {
  if (!employee || !employment) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
        <User className="w-12 h-12 mb-3 text-slate-300" />
        <p>Válassz ki egy munkavállalót a bal oldali listából.</p>
      </div>
    );
  }

  const isHourly = employment.salary_type === 'hourly';
  const actualWorkedDays = Math.max(
    0,
    (attendance.workDays || 22) - (attendance.sickDays || 0) - (attendance.leaveDays || 0)
  );

  const calculatedCommuteAmount = React.useMemo(() => {
    if (commuteInput.commuteType === 'car') {
      return Math.round((commuteInput.distanceKm || 0) * actualWorkedDays * (commuteInput.carRate || 30));
    }
    if (commuteInput.commuteType === 'public_transit') {
      return Math.round(((commuteInput.passCost || 0) * (commuteInput.pct || 86)) / 100);
    }
    return 0;
  }, [commuteInput, actualWorkedDays]);

  return (
    <div className="space-y-6">
      {/* Dolgozói törzsadat fejléc kártya */}
      <div className="p-4 rounded-xl border border-border bg-card shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-base shrink-0">
            {employee.last_name?.[0] || ''}
            {employee.first_name?.[0] || ''}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-foreground truncate">
                {employee.last_name} {employee.first_name}
              </h2>
              {isCompleted ? (
                <Badge variant="outline" className="h-5 px-2 bg-green-500/10 text-green-600 border-green-500/30 gap-1 text-[11px] font-semibold">
                  <CheckCircle2 className="w-3 h-3" />
                  Munkalap kész
                </Badge>
              ) : (
                <Badge variant="outline" className="h-5 px-2 bg-amber-500/10 text-amber-600 border-amber-500/30 gap-1 text-[11px] font-semibold">
                  <Clock className="w-3 h-3" />
                  Szerkesztés alatt
                </Badge>
              )}
              {employment.is_pensioner && (
                <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/30">
                  Saját jogú nyugdíjas (TB/SZOCHO: 0 Ft)
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
              <span className="flex items-center gap-1">
                <Briefcase className="w-3 h-3 text-primary" />
                {employment.job_title || 'Nincs megadva'} {employment.job_code ? `(FEOR: ${employment.job_code})` : ''}
              </span>
              <span>•</span>
              <span>Heti {employment.weekly_hours || 40} óra</span>
              <span>•</span>
              <span className="font-medium font-mono text-foreground">
                {isHourly
                  ? `${Number(employment.base_salary || 0).toLocaleString('hu-HU')} Ft/óra`
                  : `${Number(employment.base_salary || 0).toLocaleString('hu-HU')} Ft/hó (Alapbér)`}
              </span>
              {employee.tax_number && (
                <>
                  <span>•</span>
                  <span>Adóazonosító: {employee.tax_number}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Gyors gombok a fejlécben */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onPrintPayslip}
            className="h-8 text-xs gap-1.5"
            title="Bérlap nyomtatása"
          >
            <Printer className="w-3.5 h-3.5" />
            Bérlap
          </Button>
          <Button
            variant={isCompleted ? 'default' : 'outline'}
            size="sm"
            onClick={onToggleCompleted}
            className={cn(
              'h-8 text-xs gap-1.5 transition-colors',
              isCompleted
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'border-green-600/40 text-green-700 dark:text-green-400 hover:bg-green-500/10'
            )}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            {isCompleted ? 'Kész visszavonása' : 'Megjelölés késznek'}
          </Button>
        </div>
      </div>

      {/* 1. Szekció: Havi jelenlét és munkaórák */}
      <Card className="border-border">
        <CardHeader className="p-4 pb-2 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              <CardTitle className="text-sm font-bold">1. Havi Jelenlét & Munkaórák</CardTitle>
            </div>
            <span className="text-xs text-muted-foreground">
              Ledolgozott napok: <strong className="text-foreground font-mono">{actualWorkedDays} nap</strong>
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Havi munkanapok (keret)</Label>
            <Input
              type="number"
              min={0}
              max={31}
              value={attendance.workDays ?? 22}
              onChange={(e) => onAttendanceChange('workDays', parseInt(e.target.value) || 0)}
              className="h-8 text-xs font-mono"
            />
            <p className="text-[10px] text-muted-foreground">Általában 20-23 nap</p>
          </div>

          {isHourly ? (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-primary">Ledolgozott órák száma</Label>
              <Input
                type="number"
                min={0}
                max={300}
                value={attendance.workedHours ?? (attendance.workDays * ((employment.weekly_hours || 40) / 5))}
                onChange={(e) => onAttendanceChange('workedHours', parseFloat(e.target.value) || 0)}
                className="h-8 text-xs font-mono font-bold border-primary/40 focus-visible:ring-primary"
              />
              <p className="text-[10px] text-muted-foreground">Órabér alapja</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs">Ledolgozott munkanap</Label>
              <div className="h-8 px-3 rounded-md bg-muted flex items-center text-xs font-mono font-semibold text-foreground">
                {actualWorkedDays} nap
              </div>
              <p className="text-[10px] text-muted-foreground">Levonva betegszabi & szabi</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Túlóra (órában)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={attendance.overtime ?? 0}
              onChange={(e) => onAttendanceChange('overtime', parseInt(e.target.value) || 0)}
              className="h-8 text-xs font-mono"
            />
            <p className="text-[10px] text-muted-foreground">150%-os pótlékalap</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Betegszabadság (nap)</Label>
            <Input
              type="number"
              min={0}
              max={25}
              value={attendance.sickDays ?? 0}
              onChange={(e) => onAttendanceChange('sickDays', parseInt(e.target.value) || 0)}
              className="h-8 text-xs font-mono"
            />
            <p className="text-[10px] text-muted-foreground">70%-os távolléti díj</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Fizetett szabadság (nap)</Label>
            <Input
              type="number"
              min={0}
              max={30}
              value={attendance.leaveDays ?? 0}
              onChange={(e) => onAttendanceChange('leaveDays', parseInt(e.target.value) || 0)}
              className="h-8 text-xs font-mono"
            />
            <p className="text-[10px] text-muted-foreground">Alapbérbe építve</p>
          </div>
        </CardContent>
      </Card>

      {/* 2. Szekció: Munkába járás költségtérítés (39/2010 Korm. rend.) */}
      <Card className="border-border">
        <CardHeader className="p-4 pb-2 border-b border-border/50">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Car className="w-4 h-4 text-emerald-600" />
              <div>
                <CardTitle className="text-sm font-bold">2. Munkába Járás Költségtérítés</CardTitle>
                <CardDescription className="text-[11px]">
                  39/2010. (II. 26.) Korm. rendelet & Szja tv. 25. § (2) — Adómentes térítés (0% SZJA, 0% TB, 0% SZOCHO)
                </CardDescription>
              </div>
            </div>
            {calculatedCommuteAmount > 0 && (
              <Badge variant="outline" className="text-xs font-mono font-bold bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                +{calculatedCommuteAmount.toLocaleString('hu-HU')} Ft adómentes
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="flex gap-2 flex-wrap">
            {[
              { id: 'none', label: 'Nincs költségtérítés', icon: Info },
              { id: 'car', label: 'Saját gépkocsi (km-alapú)', icon: Car },
              { id: 'public_transit', label: 'Közösségi közlekedés bérlet', icon: Bus },
            ].map((mode) => {
              const Icon = mode.icon;
              const isSelected = commuteInput.commuteType === mode.id;
              return (
                <Button
                  key={mode.id}
                  type="button"
                  variant={isSelected ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onCommuteChange('commuteType', mode.id)}
                  className={cn(
                    'text-xs h-8 gap-1.5 font-medium',
                    isSelected && 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {mode.label}
                </Button>
              );
            })}
          </div>

          {commuteInput.commuteType === 'car' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Napi oda-vissza távolság (km)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={commuteInput.distanceKm || ''}
                  onChange={(e) => onCommuteChange('distanceKm', parseFloat(e.target.value) || 0)}
                  placeholder="pl. 40"
                  className="h-8 text-xs font-mono font-bold"
                />
                <p className="text-[10px] text-muted-foreground">Lakóhely - munkahely km</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Ledolgozott munkanapok</Label>
                <div className="h-8 px-3 rounded-md bg-muted flex items-center text-xs font-mono font-semibold text-foreground">
                  {actualWorkedDays} nap
                </div>
                <p className="text-[10px] text-muted-foreground">A jelenlétből automatikus</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Térítési norma (Ft/km)</Label>
                <Input
                  type="number"
                  min={18}
                  max={30}
                  value={commuteInput.carRate ?? 30}
                  onChange={(e) => onCommuteChange('carRate', parseInt(e.target.value) || 30)}
                  className="h-8 text-xs font-mono"
                />
                <p className="text-[10px] text-muted-foreground">Jogszabályi max: 30 Ft/km</p>
              </div>

              <div className="flex flex-col justify-end space-y-1.5">
                <Label className="text-xs font-medium text-emerald-800 dark:text-emerald-400">Kalkulált összeg</Label>
                <div className="h-8 px-3 rounded-md bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-mono font-bold flex items-center text-xs">
                  {calculatedCommuteAmount.toLocaleString('hu-HU')} Ft
                </div>
                <p className="text-[10px] text-muted-foreground">0% adó és járulék</p>
              </div>
            </div>
          )}

          {commuteInput.commuteType === 'public_transit' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Havi bérlet bruttó ára (Ft)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={100}
                    value={commuteInput.passCost || ''}
                    onChange={(e) => onCommuteChange('passCost', parseFloat(e.target.value) || 0)}
                    placeholder="pl. 14 200"
                    className="h-8 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-muted-foreground">Helyközi Volán / MÁV bérlet</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Térítési arány (%)</Label>
                  <select
                    value={commuteInput.pct || 86}
                    onChange={(e) => onCommuteChange('pct', parseInt(e.target.value))}
                    className="w-full h-8 px-2 rounded-md border border-input bg-card text-xs font-mono"
                  >
                    <option value={86}>86% (Kötelező minimum)</option>
                    <option value={100}>100% (Teljes bérletátvállalás)</option>
                  </select>
                  <p className="text-[10px] text-muted-foreground">39/2010. Korm. rend. szerint</p>
                </div>

                <div className="flex flex-col justify-end space-y-1.5">
                  <Label className="text-xs font-medium text-emerald-800 dark:text-emerald-400">Kalkulált összeg</Label>
                  <div className="h-8 px-3 rounded-md bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-mono font-bold flex items-center text-xs">
                    {calculatedCommuteAmount.toLocaleString('hu-HU')} Ft
                  </div>
                  <p className="text-[10px] text-muted-foreground">0% adó és járulék</p>
                </div>
              </div>

              {actualWorkedDays === 0 && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <span className="font-semibold">Figyelem: A dolgozónak 0 ledolgozott napja van a hónapban.</span>
                    <p className="text-[11px] text-amber-700/90 dark:text-amber-300/90 mt-0.5 leading-relaxed">
                      A 39/2010. (II. 26.) Korm. rendelet 3. § alapján teljes havi távollét (pl. táppénz, fizetés nélküli szabadság) esetén a munkáltató nem köteles megtéríteni a helyközi bérletet. Amennyiben a dolgozó nem vett bérletet, a bérlet bruttó ára 0 Ft-ra állítható.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {commuteInput.commuteType !== 'none' && (
            <div className="flex items-center justify-between pt-1">
              <p className="text-[11px] text-muted-foreground italic">
                * A beállított munkába járás adatok a lenti gombbal menthetők a munkavállaló állandó törzsadatlapjára is.
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onSaveCommuteToMaster}
                disabled={isSavingCommute}
                className="h-7 text-xs gap-1.5"
              >
                <Save className="w-3 h-3" />
                {isSavingCommute ? 'Mentés...' : 'Mentés törzsadatba'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Szekció: Bérpótlékok, Prémium & Felszolgálási Díj */}
      <Card className="border-border">
        <CardHeader className="p-4 pb-2 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Banknote className="w-4 h-4 text-emerald-600" />
            <CardTitle className="text-sm font-bold">3. Bérpótlékok, Prémium & Felszolgálási Díj</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5 p-3 rounded-lg bg-muted/40 border border-border/60">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                Vendéglátóipari Felszolgálási Díj (Ft)
              </Label>
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                15% SZJA MENTES
              </Badge>
            </div>
            <Input
              type="number"
              min={0}
              step={1000}
              value={serviceCharge || ''}
              onChange={(e) => onServiceChargeChange(parseFloat(e.target.value) || 0)}
              placeholder="0 Ft"
              className="h-8 text-xs font-mono font-bold"
            />
            <p className="text-[10px] text-muted-foreground">
              Szja tv. 1. sz. melléklet 4.38 pontja alapján adómentes, kizárólag 18.5% TB terheli.
            </p>
          </div>

          <div className="space-y-1.5 p-3 rounded-lg bg-muted/40 border border-border/60">
            <Label className="text-xs font-medium">Prémium / Jutalom (Ft)</Label>
            <Input
              type="number"
              min={0}
              step={1000}
              value={bonus || ''}
              onChange={(e) => onBonusChange(parseFloat(e.target.value) || 0)}
              placeholder="0 Ft"
              className="h-8 text-xs font-mono font-bold"
            />
            <p className="text-[10px] text-muted-foreground">
              Normál bruttó bérként adózó havi prémium / bónusz.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 4. Szekció: Cafeteria & Home Office */}
      <Card className="border-border">
        <CardHeader className="p-4 pb-2 border-b border-border/50">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <CardTitle className="text-sm font-bold">4. Cafeteria & Home Office Átalány</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Home Office költségtérítés (Ft)</Label>
            <Input
              type="number"
              min={0}
              max={32280}
              step={1000}
              value={homeOffice || ''}
              onChange={(e) => onHomeOfficeChange(parseFloat(e.target.value) || 0)}
              placeholder="0 Ft"
              className="h-8 text-xs font-mono"
            />
            <p className="text-[10px] text-muted-foreground">
              Adómentes átalánytérítés (max minimálbér 10%-a / hó, 32 280 Ft).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 5. Szekció: Levonások & Letiltások */}
      <Card className="border-border">
        <CardHeader className="p-4 pb-2 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Percent className="w-4 h-4 text-red-600" />
            <CardTitle className="text-sm font-bold">5. Levonások & Előlegek</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Egyéb bérlevonás / Hóközi előleg (Ft)</Label>
              <Input
                type="number"
                min={0}
                step={1000}
                value={itemDeductions || ''}
                onChange={(e) => onItemDeductionsChange(parseFloat(e.target.value) || 0)}
                placeholder="0 Ft"
                className="h-8 text-xs font-mono text-red-600 font-bold"
              />
              <p className="text-[10px] text-muted-foreground">Közvetlenül a nettó bérből vonódik le</p>
            </div>
          </div>

          {garnishments && garnishments.length > 0 && (
            <div className="p-3 rounded-lg bg-orange-500/5 border border-orange-500/20 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-orange-700 dark:text-orange-400">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Aktív bírósági letiltások ({garnishments.length} db)</span>
              </div>
              <div className="space-y-1 text-[11px]">
                {garnishments.map((g: any, idx: number) => (
                  <div key={g.id || idx} className="flex justify-between items-center text-muted-foreground">
                    <span>
                      {g.case_number ? `Ügyiratszám: ${g.case_number}` : 'Bérletiltás'} ({g.garnishment_type})
                    </span>
                    <span className="font-mono font-medium text-orange-600">
                      Max {Number(g.monthly_deduction || 0).toLocaleString('hu-HU')} Ft (vagy {Math.round((g.max_deduction_pct || 0.33) * 100)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alsó navigációs sáv */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <Button
          variant="outline"
          size="sm"
          onClick={onPrevEmployee}
          disabled={!hasPrev}
          className="gap-1 text-xs"
        >
          <ChevronLeft className="w-4 h-4" />
          Előző dolgozó
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant={isCompleted ? 'outline' : 'default'}
            size="sm"
            onClick={onToggleCompleted}
            className={cn(
              'text-xs gap-1.5',
              !isCompleted && 'bg-green-600 hover:bg-green-700 text-white'
            )}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            {isCompleted ? 'Módosítás folytatása' : 'Késznek jelölés'}
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={onNextEmployee}
            disabled={!hasNext}
            className="gap-1 text-xs"
          >
            Következő dolgozó
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
