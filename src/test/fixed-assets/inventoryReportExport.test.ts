import { describe, it, expect } from 'vitest';
import {
  generateInventoryReportPdf,
  generateInventoryReportPdfBlob,
  INVENTORY_STATUS_LABELS,
  type InventoryReportExportParams,
  type InventoryItemReportRow,
} from '@/lib/fixed-assets/inventoryReportExport';
import type { FixedAsset } from '@/types/fixed-assets';

describe('inventoryReportExport', () => {
  const mockAsset1: FixedAsset = {
    id: 'asset-1',
    company_id: 'comp-1',
    inventory_number: 'TE-2026/001',
    name: 'Dell Precision Munkaállomás',
    asset_group: 'machines',
    acquisition_date: '2026-01-15',
    activation_date: '2026-01-20',
    acquisition_value: 850000,
    gross_value: 850000,
    accumulated_depreciation: 150000,
    net_book_value: 700000,
    currency: 'HUF',
    depreciation_method: 'linear',
    annual_depreciation_rate: 33,
    residual_value: 0,
    status: 'active',
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T10:00:00Z',
    location: { id: 'loc-1', name: 'Központi Iroda' },
    sub_location: { id: 'sub-1', name: 'IT Labor', code: 'LAB-01' },
    custodian: { id: 'emp-1', full_name: 'Kovács János', employee_number: 'E-001' },
  };

  const mockAsset2: FixedAsset = {
    id: 'asset-2',
    company_id: 'comp-1',
    inventory_number: 'TE-2026/002',
    name: 'Ergonomikus Irodai Szék',
    asset_group: 'equipment',
    acquisition_date: '2026-02-10',
    activation_date: '2026-02-12',
    acquisition_value: 120000,
    gross_value: 120000,
    accumulated_depreciation: 20000,
    net_book_value: 100000,
    currency: 'HUF',
    depreciation_method: 'linear',
    annual_depreciation_rate: 14.5,
    residual_value: 0,
    status: 'active',
    created_at: '2026-02-10T10:00:00Z',
    updated_at: '2026-02-10T10:00:00Z',
    location: { id: 'loc-1', name: 'Központi Iroda' },
    sub_location: { id: 'sub-2', name: 'Tárgyaló 1', code: 'CONF-01' },
    custodian: null,
  };

  const sampleItems: InventoryItemReportRow[] = [
    {
      asset: mockAsset1,
      checkStatus: 'found',
      notes: 'Kitűnő állapotban',
    },
    {
      asset: mockAsset2,
      checkStatus: 'damaged',
      notes: 'Jobb oldali karfa javításra szorul',
    },
  ];

  const params: InventoryReportExportParams = {
    companyName: 'Teszt Vállalkozás Kft.',
    companyTaxNumber: '12345678-2-42',
    companyAddress: '1054 Budapest, Szabadság tér 1.',
    cutoffDate: '2026-12-31',
    items: sampleItems,
    committeeMembers: {
      taker: 'Nagy Anna',
      inspector: 'Kiss Péter',
      approver: 'Dr. Kovács Béla',
    },
  };

  it('exposes correct inventory status labels', () => {
    expect(INVENTORY_STATUS_LABELS.found).toBe('Fellelve (Rendben)');
    expect(INVENTORY_STATUS_LABELS.missing).toBe('Hiányzik');
    expect(INVENTORY_STATUS_LABELS.damaged).toBe('Sérült / Javítandó');
    expect(INVENTORY_STATUS_LABELS.scrap_candidate).toBe('Selejtezendő');
  });

  it('generates a valid landscape A4 PDF document with table and signers', () => {
    const doc = generateInventoryReportPdf(params);
    expect(doc).toBeDefined();

    // Check dimensions (A4 Landscape: 297 x 210 mm)
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    expect(Math.round(pw)).toBe(297);
    expect(Math.round(ph)).toBe(210);

    const blob = generateInventoryReportPdfBlob(params);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(1000);
    expect(blob.type).toBe('application/pdf');
  });
});
