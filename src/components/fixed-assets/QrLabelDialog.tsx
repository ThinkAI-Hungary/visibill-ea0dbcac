import { useRef } from 'react';
import QRCode from 'react-qr-code';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { QrCode, Download, Printer } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useScopedBasePath } from '@/lib/navigation';
import type { FixedAsset } from '@/types/fixed-assets';

interface QrLabelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: FixedAsset;
}

export function QrLabelDialog({ open, onOpenChange, asset }: QrLabelDialogProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const basePath = useScopedBasePath();

  // QR payload: deep-link URL to the asset in the TENY page
  const qrUrl = `${window.location.origin}${basePath}/teny?asset=${asset.id}`;

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head><title>Eszköz Címke - ${asset.inventory_number}</title>
      <style>
        body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
        .label { border: 2px solid #000; padding: 20px; text-align: center; width: 300px; }
        .label h3 { margin: 12px 0 4px; font-size: 14px; }
        .label p { margin: 2px 0; font-size: 11px; color: #555; }
        .label .inv { font-family: monospace; font-size: 12px; font-weight: bold; margin-top: 8px; letter-spacing: 1px; }
        @media print { body { margin: 0; } }
      </style>
      </head>
      <body>
        <div class="label">
          ${printRef.current.querySelector('.qr-svg-container')?.innerHTML || ''}
          <h3>${asset.name}</h3>
          <p class="inv">${asset.inventory_number}</p>
          <p>${asset.location?.name || ''}</p>
          <p>Érték: ${formatCurrency(asset.acquisition_value, asset.currency)}</p>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  const handleDownloadSvg = () => {
    const svgEl = printRef.current?.querySelector('svg');
    if (!svgEl) return;

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgEl);
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `qr-${asset.inventory_number.replace(/\s/g, '_')}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            Eszköz Címke
          </DialogTitle>
          <DialogDescription>
            QR címke nyomtatása vagy letöltése.
          </DialogDescription>
        </DialogHeader>

        <div ref={printRef} className="py-6">
          {/* Label preview */}
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center space-y-3">
            <div className="qr-svg-container flex justify-center">
              <QRCode
                value={qrUrl}
                size={160}
                level="M"
                bgColor="transparent"
                fgColor="currentColor"
              />
            </div>
            <div>
              <h3 className="font-bold text-base">{asset.name}</h3>
              <p className="font-mono text-sm text-muted-foreground tracking-wider">{asset.inventory_number}</p>
              {asset.location?.name && (
                <p className="text-xs text-muted-foreground mt-1">{asset.location.name}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {formatCurrency(asset.acquisition_value, asset.currency)}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleDownloadSvg} className="gap-2 flex-1">
            <Download className="h-4 w-4" />
            SVG letöltés
          </Button>
          <Button onClick={handlePrint} className="gap-2 flex-1">
            <Printer className="h-4 w-4" />
            Nyomtatás
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
