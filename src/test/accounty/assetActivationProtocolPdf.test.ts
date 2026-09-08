import { describe, it, expect } from 'vitest';
import { generateAssetActivationProtocolPdf, generateAssetActivationProtocolBlob, AssetProtocolData } from '../../lib/assetActivationProtocolPdf';

describe('Asset Activation Protocol PDF Generator', () => {
  it('generates a valid jsPDF instance and blob for complete asset data', () => {
    const sampleData: AssetProtocolData = {
      companyName: 'Test Kft.',
      companyAddress: '1051 Budapest, Fő tér 1.',
      companyTaxNumber: '12345678-2-41',
      protocolNumber: 'JK-2026/0001',
      protocolCity: 'Budapest',
      protocolDate: '2026-09-08',
      activatedByName: 'Kovács János',
      technicalReceiverName: 'Nagy Péter',
      assetName: 'Dell Latitude 5540 Laptop',
      assetTypeManufacturer: 'Dell Laptop i7/16GB',
      serialNumber: 'SN-99887766',
      vtszTeszor: '8471 30 00',
      inventoryNumber: 'TE-2026-0001',
      quantity: 1,
      locationNameAddress: 'Székhely iroda (Budapest)',
      supplierName: 'BestByte Kft.',
      invoiceNumber: 'BB-2026/0899',
      invoiceDate: '2026-09-01',
      invoiceNetAmount: 450000,
      receiptDate: '2026-09-02',
      acquisitionSource: 'Saját forrás',
      activationDate: '2026-09-08',
      acquisitionValue: 450000,
      incidentalCost: 0,
      nonDeductibleVat: 0,
      glAccountNumber: '1431',
      glAccountName: 'Irodai gépek, berendezések',
      accountingVoucherNumber: 'BB-2026/0899',
      depreciationStartDate: '2026-09-08',
      depreciationMethodLabel: 'Lineáris (Egyenletes)',
      depreciationRateAnnual: '33.3%',
      usefulLifeYears: '3',
      residualValue: 0,
      depreciationGlAccount: '5711 - Tárgyi eszközök értékcsökkenése',
      taoRatePercent: 33,
    };

    const doc = generateAssetActivationProtocolPdf(sampleData);
    expect(doc).toBeDefined();
    expect(doc.internal.getNumberOfPages()).toBeGreaterThanOrEqual(1);

    const blob = generateAssetActivationProtocolBlob(sampleData);
    expect(blob).toBeDefined();
    expect(blob.size).toBeGreaterThan(1000);
    expect(blob.type).toBe('application/pdf');
  });

  it('handles missing optional fields gracefully', () => {
    const minimalData: AssetProtocolData = {
      companyName: 'Minimal Cég Kft.',
      protocolNumber: 'JK-MIN-001',
      protocolDate: '2026-09-08',
      activatedByName: 'Gipsz Jakab',
      assetName: 'Egyszerű eszköz',
      inventoryNumber: 'MIN-001',
      activationDate: '2026-09-08',
      acquisitionValue: 100000,
      depreciationStartDate: '2026-09-08',
      depreciationMethodLabel: 'Lineáris',
    };

    const blob = generateAssetActivationProtocolBlob(minimalData);
    expect(blob).toBeDefined();
    expect(blob.size).toBeGreaterThan(1000);
  });
});
