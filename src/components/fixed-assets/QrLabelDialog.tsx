import { useState, useRef, useMemo } from 'react';
import QRCode from 'react-qr-code';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { QrCode, Download, Printer, Barcode, Layers, Settings2, User, MapPin } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useScopedBasePath } from '@/lib/navigation';
import { generateCode128Svg } from '@/lib/fixed-assets/barcodeGenerator';
import type { FixedAsset } from '@/types/fixed-assets';
import { formatCustodianName } from '@/types/fixed-assets';

export type LabelFormat = '50x30' | '70x36' | 'a4_sheet';
export type CodeDisplayMode = 'hybrid' | 'qr' | 'barcode';

interface QrLabelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: FixedAsset;
  companyName?: string;
}

export function QrLabelDialog({ open, onOpenChange, asset, companyName }: QrLabelDialogProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const basePath = useScopedBasePath();

  const [labelFormat, setLabelFormat] = useState<LabelFormat>('70x36');
  const [codeMode, setCodeMode] = useState<CodeDisplayMode>('hybrid');
  const [showCustodian, setShowCustodian] = useState<boolean>(true);
  const [showLocation, setShowLocation] = useState<boolean>(true);
  const [showValue, setShowValue] = useState<boolean>(false);

  // QR payload: deep-link URL to the asset in the TENY page
  const qrUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${basePath}/teny?asset=${asset.id}`
    : '';

  // Generate Code128 SVG string
  const barcodeSvgRaw = useMemo(() => {
    return generateCode128Svg(asset.inventory_number || 'INV', {
      height: labelFormat === '50x30' ? 24 : 32,
      barWidth: labelFormat === '50x30' ? 1.2 : 1.5,
      quietZone: 6,
      includeText: codeMode === 'barcode', // if barcode only, show the text underneath
      fontSize: 10,
    });
  }, [asset.inventory_number, labelFormat, codeMode]);

  const locationText = useMemo(() => {
    const parts: string[] = [];
    if (asset.location?.name) parts.push(asset.location.name);
    if (asset.sub_location?.name) parts.push(asset.sub_location.name);
    return parts.join(' → ');
  }, [asset.location, asset.sub_location]);

  const custodianText = formatCustodianName(asset.custodian) || null;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const esc = (s: unknown): string => String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    const labelHtml = (isSmall = false) => `
      <div class="label-card ${isSmall ? 'small' : ''}">
        <div class="label-header">
          <span class="company-name">${esc(companyName || 'TÁRGYI ESZKÖZ')}</span>
          <span class="inv-badge">${esc(asset.inventory_number)}</span>
        </div>
        <div class="label-body">
          ${codeMode !== 'barcode' ? `
            <div class="qr-col">
              <img src="https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrUrl)}&size=150x150" alt="QR" class="qr-img" />
            </div>
          ` : ''}
          <div class="info-col">
            <div class="asset-title">${esc(asset.name)}</div>
            ${showLocation && locationText ? `<div class="meta-row">📍 ${esc(locationText)}</div>` : ''}
            ${showCustodian && custodianText ? `<div class="meta-row">👤 ${esc(custodianText)}</div>` : ''}
            ${showValue ? `<div class="meta-row font-mono">${esc(formatCurrency(asset.acquisition_value, asset.currency))}</div>` : ''}
          </div>
        </div>
        ${codeMode !== 'qr' ? `
          <div class="barcode-footer">
            ${barcodeSvgRaw}
          </div>
        ` : ''}
      </div>
    `;

    let contentHtml = '';
    let pageCss = '';

    if (labelFormat === '50x30') {
      pageCss = `
        @page { size: 50mm 30mm; margin: 0; }
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .label-card { width: 48mm; height: 28mm; padding: 1mm 1.5mm; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; page-break-after: always; }
        .label-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 0.5px solid #000; padding-bottom: 1px; font-size: 7px; font-weight: bold; }
        .label-body { display: flex; gap: 4px; align-items: center; flex: 1; min-height: 0; }
        .qr-img { width: 14mm; height: 14mm; object-fit: contain; }
        .info-col { flex: 1; font-size: 7px; line-height: 1.1; overflow: hidden; }
        .asset-title { font-weight: bold; font-size: 7.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .meta-row { color: #333; font-size: 6.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px; }
        .barcode-footer { text-align: center; max-height: 8mm; overflow: hidden; }
        .barcode-footer svg { width: 100%; height: 8mm; max-height: 8mm; }
      `;
      contentHtml = labelHtml(true);
    } else if (labelFormat === '70x36') {
      pageCss = `
        @page { size: 70mm 36mm; margin: 0; }
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .label-card { width: 68mm; height: 34mm; padding: 2mm 2.5mm; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; page-break-after: always; }
        .label-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #111; padding-bottom: 1.5px; font-size: 8.5px; font-weight: bold; }
        .company-name { text-transform: uppercase; color: #1a2a44; letter-spacing: 0.5px; }
        .inv-badge { font-family: monospace; font-size: 9px; }
        .label-body { display: flex; gap: 6px; align-items: center; flex: 1; margin: 2px 0; }
        .qr-img { width: 17mm; height: 17mm; object-fit: contain; }
        .info-col { flex: 1; font-size: 8px; line-height: 1.25; overflow: hidden; }
        .asset-title { font-weight: bold; font-size: 9px; color: #000; margin-bottom: 1.5px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .meta-row { color: #444; font-size: 7.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .barcode-footer { text-align: center; }
        .barcode-footer svg { width: 90%; height: 9mm; max-height: 9mm; }
      `;
      contentHtml = labelHtml(false);
    } else {
      // A4 Sheet: 3 columns x 8 rows = 24 labels (70 x 36 mm standard Avery / Herma layout)
      pageCss = `
        @page { size: A4; margin: 10mm 5mm; }
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .sheet-grid { display: grid; grid-template-columns: repeat(3, 68mm); grid-auto-rows: 34mm; gap: 2mm 2mm; justify-content: center; }
        .label-card { width: 68mm; height: 34mm; border: 0.5px dashed #ccc; padding: 2mm 2.5mm; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; }
        .label-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #111; padding-bottom: 1.5px; font-size: 8px; font-weight: bold; }
        .company-name { text-transform: uppercase; color: #1a2a44; }
        .inv-badge { font-family: monospace; font-size: 8.5px; }
        .label-body { display: flex; gap: 5px; align-items: center; flex: 1; margin: 1.5px 0; }
        .qr-img { width: 16mm; height: 16mm; object-fit: contain; }
        .info-col { flex: 1; font-size: 7.5px; line-height: 1.2; overflow: hidden; }
        .asset-title { font-weight: bold; font-size: 8.5px; color: #000; margin-bottom: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .meta-row { color: #444; font-size: 7px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .barcode-footer { text-align: center; }
        .barcode-footer svg { width: 90%; height: 8mm; max-height: 8mm; }
        @media print {
          .label-card { border: none; }
        }
      `;
      const labels = Array.from({ length: 24 }).map(() => labelHtml(false)).join('');
      contentHtml = `<div class="sheet-grid">${labels}</div>`;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Címke - ${esc(asset.inventory_number)}</title>
        <style>${pageCss}</style>
      </head>
      <body>
        ${contentHtml}
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 400);
  };

  const handleDownloadSvgBarcode = () => {
    const blob = new Blob([barcodeSvgRaw], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `barcode-${asset.inventory_number.replace(/\s/g, '_')}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <QrCode className="h-5 w-5 text-primary" />
            Eszköz Címke és Vonalkód Generátor
          </DialogTitle>
          <DialogDescription>
            Ipari hibrid címke (QR és Code128 vonalkód) nyomtatása thermo címkenyomtatóra vagy A4 ívre.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Formátum és Kód típus vezérlők */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" />
                Címke méret & Formátum
              </Label>
              <Tabs value={labelFormat} onValueChange={(v) => setLabelFormat(v as LabelFormat)} className="w-full">
                <TabsList className="grid grid-cols-3 h-8 text-xs w-full">
                  <TabsTrigger value="50x30" className="text-xs px-1">50×30 mm</TabsTrigger>
                  <TabsTrigger value="70x36" className="text-xs px-1">70×36 mm</TabsTrigger>
                  <TabsTrigger value="a4_sheet" className="text-xs px-1">A4 Ív (24)</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Barcode className="h-3.5 w-3.5" />
                Kód megjelenítés
              </Label>
              <Tabs value={codeMode} onValueChange={(v) => setCodeMode(v as CodeDisplayMode)} className="w-full">
                <TabsList className="grid grid-cols-3 h-8 text-xs w-full">
                  <TabsTrigger value="hybrid" className="text-xs px-1">Hibrid</TabsTrigger>
                  <TabsTrigger value="qr" className="text-xs px-1">Csak QR</TabsTrigger>
                  <TabsTrigger value="barcode" className="text-xs px-1">Vonalkód</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          {/* Testreszabási kapcsolók */}
          <div className="flex flex-wrap items-center gap-4 p-2.5 rounded-lg bg-muted/40 border border-border/60 text-xs">
            <span className="font-semibold text-muted-foreground flex items-center gap-1">
              <Settings2 className="h-3.5 w-3.5" />
              Opciók:
            </span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <Switch checked={showLocation} onCheckedChange={setShowLocation} className="scale-75" />
              <span>Telephely / Hely</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <Switch checked={showCustodian} onCheckedChange={setShowCustodian} className="scale-75" />
              <span>Felelős dolgozó</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <Switch checked={showValue} onCheckedChange={setShowValue} className="scale-75" />
              <span>Érték (Ft)</span>
            </label>
          </div>

          {/* Címke Előnézet (Live Preview) */}
          <div className="flex justify-center p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-border">
            <div
              ref={printRef}
              className={`bg-white text-slate-900 shadow-md rounded border border-slate-300 flex flex-col justify-between transition-all ${
                labelFormat === '50x30' ? 'w-[320px] min-h-[190px] p-3' : 'w-[400px] min-h-[220px] p-4'
              }`}
            >
              {/* Címke fejléc */}
              <div className="flex justify-between items-center border-b border-slate-900 pb-1 text-xs">
                <span className="font-bold tracking-wide uppercase text-slate-700 text-[10px]">
                  {companyName || 'TÁRGYI ESZKÖZ'}
                </span>
                <span className="font-mono font-bold text-slate-900 text-[11px] bg-slate-100 px-1 rounded">
                  {asset.inventory_number}
                </span>
              </div>

              {/* Középső blokk: QR és adatok */}
              <div className="flex items-center gap-3 my-2 flex-1">
                {codeMode !== 'barcode' && (
                  <div className="flex-shrink-0 bg-white p-1 rounded border border-slate-200">
                    <QRCode
                      value={qrUrl || asset.inventory_number}
                      size={labelFormat === '50x30' ? 68 : 84}
                      level="M"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0 space-y-1">
                  <h4 className="font-bold text-xs text-slate-900 line-clamp-2 leading-tight">
                    {asset.name}
                  </h4>
                  {showLocation && locationText && (
                    <p className="text-[11px] text-slate-600 flex items-center gap-1 truncate">
                      <MapPin className="h-3 w-3 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{locationText}</span>
                    </p>
                  )}
                  {showCustodian && custodianText && (
                    <p className="text-[11px] text-slate-600 flex items-center gap-1 truncate">
                      <User className="h-3 w-3 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{custodianText}</span>
                    </p>
                  )}
                  {showValue && (
                    <p className="text-[10px] font-mono font-semibold text-slate-700">
                      {formatCurrency(asset.acquisition_value, asset.currency)}
                    </p>
                  )}
                </div>
              </div>

              {/* Alsó blokk: Code128 lineáris vonalkód */}
              {codeMode !== 'qr' && (
                <div
                  className="flex justify-center pt-1 border-t border-slate-100 overflow-hidden"
                  dangerouslySetInnerHTML={{ __html: barcodeSvgRaw }}
                />
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadSvgBarcode}
            className="gap-2 sm:mr-auto"
          >
            <Download className="h-4 w-4" />
            Vonalkód SVG mentés
          </Button>

          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Mégse
          </Button>

          <Button size="sm" onClick={handlePrint} className="gap-2 bg-primary text-primary-foreground">
            <Printer className="h-4 w-4" />
            Címke Nyomtatása {labelFormat === 'a4_sheet' ? '(A4 ív)' : `(${labelFormat})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
