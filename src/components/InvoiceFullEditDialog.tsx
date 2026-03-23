import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { hu } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';

interface Category {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
}

interface SubmittedInvoice {
  id: string;
  kibocsatas_datuma: string;
  teljesites_datuma: string | null;
  elado_nev: string;
  vevo_nev: string;
  adoalap_osszesen: number;
  brutto_vegosszeg: number;
  afa_osszeg_osszesen: number;
  penznem: string | null;
  category_id: string | null;
  project_id: string | null;
  image_url: string | null;
  melleklet_url: string | null;
}

interface InvoiceFullEditDialogProps {
  invoice: SubmittedInvoice | null;
  categories: Category[];
  projects: Project[];
  open: boolean;
  onClose: () => void;
  onSave: () => void;
}

const CURRENCIES = ['HUF', 'EUR', 'USD', 'GBP', 'CHF'];

const InvoiceFullEditDialog = ({ invoice, categories, projects, open, onClose, onSave }: InvoiceFullEditDialogProps) => {
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    kibocsatas_datuma: undefined as Date | undefined,
    teljesites_datuma: undefined as Date | undefined,
    elado_nev: '',
    vevo_nev: '',
    adoalap_osszesen: 0,
    brutto_vegosszeg: 0,
    afa_osszeg_osszesen: 0,
    penznem: 'HUF',
    category_id: 'none',
    project_id: 'none',
  });

  useEffect(() => {
    if (invoice && open) {
      setFormData({
        kibocsatas_datuma: invoice.kibocsatas_datuma ? parseISO(invoice.kibocsatas_datuma) : undefined,
        teljesites_datuma: invoice.teljesites_datuma ? parseISO(invoice.teljesites_datuma) : undefined,
        elado_nev: invoice.elado_nev || '',
        vevo_nev: invoice.vevo_nev || '',
        adoalap_osszesen: invoice.adoalap_osszesen || 0,
        brutto_vegosszeg: invoice.brutto_vegosszeg || 0,
        afa_osszeg_osszesen: invoice.afa_osszeg_osszesen || 0,
        penznem: invoice.penznem || 'HUF',
        category_id: invoice.category_id || 'none',
        project_id: invoice.project_id || 'none',
      });
    }
  }, [invoice, open]);

  const handleSave = async () => {
    if (!invoice || !user) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('invoices')
        .update({
          category_id: formData.category_id === 'none' ? null : formData.category_id,
          project_id: formData.project_id === 'none' ? null : formData.project_id,
        })
        .eq('id', invoice.id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({ title: 'Számla sikeresen frissítve' });
      onSave();
      onClose();
    } catch (error) {
      console.error('Error updating invoice:', error);
      toast({ title: 'Nem sikerült menteni a változtatásokat', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Számla szerkesztése</DialogTitle>
          <DialogDescription>
            Módosítsd a számla adatait az alábbi mezők segítségével.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          {/* Left column - Read-only fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Kibocsátás dátuma</Label>
              <div className="text-sm py-2 px-3 rounded-md bg-muted/30 border border-border/30">
                {formData.kibocsatas_datuma
                  ? format(formData.kibocsatas_datuma, "yyyy. MM. dd.", { locale: hu })
                  : "-"}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">Teljesítés dátuma</Label>
              <div className="text-sm py-2 px-3 rounded-md bg-muted/30 border border-border/30">
                {formData.teljesites_datuma
                  ? format(formData.teljesites_datuma, "yyyy. MM. dd.", { locale: hu })
                  : "-"}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">Eladó neve</Label>
              <div className="text-sm py-2 px-3 rounded-md bg-muted/30 border border-border/30 truncate">
                {formData.elado_nev || '-'}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">Vevő neve</Label>
              <div className="text-sm py-2 px-3 rounded-md bg-muted/30 border border-border/30 truncate">
                {formData.vevo_nev || '-'}
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Nettó összeg</Label>
              <div className="text-sm py-2 px-3 rounded-md bg-muted/30 border border-border/30 font-mono">
                {formData.adoalap_osszesen?.toLocaleString('hu-HU')} {formData.penznem}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">Bruttó összeg</Label>
              <div className="text-sm py-2 px-3 rounded-md bg-muted/30 border border-border/30 font-mono">
                {formData.brutto_vegosszeg?.toLocaleString('hu-HU')} {formData.penznem}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">ÁFA összeg</Label>
              <div className="text-sm py-2 px-3 rounded-md bg-muted/30 border border-border/30 font-mono">
                {formData.afa_osszeg_osszesen?.toLocaleString('hu-HU')} {formData.penznem}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">Pénznem</Label>
              <div className="text-sm py-2 px-3 rounded-md bg-muted/30 border border-border/30">
                {formData.penznem}
              </div>
            </div>

            {/* Editable: Kategória */}
            <div className="space-y-2">
              <Label>Kategória</Label>
              <Select
                value={formData.category_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, category_id: value }))}
              >
                <SelectTrigger>
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

            {/* Editable: Projekt */}
            <div className="space-y-2">
              <Label>Projekt</Label>
              <Select
                value={formData.project_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, project_id: value }))}
              >
                <SelectTrigger>
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

export default InvoiceFullEditDialog;
