import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Wand2,
  Zap,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Keyboard,
  ArrowLeft,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { PostingMode, PostingSummary } from '../types';

interface PostingWizardHeaderProps {
  postingMode: PostingMode;
  onPostingModeChange: (newMode: PostingMode) => void;
  currentPage: number;
  pageSize: number;
  totalPendingInBatch: number;
  approvedInBatchCount: number;
  summary?: PostingSummary;
  onApproveAllInBatch: () => void;
  onPageChange: (newPage: number) => void;
  onOpenBatchDialog: () => void;
}

export function PostingWizardHeader({
  postingMode,
  onPostingModeChange,
  currentPage,
  pageSize,
  totalPendingInBatch,
  approvedInBatchCount,
  summary,
  onApproveAllInBatch,
  onPageChange,
  onOpenBatchDialog,
}: PostingWizardHeaderProps) {
  const navigate = useNavigate();

  const totalAllPending = summary?.pending_item_count || totalPendingInBatch;
  const totalPages = Math.max(1, Math.ceil(totalAllPending / pageSize));
  const progressPercent =
    totalPendingInBatch > 0 ? Math.round((approvedInBatchCount / totalPendingInBatch) * 100) : 100;

  const isWizardMode = postingMode === 'wizard';

  return (
    <div className="space-y-4 bg-card/70 border border-border/80 rounded-2xl p-5 shadow-sm backdrop-blur-sm">
      {/* Felső sor: Vissza gomb + Cím + Üzemmód választó */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="h-9 px-2 text-muted-foreground hover:text-foreground"
            title="Vissza az előző oldalra"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>

          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Wand2 className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Kontírozás Varázsló
              </h1>
              <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                Batch Approval
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Számlatételek áttekintése és jóváhagyása kontírszámok szerint csoportosítva.
            </p>
          </div>
        </div>

        {/* Működési mód választó (Kétállású kapcsoló) */}
        <div className="flex items-center gap-3 p-2.5 rounded-xl border border-border/60 bg-muted/30 self-start lg:self-auto">
          <div className="flex items-center gap-2">
            {isWizardMode ? (
              <Wand2 className="w-4 h-4 text-primary" />
            ) : (
              <Zap className="w-4 h-4 text-amber-500" />
            )}
            <Label htmlFor="posting-mode-toggle" className="text-xs font-semibold cursor-pointer">
              {isWizardMode
                ? 'Varázsló mód (Könyvelői jóváhagyás)'
                : 'Automatikus háttérkontírozás'}
            </Label>
          </div>
          <Switch
            id="posting-mode-toggle"
            checked={isWizardMode}
            onCheckedChange={(checked) => onPostingModeChange(checked ? 'wizard' : 'auto')}
            aria-label="Kontírozási mód váltó"
          />
        </div>
      </div>

      {/* Középső sor: Köteginformáció + Lapozás + Haladási sáv */}
      <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-4 pt-2 border-t border-border/50">
        {/* Bal: Köteg állapota */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium text-foreground">
            <span>
              {currentPage + 1}. köteg / {totalPages} köteg
            </span>
            <span className="text-muted-foreground">
              ({totalPendingInBatch} tétel a kötegben, összesen: {totalAllPending})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Progress value={progressPercent} className="h-2 flex-1" />
            <span className="text-xs font-mono font-semibold tabular-nums text-muted-foreground">
              {progressPercent}%
            </span>
          </div>
        </div>

        {/* Közép: Gyorsbillentyű segédlet */}
        <div className="hidden md:flex items-center justify-center gap-3 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1 bg-muted/60 px-2 py-1 rounded border border-border/40">
            <kbd className="font-mono font-bold text-[10px] bg-background px-1 rounded shadow-xs">
              Space
            </kbd>
            <span>Pipálás</span>
          </div>
          <div className="flex items-center gap-1 bg-muted/60 px-2 py-1 rounded border border-border/40">
            <kbd className="font-mono font-bold text-[10px] bg-background px-1 rounded shadow-xs">
              ↑ / ↓
            </kbd>
            <span>Lépkedés</span>
          </div>
          <div className="flex items-center gap-1 bg-muted/60 px-2 py-1 rounded border border-border/40">
            <kbd className="font-mono font-bold text-[10px] bg-background px-1 rounded shadow-xs">
              Ctrl+Enter
            </kbd>
            <span>Véglegesítés</span>
          </div>
        </div>

        {/* Jobb: Lapozás + Összes jóváhagyása akciógomb */}
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={currentPage === 0}
            onClick={() => onPageChange(currentPage - 1)}
            className="h-8 px-2"
            title="Előző köteg"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages - 1}
            onClick={() => onPageChange(currentPage + 1)}
            className="h-8 px-2"
            title="Következő köteg"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onApproveAllInBatch}
            disabled={totalPendingInBatch === 0 || approvedInBatchCount === totalPendingInBatch}
            className="h-8 text-xs gap-1.5 ml-2"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Összes jóváhagyása
          </Button>
        </div>
      </div>
    </div>
  );
}
