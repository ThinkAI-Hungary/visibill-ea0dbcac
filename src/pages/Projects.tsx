import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Plus, X, FolderOpen, Calendar, DollarSign, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';

interface Project {
  id?: string;
  name: string;
  description: string;
  client_name: string;
  status: 'active' | 'completed' | 'on_hold' | 'cancelled';
  budget?: number;
  start_date?: string;
  end_date?: string;
}

const Projects = () => {
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const emptyProject: Project = {
    name: '',
    description: '',
    client_name: '',
    status: 'active',
    budget: undefined,
    start_date: undefined,
    end_date: undefined,
  };

  useEffect(() => {
    loadProjects();
  }, [user]);

  const loadProjects = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects((data || []) as Project[]);
    } catch (error) {
      console.error('Error loading projects:', error);
      toast({
        variant: 'destructive',
        title: 'Hiba történt',
        description: 'Nem sikerült betölteni a projekteket.'
      });
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSaveProject = async () => {
    if (!user || !editingProject) return;

    if (!editingProject.name.trim() || !editingProject.client_name.trim()) {
      toast({
        variant: 'destructive',
        title: 'Hiányzó adatok',
        description: 'A projekt neve és ügyfél neve kötelező!'
      });
      return;
    }

    setLoading(true);

    try {
      if (editingProject.id) {
        // Update existing project
        const { error } = await supabase
          .from('projects')
          .update({
            name: editingProject.name,
            description: editingProject.description,
            client_name: editingProject.client_name,
            status: editingProject.status,
            budget: editingProject.budget,
            start_date: editingProject.start_date,
            end_date: editingProject.end_date,
          })
          .eq('id', editingProject.id)
          .eq('user_id', user.id);

        if (error) throw error;

        toast({
          title: 'Projekt frissítve!',
          description: 'A változtatások sikeresen mentve.'
        });
      } else {
        // Create new project
        const { error } = await supabase
          .from('projects')
          .insert({
            user_id: user.id,
            name: editingProject.name,
            description: editingProject.description,
            client_name: editingProject.client_name,
            status: editingProject.status,
            budget: editingProject.budget,
            start_date: editingProject.start_date,
            end_date: editingProject.end_date,
          });

        if (error) throw error;

        toast({
          title: 'Projekt létrehozva!',
          description: 'Az új projekt sikeresen mentve.'
        });
      }

      setEditingProject(null);
      setIsCreating(false);
      await loadProjects();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Mentés sikertelen',
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!user) return;

    if (!confirm('Biztosan törölni szeretnéd ezt a projektet?')) return;

    setLoading(true);

    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: 'Projekt törölve',
        description: 'A projekt sikeresen törölve.'
      });

      await loadProjects();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Törlés sikertelen',
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      active: 'Aktív',
      completed: 'Befejezett',
      on_hold: 'Szünetel',
      cancelled: 'Törölve'
    };
    return labels[status as keyof typeof labels] || status;
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    const variants = {
      active: 'default' as const,
      completed: 'secondary' as const,
      on_hold: 'outline' as const,
      cancelled: 'destructive' as const
    };
    return variants[status as keyof typeof variants] || 'default';
  };

  if (initialLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Projektek betöltése...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Projektek</h1>
            <p className="text-muted-foreground">Kezeld az ügyfélprojektjeidet és munkáidat</p>
          </div>
          <Button
            onClick={() => {
              setEditingProject(emptyProject);
              setIsCreating(true);
            }}
            disabled={isCreating || !!editingProject}
          >
            <Plus className="h-4 w-4 mr-2" />
            Új projekt
          </Button>
        </div>

        {/* Create/Edit Form */}
        {(isCreating || editingProject) && (
          <Card>
            <CardHeader>
              <CardTitle>{editingProject?.id ? 'Projekt szerkesztése' : 'Új projekt létrehozása'}</CardTitle>
              <CardDescription>
                Adj meg részleteket az ügyfélprojektről
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Projekt neve *</Label>
                    <Input
                      id="name"
                      placeholder="pl. Weboldal fejlesztés"
                      value={editingProject?.name || ''}
                      onChange={(e) => setEditingProject(prev => prev ? { ...prev, name: e.target.value } : null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="client">Ügyfél neve *</Label>
                    <Input
                      id="client"
                      placeholder="pl. Példa Kft."
                      value={editingProject?.client_name || ''}
                      onChange={(e) => setEditingProject(prev => prev ? { ...prev, client_name: e.target.value } : null)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Leírás</Label>
                  <Textarea
                    id="description"
                    placeholder="Projekt részletei..."
                    rows={3}
                    value={editingProject?.description || ''}
                    onChange={(e) => setEditingProject(prev => prev ? { ...prev, description: e.target.value } : null)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="status">Státusz</Label>
                    <Select
                      value={editingProject?.status || 'active'}
                      onValueChange={(value: any) => setEditingProject(prev => prev ? { ...prev, status: value } : null)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Aktív</SelectItem>
                        <SelectItem value="completed">Befejezett</SelectItem>
                        <SelectItem value="on_hold">Szünetel</SelectItem>
                        <SelectItem value="cancelled">Törölve</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="budget">Költségvetés (HUF)</Label>
                    <Input
                      id="budget"
                      type="number"
                      placeholder="0"
                      value={editingProject?.budget || ''}
                      onChange={(e) => setEditingProject(prev => prev ? { ...prev, budget: e.target.value ? Number(e.target.value) : undefined } : null)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="start_date">Kezdő dátum</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={editingProject?.start_date || ''}
                      onChange={(e) => setEditingProject(prev => prev ? { ...prev, start_date: e.target.value } : null)}
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingProject(null);
                      setIsCreating(false);
                    }}
                    disabled={loading}
                  >
                    Mégse
                  </Button>
                  <Button onClick={handleSaveProject} disabled={loading}>
                    {loading ? 'Mentés...' : 'Mentés'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Projects List */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.length === 0 ? (
            <Card className="col-span-full">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Még nincsenek projektek</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Kezdj el új projekteket létrehozni az ügyfélmunkáid rendszerezéséhez
                </p>
                <Button
                  onClick={() => {
                    setEditingProject(emptyProject);
                    setIsCreating(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Első projekt létrehozása
                </Button>
              </CardContent>
            </Card>
          ) : (
            projects.map((project) => (
              <Card key={project.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{project.name}</CardTitle>
                      <CardDescription className="flex items-center gap-1 mt-1">
                        <Building2 className="h-3 w-3" />
                        {project.client_name}
                      </CardDescription>
                    </div>
                    <Badge variant={getStatusVariant(project.status)}>
                      {getStatusLabel(project.status)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-4">
                  {project.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {project.description}
                    </p>
                  )}

                  <div className="space-y-2">
                    {project.budget && (
                      <div className="flex items-center gap-2 text-sm">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF' }).format(project.budget)}
                        </span>
                      </div>
                    )}
                    {project.start_date && (
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {format(new Date(project.start_date), 'yyyy. MM. dd.', { locale: hu })}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setEditingProject(project)}
                      disabled={!!editingProject || isCreating}
                    >
                      Szerkesztés
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteProject(project.id!)}
                      disabled={loading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Projects;
