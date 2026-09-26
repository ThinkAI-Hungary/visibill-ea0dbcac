import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  UtensilsCrossed,
  Hotel,
  Bus,
  Coffee,
  Download,
  Calculator,
  RotateCcw,
  Sparkles,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { VatFrequency } from '../types';

interface VatTourismTaxSectionProps {
  companyId: string;
  year: number;
  month: number;
  frequency: VatFrequency;
  selectedCompany?: any;
}

export function VatTourismTaxSection({
  companyId,
  year,
  month,
  frequency,
  selectedCompany,
}: VatTourismTaxSectionProps) {
  const { toast } = useToast();

  // GL accounts state for the 4 categories
  const [glEtkezohely, setGlEtkezohely] = useState(['9111', '9112', '']);
  const [glEtterem, setGlEtterem] = useState(['9121', '', '']);
  const [glSzallas, setGlSzallas] = useState(['9131', '', '']);
  const [glBusz, setGlBusz] = useState(['9141', '', '']);

  // Bases state
  const [baseEtkezohely, setBaseEtkezohely] = useState<number>(0);
  const [baseEtterem, setBaseEtterem] = useState<number>(0);
  const [baseSzallas, setBaseSzallas] = useState<number>(0);
  const [baseBusz, setBaseBusz] = useState<number>(0);

  // Compute period dates
  const { dateFrom, dateTo, periodLabel } = useMemo(() => {
    if (frequency === 'H') {
      const from = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { dateFrom: from, dateTo: to, periodLabel: `${year}. ${String(month).padStart(2, '0')}. hónap` };
    } else if (frequency === 'N') {
      const startMonth = (month - 1) * 3 + 1;
      const from = `${year}-${String(startMonth).padStart(2, '0')}-01`;
      const endMonth = startMonth + 2;
      const lastDay = new Date(year, endMonth, 0).getDate();
      const to = `${year}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { dateFrom: from, dateTo: to, periodLabel: `${year}. Q${month}` };
    } else {
      return { dateFrom: `${year}-01-01`, dateTo: `${year}-12-31`, periodLabel: `${year}. év` };
    }
  }, [year, month, frequency]);

  // Auto-populate / Feltölt from invoices or general ledger balances
  const handleAutoFill = async () => {
    try {
      // Fetch outbound invoices net amounts for 5% catering or accommodation
      const [navRes, subRes] = await Promise.all([
        supabase
          .from('nav_invoices')
          .select('id, invoice_number, invoice_net_amount, invoice_vat_amount, vat_row_override')
          .eq('company_id', companyId)
          .eq('invoice_direction', 'OUTBOUND')
          .or(`invoice_delivery_date.gte.${dateFrom},and(invoice_delivery_date.is.null,invoice_issue_date.gte.${dateFrom})`)
          .or(`invoice_delivery_date.lte.${dateTo},and(invoice_delivery_date.is.null,invoice_issue_date.lte.${dateTo})`),
        supabase
          .from('invoices')
          .select('id, bizonylatsorszam, adoalap_osszesen, afa_osszeg_osszesen, vat_row_override')
          .eq('company_id', companyId)
          .eq('invoice_direction', 'OUTBOUND')
          .or(`teljesites_datuma.gte.${dateFrom},and(teljesites_datuma.is.null,kibocsatas_datuma.gte.${dateFrom})`)
          .or(`teljesites_datuma.lte.${dateTo},and(teljesites_datuma.is.null,kibocsatas_datuma.lte.${dateTo})`),
      ]);

      const navInvs = navRes.data || [];
      const subInvs = subRes.data || [];

      const normalizeInvNum = (s?: string | null) => (s || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      const existingNavNumbers = new Set(navInvs.map((i) => normalizeInvNum(i.invoice_number)).filter(Boolean));
      const standaloneSubInvs = subInvs.filter((i) => !existingNavNumbers.has(normalizeInvNum(i.bizonylatsorszam)));

      let cateringNet = 0;

      navInvs.forEach((inv) => {
        const net = Math.round(Number(inv.invoice_net_amount) || 0);
        const vat = Math.round(Number(inv.invoice_vat_amount) || 0);
        const rate = net > 0 && vat > 0 ? Math.round((vat / net) * 100) : 0;
        if (rate === 5 || inv.vat_row_override === '05') {
          cateringNet += net;
        }
      });

      standaloneSubInvs.forEach((inv) => {
        const net = Math.round(Number(inv.adoalap_osszesen) || 0);
        const vat = Math.round(Number(inv.afa_osszeg_osszesen) || 0);
        const rate = net > 0 && vat > 0 ? Math.round((vat / net) * 100) : 0;
        if (rate === 5 || inv.vat_row_override === '05') {
          cateringNet += net;
        }
      });

      setBaseEtkezohely(cateringNet);
      toast({
        title: 'Adatok feltöltve',
        description: `Az időszak bizonylatai alapján ${formatCurrency(cateringNet)} összegű hozzájárulási alap került betöltésre.`,
      });
    } catch (e: any) {
      toast({
        title: 'Hiba a feltöltés során',
        description: e.message,
        variant: 'destructive',
      });
    }
  };

  // Calculations: Total base & 4% Tourism Contribution
  const totalBase = baseEtkezohely + baseEtterem + baseSzallas + baseBusz;
  const taxPayable = Math.round(totalBase * 0.04); // 4% törvényi kulcs

  // Export 26TFEJLH XML for ÁNYK
  const handleExportXml = () => {
    const taxNum = selectedCompany?.tax_number || '';
    const compName = selectedCompany?.name || '';

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<nyomtatvanyok xmlns="http://www.nav.gov.hu/ABEV/bekuldes">
  <nyomtatvany>
    <nyomtatvanyazonosito>${year % 100}TFEJLH</nyomtatvanyazonosito>
    <nyomtatvanyverzio>1.0</nyomtatvanyverzio>
    <fejlec>
      <idoszak>
        <tol>${dateFrom.replace(/-/g, '')}</tol>
        <ig>${dateTo.replace(/-/g, '')}</ig>
      </idoszak>
      <adozo>
        <adoszam>${taxNum.replace(/-/g, '')}</adoszam>
        <nev>${compName}</nev>
      </adozo>
    </fejlec>
    <mezok>
      <mezo nev="01_ALAP">${baseEtkezohely}</mezo>
      <mezo nev="02_ALAP">${baseEtterem}</mezo>
      <mezo nev="03_ALAP">${baseSzallas}</mezo>
      <mezo nev="04_ALAP">${baseBusz}</mezo>
      <mezo nev="OSSZES_ALAP">${totalBase}</mezo>
      <mezo nev="FIZETENDO_ADO_4SZAZALEK">${taxPayable}</mezo>
    </mezok>
  </nyomtatvany>
</nyomtatvanyok>`;

    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${year % 100}TFEJLH_${taxNum}_${year}_${month}.xml`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: '26TFEJLH ÁNYK XML letöltve',
      description: 'A bevallási állomány sikeresen exportálva lett.',
    });
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-xl border border-border/70 bg-card shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <h2 className="text-base font-bold tracking-tight text-foreground">
              Turizmusfejlesztési hozzájárulás bevallás (26TFEJLH)
            </h2>
            <Badge variant="outline" className="text-xs bg-muted">
              {periodLabel}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            A turizmusfejlesztési hozzájárulás (4%) számítása az étkezőhelyi vendéglátás, szálláshely-szolgáltatás és buszos személyszállítás forgalma után.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleAutoFill}
            variant="outline"
            size="sm"
            className="h-9 text-xs gap-1.5 font-semibold text-primary"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Feltöltés forgalomból
          </Button>
          <Button
            onClick={handleExportXml}
            disabled={totalBase === 0}
            size="sm"
            className="h-9 text-xs gap-1.5 font-semibold bg-primary"
          >
            <Download className="w-3.5 h-3.5" />
            26TFEJLH exportálás
          </Button>
        </div>
      </div>

      {/* Grid of the 4 statutory categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Category 1: Étkezőhelyi vendéglátás */}
        <Card className="border border-border/80 shadow-sm">
          <CardHeader className="py-3 px-4 bg-muted/20 border-b border-border/60">
            <CardTitle className="text-xs font-bold flex items-center gap-2 text-foreground">
              <UtensilsCrossed className="w-4 h-4 text-amber-600" />
              1. Étkezőhelyi étel- és helyben készített alkoholmentes italforgalom
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div>
              <Label className="text-[11px] text-muted-foreground">Hozzárendelt főkönyvi számlák:</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {glEtkezohely.map((acc, i) => (
                  <Input
                    key={i}
                    placeholder={`Számla ${i + 1}`}
                    value={acc}
                    onChange={(e) => {
                      const next = [...glEtkezohely];
                      next[i] = e.target.value;
                      setGlEtkezohely(next);
                    }}
                    className="h-8 text-xs font-mono"
                  />
                ))}
              </div>
            </div>

            <div>
              <Label className="text-[11px] font-semibold text-foreground">Hozzájárulás adóalapja (Ft):</Label>
              <Input
                type="number"
                value={baseEtkezohely || ''}
                placeholder="0"
                onChange={(e) => setBaseEtkezohely(Number(e.target.value) || 0)}
                className="h-9 text-sm font-mono font-bold mt-1 text-right"
              />
            </div>
          </CardContent>
        </Card>

        {/* Category 2: Étterem, cukrászda */}
        <Card className="border border-border/80 shadow-sm">
          <CardHeader className="py-3 px-4 bg-muted/20 border-b border-border/60">
            <CardTitle className="text-xs font-bold flex items-center gap-2 text-foreground">
              <Coffee className="w-4 h-4 text-amber-600" />
              2. Étterem, cukrászda vendéglátás
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div>
              <Label className="text-[11px] text-muted-foreground">Hozzárendelt főkönyvi számlák:</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {glEtterem.map((acc, i) => (
                  <Input
                    key={i}
                    placeholder={`Számla ${i + 1}`}
                    value={acc}
                    onChange={(e) => {
                      const next = [...glEtterem];
                      next[i] = e.target.value;
                      setGlEtterem(next);
                    }}
                    className="h-8 text-xs font-mono"
                  />
                ))}
              </div>
            </div>

            <div>
              <Label className="text-[11px] font-semibold text-foreground">Hozzájárulás adóalapja (Ft):</Label>
              <Input
                type="number"
                value={baseEtterem || ''}
                placeholder="0"
                onChange={(e) => setBaseEtterem(Number(e.target.value) || 0)}
                className="h-9 text-sm font-mono font-bold mt-1 text-right"
              />
            </div>
          </CardContent>
        </Card>

        {/* Category 3: Szálláshely-szolgáltatás */}
        <Card className="border border-border/80 shadow-sm">
          <CardHeader className="py-3 px-4 bg-muted/20 border-b border-border/60">
            <CardTitle className="text-xs font-bold flex items-center gap-2 text-foreground">
              <Hotel className="w-4 h-4 text-indigo-600" />
              3. Kereskedelmi szálláshely-szolgáltatás
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div>
              <Label className="text-[11px] text-muted-foreground">Hozzárendelt főkönyvi számlák:</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {glSzallas.map((acc, i) => (
                  <Input
                    key={i}
                    placeholder={`Számla ${i + 1}`}
                    value={acc}
                    onChange={(e) => {
                      const next = [...glSzallas];
                      next[i] = e.target.value;
                      setGlSzallas(next);
                    }}
                    className="h-8 text-xs font-mono"
                  />
                ))}
              </div>
            </div>

            <div>
              <Label className="text-[11px] font-semibold text-foreground">Hozzájárulás adóalapja (Ft):</Label>
              <Input
                type="number"
                value={baseSzallas || ''}
                placeholder="0"
                onChange={(e) => setBaseSzallas(Number(e.target.value) || 0)}
                className="h-9 text-sm font-mono font-bold mt-1 text-right"
              />
            </div>
          </CardContent>
        </Card>

        {/* Category 4: Menetrend szerinti buszos városnézés */}
        <Card className="border border-border/80 shadow-sm">
          <CardHeader className="py-3 px-4 bg-muted/20 border-b border-border/60">
            <CardTitle className="text-xs font-bold flex items-center gap-2 text-foreground">
              <Bus className="w-4 h-4 text-emerald-600" />
              4. Menetrend szerinti buszos városnéző szolgáltatás
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div>
              <Label className="text-[11px] text-muted-foreground">Hozzárendelt főkönyvi számlák:</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {glBusz.map((acc, i) => (
                  <Input
                    key={i}
                    placeholder={`Számla ${i + 1}`}
                    value={acc}
                    onChange={(e) => {
                      const next = [...glBusz];
                      next[i] = e.target.value;
                      setGlBusz(next);
                    }}
                    className="h-8 text-xs font-mono"
                  />
                ))}
              </div>
            </div>

            <div>
              <Label className="text-[11px] font-semibold text-foreground">Hozzájárulás adóalapja (Ft):</Label>
              <Input
                type="number"
                value={baseBusz || ''}
                placeholder="0"
                onChange={(e) => setBaseBusz(Number(e.target.value) || 0)}
                className="h-9 text-sm font-mono font-bold mt-1 text-right"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Footer Card */}
      <Card className="border-2 border-primary/30 bg-primary/5 shadow-md">
        <CardContent className="p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              26TFEJLH Bevallási Összesítő
            </p>
            <p className="text-sm text-foreground">
              A 4 jogcím szerinti összesített hozzájárulási alap és a 4%-os mértékű fizetendő hozzájárulás
            </p>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <span className="text-xs text-muted-foreground block">Összesített adóalap:</span>
              <span className="text-lg font-bold font-mono text-foreground">
                {formatCurrency(totalBase)}
              </span>
            </div>

            <div className="text-right pl-6 border-l border-primary/20">
              <span className="text-xs font-semibold text-primary block">Fizetendő hozzájárulás (4%):</span>
              <span className="text-2xl font-extrabold font-mono text-primary">
                {formatCurrency(taxPayable)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
