import { describe, it, expect } from 'vitest';
import type {
  EvTaxpayerForm,
  EvEmploymentStatus,
  EvVatStatus,
  EvCostRatioCategory,
  EvOrgType,
  EvBookkeepingMode,
  PenztarkonyvDirection,
  PenztarkonyvCategory,
  PenztarkonyvTetel,
  EvClientSettings,
  EvLifecycleEvent,
  EvFixedAsset,
  EvContributionCalc,
  EvTaxReturn,
} from '@/hooks/useEvData';

// =============================================================================
// 1. Enum/Type Validation Tests
// =============================================================================

describe('EV Module — Type Definitions', () => {
  describe('EvTaxpayerForm', () => {
    it('accepts valid taxpayer forms', () => {
      const valid: EvTaxpayerForm[] = ['atalany', 'vszja', 'kata'];
      expect(valid).toHaveLength(3);
      valid.forEach(v => expect(typeof v).toBe('string'));
    });
  });

  describe('EvEmploymentStatus', () => {
    it('accepts valid employment statuses', () => {
      const valid: EvEmploymentStatus[] = ['foallasu', 'mellekallasu', 'kiegeszito'];
      expect(valid).toHaveLength(3);
    });
  });

  describe('EvVatStatus', () => {
    it('accepts valid VAT statuses', () => {
      const valid: EvVatStatus[] = ['alanyi_mentes', 'afas', 'penzforgalmi'];
      expect(valid).toHaveLength(3);
    });
  });

  describe('EvCostRatioCategory', () => {
    it('has three categories matching the tax law', () => {
      const valid: EvCostRatioCategory[] = ['general', 'high_80', 'retail_90'];
      expect(valid).toHaveLength(3);
    });
  });

  describe('EvOrgType', () => {
    it('has 7 organization types', () => {
      const valid: EvOrgType[] = ['egyesulet', 'alapitvany', 'egyhaz', 'tarsashaz', 'lakasszov', 'mrp', 'egyeb'];
      expect(valid).toHaveLength(7);
    });
  });

  describe('EvBookkeepingMode', () => {
    it('has two modes', () => {
      const valid: EvBookkeepingMode[] = ['egyszeres', 'kettos'];
      expect(valid).toHaveLength(2);
    });
  });

  describe('PenztarkonyvDirection', () => {
    it('has two directions', () => {
      const valid: PenztarkonyvDirection[] = ['bevetel', 'kiadas'];
      expect(valid).toHaveLength(2);
    });
  });

  describe('PenztarkonyvCategory', () => {
    it('has 11 categories matching Szja tv. 5. sz. melléklet I. rész', () => {
      const valid: PenztarkonyvCategory[] = [
        'bevetel_adokoteles', 'bevetel_fizetendo_afa', 'bevetel_be_nem_szamito',
        'kiadas_anyag_arubeszerzes', 'kiadas_kozvetitett_szolgaltatas',
        'kiadas_alkalmazott_ber_kozteher', 'kiadas_vallalkozoi_kivet',
        'kiadas_egyeb_koltseg', 'kiadas_beruhazasi_koltseg',
        'kiadas_levonhato_afa', 'kiadas_egyeb_nem_koltseg',
      ];
      expect(valid).toHaveLength(11);
    });

    it('bevétel categories all start with "bevetel_"', () => {
      const bevetelCats: PenztarkonyvCategory[] = [
        'bevetel_adokoteles', 'bevetel_fizetendo_afa', 'bevetel_be_nem_szamito',
      ];
      bevetelCats.forEach(c => expect(c).toMatch(/^bevetel_/));
    });

    it('kiadás categories all start with "kiadas_"', () => {
      const kiadasCats: PenztarkonyvCategory[] = [
        'kiadas_anyag_arubeszerzes', 'kiadas_kozvetitett_szolgaltatas',
        'kiadas_alkalmazott_ber_kozteher', 'kiadas_vallalkozoi_kivet',
        'kiadas_egyeb_koltseg', 'kiadas_beruhazasi_koltseg',
        'kiadas_levonhato_afa', 'kiadas_egyeb_nem_koltseg',
      ];
      kiadasCats.forEach(c => expect(c).toMatch(/^kiadas_/));
      expect(kiadasCats).toHaveLength(8);
    });
  });
});

