import { useState } from 'react';
import { XCircle, RotateCcw, Loader2, AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface StornoSettleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 'settle' = lezárás, 'unsettle' = visszavonás */
  mode: 'settle' | 'unsettle';
  stornoNavId: string;
  stornoNumber: string;
  /** Hívódik a sikeres RPC + cache invalidálás UTÁN — ez zárja be a modalt */
  onSuccess: () => void;
}

export function StornoSettleDialog({
  open,
  onOpenChange,
  mode,
  stornoNavId,
  stornoNumber,
  onSuccess,
}: StornoSettleDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const isSettle = mode === 'settle';

  const handleConfirm = async () => {
    try {
      setLoading(true);

      const rpcName = isSettle
        ? 'mark_storno_group_settled'
        : 'unmark_storno_group_settled';

      const { error } = await supabase.rpc(rpcName, {
        p_storno_nav_id: stornoNavId,
      });

      if (error) throw error;

      // Async Modal UX: await cache invalidálás → modal zár → toast
      await onSuccess();
      onOpenChange(false);

      toast({
        title: isSettle ? 'Sztornó lezárva' : 'Lezárás visszavonva',
        description: isSettle
          ? `A ${stornoNumber} sztornó számla és kapcsolódó bizonylatok lezárt állapotba kerültek.`
          : `A ${stornoNumber} lezárása visszavonva. A számlák ismét páratlan állapotban várják a tranzakciót.`,
        variant: 'success',
      });
    } catch (err: any) {
      console.error('[StornoSettleDialog] RPC error:', err);
      toast({
        title: 'Hiba történt',
        description: err.message || 'A művelet nem sikerült. Kérjük próbálja újra.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {isSettle ? (
              <>
                <XCircle className="h-5 w-5 text-orange-500" />
                Sztornó lezárása
              </>
            ) : (
              <>
                <RotateCcw className="h-5 w-5 text-muted-foreground" />
                Lezárás visszavonása
              </>
            )}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              {isSettle ? (
                <>
                  <p>
                    A <span className="font-mono font-medium text-foreground">{stornoNumber}</span> sztornó
                    számla és minden hozzá kapcsolt bizonylat lezárásra, kifizetett státuszra kerül.
                  </p>
                  <div className="rounded-md bg-muted/50 border border-border/50 p-3 space-y-1 text-xs">
                    <p className="font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                      Az alábbi bizonylatok kerülnek lezárásra:
                    </p>
                    <p>• Sztornó NAV számla: <span className="font-mono">{stornoNumber}</span></p>
                    <p>• Kapcsolódó beküldött számlakép (ha van)</p>
                    <p>• Hivatkozott eredeti számla (ha azonosítható)</p>
                  </div>
                  <p className="text-xs">
                    A lezárás visszavonható, ha szükséges.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    Visszavonja a <span className="font-mono font-medium text-foreground">{stornoNumber}</span> sztornó
                    számla lezárást.
                  </p>
                  <p className="text-xs">
                    A számlák ismét páratlan állapotba kerülnek és várhatják a bejövő tranzakciót.
                  </p>
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Mégse</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading}
            className={isSettle
              ? 'bg-orange-500 hover:bg-orange-600 text-white'
              : ''
            }
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isSettle ? (
              <>
                <XCircle className="h-4 w-4 mr-1.5" />
                Lezárás megerősítése
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4 mr-1.5" />
                Visszavonás megerősítése
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
