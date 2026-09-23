import { describe, it, expect } from 'vitest';

describe('GL Tree Performance & Structure Test', () => {
  // Generate a mock dataset representing the Croatian chart of accounts:
  // 10 root classes (0.-9.), 55 groups (00.-99.), ~1900 accounts (0000, 0001, etc.)
  const generateCroatianMockAccounts = () => {
    const accounts: Array<{
      gl_number: string;
      short_name: string;
      gl_account_id: string;
      total_balance: number;
      final_balance: number;
      temp_balance: number;
      item_count: number;
    }> = [];

    // 10 classes
    for (let c = 0; c <= 9; c++) {
      accounts.push({
        gl_number: `${c}.`,
        short_name: `Class ${c}`,
        gl_account_id: `class-${c}`,
        total_balance: 0,
        final_balance: 0,
        temp_balance: 0,
        item_count: 0
      });
    }

    // 55 groups (e.g. 00., 01., 02., 10., etc.)
    for (let c = 0; c <= 9; c++) {
      for (let g = 0; g < 6; g++) {
        accounts.push({
          gl_number: `${c}${g}.`,
          short_name: `Group ${c}${g}`,
          gl_account_id: `group-${c}${g}`,
          total_balance: 0,
          final_balance: 0,
          temp_balance: 0,
          item_count: 0
        });
      }
    }

    // ~1900 accounts (e.g. 0000..0030 under group 00., etc.)
    for (let c = 0; c <= 9; c++) {
      for (let g = 0; g < 6; g++) {
        for (let a = 0; a < 32; a++) {
          const accNum = `${c}${g}${a < 10 ? '0' + a : a}`;
          accounts.push({
            gl_number: accNum,
            short_name: `Account ${accNum}`,
            gl_account_id: `acc-${accNum}`,
            total_balance: a * 100,
            final_balance: a * 100,
            temp_balance: 0,
            item_count: a % 3 === 0 ? 5 : 0
          });
        }
      }
    }

    return accounts;
  };

  it('builds tree and computes ancestor chains in under 50ms for ~2000 accounts', () => {
    const mockAccounts = generateCroatianMockAccounts();
    expect(mockAccounts.length).toBeGreaterThan(1900);

    const cleanId = (s: string) => s.replace(/\./g, '');

    const t0 = performance.now();

    // Fast O(N) tree building
    const nodeMap = new Map<string, any>();
    const rawData = mockAccounts.map(dbItem => {
      const cid = cleanId(dbItem.gl_number);
      const directItemCount = Number(dbItem.item_count) || 0;
      const item = {
        id: String(dbItem.gl_number),
        name: dbItem.short_name,
        glAccountId: dbItem.gl_account_id,
        balance: Number(dbItem.total_balance) || 0,
        debitTurnover: 0,
        creditTurnover: 0,
        directFinalBalance: Number(dbItem.final_balance) || 0,
        directTempBalance: Number(dbItem.temp_balance) || 0,
        directItemCount,
        hasChildren: false,
        hasAccountChildren: false,
        hasItemChildren: directItemCount > 0,
        cid
      };
      nodeMap.set(cid, item);
      return item;
    });

    const directParentMap = new Map<string, any>();
    const childrenMap = new Map<string, any[]>();
    const roots: any[] = [];

    rawData.forEach(node => {
      let directParent: any = null;
      if (node.cid !== 'UNCLASSIFIED') {
        for (let len = node.cid.length - 1; len >= 1; len--) {
          const prefix = node.cid.slice(0, len);
          const candidate = nodeMap.get(prefix);
          if (candidate) {
            directParent = candidate;
            break;
          }
        }
      }

      if (!directParent) {
        roots.push(node);
      } else {
        directParentMap.set(node.cid, directParent);
        if (!childrenMap.has(directParent.cid)) {
          childrenMap.set(directParent.cid, []);
        }
        childrenMap.get(directParent.cid)!.push(node);
      }
    });

    rawData.forEach(node => {
      const hasAccountChildren = (childrenMap.get(node.cid)?.length ?? 0) > 0;
      node.hasAccountChildren = hasAccountChildren;
      node.hasChildren = hasAccountChildren || node.hasItemChildren;
    });

    // Roll up balances and turnover in O(N)
    rawData.forEach(node => {
      node.finalBalance = node.directFinalBalance || 0;
      node.tempBalance = node.directTempBalance || 0;
      if (!node.hasAccountChildren) {
        node.debitTurnover = node.balance > 0 ? node.balance : 0;
        node.creditTurnover = node.balance < 0 ? Math.abs(node.balance) : 0;
      }
    });

    rawData.forEach(d => {
      let ancestor = directParentMap.get(d.cid);
      while (ancestor) {
        ancestor.finalBalance = (ancestor.finalBalance || 0) + (d.directFinalBalance || 0);
        ancestor.tempBalance = (ancestor.tempBalance || 0) + (d.directTempBalance || 0);
        if (!d.hasAccountChildren) {
          if (d.balance > 0) ancestor.debitTurnover = (ancestor.debitTurnover || 0) + d.balance;
          if (d.balance < 0) ancestor.creditTurnover = (ancestor.creditTurnover || 0) + Math.abs(d.balance);
        }
        ancestor = directParentMap.get(ancestor.cid);
      }
    });

    rawData.forEach(node => {
      node.balance = (node.finalBalance || 0) + (node.tempBalance || 0);
    });

    // Ancestor IDs and depth
    const ancestorIdsMap = new Map<string, string[]>();
    const getAncestorIds = (cid: string): string[] => {
      if (ancestorIdsMap.has(cid)) return ancestorIdsMap.get(cid)!;
      const parent = directParentMap.get(cid);
      if (!parent) {
        ancestorIdsMap.set(cid, []);
        return [];
      }
      const ancestors = [parent.id, ...getAncestorIds(parent.cid)];
      ancestorIdsMap.set(cid, ancestors);
      return ancestors;
    };

    rawData.forEach(node => {
      const aIds = getAncestorIds(node.cid);
      node.ancestorIds = aIds;
      node.depth = aIds.length;
      node.isRoot = aIds.length === 0;
    });

    const elapsedMs = performance.now() - t0;
    // Must execute in less than 50ms (typically 2-5ms)
    expect(elapsedMs).toBeLessThan(50);

    // Verify correct structure
    expect(roots.length).toBe(10); // 10 classes
    expect(roots.map(r => r.id)).toEqual(['0.', '1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.', '9.']);

    // Check account '0000'
    const acc0000 = nodeMap.get('0000');
    expect(acc0000).toBeDefined();
    expect(acc0000.depth).toBe(2);
    expect(acc0000.ancestorIds).toEqual(['00.', '0.']);
    expect(acc0000.isRoot).toBe(false);

    // Check group '00.'
    const grp00 = nodeMap.get('00');
    expect(grp00).toBeDefined();
    expect(grp00.depth).toBe(1);
    expect(grp00.ancestorIds).toEqual(['0.']);
    expect(grp00.hasAccountChildren).toBe(true);

    // Check Class '0.'
    const cls0 = nodeMap.get('0');
    expect(cls0).toBeDefined();
    expect(cls0.depth).toBe(0);
    expect(cls0.ancestorIds).toEqual([]);
    expect(cls0.isRoot).toBe(true);
    expect(cls0.hasAccountChildren).toBe(true);
    expect(cls0.balance).toBeGreaterThan(0);
  });

  it('toggling expandedRowIds evaluates visibility in under 5ms', () => {
    const mockAccounts = generateCroatianMockAccounts();
    const cleanId = (s: string) => s.replace(/\./g, '');

    const nodeMap = new Map<string, any>();
    const rawData = mockAccounts.map(dbItem => {
      const cid = cleanId(dbItem.gl_number);
      const item = {
        id: String(dbItem.gl_number),
        name: dbItem.short_name,
        balance: Number(dbItem.total_balance) || 0,
        cid
      };
      nodeMap.set(cid, item);
      return item;
    });

    const directParentMap = new Map<string, any>();
    rawData.forEach(node => {
      for (let len = node.cid.length - 1; len >= 1; len--) {
        const prefix = node.cid.slice(0, len);
        const candidate = nodeMap.get(prefix);
        if (candidate) {
          directParentMap.set(node.cid, candidate);
          break;
        }
      }
    });

    const ancestorIdsMap = new Map<string, string[]>();
    const getAncestorIds = (cid: string): string[] => {
      if (ancestorIdsMap.has(cid)) return ancestorIdsMap.get(cid)!;
      const parent = directParentMap.get(cid);
      if (!parent) {
        ancestorIdsMap.set(cid, []);
        return [];
      }
      const ancestors = [parent.id, ...getAncestorIds(parent.cid)];
      ancestorIdsMap.set(cid, ancestors);
      return ancestors;
    };

    rawData.forEach(node => {
      const aIds = getAncestorIds(node.cid);
      node.ancestorIds = aIds;
      node.isRoot = aIds.length === 0;
    });

    // Simulate clicking '0.' to expand it
    const expandedRowIds = new Set(['0.']);

    const t0 = performance.now();
    const visibleRows = rawData.filter(item => {
      return item.isRoot || (item.ancestorIds && item.ancestorIds.every(id => expandedRowIds.has(id)));
    });
    const elapsedMs = performance.now() - t0;

    expect(elapsedMs).toBeLessThan(5); // Ultra fast <5ms!
    
    // Only 10 roots + 6 groups under '0.' should be visible (total 16)
    expect(visibleRows.length).toBe(16);
    expect(visibleRows.map(r => r.id)).toContain('0.');
    expect(visibleRows.map(r => r.id)).toContain('00.');
    expect(visibleRows.map(r => r.id)).toContain('01.');
    expect(visibleRows.map(r => r.id)).not.toContain('0000'); // Accounts under '00.' are not yet expanded!
  });
});
