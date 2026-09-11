import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/utils';
import { formatDate, getTypeBadge } from '@/lib/salary-helpers';
import { getActiveLocale } from '@/lib/locale/formatters';
import type { SalaryItem } from '@/lib/salary-helpers';

// ── Add Dialog ──

interface AddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (form: { megnevezes: string; osszeg: string; datum: string }) => void;
}

export function SalaryAddDialog({ open, onOpenChange, onSubmit }: AddDialogProps) {
  const { t } = useTranslation(['hr', 'common']);
  const currency = getActiveLocale() === 'hr' ? 'EUR' : 'HUF';

  const [form, setForm] = useState({
    megnevezes: '',
    osszeg: '',
    datum: new Date().toISOString().slice(0, 10),
  });

  const reset = () => setForm({ megnevezes: '', osszeg: '', datum: new Date().toISOString().slice(0, 10) });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={v => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('hr:salaries.dialogs.add_title')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="add-megnevezes">{t('hr:salaries.dialogs.name_label')}</Label>
            <Input id="add-megnevezes" value={form.megnevezes} onChange={e => setForm({ ...form, megnevezes: e.target.value })} placeholder={t('hr:salaries.dialogs.name_placeholder')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-osszeg">{t('hr:salaries.dialogs.amount_label', { currency })}</Label>
            <Input id="add-osszeg" type="number" step="1" value={form.osszeg} onChange={e => setForm({ ...form, osszeg: e.target.value })} placeholder={t('hr:salaries.dialogs.amount_placeholder')} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-datum">{t('hr:salaries.dialogs.date_label')}</Label>
            <Input id="add-datum" type="date" value={form.datum} onChange={e => setForm({ ...form, datum: e.target.value })} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { onOpenChange(false); reset(); }}>{t('hr:salaries.dialogs.cancel')}</Button>
            <Button type="submit">{t('hr:salaries.dialogs.submit_add')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit Dialog ──

interface EditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: SalaryItem | null;
  onSubmit: (id: string, form: { megnevezes: string; megjegyzes: string }) => void;
}

export function SalaryEditDialog({ open, onOpenChange, record, onSubmit }: EditDialogProps) {
  const { t } = useTranslation(['hr', 'common']);
  const [form, setForm] = useState({ megnevezes: '', megjegyzes: '' });

  // Sync form when record changes
  const handleOpenChange = (v: boolean) => {
    if (v && record) {
      setForm({ megnevezes: record.név, megjegyzes: record.megjegyzes ?? '' });
    }
    onOpenChange(v);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!record) return;
    onSubmit(record.id, form);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('hr:salaries.dialogs.edit_title')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-megnevezes">{t('hr:salaries.dialogs.name_label')}</Label>
            <Input id="edit-megnevezes" value={form.megnevezes} onChange={e => setForm({ ...form, megnevezes: e.target.value })} placeholder={t('hr:salaries.dialogs.edit_name_placeholder')} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-megjegyzes">{t('hr:salaries.dialogs.notes_label')}</Label>
            <Textarea id="edit-megjegyzes" value={form.megjegyzes} onChange={e => setForm({ ...form, megjegyzes: e.target.value })} placeholder={t('hr:salaries.dialogs.notes_placeholder')} rows={3} />
          </div>
          {record && (
            <div className="rounded-lg bg-muted/40 p-3 space-y-1 text-sm text-muted-foreground">
              <p><span className="font-medium text-foreground">{t('hr:salaries.dialogs.type_label')}</span> {getTypeBadge(record.tipus).label}</p>
              <p><span className="font-medium text-foreground">{t('hr:salaries.dialogs.amount_summary_label')}</span> {formatCurrency(record.összeg)}</p>
              <p><span className="font-medium text-foreground">{t('hr:salaries.dialogs.date_summary_label')}</span> {formatDate(record.dátum)}</p>
              {record.munkavallalo_neve && (
                <p><span className="font-medium text-foreground">{t('hr:salaries.dialogs.employee_summary_label')}</span> {record.munkavallalo_neve}</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('hr:salaries.dialogs.cancel')}</Button>
            <Button type="submit">{t('hr:salaries.dialogs.submit_edit')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
