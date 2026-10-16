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
import { useDevelopmentReserves, useSaveAssetReserveAllocations } from '@/hooks/useDevelopmentReserves';
import { DevelopmentReserveAllocationSelector, type AllocationItem } from './DevelopmentReserveAllocationSelector';
import { calculateDefaultTaxCreditRetentionUntil } from '@/lib/fixed-assets/taxCreditRestrictionService';
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
  const [depreciationRatePercent, setDepreciationRatePercent] = useState('33.33');
  const [depreciationMethod, setDepreciationMethod] = useState('linear');
  const [performanceUnit, setPerformanceUnit] = useState('');
  const [totalPlannedPerformance, setTotalPlannedPerformance] = useState('');
  const [depreciationScheduleString, setDepreciationScheduleString] = useState('');
  const [taoTemplateId, setTaoTemplateId] = useState('');
  const [taoRateOverride, setTaoRateOverride] = useState('');
  const [taxDepreciationBase, setTaxDepreciationBase] = useState<number | ''>('');
  const [locationId, setLocationId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [glAccountId, setGlAccountId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [sourceInvoiceNumber, setSourceInvoiceNumber] = useState('');
  const [isOpeningAsset, setIsOpeningAsset] = useState(false);
  const [hasManuallyToggledOpening, setHasManuallyToggledOpening] = useState(false);

  // Átvett nyitó karton adatok
  const [lastDepreciationDate, setLastDepreciationDate] = useState(() => `${new Date().getFullYear() - 1}-12-31`);
  const [openingAccumulatedDepreciation, setOpeningAccumulatedDepreciation] = useState<number | ''>('');
  const [openingTaxDepreciation, setOpeningTaxDepreciation] = useState<number | ''>('');

  // Ingatlan és jármű törzsadatok
  const [propertyRegistryNumber, setPropertyRegistryNumber] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [vinChassisNumber, setVinChassisNumber] = useState('');

  // Pályázatos ÉCS
  const [hasGrantFunding, setHasGrantFunding] = useState(false);
  const [grantDepreciationBase, setGrantDepreciationBase] = useState<number | ''>('');
  const [grantDepreciationRate, setGrantDepreciationRate] = useState('20');
  const [grantDepreciationMethod, setGrantDepreciationMethod] = useState('linear');

  // Development reserve allocation (Multi-year FIFO or custom allocation)
  const [useDevReserve, setUseDevReserve] = useState(false);
  const [reserveAllocations, setReserveAllocations] = useState<AllocationItem[]>([]);
  const saveReserveAllocations = useSaveAssetReserveAllocations();

  // Beruházási adókedvezmény és 4 éves megtartási kötelezettség
  const [hasTaxCredit, setHasTaxCredit] = useState(false);
  const [taxCreditType, setTaxCreditType] = useState('KKV_BERUHAZAS');
  const [taxCreditRetentionUntil, setTaxCreditRetentionUntil] = useState('');

  const [submitting, setSubmitting] = useState(false);

  // Kétirányú leírási kulcs ↔ Hasznos élettartam kalkuláció
  const handleUsefulLifeChange = (years: string, months: string) => {
    setUsefulLifeYears(years);
    setUsefulLifeMonths(months);
    const totalMonths = (parseInt(years || '0', 10) * 12) + parseInt(months || '0', 10);
    if (totalMonths > 0) {
      const annualPct = (12 / totalMonths) * 100;
      setDepreciationRatePercent(parseFloat(annualPct.toFixed(2)).toString());
    } else {
      setDepreciationRatePercent('');
    }
  };

  const handleRatePercentChange = (rateStr: string) => {
    setDepreciationRatePercent(rateStr);
    const rate = parseFloat(rateStr);
    if (!isNaN(rate) && rate > 0) {
      const totalMonths = Math.round(12 / (rate / 100));
      const y = Math.floor(totalMonths / 12);
      const m = totalMonths % 12;
      setUsefulLifeYears(y.toString());
      setUsefulLifeMonths(m.toString());
    }
  };

  const handleTaoTemplateChange = (tplId: string) => {
    const val = tplId === '_none' ? '' : tplId;
    setTaoTemplateId(val);
    if (val) {
      const tpl = taoTemplates.find(t => t.id === val);
      if (tpl) {
        setTaoRateOverride(tpl.tao_rate_percent.toString());
      }
    }
  };

  // Dinamikus számlaszám észlelés
  const selectedGlAccount = glAccounts.find((a: any) => a.id === glAccountId);
  const glNumber = selectedGlAccount?.gl_number || '';
  const isRealEstate = glNumber.startsWith('12');
  const isVehicle = glNumber.startsWith('142') || glNumber.startsWith('143');

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
      setDepreciationRatePercent('33.33');
      setDepreciationMethod('linear');
      setPerformanceUnit('');
      setTotalPlannedPerformance('');
      setDepreciationScheduleString('');
      setTaoTemplateId('');
      setTaoRateOverride('');
      setTaxDepreciationBase('');
      setLocationId(locations[0]?.id || '');
      setProjectId('');
      setGlAccountId(glAccounts[0]?.id || '');
      setSupplierName('');
      setSourceInvoiceNumber('');
      setIsOpeningAsset(false);
      setHasManuallyToggledOpening(false);
      setLastDepreciationDate(`${new Date().getFullYear() - 1}-12-31`);
      setOpeningAccumulatedDepreciation('');
      setOpeningTaxDepreciation('');
      setPropertyRegistryNumber('');
      setLicensePlate('');
      setVinChassisNumber('');
      setHasGrantFunding(false);
      setGrantDepreciationBase('');
      setGrantDepreciationRate('20');
      setGrantDepreciationMethod('linear');
      setUseDevReserve(false);
      setReserveAllocations([]);
      setHasTaxCredit(false);
      setTaxCreditType('KKV_BERUHAZAS');
      setTaxCreditRetentionUntil('');
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

    if (isOpeningAsset) {
      const numOpeningAcc = Number(openingAccumulatedDepreciation) || 0;
      const numResidual = Number(residualValue) || 0;
      const maxAllowedOpening = Math.max(0, numAcquisition - numResidual);

      if (numOpeningAcc > maxAllowedOpening) {
        toast({
          title: t('common:status.error'),
          description: `Az átvett halmozott ÉCS (${numOpeningAcc.toLocaleString('hu-HU')} Ft) nem haladhatja meg a bekerülési érték maradványérték feletti részét (${maxAllowedOpening.toLocaleString('hu-HU')} Ft)!`,
          variant: 'destructive',
        });
        return;
      }
    }

    setSubmitting(true);
    try {
      const schedule = (depreciationMethod === 'absolute' || depreciationMethod === 'multiplier')
        ? depreciationScheduleString.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v))
        : null;

      const totalDevReserveAmount = useDevReserve
        ? reserveAllocations.reduce((sum, a) => sum + (Number(a.amount) || 0), 0)
        : 0;
      const primaryReserveId = useDevReserve && reserveAllocations.length > 0
        ? reserveAllocations[0].reserveId
        : null;

      const createdAsset = await createAsset.mutateAsync({
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
        usefulLifeMonths: usefulMonths,
        depreciationMethod,
        performanceUnit: depreciationMethod === 'performance' ? performanceUnit || null : null,
        totalPlannedPerformance: depreciationMethod === 'performance' ? parseFloat(totalPlannedPerformance) || null : null,
        depreciationSchedule: schedule,
        taoTemplateId: taoTemplateId || null,
        taoRateOverride: taoRateOverride !== '' ? parseFloat(taoRateOverride) : null,
        locationId: locationId || null,
        projectId: projectId || null,
        activatedByUserId: user.id,
        activatedByName: userName || 'Adminisztrátor',
        sourceInvoiceId: null,
        sourceInvoiceType: null,
        sourceInvoiceNumber: sourceInvoiceNumber.trim() || null,
        supplierName: supplierName.trim() || null,
        glAccountId: glAccountId || null,
        developmentReserveId: primaryReserveId,
        developmentReserveAmount: totalDevReserveAmount,
        skipLedgerPosting: isOpeningAsset, // Bypasses duplicate 161 ledger posting for opening/historical assets
        // Phase 4 extended fields
        taxDepreciationBase: taxDepreciationBase !== '' ? Number(taxDepreciationBase) : null,
        grantDepreciationBase: hasGrantFunding && grantDepreciationBase !== '' ? Number(grantDepreciationBase) : null,
        grantDepreciationRate: hasGrantFunding && grantDepreciationRate !== '' ? parseFloat(grantDepreciationRate) : null,
        grantDepreciationMethod: hasGrantFunding ? grantDepreciationMethod : null,
        openingAccumulatedDepreciation: isOpeningAsset && openingAccumulatedDepreciation !== '' ? Number(openingAccumulatedDepreciation) : 0,
        openingTaxDepreciation: isOpeningAsset && openingTaxDepreciation !== '' ? Number(openingTaxDepreciation) : 0,
        lastDepreciationDate: isOpeningAsset && lastDepreciationDate ? lastDepreciationDate : null,
        depreciationRatePercent: depreciationRatePercent !== '' ? parseFloat(depreciationRatePercent) : null,
        propertyRegistryNumber: propertyRegistryNumber.trim() || null,
        licensePlate: licensePlate.trim() ? licensePlate.trim().toUpperCase() : null,
        vinChassisNumber: vinChassisNumber.trim() ? vinChassisNumber.trim().toUpperCase() : null,
        hasTaxCredit,
        taxCreditType: hasTaxCredit ? taxCreditType : null,
        taxCreditRetentionUntil: hasTaxCredit && taxCreditRetentionUntil ? taxCreditRetentionUntil : null,
      });

      // Ha többéves allokáció van megadva, mentsük el a kapcsolótáblába
      if (useDevReserve && reserveAllocations.length > 0 && selectedCompany && createdAsset?.id) {
        try {
          await saveReserveAllocations.mutateAsync({
            companyId: selectedCompany.id,
            assetId: createdAsset.id,
            allocations: reserveAllocations,
          });
        } catch (allocErr) {
          reportError({
            type: 'db_query',
            component: 'CreateFixedAssetDialog',
            action: 'saveReserveAllocations',
            message: 'Failed to save multi-year reserve allocations',
            error: allocErr,
          });
        }
      }

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

              {/* Dinamikus azonosítók (Hrsz., Rendszám, Alvázszám) */}
              {(isRealEstate || isVehicle || propertyRegistryNumber || licensePlate || vinChassisNumber) ? (
                <div className="p-3 bg-muted/40 rounded-lg border border-border/60 space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                      {isRealEstate
                        ? t('hr:fixed_assets.create_dialog.real_estate_identifiers', 'Ingatlan Törzsadatok (12-es főkönyv)')
                        : isVehicle
                        ? t('hr:fixed_assets.create_dialog.vehicle_identifiers', 'Gépjármű Törzsadatok (142/143 főkönyv)')
                        : t('hr:fixed_assets.create_dialog.custom_identifiers', 'Egyedi Nyilvántartási Törzsadatok')}
                    </span>
                    {(isRealEstate || isVehicle) && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                        {isRealEstate ? '12xx Ingatlan' : '14x Jármű'}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(isRealEstate || propertyRegistryNumber || (!isRealEstate && !isVehicle)) && (
                      <div className="space-y-1.5">
                        <Label htmlFor="asset-registry-num">
                          {t('hr:fixed_assets.create_dialog.property_registry_number', 'Helyrajzi szám (Hrsz.)')}
                          {isRealEstate && <span className="text-destructive ml-0.5">*</span>}
                        </Label>
                        <Input
                          id="asset-registry-num"
                          value={propertyRegistryNumber}
                          onChange={e => setPropertyRegistryNumber(e.target.value)}
                          placeholder="pl. 12345/6/A/2"
                          className="font-mono text-sm"
                        />
                      </div>
                    )}
                    {(isVehicle || licensePlate || (!isRealEstate && !isVehicle)) && (
                      <div className="space-y-1.5">
                        <Label htmlFor="asset-license-plate">
                          {t('hr:fixed_assets.create_dialog.license_plate', 'Forgalmi rendszám')}
                          {isVehicle && <span className="text-destructive ml-0.5">*</span>}
                        </Label>
                        <Input
                          id="asset-license-plate"
                          value={licensePlate}
                          onChange={e => setLicensePlate(e.target.value.toUpperCase())}
                          placeholder="pl. AA-BB-123"
                          className="font-mono text-sm uppercase"
                        />
                      </div>
                    )}
                    {(isVehicle || vinChassisNumber) && (
                      <div className="space-y-1.5 md:col-span-2">
                        <Label htmlFor="asset-vin">
                          {t('hr:fixed_assets.create_dialog.vin_chassis_number', 'Alvázszám (VIN)')}
                        </Label>
                        <Input
                          id="asset-vin"
                          value={vinChassisNumber}
                          onChange={e => setVinChassisNumber(e.target.value.toUpperCase())}
                          placeholder="pl. WBA31AY08NFP12345"
                          className="font-mono text-xs uppercase"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
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
                  <div className="space-y-3 pt-2 border-t border-border/40 animate-in slide-in-from-top-1 duration-200">
                    <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 bg-blue-500/10 p-2 rounded border border-blue-500/20">
                      <Info className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        {t(
                          'hr:fixed_assets.create_dialog.is_opening_alert',
                          'Nyitó eszköz mód aktív: Nem keletkezik beruházási feladás (161-es számla nem érintett). Az értékcsökkenési leírás a megadott záró dátum utáni naptári hónaptól indul.'
                        )}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="asset-last-dep-date" className="text-xs font-medium">
                          {t('hr:fixed_assets.create_dialog.last_dep_date', 'Utolsó leírt hó határa')} <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="asset-last-dep-date"
                          type="date"
                          value={lastDepreciationDate}
                          onChange={e => setLastDepreciationDate(e.target.value)}
                          className="font-mono text-xs"
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="asset-opening-acc-dep" className="text-xs font-medium">
                          {t('hr:fixed_assets.create_dialog.opening_acc_dep', 'Átvett számviteli halmozott ÉCS (Ft)')}
                        </Label>
                        <Input
                          id="asset-opening-acc-dep"
                          type="number"
                          min="0"
                          step="1"
                          value={openingAccumulatedDepreciation}
                          onChange={e => setOpeningAccumulatedDepreciation(e.target.value === '' ? '' : Number(e.target.value))}
                          placeholder="0"
                          className="font-mono text-xs"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="asset-opening-tax-dep" className="text-xs font-medium">
                          {t('hr:fixed_assets.create_dialog.opening_tax_dep', 'Átvett TAO halmozott ÉCS (Ft)')}
                        </Label>
                        <Input
                          id="asset-opening-tax-dep"
                          type="number"
                          min="0"
                          step="1"
                          value={openingTaxDepreciation}
                          onChange={e => setOpeningTaxDepreciation(e.target.value === '' ? '' : Number(e.target.value))}
                          placeholder="0"
                          className="font-mono text-xs"
                        />
                      </div>
                    </div>

                    {numAcquisition > 0 && (
                      <div className="text-xs text-muted-foreground bg-background/50 p-2 rounded border border-border/40 flex justify-between items-center">
                        <span>Átvételkori induló könyv szerinti nettó érték:</span>
                        <span className="font-bold text-foreground font-mono">
                          {Math.max(0, numAcquisition - (Number(openingAccumulatedDepreciation) || 0)).toLocaleString('hu-HU')} {currency}
                        </span>
                      </div>
                    )}
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
                  <div className="flex items-center justify-between">
                    <Label>{t('hr:fixed_assets.create_dialog.useful_life', 'Hasznos élettartam & Kulcs')}</Label>
                    <span className="text-[11px] text-muted-foreground">Kétirányú kalkuláció</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min="0"
                        value={usefulLifeYears}
                        onChange={e => handleUsefulLifeChange(e.target.value, usefulLifeMonths)}
                        disabled={depreciationMethod === 'immediate'}
                        className="w-full font-mono text-sm"
                        placeholder="0"
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{t('hr:fixed_assets.create_dialog.years', 'év')}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min="0"
                        max="11"
                        value={usefulLifeMonths}
                        onChange={e => handleUsefulLifeChange(usefulLifeYears, e.target.value)}
                        disabled={depreciationMethod === 'immediate'}
                        className="w-full font-mono text-sm"
                        placeholder="0"
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{t('hr:fixed_assets.create_dialog.months', 'hó')}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={depreciationRatePercent}
                        onChange={e => handleRatePercentChange(e.target.value)}
                        disabled={depreciationMethod === 'immediate'}
                        placeholder="33.33"
                        className="w-full font-mono text-sm font-semibold text-primary"
                      />
                      <span className="text-xs font-semibold text-primary whitespace-nowrap">%/év</span>
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
                  <div className="flex items-center justify-between">
                    <Label>{t('hr:fixed_assets.create_dialog.tao_template', 'Társasági Adó (TAO) kulcs')}</Label>
                    <span className="text-[11px] text-muted-foreground">Sablon / egyedi</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={taoTemplateId || '_none'} onValueChange={handleTaoTemplateChange}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('hr:fixed_assets.create_dialog.tao_template_placeholder', 'Válassz TAO kulcsot...')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">{t('hr:fixed_assets.create_dialog.no_tao_template', 'Egyedi kulcs')}</SelectItem>
                        {taoTemplates.map(t => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name} ({t.tao_rate_percent}%)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={taoRateOverride}
                        onChange={e => setTaoRateOverride(e.target.value)}
                        placeholder="pl. 14.5"
                        className="w-full font-mono text-sm font-semibold text-amber-600"
                      />
                      <span className="text-xs font-semibold text-amber-600 whitespace-nowrap">TAO%</span>
                    </div>
                  </div>
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

                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="asset-tax-base" className="text-xs text-muted-foreground">
                    {t('hr:fixed_assets.create_dialog.tax_base_label', 'Eltérő TAO ÉCS alap (opcionális, ha a TAO leírási alap eltér a bekerülési értéktől, Ft)')}
                  </Label>
                  <Input
                    id="asset-tax-base"
                    type="number"
                    min="0"
                    step="1"
                    value={taxDepreciationBase}
                    onChange={e => setTaxDepreciationBase(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder={`Alapértelmezett: ${numAcquisition > 0 ? numAcquisition.toLocaleString('hu-HU') + ' Ft (bekerülési érték)' : 'Bekerülési érték'}`}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            </div>

            {/* 5. Pályázatos / Támogatási Amortizáció (3. ÉCS pálya) */}
            <div className="space-y-3 border-t border-border/50 pt-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="asset-grant-toggle"
                  checked={hasGrantFunding}
                  onChange={e => {
                    const checked = e.target.checked;
                    setHasGrantFunding(checked);
                    if (checked && !grantDepreciationBase && numAcquisition > 0) {
                      setGrantDepreciationBase(numAcquisition);
                    }
                  }}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                />
                <Label htmlFor="asset-grant-toggle" className="text-sm font-semibold cursor-pointer">
                  {t('hr:fixed_assets.create_dialog.grant_toggle', 'Pályázati támogatás terhére vásárolt eszköz (3. ÉCS pálya)')}
                </Label>
              </div>

              {hasGrantFunding && (
                <div className="p-3.5 bg-purple-500/10 border border-purple-500/20 rounded-lg space-y-3 animate-in slide-in-from-top-1 duration-200">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t(
                      'hr:fixed_assets.create_dialog.grant_desc',
                      'Önálló kalkulációs ág a halasztott bevételek (4591 → 964 PIE) feloldásához. A támogatási szerződés szerinti elszámolható költség és támogatási intenzitás alapján.'
                    )}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">{t('hr:fixed_assets.create_dialog.grant_base', 'Támogatott ÉCS alap (Ft)')}</Label>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={grantDepreciationBase}
                        onChange={e => setGrantDepreciationBase(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="pl. 5000000"
                        className="h-8 text-xs bg-background font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('hr:fixed_assets.create_dialog.grant_rate', 'Támogatási éves kulcs (%)')}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={grantDepreciationRate}
                        onChange={e => setGrantDepreciationRate(e.target.value)}
                        placeholder="pl. 20"
                        className="h-8 text-xs bg-background font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('hr:fixed_assets.create_dialog.grant_method', 'Módszer')}</Label>
                      <Select value={grantDepreciationMethod} onValueChange={setGrantDepreciationMethod}>
                        <SelectTrigger className="h-8 text-xs bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="linear">Lineáris</SelectItem>
                          <SelectItem value="immediate">Azonnali</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 6. Beruházási Adókedvezmény és 4 Éves Megtartási Kötelezettség */}
            <div className="space-y-3 border-t border-border/50 pt-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="asset-tax-credit-toggle"
                  checked={hasTaxCredit}
                  onChange={e => {
                    const checked = e.target.checked;
                    setHasTaxCredit(checked);
                    if (checked && !taxCreditRetentionUntil && activationDate) {
                      setTaxCreditRetentionUntil(calculateDefaultTaxCreditRetentionUntil(activationDate));
                    }
                  }}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                />
                <Label htmlFor="asset-tax-credit-toggle" className="text-sm font-semibold cursor-pointer">
                  {t('hr:fixed_assets.create_dialog.tax_credit_toggle', 'Beruházási adókedvezménnyel érintett eszköz (4 éves megtartási kötelezettség)')}
                </Label>
              </div>

              {hasTaxCredit && (
                <div className="p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-lg space-y-3 animate-in slide-in-from-top-1 duration-200">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t(
                      'hr:fixed_assets.create_dialog.tax_credit_desc',
                      'A Tao. tv. szerinti beruházási adókedvezmény igénybevétele esetén az eszköz a megtartási időszak végéig nem idegeníthető el és nem selejtezhető jogkövetkezmény (visszafizetés és késedelmi pótlék) nélkül.'
                    )}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">{t('hr:fixed_assets.create_dialog.tax_credit_type_label', 'Adókedvezmény jogcíme')}</Label>
                      <Select value={taxCreditType} onValueChange={setTaxCreditType}>
                        <SelectTrigger className="h-8 text-xs bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="KKV_BERUHAZAS">Kisvállalkozások beruházási kedvezménye (Tao. tv. 7. § (1) zs))</SelectItem>
                          <SelectItem value="FEJLESZTESI_ADOKEDVEZMENY">Fejlesztési adókedvezmény (Tao. tv. 22/B. §)</SelectItem>
                          <SelectItem value="ENERGIAHATEKONYSAGI">Energiahatékonysági célú beruházás (Tao. tv. 22/E. §)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('hr:fixed_assets.create_dialog.retention_until_label', 'Megtartási kötelezettség záródátuma')}</Label>
                      <Input
                        type="date"
                        value={taxCreditRetentionUntil}
                        onChange={e => setTaxCreditRetentionUntil(e.target.value)}
                        className="h-8 text-xs bg-background font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}
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

            {/* 6. Fejlesztési Tartalék (opcionális, FIFO vagy egyedi többéves keretbontás) */}
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
                      if (!checked) {
                        setReserveAllocations([]);
                      }
                    }}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                  />
                  <Label htmlFor="asset-dev-reserve-toggle" className="text-sm font-semibold cursor-pointer">
                    {t('hr:fixed_assets.create_dialog.dev_reserve_toggle', 'Fejlesztési tartalék terhére aktiválva (Tao. tv. 7. § (15))')}
                  </Label>
                </div>

                {useDevReserve && selectedCompany && (
                  <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-lg space-y-3 animate-in slide-in-from-top-1 duration-200">
                    <DevelopmentReserveAllocationSelector
                      acquisitionValue={numAcquisition}
                      reserves={activeReserves}
                      allocations={reserveAllocations}
                      onChange={setReserveAllocations}
                      currency={currency}
                    />
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
