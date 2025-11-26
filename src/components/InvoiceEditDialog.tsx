import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Invoice } from '@/types/invoices';
import { toast } from 'sonner';

interface Category {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
}

interface InvoiceEditDialogProps {
  invoice: Invoice | null;
  categories: Category[];
  projects: Project[];
  open: boolean;
  onClose: () => void;
  onSave: () => void;
}

const InvoiceEditDialog = ({ invoice, categories, projects, open, onClose, onSave }: InvoiceEditDialogProps) => {
  const { user } = useAuth();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [isPaid, setIsPaid] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (invoice && open) {
      setSelectedCategoryId(invoice.category_id || 'none');
      setSelectedProjectId(invoice.project_id || 'none');
      setIsPaid(invoice.fizetve || false);
    }
  }, [invoice, open]);

  const handleSave = async () => {
    if (!invoice || !user) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('invoices')
        .update({
          category_id: selectedCategoryId === 'none' ? null : selectedCategoryId || null,
          project_id: selectedProjectId === 'none' ? null : selectedProjectId || null,
          fizetve: isPaid,
        })
        .eq('id', invoice.id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success('Számla sikeresen frissítve');
      onSave();
      onClose();
    } catch (error) {
      console.error('Error updating invoice:', error);
      toast.error('Nem sikerült menteni a változtatásokat');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Számla szerkesztése</DialogTitle>
          <DialogDescription>
            Módosítsd a számla kategóriáját, projektjét vagy fizetési státuszát.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="category">Kategória</Label>
            <Select
              value={selectedCategoryId}
              onValueChange={setSelectedCategoryId}
            >
              <SelectTrigger id="category">
                <SelectValue placeholder="Válassz kategóriát" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nincs kategória</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project">Projekt</Label>
            <Select
              value={selectedProjectId}
              onValueChange={setSelectedProjectId}
            >
              <SelectTrigger id="project">
                <SelectValue placeholder="Válassz projektet" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nincs projekt</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="paid"
              checked={isPaid}
              onCheckedChange={(checked) => setIsPaid(checked as boolean)}
            />
            <Label
              htmlFor="paid"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Fizetve
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Mégse
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Mentés...' : 'Mentés'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceEditDialog;
