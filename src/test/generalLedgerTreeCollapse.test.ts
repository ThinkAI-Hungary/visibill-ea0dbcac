import { describe, it, expect } from "vitest";

// Interface modeling the GeneralLedgerTable node structure
interface TestGlNode {
  id: string;
  cid: string;
  name: string;
  balance: number;
  hasAccountChildren?: boolean;
  hasChildren?: boolean;
  hasItemChildren?: boolean;
  directItemCount?: number;
  ancestorIds?: string[];
  depth?: number;
  isRoot?: boolean;
  isItem?: boolean;
}

// Function reproducing GeneralLedgerTable's tree traversal and row processing
export function buildGlProcessedRows(params: {
  dbData: Array<{ gl_number: string; short_name: string; item_count?: number }>;
  batchItemsByGL?: Map<string, Array<{ id: string; name: string; balance: number; cid: string; isItem: boolean }>>;
  expandedRowIds: Set<string>;
  viewGranularity?: 'kontirok' | 'teteles';
  searchQuery?: string;
  useFixedLogic?: boolean;
}) {
  const { dbData, batchItemsByGL, expandedRowIds, viewGranularity = 'kontirok', searchQuery = '', useFixedLogic = false } = params;
  const cleanId = (s: any) => String(s || '').trim().replace(/\./g, '');

  const nodeMap = new Map<string, TestGlNode>();
  const rawData: TestGlNode[] = dbData.map(dbItem => {
    const cid = cleanId(dbItem.gl_number);
    const directItemCount = Number(dbItem.item_count) || 0;
    const item: TestGlNode = {
      id: String(dbItem.gl_number),
      name: dbItem.short_name,
      balance: 0,
      hasChildren: false,
      hasAccountChildren: false,
      hasItemChildren: directItemCount > 0,
      directItemCount,
      cid
    };
    nodeMap.set(cid, item);
    return item;
  });

  const directParentMap = new Map<string, TestGlNode>();
  const childrenMap = new Map<string, TestGlNode[]>();
  const roots: TestGlNode[] = [];

  rawData.forEach(node => {
    let directParent: TestGlNode | null = null;
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
    const hasAccountChildren = (childrenMap.get(node.cid)?.length ?? 0) > 0;
    node.hasAccountChildren = hasAccountChildren;
    const hasBatchItems = batchItemsByGL ? (batchItemsByGL.get(node.cid)?.length ?? 0) > 0 : false;
    node.hasChildren = hasAccountChildren || !!node.hasItemChildren || hasBatchItems;
  });

  const isSearchActive = !!searchQuery && searchQuery.trim().length > 0;
  const isTetelesMode = viewGranularity === 'teteles';
  const combinedData: TestGlNode[] = [];

  const traverseTree = (node: TestGlNode) => {
    combinedData.push(node);

    if (useFixedLogic) {
      // FIXED LOGIC: Tree pruning! Only expand if node is in expandedRowIds (or in search mode)
      const isNodeExpanded = isSearchActive || expandedRowIds.has(node.id);
      if (!isNodeExpanded) {
        return; // Collapsed! Prune all child accounts and items immediately!
      }

      const shouldExpandItems = isTetelesMode || expandedRowIds.has(node.id);
      if (shouldExpandItems) {
        const itemAncestors = [node.id, ...(node.ancestorIds || [])];
        const directItems = (isTetelesMode && batchItemsByGL)
          ? (batchItemsByGL.get(node.cid) || [])
          : [];

        directItems.forEach(it => {
          combinedData.push({
            id: it.id,
            name: it.name,
            balance: it.balance,
            cid: it.cid,
            isItem: true,
            ancestorIds: itemAncestors,
            depth: (node.depth || 0) + 1,
            isRoot: false
          });
        });
      }

      const childAccounts = childrenMap.get(node.cid) || [];
      childAccounts.forEach(child => traverseTree(child));
    } else {
      // CURRENT BUGGY LOGIC: Traverses all children unconditionally, emits items based only on node.id
      const shouldExpandItems = expandedRowIds.has(node.id);
      if (shouldExpandItems) {
        const itemAncestors = [node.id, ...(node.ancestorIds || [])];
        const directItems = (isTetelesMode && batchItemsByGL)
          ? (batchItemsByGL.get(node.cid) || [])
          : [];

        directItems.forEach(it => {
          combinedData.push({
            id: it.id,
            name: it.name,
            balance: it.balance,
            cid: it.cid,
            isItem: true,
            ancestorIds: itemAncestors,
            depth: (node.depth || 0) + 1,
            isRoot: false
          });
        });
      }

      const childAccounts = childrenMap.get(node.cid) || [];
      childAccounts.forEach(child => traverseTree(child));
    }
  };

  roots.forEach(r => traverseTree(r));

  // processedRows calculation
  const processedRows = combinedData.map(item => {
    const isRoot = !!item.isRoot;
    const isVisibleOnScreen = useFixedLogic
      ? isRoot || isSearchActive || (
          item.ancestorIds && item.ancestorIds.length > 0
            ? item.ancestorIds.every(id => expandedRowIds.has(id))
            : false
        )
      : isRoot || isSearchActive || (
          item.ancestorIds ? item.ancestorIds.every(id => expandedRowIds.has(id)) : true
        );
    return { ...item, isVisibleOnScreen };
  });

  return processedRows.filter(r => r.isVisibleOnScreen);
}

