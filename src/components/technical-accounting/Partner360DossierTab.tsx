import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useDateRange } from '@/contexts/DateRangeContext';
import { usePartner360 } from '@/hooks/useTechnicalAccounting';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { formatCurrencyLocale, formatNumberLocale } from '@/lib/locale/formatters';
import {
  Users,
  Search,
  CheckCircle2,
  FileCheck,
  ArrowRightLeft,
  Building,
  Mail,
  CreditCard,
  Download,
  AlertTriangle,
  Scale
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Partner360DossierTabProps {
  companyId?: string;
  initialPartnerId?: string;
  onNavigateToReclassification?: (sourceAccount: string, targetAccount: string) => void;
}

export const Partner360DossierTab: React.FC<Partner360DossierTabProps> = ({
  companyId: propCompanyId,
  initialPartnerId,
  onNavigateToReclassification,
}) => {
  const { selectedCompany } = useCompany();
  const { dateFromFormatted, dateToFormatted } = useDateRange();
  const companyId = propCompanyId || selectedCompany?.id;
  const { toast } = useToast();

  const [selectedPartnerId, setSelectedPartnerId] = useState<string>(initialPartnerId || '');
  const [prevInitialId, setPrevInitialId] = useState(initialPartnerId);
  const [partnerSearch, setPartnerSearch] = useState<string>('');

  if (initialPartnerId !== prevInitialId) {
    setPrevInitialId(initialPartnerId);
    setSelectedPartnerId(initialPartnerId || '');
  }

  const startDateStr = dateFromFormatted || undefined;
  const endDateStr = dateToFormatted || undefined;

  // Céghez tartozó partnerek listája a legördülőhöz
  const { data: partnersList } = useQuery({
    queryKey: ['company-partners-select', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partners')
        .select('id, name, tax_number')
        .eq('company_id', companyId!)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  const filteredPartners = (partnersList || []).filter(
    (p) =>
      p.name.toLowerCase().includes(partnerSearch.toLowerCase()) ||
      (p.tax_number && p.tax_number.includes(partnerSearch))
  );

  const { data: matrixData, isLoading } = usePartner360(
    companyId,
    selectedPartnerId || undefined,
    startDateStr,
    endDateStr
  );

  // Kompenzációs jegyzőkönyv generálása (Letöltés/Nyomtatás)
  const handleDownloadCompensationProtocol = () => {
    if (!matrixData) return;
    const { partner, summary } = matrixData;

    const printContent = `
=======================================================================
               HIVATALOS BESZÁMÍTÁSI ÉRTESÍTŐ ÉS JEGYZŐKÖNYV
                     (Ptk. 6:49. § - 6:52. § alapján)
=======================================================================

Dátum: ${new Date().toLocaleDateString('hu-HU')}
Kezdeményező Cég: ${currentCompany?.name || 'Visibill Ügyfél'}
Adószám: ${currentCompany?.tax_number || '—'}

Partner Cég: ${partner.name}
Adószám: ${partner.tax_number || '—'}
Bankszámlaszám: ${partner.bank_account_number || '—'}

-----------------------------------------------------------------------
PÉNZÜGYI KONSZOLIDÁCIÓ ÉS NYITOTT TÉTELEK:
-----------------------------------------------------------------------
• Nyilvántartott Követelés (Vevői állomány):   ${formatCurrencyLocale(summary.total_receivables, 'HUF')}
• Nyilvántartott Kötelezettség (Szállítói állomány): ${formatCurrencyLocale(summary.total_payables, 'HUF')}

-----------------------------------------------------------------------
BESZÁMÍTÁS (KOMPENZÁCIÓ) ÖSSZEGE:
-----------------------------------------------------------------------
Összegszerűen kompenzált tétel:                ${formatCurrencyLocale(summary.compensable_amount, 'HUF')}

A felek kijelentik, hogy a fent rögzített ${formatCurrencyLocale(summary.compensable_amount, 'HUF')} összeg erejéig
egymással szemben fennálló követeléseiket és kötelezettségeiket a Ptk.
rendelkezései szerint beszámítással kiegyenlítettnek tekintik.

Fennmaradó Nettó Pénzügyi Pozíció:             ${formatCurrencyLocale(Math.abs(summary.net_position), 'HUF')}
Pozíció Jellege:                               ${summary.position_type === 'NET_RECEIVABLE' ? 'Nettó Követelés (Partner tartozik)' : summary.position_type === 'NET_PAYABLE' ? 'Nettó Tartozás (Partnernek fizetendő)' : 'Teljesen kiegyenlítve'}

-----------------------------------------------------------------------
Cégszerű Aláírás:                              Cégszerű Aláírás:

..................................             ..................................
${currentCompany?.name}                         ${partner.name}
=======================================================================
`;

    const blob = new Blob([printContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Kompenzacios_Jegyzkonyv_${partner.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Jegyzőkönyv letöltve',
      description: 'A hivatalos Ptk. beszámítási jegyzőkönyv szöveges állománya elkészült.',
    });
  };

  const getNatureBadge = (nature: string) => {
    switch (nature) {
      case 'RECEIVABLE':
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">Követelés (Vevő)</Badge>;
      case 'PAYABLE':
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30">Kötelezettség (Szállító)</Badge>;
      case 'ADVANCE_GIVEN':
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/30">Adott Előleg</Badge>;
      case 'ADVANCE_RECEIVED':
        return <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/30">Kapott Előleg</Badge>;
      case 'RETAINED_WARRANTY':
        return <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/30">Garanciális Visszatartás</Badge>;
      case 'LOAN_LIABILITY':
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/30">Hitel / Kölcsön</Badge>;
      case 'COST':
        return <Badge variant="outline" className="text-slate-600 dark:text-slate-400">Költségnem</Badge>;
      case 'REVENUE':
        return <Badge variant="outline" className="text-emerald-700 dark:text-emerald-300">Árbevétel</Badge>;
      default:
        return <Badge variant="secondary">Egyéb</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Partner választó fejléc */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Omni-Partner Karton & Pénzügyi Háló (360° Dosszié)
          </CardTitle>
          <CardDescription>
            Konszolidált kép a partner összes számlán átívelő vevői, szállítói, előleg és költség pozíciójáról
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Partner Keresése és Kiválasztása
              </label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Partner neve vagy adószáma..."
                  value={partnerSearch}
                  onChange={(e) => setPartnerSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Kiválasztott Partner
              </label>
              <select
                aria-label="Kiválasztott partner listája"
                className="w-full h-10 px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                value={selectedPartnerId}
                onChange={(e) => setSelectedPartnerId(e.target.value)}
              >
                <option value="">-- Válassz partnert az elemzéshez --</option>
                {filteredPartners.slice(0, 100).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.tax_number ? `(${p.tax_number})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {!selectedPartnerId ? (
        <Card className="py-16 text-center border-dashed">
          <Building className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-medium text-muted-foreground">Kérlek válassz ki egy partnert a fenti listából!</p>
          <p className="text-xs text-muted-foreground mt-1">
            A rendszer megjeleníti a partnerhez tartozó összes vevői, szállítói és egyéb főkönyvi számlát egyetlen konszolidált mátrixban.
          </p>
        </Card>
      ) : isLoading ? (
        <div className="py-16 text-center">
          <LoadingSpinner message="Partner 360° adatok összesítése..." />
        </div>
      ) : !matrixData ? (
        <div className="py-12 text-center text-muted-foreground">
          Nem sikerült betölteni a partner adatait.
        </div>
      ) : (
        <>
          {/* Partner Adatlap Fejléc */}
          <Card className="bg-card border-primary/20">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-foreground">{matrixData.partner.name}</h3>
                    <Badge variant="outline">{matrixData.partner.partner_type || 'partner'}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mt-1.5 font-mono">
                    {matrixData.partner.tax_number && (
                      <span className="flex items-center gap-1">
                        <strong>Adószám:</strong> {matrixData.partner.tax_number}
                      </span>
                    )}
                    {matrixData.partner.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {matrixData.partner.email}
                      </span>
                    )}
                    {matrixData.partner.bank_account_number && (
                      <span className="flex items-center gap-1">
                        <CreditCard className="h-3 w-3" /> {matrixData.partner.bank_account_number}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {matrixData.summary.can_compensate && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10"
                      onClick={handleDownloadCompensationProtocol}
                    >
                      <Download className="h-4 w-4" />
                      <span>Kompenzációs Jegyzőkönyv</span>
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Konszolidált Likvid Pozíció Kártyák */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 bg-muted/20 border-l-4 border-l-emerald-500">
              <div className="text-xs text-muted-foreground font-medium">Összes Követelés (Vevő + Előleg)</div>
              <div className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400 font-mono">
                {formatCurrencyLocale(matrixData.summary.total_receivables, 'HUF')}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">Cég felé fennálló követelés</div>
            </Card>

            <Card className="p-4 bg-muted/20 border-l-4 border-l-amber-500">
              <div className="text-xs text-muted-foreground font-medium">Összes Kötelezettség (Szállító)</div>
              <div className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400 font-mono">
                {formatCurrencyLocale(matrixData.summary.total_payables, 'HUF')}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">Partner felé fennálló tartozás</div>
            </Card>

            <Card className="p-4 bg-muted/20 border-l-4 border-l-primary">
              <div className="text-xs text-muted-foreground font-medium">Nettó Likvid Pozíció</div>
              <div className="text-2xl font-bold mt-1 font-mono">
                {formatCurrencyLocale(Math.abs(matrixData.summary.net_position), 'HUF')}
              </div>
              <div className="mt-1">
                <Badge
                  variant={matrixData.summary.position_type === 'NET_RECEIVABLE' ? 'default' : 'secondary'}
                  className="text-[10px]"
                >
                  {matrixData.summary.position_type === 'NET_RECEIVABLE'
                    ? 'Nettó Követelés (Partner tartozik)'
                    : matrixData.summary.position_type === 'NET_PAYABLE'
                    ? 'Nettó Kötelezettség (Mi tartozunk)'
                    : 'Egyensúlyban (0 Ft)'}
                </Badge>
              </div>
            </Card>

            <Card className="p-4 bg-muted/20 border-l-4 border-l-purple-500">
              <div className="text-xs text-muted-foreground font-medium">Ptk. Kompenzálható Keret</div>
              <div className="text-2xl font-bold mt-1 text-purple-600 dark:text-purple-400 font-mono">
                {formatCurrencyLocale(matrixData.summary.compensable_amount, 'HUF')}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                {matrixData.summary.can_compensate ? 'Azonnal beszámítható' : 'Nincs átfedő egyenleg'}
              </div>
            </Card>
          </div>

          {/* Automatikus Ptk. Kompenzációs Ajánlás Banner */}
          {matrixData.summary.can_compensate && (
            <Card className="bg-purple-500/5 border-purple-500/30">
              <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-500/10 rounded-lg text-purple-600 mt-0.5">
                    <Scale className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                      Automatikus Ptk. Kompenzációs Ajánlás
                      <Badge variant="outline" className="border-purple-500 text-purple-600 text-[10px]">
                        {formatCurrencyLocale(matrixData.summary.compensable_amount, 'HUF')}
                      </Badge>
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
                      A partnerrel szemben egyidejűleg áll fenn követelés (311) és kötelezettség (454).
                      A Ptk. 6:49. § alapján az egyenleg banki utalási illeték nélkül, beszámítással lekönyvelhető (T 4541 → K 3111).
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white"
                    onClick={handleDownloadCompensationProtocol}
                  >
                    <FileCheck className="h-4 w-4" />
                    <span>Jegyzőkönyv Készítése</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tételes Főkönyvi Számlák Mátrixa */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-primary" />
                Kapcsolódó Főkönyvi Számlák és Jogcímek
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Főkönyvi Szám</TableHead>
                      <TableHead>Számla Megnevezése</TableHead>
                      <TableHead>Gazdasági Jelleg</TableHead>
                      <TableHead className="text-right">Tartozik (T) Forgalom</TableHead>
                      <TableHead className="text-right">Követel (K) Forgalom</TableHead>
                      <TableHead className="text-right">Fennálló Egyenleg</TableHead>
                      <TableHead className="text-center">Tételek</TableHead>
                      <TableHead>Utolsó Mozgás</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matrixData.accounts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          A megadott időszakban nincs főkönyvi mozgás a partnerhez kapcsolódóan.
                        </TableCell>
                      </TableRow>
                    ) : (
                      matrixData.accounts.map((acc) => (
                        <TableRow key={acc.gl_account_id} className="hover:bg-muted/50">
                          <TableCell className="font-mono font-bold text-foreground">
                            {acc.gl_number}
                          </TableCell>
                          <TableCell className="font-medium text-xs">
                            {acc.short_name}
                          </TableCell>
                          <TableCell>
                            {getNatureBadge(acc.account_nature)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-emerald-600 dark:text-emerald-400">
                            {formatCurrencyLocale(acc.total_debit, 'HUF')}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-amber-600 dark:text-amber-400">
                            {formatCurrencyLocale(acc.total_credit, 'HUF')}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-bold">
                            <span className={acc.balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                              {formatCurrencyLocale(acc.balance, 'HUF')}
                            </span>
                          </TableCell>
                          <TableCell className="text-center text-xs">
                            <Badge variant="secondary" className="font-mono text-[10px]">
                              {formatNumberLocale(acc.entries_count)} db
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground font-mono">
                            {acc.last_posting_date ? acc.last_posting_date.split('T')[0] : '—'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
