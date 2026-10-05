import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Trash2,
  Plus,
  Loader2,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export interface WorksheetLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: any;
  employment: any;
  cycle: any;
  currentLeaveDays: number;
  onSyncLeaveDays: (newLeaveDays: number) => void;
}

export function calculateWorkingDays(startDateStr: string, endDateStr: string): number {
  if (!startDateStr || !endDateStr) return 0;
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return 0;

  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const dayOfWeek = cur.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export function hasLeaveOverlap(
  newStart: string,
  newEnd: string,
  existingLeaves: Array<{ start_date: string; end_date: string; id?: string }>
): { hasOverlap: boolean; overlappingLeave?: { start_date: string; end_date: string } } {
  if (!newStart || !newEnd || !existingLeaves || existingLeaves.length === 0) {
    return { hasOverlap: false };
  }
  for (const l of existingLeaves) {
    if (l.start_date && l.end_date) {
      if (newStart <= l.end_date && newEnd >= l.start_date) {
        return { hasOverlap: true, overlappingLeave: l };
      }
    }
  }
  return { hasOverlap: false };
}

export default function WorksheetLeaveModal({
  isOpen,
  onClose,
  employee,
  employment,
  cycle,
  currentLeaveDays,
  onSyncLeaveDays,
}: WorksheetLeaveModalProps) {
  const { toast } = useToast();
  const [leaves, setLeaves] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // New leave form state
  const defaultYear = cycle?.year || new Date().getFullYear();
  const defaultMonthStr = String(cycle?.month || new Date().getMonth() + 1).padStart(2, '0');
  const [startDate, setStartDate] = useState(`${defaultYear}-${defaultMonthStr}-01`);
  const [endDate, setEndDate] = useState(`${defaultYear}-${defaultMonthStr}-05`);
  const [leaveType, setLeaveType] = useState('annual');

  const calculatedDays = React.useMemo(() => {
    return calculateWorkingDays(startDate, endDate);
  }, [startDate, endDate]);

  // Fetch leaves for this employment in this cycle / month
  const fetchLeaves = async () => {
    if (!employment?.id) return;
    setIsLoading(true);
    try {
      let query = supabase
        .from('accounty_leaves')
        .select('*')
        .eq('employment_id', employment.id)
        .order('start_date', { ascending: false });

      if (cycle?.id) {
        query = query.or(`cycle_id.eq.${cycle.id},start_date.gte.${defaultYear}-${defaultMonthStr}-01`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLeaves(data || []);
    } catch (err: any) {
      toast({
        title: 'Hiba a szabadságok betöltésekor',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && employment?.id) {
      fetchLeaves();
    }
  }, [isOpen, employment?.id, cycle?.id]);

  const handleAddLeave = async () => {
    if (!employment?.id || !startDate || !endDate) return;
    if (new Date(startDate) > new Date(endDate)) {
      toast({
        title: 'Érvénytelen dátumtartomány',
        description: 'A kezdő dátum nem lehet későbbi a záró dátumnál.',
        variant: 'destructive',
      });
      return;
    }

    // Check for overlap against existing registered leaves
    const overlapResult = hasLeaveOverlap(startDate, endDate, leaves);
    if (overlapResult.hasOverlap && overlapResult.overlappingLeave) {
      toast({
        title: 'Átfedő szabadság időtartam',
        description: `A megadott időszak (${startDate} – ${endDate}) átfedi a már rögzített (${overlapResult.overlappingLeave.start_date} – ${overlapResult.overlappingLeave.end_date}) távollétet.`,
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const daysCount = calculatedDays > 0 ? calculatedDays : 1;
      const { error } = await supabase.from('accounty_leaves').insert({
        employment_id: employment.id,
        cycle_id: cycle?.id || null,
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        days: daysCount,
        status: 'approved',
      });

      if (error) throw error;

      toast({
        title: 'Szabadság időtartam elmentve!',
        description: `${startDate} – ${endDate} (${daysCount} munkanap) rögzítve.`,
      });

      // Recalculate total annual leave days for this employment
      const updatedTotal = leaveType === 'annual' ? (currentLeaveDays || 0) + daysCount : currentLeaveDays;
      onSyncLeaveDays(updatedTotal);

      await fetchLeaves();
    } catch (err: any) {
      toast({
        title: 'Mentési hiba',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLeave = async (leaveItem: any) => {
    setDeletingId(leaveItem.id);
    try {
      const { error } = await supabase
        .from('accounty_leaves')
        .delete()
        .eq('id', leaveItem.id);

      if (error) throw error;

      toast({
        title: 'Időtartam törölve',
        description: `${leaveItem.start_date} – ${leaveItem.end_date} törölve a nyilvántartásból.`,
      });

      if (leaveItem.leave_type === 'annual') {
        const updatedTotal = Math.max(0, (currentLeaveDays || 0) - Number(leaveItem.days || 0));
        onSyncLeaveDays(updatedTotal);
      }

      await fetchLeaves();
    } catch (err: any) {
      toast({
        title: 'Törlési hiba',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const getLeaveTypeLabel = (type: string) => {
    switch (type) {
      case 'annual':
        return 'Fizetett szabadság';
      case 'sick_leave':
        return 'Betegszabadság';
      case 'unpaid':
        return 'Fizetés nélküli távollét';
      case 'study':
        return 'Tanulmányi szabadság';
      case 'parental':
        return 'Szülői szabadság';
      default:
        return type;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-primary" />
            <DialogTitle className="text-base font-bold">
              Szabadság Időtartam & Dátumok Rögzítése
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            {employee ? `${employee.last_name} ${employee.first_name}` : 'Munkavállaló'} · {cycle ? `${cycle.year}. ${String(cycle.month).padStart(2, '0')}. havi bérszámfejtés` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Új időtartam rögzítése űrlap */}
          <div className="p-3.5 rounded-lg border border-border bg-muted/40 space-y-3">
            <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-primary" />
              Új szabadság időtartam hozzáadása
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-medium">Kezdő dátum (tól)</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-8 text-xs bg-background font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-medium">Záró dátum (ig)</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-8 text-xs bg-background font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 items-end">
              <div className="space-y-1">
                <Label className="text-[11px] font-medium">Távollét jogcíme</Label>
                <Select value={leaveType} onValueChange={setLeaveType}>
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="annual">Fizetett szabadság (alapbér)</SelectItem>
                    <SelectItem value="sick_leave">Betegszabadság (70%)</SelectItem>
                    <SelectItem value="unpaid">Fizetés nélküli</SelectItem>
                    <SelectItem value="study">Tanulmányi szabadság</SelectItem>
                    <SelectItem value="parental">Szülői szabadság</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between pb-0.5">
                <div className="text-[11px]">
                  <span className="text-muted-foreground">Munkanapok: </span>
                  <span className="font-bold font-mono text-primary">{calculatedDays} nap</span>
                </div>

                <Button
                  size="sm"
                  onClick={handleAddLeave}
                  disabled={isSaving || calculatedDays <= 0}
                  className="h-8 text-xs gap-1 font-semibold"
                >
                  {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  Hozzáadás
                </Button>
              </div>
            </div>
          </div>

          {/* Rögzített időtartamok listája */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-foreground">
                Rögzített távollét időszakok ({leaves.length} tétel)
              </h4>
              <span className="text-[11px] text-muted-foreground font-mono">
                Munkalapi szabadság: <strong>{currentLeaveDays || 0} nap</strong>
              </span>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center p-6 text-xs text-muted-foreground gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                Dátumok betöltése...
              </div>
            ) : leaves.length === 0 ? (
              <div className="text-center py-6 px-4 border border-dashed rounded-lg text-xs text-muted-foreground">
                Még nincs rögzített konkrét dátumtartomány ehhez a dolgozóhoz.
              </div>
            ) : (
              <div className="max-h-[220px] overflow-y-auto space-y-1.5 pr-1">
                {leaves.map((l) => (
                  <div
                    key={l.id}
                    className="p-2.5 rounded-lg border border-border bg-card flex items-center justify-between text-xs hover:bg-muted/30 transition-colors"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] px-1.5 h-4 font-semibold',
                            l.leave_type === 'annual' && 'bg-blue-500/10 text-blue-600 border-blue-500/20',
                            l.leave_type === 'sick_leave' && 'bg-amber-500/10 text-amber-600 border-amber-500/20',
                            l.leave_type === 'unpaid' && 'bg-red-500/10 text-red-600 border-red-500/20'
                          )}
                        >
                          {getLeaveTypeLabel(l.leave_type)}
                        </Badge>
                        <span className="font-mono font-bold text-foreground">
                          {l.start_date} – {l.end_date}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground font-mono pl-0.5">
                        {l.days} munkanap ({Number(l.days) * 8} óra)
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteLeave(l)}
                      disabled={deletingId === l.id}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      title="Időtartam törlése"
                    >
                      {deletingId === l.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="border-t border-border pt-3">
          <Button variant="default" size="sm" onClick={onClose} className="h-8 text-xs font-semibold">
            Kész / Bezárás
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
