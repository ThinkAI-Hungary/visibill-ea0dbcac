import { useState, useEffect } from 'react';
import { useProjectList } from '@/hooks/useProjectList';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  UserCheck,
  UserX,
  Mail,
  Phone,
  Copy,
  ExternalLink,
  Trash2,
  Pencil,
  Save,
  Briefcase,
  Users,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { formatHourlyRate } from '@/lib/payrollUtils';
import type { EmployeeRate } from '@/lib/payrollUtils';
import { cn, formatCurrency } from '@/lib/utils';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { toast } from '@/hooks/use-toast';

interface EmployeeListPanelProps {
  employeeRates: EmployeeRate[];
  onDelete: (id: string) => void;
  isDeleting: boolean;
  onEdit?: (data: {
    employee_name: string;
    employee_type?: 'employee' | 'contractor';
    email?: string | null;
    phone?: string | null;
    project_id?: string | null;
  }) => void;
  isEditing?: boolean;
  autoEditEmployeeId?: string | null;
  onEditOpenChange?: (employeeId: string | null) => void;
}

/** Shared grid for header + rows */
const EMP_GRID = 'grid grid-cols-[16px_40px_1fr_140px_140px_140px_88px] items-center gap-x-4';

function EmployeeCard({
  employee,
  onDelete,
  isDeleting,
  onEdit,
  isEditing,
  autoEditId,
  onEditOpenChange,
}: {
  employee: EmployeeRate;
  onDelete: (id: string) => void;
  isDeleting: boolean;
  onEdit?: (data: {
    employee_name: string;
    employee_type?: 'employee' | 'contractor';
    email?: string | null;
    phone?: string | null;
    project_id?: string | null;
  }) => void;
  isEditing?: boolean;
  autoEditId?: string | null;
  onEditOpenChange?: (employeeId: string | null) => void;
}) {
  const { copy } = useCopyToClipboard();
  const [expanded, setExpanded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const { projects = [] } = useProjectList();

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editType, setEditType] = useState<'employee' | 'contractor'>('employee');
  const [editProjectId, setEditProjectId] = useState('');

  const isLinked = !!employee.user_id;

  const registrationUrl = employee.registration_token
    ? `${window.location.origin}/register/${employee.registration_token}`
    : null;

  const handleCopyUrl = () => {
    if (registrationUrl) {
      copy(registrationUrl);
      toast({ title: 'Másolva!', description: 'Regisztrációs link vágólapra másolva.' });
    }
  };

  const handleEmailClick = () => {
    if (employee.email && registrationUrl) {
      const subject = encodeURIComponent('Munkaidő-nyilvántartó regisztráció');
      const body = encodeURIComponent(
        `Kedves ${employee.employee_name}!\n\nKérlek regisztrálj az alábbi linken a munkaidő-nyilvántartó rendszerbe:\n\n${registrationUrl}\n\nÜdvözlettel`
      );
      window.open(`mailto:${employee.email}?subject=${subject}&body=${body}`);
    }
  };

  const handleOpenEdit = () => {
    setEditName(employee.employee_name);
    setEditEmail(employee.email || '');
    setEditPhone(employee.phone || '');
    setEditType(employee.employee_type);
    setEditProjectId(employee.project_id || '');
    setEditOpen(true);
    onEditOpenChange?.(employee.id);
  };

  // Auto-open from URL
  useEffect(() => {
    if (autoEditId === employee.id && !editOpen) {
      handleOpenEdit();
    }
  }, [autoEditId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveEdit = () => {
    if (!onEdit || !editName.trim()) return;
    onEdit({
      employee_name: editName.trim(),
      employee_type: editType,
      email: editEmail.trim() || null,
      phone: editPhone.trim() || null,
      project_id: editProjectId || null,
    });
    setEditOpen(false);
    onEditOpenChange?.(null);
  };

  return (
    <>
      <div className="border-b border-border/30 last:border-0">
        {/* Main row — grid */}
        <div
          className={cn(EMP_GRID, 'px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer group')}
          onClick={() => setExpanded(!expanded)}
        >
          {/* 1: Chevron */}
          <div className="text-muted-foreground">
            {isLinked ? (
              expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4 opacity-30" />
            )}
          </div>

          {/* 2: Avatar */}
          <div
            className={cn(
              'flex items-center justify-center h-10 w-10 rounded-full',
              isLinked ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
            )}
          >
            {isLinked ? <UserCheck className="h-5 w-5" /> : <UserX className="h-5 w-5" />}
          </div>

          {/* 3: Name */}
          <span className="font-medium truncate">{employee.employee_name}</span>

          {/* 4: Status badge */}
          <div className="flex justify-center">
            {isLinked ? (
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20 whitespace-nowrap">
                <UserCheck className="h-3 w-3 mr-1" />
                Regisztrált
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/20 whitespace-nowrap">
                <UserX className="h-3 w-3 mr-1" />
                Regisztráció szükséges
              </Badge>
            )}
          </div>

          {/* 5: Cost */}
          <span className="font-mono text-sm tabular-nums text-right">
            {employee.base_salary_cost ? formatCurrency(employee.base_salary_cost) : '—'}
          </span>

          {/* 6: Rate */}
          <span className="font-mono font-semibold tabular-nums text-primary text-right">
            {formatHourlyRate(employee.hourly_rate)}
          </span>

          {/* 7: Actions */}
          <div
            className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            {registrationUrl && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:bg-primary/10 hover:text-primary" onClick={handleCopyUrl}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Regisztrációs link másolása</TooltipContent>
              </Tooltip>
            )}
            {employee.email && registrationUrl && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:bg-emerald-500/10 hover:text-emerald-500" onClick={handleEmailClick}>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Email küldés a regisztrációs linkkel</TooltipContent>
              </Tooltip>
            )}
            {/* Edit button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 hover:bg-primary/10 hover:text-primary"
                  onClick={handleOpenEdit}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Szerkesztés</TooltipContent>
            </Tooltip>
            {/* Delete button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => {
                    if (confirm(`Biztosan törölni szeretnéd: ${employee.employee_name}?`)) {
                      onDelete(employee.id);
                    }
                  }}
                  disabled={isDeleting}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Törlés</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="px-4 pb-4 pl-[72px] animate-in slide-in-from-top-2 fade-in duration-200">
            <div className="rounded-lg bg-muted/30 border border-border/30 p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Email</div>
                <div className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="truncate">{employee.email || '—'}</span>
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Telefon</div>
                <div className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{employee.phone || '—'}</span>
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Státusz</div>
                <div className="flex items-center gap-1.5">
                  {isLinked ? (
                    <>
                      <UserCheck className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="text-emerald-500 font-medium">Regisztrált</span>
                    </>
                  ) : (
                    <>
                      <UserX className="h-3.5 w-3.5 text-amber-500" />
                      <span className="text-amber-500 font-medium">Regisztráció szükséges</span>
                    </>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Utoljára aktív</div>
                <span>
                  {isLinked && employee.updated_at
                    ? new Date(employee.updated_at).toLocaleDateString('hu-HU', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) onEditOpenChange?.(null); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Dolgozó szerkesztése</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Név</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Teljes név" />
            </div>
            <div className="space-y-2">
              <Label>Típus</Label>
              <Select value={editType} onValueChange={(v) => setEditType(v as 'employee' | 'contractor')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Bejelentett dolgozó</SelectItem>
                  <SelectItem value="contractor">Alvállalkozó</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Projekt (opcionális)</Label>
              <Select value={editProjectId} onValueChange={(v) => setEditProjectId(v === '__none__' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Válassz projektet..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    <span className="text-muted-foreground">Nincs projekthez rendelve</span>
                  </SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="email@example.com" type="email" />
              </div>
              <div className="space-y-2">
                <Label>Telefon</Label>
                <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="+36..." />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Mégse
            </Button>
            <Button onClick={handleSaveEdit} disabled={isEditing || !editName.trim()}>
              <Save className="h-4 w-4 mr-2" />
              Mentés
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function EmployeeListHeader() {
  return (
    <div className={`${EMP_GRID} px-4 py-2 border-b border-border/50`}>
      <div />
      <div />
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Dolgozó
      </span>
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">
        Státusz
      </span>
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
        Bérköltség
      </span>
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
        Óradíj
      </span>
      <div />
    </div>
  );
}

export function EmployeeListPanel({
  employeeRates,
  onDelete,
  isDeleting,
  onEdit,
  isEditing,
  autoEditEmployeeId,
  onEditOpenChange,
}: EmployeeListPanelProps) {
  const employees = employeeRates.filter((r) => r.employee_type === 'employee');
  const contractors = employeeRates.filter((r) => r.employee_type === 'contractor');

  return (
    <Card className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm">
      <CardContent className="p-6">
        <Tabs defaultValue="employees" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="employees" className="gap-2">
              <Users className="h-4 w-4" />
              Bejelentett dolgozók
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {employees.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="contractors" className="gap-2">
              <Briefcase className="h-4 w-4" />
              Alvállalkozók
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {contractors.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="employees">
            {employees.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="font-medium">Nincsenek bejelentett dolgozók</p>
                <p className="text-sm mt-1">
                  A bérlista feltöltésekor automatikusan megjelennek itt, vagy adj hozzá manuálisan.
                </p>
              </div>
            ) : (
              <>
                <EmployeeListHeader />
                {employees.map((emp) => (
                  <EmployeeCard key={emp.id} employee={emp} onDelete={onDelete} isDeleting={isDeleting} onEdit={onEdit} isEditing={isEditing} autoEditId={autoEditEmployeeId} onEditOpenChange={onEditOpenChange} />
                ))}
              </>
            )}
          </TabsContent>

          <TabsContent value="contractors">
            {contractors.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Briefcase className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="font-medium">Nincsenek alvállalkozók</p>
                <p className="text-sm mt-1">
                  Adj hozzá alvállalkozókat a "Dolgozó hozzáadása" gombbal.
                </p>
              </div>
            ) : (
              <>
                <EmployeeListHeader />
                {contractors.map((emp) => (
                  <EmployeeCard key={emp.id} employee={emp} onDelete={onDelete} isDeleting={isDeleting} onEdit={onEdit} isEditing={isEditing} autoEditId={autoEditEmployeeId} onEditOpenChange={onEditOpenChange} />
                ))}
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
