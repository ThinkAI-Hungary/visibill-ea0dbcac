import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Nav26A60SheetFolap,
  Nav26A60SheetTable,
  Nav26A60ReplicaContainer,
} from '@/features/vat/components/replica';
import { VatNavA60Replica } from '@/features/vat';
import { type A60CalculationsResult } from '@/features/vat/types';

describe('NAV 26A60 Official Tax Return Replica Test Suite', () => {
  const mockCompany = {
    id: 'acc22ca9-e9ff-4f9f-9495-ca7612b2e5e2',
    name: 'TAXOLOGY Kft.',
    tax_number: '14160877-2-41',
    representative_name: 'Jámbor Viktor',
    phone: '06704240024',
  };

  const mockA60Calculations: A60CalculationsResult = {
    goodsOutSum: 0,
    goodsInSum: 26,
    servicesOutSum: 0,
    servicesInSum: 31,
    goodsSum: 0,
    servicesSum: 0,
    expectedGoods: 0,
    expectedServices: 0,
    goodsMismatch: false,
    servicesMismatch: false,
    goodsOutMismatch: false,
    goodsInMismatch: false,
    servicesOutMismatch: false,
    servicesInMismatch: false,
    isValid: true,
    taxErrors: [],
    itemsList: [
      {
        id: 'inv-1',
        invoice_number: 'INV-DE-001',
        partner_name: 'Digital Charging Solutions GmbH',
        partner_tax_number: 'DE312237805',
        country_code: 'DE',
        category: 'goods_in',
        invoice_direction: 'INBOUND',
        amountEft: 26,
        isService: false,
        hasTaxNumber: true,
        isValidFormat: true,
      },
      {
        id: 'inv-2',
        invoice_number: 'INV-IE-001',
        partner_name: 'Google Cloud EMEA Limited',
        partner_tax_number: 'IE3668997OH',
        country_code: 'IE',
        category: 'services_in',
        invoice_direction: 'INBOUND',
        amountEft: 31,
        isService: true,
        hasTaxNumber: true,
        isValidFormat: true,
      },
    ],
  };

  describe('1. NAV 26A60 Főlap (Nav26A60SheetFolap)', () => {
    it('renders official header, form code, company name and community tax number', () => {
      render(
        <Nav26A60SheetFolap
          selectedCompany={mockCompany}
          year={2026}
          month={7}
          frequency="H"
        />
      );

      // Official headers
      expect(screen.getByText('26A60')).toBeDefined();
      expect(screen.getByText('Összesítő nyilatkozat')).toBeDefined();
      expect(screen.getByText('Nemzeti Adó- és Vámhivatal')).toBeDefined();

      // Company info & Community VAT
      expect(screen.getByText('TAXOLOGY Kft.')).toBeDefined();
      expect(screen.getAllByText('HU').length).toBe(2);
      expect(screen.getAllByText('1').length).toBeGreaterThan(0);

      // Representative
      expect(screen.getByText('Jámbor Viktor')).toBeDefined();
      expect(screen.getByText('36704240024')).toBeDefined();

      // Period & Frequency
      expect(screen.getByText('(Havi)')).toBeDefined();
    });
  });

  describe('2. NAV 26A60 Sub-sheet Table (Nav26A60SheetTable)', () => {
    it('renders 24 numbered rows and row 25 Összesen with partner data', () => {
      const items = [
        {
          countryCode: 'DE',
          vatNumber: '312237805',
          fullTaxNumber: 'DE312237805',
          partnerName: 'Digital Charging Solutions GmbH',
          amountEft: 26,
        },
      ];

      render(
        <Nav26A60SheetTable
          sheetType="02"
          items={items}
          pageNumber={1}
        />
      );

      // Row 01 item
      expect(screen.getByText('01.')).toBeDefined();
      // Country code is rendered in segmented boxes: 'D' and 'E'
      expect(screen.getByText('D')).toBeDefined();
      expect(screen.getByText('E')).toBeDefined();
      expect(screen.getByText('312237805')).toBeDefined();
      expect(screen.getAllByText('26').length).toBeGreaterThan(0);

      // Row 24 empty row exists
      expect(screen.getByText('24.')).toBeDefined();

      // Row 25 Összesen
      expect(screen.getByText('25.')).toBeDefined();
      expect(screen.getByText('Összesen')).toBeDefined();
    });
  });

  describe('3. NAV 26A60 Container & Facade (VatNavA60Replica)', () => {
    it('aggregates items by partner and provides sheet switching', () => {
      render(
        <VatNavA60Replica
          selectedCompany={mockCompany}
          year={2026}
          month={7}
          frequency="H"
          a60Calculations={mockA60Calculations}
          defaultSheet="all"
        />
      );

      // Toolbar title
      expect(screen.getByText(/NAV 26A60 Hivatalos Nyomtatvány Replika/i)).toBeDefined();

      // Validation status badge
      expect(screen.getByText('Egyezik a 65-ös bevallással')).toBeDefined();

      // Sheet buttons
      expect(screen.getByText('Főlap')).toBeDefined();
      expect(screen.getByText('01 Lap (Értékesítés)')).toBeDefined();
      expect(screen.getByText('02 Lap (Beszerzés)')).toBeDefined();
      expect(screen.getByText('03 Lap (Szolg. nyújtás)')).toBeDefined();
      expect(screen.getByText('04 Lap (Szolg. igénybevétel)')).toBeDefined();

      // In "all" mode, rendered sheets contain both DE (goods in) and IE (services in)
      expect(screen.getByText('312237805')).toBeDefined();
      expect(screen.getByText('3668997OH')).toBeDefined();
    });
  });
});
