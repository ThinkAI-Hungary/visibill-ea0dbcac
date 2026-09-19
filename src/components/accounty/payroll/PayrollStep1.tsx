import React, { useState, useEffect } from 'react';
import {
  Mail, Loader2, CheckCircle2, Eye, Send, Copy, ExternalLink,
  Settings2, Sparkles, Check, FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { generatePayrollRequestEmail } from '@/lib/payroll/emailTemplates';
import { cn } from '@/lib/utils';

export interface DataRequestPreset {
  attendance: boolean;
  overtime: boolean;
  bonus: boolean;
  sickLeave: boolean;
  newHires: boolean;
  terminations: boolean;
  cafeteria: boolean;
  phone: boolean;
  serviceCharge: boolean;
  advances: boolean;
}

const DEFAULT_PRESET: DataRequestPreset = {
  attendance: true,
  overtime: true,
  bonus: false,
  sickLeave: true,
  newHires: false,
  terminations: false,
  cafeteria: false,
  phone: false,
  serviceCharge: false,
  advances: false,
};

interface PayrollStep1Props {
  companyId?: string;
  companyName?: string;
  year?: number;
  month?: number;
  cycleId?: string;
  emailSent: boolean;
  emailSending: boolean;
  emailTo: string;
  setEmailTo: (v: string) => void;
  handleSendCustomEmail: (subject: string, htmlBody: string, plainText: string) => Promise<void>;
}

export default function PayrollStep1({
  companyId,
  companyName = 'Cég',
  year = new Date().getFullYear(),
  month = new Date().getMonth() + 1,
  cycleId,
  emailSent,
  emailSending,
  emailTo,
  setEmailTo,
  handleSendCustomEmail,
}: PayrollStep1Props) {
  const { toast } = useToast();

  // Preset state
  const [preset, setPreset] = useState<DataRequestPreset>(DEFAULT_PRESET);
  const [savingPreset, setSavingPreset] = useState(false);
  const [editorMode, setEditorMode] = useState<'send' | 'edit'>('edit');
  const [customTemplateLoaded, setCustomTemplateLoaded] = useState<string | null>(null);

  // Email editor dialog state
  const [editorOpen, setEditorOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBodyText, setEmailBodyText] = useState('');

  // Portal link state
  const [portalUrl, setPortalUrl] = useState('');

  // Compute portalUrl with active items query
  useEffect(() => {
    if (!companyId) return;
    const origin = window.location.origin;
    const activeItems = Object.entries(preset)
      .filter(([_, v]) => Boolean(v))
      .map(([k]) => k)
      .join(',');
    setPortalUrl(`${origin}/client-portal?company=${companyId}&period=${year}-${String(month).padStart(2, '0')}&items=${activeItems}`);
  }, [companyId, year, month, preset]);

  // Load saved preset and custom template from company payroll settings
  useEffect(() => {
    if (!companyId) return;

    (async () => {
      try {
        const { data } = await supabase
          .from('accounty_payroll_settings')
          .select('data_request_preset, email_template')
          .eq('company_id', companyId)
          .maybeSingle();

        if (data?.data_request_preset) {
          setPreset({ ...DEFAULT_PRESET, ...(data.data_request_preset as any) });
        }
        if (data?.email_template) {
          setCustomTemplateLoaded(data.email_template);
        }
      } catch (err) {
        console.error('Error fetching data_request_preset:', err);
      }
    })();
  }, [companyId]);

  // Build checklist strings based on active preset
  const getActiveChecklist = (): string[] => {
    const list: string[] = [];
    if (preset.attendance) list.push('Jelenléti ív / munkaidő nyilvántartás (ledolgozott órák és napok)');
    if (preset.overtime) list.push('Túlóra kimutatás és rendkívüli munkavégzés adatai');
    if (preset.bonus) list.push('Tárgyhavi bónuszok, prémiumok és egyedi jutalmak listája');
    if (preset.sickLeave) list.push('Betegszabadság és táppénzes orvosi igazolások');
    if (preset.newHires) list.push('Új belépő munkavállalók adatai (TAJ, adószám, személyes adatok, bankszámla)');
    if (preset.terminations) list.push('Kilépő dolgozók adatai és munkaviszony megszűnésének dátuma');
    if (preset.cafeteria) list.push('SZÉP kártya és béren kívüli juttatás nyilatkozatok');
    if (preset.phone) list.push('Céges mobiltelefon számlák és magáncélú használat megosztása');
    if (preset.serviceCharge) list.push('Vendéglátóipari felszolgálási díj havi felosztási összegei');
    if (preset.advances) list.push('Fizetett munkabérelőlegek és dolgozói levonási igények');
    return list;
  };

  // Open editor and populate with template
  const handleOpenEditor = (mode: 'send' | 'edit' = 'edit') => {
    setEditorMode(mode);
    const checklist = getActiveChecklist();
    const dueDateFormatted = new Date(Date.now() + 5 * 86400000).toLocaleDateString('hu-HU');
    const generated = generatePayrollRequestEmail({
      companyName,
      contactName: 'Tisztelt Ügyfelünk',
      year,
      month,
      dueDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
      portalLink: portalUrl,
      senderName: 'Könyvelőiroda',
      senderCompany: companyName,
      extraRequests: checklist.filter(item => !item.startsWith('Jelenléti')),
    });

    setEmailSubject(generated.subject);
    
    if (customTemplateLoaded) {
      setEmailBodyText(customTemplateLoaded);
    } else {
      // Construct rich editable text with the active preset checklist and company signature
      const body = `Tisztelt Ügyfelünk!

Kérjük, hogy a(z) ${companyName} ${year}. ${month}. havi bérszámfejtéséhez a szükséges adatokat legkésőbb ${dueDateFormatted}-ig szíveskedjen megküldeni.

A tárgyhónapban bekérendő adatok köre:
${checklist.map((item, idx) => `  ${idx + 1}. ${item}`).join('\n')}

Az adatokat és dokumentumokat közvetlenül az Ügyfélportálon keresztül is feltöltheti:
${portalUrl}

Amennyiben az adott hónapban nem történt változás, kérjük válaszlevélben igazolja vissza.

Üdvözlettel,
${companyName}`;

      setEmailBodyText(body);
    }

    setEditorOpen(true);
  };

  // Save preset to DB
  const handleSavePreset = async () => {
    if (!companyId) return;
    setSavingPreset(true);
    try {
      const { error } = await supabase
        .from('accounty_payroll_settings')
        .upsert({
          company_id: companyId,
          data_request_preset: preset,
        }, { onConflict: 'company_id' });

      if (error) throw error;
      toast({ title: 'Sikeres mentés', description: 'Az adatbekérési beállítások elmentve a cég alapértelmezett profiljaként.' });
    } catch (err: any) {
      console.error('Error saving preset:', err);
      toast({ variant: 'destructive', title: 'Hiba a mentéskor', description: err.message });
    } finally {
      setSavingPreset(false);
    }
  };

  // Save custom email template to DB
  const handleSaveEmailTemplate = async () => {
    if (!companyId) return;
    setSavingPreset(true);
    try {
      const { error } = await supabase
        .from('accounty_payroll_settings')
        .upsert({
          company_id: companyId,
          data_request_preset: preset,
          email_template: emailBodyText,
        }, { onConflict: 'company_id' });

      if (error) throw error;
      setCustomTemplateLoaded(emailBodyText);
      toast({ title: 'Sablon elmentve', description: 'A testreszabott bekérő e-mail sablon sikeresen elmentve a céghez.' });
      setEditorOpen(false);
    } catch (err: any) {
      console.error('Error saving email template:', err);
      toast({ variant: 'destructive', title: 'Hiba a mentéskor', description: err.message });
    } finally {
      setSavingPreset(false);
    }
  };

  // Quick preset buttons
  const applyPresetProfile = (type: 'office' | 'full' | 'hospitality') => {
    if (type === 'office') {
      setPreset({
        attendance: true, overtime: false, bonus: false, sickLeave: true,
        newHires: false, terminations: false, cafeteria: false, phone: false,
        serviceCharge: false, advances: false,
      });
      toast({ title: 'Profil betöltve', description: 'Standard Irodai profil (csak jelenléti ív és táppénz)' });
    } else if (type === 'full') {
      setPreset({
        attendance: true, overtime: true, bonus: true, sickLeave: true,
        newHires: true, terminations: true, cafeteria: true, phone: true,
        serviceCharge: false, advances: true,
      });
      toast({ title: 'Profil betöltve', description: 'Teljes körű profil (minden tétel bepipálva)' });
    } else if (type === 'hospitality') {
      setPreset({
        attendance: true, overtime: true, bonus: true, sickLeave: true,
        newHires: true, terminations: true, cafeteria: true, phone: false,
        serviceCharge: true, advances: true,
      });
      toast({ title: 'Profil betöltve', description: 'Vendéglátóipari profil (felszolgálási díjjal kiegészítve)' });
    }
  };

  // Copy portal link to clipboard
  const handleCopyPortalLink = () => {
    navigator.clipboard.writeText(portalUrl);
    toast({
      title: 'Portál link másolva!',
      description: 'A vágólapra másolt link közvetlenül az ügyfélportál adatbekérő felületére vezet.',
    });
  };

  // Send the edited email
  const onSendEditedEmail = async () => {
    if (!emailTo || !emailTo.includes('@')) {
      toast({ variant: 'destructive', title: 'Hibás email cím', description: 'Kérlek adj meg egy érvényes email címet.' });
      return;
    }

    const formattedHtml = emailBodyText
      .replace(/\n\n/g, '</p><p style="margin: 12px 0;">')
      .replace(/\n/g, '<br/>');

    const fullHtml = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <div style="border-bottom: 2px solid #0d9488; padding-bottom: 12px; margin-bottom: 16px;">
          <h2 style="color: #0d9488; margin: 0; font-size: 20px;">eaisyBooks Bérszámfejtés</h2>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">${companyName} — Havi adatbekérő értesítés</p>
        </div>
        <p style="margin: 12px 0;">${formattedHtml}</p>
      </div>
    `;

    await handleSendCustomEmail(emailSubject, fullHtml, emailBodyText);
    setEditorOpen(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground dark:text-foreground/90">
          Állítsd be a cégre szabott adatbekérési profilt, szerkeszd meg a bekérő e-mail szövegét, vagy másold ki az Ügyfélportál közvetlen linkjét.
        </p>
      </div>

      {/* ── Action Buttons ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        {/* Email button */}
        <button
          onClick={() => handleOpenEditor('send')}
          disabled={emailSending}
          className={cn(
            "flex items-center gap-2.5 p-3 rounded-lg border transition-all text-left",
            emailSent
              ? "border-emerald-500/40 bg-emerald-500/10 dark:bg-emerald-950/20"
              : "border-border hover:border-primary/40 hover:bg-primary/5",
            emailSending && "opacity-75 cursor-not-allowed"
          )}
        >
          {emailSending ? (
            <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />
          ) : emailSent ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <Mail className="w-4 h-4 text-blue-500 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-xs font-bold text-foreground truncate">
              {emailSending ? 'Küldés folyamatban...' : emailSent ? 'E-mail elküldve!' : 'Bekérő e-mail küldése'}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {emailSent ? `Kiküldve erre: ${emailTo}` : 'Szöveg szerkesztése és küldés'}
            </p>
          </div>
        </button>

        {/* Preview and Edit button */}
        <button
          onClick={() => handleOpenEditor('edit')}
          className="flex items-center gap-2.5 p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-left"
        >
          <Eye className="w-4 h-4 text-violet-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-foreground truncate">Sablon megtekintése és szerkesztése</p>
            <p className="text-[11px] text-muted-foreground truncate">Aktuális levél előnézete és testreszabása</p>
          </div>
        </button>

        {/* Dolgozói önkiszolgáló portál kártya */}
        <div className="flex items-center justify-between p-3 rounded-lg border border-teal-500/40 bg-teal-500/5 hover:border-teal-500/60 hover:bg-teal-500/10 transition-all">
          <div className="flex items-center gap-2.5 cursor-pointer min-w-0 flex-1" onClick={handleCopyPortalLink} title="Portál link másolása a vágólapra">
            <div className="w-8 h-8 rounded-lg bg-teal-500/15 flex items-center justify-center shrink-0">
              <Send className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            </div>
            <div className="text-left min-w-0">
              <p className="text-xs font-bold text-foreground flex items-center gap-1.5 truncate">
                Dolgozói önkiszolgáló portál <Copy className="w-3 h-3 text-teal-600 dark:text-teal-400 shrink-0" />
              </p>
              <p className="text-[11px] text-muted-foreground truncate">Közvetlen bekérő link másolása</p>
            </div>
          </div>
          <a
            href={portalUrl}
            target="_blank"
            rel="noreferrer"
            title="Dolgozói önkiszolgáló portál megnyitása új lapon"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition-colors shrink-0 ml-2 shadow-xs"
          >
            <span>Megnyitás</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* ── Preset Configuration Panel ── */}
      <div className="p-3.5 rounded-lg border border-border bg-card shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 pb-2.5 border-b border-border">
          <div>
            <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Settings2 className="w-3.5 h-3.5 text-primary shrink-0" /> Cégreszabott Adatbekérési Profil
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Állítsd be, hogy ennél a cégnél milyen tételeket szükséges bekérni a havi bérszámfejtéshez.
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-muted-foreground font-medium">Gyors preset:</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyPresetProfile('office')}
              className="text-xs h-7 px-2"
            >
              Irodai
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyPresetProfile('hospitality')}
              className="text-xs h-7 px-2"
            >
              Vendéglátó
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyPresetProfile('full')}
              className="text-xs h-7 px-2"
            >
              Minden tétel
            </Button>
            <Button
              size="sm"
              onClick={handleSavePreset}
              disabled={savingPreset}
              className="text-xs h-7 px-2.5 flex items-center gap-1 bg-primary text-primary-foreground hover:bg-primary/90 ml-1"
            >
              {savingPreset ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Mentés profilként
            </Button>
          </div>
        </div>

        {/* Checkbox grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2">
          {[
            { key: 'attendance', label: 'Jelenléti ív / Munkaidő', desc: 'Ledolgozott napok és órák' },
            { key: 'overtime', label: 'Túlóra és műszakpótlék', desc: '50% és 100% túlórák' },
            { key: 'bonus', label: 'Bónuszok és jutalmak', desc: 'Tárgyhavi egyedi prémiumok' },
            { key: 'sickLeave', label: 'Táppénzes papírok', desc: 'Orvosi igazolások' },
            { key: 'newHires', label: 'Új belépők adatai', desc: 'Munkaszerződések, adatok' },
            { key: 'terminations', label: 'Kilépő munkavállalók', desc: 'Megszüntetések' },
            { key: 'cafeteria', label: 'SZÉP kártya és cafeteria', desc: 'Béren kívüli keretek' },
            { key: 'phone', label: 'Magáncélú telefon', desc: 'Céges számlák, 20% átalány' },
            { key: 'serviceCharge', label: 'Felszolgálási díj', desc: 'Vendéglátóipari felosztás' },
            { key: 'advances', label: 'Előlegek és levonások', desc: 'Előlegek, tagdíjak' },
          ].map((item) => {
            const isChecked = Boolean(preset[item.key as keyof DataRequestPreset]);
            return (
              <label
                key={item.key}
                className={cn(
                  "flex items-start gap-2 p-2 rounded-md border cursor-pointer transition-all select-none min-w-0",
                  isChecked
                    ? "border-primary/40 bg-primary/5 text-foreground"
                    : "border-border/60 hover:border-border text-muted-foreground"
                )}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => setPreset(prev => ({ ...prev, [item.key]: e.target.checked }))}
                  className="mt-0.5 rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 shrink-0"
                />
                <div className="min-w-0">
                  <p className={cn("text-xs font-semibold truncate", isChecked && "text-foreground")}>{item.label}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{item.desc}</p>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* ── Rich Email Editor Dialog ── */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Mail className="w-4 h-4 text-primary" />
              {editorMode === 'edit' ? 'Bekérő Sablon E-mail Megtekintése és Szerkesztése' : 'Bekérő E-mail Ellenőrzése és Kiküldése'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Címzett email címe *</label>
              <Input
                type="email"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="cegvezeto@ceg.hu"
                className="text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">E-mail tárgya</label>
              <Input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Bérszámfejtés - Adatbekérés"
                className="text-sm"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-muted-foreground">E-mail levéltörzs</label>
                <span className="text-[11px] text-muted-foreground">A bejelölt adatbekérési pontok automatikusan szerepelnek</span>
              </div>
              <Textarea
                rows={10}
                value={emailBodyText}
                onChange={(e) => setEmailBodyText(e.target.value)}
                className="font-mono text-xs leading-relaxed"
              />
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditorOpen(false)}>
              Mégse
            </Button>
            <div className="flex items-center gap-2">
              {editorMode === 'send' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveEmailTemplate}
                  disabled={savingPreset}
                  className="text-xs flex items-center gap-1.5"
                >
                  {savingPreset ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Mentés sablonként
                </Button>
              )}
              {editorMode === 'edit' ? (
                <Button
                  size="sm"
                  onClick={handleSaveEmailTemplate}
                  disabled={savingPreset}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 px-4 font-semibold text-xs"
                >
                  {savingPreset ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Sablon mentése
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={onSendEditedEmail}
                  disabled={emailSending || !emailTo}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 px-4 font-semibold text-xs"
                >
                  {emailSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  E-mail elküldése
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
