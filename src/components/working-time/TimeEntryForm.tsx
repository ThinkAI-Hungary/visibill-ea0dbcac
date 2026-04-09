import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Clock, FolderOpen, Palmtree, Send } from 'lucide-react';
import { useProjectList } from '@/hooks/useProjectList';
import { cn } from '@/lib/utils';

interface TimeEntryFormProps {
  selectedDate: string;
  onSubmit: (entry: {
    project_id: string | null;
    date: string;
    hours: number;
    description: string;
    absence_type?: string | null;
  }) => void;
  onSubmitDrafts: () => void;
  isSubmitting: boolean;
  isSaving: boolean;
  hasDraftEntries: boolean;
}

type EntryMode = 'work' | 'absence';

export function TimeEntryForm({
  selectedDate,
  onSubmit,
  onSubmitDrafts,
  isSubmitting,
  isSaving,
  hasDraftEntries,
}: TimeEntryFormProps) {
  const { projects } = useProjectList();
  const [mode, setMode] = useState<EntryMode>('work');
  const [form, setForm] = useState({
    project_id: '',
    hours: '',
    description: '',
    absence_type: 'vacation',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const hours = parseFloat(form.hours || (mode === 'absence' ? '8' : '0'));
    if (!hours || hours <= 0 || hours > 24) return;

    onSubmit({
      project_id: mode === 'work' ? form.project_id || null : null,
      date: selectedDate,
      hours,
      description:
        mode === 'absence'
          ? `Szabadság`
          : form.description.trim(),
      absence_type: mode === 'absence' ? form.absence_type : null,
    });

    setForm({ ...form, hours: '', description: '' });
  };

  return (
    <Card className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm border-dashed border-primary/30">
      <CardContent className="p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Plus className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Új bejegyzés</span>

            {/* Mode toggle */}
            <div className="ml-auto flex rounded-lg border border-border/50 overflow-hidden text-xs">
              <button
                type="button"
                className={cn(
                  'px-3 py-1 transition-colors flex items-center gap-1',
                  mode === 'work'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
                )}
                onClick={() => setMode('work')}
              >
                <Clock className="h-3 w-3" />
                Munka
              </button>
              <button
                type="button"
                className={cn(
                  'px-3 py-1 transition-colors flex items-center gap-1',
                  mode === 'absence'
                    ? 'bg-amber-500 text-white'
                    : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
                )}
                onClick={() => {
                  setMode('absence');
                  setForm({ ...form, hours: '8' });
                }}
              >
                <Palmtree className="h-3 w-3" />
                Távollét
              </button>
            </div>
          </div>

          {mode === 'work' ? (
            /* ===== WORK MODE ===== */
            <>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] lg:grid-cols-[1fr_140px_1fr] gap-4 items-end">
                {/* Project */}
                <div className="space-y-2">
                  <Label
                    htmlFor="te-project"
                    className="text-xs text-muted-foreground flex items-center gap-1"
                  >
                    <FolderOpen className="h-3 w-3" />
                    Projekt
                  </Label>
                  <Select
                    value={form.project_id}
                    onValueChange={(v) =>
                      setForm({
                        ...form,
                        project_id: v === '__none__' ? '' : v,
                      })
                    }
                  >
                    <SelectTrigger id="te-project">
                      <SelectValue placeholder="Válassz projektet..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
                        <span className="text-muted-foreground">
                          Nincs projekthez rendelve
                        </span>
                      </SelectItem>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Hours */}
                <div className="space-y-2">
                  <Label
                    htmlFor="te-hours"
                    className="text-xs text-muted-foreground flex items-center gap-1"
                  >
                    <Clock className="h-3 w-3" />
                    Órák *
                  </Label>
                  <Input
                    id="te-hours"
                    type="number"
                    step="0.25"
                    min="0.25"
                    max="24"
                    placeholder="8"
                    value={form.hours}
                    onChange={(e) =>
                      setForm({ ...form, hours: e.target.value })
                    }
                    className="font-mono tabular-nums"
                    required
                  />
                </div>

                {/* Description (lg+) */}
                <div className="space-y-2 hidden lg:block">
                  <Label
                    htmlFor="te-desc"
                    className="text-xs text-muted-foreground"
                  >
                    Leírás (opcionális)
                  </Label>
                  <Input
                    id="te-desc"
                    placeholder="Mit csináltál..."
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Description (mobile) */}
              <div className="lg:hidden space-y-2">
                <Label
                  htmlFor="te-desc-mobile"
                  className="text-xs text-muted-foreground"
                >
                  Leírás (opcionális)
                </Label>
                <Input
                  id="te-desc-mobile"
                  placeholder="Mit csináltál..."
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </div>
            </>
          ) : (
            /* ===== ABSENCE MODE ===== */
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-4 items-end">
              {/* Absence type */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Palmtree className="h-3 w-3" />
                  Távollét típusa
                </Label>
                <Select
                  value={form.absence_type}
                  onValueChange={(v) =>
                    setForm({ ...form, absence_type: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vacation">
                      <span className="flex items-center gap-2">
                        🏖️ Szabadság
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Hours (defaults to 8) */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Órák
                </Label>
                <Input
                  type="number"
                  step="0.25"
                  min="0.25"
                  max="24"
                  placeholder="8"
                  value={form.hours}
                  onChange={(e) =>
                    setForm({ ...form, hours: e.target.value })
                  }
                  className="font-mono tabular-nums"
                />
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={isSubmitting || isSaving || (!form.hours && mode === 'work')}
              className={cn(
                'w-full sm:w-auto',
                mode === 'absence' && 'border-amber-500/30 text-amber-500 hover:bg-amber-500/10'
              )}
            >
              <Plus className="h-4 w-4 mr-2" />
              {isSubmitting
                ? 'Mentés...'
                : mode === 'absence'
                ? 'Távollét rögzítése'
                : 'Rögzítés'}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!hasDraftEntries || isSaving}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700"
              onClick={onSubmitDrafts}
            >
              <Send className="h-4 w-4 mr-2" />
              {isSaving ? 'Leadás...' : 'Mentés'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
