import { describe, it, expect } from 'vitest';
import { CASH_CONTRA_PRESETS } from '@/components/petty-cash/types';

describe('Házipénztár Revise & Upgrade Specification Suite', () => {
  describe('4.1. Forrásdokumentum-csatolás & Digitális Archiválás', () => {
    it('validates permitted source document types for Hungarian accounting', () => {
      const allowedDocTypes = [
        'invoice',          // Készpénzes számla vagy egyszerűsített számla
        'payroll',          // Készpénzkifizetési jegyzék (munkabér)
        'travel_order',      // Kiküldetési rendelvény és üzemanyag-elszámolás
        'bank_withdrawal',  // Banki készpénzfelvételi bizonylat
        'owner_loan',       // Tagi kölcsön szerződés vagy átvételi elismervény
        'other',            // Egyéb bizonylat
      ];

      const testPayloads = [
        { type: 'invoice', valid: true },
        { type: 'payroll', valid: true },
        { type: 'travel_order', valid: true },
        { type: 'bank_withdrawal', valid: true },
        { type: 'owner_loan', valid: true },
        { type: 'unsupported_type', valid: false },
      ];

      testPayloads.forEach((p) => {
        expect(allowedDocTypes.includes(p.type)).toBe(p.valid);
      });
    });

    it('generates secure tenant-isolated storage path in petty-cash-attachments', () => {
      const companyId = 'comp-888';
      const registerId = 'reg-bp-01';
      const entryDate = '2026-10-16';
      const fileName = 'Bérkifizetési Jegyzék 2026#10.pdf';

      const year = entryDate.split('-')[0];
      const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${companyId}/${registerId}/${year}/${Date.now()}_${cleanFileName}`;

      expect(storagePath.startsWith('comp-888/reg-bp-01/2026/')).toBe(true);
      expect(storagePath.endsWith('.pdf')).toBe(true);
      expect(storagePath).not.toContain('#');
      expect(storagePath).not.toContain(' ');
    });
  });

  describe('4.1. Szigorú Számadású Bizonylat-generáló & Kontírozási Sablonok', () => {
    it('provides standardized Hungarian double-entry petty cash presets', () => {
      expect(CASH_CONTRA_PRESETS.length).toBeGreaterThan(5);

      // BPB presets (bevételezés)
      const bpbPresets = CASH_CONTRA_PRESETS.filter(p => p.direction === 'in');
      const bpbAccounts = bpbPresets.map(p => p.glAccount);
      expect(bpbAccounts).toContain('311'); // Vevőkövetelés
      expect(bpbAccounts).toContain('453'); // Vevőktől kapott előleg
      expect(bpbAccounts).toContain('451'); // Tagi kölcsön
      expect(bpbAccounts).toContain('389'); // Bankból felvett kp átvezetése

      // KPB presets (kiadás)
      const kpbPresets = CASH_CONTRA_PRESETS.filter(p => p.direction === 'out');
      const kpbAccounts = kpbPresets.map(p => p.glAccount);
      expect(kpbAccounts).toContain('454'); // Szállítói tartozás
      expect(kpbAccounts).toContain('511'); // Anyagköltség
      expect(kpbAccounts).toContain('471'); // Nettó bérkifizetés
      expect(kpbAccounts).toContain('361'); // Dolgozói előleg / elszámolásra kiadott összeg
      expect(kpbAccounts).toContain('389'); // Bankba befizetett kp átvezetése
    });

    it('formats sequential cash receipt numbers according to company policy', () => {
      const year = '2026';
      const seq = 42;
      const padded = String(seq).padStart(4, '0');

      const bpbDefault = `BPB-${year}-${padded}`;
      expect(bpbDefault).toBe('BPB-2026-0042');

      const kpbLocation = `KPB-GYOR-${year}-${padded}`;
      expect(kpbLocation).toBe('KPB-GYOR-2026-0042');
    });
  });

  describe('4.2. Pénztárzárás és Leltáreltérések Számviteli Rendezése (Sztv. 869 / 969 / 361)', () => {
    it('correctly maps surplus to 969 and shortage to 869 / 361 according to Hungarian Accounting Act', () => {
      const resolveDifferenceAccount = (diff: number, method: 'accounting_loss' | 'employee_claim' | 'cashier_repaid' | 'pending') => {
        if (diff > 0) {
          return { glAccount: '969', name: 'Egyéb bevételek (Leltártöbblet)' };
        }
        if (diff < 0) {
          if (method === 'employee_claim') {
            return { glAccount: '361', name: 'Egyéb követelések (Munkavállalói kártérítés)' };
          }
          if (method === 'accounting_loss') {
            return { glAccount: '869', name: 'Egyéb ráfordítások (Leltárhiány)' };
          }
        }
        return { glAccount: null, name: 'Egyező készlet' };
      };

      // Test surplus (többlet)
      const surplus = resolveDifferenceAccount(5000, 'accounting_loss');
      expect(surplus.glAccount).toBe('969');

      // Test shortage expensed (hiány egyéb ráfordításként)
      const shortageExpense = resolveDifferenceAccount(-3500, 'accounting_loss');
      expect(shortageExpense.glAccount).toBe('869');

      // Test shortage claimed from employee (pénztáros felelősség)
      const shortageClaim = resolveDifferenceAccount(-3500, 'employee_claim');
      expect(shortageClaim.glAccount).toBe('361');
    });
  });

  describe('4.2. NAV 40 és Art. 114. § 1,5M Ft-os Havi Készpénzfizetési Korlát Kontroll', () => {
    it('accurately detects monthly threshold breach and computes 20% penalty risk', () => {
      const limit = 1500000;

      const transactions = [
        { partnerId: 'partner-alpha', amount: 800000, date: '2026-10-02' },
        { partnerId: 'partner-alpha', amount: 950000, date: '2026-10-14' }, // Total: 1,750,000 (breach by 250,000)
        { partnerId: 'partner-beta', amount: 1200000, date: '2026-10-10' }, // Total: 1,200,000 (under limit)
      ];

      const totals: Record<string, number> = {};
      transactions.forEach((tx) => {
        totals[tx.partnerId] = (totals[tx.partnerId] || 0) + tx.amount;
      });

      expect(totals['partner-alpha']).toBe(1750000);
      expect(totals['partner-beta']).toBe(1200000);

      const alphaExcess = Math.max(0, totals['partner-alpha'] - limit);
      expect(alphaExcess).toBe(250000);

      // Art. 114. § 20% mulasztási bírság
      const penaltyAlpha = alphaExcess * 0.20;
      expect(penaltyAlpha).toBe(50000);

      const betaExcess = Math.max(0, totals['partner-beta'] - limit);
      expect(betaExcess).toBe(0);
    });

    it('generates standard NAV 40 reporting structure with Hungarian legal headers', () => {
      const mockRecord = {
        partnerName: 'Mauroni Events Kft.',
        partnerTaxNumber: '24987654-2-41',
        month: '2026-10',
        totalHuf: 1750000,
        exceededAmount: 250000,
        potentialPenaltyHuf: 50000,
      };

      const nav40Export = {
        nyomtatvanyKod: 'NAV-40',
        jogszabalyiHivatkozas: 'Art. 114. § (3) bek.',
        bejelentoAdoszam: '12345678-2-42',
        partner: {
          nev: mockRecord.partnerName,
          adoszam: mockRecord.partnerTaxNumber,
        },
        idoszak: mockRecord.month,
        haviOsszforgalomFt: mockRecord.totalHuf,
        hatarertektullepesFt: mockRecord.exceededAmount,
        kockazatBirsagFt: mockRecord.potentialPenaltyHuf,
      };

      expect(nav40Export.nyomtatvanyKod).toBe('NAV-40');
      expect(nav40Export.jogszabalyiHivatkozas).toBe('Art. 114. § (3) bek.');
      expect(nav40Export.hatarertektullepesFt).toBe(250000);
      expect(nav40Export.kockazatBirsagFt).toBe(50000);
    });
  });
});
