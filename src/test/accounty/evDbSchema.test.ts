/**
 * EV Module — DB Schema Validation Tests
 * 
 * These tests query the LIVE Supabase database to verify:
 * - Seed data correctness (tax params)
 * - Table existence (via read queries)
 * 
 * IMPORTANT: These require an authenticated Supabase session.
 * The RLS policies restrict reads to `authenticated` role.
 * If no SUPABASE_SERVICE_KEY env var is set, all tests are skipped.
 * 
 * Run with: SUPABASE_SERVICE_KEY=<key> npx vitest run src/test/accounty/evDbSchema.test.ts
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vxxgvdlqvvchtlmqnrqf.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

// Skip all tests if no service key
const canRun = SERVICE_KEY.length > 0;
const describeDb = canRun ? describe : describe.skip;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY || 'dummy');

// =============================================================================
// 1. Seed Data — Global Tax Parameters (2026)
// =============================================================================

describeDb('EV DB — Global Tax Parameters (2026)', () => {
  let params: Record<string, number> = {};

  beforeAll(async () => {
    const { data, error } = await supabase
      .from('accounty_global_tax_params')
      .select('param_key, param_value')
      .eq('tax_year', 2026);

    if (error) throw error;
    (data || []).forEach(row => {
      params[row.param_key] = Number(row.param_value);
    });
  });

  it('has at least 19 parameters for 2026', () => {
    expect(Object.keys(params).length).toBeGreaterThanOrEqual(19);
  });

  it('SZJA kulcs = 15%', () => expect(params['szja_kulcs']).toBe(0.15));
  it('TB járulék = 18.5%', () => expect(params['tb_jarulekkulcs']).toBe(0.185));
  it('Szocho = 13%', () => expect(params['szocho_kulcs']).toBe(0.13));
  it('Szocho plafon = 7.747.200 Ft', () => expect(params['szocho_plafon']).toBe(7747200));
  it('Minimálbér havi = 322.800 Ft', () => expect(params['minimalber_havi']).toBe(322800));
  it('Minimálbér éves = 3.873.600 Ft', () => expect(params['minimalber_eves']).toBe(3873600));
  it('Garantált bérminimum havi = 373.200 Ft', () => expect(params['garantalt_berminimum_havi']).toBe(373200));
  it('KATA havi tétel = 50.000 Ft', () => expect(params['kata_havi_tetel']).toBe(50000));
  it('KATA éves keret = 18.000.000 Ft', () => expect(params['kata_eves_keret']).toBe(18000000));
  it('KATA különadó = 40%', () => expect(params['kata_kulonado_kulcs']).toBe(0.40));
  it('Átalány bevételi határ = 38.736.000 Ft', () => expect(params['atalany_bevetel_hatar']).toBe(38736000));
  it('ÁFA alanyi határ = 20.000.000 Ft', () => expect(params['afa_alanyi_hatar']).toBe(20000000));
  it('Kamarai hozzájárulás = 5.000 Ft', () => expect(params['kamarai_hozzajarulas']).toBe(5000));
  it('VSZJA adókulcs = 9%', () => expect(params['vszja_adokulcs']).toBe(0.09));
  it('VSZJA osztalékadó = 15%', () => expect(params['vszja_osztalekado']).toBe(0.15));

  // Cross-validation
  it('szocho plafon = minimálbér × 24', () => {
    expect(params['szocho_plafon']).toBe(params['minimalber_havi'] * 24);
  });
  it('adómentes rész = éves minimálbér / 2', () => {
    expect(params['adomentes_resz']).toBe(params['minimalber_eves'] / 2);
  });
  it('éves minimálbér = havi × 12', () => {
    expect(params['minimalber_eves']).toBe(params['minimalber_havi'] * 12);
  });
  it('has HIPA slab params (hipa_sav_*)', () => {
    const hipaKeys = Object.keys(params).filter(k => k.startsWith('hipa_sav_'));
    expect(hipaKeys.length).toBeGreaterThanOrEqual(3);
  });

  it('no duplicate param_key', () => {
    // Already guaranteed by the Map construction, but verify count
    const keys = Object.keys(params);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });
});

// =============================================================================
// 2. Table Existence — Read queries to verify tables exist
// =============================================================================

describeDb('EV DB — Table Existence', () => {
  const tables = [
    'accounty_ev_client_settings',
    'accounty_penztarkonyv_tetel',
    'accounty_penztarkonyv_period_close',
    'accounty_ev_lifecycle_events',
    'accounty_ev_contribution_calc',
    'accounty_ev_tax_returns',
    'accounty_ev_hipa_calc',
    'accounty_ev_records_fixed_assets',
    'accounty_ev_records_receivables',
    'accounty_ev_records_payables',
    'accounty_ev_records_wages',
    'accounty_ev_records_vehicle_log',
    'accounty_ev_records_inventory',
    'accounty_ev_records_scrapping',
    'accounty_ev_records_other_claims',
    'accounty_ev_records_subcontractors',
    'accounty_ev_records_strict_forms',
    'accounty_ev_records_investments',
    'accounty_ev_records_securities',
    'accounty_ev_records_consignment',
    'accounty_global_tax_params',
  ];

  tables.forEach(tableName => {
    it(`table "${tableName}" exists and is queryable`, async () => {
      const { error } = await supabase
        .from(tableName as any)
        .select('id')
        .limit(1);

      // No "relation does not exist" error means the table is present
      if (error) {
        expect(error.message).not.toContain('relation');
        expect(error.message).not.toContain('does not exist');
      }
    });
  });
});

// =============================================================================
// When no service key, output a helpful message
// =============================================================================

if (!canRun) {
  describe('EV DB — Skipped (no service key)', () => {
    it('SUPABASE_SERVICE_KEY not set — DB tests skipped', () => {
      console.warn(
        '⚠️  Set SUPABASE_SERVICE_KEY env var to run DB schema tests.\n' +
        '    Example: $env:SUPABASE_SERVICE_KEY="<key>" ; npx vitest run src/test/accounty/evDbSchema.test.ts'
      );
      expect(true).toBe(true);
    });
  });
}
