import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpgService } from '@/services/opgService';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => {
  const mockFrom = vi.fn();
  const mockRpc = vi.fn();
  const mockFunctions = {
    invoke: vi.fn(),
  };
  const mockAuth = {
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'usr-123' } } }),
  };

  return {
    supabase: {
      auth: mockAuth,
      from: mockFrom,
      rpc: mockRpc,
      functions: mockFunctions,
    },
  };
});

describe('OpgService NAV OPG Proxy Integrációs Tesztek', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('testCashRegisterConnection', () => {
    it('Sikeres NAV státusz lekérdezés esetén aktív státuszra állítja a gépet és visszaadja a naplótartományt', async () => {
      const mockRegister = {
        id: 'reg-1',
        company_id: 'comp-1',
        ap_code: 'A12345678',
        name: 'Teszt Kassza',
        status: 'pending',
      };

      // Mock DB select & update
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockRegister, error: null }),
        }),
      });

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'opg_cash_registers') {
          return {
            select: mockSelect,
            update: mockUpdate,
          };
        }
        return {};
      });

      // Mock Edge Function invoke
      (supabase.functions.invoke as any).mockResolvedValue({
        data: {
          success: true,
          data: {
            found: true,
            apNumber: 'A12345678',
            lastCommunicationDate: '2026-10-07T09:00:00Z',
            lastFileDate: '2026-10-07T09:00:00Z',
            minAvailableFileNumber: 1,
            maxAvailableFileNumber: 42,
          },
        },
        error: null,
      });

      const res = await OpgService.testCashRegisterConnection('reg-1');

      expect(res.success).toBe(true);
      expect(res.message).toContain('NAV OPG kapcsolat aktív!');
      expect(res.message).toContain('#1 - #42');

      // Ellenőrizzük, hogy meghívta-e az edge functiont a megfelelő paraméterekkel
      expect(supabase.functions.invoke).toHaveBeenCalledWith('nav-opg-proxy', {
        body: {
          action: 'query_status',
          company_id: 'comp-1',
          register_id: 'reg-1',
          ap_code: 'A12345678',
        },
      });

      // Ellenőrizzük, hogy aktív státuszra frissült a DB-ben
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'active',
          last_error_message: null,
        })
      );
    });

    it('INVALID_SECURITY_USER vagy NAV hiba esetén error státuszra állítja a gépet', async () => {
      const mockRegister = {
        id: 'reg-2',
        company_id: 'comp-1',
        ap_code: 'A99999999',
        name: 'Hibás Kassza',
        status: 'active',
      };

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockRegister, error: null }),
        }),
      });

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'opg_cash_registers') {
          return {
            select: mockSelect,
            update: mockUpdate,
          };
        }
        return {};
      });

      const errorMsg = "A NAV visszautasította a kérést (INVALID_SECURITY_USER). Kérjük ellenőrizze az 'OPG-napló-lekérdezés' jogosultságot!";
      (supabase.functions.invoke as any).mockResolvedValue({
        data: {
          success: false,
          error: errorMsg,
        },
        error: null,
      });

      const res = await OpgService.testCashRegisterConnection('reg-2');

      expect(res.success).toBe(false);
      expect(res.message).toContain('INVALID_SECURITY_USER');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          last_error_message: errorMsg,
        })
      );
    });
  });

  describe('syncTransactions', () => {
    it('Meghívja a nav-opg-proxy sync_transactions akcióját és audit naplót vezet', async () => {
      const mockLogEntry = { id: 'log-123' };

      const mockInsertLog = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockLogEntry, error: null }),
        }),
      });

      const mockUpdateLog = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'opg_sync_logs') {
          return {
            insert: mockInsertLog,
            update: mockUpdateLog,
          };
        }
        return {};
      });

      (supabase.functions.invoke as any).mockResolvedValue({
        data: {
          success: true,
          data: {
            fetched: 15,
            newRecords: 12,
            duplicates: 3,
            errors: 0,
          },
        },
        error: null,
      });

      const stats = await OpgService.syncTransactions('comp-1', 'reg-1');

      expect(stats.fetched).toBe(15);
      expect(stats.newRecords).toBe(12);
      expect(stats.duplicates).toBe(3);
      expect(stats.errors).toBe(0);

      expect(supabase.functions.invoke).toHaveBeenCalledWith('nav-opg-proxy', {
        body: {
          action: 'sync_transactions',
          company_id: 'comp-1',
          register_id: 'reg-1',
          period_from: undefined,
          period_to: undefined,
        },
      });

      expect(mockUpdateLog).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          records_fetched: 15,
          records_new: 12,
          records_duplicated: 3,
        })
      );
    });
  });
});
