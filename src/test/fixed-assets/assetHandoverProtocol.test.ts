import { describe, it, expect, vi } from 'vitest';
import {
  generateAssetHandoverProtocolBlob,
  type AssetHandoverProtocolData,
} from '@/lib/fixed-assets/assetHandoverProtocolPdf';

describe('M2.2: Asset handover and custody protocol PDF generator', () => {
  const baseData: AssetHandoverProtocolData = {
    companyName: 'Visibill Fejlesztő Kft.',
    companyAddress: '1052 Budapest, Deák Ferenc tér 3.',
    companyTaxNumber: '12345678-2-41',
    protocolNumber: 'AAT-TE-2026-0042-2026-10-13',
    eventDate: '2026-10-13',
    assetName: 'Apple MacBook Pro M3 Max 16"',
    inventoryNumber: 'TE-2026-0042',
    description: 'Munkaállomás laptop, 64GB RAM, 1TB SSD, Space Black',
    vtszTeszor: '84713000',
    activationDate: '2026-01-15',
    acquisitionValue: 1450000,
    oldLocationName: 'Központi Telephely',
    newLocationName: 'Központi Telephely',
    oldSubLocationName: '1. emelet, Tárgyaló',
    newSubLocationName: '2. emelet, 204-es Fejlesztői Iroda',
    oldCustodianName: 'Nagy Péter',
    newCustodianName: 'Kovács János',
    newCustodianEmail: 'janos.kovacs@visibill.hu',
    oldCostCenterName: 'IT Üzemeltetés',
    newCostCenterName: 'IT Fejlesztés',
    projectName: 'Digitális Transzformáció 2026',
    notes: 'Új senior fejlesztő munkába lépése miatt eszköz átadása.',
  };

  it('generates a valid non-empty PDF blob with application/pdf type', () => {
    const blob = generateAssetHandoverProtocolBlob(baseData);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(2000);
  });

  it('generates PDF cleanly with minimal required fields', () => {
    const minimalData: AssetHandoverProtocolData = {
      companyName: 'Minimál Teszt Kft.',
      protocolNumber: 'AAT-MIN-001',
      eventDate: '2026-10-13',
      assetName: 'Egyszerű Tárgyi Eszköz',
      inventoryNumber: 'TE-MIN-001',
    };

    const blob = generateAssetHandoverProtocolBlob(minimalData);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(1500);
  });

  it('includes Hungarian special characters without throwing error', () => {
    const hungarianData: AssetHandoverProtocolData = {
      ...baseData,
      companyName: 'Árvíztűrő Fúrógép Gyártó és Javító Kft.',
      assetName: 'Őrült Érzékeny Műszer & Vizsgáló Állomás űrhajókhoz',
      oldCustodianName: 'Szabó Gergő György',
      newCustodianName: 'Tóth Árpád Zoltán',
      notes: 'Műszaki és esztétikai állapot: kiváló, sérülésmentes, őrzésre átadva.',
    };

    expect(() => generateAssetHandoverProtocolBlob(hungarianData)).not.toThrow();
    const blob = generateAssetHandoverProtocolBlob(hungarianData);
    expect(blob.size).toBeGreaterThan(2000);
  });
});
