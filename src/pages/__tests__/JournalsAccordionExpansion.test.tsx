import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('JournalsPage Expandable Accordion & Tooltip Wording', () => {
  const filePath = path.resolve(__dirname, '../JournalsPage.tsx');
  const fileContent = fs.readFileSync(filePath, 'utf8');

  it('imports ChevronDown and Layers from lucide-react', () => {
    expect(fileContent).toContain('ChevronDown');
    expect(fileContent).toContain('Layers');
  });

  it('defines deriveJournalItems helper and JournalLineItem interface', () => {
    expect(fileContent).toContain('interface JournalLineItem');
    expect(fileContent).toContain('function deriveJournalItems(entry: any): JournalLineItem[]');
  });

  it('has expandedEntryIds state and handleToggleExpand / handleToggleAllExpand callbacks', () => {
    expect(fileContent).toContain('const [expandedEntryIds, setExpandedEntryIds] = useState<Set<string>>(new Set());');
    expect(fileContent).toContain('const handleToggleExpand = useCallback((id: string) => {');
    expect(fileContent).toContain('const handleToggleAllExpand = useCallback((entries: any[]) => {');
  });

  it('resets expandedEntryIds in useEffect when filters or journal change', () => {
    expect(fileContent).toContain('setExpandedEntryIds(new Set());');
  });

  it('renders expand/collapse all button in table header', () => {
    expect(fileContent).toContain('handleToggleAllExpand(paginatedEntries)');
    expect(fileContent).toContain('Összes becsukása');
    expect(fileContent).toContain('Összes lenyitása');
  });

  it('fixes GL account tooltip wording to use "főkönyvi számla" instead of ambiguous "számla"', () => {
    expect(fileContent).toContain('Tartozik ({tAccounts.length} főkönyvi számla):');
    expect(fileContent).toContain('Követel ({kAccounts.length} főkönyvi számla):');
    // Ensure old ambiguous wording is not present
    expect(fileContent).not.toContain('Tartozik ({tAccounts.length} számla):');
    expect(fileContent).not.toContain('Követel ({kAccounts.length} számla):');
  });

  it('renders item badge on naplószám column instead of truncating bizonylatszám', () => {
    expect(fileContent).toContain('{entryItems.length} tétel');
    expect(fileContent).toContain('kattints a lenyitáshoz');
    expect(fileContent).toContain('maxWidth="150px"');
  });

  it('renders universal checkbox and selection handlers on all table rows', () => {
    expect(fileContent).toContain('handleRowSelect');
    expect(fileContent).toContain('focusedIndex === index');
    expect(fileContent).toContain('lastSelectedIndex');
  });

  it('supports spacebar sequential row-by-row selection and shift range selection with repeat throttling', () => {
    expect(fileContent).toContain("e.key === ' ' || e.code === 'Space'");
    expect(fileContent).toContain("e.shiftKey && currentLastSelected !== null");
    expect(fileContent).toContain("e.key === 'ArrowDown'");
    expect(fileContent).toContain("e.key === 'ArrowUp'");
    expect(fileContent).toContain('lastRepeatTimeRef');
    expect(fileContent).toContain('scrollRafRef');
  });

  it('renders prominent light blue focus outline and left indicator bar on active focused row', () => {
    expect(fileContent).toContain('outline-sky-400');
    expect(fileContent).toContain('bg-sky-400');
  });

  it('supports Home and End keys to jump to the beginning and end of the page', () => {
    expect(fileContent).toContain("e.key === 'Home'");
    expect(fileContent).toContain("e.key === 'End'");
  });

  it('renders accordion sub-row with colSpan={11} and item breakdown', () => {
    expect(fileContent).toContain('{isExpanded && (');
    expect(fileContent).toContain('<TableCell colSpan={11}');
    expect(fileContent).toContain('Számla tételei');
    expect(fileContent).toContain('Kontírozás (Főkönyvi könyvelési sorok: T / K)');
  });
});
