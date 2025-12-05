import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Plus, X } from 'lucide-react';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog';

interface Project {
  id?: string;
  name: string;
  description: string;
}

const Onboarding = () => {
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [profile, setProfile] = useState({
    name: '',
    position: '',
    company: '',
  });
  const [projects, setProjects] = useState<Project[]>([]);
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Track initial state for unsaved changes detection
  const initialStateRef = useRef<{ profile: typeof profile; projects: Project[] } | null>(null);
  
  // Determine if there are unsaved changes
  const hasUnsavedChanges = (): boolean => {
    if (!initialStateRef.current || initialLoading) return false;
    
    const initialProfile = initialStateRef.current.profile;
    const initialProjects = initialStateRef.current.projects;
    
    // Check profile changes
    if (
      profile.name !== initialProfile.name ||
      profile.position !== initialProfile.position ||
      profile.company !== initialProfile.company
    ) {
      return true;
    }
    
    // Check project count changes
    if (projects.length !== initialProjects.length) return true;
    
    // Check individual project changes
    for (let i = 0; i < projects.length; i++) {
      const current = projects[i];
      const initial = initialProjects[i];
      if (!initial) return true;
      if (
        current.name !== initial.name ||
        current.description !== initial.description ||
        current.id !== initial.id
      ) {
        return true;
      }
    }
    
    return false;
  };
  
  const { showDialog, confirmNavigation, cancelNavigation } = useUnsavedChanges(hasUnsavedChanges());

  // Load existing data
  useEffect(() => {
    const loadExistingData = async () => {
      if (!user || !selectedCompany) return;
      
      try {
        // Load profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();
        
        if (profileData) {
          setProfile({
            name: profileData.name || '',
            position: profileData.position || '',
            company: profileData.company || '',
          });
        }

        // Load existing categories for the user (user-based, not company-based)
        const { data: projectData } = await supabase
          .from('categories')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true });

        if (projectData && projectData.length > 0) {
          setProjects(projectData.map(p => ({
            id: p.id,
            name: p.name,
            description: p.description || ''
          })));
        } else {
          // If no projects exist, start with one empty project
          setProjects([{ name: '', description: '' }]);
        }
      } catch (error) {
        console.error('Error loading data:', error);
        setProjects([{ name: '', description: '' }]);
      } finally {
        setInitialLoading(false);
      }
    };

    loadExistingData();
  }, [user, selectedCompany]);

  // Set initial state after loading completes
  useEffect(() => {
    if (!initialLoading && !initialStateRef.current) {
      initialStateRef.current = {
        profile: { ...profile },
        projects: projects.map(p => ({ ...p }))
      };
    }
  }, [initialLoading, profile, projects]);


  const addProject = () => {
    setProjects([...projects, { name: '', description: '' }]);
  };

  const removeProject = (index: number) => {
    if (projects.length > 1) {
      setProjects(projects.filter((_, i) => i !== index));
    }
  };

  const updateProject = (index: number, field: keyof Project, value: string) => {
    const updatedProjects = [...projects];
    updatedProjects[index][field] = value;
    setProjects(updatedProjects);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedCompany) return;
    
    setLoading(true);

    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          user_id: user.id,
          name: profile.name,
          position: profile.position,
          company: profile.company,
        }, {
          onConflict: 'user_id'
        });

      if (profileError) throw profileError;

      // Handle projects (update existing, create new, delete removed)
      const validProjects = projects.filter(p => p.name.trim());

      // Load existing categories BEFORE any insert/update so we don't accidentally delete newly created ones
      const { data: existingUserProjects, error: loadCategoriesError } = await supabase
        .from('categories')
        .select('id')
        .eq('user_id', user.id);

      if (loadCategoriesError) throw loadCategoriesError;
      
      for (const project of validProjects) {
        if (project.id) {
          // Update existing category
          const { error: updateError } = await supabase
            .from('categories')
            .update({
              name: project.name,
              description: project.description,
            })
            .eq('id', project.id)
            .eq('user_id', user.id);
          
          if (updateError) throw updateError;
        } else {
          // Create new category
          const { error: createError } = await supabase
            .from('categories')
            .insert({
              user_id: user.id,
              name: project.name,
              description: project.description,
            });
          
          if (createError) throw createError;
        }
      }

      // Delete categories that were removed (categories that existed before but are not in current list)
      const currentProjectIds = validProjects.filter(p => p.id).map(p => p.id);
      if (existingUserProjects && existingUserProjects.length > 0) {
        const projectsToDelete = existingUserProjects.filter(p => !currentProjectIds.includes(p.id));
        
        if (projectsToDelete && projectsToDelete.length > 0) {
          const deleteIds = projectsToDelete.map(p => p.id);
          
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

      toast({
        title: "Profil frissítve!",
        description: "A változtatások sikeresen mentve."
      });

      // Reset initial state to prevent unsaved changes warning
      initialStateRef.current = {
        profile: { ...profile },
        projects: projects.map(p => ({ ...p }))
      };

      navigate('/');
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

  if (!user || initialLoading) {
    return (
      <div className="flex justify-center p-8">
        <Card className="w-full max-w-2xl">
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center space-y-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground">Adatok betöltése...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex justify-center p-8">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Kategória kezelő</CardTitle>
          <CardDescription>
            Kezeld a költség kategóriáidat a számlák rendszerezéséhez
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Profile Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Profil információk</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Teljes név</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Add meg a teljes neved"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="position">Beosztás</Label>
                  <Input
                    id="position"
                    type="text"
                    placeholder="pl. vezérigazgató, menedzser, könyvelő"
                    value={profile.position}
                    onChange={(e) => setProfile({ ...profile, position: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Cég</Label>
                <Input
                  id="company"
                  type="text"
                  placeholder="Add meg a cég nevét"
                  value={profile.company}
                  onChange={(e) => setProfile({ ...profile, company: e.target.value })}
                />
              </div>
            </div>

            {/* Categories */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Költség kategóriák</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addProject}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Kategória hozzáadása
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Kezeld a kategóriáidat a számlák és kiadások rendszerezéséhez. Minden kategória egy különböző projekt vagy kiadási területet jelent.
              </p>
              
              {projects.map((project, index) => (
                <Card key={index} className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">
                        {project.id ? `${project.name || `Projekt ${index + 1}`}` : `Új Projekt ${index + 1}`}
                      </h4>
                      {projects.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeProject(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`project-name-${index}`}>Kategória neve</Label>
                      <Input
                        id={`project-name-${index}`}
                        type="text"
                        placeholder="pl. Marketing, Irodai kellékek, Utazás"
                        value={project.name}
                        onChange={(e) => updateProject(index, 'name', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`project-description-${index}`}>Számla típusok</Label>
                      <Textarea
                        id={`project-description-${index}`}
                        placeholder="Írj le, milyen számlák/kiadások tartoznak ebbe a kategóriába (pl. reklámköltségek, közösségi média eszközök, promóciós anyagok)"
                        value={project.description}
                        onChange={(e) => updateProject(index, 'description', e.target.value)}
                        rows={3}
                      />
                    </div>
                  </div>
                </Card>
              ))}
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