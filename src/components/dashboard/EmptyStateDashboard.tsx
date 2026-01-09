import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Euro, TrendingUp, PieChart, Building2, ArrowRight, ArrowLeft, Check, Plus, X, FolderOpen, Tags, Shield, Mail, Copy, RefreshCw, CheckCircle } from 'lucide-react';
import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface OnboardingProject {
  name: string;
  client_name: string;
  description: string;
  status: 'active' | 'completed' | 'on_hold' | 'cancelled';
}

interface OnboardingCategory {
  name: string;
  description: string;
}

interface NavCredentialsData {
  nav_username: string;
  nav_password: string;
  nav_tax_number: string;
  nav_sign_key: string;
  nav_exchange_key: string;
}

const StepIndicator = ({ currentStep }: { currentStep: number }) => {
  const steps = [
    { num: 1, label: 'Cég' },
    { num: 2, label: 'Projektek' },
    { num: 3, label: 'Kategóriák' },
    { num: 4, label: 'NAV' },
    { num: 5, label: 'Email' },
  ];

  return (
    <div className="flex items-center justify-center gap-1 mb-6">
      {steps.map((step, index) => (
        <div key={step.num} className="flex items-center gap-1">
          <div className="flex flex-col items-center gap-1">
            <div className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-all",
              step.num < currentStep ? "bg-primary text-primary-foreground" :
              step.num === currentStep ? "bg-primary/20 border-2 border-primary text-primary" :
              "bg-muted text-muted-foreground"
            )}>
              {step.num < currentStep ? <Check className="h-4 w-4" /> : step.num}
            </div>
            <span className={cn(
              "text-[10px] font-medium",
              step.num === currentStep ? "text-primary" : "text-muted-foreground"
            )}>
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div className={cn(
              "w-6 h-0.5 mb-5",
              step.num < currentStep ? "bg-primary" : "bg-muted"
            )} />
          )}
        </div>
      ))}
    </div>
  );
};

interface EmptyStateDashboardProps {
  onOnboardingComplete?: () => void;
}

