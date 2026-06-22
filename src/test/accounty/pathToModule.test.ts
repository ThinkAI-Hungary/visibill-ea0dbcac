import { describe, it, expect } from 'vitest';
import { PATH_TO_MODULE, type AccountyModule } from '@/hooks/useAccountyPermissions';

/**
 * Tests for the PATH_TO_MODULE mapping from useAccountyPermissions.ts.
 * Validates that every sidebar route is correctly mapped to a module name.
 */

describe('PATH_TO_MODULE mapping', () => {
  it('maps /accounty to portfolio', () => {
    expect(PATH_TO_MODULE['/accounty']).toBe('portfolio');
  });

  it('maps /accounty/missing-invoices to missing_invoices', () => {
    expect(PATH_TO_MODULE['/accounty/missing-invoices']).toBe('missing_invoices');
  });

  it('maps /accounty/tax-calendar to tax_calendar', () => {
    expect(PATH_TO_MODULE['/accounty/tax-calendar']).toBe('tax_calendar');
  });

  it('maps /accounty/reports to reports', () => {
    expect(PATH_TO_MODULE['/accounty/reports']).toBe('reports');
  });

  it('maps /accounty/approval-queue to approval_queue', () => {
    expect(PATH_TO_MODULE['/accounty/approval-queue']).toBe('approval_queue');
  });

  it('maps /accounty/alerts to alerts', () => {
    expect(PATH_TO_MODULE['/accounty/alerts']).toBe('alerts');
  });

  it('maps /accounty/nav-deadlines to nav_deadlines', () => {
    expect(PATH_TO_MODULE['/accounty/nav-deadlines']).toBe('nav_deadlines');
  });

  it('maps /accounty/payroll-portfolio to payroll', () => {
    expect(PATH_TO_MODULE['/accounty/payroll-portfolio']).toBe('payroll');
  });

  it('maps /accounty/onboarding to onboarding', () => {
    expect(PATH_TO_MODULE['/accounty/onboarding']).toBe('onboarding');
  });

  it('maps /accounty/tao to tao', () => {
    expect(PATH_TO_MODULE['/accounty/tao']).toBe('tao');
  });

  it('maps /accounty/settings to settings', () => {
    expect(PATH_TO_MODULE['/accounty/settings']).toBe('settings');
  });

  it('maps /accounty/tickets to tickets', () => {
    expect(PATH_TO_MODULE['/accounty/tickets']).toBe('tickets');
  });

  it('maps /accounty/ai-assistant to ai_assistant', () => {
    expect(PATH_TO_MODULE['/accounty/ai-assistant']).toBe('ai_assistant');
  });

  it('maps /accounty/help to help', () => {
    expect(PATH_TO_MODULE['/accounty/help']).toBe('help');
  });

  it('maps /accounty/profile/settings to profile', () => {
    expect(PATH_TO_MODULE['/accounty/profile/settings']).toBe('profile');
  });

  // Admin routes
  it('maps /accounty/admin/audit to admin_audit', () => {
    expect(PATH_TO_MODULE['/accounty/admin/audit']).toBe('admin_audit');
  });

  it('maps /accounty/admin/gdpr to admin_gdpr', () => {
    expect(PATH_TO_MODULE['/accounty/admin/gdpr']).toBe('admin_gdpr');
  });

  it('maps /accounty/admin/templates to admin_templates', () => {
    expect(PATH_TO_MODULE['/accounty/admin/templates']).toBe('admin_templates');
  });

  it('maps /accounty/admin/job-codes to admin_job_codes', () => {
    expect(PATH_TO_MODULE['/accounty/admin/job-codes']).toBe('admin_job_codes');
  });

  it('maps /accounty/admin/tax-parameters to admin_tax_params', () => {
    expect(PATH_TO_MODULE['/accounty/admin/tax-parameters']).toBe('admin_tax_params');
  });

  it('maps /accounty/admin/legal-updates to admin_legal', () => {
    expect(PATH_TO_MODULE['/accounty/admin/legal-updates']).toBe('admin_legal');
  });

  it('maps /accounty/admin/office-settings to admin_office', () => {
    expect(PATH_TO_MODULE['/accounty/admin/office-settings']).toBe('admin_office');
  });

  it('maps /accounty/admin/permissions to admin_permissions', () => {
    expect(PATH_TO_MODULE['/accounty/admin/permissions']).toBe('admin_permissions');
  });

  it('maps /accounty/admin/accountants to admin_accountants', () => {
    expect(PATH_TO_MODULE['/accounty/admin/accountants']).toBe('admin_accountants');
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

  it('all paths start with /accounty', () => {
    for (const path of Object.keys(PATH_TO_MODULE)) {
      expect(path).toMatch(/^\/accounty/);
    }
  });

  it('no duplicate module values (each module mapped once)', () => {
    const modules = Object.values(PATH_TO_MODULE);
    const uniqueModules = new Set(modules);
    expect(uniqueModules.size).toBe(modules.length);
  });

  it('returns undefined for non-existent paths', () => {
    expect(PATH_TO_MODULE['/nonexistent']).toBeUndefined();
    expect(PATH_TO_MODULE['/accounty/nonexistent']).toBeUndefined();
    expect(PATH_TO_MODULE['/']).toBeUndefined();
  });
});
