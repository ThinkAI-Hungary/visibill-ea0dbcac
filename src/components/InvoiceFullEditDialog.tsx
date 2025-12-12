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
import { toast } from 'sonner';

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

    // Validation
    if (!formData.kibocsatas_datuma) {
      toast.error('A kibocsátás dátuma kötelező');
      return;
    }
    if (!formData.elado_nev.trim()) {
      toast.error('Az eladó neve kötelező');
      return;
    }
    if (!formData.vevo_nev.trim()) {
      toast.error('A vevő neve kötelező');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('invoices')
        .update({
          kibocsatas_datuma: format(formData.kibocsatas_datuma, 'yyyy-MM-dd'),
          teljesites_datuma: formData.teljesites_datuma ? format(formData.teljesites_datuma, 'yyyy-MM-dd') : null,
          elado_nev: formData.elado_nev.trim(),
          vevo_nev: formData.vevo_nev.trim(),
          adoalap_osszesen: formData.adoalap_osszesen,
          brutto_vegosszeg: formData.brutto_vegosszeg,
          afa_osszeg_osszesen: formData.afa_osszeg_osszesen,
          penznem: formData.penznem,
          category_id: formData.category_id === 'none' ? null : formData.category_id,
          project_id: formData.project_id === 'none' ? null : formData.project_id,
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
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Számla szerkesztése</DialogTitle>
          <DialogDescription>
            Módosítsd a számla adatait az alábbi mezők segítségével.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          {/* Left column */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Kibocsátás dátuma *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.kibocsatas_datuma && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.kibocsatas_datuma 
                      ? format(formData.kibocsatas_datuma, "yyyy. MM. dd.", { locale: hu }) 
                      : "Válassz dátumot"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.kibocsatas_datuma}
                    onSelect={(date) => setFormData(prev => ({ ...prev, kibocsatas_datuma: date }))}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Teljesítés dátuma</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.teljesites_datuma && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.teljesites_datuma 
                      ? format(formData.teljesites_datuma, "yyyy. MM. dd.", { locale: hu }) 
                      : "Válassz dátumot"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.teljesites_datuma}
                    onSelect={(date) => setFormData(prev => ({ ...prev, teljesites_datuma: date }))}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="elado_nev">Eladó neve *</Label>
              <Input
                id="elado_nev"
                value={formData.elado_nev}
                onChange={(e) => setFormData(prev => ({ ...prev, elado_nev: e.target.value }))}
                placeholder="Eladó neve"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vevo_nev">Vevő neve *</Label>
              <Input
                id="vevo_nev"
                value={formData.vevo_nev}
                onChange={(e) => setFormData(prev => ({ ...prev, vevo_nev: e.target.value }))}
                placeholder="Vevő neve"
              />
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="adoalap">Nettó összeg</Label>
              <Input
                id="adoalap"
                type="number"
                min="0"
                step="0.01"
                value={formData.adoalap_osszesen}
                onChange={(e) => setFormData(prev => ({ ...prev, adoalap_osszesen: parseFloat(e.target.value) || 0 }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="brutto">Bruttó összeg</Label>
              <Input
                id="brutto"
                type="number"
                min="0"
                step="0.01"
                value={formData.brutto_vegosszeg}
                onChange={(e) => setFormData(prev => ({ ...prev, brutto_vegosszeg: parseFloat(e.target.value) || 0 }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="afa">ÁFA összeg</Label>
              <Input
                id="afa"
                type="number"
                min="0"
                step="0.01"
                value={formData.afa_osszeg_osszesen}
                onChange={(e) => setFormData(prev => ({ ...prev, afa_osszeg_osszesen: parseFloat(e.target.value) || 0 }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Pénznem</Label>
              <Select
                value={formData.penznem}
                onValueChange={(value) => setFormData(prev => ({ ...prev, penznem: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Válassz pénznemet" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((currency) => (
                    <SelectItem key={currency} value={currency}>
                      {currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
