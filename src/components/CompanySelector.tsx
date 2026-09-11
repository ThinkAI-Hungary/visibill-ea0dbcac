import { useCompany, Company, VatRegime } from '@/contexts/CompanyContext';
import { useDateRange } from '@/contexts/DateRangeContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateAccountyCache } from '@/hooks/accounty/useAccountyHelpers';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { extractPageSegment, generateScopedPath } from '@/lib/navigation';
import { reportError } from '@/lib/errorReporter';
import { useTranslation } from 'react-i18next';

const CompanySelector = () => {
  const { t } = useTranslation('common');
  const queryClient = useQueryClient();
  const { companies, selectedCompany, setSelectedCompany, refreshCompanies, loading } = useCompany();
  const { dateFromFormatted, dateToFormatted } = useDateRange();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Create dialog state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyTaxNumber, setNewCompanyTaxNumber] = useState('');
  const [newCompanyAddress, setNewCompanyAddress] = useState('');
  const [newCompanyVatRegime, setNewCompanyVatRegime] = useState<VatRegime>('normal');
  const [isCreating, setIsCreating] = useState(false);

  // Join state
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  // Edit dialog state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [editName, setEditName] = useState('');
  const [editTaxNumber, setEditTaxNumber] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Delete dialog state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingCompany, setDeletingCompany] = useState<Company | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCompanyChange = (companyId: string) => {
    const company = companies.find(c => c.id === companyId);
    if (!company || company.id === selectedCompany?.id) return;

    const page = extractPageSegment(location.pathname);
    const newPath =
      generateScopedPath(
        company.id,
        dateFromFormatted,
        dateToFormatted,
        page === '/' ? '' : page.slice(1),
      ) + location.search + location.hash;

    setSelectedCompany(company);
    navigate(newPath, { replace: true });
  };

  const handleCreateCompany = async () => {
    if (!newCompanyName.trim() || !newCompanyTaxNumber.trim() || !user) {
      if (!newCompanyName.trim()) toast({ title: 'A cég neve kötelező!', variant: 'destructive' });
      if (!newCompanyTaxNumber.trim()) toast({ title: 'Az adószám kötelező!', variant: 'destructive' });
      return;
    }

    setIsCreating(true);
    try {
      const { error } = await supabase
        .from('companies')
        .insert({
          name: newCompanyName.trim(),
          tax_number: newCompanyTaxNumber.trim() || null,
          address: newCompanyAddress.trim() || null,
          owner_id: user.id,
          vat_regime: newCompanyVatRegime,
          vat_regime_effective_from: `${new Date().getFullYear()}-01-01`,
        });

      if (error) throw error;

      await refreshCompanies();
      invalidateAccountyCache(queryClient, ['clients', 'missing', 'deadlines']);
      queryClient.invalidateQueries({ queryKey: ['accounty-my-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });

      setNewCompanyName('');
      setNewCompanyTaxNumber('');
      setNewCompanyAddress('');
      setNewCompanyVatRegime('normal');
      setIsCreateDialogOpen(false);
      toast({ title: 'Cég sikeresen létrehozva!' });
    } catch (error: any) {
      reportError({ type: 'db_query', component: 'CompanySelector', action: 'error', message: 'Error creating company:', error: error });
      const msg = error?.message || error?.details || JSON.stringify(error);
      toast({ title: 'Hiba történt a cég létrehozása során', description: msg, variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinCompany = async () => {
    if (!joinCode.trim()) {
      toast({ title: 'A csatlakozási kód kötelező!', variant: 'destructive' });
      return;
    }

    setIsJoining(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('join-company', {
        body: { share_token: joinCode.trim() },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.error === 'already_member') {
        toast({ title: 'Már tagja vagy ennek a cégnek!', variant: 'destructive' });
        return;
      }
      if (data?.error === 'invalid_code') {
        toast({ title: 'Érvénytelen csatlakozási kód!', variant: 'destructive' });
        return;
      }
      if (data?.error === 'token_expired') {
        toast({ title: 'A csatlakozási kód lejárt! Kérj új kódot a cég tulajdonosától.', variant: 'destructive' });
        return;
      }
      if (data?.error) {
        toast({ title: data.error, variant: 'destructive' });
        return;
      }

      await refreshCompanies();
      if (data?.company) {
        setSelectedCompany(data.company);
      }
      setJoinCode('');
      setIsCreateDialogOpen(false);
      toast({ title: 'Sikeresen csatlakoztál a céghez!' });
    } catch (error: any) {
      reportError({ type: 'db_query', component: 'CompanySelector', action: 'error', message: 'Error joining company:', error: error });
      const msg = error?.message || error?.details || JSON.stringify(error);
      toast({ title: 'Hiba történt a csatlakozás során', description: msg, variant: 'destructive' });
    } finally {
      setIsJoining(false);
    }
  };

  const openEditDialog = (company: Company) => {
    setEditingCompany(company);
    setEditName(company.name);
    setEditTaxNumber(company.tax_number || '');
    setEditAddress(company.address || '');
    setIsEditDialogOpen(true);
  };

  const handleUpdateCompany = async () => {
    if (!editName.trim() || !editTaxNumber.trim() || !editingCompany) {
      if (!editName.trim()) toast({ title: 'A cég neve kötelező!', variant: 'destructive' });
      if (!editTaxNumber.trim()) toast({ title: 'Az adószám kötelező!', variant: 'destructive' });
      return;
    }

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('companies')
        .update({
          name: editName.trim(),
          tax_number: editTaxNumber.trim() || null,
          address: editAddress.trim() || null,
        })
        .eq('id', editingCompany.id);

      if (error) throw error;

      await refreshCompanies();
      if (selectedCompany?.id === editingCompany.id) {
        setSelectedCompany({
          ...editingCompany,
          name: editName.trim(),
          tax_number: editTaxNumber.trim() || null,
          address: editAddress.trim() || null,
        });
      }
      
      setIsEditDialogOpen(false);
      setEditingCompany(null);
      toast({ title: 'Cég sikeresen frissítve!' });
    } catch (error: any) {
      reportError({ type: 'db_query', component: 'CompanySelector', action: 'error', message: 'Error updating company:', error: error });
      const msg = error?.message || error?.details || JSON.stringify(error);
      toast({ title: 'Hiba történt a cég frissítése során', description: msg, variant: 'destructive' });
    } finally {
      setIsUpdating(false);
    }
  };

  const openDeleteDialog = (company: Company) => {
    setDeletingCompany(company);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteCompany = async () => {
    if (!deletingCompany) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', deletingCompany.id);

      if (error) throw error;

      setIsDeleteDialogOpen(false);
      setDeletingCompany(null);

      await refreshCompanies();
      const remainingCompanies = companies.filter(c => c.id !== deletingCompany.id);

      if (remainingCompanies.length > 0) {
        // Switch to another company
        if (selectedCompany?.id === deletingCompany.id) {
          setSelectedCompany(remainingCompanies[0]);
          const page = extractPageSegment(location.pathname);
          const newPath = generateScopedPath(
            remainingCompanies[0].id,
            dateFromFormatted,
            dateToFormatted,
            page === '/' ? '' : page.slice(1),
          );
          navigate(newPath, { replace: true });
        }
      } else {
        // No companies left — clear selection and go to root (onboarding)
        setSelectedCompany(null);
        localStorage.removeItem('visibill_selected_company_id');
        navigate('/', { replace: true });
      }

      toast({ title: 'Cég sikeresen törölve!' });
    } catch (error: any) {
      reportError({ type: 'db_query', component: 'CompanySelector', action: 'error', message: 'Error deleting company:', error: error });
      const msg = error?.message || error?.details || JSON.stringify(error);
      toast({ title: 'Hiba történt a cég törlése során', description: msg || 'Lehet, hogy vannak még hozzá kapcsolódó adatok.', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{t('company_selector.loading')}</span>
      </div>
    );
  }

  const hasNoCompanies = companies.length === 0;

  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground" />
      {hasNoCompanies ? (
        <div className="flex-1 px-3 py-2 text-sm text-muted-foreground bg-muted/30 rounded-md border border-dashed">
          {t('company_selector.no_company')}
        </div>
      ) : (
        <Select
          value={selectedCompany?.id || ''}
          onValueChange={handleCompanyChange}
        >
          <SelectTrigger className="min-w-[140px] max-w-[220px] h-9 [&>span]:text-left [&>span]:flex-1">
            <SelectValue placeholder={t('company_selector.choose_company')}>
              {selectedCompany?.name}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {companies.map((company) => (
              <SelectItem key={company.id} value={company.id}>
                {company.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {selectedCompany && (
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => openEditDialog(selectedCompany)} title={t('company_selector.edit_company')}>
          <Pencil className="h-4 w-4" />
        </Button>
      )}

      {selectedCompany && selectedCompany.owner_id === user?.id && (
        <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:text-destructive" onClick={() => openDeleteDialog(selectedCompany)} title={t('company_selector.delete_company')}>
          <Trash2 className="h-4 w-4" />
        </Button>
      )}

      {/* Create / Join dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9" title={t('company_selector.add_company')}>
            <Plus className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('company_selector.dialog_title')}</DialogTitle>
            <DialogDescription>{t('company_selector.dialog_desc')}</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="create" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create">{t('company_selector.tab_create')}</TabsTrigger>
              <TabsTrigger value="join">{t('company_selector.tab_join')}</TabsTrigger>
            </TabsList>
            <TabsContent value="create" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="newCompanyName">{t('company_selector.name_label')}</Label>
                <Input id="newCompanyName" value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} placeholder="Pl. Példa Kft." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newTaxNumber">{t('company_selector.tax_label')}</Label>
                <Input id="newTaxNumber" value={newCompanyTaxNumber} onChange={(e) => setNewCompanyTaxNumber(e.target.value)} placeholder="Pl. 12345678-2-42" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newAddress">{t('company_selector.address_label')}</Label>
                <Input id="newAddress" value={newCompanyAddress} onChange={(e) => setNewCompanyAddress(e.target.value)} placeholder="Pl. 1234 Budapest, Példa utca 1." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newVatRegime">{t('company_selector.vat_regime_label')}</Label>
                <Select value={newCompanyVatRegime} onValueChange={(v) => setNewCompanyVatRegime(v as VatRegime)}>
                  <SelectTrigger id="newVatRegime">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">{t('company_selector.vat_regime_normal')}</SelectItem>
                    <SelectItem value="penzforgalmi">{t('company_selector.vat_regime_cash')}</SelectItem>
                    <SelectItem value="alanyi_mentes">{t('company_selector.vat_regime_exempt')}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t('company_selector.vat_regime_hint')}</p>
              </div>
              <Button onClick={handleCreateCompany} disabled={!newCompanyName.trim() || !newCompanyTaxNumber.trim() || isCreating} className="w-full">
                {isCreating ? t('company_selector.creating') : t('company_selector.create_button')}
              </Button>
            </TabsContent>
            <TabsContent value="join" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="joinCode">{t('company_selector.join_code_label')}</Label>
                <Input id="joinCode" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="Pl. ABC123" maxLength={6} className="text-center text-lg tracking-widest font-mono" />
                <p className="text-sm text-muted-foreground">{t('company_selector.join_code_hint')}</p>
              </div>
              <Button onClick={handleJoinCompany} disabled={!joinCode.trim() || isJoining} className="w-full">
                {isJoining ? t('company_selector.joining') : t('company_selector.join_button')}
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('company_selector.edit_company')}</DialogTitle>
            <DialogDescription>{t('company_selector.edit_desc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editName">{t('company_selector.name_label')}</Label>
              <Input id="editName" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Pl. Példa Kft." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editTaxNumber">{t('company_selector.tax_label')}</Label>
              <Input id="editTaxNumber" value={editTaxNumber} onChange={(e) => setEditTaxNumber(e.target.value)} placeholder="Pl. 12345678-2-42" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editAddress">{t('company_selector.address_label')}</Label>
              <Input id="editAddress" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} placeholder="Pl. 1234 Budapest, Példa utca 1." />
            </div>
            <Button onClick={handleUpdateCompany} disabled={!editName.trim() || !editTaxNumber.trim() || isUpdating} className="w-full">
              {isUpdating ? t('company_selector.creating') : t('company_selector.save_changes')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('company_selector.delete_company')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('company_selector.delete_confirm', { name: deletingCompany?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCompany} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? t('company_selector.creating') : t('actions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CompanySelector;
