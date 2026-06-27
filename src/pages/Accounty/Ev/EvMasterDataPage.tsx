import React, { useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Database, ArrowLeft, ChevronRight, Save, Edit3,
  Building2, User, MapPin, Phone, Mail, Globe,
  FileText, Shield, Briefcase, Tag, Clock, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccountyClient } from '@/hooks/accounty';
import { useEvClientSettings } from '@/hooks/useEvData';

// ─── Component ──────────────────────────────────────────────────────────────

function DataField({ label, value, icon: Icon, mono }: {
  label: string;
  value: string;
  icon?: any;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </label>
      <p className={cn(
        'text-sm text-slate-900 dark:text-slate-100 font-medium',
        mono && 'font-mono tabular-nums'
      )}>
        {value || '—'}
      </p>
    </div>
  );
}

export default function EvMasterDataPage() {
  const { id } = useParams<{ id: string }>();
  const { data: client } = useAccountyClient(id);
  const [isEditing, setIsEditing] = useState(false);

  // ─── Real data from Supabase ───────────────────────────────────────────────
  const { data: settings, isLoading } = useEvClientSettings(id, 2026);

  // Build display data from client + EV settings
  const masterData = useMemo(() => {
    const s = settings;
    const c = client;
    return {
      registrationNumber: s?.registration_number || '',
      taxNumber: c?.tax_number || '',
      taxId: '',
      navTechUser: '',
      name: c?.name || '',
      birthName: '',
      birthDate: '',
      motherName: '',
      nationality: '',
      idCardNumber: '',
      headquarters: c?.address || '',
      mailingAddress: c?.address || '',
      phone: c?.phone || '',
      email: c?.email || '',
      website: '',
      mainActivityCode: s?.main_activity_code || '',
      mainActivityName: '',
      startDate: '',
      chamberMembership: '',
      chamberNumber: '',
      activityCodes: s?.activity_codes || [],
      skilledMainActivity: s?.skilled_main_activity || false,
      taxpayerForm: s?.taxpayer_form || '',
      employmentStatus: s?.employment_status || '',
      vatStatus: s?.vat_status || '',
    };
  }, [settings, client]);

  const sections = [
    {
      title: 'NAV azonosítók',
      icon: Shield,
      color: 'from-indigo-500 to-purple-600',
      fields: [
        { label: 'Nyilvántartási szám', value: masterData.registrationNumber, icon: FileText, mono: true },
        { label: 'Adószám', value: masterData.taxNumber, icon: Shield, mono: true },
        { label: 'Adóazonosító jel', value: masterData.taxId, icon: Tag, mono: true },
        { label: 'NAV tech. felhasználó', value: masterData.navTechUser, icon: Globe, mono: true },
      ],
    },
    {
      title: 'Személyes adatok',
      icon: User,
      color: 'from-violet-500 to-fuchsia-600',
      fields: [
        { label: 'Vállalkozó neve', value: masterData.name, icon: User },
        { label: 'Születési név', value: masterData.birthName },
        { label: 'Születési dátum', value: masterData.birthDate ? new Date(masterData.birthDate).toLocaleDateString('hu-HU') : '', icon: Clock },
        { label: 'Anyja neve', value: masterData.motherName },
        { label: 'Állampolgárság', value: masterData.nationality },
        { label: 'Személyi ig. szám', value: masterData.idCardNumber, mono: true },
      ],
    },
    {
      title: 'Elérhetőség',
      icon: MapPin,
      color: 'from-teal-500 to-cyan-600',
      fields: [
        { label: 'Székhely', value: masterData.headquarters, icon: MapPin },
        { label: 'Levelezési cím', value: masterData.mailingAddress },
        { label: 'Telefon', value: masterData.phone, icon: Phone, mono: true },
        { label: 'E-mail', value: masterData.email, icon: Mail },
        { label: 'Honlap', value: masterData.website, icon: Globe },
      ],
    },
    {
      title: 'Tevékenységi adatok',
      icon: Briefcase,
      color: 'from-rose-500 to-pink-600',
      fields: [
        { label: 'Fő tevékenység (TEÁOR)', value: masterData.mainActivityCode ? `${masterData.mainActivityCode}${masterData.mainActivityName ? ` – ${masterData.mainActivityName}` : ''}` : '', icon: Tag },
        { label: 'Tevékenység kezdete', value: masterData.startDate ? new Date(masterData.startDate).toLocaleDateString('hu-HU') : '', icon: Clock },
        { label: 'Kamarai tagság', value: masterData.chamberMembership, icon: Building2 },
        { label: 'Kamarai szám', value: masterData.chamberNumber, mono: true },
      ],
    },
  ];

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/accounty/ev" className="hover:text-indigo-600 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> EV Portfólió
        </Link>
        <ChevronRight className="w-3 h-3" />
        <Link to={`/accounty/client/${id}/ev`} className="hover:text-indigo-600 transition-colors">
          {client?.name || 'Ügyfél'}
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-900 dark:text-slate-100 font-medium">Törzsadatok</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/25">
            <Database className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Törzsadatok</h1>
            <p className="text-sm text-slate-500">{client?.name || 'Ügyfél'} – NAV azonosítók, személyes és tevékenységi adatok</p>
          </div>
        </div>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
            isEditing
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          )}
        >
          {isEditing ? (
            <><Save className="w-3.5 h-3.5" /> Mentés</>
          ) : (
            <><Edit3 className="w-3.5 h-3.5" /> Szerkesztés</>
          )}
        </button>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        </div>
      ) : (
        <>
          {/* Data sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {sections.map(section => (
              <div key={section.title} className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
                <div className="px-5 py-3 border-b border-border/50 flex items-center gap-3">
                  <div className={cn('p-1.5 rounded-lg bg-gradient-to-br shadow-md', section.color)}>
                    <section.icon className="w-4 h-4 text-white" />
                  </div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{section.title}</h2>
                </div>
                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {section.fields.map(field => (
                    <DataField key={field.label} {...field} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Secondary activities */}
          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <div className="px-5 py-3 border-b border-border/50 flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 shadow-md">
                <Tag className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Tevékenységi kódok (TEÁOR)</h2>
            </div>
            <div className="divide-y divide-border">
              {masterData.activityCodes.length === 0 ? (
                <div className="px-5 py-6 text-center text-sm text-slate-400">
                  Nincs rögzített tevékenységi kód
                </div>
              ) : (
                masterData.activityCodes.map(code => (
                  <div key={code} className="px-5 py-3 flex items-center gap-3">
                    <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded">{code}</span>
                    {code === masterData.mainActivityCode && (
                      <span className="text-[10px] font-medium text-green-600 bg-green-50 dark:bg-green-900/30 px-1.5 py-0.5 rounded">Fő tevékenység</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
