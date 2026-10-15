import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, RotateCcw, Sparkles, AlertTriangle } from 'lucide-react';
import type { LeaveBalance } from '@/lib/payroll/leaveCalculator';

interface LeaveEntitlementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employmentId?: string;
  employmentMetadata?: any;
  leaveBalance: LeaveBalance | null;
  onSuccess: () => void;
}

interface FormProps {
  employmentId?: string;
  employmentMetadata?: any;
  leaveBalance: LeaveBalance | null;
  onSuccess: () => void;
  onClose: () => void;
}

function LeaveEntitlementForm({
  employmentId,
  employmentMetadata,
  leaveBalance,
  onSuccess,
  onClose,
}: FormProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const overrides = employmentMetadata?.leave_overrides;
  const custom = overrides?.custom_overrides;
  const initialHasCustom = Boolean(
    custom && (
      custom.baseLeave !== undefined ||
      custom.ageSupplement !== undefined ||
      custom.childSupplement !== undefined ||
      custom.extraLeave !== undefined ||
      custom.totalAnnual !== undefined
    )
  );

  // Áthozott szabadság
  const [carriedOverDays, setCarriedOverDays] = useState<string>(
    overrides?.carried_over_days !== undefined ? String(overrides.carried_over_days) : '0'
  );
  const [carriedOverSource, setCarriedOverSource] = useState<'previous_year' | 'previous_job'>(
    overrides?.carried_over_source || 'previous_year'
  );

  // Megváltozott munkaképesség / Rehab pótszabadság (+5 nap, Mt. 120. §)
  const [hasRehabLeave, setHasRehabLeave] = useState<boolean>(
    Boolean(overrides?.has_rehab_disability_leave)
  );
  const [rehabDays, setRehabDays] = useState<string>(
    overrides?.rehab_days !== undefined ? String(overrides.rehab_days) : '5'
  );

  // Egyedi felülbírálások
  const [enableCustomOverrides, setEnableCustomOverrides] = useState<boolean>(initialHasCustom);
  const [customBase, setCustomBase] = useState<string>(
    custom?.baseLeave !== undefined ? String(custom.baseLeave) : ''
  );
  const [customAge, setCustomAge] = useState<string>(
    custom?.ageSupplement !== undefined ? String(custom.ageSupplement) : ''
  );
  const [customChild, setCustomChild] = useState<string>(
    custom?.childSupplement !== undefined ? String(custom.childSupplement) : ''
  );
  const [customExtra, setCustomExtra] = useState<string>(
    custom?.extraLeave !== undefined ? String(custom.extraLeave) : ''
  );
  const [customTotal, setCustomTotal] = useState<string>(
    custom?.totalAnnual !== undefined ? String(custom.totalAnnual) : ''
  );

  const handleResetToStatutory = () => {
    setEnableCustomOverrides(false);
    setCustomBase('');
    setCustomAge('');
    setCustomChild('');
    setCustomExtra('');
    setCustomTotal('');
    toast({
      title: 'Törvényi alapértékek visszaállítva',
      description: 'A kalkulátor mostantól a törvényes Mt. szabályok szerint számol.',
    });
  };

  const handleSave = async () => {
    if (!employmentId) {
      toast({
        variant: 'destructive',
        title: 'Hiba történt',
        description: 'Nincs érvényes munkaviszony kiválasztva.',
      });
      return;
    }

    setSaving(true);
    try {
      const currentMeta = employmentMetadata && typeof employmentMetadata === 'object' ? employmentMetadata : {};

      const cleanCustom = enableCustomOverrides ? {
        baseLeave: customBase.trim() !== '' ? Math.max(0, parseInt(customBase, 10) || 0) : undefined,
        ageSupplement: customAge.trim() !== '' ? Math.max(0, parseInt(customAge, 10) || 0) : undefined,
        childSupplement: customChild.trim() !== '' ? Math.max(0, parseInt(customChild, 10) || 0) : undefined,
        extraLeave: customExtra.trim() !== '' ? Math.max(0, parseInt(customExtra, 10) || 0) : undefined,
        totalAnnual: customTotal.trim() !== '' ? Math.max(0, parseInt(customTotal, 10) || 0) : undefined,
      } : null;

      const updatedOverrides = {
        carried_over_days: Math.max(0, parseInt(carriedOverDays, 10) || 0),
        carried_over_source: carriedOverSource,
        has_rehab_disability_leave: Boolean(hasRehabLeave),
        rehab_days: hasRehabLeave ? Math.max(0, parseInt(rehabDays, 10) || 5) : 0,
        custom_overrides: cleanCustom,
      };

      const updatedMetadata = {
        ...currentMeta,
        leave_overrides: updatedOverrides,
      };

      const { error } = await supabase
        .from('accounty_employments')
        .update({ metadata: updatedMetadata })
        .eq('id', employmentId);

      if (error) throw error;

      toast({
        title: 'Szabadságkeret elmentve',
        description: 'A szabadságkeret és áthozott napok sikeresen frissültek.',
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Mentési hiba',
        description: err.message || 'Nem sikerült menteni a szabadságkeretet.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="space-y-6 py-2 text-sm">
        {/* 1. Szekció: Áthozott szabadság */}
        <div className="p-4 rounded-xl border border-border bg-card/60 space-y-3">
          <h4 className="font-semibold text-foreground flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            1. Áthozott szabadság rögzítése
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="carriedDays" className="text-xs font-medium">Áthozott napok száma</Label>
              <Input
                id="carriedDays"
                type="number"
                min="0"
                max="60"
                value={carriedOverDays}
                onChange={(e) => setCarriedOverDays(e.target.value)}
                placeholder="0"
                className="font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="carriedSource" className="text-xs font-medium">Áthozatal jogcíme / oka</Label>
              <Select
                value={carriedOverSource}
                onValueChange={(val: 'previous_year' | 'previous_job') => setCarriedOverSource(val)}
              >
                <SelectTrigger id="carriedSource">
                  <SelectValue placeholder="Válassz jogcímet..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="previous_year">Előző évről áthozott szabadság (Mt. 123. §)</SelectItem>
                  <SelectItem value="previous_job">Előző munkahelyről hozott szabadság</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {carriedOverSource === 'previous_year' && (
            <div className="p-2.5 rounded-lg border border-amber-500/20 bg-amber-500/10 text-xs text-amber-800 dark:text-amber-300 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>Kiadási határidő (Mt. 123. § (1)-(2)):</span>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Az előző évről áthozott szabadságot legkésőbb a tárgyév március 31-ig ki kell adni (kivételesen fontos gazdasági érdek vagy elháríthatatlan ok esetén).
              </p>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Az áthozott napok közvetlenül növelik a tárgyévi rendelkezésre álló szabadságkeretet és órakeretet.
          </p>
        </div>

        {/* 2. Szekció: Megváltozott munkaképesség / Rehab pótszabadság */}
        <div className="p-4 rounded-xl border border-border bg-card/60 space-y-3">
          <h4 className="font-semibold text-foreground flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            2. Megváltozott munkaképességű dolgozó (Mt. 120. §)
          </h4>
          <div className="flex items-start space-x-3 pt-1">
            <Checkbox
              id="rehabToggle"
              checked={hasRehabLeave}
              onCheckedChange={(checked) => setHasRehabLeave(Boolean(checked))}
              className="mt-1"
            />
            <div className="space-y-1">
              <Label htmlFor="rehabToggle" className="font-medium cursor-pointer text-foreground">
                Rehabilitációs / fogyatékossági pótszabadság jogosultság (+5 nap)
              </Label>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                A jogszabály alapján évi 5 munkanap alanyi pótszabadság illeti meg a megváltozott munkaképességű,
                egészségkárosodott (legalább 50%-os mértékű), fogyatékossági támogatásra vagy vakok személyi járadékára jogosult munkavállalót.
              </p>
            </div>
          </div>

          {hasRehabLeave && (
            <div className="pt-2 pl-7 flex items-center gap-3">
              <Label htmlFor="rehabDaysInput" className="text-xs text-muted-foreground whitespace-nowrap">
                Pótszabadság napok:
              </Label>
              <Input
                id="rehabDaysInput"
                type="number"
                min="1"
                max="30"
                value={rehabDays}
                onChange={(e) => setRehabDays(e.target.value)}
                className="w-24 font-mono text-xs h-8"
              />
              <span className="text-xs text-muted-foreground font-mono">nap / év</span>
            </div>
          )}
        </div>

        {/* 3. Szekció: Egyedi felülbírálások (Szabik szerkeszthetősége) */}
        <div className="p-4 rounded-xl border border-border bg-card/60 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-foreground flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              3. Szabadságkeret kézi felülbírálása
            </h4>
            {enableCustomOverrides && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetToStatutory}
                className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Alapértékek visszaállítása
              </Button>
            )}
          </div>

          <div className="flex items-start space-x-3 pt-1">
            <Checkbox
              id="customOverridesToggle"
              checked={enableCustomOverrides}
              onCheckedChange={(checked) => setEnableCustomOverrides(Boolean(checked))}
              className="mt-1"
            />
            <div className="space-y-1">
              <Label htmlFor="customOverridesToggle" className="font-medium cursor-pointer text-foreground">
                Egyedi keretértékek beállítása (szerkeszthető jogcímek)
              </Label>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Kapcsold be, ha a munkaszerződés vagy kollektív szerződés alapján a dolgozó a törvényinél több napot kap,
                vagy ha a könyvelő egyedi napokat kíván megadni.
              </p>
            </div>
          </div>

          {enableCustomOverrides && (
            <div className="pt-3 space-y-3 pl-7 border-t border-border/50">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Alap-szabadság (törvényi: {leaveBalance?.baseLeave ?? 20} nap)
                  </Label>
                  <Input
                    type="number"
                    value={customBase}
                    onChange={(e) => setCustomBase(e.target.value)}
                    placeholder={String(leaveBalance?.baseLeave ?? 20)}
                    className="font-mono text-xs h-8"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Életkori pótszabadság (törvényi: {leaveBalance?.ageSupplement ?? 0} nap)
                  </Label>
                  <Input
                    type="number"
                    value={customAge}
                    onChange={(e) => setCustomAge(e.target.value)}
                    placeholder={String(leaveBalance?.ageSupplement ?? 0)}
                    className="font-mono text-xs h-8"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Gyermek utáni pótszabadság (törvényi: {leaveBalance?.childSupplement ?? 0} nap)
                  </Label>
                  <Input
                    type="number"
                    value={customChild}
                    onChange={(e) => setCustomChild(e.target.value)}
                    placeholder={String(leaveBalance?.childSupplement ?? 0)}
                    className="font-mono text-xs h-8"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Egyéb rendkívüli pótszabadság
                  </Label>
                  <Input
                    type="number"
                    value={customExtra}
                    onChange={(e) => setCustomExtra(e.target.value)}
                    placeholder="0"
                    className="font-mono text-xs h-8"
                  />
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <Label className="text-xs text-muted-foreground">
                  Fix Éves Összes Keret (opcionális felülírás)
                </Label>
                <Input
                  type="number"
                  value={customTotal}
                  onChange={(e) => setCustomTotal(e.target.value)}
                  placeholder="Ha üres, a fenti jogcímek összege adja az éves keretet"
                  className="font-mono text-xs h-8"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={saving}
        >
          Mégse
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="gap-1.5"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Mentés és Újraszámítás
        </Button>
      </DialogFooter>
    </>
  );
}

export function LeaveEntitlementDialog({
  open,
  onOpenChange,
  employmentId,
  employmentMetadata,
  leaveBalance,
  onSuccess,
}: LeaveEntitlementDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Szabadságkeret és Áthozott Napok Beállítása
          </DialogTitle>
          <DialogDescription>
            Az eaisyBooks automatikusan kalkulálja az Mt. szerinti törvényes szabadságot, de itt rögzíthetsz
            előző évről vagy előző munkahelyről hozott napokat, megváltozott munkaképesség miatti pótszabadságot,
            illetve egyedi keret felülbírálásokat.
          </DialogDescription>
        </DialogHeader>

        {open && (
          <LeaveEntitlementForm
            key={employmentId || 'new'}
            employmentId={employmentId}
            employmentMetadata={employmentMetadata}
            leaveBalance={leaveBalance}
            onSuccess={onSuccess}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
