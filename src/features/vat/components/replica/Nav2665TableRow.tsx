import React from 'react';
import { cn } from '@/lib/utils';

interface Nav2665TableRowProps {
  rowNum: string;
  title: string;
  baseVal?: number | null;
  taxVal?: number | null;
  hasBase?: boolean;
  hasTax?: boolean;
  isSummary?: boolean;
  isHeader?: boolean;
  note?: string;
  className?: string;
  baseCellSuffix?: string;
  taxCellSuffix?: string;
}

/**
 * Format numbers in thousands of HUF (ezer forint) with space separators.
 * If 0 or null and cell is not required, display nothing or 0 if explicit.
 */
function fmtEftVal(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return '';
  if (val === 0) return '';
  return Math.round(val).toLocaleString('hu-HU');
}

/**
 * Standard ÁNYK official form table row (used in 2665A-01-01, 01-02, 01-03).
 */
export function Nav2665TableRow({
  rowNum,
  title,
  baseVal,
  taxVal,
  hasBase = true,
  hasTax = true,
  isSummary = false,
  note,
  className,
}: Nav2665TableRowProps) {
  const formattedBase = fmtEftVal(baseVal);
  const formattedTax = fmtEftVal(taxVal);

  return (
    <tr
      className={cn(
        'border-b border-black text-[11px] leading-tight select-none transition-colors hover:bg-amber-50/40 print:text-[9.5px] print:leading-[1.15]',
        isSummary ? 'bg-neutral-100 font-bold' : 'bg-white',
        className
      )}
    >
      {/* Left row number */}
      <td className="w-8 sm:w-9 border-r border-b border-black text-center font-mono text-[10px] sm:text-[11px] font-bold text-black py-0.5 px-1 print:py-[1.5px] print:px-0.5">
        {rowNum}.
      </td>

      {/* Description */}
      <td className="border-r border-b border-black py-0.5 px-1.5 print:py-[1.5px] print:px-1 text-black font-sans">
        <div className="flex flex-col gap-0">
          <span className={cn('text-[10.5px] sm:text-[11px] leading-tight print:text-[9px] print:leading-[1.1]', isSummary && 'font-bold')}>{title}</span>
          {note && <span className="text-[8px] text-neutral-500 italic leading-none">{note}</span>}
        </div>
      </td>

      {/* Column b: Az adó alapja */}
      <td className={cn(
        'w-28 sm:w-36 border-r border-b border-black py-0.5 px-1 print:py-[1.5px] print:px-1 text-right font-mono text-[11px] sm:text-[12px] print:text-[10px] tabular-nums relative',
        !hasBase && 'bg-neutral-50/40 print:bg-transparent'
      )}>
        {hasBase ? (
          <div className="flex items-center justify-end h-full px-1">
            <span className={cn('font-bold text-black', isSummary && 'text-[12px] sm:text-[13px]')}>
              {formattedBase || (baseVal === 0 ? '0' : '')}
            </span>
            <span className="text-[7px] text-neutral-400 absolute bottom-0.5 right-1 select-none print:text-[6.5px]">ezer</span>
          </div>
        ) : null}
      </td>

      {/* Column c: Az adó összege */}
      <td className={cn(
        'w-28 sm:w-36 border-r border-b border-black py-0.5 px-1 print:py-[1.5px] print:px-1 text-right font-mono text-[11px] sm:text-[12px] print:text-[10px] tabular-nums relative',
        !hasTax && 'bg-neutral-50/40 print:bg-transparent'
      )}>
        {hasTax ? (
          <div className="flex items-center justify-end h-full px-1">
            <span className={cn('font-bold text-black', isSummary && 'text-[12px] sm:text-[13px]')}>
              {formattedTax || (taxVal === 0 ? '0' : '')}
            </span>
            <span className="text-[7px] text-neutral-400 absolute bottom-0.5 right-1 select-none print:text-[6.5px]">ezer</span>
          </div>
        ) : null}
      </td>

      {/* Right row number */}
      <td className="w-8 sm:w-9 border-b border-black text-center font-mono text-[10px] sm:text-[11px] font-bold text-black py-0.5 px-1 print:py-[1.5px] print:px-0.5">
        {rowNum}.
      </td>
    </tr>
  );
}
