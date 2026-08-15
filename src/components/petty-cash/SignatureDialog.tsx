import React, { useRef, useState, useEffect } from 'react';
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
    setDrawn: (d: boolean) => void
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

  const clearCanvas = (canvasRef: React.RefObject<HTMLCanvasElement>, setDrawn: (d: boolean) => void) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setDrawn(false);
  };

  const handleGenerate = () => {
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
            Digitális Aláírás a Bizonylathoz
          </DialogTitle>
          <DialogDescription className="text-xs">
            Rajzold le a kifizető és átvevő aláírását a lenti paneleken. Az aláírások bekerülnek a generált PDF bizonylatba.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-3">
          {/* Payer Signature Box */}
          <div className="space-y-1.5 flex flex-col">
            <div className="flex justify-between items-center">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                {isExpense ? 'Kifizető / Pénztáros' : 'Befizető / Pénztáros'}
              </Label>
              {payerDrawn && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-destructive hover:bg-destructive/10"
                  onClick={() => clearCanvas(payerCanvasRef, setPayerDrawn)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
            <div className="border border-border/60 rounded-lg overflow-hidden bg-muted/15 flex items-center justify-center">
              <canvas
                ref={payerCanvasRef}
                width={250}
                height={120}
                className="w-full bg-transparent cursor-crosshair touch-none"
                onMouseDown={(e) => startDrawing(e, payerCanvasRef, isDrawingPayer)}
                onMouseMove={(e) => draw(e, payerCanvasRef, isDrawingPayer, setPayerDrawn)}
                onMouseUp={() => stopDrawing(isDrawingPayer)}
                onMouseLeave={() => stopDrawing(isDrawingPayer)}
                onTouchStart={(e) => startDrawing(e, payerCanvasRef, isDrawingPayer)}
                onTouchMove={(e) => draw(e, payerCanvasRef, isDrawingPayer, setPayerDrawn)}
                onTouchEnd={() => stopDrawing(isDrawingPayer)}
              />
            </div>
          </div>

          {/* Recipient Signature Box */}
          <div className="space-y-1.5 flex flex-col">
            <div className="flex justify-between items-center">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                {isExpense ? 'Kedvezményezett / Átvevő' : 'Átvevő / Munkatárs'}
              </Label>
              {recipientDrawn && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-destructive hover:bg-destructive/10"
                  onClick={() => clearCanvas(recipientCanvasRef, setRecipientDrawn)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
            <div className="border border-border/60 rounded-lg overflow-hidden bg-muted/15 flex items-center justify-center">
              <canvas
                ref={recipientCanvasRef}
                width={250}
                height={120}
                className="w-full bg-transparent cursor-crosshair touch-none"
                onMouseDown={(e) => startDrawing(e, recipientCanvasRef, isDrawingRecipient)}
                onMouseMove={(e) => draw(e, recipientCanvasRef, isDrawingRecipient, setRecipientDrawn)}
                onMouseUp={() => stopDrawing(isDrawingRecipient)}
                onMouseLeave={() => stopDrawing(isDrawingRecipient)}
                onTouchStart={(e) => startDrawing(e, recipientCanvasRef, isDrawingRecipient)}
                onTouchMove={(e) => draw(e, recipientCanvasRef, isDrawingRecipient, setRecipientDrawn)}
                onTouchEnd={() => stopDrawing(isDrawingRecipient)}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-border/20 pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Mégse</Button>
          <Button 
            onClick={handleGenerate}
            className="bg-primary hover:bg-primary/95 text-primary-foreground gap-1.5 font-semibold"
          >
            <Check className="h-4 w-4" /> PDF Generálása
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
