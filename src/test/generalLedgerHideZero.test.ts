import { describe, it, expect } from "vitest";

// Interface modeling the GeneralLedgerTable node structure
interface TestGlNode {
  id: string;
  cid: string;
  name: string;
  balance: number;
  directFinalBalance?: number;
  directTempBalance?: number;
  directItemCount?: number;
  hasAccountChildren?: boolean;
  hasChildren?: boolean;
}

// Function reproducing the exact tree filtering logic of GeneralLedgerTable
function filterGlAccounts(
  rawData: TestGlNode[],
  hideZeroBalances: boolean,
  loadedAccountItems: Map<string, any[]> = new Map()
) {
  if (!rawData || rawData.length === 0) return [];

  const rolledUpData = rawData.map(item => {
    if (item.hasAccountChildren) {
      const descendants = rawData.filter(d => d.cid.startsWith(item.cid));
      let finalBalance = 0;
      let tempBalance = 0;
      let debitTurnover = 0;
      let creditTurnover = 0;
      descendants.forEach(d => {
        finalBalance += d.directFinalBalance || 0;
        tempBalance += d.directTempBalance || 0;
        if (!d.hasAccountChildren) {
          if (d.balance > 0) debitTurnover += d.balance;
          if (d.balance < 0) creditTurnover += Math.abs(d.balance);
        }
      });
      return {
        ...item,
        balance: finalBalance + tempBalance,
        debitTurnover,
        creditTurnover,
        directFinalBalance: finalBalance,
        directTempBalance: tempBalance,
      };
    } else {
      return {
        ...item,
        debitTurnover: item.balance > 0 ? item.balance : 0,
        creditTurnover: item.balance < 0 ? Math.abs(item.balance) : 0,
      };
    }
  });

  let activeAccountCids: Set<string> | null = null;
  if (hideZeroBalances) {
    activeAccountCids = new Set<string>();

    const isDirectlyActive = (d: TestGlNode & { debitTurnover?: number; creditTurnover?: number }) => {
      const hasDirectItems = (d.directItemCount !== undefined && d.directItemCount > 0) ||
        ((loadedAccountItems.get(d.cid)?.length ?? 0) > 0);
      const hasDirectBalance = Math.abs(d.directFinalBalance || 0) > 0.001 ||
        Math.abs(d.directTempBalance || 0) > 0.001 ||
        (!d.hasAccountChildren && Math.abs(d.balance || 0) > 0.001);
      const hasTurnover = !d.hasAccountChildren && (
        (d.debitTurnover !== undefined && d.debitTurnover > 0.001) ||
        (d.creditTurnover !== undefined && d.creditTurnover > 0.001)
      );
      return hasDirectItems || hasDirectBalance || hasTurnover;
    };

    rolledUpData.forEach(d => {
      if (isDirectlyActive(d)) {
        activeAccountCids!.add(d.cid);
        // Include all ancestor account prefixes
        rolledUpData.forEach(candidate => {
          if (candidate.cid !== d.cid && d.cid.startsWith(candidate.cid)) {
            activeAccountCids!.add(candidate.cid);
          }
        });
      }
    });
  }

  const childrenMap = new Map<string, TestGlNode[]>();
  const roots: TestGlNode[] = [];

  rolledUpData.forEach(node => {
    let directParent: TestGlNode | null = null;
    rolledUpData.forEach(candidate => {
      if (candidate.cid !== node.cid && node.cid.startsWith(candidate.cid)) {
        if (!directParent || candidate.cid.length > directParent.cid.length) {
          directParent = candidate;
        }
      }
    });

    if (!directParent) {
      roots.push(node);
    } else {
      if (!childrenMap.has(directParent.cid)) {
        childrenMap.set(directParent.cid, []);
      }
      childrenMap.get(directParent.cid)!.push(node);
    }
  });

  const combinedData: TestGlNode[] = [];

  const traverseTree = (node: TestGlNode) => {
    if (activeAccountCids && !activeAccountCids.has(node.cid)) {
      return;
    }

    const childAccounts = childrenMap.get(node.cid);
    const visibleChildAccounts = childAccounts
      ? childAccounts.filter(c => {
          if (activeAccountCids && !activeAccountCids.has(c.cid)) return false;
          return true;
        })
      : [];

    const hasVisibleAccountChildren = visibleChildAccounts.length > 0;
    const nodeToEmit = hideZeroBalances
      ? {
          ...node,
          hasAccountChildren: hasVisibleAccountChildren,
          hasChildren: hasVisibleAccountChildren
        }
      : node;

    combinedData.push(nodeToEmit);

    if (visibleChildAccounts.length > 0) {
      visibleChildAccounts.sort((a, b) => a.cid.localeCompare(b.cid));
      visibleChildAccounts.forEach(child => traverseTree(child));
    }
  };

  roots.sort((a, b) => a.cid.localeCompare(b.cid));
  roots.forEach(root => traverseTree(root));

  return combinedData;
}

