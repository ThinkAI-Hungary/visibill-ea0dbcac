import React, { useState, useRef, useEffect } from 'react';
import { Download, ChevronDown, FileSpreadsheet, FileText, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportData, type ExportFormat } from '@/lib/exportCsv';
import { exportPdf, type PdfExportOptions } from '@/lib/exportPdf';
import { cn } from '@/lib/utils';

interface ExportButtonProps {
  filename: string;
  headers: string[];
  getRows: () => (string | number | null | undefined)[][];
  label?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
  /** Optional PDF export options. If provided, adds a PDF option to the dropdown. */
  pdfOptions?: Omit<PdfExportOptions, 'headers' | 'rows'>;
}

export function ExportButton({
  filename,
  headers,
  getRows,
  label = 'Export',
  variant = 'outline',
  size = 'default',
  className,
  pdfOptions,
}: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleExport = (format: ExportFormat) => {
    exportData(filename, headers, getRows(), format);
    setOpen(false);
  };

  const handlePdfExport = () => {
    const rows = getRows();
    exportPdf(filename, {
      ...pdfOptions,
      title: pdfOptions?.title || filename,
      headers,
      rows,
    });
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <Button
        variant={variant}
        size={size}
        className={cn('gap-1.5', className)}
        onClick={() => setOpen(!open)}
      >
        <Download className="w-4 h-4" />
        {label}
        <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-lg overflow-hidden min-w-[180px] animate-in fade-in slide-in-from-top-1 duration-150">
          <button
            onClick={() => handleExport('xlsx')}
            className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-sm hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors text-left"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">Excel (.xlsx)</p>
              <p className="text-[10px] text-slate-400">Microsoft Excel formátum</p>
            </div>
          </button>
          <div className="border-t border-border" />
          <button
            onClick={() => handleExport('csv')}
            className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-sm hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors text-left"
          >
            <FileText className="w-4 h-4 text-blue-600" />
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">CSV (.csv)</p>
              <p className="text-[10px] text-slate-400">Szöveges, pontosvesszővel tagolt</p>
            </div>
          </button>
          <div className="border-t border-border" />
          <button
            onClick={handlePdfExport}
            className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-sm hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors text-left"
          >
            <FileDown className="w-4 h-4 text-red-600" />
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">PDF (.pdf)</p>
              <p className="text-[10px] text-slate-400">Nyomtatható dokumentum</p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
