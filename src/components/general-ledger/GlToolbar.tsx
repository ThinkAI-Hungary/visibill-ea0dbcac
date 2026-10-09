import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Database, Settings2, Plus, BookOpen, FileUp, UploadCloud, 
  FileText, Bot, Loader2, Download, Eye, Printer, FileSpreadsheet, 
  Table2, Layers, Filter, ChevronDown, Copy, FileCode 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, 
  DropdownMenuSubTrigger, DropdownMenuSubContent 
} from '@/components/ui/dropdown-menu';
import { CustomTooltip } from '@/components/ui/custom-tooltip';

interface GlToolbarProps {
  activePresetId: string | null;
  presets?: Array<{ id: string; name: string; type?: string }>;
  isPresetsLoading?: boolean;
  isPresetsPending?: boolean;
  isCroatia: boolean;
  selectedCompanyName?: string;
  isAIRunning: boolean;
  aiProgress?: { processed: number; total: number } | null;
  onSelectPreset: (presetId: string) => void;
  onOpenManagePresets: () => void;
  onOpenUploadPreset: () => void;
  onOpenCopyPreset?: () => void;
  onOpenAddAccount: () => void;
  onOpenManualEntry: () => void;
  onOpenExportAuditXml?: () => void;
  onOpenUploadAuditXml: () => void;
  onOpenAuditHistory: () => void;
  onRunAI: () => void;
  onShowPrintPreview: () => void;
  onPrint: () => void;
  onExportExcel: (options?: { excludeZeroRows?: boolean }) => void;
  onExportAnalyticalExcel: (options?: { excludeZeroRows?: boolean }) => void;
}