const EmptyStateDashboard = ({ onOnboardingComplete }: EmptyStateDashboardProps) => {
  const { user } = useAuth();
  const { refreshCompanies, setSelectedCompany } = useCompany();
  
  // Onboarding state
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [isCreating, setIsCreating] = useState(false);

  // Step 1: Company data
  const [companyName, setCompanyName] = useState('');
  const [companyTaxNumber, setCompanyTaxNumber] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');

  // Step 2: Projects data
  const [projects, setProjects] = useState<OnboardingProject[]>([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectClient, setNewProjectClient] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [newProjectStatus, setNewProjectStatus] = useState<'active' | 'completed' | 'on_hold' | 'cancelled'>('active');

  // Step 3: Categories data
  const [categories, setCategories] = useState<OnboardingCategory[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');

  // Step 4: NAV credentials data
  const [navCredentials, setNavCredentials] = useState<NavCredentialsData>({
    nav_username: '',
    nav_password: '',
    nav_tax_number: '',
    nav_sign_key: '',
    nav_exchange_key: '',
  });
  const [navValidationStatus, setNavValidationStatus] = useState<'pending' | 'valid' | 'invalid' | 'validating'>('pending');
  const [navValidationError, setNavValidationError] = useState<string | null>(null);

  // Step 5: Email alias data
  const [aliasName, setAliasName] = useState('');
  const [createdAliasEmail, setCreatedAliasEmail] = useState<string | null>(null);
  const [creatingAlias, setCreatingAlias] = useState(false);

  // Validation
  const isStep1Valid = companyName.trim() && companyTaxNumber.trim();
  const isStep2Valid = projects.length >= 3;
  
  const isNavFormComplete = useMemo(() => {
    return (
      navCredentials.nav_username.trim() !== '' &&
      navCredentials.nav_password.trim() !== '' &&
      /^\d{8}$/.test(navCredentials.nav_tax_number) &&
      navCredentials.nav_sign_key.trim() !== '' &&
      navCredentials.nav_exchange_key.trim() !== ''
    );
  }, [navCredentials]);

  const isStep4Valid = navValidationStatus === 'valid';

  const handleAddProject = () => {
    if (!newProjectName.trim() || !newProjectClient.trim()) {
      if (!newProjectName.trim()) toast.error('A projekt neve kötelező!');
      if (!newProjectClient.trim()) toast.error('Az ügyfél neve kötelező!');
      return;
    }

    setProjects([...projects, {
      name: newProjectName.trim(),
      client_name: newProjectClient.trim(),
      description: newProjectDescription.trim(),
      status: newProjectStatus,
    }]);

    setNewProjectName('');
    setNewProjectClient('');
    setNewProjectDescription('');
    setNewProjectStatus('active');
  };

  const handleRemoveProject = (index: number) => {
    setProjects(projects.filter((_, i) => i !== index));
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) {
      toast.error('A kategória neve kötelező!');
      return;
    }

    setCategories([...categories, {
      name: newCategoryName.trim(),
      description: newCategoryDescription.trim(),
    }]);

    setNewCategoryName('');
    setNewCategoryDescription('');
  };

  const handleRemoveCategory = (index: number) => {
    setCategories(categories.filter((_, i) => i !== index));
  };

  const handleValidateNav = async () => {
    if (!isNavFormComplete) return;
    
    setNavValidationStatus('validating');
    setNavValidationError(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Nincs bejelentkezve');

      // Validate credentials INLINE without saving to DB
      // This avoids the duplicate key issue since company doesn't exist yet
      const { data, error } = await supabase.functions.invoke('nav-token', {
        body: { 
          action: 'validate_credentials_inline',
          credentials: {
            nav_username: navCredentials.nav_username,
            nav_password: navCredentials.nav_password,
            nav_tax_number: navCredentials.nav_tax_number,
            nav_sign_key: navCredentials.nav_sign_key,
            nav_exchange_key: navCredentials.nav_exchange_key,
          }
        },
      });

      if (error) throw error;

      if (data?.success) {
        setNavValidationStatus('valid');
        toast.success('NAV kapcsolat sikeresen ellenőrizve!');
      } else {
        setNavValidationStatus('invalid');
        setNavValidationError(data?.error || data?.message || 'A megadott adatok hibásak');
        toast.error(data?.error || data?.message || 'NAV validálás sikertelen');
      }
    } catch (error: any) {
      console.error('NAV validation error:', error);
      setNavValidationStatus('invalid');
      setNavValidationError(error.message || 'Hiba történt a validálás során');
      toast.error(error.message || 'NAV validálás sikertelen');
    }
  };

  const handleCreateEmailAlias = async () => {
    if (!aliasName.trim()) return;
    
    setCreatingAlias(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-email-alias', {
        body: { company_name: aliasName },
      });

      if (error) throw error;

      setCreatedAliasEmail(data.alias.alias_email);
      toast.success('Email alias sikeresen létrehozva!');
    } catch (error: any) {
      console.error('Error creating alias:', error);
      toast.error(error.message || 'Nem sikerült létrehozni az email aliast');
    } finally {
      setCreatingAlias(false);
    }
  };

  const handleCopyAlias = () => {
    if (createdAliasEmail) {
      navigator.clipboard.writeText(createdAliasEmail);
      toast.success('Email cím vágólapra másolva!');
    }
  };

  const handleFinishOnboarding = async () => {
    if (!user) return;

    setIsCreating(true);
    try {
      // 1. Create company
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: companyName.trim(),
          tax_number: companyTaxNumber.trim(),
          address: companyAddress.trim() || null,
          owner_id: user.id,
        })
        .select()
        .single();

      if (companyError) throw companyError;

      // 2. Create projects
      const projectsToInsert = projects.map(p => ({
        user_id: user.id,
        company_id: companyData.id,
        name: p.name,
        client_name: p.client_name,
        description: p.description || null,
        status: p.status,
      }));

      const { error: projectsError } = await supabase
        .from('projects')
        .insert(projectsToInsert);

      if (projectsError) throw projectsError;

      // 3. Create categories (if any)
      if (categories.length > 0) {
        const categoriesToInsert = categories.map(c => ({
          user_id: user.id,
          company_id: companyData.id,
          name: c.name,
          description: c.description || null,
        }));

        const { error: categoriesError } = await supabase
          .from('categories')
          .insert(categoriesToInsert);

        if (categoriesError) throw categoriesError;
      }

      // 4. Save NAV credentials with company_id (first and only save)
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { error: navError } = await supabase.functions.invoke('save-credentials', {
          body: {
            navUsername: navCredentials.nav_username,
            navPassword: navCredentials.nav_password,
            navTaxNumber: navCredentials.nav_tax_number,
            navSignKey: navCredentials.nav_sign_key,
            navExchangeKey: navCredentials.nav_exchange_key,
            companyId: companyData.id,
          },
        });

        if (navError) {
          console.error('NAV credentials save error:', navError);
          // Don't throw - company is created, just log the error
        } else {
          // Trigger initial NAV sync in background (last 30 days)
          const dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          const dateTo = new Date().toISOString().split('T')[0];

          Promise.allSettled([
            supabase.functions.invoke('nav-query-outbound-invoices', {
              body: {
                invoiceDirection: 'OUTBOUND',
                dateFrom,
                dateTo,
                companyId: companyData.id
              }
            }),
            supabase.functions.invoke('nav-query-outbound-invoices', {
              body: {
                invoiceDirection: 'INBOUND',
                dateFrom,
                dateTo,
                companyId: companyData.id
              }
            })
          ]).then(([outbound, inbound]) => {
            const outboundOk = outbound.status === 'fulfilled' && !outbound.value.error;
            const inboundOk = inbound.status === 'fulfilled' && !inbound.value.error;
            
            if (outboundOk || inboundOk) {
              toast.success('NAV számlák szinkronizálása elindult a háttérben');
            }
          });
        }
      }

      // 5. Assign email alias to company (if created)
      if (createdAliasEmail) {
        const { data: aliasData } = await supabase
          .from('email_aliases')
          .select('id')
          .eq('alias_email', createdAliasEmail)
          .single();
        
        if (aliasData) {
          await supabase
            .from('email_aliases')
            .update({ company_id: companyData.id })
            .eq('id', aliasData.id);
        }
      }

      await refreshCompanies();
      setSelectedCompany(companyData);
      toast.success('Beállítás sikeres! Üdvözöljük a Visibillben!');
      
      // Trigger the product tour after successful onboarding
      onOnboardingComplete?.();
    } catch (error) {
      console.error('Error during onboarding:', error);
      toast.error('Hiba történt a beállítás során');
    } finally {
      setIsCreating(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
          <Building2 className="h-7 w-7 text-primary" />
        </div>
        <h3 className="text-xl font-semibold">Cég regisztráció</h3>
        <p className="text-sm text-muted-foreground mt-1">Add meg a vállalkozásod adatait</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="company-name">Cég neve *</Label>
        <Input
          id="company-name"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="Pl. Példa Kft."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="tax-number">Adószám *</Label>
        <Input
          id="tax-number"
          value={companyTaxNumber}
          onChange={(e) => setCompanyTaxNumber(e.target.value)}
          placeholder="Pl. 12345678-2-42"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Cím</Label>
        <Input
          id="address"
          value={companyAddress}
          onChange={(e) => setCompanyAddress(e.target.value)}
          placeholder="Pl. 1234 Budapest, Példa utca 1."
        />
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
          <FolderOpen className="h-7 w-7 text-primary" />
        </div>
        <h3 className="text-xl font-semibold">Projektek létrehozása</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Hozz létre legalább 3 projektet a számlák rendszerezéséhez
        </p>
      </div>

      {/* Project list */}
      {projects.length > 0 && (
        <div className="space-y-2 max-h-[180px] overflow-y-auto">
          {projects.map((project, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border/50">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{project.name}</p>
                <p className="text-xs text-muted-foreground truncate">{project.client_name}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveProject(index)}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Progress indicator */}
      <div className={cn(
        "text-sm font-medium text-center py-2 rounded-lg",
        projects.length >= 3 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
      )}>
        {projects.length} / 3 projekt {projects.length >= 3 && <Check className="inline h-4 w-4 ml-1" />}
      </div>

      {/* Add project form */}
      <div className="space-y-3 p-4 border border-dashed border-border rounded-lg">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Projekt neve *</Label>
            <Input
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Projekt név"
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Ügyfél neve *</Label>
            <Input
              value={newProjectClient}
              onChange={(e) => setNewProjectClient(e.target.value)}
              placeholder="Ügyfél név"
              className="h-9"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Leírás</Label>
            <Input
              value={newProjectDescription}
              onChange={(e) => setNewProjectDescription(e.target.value)}
              placeholder="Rövid leírás"
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Státusz</Label>
            <Select value={newProjectStatus} onValueChange={(v: any) => setNewProjectStatus(v)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Aktív</SelectItem>
                <SelectItem value="completed">Befejezett</SelectItem>
                <SelectItem value="on_hold">Szüneteltetve</SelectItem>
                <SelectItem value="cancelled">Törölve</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button
          onClick={handleAddProject}
          variant="outline"
          size="sm"
          className="w-full"
          disabled={!newProjectName.trim() || !newProjectClient.trim()}
        >
          <Plus className="h-4 w-4 mr-2" />
          Projekt hozzáadása
        </Button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
          <Tags className="h-7 w-7 text-primary" />
        </div>
        <h3 className="text-xl font-semibold">Kategóriák (opcionális)</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Hozz létre kategóriákat a számlák csoportosításához
        </p>
      </div>

      {/* Category list */}
      {categories.length > 0 && (
        <div className="space-y-2 max-h-[150px] overflow-y-auto">
          {categories.map((category, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border/50">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{category.name}</p>
                {category.description && (
                  <p className="text-xs text-muted-foreground truncate">{category.description}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveCategory(index)}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add category form */}
      <div className="space-y-3 p-4 border border-dashed border-border rounded-lg">
        <div className="space-y-1">
          <Label className="text-xs">Kategória neve</Label>
          <Input
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Pl. Irodaszer, Marketing"
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Kulcsszavak (vesszővel elválasztva)</Label>
          <Input
            value={newCategoryDescription}
            onChange={(e) => setNewCategoryDescription(e.target.value)}
            placeholder="Pl. papír, toll, nyomtató"
            className="h-9"
          />
        </div>
        <Button
          onClick={handleAddCategory}
          variant="outline"
          size="sm"
          className="w-full"
          disabled={!newCategoryName.trim()}
        >
          <Plus className="h-4 w-4 mr-2" />
          Kategória hozzáadása
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        A kategóriákat később is hozzáadhatod a Beállítások menüben.
      </p>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
          <Shield className="h-7 w-7 text-primary" />
        </div>
        <h3 className="text-xl font-semibold">NAV Integráció</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Kösd össze a NAV Online Számla rendszerrel
        </p>
      </div>

      {/* Validation status card */}
      {navValidationStatus === 'valid' && (
        <div className="p-4 bg-green-50 dark:bg-green-950/20 border-2 border-green-500 rounded-lg flex items-center gap-3">
          <CheckCircle className="h-6 w-6 text-green-600 shrink-0" />
          <div>
            <p className="font-semibold text-green-700 dark:text-green-400">Sikeres kapcsolat!</p>
            <p className="text-sm text-green-600 dark:text-green-500">A NAV API sikeresen validálva</p>
          </div>
        </div>
      )}

      {/* NAV form fields */}
      <div className="space-y-3 p-4 border border-dashed border-border rounded-lg">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">NAV felhasználónév *</Label>
            <Input
              value={navCredentials.nav_username}
              onChange={(e) => setNavCredentials({...navCredentials, nav_username: e.target.value})}
              placeholder="Technikai felhasználó"
              className="h-9"
              disabled={navValidationStatus === 'valid'}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Adószám (8 számjegy) *</Label>
            <Input
              value={navCredentials.nav_tax_number}
              onChange={(e) => setNavCredentials({...navCredentials, nav_tax_number: e.target.value.replace(/\D/g, '').slice(0, 8)})}
              placeholder="12345678"
              maxLength={8}
              className="h-9"
              disabled={navValidationStatus === 'valid'}
            />
          </div>
        </div>
        
        <div className="space-y-1">
          <Label className="text-xs">NAV jelszó *</Label>
          <Input
            type="password"
            value={navCredentials.nav_password}
            onChange={(e) => setNavCredentials({...navCredentials, nav_password: e.target.value})}
            placeholder="••••••••"
            className="h-9"
            disabled={navValidationStatus === 'valid'}
          />
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Aláíró kulcs *</Label>
            <Input
              type="password"
              value={navCredentials.nav_sign_key}
              onChange={(e) => setNavCredentials({...navCredentials, nav_sign_key: e.target.value})}
              placeholder="Aláíró kulcs"
              className="h-9"
              disabled={navValidationStatus === 'valid'}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Csere kulcs *</Label>
            <Input
              type="password"
              value={navCredentials.nav_exchange_key}
              onChange={(e) => setNavCredentials({...navCredentials, nav_exchange_key: e.target.value})}
              placeholder="Csere kulcs"
              className="h-9"
              disabled={navValidationStatus === 'valid'}
            />
          </div>
        </div>

        {navValidationStatus !== 'valid' && (
          <Button
            onClick={handleValidateNav}
            className="w-full"
            disabled={navValidationStatus === 'validating' || !isNavFormComplete}
          >
            {navValidationStatus === 'validating' ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Ellenőrzés...
              </>
            ) : (
              <>
                <Shield className="h-4 w-4 mr-2" />
                Kapcsolat tesztelése
              </>
            )}
          </Button>
        )}

        {navValidationStatus === 'invalid' && navValidationError && (
          <p className="text-sm text-destructive text-center">
            {navValidationError}
          </p>
        )}
      </div>
      
      <p className="text-xs text-muted-foreground text-center">
        A NAV adataidat az Integrációk menüben később is módosíthatod.
      </p>
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
          <Mail className="h-7 w-7 text-primary" />
        </div>
        <h3 className="text-xl font-semibold">Email Alias (opcionális)</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Hozz létre egy dedikált email címet a számlák fogadásához
        </p>
      </div>

      {createdAliasEmail ? (
        <div className="p-4 bg-green-50 dark:bg-green-950/20 border-2 border-green-500 rounded-lg">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle className="h-6 w-6 text-green-600 shrink-0" />
            <p className="font-semibold text-green-700 dark:text-green-400">Email alias létrehozva!</p>
          </div>
          <div className="flex items-center gap-2 p-2 bg-white dark:bg-background rounded border">
            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
            <code className="text-sm flex-1 truncate">{createdAliasEmail}</code>
            <Button variant="ghost" size="sm" onClick={handleCopyAlias} className="h-8 w-8 p-0 shrink-0">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-green-600 dark:text-green-500 mt-2">
            A számlafogadó partnereidnek ezt az email címet add meg.
          </p>
        </div>
      ) : (
        <div className="space-y-3 p-4 border border-dashed border-border rounded-lg">
          <div className="space-y-1">
            <Label className="text-xs">Alias neve (azonosításhoz)</Label>
            <Input
              value={aliasName}
              onChange={(e) => setAliasName(e.target.value)}
              placeholder={`pl. ${companyName || 'Cég'} számlák`}
              className="h-9"
            />
          </div>
          <Button
            onClick={handleCreateEmailAlias}
            variant="outline"
            className="w-full"
            disabled={!aliasName.trim() || creatingAlias}
          >
            {creatingAlias ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Létrehozás...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Email alias létrehozása
              </>
            )}
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Az email aliasokat később is létrehozhatod az Integrációk menüben.
      </p>
    </div>
  );

  // Get button text for current step
  const getNextButtonText = () => {
    if (currentStep === 3 || currentStep === 5) {
      return 'Kihagyás / Tovább';
    }
    return 'Tovább';
  };

  // Check if next button should be disabled
  const isNextDisabled = () => {
    if (currentStep === 1) return !isStep1Valid;
    if (currentStep === 2) return !isStep2Valid;
    if (currentStep === 4) return !isStep4Valid; // NAV is required
    return false; // Step 3 and 5 are optional
  };

  return (
    <div className="min-h-screen bg-background relative">
      {/* Grayed out teaser dashboard */}
      <div className="container mx-auto px-4 py-8 space-y-8 grayscale opacity-30 pointer-events-none select-none">
        {/* Welcome Section Placeholder */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold">Üdvözöljük!</h2>
            <p className="text-muted-foreground">
              Itt van a vállalkozásod teljes áttekintése
            </p>
          </div>
        </div>

        {/* Metrics Cards Placeholder */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 items-stretch">
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Összes számla</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">---</div>
              <p className="text-xs text-muted-foreground mt-1">0 feldolgozva</p>
            </CardContent>
          </Card>
          
          <Card className="overflow-hidden border-green-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Kimenő számlaösszeg (nettó)</CardTitle>
              <Euro className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0 Ft</div>
              <p className="text-xs text-muted-foreground mt-1">Kimenő számlák nettó összege</p>
            </CardContent>
          </Card>
          
          <Card className="overflow-hidden border-yellow-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Kimenő számlaösszeg (bruttó)</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0 Ft</div>
              <p className="text-xs text-muted-foreground mt-1">Kimenő számlák bruttó összege</p>
            </CardContent>
          </Card>
          
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Összesített érték</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0 Ft</div>
              <p className="text-xs text-muted-foreground mt-1">Minden számla átváltva</p>
            </CardContent>
          </Card>
          
          <Card className="overflow-hidden border-orange-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Kifizetendő ÁFA</CardTitle>
              <PieChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0 Ft</div>
              <p className="text-xs text-muted-foreground mt-1">OUTBOUND - INBOUND</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Placeholder */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>ÁFA Elemzés</CardTitle>
              <CardDescription>Havi ÁFA bontás</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[200px] flex items-center justify-center bg-muted/20 rounded-lg">
                <p className="text-muted-foreground">Grafikon helye</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Bevételek és Kiadások</CardTitle>
              <CardDescription>Éves áttekintés</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[200px] flex items-center justify-center bg-muted/20 rounded-lg">
                <p className="text-muted-foreground">Grafikon helye</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tables Placeholder */}
        <Card>
          <CardHeader>
            <CardTitle>Legutóbbi Számlák</CardTitle>
            <CardDescription>A legfrissebb bejegyzések</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[150px] flex items-center justify-center bg-muted/20 rounded-lg">
              <p className="text-muted-foreground">Nincs megjeleníthető adat</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CTA Overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
        {!isOnboarding ? (
          // Welcome screen
          <Card className="w-full max-w-md mx-4 border-primary/20 shadow-xl">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Üdvözöljük a Visibillben!</CardTitle>
              <CardDescription className="text-base mt-2">
                Kezdjük el a vállalkozásod pénzügyi áttekintését néhány egyszerű lépésben.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <Button 
                onClick={() => setIsOnboarding(true)} 
                className="w-full" 
                size="lg"
              >
                Első lépések
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </CardContent>
          </Card>
        ) : (
          // Onboarding stepper
          <Card className="w-full max-w-lg mx-4 border-primary/20 shadow-xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="pb-2">
              <StepIndicator currentStep={currentStep} />
            </CardHeader>
            <CardContent className="pt-0">
              {currentStep === 1 && renderStep1()}
              {currentStep === 2 && renderStep2()}
              {currentStep === 3 && renderStep3()}
              {currentStep === 4 && renderStep4()}
              {currentStep === 5 && renderStep5()}

              {/* Navigation buttons */}
              <div className="flex justify-between mt-6 pt-4 border-t border-border">
                <Button
                  variant="outline"
                  onClick={() => currentStep === 1 ? setIsOnboarding(false) : setCurrentStep(currentStep - 1)}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {currentStep === 1 ? 'Vissza' : 'Előző'}
                </Button>

                {currentStep < 5 ? (
                  <Button
                    onClick={() => setCurrentStep(currentStep + 1)}
                    disabled={isNextDisabled()}
                  >
                    {getNextButtonText()}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleFinishOnboarding}
                    disabled={isCreating}
                  >
                    {isCreating ? 'Mentés...' : 'Befejezés'}
                    <Check className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default EmptyStateDashboard;
