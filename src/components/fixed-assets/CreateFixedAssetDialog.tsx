import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  useTaoTemplates,
  useCreateFixedAsset,
  generateInventoryNumber,
  useAssetGlAccounts,
} from '@/hooks/useFixedAssets';
import { useCompanyLocations } from '@/hooks/useCompanyLocations';
import { useProjectList } from '@/hooks/useProjectList';
import { useActivePreset } from '@/hooks/useActivePreset';
import { useDevelopmentReserves } from '@/hooks/useDevelopmentReserves';
import { useCompanyAccountingRule } from '@/hooks/useAccountingPolicy';
import { supabase } from '@/integrations/supabase/client';
import { Package2, Sparkles, RefreshCw, Loader2, Info } from 'lucide-react';
import { reportError } from '@/lib/errorReporter';

interface CreateFixedAssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateFixedAssetDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateFixedAssetDialogProps) {
  const { t } = useTranslation(['hr', 'common']);
  const { toast } = useToast();
  const { selectedCompany } = useCompany();
  const { user } = useAuth();

  const { data: taoTemplates = [] } = useTaoTemplates();
  const { locations = [] } = useCompanyLocations(selectedCompany?.id);
  const { projects = [] } = useProjectList();
  const { activePresetId } = useActivePreset(selectedCompany?.id);
  const { data: glAccounts = [] } = useAssetGlAccounts(selectedCompany?.id, activePresetId);
  const { data: developmentReserves = [] } = useDevelopmentReserves(selectedCompany?.id);
  const activeReserves = developmentReserves.filter(r => (r.remaining_amount || 0) > 0);

  const createAsset = useCreateFixedAsset();

  const { value: lowValueThresholdRule } = useCompanyAccountingRule(
    selectedCompany?.id,
    'low_value_asset_threshold',
    { amount: 200000 }
  );
  const lowValueLimit = Number(lowValueThresholdRule?.amount) || 200000;