export function GlToolbar({
  activePresetId,
  presets,
  isPresetsLoading,
  isPresetsPending,
  isCroatia,
  selectedCompanyName,
  isAIRunning,
  aiProgress,
  onSelectPreset,
  onOpenManagePresets,
  onOpenUploadPreset,
  onOpenCopyPreset,
  onOpenAddAccount,
  onOpenManualEntry,
  onOpenExportAuditXml,
  onOpenUploadAuditXml,
  onOpenAuditHistory,
  onRunAI,
  onShowPrintPreview,
  onPrint,
  onExportExcel,
  onExportAnalyticalExcel,
}: GlToolbarProps) {
  const { t } = useTranslation(['accounting', 'common']);

  const getPresetDisplayName = (preset: { name: string; type?: string }) => {
    if (preset.name === 'számla_hr') {
      return isCroatia
        ? t('accounting:general_ledger.toolbar.builtin_hr_preset', 'Ugrađeni sustavni predložak (számla_hr)')
        : t('accounting:general_ledger.toolbar.builtin_hr_preset', 'Beépített Horvát Számlatükör (számla_hr)');
    }
    if (preset.type === 'generic' || preset.name === 'Beépített Rendszerszintű Sablon' || preset.name.toLowerCase().includes('beépített')) {
      return t('accounting:general_ledger.toolbar.builtin_system_preset', 'Beépített Rendszerszintű Sablon');
    }
    return preset.name;
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-2.5 sm:p-3 rounded-xl border border-border shadow-xs print:hidden">
      {/* ── 1. Számlatükör Sablon Blokkpár (Bal oldal) ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Database className="w-4 h-4 text-primary shrink-0" />
          <Label className="whitespace-nowrap font-medium text-xs text-foreground/80">
            {t('accounting:general_ledger.toolbar.active_preset', 'Számlatükör sablon:')}
          </Label>
        </div>
        
        <Select 
          value={activePresetId || ''} 
          onValueChange={onSelectPreset} 
          disabled={isPresetsPending || isPresetsLoading}
        >
          <SelectTrigger className="w-[190px] sm:w-[230px] h-9 text-xs sm:text-sm font-medium">
            <SelectValue placeholder={t('accounting:general_ledger.toolbar.select_preset', 'Sablon kiválasztása')} />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {presets?.map(preset => {
              const isGeneric = preset.type === 'generic' || preset.name === 'számla_hr';
              const displayName = getPresetDisplayName(preset);
              return (
                <SelectItem key={preset.id} value={preset.id} className="text-xs">
                  {displayName} {isGeneric ? ` ${t('accounting:general_ledger.toolbar.builtin_badge', '(Beépített)')}` : ''}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        {/* Sablon adminisztrációs műveletek (Fogaskerék menü) */}
        <DropdownMenu>
          <CustomTooltip content={t('accounting:general_ledger.toolbar.preset_settings_tooltip', 'Számlatükör sablonok kezelése és új sablon feltöltése')} side="bottom">
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-9 px-2.5 text-muted-foreground hover:text-foreground font-medium gap-1.5"
                aria-label={t('accounting:general_ledger.toolbar.manage_presets', 'Sablon műveletek')}
              >
                <Settings2 className="w-4 h-4 text-muted-foreground" />
                <span className="hidden md:inline text-xs">{t('accounting:general_ledger.toolbar.manage_presets_short', 'Kezelés')}</span>
                <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
              </Button>
            </DropdownMenuTrigger>
          </CustomTooltip>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuItem onClick={onOpenManagePresets} className="cursor-pointer gap-2 text-xs py-2">
              <Settings2 className="w-4 h-4 text-primary shrink-0" />
              <div className="flex flex-col">
                <span className="font-medium">{t('accounting:general_ledger.toolbar.manage_presets', 'Sablonok kezelése...')}</span>
                <span className="text-[10px] text-muted-foreground">{t('accounting:general_ledger.toolbar.manage_presets_sub', 'Meglévő sablonok megtekintése, törlése')}</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onOpenUploadPreset} className="cursor-pointer gap-2 text-xs py-2">
              <UploadCloud className="w-4 h-4 text-primary shrink-0" />
              <div className="flex flex-col">
                <span className="font-medium">{t('accounting:general_ledger.toolbar.upload_preset', 'Új sablon feltöltése...')}</span>
                <span className="text-[10px] text-muted-foreground">{t('accounting:general_ledger.toolbar.upload_preset_sub', 'Excel vagy CSV számlatükör beolvasása')}</span>
              </div>
            </DropdownMenuItem>
            {onOpenCopyPreset && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onOpenCopyPreset} className="cursor-pointer gap-2 text-xs py-2">
                  <Copy className="w-4 h-4 text-indigo-500 shrink-0" />
                  <div className="flex flex-col">
                    <span className="font-medium">{t('accounting:general_ledger.toolbar.copy_preset', 'Számlatükör másolása másik cégből...')}</span>
                    <span className="text-[10px] text-muted-foreground">{t('accounting:general_ledger.toolbar.copy_preset_sub', 'Beállítások és analitika 1-kattintásos átvétele')}</span>
                  </div>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── 2. Műveleti és Könyvelési Gombok (Jobb oldal) ── */}
      <div className="flex items-center gap-2 flex-wrap ml-auto">
        {/* Elsődleges gyorsművelet: Vegyes bizonylat */}
        <CustomTooltip content={t('accounting:general_ledger.toolbar.manual_entry_tooltip', 'Kézi vegyes könyvelési tétel rögzítése')} side="bottom">
          <Button 
            onClick={onOpenManualEntry} 
            size="sm" 
            className="h-9 gap-1.5 font-medium shadow-xs"
          >
            <BookOpen className="w-4 h-4" />
            <span>{t('accounting:general_ledger.toolbar.manual_entry', 'Vegyes bizonylat')}</span>
          </Button>
        </CustomTooltip>

        {/* Új főkönyvi szám hozzáadása */}
        <CustomTooltip content={t('accounting:general_ledger.toolbar.add_account_tooltip', 'Új egyedi számlaszám felvitele a számlatükörbe')} side="bottom">
          <Button 
            onClick={onOpenAddAccount} 
            size="sm" 
            variant="outline" 
            className="h-9 gap-1.5 font-medium"
          >
            <Plus className="w-4 h-4 text-primary" />
            <span className="hidden sm:inline">{t('accounting:general_ledger.toolbar.add_account', 'Új számlaszám')}</span>
          </Button>
        </CustomTooltip>

        {/* Egységes MKVK Audit XML menü (Exportálás + Importálás + Előzmények) */}
        <DropdownMenu>
          <CustomTooltip content={t('accounting:general_ledger.toolbar.xml_menu_tooltip', 'Könyvvizsgálói Audit XML export és import műveletek')} side="bottom">
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 font-medium text-xs">
                <FileCode className="w-4 h-4 text-primary" />
                <span>Audit XML</span>
                <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
              </Button>
            </DropdownMenuTrigger>
          </CustomTooltip>
          <DropdownMenuContent align="end" className="w-64">
            {onOpenExportAuditXml && (
              <>
                <DropdownMenuItem onClick={onOpenExportAuditXml} className="cursor-pointer gap-2 text-xs py-2">
                  <Download className="w-4 h-4 text-primary shrink-0" />
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-foreground">AuditXML_FkTet_export</span>
                      <span className="text-[9px] px-1 py-0 rounded bg-primary/10 text-primary font-mono font-bold">MKVK</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{t('accounting:general_ledger.toolbar.xml_export_desc', 'Könyvvizsgálói audit XML export (v1.0.23.0)')}</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={onOpenUploadAuditXml} className="cursor-pointer gap-2 text-xs py-2">
              <UploadCloud className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex flex-col">
                <span className="font-medium">{t('accounting:general_ledger.toolbar.xml_import', 'XML Importálás...')}</span>
                <span className="text-[10px] text-muted-foreground">{t('accounting:general_ledger.toolbar.xml_import_desc', 'NAV / könyvelőprogram XML auditfájl')}</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenAuditHistory} className="cursor-pointer gap-2 text-xs py-2">
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex flex-col">
                <span className="font-medium">{t('accounting:general_ledger.toolbar.xml_imports', 'Import előzmények...')}</span>
                <span className="text-[10px] text-muted-foreground">{t('accounting:general_ledger.toolbar.xml_imports_desc', 'Korábban feldolgozott XML-ek állapota')}</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* AI Besorolás gomb */}
        <CustomTooltip content={t('accounting:general_ledger.toolbar.ai_tooltip', 'Tételek automatikus besorolása mesterséges intelligenciával')} side="bottom">
          <Button 
            onClick={onRunAI} 
            disabled={isAIRunning}
            size="sm" 
            variant="secondary"
            className="h-9 gap-1.5 text-xs font-medium"
          >
            {isAIRunning ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Bot className="w-4 h-4 text-primary" />}
            <span className="hidden md:inline">
              {isAIRunning && aiProgress && aiProgress.total > 0
                ? `${t('accounting:general_ledger.toolbar.ai_running', 'AI Fut...')} (${aiProgress.processed}/${aiProgress.total})`
                : t('accounting:general_ledger.toolbar.ai_classification', 'AI Besorolás')}
            </span>
          </Button>
        </CustomTooltip>

        <div className="h-5 w-px bg-border/60 mx-0.5 hidden sm:block" />

        {/* Exportálás és Nyomtatás Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1.5 font-medium text-xs">
              <Download className="h-4 w-4 text-muted-foreground" />
              <span>{t('accounting:general_ledger.toolbar.export', 'Export')}</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-60 ml-0.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={onShowPrintPreview} className="cursor-pointer text-xs">
              <Eye className="h-4 w-4 mr-2 text-muted-foreground" />
              <span>{t('accounting:general_ledger.toolbar.print_preview', 'Nyomtatási előnézet')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onPrint} className="cursor-pointer text-xs">
              <Printer className="h-4 w-4 mr-2 text-muted-foreground" />
              <span className="flex-1">{t('accounting:general_ledger.toolbar.print_pdf', 'Nyomtatás / PDF')}</span>
              <kbd className="ml-2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                Ctrl+P
              </kbd>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="cursor-pointer text-xs">
                <FileSpreadsheet className="h-4 w-4 mr-2 text-muted-foreground" />
                <span>{t('accounting:general_ledger.toolbar.export_excel', 'Kivonat (Excel)')}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-52">
                <DropdownMenuItem onClick={() => onExportExcel({ excludeZeroRows: false })} className="cursor-pointer text-xs">
                  <Layers className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span>{t('accounting:general_ledger.toolbar.export_full', 'Teljes kivonat')}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExportExcel({ excludeZeroRows: true })} className="cursor-pointer text-xs">
                  <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span>{t('accounting:general_ledger.toolbar.export_no_zeros', '0-ás sorok nélkül')}</span>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="cursor-pointer text-xs">
                <Table2 className="h-4 w-4 mr-2 text-muted-foreground" />
                <span>{t('accounting:general_ledger.toolbar.export_analytical_excel', 'Analitikus kivonat (Excel)')}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-52">
                <DropdownMenuItem onClick={() => onExportAnalyticalExcel({ excludeZeroRows: false })} className="cursor-pointer text-xs">
                  <Layers className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span>{t('accounting:general_ledger.toolbar.export_full_analytics', 'Teljes analitika')}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExportAnalyticalExcel({ excludeZeroRows: true })} className="cursor-pointer text-xs">
                  <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span>{t('accounting:general_ledger.toolbar.export_no_zeros_analytics', '0-ás sorok nélkül')}</span>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
