import React, { useState, useMemo } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Save, Calculator, Info, CheckCircle, AlertTriangle,
  Star, Baby, Cake, CircleDot, Heart, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAddDeclaration } from '@/hooks/usePayrollData';

type DeclType = 'netak' | 'mothers' | 'young' | 'first-marriage' | 'personal';

const CONFIGS: Record<DeclType, {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  infoText: string;
  monthlyBase: number;
  monthlySaving: number;
  fields: { key: string; label: string; type: 'text' | 'date' | 'number' | 'select'; placeholder?: string; options?: string[]; required?: boolean }[];
  validations: string[];
}> = {
  netak: {
    title: 'NÉTAK — 4+ gyermekes anyák kedvezménye',
    subtitle: 'Szja tv. 29/D. § — Teljes SZJA mentesség',
    icon: Star,
    color: 'from-amber-500 to-orange-500',
    infoText: 'A négy vagy több gyermeket nevelő anyák teljes személyi jövedelemadó alóli mentesülést kapnak, korlát nélkül. A kedvezmény a jogosultság teljes időszakára érvényes.',
    monthlyBase: 0,
    monthlySaving: 0,
    fields: [
      { key: 'name', label: 'Anya neve', type: 'text', placeholder: 'Kovács Éva', required: true },
      { key: 'taxId', label: 'Adóazonosító jel', type: 'text', placeholder: '1234567890', required: true },
      { key: 'childCount', label: 'Gyermekek száma', type: 'number', placeholder: '4', required: true },
      { key: 'startDate', label: 'Kedvezmény kezdete', type: 'date', required: true },
    ],
    validations: ['Minimum 4 eltartott gyermek szükséges', 'Az anya biológiai vagy örökbefogadó szülő', 'A kedvezmény a 2. gyermek megszületésétől naptári napra arányosítva jár visszamenőleg'],
  },
  mothers: {
    title: '30 év alatti anyák kedvezménye',
    subtitle: 'Szja tv. 29/F. § — SZJA csökkentés 30 éves korig',
    icon: Baby,
    color: 'from-pink-500 to-rose-500',
    infoText: 'A 30 éven aluli, legalább 1 gyermeket nevelő anyák SZJA kedvezményt kapnak a bruttó átlagkereseti összegig (havi max. 715 765 Ft adóalap, azaz 107 650 Ft megtakarítás/hó).',
    monthlyBase: 715765,
    monthlySaving: 107650,
    fields: [
      { key: 'name', label: 'Anya neve', type: 'text', placeholder: 'Nagy Éva', required: true },
      { key: 'taxId', label: 'Adóazonosító jel', type: 'text', placeholder: '1234567890', required: true },
      { key: 'birthDate', label: 'Anya születési dátuma', type: 'date', required: true },
      { key: 'childCount', label: 'Gyermekek száma', type: 'number', placeholder: '1', required: true },
      { key: 'startDate', label: 'Kedvezmény kezdete', type: 'date', required: true },
    ],
    validations: ['Az anya még nem töltötte be a 30. életévét', 'Legalább 1 eltartott gyermek szükséges', 'A kedvezmény a 30. születésnapig jár'],
  },
  young: {
    title: '25 év alattiak kedvezménye',
    subtitle: 'Szja tv. 29/F. § — SZJA mentesség 25 éves korig',
    icon: Cake,
    color: 'from-green-500 to-emerald-500',
    infoText: '25 év alatti fiatalok jövedelme a bruttó átlagkereseti összegig (2026: havi max. 715 765 Ft) SZJA mentes. A kedvezmény a 25. születésnapig jár.',
    monthlyBase: 715765,
    monthlySaving: 107650,
    fields: [
      { key: 'name', label: 'Munkavállaló neve', type: 'text', placeholder: 'Tóth Gergő', required: true },
      { key: 'taxId', label: 'Adóazonosító jel', type: 'text', placeholder: '1234567890', required: true },
      { key: 'birthDate', label: 'Születési dátum', type: 'date', required: true },
      { key: 'startDate', label: 'Kedvezmény kezdete', type: 'date', required: true },
    ],
    validations: ['A munkavállaló még nem töltötte be a 25. életévét', 'A kedvezmény automatikusan megszűnik a 25. születésnapon'],
  },
  'first-marriage': {
    title: 'Első házasok kedvezménye',
    subtitle: 'Szja tv. 29/C. § — 24 hónapon át jár',
    icon: CircleDot,
    color: 'from-violet-500 to-purple-500',
    infoText: 'Az első házasságkötéstől számított 24 hónapig havi 33 335 Ft adóalap-csökkentés jár (5 000 Ft SZJA megtakarítás/hó). A házasfelek közül bármelyik érvényesítheti.',
    monthlyBase: 33335,
    monthlySaving: 5000,
    fields: [
      { key: 'name', label: 'Nyilatkozó neve', type: 'text', placeholder: 'Kiss Béla', required: true },
      { key: 'taxId', label: 'Adóazonosító jel', type: 'text', placeholder: '1234567890', required: true },
      { key: 'spouseName', label: 'Házastárs neve', type: 'text', placeholder: 'Kiss Kata', required: true },
      { key: 'spouseTaxId', label: 'Házastárs adóazonosítója', type: 'text', placeholder: '0987654321' },
      { key: 'marriageDate', label: 'Házasságkötés dátuma', type: 'date', required: true },
      { key: 'startDate', label: 'Kedvezmény kezdete', type: 'date', required: true },
    ],
    validations: ['Mindkét félnek az első házassága kell legyen', 'A kedvezmény 24 hónapig jár a kötés dátumától', 'Családi kedvezménnyel együtt is érvényesíthető'],
  },
  personal: {
    title: 'Személyi kedvezmény',
    subtitle: 'Szja tv. 29/E. § — Fogyatékosság / súlyos betegség',
    icon: Heart,
    color: 'from-red-500 to-pink-500',
    infoText: 'Súlyos fogyatékossággal élő személyeknek havi 107 600 Ft adóalap-csökkentés jár (16 140 Ft megtakarítás/hó). A kedvezmény érvényesítéséhez orvosi igazolás vagy komplex minősítés szükséges.',
    monthlyBase: 107600,
    monthlySaving: 16140,
    fields: [
      { key: 'name', label: 'Munkavállaló neve', type: 'text', placeholder: 'Szabó Péter', required: true },
      { key: 'taxId', label: 'Adóazonosító jel', type: 'text', placeholder: '1234567890', required: true },
      { key: 'certType', label: 'Igazolás típusa', type: 'select', options: ['Komplex minősítés (B1/C1/D1/E)', 'Orvos szakvélemény', 'NRSZH határozat'], required: true },
      { key: 'certNumber', label: 'Igazolás száma / határozat szám', type: 'text', placeholder: 'NRSZH-2024-12345' },
      { key: 'certValidUntil', label: 'Igazolás érvényes', type: 'date' },
      { key: 'startDate', label: 'Kedvezmény kezdete', type: 'date', required: true },
    ],
    validations: ['Érvényes orvosi igazolás vagy komplex minősítés szükséges', 'A kedvezmény határozatlan idejű, ha a komplex minősítés azt tartalmazza', 'Nem családi kedvezmény — önálló csökkentő tétel'],
  },
};

