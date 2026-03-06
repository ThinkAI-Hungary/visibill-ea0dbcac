export type InvoiceType = 'sima_szamla' | 'vegszamla' | 'proforma' | 'egyszerusitett_szamla';

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
  fizetve?: boolean;
  penznem?: string;
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

export const getInvoiceTypeLabel = (type: InvoiceType): string => {
  const labels = {
    sima_szamla: 'Sima számla',
    vegszamla: 'Végszámla',
    proforma: 'Proforma',
    egyszerusitett_szamla: 'Egyszerűsített számla'
  };
  return labels[type];
};

export const getInvoiceTypeColor = (type: InvoiceType): string => {
  const colors = {
    sima_szamla: 'bg-blue-100 text-blue-800',
    vegszamla: 'bg-green-100 text-green-800',
    proforma: 'bg-yellow-100 text-yellow-800',
    egyszerusitett_szamla: 'bg-purple-100 text-purple-800'
  };
  return colors[type];
};