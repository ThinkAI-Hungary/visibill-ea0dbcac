import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Clock, Save } from 'lucide-react';

interface WorkSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSettings: {
    work_start_time: string;
    work_end_time: string;
    admin_deadline: string;
    monthly_working_hours: number;
  };
  onSave: (settings: {
    work_start_time: string;
    work_end_time: string;
    admin_deadline: string;
    monthly_working_hours: number;
  }) => void;
  isSaving: boolean;
}

export function WorkSettingsDialog({
  open,
  onOpenChange,
  currentSettings,
  onSave,
  isSaving,
}: WorkSettingsDialogProps) {
  const { t } = useTranslation(['hr', 'common']);
  const [form, setForm] = useState(currentSettings);

  const handleOpen = (v: boolean) => {
    if (v) setForm(currentSettings);
    onOpenChange(v);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            {t('hr:working_time.settings_dialog.title')}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Work hours */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              {t('hr:working_time.settings_dialog.section_standard')}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ws-start">{t('hr:working_time.settings_dialog.start_label')}</Label>
                <Input
                  id="ws-start"
                  type="time"
                  value={form.work_start_time}
                  onChange={(e) =>
                    setForm({ ...form, work_start_time: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ws-end">{t('hr:working_time.settings_dialog.end_label')}</Label>
                <Input
                  id="ws-end"
                  type="time"
                  value={form.work_end_time}
                  onChange={(e) =>
                    setForm({ ...form, work_end_time: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          {/* Admin deadline */}
          <div className="space-y-2">
            <Label htmlFor="ws-deadline">{t('hr:working_time.settings_dialog.deadline_label')}</Label>
            <Input
              id="ws-deadline"
              type="time"
              value={form.admin_deadline}
              onChange={(e) =>
                setForm({ ...form, admin_deadline: e.target.value })
              }
            />
            <p className="text-xs text-muted-foreground">
              {t('hr:working_time.settings_dialog.deadline_hint')}
            </p>
          </div>

          {/* Monthly working hours */}
          <div className="space-y-2">
            <Label htmlFor="ws-hours">{t('hr:working_time.settings_dialog.hours_label')}</Label>
            <Input
              id="ws-hours"
              type="number"
              step="0.5"
              min="1"
              max="744"
              value={form.monthly_working_hours}
              onChange={(e) =>
                setForm({
                  ...form,
                  monthly_working_hours: parseFloat(e.target.value) || 168,
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              {t('hr:working_time.settings_dialog.hours_hint')}
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t('hr:working_time.settings_dialog.cancel')}
            </Button>
            <Button type="submit" disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? t('hr:working_time.settings_dialog.saving') : t('hr:working_time.settings_dialog.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