// =============================================================================
// 2. Interface Shape Tests
// =============================================================================

describe('EV Module — Interface Shapes', () => {
  const mockSettings: EvClientSettings = {
    id: 'test-id',
    company_id: 'comp-1',
    tax_year: 2026,
    taxpayer_form: 'atalany',
    employment_status: 'foallasu',
    vat_status: 'alanyi_mentes',
    cost_ratio_category: 'general',
    registration_number: '12345678',
    activity_codes: ['6201', '6202'],
    main_activity_code: '6201',
    skilled_main_activity: true,
    bookkeeping_mode: 'egyszeres',
    org_type: null,
    is_public_benefit: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  it('EvClientSettings has all required fields', () => {
    expect(mockSettings).toHaveProperty('id');
    expect(mockSettings).toHaveProperty('company_id');
    expect(mockSettings).toHaveProperty('tax_year');
    expect(mockSettings).toHaveProperty('taxpayer_form');
    expect(mockSettings).toHaveProperty('employment_status');
    expect(mockSettings).toHaveProperty('vat_status');
    expect(mockSettings).toHaveProperty('cost_ratio_category');
    expect(mockSettings).toHaveProperty('bookkeeping_mode');
    expect(mockSettings).toHaveProperty('is_public_benefit');
  });

  it('PenztarkonyvTetel has all 5. melléklet fields', () => {
    const mockEntry: PenztarkonyvTetel = {
      id: 'entry-1',
      company_id: 'comp-1',
      tax_year: 2026,
      serial_number: 1,
      entry_date: '2026-01-15',
      document_number: 'SZ-001',
      description: 'Szolgáltatás díj',
      entry_direction: 'bevetel',
      main_category: 'bevetel_adokoteles',
      amount: 100000,
      vat_amount: 0,
      document_url: null,
      period_closed: false,
      storno_of_id: null,
      is_storno: false,
      linked_record_type: null,
      linked_record_id: null,
      created_at: '2026-01-15T10:00:00Z',
      created_by: 'user-1',
    };

    // a) sorszám
    expect(mockEntry.serial_number).toBeGreaterThan(0);
    // b) gazdasági esemény időpontja
    expect(mockEntry.entry_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // c) bizonylat sorszáma
    expect(mockEntry).toHaveProperty('document_number');
    // d) rövid leírás
    expect(mockEntry.description.length).toBeGreaterThan(0);
    // e-f) bevétel/kiadás kategória
    expect(mockEntry).toHaveProperty('main_category');
    expect(mockEntry).toHaveProperty('amount');
  });

  it('EvLifecycleEvent tracks form changes', () => {
    const event: EvLifecycleEvent = {
      id: 'lc-1',
      company_id: 'comp-1',
      event_type: 'form_change',
      event_date: '2026-06-01',
      from_form: 'kata',
      to_form: 'vszja',
      notes: 'KATA-ból VSZJA-ra váltás',
      created_at: '2026-06-01T00:00:00Z',
    };
    expect(event.event_type).toBe('form_change');
    expect(event.from_form).not.toBe(event.to_form);
  });
});

// =============================================================================
// 3. Cashbook Calculation Logic Tests
// =============================================================================

describe('EV Module — Cashbook Calculations', () => {
  // Simulates the useCashbookTotals aggregation logic
  function calculateTotals(entries: Pick<PenztarkonyvTetel, 'main_category' | 'entry_direction' | 'amount' | 'is_storno'>[]) {
    const totals: Record<string, number> = {};
    let totalBevetel = 0;
    let totalKiadas = 0;

    entries.forEach(row => {
      const multiplier = row.is_storno ? -1 : 1;
      const amount = (row.amount || 0) * multiplier;
      totals[row.main_category] = (totals[row.main_category] || 0) + amount;
      if (row.entry_direction === 'bevetel') totalBevetel += amount;
      else totalKiadas += amount;
    });

    return { totals, totalBevetel, totalKiadas, balance: totalBevetel - totalKiadas };
  }

  it('calculates correct balance with only income', () => {
    const result = calculateTotals([
      { main_category: 'bevetel_adokoteles', entry_direction: 'bevetel', amount: 100000, is_storno: false },
      { main_category: 'bevetel_adokoteles', entry_direction: 'bevetel', amount: 50000, is_storno: false },
    ]);
    expect(result.totalBevetel).toBe(150000);
    expect(result.totalKiadas).toBe(0);
    expect(result.balance).toBe(150000);
  });

  it('calculates correct balance with income and expenses', () => {
    const result = calculateTotals([
      { main_category: 'bevetel_adokoteles', entry_direction: 'bevetel', amount: 200000, is_storno: false },
      { main_category: 'kiadas_anyag_arubeszerzes', entry_direction: 'kiadas', amount: 80000, is_storno: false },
      { main_category: 'kiadas_egyeb_koltseg', entry_direction: 'kiadas', amount: 20000, is_storno: false },
    ]);
    expect(result.totalBevetel).toBe(200000);
    expect(result.totalKiadas).toBe(100000);
    expect(result.balance).toBe(100000);
  });

  it('storno entries reduce totals', () => {
    const result = calculateTotals([
      { main_category: 'bevetel_adokoteles', entry_direction: 'bevetel', amount: 100000, is_storno: false },
      { main_category: 'bevetel_adokoteles', entry_direction: 'bevetel', amount: 100000, is_storno: true },
    ]);
    expect(result.totalBevetel).toBe(0);
    expect(result.balance).toBe(0);
  });

  it('storno of expense increases balance', () => {
    const result = calculateTotals([
      { main_category: 'bevetel_adokoteles', entry_direction: 'bevetel', amount: 200000, is_storno: false },
      { main_category: 'kiadas_anyag_arubeszerzes', entry_direction: 'kiadas', amount: 50000, is_storno: false },
      { main_category: 'kiadas_anyag_arubeszerzes', entry_direction: 'kiadas', amount: 50000, is_storno: true },
    ]);
    expect(result.totalBevetel).toBe(200000);
    expect(result.totalKiadas).toBe(0); // 50k - 50k storno = 0
    expect(result.balance).toBe(200000);
  });

  it('aggregates totals per category', () => {
    const result = calculateTotals([
      { main_category: 'bevetel_adokoteles', entry_direction: 'bevetel', amount: 100000, is_storno: false },
      { main_category: 'bevetel_adokoteles', entry_direction: 'bevetel', amount: 50000, is_storno: false },
      { main_category: 'bevetel_fizetendo_afa', entry_direction: 'bevetel', amount: 27000, is_storno: false },
    ]);
    expect(result.totals['bevetel_adokoteles']).toBe(150000);
    expect(result.totals['bevetel_fizetendo_afa']).toBe(27000);
  });

  it('handles empty entries', () => {
    const result = calculateTotals([]);
    expect(result.totalBevetel).toBe(0);
    expect(result.totalKiadas).toBe(0);
    expect(result.balance).toBe(0);
    expect(Object.keys(result.totals)).toHaveLength(0);
  });

  it('handles zero-amount entries', () => {
    const result = calculateTotals([
      { main_category: 'bevetel_adokoteles', entry_direction: 'bevetel', amount: 0, is_storno: false },
    ]);
    expect(result.totalBevetel).toBe(0);
    expect(result.balance).toBe(0);
  });
});

// =============================================================================
// 4. RECORD_TABLE_MAP Tests
// =============================================================================

describe('EV Module — RECORD_TABLE_MAP', () => {
  // Copy of the map from useEvData.ts (must stay in sync)
  const RECORD_TABLE_MAP: Record<string, string> = {
    'vevo-szallito': 'accounty_ev_records_receivables',
    'tao-kesz': 'accounty_ev_records_fixed_assets',
    'keszlet': 'accounty_ev_records_inventory',
    'utnyilv': 'accounty_ev_records_vehicle_log',
    'berbeadas': 'accounty_ev_records_other_claims',
    'valuta': 'accounty_ev_records_other_claims',
    'munkaber': 'accounty_ev_records_wages',
    'selejtezes': 'accounty_ev_records_scrapping',
    'lekerdezes': 'accounty_ev_audit_log',
    'jog-bizt': 'accounty_ev_records_wages',
  };

  it('has 10 record type mappings', () => {
    expect(Object.keys(RECORD_TABLE_MAP)).toHaveLength(10);
  });

  it('all table names start with "accounty_ev_"', () => {
    Object.values(RECORD_TABLE_MAP).forEach(table => {
      expect(table).toMatch(/^accounty_ev_/);
    });
  });

  it('maps critical record types', () => {
    expect(RECORD_TABLE_MAP['vevo-szallito']).toBe('accounty_ev_records_receivables');
    expect(RECORD_TABLE_MAP['tao-kesz']).toBe('accounty_ev_records_fixed_assets');
    expect(RECORD_TABLE_MAP['keszlet']).toBe('accounty_ev_records_inventory');
    expect(RECORD_TABLE_MAP['utnyilv']).toBe('accounty_ev_records_vehicle_log');
    expect(RECORD_TABLE_MAP['munkaber']).toBe('accounty_ev_records_wages');
    expect(RECORD_TABLE_MAP['selejtezes']).toBe('accounty_ev_records_scrapping');
  });

  it('berbeadas and valuta share the same table (other_claims)', () => {
    expect(RECORD_TABLE_MAP['berbeadas']).toBe(RECORD_TABLE_MAP['valuta']);
    expect(RECORD_TABLE_MAP['berbeadas']).toBe('accounty_ev_records_other_claims');
  });

  it('munkaber and jog-bizt share the wages table', () => {
    expect(RECORD_TABLE_MAP['munkaber']).toBe(RECORD_TABLE_MAP['jog-bizt']);
    expect(RECORD_TABLE_MAP['munkaber']).toBe('accounty_ev_records_wages');
  });

  it('unique table names cover 8 distinct tables', () => {
    const uniqueTables = new Set(Object.values(RECORD_TABLE_MAP));
    expect(uniqueTables.size).toBe(8); // 10 keys → 8 unique tables (2 pairs share)
  });
});

// =============================================================================
// 5. Tax Parameter (Seed) Value Tests — 2026
// =============================================================================

describe('EV Module — 2026 Tax Parameters (Expected Seed Values)', () => {
  // These match the values from 20260627_ev_tax_params_seed.sql
  const EXPECTED_2026_PARAMS: Record<string, number> = {
    szja_kulcs: 0.15,
    tb_jarulekkulcs: 0.185,
    szocho_kulcs: 0.13,
    szocho_minimum_szorzo: 1.00,
    szocho_plafon: 7747200,
    minimalber_havi: 322800,
    minimalber_eves: 3873600,
    garantalt_berminimum_havi: 373200,
    garantalt_berminimum_eves: 4478400,
    kata_havi_tetel: 50000,
    kata_eves_keret: 18000000,
    kata_kulonado_kulcs: 0.40,
    atalany_bevetel_hatar: 38736000,
    atalany_kisker_hatar: 193680000,
    adomentes_resz: 1936800,
    afa_alanyi_hatar: 20000000,
    kamarai_hozzajarulas: 5000,
    vszja_adokulcs: 0.09,
    vszja_osztalekado: 0.15,
  };

  it('has 19 expected tax parameters for 2026', () => {
    expect(Object.keys(EXPECTED_2026_PARAMS)).toHaveLength(19);
  });

  // SZJA
  it('SZJA kulcs = 15%', () => expect(EXPECTED_2026_PARAMS.szja_kulcs).toBe(0.15));
  
  // TB, Szocho
  it('TB járulék = 18.5%', () => expect(EXPECTED_2026_PARAMS.tb_jarulekkulcs).toBe(0.185));
  it('Szocho = 13%', () => expect(EXPECTED_2026_PARAMS.szocho_kulcs).toBe(0.13));
  it('Szocho szorzó = 1.00 (2026: megszűnt)', () => expect(EXPECTED_2026_PARAMS.szocho_minimum_szorzo).toBe(1.00));
  it('Szocho plafon = 7.747.200 Ft (322800 × 24)', () => {
    expect(EXPECTED_2026_PARAMS.szocho_plafon).toBe(322800 * 24);
  });

  // Minimálbér
  it('minimálbér havi = 322.800 Ft', () => expect(EXPECTED_2026_PARAMS.minimalber_havi).toBe(322800));
  it('minimálbér éves = 3.873.600 Ft (322800 × 12)', () => {
    expect(EXPECTED_2026_PARAMS.minimalber_eves).toBe(322800 * 12);
  });
  it('garantált bérminimum havi = 373.200 Ft', () => expect(EXPECTED_2026_PARAMS.garantalt_berminimum_havi).toBe(373200));
  it('garantált bérminimum éves = 4.478.400 Ft (373200 × 12)', () => {
    expect(EXPECTED_2026_PARAMS.garantalt_berminimum_eves).toBe(373200 * 12);
  });

  // KATA
  it('KATA havi tétel = 50.000 Ft', () => expect(EXPECTED_2026_PARAMS.kata_havi_tetel).toBe(50000));
  it('KATA éves keret = 18.000.000 Ft', () => expect(EXPECTED_2026_PARAMS.kata_eves_keret).toBe(18000000));
  it('KATA különadó = 40%', () => expect(EXPECTED_2026_PARAMS.kata_kulonado_kulcs).toBe(0.40));

  // Átalány
  it('átalány bevételi határ = 38.736.000 Ft', () => expect(EXPECTED_2026_PARAMS.atalany_bevetel_hatar).toBe(38736000));
  it('kiskereskedelmi határ = 193.680.000 Ft', () => expect(EXPECTED_2026_PARAMS.atalany_kisker_hatar).toBe(193680000));
  it('adómentes rész = 1.936.800 Ft (min.bér éves / 2)', () => {
    expect(EXPECTED_2026_PARAMS.adomentes_resz).toBe(EXPECTED_2026_PARAMS.minimalber_eves / 2);
  });

  // ÁFA
  it('ÁFA alanyi határ = 20.000.000 Ft', () => expect(EXPECTED_2026_PARAMS.afa_alanyi_hatar).toBe(20000000));

  // Kamarai
  it('kamarai hozzájárulás = 5.000 Ft', () => expect(EXPECTED_2026_PARAMS.kamarai_hozzajarulas).toBe(5000));

  // VSZJA
  it('vállalkozói SZJA kulcs = 9%', () => expect(EXPECTED_2026_PARAMS.vszja_adokulcs).toBe(0.09));
  it('vállalkozói osztalékadó = 15%', () => expect(EXPECTED_2026_PARAMS.vszja_osztalekado).toBe(0.15));
});

// =============================================================================
// 6. Period Close Date Filter Logic Tests
// =============================================================================

describe('EV Module — Period Close Date Filters', () => {
  // Replicates the date filter logic from useClosePeriod
  function getDateFilter(periodType: string, periodKey: string, taxYear: number) {
    if (periodType === 'monthly') {
      const [yearStr, monthStr] = periodKey.split('-');
      const y = parseInt(yearStr, 10);
      const m = parseInt(monthStr, 10);
      const lastDay = new Date(y, m, 0).getDate();
      return { from: `${periodKey}-01`, to: `${periodKey}-${String(lastDay).padStart(2, '0')}` };
    } else if (periodType === 'quarterly') {
      const [year, q] = periodKey.split('-Q');
      const qNum = parseInt(q, 10);
      const startMonth = (qNum - 1) * 3 + 1;
      const endMonth = qNum * 3;
      const lastDay = new Date(parseInt(year, 10), endMonth, 0).getDate();
      return {
        from: `${year}-${String(startMonth).padStart(2, '0')}-01`,
        to: `${year}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
      };
    } else {
      return { from: `${taxYear}-01-01`, to: `${taxYear}-12-31` };
    }
  }

  it('monthly: January 2026', () => {
    const filter = getDateFilter('monthly', '2026-01', 2026);
    expect(filter.from).toBe('2026-01-01');
    expect(filter.to).toBe('2026-01-31');
  });

  it('monthly: December 2026', () => {
    const filter = getDateFilter('monthly', '2026-12', 2026);
    expect(filter.from).toBe('2026-12-01');
    expect(filter.to).toBe('2026-12-31');
  });

  it('quarterly: Q1 = Jan-Mar', () => {
    const filter = getDateFilter('quarterly', '2026-Q1', 2026);
    expect(filter.from).toBe('2026-01-01');
    expect(filter.to).toBe('2026-03-31');
  });

  it('quarterly: Q2 = Apr-Jun', () => {
    const filter = getDateFilter('quarterly', '2026-Q2', 2026);
    expect(filter.from).toBe('2026-04-01');
    expect(filter.to).toBe('2026-06-30');
  });

  it('quarterly: Q3 = Jul-Sep', () => {
    const filter = getDateFilter('quarterly', '2026-Q3', 2026);
    expect(filter.from).toBe('2026-07-01');
    expect(filter.to).toBe('2026-09-30');
  });

  it('quarterly: Q4 = Oct-Dec', () => {
    const filter = getDateFilter('quarterly', '2026-Q4', 2026);
    expect(filter.from).toBe('2026-10-01');
    expect(filter.to).toBe('2026-12-31');
  });

  it('annual: full year', () => {
    const filter = getDateFilter('annual', '2026', 2026);
    expect(filter.from).toBe('2026-01-01');
    expect(filter.to).toBe('2026-12-31');
  });
});

// =============================================================================
// 7. Storno Entry Generation Tests
// =============================================================================

describe('EV Module — Storno Entry Generation', () => {
  const originalEntry: PenztarkonyvTetel = {
    id: 'original-1',
    company_id: 'comp-1',
    tax_year: 2026,
    serial_number: 5,
    entry_date: '2026-02-10',
    document_number: 'SZ-005',
    description: 'Irodaszer beszerzés',
    entry_direction: 'kiadas',
    main_category: 'kiadas_anyag_arubeszerzes',
    amount: 35000,
    vat_amount: 9450,
    document_url: null,
    period_closed: true,
    storno_of_id: null,
    is_storno: false,
    linked_record_type: null,
    linked_record_id: null,
    created_at: '2026-02-10T08:00:00Z',
    created_by: 'user-1',
  };

  // Simulates storno generation from useStornoCashbookEntry
  function generateStorno(original: PenztarkonyvTetel, newSerial: number) {
    return {
      company_id: original.company_id,
      tax_year: original.tax_year,
      serial_number: newSerial,
      entry_date: new Date().toISOString().split('T')[0],
      document_number: `STORNO-${original.document_number || original.serial_number}`,
      description: `[STORNO] ${original.description}`,
      entry_direction: original.entry_direction,
      main_category: original.main_category,
      amount: -original.amount,
      vat_amount: -(original.vat_amount || 0),
      is_storno: true,
      storno_of_id: original.id,
    };
  }

  it('storno amount is negative of original', () => {
    const storno = generateStorno(originalEntry, 10);
    expect(storno.amount).toBe(-35000);
    expect(storno.vat_amount).toBe(-9450);
  });

  it('storno references the original entry', () => {
    const storno = generateStorno(originalEntry, 10);
    expect(storno.storno_of_id).toBe('original-1');
  });

  it('storno is flagged as is_storno', () => {
    const storno = generateStorno(originalEntry, 10);
    expect(storno.is_storno).toBe(true);
  });

  it('storno document_number includes STORNO prefix', () => {
    const storno = generateStorno(originalEntry, 10);
    expect(storno.document_number).toBe('STORNO-SZ-005');
  });

  it('storno description includes [STORNO] prefix', () => {
    const storno = generateStorno(originalEntry, 10);
    expect(storno.description).toBe('[STORNO] Irodaszer beszerzés');
  });

  it('storno keeps same direction and category', () => {
    const storno = generateStorno(originalEntry, 10);
    expect(storno.entry_direction).toBe('kiadas');
    expect(storno.main_category).toBe('kiadas_anyag_arubeszerzes');
  });

  it('storno + original cancel out to zero', () => {
    const storno = generateStorno(originalEntry, 10);
    expect(originalEntry.amount + storno.amount).toBe(0);
    expect((originalEntry.vat_amount || 0) + storno.vat_amount).toBe(0);
  });
});
