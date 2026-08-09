import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useEaisybillPermissions } from '@/hooks/useEaisybillPermissions';

import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { ContentSkeleton } from '@/components/ui/content-skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, X, FolderOpen, Calendar, DollarSign, Building2, Info, TrendingUp, TrendingDown, Minus, Hash, Users, BarChart3, FileText, Settings, Search, Check, ChevronDown, GitBranch } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { cn, formatCurrency } from '@/lib/utils';
import { PartnerCombobox } from '@/components/PartnerCombobox';
import { SupplierInvoiceAssignment } from '@/components/SupplierInvoiceAssignment';
import { CopyableCell } from '@/components/ui/copyable-cell';
import { useProjectLaborCosts } from '@/hooks/useProjectLaborCosts';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { IconPicker, ColorPicker, resolveIcon } from '@/components/IconPicker';
import { Skeleton } from '@/components/ui/skeleton';
import { ProjectFlowchart } from '@/components/ProjectFlowchart';

const ProjectSkeleton = () => {
  return (
    <div className="container mx-auto px-4 py-8 animate-in fade-in-0 duration-300">
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-48" />
            </div>
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>

        {/* Cards Grid Skeleton */}
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="flex flex-col overflow-hidden border shadow-sm h-[435px]">
              <div className="flex flex-1">
                {/* Left Stripe placeholder */}
                <div className="w-1.5 shrink-0 bg-muted/50" />
                
                <div className="flex-1 flex flex-col">
                  {/* Card Header area */}
                  <div className="p-4 border-b space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {/* Icon placeholder */}
                        <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <Skeleton className="h-5 w-36" />
                          <div className="flex gap-2">
                            <Skeleton className="h-3.5 w-16" />
                            <Skeleton className="h-3.5 w-24" />
                          </div>
                        </div>
                      </div>
                      <Skeleton className="h-5 w-12 shrink-0 ml-2" />
                    </div>

                    {/* Inline financials row */}
                    <div className="flex gap-1.5 mt-3">
                      <Skeleton className="h-5 w-24 rounded-full" />
                      <Skeleton className="h-5 w-24 rounded-full" />
                      <Skeleton className="h-5 w-24 rounded-full" />
                    </div>
                  </div>

                  {/* Tabs switchers */}
                  <div className="flex border-b text-xs font-semibold">
                    <div className="flex-1 py-3 flex justify-center"><Skeleton className="h-4 w-16" /></div>
                    <div className="flex-1 py-3 flex justify-center"><Skeleton className="h-4 w-16" /></div>
                    <div className="flex-1 py-3 flex justify-center"><Skeleton className="h-4 w-16" /></div>
                  </div>

                  {/* Content Area */}
                  <div className="flex-1 flex flex-col p-4 justify-between space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      {/* Budget progress card */}
                      <div className="p-3 rounded-lg border space-y-2">
                        <Skeleton className="h-3 w-14" />
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="h-1.5 w-full rounded-full" />
                        <Skeleton className="h-3 w-16" />
                      </div>

                      {/* Duration progress card */}
                      <div className="p-3 rounded-lg border space-y-2">
                        <Skeleton className="h-3 w-14" />
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="h-1.5 w-full rounded-full" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>

                    {/* Description placeholder */}
                    <div className="space-y-2 border-t pt-3 flex-1">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-[90%]" />
                      <Skeleton className="h-3 w-[40%]" />
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};


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
  icon?: string | null;
  color?: string | null;
}

interface ProjectFinancials {
  projectId: string;
  outboundTotal: number;
  inboundTotal: number;
  profit: number;
}