export default function GenericDeclarationPage() {
  const { id, type } = useParams<{ id: string; type: string }>();
  const [searchParams] = useSearchParams();
  const declType = type as DeclType;
  const config = CONFIGS[declType];

  const [formData, setFormData] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const empId = searchParams.get('empId');
  const addDeclaration = useAddDeclaration();

  // Calculate end date for first marriage (must be before any early return for Rules of Hooks)
  const endDate = useMemo(() => {
    if (declType === 'first-marriage' && formData.marriageDate) {
      const d = new Date(formData.marriageDate);
      d.setMonth(d.getMonth() + 24);
      return d.toISOString().split('T')[0];
    }
    if ((declType === 'young' || declType === 'mothers') && formData.birthDate) {
      const d = new Date(formData.birthDate);
      d.setFullYear(d.getFullYear() + (declType === 'young' ? 25 : 30));
      return d.toISOString().split('T')[0];
    }
    return null;
  }, [declType, formData.marriageDate, formData.birthDate]);

  if (!config) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">Ismeretlen nyilatkozat típus: {type}</p>
        <Button asChild className="mt-4"><Link to={`/eaisybooks/payroll/${id}/declarations`}>Vissza</Link></Button>
      </div>
    );
  }

  const updateField = (key: string, value: string) => setFormData(prev => ({ ...prev, [key]: value }));
  const handleSave = async () => {
    if (!empId) return;
    try {
      await addDeclaration.mutateAsync({
        employee_id: empId,
        declaration_type: declType,
        valid_from: formData.startDate || new Date().toISOString().split('T')[0],
        valid_until: endDate || undefined,
        parameters: { ...formData, monthlyBase: config.monthlyBase, monthlySaving: config.monthlySaving },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch { /* error handled by mutation */ }
  };

  const isComplete = config.fields.filter(f => f.required).every(f => formData[f.key]?.trim());

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={`/eaisybooks/payroll/${id}/declarations`} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className={cn('p-2.5 bg-gradient-to-br rounded-xl shadow-lg', config.color)}>
          <config.icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{config.title}</h1>
          <p className="text-sm text-slate-500">{config.subtitle}</p>
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4 text-sm text-blue-800 dark:text-blue-300 flex items-start gap-2">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <span>{config.infoText}</span>
      </div>

      {/* Form fields */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Nyilatkozat adatai</h2>
        <div className="grid grid-cols-2 gap-4">
          {config.fields.map(f => (
            <div key={f.key}>
              <label className="text-xs text-slate-500 mb-1 block">
                {f.label} {f.required && <span className="text-red-500">*</span>}
              </label>
              {f.type === 'select' ? (
                <select
                  value={formData[f.key] || ''}
                  onChange={e => updateField(f.key, e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Válasszon...</option>
                  {f.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : (
                <input
                  type={f.type}
                  value={formData[f.key] || ''}
                  onChange={e => updateField(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className={cn(
                    'w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-blue-500 outline-none',
                    f.type === 'text' && f.key.includes('taxId') || f.key.includes('TaxId') || f.key.includes('cert') ? 'font-mono' : ''
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Validations */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Jogosultsági feltételek</h3>
        <div className="space-y-1.5">
          {config.validations.map((v, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              {v}
            </div>
          ))}
        </div>
      </div>

      {/* Calculator */}
      {config.monthlySaving > 0 && (
        <div className={cn('bg-gradient-to-r rounded-xl border p-6 space-y-3',
          `from-${declType === 'young' ? 'green' : declType === 'personal' ? 'red' : declType === 'first-marriage' ? 'violet' : 'pink'}-50 to-${declType === 'young' ? 'emerald' : declType === 'personal' ? 'pink' : declType === 'first-marriage' ? 'purple' : 'rose'}-50 dark:from-slate-900/50 dark:to-slate-800/50 border-border`
        )}>
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Calculator className="w-4 h-4" /> Kedvezmény összefoglaló
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white dark:bg-slate-900 rounded-lg p-3 text-center">
              <p className="text-lg font-bold font-mono">{config.monthlyBase.toLocaleString('hu-HU')}</p>
              <p className="text-[10px] text-slate-500 uppercase font-bold">Ft/hó adóalap-csökkentés</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-lg p-3 text-center">
              <p className="text-lg font-bold font-mono text-emerald-600">{config.monthlySaving.toLocaleString('hu-HU')}</p>
              <p className="text-[10px] text-slate-500 uppercase font-bold">Ft/hó megtakarítás</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-lg p-3 text-center">
              <p className="text-lg font-bold font-mono text-indigo-600">{(config.monthlySaving * 12).toLocaleString('hu-HU')}</p>
              <p className="text-[10px] text-slate-500 uppercase font-bold">Ft/év megtakarítás</p>
            </div>
          </div>
          {endDate && (
            <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> A kedvezmény {endDate}-ig érvényes
            </p>
          )}
        </div>
      )}

      {/* NÉTAK: teljes mentesség */}
      {declType === 'netak' && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 rounded-xl border border-amber-200 dark:border-amber-500/20 p-6 text-center">
          <Star className="w-10 h-10 mx-auto mb-2 text-amber-600" />
          <p className="text-lg font-bold text-amber-800 dark:text-amber-300">Teljes SZJA mentesség</p>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Korlát nélkül — a teljes jövedelem SZJA mentes</p>
          {formData.childCount && Number(formData.childCount) < 4 && (
            <p className="text-sm text-red-600 mt-2 flex items-center gap-1 justify-center">
              <AlertTriangle className="w-4 h-4" /> Minimum 4 gyermek szükséges! Jelenleg: {formData.childCount}
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" asChild><Link to={`/eaisybooks/payroll/${id}/declarations`}>Mégse</Link></Button>
        <Button onClick={handleSave} className={cn('gap-1.5', `bg-gradient-to-r ${config.color} hover:opacity-90`)} disabled={!isComplete || !empId || addDeclaration.isPending}>
          {addDeclaration.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {saved ? 'Mentve ' : 'Nyilatkozat mentése'}
        </Button>
      </div>
    </div>
  );
}
