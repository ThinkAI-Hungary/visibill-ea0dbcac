import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { hu } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';
import { Plus, Trash2, FileText, ListOrdered } from 'lucide-react';
import { reportError } from '@/lib/errorReporter';

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

interface InvoiceLineItem {
  id: string;
  line_number: number;
  line_description: string | null;
  quantity: number | null;
  unit_of_measure: string | null;
  unit_price: number | null;
  net_amount: number | null;
  vat_rate: string | null;
  vat_amount: number | null;
  gross_amount: number | null;
  product_code: string | null;
}

// Editable line item with tracking
interface EditableLineItem extends InvoiceLineItem {
  _isNew?: boolean;
  _isDeleted?: boolean;
  _isDirty?: boolean;
}

interface InvoiceFullEditDialogProps {
  invoice: SubmittedInvoice | null;
  categories: Category[];
  projects: Project[];
  open: boolean;
  onClose: () => void;
  onSave: () => void;
}

const InvoiceFullEditDialog = ({ invoice, categories, projects, open, onClose, onSave }: InvoiceFullEditDialogProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('details');

  const [formData, setFormData] = useState({
    bizonylatsorszam: '',
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

  // ── Line items state ──
  const [editableItems, setEditableItems] = useState<EditableLineItem[]>([]);
  const [itemsInitialized, setItemsInitialized] = useState(false);

  // ── Fetch line items ──
  const { data: serverItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['invoiceItems', 'submitted', invoice?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoice_items')
        .select('id, line_number, line_description, product_code, quantity, unit_of_measure, unit_price, net_amount, vat_rate, vat_amount, gross_amount')
        .eq('invoice_id', invoice!.id)
        .order('line_number', { ascending: true });
      if (error) throw error;
      return (data || []) as InvoiceLineItem[];
    },
    enabled: open && !!invoice?.id,
  });

  // Initialize form data when invoice changes
  useEffect(() => {
    if (invoice && open) {
      setFormData({
        bizonylatsorszam: invoice.bizonylatsorszam || '',
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
      setItemsInitialized(false);
      setActiveTab('details');
    }
  }, [invoice, open]);

  // Initialize editable items once server data arrives
  useEffect(() => {
    if (serverItems.length > 0 && !itemsInitialized) {
      setEditableItems(serverItems.map(item => ({ ...item })));
      setItemsInitialized(true);
    } else if (serverItems.length === 0 && !itemsLoading && open && !itemsInitialized) {
      setEditableItems([]);
      setItemsInitialized(true);
    }
  }, [serverItems, itemsLoading, open, itemsInitialized]);

  // ── Line item helpers ──
  const visibleItems = useMemo(() => editableItems.filter(i => !i._isDeleted), [editableItems]);

  const updateItem = useCallback((id: string, field: keyof InvoiceLineItem, value: any) => {
    setEditableItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value, _isDirty: true };
      // Auto-calc net_amount when quantity or unit_price change
      if (field === 'quantity' || field === 'unit_price') {
        const qty = field === 'quantity' ? (value ?? 0) : (item.quantity ?? 0);
        const price = field === 'unit_price' ? (value ?? 0) : (item.unit_price ?? 0);
        updated.net_amount = Math.round(qty * price * 100) / 100;
        // Recalc gross
        updated.gross_amount = Math.round(((updated.net_amount ?? 0) + (updated.vat_amount ?? 0)) * 100) / 100;
      }
      // Auto-calc gross when net or vat change
      if (field === 'net_amount' || field === 'vat_amount') {
        const net = field === 'net_amount' ? (value ?? 0) : (item.net_amount ?? 0);
        const vat = field === 'vat_amount' ? (value ?? 0) : (item.vat_amount ?? 0);
        updated.gross_amount = Math.round((net + vat) * 100) / 100;
      }
      return updated;
    }));
  }, []);

  const addNewItem = useCallback(() => {
    const maxLineNum = editableItems.reduce((max, i) => Math.max(max, i.line_number || 0), 0);
    const newItem: EditableLineItem = {
      id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      line_number: maxLineNum + 1,
      line_description: '',
      quantity: 1,
      unit_of_measure: 'db',
      unit_price: 0,
      net_amount: 0,
      vat_rate: '27%',
      vat_amount: 0,
      gross_amount: 0,
      product_code: null,
      _isNew: true,
      _isDirty: true,
    };
    setEditableItems(prev => [...prev, newItem]);
  }, [editableItems]);

  const deleteItem = useCallback((id: string) => {
    setEditableItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      // New items: remove entirely
      if (item._isNew) return { ...item, _isDeleted: true };
      // Existing items: mark for deletion
      return { ...item, _isDeleted: true };
    }));
  }, []);

  // ── Save handler ──
  const handleSave = async () => {
    if (!invoice || !user) return;

    setIsSaving(true);
    try {
      // 1. Save invoice metadata (bizonylatsorszam + category + project)
      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({
          bizonylatsorszam: formData.bizonylatsorszam.trim() || null,
          category_id: formData.category_id === 'none' ? null : formData.category_id,
          project_id: formData.project_id === 'none' ? null : formData.project_id,
          frissitve: new Date().toISOString(),
        })
        .eq('id', invoice.id);

      if (invoiceError) {
        if (invoiceError.code === '23505') {
          throw new Error('Ezzel a bizonylatsorszámmal már létezik számla ennél a cégnél.');
        }
        throw invoiceError;
      }

      // 2. Save line items
      const toDelete = editableItems.filter(i => i._isDeleted && !i._isNew);
      const toInsert = editableItems.filter(i => i._isNew && !i._isDeleted);
      const toUpdate = editableItems.filter(i => i._isDirty && !i._isNew && !i._isDeleted);

      // Delete removed items
      if (toDelete.length > 0) {
        const { error } = await supabase
          .from('invoice_items')
          .delete()
          .in('id', toDelete.map(i => i.id));
        if (error) throw error;
      }

      // Insert new items
      if (toInsert.length > 0) {
        const { error } = await supabase
          .from('invoice_items')
          .insert(toInsert.map(i => ({
            invoice_id: invoice.id,
            line_number: i.line_number,
            line_description: i.line_description,
            quantity: i.quantity,
            unit_of_measure: i.unit_of_measure,
            unit_price: i.unit_price,
            net_amount: i.net_amount,
            vat_rate: i.vat_rate,
            vat_amount: i.vat_amount,
            gross_amount: i.gross_amount,
            product_code: i.product_code,
          })));
        if (error) throw error;
      }

      // Update modified items
      if (toUpdate.length > 0) {
        for (const item of toUpdate) {
          const { error } = await supabase
            .from('invoice_items')
            .update({
              line_number: item.line_number,
              line_description: item.line_description,
              quantity: item.quantity,
              unit_of_measure: item.unit_of_measure,
              unit_price: item.unit_price,
              net_amount: item.net_amount,
              vat_rate: item.vat_rate,
              vat_amount: item.vat_amount,
              gross_amount: item.gross_amount,
              product_code: item.product_code,
            })
            .eq('id', item.id);
          if (error) throw error;
        }
      }

      // Invalidate caches
      queryClient.invalidateQueries({ queryKey: ['invoiceItems', 'submitted', invoice.id] });
      queryClient.invalidateQueries({ queryKey: ['company-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['submittedInvoices'] });
      queryClient.invalidateQueries({ queryKey: ['nav-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['recentInvoices'] });

      toast({ title: 'Számla sikeresen frissítve' });
      onSave();
      onClose();
    } catch (error) {
      reportError({ type: 'db_query', component: 'InvoiceFullEditDialog', action: 'error', message: 'Error updating invoice:', error: error });
      toast({ title: 'Nem sikerült menteni a változtatásokat', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Number input helper ──
  const handleNumberInput = (id: string, field: keyof InvoiceLineItem, rawValue: string) => {
    const parsed = rawValue === '' ? 0 : parseFloat(rawValue.replace(',', '.'));
    if (!isNaN(parsed)) {
      updateItem(id, field, parsed);
    }
  };

  // ── Totals ──
  const itemTotals = useMemo(() => {
    const items = visibleItems;
    return {
      net: items.reduce((sum, i) => sum + (i.net_amount ?? 0), 0),
      vat: items.reduce((sum, i) => sum + (i.vat_amount ?? 0), 0),
      gross: items.reduce((sum, i) => sum + (i.gross_amount ?? 0), 0),
    };
  }, [visibleItems]);

  const formatAmount = (val: number) => val.toLocaleString('hu-HU', { maximumFractionDigits: 2 });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className={cn(
        "max-h-[85vh] overflow-hidden flex flex-col transition-all duration-200",
        activeTab === 'items' ? 'sm:max-w-5xl' : 'sm:max-w-[600px]'
      )}>
        <DialogHeader>
          <DialogTitle>Számla szerkesztése</DialogTitle>
          <DialogDescription>
            Módosítsd a számla adatait az alábbi mezők segítségével.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details" className="gap-2">
              <FileText className="h-4 w-4" />
              Számla adatok
            </TabsTrigger>
            <TabsTrigger value="items" className="gap-2">
              <ListOrdered className="h-4 w-4" />
              Számlatételek
              {visibleItems.length > 0 && (
                <span className="ml-1 text-xs bg-primary/20 text-primary rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                  {visibleItems.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Tab 1: Invoice Details ── */}
          <TabsContent value="details" className="flex-1 overflow-auto mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
              {/* Left column */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-bizonylatsorszam" className="text-foreground font-medium">
                    Bizonylatsorszám
                  </Label>
                  <Input
                    id="edit-bizonylatsorszam"
                    value={formData.bizonylatsorszam}
                    onChange={(e) => setFormData(prev => ({ ...prev, bizonylatsorszam: e.target.value }))}
                    placeholder="pl. SZJE-2026-1"
                    className="font-mono text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    A sorszám módosítása automatikusan feloldja a NAV státuszt és összekapcsolja a számlát a NAV tétellel.
                  </p>
                </div>

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
          </TabsContent>

          {/* ── Tab 2: Line Items ── */}
          <TabsContent value="items" className="flex-1 overflow-auto mt-4">
            {itemsLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                Tételek betöltése...
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead className="w-10 font-semibold">#</TableHead>
                        <TableHead className="min-w-[200px] font-semibold">Megnevezés</TableHead>
                        <TableHead className="w-[90px] font-semibold text-right">Mennyiség</TableHead>
                        <TableHead className="w-[80px] font-semibold">Egység</TableHead>
                        <TableHead className="w-[130px] font-semibold text-right">Egységár</TableHead>
                        <TableHead className="w-[130px] font-semibold text-right">Nettó</TableHead>
                        <TableHead className="w-[80px] font-semibold text-center">ÁFA</TableHead>
                        <TableHead className="w-[130px] font-semibold text-right">ÁFA összeg</TableHead>
                        <TableHead className="w-[130px] font-semibold text-right">Bruttó</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                            Nincsenek tételek. Kattints az "Új tétel" gombra az első tétel hozzáadásához.
                          </TableCell>
                        </TableRow>
                      ) : (
                        visibleItems.map((item, index) => (
                          <TableRow
                            key={item.id}
                            className={cn(
                              'h-12',
                              item._isNew && 'bg-primary/5',
                              index % 2 !== 0 && !item._isNew && 'bg-muted/10'
                            )}
                          >
                            <TableCell className="text-muted-foreground font-mono text-xs">
                              {item.line_number}
                            </TableCell>
                            <TableCell>
                              <Input
                                value={item.line_description || ''}
                                onChange={(e) => updateItem(item.id, 'line_description', e.target.value)}
                                className="h-8 text-sm border-transparent bg-transparent hover:border-border focus:border-border"
                                placeholder="Tétel megnevezése..."
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="text"
                                inputMode="decimal"
                                value={item.quantity ?? ''}
                                onChange={(e) => handleNumberInput(item.id, 'quantity', e.target.value)}
                                className="h-8 text-sm text-right font-mono border-transparent bg-transparent hover:border-border focus:border-border"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={item.unit_of_measure || ''}
                                onChange={(e) => updateItem(item.id, 'unit_of_measure', e.target.value)}
                                className="h-8 text-sm border-transparent bg-transparent hover:border-border focus:border-border"
                                placeholder="db"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="text"
                                inputMode="decimal"
                                value={item.unit_price ?? ''}
                                onChange={(e) => handleNumberInput(item.id, 'unit_price', e.target.value)}
                                className="h-8 text-sm text-right font-mono border-transparent bg-transparent hover:border-border focus:border-border"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="text"
                                inputMode="decimal"
                                value={item.net_amount ?? ''}
                                onChange={(e) => handleNumberInput(item.id, 'net_amount', e.target.value)}
                                className="h-8 text-sm text-right font-mono border-transparent bg-transparent hover:border-border focus:border-border"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={item.vat_rate || ''}
                                onChange={(e) => updateItem(item.id, 'vat_rate', e.target.value)}
                                className="h-8 text-sm text-center border-transparent bg-transparent hover:border-border focus:border-border"
                                placeholder="27%"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="text"
                                inputMode="decimal"
                                value={item.vat_amount ?? ''}
                                onChange={(e) => handleNumberInput(item.id, 'vat_amount', e.target.value)}
                                className="h-8 text-sm text-right font-mono border-transparent bg-transparent hover:border-border focus:border-border"
                              />
                            </TableCell>
                            <TableCell>
                              <div className="text-sm text-right font-mono font-medium px-2">
                                {formatAmount(item.gross_amount ?? 0)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => deleteItem(item.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Add item + Totals */}
                <div className="flex justify-between items-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={addNewItem}
                  >
                    <Plus className="h-4 w-4" />
                    Új tétel
                  </Button>

                  {visibleItems.length > 0 && (
                    <div className="bg-muted/30 rounded-lg p-4 min-w-[280px]">
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Tételek nettó:</span>
                          <span className="font-mono font-medium">{formatAmount(itemTotals.net)} {formData.penznem}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Tételek ÁFA:</span>
                          <span className="font-mono font-medium">{formatAmount(itemTotals.vat)} {formData.penznem}</span>
                        </div>
                        <div className="h-px bg-border/50 my-2" />
                        <div className="flex justify-between items-center">
                          <span className="text-foreground font-medium">Tételek bruttó:</span>
                          <span className="font-mono text-lg font-bold text-primary">
                            {formatAmount(itemTotals.gross)} {formData.penznem}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

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
