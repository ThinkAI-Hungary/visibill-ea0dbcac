import { describe, it, expect } from 'vitest';
import { sanitizePartnerId, validatePettyCashEntryPayload } from '@/components/petty-cash/types';

describe('Petty Cash Manual Entry Validation & Sanitization (Prove-It)', () => {
  describe('sanitizePartnerId', () => {
    it('returns null for "none", empty strings, whitespace, and falsy values', () => {
      expect(sanitizePartnerId('none')).toBeNull();
      expect(sanitizePartnerId('')).toBeNull();
      expect(sanitizePartnerId('   ')).toBeNull();
      expect(sanitizePartnerId(null)).toBeNull();
      expect(sanitizePartnerId(undefined)).toBeNull();
    });

    it('returns trimmed valid partner UUID when present', () => {
      const validUuid = '5364d0be-e92a-4b94-9704-f457cf71f140';
      expect(sanitizePartnerId(validUuid)).toBe(validUuid);
      expect(sanitizePartnerId(`  ${validUuid}  `)).toBe(validUuid);
    });
  });

  describe('validatePettyCashEntryPayload', () => {
    it('fails when register_id is empty string, whitespace, null, or undefined', () => {
      const baseValid = {
        register_id: '',
        amount: 5000,
        description: 'Irodaszer vásárlás',
      };

      const resEmpty = validatePettyCashEntryPayload(baseValid);
      expect(resEmpty.valid).toBe(false);
      expect(resEmpty.error).toBe('Pénztár kiválasztása kötelező!');

      const resWhitespace = validatePettyCashEntryPayload({ ...baseValid, register_id: '   ' });
      expect(resWhitespace.valid).toBe(false);

      const resNull = validatePettyCashEntryPayload({ ...baseValid, register_id: null });
      expect(resNull.valid).toBe(false);

      const resUndefined = validatePettyCashEntryPayload({ ...baseValid, register_id: undefined });
      expect(resUndefined.valid).toBe(false);
    });

    it('fails when amount is zero or negative for standard entries', () => {
      const validReg = 'c132676d-85c5-4e2a-bde1-d966766bb94f';
      expect(validatePettyCashEntryPayload({ register_id: validReg, amount: 0, description: 'Teszt' }).valid).toBe(false);
      expect(validatePettyCashEntryPayload({ register_id: validReg, amount: -100, description: 'Teszt' }).valid).toBe(false);
    });

    it('fails when description is empty or whitespace for standard entries', () => {
      const validReg = 'c132676d-85c5-4e2a-bde1-d966766bb94f';
      expect(validatePettyCashEntryPayload({ register_id: validReg, amount: 1000, description: '' }).valid).toBe(false);
      expect(validatePettyCashEntryPayload({ register_id: validReg, amount: 1000, description: '   ' }).valid).toBe(false);
    });

    it('succeeds with valid register, amount, and description', () => {
      const validReg = 'c132676d-85c5-4e2a-bde1-d966766bb94f';
      const result = validatePettyCashEntryPayload({
        register_id: validReg,
        amount: 15000,
        description: 'Postaköltség készpénzben',
      });
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('validates invoiceMode correctly: requires selected invoices', () => {
      const validReg = 'c132676d-85c5-4e2a-bde1-d966766bb94f';
      const failInv = validatePettyCashEntryPayload({
        register_id: validReg,
        amount: 0,
        description: '',
        invoiceMode: true,
        selectedInvoiceCount: 0,
      });
      expect(failInv.valid).toBe(false);
      expect(failInv.error).toBe('Legalább egy számla kiválasztása kötelező!');

      const passInv = validatePettyCashEntryPayload({
        register_id: validReg,
        amount: 0,
        description: '',
        invoiceMode: true,
        selectedInvoiceCount: 2,
      });
      expect(passInv.valid).toBe(true);
    });
  });

  describe('settle_invoices_via_petty_cash payload validation', () => {
    it('ensures valid payload structure for atomic RPC call', () => {
      const companyId = 'a1111111-2222-3333-4444-555555555555';
      const registerId = 'b1111111-2222-3333-4444-555555555555';
      const entryDate = '2026-09-18';
      const selectedInvoiceIds = ['c1111111-2222-3333-4444-555555555555', 'd1111111-2222-3333-4444-555555555555'];
      const description = 'Egyéni megjegyzés';

      const validation = validatePettyCashEntryPayload({
        register_id: registerId,
        amount: 0,
        description,
        invoiceMode: true,
        selectedInvoiceCount: selectedInvoiceIds.length,
      });

      expect(validation.valid).toBe(true);

      const rpcPayload = {
        p_company_id: companyId,
        p_register_id: registerId.trim(),
        p_entry_date: entryDate,
        p_invoice_ids: selectedInvoiceIds,
        p_description: description.trim() || null,
      };

      expect(rpcPayload.p_company_id).toBe(companyId);
      expect(rpcPayload.p_register_id).toBe(registerId);
      expect(rpcPayload.p_invoice_ids).toHaveLength(2);
      expect(rpcPayload.p_description).toBe('Egyéni megjegyzés');
    });
  });
});
