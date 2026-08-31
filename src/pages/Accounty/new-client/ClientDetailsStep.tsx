import React from 'react';
import { Check, Building2, Mail, FileText, Smartphone, Send, Loader2, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface ClientDetailsStepProps {
  useVisibillAccount: boolean;
  setUseVisibillAccount: (v: boolean) => void;
  clientName: string;
  setClientName: (v: string) => void;
  taxNumber: string;
  setTaxNumber: (v: string) => void;
  validationErrors: Record<string, string>;
  setValidationErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  contactName: string;
  setContactName: (v: string) => void;
  contactEmail: string;
  setContactEmail: (v: string) => void;
  contactPhone: string;
  setContactPhone: (v: string) => void;
  selectedChannels: string[];
  toggleChannel: (id: string) => void;
  selectedDocs: string[];
  toggleDoc: (id: string) => void;
  inviteCode: string;
  setInviteCode: (v: string) => void;
  codeStatus: 'idle' | 'validating' | 'valid' | 'invalid' | 'expired' | 'already_assigned';
  setCodeStatus: (v: 'idle' | 'validating' | 'valid' | 'invalid' | 'expired' | 'already_assigned') => void;
  linkedCompany: { id: string; name: string; tax_number: string } | null;
  setLinkedCompany: (v: { id: string; name: string; tax_number: string } | null) => void;
  isJoiningAsAccountant: boolean;
  handleValidateCode: () => void;
  handleJoinAsAccountant: () => void;
  handleNext: () => void;
  navigate: (path: string) => void;
  // Personal data / docs upload
  personalData: { fullName: string; birthName: string; mothersName: string; birthPlaceDate: string; idCardNumber: string; address: string };
  setPersonalData: React.Dispatch<React.SetStateAction<{ fullName: string; birthName: string; mothersName: string; birthPlaceDate: string; idCardNumber: string; address: string }>>;
  isUploadingDocs: boolean;
  docsUploaded: boolean;
  setDocsUploaded: (v: boolean) => void;
  handleUploadClick: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  primaryTeaor: string;
  setPrimaryTeaor: (v: string) => void;
  companyDescription: string;
  setCompanyDescription: (v: string) => void;
  isGeneratingDescription: boolean;
  handleGenerateDescription: () => void;
}

export default function ClientDetailsStep(props: ClientDetailsStepProps) {
  const {
    useVisibillAccount, setUseVisibillAccount,
    clientName, setClientName, taxNumber, setTaxNumber,
    validationErrors, setValidationErrors,
    contactName, setContactName, contactEmail, setContactEmail, contactPhone, setContactPhone,
    selectedChannels, toggleChannel, selectedDocs, toggleDoc,
    inviteCode, setInviteCode, codeStatus, setCodeStatus,
    linkedCompany, setLinkedCompany,
    isJoiningAsAccountant, handleValidateCode, handleJoinAsAccountant,
    handleNext, navigate,
    personalData, setPersonalData,
    isUploadingDocs, docsUploaded, setDocsUploaded,
    handleUploadClick, fileInputRef, handleFileChange,
    primaryTeaor, setPrimaryTeaor,
    companyDescription, setCompanyDescription,
    isGeneratingDescription, handleGenerateDescription,
  } = props;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Add hozzá az első ügyfeledet</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Később bármikor hozzáadhatsz többet</p>
      </div>

      {/* Prep Toggle */}
      <div className="flex p-1 bg-muted/80 rounded-full mb-8 max-w-sm mx-auto border border-border/60">
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
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Az ügyfeled eaisybill fiókjából generált meghívó kóddal tudod hozzáadni</p>
          
          <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-5 mb-6">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Így működik:</h3>
            <ol className="space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
              <li>1. Kérd meg az ügyfelet, hogy generáljon meghívó kódot az eaisybill Beállításokban</li>
              <li>2. Írd be ide a kapott kódot és ellenőrizd</li>
              <li>3. Ha érvényes, add hozzá az ügyfelet</li>
            </ol>
          </div>

          <div className="space-y-2 mb-8">
            <Label className="text-sm font-medium text-slate-900 dark:text-slate-100">Meghívó kód</Label>
            <Input 
              placeholder="pl. A1B2C3" 
              value={inviteCode}
              onChange={(e) => { setInviteCode(e.target.value.toUpperCase()); setCodeStatus('idle'); setLinkedCompany(null); }}
              className="bg-slate-50/50 dark:bg-slate-900/50 border-border font-mono uppercase tracking-widest text-lg" 
            />
            {codeStatus === 'valid' && linkedCompany && (
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm mt-2 p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>Cég megtalálva: <strong>{linkedCompany.name}</strong> ({linkedCompany.tax_number})</span>
              </div>
            )}
            {codeStatus === 'invalid' && (
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 text-sm mt-2 p-3 bg-rose-50 dark:bg-rose-950/30 rounded-lg border border-rose-200 dark:border-rose-800">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Érvénytelen meghívó kód</span>
              </div>
            )}
            {codeStatus === 'expired' && (
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm mt-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>A meghívó kód lejárt — kérj újat az ügyféltől!</span>
              </div>
            )}
            {codeStatus === 'already_assigned' && (
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm mt-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>Ez a cég már hozzá van rendelve a fiókodhoz</span>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-border mt-4">
            <Button variant="outline" onClick={() => navigate('/eaisybooks')} className="border-border text-slate-700 dark:text-slate-300">
              Mégse
            </Button>
            {codeStatus === 'valid' ? (
              <Button 
                onClick={handleJoinAsAccountant} 
                disabled={isJoiningAsAccountant}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-6"
              >
                {isJoiningAsAccountant ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Hozzáadás...</>
                ) : (
                  <><Check className="w-4 h-4 mr-2" /> Ügyfél hozzáadása</>
                )}
              </Button>
            ) : (
              <Button 
                onClick={handleValidateCode} 
                disabled={!inviteCode.trim() || codeStatus === 'validating'}
                className="bg-[#6B7280] hover:bg-[#4B5563] text-white px-6"
              >
                {codeStatus === 'validating' ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Ellenőrzés...</>
                ) : (
                  'Kód ellenőrzése'
                )}
              </Button>
            )}
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
            <div className="space-y-2 col-span-2">
              <Label className="text-xs text-slate-700 dark:text-slate-300 font-medium">Elsődleges TEÁOR kód</Label>
              <Input 
                placeholder="Pl. 6201" 
                maxLength={4}
                className="bg-card border-border"
                value={primaryTeaor}
                onChange={(e) => setPrimaryTeaor(e.target.value.replace(/\D/g, '').slice(0, 4))}
              />
            </div>
            <div className="space-y-2 col-span-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-slate-700 dark:text-slate-300 font-medium">Cég tevékenységének bemutatása (AI alapú kontírozáshoz)</Label>
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
                placeholder="Mutasd be röviden a cég tevékenységét és üzletmenetét a pontosabb automatikus könyvelés érdekében..." 
                className="bg-card border-border min-h-[80px]"
                value={companyDescription}
                onChange={(e) => setCompanyDescription(e.target.value)}
                rows={3}
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
                  <Input value={personalData.fullName} onChange={(e) => setPersonalData({...personalData, fullName: e.target.value})} required className="bg-card border-border" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-slate-700 dark:text-slate-300">Születési név</Label>
                  <Input value={personalData.birthName} onChange={(e) => setPersonalData({...personalData, birthName: e.target.value})} className="bg-card border-border" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-slate-700 dark:text-slate-300">Anyja neve</Label>
                  <Input value={personalData.mothersName} onChange={(e) => setPersonalData({...personalData, mothersName: e.target.value})} className="bg-card border-border" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-slate-700 dark:text-slate-300">Születési hely és idő</Label>
                  <Input value={personalData.birthPlaceDate} onChange={(e) => setPersonalData({...personalData, birthPlaceDate: e.target.value})} className="bg-card border-border" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-slate-700 dark:text-slate-300">Szig. szám</Label>
                  <Input value={personalData.idCardNumber} onChange={(e) => setPersonalData({...personalData, idCardNumber: e.target.value})} className="bg-card border-border" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-slate-700 dark:text-slate-300">Lakcím</Label>
                  <Input value={personalData.address} onChange={(e) => setPersonalData({...personalData, address: e.target.value})} className="bg-card border-border" />
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
            <button type="button" onClick={() => toggleChannel('email')}
              className={cn("flex items-center gap-2 p-3 rounded-full border transition-colors text-sm font-medium", selectedChannels.includes('email') ? "border-primary bg-card text-foreground" : "border-border bg-card hover:border-primary/40 text-slate-600 dark:text-slate-400")}>
              {selectedChannels.includes('email') && <Check className="w-4 h-4 text-primary shrink-0" />}
              <Mail className={cn("w-4 h-4 shrink-0", selectedChannels.includes('email') ? "text-primary" : "text-muted-foreground/60")} />
              E-mail
            </button>
            <button type="button" onClick={() => toggleChannel('viber')}
              className={cn("flex items-center gap-2 p-3 rounded-full border transition-colors text-sm font-medium", selectedChannels.includes('viber') ? "border-primary bg-card text-foreground" : "border-border bg-card hover:border-primary/40 text-slate-600 dark:text-slate-400")}>
              {selectedChannels.includes('viber') && <Check className="w-4 h-4 text-primary shrink-0" />}
              <Smartphone className={cn("w-4 h-4 shrink-0", selectedChannels.includes('viber') ? "text-primary" : "text-muted-foreground/60")} />
              Viber
            </button>
            <button type="button" onClick={() => toggleChannel('telegram')}
              className={cn("flex items-center gap-2 p-3 rounded-full border transition-colors text-sm font-medium", selectedChannels.includes('telegram') ? "border-primary bg-card text-foreground" : "border-border bg-card hover:border-primary/40 text-slate-600 dark:text-slate-400")}>
              {selectedChannels.includes('telegram') && <Check className="w-4 h-4 text-primary shrink-0" />}
              <Send className={cn("w-4 h-4 shrink-0", selectedChannels.includes('telegram') ? "text-primary" : "text-muted-foreground/60")} />
              Telegram
            </button>
          </div>
        </div>

        {/* Section 3: Documents */}
        <div className="bg-card rounded-xl p-6 border border-border shadow-soft">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">Bekérendő dokumentumok</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Milyen dokumentumokat kérsz be rendszeresen?</p>
          
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 'szamlak', label: 'Számlák' },
              { id: 'penztargep', label: 'Pénztárgép szalagok' },
              { id: 'bankkivonat', label: 'Bankkivonatok' },
              { id: 'berszamfejtes', label: 'Bérszámfejtési dokumentumok' },
            ].map(doc => (
              <button key={doc.id} type="button" onClick={() => toggleDoc(doc.id)}
                className={cn("flex items-center gap-2 p-3 rounded-full border transition-colors text-sm font-medium", selectedDocs.includes(doc.id) ? "border-primary bg-card text-foreground" : "border-border bg-card hover:border-primary/40 text-slate-600 dark:text-slate-400")}>
                <div className={cn("w-4 h-4 rounded-full flex items-center justify-center shrink-0", selectedDocs.includes(doc.id) ? "bg-primary text-primary-foreground" : "border border-border")}>
                  {selectedDocs.includes(doc.id) && <Check className="w-3 h-3" />}
                </div>
                {doc.label}
              </button>
            ))}
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
  );
}
