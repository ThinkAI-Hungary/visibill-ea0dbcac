import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Invoice } from '@/types/invoices';
import { toast } from '@/hooks/use-toast';
import { getPaymentStatusBadge } from '@/hooks/useComputedStatus';
import { reportError } from '@/lib/errorReporter';

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
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (invoice && open) {
      setSelectedCategoryId(invoice.category_id || 'none');
      setSelectedProjectId(invoice.project_id || 'none');
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
        })
        .eq('id', invoice.id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({ title: 'Számla sikeresen frissítve' });
      onSave();
      onClose();
    } catch (error) {
      reportError({ type: 'db_query', component: 'InvoiceEditDialog', action: 'error', message: 'Error updating invoice:', error: error });
      toast({ title: 'Nem sikerült menteni a változtatásokat', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const paymentBadge = invoice ? getPaymentStatusBadge(invoice.transaction_id) : null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Számla szerkesztése</DialogTitle>
          <DialogDescription>
            Módosítsd a számla kategóriáját vagy projektjét.
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

          <div className="space-y-2">
            <Label>Fizetési státusz</Label>
            <div>
              {paymentBadge && (
                <Badge variant="outline" className={paymentBadge.className}>
                  {paymentBadge.label}
                </Badge>
              )}
            </div>
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
