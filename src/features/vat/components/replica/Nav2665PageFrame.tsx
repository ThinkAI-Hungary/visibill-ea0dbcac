import React from 'react';
import { cn } from '@/lib/utils';
import { Nav2665TaxNumberBoxes } from './Nav2665CharBox';

interface Nav2665PageFrameProps {
  sheetCode: string; // e.g. "2665A", "2665A-01-01", "2665A-01-02", etc.
  sheetTitle?: string;
  sheetSubTitle?: string;
  taxNumber?: string | null;
  pageNumber?: number;
  totalPages?: number;
  children: React.ReactNode;
  className?: string;
}

/**
 * Authentic A4 paper simulation for NAV ÁNYK official tax return forms.
 */
export function Nav2665PageFrame({
  sheetCode,
  sheetTitle,
  sheetSubTitle,
  taxNumber,
  pageNumber,
  totalPages,
  children,
  className,
}: Nav2665PageFrameProps) {
  const currentDate = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
  const currentTime = new Date().toTimeString().slice(0, 8);

  const isFolap = sheetCode === '2665A' || /^\d{2}A60$/.test(sheetCode);

  return (
    <div
      className={cn(
        'nav2665-page-frame w-full max-w-[880px] mx-auto bg-white text-neutral-900 border-2 border-black shadow-xl print:shadow-none print:border-black p-4 sm:p-7 relative font-sans transition-all print:max-w-none print:w-full print:p-2.5 print:py-2 print:m-0 my-6 select-text',
        className
      )}
      style={{
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
      }}
    >
      {/* Top Header Row for Sub-sheets (if not main Főlap) */}
      {!isFolap && (
        <div className="border-b-2 border-black pb-2 mb-3 print:pb-1 print:mb-1.5">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-mono text-xl sm:text-2xl font-black tracking-tight text-neutral-900 print:text-lg">
                {sheetCode}
              </div>
              {sheetTitle && (
                <div className="text-xs font-bold text-neutral-800 uppercase tracking-wide mt-0.5 print:text-[10px]">
                  {sheetTitle}
                </div>
              )}
              {sheetSubTitle && (
                <div className="text-[10px] text-neutral-600 font-medium print:text-[8.5px]">
                  {sheetSubTitle}
                </div>
              )}
            </div>

            <div className="flex flex-col items-end gap-1">
              {pageNumber && (
                <div className="flex items-center gap-1 border border-black px-2 py-0.5 text-[10px] font-mono font-bold bg-neutral-50 print:text-[9px] print:py-0">
                  <span>Lapszám:</span>
                  <span className="text-sm font-black print:text-xs">{pageNumber}</span>
                  {totalPages && <span> / {totalPages}</span>}
                </div>
              )}
              <div className="flex flex-col items-end">
                <span className="text-[9px] text-neutral-600 font-sans print:text-[8px]">
                  Adózó adószáma / csoportazonosító száma
                </span>
                <Nav2665TaxNumberBoxes taxNumber={taxNumber} className="scale-90 origin-right print:scale-80" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content of the Page */}
      <div className="space-y-4 print:space-y-1.5">{children}</div>

      {/* Official ÁNYK Bottom Footer Banner */}
      <div className="mt-6 pt-2 border-t border-black flex flex-col sm:flex-row justify-between items-start sm:items-center text-[9px] text-neutral-600 font-mono gap-1 select-none print:mt-1.5 print:pt-1 print:text-[8px]">
        <div>
          Ny.v.:2.0 A nyomtatvány jelen kitöltöttség mellett papír alapon nem küldhető be!
        </div>
        <div className="tabular-nums">
          Nyomtatva: {currentDate} {currentTime}
        </div>
      </div>
    </div>
  );
}
