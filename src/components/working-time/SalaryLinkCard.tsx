import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  User,
  Save,
  Pencil,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { formatHourlyRate, calculateHourlyCost } from '@/lib/payrollUtils';
import type { EmployeeRate, SalaryCostItem } from '@/lib/payrollUtils';
import { useState, useEffect } from 'react';
import { RATES_GRID } from './EmployeeRatesPanel';

interface SalaryLinkCardProps {
  employeeName: string;
  salaryItems: SalaryCostItem[];
  existingRate: EmployeeRate | null;
  monthlyWorkingHours: number;
  onSave: (data: {
    employee_name: string;
    base_salary_cost: number;
    hourly_rate: number;
  }) => void;
  isSaving: boolean;
  autoEditId?: string | null;
  onEditOpenChange?: (employeeId: string | null) => void;
}

export function SalaryLinkCard({
  employeeName,
  salaryItems,
  existingRate,
  monthlyWorkingHours,
  onSave,
  isSaving,
  autoEditId,
  onEditOpenChange,
}: SalaryLinkCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editCost, setEditCost] = useState('');

  // Calculate totals
  const salaryBer = salaryItems
    .filter(i => i.tipus === 'bér')
    .reduce((s, i) => s + Number(i.összeg), 0);
  const salaryAdo = salaryItems
    .filter(i => i.tipus === 'adó')
    .reduce((s, i) => s + Number(i.összeg), 0);
  const salaryJarulok = salaryItems
    .filter(i => i.tipus === 'járulék')
    .reduce((s, i) => s + Number(i.összeg), 0);
  const totalSalaryCost = salaryBer + salaryAdo + salaryJarulok;

  const effectiveCost = existingRate?.base_salary_cost ?? totalSalaryCost;
  const effectiveRate = existingRate?.hourly_rate ?? calculateHourlyCost(totalSalaryCost, monthlyWorkingHours);
  const hasBeenSynced = !!existingRate;
  const hasSalaryData = totalSalaryCost > 0;

  const editCostNum = parseFloat(editCost) || 0;
  const previewRate = editCostNum > 0
    ? calculateHourlyCost(editCostNum, monthlyWorkingHours)
    : 0;

  const handleOpenEdit = () => {
    setEditCost(String(effectiveCost || totalSalaryCost || ''));
    setEditOpen(true);
    onEditOpenChange?.(existingRate?.id || employeeName);
  };

  // Auto-open from URL
  useEffect(() => {
    const idMatch = existingRate?.id || employeeName;
    if (autoEditId === idMatch && !editOpen) {
      handleOpenEdit();
    }
  }, [autoEditId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveEdit = () => {
    const cost = parseFloat(editCost);
    if (!cost || cost <= 0) return;
    onSave({
      employee_name: employeeName,
      base_salary_cost: cost,
      hourly_rate: calculateHourlyCost(cost, monthlyWorkingHours),
    });
    setEditOpen(false);
    onEditOpenChange?.(null);
  };

  const handleSaveFromRow = () => {
    if (totalSalaryCost <= 0) return;
    onSave({
      employee_name: employeeName,
      base_salary_cost: totalSalaryCost,
      hourly_rate: calculateHourlyCost(totalSalaryCost, monthlyWorkingHours),
    });
  };

  return (
    <>
      <div className="border-b border-border/30 last:border-0">
        {/* Main row — uses shared RATES_GRID */}
        <div
          className={cn(
            RATES_GRID,
            'px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer group'
          )}
          onClick={() => setExpanded(!expanded)}
        >
          {/* 1: Chevron */}
          <div className="text-muted-foreground">
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </div>

          {/* 2: Avatar */}
          <div
            className={cn(
              'flex items-center justify-center h-10 w-10 rounded-full',
              hasSalaryData
                ? 'bg-emerald-500/10 text-emerald-500'
                : 'bg-amber-500/10 text-amber-500'
            )}
          >
            <User className="h-5 w-5" />
          </div>

          {/* 3: Name */}
          <span className="font-medium truncate">{employeeName}</span>

          {/* 4: Status badge — fixed column */}
          <div className="flex justify-center">
            {hasSalaryData ? (
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20 whitespace-nowrap">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Szinkronizálva
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/20 whitespace-nowrap">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Hiányzó adat
              </Badge>
            )}
          </div>

          {/* 5: Cost */}
          <span className="font-mono text-sm tabular-nums text-right">
            {effectiveCost > 0 ? formatCurrency(effectiveCost) : '—'}
          </span>

          {/* 6: Rate */}
          <span className="font-mono font-semibold tabular-nums text-primary text-right">
            {effectiveRate > 0 ? formatHourlyRate(effectiveRate) : '—'}
          </span>

          {/* 7: Actions */}
          <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            {!hasBeenSynced && hasSalaryData ? (
              <Button
                size="sm"
                onClick={handleSaveFromRow}
                disabled={isSaving}
                className="h-7 text-xs px-2"
              >
                <Save className="h-3 w-3 mr-1" />
                Mentés
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/10 hover:text-primary"
                onClick={handleOpenEdit}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Expanded details — Bér / Adó / Járulék */}
        {expanded && (
          <div className="px-4 pb-4 pl-[72px] animate-in slide-in-from-top-2 fade-in duration-200">
            <div className="rounded-lg bg-muted/30 border border-border/30 p-4 grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Bér</div>
                <span className={cn('font-mono tabular-nums', salaryBer > 0 ? 'font-semibold' : 'text-muted-foreground')}>
                  {salaryBer > 0 ? formatCurrency(salaryBer) : '—'}
                </span>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Adó</div>
                <span className={cn('font-mono tabular-nums', salaryAdo > 0 ? 'font-semibold' : 'text-muted-foreground')}>
                  {salaryAdo > 0 ? formatCurrency(salaryAdo) : '—'}
                </span>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Járulék</div>
                <span className={cn('font-mono tabular-nums', salaryJarulok > 0 ? 'font-semibold' : 'text-muted-foreground')}>
                  {salaryJarulok > 0 ? formatCurrency(salaryJarulok) : '—'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) onEditOpenChange?.(null); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Óradíj szerkesztése — {employeeName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Teljes bérköltség (Ft/hó)</Label>
              <Input
                type="number"
                value={editCost}
                onChange={(e) => setEditCost(e.target.value)}
                placeholder="pl. 416186"
                className="font-mono"
              />
            </div>
            <div className="rounded-lg bg-muted/50 border border-border/30 p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Havi munkaórák:</span>
                <span className="font-mono">{monthlyWorkingHours}h</span>
              </div>
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-muted-foreground">Számított óradíj:</span>
                <span className="font-mono text-primary">
                  {previewRate > 0 ? formatHourlyRate(previewRate) : '—'}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Mégse
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSaving || editCostNum <= 0}>
              <Save className="h-4 w-4 mr-2" />
              Mentés
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
