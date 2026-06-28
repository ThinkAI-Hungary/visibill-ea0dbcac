import { Plus } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader,
  DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";

interface AddMissingInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: {
    vendor: string;
    subtext: string;
    amount: string;
    period: string;
    priority: string;
    note: string;
  };
  onFormChange: (form: AddMissingInvoiceModalProps['form']) => void;
  onSubmit: () => void;
}

export function AddMissingInvoiceModal({
  open, onOpenChange, form, onFormChange, onSubmit,
}: AddMissingInvoiceModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-card/80 dark:hover:bg-primary/90 transition-colors text-sm font-medium shadow-soft">
          <Plus className="w-4 h-4" />
          Hiányzó hozzáadása
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Hiányzó számla hozzáadása</DialogTitle>
          <DialogDescription>
            Add meg a hiányzó számla adatait
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Szállító neve</label>
            <input type="text" value={form.vendor} onChange={e => onFormChange({...form, vendor: e.target.value})} placeholder="pl. Telekom Magyarország" className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Típus/Leírás</label>
            <input type="text" value={form.subtext} onChange={e => onFormChange({...form, subtext: e.target.value})} placeholder="pl. Telefon számla" className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Becsült összeg</label>
              <input type="text" value={form.amount} onChange={e => onFormChange({...form, amount: e.target.value})} className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Időszak</label>
              <input type="text" value={form.period} onChange={e => onFormChange({...form, period: e.target.value})} className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Prioritás</label>
            <select value={form.priority} onChange={e => onFormChange({...form, priority: e.target.value})} className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer">
              <option value="Sürgős">Sürgős</option>
              <option value="Magas">Magas</option>
              <option value="Közepes">Közepes</option>
              <option value="Alacsony">Alacsony</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Megjegyzés</label>
            <textarea value={form.note} onChange={e => onFormChange({...form, note: e.target.value})} placeholder="További információk..." className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-h-[100px] resize-none" />
          </div>
        </div>
        <DialogFooter>
          <button onClick={() => onOpenChange(false)} className="px-4 py-2 bg-card border border-border text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-sm font-medium">Mégse</button>
          <button onClick={onSubmit} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-card/80 dark:hover:bg-primary/90 transition-colors text-sm font-medium">Hozzáadás</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
