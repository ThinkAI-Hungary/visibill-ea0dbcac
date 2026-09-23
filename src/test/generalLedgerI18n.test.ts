import { describe, it, expect, beforeEach } from 'vitest';
import i18n from '@/lib/i18n';
import { getLocalizedGlItemType, getLocalizedGlItemDescription } from '@/lib/glUtils';

describe('General Ledger Localization & Dynamic Formatting Suite', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('hu');
  });

  describe('Item Badges Localization (getLocalizedGlItemType)', () => {
    it('localizes opening entries to Hungarian and Croatian', async () => {
      const tHu = i18n.getFixedT('hu', 'accounting');
      expect(getLocalizedGlItemType('Nyitó tétel', tHu)).toBe('Nyitó tétel');
      expect(getLocalizedGlItemType('OPENING', tHu)).toBe('Nyitó tétel');

      await i18n.changeLanguage('hr');
      const tHr = i18n.getFixedT('hr', 'accounting');
      expect(getLocalizedGlItemType('Nyitó tétel', tHr)).toBe('Početna stavka');
      expect(getLocalizedGlItemType('opening', tHr)).toBe('Početna stavka');
    });

    it('localizes closing entries to Hungarian and Croatian', async () => {
      const tHu = i18n.getFixedT('hu', 'accounting');
      expect(getLocalizedGlItemType('Záró tétel', tHu)).toBe('Záró tétel');

      const tHr = i18n.getFixedT('hr', 'accounting');
      expect(getLocalizedGlItemType('Záró tétel', tHr)).toBe('Završna stavka');
      expect(getLocalizedGlItemType('closing', tHr)).toBe('Završna stavka');
    });

    it('localizes journal entries (T/K and general)', async () => {
      const tHr = i18n.getFixedT('hr', 'accounting');
      expect(getLocalizedGlItemType('Könyvelt napló tétel (T)', tHr)).toBe('Proknjižena stavka (Duguje)');
      expect(getLocalizedGlItemType('Könyvelt napló tétel (K)', tHr)).toBe('Proknjižena stavka (Potražuje)');
      expect(getLocalizedGlItemType('Vegyes napló tétel', tHr)).toBe('Temeljnica');
      expect(getLocalizedGlItemType('XML Könyvelési tétel (T)', tHr)).toBe('Proknjižena stavka (Duguje)');
      expect(getLocalizedGlItemType('XML Könyvelési tétel (K)', tHr)).toBe('Proknjižena stavka (Potražuje)');
      expect(getLocalizedGlItemType('XML Naplótétel', tHr)).toBe('XML stavka dnevnika');
    });

    it('localizes invoice, bank, and cash badges', async () => {
      const tHr = i18n.getFixedT('hr', 'accounting');
      expect(getLocalizedGlItemType('Bejövő (Költség)', tHr)).toBe('Ulazni račun (Trošak)');
      expect(getLocalizedGlItemType('Kimenő (Bevétel)', tHr)).toBe('Izlazni račun (Prihod)');
      expect(getLocalizedGlItemType('Banki tranzakció', tHr)).toBe('Bankovna transakcija');
      expect(getLocalizedGlItemType('NAV Bejövő tétel', tHr)).toBe('e-Račun Ulazni');
      expect(getLocalizedGlItemType('NAV Kimenő tétel', tHr)).toBe('e-Račun Izlazni');
      expect(getLocalizedGlItemType('Házipénztár', tHr)).toBe('Blagajna');
      expect(getLocalizedGlItemType('Készpénz', tHr)).toBe('Gotovina');
      expect(getLocalizedGlItemType('Bérszámfejtés', tHr)).toBe('Obračun plaća');
      expect(getLocalizedGlItemType('számla', tHr)).toBe('Račun');
      expect(getLocalizedGlItemType('díjbekérő', tHr)).toBe('Predračun');
      expect(getLocalizedGlItemType('előlegszámla', tHr)).toBe('Predujam');
      expect(getLocalizedGlItemType('végszámla', tHr)).toBe('Završni račun');
    });

    it('falls back to raw string when untranslated or without t', () => {
      expect(getLocalizedGlItemType('Egyedi tétel', undefined)).toBe('Egyedi tétel');
      expect(getLocalizedGlItemType(null, undefined)).toBe('');
    });
  });

  describe('Item Description Localization (getLocalizedGlItemDescription)', () => {
    it('localizes [NYITO-2026] Nyitó egyenleg (1000) to Croatian', async () => {
      const tHr = i18n.getFixedT('hr', 'accounting');
      const input = '[NYITO-2026] Nyitó egyenleg (1000)';
      const output = getLocalizedGlItemDescription(input, tHr);
      expect(output).toBe('[NYITO-2026] Početno stanje (1000)');
    });

    it('keeps Hungarian description in Hungarian locale', async () => {
      const tHu = i18n.getFixedT('hu', 'accounting');
      const input = '[NYITO-2026] Nyitó egyenleg (1000)';
      const output = getLocalizedGlItemDescription(input, tHu);
      expect(output).toBe('[NYITO-2026] Nyitó egyenleg (1000)');
    });
  });

  describe('Filter Bar and View Layout Translations', () => {
    it('translates filter prefixes and view toggles in Hungarian and Croatian', async () => {
      const tHu = i18n.getFixedT('hu', 'accounting');
      expect(tHu('general_ledger.filters_label')).toBe('Szűrők:');
      expect(tHu('general_ledger.date_label')).toBe('Dátum:');
      expect(tHu('general_ledger.documents_label')).toBe('Bizonylatok:');
      expect(tHu('general_ledger.balance_label')).toBe('Egyenleg:');
      expect(tHu('general_ledger.view_summary')).toBe('Összesítő');
      expect(tHu('general_ledger.view_classic')).toBe('Klasszikus');
      expect(tHu('general_ledger.loading_items')).toBe('Tételek betöltése...');

      await i18n.changeLanguage('hr');
      const tHr = i18n.getFixedT('hr', 'accounting');
      expect(tHr('general_ledger.filters_label')).toBe('Filteri:');
      expect(tHr('general_ledger.date_label')).toBe('Datum:');
      expect(tHr('general_ledger.documents_label')).toBe('Dokumenti:');
      expect(tHr('general_ledger.balance_label')).toBe('Saldo:');
      expect(tHr('general_ledger.view_summary')).toBe('Zbirni');
      expect(tHr('general_ledger.view_classic')).toBe('Klasični');
      expect(tHr('general_ledger.loading_items')).toBe('Učitavanje stavki...');
    });
  });

  describe('Dynamic KPI Currency Labels', () => {
    it('formats Hungarian debit/credit KPI labels with Ft or custom currency', async () => {
      const tHu = i18n.getFixedT('hu', 'accounting');
      expect(tHu('general_ledger.kpi.debit', { currency: 'Ft' })).toBe('Tartozik (Ft)');
      expect(tHu('general_ledger.kpi.credit', { currency: 'Ft' })).toBe('Követel (Ft)');
      expect(tHu('general_ledger.kpi.debit', { currency: 'EUR' })).toBe('Tartozik (EUR)');
    });

    it('formats Croatian debit/credit KPI labels with EUR or custom currency', async () => {
      await i18n.changeLanguage('hr');
      const tHr = i18n.getFixedT('hr', 'accounting');
      expect(tHr('general_ledger.kpi.debit', { currency: 'EUR' })).toBe('Duguje (EUR)');
      expect(tHr('general_ledger.kpi.credit', { currency: 'EUR' })).toBe('Potražuje (EUR)');
      expect(tHr('general_ledger.kpi.debit', { currency: 'USD' })).toBe('Duguje (USD)');
    });
  });

  describe('Toolbar, Unclassified, and Tab Views Localization', () => {
    it('translates add_account in toolbar in Hungarian and Croatian', async () => {
      const tHu = i18n.getFixedT('hu', 'accounting');
      expect(tHu('general_ledger.toolbar.add_account')).toBe('Új főkönyvi szám');

      await i18n.changeLanguage('hr');
      const tHr = i18n.getFixedT('hr', 'accounting');
      expect(tHr('general_ledger.toolbar.add_account')).toBe('Novo konto');
    });

    it('translates unclassified in Hungarian and Croatian', async () => {
      const tHu = i18n.getFixedT('hu', 'accounting');
      expect(tHu('general_ledger.unclassified')).toBe('Besorolatlan');

      await i18n.changeLanguage('hr');
      const tHr = i18n.getFixedT('hr', 'accounting');
      expect(tHr('general_ledger.unclassified')).toBe('Neraspoređeno');
    });

    it('translates comparison_view and journal_view keys in Croatian', async () => {
      await i18n.changeLanguage('hr');
      const tHr = i18n.getFixedT('hr', 'accounting');

      // Journal View
      expect(tHr('general_ledger.journal_view.col_date')).toBe('Datum');
      expect(tHr('general_ledger.journal_view.col_partner')).toBe('Partner');
      expect(tHr('general_ledger.journal_view.col_debit')).toBe('Duguje');
      expect(tHr('general_ledger.journal_view.col_credit')).toBe('Potražuje');
      expect(tHr('general_ledger.journal_view.col_balance')).toBe('Saldo');

      // Comparison View
      expect(tHr('general_ledger.comparison_view.filter_all')).toBe('Sva konta');
      expect(tHr('general_ledger.comparison_view.col_balance')).toBe('Saldo');
      expect(tHr('general_ledger.comparison_view.col_diff', { currency: 'EUR' })).toBe('Odstupanje (EUR)');
      expect(tHr('general_ledger.comparison_view.col_change_pct')).toBe('Promjena %');

      // Partner Ledger Card
      expect(tHr('general_ledger.partner_ledger_card.select_partner')).toBe('Odaberite partnera');
      expect(tHr('general_ledger.partner_ledger_card.aging_current')).toBe('Nedospjelo');
      expect(tHr('general_ledger.partner_ledger_card.status_settled')).toBe('Podmireno');
      expect(tHr('general_ledger.partner_ledger_card.status_open')).toBe('Otvoreno');
    });
  });
});