const Projects = () => {
  const [loading, setLoading] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [assigningProject, setAssigningProject] = useState<Project | null>(null);
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [modalSelectedInvoices, setModalSelectedInvoices] = useState<Set<string>>(new Set());
  const [selectedFlowchartProject, setSelectedFlowchartProject] = useState<Project | null>(null);
  
  // Track active tab for each project (defaulting to 'overview')
  const [activeTabs, setActiveTabs] = useState<Record<string, 'overview' | 'invoices' | 'settings'>>({});

  // Track expanded description cards
  const [expandedDescriptions, setExpandedDescriptions] = useState<Record<string, boolean>>({});
  
  // Track search text for filtering existing assigned invoices
  const [assignedInvoicesSearch, setAssignedInvoicesSearch] = useState<Record<string, string>>({});

  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canWrite: canWriteModule } = useEaisybillPermissions();
  const writable = canWriteModule('projects');

  const emptyProject: Project = {
    name: '',
    description: '',
    client_name: '',
    status: 'active',
    budget: undefined,
    start_date: undefined,
    end_date: undefined,
    project_type: 'one_time',
    icon: 'FolderOpen',
    color: 'hsl(217, 91%, 60%)',
  };

  // Fetch projects + financials + assigned invoices
  const { data: queryData, isLoading: initialLoading } = useQuery({
    queryKey: queryKeys.projects(selectedCompany?.id || ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, description, status, budget, start_date, end_date, project_type, project_code, client_name, company_id, user_id, created_at, updated_at, icon, color')
        .eq('company_id', selectedCompany!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const projectsList = (data || []).map(p => ({
        ...p,
        project_type: p.project_type || 'one_time'
      })) as Project[];

      // Fetch detailed assigned invoices (bypasses 1000-row limit)
      const PAGE_SIZE = 1000;
      let allInvoices: any[] = [];
      let invFrom = 0;
      while (true) {
        const { data: batch, error: invoiceError } = await supabase
          .from('nav_invoices')
          .select('id, invoice_number, supplier_name, customer_name, invoice_gross_amount, invoice_direction, currency, invoice_issue_date, project_id')
          .eq('company_id', selectedCompany!.id)
          .not('project_id', 'is', null)
          .range(invFrom, invFrom + PAGE_SIZE - 1);

        if (invoiceError) throw invoiceError;
        allInvoices = allInvoices.concat(batch || []);
        if (!batch || batch.length < PAGE_SIZE) break;
        invFrom += PAGE_SIZE;
      }

      // Group financials
      const financialsMap = new Map<string, { outbound: number; inbound: number }>();
      allInvoices.forEach((inv: any) => {
        if (!inv.project_id) return;
        if (!financialsMap.has(inv.project_id)) {
          financialsMap.set(inv.project_id, { outbound: 0, inbound: 0 });
        }
        const current = financialsMap.get(inv.project_id)!;
        const amount = parseFloat(inv.invoice_gross_amount) || 0;
        if (inv.invoice_direction === 'OUTBOUND') {
          current.outbound += amount;
        } else if (inv.invoice_direction === 'INBOUND') {
          current.inbound += amount;
        }
      });

      const financials: ProjectFinancials[] = Array.from(financialsMap.entries()).map(([projectId, d]) => ({
        projectId,
        outboundTotal: d.outbound,
        inboundTotal: d.inbound,
        profit: d.outbound - d.inbound
      }));

      return { projects: projectsList, financials, invoices: allInvoices };
    },
    enabled: !!user && !!selectedCompany?.id,
    placeholderData: keepPreviousData,
  });

  const projects = queryData?.projects || [];
  const projectFinancials = queryData?.financials || [];
  const assignedInvoices = queryData?.invoices || [];
  const { getLaborCost } = useProjectLaborCosts();

  // Fetch unassigned invoices for the search bar dropdown
  const { data: unassignedInvoices = [], refetch: refetchUnassigned } = useQuery({
    queryKey: ['unassigned-invoices', selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nav_invoices')
        .select('id, invoice_number, supplier_name, customer_name, invoice_gross_amount, invoice_direction, currency, invoice_issue_date')
        .eq('company_id', selectedCompany!.id)
        .is('project_id', null)
        .order('invoice_issue_date', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCompany?.id,
  });

  const modalFilteredUnassigned = useMemo(() => {
    if (!invoiceSearchQuery.trim()) return unassignedInvoices;
    const q = invoiceSearchQuery.toLowerCase();
    return unassignedInvoices.filter(inv =>
      inv.invoice_number.toLowerCase().includes(q) ||
      (inv.supplier_name && inv.supplier_name.toLowerCase().includes(q)) ||
      (inv.customer_name && inv.customer_name.toLowerCase().includes(q))
    );
  }, [unassignedInvoices, invoiceSearchQuery]);

  const getProjectFinancials = (projectId: string): ProjectFinancials | undefined => {
    return projectFinancials.find(f => f.projectId === projectId);
  };

  const handleSaveProject = async (projToSave?: Project) => {
    const targetProj = projToSave || editingProject;
    if (!user || !targetProj) return;

    if (!targetProj.name.trim()) {
      toast({
        variant: 'destructive',
        title: 'Hiányzó adatok',
        description: 'A projekt neve kötelező!'
      });
      return;
    }

    setLoading(true);

    try {
      if (targetProj.id) {
        // Update existing project
        const { error } = await supabase
          .from('projects')
          .update({
            name: targetProj.name,
            project_code: targetProj.project_code?.trim() || null,
            description: targetProj.description,
            client_name: targetProj.client_name,
            status: targetProj.status,
            budget: targetProj.budget,
            start_date: targetProj.start_date,
            end_date: targetProj.end_date,
            project_type: targetProj.project_type,
            icon: targetProj.icon,
            color: targetProj.color,
          })
          .eq('id', targetProj.id)
          .eq('company_id', selectedCompany?.id);

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
            company_id: selectedCompany?.id,
            name: targetProj.name,
            project_code: targetProj.project_code?.trim() || undefined,
            description: targetProj.description,
            client_name: targetProj.client_name,
            status: targetProj.status,
            budget: targetProj.budget,
            start_date: targetProj.start_date,
            end_date: targetProj.end_date,
            project_type: targetProj.project_type,
            icon: targetProj.icon || 'FolderOpen',
            color: targetProj.color || 'hsl(217, 91%, 60%)',
          });

        if (error) throw error;

        toast({
          title: 'Projekt létrehozva!',
          description: 'Az új projekt sikeresen mentve.'
        });
      }

      setEditingProject(null);
      setIsCreating(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.projects(selectedCompany?.id || '') });
      queryClient.invalidateQueries({ queryKey: queryKeys.projectsList(selectedCompany?.id || '') });
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
        .eq('company_id', selectedCompany?.id);

      if (error) throw error;

      toast({
        title: 'Projekt törölve',
        description: 'A projekt sikeresen törölve.',
        duration: 3000,
      });

      queryClient.invalidateQueries({ queryKey: queryKeys.projects(selectedCompany?.id || '') });
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

  const handleAssignInvoice = async (projectId: string, invoiceId: string) => {
    try {
      const { error } = await supabase
        .from('nav_invoices')
        .update({ project_id: projectId })
        .eq('id', invoiceId);

      if (error) {
        if (error.message?.includes('INVOICE_ALREADY_ASSIGNED::')) {
          const existingProjectName = error.message.split('::')[1];
          toast({
            variant: 'destructive',
            title: 'Hozzárendelés sikertelen',
            description: `Ez a számla már a "${existingProjectName}" projekthez van rendelve.`,
          });
          return;
        }
        throw error;
      }

      toast({
        title: 'Számla hozzárendelve',
        description: 'A számla sikeresen hozzárendelve a projekthez.',
      });

      queryClient.invalidateQueries({ queryKey: queryKeys.projects(selectedCompany?.id || '') });
      refetchUnassigned();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Hiba',
        description: error.message || 'Nem sikerült hozzárendelni a számlát.',
      });
    }
  };

  const handleToggleModalInvoiceSelection = (invoiceId: string) => {
    setModalSelectedInvoices(prev => {
      const next = new Set(prev);
      if (next.has(invoiceId)) {
        next.delete(invoiceId);
      } else {
        next.add(invoiceId);
      }
      return next;
    });
  };

  const handleToggleSelectAllModalInvoices = () => {
    const allFilteredIds = modalFilteredUnassigned.map(inv => inv.id);
    const areAllSelected = allFilteredIds.every(id => modalSelectedInvoices.has(id));
    
    setModalSelectedInvoices(prev => {
      const next = new Set(prev);
      if (areAllSelected) {
        allFilteredIds.forEach(id => next.delete(id));
      } else {
        allFilteredIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handleBatchAssignInvoices = async (projectId: string) => {
    if (modalSelectedInvoices.size === 0) return;
    setLoading(true);
    try {
      const idsArray = Array.from(modalSelectedInvoices);
      const { error } = await supabase
        .from('nav_invoices')
        .update({ project_id: projectId })
        .in('id', idsArray);

      if (error) throw error;

      toast({
        title: 'Számlák hozzárendelve',
        description: `${modalSelectedInvoices.size} db számla sikeresen hozzárendelve a projekthez.`,
      });

      setModalSelectedInvoices(new Set());
      queryClient.invalidateQueries({ queryKey: queryKeys.projects(selectedCompany?.id || '') });
      refetchUnassigned();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Hiba',
        description: error.message || 'Nem sikerült a számlák hozzárendelése.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUnassignInvoice = async (invoiceId: string) => {
    try {
      const { error } = await supabase
        .from('nav_invoices')
        .update({ project_id: null })
        .eq('id', invoiceId);

      if (error) throw error;

      toast({
        title: 'Hozzárendelés törölve',
        description: 'A számla eltávolítva a projektből.',
      });

      queryClient.invalidateQueries({ queryKey: queryKeys.projects(selectedCompany?.id || '') });
      refetchUnassigned();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Hiba',
        description: error.message || 'Nem sikerült eltávolítani a számlát.',
      });
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

  const getStripeColorClass = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'cancelled': return 'bg-red-500';
      case 'on_hold': return 'bg-yellow-500';
      default: return 'bg-blue-500';
    }
  };

  if (initialLoading) {
    return <ProjectSkeleton />;
  }

  if (selectedFlowchartProject) {
    return (
      <div className="container mx-auto px-4 py-8 page-animate">
        <ProjectFlowchart
          project={selectedFlowchartProject}
          onBack={() => setSelectedFlowchartProject(null)}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 page-animate">
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
            <p className="text-muted-foreground font-medium text-sm">A projekt kártyán tabfülek választják szét az áttekintést és a számla-kezelést. A projektek nevére kattintva egy részletesebb nézetre lehet navigálni.</p>
          </div>
          <Button
            onClick={() => {
              setEditingProject(emptyProject);
              setIsCreating(true);
            }}
            disabled={!writable}
            title={!writable ? 'Nincs írási jogosultságod' : undefined}
          >
            <Plus className="h-4 w-4 mr-2" />
            Új projekt
          </Button>
        </div>



        {/* Projects List with Concept 3 tabs styling */}
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
          {projects.length === 0 ? (
            <Card className="col-span-full">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Még nincsenek projektek</h3>
                <p className="text-muted-foreground text-center mb-4 font-medium text-sm">
                  Kezdj el új projekteket létrehozni az ügyfélmunkáid rendszerezéséhez
                </p>
                <Button
                  onClick={() => {
                    setEditingProject(emptyProject);
                    setIsCreating(true);
                  }}
                  disabled={!writable}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Első projekt létrehozása
                </Button>
              </CardContent>
            </Card>
          ) : (
            projects.map((project) => {
              const financials = getProjectFinancials(project.id!);
              const currentTab = activeTabs[project.id!] || 'overview';
              const projectInvoices = assignedInvoices.filter(inv => inv.project_id === project.id);

              // Calculate budget percentage
              const budgetPercent = project.budget && project.budget > 0
                ? Math.min(Math.round(((financials?.inboundTotal || 0) / project.budget) * 100), 100)
                : 0;

              // Calculate duration percentage
              let durationDaysTotal = 0;
              let elapsedPercent = 0;
              let durationText = 'Nincs megadva';
              if (project.start_date && project.end_date) {
                const start = new Date(project.start_date);
                const end = new Date(project.end_date);
                const today = new Date();
                durationDaysTotal = Math.max(0, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                const elapsedDays = Math.max(0, Math.min(durationDaysTotal, Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))));
                elapsedPercent = durationDaysTotal > 0 ? Math.round((elapsedDays / durationDaysTotal) * 100) : 0;
                
                const months = Math.round(durationDaysTotal / 30.4);
                durationText = months > 0 ? `${months} hónap` : `${durationDaysTotal} nap`;
              }

              // Is this card currently inline editing?
              const isInlineEditing = editingProject?.id === project.id;

              return (
                <Card key={project.id} className="flex flex-col overflow-hidden border shadow-sm transition-all hover:shadow-md">
                  <div className="flex flex-1">
                    {/* Left Stripe color */}
                    <div 
                      className="w-1.5 shrink-0" 
                      style={{ backgroundColor: project.color || 'hsl(217, 91%, 60%)' }}
                    />
                    
                    <div className="flex-1 flex flex-col">
                      {/* Card Header area */}
                      <div className="p-4 border-b group">
                        <div className="flex items-start justify-between">
                          <div className="min-w-0 flex-1 flex items-center gap-3">
                            {/* Icon container */}
                            {(() => {
                              const ProjectIcon = resolveIcon(project.icon);
                              const iconColor = project.color || 'hsl(217, 91%, 60%)';
                              return (
                                <div 
                                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border animate-fade-in"
                                  style={{ backgroundColor: iconColor + '15', borderColor: iconColor + '30', color: iconColor }}
                                >
                                  <ProjectIcon className="h-5 w-5" />
                                </div>
                              );
                            })()}

                            <div className="min-w-0 flex-1">
                              <h3 
                                className="text-base font-semibold truncate text-foreground flex items-center gap-1.5 cursor-pointer hover:text-primary transition-colors w-fit"
                                onClick={() => setSelectedFlowchartProject(project)}
                              >
                                {project.name}
                                <GitBranch className="h-3.5 w-3.5 text-primary opacity-0 group-hover:opacity-100 transition-all duration-200 transform -translate-x-1 group-hover:translate-x-0 shrink-0" />
                              </h3>
                              <div className="flex flex-wrap gap-x-2 gap-y-0.5 items-center mt-1 text-xs text-muted-foreground font-medium">
                                <span className="font-mono">{project.project_code || 'Kód nélkül'}</span>
                                {project.start_date && (
                                  <>
                                    <span>•</span>
                                    <span>
                                      {format(new Date(project.start_date), 'yyyy.MM')} – {project.end_date ? format(new Date(project.end_date), 'yyyy.MM') : ''}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                            <Badge variant={getStatusVariant(project.status)} className="text-[10px] py-0 px-2 font-semibold">
                              {getStatusLabel(project.status)}
                            </Badge>
                          </div>
                        </div>

                        {/* Inline financials row */}
                        <div className="flex flex-wrap gap-1.5 mt-3 text-xs font-semibold">
                          <span className="py-0.5 px-2 rounded-full bg-green-500/10 text-green-700">
                            ↑ {formatCurrency(financials?.outboundTotal || 0, 'HUF')}
                          </span>
                          <span className="py-0.5 px-2 rounded-full bg-red-500/10 text-red-700">
                            ↓ {formatCurrency(financials?.inboundTotal || 0, 'HUF')}
                          </span>
                          <span className="py-0.5 px-2 rounded-full bg-muted text-foreground font-bold border">
                            = {formatCurrency(financials?.profit || 0, 'HUF')}
                          </span>
                        </div>
                      </div>

                      {/* Tabs switchers */}
                      <div className="flex bg-muted/30 border-b text-xs font-semibold">
                        <button
                          onClick={() => setActiveTabs(prev => ({ ...prev, [project.id!]: 'overview' }))}
                          className={`flex-1 py-2 text-center border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                            currentTab === 'overview'
                              ? 'text-primary border-primary bg-background'
                              : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/50'
                          }`}
                        >
                          <BarChart3 className="h-3.5 w-3.5" />
                          Áttekintés
                        </button>
                        <button
                          onClick={() => setActiveTabs(prev => ({ ...prev, [project.id!]: 'invoices' }))}
                          className={`flex-1 py-2 text-center border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                            currentTab === 'invoices'
                              ? 'text-primary border-primary bg-background'
                              : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/50'
                          }`}
                        >
                          <FileText className="h-3.5 w-3.5" />
                          Számlák ({projectInvoices.length})
                        </button>
                        <button
                          onClick={() => {
                            setEditingProject({ ...project });
                          }}
                          className="flex-1 py-2 text-center border-b-2 transition-all flex items-center justify-center gap-1.5 text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/50"
                        >
                          <Settings className="h-3.5 w-3.5" />
                          Beállítások
                        </button>
                      </div>

                      {/* Active Tab Contents */}
                      <div className="flex-1 flex flex-col p-4 min-h-[260px] justify-between">
                        {currentTab === 'overview' && (
                          <div className="space-y-4 flex-1 flex flex-col justify-between">
                            <div className="grid grid-cols-2 gap-3 text-left">
                              {/* Budget progress card */}
                              <div className="bg-muted/40 p-3 rounded-lg border">
                                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Költségvetés</div>
                                <div className="text-base font-bold mt-1 text-foreground">
                                  {project.budget ? formatCurrency(project.budget, 'HUF') : 'Nincs megadva'}
                                </div>
                                {project.budget ? (
                                  <>
                                    <div className="h-1.5 bg-muted rounded-full mt-2 overflow-hidden border">
                                      <div
                                        className={`h-full rounded-full transition-all ${
                                          budgetPercent > 90 ? 'bg-destructive' : budgetPercent > 70 ? 'bg-yellow-500' : 'bg-primary'
                                        }`}
                                        style={{ width: `${budgetPercent}%` }}
                                      />
                                    </div>
                                    <div className="text-[10px] text-muted-foreground mt-1.5 font-medium">
                                      {budgetPercent}% felhasználva
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-[10px] text-muted-foreground mt-2 font-medium">Nincs megadva limit</div>
                                )}
                              </div>

                              {/* Duration progress card */}
                              <div className="bg-muted/40 p-3 rounded-lg border">
                                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Időtartam</div>
                                <div className="text-base font-bold mt-1 text-foreground">{durationText}</div>
                                {project.start_date && project.end_date ? (
                                  <>
                                    <div className="h-1.5 bg-muted rounded-full mt-2 overflow-hidden border">
                                      <div
                                        className="h-full rounded-full bg-blue-500 transition-all"
                                        style={{ width: `${elapsedPercent}%` }}
                                      />
                                    </div>
                                    <div className="text-[10px] text-muted-foreground mt-1.5 font-medium flex flex-wrap justify-between items-center gap-1">
                                      <span>{elapsedPercent}% eltelt</span>
                                      <span className="text-[9px] font-semibold bg-muted px-1.5 py-0.5 rounded border">
                                        Határidő: {format(new Date(project.end_date), 'yyyy.MM.dd')}
                                      </span>
                                    </div>
                                  </>
                                ) : project.end_date ? (
                                  <div className="text-[10px] text-muted-foreground mt-2 font-medium">
                                    Határidő: {format(new Date(project.end_date), 'yyyy.MM.dd')}
                                  </div>
                                ) : (
                                  <div className="text-[10px] text-muted-foreground mt-2 font-medium">Nincs határidő megadva</div>
                                )}
                              </div>
                            </div>

                            {/* Labor Cost display if present */}
                            {(() => {
                              const labor = getLaborCost(project.id!);
                              if (!labor || labor.total_labor_cost === 0) return null;
                              return (
                                <div className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-purple-500/5 border border-purple-500/10 text-purple-900 font-semibold mt-1">
                                  <span className="flex items-center gap-1">
                                    <Users className="h-3.5 w-3.5 text-purple-600" />
                                    Munkadíj / Bérköltség:
                                  </span>
                                  <span>
                                    {formatCurrency(labor.total_labor_cost, 'HUF')}
                                    <span className="text-[10px] text-purple-700/80 font-normal ml-1">
                                      ({labor.total_hours} óra)
                                    </span>
                                  </span>
                                </div>
                              );
                            })()}

                            {project.description && (() => {
                              const isExpanded = expandedDescriptions[project.id!];
                              return (
                                <div className="border-t pt-2 mt-1">
                                  <p className={cn(
                                    "text-xs text-muted-foreground leading-relaxed transition-all",
                                    !isExpanded && "line-clamp-2"
                                  )}>
                                    {project.description}
                                  </p>
                                  {project.description.length > 80 && (
                                    <button
                                      onClick={() => setExpandedDescriptions(prev => ({ ...prev, [project.id!]: !prev[project.id!] }))}
                                      className="text-[10px] text-primary/70 hover:text-primary font-semibold mt-1 flex items-center gap-0.5 transition-colors"
                                    >
                                      <ChevronDown className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-180")} />
                                      {isExpanded ? 'Kevesebb' : 'Továbbiak'}
                                    </button>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {currentTab === 'invoices' && (
                          <div className="flex flex-col flex-1 justify-between h-full">
                            {/* Search bar to filter existing assigned invoices */}
                            <div className="relative mb-2 shrink-0">
                              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                              <Input
                                placeholder="Keresés a hozzárendelt számlák között..."
                                value={assignedInvoicesSearch[project.id!] || ''}
                                onChange={(e) => setAssignedInvoicesSearch(prev => ({ ...prev, [project.id!]: e.target.value }))}
                                className="pl-8 h-8 text-xs bg-background/50"
                              />
                            </div>

                            {/* Scrollable list of assigned invoices */}
                            <div className="overflow-y-auto max-h-[145px] space-y-1.5 pr-1 flex-1">
                              {(() => {
                                const searchVal = assignedInvoicesSearch[project.id!] || '';
                                const filteredProjectInvoices = projectInvoices.filter(inv =>
                                  inv.invoice_number.toLowerCase().includes(searchVal.toLowerCase()) ||
                                  (inv.supplier_name && inv.supplier_name.toLowerCase().includes(searchVal.toLowerCase())) ||
                                  (inv.customer_name && inv.customer_name.toLowerCase().includes(searchVal.toLowerCase()))
                                );

                                if (filteredProjectInvoices.length === 0) {
                                  return (
                                    <div className="text-center py-8 text-xs text-muted-foreground font-medium">
                                      {projectInvoices.length === 0 
                                        ? 'Még nincs számla hozzárendelve ehhez a projekthez.'
                                        : 'Nincs a keresésnek megfelelő számla.'}
                                    </div>
                                  );
                                }

                                return filteredProjectInvoices.map((invoice) => (
                                  <div
                                    key={invoice.id}
                                    className="group flex items-center justify-between p-2 rounded-lg bg-muted/30 border text-xs transition-colors hover:bg-muted/60"
                                  >
                                    <div className="flex items-center gap-2 min-w-0 mr-1.5">
                                      <div
                                        className={`w-2 h-2 rounded-full shrink-0 ${
                                          invoice.invoice_direction === 'INBOUND' ? 'bg-blue-500' : 'bg-green-500'
                                        }`}
                                      />
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-mono font-bold truncate">
                                            {invoice.invoice_number}
                                          </span>
                                          <span className={`text-[9px] py-0 px-1 rounded font-semibold ${
                                            invoice.invoice_direction === 'INBOUND'
                                              ? 'bg-blue-100 text-blue-700'
                                              : 'bg-green-100 text-green-700'
                                          }`}>
                                            {invoice.invoice_direction === 'INBOUND' ? 'Bejövő' : 'Kimenő'}
                                          </span>
                                        </div>
                                        <div className="text-[10px] text-muted-foreground truncate">
                                          {invoice.invoice_direction === 'INBOUND'
                                            ? (invoice.supplier_name || 'Szállító')
                                            : (invoice.customer_name || 'Ügyfél')}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <span className="font-semibold text-foreground">
                                        {formatCurrency(invoice.invoice_gross_amount || 0, invoice.currency || 'HUF')}
                                      </span>
                                      <button
                                        onClick={() => handleUnassignInvoice(invoice.id)}
                                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 p-1 rounded transition-all md:opacity-0 md:group-hover:opacity-100"
                                        title="Hozzárendelés törlése"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ));
                              })()}
                            </div>

                            {/* Invoice assignment button */}
                            <div className="border-t pt-3 mt-3 shrink-0">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="w-full text-xs flex items-center justify-center gap-1.5"
                                onClick={() => setAssigningProject(project)}
                              >
                                <Plus className="h-3.5 w-3.5" />
                                Számla hozzárendelése
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Edit/Create Project Dialog Modal */}
      <Dialog open={editingProject !== null} onOpenChange={(open) => {
        if (!open) {
          setEditingProject(null);
          setIsCreating(false);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingProject?.id ? 'Projekt szerkesztése' : 'Új projekt létrehozása'}
            </DialogTitle>
            <DialogDescription>
              {editingProject?.id 
                ? 'Módosítsd a projekt adatait és mentsd el a változtatásokat.' 
                : 'Adj meg részleteket az új ügyfélprojektről.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Projekt neve *</Label>
              <Input
                id="edit-name"
                placeholder="pl. Weboldal fejlesztés"
                value={editingProject?.name || ''}
                onChange={(e) => setEditingProject(prev => prev ? { ...prev, name: e.target.value } : null)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="edit-code">Projekt kód (opcionális)</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[280px]">
                      <p className="text-xs">
                        Ha üresen hagyod, a rendszer automatikusan legenerál egy egyedi kódot (pl. PRJ-202606-0022). Kitöltve megadhatod a saját belső projektazonosítódat.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                id="edit-code"
                placeholder="pl. PRJ-2026-001 (üresen hagyva automatikus)"
                value={editingProject?.project_code || ''}
                onChange={(e) => setEditingProject(prev => prev ? { ...prev, project_code: e.target.value } : null)}
                disabled={!!editingProject?.id}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ikon</Label>
                <div className="flex items-center gap-3">
                  <IconPicker
                    value={editingProject?.icon || 'FolderOpen'}
                    onChange={(icon) => setEditingProject(prev => prev ? { ...prev, icon } : null)}
                    color={editingProject?.color || 'hsl(217, 91%, 60%)'}
                  />
                  <span className="text-xs text-muted-foreground">Ikon választás</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Szín</Label>
                <div className="flex items-center gap-3">
                  <ColorPicker
                    value={editingProject?.color || 'hsl(217, 91%, 60%)'}
                    onChange={(color) => setEditingProject(prev => prev ? { ...prev, color } : null)}
                  />
                  <span className="text-xs text-muted-foreground">Kártya szegély színe</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-client">Partner / Ügyfél</Label>
              <PartnerCombobox
                value={editingProject?.client_name || ''}
                onChange={(name) => setEditingProject(prev => prev ? { ...prev, client_name: name } : null)}
                companyId={selectedCompany?.id}
                placeholder="Partner keresése..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-project_type">Típus</Label>
                <Select
                  value={editingProject?.project_type || 'one_time'}
                  onValueChange={(value: 'one_time' | 'recurring') => 
                    setEditingProject(prev => prev ? { ...prev, project_type: value } : null)
                  }
                >
                  <SelectTrigger id="edit-project_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_time">Egyszeri</SelectItem>
                    <SelectItem value="recurring">Ismétlődő</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-status">Státusz</Label>
                <Select
                  value={editingProject?.status || 'active'}
                  onValueChange={(value: any) => setEditingProject(prev => prev ? { ...prev, status: value } : null)}
                >
                  <SelectTrigger id="edit-status">
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-budget">Költségvetés (HUF)</Label>
                <Input
                  id="edit-budget"
                  type="number"
                  placeholder="0"
                  value={editingProject?.budget || ''}
                  onChange={(e) => setEditingProject(prev => prev ? { ...prev, budget: e.target.value ? Number(e.target.value) : undefined } : null)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-start_date">Kezdő dátum</Label>
                <Input
                  id="edit-start_date"
                  type="date"
                  value={editingProject?.start_date || ''}
                  onChange={(e) => setEditingProject(prev => prev ? { ...prev, start_date: e.target.value } : null)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-end_date">Befejezés dátuma</Label>
                <Input
                  id="edit-end_date"
                  type="date"
                  value={editingProject?.end_date || ''}
                  onChange={(e) => setEditingProject(prev => prev ? { ...prev, end_date: e.target.value } : null)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Leírás</Label>
              <Textarea
                id="edit-description"
                placeholder="Projekt részletei..."
                rows={3}
                value={editingProject?.description || ''}
                onChange={(e) => setEditingProject(prev => prev ? { ...prev, description: e.target.value } : null)}
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t mt-4">
            {editingProject?.id ? (
              <Button
                variant="destructive"
                onClick={() => {
                  handleDeleteProject(editingProject.id!);
                  setEditingProject(null);
                }}
                disabled={loading}
              >
                Törlés
              </Button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
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
              <Button onClick={() => handleSaveProject()} disabled={loading}>
                {loading ? 'Mentés...' : 'Mentés'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={assigningProject !== null} onOpenChange={(open) => {
        if (!open) {
          setAssigningProject(null);
          setInvoiceSearchQuery('');
          setModalSelectedInvoices(new Set());
        }
      }}>
        <DialogContent className="max-w-3xl min-w-[320px] sm:min-w-[650px] md:min-w-[800px]">
          <DialogHeader>
            <DialogTitle>Számlák hozzárendelése</DialogTitle>
            <DialogDescription>
              Válassz ki számlákat a(z) "{assigningProject?.name}" projekthez való hozzárendeléshez.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Számlaszám vagy partner keresése..."
                value={invoiceSearchQuery}
                onChange={(e) => setInvoiceSearchQuery(e.target.value)}
                className="pl-9 h-10"
              />
            </div>

            {/* Batch Selection Toolbar */}
            {modalFilteredUnassigned.length > 0 && (
              <div className="flex items-center justify-between px-2.5 text-xs text-muted-foreground bg-muted/30 rounded-lg border border-border/40 h-11 shrink-0 gap-2">
                <div className="flex items-center gap-2.5 pl-0.5">
                  <Checkbox
                    id="select-all-modal"
                    checked={
                      modalFilteredUnassigned.length > 0 &&
                      modalFilteredUnassigned.every(inv => modalSelectedInvoices.has(inv.id))
                    }
                    onCheckedChange={handleToggleSelectAllModalInvoices}
                  />
                  <label htmlFor="select-all-modal" className="cursor-pointer select-none font-semibold text-foreground">
                    Összes kijelölése ezen a listán ({modalFilteredUnassigned.length} db)
                  </label>
                </div>
                {modalSelectedInvoices.size > 0 && (
                  <Button
                    size="sm"
                    className="h-7 px-3 text-xs gap-1.5 animate-in fade-in zoom-in-95 duration-150"
                    onClick={() => {
                      if (assigningProject?.id) {
                        handleBatchAssignInvoices(assigningProject.id);
                      }
                    }}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Kijelöltek hozzárendelése ({modalSelectedInvoices.size} db)
                  </Button>
                )}
              </div>
            )}

            <div className="max-h-[300px] overflow-y-auto overflow-x-hidden w-full border rounded-lg p-1 divide-y bg-background/50">
              {modalFilteredUnassigned.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Nincs hozzárendelhető (projekt nélküli) számla.
                </div>
              ) : (
                modalFilteredUnassigned.map((invoice) => {
                  const isSelected = modalSelectedInvoices.has(invoice.id);
                  return (
                    <div
                      key={invoice.id}
                      className={cn(
                        "flex justify-between items-center p-2.5 hover:bg-muted/60 transition-colors text-xs w-full min-w-0 gap-2 cursor-pointer select-none min-h-[50px]",
                        isSelected && "bg-primary/5 hover:bg-primary/10"
                      )}
                      onClick={() => handleToggleModalInvoiceSelection(invoice.id)}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleModalInvoiceSelection(invoice.id)}
                          onClick={(e) => e.stopPropagation()} // Stop triggering row onClick
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-mono font-bold truncate">
                              {invoice.invoice_number}
                            </span>
                            <Badge
                              variant="secondary"
                              className={`text-[9px] px-1.5 py-0 h-4 border-0 ${
                                invoice.invoice_direction === 'INBOUND'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-green-100 text-green-700'
                              }`}
                            >
                              {invoice.invoice_direction === 'INBOUND' ? 'BE' : 'KI'}
                            </Badge>
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                            {invoice.invoice_direction === 'INBOUND'
                              ? (invoice.supplier_name || 'Szállító')
                              : (invoice.customer_name || 'Ügyfél')}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <span className="font-semibold text-foreground">
                          {formatCurrency(invoice.invoice_gross_amount || 0, invoice.currency || 'HUF')}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2 flex items-center gap-1 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                          onClick={async () => {
                            if (assigningProject?.id) {
                              await handleAssignInvoice(assigningProject.id, invoice.id);
                            }
                          }}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Hozzáad
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setAssigningProject(null);
                setInvoiceSearchQuery('');
                setModalSelectedInvoices(new Set());
              }}
            >
              Bezárás
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Projects;
