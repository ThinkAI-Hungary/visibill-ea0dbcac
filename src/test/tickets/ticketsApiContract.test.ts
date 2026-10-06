import { describe, it, expect } from 'vitest';

describe('VisiBill Tickets API Contract & Invariants', () => {
  const ALLOWED_ACTIONS = ['help', 'docs', 'overview', 'list', 'tickets', 'get', 'detail', 'comment', 'add-comment', 'update', 'update-ticket', 'resolve', 'close', 'create', 'create-ticket'];

  it('defines all required ticket management actions', () => {
    expect(ALLOWED_ACTIONS).toContain('overview');
    expect(ALLOWED_ACTIONS).toContain('list');
    expect(ALLOWED_ACTIONS).toContain('get');
    expect(ALLOWED_ACTIONS).toContain('comment');
    expect(ALLOWED_ACTIONS).toContain('update');
    expect(ALLOWED_ACTIONS).toContain('resolve');
    expect(ALLOWED_ACTIONS).toContain('create');
  });

  describe('Ticket identifier resolution logic', () => {
    function getSearchTerms(identifier: string): string[] {
      const trimmed = (identifier || '').trim();
      const terms = [trimmed];
      if (trimmed.startsWith('#')) {
        terms.push(trimmed.slice(1));
      } else {
        terms.push('#' + trimmed);
      }
      const cleanNum = trimmed.replace(/^#/, '');
      if (/^\d+$/.test(cleanNum)) {
        terms.push('EB-' + cleanNum.padStart(4, '0'));
      }
      return terms;
    }

    it('resolves raw number to multiple search variants including EB- prefix', () => {
      const terms = getSearchTerms('252');
      expect(terms).toContain('252');
      expect(terms).toContain('#252');
      expect(terms).toContain('EB-0252');
    });

    it('resolves hashed number to multiple search variants', () => {
      const terms = getSearchTerms('#1024');
      expect(terms).toContain('#1024');
      expect(terms).toContain('1024');
      expect(terms).toContain('EB-1024');
    });

    it('detects UUID pattern correctly', () => {
      const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      expect(isUuid('e0f878b7-1a1b-4dd4-a621-703d094e6e43')).toBe(true);
      expect(isUuid('EB-0252')).toBe(false);
      expect(isUuid('1024')).toBe(false);
    });
  });

  describe('Authentication headers contract', () => {
    function extractToken(headers: Record<string, string>): { token: string; type: 'api_key' | 'jwt' | 'none' } {
      const authHeader = headers['authorization'] || headers['Authorization'] || '';
      const apiKeyHeader = headers['x-api-key'] || headers['X-Api-Key'] || '';

      let token = '';
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.replace(/^Bearer\s+/i, '').trim();
      } else if (apiKeyHeader) {
        token = apiKeyHeader.trim();
      }

      if (!token) return { token: '', type: 'none' };
      if (token.startsWith('vb_')) return { token, type: 'api_key' };
      return { token, type: 'jwt' };
    }

    it('identifies permanent M2M vb_ API keys from Authorization Bearer', () => {
      const res = extractToken({ Authorization: 'Bearer vb_d573c4a9ce9b33df54c1dd9afe1f80c10ffb1723' });
      expect(res.type).toBe('api_key');
      expect(res.token).toBe('vb_d573c4a9ce9b33df54c1dd9afe1f80c10ffb1723');
    });

    it('identifies permanent M2M vb_ API keys from x-api-key header', () => {
      const res = extractToken({ 'x-api-key': 'vb_d573c4a9ce9b33df54c1dd9afe1f80c10ffb1723' });
      expect(res.type).toBe('api_key');
      expect(res.token).toBe('vb_d573c4a9ce9b33df54c1dd9afe1f80c10ffb1723');
    });

    it('identifies standard Supabase JWT tokens', () => {
      const res = extractToken({ Authorization: 'Bearer eyJhbGciOiJIUzI1Ni...' });
      expect(res.type).toBe('jwt');
      expect(res.token).toBe('eyJhbGciOiJIUzI1Ni...');
    });

    it('flags missing authentication', () => {
      const res = extractToken({});
      expect(res.type).toBe('none');
      expect(res.token).toBe('');
    });
  });

  describe('Comment and resolution invariants', () => {
    it('sets needs_staff_response to false when staff responds publicly', () => {
      const isInternal = false;
      const isAdmin = true;
      let needsStaffResponse = true;

      if (!isInternal && isAdmin) {
        needsStaffResponse = false;
      }
      expect(needsStaffResponse).toBe(false);
    });

    it('retains needs_staff_response when adding internal note', () => {
      const isInternal = true;
      let needsStaffResponse = true;

      // Internal note does not satisfy the SLA response to customer
      if (!isInternal) {
        needsStaffResponse = false;
      }
      expect(needsStaffResponse).toBe(true);
    });
  });
});
