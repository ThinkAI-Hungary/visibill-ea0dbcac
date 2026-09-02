import React from 'react';
import { Globe, Key, Lock, BookOpen, Calendar, CalendarCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface GeneralSettingsTabProps {
  officeName: string;
  setOfficeName: (v: string) => void;
  officeEmail: string;
  setOfficeEmail: (v: string) => void;
  officePhone: string;
  setOfficePhone: (v: string) => void;
  officeAddress: string;
  setOfficeAddress: (v: string) => void;
  firmData: { name: string; taxNumber: string; address: string; firmId: string } | null | undefined;
  glDateBasis?: 'kibocsatas' | 'teljesites';
  setGlDateBasis?: (v: 'kibocsatas' | 'teljesites') => void;
}

export default function GeneralSettingsTab({
  officeName, setOfficeName,
  officeEmail, setOfficeEmail,
  officePhone, setOfficePhone,
  officeAddress, setOfficeAddress,
  firmData,
  glDateBasis = 'kibocsatas',
  setGlDateBasis,
}: GeneralSettingsTabProps) {
  return (
    <div key="general" className="p-6 space-y-6 tab-content-enter">
      <div className="border-b border-border pb-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Iroda adatok</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Könyvelő iroda alapadatai</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            Iroda neve
            {firmData?.name && <Lock className="h-3 w-3 text-muted-foreground" />}
          </label>
          <Input 
            value={firmData?.name || officeName} 
            onChange={e => setOfficeName(e.target.value)} 
            placeholder="Pl. Minta Könyvelőiroda"
            className={cn('bg-card border-border', firmData?.name && 'bg-muted/50 cursor-not-allowed')}
            disabled={!!firmData?.name}
            title={firmData?.name ? 'Az iroda neve a cégadatokból származik' : undefined}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">E-mail</label>
          <Input 
            value={officeEmail} 
            onChange={e => setOfficeEmail(e.target.value)} 
            placeholder="iroda@example.com"
            className="bg-card border-border"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Telefonszám</label>
          <Input 
            value={officePhone} 
            onChange={e => setOfficePhone(e.target.value)} 
            placeholder="+36 1 234 5678"
            className="bg-card border-border"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            Cím
            {firmData?.address && <Lock className="h-3 w-3 text-muted-foreground" />}
          </label>
          <Input 
            value={firmData?.address || officeAddress} 
            onChange={e => setOfficeAddress(e.target.value)} 
            placeholder="1234 Budapest, Példa utca 1."
            className={cn('bg-card border-border', firmData?.address && 'bg-muted/50 cursor-not-allowed')}
            disabled={!!firmData?.address}
          />
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">API kapcsolatok</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent dark:bg-accent flex items-center justify-center">
                <Globe className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">NAV Online Számla</p>
                <p className="text-xs text-slate-500">Automatikus számla szinkronizálás</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">Konfigurálandó</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                <Key className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Bank integráció</p>
                <p className="text-xs text-slate-500">Banki tranzakciók importálása</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">Konfigurálandó</span>
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-6 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            Főkönyvi & Könyvelési beállítások
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Határozd meg, hogy a főkönyvi kimutatások és egyenlegek alapértelmezetten melyik dátum alapján gyűjtsék az adatokat.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <label 
            onClick={() => setGlDateBasis?.('kibocsatas')}
            className={cn(
              "flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer",
              glDateBasis === 'kibocsatas'
                ? "border-primary bg-primary/5 dark:bg-primary/10 ring-1 ring-primary"
                : "border-border bg-card hover:bg-muted/50"
            )}
          >
            <input 
              type="radio" 
              name="gl_date_basis" 
              value="kibocsatas" 
              checked={glDateBasis === 'kibocsatas'} 
              onChange={() => setGlDateBasis?.('kibocsatas')}
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
            onClick={() => setGlDateBasis?.('teljesites')}
            className={cn(
              "flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer",
              glDateBasis === 'teljesites'
                ? "border-primary bg-primary/5 dark:bg-primary/10 ring-1 ring-primary"
                : "border-border bg-card hover:bg-muted/50"
            )}
          >
            <input 
              type="radio" 
              name="gl_date_basis" 
              value="teljesites" 
              checked={glDateBasis === 'teljesites'} 
              onChange={() => setGlDateBasis?.('teljesites')}
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
    </div>
  );
}
