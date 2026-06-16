/**
 * Fordított Adózás (FAD / Reverse Charge) — Core Types & Constants
 * ================================================================
 * Áfa tv. 142. § szerinti belföldi fordított adózás kategóriák,
 * valamint EU/harmadik országos szolgáltatás-import kezelés.
 */

export type ReverseChargeCategory =
  | 'construction'
  | 'scrap_metal'
  | 'agriculture'
  | 'steel'
  | 'emission_quota'
  | 'natural_gas'
  | 'labor_hire'
  | 'eu_service_import'
  | 'third_country';

export interface FadCategoryMeta {
  key: ReverseChargeCategory;
  label: string;
  shortLabel: string;
  description: string;
  legalRef: string;
  color: string;          // Tailwind bg class
  textColor: string;      // Tailwind text class
}

/** All FAD categories with full metadata */
export const FAD_CATEGORIES: Record<ReverseChargeCategory, FadCategoryMeta> = {
  construction: {
    key: 'construction',
    label: 'Építőipari szolgáltatás',
    shortLabel: 'Építőipar',
    description: 'Ingatlanhoz kapcsolódó építési-szerelési, bontási, felújítási munkák',
    legalRef: 'Áfa tv. 142. § (1) b)',
    color: 'bg-orange-500/10',
    textColor: 'text-orange-600',
  },
  scrap_metal: {
    key: 'scrap_metal',
    label: 'Hulladék / Fémhulladék',
    shortLabel: 'Hulladék',
    description: 'Fémhulladék, MÉH, használt akkumulátor, roncsautó',
    legalRef: 'Áfa tv. 142. § (1) d)',
    color: 'bg-zinc-500/10',
    textColor: 'text-zinc-600',
  },
  agriculture: {
    key: 'agriculture',
    label: 'Mezőgazdasági termék',
    shortLabel: 'Mezőgazd.',
    description: 'Gabona, takarmány, olajos magvak (VTSZ 01-12 fejezet)',
    legalRef: 'Áfa tv. 142. § (1) i)',
    color: 'bg-green-500/10',
    textColor: 'text-green-600',
  },
  steel: {
    key: 'steel',
    label: 'Acélipari termék',
    shortLabel: 'Acélipar',
    description: 'Acélipari félkész-/késztermékek (VTSZ 72-73 fejezet)',
    legalRef: 'Áfa tv. 142. § (1) j)',
    color: 'bg-slate-500/10',
    textColor: 'text-slate-600',
  },
  emission_quota: {
    key: 'emission_quota',
    label: 'Kibocsátási kvóta',
    shortLabel: 'Kvóta',
    description: 'Üvegházhatású gáz kibocsátási egység kereskedelem',
    legalRef: 'Áfa tv. 142. § (1) h)',
    color: 'bg-sky-500/10',
    textColor: 'text-sky-600',
  },
  natural_gas: {
    key: 'natural_gas',
    label: 'Földgáz értékesítés',
    shortLabel: 'Földgáz',
    description: 'Belföldön értékesített földgáz',
    legalRef: 'Áfa tv. 142. § (1) c)',
    color: 'bg-amber-500/10',
    textColor: 'text-amber-600',
  },
  labor_hire: {
    key: 'labor_hire',
    label: 'Munkaerő-kölcsönzés',
    shortLabel: 'Munkaerő',
    description: 'Építőipari tevékenységhez kapcsolódó munkaerő-kölcsönzés',
    legalRef: 'Áfa tv. 142. § (1) b)',
    color: 'bg-violet-500/10',
    textColor: 'text-violet-600',
  },
  eu_service_import: {
    key: 'eu_service_import',
    label: 'EU szolgáltatás-import',
    shortLabel: 'EU import',
    description: 'Más EU tagállamból igénybe vett szolgáltatás',
    legalRef: 'Áfa tv. 37. §',
    color: 'bg-blue-500/10',
    textColor: 'text-blue-600',
  },
  third_country: {
    key: 'third_country',
    label: 'Harmadik országos szolgáltatás',
    shortLabel: '3. ország',
    description: 'EU-n kívüli országból igénybe vett szolgáltatás',
    legalRef: 'Áfa tv. 37. §',
    color: 'bg-red-500/10',
    textColor: 'text-red-600',
  },
};

/** Get category meta, returns undefined for unknown categories */
export function getFadCategory(key: string | null | undefined): FadCategoryMeta | undefined {
  if (!key) return undefined;
  return FAD_CATEGORIES[key as ReverseChargeCategory];
}

/** Get all categories as sorted array */
export function getAllFadCategories(): FadCategoryMeta[] {
  return Object.values(FAD_CATEGORIES);
}

/** Check if a category is domestic (belföldi) reverse charge */
export function isDomesticRC(category: ReverseChargeCategory): boolean {
  return !['eu_service_import', 'third_country'].includes(category);
}
