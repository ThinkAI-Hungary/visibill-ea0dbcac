import { describe, it, expect } from 'vitest';
import { queryKeys } from '@/lib/queryKeys';

/**
 * Tests for all Accounty-related query keys.
 * Ensures they produce deterministic, properly scoped cache keys.
 */

describe('Accounty Query Keys', () => {
  // ── accountyClients ──
  describe('accountyClients', () => {
    it('includes user ID for per-user scoping', () => {
      const key = queryKeys.accountyClients('user-123');
      expect(key).toEqual(['accounty-clients', 'user-123', undefined, undefined]);
    });

    it('produces different keys for different users', () => {
      const key1 = queryKeys.accountyClients('user-1');
      const key2 = queryKeys.accountyClients('user-2');
      expect(key1).not.toEqual(key2);
    });

    it('returns readonly tuple', () => {
      const key = queryKeys.accountyClients('user-1');
      expect(key).toHaveLength(4);
    });
  });

  // ── accountyMissingItems ──
  describe('accountyMissingItems', () => {
    it('includes company ID for per-company scoping', () => {
      const key = queryKeys.accountyMissingItems('comp-456');
      expect(key).toEqual(['accounty-missing-items', 'comp-456']);
    });

    it('produces different keys for different companies', () => {
      const key1 = queryKeys.accountyMissingItems('comp-1');
      const key2 = queryKeys.accountyMissingItems('comp-2');
      expect(key1).not.toEqual(key2);
    });
  });

  // ── accountyAllMissingItems ──
  describe('accountyAllMissingItems', () => {
    it('includes user ID', () => {
      const key = queryKeys.accountyAllMissingItems('user-abc');
      expect(key).toEqual(['accounty-all-missing-items', 'user-abc']);
    });
  });

  // ── accountyDeadlines ──
  describe('accountyDeadlines', () => {
    it('includes user ID', () => {
      const key = queryKeys.accountyDeadlines('user-def');
      expect(key).toEqual(['accounty-deadlines', 'user-def']);
    });
  });

  // ── accountyTaxProfile ──
  describe('accountyTaxProfile', () => {
    it('includes company ID', () => {
      const key = queryKeys.accountyTaxProfile('comp-789');
      expect(key).toEqual(['accounty-tax-profile', 'comp-789']);
    });
  });

  // ── accountyKpis ──
  describe('accountyKpis', () => {
    it('includes user ID', () => {
      const key = queryKeys.accountyKpis('user-xyz');
      expect(key).toEqual(['accounty-kpis', 'user-xyz', undefined, undefined]);
    });
  });

  // ── accountyPortalTokens ──
  describe('accountyPortalTokens', () => {
    it('includes company ID', () => {
      const key = queryKeys.accountyPortalTokens('comp-aaa');
      expect(key).toEqual(['accounty-portal-tokens', 'comp-aaa']);
    });
  });

  // ── accountyCommunicationPrefs ──
  describe('accountyCommunicationPrefs', () => {
    it('includes company ID', () => {
      const key = queryKeys.accountyCommunicationPrefs('comp-bbb');
      expect(key).toEqual(['accounty-communication-prefs', 'comp-bbb']);
    });
  });

  // ── accountyAuditLog ──
  describe('accountyAuditLog', () => {
    it('includes filters object', () => {
      const filters = { action: 'login', userId: 'user-1' };
      const key = queryKeys.accountyAuditLog(filters);
      expect(key).toEqual(['accounty-audit-log', { action: 'login', userId: 'user-1' }]);
    });

    it('works with undefined filters', () => {
      const key = queryKeys.accountyAuditLog(undefined);
      expect(key).toEqual(['accounty-audit-log', undefined]);
    });
  });

  // ── accountyGdprRequests ──
  describe('accountyGdprRequests', () => {
    it('returns static key with no parameters', () => {
      const key = queryKeys.accountyGdprRequests();
      expect(key).toEqual(['accounty-gdpr-requests']);
    });
  });

  // ── accountyTemplates ──
  describe('accountyTemplates', () => {
    it('includes optional category', () => {
      const key = queryKeys.accountyTemplates('email');
      expect(key).toEqual(['accounty-templates', 'email']);
    });

    it('works without category', () => {
      const key = queryKeys.accountyTemplates();
      expect(key).toEqual(['accounty-templates', undefined]);
    });
  });

  // ── accountyTemplateVersions ──
  describe('accountyTemplateVersions', () => {
    it('includes template ID', () => {
      const key = queryKeys.accountyTemplateVersions('tmpl-1');
      expect(key).toEqual(['accounty-template-versions', 'tmpl-1']);
    });
  });

  // ── accountyJobCodes ──
  describe('accountyJobCodes', () => {
    it('includes active filter', () => {
      const key = queryKeys.accountyJobCodes(true);
      expect(key).toEqual(['accounty-job-codes', true]);
    });

    it('includes inactive filter', () => {
      const key = queryKeys.accountyJobCodes(false);
      expect(key).toEqual(['accounty-job-codes', false]);
    });
  });

  // ── accountyGlobalTaxParams ──
  describe('accountyGlobalTaxParams', () => {
    it('includes year', () => {
      const key = queryKeys.accountyGlobalTaxParams(2024);
      expect(key).toEqual(['accounty-global-tax-params', 2024]);
    });

    it('produces different keys for different years', () => {
      const key2024 = queryKeys.accountyGlobalTaxParams(2024);
      const key2025 = queryKeys.accountyGlobalTaxParams(2025);
      expect(key2024).not.toEqual(key2025);
    });
  });

  // ── accountyLegalUpdates ──
  describe('accountyLegalUpdates', () => {
    it('returns static key', () => {
      const key = queryKeys.accountyLegalUpdates();
      expect(key).toEqual(['accounty-legal-updates']);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// New Accounty Settings/Profile query keys
// ═══════════════════════════════════════════════════════════════

describe('Accounty Settings/Profile Query Keys', () => {
  describe('accountyFirmData', () => {
    it('includes user ID', () => {
      expect(queryKeys.accountyFirmData('user-1')).toEqual(['accounty-firm-data', 'user-1']);
    });
  });

  describe('accountyFirmMembers', () => {
    it('includes company ID', () => {
      expect(queryKeys.accountyFirmMembers('comp-1')).toEqual(['accounty-firm-members', 'comp-1']);
    });
  });

  describe('accountyTeamMembers', () => {
    it('includes optional firm ID', () => {
      expect(queryKeys.accountyTeamMembers('firm-1')).toEqual(['accounty-team-members', 'firm-1']);
    });
    it('works with undefined firm ID', () => {
      expect(queryKeys.accountyTeamMembers(undefined)).toEqual(['accounty-team-members', undefined]);
    });
  });

  describe('accountyMessages', () => {
    it('includes company ID', () => {
      expect(queryKeys.accountyMessages('comp-abc')).toEqual(['accounty-messages', 'comp-abc']);
    });
  });

  describe('accountyRole', () => {
    it('includes user ID', () => {
      expect(queryKeys.accountyRole('user-xyz')).toEqual(['accounty-role', 'user-xyz']);
    });
  });

  describe('accountyModulePermissions', () => {
    it('returns static key', () => {
      expect(queryKeys.accountyModulePermissions()).toEqual(['accounty-module-permissions']);
    });
  });

  describe('accountyDocuments', () => {
    it('includes company and doc type', () => {
      expect(queryKeys.accountyDocuments('comp-1', 'payslip')).toEqual(['accounty-documents', 'comp-1', 'payslip']);
    });
    it('works without doc type', () => {
      expect(queryKeys.accountyDocuments('comp-1')).toEqual(['accounty-documents', 'comp-1', undefined]);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// Query key uniqueness tests
// ═══════════════════════════════════════════════════════════════

describe('Accounty Query Key Uniqueness', () => {
  it('all accounty query key prefixes are unique', () => {
    const prefixes = [
      queryKeys.accountyClients('x')[0],
      queryKeys.accountyMissingItems('x')[0],
      queryKeys.accountyAllMissingItems('x')[0],
      queryKeys.accountyDeadlines('x')[0],
      queryKeys.accountyTaxProfile('x')[0],
      queryKeys.accountyKpis('x')[0],
      queryKeys.accountyPortalTokens('x')[0],
      queryKeys.accountyCommunicationPrefs('x')[0],
      queryKeys.accountyAuditLog()[0],
      queryKeys.accountyGdprRequests()[0],
      queryKeys.accountyTemplates()[0],
      queryKeys.accountyTemplateVersions()[0],
      queryKeys.accountyJobCodes()[0],
      queryKeys.accountyGlobalTaxParams(2024)[0],
      queryKeys.accountyLegalUpdates()[0],
      queryKeys.accountyFirmData('x')[0],
      queryKeys.accountyFirmMembers('x')[0],
      queryKeys.accountyTeamMembers('x')[0],
      queryKeys.accountyMessages('x')[0],
      queryKeys.accountyRole('x')[0],
      queryKeys.accountyModulePermissions()[0],
      queryKeys.accountyDocuments('x')[0],
      queryKeys.accountyMissingCounts('x')[0],
    ];

    const uniquePrefixes = new Set(prefixes);
    expect(uniquePrefixes.size).toBe(prefixes.length);
  });

  it('all accounty keys start with "accounty-" prefix', () => {
    const keys = [
      queryKeys.accountyClients('x')[0],
      queryKeys.accountyMissingItems('x')[0],
      queryKeys.accountyAllMissingItems('x')[0],
      queryKeys.accountyDeadlines('x')[0],
      queryKeys.accountyTaxProfile('x')[0],
      queryKeys.accountyKpis('x')[0],
      queryKeys.accountyPortalTokens('x')[0],
      queryKeys.accountyCommunicationPrefs('x')[0],
      queryKeys.accountyAuditLog()[0],
      queryKeys.accountyGdprRequests()[0],
      queryKeys.accountyTemplates()[0],
      queryKeys.accountyTemplateVersions()[0],
      queryKeys.accountyJobCodes()[0],
      queryKeys.accountyGlobalTaxParams(2024)[0],
      queryKeys.accountyLegalUpdates()[0],
      queryKeys.accountyFirmData('x')[0],
      queryKeys.accountyFirmMembers('x')[0],
      queryKeys.accountyTeamMembers('x')[0],
      queryKeys.accountyMessages('x')[0],
      queryKeys.accountyRole('x')[0],
      queryKeys.accountyModulePermissions()[0],
      queryKeys.accountyDocuments('x')[0],
      queryKeys.accountyMissingCounts('x')[0],
    ];

    for (const key of keys) {
      expect(key).toMatch(/^accounty-/);
    }
  });
});

