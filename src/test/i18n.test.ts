import { describe, it, expect, beforeEach } from 'vitest';
import i18n, { resources } from '@/lib/i18n';
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

      // FX Differences in Hungarian
      expect(i18n.t('dashboard:fx_differences.title')).toBe('Árfolyam-különbözetek');
      expect(i18n.t('dashboard:fx_differences.net_difference')).toBe('Nettó különbözet');
      expect(i18n.t('dashboard:fx_differences.total_gain')).toBe('Össz. nyereség');
      expect(i18n.t('dashboard:fx_differences.total_loss')).toBe('Össz. veszteség');
      expect(i18n.t('dashboard:fx_differences.gl_classification')).toBe('Főkönyvi besorolás');
      expect(i18n.t('dashboard:fx_differences.table.month')).toBe('Hónap');
      expect(i18n.t('dashboard:fx_differences.table.total')).toBe('Összesen');

      // General Ledger Toolbar in Hungarian
      expect(i18n.t('accounting:general_ledger.toolbar.active_preset')).toBe('Aktív Számlatükör:');
      expect(i18n.t('accounting:general_ledger.toolbar.builtin_system_preset')).toBe('Beépített Rendszerszintű Sablon');
      expect(i18n.t('accounting:general_ledger.toolbar.manage_presets')).toBe('Sablonok kezelése');
      expect(i18n.t('accounting:general_ledger.toolbar.upload_preset')).toBe('Új sablon feltöltése');
      expect(i18n.t('accounting:general_ledger.toolbar.manual_entry')).toBe('Vegyes bizonylat');
      expect(i18n.t('accounting:general_ledger.toolbar.xml_import')).toBe('XML Import');
      expect(i18n.t('accounting:general_ledger.toolbar.xml_imports')).toBe('XML Importok');
      expect(i18n.t('accounting:general_ledger.toolbar.ai_classification')).toBe('AI Besorolás');
      expect(i18n.t('accounting:general_ledger.toolbar.export')).toBe('Export');

      // Profit & Loss in Hungarian
      expect(i18n.t('accounting:profit_and_loss.card_title')).toBe('Eredménykimutatás');
      expect(i18n.t('accounting:profit_and_loss.kpi.operating_profit')).toBe('Üzemi eredmény');
      expect(i18n.t('accounting:profit_and_loss.simulator.title')).toBe('"What-If" Működési Költség és Árbevétel Szimuláció');
      expect(i18n.t('accounting:profit_and_loss.toggles.official_view')).toBe('Hivatalos nézet (Ezer Ft)');
      expect(i18n.t('accounting:profit_and_loss.table.row')).toBe('Sor');
      expect(i18n.t('accounting:profit_and_loss.mapping_tab.match_title')).toBe('Főkönyvi számok párosítása');

      // Balance Sheet in Hungarian
      expect(i18n.t('accounting:balance_sheet.card_title')).toBe('Mérleg');
      expect(i18n.t('accounting:balance_sheet.card_subtitle')).toBe('Sztv. szerinti "A" változat');
      expect(i18n.t('accounting:balance_sheet.widgets.swing.title')).toBe('Mérleg-hinta ⚖️');
      expect(i18n.t('accounting:balance_sheet.widgets.swing.balanced')).toBe('Egyensúlyban');
      expect(i18n.t('accounting:balance_sheet.widgets.diagnostics.title')).toBe('Egyezőségi Diagnosztika');
      expect(i18n.t('accounting:balance_sheet.widgets.liquidity.title')).toBe('Likviditási Mutatók');
      expect(i18n.t('accounting:balance_sheet.toggles.traditional_view')).toBe('Hagyományos nézet');
      expect(i18n.t('accounting:balance_sheet.toggles.currency_consolidation')).toBe('DEVIZA KONSZOLIDÁCIÓ:');

      // Annual Report in Hungarian
      expect(i18n.t('accounting:annual_report.title')).toBe('Éves Beszámoló');
      expect(i18n.t('accounting:annual_report.step1.header')).toBe('1. Alapadatok');
      expect(i18n.t('accounting:annual_report.step1.company_info_title')).toBe('CÉGADATOK (A CÉGPROFILBÓL)');
      expect(i18n.t('accounting:annual_report.step2.header')).toBe('2. Mérleg & Eredménykimutatás Import');
      expect(i18n.t('accounting:annual_report.step3.header')).toBe('3. Validáció — Az „Őrszem"');

      // Journals in Hungarian
      expect(i18n.t('accounting:journals.title')).toBe('Naplók');
      expect(i18n.t('accounting:journals.period_closing')).toBe('Időszakzárás');
      expect(i18n.t('accounting:journals.new_manual_entry')).toBe('Új vegyes bizonylat');
      expect(i18n.t('accounting:journals.worklist')).toBe('Munkalista');
      expect(i18n.t('accounting:journals.opening.banner_title')).toBe('Nyitó Napló (NY) — Számviteli Nyitás Szükséges');
      expect(i18n.t('accounting:journals.table.col_journal_num')).toBe('Naplószám');
      expect(i18n.t('accounting:journals.status.kezi_piszkozat')).toBe('Kézi piszkozat');
      expect(i18n.t('accounting:journals.batch_bar.post_selected')).toBe('Kijelöltek könyvelése');
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

      // FX Differences in Croatian
      expect(i18n.t('dashboard:fx_differences.title')).toBe('Tečajne razlike');
      expect(i18n.t('dashboard:fx_differences.net_difference')).toBe('Neto razlika');
      expect(i18n.t('dashboard:fx_differences.total_gain')).toBe('Ukupni dobitak');
      expect(i18n.t('dashboard:fx_differences.total_loss')).toBe('Ukupni gubitak');
      expect(i18n.t('dashboard:fx_differences.gl_classification')).toBe('Knjiženje u glavnu knjigu');
      expect(i18n.t('dashboard:fx_differences.table.month')).toBe('Mjesec');
      expect(i18n.t('dashboard:fx_differences.table.total')).toBe('Ukupno');

      // General Ledger Toolbar in Croatian
      expect(i18n.t('accounting:general_ledger.toolbar.active_preset')).toBe('Aktivni kontni plan:');
      expect(i18n.t('accounting:general_ledger.toolbar.builtin_system_preset')).toBe('Ugrađeni sustavni predložak');
      expect(i18n.t('accounting:general_ledger.toolbar.manage_presets')).toBe('Upravljanje predlošcima');
      expect(i18n.t('accounting:general_ledger.toolbar.upload_preset')).toBe('Učitaj novi predložak');
      expect(i18n.t('accounting:general_ledger.toolbar.manual_entry')).toBe('Temeljnica');
      expect(i18n.t('accounting:general_ledger.toolbar.xml_import')).toBe('XML Uvoz');
      expect(i18n.t('accounting:general_ledger.toolbar.xml_imports')).toBe('XML Uvozi');
      expect(i18n.t('accounting:general_ledger.toolbar.ai_classification')).toBe('AI Klasifikacija');
      expect(i18n.t('accounting:general_ledger.toolbar.export')).toBe('Izvoz');

      // Profit & Loss in Croatian
      expect(i18n.t('accounting:profit_and_loss.card_title')).toBe('Račun dobiti i gubitka');
      expect(i18n.t('accounting:profit_and_loss.kpi.operating_profit')).toBe('Poslovni rezultat');
      expect(i18n.t('accounting:profit_and_loss.simulator.title')).toBe('"What-If" Simulacija operativnih troškova i prihoda');
      expect(i18n.t('accounting:profit_and_loss.toggles.official_view')).toBe('Službeni prikaz (tisuće Ft)');
      expect(i18n.t('accounting:profit_and_loss.table.row')).toBe('R.br.');
      expect(i18n.t('accounting:profit_and_loss.mapping_tab.match_title')).toBe('Uparivanje konta glavne knjige');

      // Balance Sheet in Croatian
      expect(i18n.t('accounting:balance_sheet.card_title')).toBe('Bilanca');
      expect(i18n.t('accounting:balance_sheet.card_subtitle')).toBe('Verzija "A" prema računovodstvenim standardima');
      expect(i18n.t('accounting:balance_sheet.widgets.swing.title')).toBe('Vaga bilance ⚖️');
      expect(i18n.t('accounting:balance_sheet.widgets.swing.balanced')).toBe('U ravnoteži');
      expect(i18n.t('accounting:balance_sheet.widgets.diagnostics.title')).toBe('Dijagnostika usklađenosti');
      expect(i18n.t('accounting:balance_sheet.widgets.liquidity.title')).toBe('Pokazatelji likvidnosti');
      expect(i18n.t('accounting:balance_sheet.toggles.traditional_view')).toBe('Tradicionalni prikaz');
      expect(i18n.t('accounting:balance_sheet.toggles.currency_consolidation')).toBe('KONSOLIDACIJA VALUTA:');

      // Annual Report in Croatian
      expect(i18n.t('accounting:annual_report.title')).toBe('Godišnji financijski izvještaj');
      expect(i18n.t('accounting:annual_report.step1.header')).toBe('1. Osnovni podaci');
      expect(i18n.t('accounting:annual_report.step1.company_info_title')).toBe('PODACI O TVRTKI (IZ PROFILA TVRTKE)');
      expect(i18n.t('accounting:annual_report.step2.header')).toBe('2. Uvoz Bilance i Računa dobiti i gubitka');
      expect(i18n.t('accounting:annual_report.step3.header')).toBe('3. Validacija — „Stražar"');

      // Journals in Croatian
      expect(i18n.t('accounting:journals.title')).toBe('Dnevnici');
      expect(i18n.t('accounting:journals.period_closing')).toBe('Zaključak razdoblja');
      expect(i18n.t('accounting:journals.new_manual_entry')).toBe('Novi temeljni nalog');
      expect(i18n.t('accounting:journals.worklist')).toBe('Radna lista');
      expect(i18n.t('accounting:journals.opening.banner_title')).toBe('Početni dnevnik (NY) — Potrebno računovodstveno otvaranje');
      expect(i18n.t('accounting:journals.table.col_journal_num')).toBe('Broj dnevnika');
      expect(i18n.t('accounting:journals.status.kezi_piszkozat')).toBe('Ručni nacrt');
      expect(i18n.t('accounting:journals.batch_bar.post_selected')).toBe('Knjiženje označenih');

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

    it('ensures 100% key parity across all Hungarian and Croatian translation resources', () => {
      const getDeepKeys = (obj: Record<string, any>, prefix = ''): string[] => {
        let keys: string[] = [];
        for (const [k, v] of Object.entries(obj)) {
          const path = prefix ? `${prefix}.${k}` : k;
          if (v && typeof v === 'object' && !Array.isArray(v)) {
            keys = keys.concat(getDeepKeys(v, path));
          } else {
            keys.push(path);
          }
        }
        return keys;
      };

      const huNamespaces = Object.keys(resources.hu);
      const hrNamespaces = Object.keys(resources.hr);

      expect(hrNamespaces.sort()).toEqual(huNamespaces.sort());

      for (const ns of huNamespaces) {
        const huKeys = getDeepKeys((resources.hu as any)[ns]).sort();
        const hrKeys = getDeepKeys((resources.hr as any)[ns]).sort();

        const missingInHr = huKeys.filter(k => !hrKeys.includes(k));
        const missingInHu = hrKeys.filter(k => !huKeys.includes(k));

        expect(missingInHr, `Missing keys in hr for namespace "${ns}"`).toEqual([]);
        expect(missingInHu, `Missing keys in hu for namespace "${ns}"`).toEqual([]);
      }
    });
  });
});

