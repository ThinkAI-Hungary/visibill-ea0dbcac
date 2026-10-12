import React, { useState, useMemo } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { useDateRange } from '@/contexts/DateRangeContext';
import { useOmniPartnerLedger } from '@/hooks/useTechnicalAccounting';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { formatCurrencyLocale, formatNumberLocale } from '@/lib/locale/formatters';
import { Search, Users, ExternalLink, Filter, Layers } from 'lucide-react';

interface OmniPartnerLedgerTabProps {
  companyId?: string;
  onSelectPartner?: (partnerId: string) => void;
}

export const OmniPartnerLedgerTab: React.FC<OmniPartnerLedgerTabProps> = ({
  companyId: propCompanyId,
  onSelectPartner,
}) => {
  const { selectedCompany } = useCompany();
  const { dateFromFormatted, dateToFormatted } = useDateRange();
  const companyId = propCompanyId || selectedCompany?.id;

  const [inputPrefix, setInputPrefix] = useState<string>('5');
  const [debouncedPrefix, setDebouncedPrefix] = useState<string>('5');
  const [partnerFilter, setPartnerFilter] = useState<string>('');

  // Debounce inputPrefix to prevent refetching and UI reloading on every keystroke
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPrefix(inputPrefix);
    }, 300);
    return () => clearTimeout(timer);
  }, [inputPrefix]);

  const startDateStr = dateFromFormatted || undefined;
  const endDateStr = dateToFormatted || undefined;

  const { data: ledgerItems, isLoading, isFetching } = useOmniPartnerLedger(
    companyId,
    undefined,
    debouncedPrefix || undefined,
    startDateStr,
    endDateStr
  );

  const filteredItems = useMemo(() => {
    if (!ledgerItems) return [];
    if (!partnerFilter.trim()) return ledgerItems;
    const term = partnerFilter.toLowerCase();
    return ledgerItems.filter(
      (item) =>
        item.partner_name.toLowerCase().includes(term) ||
        (item.partner_tax_number && item.partner_tax_number.includes(term))
    );
  }, [ledgerItems, partnerFilter]);

  const totals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    let net = 0;
    let count = 0;
    filteredItems.forEach((i) => {
      debit += Number(i.total_debit || 0);
      credit += Number(i.total_credit || 0);
      net += Number(i.net_balance || 0);
      count += Number(i.entries_count || 0);
    });
    return { debit, credit, net, count };
  }, [filteredItems]);

  const quickPrefixes = [
    { label: '5. Költségnemek', prefix: '5' },
    { label: '52. Igénybevett szlg.', prefix: '52' },
    { label: '31. Vevők', prefix: '31' },
    { label: '45. Szállítók', prefix: '45' },
    { label: '35 / 453. Előlegek', prefix: '35' },
    { label: '44 / 458. Hitelek', prefix: '44' },
    { label: 'Mind (1–9)', prefix: '' },
  ];

  return (
    <div className="space-y-6">
      {/* Szűrő és Főkönyvi számlacsoport választó */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" />
                Bármely Főkönyvi Számla Partnerbontása
              </CardTitle>
              <CardDescription>
                Bontsd meg a költségeket, kötelezettségeket vagy egyéb főkönyvi számlákat partnerenként
              </CardDescription>
            </div>
            {/* Gyors számlaosztály választó */}
            <div className="flex flex-wrap items-center gap-1.5">
              {quickPrefixes.map((p) => (
                <Button
                  key={p.prefix}
                  size="sm"
                  variant={inputPrefix === p.prefix ? 'default' : 'outline'}
                  onClick={() => {
                    setInputPrefix(p.prefix);
                    setDebouncedPrefix(p.prefix);
                  }}
                  className="text-xs h-8"
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block flex items-center justify-between">
                <span>Főkönyvi számlaszám előtag (pl. 52, 521, 4541, 311)</span>
                {isFetching && !isLoading && (
                  <span className="text-[10px] text-primary animate-pulse font-mono">Keresés...</span>
                )}
              </label>
              <div className="relative">
                <Filter className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Számlaszám kezdete (pl. 523)..."
                  value={inputPrefix}
                  onChange={(e) => setInputPrefix(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Partner szűrés (név vagy adószám)
              </label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Partner neve vagy adószáma..."
                  value={partnerFilter}
                  onChange={(e) => setPartnerFilter(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Összesítő statisztika */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-muted/30">
          <div className="text-xs text-muted-foreground">Érintett Partnerek</div>
          <div className="text-xl font-bold mt-1">{filteredItems.length} db</div>
        </Card>
        <Card className="p-4 bg-muted/30">
          <div className="text-xs text-muted-foreground">Összes Tartozik (T)</div>
          <div className="text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
            {formatCurrencyLocale(totals.debit, 'HUF')}
          </div>
        </Card>
        <Card className="p-4 bg-muted/30">
          <div className="text-xs text-muted-foreground">Összes Követel (K)</div>
          <div className="text-xl font-bold mt-1 text-amber-600 dark:text-amber-400">
            {formatCurrencyLocale(totals.credit, 'HUF')}
          </div>
        </Card>
        <Card className="p-4 bg-muted/30">
          <div className="text-xs text-muted-foreground">Nettó Egyenleg (T-K)</div>
          <div className="text-xl font-bold mt-1">
            {formatCurrencyLocale(totals.net, 'HUF')}
          </div>
        </Card>
      </div>

      {/* Táblázat */}
      <Card>
        <CardContent className="p-0">
          {isLoading && !ledgerItems ? (
            <div className="py-16 text-center">
              <LoadingSpinner message="Partner szerinti főkönyvi adatok betöltése..." />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Users className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="font-medium">Nem található tétel a megadott szűrési feltételekkel.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Próbálj meg módosítani a számlaszám előtagon vagy a dátumtartományon.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Partner Megnevezése</TableHead>
                    <TableHead>Adószám</TableHead>
                    <TableHead className="text-right">Tartozik (T) Forgalom</TableHead>
                    <TableHead className="text-right">Követel (K) Forgalom</TableHead>
                    <TableHead className="text-right">Nettó Egyenleg</TableHead>
                    <TableHead className="text-center">Tételek</TableHead>
                    <TableHead>Utolsó Mozgás</TableHead>
                    <TableHead className="text-right">Művelet</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.partner_id || 'no-partner'} className="hover:bg-muted/50">
                      <TableCell className="font-medium">
                        {item.partner_id ? (
                          <span className="text-foreground">{item.partner_name}</span>
                        ) : (
                          <Badge variant="outline" className="border-amber-500/50 text-amber-600 bg-amber-500/10">
                            {item.partner_name}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {item.partner_tax_number || '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-emerald-600 dark:text-emerald-400">
                        {formatCurrencyLocale(item.total_debit, 'HUF')}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-amber-600 dark:text-amber-400">
                        {formatCurrencyLocale(item.total_credit, 'HUF')}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold">
                        {formatCurrencyLocale(item.net_balance, 'HUF')}
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        <Badge variant="secondary" className="font-mono">
                          {formatNumberLocale(item.entries_count)} db
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {item.last_entry_date ? item.last_entry_date.split('T')[0] : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.partner_id && onSelectPartner && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1 text-xs text-primary"
                            onClick={() => onSelectPartner(item.partner_id!)}
                          >
                            <span>360° Dosszié</span>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
