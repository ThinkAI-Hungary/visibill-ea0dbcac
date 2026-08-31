import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Link2,
  FileText,
  Loader2,
  CheckCircle2,
  Ban,
  UploadCloud,
  Check,
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toHuf, isSameCurrency } from '@/lib/matching/candidateFinder';
import { AvailableInvoice, TransactionItem } from '@/lib/matching/types';

export interface ManualMatchSearchSectionProps {
  mode: 'primary' | 'extra';
  transaction: TransactionItem;
  candidateInvoices: AvailableInvoice[];
  search: string;
  setSearch: (query: string) => void;
  selectedInvoiceId: string | null;
  setSelectedInvoiceId: (id: string | null) => void;
  loading: boolean;
  isSearchingServer: boolean;
  isSaving: boolean;
  matchStatus: string;
  onBack?: () => void;
  onMatch: () => void;
  onMarkNoInvoice?: () => void;
  onMarkInvoiceMissing?: () => void;
}

export const ManualMatchSearchSection: React.FC<ManualMatchSearchSectionProps> = ({
  mode,
  transaction,
  candidateInvoices,
  search,
  setSearch,
  selectedInvoiceId,
  setSelectedInvoiceId,
  loading,
  isSearchingServer,
  isSaving,
  matchStatus,
  onBack,
  onMatch,
  onMarkNoInvoice,
  onMarkInvoiceMissing,
}) => {
  const transactionAmount = transaction.amount || 0;
  const isExtra = mode === 'extra';

  return (
    <>
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-medium flex items-center gap-1.5">
              {isExtra ? (
                <FileText className="h-3.5 w-3.5 text-primary" />
              ) : (
                <Link2 className="h-3.5 w-3.5 text-primary" />
              )}
              {isExtra
                ? 'További számla hozzáadása'
                : transaction.matched_invoice_id
                ? 'Másik számla választása'
                : 'Manuális párosítás'}
            </h4>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {isExtra
                ? 'A kiválasztott számla kiegészítő párosításként kerül a tranzakcióhoz'
                : `Összeg alapján rendezve · keresett: `}
              {!isExtra && (
                <span className="font-mono font-medium">
                  {formatCurrency(transactionAmount, transaction.currency || 'HUF')}
                </span>
              )}
            </p>
          </div>
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack} className="h-6 text-xs">
              Vissza
            </Button>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Keresés számlaszám, partner vagy összeg alapján..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-8 h-8 text-xs"
            autoFocus
          />
          {isSearchingServer && (
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        {!loading && (
          <div className="flex items-center justify-between text-[10px] text-muted-foreground px-0.5">
            <span>
              {search
                ? `${candidateInvoices.length} találat`
                : `${candidateInvoices.length} számla az időszakban (±180 nap)`}
            </span>
          </div>
        )}

        <div
          className={cn(
            'overflow-y-auto border rounded-md',
            isExtra ? 'min-h-[200px] max-h-[200px]' : 'min-h-[240px] max-h-[240px]'
          )}
        >
          {loading ? (
            <div className="flex items-center justify-center h-20">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : candidateInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-20 text-muted-foreground">
              {isSearchingServer ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <p className="text-xs mt-2">Keresés a számlák között...</p>
                </>
              ) : (
                <>
                  <FileText className="h-5 w-5 mb-1" />
                  <p className="text-xs">
                    {search ? 'Nincs találat a keresésre' : 'Nincs elérhető számla az időszakban'}
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="p-1.5 space-y-1">
              {candidateInvoices.map(invoice => {
                const isSelected = selectedInvoiceId === invoice.id;
                const invoiceAmt = invoice.brutto_vegosszeg || 0;
                const txCurrency = (transaction.currency || 'HUF').toUpperCase();
                const invCurrency = (invoice.penznem || 'HUF').toUpperCase();
                const isSame = isSameCurrency(txCurrency, invCurrency);

                const txAbs = Math.abs(transactionAmount);
                let compareInvAmt: number;
                let compareTxAmt: number;
                let diffCurrency: string;

                if (isSame) {
                  compareInvAmt = Math.abs(invoiceAmt);
                  compareTxAmt = txAbs;
                  diffCurrency = invCurrency;
                } else {
                  compareInvAmt = toHuf(Math.abs(invoiceAmt), invoice.penznem);
                  compareTxAmt = toHuf(txAbs, transaction.currency);
                  diffCurrency = 'HUF';
                }

                const diff = compareInvAmt - compareTxAmt;
                const absDiff = Math.abs(diff);
                const isExact = absDiff < (isSame ? 0.01 : 1);
                const isNear = !isExact && compareTxAmt > 0 && absDiff < compareTxAmt * 0.05;
                const pctDiff = compareTxAmt > 0 ? (absDiff / compareTxAmt) * 100 : 0;

                const partnerName = invoice.elado_nev?.toLowerCase() || '';
                const txDesc = transaction.description?.toLowerCase() || '';
                const cleanPartnerName = partnerName
                  .replace(/\b(kft|zrt|bt|s\.r\.o\.|ev\.)\b/g, '')
                  .trim();
                const hasPartnerMatch =
                  cleanPartnerName.length > 2 && txDesc.includes(cleanPartnerName);

                const brutto = Math.abs(invoice.brutto_vegosszeg || 0);
                const paid = invoice.already_paid || 0;
                const rem = brutto - paid;

                return (
                  <div
                    key={invoice.id}
                    className={cn(
                      'rounded-md border p-2.5 cursor-pointer transition-all',
                      isSelected
                        ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                        : 'hover:bg-muted/40 hover:border-border',
                      isExact && !isSelected && 'border-emerald-500/40 bg-emerald-500/5',
                      isNear && !isSelected && 'border-amber-500/30 bg-amber-500/5'
                    )}
                    onClick={() => setSelectedInvoiceId(invoice.id)}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {isSelected && (
                            <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />
                          )}
                          <p className="font-medium font-mono text-xs truncate">
                            {invoice.bizonylatsorszam}
                          </p>
                        </div>
                        <p className="text-muted-foreground text-[10px] mt-0.5 truncate flex items-center gap-1.5">
                          <span className="truncate">{invoice.elado_nev || '-'}</span>
                          {hasPartnerMatch && (
                            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[8px] h-3.5 px-1 font-semibold leading-none shrink-0 hover:bg-emerald-500/10">
                              Partner egyezik
                            </Badge>
                          )}
                        </p>
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                          {invoice.kibocsatas_datuma
                            ? format(new Date(invoice.kibocsatas_datuma), 'yyyy.MM.dd')
                            : ''}
                        </p>
                        {paid >= brutto && brutto > 0 ? (
                          <Badge className="text-[8px] h-3.5 px-1 mt-0.5 bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/10">
                            Kifizetve
                          </Badge>
                        ) : paid > 0 ? (
                          <Badge className="text-[8px] h-3.5 px-1 mt-0.5 bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/10">
                            Részben fizetve, fennmaradó: {formatCurrency(rem, invoice.penznem || 'HUF')}
                          </Badge>
                        ) : (
                          <Badge className="text-[8px] h-3.5 px-1 mt-0.5 bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500/10">
                            Nincs fizetve
                          </Badge>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono font-medium text-xs">
                          {formatCurrency(invoice.brutto_vegosszeg || 0, invoice.penznem || 'HUF')}
                        </p>
                        {isExact ? (
                          <Badge variant="success" className="text-[9px] h-4 mt-0.5">
                            ✓ Egyező
                          </Badge>
                        ) : isNear ? (
                          <Badge className="text-[9px] h-4 mt-0.5 bg-amber-500/20 text-amber-600 border-amber-500/30 hover:bg-amber-500/20">
                            ~{pctDiff.toFixed(0)}% elt.
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/60 mt-0.5 block">
                            {diff > 0 ? '+' : ''}
                            {formatCurrency(diff, diffCurrency)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 pt-4 w-full mt-4 border-t border-border/40 bg-background sticky bottom-0">
        {!isExtra && onMarkNoInvoice && onMarkInvoiceMissing && (
          <div className="flex items-center gap-2 w-full">
            <Button
              variant="outline"
              size="sm"
              disabled={isSaving}
              onClick={onMarkNoInvoice}
              className={cn(
                'text-xs h-10 flex-1 border-purple-500/30 hover:bg-purple-500/10',
                matchStatus === 'no_invoice' && 'bg-purple-500/15 border-purple-500/50'
              )}
            >
              <Ban className="h-3 w-3 mr-1 text-purple-500" />
              Nincs hozzá számla
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isSaving}
              onClick={onMarkInvoiceMissing}
              className={cn(
                'text-xs h-10 flex-1 border-sky-500/30 hover:bg-sky-500/10',
                matchStatus === 'invoice_missing' && 'bg-sky-500/15 border-sky-500/50'
              )}
            >
              <UploadCloud className="h-3 w-3 mr-1 text-sky-500" />
              Számla nincs feltöltve
            </Button>
          </div>
        )}

        <div className="flex justify-end w-full">
          <Button
            size="sm"
            disabled={!selectedInvoiceId || isSaving}
            onClick={onMatch}
            className="text-xs h-10 w-full"
          >
            <Check className="h-3 w-3 mr-1" />
            {isSaving ? 'Mentés...' : isExtra ? 'Hozzáadás' : 'Párosítás mentése'}
          </Button>
        </div>
      </div>
    </>
  );
};
