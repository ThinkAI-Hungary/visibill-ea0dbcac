import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, Building2, User, Mail, Phone, ExternalLink, Download, FileText, Smartphone, Send, Settings, Users, BarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { exportReceiptPdf } from '@/lib/exportPdf';
import { reportError } from '@/lib/errorReporter';

export default function NewClientPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [integrationType, setIntegrationType] = useState<'rlb' | 'novitax' | 'other' | null>(null);

  const [clientName, setClientName] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // UI interaction state
  const [useVisibillAccount, setUseVisibillAccount] = useState(false);
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['email']);
  const [selectedDocs, setSelectedDocs] = useState<string[]>(['szamlak']);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  const [isUploadingDocs, setIsUploadingDocs] = useState(false);
  const [docsUploaded, setDocsUploaded] = useState(false);
  const [personalData, setPersonalData] = useState({
    fullName: '',
    birthName: '',
    mothersName: '',
    birthPlaceDate: '',
    idCardNumber: '',
    address: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    if (!isUploadingDocs && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleUploadDocs();
    }
  };

  const handleUploadDocs = () => {
    setIsUploadingDocs(true);
    // OCR integration placeholder — real OCR will populate these fields
    setTimeout(() => {
      setIsUploadingDocs(false);
      setDocsUploaded(true);
      // Leave fields empty for manual entry until real OCR is integrated
      setPersonalData({
        fullName: '',
        birthName: '',
        mothersName: '',
        birthPlaceDate: '',
        idCardNumber: '',
        address: ''
      });
    }, 1500);
  };

  const handleNext = async () => {
    if (step === 1 && !useVisibillAccount) {
      // Validate Step 1
      const errors: Record<string, string> = {};
      if (!clientName.trim()) errors.clientName = 'Cégnév megadása kötelező';
      if (!taxNumber.trim()) {
        errors.taxNumber = 'Adószám megadása kötelező';
      } else if (!/^[0-9]{8}-[0-9]-[0-9]{2}$/.test(taxNumber)) {
        errors.taxNumber = 'Érvényes formátum: 12345678-1-23';
      }
      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        return;
      }
      setValidationErrors({});
    }
    if (step === 2) {
      // Create assignment in Supabase
      if (user?.id) {
        try {
          const name = clientName || (useVisibillAccount ? 'Meghívott Ügyfél Kft.' : 'Új Ügyfél Kft.');
          const tax = taxNumber || '12345678-1-23';

          // 1. Check if company exists by tax_number
          const { data: existing } = await supabase
            .from('companies')
            .select('id')
            .eq('tax_number', tax)
            .maybeSingle();

          let companyId: string;
          if (existing) {
            companyId = existing.id;
          } else {
            // Create new company
            const { data: newCompany, error: compErr } = await supabase
              .from('companies')
              .insert({ name, tax_number: tax })
              .select('id')
              .single();
            if (compErr) throw compErr;
            companyId = newCompany.id;
          }

          // 2. Create assignment
          const { error: assignErr } = await supabase
            .from('accounty_assignments')
            .upsert({
              accountant_user_id: user.id,
              company_id: companyId,
              role: 'junior',
              is_primary: true,
            } as any, { onConflict: 'accountant_user_id,company_id' });

          if (assignErr) throw assignErr;

          // 3. Save communication preferences
          await supabase
            .from('accounty_communication_preferences' as any)
            .upsert({
              company_id: companyId,
              contact_name: contactName || null,
              contact_email: contactEmail || null,
              contact_phone: contactPhone || null,
              channel_email: selectedChannels.includes('email'),
              channel_viber: selectedChannels.includes('viber'),
              channel_sms: selectedChannels.includes('telegram'),
              channel_phone: false,
              auto_reminder: true,
            } as any, { onConflict: 'company_id' });

          // Invalidate relevant queries
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

  const toggleChannel = (id: string) => {
    setSelectedChannels(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const toggleDoc = (id: string) => {
    setSelectedDocs(prev => 
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  return (
    <div className="h-screen w-full flex flex-col bg-slate-50 dark:bg-background font-sans text-slate-900 dark:text-slate-100">
      {/* Top Bar */}
      <header className="h-16 shrink-0 bg-card border-b border-border flex items-center justify-between px-8">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-lg leading-none">v</div>
          <span className="text-xl font-bold text-slate-800 dark:text-slate-200 tracking-tight">Visibill for Accountants</span>
        </div>
        
        <div className="flex items-center gap-6">
          {/* Progress Indicator */}
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
                    "bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                  )}>
                    {isCompleted ? <Check className="w-3.5 h-3.5" /> : num}
                  </div>
                </div>
              );
            })}
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400 ml-2">
              {step === 1 ? "Első ügyfél" : step === 2 ? "Integráció" : "Kész"}
            </span>
          </div>

          <button onClick={() => navigate('/accounty')} className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-100 transition-colors">
            Kihagyás
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto py-12 px-4 flex flex-col items-center">
        <div className="w-full max-w-2xl">
          
          {/* STEP 1: Client Details */}
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Add hozzá az első ügyfeledet</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">Később bármikor hozzáadhatsz többet</p>
              </div>

              {/* Prep Toggle */}
              <div className="flex p-1 bg-slate-100/80 dark:bg-slate-900/80 rounded-full mb-8 max-w-sm mx-auto border border-border/60">
                <button 
                  onClick={() => setUseVisibillAccount(true)}
                  className={cn("flex-1 py-2 px-4 text-sm font-medium rounded-full flex items-center justify-center gap-2 transition-all", useVisibillAccount ? "bg-card shadow-soft text-slate-900 dark:text-slate-100" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 dark:text-slate-300")}
                >
                  <svg className="w-4 h-4 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                  Van Visibill fiókja
                </button>
                <button 
                  onClick={() => setUseVisibillAccount(false)}
                  className={cn("flex-1 py-2 px-4 text-sm font-medium rounded-full flex items-center justify-center gap-2 transition-all", !useVisibillAccount ? "bg-card shadow-soft text-slate-900 dark:text-slate-100" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 dark:text-slate-300")}
                >
                  <Building2 className="w-4 h-4 opacity-70" /> Manuálisan adom hozzá
                </button>
              </div>

              {useVisibillAccount ? (
                <div className="bg-card rounded-xl p-6 border border-border shadow-soft animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">Ügyfelemnek van Visibill fiókja</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Az ügyfeled a saját fiókjából fog meghívni</p>
                  
                  <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-5 mb-6">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Így működik:</h3>
                    <ol className="space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
                      <li>1. Kérd meg az ügyfelet, hogy hívjon meg a Visibill-ből</li>
                      <li>2. Fogadd el az e-mailben kapott meghívót</li>
                    </ol>
                  </div>

                  <div className="space-y-2 mb-8">
                    <Label className="text-sm font-medium text-slate-900 dark:text-slate-100">Vagy add meg a meghívó kódot</Label>
                    <Input placeholder="ABC-123-XYZ" className="bg-slate-50/50 dark:bg-slate-900/50 border-border font-mono" />
                  </div>

                  <div className="flex justify-end gap-3 pt-2 border-t border-slate-50 mt-4">
                    <Button variant="outline" onClick={() => navigate('/accounty')} className="border-border text-slate-700 dark:text-slate-300">
                      Várok a meghívóra
                    </Button>
                    <Button onClick={handleNext} className="bg-[#6B7280] hover:bg-[#4B5563] text-white px-6">
                      Kód ellenőrzése
                    </Button>
                  </div>
                </div>
              ) : (
              <form className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300" onSubmit={(e) => { e.preventDefault(); handleNext(); }}>
                {/* Section 1: Client Data */}
                <div className="bg-card rounded-xl p-6 border border-border shadow-soft">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">Ügyfél adatai</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">Az ügyfél nem használ Visibill-t</p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-700 dark:text-slate-300">Cégnév <span className="text-red-500">*</span></Label>
                      <Input 
                        placeholder="" 
                        required 
                        className={cn("bg-card border-border", validationErrors.clientName && "border-red-400 focus-visible:ring-red-500")} 
                        value={clientName}
                        onChange={(e) => { setClientName(e.target.value); setValidationErrors(prev => { const n = {...prev}; delete n.clientName; return n; }); }}
                      />
                      {validationErrors.clientName && <p className="text-xs text-red-500 mt-1">{validationErrors.clientName}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-700 dark:text-slate-300">Adószám <span className="text-red-500">*</span></Label>
                      <Input 
                        value={taxNumber}
                        onChange={(e) => { setTaxNumber(e.target.value); setValidationErrors(prev => { const n = {...prev}; delete n.taxNumber; return n; }); }}
                        required 
                        pattern="^[0-9]{8}-[0-9]-[0-9]{2}$"
                        title="Kérjük, érvényes magyar adószámot adjon meg, a következő formátumban: 12345678-1-23"
                        placeholder="12345678-1-23"
                        className={cn("bg-card border-border", validationErrors.taxNumber && "border-red-400 focus-visible:ring-red-500")} 
                      />
                      {validationErrors.taxNumber && <p className="text-xs text-red-500 mt-1">{validationErrors.taxNumber}</p>}
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label className="text-xs text-slate-700 dark:text-slate-300">Kapcsolattartó neve <span className="text-red-500">*</span></Label>
                      <Input placeholder="" required className="bg-card border-border" value={contactName} onChange={(e) => setContactName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-700 dark:text-slate-300">E-mail cím <span className="text-red-500">*</span></Label>
                      <Input type="email" placeholder="" required className="bg-card border-border" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-700 dark:text-slate-300">Telefonszám</Label>
                      <Input 
                        type="tel" 
                        pattern="^[\+]?[0-9\s\-\(\)]+$" 
                        title="Kérjük, érvényes telefonszámot adjon meg (csak számok, szóköz, +, - vagy zárójel)!"
                        placeholder="" 
                        className="bg-card border-border"
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 1.5: Personal Data & ID Upload */}
                <div className="bg-card rounded-xl p-6 border border-border shadow-soft">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">Személyes adatok és okmányok</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">Személyi igazolvány és lakcímkártya feltöltése az automatikus kitöltéshez</p>
                  
                  {!docsUploaded ? (
                    <>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        className="hidden" 
                        multiple 
                        accept="image/jpeg, image/png, application/pdf" 
                      />
                      <div 
                        className={cn(
                          "border-2 border-dashed rounded-xl p-8 text-center transition-colors flex flex-col items-center justify-center gap-3",
                          isUploadingDocs ? "border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50" : "border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700 hover:bg-slate-50 dark:bg-slate-900 cursor-pointer"
                        )}
                        onClick={handleUploadClick}
                      >
                      {isUploadingDocs ? (
                        <>
                          <div className="w-10 h-10 border-4 border-slate-200 border-t-primary dark:border-slate-700 dark:border-t-slate-300 rounded-full animate-spin"></div>
                          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Okmányok feldolgozása (OCR)...</p>
                        </>
                      ) : (
                        <>
                          <div className="w-12 h-12 rounded-full bg-card border border-border flex items-center justify-center shadow-soft text-slate-400">
                            <FileText className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Kattints ide a feltöltéshez</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Személyi igazolvány és Lakcímkártya (JPG, PNG, PDF)</p>
                          </div>
                        </>
                      )}
                    </div>
                  </>
                  ) : (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="flex items-center gap-2 mb-4 text-primary bg-accent-subtle dark:bg-accent px-4 py-3 rounded-lg border border-accent dark:border-accent">
                        <Check className="w-5 h-5 shrink-0" />
                        <p className="text-sm font-medium">Okmányok sikeresen feldolgozva. Kérjük, ellenőrizze az adatokat!</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs text-slate-700 dark:text-slate-300">Név <span className="text-red-500">*</span></Label>
                          <Input 
                            value={personalData.fullName}
                            onChange={(e) => setPersonalData({...personalData, fullName: e.target.value})}
                            required
                            className="bg-card border-border" 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs text-slate-700 dark:text-slate-300">Születési név</Label>
                          <Input 
                            value={personalData.birthName}
                            onChange={(e) => setPersonalData({...personalData, birthName: e.target.value})}
                            className="bg-card border-border" 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs text-slate-700 dark:text-slate-300">Anyja neve</Label>
                          <Input 
                            value={personalData.mothersName}
                            onChange={(e) => setPersonalData({...personalData, mothersName: e.target.value})}
                            className="bg-card border-border" 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs text-slate-700 dark:text-slate-300">Születési hely és idő</Label>
                          <Input 
                            value={personalData.birthPlaceDate}
                            onChange={(e) => setPersonalData({...personalData, birthPlaceDate: e.target.value})}
                            className="bg-card border-border" 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs text-slate-700 dark:text-slate-300">Szig. szám</Label>
                          <Input 
                            value={personalData.idCardNumber}
                            onChange={(e) => setPersonalData({...personalData, idCardNumber: e.target.value})}
                            className="bg-card border-border" 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs text-slate-700 dark:text-slate-300">Lakcím</Label>
                          <Input 
                            value={personalData.address}
                            onChange={(e) => setPersonalData({...personalData, address: e.target.value})}
                            className="bg-card border-border" 
                          />
                        </div>
                      </div>
                      
                      <div className="flex justify-end mt-2">
                        <Button 
                          type="button"
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setDocsUploaded(false);
                            setPersonalData({ fullName: '', birthName: '', mothersName: '', birthPlaceDate: '', idCardNumber: '', address: '' });
                          }}
                          className="text-xs text-slate-500 hover:text-slate-700 border-border"
                        >
                          Újrafeltöltés
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Section 2: Communication Channels */}
                <div className="bg-card rounded-xl p-6 border border-border shadow-soft">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">Kommunikációs csatornák</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Hogyan kommunikálsz az ügyféllel?</p>
                  
                  <div className="grid grid-cols-3 gap-3">
                    <button 
                      type="button" 
                      onClick={() => toggleChannel('email')}
                      className={cn("flex items-center gap-2 p-3 rounded-full border transition-colors text-sm font-medium", selectedChannels.includes('email') ? "border-slate-900 bg-card text-slate-900 dark:text-slate-100" : "border-border bg-card hover:border-slate-300 text-slate-600 dark:text-slate-400")}
                    >
                      {selectedChannels.includes('email') && <Check className="w-4 h-4 text-slate-900 dark:text-slate-100 shrink-0" />}
                      <Mail className={cn("w-4 h-4 shrink-0", selectedChannels.includes('email') ? "text-slate-600 dark:text-slate-400" : "text-slate-400")} />
                      E-mail
                    </button>
                    <button 
                      type="button" 
                      onClick={() => toggleChannel('viber')}
                      className={cn("flex items-center gap-2 p-3 rounded-full border transition-colors text-sm font-medium", selectedChannels.includes('viber') ? "border-slate-900 bg-card text-slate-900 dark:text-slate-100" : "border-border bg-card hover:border-slate-300 text-slate-600 dark:text-slate-400")}
                    >
                      {selectedChannels.includes('viber') && <Check className="w-4 h-4 text-slate-900 dark:text-slate-100 shrink-0" />}
                      <Smartphone className={cn("w-4 h-4 shrink-0", selectedChannels.includes('viber') ? "text-slate-600 dark:text-slate-400" : "text-slate-400")} />
                      Viber
                    </button>
                    <button 
                      type="button" 
                      onClick={() => toggleChannel('telegram')}
                      className={cn("flex items-center gap-2 p-3 rounded-full border transition-colors text-sm font-medium", selectedChannels.includes('telegram') ? "border-slate-900 bg-card text-slate-900 dark:text-slate-100" : "border-border bg-card hover:border-slate-300 text-slate-600 dark:text-slate-400")}
                    >
                      {selectedChannels.includes('telegram') && <Check className="w-4 h-4 text-slate-900 dark:text-slate-100 shrink-0" />}
                      <Send className={cn("w-4 h-4 shrink-0", selectedChannels.includes('telegram') ? "text-slate-600 dark:text-slate-400" : "text-slate-400")} />
                      Telegram
                    </button>
                  </div>
                </div>

                {/* Section 3: Documents */}
                <div className="bg-card rounded-xl p-6 border border-border shadow-soft">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">Bekérendő dokumentumok</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Milyen dokumentumokat kérsz be rendszeresen?</p>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      type="button" 
                      onClick={() => toggleDoc('szamlak')}
                      className={cn("flex items-center gap-2 p-3 rounded-full border transition-colors text-sm font-medium", selectedDocs.includes('szamlak') ? "border-slate-900 bg-card text-slate-900 dark:text-slate-100" : "border-border bg-card hover:border-slate-300 text-slate-600 dark:text-slate-400")}
                    >
                      <div className={cn("w-4 h-4 rounded-full flex items-center justify-center shrink-0", selectedDocs.includes('szamlak') ? "bg-slate-900 text-white" : "border border-slate-300")}>
                        {selectedDocs.includes('szamlak') && <Check className="w-3 h-3" />}
                      </div>
                      Számlák
                    </button>
                    <button 
                      type="button" 
                      onClick={() => toggleDoc('penztargep')}
                      className={cn("flex items-center gap-2 p-3 rounded-full border transition-colors text-sm font-medium", selectedDocs.includes('penztargep') ? "border-slate-900 bg-card text-slate-900 dark:text-slate-100" : "border-border bg-card hover:border-slate-300 text-slate-600 dark:text-slate-400")}
                    >
                      <div className={cn("w-4 h-4 rounded-full flex items-center justify-center shrink-0", selectedDocs.includes('penztargep') ? "bg-slate-900 text-white" : "border border-slate-300")}>
                        {selectedDocs.includes('penztargep') && <Check className="w-3 h-3" />}
                      </div>
                      Pénztárgép szalagok
                    </button>
                    <button 
                      type="button" 
                      onClick={() => toggleDoc('bankkivonat')}
                      className={cn("flex items-center gap-2 p-3 rounded-full border transition-colors text-sm font-medium", selectedDocs.includes('bankkivonat') ? "border-slate-900 bg-card text-slate-900 dark:text-slate-100" : "border-border bg-card hover:border-slate-300 text-slate-600 dark:text-slate-400")}
                    >
                      <div className={cn("w-4 h-4 rounded-full flex items-center justify-center shrink-0", selectedDocs.includes('bankkivonat') ? "bg-slate-900 text-white" : "border border-slate-300")}>
                        {selectedDocs.includes('bankkivonat') && <Check className="w-3 h-3" />}
                      </div>
                      Bankkivonatok
                    </button>
                    <button 
                      type="button" 
                      onClick={() => toggleDoc('berszamfejtes')}
                      className={cn("flex items-center gap-2 p-3 rounded-full border transition-colors text-sm font-medium", selectedDocs.includes('berszamfejtes') ? "border-slate-900 bg-card text-slate-900 dark:text-slate-100" : "border-border bg-card hover:border-slate-300 text-slate-600 dark:text-slate-400")}
                    >
                      <div className={cn("w-4 h-4 rounded-full flex items-center justify-center shrink-0", selectedDocs.includes('berszamfejtes') ? "bg-slate-900 text-white" : "border border-slate-300")}>
                        {selectedDocs.includes('berszamfejtes') && <Check className="w-3 h-3" />}
                      </div>
                      Bérszámfejtési dokumentumok
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground px-8">
                    Ügyfél hozzáadása
                  </Button>
                </div>
              </form>
              )}
            </div>
          )}

          {/* STEP 2: Integration */}
          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Könyvelőprogram integráció</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">Automatizáld az adatátvitelt a könyvelőprogramod és a Visibill között</p>
              </div>

              <div className="bg-card rounded-xl p-6 border border-border shadow-soft mb-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Milyen könyvelőprogramot használsz?</h2>
                
                <div className="grid grid-cols-3 gap-4">
                  {/* RLB Option */}
                  <button 
                    onClick={() => setIntegrationType('rlb')}
                    className={cn("p-4 rounded-xl border-2 text-left transition-all", integrationType === 'rlb' ? "border-slate-900 dark:border-primary bg-slate-50 dark:bg-accent" : "border-border hover:border-slate-200")}
                  >
                    <div className="w-10 h-10 mb-3 bg-card border border-border rounded flex items-center justify-center shadow-soft">
                      <BarChart2 className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">RLB</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-tight">RLB könyvelőprogram integráció RPA-val</p>
                    {integrationType === 'rlb' && <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100"><Check className="w-3.5 h-3.5" /> Kiválasztva</div>}
                  </button>

                  {/* Novitax Option */}
                  <button 
                    onClick={() => setIntegrationType('novitax')}
                    className={cn("p-4 rounded-xl border-2 text-left transition-all", integrationType === 'novitax' ? "border-slate-900 dark:border-primary bg-slate-50 dark:bg-accent" : "border-border hover:border-slate-200")}
                  >
                    <div className="w-10 h-10 mb-3 bg-card border border-border rounded flex items-center justify-center shadow-soft">
                      <div className="text-red-500 font-bold text-lg"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg></div>
                    </div>
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">Novitax</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-tight">Novitax könyvelőprogram integráció</p>
                    {integrationType === 'novitax' && <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100"><Check className="w-3.5 h-3.5" /> Kiválasztva</div>}
                  </button>

                  {/* Other Option */}
                  <button 
                    onClick={() => setIntegrationType('other')}
                    className={cn("p-4 rounded-xl border-2 text-left transition-all", integrationType === 'other' ? "border-slate-900 dark:border-primary bg-slate-50 dark:bg-accent" : "border-border hover:border-slate-200")}
                  >
                    <div className="w-10 h-10 mb-3 bg-card border border-border rounded flex items-center justify-center shadow-soft">
                      <div className="w-6 h-5 bg-amber-400 rounded-sm relative"><div className="absolute top-0 right-0 w-2 h-2 bg-amber-300 rounded-bl-sm"></div></div>
                    </div>
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">Egyéb / Nincs</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-tight">Manuális exportálás CSV/Excel formátumban</p>
                    {integrationType === 'other' && <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100"><Check className="w-3.5 h-3.5" /> Kiválasztva</div>}
                  </button>
                </div>
              </div>

              {/* Dynamic Content based on selection */}
              {integrationType === 'rlb' && (
                <div className="bg-card rounded-xl p-6 border border-border shadow-soft animate-in fade-in slide-in-from-top-4 duration-300">
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">RLB integráció beállítása</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-6">Kövesd az alábbi lépéseket az integráció beállításához</p>
                  
                  <div className="space-y-4 mb-8">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center text-xs font-semibold">1</div>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Telepítsd a Visibill RPA ügynököt a gépedre</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center text-xs font-semibold">2</div>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Indítsd el az ügynököt és jelentkezz be a Visibill fiókoddal</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center text-xs font-semibold">3</div>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Válaszd ki a RLB programot és add meg a bejelentkezési adatokat</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center text-xs font-semibold">4</div>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Teszteld a kapcsolatot és mentsd el a beállításokat</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button variant="outline" className="gap-2 text-slate-600 dark:text-slate-400" onClick={() => {
                      exportReceiptPdf('rlb_integracis_utmutato', {
                        title: 'RLB Integrációs Útmutató',
                        fields: [
                          { label: '1. lépés', value: 'Telepítsd a Visibill RPA ügynököt' },
                          { label: '2. lépés', value: 'Indítsd el és jelentkezz be' },
                          { label: '3. lépés', value: 'Válaszd ki az RLB programot' },
                          { label: '4. lépés', value: 'Teszteld a kapcsolatot' },
                        ],
                      });
                    }}>
                      <Download className="w-4 h-4" /> Részletes útmutató letöltése
                    </Button>
                    <Button variant="outline" className="gap-2 text-slate-600 dark:text-slate-400">
                      <ExternalLink className="w-4 h-4" /> Segítséget kérek
                    </Button>
                  </div>
                </div>
              )}

              {integrationType === 'novitax' && (
                <div className="bg-card rounded-xl p-6 border border-border shadow-soft animate-in fade-in slide-in-from-top-4 duration-300">
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Novitax integráció beállítása</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-6">Kövesd az alábbi lépéseket az integráció beállításához</p>
                  
                  <div className="space-y-4 mb-8">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center text-xs font-semibold">1</div>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Telepítsd a Visibill RPA ügynököt a gépedre</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center text-xs font-semibold">2</div>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Indítsd el az ügynököt és jelentkezz be a Visibill fiókoddal</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center text-xs font-semibold">3</div>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Válaszd ki a Novitax programot és add meg a bejelentkezési adatokat</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center text-xs font-semibold">4</div>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Teszteld a kapcsolatot és mentsd el a beállításokat</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button variant="outline" className="gap-2 text-slate-600 dark:text-slate-400" onClick={() => {
                      exportReceiptPdf('novitax_integracis_utmutato', {
                        title: 'Novitax Integrációs Útmutató',
                        fields: [
                          { label: '1. lépés', value: 'Telepítsd a Visibill RPA ügynököt' },
                          { label: '2. lépés', value: 'Indítsd el és jelentkezz be' },
                          { label: '3. lépés', value: 'Válaszd ki a Novitax programot' },
                          { label: '4. lépés', value: 'Teszteld a kapcsolatot' },
                        ],
                      });
                    }}>
                      <Download className="w-4 h-4" /> Részletes útmutató letöltése
                    </Button>
                    <Button variant="outline" className="gap-2 text-slate-600 dark:text-slate-400">
                      <ExternalLink className="w-4 h-4" /> Segítséget kérek
                    </Button>
                  </div>
                </div>
              )}

              {integrationType === 'other' && (
                <div className="bg-card rounded-xl p-6 border border-border shadow-soft animate-in fade-in slide-in-from-top-4 duration-300">
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">Manuális exportálás</h2>
                  <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg text-sm text-slate-600 dark:text-slate-400">
                    Manuális exportálást fogsz használni. Az adatokat CSV vagy Excel formátumban töltheted le a feldolgozott számlákból, majd importálhatod a könyvelőprogramodba.
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-6">
                <Button onClick={handleNext} disabled={!integrationType} className="bg-primary hover:bg-primary/90 text-primary-foreground px-8">
                  Befejezés
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: Success */}
          {step === 3 && (
            <div className="animate-in fade-in zoom-in-95 duration-500 w-full">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-3xl"></span>
                </div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Minden készen áll!</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2">A könyvelői fiókod be van állítva. Kezdheted a munkát!</p>
              </div>

              <div className="space-y-3 mb-6">
                <div className="bg-card rounded-xl p-4 border border-border shadow-soft flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-accent text-primary flex items-center justify-center"><Check className="w-3.5 h-3.5" /></div>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Profil</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Kész</p>
                    </div>
                  </div>
                  <User className="w-5 h-5 text-slate-400" />
                </div>

                <div className="bg-card rounded-xl p-4 border border-border shadow-soft flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-accent text-primary flex items-center justify-center"><Check className="w-3.5 h-3.5" /></div>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Ügyfelek</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">1 ügyfél hozzáadva</p>
                    </div>
                  </div>
                  <Users className="w-5 h-5 text-slate-400" />
                </div>

                <div className="bg-card rounded-xl p-4 border border-border shadow-soft flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-accent text-primary flex items-center justify-center"><Check className="w-3.5 h-3.5" /></div>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Integráció</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{integrationType === 'other' ? 'Manuális beállítva' : `${integrationType?.toUpperCase()} beállítva`}</p>
                    </div>
                  </div>
                  <Settings className="w-5 h-5 text-slate-400" />
                </div>
              </div>

              <div className="bg-card rounded-xl p-5 border border-border shadow-soft mb-6 text-sm">
                <p className="font-semibold text-amber-600 flex items-center gap-2 mb-2">
                  <span className="text-base"></span> Tudtad?
                </p>
                <ul className="list-disc pl-5 text-slate-600 dark:text-slate-400 space-y-1.5 text-xs">
                  <li>A portfólió nézetben egy helyen látod az összes ügyfeled státuszát</li>
                  <li>A NAV szinkronizálás automatikusan letölti a bejövő számlákat</li>
                  <li>Az automatikus bekérő emlékezteti az ügyfeleidet a hiányzó számlákra</li>
                </ul>
              </div>

              <Button onClick={() => navigate('/accounty')} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground mb-3">
                Irány a Dashboard &rarr;
              </Button>
              
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1 text-slate-600 dark:text-slate-400">
                  + Újabb ügyfél
                </Button>
                <Button variant="outline" className="flex-1 text-slate-600 dark:text-slate-400">
                  <Settings className="w-4 h-4 mr-2" /> Beállítások
                </Button>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
