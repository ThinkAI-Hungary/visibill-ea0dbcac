import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('JournalsPage Prominent Nyitó tételek Button', () => {
  const filePath = path.resolve(__dirname, '../JournalsPage.tsx');
  const fileContent = fs.readFileSync(filePath, 'utf8');

  const huLocalePath = path.resolve(__dirname, '../../locales/hu/accounting.json');
  const huLocale = JSON.parse(fs.readFileSync(huLocalePath, 'utf8'));

  const hrLocalePath = path.resolve(__dirname, '../../locales/hr/accounting.json');
  const hrLocale = JSON.parse(fs.readFileSync(hrLocalePath, 'utf8'));

  it('contains handleOpenOpeningWizard callback that sets selected journal to NY and opens wizard', () => {
    expect(fileContent).toContain('const handleOpenOpeningWizard = useCallback(() => {');
    expect(fileContent).toContain("const nyJ = journals.find((j: any) => j.code === 'NY');");
    expect(fileContent).toContain('setSelectedJournalId(nyJ.id);');
    expect(fileContent).toContain('setOpeningWizardOpen(true);');
  });

  it('renders prominent Nyitó tételek button in PageHeader actions with emerald styling', () => {
    expect(fileContent).toContain("onClick={handleOpenOpeningWizard}");
    expect(fileContent).toContain("opening_entries_btn");
    expect(fileContent).toContain("from-emerald-600");
    expect(fileContent).toContain("to-emerald-700");
    expect(fileContent).toContain("BookOpen");
    expect(fileContent).toContain("shadow-emerald-950/20");
  });

  it('has localized translation keys in hu and hr accounting.json', () => {
    expect(huLocale.journals.opening_entries_btn).toBe('Nyitó tételek');
    expect(huLocale.journals.opening_entries_tooltip_title).toBe('Nyitó tételek & Varázsló');
    expect(hrLocale.journals.opening_entries_btn).toBe('Početna stanja');
    expect(hrLocale.journals.opening_entries_tooltip_title).toBe('Početna stanja i čarobnjak');
  });

  it('renders "Számlatükör importálása" button and integrates UploadChartOfAccountsModal in JournalsPage', () => {
    expect(fileContent).toContain('UploadChartOfAccountsModal');
    expect(fileContent).toContain('setUploadCoaOpen(true)');
    expect(fileContent).toContain('journals.opening.upload_coa');
    expect(huLocale.journals.opening.upload_coa).toBe('Számlatükör importálása');
    expect(hrLocale.journals.opening.upload_coa).toBe('Uvoz kontnog plana');
  });
});
