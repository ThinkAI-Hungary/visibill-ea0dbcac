import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Plus, RotateCcw, Trash2, Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatNumberLocale } from '@/lib/locale/formatters';
import type {
  AnnualReport,
  NotesTemplateItem,
  AssetMovementSummary,
  EquityRowItem,
  SalaryMetrics,
} from '../../types';

interface Step4KiegMellekletProps {
  report: AnnualReport;
  notesTemplates: NotesTemplateItem[] | undefined;
  activeSectionKey: string;
  setActiveSectionKey: (key: string) => void;
  resetCounter: number;
  setResetCounter: React.Dispatch<React.SetStateAction<number>>;
  updateReport: {
    mutate: (updates: Partial<AnnualReport>) => void;
  };
  draftFields: Record<string, any>;
  setDraftFields: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  assetMovement: AssetMovementSummary | null;
  equityRows: EquityRowItem[];
  salaryMetrics: SalaryMetrics | null;
  livePreviewUrl: string | null;
  iframeRef: React.RefObject<HTMLIFrameElement>;
  iframeScrollRef: React.MutableRefObject<number>;
}

export function Step4KiegMelleklet({
  report,
  notesTemplates,
  activeSectionKey,
  setActiveSectionKey,
  resetCounter,
  setResetCounter,
  updateReport,
  draftFields,
  setDraftFields,
  assetMovement,
  equityRows,
  salaryMetrics,
  livePreviewUrl,
  iframeRef,
  iframeScrollRef,
}: Step4KiegMellekletProps) {
  const { t } = useTranslation('accounting');
  const { toast } = useToast();
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>();

  const templates = (notesTemplates || []).map((tItem) => ({
    key: tItem.section_key,
    title: tItem.section_title,
    isCustom: false,
    isRequired: tItem.is_required,
    defaultText: tItem.default_text,
  }));
  const custom = (((report?.notes_sections as any[]) || []).filter((s: any) => s.is_custom) || []).map(
    (s: any) => ({
      key: s.section_key,
      title: s.title || t('annual_report.step4.custom_section_title'),
      isCustom: true,
      isRequired: false,
      defaultText: '',
    })
  );
  const allNotesTabs = [...templates, ...custom];
  const activeTab = allNotesTabs.find((tab) => tab.key === activeSectionKey);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            {t('annual_report.step4.header')}
          </h2>
          <p className="text-muted-foreground text-xs mt-0.5">
            {t('annual_report.step4.subtitle')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Sidebar + Active Editor */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-col md:flex-row gap-4 border border-border/40 rounded-2xl p-4 bg-muted/10">
            {/* Vertical tab buttons */}
            <div className="flex flex-col gap-1 md:w-48 shrink-0">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 pl-2">
                {t('annual_report.step4.sections_title')}
              </p>
              {allNotesTabs.map((tab) => {
                const isActive = activeSectionKey === tab.key;
                const saved = (report.notes_sections as any[])?.find((s: any) => s.section_key === tab.key);
                return (
                  <Button
                    key={tab.key}
                    variant={isActive ? 'default' : 'ghost'}
                    size="sm"
                    className={cn(
                      'justify-start text-xs font-semibold px-3 py-2 h-auto text-left rounded-lg transition-all',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    )}
                    onClick={() => setActiveSectionKey(tab.key)}
                  >
                    <span className="truncate flex-1">{tab.title}</span>
                    {saved && <span className="ml-1.5 text-[9px] text-emerald-500 font-bold shrink-0">✓</span>}
                  </Button>
                );
              })}

              {/* Add custom section button in sidebar */}
              <div className="border-t border-border/40 pt-3 mt-2 space-y-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider pl-2">
                  {t('annual_report.step4.custom_section_title')}
                </p>
                <div className="flex flex-col gap-1.5 px-2">
                  <Input
                    placeholder={t('annual_report.step4.new_title_placeholder')}
                    value={newSectionTitle}
                    onChange={(e) => setNewSectionTitle(e.target.value)}
                    className="h-7 text-xs"
                  />
                  <Button
                    variant="outline"
                    size="xs"
                    className="w-full text-[10px] gap-1 h-6"
                    disabled={!newSectionTitle.trim()}
                    onClick={() => {
                      const key = `custom_${Date.now()}`;
                      const sections = [
                        ...((report.notes_sections as any[]) || []),
                        {
                          section_key: key,
                          title: newSectionTitle.trim(),
                          text: '',
                          is_custom: true,
                        },
                      ];
                      updateReport.mutate({ notes_sections: sections });
                      setActiveSectionKey(key);
                      setNewSectionTitle('');
                      toast({ title: t('annual_report.step4.toast_added_title'), description: newSectionTitle.trim() });
                    }}
                  >
                    <Plus className="w-3 h-3" /> {t('annual_report.step4.add_btn')}
                  </Button>
                </div>
              </div>
            </div>

            {/* Active Editor content container */}
            <div className="flex-1 min-w-0 bg-background border border-border/30 rounded-xl overflow-hidden shadow-sm p-4 space-y-4">
              {!activeTab ? (
                <div className="text-center py-8 text-muted-foreground text-xs">
                  {t('annual_report.step4.empty_selection')}
                </div>
              ) : (
                (() => {
                  const saved = (report.notes_sections as any[])?.find(
                    (s: any) => s.section_key === activeTab.key
                  );
                  const isAssetSection = activeTab.key === 'asset_movement';
                  const isEquitySection = activeTab.key === 'equity_changes';
                  const isSalarySection = activeTab.key === 'employee_info';

                  return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between pb-2 border-b border-border/40">
                        <h3 className="font-bold text-sm text-foreground">{activeTab.title}</h3>
                        <div className="flex items-center gap-2">
                          {saved && (
                            <Button
                              variant="ghost"
                              size="xs"
                              className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground gap-1"
                              onClick={() => {
                                const sections = (
                                  (report.notes_sections as any[]) || []
                                ).filter((s: any) => s.section_key !== activeTab.key);
                                updateReport.mutate({ notes_sections: sections });
                                setResetCounter((prev) => prev + 1);
                                toast({
                                  title: t('annual_report.step4.toast_reset_title'),
                                  description: t('annual_report.step4.toast_reset_desc', { title: activeTab.title }),
                                });
                              }}
                            >
                              <RotateCcw className="w-3 h-3" />
                              {t('annual_report.step4.reset_btn')}
                            </Button>
                          )}
                          {activeTab.isCustom && (
                            <Button
                              variant="ghost"
                              size="xs"
                              className="h-6 px-2 text-[10px] text-red-500 hover:text-red-700 gap-1 hover:bg-red-500/5"
                              onClick={() => {
                                const sections = (
                                  (report.notes_sections as any[]) || []
                                ).filter((s: any) => s.section_key !== activeTab.key);
                                updateReport.mutate({ notes_sections: sections });
                                toast({
                                  title: t('annual_report.step4.toast_deleted_title'),
                                  description: t('annual_report.step4.toast_deleted_desc', { title: activeTab.title }),
                                });
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                              {t('annual_report.step4.delete_btn')}
                            </Button>
                          )}
                          {(isAssetSection || isEquitySection || isSalarySection) && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-semibold select-none">
                              {t('annual_report.step4.autofill_badge')}
                            </span>
                          )}
                          {activeTab.isRequired && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold select-none">
                              {t('annual_report.step4.required_badge')}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Supplementary Tables */}
                      {isAssetSection && assetMovement && (
                        <div className="bg-muted/20 rounded-lg border border-border/30 overflow-hidden text-xs">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-muted/50 font-bold border-b text-[10px] uppercase text-muted-foreground">
                                <th className="p-2 text-left">{t('annual_report.step4.asset_table.metric')}</th>
                                <th className="p-2 text-right">{t('annual_report.step4.asset_table.value')}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/10">
                              <tr>
                                <td className="p-2">{t('annual_report.step4.asset_table.total_assets')}</td>
                                <td className="p-2 text-right font-mono font-medium">
                                  {assetMovement.total}
                                </td>
                              </tr>
                              <tr>
                                <td className="p-2">{t('annual_report.step4.asset_table.active_assets')}</td>
                                <td className="p-2 text-right font-mono font-medium">
                                  {assetMovement.active}
                                </td>
                              </tr>
                              <tr>
                                <td className="p-2">{t('annual_report.step4.asset_table.disposed_assets')}</td>
                                <td className="p-2 text-right font-mono font-medium">
                                  {assetMovement.disposed}
                                </td>
                              </tr>
                              <tr className="font-semibold">
                                <td className="p-2">{t('annual_report.step4.asset_table.gross_total')}</td>
                                <td className="p-2 text-right font-mono text-primary">
                                  {formatNumberLocale(assetMovement.totalAcquisition)} Ft
                                </td>
                              </tr>
                              <tr>
                                <td className="p-2">{t('annual_report.step4.asset_table.active_gross')}</td>
                                <td className="p-2 text-right font-mono font-medium">
                                  {formatNumberLocale(assetMovement.activeAcquisition)} Ft
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}

                      {isEquitySection && equityRows.length > 0 && (
                        <div className="bg-muted/20 rounded-lg border border-border/30 overflow-hidden text-xs">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-muted/50 font-bold border-b text-[10px] uppercase text-muted-foreground">
                                <th className="p-2 text-left">{t('annual_report.step4.equity_table.row')}</th>
                                <th className="p-2 text-left">{t('annual_report.step4.equity_table.name')}</th>
                                <th className="p-2 text-right">{t('annual_report.step4.equity_table.prev_year')}</th>
                                <th className="p-2 text-right">{t('annual_report.step4.equity_table.curr_year')}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/10">
                              {equityRows.map((r: any) => (
                                <tr key={r.bs_structure_id || r.row_code}>
                                <td className="p-2 font-mono text-[10px] text-muted-foreground">
                                  {r.row_code}
                                </td>
                                <td className="p-2 font-medium">{r.name}</td>
                                <td className="p-2 text-right font-mono">
                                  {formatNumberLocale(
                                    Math.round((Number(r.prior_year_balance) || 0) / 1000)
                                  )}{' '}
                                  {t('annual_report.step4.equity_table.thousands_unit')}
                                </td>
                                <td className="p-2 text-right font-mono font-semibold text-primary">
                                  {formatNumberLocale(
                                    Math.round((Number(r.current_balance) || 0) / 1000)
                                  )}{' '}
                                  {t('annual_report.step4.equity_table.thousands_unit')}
                                </td>
                              </tr>
                            ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {isSalarySection && salaryMetrics && (
                        <div className="bg-muted/20 rounded-lg border border-border/30 overflow-hidden text-xs">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-muted/50 font-bold border-b text-[10px] uppercase text-muted-foreground">
                                <th className="p-2 text-left">{t('annual_report.step4.salary_table.metric')}</th>
                                <th className="p-2 text-right">{t('annual_report.step4.salary_table.value')}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/10">
                              <tr>
                                <td className="p-2">{t('annual_report.step4.salary_table.headcount')}</td>
                                <td className="p-2 text-right font-mono font-medium">
                                  {salaryMetrics.headcount} {t('annual_report.step4.salary_table.headcount_unit')}
                                </td>
                              </tr>
                              <tr>
                                <td className="p-2">{t('annual_report.step4.salary_table.wages')}</td>
                                <td className="p-2 text-right font-mono font-medium">
                                  {formatNumberLocale(salaryMetrics.totalWages)} Ft
                                </td>
                              </tr>
                              <tr>
                                <td className="p-2">{t('annual_report.step4.salary_table.contributions')}</td>
                                <td className="p-2 text-right font-mono font-medium">
                                  {formatNumberLocale(salaryMetrics.totalContrib)} Ft
                                </td>
                              </tr>
                              <tr className="font-semibold">
                                <td className="p-2">{t('annual_report.step4.salary_table.total_personnel')}</td>
                                <td className="p-2 text-right font-mono text-primary">
                                  {formatNumberLocale(salaryMetrics.total)} Ft
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}

                      {activeTab.isCustom ? (
                        <div className="space-y-1.5">
                          <Label className="text-xs">{t('annual_report.step4.section_text')}</Label>
                          <Textarea
                            value={
                              draftFields[`note_${activeTab.key}`] !== undefined
                                ? draftFields[`note_${activeTab.key}`]
                                : saved?.text || ''
                            }
                            rows={12}
                            className="text-xs font-sans leading-relaxed"
                            onChange={(e) => {
                              const newText = e.target.value;
                              setDraftFields((prev) => ({
                                ...prev,
                                [`note_${activeTab.key}`]: newText,
                              }));
                              if (debounceRef.current) clearTimeout(debounceRef.current);
                              debounceRef.current = setTimeout(() => {
                                const sections = [
                                  ...((report.notes_sections as any[]) || []),
                                ];
                                const idx = sections.findIndex(
                                  (x: any) => x.section_key === activeTab.key
                                );
                                if (idx >= 0)
                                  sections[idx] = { ...saved, text: newText };
                                updateReport.mutate({ notes_sections: sections });
                                setDraftFields((prev) => {
                                  const next = { ...prev };
                                  delete next[`note_${activeTab.key}`];
                                  return next;
                                });
                              }, 800);
                            }}
                          />
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <Label className="text-xs">{t('annual_report.step4.editor_label')}</Label>
                          <RichTextEditor
                            key={`rte_${activeTab.key}_${resetCounter}`}
                            initialContent={saved?.text || activeTab.defaultText}
                            onChange={(newText) => {
                              if (debounceRef.current) clearTimeout(debounceRef.current);
                              debounceRef.current = setTimeout(() => {
                                const sections = [
                                  ...((report.notes_sections as any[]) || []),
                                ];
                                const idx = sections.findIndex(
                                  (s: any) => s.section_key === activeTab.key
                                );
                                const entry = { section_key: activeTab.key, text: newText };
                                if (idx >= 0) sections[idx] = entry;
                                else sections.push(entry);
                                updateReport.mutate({ notes_sections: sections });
                              }, 1000);
                            }}
                            placeholder={activeTab.title}
                            variables={[
                              { key: '[Cégnév]', label: 'Cég neve' },
                              { key: '[Székhely]', label: 'Székhely' },
                              { key: '[Adószám]', label: 'Adószám' },
                              { key: '[Tárgyév]', label: 'Tárgyév' },
                              { key: '[Tárgyév+1]', label: 'Tárgyév+1' },
                              { key: '[Képviselő neve]', label: 'Képviselő' },
                              { key: '[Képviselő beosztása]', label: 'Beosztás' },
                              { key: '[Saját tőke]', label: 'Saját tőke (E Ft)' },
                              { key: '[Saját tőke változás]', label: 'Tőke változás iránya' },
                              { key: '[Mérlegfőösszeg]', label: 'Mérlegfőösszeg (E Ft)' },
                              { key: '[ROE]', label: 'ROE %' },
                              { key: '[Likviditás]', label: 'Likviditási mutató' },
                              { key: '[Likviditás értékelés]', label: 'Likviditás szöveges értékelés' },
                              { key: '[Adózott eredmény]', label: 'Adózott eredmény (E Ft)' },
                              { key: '[Osztalék]', label: 'Osztalék (E Ft)' },
                              { key: '[Eredménytartalék]', label: 'Eredménytartalék (E Ft)' },
                              { key: '[AUTOMATIKUS TÁBLÁZAT - TENY MODULBÓL]', label: 'Tárgyi Eszköz Táblázat' },
                              { key: '[AUTOMATIKUS TÁBLÁZAT - MÉRLEG D. SOROKBÓL]', label: 'Saját Tőke Táblázat' },
                              { key: '[AUTOMATIKUS TÁBLÁZAT - FOGLALKOZTATOTTI ADATOK]', label: 'Létszám/Bér Táblázat' },
                            ]}
                          />
                        </div>
                      )}
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Sticky Live Preview Panel */}
        <div className="lg:col-span-5">
          <div className="sticky top-4 h-[75vh] flex flex-col border border-border/80 rounded-2xl overflow-hidden bg-muted/5 shadow-lg">
            <div className="bg-muted/40 px-4 py-3 text-xs font-bold border-b border-border/60 flex items-center justify-between shrink-0 select-none">
              <span className="flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-primary" />
                {t('annual_report.step4.preview.title')}
              </span>
              <span className="text-[9px] text-muted-foreground font-normal">
                {t('annual_report.step4.preview.auto_update')}
              </span>
            </div>
            <div className="flex-1 bg-white dark:bg-slate-900">
              {livePreviewUrl ? (
                <iframe
                  ref={iframeRef}
                  src={livePreviewUrl}
                  className="w-full h-full border-0"
                  title={t('annual_report.step4.preview.title')}
                  onLoad={() => {
                    if (iframeRef.current && iframeRef.current.contentWindow) {
                      try {
                        iframeRef.current.contentWindow.scrollTo(0, iframeScrollRef.current);
                      } catch (e) {
                        // Ignore iframe cross-context security
                      }
                    }
                  }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-xs text-muted-foreground p-4 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-primary/50 mb-2" />
                  <span>{t('annual_report.step4.preview.loading')}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
