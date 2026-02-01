import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Plus, X, FolderOpen, Calendar, DollarSign, Building2, Info, TrendingUp, TrendingDown, Minus, Hash } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import { PartnerCombobox } from '@/components/PartnerCombobox';
import { SupplierInvoiceAssignment } from '@/components/SupplierInvoiceAssignment';
import { CopyableCell } from '@/components/ui/copyable-cell';

interface Project {
  id?: string;
  name: string;
  description: string;
  client_name: string;
  status: 'active' | 'completed' | 'on_hold' | 'cancelled';
  budget?: number;
  start_date?: string;
  end_date?: string;
  project_code?: string;
  project_type: 'one_time' | 'recurring';
}

interface ProjectFinancials {
  projectId: string;
  outboundTotal: number;
  inboundTotal: number;
  profit: number;
}

const Projects = () => {
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [projectFinancials, setProjectFinancials] = useState<ProjectFinancials[]>([]);
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const { toast } = useToast();

  const emptyProject: Project = {
    name: '',
    description: '',
    client_name: '',
    status: 'active',
    budget: undefined,
    start_date: undefined,
    end_date: undefined,
    project_type: 'one_time',
  };

  useEffect(() => {
    loadProjects();
  }, [user, selectedCompany]);

  const loadProjects = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects((data || []).map(p => ({
        ...p,
        project_type: p.project_type || 'one_time'
      })) as Project[]);

      // Fetch project financials from nav_invoices
      if (selectedCompany) {
        const { data: invoiceData, error: invoiceError } = await supabase
          .from('nav_invoices')
          .select('project_id, invoice_direction, invoice_gross_amount')
          .eq('company_id', selectedCompany.id)
          .not('project_id', 'is', null);

        if (invoiceError) throw invoiceError;

        // Calculate financials per project
        const financialsMap = new Map<string, { outbound: number; inbound: number }>();
        
        (invoiceData || []).forEach((inv: any) => {
          if (!inv.project_id) return;
          
          if (!financialsMap.has(inv.project_id)) {
            financialsMap.set(inv.project_id, { outbound: 0, inbound: 0 });
          }
          
          const current = financialsMap.get(inv.project_id)!;
          const amount = inv.invoice_gross_amount || 0;
          
          if (inv.invoice_direction === 'OUTBOUND') {
            current.outbound += amount;
          } else if (inv.invoice_direction === 'INBOUND') {
            current.inbound += amount;
          }
        });

        const financials: ProjectFinancials[] = Array.from(financialsMap.entries()).map(([projectId, data]) => ({
          projectId,
          outboundTotal: data.outbound,
          inboundTotal: data.inbound,
          profit: data.outbound - data.inbound
        }));

        setProjectFinancials(financials);
      }
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

  const getProjectFinancials = (projectId: string): ProjectFinancials | undefined => {
    return projectFinancials.find(f => f.projectId === projectId);
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
            project_type: editingProject.project_type,
          })
          .eq('id', editingProject.id)
          .eq('user_id', user.id);

        if (error) throw error;

        toast({
          title: 'Projekt frissítve!',
          description: 'A változtatások sikeresen mentve.'
        });
      } else {
        // Create new project (project_code is generated server-side)
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
            project_type: editingProject.project_type,
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

  const getProjectTypeLabel = (type: string) => {
    return type === 'recurring' ? 'Ismétlődő' : 'Egyszeri';
  };

  if (initialLoading) {
    return <LoadingSpinner message="Projektek betöltése..." />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold">Projektek</h1>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-5 w-5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Hozz létre és kezelj projekteket az ügyfélmunkáid rendszerezéséhez. A számlákat projektekhez rendelheted.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
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
                {/* Project name */}
                <div className="space-y-2">
                  <Label htmlFor="name">Projekt neve *</Label>
                  <Input
                    id="name"
                    placeholder="pl. Weboldal fejlesztés"
                    value={editingProject?.name || ''}
                    onChange={(e) => setEditingProject(prev => prev ? { ...prev, name: e.target.value } : null)}
                  />
                </div>

                {/* Client selection with PartnerCombobox */}
                <div className="space-y-2">
                  <Label htmlFor="client">Ügyfél *</Label>
                  <PartnerCombobox
                    value={editingProject?.client_name || ''}
                    onChange={(name) => setEditingProject(prev => prev ? { ...prev, client_name: name } : null)}
                    companyId={selectedCompany?.id}
                    placeholder="Partner keresése..."
                  />
                  <p className="text-xs text-muted-foreground flex items-start gap-1">
                    <Info className="h-3 w-3 mt-0.5 shrink-0" />
                    Ha nem látod a partnert a listában, akkor küldj be/tölts fel egy olyan számlát, amin az új partner szerepel.
                  </p>
                </div>

                {/* Project code (read-only), Type, Status */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Project Code - only show for existing projects */}
                  <div className="space-y-2">
                    <Label>Projektkód</Label>
                    {editingProject?.project_code ? (
                      <div className="flex items-center gap-2 h-10 px-3 rounded-md border bg-muted">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                        <CopyableCell 
                          value={editingProject.project_code} 
                          className="font-mono text-sm"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center h-10 px-3 rounded-md border bg-muted text-muted-foreground text-sm">
                        Mentés után generálódik
                      </div>
                    )}
                  </div>

                  {/* Project Type */}
                  <div className="space-y-2">
                    <Label htmlFor="project_type">Típus</Label>
                    <Select
                      value={editingProject?.project_type || 'one_time'}
                      onValueChange={(value: 'one_time' | 'recurring') => 
                        setEditingProject(prev => prev ? { ...prev, project_type: value } : null)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="one_time">Egyszeri</SelectItem>
                        <SelectItem value="recurring">Ismétlődő</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Status */}
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
                </div>

                {/* Budget and Dates */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

                  <div className="space-y-2">
                    <Label htmlFor="end_date">Befejezés dátuma</Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={editingProject?.end_date || ''}
                      onChange={(e) => setEditingProject(prev => prev ? { ...prev, end_date: e.target.value } : null)}
                    />
                  </div>
                </div>

                {/* Description */}
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

                {/* Supplier Invoice Assignment - only for existing projects */}
                {editingProject?.id && selectedCompany && (
                  <SupplierInvoiceAssignment
                    projectId={editingProject.id}
                    projectName={editingProject.name}
                    companyId={selectedCompany.id}
                    onAssignmentChange={loadProjects}
                  />
                )}

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
            projects.map((project) => {
              const financials = getProjectFinancials(project.id!);
              
              return (
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
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant={getStatusVariant(project.status)}>
                          {getStatusLabel(project.status)}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {getProjectTypeLabel(project.project_type)}
                        </Badge>
                      </div>
                    </div>
                    {/* Project code display */}
                    {project.project_code && (
                      <div className="mt-2">
                        <CopyableCell 
                          value={project.project_code}
                          className="font-mono text-xs text-muted-foreground"
                        />
                      </div>
                    )}
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
                            {formatCurrency(project.budget, 'HUF')}
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

                    {/* Financial Summary */}
                    <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <TrendingUp className="h-3 w-3 text-green-500" />
                          Bevétel
                        </span>
                        <span className="font-medium text-green-600">
                          {formatCurrency(financials?.outboundTotal || 0, 'HUF')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <TrendingDown className="h-3 w-3 text-red-500" />
                          Kiadás
                        </span>
                        <span className="font-medium text-red-600">
                          {formatCurrency(financials?.inboundTotal || 0, 'HUF')}
                        </span>
                      </div>
                      <div className="border-t pt-2 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1">
                          {(financials?.profit || 0) > 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (financials?.profit || 0) < 0 ? (
                            <TrendingDown className="h-3 w-3" />
                          ) : (
                            <Minus className="h-3 w-3" />
                          )}
                          Eredmény
                        </span>
                        <Badge 
                          variant={(financials?.profit || 0) > 0 ? 'default' : (financials?.profit || 0) < 0 ? 'destructive' : 'secondary'}
                          className={(financials?.profit || 0) > 0 ? 'bg-green-500/20 text-green-700 border-green-500/30' : ''}
                        >
                          {(financials?.profit || 0) > 0 ? '+' : ''}{formatCurrency(financials?.profit || 0, 'HUF')}
                        </Badge>
                      </div>
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
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default Projects;
