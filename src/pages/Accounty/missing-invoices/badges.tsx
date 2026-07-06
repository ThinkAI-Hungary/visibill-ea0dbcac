import React from 'react';

export function getPriorityBadge(priority: string) {
  switch (priority) {
    case 'Sürgős':
      return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800">Sürgős</span>;
    case 'Közepes':
      return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800">Közepes</span>;
    case 'Alacsony':
      return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-border">Alacsony</span>;
    default:
      return null;
  }
}

export function getStatusBadge(status: string, variant: string) {
  if (variant === 'success') {
    return <span className="text-xs font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/40 px-2.5 py-1 rounded-full border border-green-200 dark:border-green-800 whitespace-nowrap">{status}</span>;
  }
  if (variant === 'warning') {
    return <span className="text-xs font-semibold text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/40 px-2.5 py-1 rounded-full border border-amber-100/50 dark:border-amber-800 whitespace-nowrap">{status}</span>;
  }
  return <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-full border border-border whitespace-nowrap">{status}</span>;
}
