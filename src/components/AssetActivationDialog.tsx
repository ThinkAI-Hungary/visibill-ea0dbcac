import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTaoTemplates, useCreateFixedAsset, generateInventoryNumber, useAssetGlAccounts } from '@/hooks/useFixedAssets';
import { useCompanyLocations } from '@/hooks/useCompanyLocations';
import { useProjectList } from '@/hooks/useProjectList';
import { useActivePreset } from '@/hooks/useActivePreset';
import { supabase } from '@/integrations/supabase/client';
import { Package2, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { reportError } from '@/lib/errorReporter';
import { useCompanyAccountingRule } from '@/hooks/useAccountingPolicy';

interface SelectedItem {
  id: string;
  name: string;
  netAmount: number;
  grossAmount: number;
  currency: string;
}

interface InvoiceInfo {
  invoiceId: string;
  invoiceType: 'submitted' | 'nav';
  invoiceNumber: string;
  invoiceDate: string;
  supplierName: string;
  projectId?: string | null;
}

interface AssetActivationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedItems: SelectedItem[];
  invoiceInfo: InvoiceInfo;
  onSuccess?: () => void;
}

export function AssetActivationDialog({
  open,
  onOpenChange,
  selectedItems,
  invoiceInfo,
  onSuccess,
}: AssetActivationDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  const { data: taoTemplates = [] } = useTaoTemplates();
  const { locations } = useCompanyLocations(selectedCompany?.id);
  const { projects = [] } = useProjectList();
  const { activePresetId } = useActivePreset(selectedCompany?.id);
  const { data: glAccounts = [] } = useAssetGlAccounts(selectedCompany?.id, activePresetId);
  const createAsset = useCreateFixedAsset();

  // Profile name for the activated_by field
  const [userName, setUserName] = useState('');
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const { data } = await supabase.from('profiles').select('name').eq('user_id', user.id).single();
      if (data?.name) setUserName(data.name);
    };
    fetchProfile();
  }, [user]);

  // Form state - one record per selected item
  const [forms, setForms] = useState<Array<{
    name: string;
    description: string;
    vtszTeszor: string;
    acquisitionValue: number;
    activationDate: string;
    usefulLifeYears: string;
    usefulLifeMonths: string;
    residualValue: string;
    taoTemplateId: string;
    locationId: string;
    projectId: string;
    glAccountId: string;
    depreciationMethod: string;
    performanceUnit: string;
    totalPlannedPerformance: string;
    depreciationScheduleString: string;
  }>>([]);

  const { value: lowValueThresholdRule } = useCompanyAccountingRule(
    selectedCompany?.id,
    'low_value_asset_threshold',
    { amount: 200000 }
  );
  const lowValueLimit = Number(lowValueThresholdRule?.amount) || 200000;

  // Initialize forms when dialog opens
  useEffect(() => {
    if (open && selectedItems.length > 0) {
      setActiveTab(0);
      setForms(selectedItems.map(item => {
        const val = item.grossAmount || item.netAmount;
        const isLowValue = val > 0 && val <= lowValueLimit;
        return {
          name: item.name,
          description: '',
          vtszTeszor: '',
          acquisitionValue: val,
          activationDate: new Date().toISOString().split('T')[0],
          usefulLifeYears: isLowValue ? '0' : '3',
          usefulLifeMonths: '0',
          residualValue: '0',
          taoTemplateId: '',
          locationId: '',
          projectId: invoiceInfo.projectId || '',
          glAccountId: '',
          depreciationMethod: isLowValue ? 'immediate' : 'linear',
          performanceUnit: '',
          totalPlannedPerformance: '',
          depreciationScheduleString: '',
        };
      }));
    }
  }, [open, selectedItems, invoiceInfo.projectId, lowValueLimit]);

  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  const handleSubmit = async () => {
    if (!selectedCompany || !user) return;
    setSubmitting(true);

    try {
      for (let i = 0; i < forms.length; i++) {
        const form = forms[i];
        const usefulMonths = parseInt(form.usefulLifeYears) * 12 + parseInt(form.usefulLifeMonths || '0');

        if (!form.name.trim() || (form.depreciationMethod !== 'immediate' && usefulMonths <= 0)) {
          toast({
            title: t('common:status.error'),
            description: t('hr:fixed_assets.activation_dialog.validation_error', {
              index: i + 1,
              defaultValue: `Az ${i + 1}. tétel neve és hasznos élettartama kötelező.`,
            }),
            variant: 'destructive',
          });
          setSubmitting(false);
          return;
        }

        const inventoryNumber = await generateInventoryNumber(
          selectedCompany.id,
          invoiceInfo.invoiceNumber
        );

        const schedule = (form.depreciationMethod === 'absolute' || form.depreciationMethod === 'multiplier')
          ? form.depreciationScheduleString.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v))
          : null;

        await createAsset.mutateAsync({
          companyId: selectedCompany.id,
          userId: user.id,
          inventoryNumber,
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          vtszTeszor: form.vtszTeszor.trim() || undefined,
          acquisitionValue: form.acquisitionValue,
          residualValue: parseFloat(form.residualValue) || 0,
          currency: selectedItems[i].currency || 'HUF',
          purchaseDate: invoiceInfo.invoiceDate,
          activationDate: form.activationDate,
          usefulLifeMonths: usefulMonths,
          depreciationMethod: form.depreciationMethod,
          performanceUnit: form.depreciationMethod === 'performance' ? form.performanceUnit || null : null,
          totalPlannedPerformance: form.depreciationMethod === 'performance' ? parseFloat(form.totalPlannedPerformance) || null : null,
          depreciationSchedule: schedule,
          taoTemplateId: form.taoTemplateId || null,
          locationId: form.locationId || null,
          projectId: form.projectId || null,
          activatedByUserId: user.id,
          activatedByName: userName,
          sourceInvoiceId: invoiceInfo.invoiceId,
          sourceInvoiceType: invoiceInfo.invoiceType,
          sourceInvoiceNumber: invoiceInfo.invoiceNumber,
          supplierName: invoiceInfo.supplierName,
          glAccountId: form.glAccountId || null,
        });
      }

      toast({
        title: t('common:status.success'),
        description: t('hr:fixed_assets.activation_dialog.success_toast', {
          count: forms.length,
          defaultValue: `${forms.length} eszköz sikeresen aktiválva.`,
        }),
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      reportError({ type: 'db_query', component: 'AssetActivationDialog', action: 'activateAsset', message: error?.message || 'Asset activation failed', error });
      toast({
        title: t('common:status.error'),
        description: error?.message || t('hr:fixed_assets.activation_dialog.error_toast'),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const updateForm = (index: number, field: string, value: any) => {
    setForms(prev => prev.map((f, i) => i === index ? { ...f, [field]: value } : f));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package2 className="h-5 w-5 text-primary" />
            {t('hr:fixed_assets.activation_dialog.title')}
          </DialogTitle>
          <DialogDescription>
            {selectedItems.length === 1
              ? t('hr:fixed_assets.activation_dialog.description_single')
              : t('hr:fixed_assets.activation_dialog.description_multiple', {
                  count: selectedItems.length,
                  defaultValue: `${selectedItems.length} tétel aktiválása eszközként.`,
                })
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Invoice info (read-only) */}
          <div className="rounded-lg border border-border/50 p-3 bg-muted/20">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <div>
                <span className="text-muted-foreground">{t('hr:fixed_assets.activation_dialog.invoice_number')}</span>
                <span className="ml-2 font-mono font-semibold">{invoiceInfo.invoiceNumber}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t('hr:fixed_assets.activation_dialog.supplier')}</span>
                <span className="ml-2 font-semibold">{invoiceInfo.supplierName}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t('hr:fixed_assets.activation_dialog.purchase_date')}</span>
                <span className="ml-2 font-semibold">{invoiceInfo.invoiceDate}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t('hr:fixed_assets.activation_dialog.activated_by')}</span>
                <span className="ml-2 font-semibold">{userName || t('hr:fixed_assets.activation_dialog.unknown_user')}</span>
              </div>
            </div>
          </div>

          {/* Tabs — only visible when multiple items */}
          {forms.length > 1 && (
            <div className="flex flex-wrap items-center gap-1 border-b border-border/50 pb-0">
              {forms.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveTab(i)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors border-b-2 -mb-[1px]",
                    activeTab === i
                      ? "border-primary text-primary bg-primary/5"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  {i + 1}.
                </button>
              ))}
            </div>
          )}

          {/* Active item form */}
          {forms.map((form, index) => (
            <div
              key={index}
              className={cn("space-y-4", index !== activeTab && forms.length > 1 && "hidden")}
            >
              {forms.length > 1 && (
                <p className="text-xs text-muted-foreground">
                  {selectedItems[index]?.name} — {selectedItems[index]?.grossAmount || selectedItems[index]?.netAmount} {selectedItems[index]?.currency}
                </p>
              )}

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`name-${index}`}>{t('hr:fixed_assets.activation_dialog.name_label')}</Label>
                    <Input
                      id={`name-${index}`}
                      value={form.name}
                      onChange={e => updateForm(index, 'name', e.target.value)}
                      placeholder={t('hr:fixed_assets.activation_dialog.name_placeholder')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`vtsz-${index}`}>{t('hr:fixed_assets.activation_dialog.vtsz_label')}</Label>
                    <Input
                      id={`vtsz-${index}`}
                      value={form.vtszTeszor}
                      onChange={e => updateForm(index, 'vtszTeszor', e.target.value)}
                      placeholder={t('hr:fixed_assets.activation_dialog.vtsz_placeholder')}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`desc-${index}`}>{t('hr:fixed_assets.activation_dialog.description_label')}</Label>
                  <Input
                    id={`desc-${index}`}
                    value={form.description}
                    onChange={e => updateForm(index, 'description', e.target.value)}
                    placeholder={t('hr:fixed_assets.activation_dialog.description_placeholder')}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`value-${index}`}>{t('hr:fixed_assets.activation_dialog.acquisition_value_label')}</Label>
                    <Input
                      id={`value-${index}`}
                      type="number"
                      value={form.acquisitionValue}
                      onChange={e => updateForm(index, 'acquisitionValue', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`activation-date-${index}`}>{t('hr:fixed_assets.activation_dialog.activation_date_label')}</Label>
                    <Input
                      id={`activation-date-${index}`}
                      type="date"
                      value={form.activationDate}
                      onChange={e => updateForm(index, 'activationDate', e.target.value)}
                    />
                  </div>
                </div>

                {form.acquisitionValue > 0 && form.acquisitionValue <= lowValueLimit && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 p-2 rounded-md border border-emerald-500/20">
                    <Sparkles className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      Számviteli politika: Kisértékű eszköz (értékhatár: {lowValueLimit.toLocaleString('hu-HU')} Ft) &bull; Azonnali egyösszegű leírás beállítva.
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('hr:fixed_assets.activation_dialog.useful_life_label')}</Label>
                    <div className="flex gap-2">
                      <div className="flex items-center gap-1.5 flex-1">
                        <Input
                          type="number"
                          min="0"
                          value={form.usefulLifeYears}
                          onChange={e => updateForm(index, 'usefulLifeYears', e.target.value)}
                          className="w-full"
                        />
                        <span className="text-sm text-muted-foreground whitespace-nowrap">{t('hr:fixed_assets.activation_dialog.years_unit')}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-1">
                        <Input
                          type="number"
                          min="0"
                          max="11"
                          value={form.usefulLifeMonths}
                          onChange={e => updateForm(index, 'usefulLifeMonths', e.target.value)}
                          className="w-full"
                        />
                        <span className="text-sm text-muted-foreground whitespace-nowrap">{t('hr:fixed_assets.activation_dialog.months_unit')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`residual-${index}`}>{t('hr:fixed_assets.activation_dialog.residual_value_label')}</Label>
                    <Input
                      id={`residual-${index}`}
                      type="number"
                      value={form.residualValue}
                      onChange={e => updateForm(index, 'residualValue', e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="space-y-2 border-t pt-4">
                  <Label>{t('hr:fixed_assets.activation_dialog.depreciation_method_label')}</Label>
                  <Select
                    value={form.depreciationMethod}
                    onValueChange={v => updateForm(index, 'depreciationMethod', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('hr:fixed_assets.activation_dialog.depreciation_methods.linear')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="linear">{t('hr:fixed_assets.activation_dialog.depreciation_methods.linear')}</SelectItem>
                      <SelectItem value="degressive_syd">{t('hr:fixed_assets.activation_dialog.depreciation_methods.degressive_syd')}</SelectItem>
                      <SelectItem value="degressive_declining">{t('hr:fixed_assets.activation_dialog.depreciation_methods.degressive_declining')}</SelectItem>
                      <SelectItem value="progressive">{t('hr:fixed_assets.activation_dialog.depreciation_methods.progressive')}</SelectItem>
                      <SelectItem value="performance">{t('hr:fixed_assets.activation_dialog.depreciation_methods.performance')}</SelectItem>
                      <SelectItem value="absolute">{t('hr:fixed_assets.activation_dialog.depreciation_methods.absolute')}</SelectItem>
                      <SelectItem value="multiplier">{t('hr:fixed_assets.activation_dialog.depreciation_methods.multiplier')}</SelectItem>
                      <SelectItem value="immediate">{t('hr:fixed_assets.activation_dialog.depreciation_methods.immediate')}</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.acquisitionValue > 0 && form.acquisitionValue <= lowValueLimit && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-850 rounded px-2.5 py-1.5 mt-1.5">
                      <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                      <span>
                        {t('hr:fixed_assets.activation_dialog.policy_low_value_applied', {
                          amount: lowValueLimit.toLocaleString('hu-HU'),
                          defaultValue: `Számviteli politika: ${lowValueLimit.toLocaleString('hu-HU')} Ft alatti kisértékű eszköz azonnali egyösszegű leírásra került.`
                        })}
                      </span>
                    </div>
                  )}
                </div>

                {form.depreciationMethod === 'performance' && (
                  <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-1 duration-200">
                    <div className="space-y-2">
                      <Label htmlFor={`perf-unit-${index}`}>{t('hr:fixed_assets.activation_dialog.perf_unit_label')}</Label>
                      <Input
                        id={`perf-unit-${index}`}
                        value={form.performanceUnit}
                        onChange={e => updateForm(index, 'performanceUnit', e.target.value)}
                        placeholder={t('hr:fixed_assets.activation_dialog.perf_unit_placeholder')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`perf-total-${index}`}>{t('hr:fixed_assets.activation_dialog.perf_total_label')}</Label>
                      <Input
                        id={`perf-total-${index}`}
                        type="number"
                        value={form.totalPlannedPerformance}
                        onChange={e => updateForm(index, 'totalPlannedPerformance', e.target.value)}
                        placeholder={t('hr:fixed_assets.activation_dialog.perf_total_placeholder')}
                      />
                    </div>
                  </div>
                )}

                {(form.depreciationMethod === 'absolute' || form.depreciationMethod === 'multiplier') && (
                  <div className="space-y-2 animate-in slide-in-from-top-1 duration-200">
                    <Label htmlFor={`schedule-${index}`}>
                      {form.depreciationMethod === 'absolute'
                        ? t('hr:fixed_assets.activation_dialog.schedule_label_absolute')
                        : t('hr:fixed_assets.activation_dialog.schedule_label_multiplier')
                      }
                    </Label>
                    <Input
                      id={`schedule-${index}`}
                      value={form.depreciationScheduleString}
                      onChange={e => updateForm(index, 'depreciationScheduleString', e.target.value)}
                      placeholder={form.depreciationMethod === 'absolute'
                        ? t('hr:fixed_assets.activation_dialog.schedule_placeholder_absolute')
                        : t('hr:fixed_assets.activation_dialog.schedule_placeholder_multiplier')
                      }
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 border-t pt-4">
                  <div className="space-y-2">
                    <Label>{t('hr:fixed_assets.activation_dialog.tao_template_label')}</Label>
                    <Select
                      value={form.taoTemplateId}
                      onValueChange={v => updateForm(index, 'taoTemplateId', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('hr:fixed_assets.activation_dialog.tao_template_placeholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {taoTemplates.map(t => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name} ({t.tao_rate_percent}%)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('hr:fixed_assets.activation_dialog.location_label')}</Label>
                    <Select
                      value={form.locationId}
                      onValueChange={v => updateForm(index, 'locationId', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('hr:fixed_assets.activation_dialog.location_placeholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {locations.map(l => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.location_type === 'headquarters'
                              ? `${l.address} ${t('hr:fixed_assets.activation_dialog.headquarters_suffix')}`
                              : l.address}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('hr:fixed_assets.activation_dialog.project_label')}</Label>
                    <Select
                      value={form.projectId || '_none'}
                      onValueChange={v => updateForm(index, 'projectId', v === '_none' ? '' : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('hr:fixed_assets.activation_dialog.project_placeholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">{t('hr:fixed_assets.activation_dialog.no_project')}</SelectItem>
                        {projects.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {glAccounts.length > 0 && (
                    <div className="space-y-2">
                      <Label>{t('hr:fixed_assets.activation_dialog.gl_account_label')}</Label>
                      <Select
                        value={form.glAccountId}
                        onValueChange={v => updateForm(index, 'glAccountId', v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('hr:fixed_assets.activation_dialog.gl_account_placeholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          {glAccounts.map((a: any) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.gl_number} — {a.short_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t('hr:fixed_assets.activation_dialog.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || forms.length === 0}
            className="gap-2"
          >
            <Package2 className="h-4 w-4" />
            {submitting
              ? t('hr:fixed_assets.activation_dialog.activating')
              : t('hr:fixed_assets.activation_dialog.activate_button', {
                  count: forms.length,
                  defaultValue: `Aktiválás (${forms.length} tétel)`,
                })
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
