import React from 'react';
import { cn } from '@/lib/utils';

export interface Nav2665CharBoxProps {
  value?: string | number | null;
  length?: number;
  className?: string;
  boxClassName?: string;
  subLabels?: string[];
  compact?: boolean;
}

/**
 * Single segmented character boxes for official tax form representation.
 * Each character sits in a discrete 1px bordered box, identical to ÁNYK.
 */
export function Nav2665CharBox({
  value,
  length,
  className,
  boxClassName,
  subLabels,
  compact = false,
}: Nav2665CharBoxProps) {
  const strVal = value != null ? String(value) : '';
  const totalLength = length || Math.max(strVal.length, 1);
  const chars = strVal.padEnd(totalLength, ' ').slice(0, totalLength).split('');

  return (
    <div className={cn('inline-flex flex-col select-none', className)}>
      <div className="inline-flex border-t border-b border-l border-neutral-900 bg-white shadow-none">
        {chars.map((ch, idx) => (
          <div
            key={idx}
            className={cn(
              compact
                ? 'w-[11.5px] h-[17px] border-r border-neutral-900 flex items-center justify-center font-mono text-[9.5px] font-bold text-neutral-900 leading-none bg-white'
                : 'w-[18px] h-[22px] sm:w-[20px] sm:h-[24px] border-r border-neutral-900 flex items-center justify-center font-mono text-[12px] sm:text-[13px] font-bold text-neutral-900 leading-none bg-white',
              boxClassName
            )}
          >
            {ch === ' ' ? '' : ch}
          </div>
        ))}
      </div>
      {subLabels && subLabels.length > 0 && (
        <div
          className={cn(
            'flex text-neutral-600 font-sans mt-0.5 justify-around leading-none',
            compact ? 'text-[7px]' : 'text-[9px]'
          )}
        >
          {subLabels.map((lbl, idx) => (
            <span key={idx}>{lbl}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export interface Nav2665TaxNumberBoxesProps {
  taxNumber?: string | null;
  className?: string;
  compact?: boolean;
  boxClassName?: string;
}

/**
 * Standard Hungarian 8-1-2 tax number split into segmented character boxes:
 * [1][2][3][4][5][6][7][8] - [1] - [1][2]
 */
export function Nav2665TaxNumberBoxes({
  taxNumber,
  className,
  compact = false,
  boxClassName,
}: Nav2665TaxNumberBoxesProps) {
  const clean = (taxNumber || '').replace(/[^0-9]/g, '');
  const part1 = clean.slice(0, 8);
  const part2 = clean.slice(8, 9);
  const part3 = clean.slice(9, 11);

  return (
    <div
      className={cn(
        'inline-flex items-center select-none',
        compact ? 'gap-0.5' : 'gap-1',
        className
      )}
    >
      <Nav2665CharBox value={part1} length={8} compact={compact} boxClassName={boxClassName} />
      <span className={cn('font-bold text-neutral-900 leading-none', compact ? 'text-[11px]' : 'text-sm')}>-</span>
      <Nav2665CharBox value={part2} length={1} compact={compact} boxClassName={boxClassName} />
      <span className={cn('font-bold text-neutral-900 leading-none', compact ? 'text-[11px]' : 'text-sm')}>-</span>
      <Nav2665CharBox value={part3} length={2} compact={compact} boxClassName={boxClassName} />
    </div>
  );
}

export interface Nav2665BankAccountBoxesProps {
  accountNumber?: string | null;
  className?: string;
  compact?: boolean;
}

/**
 * Standard Hungarian 3x8 or 2x8 bank account number split into segmented character boxes.
 */
export function Nav2665BankAccountBoxes({ accountNumber, className }: Nav2665BankAccountBoxesProps) {
  const clean = (accountNumber || '').replace(/[^0-9]/g, '');
  const part1 = clean.slice(0, 8);
  const part2 = clean.slice(8, 16);
  const part3 = clean.slice(16, 24);

  return (
    <div className={cn('inline-flex items-center gap-1 select-none', className)}>
      <Nav2665CharBox value={part1} length={8} />
      <span className="font-bold text-neutral-900 text-sm leading-none">-</span>
      <Nav2665CharBox value={part2} length={8} />
      {clean.length > 16 && (
        <>
          <span className="font-bold text-neutral-900 text-sm leading-none">-</span>
          <Nav2665CharBox value={part3} length={8} />
        </>
      )}
    </div>
  );
}

export interface Nav2665DateBoxesProps {
  dateStr?: string | null;
  className?: string;
  labels?: [string, string, string];
  compact?: boolean;
  boxClassName?: string;
}

/**
 * 8-box date [YYYY][MM][DD] with sublabels 'év', 'hó', 'nap'
 */
export function Nav2665DateBoxes({
  dateStr,
  className,
  labels = ['év', 'hó', 'nap'],
  compact = false,
  boxClassName,
}: Nav2665DateBoxesProps) {
  const clean = (dateStr || '').replace(/[^0-9]/g, '');
  const yyyy = clean.slice(0, 4);
  const mm = clean.slice(4, 6);
  const dd = clean.slice(6, 8);

  const boxCls = cn(
    compact
      ? 'w-[10.5px] h-[17px] border-r border-neutral-900 flex items-center justify-center font-mono text-[9.5px] font-bold text-neutral-900 leading-none'
      : 'w-[18px] h-[22px] sm:w-[20px] sm:h-[24px] border-r border-neutral-900 flex items-center justify-center font-mono text-[12px] sm:text-[13px] font-bold text-neutral-900',
    boxClassName
  );

  return (
    <div className={cn('inline-flex flex-col select-none', className)}>
      <div className="inline-flex border border-neutral-900 bg-white">
        {/* Year: 4 boxes */}
        {[0, 1, 2, 3].map((i) => (
          <div key={`y-${i}`} className={boxCls}>
            {yyyy[i] || ''}
          </div>
        ))}
        {/* Month: 2 boxes */}
        {[0, 1].map((i) => (
          <div key={`m-${i}`} className={boxCls}>
            {mm[i] || ''}
          </div>
        ))}
        {/* Day: 2 boxes */}
        {[0, 1].map((i) => (
          <div
            key={`d-${i}`}
            className={cn(
              compact
                ? 'w-[10.5px] h-[17px] flex items-center justify-center font-mono text-[9.5px] font-bold text-neutral-900 leading-none'
                : 'w-[18px] h-[22px] sm:w-[20px] sm:h-[24px] flex items-center justify-center font-mono text-[12px] sm:text-[13px] font-bold text-neutral-900',
              i === 0 ? 'border-r border-neutral-900' : '',
              boxClassName
            )}
          >
            {dd[i] || ''}
          </div>
        ))}
      </div>
      <div
        className={cn(
          'grid grid-cols-3 text-neutral-600 font-sans mt-0.5 text-center leading-none',
          compact ? 'text-[7px]' : 'text-[9px]'
        )}
      >
        <span>{labels[0]}</span>
        <span>{labels[1]}</span>
        <span>{labels[2]}</span>
      </div>
    </div>
  );
}
