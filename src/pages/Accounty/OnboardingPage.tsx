import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { seedAccountyAssignments } from '@/utils/seedAccounty';
import { 
  Rocket, 
  Briefcase,
  CheckCircle2, 
  Circle, 
  ArrowRight, 
  Building2, 
  Shield, 
  Settings, 
  Users, 
  FileText, 
  Play, 
  ChevronDown, 
  ChevronUp, 
  Loader2, 
  Check, 
  PartyPopper,
  User,
  Plus,
  Trash2,
  Mail,
  ToggleLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

/* ─── Confetti burst ─── */
function ConfettiBurst() {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; color: string; size: number; rotation: number }>>([]);

  useEffect(() => {
    const colors = ['#14b8a6', '#8b5cf6', '#f59e0b', '#ec4899', '#3b82f6', '#10b981', '#f97316'];
    const newParticles = Array.from({ length: 70 }, (_, i) => ({
      id: i,
      x: 50 + (Math.random() - 0.5) * 80,
      y: 40 + (Math.random() - 0.5) * 50,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 5 + Math.random() * 7,
      rotation: Math.random() * 360,
    }));
    setParticles(newParticles);

    const timer = setTimeout(() => setParticles([]), 2500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-50">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-sm animate-in fade-in"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            transform: `rotate(${p.rotation}deg)`,
            animation: `confetti-fall ${1.5 + Math.random()}s ease-out forwards`,
            animationDelay: `${Math.random() * 0.3}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% { opacity: 1; transform: translateY(0) rotate(0deg) scale(1); }
          100% { opacity: 0; transform: translateY(200px) rotate(${360 + Math.random() * 360}deg) scale(0.3); }
        }
      `}</style>
    </div>
  );
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const { refreshCompanies } = useCompany();

  // Active step accordion state
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);

  // Loading indicator states for actions
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // Step 1: Form state
  const [profileName, setProfileName] = useState('');
  const [profilePosition, setProfilePosition] = useState('iroda_admin');

  // Step 2: Form state
  const [officeName, setOfficeName] = useState('');
  const [officeTax, setOfficeTax] = useState('');
  const [officeAddress, setOfficeAddress] = useState('');

  // Step 3: Form state
  const [inviteCode, setInviteCode] = useState('');
  const [codeStatus, setCodeStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid' | 'expired' | 'already_assigned'>('idle');
  const [linkedCompany, setLinkedCompany] = useState<{ id: string; name: string; tax_number: string } | null>(null);

  // Step 4: Form state
  const [autoReminders, setAutoReminders] = useState(true);
  const [defaultLanguage, setDefaultLanguage] = useState('hu');

  // Step 5: Form state
  const [colleagueEmail, setColleagueEmail] = useState('');
  const [colleagueRole, setColleagueRole] = useState<'senior' | 'junior'>('junior');

  // Database status queries
  const { data: profile, refetch: refetchProfile } = useQuery({
    queryKey: ['onboarding-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  const { data: officeSettings, refetch: refetchOffice } = useQuery({
    queryKey: ['onboarding-office', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('accounty_office_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  const { data: clientCount = 0, refetch: refetchClients } = useQuery({
    queryKey: ['onboarding-clients', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await supabase
        .from('accounty_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('accountant_user_id', user.id);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user?.id
  });

  // Sync state values on data load
  useEffect(() => {
    if (profile) {
      setProfileName(profile.name || '');
      setProfilePosition(profile.position || 'iroda_admin');
    }
  }, [profile]);

  useEffect(() => {
    if (officeSettings) {
      const s = (officeSettings.settings || {}) as any;
      setOfficeName(s.office_name || '');
      setOfficeTax(s.tax_number || '');
      setOfficeAddress(s.address || '');
      setAutoReminders(s.auto_reminders ?? true);
      setDefaultLanguage(s.default_language || 'hu');
    }
  }, [officeSettings]);

  const settingsObj = (officeSettings?.settings || {}) as any;
  const isPrefsComplete = typeof settingsObj.auto_reminders !== 'undefined';
  const invitedColleagues = settingsObj.invited_colleagues || [];
  const isColleaguesComplete = Array.isArray(invitedColleagues) && invitedColleagues.length > 0;

  const steps = [
    {
      id: 'profile',
      title: 'Személyes profil beállítása',
      description: 'Név és beosztás/szerepkör konfigurálása az irodán belül.',
      icon: User,
      isComplete: !!profile?.name,
    },
    {
      id: 'office',
      title: 'Könyvelőiroda beállítása',
      description: 'Iroda alapadatai, székhelye és adószáma a hivatalos dokumentumokhoz.',
      icon: Building2,
      isComplete: !!(settingsObj.office_name && settingsObj.tax_number && settingsObj.address),
    },
    {
      id: 'client',
      title: 'Első ügyfélcég felvétele',
      description: 'Kapcsolj be egy meglévő eaisybill céget vagy hozz létre új ügyfelet.',
      icon: Briefcase,
      isComplete: clientCount > 0,
    },
    {
      id: 'preferences',
      title: 'Irodai alapbeállítások',
      description: 'Globális automatikus emlékeztetők és nyelvi beállítások konfigurálása.',
      icon: Settings,
      isComplete: isPrefsComplete,
    },
    {
      id: 'colleagues',
      title: 'Könyvelőtársak meghívása',
      description: 'Hívj meg más könyvelőket az irodába a feladatok delegálásához.',
      icon: Users,
      isComplete: isColleaguesComplete,
    },
  ];

  // Set first incomplete step expanded automatically on load
  useEffect(() => {
    if (!expandedStep && user) {
      const firstIncomplete = steps.find(s => !s.isComplete);
      if (firstIncomplete) {
        setExpandedStep(firstIncomplete.id);
      } else {
        setExpandedStep('profile');
      }
    }
  }, [user, profile, officeSettings, clientCount]);

  const completedCount = steps.filter(s => s.isComplete).length;
  const progressPct = Math.round((completedCount / steps.length) * 100);

  // SVG circular properties
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPct / 100) * circumference;

  /* ─── Actions & Handlers ─── */

  // Step 1: Save Profile
  const handleSaveProfile = async () => {
    if (!profileName.trim()) {
      toast({
        title: 'Hiba',
        description: 'A név megadása kötelező!',
        variant: 'destructive'
      });
      return;
    }
    setLoadingAction('save_profile');
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: profileName,
          position: profilePosition,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user!.id);

      if (error) throw error;
      await refetchProfile();
      toast({
        title: 'Profil frissítve',
        description: 'Személyes adataidat sikeresen elmentettük.',
      });
      setExpandedStep('office');
    } catch (err: any) {
      toast({
        title: 'Mentési hiba',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setLoadingAction(null);
    }
  };

  // Step 2: Save Office Settings
  const handleSaveOffice = async () => {
    if (!officeName.trim() || !officeTax.trim() || !officeAddress.trim()) {
      toast({
        title: 'Hiba',
        description: 'Minden irodai adatot kötelező megadni!',
        variant: 'destructive'
      });
      return;
    }
    setLoadingAction('save_office');
    try {
      const existingSettings = (officeSettings?.settings || {}) as any;
      const { error } = await supabase
        .from('accounty_office_settings')
        .upsert({
          user_id: user!.id,
          settings: {
            ...existingSettings,
            office_name: officeName,
            tax_number: officeTax,
            address: officeAddress
          },
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;
      await refetchOffice();
      toast({
        title: 'Iroda mentve',
        description: 'Könyvelőiroda adatai sikeresen rögzítve.',
      });
      setExpandedStep('client');
    } catch (err: any) {
      toast({
        title: 'Hiba',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setLoadingAction(null);
    }
  };

  // Step 3: Validate Invite Code
  const handleValidateCode = async () => {
    if (!inviteCode.trim()) return;
    setLoadingAction('validate_code');
    setCodeStatus('validating');
    setLinkedCompany(null);
    try {
      const { data, error } = await supabase.functions.invoke('validate-partner-code', {
        body: { share_token: inviteCode.trim().toUpperCase() },
      });
      if (error) throw error;
      if (data?.valid) {
        setCodeStatus('valid');
        setLinkedCompany(data.company);
      } else if (data?.error === 'token_expired') {
        setCodeStatus('expired');
      } else {
        setCodeStatus('invalid');
      }
    } catch (err) {
      setCodeStatus('invalid');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleJoinCompany = async () => {
    if (!inviteCode.trim() || codeStatus !== 'valid') return;
    setLoadingAction('join_company');
    try {
      const { data, error } = await supabase.functions.invoke('join-company-as-accountant', {
        body: { share_token: inviteCode.trim().toUpperCase() },
      });
      if (error) throw error;
      if (data?.error === 'already_assigned') {
        setCodeStatus('already_assigned');
        return;
      }
      if (data?.error) {
        setCodeStatus('invalid');
        return;
      }
      await refetchClients();
      await refreshCompanies();
      toast({
        title: 'Sikeres hozzárendelés',
        description: 'Az ügyfélcég hozzárendelése sikeresen megtörtént.',
      });
      setExpandedStep('preferences');
    } catch (err: any) {
      toast({
        title: 'Hiba',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSyncEaisybill = async () => {
    setLoadingAction('sync_eaisybill');
    try {
      const result = await seedAccountyAssignments();
      if (result && !('error' in result)) {
        await refetchClients();
        await refreshCompanies();
        toast({
          title: 'Szinkronizáció kész',
          description: 'Cégek sikeresen átmásolva az eaisybillből.',
        });
        setExpandedStep('preferences');
      }
    } catch (err: any) {
      toast({
        title: 'Hiba',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setLoadingAction(null);
    }
  };

  // Step 4: Save General Preferences
  const handleSavePreferences = async () => {
    setLoadingAction('save_prefs');
    try {
      const existingSettings = (officeSettings?.settings || {}) as any;
      const { error } = await supabase
        .from('accounty_office_settings')
        .upsert({
          user_id: user!.id,
          settings: {
            ...existingSettings,
            auto_reminders: autoReminders,
            default_language: defaultLanguage
          },
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;
      await refetchOffice();
      toast({
        title: 'Preferenciák mentve',
        description: 'Irodai alapértelmezett beállítások rögzítve.',
      });
      setExpandedStep('colleagues');
    } catch (err: any) {
      toast({
        title: 'Hiba',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setLoadingAction(null);
    }
  };

  // Step 5: Invite Colleague
  const handleInviteColleague = async () => {
    if (!colleagueEmail.trim()) {
      toast({
        title: 'Hiba',
        description: 'Adj meg egy e-mail címet!',
        variant: 'destructive'
      });
      return;
    }
    setLoadingAction('invite_colleague');
    try {
      const existingSettings = (officeSettings?.settings || {}) as any;
      const currentInvites = existingSettings.invited_colleagues || [];
      const newInvites = [...currentInvites, { email: colleagueEmail, role: colleagueRole, date: new Date().toISOString() }];
      
      const { error } = await supabase
        .from('accounty_office_settings')
        .upsert({
          user_id: user!.id,
          settings: {
            ...existingSettings,
            invited_colleagues: newInvites
          },
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;
      await refetchOffice();
      setColleagueEmail('');
      toast({
        title: 'Meghívó elküldve',
        description: `Sikeresen kiküldtük a meghívót a(z) ${colleagueEmail} címre.`,
      });
    } catch (err: any) {
      toast({
        title: 'Hiba',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleFinishOnboarding = () => {
    setShowCelebration(true);
    setTimeout(() => {
      setShowCelebration(false);
      navigate('/accounty');
    }, 2000);
  };

  const handleSkipColleagues = async () => {
    setLoadingAction('skip_colleagues');
    try {
      const existingSettings = (officeSettings?.settings || {}) as any;
      const { error } = await supabase
        .from('accounty_office_settings')
        .upsert({
          user_id: user!.id,
          settings: {
            ...existingSettings,
            invited_colleagues: [{ skipped: true }]
          },
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;
      await refetchOffice();
      handleFinishOnboarding();
    } catch (err: any) {
      toast({
        title: 'Hiba',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto relative pb-12">
      {showCelebration && <ConfettiBurst />}

      {/* Header */}
      <div className="text-center bg-card border border-border p-8 rounded-2xl shadow-soft relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-violet-500/5 pointer-events-none" />
        <div className="p-3.5 bg-gradient-to-br from-primary to-violet-600 rounded-2xl shadow-lg shadow-primary/20 w-fit mx-auto mb-4">
          <Rocket className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight mb-2">Könyvelői fiók beállítása</h1>
        <p className="text-sm text-muted-foreground max-w-lg mx-auto">
          Állítsd be könyvelői profilodat, az iroda adatait és a preferenciáidat, hogy azonnal megkezdhesd a munkát a portfólióddal.
        </p>
      </div>

      {/* Donut progress ring */}
      <div className="bg-card rounded-2xl border border-border p-6 shadow-soft flex flex-col md:flex-row items-center gap-6">
        <div className="relative shrink-0">
          <svg className="w-20 h-20 transform -rotate-90">
            <circle cx="40" cy="40" r={radius} className="stroke-slate-100 dark:stroke-slate-800" strokeWidth="6" fill="transparent" />
            <circle 
              cx="40" 
              cy="40" 
              r={radius} 
              className="stroke-primary transition-all duration-1000 ease-out" 
              strokeWidth="6" 
              fill="transparent" 
              strokeDasharray={circumference} 
              strokeDashoffset={strokeDashoffset} 
              strokeLinecap="round" 
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-bold text-foreground">{progressPct}%</span>
          </div>
        </div>
        <div className="flex-1 text-center md:text-left space-y-1">
          <h4 className="text-sm font-bold text-foreground">Fiók előkészítettsége</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Az alábbi beállítások elvégzésével könyvelőirodád teljes funkcionalitással használatba veheti az eaisybooks rendszert.
          </p>
          <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 pt-1">
            {completedCount} / {steps.length} lépés befejezve
          </div>
        </div>
      </div>

      {/* Accordion list */}
      <div className="space-y-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isComplete = step.isComplete;
          const isExpanded = expandedStep === step.id;

          return (
            <div 
              key={step.id} 
              className={cn(
                "bg-card rounded-2xl border border-border shadow-soft overflow-hidden transition-all duration-300",
                isComplete && "border-green-200/60 dark:border-green-900/30 bg-green-50/10 dark:bg-green-950/5",
                isExpanded && "ring-1 ring-primary/20 shadow-md"
              )}
            >
              {/* Header */}
              <div 
                className="flex items-center justify-between p-5 cursor-pointer select-none"
                onClick={() => setExpandedStep(isExpanded ? null : step.id)}
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-300",
                    isComplete ? "bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                  )}>
                    {isComplete ? <Check className="w-5 h-5" /> : <span className="text-sm font-bold">{index + 1}</span>}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Icon className={cn("w-4 h-4", isComplete ? "text-green-500" : "text-muted-foreground")} />
                      <h3 className={cn("text-sm font-bold tracking-tight", isComplete && "line-through text-muted-foreground")}>
                        {step.title}
                      </h3>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                  </div>
                </div>
                {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </div>

              {/* Form Content */}
              {isExpanded && (
                <div className="px-5 pb-6 pt-2 border-t border-border/50 animate-in slide-in-from-top-3 duration-300">
                  
                  {/* Step 1: Profile details */}
                  {step.id === 'profile' && (
                    <div className="space-y-4 max-w-xl">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="prof-name" className="text-xs font-semibold">Teljes név</Label>
                          <Input 
                            id="prof-name"
                            placeholder="Kovács János"
                            value={profileName}
                            onChange={e => setProfileName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">Beosztás / Jogkör</Label>
                          <select 
                            value={profilePosition}
                            onChange={e => setProfilePosition(e.target.value)}
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          >
                            <option value="iroda_admin">Irodavezető / Adminisztrátor</option>
                            <option value="senior_könyvelő">Senior Könyvelő</option>
                            <option value="junior_könyvelő">Junior Könyvelő</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <Button 
                          onClick={handleSaveProfile} 
                          disabled={loadingAction === 'save_profile'}
                          className="gap-2"
                        >
                          {loadingAction === 'save_profile' && <Loader2 className="w-4 h-4 animate-spin" />}
                          Profil mentése és tovább
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Office settings */}
                  {step.id === 'office' && (
                    <div className="space-y-4 max-w-xl">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="off-name" className="text-xs font-semibold">Iroda hivatalos neve</Label>
                          <Input 
                            id="off-name"
                            placeholder="pl. Pannon Könyvelőiroda Kft."
                            value={officeName}
                            onChange={e => setOfficeName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="off-tax" className="text-xs font-semibold">Irodai adószám</Label>
                          <Input 
                            id="off-tax"
                            placeholder="pl. 12345678-2-41"
                            value={officeTax}
                            onChange={e => setOfficeTax(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="off-addr" className="text-xs font-semibold">Iroda székhelye</Label>
                        <Input 
                          id="off-addr"
                          placeholder="Irányítószám, Város, Utca, Házszám"
                          value={officeAddress}
                          onChange={e => setOfficeAddress(e.target.value)}
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <Button 
                          onClick={handleSaveOffice} 
                          disabled={loadingAction === 'save_office'}
                          className="gap-2"
                        >
                          {loadingAction === 'save_office' && <Loader2 className="w-4 h-4 animate-spin" />}
                          Iroda mentése és tovább
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Step 3: First client assignment */}
                  {step.id === 'client' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Option 1: Code */}
                        <div className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-2xl border border-border flex flex-col justify-between space-y-4">
                          <div>
                            <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                              <Shield className="w-4 h-4 text-primary" />
                              Meghívó kóddal
                            </h4>
                            <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                              Az ügyfeled eaisybill fiókjából kapott 6 jegyű partnerkóddal.
                            </p>
                          </div>
                          
                          <div className="space-y-2">
                            <Input 
                              placeholder="pl. A1B2C3"
                              value={inviteCode}
                              onChange={e => {
                                setInviteCode(e.target.value);
                                setCodeStatus('idle');
                              }}
                              className="font-mono tracking-widest text-center text-sm"
                              maxLength={6}
                            />
                            {codeStatus === 'valid' && linkedCompany && (
                              <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold">Talált cég: {linkedCompany.name}</p>
                            )}
                            {codeStatus === 'invalid' && (
                              <p className="text-[9px] text-rose-600 dark:text-rose-400 font-semibold">Érvénytelen kód!</p>
                            )}

                            {codeStatus === 'valid' ? (
                              <Button 
                                onClick={handleJoinCompany} 
                                disabled={loadingAction === 'join_company'}
                                className="w-full text-xs h-8"
                              >
                                {loadingAction === 'join_company' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Hozzáadás'}
                              </Button>
                            ) : (
                              <Button 
                                onClick={handleValidateCode} 
                                disabled={!inviteCode.trim() || loadingAction === 'validate_code'}
                                variant="outline"
                                className="w-full text-xs h-8"
                              >
                                {loadingAction === 'validate_code' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Ellenőrzés'}
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Option 2: Sync */}
                        <div className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-2xl border border-border flex flex-col justify-between space-y-4">
                          <div>
                            <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                              <Rocket className="w-4 h-4 text-violet-500" />
                              eaisybill szinkron
                            </h4>
                            <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                              A meglévő eaisybill cégeid automatikus betöltése és könyvelői hozzárendelése.
                            </p>
                          </div>
                          
                          <Button 
                            onClick={handleSyncEaisybill} 
                            disabled={loadingAction === 'sync_eaisybill'}
                            variant="outline"
                            className="w-full text-xs h-8 gap-1.5"
                          >
                            {loadingAction === 'sync_eaisybill' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            Szinkronizálás indítása
                          </Button>
                        </div>

                        {/* Option 3: Manual */}
                        <div className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-2xl border border-border flex flex-col justify-between space-y-4">
                          <div>
                            <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                              <Plus className="w-4 h-4 text-amber-500" />
                              Kézi új felvétel
                            </h4>
                            <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                              Egy teljesen új ügyfélcég manuális regisztrációja a rendszerbe.
                            </p>
                          </div>
                          
                          <Button 
                            asChild
                            variant="outline"
                            className="w-full text-xs h-8"
                          >
                            <Link to="/accounty/new-client">
                              Új ügyfél felvétele
                              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 4: General Preferences */}
                  {step.id === 'preferences' && (
                    <div className="space-y-4 max-w-xl">
                      <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-border">
                        <div>
                          <h4 className="text-xs font-bold text-foreground">Automatikus ügyfél emlékeztetők</h4>
                          <p className="text-[10px] text-muted-foreground mt-0.5">Automatikus havi értesítések küldése a hiányzó bizonylatokról.</p>
                        </div>
                        <Switch 
                          checked={autoReminders} 
                          onCheckedChange={setAutoReminders} 
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Alapértelmezett rendszer nyelv</Label>
                        <select 
                          value={defaultLanguage}
                          onChange={e => setDefaultLanguage(e.target.value)}
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <option value="hu">Magyar (Alapértelmezett)</option>
                          <option value="en">English (Angol)</option>
                        </select>
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <Button 
                          onClick={handleSavePreferences} 
                          disabled={loadingAction === 'save_prefs'}
                          className="gap-2"
                        >
                          {loadingAction === 'save_prefs' && <Loader2 className="w-4 h-4 animate-spin" />}
                          Beállítások mentése és tovább
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Step 5: Invite colleagues */}
                  {step.id === 'colleagues' && (
                    <div className="space-y-4 max-w-xl">
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-border text-xs text-muted-foreground leading-relaxed">
                        Ha nem egyedül dolgozol, hívj meg könyvelő asszisztenseket vagy senior kollégákat az irodai munkatérbe. E-mail alapján kapnak meghívót.
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 space-y-1.5">
                          <Label htmlFor="col-email" className="text-xs font-semibold">Kolléga e-mail címe</Label>
                          <Input 
                            id="col-email"
                            placeholder="konyvelo@iroda.hu"
                            value={colleagueEmail}
                            onChange={e => setColleagueEmail(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5 shrink-0 sm:w-44">
                          <Label className="text-xs font-semibold">Szerepkör</Label>
                          <select 
                            value={colleagueRole}
                            onChange={e => setColleagueRole(e.target.value as any)}
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none"
                          >
                            <option value="junior">Junior Könyvelő</option>
                            <option value="senior">Senior Könyvelő</option>
                          </select>
                        </div>
                        <Button 
                          onClick={handleInviteColleague}
                          disabled={loadingAction === 'invite_colleague' || !colleagueEmail}
                          className="sm:mt-[22px] gap-1.5 shrink-0 text-xs"
                        >
                          {loadingAction === 'invite_colleague' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                          Meghívás
                        </Button>
                      </div>

                      {invitedColleagues.length > 0 && (
                        <div className="space-y-2 animate-in fade-in duration-300">
                          <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Kiküldött meghívók:</h4>
                          <div className="space-y-1.5">
                            {invitedColleagues.filter((c: any) => !c.skipped).map((c: any, i: number) => (
                              <div key={i} className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-slate-50/50 dark:bg-slate-900/30 text-xs">
                                <span className="font-medium text-foreground">{c.email}</span>
                                <span className="text-[10px] font-semibold text-muted-foreground uppercase px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full">{c.role}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex justify-between items-center pt-4 border-t border-border/50">
                        <Button 
                          onClick={handleSkipColleagues}
                          variant="ghost"
                          className="text-xs text-muted-foreground"
                          disabled={loadingAction === 'skip_colleagues'}
                        >
                          Kihagyom, befejezés
                        </Button>
                        
                        <Button 
                          onClick={handleFinishOnboarding}
                          disabled={!isColleaguesComplete}
                          className="gap-2"
                        >
                          Fiókbeállítás lezárása
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
