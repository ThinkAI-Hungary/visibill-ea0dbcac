import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reportError } from '../errorReporter';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}));

describe('errorReporter exclusions and environment guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters out dev-sw and serviceworker errors from DB logging', async () => {
    const fromSpy = vi.spyOn(supabase, 'from');
    await reportError({
      type: 'unhandled',
      component: 'global',
      action: 'unhandled_rejection',
      message: "Failed to register a ServiceWorker for scope ('https://example.com') with script ('https://example.com/dev-sw.js?dev-sw'): A bad HTTP response code (404)",
    });

    expect(fromSpy).not.toHaveBeenCalled();
  });

  it('filters out network abort and offline errors from DB logging', async () => {
    const fromSpy = vi.spyOn(supabase, 'from');
    await reportError({
      type: 'db_query',
      component: 'useDashboardData',
      action: 'error',
      message: 'TypeError: NetworkError when attempting to fetch resource.',
    });

    expect(fromSpy).not.toHaveBeenCalled();
  });

  it('filters out browser extension and window.__go errors from DB logging', async () => {
    const fromSpy = vi.spyOn(supabase, 'from');
    await reportError({
      type: 'unhandled',
      component: 'global',
      action: 'unhandled_rejection',
      message: "Cannot read properties of undefined (reading 'slice')",
      error: {
        name: 'TypeError',
        message: "Cannot read properties of undefined (reading 'slice')",
        stack: "TypeError: Cannot read properties of undefined (reading 'slice')\n    at <anonymous>:5:209\n    at Array.forEach (<anonymous>)\n    at window.__go (<anonymous>:5:87)",
      },
    });

    expect(fromSpy).not.toHaveBeenCalled();
  });

  it('filters out chrome-extension stack errors from DB logging', async () => {
    const fromSpy = vi.spyOn(supabase, 'from');
    await reportError({
      type: 'unhandled',
      component: 'global',
      action: 'uncaught_error',
      message: 'Extension context invalidated',
      error: {
        stack: 'Error: Extension context invalidated\n    at chrome-extension://abcdefg/content.js:12:34',
      },
    });

    expect(fromSpy).not.toHaveBeenCalled();
  });
});
