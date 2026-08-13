import { describe, it, expect } from 'vitest';
import { PATH_TO_MODULE, type AccountyModule } from '@/hooks/useAccountyPermissions';

/**
 * Tests for the PATH_TO_MODULE mapping from useAccountyPermissions.ts.
 * Validates that every sidebar route is correctly mapped to a module name.
 */

describe('PATH_TO_MODULE mapping', () => {
  it('maps /eaisybooks to portfolio', () => {
    expect(PATH_TO_MODULE['/eaisybooks']).toBe('portfolio');
  });

  it('maps /eaisybooks/missing-invoices to missing_invoices', () => {
    expect(PATH_TO_MODULE['/eaisybooks/missing-invoices']).toBe('missing_invoices');
  });

  it('maps /eaisybooks/tax-calendar to tax_calendar', () => {
    expect(PATH_TO_MODULE['/eaisybooks/tax-calendar']).toBe('tax_calendar');
  });

  it('maps /eaisybooks/reports to reports', () => {
    expect(PATH_TO_MODULE['/eaisybooks/reports']).toBe('reports');
  });

  it('maps /eaisybooks/approval-queue to approval_queue', () => {
    expect(PATH_TO_MODULE['/eaisybooks/approval-queue']).toBe('approval_queue');
  });

  it('maps /eaisybooks/alerts to alerts', () => {
    expect(PATH_TO_MODULE['/eaisybooks/alerts']).toBe('alerts');
  });

  it('maps /eaisybooks/nav-deadlines to nav_deadlines', () => {
    expect(PATH_TO_MODULE['/eaisybooks/nav-deadlines']).toBe('nav_deadlines');
  });

  it('maps /eaisybooks/payroll-portfolio to payroll', () => {
    expect(PATH_TO_MODULE['/eaisybooks/payroll-portfolio']).toBe('payroll');
  });

  it('maps /eaisybooks/onboarding to onboarding', () => {
    expect(PATH_TO_MODULE['/eaisybooks/onboarding']).toBe('onboarding');
  });

  it('maps /eaisybooks/tao to tao', () => {
    expect(PATH_TO_MODULE['/eaisybooks/tao']).toBe('tao');
  });

  it('maps /eaisybooks/settings to settings', () => {
    expect(PATH_TO_MODULE['/eaisybooks/settings']).toBe('settings');
  });

  it('maps /eaisybooks/tickets to tickets', () => {
    expect(PATH_TO_MODULE['/eaisybooks/tickets']).toBe('tickets');
  });

  it('maps /eaisybooks/ai-assistant to ai_assistant', () => {
    expect(PATH_TO_MODULE['/eaisybooks/ai-assistant']).toBe('ai_assistant');
  });

  it('maps /eaisybooks/help to help', () => {
    expect(PATH_TO_MODULE['/eaisybooks/help']).toBe('help');
  });

  it('maps /eaisybooks/profile/settings to profile', () => {
    expect(PATH_TO_MODULE['/eaisybooks/profile/settings']).toBe('profile');
  });

  // Admin routes
  it('maps /eaisybooks/admin/audit to admin_audit', () => {
    expect(PATH_TO_MODULE['/eaisybooks/admin/audit']).toBe('admin_audit');
  });

  it('maps /eaisybooks/admin/gdpr to admin_gdpr', () => {
    expect(PATH_TO_MODULE['/eaisybooks/admin/gdpr']).toBe('admin_gdpr');
  });

  it('maps /eaisybooks/admin/templates to admin_templates', () => {
    expect(PATH_TO_MODULE['/eaisybooks/admin/templates']).toBe('admin_templates');
  });

  it('maps /eaisybooks/admin/job-codes to admin_job_codes', () => {
    expect(PATH_TO_MODULE['/eaisybooks/admin/job-codes']).toBe('admin_job_codes');
  });

  it('maps /eaisybooks/admin/tax-parameters to admin_tax_params', () => {
    expect(PATH_TO_MODULE['/eaisybooks/admin/tax-parameters']).toBe('admin_tax_params');
  });

  it('maps /eaisybooks/admin/legal-updates to admin_legal', () => {
    expect(PATH_TO_MODULE['/eaisybooks/admin/legal-updates']).toBe('admin_legal');
  });

  it('maps /eaisybooks/admin/office-settings to admin_office', () => {
    expect(PATH_TO_MODULE['/eaisybooks/admin/office-settings']).toBe('admin_office');
  });

  it('maps /eaisybooks/admin/permissions to admin_permissions', () => {
    expect(PATH_TO_MODULE['/eaisybooks/admin/permissions']).toBe('admin_permissions');
  });

  it('maps /eaisybooks/admin/accountants to admin_accountants', () => {
    expect(PATH_TO_MODULE['/eaisybooks/admin/accountants']).toBe('admin_accountants');
  });

  // Structural tests
  it('has exactly 24 path mappings', () => {
    expect(Object.keys(PATH_TO_MODULE)).toHaveLength(24);
  });

  it('all module values are valid AccountyModule values', () => {
    const validModules: AccountyModule[] = [
      'portfolio', 'missing_invoices', 'tax_calendar', 'reports',
      'approval_queue', 'alerts', 'nav_deadlines', 'payroll',
      'onboarding', 'tao', 'settings', 'admin_audit', 'admin_gdpr',
      'admin_templates', 'admin_job_codes', 'admin_tax_params',
      'admin_legal', 'admin_office', 'admin_permissions',
      'admin_accountants', 'tickets', 'ai_assistant', 'help', 'profile',
    ];

    for (const module of Object.values(PATH_TO_MODULE)) {
      expect(validModules).toContain(module);
    }
  });

  it('all paths start with /eaisybooks', () => {
    for (const path of Object.keys(PATH_TO_MODULE)) {
      expect(path).toMatch(/^\/eaisybooks/);
    }
  });

  it('no duplicate module values (each module mapped once)', () => {
    const modules = Object.values(PATH_TO_MODULE);
    const uniqueModules = new Set(modules);
    expect(uniqueModules.size).toBe(modules.length);
  });

  it('returns undefined for non-existent paths', () => {
    expect(PATH_TO_MODULE['/nonexistent']).toBeUndefined();
    expect(PATH_TO_MODULE['/eaisybooks/nonexistent']).toBeUndefined();
    expect(PATH_TO_MODULE['/']).toBeUndefined();
  });
});
