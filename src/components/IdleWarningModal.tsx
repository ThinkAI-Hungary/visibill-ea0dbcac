import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';

interface IdleWarningModalProps {
  open: boolean;
  secondsLeft: number;
  onStay: () => void;
  onLogout: () => void;
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function IdleWarningModal({ open, secondsLeft, onStay, onLogout }: IdleWarningModalProps) {
  const isUrgent = secondsLeft <= 30;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md border-border/60 shadow-2xl z-[9999]"
        overlayClassName="backdrop-blur-md bg-black/60 z-[9999]"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        hideCloseButton
      >
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 ring-1 ring-amber-500/20">
            <ShieldAlert className={`h-7 w-7 text-amber-500 ${isUrgent ? 'animate-pulse' : ''}`} />
          </div>
          <DialogTitle className="text-xl font-bold">
            Inaktivitás észlelve
          </DialogTitle>
          <DialogDescription className="mt-2 text-base leading-relaxed">
            A munkameneted hamarosan{' '}
            <span
              className="inline-block w-[4.5rem] text-center font-mono tabular-nums font-semibold text-foreground"
            >
              {formatTime(secondsLeft)}
            </span>{' '}
            múlva lejár inaktivitás miatt.
          </DialogDescription>
        </DialogHeader>

        {/* Progress bar */}
        <div className="mt-2 mb-1 h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-linear ${
              isUrgent ? 'bg-destructive' : 'bg-amber-500'
            }`}
            style={{ width: `${(secondsLeft / 120) * 100}%` }}
          />
        </div>

        <DialogFooter className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
          <Button
            variant="outline"
            onClick={onLogout}
            className="text-muted-foreground"
          >
            Kijelentkezés
          </Button>
          <Button
            onClick={onStay}
            className="bg-primary hover:bg-primary/90 font-semibold"
            autoFocus
          >
            Igen, maradok
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
