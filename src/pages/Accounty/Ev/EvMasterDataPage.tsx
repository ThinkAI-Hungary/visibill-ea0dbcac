import React, { useState, useMemo, useCallback } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  Database, ArrowLeft, ChevronRight, Save, Edit3, X,
  Building2, User, MapPin, Phone, Mail, Globe,
  FileText, Shield, Briefcase, Tag, Clock, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { useAccountyClient } from '@/hooks/accounty';
import { useEvClientSettings, useUpdateEvSettings } from '@/hooks/useEvData';
import { toast } from '@/hooks/use-toast';

// ─── Editable data field ────────────────────────────────────────────────────

function DataField({ label, value, icon: Icon, mono, isEditing, onChange }: {
  label: string;
  value: string;
  icon?: any;
  mono?: boolean;
  isEditing?: boolean;
  onChange?: (val: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </label>
      {isEditing && onChange ? (
        <Input
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          className={cn('text-sm h-8 bg-card', mono && 'font-mono')}
          placeholder={label}
        />
      ) : (
        <p className={cn(
          'text-sm text-slate-900 dark:text-slate-100 font-medium',
          mono && 'font-mono tabular-nums'
        )}>
          {value || '—'}
        </p>
      )}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function EvMasterDataPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const taxYear = Number(searchParams.get('year') || '2026');
  const { data: client } = useAccountyClient(id);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // ─── Real data from Supabase ───────────────────────────────────────────────
  const { data: settings, isLoading } = useEvClientSettings(id, taxYear);
  const updateSettings = useUpdateEvSettings();

  // ─── Edit form state ───────────────────────────────────────────────────────
  const [editForm, setEditForm] = useState<Record<string, string>>({});

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
      headquarters: '',
      mailingAddress: '',
      phone: '',
      email: '',
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

  const startEditing = useCallback(() => {
    setEditForm({
      registrationNumber: masterData.registrationNumber,
      taxId: masterData.taxId,
      navTechUser: masterData.navTechUser,
      birthName: masterData.birthName,
      birthDate: masterData.birthDate,
      motherName: masterData.motherName,
      nationality: masterData.nationality,
      idCardNumber: masterData.idCardNumber,
      headquarters: masterData.headquarters,
      mailingAddress: masterData.mailingAddress,
      phone: masterData.phone,
      email: masterData.email,
      website: masterData.website,
      mainActivityCode: masterData.mainActivityCode,
      mainActivityName: masterData.mainActivityName,
      startDate: masterData.startDate,
      chamberMembership: masterData.chamberMembership,
      chamberNumber: masterData.chamberNumber,
    });
    setIsEditing(true);
  }, [masterData]);

  const cancelEditing = () => {
    setIsEditing(false);
    setEditForm({});
  };

  const handleSave = async () => {
    if (!id || !settings) return;
    setSaving(true);
    try {
      await updateSettings.mutateAsync({
        company_id: id,
        tax_year: settings.tax_year,
        registration_number: editForm.registrationNumber || null,
        main_activity_code: editForm.mainActivityCode || null,
      });
      toast({ title: 'Törzsadatok mentve', description: 'A módosítások sikeresen elmentésre kerültek.' });
      setIsEditing(false);
      setEditForm({});
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hiba történt', description: err.message || 'Nem sikerült menteni.' });
    } finally {
      setSaving(false);
    }
  };

  const upd = (key: string) => (val: string) => setEditForm(f => ({ ...f, [key]: val }));
  const getVal = (key: string, fallback: string) => isEditing ? (editForm[key] ?? fallback) : fallback;

  const sections = [
    {
      title: 'NAV azonosítók',
      icon: Shield,
      color: 'from-indigo-500 to-purple-600',
      fields: [
        { label: 'Nyilvántartási szám', key: 'registrationNumber', value: masterData.registrationNumber, icon: FileText, mono: true, editable: true },
        { label: 'Adószám', key: 'taxNumber', value: masterData.taxNumber, icon: Shield, mono: true, editable: false },
        { label: 'Adóazonosító jel', key: 'taxId', value: masterData.taxId, icon: Tag, mono: true, editable: true },
        { label: 'NAV tech. felhasználó', key: 'navTechUser', value: masterData.navTechUser, icon: Globe, mono: true, editable: true },
      ],
    },
    {
      title: 'Személyes adatok',
      icon: User,
      color: 'from-violet-500 to-fuchsia-600',
      fields: [
        { label: 'Vállalkozó neve', key: 'name', value: masterData.name, icon: User, editable: false },
        { label: 'Születési név', key: 'birthName', value: masterData.birthName, editable: true },
        { label: 'Születési dátum', key: 'birthDate', value: masterData.birthDate ? new Date(masterData.birthDate).toLocaleDateString('hu-HU') : '', icon: Clock, editable: true },
        { label: 'Anyja neve', key: 'motherName', value: masterData.motherName, editable: true },
        { label: 'Állampolgárság', key: 'nationality', value: masterData.nationality, editable: true },
        { label: 'Személyi ig. szám', key: 'idCardNumber', value: masterData.idCardNumber, mono: true, editable: true },
      ],
    },
    {
      title: 'Elérhetőség',
      icon: MapPin,
      color: 'from-teal-500 to-cyan-600',
      fields: [
        { label: 'Székhely', key: 'headquarters', value: masterData.headquarters, icon: MapPin, editable: true },
        { label: 'Levelezési cím', key: 'mailingAddress', value: masterData.mailingAddress, editable: true },
        { label: 'Telefon', key: 'phone', value: masterData.phone, icon: Phone, mono: true, editable: true },
        { label: 'E-mail', key: 'email', value: masterData.email, icon: Mail, editable: true },
        { label: 'Honlap', key: 'website', value: masterData.website, icon: Globe, editable: true },
      ],
    },
    {
      title: 'Tevékenységi adatok',
      icon: Briefcase,
      color: 'from-rose-500 to-pink-600',
      fields: [
        { label: 'Fő tevékenység (TEÁOR)', key: 'mainActivityCode', value: masterData.mainActivityCode ? `${masterData.mainActivityCode}${masterData.mainActivityName ? ` – ${masterData.mainActivityName}` : ''}` : '', icon: Tag, editable: true },
        { label: 'Tevékenység kezdete', key: 'startDate', value: masterData.startDate ? new Date(masterData.startDate).toLocaleDateString('hu-HU') : '', icon: Clock, editable: true },
        { label: 'Kamarai tagság', key: 'chamberMembership', value: masterData.chamberMembership, icon: Building2, editable: true },
        { label: 'Kamarai szám', key: 'chamberNumber', value: masterData.chamberNumber, mono: true, editable: true },
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
        <Link to={`/accounty/client/${id}/ev?year=${taxYear}`} className="hover:text-indigo-600 transition-colors">
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
        {isEditing ? (
          <div className="flex items-center gap-2">
            <button
              onClick={cancelEditing}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Mégse
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Mentés
            </button>
          </div>
        ) : (
          <button
            onClick={startEditing}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" /> Szerkesztés
          </button>
        )}
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
                    <DataField
                      key={field.label}
                      label={field.label}
                      value={isEditing && field.editable ? (editForm[field.key] ?? field.value) : field.value}
                      icon={field.icon}
                      mono={field.mono}
                      isEditing={isEditing && field.editable}
                      onChange={field.editable ? upd(field.key) : undefined}
                    />
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
