import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Calculator, Store, Building2, Clock, ShieldCheck } from 'lucide-react';
import type { OpgCashRegister, CreateOpgRegisterInput, UpdateOpgRegisterInput, OpgCashBookingMode, OpgRegisterStatus } from '@/types/opg';
import type { PettyCashRegister } from '@/components/petty-cash/types';

interface OpgRegisterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  register?: OpgCashRegister | null;
  pettyCashRegisters: PettyCashRegister[];
  companyId: string;
  onSave: (input: CreateOpgRegisterInput | UpdateOpgRegisterInput) => Promise<void>;
  isLoading?: boolean;
}

interface FormContentProps {
  register?: OpgCashRegister | null;
  pettyCashRegisters: PettyCashRegister[];
  companyId: string;
  onSave: (input: CreateOpgRegisterInput | UpdateOpgRegisterInput) => Promise<void>;
  onClose: () => void;
  isLoading?: boolean;
}

const OpgRegisterFormContent: React.FC<FormContentProps> = ({
  register,
  pettyCashRegisters,
  companyId,
  onSave,
  onClose,
  isLoading = false,
}) => {
  const defaultPcr = pettyCashRegisters.find((p) => p.is_default);

  const [apCode, setApCode] = useState(() => register?.ap_code || '');
  const [name, setName] = useState(() => register?.name || '');
  const [location, setLocation] = useState(() => register?.location || '');
  const [pettyCashRegisterId, setPettyCashRegisterId] = useState<string>(
    () => register?.petty_cash_register_id || (defaultPcr ? defaultPcr.id : pettyCashRegisters[0]?.id || 'none')
  );
  const [cashBookingMode, setCashBookingMode] = useState<OpgCashBookingMode>(
    () => register?.cash_booking_mode || 'daily_z_summary'
  );
  const [syncInterval, setSyncInterval] = useState<number>(
    () => register?.sync_interval_minutes || 60
  );
  const [status, setStatus] = useState<OpgRegisterStatus>(
    () => register?.status || 'active'
  );
  const [errors, setErrors] = useState<{ apCode?: string; name?: string }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanAp = apCode.trim().toUpperCase();
    const cleanName = name.trim();

    const newErrors: { apCode?: string; name?: string } = {};
    if (!cleanAp) {
      newErrors.apCode = 'Az AP kód megadása kötelező.';
    } else if (cleanAp.length < 8) {
      newErrors.apCode = 'Az AP kódnak legalább 8 karakterből kell állnia (pl. A12345678).';
    }

    if (!cleanName) {
      newErrors.name = 'A pénztárgép megnevezése kötelező.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const payloadPettyCashId = pettyCashRegisterId === 'none' ? null : pettyCashRegisterId;

    if (register) {
      await onSave({
        id: register.id,
        ap_code: cleanAp,
        name: cleanName,
        location: location.trim() || null,
        petty_cash_register_id: payloadPettyCashId,
        cash_booking_mode: cashBookingMode,
        sync_interval_minutes: syncInterval,
        status,
      } as UpdateOpgRegisterInput);
    } else {
      await onSave({
        company_id: companyId,
        ap_code: cleanAp,
        name: cleanName,
        location: location.trim() || null,
        petty_cash_register_id: payloadPettyCashId,
        cash_booking_mode: cashBookingMode,
        sync_interval_minutes: syncInterval,
        status,
      } as CreateOpgRegisterInput);
    }

    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-2">
      {/* AP kód */}
      <div className="space-y-1.5">
        <Label htmlFor="ap-code" className="font-medium flex items-center justify-between">
          <span>NAV AP Kód *</span>
          <span className="text-xs text-muted-foreground font-normal">Pl. A12345678</span>
        </Label>
        <div className="relative">
          <ShieldCheck className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            id="ap-code"
            placeholder="A12345678"
            value={apCode}
            onChange={(e) => {
              setApCode(e.target.value.toUpperCase());
              if (errors.apCode) setErrors((prev) => ({ ...prev, apCode: undefined }));
            }}
            className={`pl-9 uppercase font-mono tracking-wider ${errors.apCode ? 'border-destructive focus-visible:ring-destructive' : ''}`}
          />
        </div>
        {errors.apCode && <p className="text-xs text-destructive mt-1">{errors.apCode}</p>}
      </div>

      {/* Megnevezés */}
      <div className="space-y-1.5">
        <Label htmlFor="reg-name" className="font-medium">
          Pénztárgép megnevezése *
        </Label>
        <div className="relative">
          <Store className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            id="reg-name"
            placeholder="Főpénztár - Recepció / Pult 1"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
            }}
            className={`pl-9 ${errors.name ? 'border-destructive focus-visible:ring-destructive' : ''}`}
          />
        </div>
        {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
      </div>

      {/* Telephely / Cím */}
      <div className="space-y-1.5">
        <Label htmlFor="reg-loc" className="font-medium">
          Telephely / Üzlet címe
        </Label>
        <div className="relative">
          <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            id="reg-loc"
            placeholder="1052 Budapest, Kossuth Lajos u. 12."
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Hozzárendelt Házipénztár */}
      <div className="space-y-1.5">
        <Label htmlFor="reg-pcr" className="font-medium">
          Hozzárendelt Házipénztár
        </Label>
        <Select value={pettyCashRegisterId} onValueChange={setPettyCashRegisterId}>
          <SelectTrigger id="reg-pcr">
            <SelectValue placeholder="Válasszon házipénztárt..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nincs közvetlen rendelés (Cég alapértelmezett)</SelectItem>
            {pettyCashRegisters.map((pcr) => (
              <SelectItem key={pcr.id} value={pcr.id}>
                {pcr.name} {pcr.is_default ? '(Alapértelmezett)' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          A pénztárgép készpénz forgalma automatikusan ebbe a házipénztárba kerül lekönyvelésre.
        </p>
      </div>

      {/* Készpénz könyvelési mód */}
      <div className="space-y-2 pt-2 border-t">
        <Label className="font-medium block">Készpénz könyvelésének módja</Label>
        <RadioGroup
          value={cashBookingMode}
          onValueChange={(val) => setCashBookingMode(val as OpgCashBookingMode)}
          className="grid gap-2"
        >
          <label
            htmlFor="mode-z"
            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              cashBookingMode === 'daily_z_summary'
                ? 'border-primary bg-primary/5 text-foreground'
                : 'border-border hover:bg-muted/50'
            }`}
          >
            <RadioGroupItem value="daily_z_summary" id="mode-z" className="mt-1" />
            <div className="space-y-1">
              <div className="text-sm font-semibold flex items-center gap-2">
                <span>Napi Z-zárás összesítő alapján</span>
                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                  Ajánlott
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                A nap végi Z-jelentés összesített készpénz forgalma kerül egyetlen bizonylatként a házipénztári naplóba. Nem zsúfolja tele a pénztárkönyvet apró tételekkel.
              </p>
            </div>
          </label>

          <label
            htmlFor="mode-itemized"
            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              cashBookingMode === 'itemized_receipt'
                ? 'border-primary bg-primary/5 text-foreground'
                : 'border-border hover:bg-muted/50'
            }`}
          >
            <RadioGroupItem value="itemized_receipt" id="mode-itemized" className="mt-1" />
            <div className="space-y-1">
              <div className="text-sm font-semibold">Tételes nyugtánként</div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Minden egyes készpénzes nyugta azonnal és önállóan bekerül a házipénztárba. Nagy forgalom esetén sok pénztári tételt eredményez.
              </p>
            </div>
          </label>
        </RadioGroup>
      </div>

      {/* Szinkronizáció és Státusz */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <div className="space-y-1.5">
          <Label htmlFor="sync-interval" className="font-medium flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Szinkron ciklus</span>
          </Label>
          <Select
            value={String(syncInterval)}
            onValueChange={(v) => setSyncInterval(Number(v))}
          >
            <SelectTrigger id="sync-interval">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15">15 percenként</SelectItem>
              <SelectItem value="30">30 percenként</SelectItem>
              <SelectItem value="60">1 óránként (Alap)</SelectItem>
              <SelectItem value="120">2 óránként</SelectItem>
              <SelectItem value="360">6 óránként</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reg-status" className="font-medium">
            Státusz
          </Label>
          <Select value={status} onValueChange={(v) => setStatus(v as OpgRegisterStatus)}>
            <SelectTrigger id="reg-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Aktív</SelectItem>
              <SelectItem value="suspended">Felfüggesztve</SelectItem>
              <SelectItem value="disconnected">Lecsatlakozva</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DialogFooter className="pt-4 border-t gap-2 sm:gap-0">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isLoading}
        >
          Mégse
        </Button>
        <Button type="submit" disabled={isLoading} className="gap-2">
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {register ? 'Módosítások mentése' : 'Pénztárgép rögzítése'}
        </Button>
      </DialogFooter>
    </form>
  );
};

export const OpgRegisterModal: React.FC<OpgRegisterModalProps> = ({
  open,
  onOpenChange,
  register,
  pettyCashRegisters,
  companyId,
  onSave,
  isLoading = false,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <Calculator className="h-5 w-5 text-primary" />
            {register ? 'Online pénztárgép szerkesztése' : 'Új online pénztárgép rögzítése'}
          </DialogTitle>
          <DialogDescription>
            Adja meg a NAV által jóváhagyott pénztárgép AP kódját és a hozzá tartozó házipénztári könyvelési paramétereket.
          </DialogDescription>
        </DialogHeader>

        {open && (
          <OpgRegisterFormContent
            key={register?.id || 'new'}
            register={register}
            pettyCashRegisters={pettyCashRegisters}
            companyId={companyId}
            onSave={onSave}
            onClose={() => onOpenChange(false)}
            isLoading={isLoading}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
