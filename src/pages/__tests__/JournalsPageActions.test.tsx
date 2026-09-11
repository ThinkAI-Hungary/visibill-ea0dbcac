import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('JournalsPage Action Buttons Tooltips & Accessibility', () => {
  const filePath = path.resolve(__dirname, '../JournalsPage.tsx');
  const fileContent = fs.readFileSync(filePath, 'utf8');

  it('imports CustomTooltip from ui/custom-tooltip', () => {
    expect(fileContent).toContain("import { CustomTooltip } from '@/components/ui/custom-tooltip';");
  });

  it('has CustomTooltip for all journal action buttons', () => {
    // 1. View details
    expect(fileContent).toContain('view_document');
    expect(fileContent).toContain('Bizonylat megtekintése');

    // 2. Audit history
    expect(fileContent).toContain('edit_history');
    expect(fileContent).toContain('Módosítási előzmények');

    // 3. Storno
    expect(fileContent).toContain('storno_cancel');
    expect(fileContent).toContain('storno_aria');

    // 4. Correction
    expect(fileContent).toContain('correct_aria');

    // 5. Post/Approve draft
    expect(fileContent).toContain('approve_and_post');
    expect(fileContent).toContain('post_entry');

    // 6. Edit draft
    expect(fileContent).toContain('edit_entry');
    expect(fileContent).toContain('edit_entry_aria');

    // 7. Delete draft
    expect(fileContent).toContain('delete_draft');
  });

  it('does not have native title attributes on action buttons (prevents double tooltip bug)', () => {
    // Check that the action buttons block does not contain title="Könyvelés", title="Sztornózás", etc.
    const actionCellMatch = fileContent.match(/<TableCell className="w-\[135px\] text-right">[\s\S]*?<\/TableCell>/);
    expect(actionCellMatch).not.toBeNull();
    const actionCellContent = actionCellMatch![0];

    expect(actionCellContent).not.toContain('title="');
  });

  it('sets Műveletek column width to 135px to prevent wrapping of 5 action icons', () => {
    expect(fileContent).toContain('<TableHead className="w-[135px] text-right whitespace-nowrap">');
    expect(fileContent).toContain("'Műveletek'");
    expect(fileContent).toContain('<TableCell className="w-[135px] text-right">');
  });

  it('renders Lock icon with explanatory tooltip on closed/posted non-draft items', () => {
    expect(fileContent).toContain('Lekönyvelt zárt tétel (${lock.reason})');
    expect(fileContent).toContain('Sztornózott tétel (lezárt, nem jelölhető ki tömeges műveletre)');
    expect(fileContent).toContain('<Lock className="w-3.5 h-3.5" />');
  });

  it('handles header checkbox indeterminate state and disables it when no drafts exist', () => {
    expect(fileContent).toContain("checked={isAllSelected ? true : isSomeSelected ? 'indeterminate' : false}");
    expect(fileContent).toContain('disabled={pageDrafts.length === 0}');
  });
});

