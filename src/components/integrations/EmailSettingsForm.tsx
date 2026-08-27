import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Mail, Shield, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { useEmailAccounts, CompanyEmailAccount, SaveEmailAccountForm } from '@/hooks/useEmailAccounts';
import { EmailAccountCard } from './EmailAccountCard';
import { EmailAccountDialog } from './EmailAccountDialog';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const EmailSettingsForm: React.FC = () => {
  const { selectedCompany } = useCompany();
  const { user } = useAuth();

  const { data: memberRole } = useQuery({
    queryKey: ['companyMemberRole', selectedCompany?.id, user?.id],
    queryFn: async () => {
      if (!selectedCompany?.id || !user?.id) return null;
      const { data } = await supabase
        .from('company_members')
        .select('role')
        .eq('company_id', selectedCompany.id)
        .eq('user_id', user.id)
        .maybeSingle();
      return data?.role || null;
    },
    enabled: !!selectedCompany?.id && !!user?.id,
  });

  const isOwner = selectedCompany?.owner_id === user?.id || memberRole === 'owner' || memberRole === 'admin';

  const {
    accounts,
    isLoading,
    saveMutation,
    deleteMutation,
    setDefaultMutation,
    testConnectionMutation,
  } = useEmailAccounts();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<CompanyEmailAccount | null>(null);

  const handleOpenAddDialog = () => {
    setEditingAccount(null);
    setDialogOpen(true);
  };

  const handleOpenEditDialog = (account: CompanyEmailAccount) => {
    setEditingAccount(account);
    setDialogOpen(true);
  };

  const handleSave = async (form: SaveEmailAccountForm) => {
    await saveMutation.mutateAsync(form);
  };

  const handleDelete = async (accountId: string) => {
    await deleteMutation.mutateAsync(accountId);
  };

  const handleSetDefault = async (accountId: string, type: 'smtp' | 'imap' | 'both') => {
    await setDefaultMutation.mutateAsync({ accountId, type });
  };

  const handleTestConnection = async (type: 'imap' | 'smtp', accountId?: string, config?: any) => {
    return await testConnectionMutation.mutateAsync({
      type,
      accountId,
      config: config || {
        host: '',
        port: 0,
        username: '',
        encryption: 'SSL/TLS',
      },
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4 py-8 flex flex-col items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Levelező fiókok betöltése...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Header / Info Banner */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Saját Levelező Fiókok (IMAP / SMTP)</h3>
          <p className="text-xs text-muted-foreground">
            Csatlakoztass akár több postafiókot a számlák beolvasásához és a kimenő értesítésekhez.
          </p>
        </div>

        {isOwner && (
          <Button
            size="sm"
            onClick={handleOpenAddDialog}
            className="gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Új Fiók Hozzáadása
          </Button>
        )}
      </div>

      {/* Empty State */}
      {accounts.length === 0 ? (
        <Card className="border-dashed border-2 border-border/80 bg-muted/10">
          <CardContent className="py-10 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Mail className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-sm">
              <h4 className="font-semibold text-base">Még nincs bekötött saját levelező fiók</h4>
              <p className="text-xs text-muted-foreground">
                Köss be egyedi IMAP vagy SMTP postafiókokat (pl. szamla@ceg.hu, info@ceg.hu), hogy a számlák automatikusan szinkronizálódjan invitation.
              </p>
            </div>
            {isOwner ? (
              <Button onClick={handleOpenAddDialog} size="sm" className="mt-2 gap-1.5">
                <Plus className="w-4 h-4" />
                Első Fiók Hozzáadása
              </Button>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-2">
                <AlertCircle className="w-3.5 h-3.5" />
                Csak a cég tulajdonosa köthet be új levelező fiókot.
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        /* Account List */
        <div className="space-y-3">
          {accounts.map((account) => (
            <EmailAccountCard
              key={account.id}
              account={account}
              isOwner={isOwner}
              onEdit={handleOpenEditDialog}
              onDelete={handleDelete}
              onSetDefault={handleSetDefault}
              onTestConnection={handleTestConnection}
            />
          ))}
        </div>
      )}

      {/* Add / Edit Dialog */}
      <EmailAccountDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        account={editingAccount}
        onSave={handleSave}
        onTestConnection={handleTestConnection}
        isSaving={saveMutation.isPending}
      />
    </div>
  );
};

export default EmailSettingsForm;
