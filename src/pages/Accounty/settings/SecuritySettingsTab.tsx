import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Key, Clock, Shield, ChevronDown, CheckCircle2, Circle, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface SecuritySettingsTabProps {
  sessionTimeout: number;
  setSessionTimeout: (v: number) => void;
}

export default function SecuritySettingsTab({
  sessionTimeout, setSessionTimeout,
}: SecuritySettingsTabProps) {
  const { toast } = useToast();

  // Password change state (local to this tab)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // GDPR state
  const [gdprExpanded, setGdprExpanded] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Auto-detect GDPR compliance
  const gdprChecks = useMemo(() => {
    const cookieConsentGiven = (() => {
      try {
        const raw = localStorage.getItem('accounty_cookie_consent');
        return raw ? JSON.parse(raw).version === '1.0' : false;
      } catch { return false; }
    })();

    const privacyPolicyAccepted = (() => {
      try {
        const raw = localStorage.getItem('accounty_privacy_consent');
        return raw ? JSON.parse(raw).version === '1.0' : false;
      } catch { return false; }
    })();

    return {
      privacyPolicy: privacyPolicyAccepted,
      cookieConsent: cookieConsentGiven,
      auditLog: true,
      dataRetention: true,
      gdprRequests: true,
      dataExport: true,
    };
  }, []);

  const gdprItems = [
    { key: 'privacyPolicy' as const, label: 'Adatkezelési tájékoztató', desc: 'Elfogadott adatkezelési nyilatkozat elérhető a felhasználók számára', autoDesc: 'A tájékoztató el lett fogadva', missingDesc: 'Nyissa meg és fogadja el az adatkezelési tájékoztatót', actionPath: '/accounty/privacy-policy' },
    { key: 'cookieConsent' as const, label: 'Cookie hozzájárulás', desc: 'Süti-kezelési banner konfigurálva belépéskor', autoDesc: 'Cookie hozzájárulás rögzítve', missingDesc: 'A süti banner megjelenik újratöltéskor — fogadja el' },
    { key: 'auditLog' as const, label: 'Hozzáférési napló', desc: 'Felhasználói műveletek naplózása aktív', autoDesc: 'Az audit napló aktív (accounty_audit_log)' },
    { key: 'dataRetention' as const, label: 'Adatmegőrzési szabályzat', desc: 'Meghatározott megőrzési idők és automatikus törlés', autoDesc: '8 év számviteli / 5 év bérszámfejtési / 1 év napló' },
    { key: 'gdprRequests' as const, label: 'Törlési kérelmek kezelése', desc: 'GDPR "elfeledtetéshez való jog" folyamat működik', autoDesc: 'GDPR kérelmek az Admin → GDPR oldalon kezelhetők' },
    { key: 'dataExport' as const, label: 'Adathordozhatóság', desc: 'Felhasználói adatok exportálása JSON formátumban', autoDesc: 'GDPR adatexport elérhető az alábbi gombbal' },
  ];
  const gdprCompleted = Object.values(gdprChecks).filter(Boolean).length;
  const gdprTotal = Object.values(gdprChecks).length;
  const gdprCompliant = gdprCompleted === gdprTotal;

  return (
    <>
      <div key="security" className="p-6 space-y-6 tab-content-enter">
        <div className="border-b border-border pb-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Biztonság</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Jelszó, munkamenet és adatvédelem</p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                <Key className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Jelszó módosítás</p>
                <p className="text-xs text-slate-500">Utolsó módosítás: ismeretlen</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setPasswordDialogOpen(true)}>Módosítás</Button>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Munkamenet időtúllépés</p>
                <p className="text-xs text-slate-500">Inaktivitás után automatikus kijelentkezés</p>
              </div>
            </div>
            <select
              value={sessionTimeout}
              onChange={e => setSessionTimeout(Number(e.target.value))}
              className="text-sm font-medium bg-card border border-border rounded-lg px-3 py-1.5 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value={5}>5 perc</option>
              <option value={15}>15 perc</option>
              <option value={30}>30 perc</option>
              <option value={60}>60 perc</option>
            </select>
          </div>

          <div className="rounded-xl overflow-hidden border border-border">
            <button
              onClick={() => setGdprExpanded(!gdprExpanded)}
              className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 w-full text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', gdprCompliant ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-amber-100 dark:bg-amber-900/40')}>
                  <Shield className={cn('w-4 h-4', gdprCompliant ? 'text-emerald-600' : 'text-amber-600')} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">GDPR megfelelőség</p>
                  <p className="text-xs text-slate-500">{gdprCompleted}/{gdprTotal} követelmény teljesítve</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  'px-2.5 py-1 rounded-full text-[10px] font-bold uppercase',
                  gdprCompliant
                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                    : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                )}>
                  {gdprCompliant ? 'Megfelelő' : 'Ellenőrizendő'}
                </span>
                <ChevronDown className={cn('w-4 h-4 text-slate-400 transition-transform', gdprExpanded && 'rotate-180')} />
              </div>
            </button>

            {/* Progress bar */}
            <div className="h-1 bg-slate-200 dark:bg-slate-700">
              <div
                className={cn('h-full transition-all duration-500', gdprCompliant ? 'bg-emerald-500' : 'bg-amber-500')}
                style={{ width: `${(gdprCompleted / gdprTotal) * 100}%` }}
              />
            </div>

            {/* Expandable checklist */}
            <div className={cn(
              'overflow-hidden transition-all duration-300',
              gdprExpanded ? 'max-h-[600px]' : 'max-h-0'
            )}>
              <div className="p-4 space-y-2 dark:bg-slate-900/30">
                {gdprItems.map(item => {
                  const checked = gdprChecks[item.key];
                  return (
                    <div
                      key={item.key}
                      className={cn(
                        'flex items-start gap-3 w-full text-left p-3 rounded-lg transition-all',
                        checked
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-white dark:bg-slate-800/50 border border-amber-200 dark:border-amber-800'
                      )}
                    >
                      {checked ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className={cn('text-sm font-medium', checked ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100')}>
                          {item.label}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {checked ? (item.autoDesc || item.desc) : (item.missingDesc || item.desc)}
                        </p>
                        {!checked && item.actionPath && (
                          <Link
                            to={item.actionPath}
                            className="text-xs text-primary hover:text-primary/80 font-medium mt-1 inline-block"
                          >
                            Megnyitás →
                          </Link>
                        )}
                      </div>
                      {checked && (
                        <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded shrink-0">AUTO</span>
                      )}
                    </div>
                  );
                })}

                {/* Data export button */}
                <div className="pt-3 border-t border-border mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2 text-xs"
                    disabled={exporting}
                    onClick={async () => {
                      setExporting(true);
                      try {
                        const { exportAllDataAsJson, downloadBlob } = await import('@/lib/gdprExport');
                        const result = await exportAllDataAsJson();
                        downloadBlob(result);
                        toast({ title: 'GDPR Export', description: `${result.recordCount} rekord exportálva: ${result.filename}` });
                      } catch (err: any) {
                        toast({ variant: 'destructive', title: 'Export hiba', description: err.message });
                      } finally {
                        setExporting(false);
                      }
                    }}
                  >
                    {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {exporting ? 'Exportálás...' : 'GDPR adatexport letöltése (JSON)'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Password Change Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={(open) => { setPasswordDialogOpen(open); if (!open) { setNewPassword(''); setConfirmPassword(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Jelszó módosítás</DialogTitle>
            <DialogDescription>Adja meg az új jelszavát. Minimum 6 karakter.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Új jelszó</label>
              <Input
                type="password"
                placeholder="Minimum 6 karakter"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Jelszó megerősítése</label>
              <Input
                type="password"
                placeholder="Jelszó újra"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-500">A két jelszó nem egyezik</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>Mégse</Button>
            <Button
              disabled={changingPassword || newPassword.length < 6 || newPassword !== confirmPassword}
              onClick={async () => {
                setChangingPassword(true);
                try {
                  const { error } = await supabase.auth.updateUser({ password: newPassword });
                  if (error) throw error;
                  toast({ title: 'Jelszó módosítva', description: 'Az új jelszó sikeresen beállítva.' });
                  setPasswordDialogOpen(false);
                  setNewPassword('');
                  setConfirmPassword('');
                } catch (err: any) {
                  toast({ variant: 'destructive', title: 'Hiba', description: err.message || 'Nem sikerült a jelszó módosítása.' });
                } finally {
                  setChangingPassword(false);
                }
              }}
            >
              {changingPassword ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Jelszó módosítása
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
