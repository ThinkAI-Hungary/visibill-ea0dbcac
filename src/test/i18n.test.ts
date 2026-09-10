import { describe, it, expect, beforeEach } from 'vitest';
import i18n from '@/lib/i18n';
import { getActiveLocale, formatCurrencyLocale } from '@/lib/locale/formatters';
import { generateScopedPath, extractPageSegment } from '@/lib/navigation';

describe('i18n and Localization Suite', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('hu');
  });

  describe('Locale & Formatters', () => {
    it('defaults to hu locale', () => {
      expect(getActiveLocale()).toBe('hu');
    });

    it('switches active locale to hr when language changes', async () => {
      await i18n.changeLanguage('hr');
      expect(getActiveLocale()).toBe('hr');
    });

    it('formats currency in HUF for hu locale', async () => {
      await i18n.changeLanguage('hu');
      const formatted = formatCurrencyLocale(150000);
      expect(formatted).toMatch(/150\s?000\s?Ft/);
    });

    it('formats currency in EUR for hr locale', async () => {
      await i18n.changeLanguage('hr');
      const formatted = formatCurrencyLocale(1500.5);
      // In Croatian locale, EUR is formatted with € symbol
      expect(formatted).toMatch(/€/);
      expect(formatted).toMatch(/1/);
      expect(formatted).toMatch(/500/);
    });
  });

  describe('Navigation & Scoped Path Resolution with /hr', () => {
    const companyId = 'test-company-uuid';
    const dateFrom = '2026-01-01';
    const dateTo = '2026-01-31';

    it('generates standard path when isHr is false', () => {
      const path = generateScopedPath(companyId, dateFrom, dateTo, 'invoices', false);
      expect(path).toBe(`/${companyId}/${dateFrom}_${dateTo}/invoices`);
    });

    it('generates /hr prefixed path when isHr is true', () => {
      const path = generateScopedPath(companyId, dateFrom, dateTo, 'invoices', true);
      expect(path).toBe(`/hr/${companyId}/${dateFrom}_${dateTo}/invoices`);
    });

    it('extracts page segment correctly from standard path', () => {
      const segment = extractPageSegment(`/${companyId}/${dateFrom}_${dateTo}/invoices`);
      expect(segment).toBe('/invoices');
    });

    it('extracts page segment correctly from /hr prefixed path', () => {
      const segment = extractPageSegment(`/hr/${companyId}/${dateFrom}_${dateTo}/invoices`);
      expect(segment).toBe('/invoices');
    });

    it('extracts root page segment as slash from /hr path', () => {
      const segment = extractPageSegment(`/hr/${companyId}/${dateFrom}_${dateTo}`);
      expect(segment).toBe('/');
    });
  });

  describe('Translation Resources', () => {
    it('provides valid Hungarian translations', async () => {
      await i18n.changeLanguage('hu');
      expect(i18n.t('navigation:items.invoices')).toBe('Számlák');
      expect(i18n.t('navigation:items.partners')).toBe('Partnertörzs');
      expect(i18n.t('navigation:groups.hr')).toBe('HR & Eszközök');
      expect(i18n.t('partners:title')).toBe('Partnertörzs');
      expect(i18n.t('categories:title')).toBe('Kategóriák');
      expect(i18n.t('projects:title')).toBe('Projektek');
      expect(i18n.t('pettyCash:title')).toBe('Házipénztár');
      expect(i18n.t('accounting:general_ledger.title')).toBe('Főkönyv');
      expect(i18n.t('accounting:profit_and_loss.title')).toBe('Eredménykimutatás');
      expect(i18n.t('accounting:balance_sheet.title')).toBe('Mérleg');
      expect(i18n.t('hr:salaries.title')).toBe('Bérek / járulékok');
      expect(i18n.t('hr:working_time.title')).toBe('Munkaidő');
      expect(i18n.t('hr:fixed_assets.title')).toBe('Tárgyi Eszköz Nyilvántartó');
      expect(i18n.t('tickets:title')).toBe('Hibajegyek');
      expect(i18n.t('common:actions.save')).toBe('Mentés');
      expect(i18n.t('hr:working_time.tabs.timesheet')).toBe('Időrögzítés');
      expect(i18n.t('hr:working_time.tabs.attendance')).toBe('Jelenléti ív');
      expect(i18n.t('hr:working_time.kpi.registered')).toBe('Bejelentett');
      expect(i18n.t('hr:working_time.calendar.monthly_summary')).toBe('Havi összesítő');
      expect(i18n.t('accounting:general_ledger.tabs.extract')).toBe('Kivonat');
      expect(i18n.t('accounting:profit_and_loss.tabs.view')).toBe('Eredménykimutatás');
      expect(i18n.t('accounting:balance_sheet.tabs.view')).toBe('Mérleg');
      expect(i18n.t('partners:types.all')).toBe('Összes');
      expect(i18n.t('dashboard:inbound_status.title')).toBe('Bejövő számlák állapota');
      expect(i18n.t('auth:tabs.signin')).toBe('Bejelentkezés');
      expect(i18n.t('auth:tabs.signup')).toBe('Regisztráció');
      expect(i18n.t('auth:fields.email')).toBe('Email cím');
      expect(i18n.t('auth:fields.password')).toBe('Jelszó');
      expect(i18n.t('auth:buttons.signin')).toBe('Bejelentkezés');
      expect(i18n.t('auth:forgot.title')).toBe('Elfelejtett jelszó');
    });

    it('provides valid Croatian translations for demo', async () => {
      await i18n.changeLanguage('hr');
      expect(i18n.t('navigation:items.invoices')).toBe('Računi');
      expect(i18n.t('navigation:items.partners')).toBe('Partneri');
      expect(i18n.t('navigation:groups.hr')).toBe('Ljudski resursi i imovina');
      expect(i18n.t('partners:title')).toBe('Partneri');
      expect(i18n.t('partners:columns.tax_number')).toBe('OIB / Porezni broj');
      expect(i18n.t('categories:title')).toBe('Kategorije');
      expect(i18n.t('projects:title')).toBe('Projekti');
      expect(i18n.t('pettyCash:title')).toBe('Blagajna');
      expect(i18n.t('accounting:general_ledger.title')).toBe('Glavna knjiga');
      expect(i18n.t('accounting:profit_and_loss.title')).toBe('Račun dobiti i gubitka');
      expect(i18n.t('accounting:balance_sheet.title')).toBe('Bilanca');
      expect(i18n.t('hr:salaries.title')).toBe('Plaće i doprinosi');
      expect(i18n.t('hr:working_time.title')).toBe('Radno vrijeme');
      expect(i18n.t('hr:fixed_assets.title')).toBe('Dugotrajna imovina');
      expect(i18n.t('tickets:title')).toBe('Korisnički zahtjevi');
      expect(i18n.t('common:actions.save')).toBe('Spremi');

      // Sub-tabs, cards & widgets in Croatian
      expect(i18n.t('hr:working_time.tabs.timesheet')).toBe('Evidencija rada');
      expect(i18n.t('hr:working_time.tabs.attendance')).toBe('Evidencija prisutnosti');
      expect(i18n.t('hr:working_time.tabs.employees')).toBe('Djelatnici');
      expect(i18n.t('hr:working_time.kpi.registered')).toBe('Prijavljeni');
      expect(i18n.t('hr:working_time.kpi.contractors')).toBe('Podizvođači');
      expect(i18n.t('hr:working_time.kpi.monthly_salary_cost')).toBe('Mjesečni trošak plaća');
      expect(i18n.t('hr:working_time.kpi.avg_hourly_rate')).toBe('Prosječna satnica');
      expect(i18n.t('hr:working_time.calendar.monthly_summary')).toBe('Mjesečni pregled');
      expect(i18n.t('accounting:general_ledger.tabs.extract')).toBe('Izvadak');
      expect(i18n.t('accounting:general_ledger.tabs.cards')).toBe('Kartice');
      expect(i18n.t('accounting:profit_and_loss.tabs.view')).toBe('Račun dobiti i gubitka');
      expect(i18n.t('accounting:balance_sheet.tabs.view')).toBe('Bilanca');
      expect(i18n.t('partners:types.all')).toBe('Svi');
      expect(i18n.t('dashboard:inbound_status.title')).toBe('Status ulaznih računa');
      expect(i18n.t('dashboard:inbound_status.payable')).toBe('Za plaćanje');
      expect(i18n.t('settings:integrations.generated_alias')).toBe('Generirani alias');

      // Auth namespace in Croatian
      expect(i18n.t('auth:tabs.signin')).toBe('Prijava');
      expect(i18n.t('auth:tabs.signup')).toBe('Registracija');
      expect(i18n.t('auth:fields.email')).toBe('E-mail adresa');
      expect(i18n.t('auth:fields.password')).toBe('Lozinka');
      expect(i18n.t('auth:buttons.signin')).toBe('Prijava');
      expect(i18n.t('auth:buttons.signup')).toBe('Registracija');
      expect(i18n.t('auth:forgot.title')).toBe('Zaboravljena lozinka');
      expect(i18n.t('auth:verification.in_progress_title')).toBe('Potvrda e-pošte...');
      expect(i18n.t('auth:verification.success_title')).toBe('E-pošta uspješno potvrđena! 🎉');
    });
  });
});
