import { useCompany, Company } from '@/contexts/CompanyContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const CompanySelector = () => {
  const { companies, selectedCompany, setSelectedCompany, refreshCompanies, loading } = useCompany();
  const { user } = useAuth();
  
  // Create dialog state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyTaxNumber, setNewCompanyTaxNumber] = useState('');
  const [newCompanyAddress, setNewCompanyAddress] = useState('');
  const [isCreating, setIsCreating] = useState(false);

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
    if (company) {
      setSelectedCompany(company);
    }
  };

  const handleCreateCompany = async () => {
    if (!newCompanyName.trim() || !user) return;

    setIsCreating(true);
    try {
      const { data, error } = await supabase
        .from('companies')
        .insert({
          name: newCompanyName.trim(),
          tax_number: newCompanyTaxNumber.trim() || null,
          address: newCompanyAddress.trim() || null,
          owner_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      await refreshCompanies();
      setSelectedCompany(data);
      setNewCompanyName('');
      setNewCompanyTaxNumber('');
      setNewCompanyAddress('');
      setIsCreateDialogOpen(false);
      toast.success('Cég sikeresen létrehozva!');
    } catch (error) {
      console.error('Error creating company:', error);
      toast.error('Hiba történt a cég létrehozása során');
    } finally {
      setIsCreating(false);
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
    if (!editName.trim() || !editingCompany) return;

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
      
      // Update selected company if it was the one being edited
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
      toast.success('Cég sikeresen frissítve!');
    } catch (error) {
      console.error('Error updating company:', error);
      toast.error('Hiba történt a cég frissítése során');
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

      await refreshCompanies();
      
      // If deleted company was selected, select another one
      if (selectedCompany?.id === deletingCompany.id) {
        const remainingCompanies = companies.filter(c => c.id !== deletingCompany.id);
        setSelectedCompany(remainingCompanies.length > 0 ? remainingCompanies[0] : null);
      }
      
      setIsDeleteDialogOpen(false);
      setDeletingCompany(null);
      toast.success('Cég sikeresen törölve!');
    } catch (error) {
      console.error('Error deleting company:', error);
      toast.error('Hiba történt a cég törlése során. Lehet, hogy vannak még hozzá kapcsolódó adatok.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Betöltés...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground" />
      <Select
        value={selectedCompany?.id || ''}
        onValueChange={handleCompanyChange}
      >
        <SelectTrigger className="w-[200px] h-9">
          <SelectValue placeholder="Válassz céget" />
        </SelectTrigger>
        <SelectContent>
          {companies.map((company) => (
            <SelectItem key={company.id} value={company.id}>
              {company.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Edit button */}
      {selectedCompany && (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => openEditDialog(selectedCompany)}
          title="Cég szerkesztése"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      )}

      {/* Delete button */}
      {selectedCompany && companies.length > 1 && (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-destructive hover:text-destructive"
          onClick={() => openDeleteDialog(selectedCompany)}
          title="Cég törlése"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}

      {/* Create dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9" title="Új cég hozzáadása">
            <Plus className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Új cég hozzáadása</DialogTitle>
            <DialogDescription>
              Add meg az új cég adatait
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newCompanyName">Cég neve *</Label>
              <Input
                id="newCompanyName"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                placeholder="Pl. Példa Kft."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newTaxNumber">Adószám</Label>
              <Input
                id="newTaxNumber"
                value={newCompanyTaxNumber}
                onChange={(e) => setNewCompanyTaxNumber(e.target.value)}
                placeholder="Pl. 12345678-2-42"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newAddress">Cím</Label>
              <Input
                id="newAddress"
                value={newCompanyAddress}
                onChange={(e) => setNewCompanyAddress(e.target.value)}
                placeholder="Pl. 1234 Budapest, Példa utca 1."
              />
            </div>
            <Button
              onClick={handleCreateCompany}
              disabled={!newCompanyName.trim() || isCreating}
              className="w-full"
            >
              {isCreating ? 'Létrehozás...' : 'Cég létrehozása'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cég szerkesztése</DialogTitle>
            <DialogDescription>
              Módosítsd a cég adatait
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editName">Cég neve *</Label>
              <Input
                id="editName"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Pl. Példa Kft."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editTaxNumber">Adószám</Label>
              <Input
                id="editTaxNumber"
                value={editTaxNumber}
                onChange={(e) => setEditTaxNumber(e.target.value)}
                placeholder="Pl. 12345678-2-42"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editAddress">Cím</Label>
              <Input
                id="editAddress"
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                placeholder="Pl. 1234 Budapest, Példa utca 1."
              />
            </div>
            <Button
              onClick={handleUpdateCompany}
              disabled={!editName.trim() || isUpdating}
              className="w-full"
            >
              {isUpdating ? 'Mentés...' : 'Változások mentése'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cég törlése</AlertDialogTitle>
            <AlertDialogDescription>
              Biztosan törölni szeretnéd a(z) <strong>{deletingCompany?.name}</strong> céget? 
              Ez a művelet nem visszavonható, és a céghez kapcsolódó összes adat (számlák, projektek, bérek stb.) is törlődik.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Mégse</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCompany}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Törlés...' : 'Törlés'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CompanySelector;
