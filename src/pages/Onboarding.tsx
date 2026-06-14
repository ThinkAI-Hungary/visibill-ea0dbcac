import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Plus } from 'lucide-react';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog';
import { CategoryCard } from '@/components/CategoryCard';
import { ContentSkeleton } from '@/components/ui/content-skeleton';
import { reportError } from '@/lib/errorReporter';

interface Category {
  id?: string;
  name: string;
  description: string;
}

const Onboarding = () => {
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Track initial state for unsaved changes detection
  const [initialCategories, setInitialCategories] = useState<Category[] | null>(null);
  
  // Calculate if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (!initialCategories || initialLoading) {
      return false;
    }
    
    // Check category count changes
    if (categories.length !== initialCategories.length) {
      return true;
    }
    
    // Check individual category changes
    for (let i = 0; i < categories.length; i++) {
      const current = categories[i];
      const initial = initialCategories[i];
      if (!initial) {
        return true;
      }
      if (
        current.name !== initial.name ||
        current.description !== initial.description ||
        current.id !== initial.id
      ) {
        return true;
      }
    }
    
    return false;
  }, [categories, initialCategories, initialLoading]);
  
  const { showDialog, confirmNavigation, cancelNavigation } = useUnsavedChanges(hasUnsavedChanges);

  // Load existing data
  useEffect(() => {
    const loadExistingData = async () => {
      if (!user || !selectedCompany) return;
      
      try {
        // Load existing categories for the company
        const { data: categoryData } = await supabase
          .from('categories')
          .select('id, name, description')
          .eq('company_id', selectedCompany.id)
          .order('created_at', { ascending: true });

        let loadedCategories: Category[];
        if (categoryData && categoryData.length > 0) {
          loadedCategories = categoryData.map(c => ({
            id: c.id,
            name: c.name,
            description: c.description || ''
          }));
        } else {
          loadedCategories = [{ name: '', description: '' }];
        }
        setCategories(loadedCategories);
        setInitialCategories(loadedCategories.map(c => ({ ...c })));
      } catch (error) {
        reportError({ type: 'db_query', component: 'Onboarding', action: 'error', message: 'Error loading data:', error: error });
        const defaultCategories = [{ name: '', description: '' }];
        setCategories(defaultCategories);
        setInitialCategories(defaultCategories.map(c => ({ ...c })));
      } finally {
        setInitialLoading(false);
      }
    };

    loadExistingData();
  }, [user, selectedCompany]);


  const addCategory = () => {
    setCategories([...categories, { name: '', description: '' }]);
  };

  const removeCategory = (index: number) => {
    const updated = categories.filter((_, i) => i !== index);
    setCategories(updated.length > 0 ? updated : []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedCompany) return;
    
    setLoading(true);

    try {
      // Handle categories (update existing, create new, delete removed)
      const validCategories = categories.filter(c => c.name.trim());

      // Load existing categories BEFORE any insert/update so we don't accidentally delete newly created ones
      const { data: existingUserCategories, error: loadCategoriesError } = await supabase
        .from('categories')
        .select('id')
        .eq('company_id', selectedCompany.id);

      if (loadCategoriesError) throw loadCategoriesError;
      
      for (const category of validCategories) {
        if (category.id) {
          // Update existing category
          const { error: updateError } = await supabase
            .from('categories')
            .update({
              name: category.name,
              description: category.description,
            })
            .eq('id', category.id)
            .eq('company_id', selectedCompany.id);
          
          if (updateError) throw updateError;
        } else {
          // Create new category
          const { error: createError } = await supabase
            .from('categories')
            .insert({
              user_id: user.id,
              company_id: selectedCompany.id,
              name: category.name,
              description: category.description,
            });
          
          if (createError) throw createError;
        }
      }

      // Delete categories that were removed (categories that existed before but are not in current list)
      const currentCategoryIds = validCategories.filter(c => c.id).map(c => c.id);
      if (existingUserCategories && existingUserCategories.length > 0) {
        const categoriesToDelete = existingUserCategories.filter(c => !currentCategoryIds.includes(c.id));
        
        if (categoriesToDelete && categoriesToDelete.length > 0) {
          const deleteIds = categoriesToDelete.map(c => c.id);
          
          // First, remove category references from invoices
          const { error: updateInvoicesError } = await supabase
            .from('invoices')
            .update({ category_id: null })
            .in('category_id', deleteIds);
          
          if (updateInvoicesError) throw updateInvoicesError;
          
          // Then delete the categories
          const { error: deleteError } = await supabase
            .from('categories')
            .delete()
            .in('id', deleteIds);
          
          if (deleteError) throw deleteError;
        }
      }

      if (hasUnsavedChanges) {
        toast({
          title: "Kategóriák mentve!",
          description: "A változtatások sikeresen mentve."
        });
      }

      // Reset initial state to prevent unsaved changes warning
      // Reload fresh data from DB so new IDs are reflected
      const { data: freshData } = await supabase
        .from('categories')
        .select('id, name, description')
        .eq('company_id', selectedCompany.id)
        .order('created_at', { ascending: true });

      if (freshData && freshData.length > 0) {
        const freshCategories = freshData.map(c => ({
          id: c.id,
          name: c.name,
          description: c.description || ''
        }));
        setCategories(freshCategories);
        setInitialCategories(freshCategories.map(c => ({ ...c })));
      } else {
        setInitialCategories(categories.map(c => ({ ...c })));
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Mentés sikertelen",
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user || !selectedCompany || initialLoading) {
    return <ContentSkeleton />;
  }

  return (
    <div className="flex justify-center p-8 page-animate">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Kategória kezelő</CardTitle>
          <CardDescription>
            Kezeld a költség kategóriáidat a számlák rendszerezéséhez
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Categories - Modern Grid Layout */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Költség kategóriák</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addCategory}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Új kategória
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Kezeld a kategóriáidat a számlák és kiadások rendszerezéséhez.
              </p>
              
              {categories.length === 0 ? (
                <div className="col-span-full text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
                  <p className="text-sm">Nincsenek kategóriák. Kattints az „Új kategória" gombra a hozzáadáshoz.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {categories.map((category, index) => (
                    <CategoryCard
                      key={category.id || `new-${index}`}
                      name={category.name}
                      description={category.description}
                      isNew={!category.id}
                      onUpdate={(name, description) => {
                        const updatedCategories = [...categories];
                        updatedCategories[index] = { ...updatedCategories[index], name, description };
                        setCategories(updatedCategories);
                      }}
                      onRemove={() => removeCategory(index)}
                      canRemove={true}
                    />
                  ))}
                </div>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Mentés...' : 'Változtatások mentése'}
            </Button>
          </form>
        </CardContent>
      </Card>
      
      <UnsavedChangesDialog
        open={showDialog}
        onConfirm={confirmNavigation}
        onCancel={cancelNavigation}
      />
    </div>
  );
};

export default Onboarding;
