import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Trash2, ArrowRightLeft, Calendar, FileText, Hash } from 'lucide-react';
import { useSubledgerItemMatches, useUnsettleOpenItems } from '@/hooks/useSubledger';
import type { SubledgerItem } from '@/types/subledger';
import { formatCurrency } from '@/lib/utils';

interface SubledgerItemMatchesModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: SubledgerItem | null;
  companyId: string;
}

export const SubledgerItemMatchesModal: React.FC<SubledgerItemMatchesModalProps> = ({
  isOpen,
  onClose,
  item,
  companyId,
}) => {
  const { data: matches, isLoading } = useSubledgerItemMatches(companyId, item?.line_id);
  const unsettleMutation = useUnsettleOpenItems();

  if (!item) return null;

  const handleUnsettle = (matchId: string) => {
    if (window.confirm('Biztosan felbontja ezt a párosítást? A tétel ismét nyitott státuszba kerül.')) {
      unsettleMutation.mutate({ companyId, matchId });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
            <span>Kapcsolódó rendezések és párosítások</span>
          </DialogTitle>
          <DialogDescription>
            Bizonylat: <strong className="text-foreground">{item.document_id}</strong> ({item.gl_number} - {item.partner_name || item.gl_short_name})
          </DialogDescription>
        </DialogHeader>

        {/* Selected Item Overview */}
        <div className="bg-muted/50 rounded-lg p-3 text-sm flex items-center justify-between border">
          <div>
            <div className="text-muted-foreground text-xs">Eredeti könyvelt összeg</div>
            <div className="font-semibold text-base">
              {formatCurrency(item.amount, item.currency)} ({item.dc_type})
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Eddig rendezve</div>
            <div className="font-semibold text-emerald-600">
              {formatCurrency(item.settled_amount, item.currency)}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Fennmaradó nyitott</div>
            <div className={`font-semibold ${item.remaining_amount > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>
              {formatCurrency(item.remaining_amount, item.currency)}
            </div>
          </div>
        </div>

        {/* Matches List */}
        <div className="space-y-3 py-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Összerendezett ellen-tételek ({matches?.length || 0})
          </div>

          {isLoading ? (
            <div className="py-8 flex items-center justify-center text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Párosítások betöltése...
            </div>
          ) : !matches || matches.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
              Ehhez a tételhez még nem tartozik rögzített párosítás.
            </div>
          ) : (
            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
              {matches.map((m) => (
                <div
                  key={m.match_id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-foreground">
                        {m.other_document_id || 'Bizonylatszám nélküli'}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {m.other_journal_code}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className={
                          m.match_type === 'ROUNDING'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : m.match_type === 'FX_DIFFERENCE'
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                            : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                        }
                      >
                        {m.match_type === 'ROUNDING'
                          ? 'Kerekítés'
                          : m.match_type === 'FX_DIFFERENCE'
                          ? 'Árfolyamkülönbözet'
                          : m.match_type === 'AUTO_REF'
                          ? 'Banki ref'
                          : 'Kézi párosítás'}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {m.other_posting_date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Hash className="w-3.5 h-3.5" />
                        {m.other_dc_type}
                      </span>
                      {m.notes && <span className="italic">{m.notes}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-semibold text-sm text-foreground">
                        {formatCurrency(m.settled_amount_huf)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Rendezve: {new Date(m.settled_at).toLocaleDateString('hu-HU')}
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleUnsettle(m.match_id)}
                      disabled={unsettleMutation.isPending}
                      className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 p-2"
                      title="Párosítás felbontása"
                    >
                      {unsettleMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose}>
            Bezárás
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
