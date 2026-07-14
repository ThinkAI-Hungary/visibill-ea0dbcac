export type InvoiceType = 'sima_szamla' | 'sima_szla' | 'vegszamla' | 'proforma' | 'dijbekero' | 'dijbekero_proforma' | 'egyszerusitett_szamla' | 'egyszerusitett_szla' | 'elolegszamla' | 'sztorno_szla' | 'garanciajegy' | 'nem_beazonosithato' | 'penztarbizonylat';

/**
 * Central label map for ALL invoice types (covers both legacy and current DB key formats).
 * Use this everywhere instead of ad-hoc label maps.
 */
export const INVOICE_TYPE_LABELS: Record<string, string> = {
  sima_szamla: 'Számla',
  sima_szla: 'Számla',
  vegszamla: 'Végszámla',
  proforma: 'Díjbekérő',
  dijbekero: 'Díjbekérő',
  dijbekero_proforma: 'Díjbekérő',
  egyszerusitett_szamla: 'Egyszerűsített számla',
  egyszerusitett_szla: 'Egyszerűsített számla',
  elolegszamla: 'Előlegszámla',
  sztorno_szla: 'Sztornó számla',
  garanciajegy: 'Garanciajegy',
  nem_beazonosithato: 'Nem beazonosítható',
  penztarbizonylat: 'Pénztárbizonylat',
};

export interface BaseInvoice {
  id: string;
  user_id: string;
  invoice_type: InvoiceType;
  kibocsatas_datuma: string;
  elado_nev: string;
  vevo_nev: string;
  elado_vat_id?: string;
  created_at?: string;
  updated_at?: string;
  category_id?: string;
  category_name?: string;
  project_id?: string;
  project_name?: string;
  penznem?: string;
  reference_number?: string;
  transaction_id?: string | null;
}

export interface SimaInvoice extends BaseInvoice {
  invoice_type: 'sima_szamla';
  bizonylatsorszam?: string;
  elado_cim?: string;
  vevo_cim?: string;
  vevo_vat_id?: string;
  teljesites_datuma?: string;
  adoalap_osszesen?: number;
  afa_kulcsok_bontasban?: string;
  afa_osszeg_osszesen?: number;
  brutto_vegosszeg?: number;
  forditott_adozas?: boolean;
  adomentesseg_hivatkozas?: string;
  onszamlazas?: boolean;
  penzforgalmi_elszamolas?: boolean;
  penznem?: string;
  statusz?: string;
  melleklet_url?: string;
  email_uzenet_id?: string;
  feldolgozva?: string;
  frissitve?: string;
  letrehozva?: string;
}

export interface VegszamlaInvoice extends BaseInvoice {
  invoice_type: 'vegszamla';
  bizonylatsorszam?: string;
  elado_cim?: string;
  vevo_cim?: string;
  adoalap_osszesen?: number;
  afa_osszeg_osszesen?: number;
  elolegszamla_hivatkozas?: string;
  elszamolt_eloleg_osszeg?: number;
  brutto_vegosszeg?: number;
  teljesites_datuma?: string;
  forditott_adozas?: boolean;
}

export interface ProformaInvoice extends BaseInvoice {
  invoice_type: 'proforma';
  dokumentum_azonosito?: string;
  fizetendo_osszeg?: number;
  fizetesi_mod?: string;
  bankszamlaszam_iban?: string;
  adojogi_megjegyzes?: string;
  fizetesi_hatarido?: string;
}

export interface EgyszerusitettInvoice extends BaseInvoice {
  invoice_type: 'egyszerusitett_szamla';
  termek_szolgaltatas_tipusa?: string;
  afa_osszeg?: number;
  adoalap_osszesen_netto?: number;
  elado_cim?: string;
}

export type Invoice = SimaInvoice | VegszamlaInvoice | ProformaInvoice | EgyszerusitettInvoice;

export const getInvoiceTypeLabel = (type: string): string => {
  return INVOICE_TYPE_LABELS[type] || type;
};

export const getInvoiceTypeColor = (type: string): string => {
  const colors: Record<string, string> = {
    sima_szamla: 'bg-blue-100 text-blue-800',
    sima_szla: 'bg-blue-100 text-blue-800',
    vegszamla: 'bg-green-100 text-green-800',
    proforma: 'bg-yellow-100 text-yellow-800',
    dijbekero: 'bg-yellow-100 text-yellow-800',
    dijbekero_proforma: 'bg-yellow-100 text-yellow-800',
    egyszerusitett_szamla: 'bg-purple-100 text-purple-800',
    egyszerusitett_szla: 'bg-purple-100 text-purple-800',
    elolegszamla: 'bg-cyan-100 text-cyan-800',
    sztorno_szla: 'bg-red-100 text-red-800',
    garanciajegy: 'bg-orange-100 text-orange-800',
    nem_beazonosithato: 'bg-gray-100 text-gray-800',
  };
  return colors[type] || 'bg-gray-100 text-gray-800';
};