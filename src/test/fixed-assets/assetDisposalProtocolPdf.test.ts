import { describe, it, expect } from 'vitest';
import {
  generateAssetDisposalProtocolBlob,
  generateAssetDisposalProtocolPdf,
  buildDisposalProtocolFileName,
  DISPOSAL_PROTOCOL_TITLES,
  type DisposalProtocolData,
} from '@/lib/fixed-assets/assetDisposalProtocolPdf';
import { buildDisposalProtocolData } from '@/lib/fixed-assets/assetDisposalProtocolService';
import type { DisposalReasonType, FixedAsset } from '@/types/fixed-assets';

const base: DisposalProtocolData = {
  reasonType: 'scrapping',
  disposalStatus: 'pending_approval',
  companyName: 'Teszt Kft.',
  companyAddress: '1051 Budapest, Fő tér 1.',
  companyTaxNumber: '12345678-2-41',
  protocolNumber: 'KIV-TE-2026-0001',
  disposalDate: '2026-10-13',
  assetName: 'Dell Latitude 5540 laptop',
  inventoryNumber: 'TE-2026-0001',
  acquisitionValue: 450000,
  accumulatedDepreciation: 150000,
  netBookValue: 300000,
  reason: 'Fizikai elavulás',
  committee: { chair: 'Kovács János', members: ['Nagy Péter', 'Szabó Éva'] },
  waste: { hazardous: true, handler: 'Újrahasznosító Zrt.', waste_code: '16 02 13', handover_date: '2026-10-14' },
  details: { buyer_name: 'Vevő Bt.', sale_value: 200000, recipient_name: 'Alapítvány', compensation_amount: 50000, notes: 'Megjegyzés' },
  liableEmployeeName: 'Tóth Béla',
  journalDocumentId: 'KIV-TE-2026-0001',
  journalLines: [
    { glNumber: '139', dcType: 'T', amount: 150000, description: 'Halmozott ÉCS kivezetése' },
    { glNumber: '869', dcType: 'T', amount: 300000, description: 'Nettó érték' },
    { glNumber: '143', dcType: 'K', amount: 450000, description: 'Bruttó érték' },
  ],
};

const TYPES: DisposalReasonType[] = ['sale', 'scrapping', 'inventory_shortage', 'donation'];

describe('Kivezetési jegyzőkönyv PDF', () => {
  it.each(TYPES)('%s: érvényes, nem üres PDF blob készül', (reasonType) => {
    const blob = generateAssetDisposalProtocolBlob({ ...base, reasonType });
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(2000);
  });

  it.each(TYPES)('%s: legalább egy oldalas, a lábléc jogcímfüggő', (reasonType) => {
    const doc = generateAssetDisposalProtocolPdf({ ...base, reasonType });
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    expect(DISPOSAL_PROTOCOL_TITLES[reasonType].title.length).toBeGreaterThan(5);
  });

  it('könyvelési tételek és üres opcionális mezők nélkül is generálódik', () => {
    const blob = generateAssetDisposalProtocolBlob({
      ...base,
      journalLines: undefined,
      committee: null,
      waste: null,
      details: null,
      accumulatedDepreciation: undefined,
      netBookValue: undefined,
    });
    expect(blob.size).toBeGreaterThan(2000);
  });

  it('a fájlnév jogcímenként egyedi és biztonságos', () => {
    expect(buildDisposalProtocolFileName('scrapping', 'TE 2026/0001')).toBe('selejtezesi_jegyzokonyv_TE_2026_0001.pdf');
    expect(buildDisposalProtocolFileName('inventory_shortage', 'A-1')).toBe('leltarhiany_jegyzokonyv_A-1.pdf');
    expect(new Set(TYPES.map((t) => buildDisposalProtocolFileName(t, 'X'))).size).toBe(4);
  });
});

describe('buildDisposalProtocolData', () => {
  const asset = {
    id: 'a1',
    inventory_number: 'TE-1',
    name: 'Gép',
    acquisition_value: 1000,
    activation_date: '2026-01-01',
    disposal_date: null,
    disposal_status: 'pending_approval',
    disposal_reason_type: 'sale',
    disposal_committee: null,
    disposal_waste_info: null,
    disposal_details: { requested_disposal_date: '2026-10-01', reason: 'Eladva', sale_value: 900, buyer_name: 'Vevő' },
    vtsz_teszor: null,
    location: { name: 'Iroda', address: 'Budapest' },
  } as unknown as FixedAsset;

  it('a kérelem adataiból tölti a jegyzőkönyvet (tervezett dátum, indoklás, telephely)', () => {
    const data = buildDisposalProtocolData(asset, { name: 'Cég Kft.', address: 'Cím', tax_number: '1' });
    expect(data.reasonType).toBe('sale');
    expect(data.disposalDate).toBe('2026-10-01');
    expect(data.reason).toBe('Eladva');
    expect(data.protocolNumber).toBe('KIV-TE-1');
    expect(data.locationNameAddress).toBe('Iroda (Budapest)');
    expect(data.companyName).toBe('Cég Kft.');
  });

  it('jóváhagyás után a ténylegesen rögzített kivezetési dátumot használja', () => {
    const data = buildDisposalProtocolData({ ...asset, disposal_date: '2026-10-05' } as FixedAsset, null);
    expect(data.disposalDate).toBe('2026-10-05');
    expect(data.companyName).toBe('Cég neve');
  });
});
