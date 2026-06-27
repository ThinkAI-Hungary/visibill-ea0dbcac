import React from 'react';
import { Building2, Users, ChevronDown, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const ROLE_LABELS: Record<string, string> = {
  iroda_admin: 'Iroda Admin',
  senior_könyvelő: 'Senior',
  könyvelő: 'Könyvelő',
  asszisztens: 'Asszisztens',
};
const ROLE_COLORS: Record<string, string> = {
  iroda_admin: 'bg-primary/10 text-primary',
  senior_könyvelő: 'bg-accent dark:bg-accent text-accent-foreground dark:text-primary',
  könyvelő: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400',
  asszisztens: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400',
};

interface TeamMember {
  id: string;
  name: string;
  initial: string;
  role: string;
  clientCount: number;
  assignedCompanies: { id: string; name: string }[];
}

interface TeamSettingsTabProps {
  teamMembers: TeamMember[];
  isAdmin: boolean;
  currentUserId?: string;
  firmId?: string;
}

export default function TeamSettingsTab({
  teamMembers, isAdmin, currentUserId, firmId,
}: TeamSettingsTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Local state for this tab
  const [expandedMembers, setExpandedMembers] = React.useState<Set<string>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [memberToDelete, setMemberToDelete] = React.useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [inviteName, setInviteName] = React.useState('');
  const [inviteRole, setInviteRole] = React.useState<string>('könyvelő');
  const [inviting, setInviting] = React.useState(false);

  return (
    <div key="team" className="p-6 space-y-6 tab-content-enter">
      <div className="border-b border-border pb-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Csapat</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Könyvelők és hozzáférések kezelése</p>
      </div>

      <div className="space-y-3">
        {teamMembers.map((member, idx) => {
          const isExpanded = expandedMembers.has(member.id);
          return (
            <div key={member.id} className="flex flex-col bg-slate-50 dark:bg-slate-800/50 rounded-xl overflow-hidden">
              {/* Header Row */}
              <div 
                onClick={() => {
                  setExpandedMembers(prev => {
                    const next = new Set(prev);
                    if (next.has(member.id)) next.delete(member.id);
                    else next.add(member.id);
                    return next;
                  });
                }}
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-100/30 dark:hover:bg-slate-800 transition-colors select-none"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white",
                    idx === 0 ? "bg-primary" : idx === 1 ? "bg-blue-600" : idx === 2 ? "bg-purple-600" : "bg-slate-500"
                  )}>
                    {member.initial}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{member.name}</p>
                    <p className="text-xs text-slate-500">{member.clientCount} ügyfél hozzárendelve</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'px-2.5 py-1 rounded-full text-[10px] font-bold uppercase',
                    ROLE_COLORS[member.role] || 'bg-muted text-muted-foreground'
                  )}>
                    {ROLE_LABELS[member.role] || member.role}
                  </span>
                  {isAdmin && member.id !== currentUserId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMemberToDelete({ id: member.id, name: member.name });
                        setDeleteConfirmOpen(true);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                      title="Eltávolítás"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform duration-200", isExpanded && "rotate-180")} />
                </div>
              </div>

              {/* Collapsible Panel */}
              {isExpanded && (
                <div className="border-t border-border/50 bg-slate-50/50 dark:bg-slate-900/10 px-4 py-3 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Hozzárendelt ügyfelek ({member.assignedCompanies?.length || 0})
                  </p>
                  {!member.assignedCompanies || member.assignedCompanies.length === 0 ? (
                    <p className="text-xs text-slate-400 dark:text-slate-500 italic">Nincsenek hozzárendelt ügyfelek</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {member.assignedCompanies.map((comp: any) => (
                        <div key={comp.id} className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-lg text-xs font-medium">
                          <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate text-slate-700 dark:text-slate-300">{comp.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {teamMembers.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">Még nincs csapattag regisztrálva</p>
          </div>
        )}
      </div>

      <Button
        variant="outline"
        className="gap-2 w-full border-dashed border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
        onClick={() => setInviteOpen(true)}
      >
        <Users className="w-4 h-4" />
        Új könyvelő meghívása
      </Button>

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Új könyvelő meghívása</DialogTitle>
            <DialogDescription>Add meg a meghívandó könyvelő adatait</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Név</label>
              <Input
                placeholder="Könyvelő neve"
                value={inviteName}
                onChange={e => setInviteName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">E-mail cím</label>
              <Input
                type="email"
                placeholder="konyvelo@example.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Szerepkör</label>
              <div className="grid grid-cols-2 gap-2">
                {(['könyvelő', 'senior_könyvelő', 'asszisztens', 'iroda_admin'] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => setInviteRole(r)}
                    className={cn(
                      'px-3 py-2 rounded-lg border text-sm font-medium transition-all text-left',
                      inviteRole === r
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-slate-300'
                    )}
                  >
                    {ROLE_LABELS[r] || r}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Mégse</Button>
            <Button
              disabled={inviting || !inviteEmail.trim() || !inviteName.trim()}
              onClick={async () => {
                setInviting(true);
                try {
                  if (!firmId) throw new Error('Nincs iroda hozzárendelve');
                  
                  const { data: { session } } = await supabase.auth.getSession();
                  if (!session?.access_token) throw new Error('Nincs aktív munkamenet.');

                  const tempPassword = Math.random().toString(36).slice(-8) + 'aA1!';

                  const response = await supabase.functions.invoke('invite-user', {
                    body: {
                      email: inviteEmail.trim(),
                      name: inviteName.trim(),
                      password: tempPassword,
                      company_id: firmId,
                      role: inviteRole,
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
                      not_admin: 'Nincs jogosultságod felhasználót meghívni ehhez az irodához.',
                      already_member: 'Ez a felhasználó már tagja az irodának.',
                      email_exists: 'Ez az email cím már regisztrálva van az adatbázisban.',
                      user_create_failed: 'Nem sikerült létrehozni a felhasználót.',
                    };

                    const msg = errorMessages[result?.error] || result?.error || 'Ismeretlen hiba történt.';
                    throw new Error(msg);
                  }

                  toast({
                    title: result.existing_user ? 'Könyvelő hozzáadva' : 'Meghívó elküldve',
                    description: result.existing_user
                      ? `${inviteName.trim()} már regisztrált felhasználó — hozzáadva az irodához.`
                      : `Meghívó elküldve ${inviteEmail} címre (${ROLE_LABELS[inviteRole]} szerepkörrel).`,
                  });
                  
                  setInviteOpen(false);
                  setInviteEmail('');
                  setInviteName('');
                  setInviteRole('könyvelő');
                  queryClient.invalidateQueries({ queryKey: ['accounty-team-members'] });
                } catch (err: any) {
                  toast({ title: 'Hiba', description: err.message, variant: 'destructive' });
                } finally {
                  setInviting(false);
                }
              }}
            >
              {inviting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Meghívó küldése
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Csapattag eltávolítása
            </DialogTitle>
            <DialogDescription>
              Biztosan el szeretné távolítani <strong>{memberToDelete?.name}</strong> felhasználót a csapatból?
              Ezzel törlődik az összes irodai hozzárendelése ehhez a könyvelő irodához.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Mégse</Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={async () => {
                if (!memberToDelete || !firmId) return;
                setDeleting(true);
                try {
                  const { error } = await supabase
                    .from('accounty_assignments')
                    .delete()
                    .eq('accountant_user_id', memberToDelete.id)
                    .eq('accounting_firm_id', firmId);
                  
                  if (error) throw error;

                  toast({
                    title: 'Sikeres eltávolítás',
                    description: `${memberToDelete.name} sikeresen el lett távolítva a csapatból.`,
                  });
                  setDeleteConfirmOpen(false);
                  setMemberToDelete(null);
                  queryClient.invalidateQueries({ queryKey: ['accounty-team-members'] });
                } catch (err: any) {
                  toast({
                    title: 'Hiba',
                    description: err.message || 'Nem sikerült eltávolítani a felhasználót.',
                    variant: 'destructive',
                  });
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Eltávolítás
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
