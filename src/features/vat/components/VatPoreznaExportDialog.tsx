import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  Download,
  FileSpreadsheet,
  Building2,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import {
  downloadPdvSXml,
  downloadZpXml,
  parseCroatianAddress,
  type CroatianEuStatementsData,
  type CroatianPreparerInfo,
  type CroatianCompanyTaxInfo,
} from '@/lib/croatianPoreznaXml';
import { fmtEur } from '../types';

interface VatPoreznaExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCompany: any;
  year: number;
  month: number;
  frequency: string;
}

export function VatPoreznaExportDialog({
  open,
  onOpenChange,
  selectedCompany,
  year,
  month,
  frequency,
}: VatPoreznaExportDialogProps) {
  const { t, i18n } = useTranslation(['accounting', 'common']);
  const { toast } = useToast();
  const isHr = i18n.language === 'hr';

  const companyId = selectedCompany?.id;
  const storageKey = `porezna_preparer_${companyId}`;

  // 1. Preparer & Tax Office state with localStorage persistence
  const [preparer, setPreparer] = useState<CroatianPreparerInfo>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) return JSON.parse(saved);
      } catch {
        // Fallback below
      }
    }
    return {
      firstName: 'Laura',
      lastName: 'Gergelj',
      phone: '+385957266641',
      email: 'mobilnost385@gmail.com',
      ispostava: '3301',
    };
  });

  const parsedAddress = useMemo(() => {
    return parseCroatianAddress(selectedCompany?.address);
  }, [selectedCompany?.address]);

  const [companyAddress, setCompanyAddress] = useState<CroatianCompanyTaxInfo>({
    name: selectedCompany?.name || 'D-INVOICE D.O.O',
    oib: (selectedCompany as any)?.tax_number || '95114485977',
    address: selectedCompany?.address || '',
    city: parsedAddress.city || 'DARDA',
    street: parsedAddress.street || 'SV. IVANA KRSTITELJA',
    houseNumber: parsedAddress.houseNumber || '15',
  });

  // Sync state if company changes
  useEffect(() => {
    if (selectedCompany) {
      const parsed = parseCroatianAddress(selectedCompany.address);
      setCompanyAddress({
        name: selectedCompany.name || '',
        oib: (selectedCompany as any).tax_number || '',
        address: selectedCompany.address || '',
        city: parsed.city || 'DARDA',
        street: parsed.street || 'SV. IVANA KRSTITELJA',
        houseNumber: parsed.houseNumber || '15',
      });
    }
  }, [selectedCompany]);

  // Persist preparer changes
  const updatePreparer = (field: keyof CroatianPreparerInfo, val: string) => {
    setPreparer((prev) => {
      const next = { ...prev, [field]: val };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  // 2. Query statements data from RPC
  const {
    data: rpcResult,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['croatian_eu_vat_statements', companyId, year, month, frequency],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase.rpc('get_croatian_eu_vat_statements', {
        p_company_id: companyId,
        p_year: year,
        p_month: month,
        p_frequency: frequency,
      });

      if (error) {
        throw error;
      }
      return data as any;
    },
    enabled: open && !!companyId,
    staleTime: 30_000,
  });

  const pdvSItems = rpcResult?.pdv_s?.items || [];
  const pdvSTotals = rpcResult?.pdv_s?.totals || { i1: 0, i2: 0, total: 0 };

  const zpItems = rpcResult?.zp?.items || [];
  const zpTotals = rpcResult?.zp?.totals || { i1: 0, i2: 0, i3: 0, i4: 0, total: 0 };

  const statementsData: CroatianEuStatementsData = useMemo(() => {
    return {
      company: companyAddress,
      periodYear: year,
      periodMonth: month,
      frequency,
      dateFrom: rpcResult?.date_from || `${year}-${String(month).padStart(2, '0')}-01`,
      dateTo: rpcResult?.date_to || `${year}-${String(month).padStart(2, '0')}-31`,
      preparer,
      pdv_s: {
        items: pdvSItems,
        totals: pdvSTotals,
      },
      zp: {
        items: zpItems,
        totals: zpTotals,
      },
    };
  }, [companyAddress, year, month, frequency, rpcResult, preparer, pdvSItems, pdvSTotals, zpItems, zpTotals]);

  // Export handlers
  const handleDownloadPdvS = () => {
    try {
      const filename = `HR_PDV-S_${String(month).padStart(2, '0')}.${year}.xml`;
      downloadPdvSXml(statementsData, filename);
      toast({
        title: isHr ? 'Obrazac PDV-S preuzet' : 'PDV-S XML sikeresen letöltve',
        description: isHr
          ? `Datoteka ${filename} je uspješno generirana prema shemi v1-0.`
          : `A ${filename} fájl elkészült a hivatalos Porezna uprava v1-0 séma szerint.`,
      });
    } catch (err: any) {
      toast({
        title: isHr ? 'Greška pri generiranju' : 'Generálási hiba',
        description: err?.message || 'Hiba történt az XML előállítása közben.',
        variant: 'destructive',
      });
    }
  };

  const handleDownloadZp = () => {
    try {
      const filename = `HR_ZP_${String(month).padStart(2, '0')}.${year}.xml`;
      downloadZpXml(statementsData, filename);
      toast({
        title: isHr ? 'Obrazac ZP preuzet' : 'ZP XML sikeresen letöltve',
        description: isHr
          ? `Datoteka ${filename} je uspješno generirana prema shemi v1-0.`
          : `A ${filename} fájl elkészült a hivatalos Porezna uprava v1-0 séma szerint.`,
      });
    } catch (err: any) {
      toast({
        title: isHr ? 'Greška pri generiranju' : 'Generálási hiba',
        description: err?.message || 'Hiba történt az XML előállítása közben.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60 shrink-0 bg-muted/20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <span>ePorezna XML Export (Obrazac PDV-S & Obrazac ZP)</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1">
                {isHr
                  ? 'Elektronički obrasci za Poreznu upravu unutar EU (Stjecanje dobara i usluga / Zbirna prijava)'
                  : 'Hivatalos horvát adóhatósági elektronikus nyomtatványok az EU-s ügyletek összesítéséhez'}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className="text-xs font-mono bg-background border-border/80">
                {year}/{String(month).padStart(2, '0')}
              </Badge>
              <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-xs">
                Hrvatska (HR)
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-xs font-medium">
                {isHr ? 'Učitavanje podataka iz baze...' : 'EU ügyletek aggregálása és adatok betöltése...'}
              </p>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-12 text-destructive space-y-3 text-center">
              <AlertCircle className="w-8 h-8" />
              <p className="text-sm font-semibold">
                {isHr ? 'Greška pri dohvaćanju podataka' : 'Hiba történt az adatok lekérdezésekor'}
              </p>
              <Button size="sm" variant="outline" onClick={() => refetch()}>
                {isHr ? 'Pokušaj ponovno' : 'Újrapróbálás'}
              </Button>
            </div>
          ) : (
            <Tabs defaultValue="pdv-s" className="space-y-4">
              <TabsList className="grid w-full grid-cols-3 bg-muted/60 p-1">
                <TabsTrigger value="pdv-s" className="text-xs font-semibold gap-1.5">
                  <ArrowDownLeft className="w-3.5 h-3.5 text-blue-500" />
                  <span>Obrazac PDV-S</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ml-1">
                    {pdvSItems.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="zp" className="text-xs font-semibold gap-1.5">
                  <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Obrazac ZP</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ml-1">
                    {zpItems.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="preparer" className="text-xs font-semibold gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{isHr ? 'Sastavljač & Ispostava' : 'Beadó & Kirendeltség'}</span>
                </TabsTrigger>
              </TabsList>

              {/* TAB 1: PDV-S (Inbound EU Acquisitions & Received Services) */}
              <TabsContent value="pdv-s" className="space-y-4 outline-none">
                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Card className="border-border/60 bg-muted/20">
                    <CardContent className="p-3">
                      <div className="text-[11px] font-medium text-muted-foreground">
                        I1. Stjecanje dobara (Termék)
                      </div>
                      <div className="text-sm font-bold mt-1 text-foreground">
                        {fmtEur(pdvSTotals.i1)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-border/60 bg-muted/20">
                    <CardContent className="p-3">
                      <div className="text-[11px] font-medium text-muted-foreground">
                        I2. Primljene usluge (Szolgáltatás)
                      </div>
                      <div className="text-sm font-bold mt-1 text-foreground">
                        {fmtEur(pdvSTotals.i2)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-border/60 bg-blue-500/5 border-blue-500/20">
                    <CardContent className="p-3">
                      <div className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
                        Ukupno (Összesen)
                      </div>
                      <div className="text-sm font-bold mt-1 text-blue-700 dark:text-blue-300">
                        {fmtEur(pdvSTotals.total)}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Table */}
                <Card className="border-border/60 overflow-hidden">
                  <div className="p-3 border-b border-border/60 flex items-center justify-between bg-muted/30">
                    <div className="text-xs font-semibold flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 text-blue-500" />
                      <span>{isHr ? 'Pregled partnera za PDV-S' : 'PDV-S partnerlista és tételek'}</span>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleDownloadPdvS}
                      disabled={pdvSItems.length === 0}
                      className="h-7 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{isHr ? 'Preuzmi PDV-S XML' : 'PDV-S XML letöltése'}</span>
                    </Button>
                  </div>

                  {pdvSItems.length === 0 ? (
                    <div className="py-12 text-center text-xs text-muted-foreground">
                      {isHr
                        ? 'Nema evidentiranih EU stjecanja dobara ili primljenih usluga za ovo razdoblje.'
                        : 'Ebben az időszakban nincsenek EU-s termékbeszerzések vagy igénybe vett szolgáltatások.'}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="text-[11px] bg-muted/20">
                            <TableHead className="w-12 text-center">#</TableHead>
                            <TableHead className="w-20">Država</TableHead>
                            <TableHead className="w-36">PDV-ID</TableHead>
                            <TableHead>Naziv partnera</TableHead>
                            <TableHead className="text-right">I1 (Dobra)</TableHead>
                            <TableHead className="text-right">I2 (Usluge)</TableHead>
                            <TableHead className="text-center w-20">Računi</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pdvSItems.map((item: any) => (
                            <TableRow key={item.row_number} className="text-xs hover:bg-muted/30">
                              <TableCell className="text-center font-mono text-muted-foreground">
                                {item.row_number}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0">
                                  {item.country_code}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-mono font-medium">{item.pdv_id}</TableCell>
                              <TableCell className="font-medium max-w-[220px] truncate" title={item.partner_name}>
                                {item.partner_name || '—'}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {item.i1 > 0 ? fmtEur(item.i1) : '—'}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {item.i2 > 0 ? fmtEur(item.i2) : '—'}
                              </TableCell>
                              <TableCell className="text-center text-muted-foreground">
                                {item.invoice_count} db
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </Card>
              </TabsContent>

              {/* TAB 2: ZP (Outbound EU Supplies & Services) */}
              <TabsContent value="zp" className="space-y-4 outline-none">
                {/* KPI Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <Card className="border-border/60 bg-muted/20">
                    <CardContent className="p-2.5">
                      <div className="text-[10px] font-medium text-muted-foreground truncate">
                        I1. Isporuke dobara
                      </div>
                      <div className="text-xs font-bold mt-1 text-foreground">{fmtEur(zpTotals.i1)}</div>
                    </CardContent>
                  </Card>
                  <Card className="border-border/60 bg-muted/20">
                    <CardContent className="p-2.5">
                      <div className="text-[10px] font-medium text-muted-foreground truncate">
                        I2. Trostrani posao
                      </div>
                      <div className="text-xs font-bold mt-1 text-foreground">{fmtEur(zpTotals.i2)}</div>
                    </CardContent>
                  </Card>
                  <Card className="border-border/60 bg-muted/20">
                    <CardContent className="p-2.5">
                      <div className="text-[10px] font-medium text-muted-foreground truncate">
                        I3. Premještanje
                      </div>
                      <div className="text-xs font-bold mt-1 text-foreground">{fmtEur(zpTotals.i3)}</div>
                    </CardContent>
                  </Card>
                  <Card className="border-border/60 bg-muted/20">
                    <CardContent className="p-2.5">
                      <div className="text-[10px] font-medium text-muted-foreground truncate">
                        I4. Obavljene usluge
                      </div>
                      <div className="text-xs font-bold mt-1 text-foreground">{fmtEur(zpTotals.i4)}</div>
                    </CardContent>
                  </Card>
                  <Card className="border-border/60 bg-emerald-500/5 border-emerald-500/20 col-span-2 sm:col-span-1">
                    <CardContent className="p-2.5">
                      <div className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 truncate">
                        Ukupno (Összes)
                      </div>
                      <div className="text-xs font-bold mt-1 text-emerald-700 dark:text-emerald-300">
                        {fmtEur(zpTotals.total)}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Table */}
                <Card className="border-border/60 overflow-hidden">
                  <div className="p-3 border-b border-border/60 flex items-center justify-between bg-muted/30">
                    <div className="text-xs font-semibold flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{isHr ? 'Pregled partnera za Obrazac ZP' : 'ZP partnerlista és forgalmak'}</span>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleDownloadZp}
                      disabled={zpItems.length === 0}
                      className="h-7 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{isHr ? 'Preuzmi ZP XML' : 'ZP XML letöltése'}</span>
                    </Button>
                  </div>

                  {zpItems.length === 0 ? (
                    <div className="py-12 text-center text-xs text-muted-foreground">
                      {isHr
                        ? 'Nema evidentiranih EU isporuka dobara ili obavljenih usluga za ovo razdoblje.'
                        : 'Ebben az időszakban nincsenek EU-ba irányuló értékesítések vagy szolgáltatásnyújtások.'}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="text-[11px] bg-muted/20">
                            <TableHead className="w-10 text-center">#</TableHead>
                            <TableHead className="w-16">Država</TableHead>
                            <TableHead className="w-32">PDV-ID</TableHead>
                            <TableHead>Naziv partnera</TableHead>
                            <TableHead className="text-right">I1 (Dobra)</TableHead>
                            <TableHead className="text-right">I2 (Trostrani)</TableHead>
                            <TableHead className="text-right">I3 (Premj.)</TableHead>
                            <TableHead className="text-right">I4 (Usluge)</TableHead>
                            <TableHead className="text-center w-16">Računi</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {zpItems.map((item: any) => (
                            <TableRow key={item.row_number} className="text-xs hover:bg-muted/30">
                              <TableCell className="text-center font-mono text-muted-foreground">
                                {item.row_number}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0">
                                  {item.country_code}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-mono font-medium">{item.pdv_id}</TableCell>
                              <TableCell className="font-medium max-w-[180px] truncate" title={item.partner_name}>
                                {item.partner_name || '—'}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {item.i1 > 0 ? fmtEur(item.i1) : '—'}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {item.i2 > 0 ? fmtEur(item.i2) : '—'}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {item.i3 > 0 ? fmtEur(item.i3) : '—'}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {item.i4 > 0 ? fmtEur(item.i4) : '—'}
                              </TableCell>
                              <TableCell className="text-center text-muted-foreground">
                                {item.invoice_count}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </Card>
              </TabsContent>

              {/* TAB 3: Preparer & Tax Office Settings */}
              <TabsContent value="preparer" className="space-y-4 outline-none">
                <Card className="border-border/60 p-4 space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-foreground">
                      {isHr ? 'Podaci o sastavljaču obračuna (ObracunSastavio)' : 'Bevallást összeállító személy adatai'}
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      {isHr
                        ? 'Ovi podaci ulaze u Zaglavlje XML obrasca i automatski se pamte za sljedeća razdoblja.'
                        : 'Ezek az adatok kerülnek az XML fejlécébe, és a böngésző automatikusan megjegyzi a következő hónapokra is.'}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <Label htmlFor="prep-first-name" className="text-[11px]">
                        {isHr ? 'Ime sastavljača' : 'Keresztnév'}
                      </Label>
                      <Input
                        id="prep-first-name"
                        value={preparer.firstName}
                        onChange={(e) => updatePreparer('firstName', e.target.value)}
                        className="h-8 text-xs font-medium"
                        placeholder="Laura"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prep-last-name" className="text-[11px]">
                        {isHr ? 'Prezime sastavljača' : 'Vezetéknév'}
                      </Label>
                      <Input
                        id="prep-last-name"
                        value={preparer.lastName}
                        onChange={(e) => updatePreparer('lastName', e.target.value)}
                        className="h-8 text-xs font-medium"
                        placeholder="Gergelj"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prep-phone" className="text-[11px]">
                        {isHr ? 'Kontakt telefon' : 'Telefonszám'}
                      </Label>
                      <Input
                        id="prep-phone"
                        value={preparer.phone}
                        onChange={(e) => updatePreparer('phone', e.target.value)}
                        className="h-8 text-xs font-mono"
                        placeholder="+385957266641"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="prep-email" className="text-[11px]">
                        {isHr ? 'E-mail adresa' : 'E-mail cím'}
                      </Label>
                      <Input
                        id="prep-email"
                        type="email"
                        value={preparer.email}
                        onChange={(e) => updatePreparer('email', e.target.value)}
                        className="h-8 text-xs font-mono"
                        placeholder="mobilnost385@gmail.com"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/40 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="prep-ispostava" className="text-[11px] font-semibold">
                        {isHr ? 'Ispostava Porezne uprave (Kod)' : 'Adóhivatali kirendeltség kódja (Ispostava)'}
                      </Label>
                      <Input
                        id="prep-ispostava"
                        value={preparer.ispostava}
                        onChange={(e) => updatePreparer('ispostava', e.target.value)}
                        className="h-8 text-xs font-mono font-bold"
                        placeholder="3301"
                      />
                      <span className="text-[10px] text-muted-foreground">pl. 3301 (Osijek)</span>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="comp-street" className="text-[11px]">
                        {isHr ? 'Ulica i kućni broj' : 'Közterület és házszám'}
                      </Label>
                      <Input
                        id="comp-street"
                        value={`${companyAddress.street || ''} ${companyAddress.houseNumber || ''}`.trim()}
                        onChange={(e) => {
                          const parsed = parseCroatianAddress(e.target.value);
                          setCompanyAddress((prev) => ({
                            ...prev,
                            street: parsed.street,
                            houseNumber: parsed.houseNumber,
                          }));
                        }}
                        className="h-8 text-xs font-medium"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="comp-city" className="text-[11px]">
                        {isHr ? 'Mjesto / Grad' : 'Település'}
                      </Label>
                      <Input
                        id="comp-city"
                        value={companyAddress.city || ''}
                        onChange={(e) => setCompanyAddress((prev) => ({ ...prev, city: e.target.value }))}
                        className="h-8 text-xs font-medium"
                      />
                    </div>
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-3 border-t border-border/60 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0">
          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>ePorezna v1-0 XML shema usklađena</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => onOpenChange(false)} className="h-8 text-xs">
              {isHr ? 'Zatvori' : 'Bezárás'}
            </Button>
            <Button
              size="sm"
              onClick={handleDownloadPdvS}
              disabled={pdvSItems.length === 0}
              className="h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              <Download className="w-3.5 h-3.5" />
              <span>PDV-S XML</span>
            </Button>
            <Button
              size="sm"
              onClick={handleDownloadZp}
              disabled={zpItems.length === 0}
              className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            >
              <Download className="w-3.5 h-3.5" />
              <span>ZP XML</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
