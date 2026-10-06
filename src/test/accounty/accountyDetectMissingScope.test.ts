import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('accounty-detect-missing Edge Function Contract & Scope Invariants', () => {
  const functionPath = path.resolve(__dirname, '../../../supabase/functions/accounty-detect-missing/index.ts');
  const functionCode = fs.readFileSync(functionPath, 'utf-8');

  it('does not reference out-of-scope assignedUsers in client contact section', () => {
    // Locate the client contact section
    const clientSectionStart = functionCode.indexOf('// ── Notify client contact (if configured) ──');
    expect(clientSectionStart).toBeGreaterThan(0);

    const clientSection = functionCode.slice(clientSectionStart);
    // assignedUsers must NOT appear anywhere in the client contact section
    expect(clientSection).not.toContain('assignedUsers');
  });

  it('uses clientAssignments to extract creator for portal token generation', () => {
    expect(functionCode).toContain('const creator = clientAssignments?.[0]?.accountant_user_id');
    expect(functionCode).toContain('if (!cToken && creator)');
  });

  describe('Portal token creation business logic invariants', () => {
    interface PortalTokenInput {
      existingToken?: string | null;
      clientAssignments: Array<{ accountant_user_id: string; accounting_firm_id?: string }> | null;
      companyId: string;
      appUrl?: string;
      companyName: string;
    }

    interface PortalTokenResult {
      token: string | null;
      clientPortalUrl: string;
      createdRecord?: {
        company_id: string;
        token: string;
        created_by: string;
        expires_at: string;
        is_active: boolean;
      };
    }

    function resolvePortalToken(input: PortalTokenInput): PortalTokenResult {
      let cToken = input.existingToken || null;
      let createdRecord: PortalTokenResult['createdRecord'];

      const creator = input.clientAssignments?.[0]?.accountant_user_id;
      if (!cToken && creator) {
        const newToken = 'mock-uuid-token-12345';
        const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
        createdRecord = {
          company_id: input.companyId,
          token: newToken,
          created_by: creator,
          expires_at: expiresAt,
          is_active: true,
        };
        cToken = createdRecord.token;
      }

      let clientPortalUrl = '';
      if (cToken) {
        const appUrl = input.appUrl || 'https://app.visibill.hu';
        clientPortalUrl = `${appUrl}/portal/${cToken}?company_name=${encodeURIComponent(input.companyName)}`;
      }

      return {
        token: cToken,
        clientPortalUrl,
        createdRecord,
      };
    }

    it('reuses existing valid token without creating a duplicate', () => {
      const result = resolvePortalToken({
        existingToken: 'existing-magic-token',
        clientAssignments: [{ accountant_user_id: 'acc-uuid-1' }],
        companyId: 'comp-uuid-1',
        companyName: 'Test Cég Kft.',
      });

      expect(result.token).toBe('existing-magic-token');
      expect(result.createdRecord).toBeUndefined();
      expect(result.clientPortalUrl).toBe('https://app.visibill.hu/portal/existing-magic-token?company_name=Test%20C%C3%A9g%20Kft.');
    });

    it('generates a new token when no active token exists and creator is present', () => {
      const result = resolvePortalToken({
        existingToken: null,
        clientAssignments: [{ accountant_user_id: 'acc-uuid-88' }],
        companyId: 'comp-uuid-1',
        companyName: 'Test Cég Kft.',
      });

      expect(result.token).toBe('mock-uuid-token-12345');
      expect(result.createdRecord).toBeDefined();
      expect(result.createdRecord?.created_by).toBe('acc-uuid-88');
      expect(result.createdRecord?.company_id).toBe('comp-uuid-1');
      expect(result.createdRecord?.is_active).toBe(true);
      expect(result.clientPortalUrl).toContain('/portal/mock-uuid-token-12345');
    });

    it('gracefully handles company without assigned accountant without crashing', () => {
      const result = resolvePortalToken({
        existingToken: null,
        clientAssignments: [],
        companyId: 'comp-uuid-1',
        companyName: 'Test Cég Kft.',
      });

      expect(result.token).toBeNull();
      expect(result.createdRecord).toBeUndefined();
      expect(result.clientPortalUrl).toBe('');
    });
  });
});
