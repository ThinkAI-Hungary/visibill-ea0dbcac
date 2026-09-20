import { describe, it, expect } from 'vitest';
import huCategories from '@/locales/hu/categories.json';
import hrCategories from '@/locales/hr/categories.json';

describe('Auto Categorize Job and Progress Bar', () => {
  it('contains all required translation keys for auto-categorization in Hungarian', () => {
    expect(huCategories.auto_categorize).toBe('Automatikus kategorizálás');
    expect(huCategories.auto_categorize_in_progress).toBe('Kategorizálás folyamatban...');
    expect(huCategories.auto_categorize_gathering).toBe('Számlák összegyűjtése...');
    expect(huCategories.auto_categorize_progress).toContain('{{processed}}');
    expect(huCategories.auto_categorize_progress).toContain('{{total}}');
    expect(huCategories.auto_categorize_success).toContain('{{count}}');
    expect(huCategories.auto_categorize_partial_title).toContain('{{categorized}}');
    expect(huCategories.auto_categorize_partial_title).toContain('{{total}}');
    expect(huCategories.auto_categorize_partial_desc).toContain('{{uncategorized}}');
    expect(huCategories.auto_categorize_none).toBeDefined();
    expect(huCategories.auto_categorize_error).toBeDefined();
  });

  it('contains all required translation keys for auto-categorization in Croatian', () => {
    expect(hrCategories.auto_categorize).toBe('Automatsko kategoriziranje');
    expect(hrCategories.auto_categorize_in_progress).toBe('Kategoriziranje u tijeku...');
    expect(hrCategories.auto_categorize_gathering).toBe('Prikupljanje računa...');
    expect(hrCategories.auto_categorize_progress).toContain('{{processed}}');
    expect(hrCategories.auto_categorize_progress).toContain('{{total}}');
    expect(hrCategories.auto_categorize_success).toContain('{{count}}');
    expect(hrCategories.auto_categorize_partial_title).toContain('{{categorized}}');
    expect(hrCategories.auto_categorize_partial_title).toContain('{{total}}');
    expect(hrCategories.auto_categorize_partial_desc).toContain('{{uncategorized}}');
    expect(hrCategories.auto_categorize_none).toBeDefined();
    expect(hrCategories.auto_categorize_error).toBeDefined();
  });

  it('calculates progress percentage correctly with bounds protection', () => {
    const calcProgress = (processed: number, total: number) => {
      if (total <= 0) return 0;
      return Math.min(100, Math.max(0, Math.round((processed / total) * 100)));
    };

    expect(calcProgress(0, 0)).toBe(0);
    expect(calcProgress(0, 100)).toBe(0);
    expect(calcProgress(25, 100)).toBe(25);
    expect(calcProgress(50, 154)).toBe(32);
    expect(calcProgress(154, 154)).toBe(100);
    expect(calcProgress(200, 154)).toBe(100); // capped at 100
  });

  it('detects stale background jobs correctly based on timestamp threshold', () => {
    const STALE_JOB_MS = 10 * 60 * 1000;
    const now = Date.now();

    const isStale = (createdAt: string) => {
      const age = now - new Date(createdAt).getTime();
      return age >= STALE_JOB_MS;
    };

    const recentJob = new Date(now - 2 * 60 * 1000).toISOString(); // 2 mins ago
    const boundaryJob = new Date(now - 9 * 60 * 1000).toISOString(); // 9 mins ago
    const staleJob = new Date(now - 15 * 60 * 1000).toISOString(); // 15 mins ago

    expect(isStale(recentJob)).toBe(false);
    expect(isStale(boundaryJob)).toBe(false);
    expect(isStale(staleJob)).toBe(true);
  });

  it('correctly maps job states to user interface display states', () => {
    const getUiState = (isStarting: boolean, job: { status: string; total_invoices: number } | null) => {
      const isRunning = isStarting || (job !== null && ['pending', 'processing'].includes(job.status));
      const isGathering = isStarting || job?.status === 'pending' || (job?.status === 'processing' && job.total_invoices === 0);
      return { isRunning, isGathering };
    };

    // 1. Initial idle
    expect(getUiState(false, null)).toEqual({ isRunning: false, isGathering: false });

    // 2. User clicked, starting
    expect(getUiState(true, null)).toEqual({ isRunning: true, isGathering: true });

    // 3. Job created in pending state
    expect(getUiState(false, { status: 'pending', total_invoices: 0 })).toEqual({ isRunning: true, isGathering: true });

    // 4. Job processing with candidates
    expect(getUiState(false, { status: 'processing', total_invoices: 80 })).toEqual({ isRunning: true, isGathering: false });

    // 5. Job completed
    expect(getUiState(false, { status: 'completed', total_invoices: 80 })).toEqual({ isRunning: false, isGathering: false });

    // 6. Job failed
    expect(getUiState(false, { status: 'error', total_invoices: 80 })).toEqual({ isRunning: false, isGathering: false });
  });

  it('detects existing active jobs within 5-minute window for concurrency protection', () => {
    const ACTIVE_WINDOW_MS = 5 * 60 * 1000;
    const now = Date.now();

    const hasActiveConcurrentJob = (jobs: { status: string; created_at: string }[]) => {
      return jobs.some(j => {
        if (!['pending', 'processing'].includes(j.status)) return false;
        const age = now - new Date(j.created_at).getTime();
        return age >= 0 && age < ACTIVE_WINDOW_MS;
      });
    };

    // Case 1: Job pending created 1 minute ago -> active concurrent job detected!
    expect(hasActiveConcurrentJob([
      { status: 'pending', created_at: new Date(now - 60 * 1000).toISOString() }
    ])).toBe(true);

    // Case 2: Job processing created 4 minutes ago -> active concurrent job detected!
    expect(hasActiveConcurrentJob([
      { status: 'processing', created_at: new Date(now - 4 * 60 * 1000).toISOString() }
    ])).toBe(true);

    // Case 3: Job completed 1 minute ago -> no active job
    expect(hasActiveConcurrentJob([
      { status: 'completed', created_at: new Date(now - 60 * 1000).toISOString() }
    ])).toBe(false);

    // Case 4: Old job pending created 8 minutes ago (stale) -> ignored
    expect(hasActiveConcurrentJob([
      { status: 'pending', created_at: new Date(now - 8 * 60 * 1000).toISOString() }
    ])).toBe(false);
  });
});

