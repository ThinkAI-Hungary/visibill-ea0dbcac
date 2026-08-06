import React from 'react';
import {
  FileText, FileJson, Download, Mail, Eye, Loader2,
  Check, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { PreviewTable, type FullReportData } from './ReportHelpers';

type ReportType = 'havi' | 'afa' | 'koltseg' | 'cashflow' | 'partner' | 'hianyzo';

const reportTypes = [
  { id: 'havi', title: 'Havi összesítő' },
  { id: 'afa', title: 'ÁFA kimutatás' },
  { id: 'koltseg', title: 'Költségkimutatás' },
  { id: 'cashflow', title: 'Cash flow riport' },
  { id: 'partner', title: 'Partner kimutatás' },
];

interface ReportGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedType: ReportType;
  onTypeChange: (type: ReportType) => void;
  format: 'pdf' | 'excel';
  onFormatChange: (f: 'pdf' | 'excel') => void;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  includeDetails: boolean;
  onIncludeDetailsChange: (v: boolean) => void;
  isGenerating: boolean;
  generated: boolean;
  showPreview: boolean;
  emailSent: boolean;
  reportData: FullReportData;
  currentTypeLabel: string;
  onGenerate: () => void;
  onPreview: () => void;
  onSendEmail: () => void;
  onHidePreview: () => void;
}

export function ReportGeneratorModal({
  isOpen, onClose, selectedType, onTypeChange,
  format, onFormatChange, dateFrom, dateTo,
  onDateFromChange, onDateToChange, includeDetails,
  onIncludeDetailsChange, isGenerating, generated,
  showPreview, emailSent, reportData, currentTypeLabel,
  onGenerate, onPreview, onSendEmail, onHidePreview,
}: ReportGeneratorModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      <div className="relative bg-card rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 z-10 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-start p-6 border-b border-border shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Riport generálása</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Állítsd be a riport paramétereit</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto">


          {/* Date Range */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-slate-900 dark:text-slate-100">Időszak</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500 dark:text-slate-400">Kezdő dátum</Label>
                <Input type="date" value={dateFrom} onChange={(e) => onDateFromChange(e.target.value)} className="bg-card border-border text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500 dark:text-slate-400">Záró dátum</Label>
                <Input type="date" value={dateTo} onChange={(e) => onDateToChange(e.target.value)} className="bg-card border-border text-sm" />
              </div>
            </div>
            <p className="text-[11px] text-slate-400">{reportData.invoices.length} számla a kiválasztott időszakban</p>
          </div>

          {/* Format */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-slate-900 dark:text-slate-100">Formátum</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => onFormatChange('pdf')}
                className={cn(
                  "flex items-center gap-2 p-3 rounded-xl border-2 transition-colors text-sm font-medium",
                  format === 'pdf' ? "border-slate-900 dark:border-primary bg-slate-50 dark:bg-accent" : "border-border hover:border-slate-200"
                )}
              >
                <FileText className={cn("w-4 h-4", format === 'pdf' ? "text-red-500" : "text-slate-400")} />
                PDF
              </button>
              <button
                onClick={() => onFormatChange('excel')}
                className={cn(
                  "flex items-center gap-2 p-3 rounded-xl border-2 transition-colors text-sm font-medium",
                  format === 'excel' ? "border-slate-900 dark:border-primary bg-slate-50 dark:bg-accent" : "border-border hover:border-slate-200"
                )}
              >
                <FileJson className={cn("w-4 h-4", format === 'excel' ? "text-primary" : "text-slate-400")} />
                Excel
              </button>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-slate-900 dark:text-slate-100">Opciók</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox id="opt-1" checked={includeDetails} onCheckedChange={(c) => onIncludeDetailsChange(!!c)} className="border-slate-300 rounded" />
                <Label htmlFor="opt-1" className="text-sm font-normal cursor-pointer">Részletes tételsorok</Label>
              </div>
            </div>
          </div>

          {/* Inline Preview */}
          {showPreview && (
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400"> Előnézet — {currentTypeLabel}</span>
                <button onClick={onHidePreview} className="text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="p-4 max-h-[350px] overflow-y-auto text-xs">
                <PreviewTable data={reportData} type={selectedType} options={{ details: includeDetails }} />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex items-center justify-between shrink-0 dark:bg-slate-900/50">
          <Button variant="ghost" className="text-slate-500 dark:text-slate-400 hover:text-slate-700 whitespace-nowrap" onClick={onClose}>
            Mégse
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onSendEmail}
              disabled={isGenerating}
              className={cn(
                "gap-2 bg-card border-border whitespace-nowrap transition-all",
                emailSent ? "text-primary border-primary/30" : "text-slate-700 dark:text-slate-300"
              )}
            >
              {emailSent ? <><Check className="w-4 h-4" /> Elküldve!</> : <><Mail className="w-4 h-4" /> Generálás és küldés</>}
            </Button>
            <Button
              variant="outline"
              onClick={onPreview}
              className={cn(
                "gap-2 bg-card border-border whitespace-nowrap",
                showPreview ? "text-indigo-600 border-indigo-300" : "text-slate-700 dark:text-slate-300"
              )}
            >
              <Eye className="w-4 h-4" /> Előnézet
            </Button>
            <Button
              onClick={onGenerate}
              disabled={isGenerating}
              className={cn(
                "gap-2 whitespace-nowrap transition-all",
                generated
                  ? "bg-primary text-white hover:bg-primary/90"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              {isGenerating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generálás...</>
              ) : generated ? (
                <><Check className="w-4 h-4" /> Letöltve!</>
              ) : (
                <><Download className="w-4 h-4" /> Generálás</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
