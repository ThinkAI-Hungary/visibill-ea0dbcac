import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Landmark, Save, Building2, Globe, Users, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAccountyClients } from '@/hooks/useAccountyData';

const KKV_OPTIONS = [
  { value: 'micro', label: 'Mikrovállalkozás' },
  { value: 'small', label: 'Kisvállalkozás' },
  { value: 'medium', label: 'Középvállalkozás' },
  { value: 'large', label: 'Nagyvállalkozás' },
];

const TAX_REGIMES = [
  { value: 'general_6', label: 'Általános 6.§ (AEE ± korrekciók)' },
  { value: 'nonprofit_a', label: 'Nonprofit (A) csoport — vállalkozási AEE' },
  { value: 'nonprofit_b', label: 'Nonprofit (B) csoport — kedvezményezett tevékenység arány' },
  { value: 'foreign', label: 'Külföldi vállalkozó — telephely jövedelem' },
  { value: 'property', label: 'Ingatlannal rendelkező társaság' },
  { value: 'managed', label: 'Kezelt vagyon' },
];

export default function TaoMasterDataPage() {
  const { id } = useParams<{ id: string }>();
  const { data: clients = [] } = useAccountyClients();
  const client = clients.find((c: any) => c.companyId === id);

  const [formData, setFormData] = useState({
    companyName: client?.name || '',
    taxNumber: client?.taxNumber || '12345678-2-41',
    registrationNumber: '01-09-123456',
    gfoCode: '113',
    taxpayerType: 'kft',
    taxRegime: 'general_6',
    kkvCategory: 'small',
    taxSubjectStart: '2020-01-01',
    businessYearType: 'calendar',
    accountingRegime: 'szt',
    groupMember: false,
    groupId: '',
    groupRepresentative: '',
    votingShare: '',
    pillarTwo: false,
    consolidatedRevenue: '',
    ultimateParent: '',
  });

  const update = (key: string, value: any) =>
    setFormData(prev => ({ ...prev, [key]: value }));

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={`/accounty/client/${id}/tao`} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft className="w-4 h-4 text-slate-400" />
        </Link>
        <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/25">
          <Building2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">TAO Törzsadatok</h1>
          <p className="text-sm text-slate-500">{client?.name || 'Ügyfél'}</p>
        </div>
      </div>

      {/* Alapadatok */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-soft space-y-5">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Landmark className="w-4 h-4 text-emerald-600" />
          Alapadatok
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Cégnév</label>
            <Input value={formData.companyName} onChange={e => update('companyName', e.target.value)} className="bg-background" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Adószám (xx-x-yy)</label>
            <Input value={formData.taxNumber} onChange={e => update('taxNumber', e.target.value)} className="bg-background font-mono" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Cégjegyzékszám</label>
            <Input value={formData.registrationNumber} onChange={e => update('registrationNumber', e.target.value)} className="bg-background font-mono" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">GFO-kód</label>
            <Input value={formData.gfoCode} onChange={e => update('gfoCode', e.target.value)} className="bg-background font-mono" placeholder="pl. 113" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Adóalap-rezsim</label>
            <select
              value={formData.taxRegime}
              onChange={e => update('taxRegime', e.target.value)}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground"
            >
              {TAX_REGIMES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">KKV-besorolás</label>
            <select
              value={formData.kkvCategory}
              onChange={e => update('kkvCategory', e.target.value)}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground"
            >
              {KKV_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Adóalanyiság kezdete</label>
            <Input type="date" value={formData.taxSubjectStart} onChange={e => update('taxSubjectStart', e.target.value)} className="bg-background" />
          </div>
        </div>
      </div>

      {/* Csoporttagság */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-soft space-y-5">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-600" />
          Csoporttagság
        </h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.groupMember}
              onChange={e => update('groupMember', e.target.checked)}
              className="rounded border-border"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">Csoportos TAO-alany tagja (2/A.§)</span>
          </label>
        </div>
        {formData.groupMember && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Csoport-azonosító</label>
              <Input value={formData.groupId} onChange={e => update('groupId', e.target.value)} className="bg-background" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Képviselő</label>
              <Input value={formData.groupRepresentative} onChange={e => update('groupRepresentative', e.target.value)} className="bg-background" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Szavazati arány (≥75%)</label>
              <Input value={formData.votingShare} onChange={e => update('votingShare', e.target.value)} className="bg-background" placeholder="pl. 85%" />
            </div>
          </div>
        )}
      </div>

      {/* Pillar Two */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-soft space-y-5">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Globe className="w-4 h-4 text-amber-600" />
          Pillar Two (Globális minimumadó)
        </h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.pillarTwo}
              onChange={e => update('pillarTwo', e.target.checked)}
              className="rounded border-border"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">Multinacionális csoport-tag (750 M EUR küszöb)</span>
          </label>
        </div>
        {formData.pillarTwo && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Konszolidált bevétel (4 év)</label>
              <Input value={formData.consolidatedRevenue} onChange={e => update('consolidatedRevenue', e.target.value)} className="bg-background" placeholder="EUR" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Végső anyavállalat</label>
              <Input value={formData.ultimateParent} onChange={e => update('ultimateParent', e.target.value)} className="bg-background" />
            </div>
          </div>
        )}
        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Ha a konszolidált bevétel eléri a 750 millió EUR-t legalább 2 évben, QDMTT-kötelezettség keletkezik (2023. évi LXXXIV. tv.)
          </p>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end gap-3">
        <Button variant="outline">Mégse</Button>
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Save className="w-4 h-4 mr-2" />
          Mentés
        </Button>
      </div>
    </div>
  );
}
