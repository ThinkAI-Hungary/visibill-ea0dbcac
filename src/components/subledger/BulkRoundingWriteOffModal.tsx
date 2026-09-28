import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, Coins, CheckCircle2 } from 'lucide-react';
import { useWriteOffSubledgerDifference } from '@/hooks/useSubledger';
import type { SubledgerItem } from '@/types/subledger';
import { formatCurrency } from '@/lib/utils';

interface BulkRoundingWriteOffModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: SubledgerItem[];
  companyId: string;
}

export const BulkRoundingWriteOffModal: React.FC<BulkRoundingWriteOffModalProps> = ({
  isOpen,
  onClose,
  items,
  companyId,
}) => {
  // Filter items eligible for rounding write-off (remaining balance <= 10 HUF and > 0)
  const roundingCandidates = useMemo(() => {
    return items.filter(
      (i) => !i.is_settled && i.remaining_amount > 0 && i.remaining_amount <= 10
    );
  }, [items]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Initialize all selected
  React.useEffect(() => {
    if (roundingCandidates.length > 0) {
      setSelectedIds(new Set(roundingCandidates.map((i) => i.line_id)));
    }
  }, [roundingCandidates]);

  const writeOffMutation = useWriteOffSubledgerDifference();

  const handleToggle = (lineId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(roundingCandidates.map((i) => i.line_id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const selectedCandidates = useMemo(() => {
    return roundingCandidates.filter((i) => selectedIds.has(i.line_id));
  }, [roundingCandidates, selectedIds]);

  const totalAmount = useMemo(() => {
    return selectedCandidates.reduce((sum, i) => sum + i.remaining_amount, 0);
  }, [selectedCandidates]);

  const handleExecuteWriteOff = async () => {
    if (selectedCandidates.length === 0) return;
    setIsProcessing(true);

    try {
      for (const item of selectedCandidates) {
        await writeOffMutation.mutateAsync({
          companyId,
          lineId: item.line_id,
          type: 'ROUNDING',
          amountHuf: item.remaining_amount,
          description: `Kerekítési különbözet leírása - ${item.document_id}`,
        });
      }
      onClose();
    } catch (err) {
      console.error('Error during bulk write-off:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-500" />
            <span>Kerekítési Különbözetek Csoportos Leírása (≤ 10 Ft)</span>
          </DialogTitle>
          <DialogDescription>
            A számviteli törvény szerinti filléres kerekítési eltérések automatikus leírása egyéb ráfordításra / bevételre (8755/9779).
          </DialogDescription>
        </DialogHeader>

        {roundingCandidates.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground bg-muted/20 rounded-lg border border-dashed my-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
            Nem található 10 Ft alatti kerekítési különbözettel rendelkező nyitott tétel.
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={
                    roundingCandidates.length > 0 &&
                    selectedIds.size === roundingCandidates.length
                  }
                  onCheckedChange={(c) => handleSelectAll(!!c)}
                  id="bulk-round-select-all"
                />
                <label htmlFor="bulk-round-select-all" className="cursor-pointer font-medium">
                  Összes kijelölése ({roundingCandidates.length} tétel)
                </label>
              </div>

              <div>
                Kijelölt összeg: <strong className="text-foreground">{formatCurrency(totalAmount)} Ft</strong>
              </div>
            </div>

            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 border rounded-lg p-2 bg-muted/10">
              {roundingCandidates.map((item) => (
                <div
                  key={item.line_id}
                  className="flex items-center justify-between p-2.5 rounded-md border bg-card hover:bg-muted/30 transition-colors text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <Checkbox
                      checked={selectedIds.has(item.line_id)}
                      onCheckedChange={() => handleToggle(item.line_id)}
                    />
                    <div>
                      <div className="font-semibold text-foreground flex items-center gap-1.5">
                        <span>{item.document_id}</span>
                        <Badge variant="outline" className="text-[10px] py-0 px-1 font-mono">
                          {item.gl_number}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate max-w-[240px]">
                        {item.partner_name || item.description || item.gl_short_name}
                      </div>
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    <div className="font-bold text-amber-600 dark:text-amber-400">
                      {formatCurrency(item.remaining_amount)} Ft
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Eredeti: {formatCurrency(item.amount)} Ft
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="pt-2 flex justify-between sm:justify-between items-center">
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Bezárás
          </Button>

          {roundingCandidates.length > 0 && (
            <Button
              onClick={handleExecuteWriteOff}
              disabled={isProcessing || selectedCandidates.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center gap-1.5"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  Könyvelés...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Kijelöltek leírása ({selectedCandidates.length} db)</span>
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
