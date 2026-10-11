import { describe, it, expect, vi, beforeEach } from 'vitest';
import { inferGlField, parseGlTemplateFile, MAX_GL_TEMPLATE_COLUMNS } from '@/lib/glTemplateParser';
import { BUILTIN_GL_TEMPLATES } from '@/hooks/useGlViewTemplates';
import { exportGlExcel, GLRow } from '@/lib/glExport';
import type { GlViewTemplate } from '@/types/glTemplate';

describe('GL View Templates - Parser & Inference', () => {
  it('correctly infers GL field types from Hungarian and English header labels', () => {
    // ID / Account number
    expect(inferGlField('Főkönyvi szám').field).toBe('id');
    expect(inferGlField('Fők. szám').field).toBe('id');
    expect(inferGlField('Számlaszám').field).toBe('id');
    expect(inferGlField('Account Number').field).toBe('id');
    expect(inferGlField('Konto').field).toBe('id');

    // Name
    expect(inferGlField('Megnevezés').field).toBe('name');
    expect(inferGlField('Számla neve').field).toBe('name');
    expect(inferGlField('Account Name').field).toBe('name');

    // Balance
    expect(inferGlField('Egyenleg').field).toBe('balance');
    expect(inferGlField('Záró egyenleg').field).toBe('balance');
    expect(inferGlField('Total Balance').field).toBe('balance');

    // Turnovers
    expect(inferGlField('Forgalom T').field).toBe('debitTurnover');
    expect(inferGlField('Tartozik forgalom').field).toBe('debitTurnover');
    expect(inferGlField('Forgalom K').field).toBe('creditTurnover');
    expect(inferGlField('Követel forgalom').field).toBe('creditTurnover');

    // Balance Debit / Credit
    expect(inferGlField('Egyenleg T').field).toBe('balanceDebit');
    expect(inferGlField('Tartozik egyenleg').field).toBe('balanceDebit');
    expect(inferGlField('Egyenleg K').field).toBe('balanceCredit');
    expect(inferGlField('Követel egyenleg').field).toBe('balanceCredit');

    // Partner, Invoice, Date
    expect(inferGlField('Partner neve').field).toBe('partner');
    expect(inferGlField('Bizonylatszám').field).toBe('invoiceNumber');
    expect(inferGlField('Teljesítés dátuma').field).toBe('date');

    // Unrecognized / Custom
    expect(inferGlField('Megjegyzések és egyéb').field).toBe('custom');
  });

  it('parses CSV sample content into structured template columns', async () => {
    const csvContent = 'Főkönyvi szám;Megnevezés;Tartozik forgalom;Követel forgalom;Egyenleg\n111;Ingatlanok;1000000;0;1000000\n';
    const file = new File([csvContent], 'test_sablon.csv', { type: 'text/csv' });

    const result = await parseGlTemplateFile(file, 'Teszt Irodai Sablon');

    expect(result.name).toBe('Teszt Irodai Sablon');
    expect(result.columns).toHaveLength(5);

    expect(result.columns[0].field).toBe('id');
    expect(result.columns[1].field).toBe('name');
    expect(result.columns[2].field).toBe('debitTurnover');
    expect(result.columns[3].field).toBe('creditTurnover');
    expect(result.columns[4].field).toBe('balance');

    expect(result.columns[2].format).toBe('currency');
    expect(result.columns[2].align).toBe('right');
    expect(result.columns[0].align).toBe('center');
  });

  it('caps column count at MAX_GL_TEMPLATE_COLUMNS (16) and generates a warning', async () => {
    const headers = Array.from({ length: 22 }, (_, i) => `Oszlop ${i + 1}`).join(';') + ';Főkönyvi szám;Megnevezés;Egyenleg';
    const rowValues = Array.from({ length: 25 }, (_, i) => `Érték ${i + 1}`).join(';');
    const csvContent = `${headers}\n${rowValues}\n`;
    const file = new File([csvContent], 'sok_oszlop.csv', { type: 'text/csv' });

    const result = await parseGlTemplateFile(file, 'Sok Oszlopos Sablon');
    expect(result.columns.length).toBe(MAX_GL_TEMPLATE_COLUMNS);
    expect(result.warnings.some(w => w.includes('16 oszlop'))).toBe(true);
  });
});

describe('GL View Templates - Built-in Catalog', () => {
  it('provides all 5 core built-in templates with valid configuration', () => {
    expect(BUILTIN_GL_TEMPLATES).toHaveLength(5);

    const ids = BUILTIN_GL_TEMPLATES.map(t => t.id);
    expect(ids).toContain('standard_3col');
    expect(ids).toContain('classic_6col');
    expect(ids).toContain('balance_4col');
    expect(ids).toContain('analytic_8col');
    expect(ids).toContain('agora_6col');

    BUILTIN_GL_TEMPLATES.forEach(tpl => {
      expect(tpl.template_type).toBe('builtin');
      expect(tpl.columns.length).toBeGreaterThanOrEqual(3);
      tpl.columns.forEach(col => {
        expect(col.id).toBeDefined();
        expect(col.label).toBeDefined();
        expect(col.field).toBeDefined();
        expect(['left', 'center', 'right']).toContain(col.align);
      });
    });
  });
});

describe('GL View Templates - Export with Custom Template', () => {
  beforeEach(() => {
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  it('exports Excel file using custom template columns layout', async () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const removeSpy = vi.spyOn(document.body, 'removeChild');

    const sampleRows: GLRow[] = [
      {
        id: '311',
        name: 'Belföldi vevők',
        balance: 150000,
        hasChildren: false,
        cid: '311',
        depth: 0,
        debitTurnover: 150000,
        creditTurnover: 0,
      },
    ];

    const customTemplate: GlViewTemplate = {
      id: 'custom_test_1',
      name: 'Teszt 4 Oszlopos Egyenleg Sablon',
      template_type: 'custom',
      columns: [
        { id: 'c1', key: 'gl_num', label: 'Fők. szám', field: 'id', align: 'center' },
        { id: 'c2', key: 'gl_name', label: 'Megnevezés', field: 'name', align: 'left' },
        { id: 'c3', key: 'gl_deb', label: 'Tartozik', field: 'balanceDebit', align: 'right', format: 'currency' },
        { id: 'c4', key: 'gl_crd', label: 'Követel', field: 'balanceCredit', align: 'right', format: 'currency' },
      ],
    };

    await exportGlExcel(sampleRows, 'Teszt Kft', { balanceDebit: 150000, balanceCredit: 0 }, 'teljesites', '2026-01-01', '2026-12-31', {
      template: customTemplate,
    });

    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
    expect(global.URL.createObjectURL).toHaveBeenCalled();
  }, 20000);
});
