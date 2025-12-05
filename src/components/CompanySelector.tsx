import { useCompany } from '@/contexts/CompanyContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const CompanySelector = () => {
  const { companies, selectedCompany, setSelectedCompany, refreshCompanies, loading } = useCompany();
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyTaxNumber, setNewCompanyTaxNumber] = useState('');
  const [isCreating, setIsCreating] = useState(false);

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
          owner_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      await refreshCompanies();
      setSelectedCompany(data);
      setNewCompanyName('');
      setNewCompanyTaxNumber('');
      setIsDialogOpen(false);
      toast.success('Cég sikeresen létrehozva!');
    } catch (error) {
      console.error('Error creating company:', error);
      toast.error('Hiba történt a cég létrehozása során');
    } finally {
      setIsCreating(false);
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <Plus className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Új cég hozzáadása</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Cég neve *</Label>
              <Input
                id="companyName"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                placeholder="Pl. Példa Kft."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxNumber">Adószám</Label>
              <Input
                id="taxNumber"
                value={newCompanyTaxNumber}
                onChange={(e) => setNewCompanyTaxNumber(e.target.value)}
                placeholder="Pl. 12345678-2-42"
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
    </div>
  );
};

export default CompanySelector;
