import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Building2, AlertCircle, Info, MapPin, Plus, X, Sparkles, BookOpen, Calendar, CalendarCheck, Landmark, ExternalLink } from 'lucide-react';
import { useCompanyLocations } from '@/hooks/useCompanyLocations';
import { useToast } from '@/hooks/use-toast';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatAccountOnType, detectAccountFormat } from '@/lib/ibanUtils';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getJurisdictionRules } from '@/hooks/useCompanyJurisdiction';

interface Company {
  id: string;
  name: string;
  owner_id: string;
  tax_number: string | null;
  address: string | null;
  description?: string | null;
  primary_teaor?: string | null;
  country_code?: 'HU' | 'HR' | string | null;
  created_at: string;
}

interface Props {
  selectedCompany: Company | null;
  userId: string | undefined;
  companyName: string;
  setCompanyName: (v: string) => void;
  companyTaxNumber: string;
  setCompanyTaxNumber: (v: string) => void;
  companyAddress: string;
  setCompanyAddress: (v: string) => void;
  companyDescription: string;
  setCompanyDescription: (v: string) => void;
  companyPrimaryTeaor: string;
  setCompanyPrimaryTeaor: (v: string) => void;
  companyCountryCode?: 'HU' | 'HR';
  setCompanyCountryCode?: (v: 'HU' | 'HR') => void;
  isGeneratingDescription: boolean;
  onGenerateDescription: () => void;
  savingCompany: boolean;
  onSave: () => void;
  companies: Company[];
  setSelectedCompany: (c: Company) => void;
  onNavigateToBankAccounts?: () => void;
  children?: React.ReactNode; // CompanyAccessCard + CompanyMembersCard
}

