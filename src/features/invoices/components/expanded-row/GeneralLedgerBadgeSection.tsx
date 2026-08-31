import React from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GeneralLedgerBadgeSectionProps {
  glNumbers: string | null | undefined;
  hasSubmittedMatch?: boolean;
}

export function GeneralLedgerBadgeSection({
  glNumbers,
  hasSubmittedMatch = false,
}: GeneralLedgerBadgeSectionProps) {
  if (!glNumbers) return null;

  return (
    <div className="mb-4 expand-animate bg-card border border-border/40 p-3 rounded-lg flex flex-col gap-2 max-w-lg">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        <FileSpreadsheet className="h-3.5 w-3.5 text-primary" />
        Hozzárendelt főkönyvi számok
      </div>
      <div className="flex flex-wrap gap-1.5 font-mono">
        {glNumbers.split(', ').map((num) => (
          <span
            key={num}
            className={cn(
              "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border",
              hasSubmittedMatch
                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400"
                : "bg-orange-500/10 text-orange-500 border-orange-500/20 dark:text-orange-400"
            )}
          >
            {num} ({hasSubmittedMatch ? 'Végleges' : 'Ideiglenes'})
          </span>
        ))}
      </div>
    </div>
  );
}
