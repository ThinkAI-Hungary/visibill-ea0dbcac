import { describe, it, expect } from 'vitest';
import {
  generateGiroPayrollXml,
  formatToIban,
  type GiroBatchParams,
} from '@/lib/payroll/giroXmlGenerator';

describe('GIRO XML Generator & IBAN Utils', () => {
  describe('formatToIban', () => {
    it('should convert standard 24-digit Hungarian BBAN to valid IBAN with correct checksum', () => {
      // Example BBAN: 11773016-00000000-00000000 (OTP)
      const bban = '11773016-00000000-00000000';
      const iban = formatToIban(bban);
      
      expect(iban.startsWith('HU')).toBe(true);
      expect(iban.length).toBe(28);
      expect(iban).toBe('HU03117730160000000000000000');
    });

    it('should pad 16-digit BBAN with 8 zeroes to form 24 digits before calculating IBAN', () => {
      const bban16 = '10032000-06055950'; // 16 digits
      const iban = formatToIban(bban16);

      expect(iban.startsWith('HU')).toBe(true);
      expect(iban.length).toBe(28);
      expect(iban.endsWith('00000000')).toBe(true);
    });

    it('should return already valid 28-char HU IBAN intact', () => {
      const existingIban = 'HU03117730160000000000000000';
      expect(formatToIban(existingIban)).toBe(existingIban);
    });

    it('should sanitize spaces and dashes cleanly', () => {
      const dashed = 'HU03-1177-3016-0000-0000-0000-0000';
      expect(formatToIban(dashed)).toBe('HU03117730160000000000000000');
    });
  });

  describe('generateGiroPayrollXml', () => {
    it('should generate well-formed ISO 20022 pain.001.001.03 XML', () => {
      const batch: GiroBatchParams = {
        companyName: 'Teszt Kft.',
        debtorIban: 'HU03117730160000000000000000',
        executionDate: '2026-11-10',
        batchReference: 'BER-2026-10',
        payoutItems: [
          {
            employeeId: 'emp-001',
            employeeName: 'Kovács János',
            bankAccount: '11773016-00000000-00000001',
            netSalary: 450000,
            remittanceInfo: 'Munkabér 2026.10',
          },
          {
            employeeId: 'emp-002',
            employeeName: 'Nagy Anna',
            bankAccount: '11773016-00000000-00000002',
            netSalary: 380500,
            remittanceInfo: 'Munkabér 2026.10',
          },
        ],
      };

      const xml = generateGiroPayrollXml(batch);

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03"');
      expect(xml).toContain('<CstmrCdtTrfInitn>');
      expect(xml).toContain('<NbOfTxs>2</NbOfTxs>');
      expect(xml).toContain('<CtrlSum>830500</CtrlSum>');
      expect(xml).toContain('<ReqdExctnDt>2026-11-10</ReqdExctnDt>');
      expect(xml).toContain('<Nm>Teszt Kft.</Nm>');
      expect(xml).toContain('<IBAN>HU03117730160000000000000000</IBAN>');

      // Employee 1
      expect(xml).toContain('<InstdAmt Ccy="HUF">450000</InstdAmt>');
      expect(xml).toContain('<Nm>Kovács János</Nm>');

      // Employee 2
      expect(xml).toContain('<InstdAmt Ccy="HUF">380500</InstdAmt>');
      expect(xml).toContain('<Nm>Nagy Anna</Nm>');
    });

    it('should escape XML special characters in employee names and debtor names', () => {
      const batch: GiroBatchParams = {
        companyName: 'Alpha & Omega Kft. <Pénzügy>',
        debtorIban: 'HU03117730160000000000000000',
        executionDate: '2026-11-10',
        batchReference: 'BER-2026-10',
        payoutItems: [
          {
            employeeId: 'emp-003',
            employeeName: 'Kiss "Művész" & Fia',
            bankAccount: '11773016-00000000-00000003',
            netSalary: 100000,
            remittanceInfo: 'Munkabér <100%> & jutalom',
          },
        ],
      };

      const xml = generateGiroPayrollXml(batch);

      expect(xml).toContain('Alpha &amp; Omega Kft. &lt;Pénzügy&gt;');
      expect(xml).toContain('Kiss &quot;Művész&quot; &amp; Fia');
      expect(xml).toContain('Munkabér &lt;100%&gt; &amp; jutalom');
    });
  });
});