export function BusinessSection({
  selectedCompany, userId, companyName, setCompanyName,
  companyTaxNumber, setCompanyTaxNumber, companyAddress, setCompanyAddress,
  companyDescription, setCompanyDescription, companyPrimaryTeaor, setCompanyPrimaryTeaor,
  companyCountryCode, setCompanyCountryCode,
  isGeneratingDescription, onGenerateDescription,
  savingCompany, onSave, companies, setSelectedCompany,
  onNavigateToBankAccounts, children,
}: Props) {
  const { t } = useTranslation(['settings']);
  const activeCountry = companyCountryCode || (selectedCompany?.country_code as 'HU' | 'HR') || 'HU';
  const jurisdiction = getJurisdictionRules(activeCountry);
  const isOwner = selectedCompany?.owner_id === userId;
  const { toast } = useToast();
  const { locations, isLoading: locationsLoading, addLocation, deleteLocation } = useCompanyLocations(selectedCompany?.id);
  const { effectiveSettings: compEffectiveSettings, saveMutation: compSaveMutation } = useCompanySettings();
  const [glBasis, setGlBasis] = useState<'kibocsatas' | 'teljesites'>('kibocsatas');

  const { data: companyBankAccounts = [], isLoading: bankAccountsLoading } = useQuery({
    queryKey: ['company-bank-accounts', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase
        .from('company_bank_accounts')
        .select('id, bank_name, account_number, currency, created_at')
        .eq('company_id', selectedCompany.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id,
  });

  useEffect(() => {
    if (compEffectiveSettings?.gl_date_basis) {
      setGlBasis(compEffectiveSettings.gl_date_basis as 'kibocsatas' | 'teljesites');
    }
  }, [compEffectiveSettings?.gl_date_basis]);

  const handleGlBasisChange = async (newBasis: 'kibocsatas' | 'teljesites') => {
    if (newBasis === glBasis || compSaveMutation.isPending) return;
    const prevBasis = glBasis;
    setGlBasis(newBasis);
    try {
      await compSaveMutation.mutateAsync({ gl_date_basis: newBasis });
    } catch {
      // Revert optimistic state if mutation fails (error toast shown by mutation)
      setGlBasis(prevBasis);
    }
  };

  // New location form state
  const [showNewLocation, setShowNewLocation] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');
  const [newLocationAddress, setNewLocationAddress] = useState('');
  const [addingLocation, setAddingLocation] = useState(false);

  const handleAddLocation = async () => {
    const name = (newLocationName || '').trim();
    const address = (newLocationAddress || '').trim();
    if (!name || !address) return;
    setAddingLocation(true);
    try {
      await addLocation.mutateAsync({
        name,
        address,
        location_type: 'branch',
      });
      toast({ title: 'Siker', description: 'Telephely sikeresen hozzáadva.' });
      setNewLocationName('');
      setNewLocationAddress('');
      setShowNewLocation(false);
    } catch {
      toast({ title: 'Hiba', description: 'Nem sikerült a telephely hozzáadása.', variant: 'destructive' });
    } finally {
      setAddingLocation(false);
    }
  };

  const handleDeleteLocation = async (locationId: string) => {
    try {
      await deleteLocation.mutateAsync(locationId);
      toast({ title: 'Siker', description: 'Telephely eltávolítva.' });
    } catch {
      toast({ title: 'Hiba', description: 'Nem sikerült a telephely törlése.', variant: 'destructive' });
    }
  };

  // Filter locations for display (branches only — headquarters shown as the main address)
  const branchLocations = locations.filter(l => l.location_type === 'branch');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {t('business.selected_company_title', 'Kiválasztott cég adatai')}
          </CardTitle>
          <CardDescription>
            {selectedCompany ? (
              <>{t('business.selected_company_prefix', 'Az aktuálisan kiválasztott cég:')} <strong>{selectedCompany.name}</strong></>
            ) : t('business.select_company_hint', 'Válassz céget a felső menüből')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedCompany ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{t('business.no_selected_company', 'Nincs kiválasztott cég. A cég adatainak szerkesztéséhez válassz egy céget a felső menüből.')}</AlertDescription>
            </Alert>
          ) : (
            <>
              {!isOwner && (
                <Alert className="mb-4">
                  <Info className="h-4 w-4" />
                  <AlertDescription>{t('business.owner_only_edit', 'Csak a tulajdonos szerkesztheti a cég adatait.')}</AlertDescription>
                </Alert>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company_country">{t('business.country', 'Ország / Joghatóság')}</Label>
                  {setCompanyCountryCode ? (
                    <Select
                      value={activeCountry}
                      onValueChange={(val) => setCompanyCountryCode(val as 'HU' | 'HR')}
                      disabled={!isOwner}
                    >
                      <SelectTrigger id="company_country" className="bg-card">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HU">🇭🇺 Magyarország (HU)</SelectItem>
                        <SelectItem value="HR">🇭🇷 Horvátország (HR)</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="h-10 px-3 py-2 rounded-md border border-input bg-muted/50 text-sm flex items-center gap-2">
                      <span>{activeCountry === 'HR' ? '🇭🇷 Horvátország (HR)' : '🇭🇺 Magyarország (HU)'}</span>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company_name">{t('business.company_name', 'Cég neve')} *</Label>
                  <Input id="company_name" value={companyName || ''} onChange={e => setCompanyName(e.target.value)} placeholder="Pl. Példa Kft." disabled={!isOwner} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tax_number">{jurisdiction.taxNumberLabel}</Label>
                  <Input 
                    id="tax_number" 
                    value={companyTaxNumber || ''} 
                    onChange={e => setCompanyTaxNumber(e.target.value)} 
                    placeholder={jurisdiction.taxNumberPlaceholder} 
                    disabled={!isOwner} 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_address">{t('business.address', 'Székhely')}</Label>
                <Textarea id="company_address" value={companyAddress || ''} onChange={e => setCompanyAddress(e.target.value)} placeholder="Pl. 1234 Budapest, Példa utca 1." rows={3} disabled={!isOwner} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company_teaor">{t('business.primary_teaor', 'Elsődleges TEÁOR kód')}</Label>
                  <Input id="company_teaor" value={companyPrimaryTeaor} onChange={e => setCompanyPrimaryTeaor(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="Pl. 6201" maxLength={4} disabled={!isOwner} />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="company_description">{t('business.description', 'Cég tevékenységének bemutatása')}</Label>
                  {isOwner && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-primary hover:text-primary/80 gap-1 px-2"
                      onClick={onGenerateDescription}
                      disabled={isGeneratingDescription || !companyPrimaryTeaor.trim()}
                    >
                      <Sparkles className={`h-3.5 w-3.5 ${isGeneratingDescription ? 'animate-spin' : ''}`} />
                      {isGeneratingDescription ? 'Generálás...' : t('business.generate_ai', 'Generálás AI-al')}
                    </Button>
                  )}
                </div>
                <Textarea id="company_description" value={companyDescription} onChange={e => setCompanyDescription(e.target.value)} placeholder="Mutasd be röviden a cég tevékenységét és üzletmenetét a pontosabb automatikus könyvelés érdekében..." rows={3} disabled={!isOwner} />
              </div>
              <div className="flex items-center gap-4 pt-2">
                {isOwner && (
                  <Button onClick={onSave} disabled={!companyName?.trim() || savingCompany}>
                    {savingCompany ? 'Mentés...' : t('business.save_button', 'Cég adatainak mentése')}
                  </Button>
                )}
                <p className="text-sm text-muted-foreground">
                  Létrehozva: {new Date(selectedCompany.created_at).toLocaleDateString('hu-HU')}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Céges bankszámlák és IBAN azonosítók áttekintése */}
      {selectedCompany && (
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Landmark className="h-5 w-5 text-primary" />
                  {t('business.bank_accounts_overview_title', 'Céges bankszámlák és IBAN azonosítók')}
                </CardTitle>
                <CardDescription>
                  {t('business.bank_accounts_overview_desc', 'A céghez tartozó belföldi GIRO és nemzetközi IBAN bankszámlák a banki utalási exportokhoz.')}
                </CardDescription>
              </div>
              {onNavigateToBankAccounts && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={onNavigateToBankAccounts}
                >
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                  {t('business.manage_bank_accounts', 'Bankszámlák kezelése')}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {bankAccountsLoading ? (
              <p className="text-sm text-muted-foreground">{t('common:loading', 'Betöltés...')}</p>
            ) : companyBankAccounts.length === 0 ? (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {t('business.no_bank_accounts_warning', 'Még nincs céges bankszámla rögzítve')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('business.no_bank_accounts_hint', 'Rögzítsd a cég GIRO vagy IBAN számlaszámát a kimenő utalási csomagok (SEPA XML, OTP, MBH, CIB) készítéséhez.')}
                    </p>
                  </div>
                </div>
                {onNavigateToBankAccounts && (
                  <Button size="sm" onClick={onNavigateToBankAccounts} className="shrink-0 gap-1.5">
                    <Plus className="h-4 w-4" />
                    {t('business.add_first_bank_account', 'Számla hozzáadása')}
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {companyBankAccounts.map((acc: any) => {
                  const fmt = detectAccountFormat(acc.account_number);
                  return (
                    <div
                      key={acc.id}
                      className="p-3.5 rounded-xl border border-border/70 bg-card hover:bg-muted/30 transition-all flex flex-col justify-between gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                          <Landmark className="h-3.5 w-3.5 text-primary" />
                          {acc.bank_name}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0">
                            {acc.currency}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] font-medium px-1.5 py-0",
                              fmt === 'iban' ? "border-sky-500/40 text-sky-600 dark:text-sky-400 bg-sky-500/5" : "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5"
                            )}
                          >
                            {fmt === 'iban' ? 'IBAN' : 'GIRO'}
                          </Badge>
                        </div>
                      </div>
                      <div className="font-mono text-xs font-semibold tracking-wider text-muted-foreground bg-muted/40 px-2.5 py-1.5 rounded-md select-all">
                        {formatAccountOnType(acc.account_number)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Telephelyek szekció */}
      {selectedCompany && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  {t('business.locations_title', 'Telephelyek')}
                </CardTitle>
                <CardDescription>{t('business.locations_subtitle', 'A céghez tartozó telephelyek és fióktelepek kezelése')}</CardDescription>
              </div>
              {isOwner && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setShowNewLocation(!showNewLocation)}
                >
                  <Plus className="h-4 w-4" />
                  {t('business.new_location', 'Új telephely')}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* New location form */}
            {showNewLocation && isOwner && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                <p className="text-sm font-semibold">Új telephely hozzáadása</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="new_location_name" className="text-sm">Telephely neve *</Label>
                    <Input
                      id="new_location_name"
                      value={newLocationName}
                      onChange={e => setNewLocationName(e.target.value)}
                      placeholder="Pl. Debreceni Raktár"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new_location_address" className="text-sm">Cím *</Label>
                    <Input
                      id="new_location_address"
                      value={newLocationAddress}
                      onChange={e => setNewLocationAddress(e.target.value)}
                      placeholder="Pl. 4032 Debrecen, Ipari utca 5."
                      className="h-9"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={!newLocationName?.trim() || !newLocationAddress?.trim() || addingLocation}
                    onClick={handleAddLocation}
                  >
                    {addingLocation ? 'Hozzáadás...' : 'Hozzáadás'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setShowNewLocation(false); setNewLocationName(''); setNewLocationAddress(''); }}>
                    Mégse
                  </Button>
                </div>
              </div>
            )}

            {/* Existing locations list */}
            {locationsLoading ? (
              <p className="text-sm text-muted-foreground">Betöltés...</p>
            ) : locations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nincsenek telephelyek hozzáadva.</p>
            ) : (
              <div className="space-y-2">
                {locations.map(location => (
                  <div
                    key={location.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        location.location_type === 'headquarters'
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        <MapPin className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {location.name}
                          {location.location_type === 'headquarters' && (
                            <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                              Székhely
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">{location.address}</p>
                      </div>
                    </div>
                    {isOwner && location.location_type !== 'headquarters' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive opacity-50 hover:opacity-100"
                        onClick={() => handleDeleteLocation(location.id)}
                        title="Telephely törlése"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Főkönyvi és Könyvelési beállítások */}
      {selectedCompany && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              {t('business.accounting_settings_title', 'Főkönyvi és Könyvelési beállítások')}
            </CardTitle>
            <CardDescription>
              A cég főkönyvi kimutatásaiban és egyenlegkivonataiban alkalmazott alapértelmezett beállítások
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Adatgyűjtés alapértelmezett dátum alapja</Label>
              <p className="text-xs text-muted-foreground">
                Válaszd ki, hogy a főkönyv megnyitásakor a bizonylatok kiállítási kelte vagy a gazdasági teljesítés dátuma alapján gyűjtse az adatokat.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <label
                  className={cn(
                    "flex items-start gap-3 p-3.5 rounded-xl border transition-all",
                    isOwner && !compSaveMutation.isPending ? "cursor-pointer" : "cursor-default opacity-80",
                    glBasis === 'kibocsatas'
                      ? "border-primary bg-primary/5 dark:bg-primary/10 ring-1 ring-primary"
                      : "border-border bg-card hover:bg-muted/50"
                  )}
                >
                  <input
                    type="radio"
                    name="main_gl_date_basis"
                    value="kibocsatas"
                    checked={glBasis === 'kibocsatas'}
                    onChange={() => isOwner && !compSaveMutation.isPending && handleGlBasisChange('kibocsatas')}
                    disabled={!isOwner || compSaveMutation.isPending}
                    className="mt-1 accent-primary"
                  />
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      Kibocsátás kelte (Alapértelmezett)
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      A számlák és bizonylatok hivatalos kiállítási dátuma alapján veszi figyelembe a tételeket.
                    </p>
                  </div>
                </label>

                <label
                  className={cn(
                    "flex items-start gap-3 p-3.5 rounded-xl border transition-all",
                    isOwner && !compSaveMutation.isPending ? "cursor-pointer" : "cursor-default opacity-80",
                    glBasis === 'teljesites'
                      ? "border-primary bg-primary/5 dark:bg-primary/10 ring-1 ring-primary"
                      : "border-border bg-card hover:bg-muted/50"
                  )}
                >
                  <input
                    type="radio"
                    name="main_gl_date_basis"
                    value="teljesites"
                    checked={glBasis === 'teljesites'}
                    onChange={() => isOwner && !compSaveMutation.isPending && handleGlBasisChange('teljesites')}
                    disabled={!isOwner || compSaveMutation.isPending}
                    className="mt-1 accent-primary"
                  />
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
                      <CalendarCheck className="w-3.5 h-3.5 text-primary" />
                      Teljesítés dátuma
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      A gazdasági esemény vagy szolgáltatás tényleges teljesítésének napja alapján gyűjti az adatokat.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {children}

      {companies.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('business.all_companies_title', 'Összes cég áttekintése')}</CardTitle>
            <CardDescription>A fiókodhoz tartozó összes cég</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {companies.map(company => (
                <div
                  key={company.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    selectedCompany?.id === company.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <div>
                    <p className="font-medium">{company.name}</p>
                    <p className="text-sm text-muted-foreground">{company.tax_number || 'Nincs adószám megadva'}</p>
                  </div>
                  {selectedCompany?.id !== company.id ? (
                    <Button variant="outline" size="sm" onClick={() => setSelectedCompany(company)}>Kiválasztás</Button>
                  ) : (
                    <span className="text-sm text-primary font-medium">Aktív</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