  // Profile name for the activated_by field
  const [userName, setUserName] = useState('');
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const { data } = await supabase.from('profiles').select('name').eq('user_id', user.id).maybeSingle();
      if (data?.name) setUserName(data.name);
    };
    fetchProfile();
  }, [user]);

  // Form states
  const [name, setName] = useState('');
  const [inventoryNumber, setInventoryNumber] = useState('');
  const [generatingInvNumber, setGeneratingInvNumber] = useState(false);
  const [description, setDescription] = useState('');
  const [vtszTeszor, setVtszTeszor] = useState('');
  const [acquisitionValue, setAcquisitionValue] = useState<number | ''>('');
  const [residualValue, setResidualValue] = useState<number | ''>(0);
  const [currency, setCurrency] = useState('HUF');
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [activationDate, setActivationDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [usefulLifeYears, setUsefulLifeYears] = useState('3');
  const [usefulLifeMonths, setUsefulLifeMonths] = useState('0');
  const [depreciationMethod, setDepreciationMethod] = useState('linear');
  const [performanceUnit, setPerformanceUnit] = useState('');
  const [totalPlannedPerformance, setTotalPlannedPerformance] = useState('');
  const [depreciationScheduleString, setDepreciationScheduleString] = useState('');
  const [taoTemplateId, setTaoTemplateId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [glAccountId, setGlAccountId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [sourceInvoiceNumber, setSourceInvoiceNumber] = useState('');
  const [isOpeningAsset, setIsOpeningAsset] = useState(false);
  const [hasManuallyToggledOpening, setHasManuallyToggledOpening] = useState(false);

  // Development reserve allocation
  const [useDevReserve, setUseDevReserve] = useState(false);
  const [devReserveId, setDevReserveId] = useState('');
  const [devReserveAmount, setDevReserveAmount] = useState<number | ''>('');

  const [submitting, setSubmitting] = useState(false);

  // Auto-generate inventory number when dialog opens or when user clicks regenerate
  const handleGenerateInventoryNumber = async () => {
    if (!selectedCompany) return;
    setGeneratingInvNumber(true);
    try {
      const generated = await generateInventoryNumber(selectedCompany.id, sourceInvoiceNumber || null);
      setInventoryNumber(generated);
    } catch (err) {
      reportError({ type: 'db_query', component: 'CreateFixedAssetDialog', action: 'generateInventoryNumber', message: 'Failed to generate inventory number', error: err });
    } finally {
      setGeneratingInvNumber(false);
    }
  };

  // Reset form when dialog opens
  useEffect(() => {
    if (open && selectedCompany) {
      setName('');
      setDescription('');
      setVtszTeszor('');
      setAcquisitionValue('');
      setResidualValue(0);
      setCurrency('HUF');
      const today = new Date().toISOString().split('T')[0];
      setPurchaseDate(today);
      setActivationDate(today);
      setUsefulLifeYears('3');
      setUsefulLifeMonths('0');
      setDepreciationMethod('linear');
      setPerformanceUnit('');
      setTotalPlannedPerformance('');
      setDepreciationScheduleString('');
      setTaoTemplateId('');
      setLocationId(locations[0]?.id || '');
      setProjectId('');
      setGlAccountId(glAccounts[0]?.id || '');
      setSupplierName('');
      setSourceInvoiceNumber('');
      setIsOpeningAsset(false);
      setHasManuallyToggledOpening(false);
      setUseDevReserve(false);
      setDevReserveId(activeReserves[0]?.id || '');
      setDevReserveAmount('');
      handleGenerateInventoryNumber();
    }
  }, [open, selectedCompany?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Heuristic: If activationDate is before current year and user hasn't manually toggled, auto-check isOpeningAsset
  useEffect(() => {
    if (hasManuallyToggledOpening || !activationDate) return;
    const currentYear = new Date().getFullYear();
    const actYear = new Date(activationDate).getFullYear();
    if (!isNaN(actYear) && actYear < currentYear) {
      setIsOpeningAsset(true);
    }
  }, [activationDate, hasManuallyToggledOpening]);

  // Low-value asset check
  const numAcquisition = Number(acquisitionValue) || 0;
  const isLowValue = numAcquisition > 0 && numAcquisition <= lowValueLimit;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany || !user) return;

    if (!name.trim()) {
      toast({
        title: t('common:status.error'),
        description: t('hr:fixed_assets.create_dialog.validation_name', { defaultValue: 'Az eszköz megnevezése kötelező.' }),
        variant: 'destructive',
      });
      return;
    }

    if (!inventoryNumber.trim()) {
      toast({
        title: t('common:status.error'),
        description: t('hr:fixed_assets.create_dialog.validation_inventory_number', { defaultValue: 'A leltári szám megadása kötelező.' }),
        variant: 'destructive',
      });
      return;
    }

    if (numAcquisition <= 0) {
      toast({
        title: t('common:status.error'),
        description: t('hr:fixed_assets.create_dialog.validation_value', { defaultValue: 'A bekerülési értéknek nagyobbnak kell lennie nullánál.' }),
        variant: 'destructive',
      });
      return;
    }

    const usefulMonths = parseInt(usefulLifeYears || '0', 10) * 12 + parseInt(usefulLifeMonths || '0', 10);
    if (depreciationMethod !== 'immediate' && usefulMonths <= 0) {
      toast({
        title: t('common:status.error'),
        description: t('hr:fixed_assets.create_dialog.validation_life', { defaultValue: 'Adjon meg érvényes hasznos élettartamot (vagy válasszon Azonnali leírást).' }),
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const schedule = (depreciationMethod === 'absolute' || depreciationMethod === 'multiplier')
        ? depreciationScheduleString.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v))
        : null;

      await createAsset.mutateAsync({
        companyId: selectedCompany.id,
        userId: user.id,
        inventoryNumber: inventoryNumber.trim(),
        name: name.trim(),
        description: description.trim() || undefined,
        vtszTeszor: vtszTeszor.trim() || undefined,
        acquisitionValue: numAcquisition,
        residualValue: Number(residualValue) || 0,
        currency,
        purchaseDate,
        activationDate,
        usefulLifeMonths: parseInt(usefulLifeMonths, 10) || 0,
        depreciationMethod,
        performanceUnit: depreciationMethod === 'performance' ? performanceUnit || null : null,
        totalPlannedPerformance: depreciationMethod === 'performance' ? parseFloat(totalPlannedPerformance) || null : null,
        depreciationSchedule: schedule,
        taoTemplateId: taoTemplateId || null,
        locationId: locationId || null,
        projectId: projectId || null,
        activatedByUserId: user.id,
        activatedByName: userName || 'Adminisztrátor',
        sourceInvoiceId: null,
        sourceInvoiceType: null,
        sourceInvoiceNumber: sourceInvoiceNumber.trim() || null,
        supplierName: supplierName.trim() || null,
        glAccountId: glAccountId || null,
        developmentReserveId: useDevReserve ? devReserveId || null : null,
        developmentReserveAmount: useDevReserve ? Number(devReserveAmount) || 0 : 0,
        skipLedgerPosting: isOpeningAsset, // Bypasses duplicate 161 ledger posting for opening/historical assets
      });

      toast({
        title: t('common:status.success'),
        description: isOpeningAsset
          ? t('hr:fixed_assets.create_dialog.success_opening', { defaultValue: 'Nyitó / előzmény tárgyi eszköz sikeresen rögzítve.' })
          : t('hr:fixed_assets.create_dialog.success_new', { defaultValue: 'Új tárgyi eszköz sikeresen aktiválva.' }),
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      reportError({
        type: 'db_query',
        component: 'CreateFixedAssetDialog',
        action: 'handleSubmit',
        message: err?.message || 'Fixed asset creation failed',
        error: err,
      });
      toast({
        title: t('common:status.error'),
        description: err?.message || t('hr:fixed_assets.create_dialog.error', { defaultValue: 'Hiba történt az eszköz mentése során.' }),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto overflow-x-hidden">
        <form onSubmit={handleSubmit} noValidate>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Package2 className="h-5 w-5 text-primary" />
              {t('hr:fixed_assets.create_dialog.title', 'Új tárgyi eszköz felvétele')}
            </DialogTitle>
            <DialogDescription>
              {t(
                'hr:fixed_assets.create_dialog.description',
                'Közvetlen eszközfelvitel vagy korábbi évekből származó nyitó / előzmény eszközök rögzítése számlacsatolás nélkül.'
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4 text-sm">
            {/* 1. Alapadatok Szekció */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('hr:fixed_assets.create_dialog.section_general', 'Eszköz Azonosítása')}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="asset-name" className="font-medium">
                    {t('hr:fixed_assets.create_dialog.name', 'Megnevezés')} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="asset-name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={t('hr:fixed_assets.create_dialog.name_placeholder', 'pl. Dell Latitude 5540, Raktári emelőgép...')}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="asset-inv-number" className="font-medium">
                      {t('hr:fixed_assets.create_dialog.inventory_number', 'Leltári szám')}{' '}
                      <span className="text-destructive">*</span>
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleGenerateInventoryNumber}
                      disabled={generatingInvNumber}
                      className="h-6 text-xs gap-1 text-primary hover:text-primary px-2"
                      title={t('common:actions.regenerate', 'Következő leltári szám automatikus generálása')}
                    >
                      <RefreshCw className={`h-3 w-3 ${generatingInvNumber ? 'animate-spin' : ''}`} />
                      <span>{t('common:actions.regenerate', 'Auto-generálás')}</span>
                    </Button>
                  </div>
                  <Input
                    id="asset-inv-number"
                    value={inventoryNumber}
                    onChange={e => setInventoryNumber(e.target.value)}
                    placeholder={t('hr:fixed_assets.create_dialog.inventory_number_placeholder', 'pl. TE-2610-0001')}
                    className="font-mono text-sm"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="asset-vtsz">
                    {t('hr:fixed_assets.create_dialog.vtsz', 'VTSZ / TESZOR / KSH besorolás')}
                  </Label>
                  <Input
                    id="asset-vtsz"
                    value={vtszTeszor}
                    onChange={e => setVtszTeszor(e.target.value)}
                    placeholder={t('hr:fixed_assets.create_dialog.vtsz_placeholder', 'pl. 8471 30 00 (Laptopok)')}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="asset-desc">
                    {t('hr:fixed_assets.create_dialog.specs', 'Gyári szám / Műszaki paraméterek')}
                  </Label>
                  <Input
                    id="asset-desc"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder={t('hr:fixed_assets.create_dialog.specs_placeholder', 'pl. SN: ABC1234567, 32GB RAM, 1TB SSD')}
                  />
                </div>
              </div>
            </div>

            {/* 2. Érték & Dátumok */}
            <div className="space-y-3 border-t border-border/50 pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('hr:fixed_assets.create_dialog.section_valuation', 'Bekerülési Érték és Időpontok')}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="asset-val" className="font-medium">
                    {t('hr:fixed_assets.create_dialog.acquisition_value', 'Bekerülési (bruttó) érték')}{' '}
                    <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="asset-val"
                      type="number"
                      min="1"
                      step="1"
                      value={acquisitionValue}
                      onChange={e => {
                        const val = e.target.value === '' ? '' : Number(e.target.value);
                        setAcquisitionValue(val);
                        if (typeof val === 'number' && val > 0 && val <= lowValueLimit) {
                          setDepreciationMethod('immediate');
                          setUsefulLifeYears('0');
                          setUsefulLifeMonths('0');
                        }
                      }}
                      placeholder="0"
                      className="font-mono text-sm"
                      required
                    />
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger className="w-24 shrink-0 font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HUF">HUF</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="asset-residual">
                    {t('hr:fixed_assets.create_dialog.residual_value', 'Tervezett maradványérték (Ft)')}
                  </Label>
                  <Input
                    id="asset-residual"
                    type="number"
                    min="0"
                    step="1"
                    value={residualValue}
                    onChange={e => setResidualValue(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0"
                    className="font-mono text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="asset-purchase-date" className="font-medium">
                    {t('hr:fixed_assets.create_dialog.purchase_date', 'Beszerzés / Vásárlás dátuma')}{' '}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="asset-purchase-date"
                    type="date"
                    value={purchaseDate}
                    onChange={e => setPurchaseDate(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="asset-activation-date" className="font-medium">
                    {t('hr:fixed_assets.create_dialog.activation_date', 'Aktiválás / Használatbavétel dátuma')}{' '}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="asset-activation-date"
                    type="date"
                    value={activationDate}
                    onChange={e => setActivationDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="asset-supplier">
                    {t('hr:fixed_assets.create_dialog.supplier', 'Beszállító / Eladó partner')}
                  </Label>
                  <Input
                    id="asset-supplier"
                    value={supplierName}
                    onChange={e => setSupplierName(e.target.value)}
                    placeholder={t('hr:fixed_assets.create_dialog.supplier_placeholder', 'pl. Alza.hu Kft., Használt gép eladó...')}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="asset-invoice-num">
                    {t('hr:fixed_assets.create_dialog.invoice_number', 'Eredeti számlaszám / Szerződésszám')}
                  </Label>
                  <Input
                    id="asset-invoice-num"
                    value={sourceInvoiceNumber}
                    onChange={e => setSourceInvoiceNumber(e.target.value)}
                    placeholder={t('hr:fixed_assets.create_dialog.invoice_number_placeholder', 'pl. 2023/SZL-00892')}
                  />
                </div>
              </div>

              {/* 3. Előzmény / Nyitó Eszköz Jelölő (Könyvelési védelem) */}
              <div className="p-3.5 rounded-lg border border-border/60 bg-muted/30 space-y-2">
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="asset-is-opening"
                    checked={isOpeningAsset}
                    onChange={e => {
                      setHasManuallyToggledOpening(true);
                      setIsOpeningAsset(e.target.checked);
                    }}
                    className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                  />
                  <div className="flex-1">
                    <Label htmlFor="asset-is-opening" className="font-semibold cursor-pointer block text-foreground">
                      {t('hr:fixed_assets.create_dialog.is_opening_label', 'Előzmény / nyitó eszköz (már szerepel a nyitó mérlegben)')}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {t(
                        'hr:fixed_assets.create_dialog.is_opening_desc',
                        'Bekapcsolva a rendszer NEM generál T [Eszköz] - K 161 aktiválási vegyes napló tételt, megelőzve a nyitó naplóval szembeni duplikációt. A korábbi évek halmozott értékcsökkenését az aktiválás dátuma alapján a rendszer automatikusan számítja.'
                      )}
                    </p>
                  </div>
                </div>
                {isOpeningAsset && (
                  <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 bg-blue-500/10 p-2 rounded border border-blue-500/20">
                    <Info className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {t(
                        'hr:fixed_assets.create_dialog.is_opening_alert',
                        'Nyitó eszköz mód aktív: Nem keletkezik beruházási feladás (161-es számla nem érintett). Az értékcsökkenési leírások ettől függetlenül pontosan fognak kalkulálni.'
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 4. Értékcsökkenés & Leírási módszer */}
            <div className="space-y-3 border-t border-border/50 pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('hr:fixed_assets.create_dialog.section_depreciation', 'Értékcsökkenés és Leírás')}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>{t('hr:fixed_assets.create_dialog.depreciation_method', 'Leírási módszer')}</Label>
                  <Select value={depreciationMethod} onValueChange={setDepreciationMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="linear">{t('hr:fixed_assets.activation_dialog.depreciation_methods.linear', 'Lineáris (Egyenletes)')}</SelectItem>
                      <SelectItem value="degressive_syd">{t('hr:fixed_assets.activation_dialog.depreciation_methods.degressive_syd', 'Degresszív (Évek száma összege)')}</SelectItem>
                      <SelectItem value="degressive_declining">{t('hr:fixed_assets.activation_dialog.depreciation_methods.degressive_declining', 'Degresszív (Nettó érték alapú)')}</SelectItem>
                      <SelectItem value="progressive">{t('hr:fixed_assets.activation_dialog.depreciation_methods.progressive', 'Progresszív (Növekvő)')}</SelectItem>
                      <SelectItem value="performance">{t('hr:fixed_assets.activation_dialog.depreciation_methods.performance', 'Teljesítményarányos')}</SelectItem>
                      <SelectItem value="absolute">{t('hr:fixed_assets.activation_dialog.depreciation_methods.absolute', 'Abszolút összegű')}</SelectItem>
                      <SelectItem value="multiplier">{t('hr:fixed_assets.activation_dialog.depreciation_methods.multiplier', 'Szorzószámos')}</SelectItem>
                      <SelectItem value="immediate">{t('hr:fixed_assets.activation_dialog.depreciation_methods.immediate', 'Azonnali (Kisértékű eszköz)')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>{t('hr:fixed_assets.create_dialog.useful_life', 'Hasznos élettartam')}</Label>
                  <div className="flex gap-2">
                    <div className="flex items-center gap-1.5 flex-1">
                      <Input
                        type="number"
                        min="0"
                        value={usefulLifeYears}
                        onChange={e => setUsefulLifeYears(e.target.value)}
                        disabled={depreciationMethod === 'immediate'}
                        className="w-full font-mono text-sm"
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{t('hr:fixed_assets.create_dialog.years', 'év')}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-1">
                      <Input
                        type="number"
                        min="0"
                        max="11"
                        value={usefulLifeMonths}
                        onChange={e => setUsefulLifeMonths(e.target.value)}
                        disabled={depreciationMethod === 'immediate'}
                        className="w-full font-mono text-sm"
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{t('hr:fixed_assets.create_dialog.months', 'hónap')}</span>
                    </div>
                  </div>
                </div>
              </div>

              {isLowValue && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 p-2.5 rounded-md border border-emerald-500/20">
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {t('hr:fixed_assets.create_dialog.low_value_alert', {
                      defaultValue: `Számviteli politika figyelmeztetés: ${lowValueLimit.toLocaleString('hu-HU')} Ft értékhatár alatti kisértékű eszköz, azonnali 100%-os egyösszegű leírásra jogosult.`,
                      limit: lowValueLimit.toLocaleString('hu-HU'),
                    })}
                  </span>
                </div>
              )}

              {/* Teljesítményarányos extra mezők */}
              {depreciationMethod === 'performance' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-1 duration-200">
                  <div className="space-y-1.5">
                    <Label htmlFor="asset-perf-unit">{t('hr:fixed_assets.create_dialog.perf_unit', 'Mértékegység (pl. km, üzemóra, db)')}</Label>
                    <Input
                      id="asset-perf-unit"
                      value={performanceUnit}
                      onChange={e => setPerformanceUnit(e.target.value)}
                      placeholder={t('hr:fixed_assets.create_dialog.perf_unit_placeholder', 'pl. km')}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="asset-perf-total">{t('hr:fixed_assets.create_dialog.perf_total', 'Tervezett összteljesítmény')}</Label>
                    <Input
                      id="asset-perf-total"
                      type="number"
                      value={totalPlannedPerformance}
                      onChange={e => setTotalPlannedPerformance(e.target.value)}
                      placeholder={t('hr:fixed_assets.create_dialog.perf_total_placeholder', 'pl. 300000')}
                    />
                  </div>
                </div>
              )}

              {/* Ütemezett / szorzós leírás extra mező */}
              {(depreciationMethod === 'absolute' || depreciationMethod === 'multiplier') && (
                <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-200">
                  <Label htmlFor="asset-schedule">
                    {depreciationMethod === 'absolute'
                      ? t('hr:fixed_assets.create_dialog.schedule_label_abs', 'Éves leírási összegek (vesszővel elválasztva, Ft)')
                      : t('hr:fixed_assets.create_dialog.schedule_label_mult', 'Éves szorzók / kulcsok (vesszővel elválasztva)')}
                  </Label>
                  <Input
                    id="asset-schedule"
                    value={depreciationScheduleString}
                    onChange={e => setDepreciationScheduleString(e.target.value)}
                    placeholder={depreciationMethod === 'absolute' ? '500000, 300000, 200000' : '0.4, 0.3, 0.2, 0.1'}
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>{t('hr:fixed_assets.create_dialog.tao_template', 'Társasági Adó (TAO) kulcs sablon')}</Label>
                  <Select value={taoTemplateId || '_none'} onValueChange={v => setTaoTemplateId(v === '_none' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('hr:fixed_assets.create_dialog.tao_template_placeholder', 'Válassz TAO kulcsot...')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">{t('hr:fixed_assets.create_dialog.no_tao_template', 'Nincs TAO sablon hozzárendelve')}</SelectItem>
                      {taoTemplates.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} ({t.tao_rate_percent}%)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>{t('hr:fixed_assets.create_dialog.gl_account', 'Főkönyvi Számlaszám (1xx Befektetett)')}</Label>
                  <Select value={glAccountId || '_none'} onValueChange={v => setGlAccountId(v === '_none' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('hr:fixed_assets.create_dialog.gl_account_placeholder', 'Válassz főkönyvi számlát...')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">{t('hr:fixed_assets.create_dialog.no_gl_account', 'Nincs főkönyvi számla kiválasztva')}</SelectItem>
                      {glAccounts.map((a: any) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.gl_number} — {a.short_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* 5. Telephely, Projekt & Szervezet */}
            <div className="space-y-3 border-t border-border/50 pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('hr:fixed_assets.create_dialog.section_org', 'Helyszín és Projekt Hozzárendelés')}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>{t('hr:fixed_assets.create_dialog.location', 'Telephely / Helyszín')}</Label>
                  <Select value={locationId || '_none'} onValueChange={v => setLocationId(v === '_none' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('hr:fixed_assets.create_dialog.location_placeholder', 'Válassz telephelyet...')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">{t('hr:fixed_assets.create_dialog.no_location', 'Nincs megadva telephely')}</SelectItem>
                      {locations.map(l => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name} {l.address ? `(${l.address})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>{t('hr:fixed_assets.create_dialog.project', 'Projekt')}</Label>
                  <Select value={projectId || '_none'} onValueChange={v => setProjectId(v === '_none' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('hr:fixed_assets.create_dialog.project_placeholder', 'Válassz projektet...')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">{t('hr:fixed_assets.create_dialog.no_project', 'Nincs projekthez rendelve')}</SelectItem>
                      {projects.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} {p.project_code ? `(${p.project_code})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* 6. Fejlesztési Tartalék (opcionális) */}
            {activeReserves.length > 0 && !isOpeningAsset && (
              <div className="space-y-3 border-t border-border/50 pt-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="asset-dev-reserve-toggle"
                    checked={useDevReserve}
                    onChange={e => {
                      const checked = e.target.checked;
                      setUseDevReserve(checked);
                      if (checked && !devReserveId && activeReserves.length > 0) {
                        setDevReserveId(activeReserves[0].id);
                        if (numAcquisition > 0) {
                          setDevReserveAmount(Math.min(numAcquisition, activeReserves[0].remaining_amount || 0));
                        }
                      }
                    }}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                  />
                  <Label htmlFor="asset-dev-reserve-toggle" className="text-sm font-semibold cursor-pointer">
                    {t('hr:fixed_assets.create_dialog.dev_reserve_toggle', 'Fejlesztési tartalék terhére aktiválva (Tao. tv. 7. § (15))')}
                  </Label>
                </div>

                {useDevReserve && (
                  <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-lg space-y-3 animate-in slide-in-from-top-1 duration-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">{t('hr:fixed_assets.create_dialog.dev_reserve_frame', 'Fejlesztési Tartalék Keret')}</Label>
                        <Select value={devReserveId} onValueChange={setDevReserveId}>
                          <SelectTrigger className="h-8 text-xs bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {activeReserves.map(r => (
                              <SelectItem key={r.id} value={r.id} className="text-xs">
                                {t('hr:fixed_assets.create_dialog.dev_reserve_frame_option', {
                                  defaultValue: `${r.creation_year}. évi keret (Szabad: ${(r.remaining_amount || 0).toLocaleString('hu-HU')} Ft)`,
                                  year: r.creation_year,
                                  amount: (r.remaining_amount || 0).toLocaleString('hu-HU')
                                })}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t('hr:fixed_assets.create_dialog.dev_reserve_used_amount', 'Felhasznált összeg (Ft)')}</Label>
                        <Input
                          type="number"
                          value={devReserveAmount}
                          onChange={e => setDevReserveAmount(e.target.value === '' ? '' : Number(e.target.value))}
                          max={numAcquisition}
                          className="h-8 text-xs bg-background font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-border/50 pt-4 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              {t('common:actions.cancel', 'Mégse')}
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 min-w-[140px]"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{t('common:actions.saving', 'Mentés folyamatban...')}</span>
                </>
              ) : (
                <>
                  <Package2 className="h-4 w-4" />
                  <span>{isOpeningAsset ? t('hr:fixed_assets.create_dialog.save_opening', 'Nyitó eszköz rögzítése') : t('hr:fixed_assets.create_dialog.save_new', 'Eszköz mentése')}</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
