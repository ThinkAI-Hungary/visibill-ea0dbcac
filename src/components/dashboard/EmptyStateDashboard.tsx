import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Euro, TrendingUp, PieChart, Building2, Plus } from 'lucide-react';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { toast } from 'sonner';

const EmptyStateDashboard = () => {
  const { user } = useAuth();
  const { refreshCompanies, setSelectedCompany } = useCompany();
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyTaxNumber, setNewCompanyTaxNumber] = useState('');
  const [newCompanyAddress, setNewCompanyAddress] = useState('');
  const [isCreating, setIsCreating] = useState(false);

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

  return (
    <div className="min-h-screen bg-background relative">
      {/* Grayed out teaser dashboard */}
      <div className="container mx-auto px-4 py-8 space-y-8 grayscale opacity-30 pointer-events-none select-none">
        {/* Welcome Section Placeholder */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold">Üdvözöljük!</h2>
            <p className="text-muted-foreground">
              Itt van a vállalkozásod teljes áttekintése
            </p>
          </div>
        </div>

        {/* Metrics Cards Placeholder */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 items-stretch">
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Összes számla</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">---</div>
              <p className="text-xs text-muted-foreground mt-1">0 feldolgozva</p>
            </CardContent>
          </Card>
          
          <Card className="overflow-hidden border-green-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Kimenő számlaösszeg (nettó)</CardTitle>
              <Euro className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0 Ft</div>
              <p className="text-xs text-muted-foreground mt-1">Kimenő számlák nettó összege</p>
            </CardContent>
          </Card>
          
          <Card className="overflow-hidden border-yellow-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Kimenő számlaösszeg (bruttó)</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0 Ft</div>
              <p className="text-xs text-muted-foreground mt-1">Kimenő számlák bruttó összege</p>
            </CardContent>
          </Card>
          
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Összesített érték</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0 Ft</div>
              <p className="text-xs text-muted-foreground mt-1">Minden számla átváltva</p>
            </CardContent>
          </Card>
          
          <Card className="overflow-hidden border-orange-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Kifizetendő ÁFA</CardTitle>
              <PieChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0 Ft</div>
              <p className="text-xs text-muted-foreground mt-1">OUTBOUND - INBOUND</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Placeholder */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>ÁFA Elemzés</CardTitle>
              <CardDescription>Havi ÁFA bontás</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[200px] flex items-center justify-center bg-muted/20 rounded-lg">
                <p className="text-muted-foreground">Grafikon helye</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Bevételek és Kiadások</CardTitle>
              <CardDescription>Éves áttekintés</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[200px] flex items-center justify-center bg-muted/20 rounded-lg">
                <p className="text-muted-foreground">Grafikon helye</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tables Placeholder */}
        <Card>
          <CardHeader>
            <CardTitle>Legutóbbi Számlák</CardTitle>
            <CardDescription>A legfrissebb bejegyzések</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[150px] flex items-center justify-center bg-muted/20 rounded-lg">
              <p className="text-muted-foreground">Nincs megjeleníthető adat</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CTA Overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
        <Card className="w-full max-w-md mx-4 border-primary/20 shadow-xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Üdvözöljük a Visibillben!</CardTitle>
            <CardDescription className="text-base mt-2">
              A statisztikák és funkciók eléréséhez regisztráld az első cégedet.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <Button 
              onClick={() => setIsCreateDialogOpen(true)} 
              className="w-full" 
              size="lg"
            >
              <Plus className="h-5 w-5 mr-2" />
              Első cég létrehozása
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Create Company Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Új cég létrehozása</DialogTitle>
            <DialogDescription>
              Add meg az új cég adatait
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="company-name">Cég neve *</Label>
              <Input
                id="company-name"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                placeholder="Pl. Példa Kft."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax-number">Adószám</Label>
              <Input
                id="tax-number"
                value={newCompanyTaxNumber}
                onChange={(e) => setNewCompanyTaxNumber(e.target.value)}
                placeholder="Pl. 12345678-2-42"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Cím</Label>
              <Input
                id="address"
                value={newCompanyAddress}
                onChange={(e) => setNewCompanyAddress(e.target.value)}
                placeholder="Pl. 1234 Budapest, Példa utca 1."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Mégse
            </Button>
            <Button onClick={handleCreateCompany} disabled={!newCompanyName.trim() || isCreating}>
              {isCreating ? 'Létrehozás...' : 'Létrehozás'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmptyStateDashboard;
