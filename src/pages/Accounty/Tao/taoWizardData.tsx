import React from 'react';
import {
  FileText, TrendingUp, TrendingDown, Scale, Globe, Shield,
  Landmark, Heart, Send, Calculator
} from 'lucide-react';
import { Input } from '@/components/ui/input';

// ── Step Definitions ──
export const STEPS = [
  { num: 1,  label: 'Beszámoló',   icon: FileText,      desc: 'Eredménykimutatás alapadatok' },
  { num: 2,  label: 'AEE',         icon: Calculator,    desc: 'Adózás előtti eredmény' },
  { num: 3,  label: '7.§ csökk.',  icon: TrendingDown,  desc: 'Adóalap-csökkentő tételek' },
  { num: 4,  label: '8.§ növ.',    icon: TrendingUp,    desc: 'Adóalap-növelő tételek' },
  { num: 5,  label: 'Kamatkorlát', icon: Scale,         desc: 'EBITDA 30% szabály' },
  { num: 6,  label: 'CFC',         icon: Globe,         desc: 'Ellenőrzött külföldi társaság' },
  { num: 7,  label: 'Adóalap',     icon: Calculator,    desc: 'Módosított adóalap kiszámítása' },
  { num: 8,  label: 'Kedvezm.',    icon: Shield,        desc: 'Adókedvezmények' },
  { num: 9,  label: 'Felajánlás',  icon: Heart,         desc: 'Látvány-csapatsport, film' },
  { num: 10, label: 'Fizetendő',   icon: Landmark,      desc: 'Fizetendő TAO összeg' },
  { num: 11, label: 'Beküldés',    icon: Send,          desc: '29-es bevallás generálás' },
];

// ── 7.§ Csökkentő tételek ──
export const DECREASING_ITEMS = [
  { key: 'rd_allowance', label: 'Kutatás-fejlesztés (K+F) közvetlen költsége', hint: 'Tao tv. 7.§ (1) t)' },
  { key: 'investment_allowance', label: 'Fejlesztési tartalék', hint: 'Tao tv. 7.§ (1) f)' },
  { key: 'provision_release', label: 'Céltartalék felszabadítás', hint: 'Tao tv. 7.§ (1) ly)' },
  { key: 'royalty_income', label: 'Szellemi tulajdon (IP) bevétel 50%-a', hint: 'Tao tv. 7.§ (1) s)' },
  { key: 'donation_allowance', label: 'Közérdekű adomány 20%-a (max AEE 50%)', hint: 'Tao tv. 7.§ (1) z)' },
  { key: 'sme_investment', label: 'KKV beruházási kedvezmény', hint: 'Tao tv. 7.§ (1) zs)' },
  { key: 'depreciation_tax', label: 'Adó szerinti értékcsökkenés', hint: 'Tao tv. 7.§ (1) d)' },
  { key: 'other', label: 'Egyéb csökkentő tételek', hint: '' },
];

// ── 8.§ Növelő tételek ──
export const INCREASING_ITEMS = [
  { key: 'depreciation_diff', label: 'Számviteli-adó ÉCS különbözet', hint: 'Tao tv. 8.§ (1) b)' },
  { key: 'thin_cap', label: 'Alultőkésítés miatti kamatkorrekció', hint: 'Tao tv. 8.§ (1) j)' },
  { key: 'transfer_pricing', label: 'Transzferár-korrekció', hint: 'Tao tv. 18.§' },
  { key: 'penalty_fine', label: 'Bírság, pótlék, büntetés', hint: 'Tao tv. 8.§ (1) d)' },
  { key: 'non_deductible', label: 'Nem elismert költségek', hint: 'Tao tv. 8.§ (1) a)' },
  { key: 'provision_formed', label: 'Céltartalék képzés', hint: 'Tao tv. 8.§ (1) a)' },
  { key: 'representation', label: 'Reprezentáció nem elismert része', hint: 'Tao tv. 3. mell. B/3.' },
  { key: 'other', label: 'Egyéb növelő tételek', hint: '' },
];

// ── Adókedvezmények ──
export const CREDIT_ITEMS = [
  { key: 'development', label: 'Fejlesztési adókedvezmény', hint: 'Tao tv. 22/B.§' },
  { key: 'energy_efficiency', label: 'Energiahatékonysági beruházás', hint: 'Tao tv. 22/E.§' },
  { key: 'performing_arts', label: 'Előadó-művészeti kedvezmény', hint: 'Tao tv. 22/C.§' },
  { key: 'sports_development', label: 'Sportfejlesztési kedvezmény', hint: 'Tao tv. 22/C.§' },
  { key: 'small_business', label: 'KKV adókedvezmény', hint: 'Tao tv. 22/A.§' },
  { key: 'other', label: 'Egyéb kedvezmények', hint: '' },
];

// ── Felajánlás ──
export const DONATION_ITEMS = [
  { key: 'spectator_sports', label: 'Látvány-csapatsport (TAO felajánlás)', hint: 'max. a számított adó 80%-a' },
  { key: 'film', label: 'Filmalkotás, előadó-művészet', hint: 'max. a számított adó 80%-a' },
];

// ── Helper: format currency ──
export const fmt = (n: number) => new Intl.NumberFormat('hu-HU', { style: 'decimal', maximumFractionDigits: 0 }).format(n);

// ── NumberInput component ──
export function NumberInput({ value, onChange, label, hint, suffix = 'Ft' }: {
  value: number; onChange: (v: number) => void; label: string; hint?: string; suffix?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">
        {label}
        {hint && <span className="ml-1 text-slate-400 font-normal">({hint})</span>}
      </label>
      <div className="relative">
        <Input
          type="text"
          value={value === 0 ? '' : fmt(value)}
          onChange={e => {
            const raw = e.target.value.replace(/[^\d-]/g, '');
            onChange(raw ? parseInt(raw, 10) : 0);
          }}
          className="bg-background pr-10 text-right font-mono"
          placeholder="0"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{suffix}</span>
      </div>
    </div>
  );
}
