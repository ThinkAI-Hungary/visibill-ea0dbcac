import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Sparkles, AlertCircle, Coins, TrendingDown } from 'lucide-react';
import { useWriteOffSubledgerDifference } from '@/hooks/useSubledger';
import type { SubledgerItem } from '@/types/subledger';
import { formatCurrency } from '@/lib/utils';

interface WriteOffSettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: SubledgerItem | null;
  companyId: string;
}

export const WriteOffSettlementModal: React.FC<WriteOffSettlementModalProps> = ({
  isOpen,
  onClose,
  item,
  companyId,
}) => {
  const [type, setType] = useState<'ROUNDING' | 'FX_DIFFERENCE'>('ROUNDING');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  const writeOffMutation = useWriteOffSubledgerDifference();

  useEffect(() => {
    if (item) {
      const rem = Math.abs(item.remaining_amount);
      setAmount(rem > 0 ? rem.toString() : '0');

      // Pre-select type: if <= 10 HUF default to ROUNDING, else if foreign currency default to FX_DIFFERENCE
      if (item.currency !== 'HUF') {
        setType('FX_DIFFERENCE');
        setDescription(`Realizált árfolyamkülönbözet - ${item.document_id}`);
      } else if (rem <= 10) {
        setType('ROUNDING');
        setDescription(`Kerekítési különbözet leírása - ${item.document_id}`);
      } else {
        setType('ROUNDING');
        setDescription(`Különbözet leírása - ${item.document_id}`);
      }
    }
  }, [item]);

  if (!item) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Kérjük, adjon meg egy érvényes pozitív összeget!');
      return;
    }

    writeOffMutation.mutate(
      {
        companyId,
        lineId: item.line_id,
        type,
        amountHuf: numAmount,
        description: description || undefined,
      },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  const isSmallRounding = Math.abs(item.remaining_amount) <= 10;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <span>Különbözet Leírás és Lezárás</span>
          </DialogTitle>
          <DialogDescription>
            Automatikus vegyes bizonylat (VE) generálása és a nyitott tétel teljes lezárása.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Item details */}
          <div className="bg-muted/40 rounded-lg p-3 text-sm border space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bizonylat / Partner:</span>
              <span className="font-semibold text-foreground">
                {item.document_id} ({item.partner_name || item.gl_short_name})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Főkönyvi számla:</span>
              <span className="font-mono text-xs">{item.gl_number} ({item.dc_type})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Eredeti könyvelt összeg:</span>
              <span>
                {item.currency !== 'HUF' && item.foreign_amount ? (
                  <span>
                    {formatCurrency(item.foreign_amount, item.currency)}{' '}
                    <span className="text-xs text-muted-foreground font-normal">({formatCurrency(item.amount, 'HUF')})</span>
                  </span>
                ) : (
                  formatCurrency(item.amount, 'HUF')
                )}
              </span>
            </div>
            <div className="flex justify-between pt-1 border-t">
              <span className="text-muted-foreground font-medium">Jelenlegi nyitott különbözet:</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">
                {formatCurrency(item.remaining_amount, 'HUF')}
              </span>
            </div>
          </div>

          {/* Type selection */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Különbözet Típusa</Label>
            <RadioGroup
              value={type}
              onValueChange={(val) => {
                const nextType = val as 'ROUNDING' | 'FX_DIFFERENCE';
                setType(nextType);
                if (nextType === 'ROUNDING') {
                  setDescription(`Kerekítési különbözet leírása - ${item.document_id}`);
                } else {
                  setDescription(`Realizált árfolyamkülönbözet - ${item.document_id}`);
                }
              }}
              className="grid grid-cols-2 gap-3"
            >
              <div
                className={`flex items-start space-x-2 border rounded-lg p-3 cursor-pointer transition-colors ${
                  type === 'ROUNDING' ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20' : 'hover:bg-muted/40'
                }`}
                onClick={() => setType('ROUNDING')}
              >
                <RadioGroupItem value="ROUNDING" id="type-rounding" className="mt-0.5" />
                <div className="space-y-1">
                  <Label htmlFor="type-rounding" className="font-medium cursor-pointer flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-amber-600" />
                    Kerekítés
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    $\le 10$ Ft eltérés leírása egyéb ráfordításra / bevételre (8755/9779).
                  </p>
                </div>
              </div>

              <div
                className={`flex items-start space-x-2 border rounded-lg p-3 cursor-pointer transition-colors ${
                  type === 'FX_DIFFERENCE' ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20' : 'hover:bg-muted/40'
                }`}
                onClick={() => setType('FX_DIFFERENCE')}
              >
                <RadioGroupItem value="FX_DIFFERENCE" id="type-fx" className="mt-0.5" />
                <div className="space-y-1">
                  <Label htmlFor="type-fx" className="font-medium cursor-pointer flex items-center gap-1.5">
                    <TrendingDown className="w-4 h-4 text-purple-600" />
                    Árfolyamkülönbözet
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Pénzügyi műveletek egyéb ráfordításai / bevételei (8762/9762).
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Amount input */}
          <div className="space-y-1.5">
            <Label htmlFor="writeoff-amount" className="text-sm font-semibold">
              Leírandó összeg (Ft)
            </Label>
            <Input
              id="writeoff-amount"
              type="number"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="font-semibold"
            />
            {isSmallRounding && type === 'ROUNDING' && (
              <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <Sparkles className="w-3.5 h-3.5" />
                10 Ft alatti kerekítés (Sztv. szerinti egyszerűsített elszámolás).
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="writeoff-desc" className="text-sm font-semibold">
              Vegyes könyvelési szöveg
            </Label>
            <Input
              id="writeoff-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="pl. Kerekítési különbözet leírása"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={writeOffMutation.isPending}>
              Mégse
            </Button>
            <Button
              type="submit"
              disabled={writeOffMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {writeOffMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Könyvelés folyamatban...
                </>
              ) : (
                'Könyvelés és Lezárás'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
