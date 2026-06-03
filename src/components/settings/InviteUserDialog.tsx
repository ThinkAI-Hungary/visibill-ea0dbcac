import { useState, useMemo } from 'react';
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
import { UserPlus, Loader2, Eye, EyeOff, Building2, Search, Check, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyName: string;
  onSuccess: () => void;
  toast: (props: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void;
}

// ── Password Strength ──

interface PasswordStrength {
  score: number; // 0-4
  label: string;
  color: string;
  checks: { label: string; passed: boolean }[];
}

function evaluatePassword(password: string): PasswordStrength {
  const checks = [
    { label: 'Legalább 8 karakter', passed: password.length >= 8 },
    { label: 'Nagybetű (A-Z)', passed: /[A-Z]/.test(password) },
    { label: 'Kisbetű (a-z)', passed: /[a-z]/.test(password) },
    { label: 'Szám (0-9)', passed: /[0-9]/.test(password) },
    { label: 'Speciális karakter (!@#$...)', passed: /[^A-Za-z0-9]/.test(password) },
  ];

  const score = checks.filter(c => c.passed).length;

  const levels: Record<number, { label: string; color: string }> = {
    0: { label: '', color: '' },
    1: { label: 'Nagyon gyenge', color: 'bg-red-500' },
    2: { label: 'Gyenge', color: 'bg-orange-500' },
    3: { label: 'Közepes', color: 'bg-amber-500' },
    4: { label: 'Erős', color: 'bg-emerald-500' },
    5: { label: 'Nagyon erős', color: 'bg-emerald-600' },
  };

  return { score, ...levels[score], checks };
}

export function InviteUserDialog({
  open,
  onOpenChange,
  companyId,
  companyName,
  onSuccess,
  toast,
}: InviteUserDialogProps) {
  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Company assignment
  const [assignToCompany, setAssignToCompany] = useState(true);
  const [selectedCompanyId, setSelectedCompanyId] = useState(companyId);
  const [companySearch, setCompanySearch] = useState('');
  const [role, setRole] = useState<'member' | 'admin' | 'employee'>('member');

  // UI
  const [loading, setLoading] = useState(false);

  // Companies from context
  const { companies } = useCompany();

  // Filter companies by search
  const filteredCompanies = useMemo(() => {
    if (!companySearch.trim()) return companies;
    const q = companySearch.toLowerCase();
    return companies.filter(c => c.name.toLowerCase().includes(q));
  }, [companies, companySearch]);

  // Selected company object
  const selectedCompanyObj = useMemo(
    () => companies.find(c => c.id === selectedCompanyId) || null,
    [companies, selectedCompanyId]
  );

  // Password strength
  const strength = useMemo(() => evaluatePassword(password), [password]);
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const isPasswordStrong = strength.score >= 4; // At least 4 of 5 criteria

  const resetForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setAssignToCompany(true);
    setSelectedCompanyId(companyId);
    setCompanySearch('');
    setRole('member');
  };

  const canSubmit = (
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    email.includes('@') &&
    isPasswordStrong &&
    passwordsMatch &&
    !loading
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSubmit) return;

    if (password !== confirmPassword) {
      toast({ title: 'A jelszavak nem egyeznek', description: 'Kérlek ellenőrizd a megadott jelszavakat.', variant: 'destructive' });
      return;
    }

    if (!isPasswordStrong) {
      toast({ title: 'Gyenge jelszó', description: 'A jelszónak legalább 4 kritériumnak meg kell felelnie.', variant: 'destructive' });
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Nincs aktív munkamenet.');

      const response = await supabase.functions.invoke('invite-user', {
        body: {
          email: email.trim(),
          name: name.trim(),
          password,
          company_id: assignToCompany ? selectedCompanyId : null,
          role: assignToCompany ? role : null,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Ismeretlen hiba');
      }

      const result = response.data;

      if (!result?.success) {
        const errorMessages: Record<string, string> = {
          valid_email_required: 'Érvényes email cím szükséges.',
          name_required: 'A név megadása kötelező.',
          password_min_6: 'A jelszónak legalább 6 karakter hosszúnak kell lennie.',
          not_admin: 'Nincs jogosultságod felhasználót meghívni ehhez a céghez.',
          already_member: 'Ez a felhasználó már tagja a cégnek.',
          email_exists: 'Ez az email cím már regisztrálva van és nem tartozik céghez.',
          user_create_failed: 'Nem sikerült létrehozni a felhasználót.',
          member_insert_failed: 'Nem sikerült hozzárendelni a felhasználót a céghez.',
        };

        const msg = errorMessages[result?.error] || result?.error || 'Ismeretlen hiba történt.';
        toast({ title: 'Hiba', description: msg, variant: 'destructive' });
        setLoading(false);
        return;
      }

      // Success
      if (result.existing_user) {
        toast({
          title: 'Felhasználó hozzáadva',
          description: `${name.trim()} már regisztrált felhasználó — hozzáadva a céghez.`,
        });
      } else {
        toast({
          title: 'Felhasználó meghívva',
          description: `${name.trim()} (${email.trim()}) sikeresen létrehozva.`,
        });
      }

      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      console.error('Invite error:', err);
      toast({
        title: 'Meghívás sikertelen',
        description: err.message || 'Ismeretlen hiba történt.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!loading) { onOpenChange(v); if (!v) resetForm(); } }}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Felhasználó meghívása
          </DialogTitle>
          <DialogDescription>
            Új felhasználó létrehozása az eaisybill platformon.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          {/* ── Name ── */}
          <div className="space-y-2">
            <Label htmlFor="invite-name">Teljes név *</Label>
            <Input
              id="invite-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Vezetéknév Keresztnév"
              autoComplete="off"
            />
          </div>

          {/* ── Email ── */}
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email cím *</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="felhasznalo@example.com"
              autoComplete="off"
            />
          </div>

          {/* ── Password ── */}
          <div className="space-y-2">
            <Label htmlFor="invite-password">Jelszó *</Label>
            <div className="relative">
              <Input
                id="invite-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Erős jelszó"
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
            <Label htmlFor="invite-confirm-password">Jelszó megerősítése *</Label>
            <div className="relative">
              <Input
                id="invite-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Jelszó újra"
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
                A jelszavak nem egyeznek
              </p>
            )}
            {passwordsMatch && (
              <p className="text-xs text-emerald-500 flex items-center gap-1">
                <Check className="h-3 w-3" />
                A jelszavak egyeznek
              </p>
            )}
          </div>

          {/* ── Company assignment ── */}
          <div className="rounded-lg border border-border p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="assign-company"
                checked={assignToCompany}
                onCheckedChange={(checked) => setAssignToCompany(checked === true)}
              />
              <Label htmlFor="assign-company" className="flex items-center gap-2 cursor-pointer font-normal">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                Hozzárendelés céghez
              </Label>
            </div>

            {assignToCompany && (
              <div className="space-y-3 pl-6">
                {/* Company selector with search (only if >1 company) */}
                {companies.length > 1 ? (
                  <div className="space-y-2">
                    <Label>Cég kiválasztása</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        value={companySearch}
                        onChange={(e) => setCompanySearch(e.target.value)}
                        placeholder="Cég keresése..."
                        className="pl-9 h-9"
                      />
                    </div>
                    <div className="max-h-[120px] overflow-y-auto rounded-md border border-border">
                      {filteredCompanies.length === 0 ? (
                        <div className="p-2 text-xs text-muted-foreground text-center">Nincs találat</div>
                      ) : (
                        filteredCompanies.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            className={cn(
                              'w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors',
                              c.id === selectedCompanyId
                                ? 'bg-primary/10 text-primary font-medium'
                                : 'hover:bg-muted/50'
                            )}
                            onClick={() => { setSelectedCompanyId(c.id); setCompanySearch(''); }}
                          >
                            <span className="truncate">{c.name}</span>
                            {c.id === selectedCompanyId && <Check className="h-3.5 w-3.5 shrink-0" />}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm font-medium">{selectedCompanyObj?.name || companyName}</p>
                )}

                {/* Role */}
                <div className="space-y-2">
                  <Label htmlFor="invite-role">Szerepkör</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
                    <SelectTrigger id="invite-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Tag</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="employee">Munkavállaló</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {role === 'admin' && 'Teljes hozzáférés a céghez, felhasználókat is kezelhet.'}
                    {role === 'member' && 'Általános hozzáférés a cég adataihoz.'}
                    {role === 'employee' && 'Csak a saját munkaidő-nyilvántartásához fér hozzá.'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => { onOpenChange(false); resetForm(); }} disabled={loading}>
              Mégse
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Létrehozás...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Meghívás
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
