import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useCompany, type Company } from '@/contexts/CompanyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { UserPlus, Loader2, Eye, EyeOff, Building2, Search, Check, X, AlertCircle, UserCheck, UserRoundPlus, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { reportError } from '@/lib/errorReporter';

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyName: string;
  onSuccess: () => void;
  toast: (props: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void;
  /** When true, show eaisybooks (accounting firm) roles instead of eaisybill roles */
  isAccounty?: boolean;
}

// ── Password Strength ──

interface PasswordStrength {
  score: number; // 0-4
  label: string;
  color: string;
  checks: { label: string; passed: boolean }[];
}

function evaluatePassword(password: string, t: (key: any) => string): PasswordStrength {
  const checks = [
    { label: t('settings:invite_dialog.strength.check_min_chars'), passed: password.length >= 8 },
    { label: t('settings:invite_dialog.strength.check_uppercase'), passed: /[A-Z]/.test(password) },
    { label: t('settings:invite_dialog.strength.check_lowercase'), passed: /[a-z]/.test(password) },
    { label: t('settings:invite_dialog.strength.check_number'), passed: /[0-9]/.test(password) },
    { label: t('settings:invite_dialog.strength.check_special'), passed: /[^A-Za-z0-9]/.test(password) },
  ];

  const score = checks.filter(c => c.passed).length;

  const levels: Record<number, { label: string; color: string }> = {
    0: { label: '', color: '' },
    1: { label: t('settings:invite_dialog.strength.level_very_weak'), color: 'bg-red-500' },
    2: { label: t('settings:invite_dialog.strength.level_weak'), color: 'bg-orange-500' },
    3: { label: t('settings:invite_dialog.strength.level_medium'), color: 'bg-amber-500' },
    4: { label: t('settings:invite_dialog.strength.level_strong'), color: 'bg-emerald-500' },
    5: { label: t('settings:invite_dialog.strength.level_very_strong'), color: 'bg-emerald-600' },
  };

  return { score, ...levels[score], checks };
}

// ── Mode type ──
type InviteMode = 'existing' | 'new';

