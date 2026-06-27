import React from 'react';
import { Globe, Key, Lock } from 'lucide-react';
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
}

export default function GeneralSettingsTab({
  officeName, setOfficeName,
  officeEmail, setOfficeEmail,
  officePhone, setOfficePhone,
  officeAddress, setOfficeAddress,
  firmData,
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
    </div>
  );
}
