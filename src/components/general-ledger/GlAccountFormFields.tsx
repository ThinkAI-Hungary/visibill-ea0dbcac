import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { GlAccountType, SubledgerType } from '@/types/accounting';
import { Users, FileSpreadsheet, Layers, Coins, AlertCircle, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface GlAccountFormData {
  glNumber: string;
  shortName: string;
  description: string;
  accountType: GlAccountType;
  subledgerType: SubledgerType;
  isOpenItemManaged: boolean;
  isMulticurrency: boolean;
  currency: string;
}

interface GlAccountFormFieldsProps {
  data: GlAccountFormData;
  onChange: (updates: Partial<GlAccountFormData>) => void;
  isEditingGlNumber?: boolean; // if true, glNumber input is disabled
  detectedParent?: { gl_number: string; short_name: string } | null;
  hasChildren?: boolean;
}

export function GlAccountFormFields({
  data,
  onChange,
  isEditingGlNumber = false,
  detectedParent,
  hasChildren = false,
}: GlAccountFormFieldsProps) {
  const { t } = useTranslation(['accounting', 'common']);

  const handleSubledgerTypeChange = (value: SubledgerType) => {
    // Reactive rule: if partner or detail is selected, auto-enable is_open_item_managed
    const autoOpenItem = value === 'partner' || value === 'detail' ? true : data.isOpenItemManaged;
    onChange({
      subledgerType: value,
      isOpenItemManaged: autoOpenItem,
    });
  };

  return (
    <div className="space-y-5 text-sm">
      {/* 1. Alapadatok */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="gl-number" className="font-medium text-foreground">
            {t('accounting:fields.gl_number', 'Főkönyvi számlaszám')} <span className="text-red-500">*</span>
          </Label>
          <Input
            id="gl-number"
            value={data.glNumber}
            onChange={(e) => onChange({ glNumber: e.target.value })}
            placeholder="pl. 3111 vagy 4541"
            disabled={isEditingGlNumber}
            className="font-mono"
          />
          {detectedParent && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <Info className="h-3.5 w-3.5 text-blue-500" />
              <span>
                Szülő számla: <strong className="font-mono text-foreground">{detectedParent.gl_number}</strong> ({detectedParent.short_name})
              </span>
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="gl-short-name" className="font-medium text-foreground">
            {t('accounting:fields.short_name', 'Megnevezés')} <span className="text-red-500">*</span>
          </Label>
          <Input
            id="gl-short-name"
            value={data.shortName}
            onChange={(e) => onChange({ shortName: e.target.value })}
            placeholder="pl. Belföldi vevők vagy Készpénz"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="gl-description" className="font-medium text-muted-foreground">
          {t('accounting:fields.description', 'Leírás és megjegyzés (opcionális)')}
        </Label>
        <Textarea
          id="gl-description"
          value={data.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Könyvelési útmutató vagy megjegyzés ehhez a számlához..."
          rows={2}
          className="resize-none"
        />
      </div>

      {/* 2. Számla jellege: Csoportszámla vs Könyvelési számla */}
      <div className="rounded-lg border border-border/70 p-3.5 bg-muted/20 space-y-2.5">
        <div className="flex items-center justify-between">
          <Label className="font-semibold text-foreground flex items-center gap-1.5">
            <Layers className="h-4 w-4 text-primary" />
            <span>Számla jellege</span>
          </Label>
          {hasChildren && (
            <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              Alárendelt alszámlákkal rendelkezik
            </span>
          )}
        </div>

        <RadioGroup
          value={data.accountType}
          onValueChange={(val) => onChange({ accountType: val as GlAccountType })}
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          <label
            htmlFor="type-detail"
            className={`flex items-start gap-3 p-2.5 rounded-md border cursor-pointer transition-colors ${
              data.accountType === 'detail'
                ? 'border-primary bg-primary/5 text-foreground'
                : 'border-border/60 hover:bg-muted/40 text-muted-foreground'
            }`}
          >
            <RadioGroupItem value="detail" id="type-detail" className="mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-medium text-xs block text-foreground">Könyvelési számla (analitikus)</span>
              <span className="text-[11px] text-muted-foreground leading-tight block">
                Közvetlenül könyvelhető tételsorok rögzítésére szolgál.
              </span>
            </div>
          </label>

          <label
            htmlFor="type-group"
            className={`flex items-start gap-3 p-2.5 rounded-md border cursor-pointer transition-colors ${
              data.accountType === 'group'
                ? 'border-primary bg-primary/5 text-foreground'
                : 'border-border/60 hover:bg-muted/40 text-muted-foreground'
            }`}
          >
            <RadioGroupItem value="group" id="type-group" className="mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-medium text-xs block text-foreground">Csoportszámla (gyűjtő)</span>
              <span className="text-[11px] text-muted-foreground leading-tight block">
                Alszámlák összesítésére szolgál, közvetlen könyvelés nem megengedett.
              </span>
            </div>
          </label>
        </RadioGroup>
      </div>

      {/* 3. Folyószámla és Partnerkényszer beállítások */}
      <div className="rounded-lg border border-border/70 p-3.5 bg-muted/20 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="font-semibold text-foreground flex items-center gap-1.5">
            <Users className="h-4 w-4 text-blue-500" />
            <span>Folyószámla és analitika típus</span>
          </Label>
        </div>

        <div className="space-y-2">
          <Select
            value={data.subledgerType}
            onValueChange={(val) => handleSubledgerTypeChange(val as SubledgerType)}
          >
            <SelectTrigger id="subledger-type" className="w-full">
              <SelectValue placeholder="Válasszon folyószámla típust" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                <span className="font-medium">Nincs folyószámla</span> — nem analitikus tétel
              </SelectItem>
              <SelectItem value="partner">
                <span className="font-medium text-blue-600 dark:text-blue-400">Partnerhez kötött (Partnerkényszer)</span> — pl. 311 Vevők, 454 Szállítók
              </SelectItem>
              <SelectItem value="detail">
                <span className="font-medium text-purple-600 dark:text-purple-400">Egyéb analitika</span> — pl. 451 Tagi kölcsönök, hitelek (személyenkénti analitika)
              </SelectItem>
            </SelectContent>
          </Select>

          {data.subledgerType === 'partner' && (
            <div className="flex items-center gap-2 p-2 rounded bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>
                <strong>Partnerkényszer aktív:</strong> a rendszer rögzítéskor és könyveléskor kötelezővé teszi a partner kiválasztását.
              </span>
            </div>
          )}

          {data.subledgerType === 'detail' && (
            <div className="flex items-center gap-2 p-2 rounded bg-purple-500/10 border border-purple-500/20 text-xs text-purple-700 dark:text-purple-300">
              <FileSpreadsheet className="h-4 w-4 shrink-0" />
              <span>
                <strong>Egyéb analitika:</strong> lehetővé teszi 1 főkönyvi számon belüli személyenkénti / szerződésenkénti analitikát és éves nyitást.
              </span>
            </div>
          )}
        </div>

        <div className="pt-1 border-t border-border/50">
          <label htmlFor="open-item-check" className="flex items-start gap-2.5 cursor-pointer mt-1">
            <Checkbox
              id="open-item-check"
              checked={data.isOpenItemManaged}
              onCheckedChange={(checked) => onChange({ isOpenItemManaged: !!checked })}
              className="mt-0.5"
            />
            <div className="space-y-0.5">
              <span className="text-xs font-medium text-foreground block">
                Folyószámla modulban párosítható számla (Nyitott tételek kezelése)
              </span>
              <span className="text-[11px] text-muted-foreground block leading-tight">
                Bekapcsolásakor a számla megjelenik a Folyószámla modul párosítási felületén.
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* 4. Deviza beállítások */}
      <div className="rounded-lg border border-border/70 p-3.5 bg-muted/20 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="font-semibold text-foreground flex items-center gap-1.5">
            <Coins className="h-4 w-4 text-emerald-500" />
            <span>Deviza kezelés</span>
          </Label>
        </div>

        <div className="space-y-2">
          <label htmlFor="multicurrency-check" className="flex items-start gap-2.5 cursor-pointer">
            <Checkbox
              id="multicurrency-check"
              checked={data.isMulticurrency}
              onCheckedChange={(checked) => onChange({ isMulticurrency: !!checked })}
              className="mt-0.5"
            />
            <div className="space-y-0.5">
              <span className="text-xs font-medium text-foreground block">
                Többdevizás számla engedélyezése
              </span>
              <span className="text-[11px] text-muted-foreground block leading-tight">
                A számlára több különböző devizanemben is engedélyezi a könyvelést.
              </span>
            </div>
          </label>

          <div className="pt-2 flex items-center gap-3">
            <Label htmlFor="gl-currency" className="text-xs text-muted-foreground shrink-0">
              Dedikált devizanem:
            </Label>
            <Select
              value={data.currency}
              onValueChange={(val) => onChange({ currency: val })}
            >
              <SelectTrigger id="gl-currency" className="w-[140px] h-8 text-xs">
                <SelectValue placeholder="Devizanem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ANY">Bármely deviza</SelectItem>
                <SelectItem value="HUF">HUF (Forint)</SelectItem>
                <SelectItem value="EUR">EUR (Euró)</SelectItem>
                <SelectItem value="USD">USD (Dollár)</SelectItem>
                <SelectItem value="GBP">GBP (Font)</SelectItem>
                <SelectItem value="CHF">CHF (Frank)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}