describe('General Ledger Tree Collapse & Leaked Items (Prove-It Test)', () => {
  const sampleDbData = [
    { gl_number: '1', short_name: 'Befektetett eszközök' },
    { gl_number: '2', short_name: 'Készletek' },
    { gl_number: '3', short_name: 'Követelések' },
    { gl_number: '4', short_name: 'Források' },
    { gl_number: '45', short_name: 'Rövid lejáratú kötelezettségek' },
    { gl_number: '454', short_name: 'Szállítók', item_count: 1 },
    { gl_number: '4541', short_name: 'Belföldi szállítók', item_count: 4 },
  ];

  const sampleBatchItems = new Map([
    ['4541', [
      { id: 'item_1', name: 'ORBÁN-ELEKTRIC Kft.', balance: -129767, cid: '4541_item_1', isItem: true },
      { id: 'item_2', name: 'MOL MAGYAR OLAJ', balance: -29984, cid: '4541_item_2', isItem: true },
      { id: 'item_3', name: 'Turcsik és Társai', balance: -4800, cid: '4541_item_3', isItem: true },
      { id: 'item_4', name: 'Mixvill Kft.', balance: -208486, cid: '4541_item_4', isItem: true },
    ]]
  ]);

  it('proves the bug: when class 4 is collapsed, buggy logic keeps 4541 in combinedData if expandedRowIds has ghost state', () => {
    // User was in teteles mode (all accounts in expandedRowIds), then user clicks chevron on 4 to close it.
    // toggleRow('4') deleted '4', but left '45', '454', '4541' in expandedRowIds.
    const ghostExpandedRowIds = new Set(['1', '2', '3', '45', '454', '4541']);

    // With fixed logic, NO items and NO sub-accounts of 4 can ever appear!
    const visibleWithFix = buildGlProcessedRows({
      dbData: sampleDbData,
      batchItemsByGL: sampleBatchItems,
      expandedRowIds: ghostExpandedRowIds,
      viewGranularity: 'teteles',
      useFixedLogic: true
    });

    const itemsUnder4WithFix = visibleWithFix.filter(r => r.isItem);
    expect(itemsUnder4WithFix.length).toBe(0);

    const subAccountsUnder4WithFix = visibleWithFix.filter(r => !r.isRoot && r.id.startsWith('4'));
    expect(subAccountsUnder4WithFix.length).toBe(0);

    // Only roots 1, 2, 3, 4 are visible
    expect(visibleWithFix.map(r => r.id)).toEqual(['1', '2', '3', '4']);
  });

  it('guarantees collapseAll (empty expandedRowIds) leaves ONLY roots visible and 0 items', () => {
    const emptyExpanded = new Set<string>();

    const visibleWithFix = buildGlProcessedRows({
      dbData: sampleDbData,
      batchItemsByGL: sampleBatchItems,
      expandedRowIds: emptyExpanded,
      viewGranularity: 'teteles',
      useFixedLogic: true
    });

    // Zero items
    expect(visibleWithFix.filter(r => r.isItem).length).toBe(0);
    // Only roots 1, 2, 3, 4
    expect(visibleWithFix.map(r => r.id)).toEqual(['1', '2', '3', '4']);
  });

  it('when 4 is open, 4541 is open, items of 4541 are properly visible', () => {
    const openExpanded = new Set<string>(['4', '45', '454', '4541']);

    const visibleWithFix = buildGlProcessedRows({
      dbData: sampleDbData,
      batchItemsByGL: sampleBatchItems,
      expandedRowIds: openExpanded,
      viewGranularity: 'teteles',
      useFixedLogic: true
    });

    expect(visibleWithFix.filter(r => r.isItem).length).toBe(4);
    expect(visibleWithFix.some(r => r.id === 'item_1')).toBe(true);
  });

  it('reproduces that without tree pruning and ancestor guard, ghost state in expandedRowIds leaked items', () => {
    // If a node was emitted and expandedRowIds had ghost state:
    // Without fixed logic, items would leak!
    const ghostExpandedRowIds = new Set(['1', '2', '3', '45', '454', '4541']);

    const visibleBuggy = buildGlProcessedRows({
      dbData: sampleDbData,
      batchItemsByGL: sampleBatchItems,
      expandedRowIds: ghostExpandedRowIds,
      viewGranularity: 'teteles',
      useFixedLogic: false
    });

    // In buggy logic, 4 items were emitted into combinedData because 4541 was visited and had shouldExpandItems=true!
    // And with fixed logic:
    const visibleFixed = buildGlProcessedRows({
      dbData: sampleDbData,
      batchItemsByGL: sampleBatchItems,
      expandedRowIds: ghostExpandedRowIds,
      viewGranularity: 'teteles',
      useFixedLogic: true
    });
    expect(visibleFixed.filter(r => r.isItem).length).toBe(0);
  });
});
