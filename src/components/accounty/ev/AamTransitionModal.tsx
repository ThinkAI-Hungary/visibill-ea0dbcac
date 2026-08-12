import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, CheckCircle2, Download, Info, ListTodo, ShieldCheck } from 'lucide-react';
import { generateT101Xml } from '@/lib/t101Xml';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface AamTransitionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName: string;
  clientTaxNumber: string;
  clientAddress?: string;
  ytdRevenue: number;
}

export function AamTransitionModal({
  open,
  onOpenChange,
  clientName,
  clientTaxNumber,
  clientAddress = 'Magyarország, 1000 Budapest',
  ytdRevenue,
}: AamTransitionModalProps) {
  const { toast } = useToast();
  const [selectedRegime, setSelectedRegime] = useState<'standard' | 'cash_basis' | 'exempt'>('standard');
  const [checklist, setChecklist] = useState<Record<string, boolean>>({
    nav_report: false,
    billing_system: false,
    vat_inventory: false,
    partner_notify: false,
  });

  const handleToggle = (key: string) => {
    setChecklist((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleDownloadT101 = () => {
    try {
      generateT101Xml({
        companyName: clientName,
        companyTaxNumber: clientTaxNumber,
        companyAddress: clientAddress,
        selectedRegime,
        declarationDate: new Date().toISOString().substring(0, 10),
      });
      
      toast({
        title: 'T101 XML letöltve',
        description: 'Az ÁNYK-ba közvetlenül beimportálható XML fájl sikeresen előállításra került.',
      });
    } catch (err: any) {
      toast({
        title: 'Hiba történt',
        description: 'Nem sikerült előállítani a T101 XML fájlt.',
        variant: 'destructive',
      });
    }
  };

  const completedCount = Object.values(checklist).filter(Boolean).length;
  const isFinished = completedCount === 4;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] p-6 bg-card border-border shadow-soft rounded-2xl">
        <DialogHeader className="space-y-2">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-slate-100">
            <AlertTriangle className="w-5.5 h-5.5 text-orange-500 animate-pulse" />
            ÁFA-körbe lépési Transition Workflow
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Az alanyi ÁFA-mentesség (AAM) értékhatárának átlépése miatt szükséges átállási teendők ellenőrzése és adminisztrációja.
          </DialogDescription>
        </DialogHeader>

        {/* Current status info */}
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/50 rounded-xl p-4 flex gap-3 text-xs text-amber-800 dark:text-amber-300">
          <Info className="w-4.5 h-4.5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Figyelmeztetés: Bevételi korlát elérve!</p>
            <p className="opacity-90">
              {clientName} idei árbevétele elérte a <strong>{new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 }).format(ytdRevenue)}</strong> összeget. Az ÁFA-körbe való bejelentkezés kötelező az értékhatár túllépését követő 15 napon belül.
            </p>
          </div>
        </div>

        {/* Checklist */}
        <div className="space-y-3.5 my-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ListTodo className="w-4 h-4 text-indigo-500" />
            Kötelező feladatok listája
          </h3>
          <div className="space-y-2.5">
            {/* Checklist item 1 */}
            <div 
              onClick={() => handleToggle('nav_report')}
              className={cn(
                "p-3 rounded-xl border transition-all duration-300 flex items-start gap-3 cursor-pointer select-none",
                checklist.nav_report ? "border-emerald-200 bg-emerald-500/5 dark:border-emerald-950 dark:bg-emerald-950/10" : "border-border hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20"
              )}
            >
              <Checkbox id="nav_report" checked={checklist.nav_report} onCheckedChange={() => {}} className="mt-0.5" />
              <div>
                <Label htmlFor="nav_report" className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                  T101-es NAV adatbejelentő beküldése
                </Label>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                  15 napos jogvesztő határidőn belül be kell nyújtani az adózási mód módosítását a NAV felé.
                </p>
              </div>
            </div>

            {/* Checklist item 2 */}
            <div 
              onClick={() => handleToggle('billing_system')}
              className={cn(
                "p-3 rounded-xl border transition-all duration-300 flex items-start gap-3 cursor-pointer select-none",
                checklist.billing_system ? "border-emerald-200 bg-emerald-500/5 dark:border-emerald-950 dark:bg-emerald-950/10" : "border-border hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20"
              )}
            >
              <Checkbox id="billing_system" checked={checklist.billing_system} onCheckedChange={() => {}} className="mt-0.5" />
              <div>
                <Label htmlFor="billing_system" className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                  Számlázó program átállítása
                </Label>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                  Az értékhatár átlépése után kiállított számlákban kötelező felszámítani az ÁFÁ-t (alapértelmezetten 27%).
                </p>
              </div>
            </div>

            {/* Checklist item 3 */}
            <div 
              onClick={() => handleToggle('vat_inventory')}
              className={cn(
                "p-3 rounded-xl border transition-all duration-300 flex items-start gap-3 cursor-pointer select-none",
                checklist.vat_inventory ? "border-emerald-200 bg-emerald-500/5 dark:border-emerald-950 dark:bg-emerald-950/10" : "border-border hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20"
              )}
            >
              <Checkbox id="vat_inventory" checked={checklist.vat_inventory} onCheckedChange={() => {}} className="mt-0.5" />
              <div>
                <Label htmlFor="vat_inventory" className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                  Nyitó ÁFA-leltár elkészítése
                </Label>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                  A meglévő, még értékesítetlen árukészlet korábban le nem vont előzetes áfája utólag levonásba helyezhető.
                </p>
              </div>
            </div>

            {/* Checklist item 4 */}
            <div 
              onClick={() => handleToggle('partner_notify')}
              className={cn(
                "p-3 rounded-xl border transition-all duration-300 flex items-start gap-3 cursor-pointer select-none",
                checklist.partner_notify ? "border-emerald-200 bg-emerald-500/5 dark:border-emerald-950 dark:bg-emerald-950/10" : "border-border hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20"
              )}
            >
              <Checkbox id="partner_notify" checked={checklist.partner_notify} onCheckedChange={() => {}} className="mt-0.5" />
              <div>
                <Label htmlFor="partner_notify" className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                  Ügyfelek/Partnerek tájékoztatása
                </Label>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                  Írásos értesítő küldése a partnerek részére, hogy a további teljesítések már ÁFA felszámításával történnek.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* VAT Regime Selection */}
        <div className="bg-slate-50 dark:bg-slate-900/40 border rounded-xl p-4 space-y-3">
          <Label className="text-xs font-bold text-slate-900 dark:text-slate-100 block">Választandó ÁFA adózási mód (NAV T101 pre-fill)</Label>
          <div className="flex items-center gap-3">
            <Select value={selectedRegime} onValueChange={(v: any) => setSelectedRegime(v)}>
              <SelectTrigger className="w-full bg-card border-border h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="standard" className="text-xs">Általános szabályok szerinti ÁFA (27%)</SelectItem>
                <SelectItem value="cash_basis" className="text-xs">Pénzforgalmi ÁFA elszámolás</SelectItem>
                <SelectItem value="exempt" className="text-xs">Tárgyi ÁFA-mentesség (tevékenység szerint)</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              size="sm"
              className="gap-1.5 h-9 shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg px-4"
              onClick={handleDownloadT101}
            >
              <Download className="w-3.5 h-3.5" />
              XML (ÁNYK)
            </Button>
          </div>
        </div>

        {/* Completion summary */}
        <DialogFooter className="pt-2 flex justify-between items-center sm:justify-between w-full">
          <div className="text-[10px] text-slate-400 font-semibold">
            {completedCount} / 4 feladat kész
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="h-9 px-4 text-xs">
              Mégse
            </Button>
            <Button 
              onClick={() => {
                toast({
                  title: 'Átállás folyamatban',
                  description: 'A transition workflow állapota elmentve az ügyfél adataihoz.',
                });
                onOpenChange(false);
              }}
              className={cn(
                "h-9 px-4 text-xs font-bold gap-1.5",
                isFinished ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-primary hover:bg-primary/95 text-primary-foreground"
              )}
            >
              {isFinished && <ShieldCheck className="w-3.5 h-3.5" />}
              {isFinished ? 'Workflow lezárása' : 'Mentés'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
