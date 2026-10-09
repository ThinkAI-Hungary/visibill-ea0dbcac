import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Filter,
  RotateCcw,
  X,
  Search,
  SlidersHorizontal,
  Calendar,
  Layers,
} from 'lucide-react';
import {
  JournalFilterCriteria,
  DEFAULT_JOURNAL_FILTER_CRITERIA,
  MatchMode,
  getActiveFilterCount,
} from './journalFilterUtils';

interface JournalFilterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  criteria: JournalFilterCriteria;
  onApplyCriteria: (newCriteria: JournalFilterCriteria) => void;
  onResetCriteria: () => void;
  journals?: { id: string; code: string; name: string }[];
  currentJournalName?: string;
}

export const JournalFilterModal: React.FC<JournalFilterModalProps> = ({
  open,
  onOpenChange,
  criteria,
  onApplyCriteria,
  journals = [],
  currentJournalName = 'Aktuális nézet',
}) => {
  // Local draft state so the user can tweak fields before applying
  const [draft, setDraft] = useState<JournalFilterCriteria>(criteria);
  const [prevOpen, setPrevOpen] = useState(open);

  // Sync draft during render when modal opens
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setDraft(criteria);
    }
  }

  const activeCountInDraft = getActiveFilterCount(draft);

  const handleApply = () => {
    onApplyCriteria(draft);
    onOpenChange(false);
  };

  const handleReset = () => {
    setDraft(DEFAULT_JOURNAL_FILTER_CRITERIA);
  };

  const updateDraft = <K extends keyof JournalFilterCriteria>(
    field: K,
    value: JournalFilterCriteria[K]
  ) => {
    setDraft(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-full max-h-[88vh] overflow-y-auto overflow-x-hidden p-0 gap-0 border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="bg-amber-500/15 dark:bg-amber-950/40 border-b border-amber-500/30 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 shadow-xs">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-lg font-bold text-foreground tracking-tight">
                  Szűkítés
                </DialogTitle>
                {activeCountInDraft > 0 && (
                  <Badge className="bg-amber-600 text-white hover:bg-amber-700 text-xs px-2 py-0.5 font-bold">
                    {activeCountInDraft} aktív feltétel
                  </Badge>
                )}
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Állítsd be a szűkítési feltételeket a könyvelési napló gyors áttekintéséhez.
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-6 text-sm overflow-x-hidden">
          {/* 1. Szekció: Hatókör és Típus / Irány jelölők */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Layers className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Hatókör és számlatípusok</span>
            </div>

            <div className="bg-muted/30 p-4 rounded-lg border border-border/60 space-y-4">
              {/* Hatókör választó */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/40">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                  <Label htmlFor="scope-select" className="text-xs font-medium shrink-0">
                    Napló keresési hatókör:
                  </Label>
                  <Select
                    value={draft.journalScope}
                    onValueChange={(val) => updateDraft('journalScope', val)}
                  >
                    <SelectTrigger id="scope-select" className="h-8 w-full sm:w-[260px] text-xs bg-background">
                      <SelectValue placeholder="Válassz hatókört..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CURRENT">
                        Aktuális nézet ({currentJournalName})
                      </SelectItem>
                      <SelectItem value="ALL">Minden napló (Globális szűkítés)</SelectItem>
                      {journals.map((j) => (
                        <SelectItem key={j.id} value={j.id}>
                          {j.code} – {j.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <span className="text-[11px] text-muted-foreground italic">
                  A „Minden napló” opcióval az összes napló tételei között kereshetsz.
                </span>
              </div>

              {/* Típus / Irány kapcsolók */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Bizonylat típusok:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                    <Checkbox
                      checked={draft.vevoSzamlak}
                      onCheckedChange={(checked) => updateDraft('vevoSzamlak', !!checked)}
                    />
                    <span className="font-medium">Vevő számlák (311)</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                    <Checkbox
                      checked={draft.szallitoSzamlak}
                      onCheckedChange={(checked) => updateDraft('szallitoSzamlak', !!checked)}
                    />
                    <span className="font-medium">Szállító számlák (454)</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                    <Checkbox
                      checked={draft.bankPenztar}
                      onCheckedChange={(checked) => updateDraft('bankPenztar', !!checked)}
                    />
                    <span className="font-medium">Bank / Pénztár (38)</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                    <Checkbox
                      checked={draft.vegyesNaplo}
                      onCheckedChange={(checked) => updateDraft('vegyesNaplo', !!checked)}
                    />
                    <span className="font-medium">Vegyes tételek</span>
                  </label>
                </div>
              </div>

              {/* Státusz és speciális kapcsolók */}
              <div className="space-y-1.5 pt-2 border-t border-border/40">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Státuszok és opciók:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                    <Checkbox
                      checked={draft.statusKonyvelt}
                      onCheckedChange={(checked) => updateDraft('statusKonyvelt', !!checked)}
                    />
                    <span>Könyvelt tételek</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                    <Checkbox
                      checked={draft.statusPiszkozat}
                      onCheckedChange={(checked) => updateDraft('statusPiszkozat', !!checked)}
                    />
                    <span>Piszkozatok / Javaslatok</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs cursor-pointer select-none text-rose-600 dark:text-rose-400 font-medium">
                    <Checkbox
                      checked={draft.statusSztorno}
                      onCheckedChange={(checked) => updateDraft('statusSztorno', !!checked)}
                    />
                    <span>Sztornózott tételek</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                    <Checkbox
                      checked={draft.csakPfAfa}
                      onCheckedChange={(checked) => updateDraft('csakPfAfa', !!checked)}
                    />
                    <span>Csak pf. áfás</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                    <Checkbox
                      checked={draft.csakJegyzet}
                      onCheckedChange={(checked) => updateDraft('csakJegyzet', !!checked)}
                    />
                    <span>Csak jegyzettel</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Szekció: Intervallumos szűrők (Tól - Ig) - Label on TOP */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Calendar className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Dátum- és sorszám intervallumok</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/20 p-4 rounded-lg border border-border/50">
              {/* Naplósorszám */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Naplósorszám (tól – ig)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="tól"
                    value={draft.naplosorszamTol}
                    onChange={(e) => updateDraft('naplosorszamTol', e.target.value)}
                    className="h-8 text-xs flex-1 min-w-0"
                  />
                  <span className="text-muted-foreground text-xs">–</span>
                  <Input
                    type="number"
                    placeholder="ig"
                    value={draft.naplosorszamIg}
                    onChange={(e) => updateDraft('naplosorszamIg', e.target.value)}
                    className="h-8 text-xs flex-1 min-w-0"
                  />
                </div>
              </div>

              {/* Kelt (document_date) */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Kelt (bizonylatkelt)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={draft.keltTol}
                    onChange={(e) => updateDraft('keltTol', e.target.value)}
                    className="h-8 text-xs flex-1 min-w-0"
                  />
                  <span className="text-muted-foreground text-xs">–</span>
                  <Input
                    type="date"
                    value={draft.keltIg}
                    onChange={(e) => updateDraft('keltIg', e.target.value)}
                    className="h-8 text-xs flex-1 min-w-0"
                  />
                </div>
              </div>

              {/* Teljesítés (posting_date) */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Teljesítés (számviteli)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={draft.teljesitesTol}
                    onChange={(e) => updateDraft('teljesitesTol', e.target.value)}
                    className="h-8 text-xs flex-1 min-w-0"
                  />
                  <span className="text-muted-foreground text-xs">–</span>
                  <Input
                    type="date"
                    value={draft.teljesitesIg}
                    onChange={(e) => updateDraft('teljesitesIg', e.target.value)}
                    className="h-8 text-xs flex-1 min-w-0"
                  />
                </div>
              </div>

              {/* Áfa esedékesség */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Áfa esedékesség</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={draft.afaEsedekessegTol}
                    onChange={(e) => updateDraft('afaEsedekessegTol', e.target.value)}
                    className="h-8 text-xs flex-1 min-w-0"
                  />
                  <span className="text-muted-foreground text-xs">–</span>
                  <Input
                    type="date"
                    value={draft.afaEsedekessegIg}
                    onChange={(e) => updateDraft('afaEsedekessegIg', e.target.value)}
                    className="h-8 text-xs flex-1 min-w-0"
                  />
                </div>
              </div>

              {/* Fizetési határidő */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Fizetési határidő</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={draft.fizetesiHataridoTol}
                    onChange={(e) => updateDraft('fizetesiHataridoTol', e.target.value)}
                    className="h-8 text-xs flex-1 min-w-0"
                  />
                  <span className="text-muted-foreground text-xs">–</span>
                  <Input
                    type="date"
                    value={draft.fizetesiHataridoIg}
                    onChange={(e) => updateDraft('fizetesiHataridoIg', e.target.value)}
                    className="h-8 text-xs flex-1 min-w-0"
                  />
                </div>
              </div>

              {/* Bruttó összeg */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Bruttó összeg (Ft)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="min Ft"
                    value={draft.osszegTol}
                    onChange={(e) => updateDraft('osszegTol', e.target.value)}
                    className="h-8 text-xs flex-1 min-w-0"
                  />
                  <span className="text-muted-foreground text-xs">–</span>
                  <Input
                    type="number"
                    placeholder="max Ft"
                    value={draft.osszegIg}
                    onChange={(e) => updateDraft('osszegIg', e.target.value)}
                    className="h-8 text-xs flex-1 min-w-0"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 3. Szekció: Szöveges és Relációs keresések - Label on TOP, inputs min-w-0 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Search className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Szöveges és Főkönyvi illeszkedések</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/20 p-4 rounded-lg border border-border/50">
              {/* Főkönyvi szám */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Főkönyvi szám</Label>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="pl. 311, 4541, 911"
                    value={draft.fokonyviSzam}
                    onChange={(e) => updateDraft('fokonyviSzam', e.target.value)}
                    className="h-8 text-xs flex-1 min-w-0"
                  />
                  <Select
                    value={draft.fokonyviSzamMatch}
                    onValueChange={(val: MatchMode) => updateDraft('fokonyviSzamMatch', val)}
                  >
                    <SelectTrigger className="h-8 w-32 text-xs shrink-0 bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STARTS_WITH">Eleje egyezik</SelectItem>
                      <SelectItem value="EXACT">Teljes egyezőség</SelectItem>
                      <SelectItem value="CONTAINS">Tartalmazza</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Bizonylatszám */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Bizonylatszám</Label>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="pl. E-TXLG-..."
                    value={draft.bizonylatszam}
                    onChange={(e) => updateDraft('bizonylatszam', e.target.value)}
                    className="h-8 text-xs flex-1 min-w-0"
                  />
                  <Select
                    value={draft.bizonylatszamMatch}
                    onValueChange={(val: MatchMode) => updateDraft('bizonylatszamMatch', val)}
                  >
                    <SelectTrigger className="h-8 w-32 text-xs shrink-0 bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CONTAINS">Tartalmazza</SelectItem>
                      <SelectItem value="STARTS_WITH">Eleje egyezik</SelectItem>
                      <SelectItem value="EXACT">Teljes egyezőség</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Partnernév */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Partnernév</Label>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="pl. Alpha Logistics"
                    value={draft.partnerNev}
                    onChange={(e) => updateDraft('partnerNev', e.target.value)}
                    className="h-8 text-xs flex-1 min-w-0"
                  />
                  <Select
                    value={draft.partnerNevMatch}
                    onValueChange={(val: MatchMode) => updateDraft('partnerNevMatch', val)}
                  >
                    <SelectTrigger className="h-8 w-32 text-xs shrink-0 bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CONTAINS">Tartalmazza</SelectItem>
                      <SelectItem value="STARTS_WITH">Eleje egyezik</SelectItem>
                      <SelectItem value="EXACT">Teljes egyezőség</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Partnerkód / Adószám */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Partnerkód / Adószám</Label>
                <Input
                  placeholder="pl. 12345678"
                  value={draft.partnerKod}
                  onChange={(e) => updateDraft('partnerKod', e.target.value)}
                  className="h-8 text-xs w-full min-w-0"
                />
              </div>

              {/* Megjegyzés */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Megjegyzés / Szöveg</Label>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Keresés a leírásban..."
                    value={draft.megjegyzes}
                    onChange={(e) => updateDraft('megjegyzes', e.target.value)}
                    className="h-8 text-xs flex-1 min-w-0"
                  />
                  <Select
                    value={draft.megjegyzesMatch}
                    onValueChange={(val: MatchMode) => updateDraft('megjegyzesMatch', val)}
                  >
                    <SelectTrigger className="h-8 w-32 text-xs shrink-0 bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CONTAINS">Tartalmazza</SelectItem>
                      <SelectItem value="STARTS_WITH">Eleje egyezik</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Munkaszám / Projekt */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Munkaszám / Projekt</Label>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="pl. PRJ-01"
                    value={draft.munkaszam}
                    onChange={(e) => updateDraft('munkaszam', e.target.value)}
                    className="h-8 text-xs flex-1 min-w-0"
                  />
                  <Select
                    value={draft.munkaszamMatch}
                    onValueChange={(val: MatchMode) => updateDraft('munkaszamMatch', val)}
                  >
                    <SelectTrigger className="h-8 w-32 text-xs shrink-0 bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CONTAINS">Tartalmazza</SelectItem>
                      <SelectItem value="STARTS_WITH">Eleje egyezik</SelectItem>
                      <SelectItem value="EXACT">Teljes egyezőség</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Devizanem */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Devizanem</Label>
                <Select
                  value={draft.devizanem}
                  onValueChange={(val) => updateDraft('devizanem', val)}
                >
                  <SelectTrigger className="h-8 w-full text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Minden devizanem</SelectItem>
                    <SelectItem value="HUF">HUF – Magyar Forint</SelectItem>
                    <SelectItem value="EUR">EUR – Euro</SelectItem>
                    <SelectItem value="USD">USD – US Dollár</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Év / Előzmények */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Év intervallum (tól – ig)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="2025"
                    value={draft.evTol}
                    onChange={(e) => updateDraft('evTol', e.target.value)}
                    className="h-8 text-xs flex-1 min-w-0"
                  />
                  <span className="text-muted-foreground text-xs">–</span>
                  <Input
                    type="number"
                    placeholder="2026"
                    value={draft.evIg}
                    onChange={(e) => updateDraft('evIg', e.target.value)}
                    className="h-8 text-xs flex-1 min-w-0"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer with Actions */}
        <DialogFooter className="bg-muted/30 border-t border-border px-6 py-3 flex flex-row items-center justify-between sm:justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Alaphelyzet
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="gap-1.5 text-xs"
            >
              <X className="w-3.5 h-3.5" />
              Mégse
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleApply}
              className="gap-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-xs"
            >
              <Filter className="w-3.5 h-3.5" />
              Szűkít
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
