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
        'border-b border-neutral-900 text-[11px] leading-tight select-none transition-colors hover:bg-amber-50/40',
        isSummary ? 'bg-neutral-100 font-bold' : 'bg-white',
        className
      )}
    >
      {/* Left row number */}
      <td className="w-9 border-r border-neutral-900 text-center font-mono text-[11px] font-bold text-neutral-900 p-1">
        {rowNum}.
      </td>

      {/* Description */}
      <td className="border-r border-neutral-900 p-1.5 text-neutral-900 font-sans">
        <div className="flex flex-col gap-0.5">
          <span className={cn('text-[11px] leading-tight', isSummary && 'font-bold')}>{title}</span>
          {note && <span className="text-[9px] text-neutral-500 italic leading-none">{note}</span>}
        </div>
      </td>

      {/* Column b: Az adó alapja */}
      <td className={cn(
        'w-32 sm:w-36 border-r border-neutral-900 p-1 text-right font-mono text-[12px] tabular-nums relative',
        !hasBase && 'bg-neutral-100/80 cursor-not-allowed'
      )}>
        {hasBase ? (
          <div className="flex items-center justify-end h-full px-1">
            <span className={cn('font-bold text-neutral-900', isSummary && 'text-[13px]')}>
              {formattedBase || (baseVal === 0 ? '0' : '')}
            </span>
            <span className="text-[7px] text-neutral-400 absolute bottom-0.5 right-1 select-none">ezer</span>
          </div>
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <div className="w-full h-[1px] bg-neutral-300" />
          </div>
        )}
      </td>

      {/* Column c: Az adó összege */}
      <td className={cn(
        'w-32 sm:w-36 border-r border-neutral-900 p-1 text-right font-mono text-[12px] tabular-nums relative',
        !hasTax && 'bg-neutral-100/80 cursor-not-allowed'
      )}>
        {hasTax ? (
          <div className="flex items-center justify-end h-full px-1">
            <span className={cn('font-bold text-neutral-900', isSummary && 'text-[13px]')}>
              {formattedTax || (taxVal === 0 ? '0' : '')}
            </span>
            <span className="text-[7px] text-neutral-400 absolute bottom-0.5 right-1 select-none">ezer</span>
          </div>
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <div className="w-full h-[1px] bg-neutral-300" />
          </div>
        )}
      </td>

      {/* Right row number */}
      <td className="w-9 text-center font-mono text-[11px] font-bold text-neutral-900 p-1">
        {rowNum}.
      </td>
    </tr>
  );
}
