import React, { useState } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  FileText,
  Printer,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCw,
  UserCheck,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { Nav2665PageFrame } from './Nav2665PageFrame';
import { Nav26TfejlhSheetFolap } from './Nav26TfejlhSheetFolap';
import { generateTfejlhPdf } from '@/lib/tfejlhPdf';

export interface Nav26TfejlhReplicaContainerProps {
  selectedCompany?: any;
  year: number;
  month: number;
  frequency: string; // 'H' | 'N' | 'E'
  baseEtkezohely: number;
  baseEtterem: number;
  baseSzallas: number;
  baseBusz: number;
  initialAgentName?: string;
  initialAgentPhone?: string;
  onExportXml?: () => void;
}

export function Nav26TfejlhReplicaContainer({
  selectedCompany,
  year,
  month,
  frequency,
  baseEtkezohely,
  baseEtterem,
  baseSzallas,
  baseBusz,
  initialAgentName = '',
  initialAgentPhone = '',
  onExportXml,
}: Nav26TfejlhReplicaContainerProps) {
  const { toast } = useToast();
  const formCode = `${year % 100}TFEJLH`;

  // Zoom level state (80% - 120%)
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // Agent name and phone customization state
  const [agentName, setAgentName] = useState<string>(
    initialAgentName || selectedCompany?.representative_name || ''
  );
  const [agentPhone, setAgentPhone] = useState<string>(
    initialAgentPhone || selectedCompany?.phone || ''
  );
  const [isAgentDialogOpen, setIsAgentDialogOpen] = useState<boolean>(false);

  // Self-revision state
  const [isSelfRevision, setIsSelfRevision] = useState<boolean>(false);
  const [isRepeatedSelfRevision, setIsRepeatedSelfRevision] = useState<boolean>(false);
  const [selfRevisionTaxDiff, setSelfRevisionTaxDiff] = useState<number>(0);
  const [selfRevisionSurcharge, setSelfRevisionSurcharge] = useState<number>(0);
  const [isRevisionDialogOpen, setIsRevisionDialogOpen] = useState<boolean>(false);

  // Calculations
  const totalBase = baseEtkezohely + baseEtterem + baseSzallas + baseBusz;
  const taxPayable = Math.round(totalBase * 0.04);

  // Handle native browser print
  const handlePrint = () => {
    window.print();
  };

  // Handle standalone PDF report export
  const handleDownloadPdf = () => {
    try {
      generateTfejlhPdf({
        companyName: selectedCompany?.name || 'Vállalkozás',
        companyTaxNumber: selectedCompany?.tax_number || '',
        year,
        month,
        frequency,
        baseEtkezohely,
        baseEtterem,
        baseSzallas,
        baseBusz,
        agentName,
        agentPhone,
        isSelfRevision,
        isRepeatedSelfRevision,
        selfRevisionTaxDiff,
        selfRevisionSurcharge,
      });
      toast({
        title: '26TFEJLH PDF nyomtatási nézet elindítva',
        description: 'Az A4 formátumhű dokumentum új ablakban megnyílt.',
      });
    } catch (e: any) {
      toast({
        title: 'Hiba a PDF generálás során',
        description: e.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. TOP CONTROL TOOLBAR */}
      <Card className="border border-border/80 shadow-sm print:hidden">
        <CardHeader className="py-3 px-4 bg-muted/20 border-b border-border/60">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Title & Badges */}
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <FileText className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <h3 className="font-bold text-sm tracking-tight text-foreground">
                  NAV {formCode} Hivatalos Nyomtatvány Hiteles Replika
                </h3>
                <Badge variant="outline" className="text-xs bg-background font-mono">
                  {year}. {frequency === 'H' ? `${month}. hó` : frequency === 'N' ? `Q${month}` : 'év'}
                </Badge>
                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300/40 text-xs font-semibold">
                  Hozzájárulás (4%): {formatCurrency(taxPayable)}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Nemzeti Adó- és Vámhivatal {formCode} Turizmusfejlesztési hozzájárulás nyomtatvány A4 szimulációja.
              </p>
            </div>

            {/* Actions Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Zoom Controls */}
              <div className="flex items-center border border-border/70 rounded-md bg-background px-1 py-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={zoomLevel <= 70}
                  onClick={() => setZoomLevel((z) => Math.max(z - 10, 70))}
                  title="Kicsinyítés"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </Button>
                <span className="text-[11px] font-mono font-medium px-2 min-w-[42px] text-center">
                  {zoomLevel}%
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={zoomLevel >= 130}
                  onClick={() => setZoomLevel((z) => Math.min(z + 10, 130))}
                  title="Nagyítás"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => setZoomLevel(100)}
                  title="Alaphelyzet (100%)"
                >
                  <RotateCw className="w-3 h-3" />
                </Button>
              </div>

              {/* Ügyintéző adatok dialog */}
              <Dialog open={isAgentDialogOpen} onOpenChange={setIsAgentDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 font-medium">
                    <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                    Ügyintéző adatai
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-sm font-bold flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-blue-600" />
                      (B) Rovat — Ügyintéző adatai
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 py-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Ügyintéző neve</Label>
                      <Input
                        placeholder="Pl. Jámbor Viktor"
                        value={agentName}
                        onChange={(e) => setAgentName(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Ügyintéző telefonszáma</Label>
                      <Input
                        placeholder="Pl. 36704240024"
                        value={agentPhone}
                        onChange={(e) => setAgentPhone(e.target.value)}
                        className="text-xs font-mono"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button size="sm" onClick={() => setIsAgentDialogOpen(false)} className="text-xs">
                      Alkalmazás
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Önellenőrzés beállítás dialog */}
              <Dialog open={isRevisionDialogOpen} onOpenChange={setIsRevisionDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant={isSelfRevision ? 'default' : 'outline'}
                    size="sm"
                    className={`h-8 text-xs gap-1.5 font-medium ${isSelfRevision ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}`}
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    {isSelfRevision ? 'Önellenőrzés aktív' : 'Önellenőrzés (E)'}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-sm font-bold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      (E) Rovat — Önellenőrzés beállításai
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">Önellenőrzés bekapcsolása</Label>
                      <Switch checked={isSelfRevision} onCheckedChange={setIsSelfRevision} />
                    </div>

                    {isSelfRevision && (
                      <div className="space-y-3 pt-2 border-t border-border/60">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Ismételt önellenőrzés</Label>
                          <Switch
                            checked={isRepeatedSelfRevision}
                            onCheckedChange={setIsRepeatedSelfRevision}
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">11. sor: Adókötelezettség változása (+/-) Ft</Label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={selfRevisionTaxDiff || ''}
                            onChange={(e) => setSelfRevisionTaxDiff(Number(e.target.value))}
                            className="text-xs font-mono"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">12. sor: Önellenőrzési pótlék összege Ft</Label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={selfRevisionSurcharge || ''}
                            onChange={(e) => setSelfRevisionSurcharge(Number(e.target.value))}
                            className="text-xs font-mono"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button size="sm" onClick={() => setIsRevisionDialogOpen(false)} className="text-xs">
                      Kész
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Nyomtatás / PDF mentés */}
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="h-8 text-xs gap-1.5 font-semibold"
                title="Böngészős nyomtatás vagy PDF mentés A4 oldalakkal"
              >
                <Printer className="w-3.5 h-3.5 text-neutral-700 dark:text-neutral-300" />
                Nyomtatás / PDF
              </Button>

              {/* Közvetlen PDF letöltés */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPdf}
                className="h-8 text-xs gap-1.5 font-semibold text-primary"
                title="Formátumhű A4 PDF riport letöltése"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-red-600" />
                PDF riport
              </Button>

              {/* ÁNYK XML Export */}
              {onExportXml && (
                <Button
                  size="sm"
                  onClick={onExportXml}
                  className="h-8 text-xs gap-1.5 font-semibold bg-primary"
                  title="26TFEJLH ÁNYK XML letöltése"
                >
                  <Download className="w-3.5 h-3.5" />
                  ÁNYK XML
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* 2. REPLICA A4 PAPER CONTAINER */}
      <div className="w-full overflow-x-auto pb-8 print:p-0 print:overflow-visible">
        <div
          style={{
            transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : undefined,
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease-out',
          }}
          className="print:transform-none"
        >
          <Nav2665PageFrame
            sheetCode={formCode}
            sheetTitle="BEVALLÁS a turizmusfejlesztési hozzájárulásról"
            taxNumber={selectedCompany?.tax_number}
            pageNumber={1}
            totalPages={1}
            className="my-2"
          >
            <Nav26TfejlhSheetFolap
              selectedCompany={selectedCompany}
              year={year}
              month={month}
              frequency={frequency}
              baseEtkezohely={baseEtkezohely}
              baseEtterem={baseEtterem}
              baseSzallas={baseSzallas}
              baseBusz={baseBusz}
              agentName={agentName}
              agentPhone={agentPhone}
              isSelfRevision={isSelfRevision}
              isRepeatedSelfRevision={isRepeatedSelfRevision}
              selfRevisionTaxDiff={selfRevisionTaxDiff}
              selfRevisionSurcharge={selfRevisionSurcharge}
            />
          </Nav2665PageFrame>
        </div>
      </div>
    </div>
  );
}
