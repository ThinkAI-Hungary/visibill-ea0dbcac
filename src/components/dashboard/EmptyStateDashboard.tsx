import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Euro, TrendingUp, PieChart, Building2, ArrowRight, ArrowLeft, Check, Plus, X, FolderOpen, Tags, Shield, RefreshCw, CheckCircle, Users, LogOut, Sparkles } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { reportError } from '@/lib/errorReporter';

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
  const { user, signOut } = useAuth();
  const { refreshCompanies, setSelectedCompany } = useCompany();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  // Onboarding state
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [isCreating, setIsCreating] = useState(false);

  // Step 1: Company data
  const [companyName, setCompanyName] = useState('');
  const [companyTaxNumber, setCompanyTaxNumber] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [primaryTeaor, setPrimaryTeaor] = useState('');
  const [companyDescription, setCompanyDescription] = useState('');
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [step1Tab, setStep1Tab] = useState('create');
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);

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

  // Validation
  const isStep1Valid = companyName.trim() && companyTaxNumber.trim();
  const isStep2Valid = true; // Projects are now optional
  
  const isNavFormComplete = useMemo(() => {
    return (
      navCredentials.nav_username.trim() !== '' &&
      navCredentials.nav_password.trim() !== '' &&
      /^\d{8}$/.test(navCredentials.nav_tax_number) &&
      navCredentials.nav_sign_key.trim() !== '' &&
      navCredentials.nav_exchange_key.trim() !== ''
    );
  }, [navCredentials]);

  // NAV is now optional — always valid (user can skip)
  const isStep4Valid = true;

  const handleAddProject = () => {
    if (!newProjectName.trim()) {
      toast({ title: 'A projekt neve kötelező!', variant: 'destructive' });
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
      toast({ title: 'A kategória neve kötelező!', variant: 'destructive' });
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
        toast({ title: 'NAV kapcsolat sikeresen ellenőrizve!' });
      } else {
        setNavValidationStatus('invalid');
        setNavValidationError(data?.error || data?.message || 'A megadott adatok hibásak');
        toast({ title: data?.error || data?.message || 'NAV validálás sikertelen', variant: 'destructive' });
      }
    } catch (error: any) {
      reportError({ type: 'db_query', component: 'EmptyStateDashboard', action: 'error', message: 'NAV validation error:', error: error });
      setNavValidationStatus('invalid');
      setNavValidationError(error.message || 'Hiba történt a validálás során');
      toast({ title: error.message || 'NAV validálás sikertelen', variant: 'destructive' });
    }
  };

  const handleGenerateDescription = async () => {
    if (!companyName.trim()) {
      toast({ title: 'Kérjük, add meg a cég nevét a generáláshoz!', variant: 'destructive' });
      return;
    }
    if (!primaryTeaor.trim()) {
      toast({ title: 'Kérjük, add meg az elsődleges TEÁOR kódot a generáláshoz!', variant: 'destructive' });
      return;
    }

    setIsGeneratingDescription(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-company-description', {
        body: { teaorCode: primaryTeaor.trim(), companyName: companyName.trim() }
      });

      if (error) throw error;
      if (data?.description) {
        setCompanyDescription(data.description);
        toast({ title: 'Cégleírás sikeresen generálva!' });
      } else {
        throw new Error('Nem érkezett leírás a szervertől.');
      }
    } catch (err: any) {
      reportError({ type: 'db_query', component: 'EmptyStateDashboard', action: 'error', message: 'Error generating description:', error: err });
      toast({
        title: 'Generálás sikertelen',
        description: err.message || 'Hiba történt a generálás során',
        variant: 'destructive'
      });
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  const handleFinishOnboarding = async () => {
    if (!user) return;

    setIsCreating(true);
    let rollbackNeeded = false;
    let createdCompanyId: string | null = null;
    try {
      // 0. Refresh session to ensure JWT is valid before DB operations
      const { data: { session: freshSession }, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !freshSession) {
        toast({
          title: 'A munkamenet lejárt',
          description: 'Kérjük, jelentkezzen be újra a folytatáshoz.',
          variant: 'destructive',
        });
        return;
      }

      // 1. Create company
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: companyName.trim(),
          tax_number: companyTaxNumber.trim(),
          address: companyAddress.trim() || null,
          owner_id: user.id,
          primary_teaor: primaryTeaor.trim() || null,
          description: companyDescription.trim() || null,
        })
        .select()
        .single();

      if (companyError) throw companyError;
      createdCompanyId = companyData.id;

      // 2. Create projects
      if (projects.length > 0) {
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

        if (projectsError) {
          rollbackNeeded = true;
          throw projectsError;
        }
      }

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

        if (categoriesError) {
          rollbackNeeded = true;
          throw categoriesError;
        }
      }

      // 4. Save NAV credentials with company_id (only if user filled them in)
      if (navValidationStatus === 'valid' && isNavFormComplete) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: navData, error: navError } = await supabase.functions.invoke('save-credentials', {
            body: {
              navUsername: navCredentials.nav_username,
              navPassword: navCredentials.nav_password,
              navTaxNumber: navCredentials.nav_tax_number,
              navSignKey: navCredentials.nav_sign_key,
              navExchangeKey: navCredentials.nav_exchange_key,
              companyId: companyData.id,
            },
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          });

          if (navError || navData?.error) {
            const navMsg = navError?.message || navData?.error || 'Ismeretlen NAV hiba';
            reportError({ type: 'db_query', component: 'EmptyStateDashboard', action: 'error', message: 'NAV credentials save error:', error: navMsg });
            // Don't throw - company is created, but inform the user
            toast({
              title: 'NAV mentési figyelmeztetés',
              description: `A cég létrejött, de a NAV adatok mentése sikertelen: ${navMsg}. Az Integrációk menüben újra megpróbálhatod.`,
              variant: 'destructive',
            });
          } else {
            // Trigger initial NAV sync in background (last 90 days)
            // Split into 35-day chunks due to NAV API limit
            const splitDateRange = (startDate: Date, endDate: Date, maxDays: number = 35): Array<{from: string, to: string}> => {
              const chunks: Array<{from: string, to: string}> = [];
              let currentStart = new Date(startDate);
              
              while (currentStart < endDate) {
                const chunkEnd = new Date(currentStart);
                chunkEnd.setDate(chunkEnd.getDate() + maxDays - 1);
                
                const actualEnd = chunkEnd > endDate ? endDate : chunkEnd;
                
                chunks.push({
                  from: currentStart.toISOString().split('T')[0],
                  to: actualEnd.toISOString().split('T')[0]
                });
                
                currentStart = new Date(actualEnd);
                currentStart.setDate(currentStart.getDate() + 1);
              }
              
              return chunks;
            };

            const endDate = new Date();
            const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
            const dateChunks = splitDateRange(startDate, endDate);
            

            // Process all chunks sequentially in background
            (async () => {
              let successCount = 0;
              for (const chunk of dateChunks) {
                // Refresh session before each chunk to prevent JWT expiration
                const { data: { session: freshSession } } = await supabase.auth.getSession();
                if (!freshSession) {
                  reportError({ type: 'auth', severity: 'warning', component: 'EmptyStateDashboard', action: 'warn', message: 'Session expired during background sync, aborting remaining chunks' });
                  break;
                }
                const currentToken = freshSession.access_token;

                const [outbound, inbound] = await Promise.allSettled([
                  supabase.functions.invoke('nav-query-outbound-invoices', {
                    body: {
                      invoiceDirection: 'OUTBOUND',
                      dateFrom: chunk.from,
                      dateTo: chunk.to,
                      companyId: companyData.id
                    },
                    headers: {
                      Authorization: `Bearer ${currentToken}`,
                    },
                  }),
                  supabase.functions.invoke('nav-query-outbound-invoices', {
                    body: {
                      invoiceDirection: 'INBOUND',
                      dateFrom: chunk.from,
                      dateTo: chunk.to,
                      companyId: companyData.id
                    },
                    headers: {
                      Authorization: `Bearer ${currentToken}`,
                    },
                  })
                ]);
                
                if ((outbound.status === 'fulfilled' && !outbound.value.error) ||
                    (inbound.status === 'fulfilled' && !inbound.value.error)) {
                  successCount++;
                }
              }
              
              if (successCount > 0) {
                toast({ title: 'NAV számlák szinkronizálása elindult a háttérben' });
              }
            })();
          }
        }
      }

      await refreshCompanies();
      // Immediately set access cache to true so RootRedirect won't redirect to /accounty
      queryClient.setQueryData(['has-eaisybill-access', user.id], true);
      setSelectedCompany(companyData);
      toast({ title: 'Beállítás sikeres! Üdvözöljük a eaisybill-ben!' });
      
      // Hard reload to the new company's dashboard.
      // navigate() doesn't work because React state batching means companies
      // haven't committed to the DOM yet, causing the wizard to reappear.
      // A full page reload guarantees fresh state and cleans up the Dialog Portal.
      const now = new Date();
      const yearStart = `${now.getFullYear()}-01-01`;
      const yearEnd = `${now.getFullYear()}-12-31`;
      window.location.href = `/${companyData.id}/${yearStart}_${yearEnd}/`;
      return; // stop execution — page is reloading
    } catch (error: any) {
      reportError({ type: 'db_query', component: 'EmptyStateDashboard', action: 'error', message: 'Error during onboarding:', error: error });
      const msg = error?.message || error?.details || JSON.stringify(error);
      toast({ title: 'Hiba történt a beállítás során', description: msg, variant: 'destructive' });

      // Rollback: delete the company if it was created but sub-steps failed
      if (rollbackNeeded && createdCompanyId) {
        reportError({ type: 'db_query', severity: 'warning', component: 'EmptyStateDashboard', action: 'warn', message: 'Rolling back company:', error: createdCompanyId });
        await supabase.from('companies').delete().eq('id', createdCompanyId);
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinCompany = async () => {
    if (!joinCode.trim()) {
      toast({ title: 'A csatlakozási kód kötelező!', variant: 'destructive' });
      return;
    }

    setIsJoining(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Nincs bejelentkezve');

      const { data, error } = await supabase.functions.invoke('join-company', {
        body: { share_token: joinCode.trim() },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.error === 'already_member') {
        toast({ title: 'Már tagja vagy ennek a cégnek!', variant: 'destructive' });
        return;
      }
      if (data?.error === 'invalid_code') {
        toast({ title: 'Érvénytelen csatlakozási kód!', variant: 'destructive' });
        return;
      }
      if (data?.error === 'token_expired') {
        toast({ title: 'A csatlakozási kód lejárt! Kérj új kódot a cég tulajdonosától.', variant: 'destructive' });
        return;
      }
      if (data?.error) {
        toast({ title: data.error, variant: 'destructive' });
        return;
      }

      await refreshCompanies();
      queryClient.setQueryData(['has-eaisybill-access', user.id], true);
      const joinedCompany = data?.company;
      if (joinedCompany) {
        setSelectedCompany(joinedCompany);
      }
      toast({ title: 'Sikeresen csatlakoztál a céghez!' });
      
      // Hard reload (same reason as create flow)
      if (joinedCompany) {
        const now = new Date();
        const yearStart = `${now.getFullYear()}-01-01`;
        const yearEnd = `${now.getFullYear()}-12-31`;
        window.location.href = `/${joinedCompany.id}/${yearStart}_${yearEnd}/`;
        return;
      }
    } catch (error: any) {
      reportError({ type: 'db_query', component: 'EmptyStateDashboard', action: 'error', message: 'Error joining company:', error: error });
      const msg = error?.message || error?.details || JSON.stringify(error);
      toast({ title: 'Hiba történt a csatlakozás során', description: msg, variant: 'destructive' });
    } finally {
      setIsJoining(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
          <Building2 className="h-7 w-7 text-primary" />
        </div>
        <h3 className="text-xl font-semibold">Cég hozzáadása</h3>
        <p className="text-sm text-muted-foreground mt-1">Regisztrálj új céget vagy csatlakozz egy meglévőhöz</p>
      </div>

      <Tabs value={step1Tab} onValueChange={setStep1Tab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="create">Új cég regisztrációja</TabsTrigger>
          <TabsTrigger value="join">Csatlakozás meglévőhöz</TabsTrigger>
        </TabsList>
        <TabsContent value="create" className="space-y-4 pt-4">
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
            <Label htmlFor="address">Székhely</Label>
            <Input
              id="address"
              value={companyAddress}
              onChange={(e) => setCompanyAddress(e.target.value)}
              placeholder="Pl. 1234 Budapest, Példa utca 1."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="primary-teaor">Elsődleges TEÁOR kód</Label>
            <Input
              id="primary-teaor"
              value={primaryTeaor}
              onChange={(e) => setPrimaryTeaor(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="Pl. 6201"
              maxLength={4}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="company-description">Cég tevékenységének bemutatása (AI alapú kontírozáshoz)</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-primary hover:text-primary/80 gap-1 px-2"
                onClick={handleGenerateDescription}
                disabled={isGeneratingDescription || !primaryTeaor.trim()}
              >
                <Sparkles className={cn("h-3.5 w-3.5", isGeneratingDescription && "animate-spin")} />
                {isGeneratingDescription ? 'Generálás...' : 'Generálás AI-jal'}
              </Button>
            </div>
            <Textarea
              id="company-description"
              value={companyDescription}
              onChange={(e) => setCompanyDescription(e.target.value)}
              placeholder="Mutasd be röviden a cég tevékenységét és üzletmenetét a pontosabb automatikus könyvelés érdekében..."
              rows={3}
            />
          </div>
        </TabsContent>
        <TabsContent value="join" className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="joinCode">Csatlakozási kód</Label>
            <Input
              id="joinCode"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Pl. ABC123"
              maxLength={6}
              className="text-center text-lg tracking-widest font-mono"
            />
            <p className="text-sm text-muted-foreground">
              Kérd el a cég tulajdonosától a 6 karakteres csatlakozási kódot.
            </p>
          </div>
          <Button
            onClick={handleJoinCompany}
            disabled={!joinCode.trim() || isJoining}
            className="w-full"
          >
            <Users className="h-4 w-4 mr-2" />
            {isJoining ? 'Csatlakozás...' : 'Csatlakozás a céghez'}
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
          <FolderOpen className="h-7 w-7 text-primary" />
        </div>
        <h3 className="text-xl font-semibold">Projektek létrehozása (opcionális)</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Hozz létre projekteket a számlák rendszerezéséhez, vagy hagyd ki ezt a lépést
        </p>
      </div>

      {/* Project list */}
      {projects.length > 0 && (
        <div className="space-y-2 max-h-[180px] overflow-y-auto">
          {projects.map((project, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border/50">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{project.name}</p>
                <p className="text-xs text-muted-foreground truncate">{project.client_name || <span className="italic">Nincs ügyfél</span>}</p>
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

      {/* Project count indicator */}
      {projects.length > 0 && (
        <div className="text-sm font-medium text-center py-2 rounded-lg bg-primary/10 text-primary">
          {projects.length} projekt hozzáadva <Check className="inline h-4 w-4 ml-1" />
        </div>
      )}

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
            <Label className="text-xs">Ügyfél neve</Label>
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
          disabled={!newProjectName.trim()}
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
        <h3 className="text-xl font-semibold">NAV Integráció (opcionális)</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Kösd össze a NAV Online Számla rendszerrel, vagy hagyd ki ezt a lépést
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

  // Get button text for current step
  const getNextButtonText = () => {
    if (currentStep === 2 || currentStep === 3) {
      return 'Kihagyás / Tovább';
    }
    return 'Tovább';
  };

  // Get finish button text based on NAV state
  const getFinishButtonText = () => {
    if (isCreating) return 'Mentés...';
    if (navValidationStatus === 'valid') return 'Befejezés';
    return 'Kihagyás / Befejezés';
  };

  // Check if next button should be disabled
  const isNextDisabled = () => {
    if (currentStep === 1) return step1Tab === 'join' || !isStep1Valid;
    // Steps 2 and 3 are optional
    return false;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Grayed out teaser dashboard */}
      <div className="container mx-auto px-4 py-8 space-y-8 grayscale opacity-20 pointer-events-none select-none">
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

      {/* Onboarding Modal */}
      <Dialog open modal>
        <DialogContent
          className="max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          hideCloseButton
        >
          {/* Logout icon - top left */}
          <button
            onClick={() => signOut()}
            className="absolute left-4 top-4 z-10 p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors group"
            aria-label="Kijelentkezés"
            tabIndex={-1}
          >
            <LogOut className="h-4 w-4" />
            <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded-md bg-popover border border-border text-xs font-medium text-popover-foreground whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity shadow-md">
              Kijelentkezés
            </span>
          </button>

          {!isOnboarding ? (
            /* Welcome screen */
            <div className="p-6">
              <div className="text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Building2 className="h-8 w-8 text-primary" />
                </div>
                <DialogHeader className="items-center">
                  <DialogTitle className="text-2xl">Üdvözöljük a eaisybill-ben!</DialogTitle>
                  <DialogDescription className="text-base mt-2">
                    Kezdjük el a vállalkozásod pénzügyi áttekintését néhány egyszerű lépésben.
                  </DialogDescription>
                </DialogHeader>
                <div className="pt-6">
                  <Button 
                    onClick={() => setIsOnboarding(true)} 
                    className="w-full" 
                    size="lg"
                    autoFocus
                  >
                    Első lépések
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* Onboarding stepper */
            <div className="p-6">
              <StepIndicator currentStep={currentStep} />
              <div className="mt-2">
                {currentStep === 1 && renderStep1()}
                {currentStep === 2 && renderStep2()}
                {currentStep === 3 && renderStep3()}
                {currentStep === 4 && renderStep4()}

                {/* Navigation buttons */}
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
                  <Button
                    variant="outline"
                    onClick={() => currentStep === 1 ? setIsOnboarding(false) : setCurrentStep(currentStep - 1)}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    {currentStep === 1 ? 'Vissza' : 'Előző'}
                  </Button>


                  {currentStep < 4 ? (
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
                      {getFinishButtonText()}
                      <Check className="h-4 w-4 ml-2" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmptyStateDashboard;
