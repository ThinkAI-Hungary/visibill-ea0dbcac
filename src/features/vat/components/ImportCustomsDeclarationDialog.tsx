import React, { useState, useMemo } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileText,
  Calculator,
  CreditCard,
  Building,
  Info,
  CheckCircle2,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import {
  ImportCustomsDeclaration,
  ImportCustomsFormData,
  ImportProcedureType,
} from '../types/importVat';

interface ImportCustomsDeclarationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  declarationToEdit?: ImportCustomsDeclaration | null;
  companyId: string;
  defaultPeriodDate?: string;
  onSave: (data: ImportCustomsFormData, postToGl: boolean) => Promise<void>;
}

const VAT_CODE_OPTIONS = [
  {
    code: 'IMP_KIV_27',
    label: 'Termékimport kivetéssel 27% (70. sor, megfizetéskor)',
    rate: 27,
    procedure: 'LEVY',
  },
  {
    code: 'IMP_KIV_18',
    label: 'Termékimport kivetéssel 18% (70. sor, megfizetéskor)',
    rate: 18,
    procedure: 'LEVY',
  },
  {
    code: 'IMP_KIV_5',
    label: 'Termékimport kivetéssel 5% (70. sor, megfizetéskor)',
    rate: 5,
    procedure: 'LEVY',
  },
  {
    code: 'IMP_ON_27',
    label: 'Termékimport önadózással 27% (26. fizetendő + 71. levonható)',
    rate: 27,
    procedure: 'SELF_ASSESSMENT',
  },
  {
    code: 'IMP_ON_18',
    label: 'Termékimport önadózással 18% (25. fizetendő + 71. levonható)',
    rate: 18,
    procedure: 'SELF_ASSESSMENT',
  },
  {
    code: 'IMP_ON_5',
    label: 'Termékimport önadózással 5% (24. fizetendő + 71. levonható)',
    rate: 5,
    procedure: 'SELF_ASSESSMENT',
  },
  {
    code: 'IMP_MENTES',
    label: 'Adómentes termékimport 42-es eljárás (23. sor adóalap)',
    rate: 0,
    procedure: 'SELF_ASSESSMENT',
  },
  {
    code: 'IMP_NEM_LEV',
    label: 'Nem levonható import ÁFA (bekerülési értékbe)',
    rate: 27,
    procedure: 'LEVY',
  },
];

interface FormProps {
  declarationToEdit?: ImportCustomsDeclaration | null;
  defaultPeriodDate?: string;
  onSave: (data: ImportCustomsFormData, postToGl: boolean) => Promise<void>;
  onClose: () => void;
}

