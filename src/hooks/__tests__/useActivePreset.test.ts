import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useActivePreset } from '../useActivePreset';

// Mock contexts
vi.mock('@/contexts/CompanyContext', () => ({
  useOptionalCompany: () => ({
    selectedCompany: { id: 'test-company-1', country_code: 'HU' },
  }),
}));

vi.mock('@/lib/errorReporter', () => ({
  reportError: vi.fn(),
}));

const mockPresetsData = [
  { id: 'generic-1', type: 'generic', name: 'Általános', company_id: null, is_active: false },
  { id: 'custom-mandala', type: 'custom', name: 'Mandala 2026', company_id: 'test-company-1', is_active: true },
];

let currentDbPresets = [...mockPresetsData];

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'chart_of_accounts_presets') {
        return {
          select: vi.fn().mockImplementation(() => Promise.resolve({ data: currentDbPresets, error: null })),
        };
      }
      return {};
    }),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  );
}

describe('useActivePreset', () => {
  beforeEach(() => {
    localStorage.clear();
    currentDbPresets = [...mockPresetsData];
    vi.clearAllMocks();
  });

  it('selects active custom preset when available', async () => {
    const { result } = renderHook(() => useActivePreset('test-company-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.activePresetId).toBe('custom-mandala');
  });

  it('does not reset explicitly selected preset to generic when activePresetId is set', async () => {
    const { result } = renderHook(() => useActivePreset('test-company-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Explicitly set to a newly created preset
    act(() => {
      result.current.setActivePresetId('custom-mandala');
    });

    expect(result.current.activePresetId).toBe('custom-mandala');
    expect(localStorage.getItem('visibill_active_preset_test-company-1')).toBe('custom-mandala');
  });
});
