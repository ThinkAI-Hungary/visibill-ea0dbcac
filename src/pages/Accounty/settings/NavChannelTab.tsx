import React from 'react';
import { Globe, Send, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface NavChannelTabProps {
  navApiKey: string;
  setNavApiKey: (v: string) => void;
  navTechnicalUser: string;
  setNavTechnicalUser: (v: string) => void;
  navSignatureKey: string;
  setNavSignatureKey: (v: string) => void;
  navEnvironment: string;
  setNavEnvironment: (v: string) => void;
  navAutoSubmit: boolean;
  setNavAutoSubmit: (v: boolean) => void;
  navAnykPath: string;
  setNavAnykPath: (v: string) => void;
}

export default function NavChannelTab({
  navApiKey, setNavApiKey,
  navTechnicalUser, setNavTechnicalUser,
  navSignatureKey, setNavSignatureKey,
  navEnvironment, setNavEnvironment,
  navAutoSubmit, setNavAutoSubmit,
  navAnykPath, setNavAnykPath,
}: NavChannelTabProps) {
  return (
    <div key="nav" className="p-6 space-y-6 tab-content-enter">
      <div className="border-b border-border pb-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">NAV csatorna beállítások</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Online Számla API, bevallás-beküldés és ÁNYK integráció</p>
      </div>

      <div>
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">NAV Online Számla API</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs text-slate-500">Technikai felhasználó</label>
            <Input value={navTechnicalUser} onChange={e => setNavTechnicalUser(e.target.value)} className="bg-card border-border font-mono" />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-slate-500">Környezet</label>
            <select value={navEnvironment} onChange={e => setNavEnvironment(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
              <option value="production"> Éles (production)</option>
              <option value="sandbox"> Teszt (sandbox)</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-slate-500">API kulcs</label>
            <Input type="password" value={navApiKey} onChange={e => setNavApiKey(e.target.value)} className="bg-card border-border font-mono" />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-slate-500">Aláíró kulcs (XML signature)</label>
            <Input type="password" value={navSignatureKey} onChange={e => setNavSignatureKey(e.target.value)} className="bg-card border-border font-mono" />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">Bevallás-beküldés mód</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                <Send className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">KR (Kormányzati API)</p>
                <p className="text-xs text-slate-500">Közvetlen NAV beküldés XML-ben</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700">Elsődleges</span>
          </div>
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                <Globe className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">ÁNYK (Általános Nyomtatványkitöltő)</p>
                <p className="text-xs text-slate-500">Offline kitöltő programmal — ABEV export</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-blue-700">Tartalék</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-slate-500">ÁNYK telepítési útvonal</label>
        <Input value={navAnykPath} onChange={e => setNavAnykPath(e.target.value)} className="bg-card border-border font-mono text-xs" />
        <p className="text-[10px] text-slate-400">Csak ÁNYK módú beküldésnél szükséges</p>
      </div>

      <label className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl cursor-pointer">
        <input type="checkbox" checked={navAutoSubmit} onChange={e => setNavAutoSubmit(e.target.checked)} className="w-4 h-4 rounded" />
        <div>
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Automatikus beküldés</p>
          <p className="text-xs text-slate-500">Lezárt bevallások automatikus beküldése a NAV felé (KR csatornán)</p>
        </div>
      </label>

      <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-lg p-3 text-sm text-yellow-800 dark:text-yellow-300">
        <AlertTriangle className="w-4 h-4 inline mr-1" />
        <strong>Figyelem:</strong> Az API kulcs és aláíró kulcs megváltoztatása azonnali hatással van az összes ügyfél bevallás-beküldésére.
      </div>
    </div>
  );
}
