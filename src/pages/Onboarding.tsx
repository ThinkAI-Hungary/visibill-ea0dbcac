import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { Plus, X, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog';
import { reportError } from '@/lib/errorReporter';
import { useEaisybillPermissions } from '@/hooks/useEaisybillPermissions';
import { CategoryDonutChart } from '@/components/CategoryDonutChart';
import { CategoryAccordionItem, type CategoryInvoice } from '@/components/CategoryAccordionItem';
import { IconPicker, ColorPicker, DEFAULT_CATEGORY_COLOR, resolveIcon } from '@/components/IconPicker';
import { FolderOpen } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Category {
  id?: string;
  name: string;
  description: string;
  icon: string | null;
  color: string | null;
}

interface CategoryStats {
  invoiceCount: number;
  totalAmount: number;
  invoices: CategoryInvoice[];
}

const CategoryPageSkeleton = () => {
  return (
    <div className="p-6 max-w-[900px] mx-auto page-animate">
      {/* Page header skeleton */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="h-8 w-36 bg-muted rounded animate-pulse" />
          <div className="h-4 w-96 bg-muted rounded animate-pulse mt-2" />
        </div>
        <div className="h-9 w-32 bg-muted rounded animate-pulse" />
      </div>

      {/* Donut chart summary skeleton */}
      <div className="mb-6 p-6 border border-border rounded-lg bg-card shadow-sm flex items-center gap-12">
        {/* Circle shape */}
        <div className="relative w-36 h-36 flex items-center justify-center flex-shrink-0">
          <div className="w-32 h-32 rounded-full border-[14px] border-muted animate-pulse" />
          <div className="absolute flex flex-col items-center justify-center">
            <div className="h-6 w-8 bg-muted rounded animate-pulse mb-1" />
            <div className="h-3 w-12 bg-muted rounded animate-pulse" />
          </div>
        </div>

        {/* Legend grid */}
        <div className="flex-1 grid grid-cols-2 gap-x-8 gap-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between text-xs py-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-muted animate-pulse" />
                <div className="h-4 w-28 bg-muted rounded animate-pulse" />
              </div>
              <div className="h-4 w-8 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>

      {/* Accordion list skeleton */}
      <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
        {/* Column header skeleton */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-muted/20">
          <div className="w-4 h-4 bg-muted rounded animate-pulse flex-shrink-0" />
          <div className="w-8 h-8 bg-muted rounded animate-pulse flex-shrink-0" />
          <div className="h-4 w-12 bg-muted rounded animate-pulse flex-1" />
          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="w-14 h-4 bg-muted rounded animate-pulse text-center" />
            <div className="w-12 h-4 bg-muted rounded animate-pulse text-right" />
            <div className="w-28 h-4 bg-muted rounded animate-pulse text-right" />
          </div>
          <div className="w-[60px] h-4 bg-muted rounded animate-pulse text-center" />
        </div>

        {/* List items skeleton */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-4 border-b border-border last:border-b-0">
            {/* Arrow */}
            <div className="w-4 h-4 bg-muted rounded animate-pulse flex-shrink-0" />
            
            {/* Icon */}
            <div className="w-8 h-8 bg-muted rounded-lg animate-pulse flex-shrink-0" />
            
            {/* Name + tags */}
            <div className="flex-1">
              <div className="h-4 w-32 bg-muted rounded animate-pulse" />
              <div className="flex gap-1 mt-2">
                <div className="h-4 w-10 bg-muted rounded animate-pulse" />
                <div className="h-4 w-12 bg-muted rounded animate-pulse" />
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 flex-shrink-0">
              {/* Progress bar */}
              <div className="w-14 h-1.5 bg-muted rounded-full animate-pulse" />

              {/* Count */}
              <div className="w-12 h-4 bg-muted rounded animate-pulse text-right" />

              {/* Amount */}
              <div className="w-28 h-4 bg-muted rounded animate-pulse text-right" />
            </div>

            {/* Actions */}
            <div className="flex gap-1 flex-shrink-0">
              <div className="w-7 h-7 bg-muted rounded animate-pulse" />
              <div className="w-7 h-7 bg-muted rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Onboarding = () => {
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryStats, setCategoryStats] = useState<Record<string, CategoryStats>>({});
  const [selectedCategoryForModal, setSelectedCategoryForModal] = useState<string | null>(null);
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [modalCurrentPage, setModalCurrentPage] = useState(1);
  const [activeDonutIndex, setActiveDonutIndex] = useState<number | null>(null);
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const { canWrite: canWriteModule } = useEaisybillPermissions();
  const writable = canWriteModule('categories');
  
  // Edit dialog state
  const [editingCategory, setEditingCategory] = useState<{ index: number; category: Category } | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('FolderOpen');
  const [editColor, setEditColor] = useState(DEFAULT_CATEGORY_COLOR);
  const [editTags, setEditTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  
  // New category dialog
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('FolderOpen');
  const [newColor, setNewColor] = useState(DEFAULT_CATEGORY_COLOR);
  const [newTags, setNewTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');

  // Delete confirmation state
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);

  // Invoice search state (per category)
  const [searchResults, setSearchResults] = useState<Record<string, CategoryInvoice[]>>({});

  // Track initial state for unsaved changes detection
  const [initialCategories, setInitialCategories] = useState<Category[] | null>(null);
  
  const hasUnsavedChanges = useMemo(() => {
    if (!initialCategories || initialLoading) return false;
    if (categories.length !== initialCategories.length) return true;
    for (let i = 0; i < categories.length; i++) {
      const current = categories[i];
      const initial = initialCategories[i];
      if (!initial) return true;
      if (current.name !== initial.name || current.description !== initial.description || current.id !== initial.id) return true;
    }
    return false;
  }, [categories, initialCategories, initialLoading]);
  
  const { showDialog, confirmNavigation, cancelNavigation } = useUnsavedChanges(hasUnsavedChanges);

  // Load existing data + stats
  const loadData = useCallback(async () => {
    if (!user || !selectedCompany) return;
    
    try {
      // Load categories
      const { data: categoryData } = await supabase
        .from('categories')
        .select('id, name, description, icon, color')
        .eq('company_id', selectedCompany.id)
        .order('created_at', { ascending: true });

      let loadedCategories: Category[];
      if (categoryData && categoryData.length > 0) {
        loadedCategories = categoryData.map(c => ({
          id: c.id,
          name: c.name,
          description: c.description || '',
          icon: c.icon || null,
          color: c.color || null,
        }));
      } else {
        loadedCategories = [];

      }
      setCategories(loadedCategories);
      setInitialCategories(loadedCategories.map(c => ({ ...c })));

      // Load invoice stats per category
      const stats: Record<string, CategoryStats> = {};
      
      for (const cat of loadedCategories) {
        if (!cat.id) continue;
        
        const { data: invoices } = await supabase
          .from('nav_invoices')
          .select('id, invoice_number, invoice_direction, supplier_name, invoice_issue_date, invoice_gross_amount')
          .eq('company_id', selectedCompany.id)
          .eq('category_id', cat.id)
          .order('invoice_issue_date', { ascending: false });
        
        const invList = (invoices || []) as CategoryInvoice[];
        stats[cat.id] = {
          invoiceCount: invList.length,
          totalAmount: invList.reduce((sum, inv) => sum + (inv.invoice_gross_amount || 0), 0),
          invoices: invList,
        };
      }
      
      setCategoryStats(stats);
    } catch (error) {
      reportError({ type: 'db_query', component: 'Onboarding', action: 'error', message: 'Error loading data:', error });
      setCategories([]);
      setInitialCategories([]);
    } finally {
      setInitialLoading(false);
    }
  }, [user, selectedCompany]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Computed totals
  const totalInvoices = useMemo(() => 
    Object.values(categoryStats).reduce((sum, s) => sum + s.invoiceCount, 0), 
    [categoryStats]
  );
  const totalAmount = useMemo(() => 
    Object.values(categoryStats).reduce((sum, s) => sum + s.totalAmount, 0), 
    [categoryStats]
  );

  // Donut chart data
  const donutStats = useMemo(() => 
    categories.map((cat) => ({
      name: cat.name || 'Névtelen',
      invoiceCount: cat.id ? (categoryStats[cat.id]?.invoiceCount || 0) : 0,
      totalAmount: cat.id ? (categoryStats[cat.id]?.totalAmount || 0) : 0,
      color: cat.color || DEFAULT_CATEGORY_COLOR,
    })),
    [categories, categoryStats]
  );

  // Toggle category -> Open popup details modal
  const toggleCategory = (catId: string) => {
    setSelectedCategoryForModal(catId);
    setModalCurrentPage(1);
  };

  // Close details modal
  const closeDetailsModal = () => {
    if (selectedCategoryForModal) {
      setSearchResults(prev => ({ ...prev, [selectedCategoryForModal]: [] }));
    }
    setModalSearchQuery('');
    setSelectedCategoryForModal(null);
    setActiveDonutIndex(null);
    setModalCurrentPage(1);
  };

  // Donut segment click -> Open details modal
  const handleDonutClick = (index: number) => {
    setActiveDonutIndex(prev => prev === index ? null : index);
    const cat = categories[index];
    if (cat?.id) {
      setSelectedCategoryForModal(cat.id);
      setModalCurrentPage(1);
    }
  };

  // Remove invoice from category
  const handleRemoveInvoice = async (invoiceId: string, categoryId: string) => {
    try {
      const { error } = await supabase
        .from('nav_invoices')
        .update({ category_id: null })
        .eq('id', invoiceId);
      
      if (error) throw error;
      
      // Update local state
      setCategoryStats(prev => {
        const stats = { ...prev };
        if (stats[categoryId]) {
          const newInvoices = stats[categoryId].invoices.filter(inv => inv.id !== invoiceId);
          stats[categoryId] = {
            invoiceCount: newInvoices.length,
            totalAmount: newInvoices.reduce((sum, inv) => sum + (inv.invoice_gross_amount || 0), 0),
            invoices: newInvoices,
          };
        }
        return stats;
      });
      
      toast({ title: 'Számla eltávolítva a kategóriából' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Hiba', description: error.message });
    }
  };

  // Search unassigned invoices for a category
  const handleSearchInvoice = async (query: string, categoryId: string) => {
    if (!query.trim() || !selectedCompany) {
      setSearchResults(prev => ({ ...prev, [categoryId]: [] }));
      return;
    }

    try {
      const { data } = await supabase
        .from('nav_invoices')
        .select('id, invoice_number, invoice_direction, supplier_name, invoice_issue_date, invoice_gross_amount')
        .eq('company_id', selectedCompany.id)
        .is('category_id', null)
        .or(`invoice_number.ilike.%${query}%,supplier_name.ilike.%${query}%`)
        .limit(10);

      setSearchResults(prev => ({ ...prev, [categoryId]: (data || []) as CategoryInvoice[] }));
    } catch (error) {
      reportError({ type: 'db_query', component: 'Onboarding', action: 'error', message: 'Search error', error });
    }
  };

  // Add invoice to a category
  const handleAddInvoice = async (invoiceId: string, categoryId: string) => {
    try {
      const { error } = await supabase
        .from('nav_invoices')
        .update({ category_id: categoryId })
        .eq('id', invoiceId);

      if (error) throw error;

      // Get the invoice data from search results to add to local state
      const allResults = Object.values(searchResults).flat();
      const invoice = allResults.find(inv => inv.id === invoiceId);

      if (invoice) {
        setCategoryStats(prev => {
          const stats = { ...prev };
          const current = stats[categoryId] || { invoiceCount: 0, totalAmount: 0, invoices: [] };
          const newInvoices = [...current.invoices, invoice];
          stats[categoryId] = {
            invoiceCount: newInvoices.length,
            totalAmount: newInvoices.reduce((sum, inv) => sum + (inv.invoice_gross_amount || 0), 0),
            invoices: newInvoices,
          };
          return stats;
        });
      }

      // Clear search results for this category
      setSearchResults(prev => ({ ...prev, [categoryId]: [] }));
      toast({ title: 'Számla hozzárendelve a kategóriához' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Hiba', description: error.message });
    }
  };

  // Edit category dialog
  const openEditDialog = (index: number) => {
    const cat = categories[index];
    setEditingCategory({ index, category: cat });
    setEditName(cat.name);
    setEditIcon(cat.icon || 'FolderOpen');
    setEditColor(cat.color || DEFAULT_CATEGORY_COLOR);
    setEditTags(cat.description ? cat.description.split(',').map(t => t.trim()).filter(Boolean) : []);
    setTagInput('');
  };

  const handleEditSave = async () => {
    if (!editingCategory || !user || !selectedCompany) return;
    
    const updatedCategories = [...categories];
    const newDescription = editTags.join(', ');
    updatedCategories[editingCategory.index] = {
      ...updatedCategories[editingCategory.index],
      name: editName,
      description: newDescription,
      icon: editIcon,
      color: editColor,
    };
    
    // If existing, save immediately
    const cat = updatedCategories[editingCategory.index];
    if (cat.id) {
      try {
        const { error } = await supabase
          .from('categories')
          .update({ name: editName, description: newDescription, icon: editIcon, color: editColor })
          .eq('id', cat.id)
          .eq('company_id', selectedCompany.id);
        
        if (error) throw error;
        toast({ title: 'Kategória mentve!' });
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Mentés sikertelen', description: error.message });
        return;
      }
    }
    
    setCategories(updatedCategories);
    setInitialCategories(updatedCategories.map(c => ({ ...c })));
    setEditingCategory(null);
  };

  // Delete category
  const confirmDeleteCategory = (index: number) => {
    setDeletingIndex(index);
  };

  const handleDeleteCategory = async () => {
    if (deletingIndex === null) return;
    const index = deletingIndex;
    const cat = categories[index];
    if (!selectedCompany) return;
    
    if (cat.id) {
      try {
        // Remove category from invoices first
        await supabase
          .from('nav_invoices')
          .update({ category_id: null })
          .eq('category_id', cat.id);
        
        // Also handle 'invoices' table references
        await supabase
          .from('invoices')
          .update({ category_id: null })
          .eq('category_id', cat.id);
        
        const { error } = await supabase
          .from('categories')
          .delete()
          .eq('id', cat.id)
          .eq('company_id', selectedCompany.id);
        
        if (error) throw error;
        
        toast({ title: 'Kategória törölve' });
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Törlés sikertelen', description: error.message });
        return;
      }
    }
    
    const updated = categories.filter((_, i) => i !== index);
    setCategories(updated);
    setInitialCategories(updated.map(c => ({ ...c })));
    
    // Remove from stats
    if (cat.id) {
      setCategoryStats(prev => {
        const next = { ...prev };
        delete next[cat.id!];
        return next;
      });
    }
    setDeletingIndex(null);
  };

  // New category dialog
  const handleNewCategorySave = async () => {
    if (!newName.trim() || !user || !selectedCompany) return;
    
    try {
      const { data, error } = await supabase
        .from('categories')
        .insert({
          user_id: user.id,
          company_id: selectedCompany.id,
          name: newName.trim(),
          description: newTags.join(', '),
          icon: newIcon,
          color: newColor,
        })
        .select('id, name, description, icon, color')
        .single();
      
      if (error) throw error;
      
      const newCat: Category = {
        id: data.id,
        name: data.name,
        description: data.description || '',
        icon: data.icon || null,
        color: data.color || null,
      };
      
      const updatedCategories = [...categories, newCat];
      setCategories(updatedCategories);
      setInitialCategories(updatedCategories.map(c => ({ ...c })));
      
      // Init stats for new category
      setCategoryStats(prev => ({
        ...prev,
        [data.id]: { invoiceCount: 0, totalAmount: 0, invoices: [] },
      }));
      
      setShowNewDialog(false);
      setNewName('');
      setNewIcon('FolderOpen');
      setNewColor(DEFAULT_CATEGORY_COLOR);
      setNewTags([]);
      setNewTagInput('');
      
      toast({ title: 'Kategória létrehozva!', description: `"${data.name}" hozzáadva.` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Létrehozás sikertelen', description: error.message });
    }
  };

  // Tag management helpers
  const handleAddEditTag = () => {
    if (tagInput.trim() && !editTags.includes(tagInput.trim())) {
      setEditTags([...editTags, tagInput.trim()]);
      setTagInput('');
    }
  };
  const handleAddNewTag = () => {
    if (newTagInput.trim() && !newTags.includes(newTagInput.trim())) {
      setNewTags([...newTags, newTagInput.trim()]);
      setNewTagInput('');
    }
  };

  if (!user || !selectedCompany || initialLoading) {
    return <CategoryPageSkeleton />;
  }

  return (
    <div className="p-6 max-w-[900px] mx-auto page-animate">
      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kategóriák</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kattints a kategóriákra a hozzárendelt számlák megtekintéséhez, újak hozzáadásához vagy a meglévők leválasztásához.
          </p>
        </div>
        <Button onClick={() => setShowNewDialog(true)} className="gap-2" disabled={!writable} title={!writable ? 'Nincs írási jogosultságod' : undefined}>
          <Plus className="h-4 w-4" />
          Új kategória
        </Button>
      </div>

      {/* Donut chart summary */}
      {categories.length > 0 && (
        <div className="mb-6">
          <CategoryDonutChart
            stats={donutStats}
            totalInvoices={totalInvoices}
            totalAmount={totalAmount}
            onSegmentClick={handleDonutClick}
            activeIndex={activeDonutIndex}
          />
        </div>
      )}

      {/* Accordion list */}
      {categories.length > 0 ? (
        <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
          {/* Column header */}
          <div className="flex items-center gap-3 px-5 py-2 border-b border-border bg-muted/30">
            {/* Arrow spacer */}
            <div className="w-4 flex-shrink-0" />
            {/* Icon spacer */}
            <div className="w-8 flex-shrink-0" />
            {/* Name */}
            <div className="flex-1 min-w-0 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Név
            </div>
            {/* Stats headers */}
            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="w-14 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-center">
                Arány
              </div>
              <div className="w-12 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-right">
                Számla
              </div>
              <div className="w-28 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-right">
                Összeg
              </div>
            </div>
            {/* Actions header */}
            <div className="flex-shrink-0 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider" style={{ width: '60px', textAlign: 'center' }}>
              Műveletek
            </div>
          </div>
          {categories.map((cat, index) => {
            const catId = cat.id || `new-${index}`;
            const stats = cat.id ? categoryStats[cat.id] : undefined;
            
            return (
              <CategoryAccordionItem
                key={catId}
                name={cat.name || 'Névtelen kategória'}
                description={cat.description}
                color={cat.color || DEFAULT_CATEGORY_COLOR}
                iconName={cat.icon}
                invoiceCount={stats?.invoiceCount || 0}
                totalAmount={stats?.totalAmount || 0}
                totalAllAmount={totalAmount}
                onToggle={() => toggleCategory(catId)}
                onEdit={() => openEditDialog(index)}
                onDelete={() => confirmDeleteCategory(index)}
              />
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 border border-dashed border-border rounded-lg text-muted-foreground flex flex-col items-center gap-3">
          <FolderOpen className="h-8 w-8" />
          <p className="text-sm">Nincsenek kategóriák. Kattints az „Új kategória" gombra a létrehozáshoz.</p>
        </div>
      )}

      {/* Edit category dialog */}
      <Dialog open={!!editingCategory} onOpenChange={(open) => !open && setEditingCategory(null)}>
        <DialogContent
          className="sm:max-w-md bg-card/95 backdrop-blur-md border-border/50"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            setTimeout(() => document.getElementById('edit-cat-name')?.focus(), 0);
          }}
        >
          <DialogHeader>
            <DialogTitle>Kategória szerkesztése</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            {/* Category identity header */}
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <div className="flex items-end gap-4">
                {/* Icon picker */}
                <div className="flex flex-col items-center gap-1.5">
                  <IconPicker
                    value={editIcon}
                    onChange={setEditIcon}
                    color={editColor}
                  />
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Ikon</span>
                </div>
                {/* Color picker */}
                <div className="flex flex-col items-center gap-1.5">
                  <ColorPicker
                    value={editColor}
                    onChange={setEditColor}
                  />
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Szín</span>
                </div>
                {/* Name input */}
                <div className="flex flex-col gap-1.5 flex-1">
                  <Input
                    id="edit-cat-name"
                    placeholder="pl. Marketing, Irodai kellékek"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="bg-background/50 h-12 text-base font-medium"
                  />
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Kategória neve</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Címkék (számla típusok)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Új címke hozzáadása..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddEditTag(); } }}
                  className="bg-background/50"
                />
                <Button type="button" variant="secondary" size="icon" onClick={handleAddEditTag} disabled={!tagInput.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-3 min-h-[32px] p-2 rounded-md bg-background/30 border border-border/30">
                {editTags.length > 0 ? (
                  editTags.map((tag, i) => (
                    <Badge key={i} variant="secondary" className="text-sm bg-primary/15 text-primary border-0 pr-1 gap-1">
                      {tag}
                      <button type="button" onClick={() => setEditTags(editTags.filter(t => t !== tag))} className="ml-1 rounded-full hover:bg-primary/20 p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground italic p-1">Még nincs címke hozzáadva</span>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => setEditingCategory(null)}>Mégse</Button>
            <Button type="button" onClick={handleEditSave}>Mentés</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New category dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent
          className="sm:max-w-md bg-card/95 backdrop-blur-md border-border/50"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            setTimeout(() => document.getElementById('new-cat-name')?.focus(), 0);
          }}
        >
          <DialogHeader>
            <DialogTitle>Új kategória</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            {/* Category identity header */}
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <div className="flex items-end gap-4">
                {/* Icon picker */}
                <div className="flex flex-col items-center gap-1.5">
                  <IconPicker
                    value={newIcon}
                    onChange={setNewIcon}
                    color={newColor}
                  />
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Ikon</span>
                </div>
                {/* Color picker */}
                <div className="flex flex-col items-center gap-1.5">
                  <ColorPicker
                    value={newColor}
                    onChange={setNewColor}
                  />
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Szín</span>
                </div>
                {/* Name input */}
                <div className="flex flex-col gap-1.5 flex-1">
                  <Input
                    id="new-cat-name"
                    placeholder="pl. Marketing, Irodai kellékek"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="bg-background/50 h-12 text-base font-medium"
                  />
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Kategória neve</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Címkék (számla típusok)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Új címke hozzáadása..."
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddNewTag(); } }}
                  className="bg-background/50"
                />
                <Button type="button" variant="secondary" size="icon" onClick={handleAddNewTag} disabled={!newTagInput.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-3 min-h-[32px] p-2 rounded-md bg-background/30 border border-border/30">
                {newTags.length > 0 ? (
                  newTags.map((tag, i) => (
                    <Badge key={i} variant="secondary" className="text-sm bg-primary/15 text-primary border-0 pr-1 gap-1">
                      {tag}
                      <button type="button" onClick={() => setNewTags(newTags.filter(t => t !== tag))} className="ml-1 rounded-full hover:bg-primary/20 p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground italic p-1">Még nincs címke hozzáadva</span>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => { setShowNewDialog(false); setNewName(''); setNewIcon('FolderOpen'); setNewColor(DEFAULT_CATEGORY_COLOR); setNewTags([]); }}>Mégse</Button>
            <Button type="button" onClick={handleNewCategorySave} disabled={!newName.trim()}>Létrehozás</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deletingIndex !== null} onOpenChange={(open) => !open && setDeletingIndex(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kategória törlése</AlertDialogTitle>
            <AlertDialogDescription>
              Biztosan törölni szeretnéd a{' '}
              <span className="font-semibold text-foreground">
                „{deletingIndex !== null ? categories[deletingIndex]?.name : ''}"
              </span>{' '}
              kategóriát? A hozzárendelt számlák kategorizálatlanná válnak. Ez a művelet nem vonható vissza.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Mégse</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCategory}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Törlés
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Category Details & Invoices Modal */}
      {(() => {
        const activeModalCategory = categories.find(c => c.id === selectedCategoryForModal);
        const activeModalStats = selectedCategoryForModal ? categoryStats[selectedCategoryForModal] : undefined;
        if (!activeModalCategory || !selectedCategoryForModal) return null;
        
        const IconComponent = resolveIcon(activeModalCategory.icon);
        const color = activeModalCategory.color || DEFAULT_CATEGORY_COLOR;
        const tags = activeModalCategory.description ? activeModalCategory.description.split(',').map(t => t.trim()).filter(Boolean) : [];
        const invoices = activeModalStats?.invoices || [];

        // Pagination calculations
        const ITEMS_PER_PAGE = 7;
        const totalPages = Math.ceil(invoices.length / ITEMS_PER_PAGE) || 1;
        const currentPage = Math.min(modalCurrentPage, totalPages);

        // Keep page in-bounds if items were deleted
        if (currentPage !== modalCurrentPage) {
          setTimeout(() => setModalCurrentPage(currentPage), 0);
        }

        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const paginatedInvoices = invoices.slice(startIndex, startIndex + ITEMS_PER_PAGE);
        const displayCount = paginatedInvoices.length > 0 ? paginatedInvoices.length : 1;
        const emptyRowsNeeded = ITEMS_PER_PAGE - displayCount;

        const formatAmount = (amount: number | null) => {
          if (amount === null || amount === undefined) return '0 Ft';
          return new Intl.NumberFormat('hu-HU').format(amount) + ' Ft';
        };

        return (
          <Dialog open={!!selectedCategoryForModal} onOpenChange={(open) => !open && closeDetailsModal()}>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col bg-card/95 backdrop-blur-md border-border/50 p-6 overflow-hidden">
              <DialogHeader className="flex flex-row items-center gap-4 border-b border-border pb-4 pr-6">
                <span
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: color + '20', color: color }}
                >
                  <IconComponent className="h-6 w-6" />
                </span>
                <div className="flex-1 min-w-0">
                  <DialogTitle className="text-xl font-bold tracking-tight">{activeModalCategory.name}</DialogTitle>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {tags.map((tag, i) => (
                        <Badge
                          key={i}
                          variant="secondary"
                          className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary border-0"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </DialogHeader>

              {/* Scrollable invoice list */}
              <div className="flex-1 overflow-y-auto py-4 min-h-[200px] flex flex-col">
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
                  Hozzárendelt számlák ({invoices.length})
                </h3>
                <div className="border border-border rounded-lg overflow-hidden bg-background/50 flex-1">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent bg-muted/20">
                        <TableHead className="w-32">Szám</TableHead>
                        <TableHead className="w-20">Irány</TableHead>
                        <TableHead>Partner</TableHead>
                        <TableHead className="w-28">Dátum</TableHead>
                        <TableHead className="text-right w-32">Összeg</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedInvoices.length > 0 ? (
                        paginatedInvoices.map((inv) => (
                          <TableRow key={inv.id} className="group hover:bg-muted/10">
                            <TableCell className="font-semibold text-xs truncate max-w-[120px] h-12 py-0 align-middle" title={inv.invoice_number}>{inv.invoice_number || '–'}</TableCell>
                            <TableCell className="h-12 py-0 align-middle">
                              <Badge
                                variant="secondary"
                                className={`text-[10px] px-1.5 py-0 h-4 border-0 ${
                                  inv.invoice_direction === 'INBOUND'
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                    : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                }`}
                              >
                                {inv.invoice_direction === 'INBOUND' ? 'BE' : 'KI'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs truncate max-w-[150px] h-12 py-0 align-middle" title={inv.supplier_name || '–'}>
                              {inv.supplier_name || '–'}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground h-12 py-0 align-middle">{inv.invoice_issue_date || '–'}</TableCell>
                            <TableCell className="text-right text-xs font-semibold tabular-nums h-12 py-0 align-middle">
                              {formatAmount(inv.invoice_gross_amount)}
                            </TableCell>
                            <TableCell className="h-12 py-0 align-middle">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                onClick={() => handleRemoveInvoice(inv.id, selectedCategoryForModal)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground text-sm h-12 py-0 align-middle">
                            Nincsenek számlák rendelve ehhez a kategóriához
                          </TableCell>
                        </TableRow>
                      )}
                      {Array.from({ length: emptyRowsNeeded }).map((_, idx) => (
                        <TableRow key={`empty-${idx}`} className="hover:bg-transparent border-b border-border/30 last:border-b-0 opacity-10">
                          <TableCell colSpan={6} className="h-12 py-0 align-middle">&nbsp;</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination Controls */}
                <div className="flex items-center justify-between px-2 py-3 border-t border-border bg-muted/5 mt-2 rounded-lg">
                  <span className="text-xs text-muted-foreground font-medium">
                    Összesen {invoices.length} számla • {currentPage}. / {totalPages} oldal
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      disabled={currentPage === 1}
                      onClick={() => setModalCurrentPage(prev => Math.max(prev - 1, 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      disabled={currentPage === totalPages}
                      onClick={() => setModalCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Bottom search section for assignment */}
              <div className="border-t border-border pt-4 mt-auto">
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
                  Új számla hozzáadása
                </h3>
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Keresés számlaszám, partner alapján a kategorizálatlan számlák között..."
                      value={modalSearchQuery}
                      onChange={(e) => {
                        setModalSearchQuery(e.target.value);
                        handleSearchInvoice(e.target.value, selectedCategoryForModal);
                      }}
                      className="pl-9 h-10 bg-background/50 border-dashed"
                    />
                  </div>
                  {modalSearchQuery && searchResults[selectedCategoryForModal] && searchResults[selectedCategoryForModal].length > 0 && (
                    <div className="absolute left-0 right-0 bottom-full mb-1 z-50 bg-card border border-border rounded-lg shadow-xl max-h-48 overflow-y-auto p-1">
                      {searchResults[selectedCategoryForModal].map((inv) => (
                        <button
                          key={inv.id}
                          className="w-full flex items-center gap-3 px-3 py-2 text-xs hover:bg-primary/5 text-left border-b border-border/50 last:border-b-0 rounded-md transition-colors"
                          onClick={() => {
                            handleAddInvoice(inv.id, selectedCategoryForModal);
                            setModalSearchQuery('');
                          }}
                        >
                          <Plus className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                          <span className="font-semibold w-24 truncate">{inv.invoice_number}</span>
                          <Badge
                            variant="secondary"
                            className={`text-[10px] px-1.5 py-0 h-4 border-0 flex-shrink-0 ${
                              inv.invoice_direction === 'INBOUND'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            }`}
                          >
                            {inv.invoice_direction === 'INBOUND' ? 'BE' : 'KI'}
                          </Badge>
                          <span className="text-muted-foreground flex-1 truncate">
                            {inv.supplier_name || '–'}
                          </span>
                          <span className="font-bold tabular-nums flex-shrink-0">{formatAmount(inv.invoice_gross_amount)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      <UnsavedChangesDialog
        open={showDialog}
        onConfirm={confirmNavigation}
        onCancel={cancelNavigation}
      />
    </div>
  );
};

export default Onboarding;