export function InviteUserDialog({
  open,
  onOpenChange,
  companyId,
  companyName,
  onSuccess,
  toast,
  isAccounty = false,
}: InviteUserDialogProps) {
  const { t } = useTranslation(['settings', 'common']);

  // Mode: add existing user or create new
  const [mode, setMode] = useState<InviteMode>('existing');

  // Common form state
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>(isAccounty ? 'könyvelő' : 'member');
  const [loading, setLoading] = useState(false);

  // New user form state
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Existing user lookup state
  const [lookupStatus, setLookupStatus] = useState<'idle' | 'checking' | 'found' | 'not_found'>('idle');
  const [foundUserName, setFoundUserName] = useState<string | null>(null);
  const lookupDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Company assignment
  const [assignToCompany, setAssignToCompany] = useState(true);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([companyId]);
  const [companySearch, setCompanySearch] = useState('');

  // Companies from context
  const { companies } = useCompany();

  // Filter companies by search
  const filteredCompanies = useMemo(() => {
    if (!companySearch.trim()) return companies;
    const q = companySearch.toLowerCase();
    return companies.filter(c => c.name.toLowerCase().includes(q));
  }, [companies, companySearch]);

  // Toggle company selection
  const toggleCompany = (id: string) => {
    setSelectedCompanyIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Select / deselect all filtered companies
  const selectAllFiltered = () => {
    const filteredIds = filteredCompanies.map(c => c.id);
    const allSelected = filteredIds.every(id => selectedCompanyIds.includes(id));
    if (allSelected) {
      setSelectedCompanyIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedCompanyIds(prev => [...new Set([...prev, ...filteredIds])]);
    }
  };

  // Selected company objects
  const selectedCompanyObjs = useMemo(
    () => companies.filter(c => selectedCompanyIds.includes(c.id)),
    [companies, selectedCompanyIds]
  );

  // Password strength
  const strength = useMemo(() => evaluatePassword(password, t), [password, t]);
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const isPasswordStrong = strength.score >= 4; // At least 4 of 5 criteria

  // ── Email lookup for existing users ──
  const checkEmailExists = useCallback(async (emailVal: string) => {
    if (!emailVal.includes('@') || emailVal.trim().length < 5) {
      setLookupStatus('idle');
      setFoundUserName(null);
      return;
    }

    setLookupStatus('checking');

    try {
      const { data, error } = await supabase
        .rpc('lookup_user_by_email' as any, { p_email: emailVal.trim().toLowerCase() });

      if (error) {
        // RPC might not exist yet — that's OK, allow submission anyway
        console.warn('Email lookup unavailable:', error.message);
        setLookupStatus('idle');
        return;
      }

      if (data && (data as any[]).length > 0) {
        setLookupStatus('found');
        setFoundUserName((data as any[])[0].name || (data as any[])[0].email);
      } else {
        setLookupStatus('not_found');
        setFoundUserName(null);
      }
    } catch {
      // Network error — allow submission anyway
      setLookupStatus('idle');
    }
  }, []);

  // Debounced email lookup in 'existing' mode
  useEffect(() => {
    if (mode !== 'existing') return;
    if (lookupDebounce.current) clearTimeout(lookupDebounce.current);

    lookupDebounce.current = setTimeout(() => {
      checkEmailExists(email);
    }, 500);

    return () => {
      if (lookupDebounce.current) clearTimeout(lookupDebounce.current);
    };
  }, [email, mode, checkEmailExists]);

  const resetForm = () => {
    setMode('existing');
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setAssignToCompany(true);
    setSelectedCompanyIds([companyId]);
    setCompanySearch('');
    setRole(isAccounty ? 'könyvelő' : 'member');
    setLookupStatus('idle');
    setFoundUserName(null);
  };

  const canSubmitExisting = (
    email.trim().length > 0 &&
    email.includes('@') &&
    lookupStatus === 'found' &&
    !loading
  );

  const canSubmitNew = (
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    email.includes('@') &&
    isPasswordStrong &&
    passwordsMatch &&
    !loading
  );

  const canSubmit = mode === 'existing' ? canSubmitExisting : canSubmitNew;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSubmit) return;

    if (mode === 'new') {
      if (password !== confirmPassword) {
        toast({ title: t('settings:invite_dialog.mismatch_toast_title'), description: t('settings:invite_dialog.mismatch_toast_desc'), variant: 'destructive' });
        return;
      }

      if (!isPasswordStrong) {
        toast({ title: t('settings:invite_dialog.weak_toast_title'), description: t('settings:invite_dialog.weak_toast_desc'), variant: 'destructive' });
        return;
      }
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error(t('settings:invite_dialog.no_session'));

      if (mode === 'existing') {
        // ── Existing user: add to company/companies directly ──
        const companyIdsToAssign = assignToCompany ? selectedCompanyIds : [];
        const errors: string[] = [];
        let successCount = 0;

        for (const cId of companyIdsToAssign.length > 0 ? companyIdsToAssign : [null]) {
          const response = await supabase.functions.invoke('invite-user', {
            body: {
              email: email.trim(),
              name: foundUserName || email.trim(),
              password: 'DummyPassword1!',
              company_id: cId,
              accounting_firm_id: isAccounty ? companyId : undefined,
              role: cId ? role : null,
            },
          });

          if (response.error) {
            errors.push(response.error.message || t('settings:invite_dialog.unknown_error'));
            continue;
          }

          const result = response.data;

          if (!result?.success) {
            const errorMessages: Record<string, string> = {
              valid_email_required: t('settings:invite_dialog.errors.valid_email_required'),
              name_required: t('settings:invite_dialog.errors.name_required'),
              not_admin: t('settings:invite_dialog.errors.not_admin_add'),
              already_member: t('settings:invite_dialog.errors.already_member'),
              member_insert_failed: t('settings:invite_dialog.errors.member_insert_failed'),
            };
            const msg = errorMessages[result?.error] || result?.error || t('settings:invite_dialog.unknown_error');
            const cName = companies.find(c => c.id === cId)?.name || '';
            errors.push(cName ? `${cName}: ${msg}` : msg);
          } else {
            successCount++;
          }
        }

        if (errors.length > 0 && successCount === 0) {
          toast({ title: t('common:status.error'), description: errors.join('\n'), variant: 'destructive' });
          setLoading(false);
          return;
        }

        const companyCountText = successCount > 1
          ? t('settings:invite_dialog.companies_count_plural', { count: successCount })
          : t('settings:invite_dialog.companies_count_single');
        toast({
          title: t('settings:invite_dialog.user_added_title'),
          description: `${t('settings:invite_dialog.user_added_desc', { user: foundUserName || email.trim(), target: companyCountText })}${errors.length > 0 ? ` (${errors.length} error)` : ''}`,
        });
      } else {
        // ── New user: create + add to first company, then add remaining ──
        const newUserCompanyIds = assignToCompany ? selectedCompanyIds : [];
        const firstCompanyId = newUserCompanyIds[0] || null;

        const response = await supabase.functions.invoke('invite-user', {
          body: {
            email: email.trim(),
            name: name.trim(),
            password,
            company_id: firstCompanyId,
            accounting_firm_id: isAccounty ? companyId : undefined,
            role: firstCompanyId ? role : null,
          },
        });

        if (response.error) throw new Error(response.error.message || t('settings:invite_dialog.unknown_error'));

        const result = response.data;

        if (!result?.success) {
          const errorMessages: Record<string, string> = {
            valid_email_required: t('settings:invite_dialog.errors.valid_email_required'),
            name_required: t('settings:invite_dialog.errors.name_required'),
            password_min_6: t('settings:invite_dialog.errors.password_min_6'),
            not_admin: t('settings:invite_dialog.errors.not_admin_invite'),
            already_member: t('settings:invite_dialog.errors.already_member'),
            email_exists: t('settings:invite_dialog.errors.email_exists'),
            user_create_failed: t('settings:invite_dialog.errors.user_create_failed'),
            member_insert_failed: t('settings:invite_dialog.errors.member_insert_failed'),
          };
          const msg = errorMessages[result?.error] || result?.error || t('settings:invite_dialog.unknown_error');
          toast({ title: t('common:status.error'), description: msg, variant: 'destructive' });
          setLoading(false);
          return;
        }

        // Add to remaining companies (if multi-select)
        let extraSuccess = 0;
        for (const cId of newUserCompanyIds.slice(1)) {
          const extraResp = await supabase.functions.invoke('invite-user', {
            body: {
              email: email.trim(),
              name: name.trim(),
              password: 'DummyPassword1!',
              company_id: cId,
              accounting_firm_id: isAccounty ? companyId : undefined,
              role,
            },
          });
          if (!extraResp.error && extraResp.data?.success) extraSuccess++;
        }

        const totalAssigned = 1 + extraSuccess;
        const companyText = totalAssigned > 1
          ? t('settings:invite_dialog.companies_count_plural', { count: totalAssigned })
          : t('settings:invite_dialog.companies_count_single');

        if (result.existing_user) {
          toast({
            title: t('settings:invite_dialog.user_added_title'),
            description: t('settings:invite_dialog.user_existing_added_desc', { name: name.trim(), target: companyText }),
          });
        } else {
          toast({
            title: t('settings:invite_dialog.user_invited_title'),
            description: t('settings:invite_dialog.user_invited_desc', { name: name.trim(), email: email.trim(), target: companyText }),
          });
        }
      }

      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      reportError({ type: 'db_query', component: 'InviteUserDialog', action: 'error', message: 'Invite error:', error: err });
      toast({
        title: mode === 'existing' ? t('settings:invite_dialog.add_failed_title') : t('settings:invite_dialog.invite_failed_title'),
        description: err.message || t('settings:invite_dialog.unknown_error'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!loading) { onOpenChange(v); if (!v) resetForm(); } }}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            {t('settings:invite_dialog.title')}
          </DialogTitle>
          <DialogDescription>
            {isAccounty
              ? t('settings:invite_dialog.desc_accounty')
              : t('settings:invite_dialog.desc_default')}
          </DialogDescription>
        </DialogHeader>

        {/* ── Mode Switcher ── */}
        <div className="flex rounded-lg border border-border bg-muted/30 p-1 gap-1">
          <button
            type="button"
            onClick={() => { setMode('existing'); setLookupStatus('idle'); }}
            className={cn(
              'flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2',
              mode === 'existing'
                ? 'bg-background shadow-sm text-foreground border border-border/50'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            <UserCheck className="h-4 w-4" />
            {t('settings:invite_dialog.tab_existing')}
          </button>
          <button
            type="button"
            onClick={() => setMode('new')}
            className={cn(
              'flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2',
              mode === 'new'
                ? 'bg-background shadow-sm text-foreground border border-border/50'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            <UserRoundPlus className="h-4 w-4" />
            {t('settings:invite_dialog.tab_new')}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          {mode === 'existing' ? (
            /* ══════════════════════════════════════
               MODE: EXISTING USER
               ══════════════════════════════════════ */
            <>
              {/* ── Email Search ── */}
              <div className="space-y-2">
                <Label htmlFor="invite-email-existing">{t('settings:invite_dialog.email_label')}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="invite-email-existing"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('settings:invite_dialog.email_placeholder')}
                    autoComplete="off"
                    className="pl-10"
                  />
                  {lookupStatus === 'checking' && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {lookupStatus === 'found' && (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
                  )}
                  {lookupStatus === 'not_found' && email.includes('@') && (
                    <X className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />
                  )}
                </div>

                {/* Status messages */}
                {lookupStatus === 'found' && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <UserCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                    <div className="text-sm">
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">{foundUserName}</span>
                      <span className="text-muted-foreground"> {t('settings:invite_dialog.registered_user')}</span>
                    </div>
                  </div>
                )}
                {lookupStatus === 'not_found' && email.includes('@') && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                    <div className="text-sm text-muted-foreground">
                      {t('settings:invite_dialog.email_not_registered')} 
                      <button
                        type="button"
                        className="text-primary font-medium hover:underline ml-1"
                        onClick={() => setMode('new')}
                      >
                        {t('settings:invite_dialog.create_new_user_action')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* ══════════════════════════════════════
               MODE: NEW USER
               ══════════════════════════════════════ */
            <>
              {/* ── Name ── */}
              <div className="space-y-2">
                <Label htmlFor="invite-name">{t('settings:invite_dialog.name_label')}</Label>
                <Input
                  id="invite-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('settings:invite_dialog.name_placeholder')}
                  autoComplete="off"
                />
              </div>

              {/* ── Email ── */}
              <div className="space-y-2">
                <Label htmlFor="invite-email">{t('settings:invite_dialog.email_label')}</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('settings:invite_dialog.email_placeholder')}
                  autoComplete="off"
                />
              </div>

              {/* ── Password ── */}
              <div className="space-y-2">
                <Label htmlFor="invite-password">{t('settings:invite_dialog.password_label')}</Label>
                <div className="relative">
                  <Input
                    id="invite-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('settings:invite_dialog.password_placeholder')}
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Strength bar */}
                <div className="space-y-2">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div
                        key={i}
                        className={cn(
                          'h-1.5 flex-1 rounded-full transition-colors duration-200',
                          i <= strength.score ? strength.color : 'bg-muted'
                        )}
                      />
                    ))}
                  </div>
                  {password.length > 0 && (
                    <p className={cn(
                      'text-xs font-medium',
                      strength.score <= 2 ? 'text-red-500' : strength.score <= 3 ? 'text-amber-500' : 'text-emerald-500'
                    )}>
                      {strength.label}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                    {strength.checks.map(check => (
                      <div key={check.label} className="flex items-center gap-1.5 text-xs">
                        {check.passed
                          ? <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                          : <X className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                        }
                        <span className={check.passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}>
                          {check.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Confirm Password ── */}
              <div className="space-y-2">
                <Label htmlFor="invite-confirm-password">{t('settings:invite_dialog.confirm_password_label')}</Label>
                <div className="relative">
                  <Input
                    id="invite-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t('settings:invite_dialog.confirm_password_placeholder')}
                    autoComplete="new-password"
                    className={cn(
                      'pr-10',
                      passwordsMismatch && 'border-red-500 focus-visible:ring-red-500/25'
                    )}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordsMismatch && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {t('settings:invite_dialog.passwords_mismatch')}
                  </p>
                )}
                {passwordsMatch && (
                  <p className="text-xs text-emerald-500 flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    {t('settings:invite_dialog.passwords_match')}
                  </p>
                )}
              </div>
            </>
          )}

          {/* ── Company assignment (shared for both modes) ── */}
          <div className="rounded-lg border border-border p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="assign-company"
                checked={assignToCompany}
                onCheckedChange={(checked) => setAssignToCompany(checked === true)}
              />
              <Label htmlFor="assign-company" className="flex items-center gap-2 cursor-pointer font-normal">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                {t('settings:invite_dialog.assign_company_label')}
              </Label>
            </div>

            {assignToCompany && (
              <div className="space-y-3 pl-6">
                {/* Company multi-selector with search */}
                {companies.length > 1 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>{t('settings:invite_dialog.select_companies_label')}</Label>
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline font-medium"
                        onClick={selectAllFiltered}
                      >
                        {filteredCompanies.every(c => selectedCompanyIds.includes(c.id))
                          ? t('settings:invite_dialog.deselect_all')
                          : t('settings:invite_dialog.select_all')}
                      </button>
                    </div>

                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        value={companySearch}
                        onChange={(e) => setCompanySearch(e.target.value)}
                        placeholder={t('settings:invite_dialog.company_search_placeholder')}
                        className="pl-9 h-9"
                      />
                    </div>
                    <div className="max-h-[160px] overflow-y-auto rounded-md border border-border">
                      {filteredCompanies.length === 0 ? (
                        <div className="p-2 text-xs text-muted-foreground text-center">{t('settings:invite_dialog.no_company_results')}</div>
                      ) : (
                        filteredCompanies.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            className={cn(
                              'w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors',
                              selectedCompanyIds.includes(c.id)
                                ? 'bg-primary/10 text-primary font-medium'
                                : 'hover:bg-muted/50'
                            )}
                            onClick={() => toggleCompany(c.id)}
                          >
                            <span className="truncate">{c.name}</span>
                            {selectedCompanyIds.includes(c.id) && <Check className="h-3.5 w-3.5 shrink-0" />}
                          </button>
                        ))
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('settings:invite_dialog.companies_selected_count', { count: selectedCompanyIds.length })}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm font-medium">{selectedCompanyObjs[0]?.name || companyName}</p>
                )}

                {/* Role */}
                <div className="space-y-2">
                  <Label htmlFor="invite-role">{t('settings:invite_dialog.role_label')}</Label>
                  <Select value={role} onValueChange={(v) => setRole(v)}>
                    <SelectTrigger id="invite-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {isAccounty ? (
                        <>
                          <SelectItem value="iroda_admin">{t('settings:invite_dialog.roles.iroda_admin')}</SelectItem>
                          <SelectItem value="senior_könyvelő">{t('settings:invite_dialog.roles.senior_könyvelő')}</SelectItem>
                          <SelectItem value="könyvelő">{t('settings:invite_dialog.roles.könyvelő')}</SelectItem>
                          <SelectItem value="asszisztens">{t('settings:invite_dialog.roles.asszisztens')}</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="admin">{t('settings:invite_dialog.roles.admin')}</SelectItem>
                          <SelectItem value="member">{t('settings:invite_dialog.roles.member')}</SelectItem>
                          <SelectItem value="assistant">{t('settings:invite_dialog.roles.assistant')}</SelectItem>
                          <SelectItem value="viewer">{t('settings:invite_dialog.roles.viewer')}</SelectItem>
                          <SelectItem value="employee">{t('settings:invite_dialog.roles.employee')}</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {isAccounty ? (
                      <>
                        {role === 'iroda_admin' && t('settings:invite_dialog.role_descriptions.iroda_admin')}
                        {role === 'senior_könyvelő' && t('settings:invite_dialog.role_descriptions.senior_könyvelő')}
                        {role === 'könyvelő' && t('settings:invite_dialog.role_descriptions.könyvelő')}
                        {role === 'asszisztens' && t('settings:invite_dialog.role_descriptions.asszisztens')}
                      </>
                    ) : (
                      <>
                        {role === 'admin' && t('settings:invite_dialog.role_descriptions.admin')}
                        {role === 'member' && t('settings:invite_dialog.role_descriptions.member')}
                        {role === 'assistant' && t('settings:invite_dialog.role_descriptions.assistant')}
                        {role === 'viewer' && t('settings:invite_dialog.role_descriptions.viewer')}
                        {role === 'employee' && t('settings:invite_dialog.role_descriptions.employee')}
                      </>
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => { onOpenChange(false); resetForm(); }} disabled={loading}>
              {t('settings:invite_dialog.cancel')}
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {mode === 'existing' ? t('settings:invite_dialog.adding') : t('settings:invite_dialog.creating')}
                </>
              ) : (
                <>
                  {mode === 'existing' ? (
                    <>
                      <UserCheck className="h-4 w-4 mr-2" />
                      {t('settings:invite_dialog.add_button')}
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      {t('settings:invite_dialog.invite_button')}
                    </>
                  )}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
