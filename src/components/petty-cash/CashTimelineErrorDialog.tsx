import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle, Calendar, Hash, ArrowDownRight, ShieldAlert } from 'lucide-react';
import { fmtBalance } from './types';
import type { TimelineIntegrityResult } from './types';

interface CashTimelineErrorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: TimelineIntegrityResult | null;
  currency?: string;
}

export default function CashTimelineErrorDialog({
  open,
  onOpenChange,
  result,
  currency = 'HUF',
}: CashTimelineErrorDialogProps) {
  const { t } = useTranslation(['pettyCash', 'common']);

  if (!result || result.valid) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-destructive/40 shadow-2xl bg-gradient-to-b from-background to-destructive/5">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-destructive">
                {t('pettyCash:timeline_error.title', 'Negatív pénztáregyenleg tilalma')}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Sztv. 165. § és hatályos Pénzkezelési Szabályzat védelmi korlát
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          <div className="p-3.5 rounded-lg border border-destructive/30 bg-destructive/5 text-foreground space-y-2">
            <div className="flex items-start gap-2 text-xs font-medium text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                {result.message || 'A művelet végrehajtása nem engedélyezett, mert a házipénztár egyenlege negatívba fordulna.'}
              </span>
            </div>
          </div>

          {/* Breakdown cards */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg border border-border/80 bg-card space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span>Kritikus dátum</span>
              </div>
              <div className="font-bold text-sm text-foreground">
                {result.first_failing_date || '—'}
              </div>
            </div>

            <div className="p-3 rounded-lg border border-border/80 bg-card space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Hash className="h-3.5 w-3.5" />
                <span>Érintett bizonylat</span>
              </div>
              <div className="font-bold text-sm font-mono text-foreground truncate" title={result.first_failing_receipt_number || 'Új tétel'}>
                {result.first_failing_receipt_number || 'Rögzítendő tétel'}
              </div>
            </div>

            <div className="p-3 rounded-lg border border-border/80 bg-card space-y-1">
              <div className="text-muted-foreground">Egyenleg a hiány előtt</div>
              <div className="font-bold text-sm font-mono text-emerald-600 dark:text-emerald-400">
                {fmtBalance(result.running_balance_before_deficit, currency)}
              </div>
            </div>

            <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 space-y-1">
              <div className="flex items-center gap-1 text-destructive font-medium">
                <ArrowDownRight className="h-3.5 w-3.5" />
                <span>Kialakuló hiány</span>
              </div>
              <div className="font-bold text-sm font-mono text-destructive">
                {fmtBalance(result.deficit_amount, currency)}
              </div>
            </div>
          </div>

          <div className="text-[11px] text-muted-foreground leading-relaxed bg-muted/40 p-3 rounded-lg border border-border/50">
            <strong>Számviteli követelmény:</strong> A készpénzállomány fizikai természetéből adódóan a pénztár egyetlen napon sem mutathat negatív összeget. Kérjük, előbb rögzítsen bevételezést (pl. banki készpénzfelvételt vagy tulajdonosi tagi kölcsönt), és csak ezt követően hajtsa végre a kiadást!
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="default"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            {t('common:understood', 'Megértettem, javítom a tételt')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
