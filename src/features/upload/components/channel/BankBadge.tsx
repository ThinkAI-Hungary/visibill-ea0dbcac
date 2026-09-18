import React from 'react';
import { cn } from '@/lib/utils';

interface BankBadgeProps {
  bank: string;
  className?: string;
}

export function BankBadge({ bank, className }: BankBadgeProps) {
  const normalizedBank = bank.toLowerCase().trim();

  switch (normalizedBank) {
    case 'auto':
      return (
        <span
          className={cn(
            'w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center shrink-0 shadow-xs',
            className
          )}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <circle cx="5" cy="5" r="2" fill="white" />
            <path
              d="M5 1v2M5 7v2M1 5h2M7 5h2"
              stroke="white"
              strokeWidth="0.8"
              strokeLinecap="round"
            />
          </svg>
        </span>
      );

    case 'otp':
      return (
        <span
          className={cn(
            'w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-[9px] font-black text-white shrink-0 shadow-xs select-none',
            className
          )}
        >
          O
        </span>
      );

    case 'erste':
      return (
        <span
          className={cn(
            'w-5 h-5 rounded-full bg-sky-500 flex items-center justify-center text-[9px] font-black text-white shrink-0 shadow-xs select-none',
            className
          )}
        >
          E
        </span>
      );

    case 'kh':
      return (
        <span
          className={cn(
            'w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-[9px] font-black text-white shrink-0 shadow-xs select-none',
            className
          )}
        >
          K
        </span>
      );

    case 'raiffeisen':
      return (
        <span
          className={cn(
            'w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center text-[9px] font-black text-black shrink-0 shadow-xs select-none',
            className
          )}
        >
          R
        </span>
      );

    case 'mbh':
      return (
        <span
          className={cn(
            'w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-[9px] font-black text-white shrink-0 shadow-xs select-none',
            className
          )}
        >
          M
        </span>
      );

    case 'cib':
      return (
        <span
          className={cn(
            'w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-[9px] font-black text-white shrink-0 shadow-xs select-none',
            className
          )}
        >
          C
        </span>
      );

    case 'unicredit':
      return (
        <span
          className={cn(
            'w-5 h-5 rounded-full bg-rose-600 flex items-center justify-center text-[9px] font-black text-white shrink-0 shadow-xs select-none',
            className
          )}
        >
          U
        </span>
      );

    case 'granit':
      return (
        <span
          className={cn(
            'w-5 h-5 rounded-full bg-stone-500 flex items-center justify-center text-[9px] font-black text-white shrink-0 shadow-xs select-none',
            className
          )}
        >
          G
        </span>
      );

    case 'magnet':
      return (
        <span
          className={cn(
            'w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center text-[9px] font-black text-white shrink-0 shadow-xs select-none',
            className
          )}
        >
          M
        </span>
      );

    case 'szep':
      return (
        <span
          className={cn(
            'w-5 h-5 rounded-full bg-teal-500 flex items-center justify-center text-[8px] font-black text-white leading-none shrink-0 shadow-xs select-none',
            className
          )}
        >
          SZ
        </span>
      );

    case 'wise':
      return (
        <span
          className={cn(
            'w-5 h-5 rounded-full bg-[#9FE870] flex items-center justify-center text-[9px] font-black text-black shrink-0 shadow-xs select-none',
            className
          )}
        >
          W
        </span>
      );

    case 'revolut':
      return (
        <span
          className={cn(
            'w-5 h-5 rounded-full bg-[#0075EB] flex items-center justify-center text-[9px] font-black text-white shrink-0 shadow-xs select-none',
            className
          )}
        >
          R
        </span>
      );

    case 'zaba':
      return (
        <span
          className={cn(
            'w-5 h-5 rounded-full bg-red-600 flex items-center justify-center text-[9px] font-black text-white shrink-0 shadow-xs select-none',
            className
          )}
        >
          Z
        </span>
      );

    case 'minimax':
      return (
        <span
          className={cn(
            'w-5 h-5 rounded-full bg-teal-600 flex items-center justify-center text-[9px] font-black text-white shrink-0 shadow-xs select-none',
            className
          )}
        >
          M
        </span>
      );

    case 'paypal':
      return (
        <span
          className={cn(
            'w-5 h-5 rounded-full bg-[#003087] flex items-center justify-center text-[9px] font-black text-white shrink-0 shadow-xs select-none',
            className
          )}
        >
          P
        </span>
      );

    case 'binx':
      return (
        <span
          className={cn(
            'w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center text-[9px] font-black text-white shrink-0 shadow-xs select-none',
            className
          )}
        >
          B
        </span>
      );

    default:
      return (
        <span
          className={cn(
            'w-5 h-5 rounded-full bg-muted-foreground/30 flex items-center justify-center text-[9px] font-bold text-foreground shrink-0 shadow-xs select-none',
            className
          )}
        >
          {bank ? bank.slice(0, 1).toUpperCase() : '?'}
        </span>
      );
  }
}
