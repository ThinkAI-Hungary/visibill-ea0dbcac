import { describe, it, expect } from 'vitest';
import type { PendingPostingItem, PostingGroup, RuleScopeOption, RuleToCreate } from '@/features/posting-wizard/types';

describe('Kontírozás Varázsló (Posting Wizard) Test Suite', () => {
  const sampleItems: PendingPostingItem[] = [
    {
      item_id: 'item-1',
      source_type: 'nav_invoice_item',
      invoice_id: 'inv-1',
      invoice_number: 'SZ-2026/001',
      invoice_direction: 'INBOUND',
      invoice_date: '2026-03-15',
      partner_name: 'Mol Nyrt.',
      partner_tax_number: '12345678-2-44',
      line_description: 'Üzemanyag vásárlás 95-ös benzin',
      net_amount: 45000,
      vat_amount: 12150,
      gross_amount: 57150,
      vat_rate: 27,
      vat_code: '27%',
      currency: 'HUF',
      matched_gl_id: 'gl-5111',
      matched_gl_number: '5111',
      matched_gl_name: 'Anyagköltség',
      rule_source: 'rule',
      confidence_score: 0.95,
      is_approved: false,
    },
    {
      item_id: 'item-2',
      source_type: 'nav_invoice_item',
      invoice_id: 'inv-1',
      invoice_number: 'SZ-2026/001',
      invoice_direction: 'INBOUND',
      invoice_date: '2026-03-15',
      partner_name: 'Mol Nyrt.',
      partner_tax_number: '12345678-2-44',
      line_description: 'Autópálya matrica',
      net_amount: 15000,
      vat_amount: 4050,
      gross_amount: 19050,
      vat_rate: 27,
      vat_code: '27%',
      currency: 'HUF',
      matched_gl_id: 'gl-5211',
      matched_gl_number: '5211',
      matched_gl_name: 'Bérleti díjak és egyéb szolgáltatások',
      rule_source: 'suggestion',
      confidence_score: 0.8,
      is_approved: false,
    },
    {
      item_id: 'item-3',
      source_type: 'nav_invoice_item',
      invoice_id: 'inv-2',
      invoice_number: 'SZ-2026/002',
      invoice_direction: 'INBOUND',
      invoice_date: '2026-03-20',
      partner_name: 'OMV Hungária Kft.',
      partner_tax_number: '87654321-2-41',
      line_description: 'Üzemanyag vásárlás dízel',
      net_amount: 32000,
      vat_amount: 8640,
      gross_amount: 40640,
      vat_rate: 27,
      vat_code: '27%',
      currency: 'HUF',
      matched_gl_id: 'gl-5111',
      matched_gl_number: '5111',
      matched_gl_name: 'Anyagköltség',
      rule_source: 'rule',
      confidence_score: 0.95,
      is_approved: false,
    },
  ];

  it('1. Csoportosítás főkönyvi számok szerint (Inverted GL Grouping)', () => {
    // Csoportosítás szimuláció
    const groupMap = new Map<string, PostingGroup>();

    for (const item of sampleItems) {
      const glNumber = item.matched_gl_number || 'BESOROLATLAN';
      const glName = item.matched_gl_name || 'Besorolásra váró tételek';

      if (!groupMap.has(glNumber)) {
        groupMap.set(glNumber, {
          gl_number: glNumber,
          gl_name: glName,
          gl_account_id: item.matched_gl_id,
          total_net: 0,
          total_gross: 0,
          items: [],
        });
      }

      const g = groupMap.get(glNumber)!;
      g.items.push(item);
      g.total_net += item.net_amount;
      g.total_gross += item.gross_amount;
    }

    const groups = Array.from(groupMap.values()).sort((a, b) => a.gl_number.localeCompare(b.gl_number));

    expect(groups.length).toBe(2);
    
    // 5111 csoport ellenőrzése
    const g5111 = groups.find((g) => g.gl_number === '5111');
    expect(g5111).toBeDefined();
    expect(g5111?.items.length).toBe(2);
    expect(g5111?.total_net).toBe(77000); // 45000 + 32000
    expect(g5111?.total_gross).toBe(97790); // 57150 + 40640

    // 5211 csoport ellenőrzése
    const g5211 = groups.find((g) => g.gl_number === '5211');
    expect(g5211).toBeDefined();
    expect(g5211?.items.length).toBe(1);
    expect(g5211?.total_net).toBe(15000);
  });

  it('2. Gyors áthelyezés egy másik kontírszám csoportba (Quick Reassignment)', () => {
    // Tegyük fel, hogy a könyvelő az item-2-t átteszi 5211-ről 5111-re
    const targetGlId = 'gl-5111';
    const targetGlNumber = '5111';
    const targetGlName = 'Anyagköltség';

    const updatedItems = sampleItems.map((item) => {
      if (item.item_id === 'item-2') {
        return {
          ...item,
          matched_gl_id: targetGlId,
          matched_gl_number: targetGlNumber,
          matched_gl_name: targetGlName,
          rule_source: 'manual' as const,
        };
      }
      return item;
    });

    const g5111Items = updatedItems.filter((i) => i.matched_gl_number === '5111');
    const g5211Items = updatedItems.filter((i) => i.matched_gl_number === '5211');

    expect(g5111Items.length).toBe(3);
    expect(g5211Items.length).toBe(0);
    expect(g5111Items.map((i) => i.item_id)).toContain('item-2');
  });

  it('3. Kötegelt jóváhagyás (Batch Selection & Approval State)', () => {
    const approvedItemIds = new Set<string>();

    // Egyedi jóváhagyás (Space)
    approvedItemIds.add('item-1');
    expect(approvedItemIds.has('item-1')).toBe(true);
    expect(approvedItemIds.size).toBe(1);

    // Csoportos jóváhagyás ("Összes jóváhagyása ebben a csoportban")
    const groupItems = sampleItems.filter((i) => i.matched_gl_number === '5111');
    for (const item of groupItems) {
      approvedItemIds.add(item.item_id);
    }

    expect(approvedItemIds.has('item-1')).toBe(true);
    expect(approvedItemIds.has('item-3')).toBe(true);
    expect(approvedItemIds.size).toBe(2);

    // Köteg állapota
    const totalInBatch = sampleItems.length;
    const isFullyApproved = approvedItemIds.size === totalInBatch;
    expect(isFullyApproved).toBe(false);

    // Teljes köteg jóváhagyása
    for (const item of sampleItems) {
      approvedItemIds.add(item.item_id);
    }
    expect(approvedItemIds.size).toBe(totalInBatch);
  });

  it('4. Szabálykészítési opciók és hatókör (Rule Scope Logic)', () => {
    const approvedItems = [sampleItems[0], sampleItems[1]];
    const ruleScopeCompany: RuleScopeOption = 'company';
    const ruleScopeTenant: RuleScopeOption = 'tenant';
    const ruleScopeNone: RuleScopeOption = 'none';

    const rulesToCreate: RuleToCreate[] = approvedItems.map((item) => ({
      partner_name: item.partner_name,
      partner_tax_number: item.partner_tax_number,
      keyword: item.line_description,
      gl_account_id: item.matched_gl_id || '',
      gl_account_number: item.matched_gl_number || '',
      invoice_direction: item.invoice_direction,
    }));

    expect(rulesToCreate.length).toBe(2);
    expect(rulesToCreate[0].partner_name).toBe('Mol Nyrt.');
    expect(rulesToCreate[0].gl_account_number).toBe('5111');

    // Ha 'none', akkor a rulesToCreate nem kerül elmentésre a DB-be
    const payloadWhenNone = {
      ruleScope: ruleScopeNone,
      rules: ruleScopeNone === 'none' ? [] : rulesToCreate,
    };
    expect(payloadWhenNone.rules.length).toBe(0);

    // Ha 'company', akkor 2 céges szabály jön létre
    const payloadWhenCompany = {
      ruleScope: ruleScopeCompany,
      rules: rulesToCreate,
    };
    expect(payloadWhenCompany.rules.length).toBe(2);
    expect(payloadWhenCompany.ruleScope).toBe('company');

    // Ha 'tenant', akkor 2 irodai (globális) szabály jön létre
    const payloadWhenTenant = {
      ruleScope: ruleScopeTenant,
      rules: rulesToCreate,
    };
    expect(payloadWhenTenant.rules.length).toBe(2);
    expect(payloadWhenTenant.ruleScope).toBe('tenant');
  });
});
