import { describe, it, expect, beforeEach } from 'vitest';
import i18n, { resources } from '@/lib/i18n';
import { getActiveLocale, formatCurrencyLocale } from '@/lib/locale/formatters';
import { generateScopedPath, extractPageSegment, resolveAuthTarget } from '@/lib/navigation';
import { getTransactionTypeLabel } from '@/lib/transactionUtils';
import { getLocalizedRegisterName, getLocalizedEntryDescription } from '@/lib/pettyCashUtils';
import { getLocalizedGlAccountName } from '@/lib/glUtils';
import { getLocalizedPnlRowName } from '@/lib/pnlUtils';
import { getLocalizedBsRowName } from '@/lib/bsUtils';
import { getLocalizedJournalName } from '@/lib/journalUtils';

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

    describe('resolveAuthTarget', () => {
      it('resolves default target to / when not hr and not eaisybooks', () => {
        expect(resolveAuthTarget(null, false, false)).toBe('/');
        expect(resolveAuthTarget('', false, false)).toBe('/');
        expect(resolveAuthTarget('/', false, false)).toBe('/');
      });

      it('resolves default target to /hr when isHr is true', () => {
        expect(resolveAuthTarget(null, false, true)).toBe('/hr');
        expect(resolveAuthTarget('', false, true)).toBe('/hr');
        expect(resolveAuthTarget('/', false, true)).toBe('/hr');
        expect(resolveAuthTarget('/hr', false, true)).toBe('/hr');
      });

      it('resolves eaisybooks target appropriately', () => {
        expect(resolveAuthTarget(null, true, false)).toBe('/eaisybooks');
        expect(resolveAuthTarget(null, true, true)).toBe('/hr/eaisybooks');
      });

      it('preserves returnTo path and prepends /hr if isHr is true and missing /hr prefix', () => {
        expect(resolveAuthTarget(`/${companyId}/${dateFrom}_${dateTo}/invoices`, false, true))
          .toBe(`/hr/${companyId}/${dateFrom}_${dateTo}/invoices`);
      });

      it('does not double prepend /hr if returnTo already has /hr prefix', () => {
        expect(resolveAuthTarget(`/hr/${companyId}/${dateFrom}_${dateTo}/invoices`, false, true))
          .toBe(`/hr/${companyId}/${dateFrom}_${dateTo}/invoices`);
      });

      it('preserves returnTo without /hr if isHr is false', () => {
        expect(resolveAuthTarget(`/${companyId}/${dateFrom}_${dateTo}/invoices`, false, false))
          .toBe(`/${companyId}/${dateFrom}_${dateTo}/invoices`);
      });
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

      // Transactions types in Croatian
      expect(i18n.t('transactions:types.supplier')).toBe('Transakcija dobavljača');
      expect(i18n.t('transactions:types.customer')).toBe('Transakcija kupca');
      expect(i18n.t('transactions:types.bank_cost')).toBe('Bankovni trošak');
      expect(i18n.t('transactions:types.interest_income')).toBe('Prihod od kamata');
      expect(i18n.t('transactions:types.tax_expense')).toBe('Troškovi doprinosa');

      // Invoices NavSync and payment methods in Croatian
      expect(i18n.t('invoices:nav_sync.sync')).toBe('Sinkronizacija');
      expect(i18n.t('invoices:nav_sync.syncing')).toBe('Sinkronizacija...');
      expect(i18n.t('invoices:payment_methods.cash')).toBe('Gotovina');
      expect(i18n.t('invoices:payment_methods.transfer')).toBe('Virman');
      expect(i18n.t('invoices:payment_methods.card')).toBe('Kartica');
      expect(i18n.t('invoices:expanded.not_booked')).toBe('Neknjiženo');

      // Petty cash register name and descriptions in Croatian
      expect(i18n.t('pettyCash:registers.default_name')).toBe('Glavna blagajna');
      expect(i18n.t('pettyCash:entries.auto_desc_outbound', { partner: 'Test' })).toBe('Uplata u blagajnu - Test');
      expect(i18n.t('pettyCash:entries.auto_desc_inbound', { partner: 'Test' })).toBe('Isplata iz blagajne - Test');
      expect(i18n.t('pettyCash:entries.unknown_partner')).toBe('Nepoznati partner');
    });

    it('correctly localizes dynamic transaction types via getTransactionTypeLabel', async () => {
      await i18n.changeLanguage('hu');
      const tHu = i18n.t as any;
      expect(getTransactionTypeLabel('szállítói tranzakció', tHu)).toBe('Szállítói tranzakció');
      expect(getTransactionTypeLabel('bankköltség', tHu)).toBe('Bankköltség');
      expect(getTransactionTypeLabel('kamatjövedelem', tHu)).toBe('Kamatjövedelem');

      await i18n.changeLanguage('hr');
      const tHr = i18n.t as any;
      expect(getTransactionTypeLabel('szállítói tranzakció', tHr)).toBe('Transakcija dobavljača');
      expect(getTransactionTypeLabel('bankköltség', tHr)).toBe('Bankovni trošak');
      expect(getTransactionTypeLabel('kamatjövedelem', tHr)).toBe('Prihod od kamata');
      expect(getTransactionTypeLabel('járulékkiadások', tHr)).toBe('Troškovi doprinosa');
    });

    it('correctly localizes petty cash register name and description helpers', async () => {
      await i18n.changeLanguage('hu');
      const tHu = i18n.t as any;
      expect(getLocalizedRegisterName('Központi pénztár', tHu)).toBe('Központi pénztár');
      expect(getLocalizedEntryDescription('Pénztári bevétel - Ismeretlen', tHu)).toBe('Pénztári bevétel - Ismeretlen');
      expect(getLocalizedEntryDescription('Pénztári kiadás - Partner Kft.', tHu)).toBe('Pénztári kiadás - Partner Kft.');

      await i18n.changeLanguage('hr');
      const tHr = i18n.t as any;
      expect(getLocalizedRegisterName('Központi pénztár', tHr)).toBe('Glavna blagajna');
      expect(getLocalizedEntryDescription('Pénztári bevétel - Ismeretlen', tHr)).toBe('Uplata u blagajnu - Nepoznati partner');
      expect(getLocalizedEntryDescription('Pénztári kiadás - Partner Kft.', tHr)).toBe('Isplata iz blagajne - Partner Kft.');
    });

    it('correctly localizes general ledger account classes 0-9', async () => {
      await i18n.changeLanguage('hu');
      const tHu = i18n.t as any;
      expect(getLocalizedGlAccountName('0.', 'SZÁMLAOSZTÁLY: NYILVÁNTARTÁSI SZÁMLÁK', tHu)).toBe('SZÁMLAOSZTÁLY: NYILVÁNTARTÁSI SZÁMLÁK');
      expect(getLocalizedGlAccountName('1.', 'SZÁMLAOSZTÁLY: BEFEKTETETT ESZKÖZÖK', tHu)).toBe('SZÁMLAOSZTÁLY: BEFEKTETETT ESZKÖZÖK');
      expect(getLocalizedGlAccountName('5.', 'SZÁMLAOSZTÁLY: KÖLTSÉGNEMEK', tHu)).toBe('SZÁMLAOSZTÁLY: KÖLTSÉGNEMEK');

      await i18n.changeLanguage('hr');
      const tHr = i18n.t as any;
      expect(getLocalizedGlAccountName('0.', 'SZÁMLAOSZTÁLY: NYILVÁNTARTÁSI SZÁMLÁK', tHr)).toBe('RAZRED KONTA: IZVANBILANČNA KONTA');
      expect(getLocalizedGlAccountName('1.', 'SZÁMLAOSZTÁLY: BEFEKTETETT ESZKÖZÖK', tHr)).toBe('RAZRED KONTA: DUGOTRAJNA IMOVINA');
      expect(getLocalizedGlAccountName('5.', 'SZÁMLAOSZTÁLY: KÖLTSÉGNEMEK', tHr)).toBe('RAZRED KONTA: TROŠKOVI PREMA VRSTAMA');
    });

    it('correctly localizes statutory profit and loss rows I-X and A-D', async () => {
      await i18n.changeLanguage('hu');
      const tHu = i18n.t as any;
      expect(getLocalizedPnlRowName('I.', 'Értékesítés nettó árbevétele', tHu)).toBe('Értékesítés nettó árbevétele');
      expect(getLocalizedPnlRowName('IV.', 'Anyagjellegű ráfordítások', tHu)).toBe('Anyagjellegű ráfordítások');
      expect(getLocalizedPnlRowName('V.', 'Személyi jellegű ráfordítások', tHu)).toBe('Személyi jellegű ráfordítások');
      expect(getLocalizedPnlRowName('A.', 'ÜZEMI (ÜZLETI) TEVÉKENYSÉG EREDMÉNYE', tHu)).toBe('ÜZEMI (ÜZLETI) TEVÉKENYSÉG EREDMÉNYE');
      expect(getLocalizedPnlRowName('D.', 'ADÓZOTT EREDMÉNY', tHu)).toBe('ADÓZOTT EREDMÉNY');

      await i18n.changeLanguage('hr');
      const tHr = i18n.t as any;
      expect(getLocalizedPnlRowName('I.', 'Értékesítés nettó árbevétele', tHr)).toBe('Neto prihodi od prodaje');
      expect(getLocalizedPnlRowName('IV.', 'Anyagjellegű ráfordítások', tHr)).toBe('Materijalni troškovi');
      expect(getLocalizedPnlRowName('V.', 'Személyi jellegű ráfordítások', tHr)).toBe('Troškovi osoblja');
      expect(getLocalizedPnlRowName('A.', 'ÜZEMI (ÜZLETI) TEVÉKENYSÉG EREDMÉNYE', tHr)).toBe('POSLOVNI REZULTAT (DOBIT/GUBITAK IZ POSLOVANJA)');
      expect(getLocalizedPnlRowName('D.', 'ADÓZOTT EREDMÉNY', tHr)).toBe('DOBIT ILI GUBITAK RAZDOBLJA (NETO DOBIT/GUBITAK)');
    });

    it('correctly localizes statutory balance sheet rows A-G and totals', async () => {
      await i18n.changeLanguage('hu');
      const tHu = i18n.t as any;
      expect(getLocalizedBsRowName({ order_num: 9999, name: 'ESZKÖZÖK (AKTÍVÁK) ÖSSZESEN' }, 'ESZKÖZÖK (AKTÍVÁK) ÖSSZESEN', tHu)).toBe('ESZKÖZÖK (AKTÍVÁK) ÖSSZESEN');
      expect(getLocalizedBsRowName({ order_num: 100, row_code: 'A.', name: 'Befektetett eszközök' }, 'Befektetett eszközök', tHu)).toBe('Befektetett eszközök');
      expect(getLocalizedBsRowName({ order_num: 200, row_code: 'B.', name: 'Forgóeszközök' }, 'Forgóeszközök', tHu)).toBe('Forgóeszközök');
      expect(getLocalizedBsRowName({ order_num: 1100, row_code: 'D.', name: 'Saját tőke' }, 'Saját tőke', tHu)).toBe('Saját tőke');
      expect(getLocalizedBsRowName({ order_num: 1300, row_code: 'F.', name: 'Kötelezettségek' }, 'Kötelezettségek', tHu)).toBe('Kötelezettségek');
      expect(getLocalizedBsRowName({ order_num: 19999, name: 'FORRÁSOK (PASSZÍVÁK) ÖSSZESEN' }, 'FORRÁSOK (PASSZÍVÁK) ÖSSZESEN', tHu)).toBe('FORRÁSOK (PASSZÍVÁK) ÖSSZESEN');
      expect(getLocalizedBsRowName('CÉLTARTALÉKOK', 'CÉLTARTALÉKOK', tHu)).toBe('Céltartalékok');

      await i18n.changeLanguage('hr');
      const tHr = i18n.t as any;
      expect(getLocalizedBsRowName({ order_num: 9999, name: 'ESZKÖZÖK (AKTÍVÁK) ÖSSZESEN' }, 'ESZKÖZÖK (AKTÍVÁK) ÖSSZESEN', tHr)).toBe('UKUPNO IMOVINA (AKTIVA)');
      expect(getLocalizedBsRowName({ order_num: 100, row_code: 'A.', name: 'Befektetett eszközök' }, 'Befektetett eszközök', tHr)).toBe('Dugotrajna imovina');
      expect(getLocalizedBsRowName({ order_num: 200, row_code: 'B.', name: 'Forgóeszközök' }, 'Forgóeszközök', tHr)).toBe('Kratkotrajna imovina');
      expect(getLocalizedBsRowName({ order_num: 1100, row_code: 'D.', name: 'Saját tőke' }, 'Saját tőke', tHr)).toBe('Kapital i rezerve');
      expect(getLocalizedBsRowName({ order_num: 1300, row_code: 'F.', name: 'Kötelezettségek' }, 'Kötelezettségek', tHr)).toBe('Obveze');
      expect(getLocalizedBsRowName({ order_num: 19999, name: 'FORRÁSOK (PASSZÍVÁK) ÖSSZESEN' }, 'FORRÁSOK (PASSZÍVÁK) ÖSSZESEN', tHr)).toBe('UKUPNO OBVEZE I KAPITAL (PASIVA)');
      expect(getLocalizedBsRowName('CÉLTARTALÉKOK', 'CÉLTARTALÉKOK', tHr)).toBe('Rezerviranja');
    });

    it('correctly localizes standard accounting journals into Croatian', async () => {
      await i18n.changeLanguage('hu');
      const tHu = i18n.t as any;
      expect(getLocalizedJournalName({ code: 'NY', name: 'Nyitó tételek' }, 'Nyitó tételek', tHu)).toBe('Nyitó tételek');
      expect(getLocalizedJournalName({ code: 'V', name: 'Vevő számlák' }, 'Vevő számlák', tHu)).toBe('Vevő számlák');
      expect(getLocalizedJournalName({ code: 'SZ', name: 'Szállító számlák' }, 'Szállító számlák', tHu)).toBe('Szállító számlák');
      expect(getLocalizedJournalName({ code: 'VE', name: 'Vegyes tételek' }, 'Vegyes tételek', tHu)).toBe('Vegyes tételek');
      expect(getLocalizedJournalName({ code: 'BÉR', name: 'Bérfeladás' }, 'Bérfeladás', tHu)).toBe('Bérfeladás');
      expect(getLocalizedJournalName({ code: 'Z', name: 'Záró tételek' }, 'Záró tételek', tHu)).toBe('Záró tételek');
      expect(getLocalizedJournalName({ code: 'P1', name: 'Házipénztár HUF' }, 'Házipénztár HUF', tHu)).toBe('Házipénztár HUF');
      expect(getLocalizedJournalName({ code: 'B1', name: 'K&H bank HUF' }, 'K&H bank HUF', tHu)).toBe('K&H bank HUF');
      expect(getLocalizedJournalName({ code: 'B2', name: 'K&H bank EUR' }, 'K&H bank EUR', tHu)).toBe('K&H bank EUR');
      expect(getLocalizedJournalName({ code: 'B_USD', name: 'Deviza bank USD' }, 'Deviza bank USD', tHu)).toBe('Deviza bank USD');
      expect(getLocalizedJournalName('all', 'Összes napló', tHu)).toBe('Összes napló');
      expect(getLocalizedJournalName('B1', 'Bank', tHu, { short: true })).toBe('Bank');

      await i18n.changeLanguage('hr');
      const tHr = i18n.t as any;
      expect(getLocalizedJournalName({ code: 'NY', name: 'Nyitó tételek' }, 'Nyitó tételek', tHr)).toBe('Početna stanja');
      expect(getLocalizedJournalName({ code: 'V', name: 'Vevő számlák' }, 'Vevő számlák', tHr)).toBe('Izlazni računi');
      expect(getLocalizedJournalName({ code: 'SZ', name: 'Szállító számlák' }, 'Szállító számlák', tHr)).toBe('Ulazni računi');
      expect(getLocalizedJournalName({ code: 'VE', name: 'Vegyes tételek' }, 'Vegyes tételek', tHr)).toBe('Temeljnica (razno)');
      expect(getLocalizedJournalName({ code: 'BÉR', name: 'Bérfeladás' }, 'Bérfeladás', tHr)).toBe('Obračun plaća');
      expect(getLocalizedJournalName({ code: 'Z', name: 'Záró tételek' }, 'Záró tételek', tHr)).toBe('Zaključna knjiženja');
      expect(getLocalizedJournalName({ code: 'P1', name: 'Házipénztár HUF' }, 'Házipénztár HUF', tHr)).toBe('Blagajna HUF');
      expect(getLocalizedJournalName({ code: 'B1', name: 'K&H bank HUF' }, 'K&H bank HUF', tHr)).toBe('K&H banka HUF');
      expect(getLocalizedJournalName({ code: 'B2', name: 'K&H bank EUR' }, 'K&H bank EUR', tHr)).toBe('K&H banka EUR');
      expect(getLocalizedJournalName({ code: 'B_USD', name: 'Deviza bank USD' }, 'Deviza bank USD', tHr)).toBe('Devizni račun USD');
      expect(getLocalizedJournalName('all', 'Összes napló', tHr)).toBe('Svi dnevnici');
      expect(getLocalizedJournalName('B1', 'Bank', tHr, { short: true })).toBe('Banka');

      // Custom journal should preserve custom name
      expect(getLocalizedJournalName({ code: 'B99', name: 'Revolut Business EUR' }, 'Revolut Business EUR', tHr)).toBe('Revolut Business EUR');
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