describe("General Ledger: hideZeroBalances filter", () => {
  const sampleAccounts: TestGlNode[] = [
    // Class 1: Empty
    { id: "1", cid: "1", name: "Befektetett eszközök", balance: 0, hasAccountChildren: true },
    { id: "11", cid: "11", name: "Immateriális javak", balance: 0, hasAccountChildren: true },
    { id: "111", cid: "111", name: "Alapítás-átszervezés", balance: 0, directFinalBalance: 0, directTempBalance: 0, directItemCount: 0, hasAccountChildren: false },

    // Class 2: Only 251 has activity (customer scenario from Kiss-Százi Emese)
    { id: "2", cid: "2", name: "Készletek", balance: 0, hasAccountChildren: true },
    { id: "21", cid: "21", name: "Anyagok", balance: 0, hasAccountChildren: true },
    { id: "211", cid: "211", name: "Alapanyagok", balance: 0, directFinalBalance: 0, directTempBalance: 0, directItemCount: 0, hasAccountChildren: false },
    { id: "25", cid: "25", name: "Befejezetlen termelés és félkész termékek", balance: 0, hasAccountChildren: true },
    { id: "251", cid: "251", name: "Befejezetlen termelés", balance: 150000, directFinalBalance: 150000, directTempBalance: 0, directItemCount: 2, hasAccountChildren: false },
    { id: "252", cid: "252", name: "Félkész termékek", balance: 0, directFinalBalance: 0, directTempBalance: 0, directItemCount: 0, hasAccountChildren: false },
    { id: "26", cid: "26", name: "Áruk", balance: 0, hasAccountChildren: true },
    { id: "261", cid: "261", name: "Kereskedelmi áruk", balance: 0, directFinalBalance: 0, directTempBalance: 0, directItemCount: 0, hasAccountChildren: false },

    // Class 3: Empty
    { id: "3", cid: "3", name: "Követelések és pénzügyi eszközök", balance: 0, hasAccountChildren: true },
    { id: "31", cid: "31", name: "Követelések", balance: 0, hasAccountChildren: true },
    { id: "311", cid: "311", name: "Vevők", balance: 0, directFinalBalance: 0, directTempBalance: 0, directItemCount: 0, hasAccountChildren: false },

    // Class 4: 454 has activity with net zero balance but direct transactions (e.g. 50k debit, 50k credit)
    { id: "4", cid: "4", name: "Források", balance: 0, hasAccountChildren: true },
    { id: "45", cid: "45", name: "Rövid lejáratú kötelezettségek", balance: 0, hasAccountChildren: true },
    { id: "454", cid: "454", name: "Szállítók", balance: 0, directFinalBalance: 0, directTempBalance: 0, directItemCount: 4, hasAccountChildren: false },
    { id: "46", cid: "46", name: "Egyéb rövid lejáratú kötelezettségek", balance: 0, hasAccountChildren: true },
    { id: "466", cid: "466", name: "Előzetesen felszámított áfa", balance: 0, directFinalBalance: 0, directTempBalance: 0, directItemCount: 0, hasAccountChildren: false },
  ];

  it("should show all accounts when hideZeroBalances is false", () => {
    const result = filterGlAccounts(sampleAccounts, false);
    expect(result.length).toBe(sampleAccounts.length);
    const ids = result.map(r => r.id);
    expect(ids).toContain("1");
    expect(ids).toContain("11");
    expect(ids).toContain("111");
    expect(ids).toContain("2");
    expect(ids).toContain("21");
    expect(ids).toContain("25");
    expect(ids).toContain("251");
    expect(ids).toContain("252");
    expect(ids).toContain("3");
  });

  it("should hide inactive classes and preserve 2 -> 25 -> 251 hierarchy when hideZeroBalances is true", () => {
    // Sub-test covering user's exact example:
    // "Ha a 251-esen van tétel, akkor megjelenne a 2 azon belül a 25 és azon belül a 251, de a többi nem."
    const onlyClass2Scenario = sampleAccounts.filter(a => a.cid.startsWith("1") || a.cid.startsWith("2") || a.cid.startsWith("3"));
    const result = filterGlAccounts(onlyClass2Scenario, true);
    const ids = result.map(r => r.id);

    // Class 1 and Class 3 should be completely hidden
    expect(ids).not.toContain("1");
    expect(ids).not.toContain("11");
    expect(ids).not.toContain("111");
    expect(ids).not.toContain("3");
    expect(ids).not.toContain("31");
    expect(ids).not.toContain("311");

    // Inside Class 2: only 2, 25, 251 should appear
    expect(ids).toContain("2");
    expect(ids).toContain("25");
    expect(ids).toContain("251");

    // Inactive sibling accounts in Class 2 must be hidden
    expect(ids).not.toContain("21");
    expect(ids).not.toContain("211");
    expect(ids).not.toContain("252");
    expect(ids).not.toContain("26");
    expect(ids).not.toContain("261");

    expect(ids).toEqual(["2", "25", "251"]);
  });

  it("should preserve accounts with zero net balance if they have direct transaction items", () => {
    // Account 454 has balance 0, but directItemCount: 4
    const result = filterGlAccounts(sampleAccounts, true);
    const ids = result.map(r => r.id);

    expect(ids).toContain("4");
    expect(ids).toContain("45");
    expect(ids).toContain("454");

    // Inactive sibling 46 / 466 should be hidden
    expect(ids).not.toContain("46");
    expect(ids).not.toContain("466");
  });

  it("should update hasAccountChildren to false on accounts that have no remaining visible children", () => {
    const result = filterGlAccounts(sampleAccounts, true);
    const node251 = result.find(r => r.id === "251");
    const node25 = result.find(r => r.id === "25");
    const node2 = result.find(r => r.id === "2");

    expect(node251?.hasAccountChildren).toBe(false);
    expect(node25?.hasAccountChildren).toBe(true); // Has visible child 251
    expect(node2?.hasAccountChildren).toBe(true);  // Has visible child 25
  });

  it("should preserve accounts if items were dynamically loaded in loadedAccountItems", () => {
    const loadedItemsMap = new Map<string, any[]>();
    loadedItemsMap.set("111", [{ id: "dyn-1", amount: 1000 }]);

    const result = filterGlAccounts(sampleAccounts, true, loadedItemsMap);
    const ids = result.map(r => r.id);

    // Now 111 and its ancestors 1 and 11 should be visible
    expect(ids).toContain("1");
    expect(ids).toContain("11");
    expect(ids).toContain("111");
  });
});
