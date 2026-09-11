import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Pencil, Trash2, Check } from 'lucide-react';

interface SignatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (signatures: { payerSig: string | null; recipientSig: string | null }) => void;
  isExpense: boolean;
}

export default function SignatureDialog({ open, onOpenChange, onConfirm, isExpense }: SignatureDialogProps) {
  const { t } = useTranslation(['pettyCash', 'common']);
  const payerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const recipientCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [payerDrawn, setPayerDrawn] = useState(false);
  const [recipientDrawn, setRecipientDrawn] = useState(false);

  // Drawing state pointers
  const isDrawingPayer = useRef(false);
  const isDrawingRecipient = useRef(false);

  const initCanvas = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0f172a'; // Slate-900 / Dark color for signature ink
    }
  };

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        if (payerCanvasRef.current) initCanvas(payerCanvasRef.current);
        if (recipientCanvasRef.current) initCanvas(recipientCanvasRef.current);
      }, 100);
      setPayerDrawn(false);
      setRecipientDrawn(false);
    }
  }, [open]);

  // General draw handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>, canvasRef: React.RefObject<HTMLCanvasElement>, isDrawingRef: React.MutableRefObject<boolean>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    isDrawingRef.current = true;
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>, 
    canvasRef: React.RefObject<HTMLCanvasElement>, 
    isDrawingRef: React.MutableRefObject<boolean>, 
    setDrawn: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
      // Prevent scrolling when drawing on touch screens
      e.preventDefault();
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
    setDrawn(true);
  };

  const stopDrawing = (isDrawingRef: React.MutableRefObject<boolean>) => {
    isDrawingRef.current = false;
  };

  const clearCanvas = (canvasRef: React.RefObject<HTMLCanvasElement>, setDrawn: React.Dispatch<React.SetStateAction<boolean>>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setDrawn(false);
  };

  const handleConfirm = () => {
    const payerSig = payerDrawn && payerCanvasRef.current ? payerCanvasRef.current.toDataURL('image/png') : null;
    const recipientSig = recipientDrawn && recipientCanvasRef.current ? recipientCanvasRef.current.toDataURL('image/png') : null;
    onConfirm({ payerSig, recipientSig });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            {t('pettyCash:signature_dialog.title')}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {t('pettyCash:signature_dialog.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-3">
          {/* Payer Signature Box */}
          <div className="space-y-1.5 flex flex-col">
            <div className="flex justify-between items-center">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                {isExpense ? t('pettyCash:signature_dialog.payer_expense') : t('pettyCash:signature_dialog.payer_income')}
              </Label>
              {payerDrawn && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => clearCanvas(payerCanvasRef, setPayerDrawn)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <div className="border border-border/80 rounded-lg p-1 bg-background shadow-inner">
              <canvas
                ref={payerCanvasRef}
                width={280}
                height={140}
                className="w-full h-32 bg-slate-50 dark:bg-slate-900/50 rounded border border-dashed border-border/60 touch-none cursor-crosshair"
                onMouseDown={e => startDrawing(e, payerCanvasRef, isDrawingPayer)}
                onMouseMove={e => draw(e, payerCanvasRef, isDrawingPayer, setPayerDrawn)}
                onMouseUp={() => stopDrawing(isDrawingPayer)}
                onMouseLeave={() => stopDrawing(isDrawingPayer)}
                onTouchStart={e => startDrawing(e, payerCanvasRef, isDrawingPayer)}
                onTouchMove={e => draw(e, payerCanvasRef, isDrawingPayer, setPayerDrawn)}
                onTouchEnd={() => stopDrawing(isDrawingPayer)}
              />
            </div>
          </div>

          {/* Recipient Signature Box */}
          <div className="space-y-1.5 flex flex-col">
            <div className="flex justify-between items-center">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                {isExpense ? t('pettyCash:signature_dialog.recipient_expense') : t('pettyCash:signature_dialog.recipient_income')}
              </Label>
              {recipientDrawn && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => clearCanvas(recipientCanvasRef, setRecipientDrawn)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <div className="border border-border/80 rounded-lg p-1 bg-background shadow-inner">
              <canvas
                ref={recipientCanvasRef}
                width={280}
                height={140}
                className="w-full h-32 bg-slate-50 dark:bg-slate-900/50 rounded border border-dashed border-border/60 touch-none cursor-crosshair"
                onMouseDown={e => startDrawing(e, recipientCanvasRef, isDrawingRecipient)}
                onMouseMove={e => draw(e, recipientCanvasRef, isDrawingRecipient, setRecipientDrawn)}
                onMouseUp={() => stopDrawing(isDrawingRecipient)}
                onMouseLeave={() => stopDrawing(isDrawingRecipient)}
                onTouchStart={e => startDrawing(e, recipientCanvasRef, isDrawingRecipient)}
                onTouchMove={e => draw(e, recipientCanvasRef, isDrawingRecipient, setRecipientDrawn)}
                onTouchEnd={() => stopDrawing(isDrawingRecipient)}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('pettyCash:signature_dialog.cancel')}</Button>
          <Button
            onClick={handleConfirm}
            className="gap-1.5"
          >
            <Check className="h-4 w-4" /> {t('pettyCash:signature_dialog.generate_pdf')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
