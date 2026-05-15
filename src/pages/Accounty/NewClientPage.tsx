import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, Building2, User, Mail, Phone, ExternalLink, Download, FileText, Smartphone, Send, Settings, Users, BarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

export default function NewClientPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [integrationType, setIntegrationType] = useState<'rlb' | 'novitax' | 'other' | null>(null);

  // Mocks state
  const [useVisibillAccount, setUseVisibillAccount] = useState(false);
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['email']);
  const [selectedDocs, setSelectedDocs] = useState<string[]>(['szamlak']);

  const handleNext = () => {
    if (step < 3) setStep((s) => (s + 1) as 1 | 2 | 3);
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
    <div className="h-screen w-full flex flex-col bg-slate-50 font-sans text-slate-900">
      {/* Top Bar */}
      <header className="h-16 shrink-0 bg-white border-b border-slate-200 flex items-center justify-between px-8">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-lg leading-none">v</div>
          <span className="text-xl font-bold text-slate-800 tracking-tight">Visibill for Accountants</span>
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
                    isCompleted ? "bg-[#1A1F2C] text-white" : 
                    isActive ? "bg-[#1A1F2C] text-white ring-2 ring-offset-1 ring-[#1A1F2C]" : 
                    "bg-slate-200 text-slate-500"
                  )}>
                    {isCompleted ? <Check className="w-3.5 h-3.5" /> : num}
                  </div>
                </div>
              );
            })}
            <span className="text-sm font-medium text-slate-600 ml-2">
              {step === 1 ? "Első ügyfél" : step === 2 ? "Integráció" : "Kész"}
            </span>
          </div>

          <button onClick={() => navigate('/accounty')} className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
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
                <h1 className="text-2xl font-bold text-slate-900">Add hozzá az első ügyfeledet</h1>
                <p className="text-slate-500 mt-1">Később bármikor hozzáadhatsz többet</p>
              </div>

              {/* Prep Toggle */}
              <div className="flex p-1 bg-slate-100/80 rounded-full mb-8 max-w-sm mx-auto border border-slate-200/60">
                <button 
                  onClick={() => setUseVisibillAccount(true)}
                  className={cn("flex-1 py-2 px-4 text-sm font-medium rounded-full flex items-center justify-center gap-2 transition-all", useVisibillAccount ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700")}
                >
                  <svg className="w-4 h-4 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                  Van Visibill fiókja
                </button>
                <button 
                  onClick={() => setUseVisibillAccount(false)}
                  className={cn("flex-1 py-2 px-4 text-sm font-medium rounded-full flex items-center justify-center gap-2 transition-all", !useVisibillAccount ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700")}
                >
                  <Building2 className="w-4 h-4 opacity-70" /> Manuálisan adom hozzá
                </button>
              </div>

              {useVisibillAccount ? (
                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <h2 className="text-xl font-bold text-slate-900 mb-1">Ügyfelemnek van Visibill fiókja</h2>
                  <p className="text-sm text-slate-500 mb-6">Az ügyfeled a saját fiókjából fog meghívni</p>
                  
                  <div className="bg-slate-100 rounded-lg p-5 mb-6">
                    <h3 className="font-semibold text-slate-900 mb-2">Így működik:</h3>
                    <ol className="space-y-1.5 text-sm text-slate-600">
                      <li>1. Kérd meg az ügyfelet, hogy hívjon meg a Visibill-ből</li>
                      <li>2. Fogadd el az e-mailben kapott meghívót</li>
                    </ol>
                  </div>

                  <div className="space-y-2 mb-8">
                    <Label className="text-sm font-medium text-slate-900">Vagy add meg a meghívó kódot</Label>
                    <Input placeholder="ABC-123-XYZ" className="bg-slate-50/50 border-slate-200 font-mono" />
                  </div>

                  <div className="flex justify-end gap-3 pt-2 border-t border-slate-50 mt-4">
                    <Button variant="outline" onClick={() => navigate('/accounty')} className="border-slate-200 text-slate-700">
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
                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-900 mb-1">Ügyfél adatai</h2>
                  <p className="text-xs text-slate-500 mb-6">Az ügyfél nem használ Visibill-t</p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-700">Cégnév <span className="text-red-500">*</span></Label>
                      <Input placeholder="" required className="bg-white border-slate-200" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-700">Adószám <span className="text-red-500">*</span></Label>
                      <Input 
                        defaultValue="12345678-1-23" 
                        required 
                        pattern="^[0-9]{8}-[0-9]-[0-9]{2}$"
                        title="Kérjük, érvényes magyar adószámot adjon meg, a következő formátumban: 12345678-1-23"
                        className="bg-white border-slate-200" 
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label className="text-xs text-slate-700">Kapcsolattartó neve <span className="text-red-500">*</span></Label>
                      <Input placeholder="" required className="bg-white border-slate-200" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-700">E-mail cím <span className="text-red-500">*</span></Label>
                      <Input type="email" placeholder="" required className="bg-white border-slate-200" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-700">Telefonszám</Label>
                      <Input 
                        type="tel" 
                        pattern="^[\+]?[0-9\s\-\(\)]+$" 
                        title="Kérjük, érvényes telefonszámot adjon meg (csak számok, szóköz, +, - vagy zárójel)!"
                        placeholder="" 
                        className="bg-white border-slate-200" 
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Communication Channels */}
                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-900 mb-1">Kommunikációs csatornák</h2>
                  <p className="text-xs text-slate-500 mb-4">Hogyan kommunikálsz az ügyféllel?</p>
                  
                  <div className="grid grid-cols-3 gap-3">
                    <button 
                      type="button" 
                      onClick={() => toggleChannel('email')}
                      className={cn("flex items-center gap-2 p-3 rounded-full border transition-colors text-sm font-medium", selectedChannels.includes('email') ? "border-slate-900 bg-white text-slate-900" : "border-slate-200 bg-white hover:border-slate-300 text-slate-600")}
                    >
                      {selectedChannels.includes('email') && <Check className="w-4 h-4 text-slate-900 shrink-0" />}
                      <Mail className={cn("w-4 h-4 shrink-0", selectedChannels.includes('email') ? "text-slate-600" : "text-slate-400")} />
                      E-mail
                    </button>
                    <button 
                      type="button" 
                      onClick={() => toggleChannel('viber')}
                      className={cn("flex items-center gap-2 p-3 rounded-full border transition-colors text-sm font-medium", selectedChannels.includes('viber') ? "border-slate-900 bg-white text-slate-900" : "border-slate-200 bg-white hover:border-slate-300 text-slate-600")}
                    >
                      {selectedChannels.includes('viber') && <Check className="w-4 h-4 text-slate-900 shrink-0" />}
                      <Smartphone className={cn("w-4 h-4 shrink-0", selectedChannels.includes('viber') ? "text-slate-600" : "text-slate-400")} />
                      Viber
                    </button>
                    <button 
                      type="button" 
                      onClick={() => toggleChannel('telegram')}
                      className={cn("flex items-center gap-2 p-3 rounded-full border transition-colors text-sm font-medium", selectedChannels.includes('telegram') ? "border-slate-900 bg-white text-slate-900" : "border-slate-200 bg-white hover:border-slate-300 text-slate-600")}
                    >
                      {selectedChannels.includes('telegram') && <Check className="w-4 h-4 text-slate-900 shrink-0" />}
                      <Send className={cn("w-4 h-4 shrink-0", selectedChannels.includes('telegram') ? "text-slate-600" : "text-slate-400")} />
                      Telegram
                    </button>
                  </div>
                </div>

                {/* Section 3: Documents */}
                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-900 mb-1">Bekérendő dokumentumok</h2>
                  <p className="text-xs text-slate-500 mb-4">Milyen dokumentumokat kérsz be rendszeresen?</p>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      type="button" 
                      onClick={() => toggleDoc('szamlak')}
                      className={cn("flex items-center gap-2 p-3 rounded-full border transition-colors text-sm font-medium", selectedDocs.includes('szamlak') ? "border-slate-900 bg-white text-slate-900" : "border-slate-200 bg-white hover:border-slate-300 text-slate-600")}
                    >
                      <div className={cn("w-4 h-4 rounded-full flex items-center justify-center shrink-0", selectedDocs.includes('szamlak') ? "bg-slate-900 text-white" : "border border-slate-300")}>
                        {selectedDocs.includes('szamlak') && <Check className="w-3 h-3" />}
                      </div>
                      Számlák
                    </button>
                    <button 
                      type="button" 
                      onClick={() => toggleDoc('penztargep')}
                      className={cn("flex items-center gap-2 p-3 rounded-full border transition-colors text-sm font-medium", selectedDocs.includes('penztargep') ? "border-slate-900 bg-white text-slate-900" : "border-slate-200 bg-white hover:border-slate-300 text-slate-600")}
                    >
                      <div className={cn("w-4 h-4 rounded-full flex items-center justify-center shrink-0", selectedDocs.includes('penztargep') ? "bg-slate-900 text-white" : "border border-slate-300")}>
                        {selectedDocs.includes('penztargep') && <Check className="w-3 h-3" />}
                      </div>
                      Pénztárgép szalagok
                    </button>
                    <button 
                      type="button" 
                      onClick={() => toggleDoc('bankkivonat')}
                      className={cn("flex items-center gap-2 p-3 rounded-full border transition-colors text-sm font-medium", selectedDocs.includes('bankkivonat') ? "border-slate-900 bg-white text-slate-900" : "border-slate-200 bg-white hover:border-slate-300 text-slate-600")}
                    >
                      <div className={cn("w-4 h-4 rounded-full flex items-center justify-center shrink-0", selectedDocs.includes('bankkivonat') ? "bg-slate-900 text-white" : "border border-slate-300")}>
                        {selectedDocs.includes('bankkivonat') && <Check className="w-3 h-3" />}
                      </div>
                      Bankkivonatok
                    </button>
                    <button 
                      type="button" 
                      onClick={() => toggleDoc('berszamfejtes')}
                      className={cn("flex items-center gap-2 p-3 rounded-full border transition-colors text-sm font-medium", selectedDocs.includes('berszamfejtes') ? "border-slate-900 bg-white text-slate-900" : "border-slate-200 bg-white hover:border-slate-300 text-slate-600")}
                    >
                      <div className={cn("w-4 h-4 rounded-full flex items-center justify-center shrink-0", selectedDocs.includes('berszamfejtes') ? "bg-slate-900 text-white" : "border border-slate-300")}>
                        {selectedDocs.includes('berszamfejtes') && <Check className="w-3 h-3" />}
                      </div>
                      Bérszámfejtési dokumentumok
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" className="bg-[#1A1F2C] hover:bg-[#1A1F2C]/90 text-white px-8">
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
                <h1 className="text-2xl font-bold text-slate-900">Könyvelőprogram integráció</h1>
                <p className="text-slate-500 mt-1">Automatizáld az adatátvitelt a könyvelőprogramod és a Visibill között</p>
              </div>

              <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm mb-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Milyen könyvelőprogramot használsz?</h2>
                
                <div className="grid grid-cols-3 gap-4">
                  {/* RLB Option */}
                  <button 
                    onClick={() => setIntegrationType('rlb')}
                    className={cn("p-4 rounded-xl border-2 text-left transition-all", integrationType === 'rlb' ? "border-slate-900 bg-slate-50" : "border-slate-100 hover:border-slate-200")}
                  >
                    <div className="w-10 h-10 mb-3 bg-white border border-slate-100 rounded flex items-center justify-center shadow-sm">
                      <BarChart2 className="w-6 h-6 text-emerald-600" />
                    </div>
                    <h3 className="font-semibold text-slate-900">RLB</h3>
                    <p className="text-xs text-slate-500 mt-1 leading-tight">RLB könyvelőprogram integráció RPA-val</p>
                    {integrationType === 'rlb' && <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-slate-900"><Check className="w-3.5 h-3.5" /> Kiválasztva</div>}
                  </button>

                  {/* Novitax Option */}
                  <button 
                    onClick={() => setIntegrationType('novitax')}
                    className={cn("p-4 rounded-xl border-2 text-left transition-all", integrationType === 'novitax' ? "border-slate-900 bg-slate-50" : "border-slate-100 hover:border-slate-200")}
                  >
                    <div className="w-10 h-10 mb-3 bg-white border border-slate-100 rounded flex items-center justify-center shadow-sm">
                      <div className="text-red-500 font-bold text-lg"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg></div>
                    </div>
                    <h3 className="font-semibold text-slate-900">Novitax</h3>
                    <p className="text-xs text-slate-500 mt-1 leading-tight">Novitax könyvelőprogram integráció</p>
                    {integrationType === 'novitax' && <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-slate-900"><Check className="w-3.5 h-3.5" /> Kiválasztva</div>}
                  </button>

                  {/* Other Option */}
                  <button 
                    onClick={() => setIntegrationType('other')}
                    className={cn("p-4 rounded-xl border-2 text-left transition-all", integrationType === 'other' ? "border-slate-900 bg-slate-50" : "border-slate-100 hover:border-slate-200")}
                  >
                    <div className="w-10 h-10 mb-3 bg-white border border-slate-100 rounded flex items-center justify-center shadow-sm">
                      <div className="w-6 h-5 bg-amber-400 rounded-sm relative"><div className="absolute top-0 right-0 w-2 h-2 bg-amber-300 rounded-bl-sm"></div></div>
                    </div>
                    <h3 className="font-semibold text-slate-900">Egyéb / Nincs</h3>
                    <p className="text-xs text-slate-500 mt-1 leading-tight">Manuális exportálás CSV/Excel formátumban</p>
                    {integrationType === 'other' && <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-slate-900"><Check className="w-3.5 h-3.5" /> Kiválasztva</div>}
                  </button>
                </div>
              </div>

              {/* Dynamic Content based on selection */}
              {integrationType === 'rlb' && (
                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                  <h2 className="text-xl font-semibold text-slate-900">RLB integráció beállítása</h2>
                  <p className="text-sm text-slate-500 mt-1 mb-6">Kövesd az alábbi lépéseket az integráció beállításához</p>
                  
                  <div className="space-y-4 mb-8">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-semibold">1</div>
                      <span className="text-sm font-medium text-slate-700">Telepítsd a Visibill RPA ügynököt a gépedre</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-semibold">2</div>
                      <span className="text-sm font-medium text-slate-700">Indítsd el az ügynököt és jelentkezz be a Visibill fiókoddal</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-semibold">3</div>
                      <span className="text-sm font-medium text-slate-700">Válaszd ki a RLB programot és add meg a bejelentkezési adatokat</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-semibold">4</div>
                      <span className="text-sm font-medium text-slate-700">Teszteld a kapcsolatot és mentsd el a beállításokat</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button variant="outline" className="gap-2 text-slate-600">
                      <Download className="w-4 h-4" /> Részletes útmutató letöltése
                    </Button>
                    <Button variant="outline" className="gap-2 text-slate-600">
                      <ExternalLink className="w-4 h-4" /> Segítséget kérek
                    </Button>
                  </div>
                </div>
              )}

              {integrationType === 'novitax' && (
                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                  <h2 className="text-xl font-semibold text-slate-900">Novitax integráció beállítása</h2>
                  <p className="text-sm text-slate-500 mt-1 mb-6">Kövesd az alábbi lépéseket az integráció beállításához</p>
                  
                  <div className="space-y-4 mb-8">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-semibold">1</div>
                      <span className="text-sm font-medium text-slate-700">Telepítsd a Visibill RPA ügynököt a gépedre</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-semibold">2</div>
                      <span className="text-sm font-medium text-slate-700">Indítsd el az ügynököt és jelentkezz be a Visibill fiókoddal</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-semibold">3</div>
                      <span className="text-sm font-medium text-slate-700">Válaszd ki a Novitax programot és add meg a bejelentkezési adatokat</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-semibold">4</div>
                      <span className="text-sm font-medium text-slate-700">Teszteld a kapcsolatot és mentsd el a beállításokat</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button variant="outline" className="gap-2 text-slate-600">
                      <Download className="w-4 h-4" /> Részletes útmutató letöltése
                    </Button>
                    <Button variant="outline" className="gap-2 text-slate-600">
                      <ExternalLink className="w-4 h-4" /> Segítséget kérek
                    </Button>
                  </div>
                </div>
              )}

              {integrationType === 'other' && (
                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                  <h2 className="text-xl font-semibold text-slate-900 mb-4">Manuális exportálás</h2>
                  <div className="bg-slate-100 p-4 rounded-lg text-sm text-slate-600">
                    Manuális exportálást fogsz használni. Az adatokat CSV vagy Excel formátumban töltheted le a feldolgozott számlákból, majd importálhatod a könyvelőprogramodba.
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-6">
                <Button onClick={handleNext} disabled={!integrationType} className="bg-[#1A1F2C] hover:bg-[#1A1F2C]/90 text-white px-8">
                  Befejezés
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: Success */}
          {step === 3 && (
            <div className="animate-in fade-in zoom-in-95 duration-500 max-w-lg mx-auto">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-3xl">🎉</span>
                </div>
                <h1 className="text-2xl font-bold text-slate-900">Minden készen áll!</h1>
                <p className="text-slate-500 mt-2">A könyvelői fiókod be van állítva. Kezdheted a munkát!</p>
              </div>

              <div className="space-y-3 mb-6">
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center"><Check className="w-3.5 h-3.5" /></div>
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">Profil</p>
                      <p className="text-xs text-slate-500">Kész</p>
                    </div>
                  </div>
                  <User className="w-5 h-5 text-slate-400" />
                </div>

                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center"><Check className="w-3.5 h-3.5" /></div>
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">Ügyfelek</p>
                      <p className="text-xs text-slate-500">1 ügyfél hozzáadva</p>
                    </div>
                  </div>
                  <Users className="w-5 h-5 text-slate-400" />
                </div>

                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center"><Check className="w-3.5 h-3.5" /></div>
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">Integráció</p>
                      <p className="text-xs text-slate-500">{integrationType === 'other' ? 'Manuális beállítva' : `${integrationType?.toUpperCase()} beállítva`}</p>
                    </div>
                  </div>
                  <Settings className="w-5 h-5 text-slate-400" />
                </div>
              </div>

              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm mb-6 text-sm">
                <p className="font-semibold text-amber-600 flex items-center gap-2 mb-2">
                  <span className="text-base">💡</span> Tudtad?
                </p>
                <ul className="list-disc pl-5 text-slate-600 space-y-1.5 text-xs">
                  <li>A portfólió nézetben egy helyen látod az összes ügyfeled státuszát</li>
                  <li>A NAV szinkronizálás automatikusan letölti a bejövő számlákat</li>
                  <li>Az automatikus bekérő emlékezteti az ügyfeleidet a hiányzó számlákra</li>
                </ul>
              </div>

              <Button onClick={() => navigate('/accounty')} className="w-full bg-[#1A1F2C] hover:bg-[#1A1F2C]/90 text-white mb-3">
                Irány a Dashboard &rarr;
              </Button>
              
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1 text-slate-600">
                  + Újabb ügyfél
                </Button>
                <Button variant="outline" className="flex-1 text-slate-600">
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
