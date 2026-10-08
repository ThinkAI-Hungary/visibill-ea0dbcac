import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Copy, AlertCircle, Sparkles, Loader2, CheckCircle2 } from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import { useCopyAutoAccountingRules } from '@/hooks/useAutoAccountingRules';

interface CopyCompanyRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetCompanyId: string;
  targetCompanyName: string;
}

export const CopyCompanyRulesModal: React.FC<CopyCompanyRulesModalProps> = ({
  isOpen,
  onClose,
  targetCompanyId,
  targetCompanyName,
}) => {
  const { companies = [] } = useCompany();
  const [sourceCompanyId, setSourceCompanyId] = useState<string>('');

  const copyMutation = useCopyAutoAccountingRules();

  // Filter out current company from selectable sources
  const availableSources = (companies || []).filter((c) => c.id !== targetCompanyId);

  const handleCopy = () => {
    if (!sourceCompanyId) return;

    copyMutation.mutate(
      {
        sourceCompanyId,
        targetCompanyId,
      },
      {
        onSuccess: () => {
          onClose();
          setSourceCompanyId('');
        },
      }
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <Copy className="h-5 w-5 text-primary" />
            <span>Szabályok Átvétele Másik Cégből</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Egy már beállított cég automatikus könyvelési paramétereinek átvétele a(z){' '}
            <strong className="text-foreground">{targetCompanyName}</strong> céghez.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">
              Forrás cég kiválasztása
            </Label>
            <Select value={sourceCompanyId} onValueChange={setSourceCompanyId}>
              <SelectTrigger className="h-9 text-xs bg-background/60">
                <SelectValue placeholder="Válassz egy forrás céget..." />
              </SelectTrigger>
              <SelectContent>
                {availableSources.map((comp) => (
                  <SelectItem key={comp.id} value={comp.id} className="text-xs">
                    <span className="font-semibold">{comp.name}</span>
                    {comp.tax_number && (
                      <span className="text-muted-foreground ml-2 font-mono text-[11px]">
                        ({comp.tax_number})
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-primary">
              <Sparkles className="h-4 w-4" />
              <span>Hogyan működik az átvétel?</span>
            </div>
            <ul className="space-y-1.5 text-muted-foreground text-[11px] list-disc list-inside">
              <li>
                A rendszer a forrás cég beállított számlaszámai (<span className="font-mono text-foreground font-semibold">gl_number</span>) alapján automatikusan megkeresi az azonos vagy legközelebbi egyező számlákat (intelligens hierarchikus illesztés).
              </li>
              <li>
                A cél cég saját Vegyes (<span className="font-mono text-foreground font-semibold">VE</span>) naplója automatikusan hozzárendelésre kerül.
              </li>
              <li>
                Ha egy számlaszám semmilyen formában nem létezik a cél cégnél, a rendszer pontos figyelmeztetést ad a sikeres átvétel után.
              </li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/40">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={copyMutation.isPending}
            className="text-xs"
          >
            Mégse
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleCopy}
            disabled={!sourceCompanyId || copyMutation.isPending}
            className="text-xs gap-1.5 font-semibold"
          >
            {copyMutation.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Másolás folyamatban...</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Szabályok Átvétele (1 Kattintás)</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
