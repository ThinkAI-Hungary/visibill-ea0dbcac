import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, User, Settings, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { reportError } from '@/lib/errorReporter';
import { useToast } from '@/components/ui/use-toast';
import { seedAccountyAssignments } from '@/utils/seedAccounty';

import ClientDetailsStep from './new-client/ClientDetailsStep';
import IntegrationStep from './new-client/IntegrationStep';

export default function NewClientPage() {
  const { t } = useTranslation('accounty');
  const navigate = useNavigate();
  const location = useLocation();
  const prefix = location.pathname.startsWith('/hr') ? '/hr' : '';
  const isHr = location.pathname.startsWith('/hr');
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [integrationType, setIntegrationType] = useState<'rlb' | 'novitax' | 'other' | null>(null);

  const [clientName, setClientName] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [countryCode, setCountryCode] = useState<'HU' | 'HR'>(isHr ? 'HR' : 'HU');
  const [primaryTeaor, setPrimaryTeaor] = useState('');
  const [companyDescription, setCompanyDescription] = useState('');
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const handleGenerateDescription = async () => {
    if (!clientName.trim()) {
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
        body: { teaorCode: primaryTeaor.trim(), companyName: clientName.trim() }
      });

      if (error) throw error;
      if (data?.description) {
        setCompanyDescription(data.description);
        toast({ title: 'Cégleírás sikeresen generálva!' });
      } else {
        throw new Error('Nem érkezett leírás a szervertől.');
      }
    } catch (err: any) {
      reportError({ type: 'edge_function', component: 'NewClientPage', action: 'error', message: 'Failed to generate description:', error: err });
      toast({
        title: 'Generálás sikertelen',
        description: err.message || 'Hiba történt a generálás során',
        variant: 'destructive'
      });
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  const [useVisibillAccount, setUseVisibillAccount] = useState(false);
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['email']);
  const [selectedDocs, setSelectedDocs] = useState<string[]>(['szamlak']);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  const [inviteCode, setInviteCode] = useState('');
  const [codeStatus, setCodeStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid' | 'expired' | 'already_assigned'>('idle');
  const [linkedCompany, setLinkedCompany] = useState<{ id: string; name: string; tax_number: string } | null>(null);
  const [isJoiningAsAccountant, setIsJoiningAsAccountant] = useState(false);

  const [isUploadingDocs, setIsUploadingDocs] = useState(false);
  const [docsUploaded, setDocsUploaded] = useState(false);
  const [personalData, setPersonalData] = useState({
    fullName: '', birthName: '', mothersName: '', birthPlaceDate: '', idCardNumber: '', address: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    if (!isUploadingDocs && fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsUploadingDocs(true);
      setTimeout(() => {
        setIsUploadingDocs(false);
        setDocsUploaded(true);
        setPersonalData({ fullName: '', birthName: '', mothersName: '', birthPlaceDate: '', idCardNumber: '', address: '' });
      }, 1500);
    }
  };

  const handleValidateCode = async () => {
    if (!inviteCode.trim()) return;
    setCodeStatus('validating');
    setLinkedCompany(null);
    try {
      const { data, error } = await supabase.functions.invoke('validate-partner-code', { body: { share_token: inviteCode.trim() } });
      if (error) throw error;
      if (data?.valid) { setCodeStatus('valid'); setLinkedCompany(data.company); }
      else if (data?.error === 'token_expired') { setCodeStatus('expired'); }
      else { setCodeStatus('invalid'); }
    } catch (err) {
      reportError({ type: 'edge_function', component: 'NewClientPage', action: 'error', message: 'Failed to validate partner code:', error: err });
      setCodeStatus('invalid');
    }
  };

  const handleJoinAsAccountant = async () => {
    if (!inviteCode.trim() || codeStatus !== 'valid') return;
    setIsJoiningAsAccountant(true);
    try {
      const { data, error } = await supabase.functions.invoke('join-company-as-accountant', { body: { share_token: inviteCode.trim() } });
      if (error) throw error;
      if (data?.error === 'already_assigned') { setCodeStatus('already_assigned'); return; }
      if (data?.error) { setCodeStatus('invalid'); return; }
      queryClient.invalidateQueries({ queryKey: ['accounty-clients'] });
      queryClient.invalidateQueries({ queryKey: ['accounty-kpis'] });
      navigate(`${prefix}/eaisybooks`);
    } catch (err) {
      reportError({ type: 'edge_function', component: 'NewClientPage', action: 'error', message: 'Failed to join as accountant:', error: err });
      setCodeStatus('invalid');
    } finally {
      setIsJoiningAsAccountant(false);
    }
  };

  const handleNext = async () => {
    if (step === 1 && !useVisibillAccount) {
      const errors: Record<string, string> = {};
      if (!clientName.trim()) errors.clientName = 'Cégnév megadása kötelező';
      if (!taxNumber.trim()) errors.taxNumber = 'Adószám megadása kötelező';
      else if (!/^[0-9]{8}-[0-9]-[0-9]{2}$/.test(taxNumber)) errors.taxNumber = 'Érvényes formátum: 12345678-1-23';
      if (Object.keys(errors).length > 0) { setValidationErrors(errors); return; }
      setValidationErrors({});
    }
    if (step === 2) {
      if (user?.id) {
        try {
          const name = clientName || (useVisibillAccount ? 'Meghívott Ügyfél Kft.' : 'Új Ügyfél Kft.');
          const tax = taxNumber || '12345678-1-23';
          const { data: existing } = await supabase.from('companies').select('id').eq('tax_number', tax).maybeSingle();
          let companyId: string;
          if (existing) {
            companyId = existing.id;
          } else {
            const { data: newCompany, error: compErr } = await supabase.from('companies').insert({ 
              name, 
              tax_number: tax,
              owner_id: user.id,
              primary_teaor: primaryTeaor.trim() || null,
              description: companyDescription.trim() || null,
              country_code: countryCode,
            } as any).select('id').single();
            if (compErr) throw compErr;
            companyId = newCompany.id;
          }

          // Resolve user's accounting firm ID and role
          const { data: myAssign } = await supabase
            .from('accounty_assignments')
            .select('accounting_firm_id, role')
            .eq('accountant_user_id', user.id)
            .not('accounting_firm_id', 'is', null)
            .limit(1)
            .maybeSingle();

          const firmId = myAssign?.accounting_firm_id || companyId;
          const assignRole = myAssign?.role || 'iroda_admin';

          let assignErr: any;
          if (myAssign) {
            // Normal case: user has existing assignments, try direct client-side insert
            const { error } = await supabase.from('accounty_assignments').upsert({
              accountant_user_id: user.id,
              company_id: companyId,
              accounting_firm_id: firmId,
              role: assignRole,
              is_primary: true,
            } as any, { onConflict: 'accountant_user_id,company_id' });
            assignErr = error;
          }

          // Bootstrap case or direct fallback: call the seed Edge Function to bypass RLS
          if (!myAssign || assignErr) {
            console.log("No existing assignment or direct assignment failed, invoking seedAccountyAssignments...");
            const seedResult = await seedAccountyAssignments();
            if (seedResult && seedResult.error) {
              throw new Error(seedResult.error);
            }
          }
          await supabase.from('accounty_communication_preferences').upsert({
            company_id: companyId, contact_name: contactName || null, contact_email: contactEmail || null, contact_phone: contactPhone || null,
            channel_email: selectedChannels.includes('email'), channel_viber: selectedChannels.includes('viber'), channel_sms: selectedChannels.includes('telegram'), channel_phone: false, auto_reminder: true,
          } as any, { onConflict: 'company_id' });
          queryClient.invalidateQueries({ queryKey: ['accounty-clients'] });
          queryClient.invalidateQueries({ queryKey: ['accounty-kpis'] });
        } catch (err) {
          reportError({ type: 'db_query', component: 'NewClientPage', action: 'error', message: 'Failed to create client assignment:', error: err });
        }
      }
      setStep(3);
    } else if (step < 3) {
      setStep((s) => (s + 1) as 1 | 2 | 3);
    }
  };

  const toggleChannel = (id: string) => setSelectedChannels(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  const toggleDoc = (id: string) => setSelectedDocs(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);

  return (
    <div className="h-screen w-full flex flex-col bg-muted/40 dark:bg-background font-sans text-foreground">
      {/* Top Bar */}
      <header className="h-16 shrink-0 bg-card border-b border-border flex items-center justify-between px-8">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-lg leading-none">v</div>
          <span className="text-xl font-bold text-foreground tracking-tight">{t('new_client_page.app_title', 'Visibill for Accountants')}</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((num) => {
              const isActive = step === num;
              const isPast = step > num;
              const isCompleted = isPast || (step === 3 && num === 3);
              return (
                <div key={num} className="flex items-center gap-2">
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors",
                    isCompleted ? "bg-primary text-primary-foreground" : 
                    isActive ? "bg-primary text-primary-foreground ring-2 ring-offset-1 ring-primary" : 
                    "bg-muted text-muted-foreground"
                  )}>
                    {isCompleted ? <Check className="w-3.5 h-3.5" /> : num}
                  </div>
                </div>
              );
            })}
            <span className="text-sm font-medium text-muted-foreground ml-2">
              {step === 1 ? t('new_client_page.step_first_client', 'Első ügyfél') : step === 2 ? t('new_client_page.step_integration', 'Integráció') : t('new_client_page.step_done', 'Kész')}
            </span>
          </div>
          <button onClick={() => navigate(`${prefix}/eaisybooks`)} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            {t('new_client_page.skip', 'Kihagyás')}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto py-12 px-4 flex flex-col items-center">
        <div className="w-full max-w-2xl">
          
          {step === 1 && (
            <ClientDetailsStep
              useVisibillAccount={useVisibillAccount} setUseVisibillAccount={setUseVisibillAccount}
              clientName={clientName} setClientName={setClientName}
              taxNumber={taxNumber} setTaxNumber={setTaxNumber}
              countryCode={countryCode} setCountryCode={setCountryCode}
              primaryTeaor={primaryTeaor} setPrimaryTeaor={setPrimaryTeaor}
              companyDescription={companyDescription} setCompanyDescription={setCompanyDescription}
              isGeneratingDescription={isGeneratingDescription}
              handleGenerateDescription={handleGenerateDescription}
              validationErrors={validationErrors} setValidationErrors={setValidationErrors}
              contactName={contactName} setContactName={setContactName}
              contactEmail={contactEmail} setContactEmail={setContactEmail}
              contactPhone={contactPhone} setContactPhone={setContactPhone}
              selectedChannels={selectedChannels} toggleChannel={toggleChannel}
              selectedDocs={selectedDocs} toggleDoc={toggleDoc}
              inviteCode={inviteCode} setInviteCode={setInviteCode}
              codeStatus={codeStatus} setCodeStatus={setCodeStatus}
              linkedCompany={linkedCompany} setLinkedCompany={setLinkedCompany}
              isJoiningAsAccountant={isJoiningAsAccountant}
              handleValidateCode={handleValidateCode}
              handleJoinAsAccountant={handleJoinAsAccountant}
              handleNext={handleNext}
              navigate={(path: string) => navigate(prefix && !path.startsWith(prefix) ? `${prefix}${path.startsWith('/') ? path : `/${path}`}` : path)}
              personalData={personalData} setPersonalData={setPersonalData}
              isUploadingDocs={isUploadingDocs} docsUploaded={docsUploaded} setDocsUploaded={setDocsUploaded}
              handleUploadClick={handleUploadClick} fileInputRef={fileInputRef} handleFileChange={handleFileChange}
            />
          )}

          {step === 2 && (
            <IntegrationStep
              integrationType={integrationType}
              setIntegrationType={setIntegrationType}
              handleNext={handleNext}
            />
          )}

          {step === 3 && (
            <div className="page-animate w-full">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-3xl"></span>
                </div>
                <h1 className="text-2xl font-bold text-foreground">{t('new_client_page.done_title', 'Minden készen áll!')}</h1>
                <p className="text-muted-foreground mt-2">{t('new_client_page.done_subtitle', 'A könyvelői fiókod be van állítva. Kezdheted a munkát!')}</p>
              </div>

              <div className="space-y-3 mb-6">
                {[
                  { label: t('new_client_page.profile', 'Profil'), desc: t('new_client_page.profile_done', 'Kész'), Icon: User },
                  { label: t('new_client_page.clients', 'Ügyfelek'), desc: t('new_client_page.client_added', '1 ügyfél hozzáadva'), Icon: Users },
                  { label: t('new_client_page.integration', 'Integráció'), desc: integrationType === 'other' ? t('new_client_page.manual_configured', 'Manuális beállítva') : t('new_client_page.integration_configured', '{{type}} beállítva', { type: integrationType?.toUpperCase() }), Icon: Settings },
                ].map(item => (
                  <div key={item.label} className="bg-card rounded-lg p-4 border border-border shadow-soft flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-accent text-primary flex items-center justify-center"><Check className="w-3.5 h-3.5" /></div>
                      <div>
                        <p className="font-semibold text-foreground text-sm">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                    <item.Icon className="w-5 h-5 text-muted-foreground" />
                  </div>
                ))}
              </div>

              <div className="bg-card rounded-lg p-5 border border-border shadow-soft mb-6 text-sm">
                <p className="font-semibold text-amber-600 flex items-center gap-2 mb-2">
                  <span className="text-base"></span> {t('new_client_page.did_you_know', 'Tudtad?')}
                </p>
                <ul className="list-disc pl-5 text-muted-foreground space-y-1.5 text-xs">
                  <li>{t('new_client_page.tip_portfolio', 'A portfólió nézetben egy helyen látod az összes ügyfeled státuszát')}</li>
                  <li>{t('new_client_page.tip_nav_sync', 'A NAV szinkronizálás automatikusan letölti a bejövő számlákat')}</li>
                  <li>{t('new_client_page.tip_reminders', 'Az automatikus bekérő emlékezteti az ügyfeleidet a hiányzó számlákra')}</li>
                </ul>
              </div>

              <Button onClick={() => navigate(`${prefix}/eaisybooks`)} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground mb-3">
                {t('new_client_page.go_to_dashboard', 'Irány a Dashboard →')}
              </Button>
              
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1 text-muted-foreground">
                  {t('new_client_page.add_another', '+ Újabb ügyfél')}
                </Button>
                <Button variant="outline" className="flex-1 text-muted-foreground">
                  <Settings className="w-4 h-4 mr-2" /> {t('new_client_page.settings', 'Beállítások')}
                </Button>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
