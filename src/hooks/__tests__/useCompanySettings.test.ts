import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCompanySettings } from '../useCompanySettings';

// Mock contexts
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'test-user-id' } }),
}));

vi.mock('@/contexts/CompanyContext', () => ({
  useCompany: () => ({
    selectedCompany: { id: 'test-company-id', name: 'Test Kft.' },
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

// Mock Supabase
const mockUpsert = vi.fn();
const mockSelect = vi.fn();
const mockMaybeSingle = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'company_settings') {
        return {
          select: mockSelect.mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: mockMaybeSingle,
            }),
          }),
          upsert: mockUpsert,
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
        };
      }
      return {};
    }),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  );
}

describe('useCompanySettings atomic upsert and behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockUpsert.mockResolvedValue({ data: null, error: null });
  });

  it('performs atomic upsert with only specified fields in payload to avoid overwriting defaults or other columns', async () => {
    const { result } = renderHook(() => useCompanySettings(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.saveMutation.mutateAsync({
        gl_date_basis: 'teljesites',
      });
    });

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const [payload, options] = mockUpsert.mock.calls[0];

    expect(options).toEqual({ onConflict: 'company_id' });
    expect(payload.company_id).toBe('test-company-id');
    expect(payload.gl_date_basis).toBe('teljesites');
    expect(payload.updated_at).toBeDefined();

    // Verify untouched fields are NOT in payload (they rely on DB defaults / existing values)
    expect(payload.work_start_time).toBeUndefined();
    expect(payload.work_end_time).toBeUndefined();
    expect(payload.admin_deadline).toBeUndefined();
    expect(payload.monthly_working_hours).toBeUndefined();
  });

  it('supports updating working hours without touching gl_date_basis', async () => {
    const { result } = renderHook(() => useCompanySettings(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.saveMutation.mutateAsync({
        monthly_working_hours: 160,
        work_start_time: '08:00',
      });
    });

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const [payload, options] = mockUpsert.mock.calls[0];

    expect(options).toEqual({ onConflict: 'company_id' });
    expect(payload.monthly_working_hours).toBe(160);
    expect(payload.work_start_time).toBe('08:00');
    expect(payload.gl_date_basis).toBeUndefined();
  });

  it('memoizes effectiveSettings to maintain reference stability across re-renders', async () => {
    const { result, rerender } = renderHook(() => useCompanySettings(), {
      wrapper: createWrapper(),
    });

    const firstEffectiveSettings = result.current.effectiveSettings;
    rerender();
    const secondEffectiveSettings = result.current.effectiveSettings;

    expect(firstEffectiveSettings).toBe(secondEffectiveSettings);
  });

  it('handles concurrent save calls gracefully with onConflict: "company_id"', async () => {
    const { result } = renderHook(() => useCompanySettings(), {
      wrapper: createWrapper(),
    });

    // Simulate rapid concurrent clicks
    await act(async () => {
      await Promise.all([
        result.current.saveMutation.mutateAsync({ gl_date_basis: 'teljesites' }),
        result.current.saveMutation.mutateAsync({ gl_date_basis: 'teljesites' }),
      ]);
    });

    expect(mockUpsert).toHaveBeenCalledTimes(2);
    for (const call of mockUpsert.mock.calls) {
      expect(call[1]).toEqual({ onConflict: 'company_id' });
    }
  });
});
