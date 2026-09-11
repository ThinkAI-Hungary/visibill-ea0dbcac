import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useProjectList } from '@/hooks/useProjectList';
import { getActiveLocale } from '@/lib/locale/formatters';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserPlus, UserRoundPlus, Users, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AddEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    employee_name: string;
    employee_type: 'employee' | 'contractor';
    email: string | null;
    phone: string | null;
    hourly_rate: number | null;
    project_id?: string | null;
    user_id?: string | null;
  }) => void;
  isSaving: boolean;
  existingEmployeeNames?: string[];
}

type AddMode = 'member' | 'manual';

interface CompanyMemberProfile {
  user_id: string;
  name: string;
  role: string;
}

export function AddEmployeeDialog({
  open,
  onOpenChange,
  onSubmit,
  isSaving,
  existingEmployeeNames = [],
}: AddEmployeeDialogProps) {
  const { t } = useTranslation(['hr', 'common']);
  const currency = getActiveLocale() === 'hr' ? 'EUR' : 'HUF';
  const { selectedCompany } = useCompany();
  const { projects = [] } = useProjectList();
  const [mode, setMode] = useState<AddMode>('member');

  // Form state
  const [form, setForm] = useState({
    employee_name: '',
    employee_type: 'employee' as 'employee' | 'contractor',
    email: '',
    phone: '',
    hourly_rate: '',
    project_id: '',
  });

  // Selected member from dropdown
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  // Fetch company members with profiles
  const { data: companyMembers = [], isLoading: membersLoading } = useQuery({
    queryKey: ['company-members-for-employee', selectedCompany?.id],
    queryFn: async () => {
      const { data: members } = await supabase
        .from('company_members')
        .select('user_id, role')
        .eq('company_id', selectedCompany!.id);

      if (!members || members.length === 0) return [];

      const userIds = members.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', userIds);

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p.name]));

      return members.map(m => ({
        user_id: m.user_id,
        name: profileMap.get(m.user_id) || 'Névtelen',
        role: m.role,
      })) as CompanyMemberProfile[];
    },
    enabled: !!selectedCompany?.id && open,
  });

  // Filter out members who are already employees
  const availableMembers = useMemo(() => {
    const existingSet = new Set(existingEmployeeNames.map(n => n.toLowerCase()));
    return companyMembers.filter(m => !existingSet.has(m.name.toLowerCase()));
  }, [companyMembers, existingEmployeeNames]);

  // Selected member object
  const selectedMember = useMemo(
    () => companyMembers.find(m => m.user_id === selectedMemberId),
    [companyMembers, selectedMemberId]
  );

  const reset = () => {
    setForm({
      employee_name: '',
      employee_type: 'employee',
      email: '',
      phone: '',
      hourly_rate: '',
      project_id: '',
    });
    setSelectedMemberId(null);
    setMode('member');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'member') {
      if (!selectedMember) return;
      onSubmit({
        employee_name: selectedMember.name,
        employee_type: form.employee_type,
        email: null,
        phone: null,
        hourly_rate: form.hourly_rate ? parseFloat(form.hourly_rate) : null,
        project_id: form.project_id || null,
        user_id: selectedMember.user_id,
      });
    } else {
      if (!form.employee_name.trim()) return;
      onSubmit({
        employee_name: form.employee_name.trim(),
        employee_type: form.employee_type,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        hourly_rate: form.hourly_rate ? parseFloat(form.hourly_rate) : null,
        project_id: form.project_id || null,
      });
    }
    reset();
  };

  const canSubmit = mode === 'member'
    ? !!selectedMember && !isSaving
    : !!form.employee_name.trim() && !isSaving;

  const roleLabel = (role: string) => {
    return t(`hr:working_time.add_employee_dialog.roles.${role}`, role);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            {t('hr:working_time.add_employee_dialog.title')}
          </DialogTitle>
        </DialogHeader>

        {/* ── Mode Switcher ── */}
        <div className="flex rounded-lg border border-border bg-muted/30 p-1 gap-1">
          <button
            type="button"
            onClick={() => setMode('member')}
            className={cn(
              'flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2',
              mode === 'member'
                ? 'bg-background shadow-sm text-foreground border border-border/50'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            <Users className="h-4 w-4" />
            {t('hr:working_time.add_employee_dialog.mode_member')}
          </button>
          <button
            type="button"
            onClick={() => setMode('manual')}
            className={cn(
              'flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2',
              mode === 'manual'
                ? 'bg-background shadow-sm text-foreground border border-border/50'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            <UserRoundPlus className="h-4 w-4" />
            {t('hr:working_time.add_employee_dialog.mode_manual')}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'member' ? (
            /* ══════════════════════════════
               MODE: SELECT FROM COMPANY MEMBERS
               ══════════════════════════════ */
            <div className="space-y-2">
              <Label>{t('hr:working_time.add_employee_dialog.member_select_label')}</Label>
              {membersLoading ? (
                <div className="p-4 text-sm text-muted-foreground text-center">{t('hr:working_time.add_employee_dialog.loading')}</div>
              ) : availableMembers.length === 0 ? (
                <div className="p-4 rounded-lg border border-border bg-muted/20 text-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {t('hr:working_time.add_employee_dialog.no_members')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('hr:working_time.add_employee_dialog.no_members_desc')}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setMode('manual')}
                    className="mt-2"
                  >
                    <UserRoundPlus className="h-3.5 w-3.5 mr-1.5" />
                    {t('hr:working_time.add_employee_dialog.mode_manual')}
                  </Button>
                </div>
              ) : (
                <div className="max-h-[200px] overflow-y-auto rounded-lg border border-border divide-y divide-border">
                  {availableMembers.map(member => (
                    <button
                      key={member.user_id}
                      type="button"
                      className={cn(
                        'w-full text-left px-3 py-2.5 flex items-center justify-between transition-colors',
                        member.user_id === selectedMemberId
                          ? 'bg-primary/10'
                          : 'hover:bg-muted/50'
                      )}
                      onClick={() => setSelectedMemberId(member.user_id)}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={cn(
                          'h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0',
                          member.user_id === selectedMemberId
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        )}>
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className={cn(
                            'text-sm font-medium',
                            member.user_id === selectedMemberId && 'text-primary'
                          )}>
                            {member.name}
                          </p>
                          <p className="text-xs text-muted-foreground">{roleLabel(member.role)}</p>
                        </div>
                      </div>
                      {member.user_id === selectedMemberId && (
                        <Check className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* ══════════════════════════════
               MODE: MANUAL ENTRY
               ══════════════════════════════ */
            <>
              <div className="space-y-2">
                <Label htmlFor="emp-name">{t('hr:working_time.add_employee_dialog.name_label')}</Label>
                <Input
                  id="emp-name"
                  value={form.employee_name}
                  onChange={(e) =>
                    setForm({ ...form, employee_name: e.target.value })
                  }
                  placeholder={t('hr:working_time.add_employee_dialog.name_placeholder')}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emp-email">{t('hr:working_time.add_employee_dialog.email_label')}</Label>
                  <Input
                    id="emp-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="email@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emp-phone">{t('hr:working_time.add_employee_dialog.phone_label')}</Label>
                  <Input
                    id="emp-phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder={t('hr:working_time.add_employee_dialog.phone_placeholder')}
                  />
                </div>
              </div>
            </>
          )}

          {/* ── Shared fields for both modes ── */}
          <div className="space-y-2">
            <Label htmlFor="emp-type">{t('hr:working_time.add_employee_dialog.type_label')}</Label>
            <Select
              value={form.employee_type}
              onValueChange={(v: 'employee' | 'contractor') =>
                setForm({ ...form, employee_type: v })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="employee">{t('hr:working_time.add_employee_dialog.type_employee')}</SelectItem>
                <SelectItem value="contractor">{t('hr:working_time.add_employee_dialog.type_contractor')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="emp-project">{t('hr:working_time.add_employee_dialog.project_label')}</Label>
            <Select
              value={form.project_id}
              onValueChange={(v) =>
                setForm({ ...form, project_id: v === '__none__' ? '' : v })
              }
            >
              <SelectTrigger id="emp-project">
                <SelectValue placeholder={t('hr:working_time.add_employee_dialog.project_placeholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  <span className="text-muted-foreground">{t('hr:working_time.add_employee_dialog.no_project')}</span>
                </SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="emp-rate">{t('hr:working_time.add_employee_dialog.rate_label', { currency })}</Label>
            <Input
              id="emp-rate"
              type="number"
              step="1"
              min="0"
              value={form.hourly_rate}
              onChange={(e) =>
                setForm({ ...form, hourly_rate: e.target.value })
              }
              placeholder={t('hr:working_time.add_employee_dialog.rate_placeholder')}
            />
            <p className="text-xs text-muted-foreground">
              {t('hr:working_time.add_employee_dialog.rate_hint')}
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                reset();
              }}
            >
              {t('hr:working_time.add_employee_dialog.cancel')}
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {isSaving ? t('hr:working_time.add_employee_dialog.saving') : t('hr:working_time.add_employee_dialog.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