function getInitialIsoDate(fallback?: string): string {
  if (fallback) return fallback;
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function ImportCustomsDeclarationInnerForm({
  declarationToEdit,
  defaultPeriodDate,
  onSave,
  onClose,
}: FormProps) {
  const [activeTab, setActiveTab] = useState<'basics' | 'calculation' | 'vat'>('basics');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const initialDate = declarationToEdit?.tax_period_date || getInitialIsoDate(defaultPeriodDate);

  // Form State initialized directly from props
  const [declarationNumber, setDeclarationNumber] = useState(
    declarationToEdit?.declaration_number || ''
  );
  const [customsOfficeCode, setCustomsOfficeCode] = useState(
    declarationToEdit?.customs_office_code || ''
  );
  const [decisionDate, setDecisionDate] = useState(
    declarationToEdit?.decision_date || initialDate
  );
  const [taxPeriodDate, setTaxPeriodDate] = useState(
    declarationToEdit?.tax_period_date || initialDate
  );
  const [procedureType, setProcedureType] = useState<ImportProcedureType>(
    declarationToEdit?.procedure_type || 'LEVY'
  );

  const [foreignSupplierName, setForeignSupplierName] = useState(
    declarationToEdit?.foreign_supplier_name || ''
  );
  const [foreignCurrency, setForeignCurrency] = useState(
    declarationToEdit?.foreign_currency || 'EUR'
  );
  const [foreignInvoiceAmount, setForeignInvoiceAmount] = useState<number>(
    declarationToEdit?.foreign_invoice_amount || 0
  );

  const [customsExchangeRate, setCustomsExchangeRate] = useState<number>(
    declarationToEdit?.customs_exchange_rate || 395.5
  );
  const [customsDutyHuf, setCustomsDutyHuf] = useState<number>(
    declarationToEdit?.customs_duty_huf || 0
  );
  const [otherImportCostsHuf, setOtherImportCostsHuf] = useState<number>(
    declarationToEdit?.other_import_costs_huf || 0
  );

  const [vatCode, setVatCode] = useState(declarationToEdit?.vat_code || 'IMP_KIV_27');
  const [isDeductible, setIsDeductible] = useState(declarationToEdit?.is_deductible ?? true);

  // Payment Tracking
  const [isPaid, setIsPaid] = useState(declarationToEdit?.payment_status === 'PAID');
  const [paymentDate, setPaymentDate] = useState<string>(
    declarationToEdit?.payment_date || initialDate
  );
  const [bankTransactionRef, setBankTransactionRef] = useState(
    declarationToEdit?.bank_transaction_ref || ''
  );

  // Indirect rep
  const [indirectRepName, setIndirectRepName] = useState(
    declarationToEdit?.indirect_customs_rep_name || ''
  );
  const [indirectRepTaxNum, setIndirectRepTaxNum] = useState(
    declarationToEdit?.indirect_customs_rep_tax_number || ''
  );
  const [notes, setNotes] = useState(declarationToEdit?.notes || '');

  // Handle procedure type change -> adjust default vat code
  const handleProcedureTypeChange = (type: ImportProcedureType) => {
    setProcedureType(type);
    if (type === 'LEVY') {
      if (vatCode.startsWith('IMP_ON_')) {
        setVatCode('IMP_KIV_27');
      }
    } else {
      if (vatCode.startsWith('IMP_KIV_')) {
        setVatCode('IMP_ON_27');
      }
    }
  };

  // Computations
  const customsValueHuf = useMemo(() => {
    return Math.round((foreignInvoiceAmount || 0) * (customsExchangeRate || 1.0));
  }, [foreignInvoiceAmount, customsExchangeRate]);

  const vatBaseHuf = useMemo(() => {
    // Áfa tv. 74-75. §: Vámérték + Kiszabott vám + Járulékos költségek
    return Math.round(customsValueHuf + (customsDutyHuf || 0) + (otherImportCostsHuf || 0));
  }, [customsValueHuf, customsDutyHuf, otherImportCostsHuf]);

  const selectedVatConfig = useMemo(() => {
    return VAT_CODE_OPTIONS.find((v) => v.code === vatCode) || VAT_CODE_OPTIONS[0];
  }, [vatCode]);

  const vatAmountHuf = useMemo(() => {
    if (!selectedVatConfig || selectedVatConfig.rate === 0) return 0;
    return Math.round(vatBaseHuf * (selectedVatConfig.rate / 100));
  }, [vatBaseHuf, selectedVatConfig]);

  const handleSubmit = async (postToGl: boolean) => {
    if (!declarationNumber.trim()) {
      alert('A határozatszám megadása kötelező!');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload: ImportCustomsFormData = {
        declaration_number: declarationNumber.trim(),
        customs_office_code: customsOfficeCode.trim(),
        decision_date: decisionDate,
        tax_period_date: taxPeriodDate,
        procedure_type: procedureType,
        status: isPaid ? 'PAID' : 'CONFIRMED',
        foreign_supplier_name: foreignSupplierName.trim(),
        foreign_currency: foreignCurrency,
        foreign_invoice_amount: foreignInvoiceAmount,
        customs_exchange_rate: customsExchangeRate,
        customs_value_huf: customsValueHuf,
        customs_duty_huf: customsDutyHuf,
        other_import_costs_huf: otherImportCostsHuf,
        vat_base_huf: vatBaseHuf,
        vat_code: vatCode,
        vat_rate_percent: selectedVatConfig.rate,
        vat_amount_huf: vatAmountHuf,
        is_deductible: isDeductible,
        payment_status: isPaid ? 'PAID' : 'PENDING',
        payment_date: isPaid ? paymentDate : null,
        bank_transaction_ref: bankTransactionRef.trim(),
        indirect_customs_rep_name: indirectRepName.trim(),
        indirect_customs_rep_tax_number: indirectRepTaxNum.trim(),
        notes: notes.trim(),
      };

      await onSave(payload, postToGl);
      onClose();
    } catch (err: any) {
      console.error(err);
      alert('Hiba mentés közben: ' + (err.message || 'Ismeretlen hiba'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <DialogTitle className="text-lg font-semibold">
              {declarationToEdit ? 'Vámhatározat Módosítása' : 'Új Import Vámhatározat Rögzítése'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Termékimport ÁFA és vámérték nyilvántartása az Áfa tv. 24. §, 74–75. § és 154–156. § szerint
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full mt-2">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="basics" className="gap-1.5 text-xs">
            <Building className="w-3.5 h-3.5" />
            1. Határozat & Partner
          </TabsTrigger>
          <TabsTrigger value="calculation" className="gap-1.5 text-xs">
            <Calculator className="w-3.5 h-3.5" />
            2. Vámérték & Adóalap
          </TabsTrigger>
          <TabsTrigger value="vat" className="gap-1.5 text-xs">
            <CreditCard className="w-3.5 h-3.5" />
            3. ÁFA & Megfizetés
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Határozat Alapadatok & Partner */}
        <TabsContent value="basics" className="space-y-4 pt-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Vámhatározat / eVám referenciaszám *</Label>
              <Input
                placeholder="Pl. 26HU0012345678 vagy 12345/2026"
                value={declarationNumber}
                onChange={(e) => setDeclarationNumber(e.target.value)}
                className="font-mono text-sm"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Eljáró Vámhivatal Kódja</Label>
              <Input
                placeholder="Pl. HU001000 vagy BUDAPEST-AIRPORT"
                value={customsOfficeCode}
                onChange={(e) => setCustomsOfficeCode(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Határozat Kelte (Dátum)</Label>
              <Input
                type="date"
                value={decisionDate}
                onChange={(e) => setDecisionDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Adómegállapítás / Bevallási nap</Label>
              <Input
                type="date"
                value={taxPeriodDate}
                onChange={(e) => setTaxPeriodDate(e.target.value)}
              />
            </div>
          </div>

          <div className="p-3.5 rounded-xl border bg-muted/40 space-y-2">
            <Label className="text-xs font-semibold text-foreground">Eljárás törvényi típusa</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={procedureType === 'LEVY' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleProcedureTypeChange('LEVY')}
                className="justify-start text-xs font-medium"
              >
                <Building className="w-3.5 h-3.5 mr-1.5" />
                Kivetés (Áfa tv. 154. §)
              </Button>
              <Button
                type="button"
                variant={procedureType === 'SELF_ASSESSMENT' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleProcedureTypeChange('SELF_ASSESSMENT')}
                className="justify-start text-xs font-medium"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Önadózás (Áfa tv. 155–156. §)
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {procedureType === 'LEVY'
                ? 'Főszabály: A vámhatóság határozatban szabja ki az adót. A 70. sorban kizárólag a tényleges vámhatósági megfizetés után válik levonhatóvá!'
                : 'Engedélyes eljárás: Pénzmozgás nincs az áfára. A bevallásban egyszerre szerepel fizetendőként (24–26. sor) és levonhatóként (71. sor).'}
            </p>
          </div>

          <div className="border-t pt-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Külföldi Partner és Kapcsolódó Szállítói Bizonylat
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-xs">Külföldi Szállító Neve</Label>
                <Input
                  placeholder="Pl. Shenzen Electronics Ltd."
                  value={foreignSupplierName}
                  onChange={(e) => setForeignSupplierName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Devizanem</Label>
                <Select value={foreignCurrency} onValueChange={setForeignCurrency}>
                  <SelectTrigger>
                    <SelectValue placeholder="Deviza" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                    <SelectItem value="CHF">CHF</SelectItem>
                    <SelectItem value="CNY">CNY (¥)</SelectItem>
                    <SelectItem value="HUF">HUF (Ft)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Közvetett képviselő blokk */}
          <div className="p-3 rounded-lg border bg-background/50 space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              Közvetett vámjogi képviselő (Opcionális - 2025. március 1-től hatályos szabályokhoz)
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                placeholder="Képviselő cég neve (pl. Spedíció Kft.)"
                value={indirectRepName}
                onChange={(e) => setIndirectRepName(e.target.value)}
                className="text-xs"
              />
              <Input
                placeholder="Képviselő adószáma (pl. 12345678-2-42)"
                value={indirectRepTaxNum}
                onChange={(e) => setIndirectRepTaxNum(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: Vámérték & Adóalap Kalkulátor */}
        <TabsContent value="calculation" className="space-y-4 pt-3">
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5">
            <Info className="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <span className="font-semibold">Kettős árfolyam törvényi kezelése (Áfa tv. 81. § vs Szt. 60. §):</span>
              <p className="mt-0.5 text-[11px] leading-relaxed opacity-90">
                Az eszköz / készlet könyvelése a vállalkozás számviteli devizaárfolyamán történik. Az import áfa és vám alapja viszont KIZÁRÓLAG a vámhatóság által megállapított <strong>hivatalos vámárfolyam</strong> szerinti forintösszeg.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Külföldi számla devizaértéke ({foreignCurrency})</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={foreignInvoiceAmount || ''}
                onChange={(e) => setForeignInvoiceAmount(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="text-right font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Hivatalos Vámárfolyam (Áfa tv. 81. §)</Label>
              <Input
                type="number"
                step="0.0001"
                min="0"
                value={customsExchangeRate || ''}
                onChange={(e) => setCustomsExchangeRate(parseFloat(e.target.value) || 0)}
                placeholder="395.5000"
                className="text-right font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg border bg-muted/30">
              <div className="text-[11px] text-muted-foreground uppercase font-medium">Kiszámolt Vámérték HUF</div>
              <div className="text-base font-bold font-mono mt-1 text-foreground">
                {formatCurrency(customsValueHuf)}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Kiszabott Vám összege (HUF)</Label>
              <Input
                type="number"
                step="1"
                min="0"
                value={customsDutyHuf || ''}
                onChange={(e) => setCustomsDutyHuf(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="text-right font-mono"
              />
              <span className="text-[10px] text-muted-foreground">Bekerülési értékbe könyvelendő</span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Járulékos költségek (HUF)</Label>
              <Input
                type="number"
                step="1"
                min="0"
                value={otherImportCostsHuf || ''}
                onChange={(e) => setOtherImportCostsHuf(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="text-right font-mono"
              />
              <span className="text-[10px] text-muted-foreground">Fuvar, vámügyintézés (Áfa tv. 74. §)</span>
            </div>
          </div>

          {/* Összesített Vám ÁFA Alap Kiemelés */}
          <div className="p-4 rounded-xl border bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-background border-indigo-500/30">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                  ÖSSZESÍTETT IMPORT ÁFAALAP (HUF)
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  = Vámérték ({formatCurrency(customsValueHuf)}) + Vám ({formatCurrency(customsDutyHuf)}) + Járulékos ({formatCurrency(otherImportCostsHuf)})
                </div>
              </div>
              <div className="text-xl font-bold font-mono text-indigo-600 dark:text-indigo-400">
                {formatCurrency(vatBaseHuf)}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* TAB 3: ÁFA Kód & Megfizetettség */}
        <TabsContent value="vat" className="space-y-4 pt-3">
          <div className="space-y-2">
            <Label className="text-xs font-medium">Törvényi ÁFA Kód & Bevallási Sor</Label>
            <Select value={vatCode} onValueChange={setVatCode}>
              <SelectTrigger>
                <SelectValue placeholder="Válassz áfa kódot" />
              </SelectTrigger>
              <SelectContent>
                {VAT_CODE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.code} value={opt.code}>
                    <span className="font-mono font-medium mr-2">[{opt.code}]</span>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl border bg-muted/40 space-y-1">
              <span className="text-[11px] text-muted-foreground font-medium uppercase">Kiszámított ÁFA összege</span>
              <div className="text-lg font-bold font-mono text-foreground">
                {formatCurrency(vatAmountHuf)}
              </div>
              <Badge variant="outline" className="text-[10px] mt-1">
                Kulcs: {selectedVatConfig.rate}%
              </Badge>
            </div>

            <div className="p-3.5 rounded-xl border bg-muted/40 flex items-center justify-between">
              <div>
                <Label className="text-xs font-semibold text-foreground">Levonható ÁFA-e?</Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Adóköteles gazdasági tevékenységhez szolgál (Áfa tv. 120. §)
                </p>
              </div>
              <Switch checked={isDeductible} onCheckedChange={setIsDeductible} />
            </div>
          </div>

          {/* Megfizetés követése (Kivetés esetén kritikus kapu) */}
          <div className="p-4 rounded-xl border bg-background space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-bold text-foreground uppercase tracking-wide">
                    Vámhatósági Megfizetés Igazolása
                  </Label>
                  {isPaid ? (
                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
                      Megfizetve (Levonható 70. sor)
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">
                      Fizetésre vár (Még nem vonható le)
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Áfa tv. 127. § (1) c): Kivetésnél a levonás feltétele a határozat ÉS a tényleges befizetés igazolása.
                </p>
              </div>
              <Switch checked={isPaid} onCheckedChange={setIsPaid} />
            </div>

            {isPaid && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-border/60">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Tényleges Vám és Áfa Megfizetés Napja *</Label>
                  <Input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    required
                  />
                  <span className="text-[10px] text-muted-foreground">
                    Ez a dátum határozza meg, melyik havi 2665 bevallás 70. sorába kerül!
                  </span>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Banki Bizonylatszám / Hivatkozás</Label>
                  <Input
                    placeholder="Pl. KH-2026-01-15-0042 vagy NAV kivonat"
                    value={bankTransactionRef}
                    onChange={(e) => setBankTransactionRef(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Belső megjegyzés</Label>
            <Textarea
              placeholder="Áru leírása, vámügynökség megjegyzése, konténer azonosító..."
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-xs resize-none"
            />
          </div>
        </TabsContent>
      </Tabs>

      <DialogFooter className="mt-4 pt-3 border-t flex flex-row items-center justify-between sm:justify-between w-full">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          disabled={isSubmitting}
        >
          Mégse
        </Button>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleSubmit(false)}
            disabled={isSubmitting}
          >
            <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-600" />
            Csak Határozat Mentése
          </Button>

          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => handleSubmit(true)}
            disabled={isSubmitting}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <BookOpen className="w-4 h-4 mr-1.5" />
            Mentés & Vegyes Napló Könyvelés
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}

export function ImportCustomsDeclarationDialog({
  open,
  onOpenChange,
  declarationToEdit,
  defaultPeriodDate,
  onSave,
}: ImportCustomsDeclarationDialogProps) {
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <ImportCustomsDeclarationInnerForm
          key={declarationToEdit?.id || 'new'}
          declarationToEdit={declarationToEdit}
          defaultPeriodDate={defaultPeriodDate}
          onSave={onSave}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
