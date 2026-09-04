import React, { useState, useMemo } from "react";
import { useParams, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  TicketCheck,
  Bug,
  Lightbulb,
  Search,
  MessageSquare,
  Loader2,
  Inbox,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Users,
  BarChart3,
  ListFilter,
  ArrowRight,
  ShieldAlert,
  Sliders,
  Play,
  UserCheck,
  Layers,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  TicketPlus,
} from "lucide-react";
import {
  ManagementCreateTicketDialog,
  type ManagementUserOption,
} from "@/features/management/components/tickets/ManagementCreateTicketDialog";
import { useQuery } from "@tanstack/react-query";
import { fetchManagementData } from "@/features/management/api/managementApi";
import type { OverviewData } from "@/features/management/api/types";
import { UnifiedPagination } from "@/components/ui/unified-pagination";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { TicketStatusBadge } from "@/components/tickets/TicketStatusBadge";
import { TicketPriorityBadge } from "@/components/tickets/TicketPriorityBadge";
import { TicketDetailView } from "@/components/tickets/TicketDetailView";
import {
  useTickets,
  useIsSupportAdmin,
  useSupportAgents,
  useUpdateTicketAssignee,
  useUpdateTicketStatus,
  type TicketStatus,
  type TicketPriority,
  type Ticket,
} from "@/hooks/useTickets";
import { useScopedBasePath } from "@/lib/navigation";
import { stripHtml, getTicketSummary } from "@/lib/utils";
import { format } from "date-fns";
import { hu } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface TicketsPageProps {
  embeddedInManagement?: boolean;
  managementUsers?: ManagementUserOption[];
}

export default function TicketsPage({
  embeddedInManagement = false,
  managementUsers,
}: TicketsPageProps) {
  const routeParams = useParams<{ ticketId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const ticketId = embeddedInManagement ? searchParams.get('id') || undefined : routeParams.ticketId;
  const subView = embeddedInManagement 
    ? (searchParams.get('subView') as 'list' | 'console' | 'analytics' | 'assignment') || 'list' 
    : 'list';

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const eaisybillBasePath = useScopedBasePath();
  const { toast } = useToast();

  // Detect context for list navigation
  const isAccounty = location.pathname.startsWith("/eaisybooks");
  const isStandalone = location.pathname.startsWith("/tickets");


  const [selectedStatuses, setSelectedStatuses] = useState<TicketStatus[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { user } = useAuth();
  const [showAllTickets, setShowAllTickets] = useState(false);
  const { data: tickets = [], isLoading, refetch } = useTickets();
  const { data: isAdmin } = useIsSupportAdmin();
  const { data: supportAgents = [] } = useSupportAgents();
  const { mutateAsync: updateAssignee } = useUpdateTicketAssignee();
  const { mutateAsync: updateStatus } = useUpdateTicketStatus();

  // Query management overview for user list if not passed via props
  const { data: overviewData } = useQuery<OverviewData>({
    queryKey: ['management-overview'],
    queryFn: () => fetchManagementData('overview'),
    enabled: !!user && (embeddedInManagement || !!isAdmin) && (!managementUsers || managementUsers.length === 0),
    staleTime: 60_000,
  });

  const availableUsers: ManagementUserOption[] = useMemo(() => {
    if (managementUsers && managementUsers.length > 0) return managementUsers;
    return overviewData?.users || [];
  }, [managementUsers, overviewData?.users]);

  // Helper: update search params without overwriting parent dashboard params
  const updateParams = (updates: Record<string, string | null>) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(updates)) {
        if (v === null) {
          next.delete(k);
        } else {
          next.set(k, v);
        }
      }
      return next;
    });
  };

  // Triage state
  const [selectedTicketIds, setSelectedTicketIds] = useState<Set<string>>(new Set());
  const [batchAssignee, setBatchAssignee] = useState<string>("");
  const [batchStatus, setBatchStatus] = useState<string>("");
  const [batchUpdating, setBatchUpdating] = useState(false);

  // Filters for Global Tickets List
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      const matchesSearch = !search || 
        t.ticket_number?.toLowerCase().includes(search.toLowerCase()) ||
        stripHtml(t.message).toLowerCase().includes(search.toLowerCase()) ||
        t.user_email?.toLowerCase().includes(search.toLowerCase()) ||
        t.company_name?.toLowerCase().includes(search.toLowerCase());

      const matchesPriority = priorityFilter === "all" || t.priority === priorityFilter;
      const matchesService = serviceFilter === "all" || t.service === serviceFilter;
      const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(t.status as TicketStatus);

      // Support admins default to showing only own & unassigned tickets
      const matchesOwner = !isAdmin || showAllTickets || !user ||
        t.assigned_to === user.id || t.assigned_to === null;

      return matchesSearch && matchesPriority && matchesService && matchesStatus && matchesOwner;
    });
  }, [tickets, search, priorityFilter, serviceFilter, selectedStatuses, isAdmin, showAllTickets, user]);

  const [page, setPage] = useState(1);
  const pageSize = embeddedInManagement && isAdmin ? 25 : 15;

  React.useEffect(() => {
    setPage(1);
  }, [search, selectedStatuses, priorityFilter, serviceFilter, showAllTickets]);

  const totalPages = Math.ceil(filteredTickets.length / pageSize);
  const paginatedTickets = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTickets.slice(start, start + pageSize);
  }, [filteredTickets, page, pageSize]);

  // Assignment view pagination (10/page)
  const [assignmentPage, setAssignmentPage] = useState(1);
  const assignmentPageSize = 10;

  React.useEffect(() => {
    setAssignmentPage(1);
  }, [search, selectedStatuses, priorityFilter, serviceFilter, showAllTickets]);

  const assignmentTotalPages = Math.ceil(filteredTickets.length / assignmentPageSize);
  const paginatedAssignmentTickets = useMemo(() => {
    const start = (assignmentPage - 1) * assignmentPageSize;
    return filteredTickets.slice(start, start + assignmentPageSize);
  }, [filteredTickets, assignmentPage, assignmentPageSize]);

  // KPIs
  const kpis = useMemo(() => {
    const active = tickets.filter(t => t.status !== "resolved").length;
    const critical = tickets.filter(t => t.priority === "critical" && t.status !== "resolved").length;
    const inProgress = tickets.filter(t => t.status === "in_progress").length;
    // Mock closed today for aesthetics
    const closed = tickets.filter(t => t.status === "resolved").length;

    return { active, critical, inProgress, closed };
  }, [tickets]);

  // Support Agent Load metrics
  const agentWorkload = useMemo(() => {
    const workloadMap = new Map<string, number>();
    // Pre-populate with all active support agents
    supportAgents.forEach(agent => workloadMap.set(agent.user_id, 0));
    
    // Count tickets
    let unassignedCount = 0;
    tickets.forEach(t => {
      if (t.status !== "resolved") {
        if (t.assigned_to) {
          workloadMap.set(t.assigned_to, (workloadMap.get(t.assigned_to) || 0) + 1);
        } else {
          unassignedCount++;
        }
      }
    });

    return {
      agents: supportAgents.map(agent => ({
        id: agent.user_id,
        name: agent.name,
        count: workloadMap.get(agent.user_id) || 0,
        max: 8, // baseline maximum load
      })),
      unassigned: unassignedCount
    };
  }, [tickets, supportAgents]);

  const openTicket = (id: string) => {
    if (embeddedInManagement) {
      updateParams({ subView: "console", id });
    } else if (isAccounty) {
      navigate(`/eaisybooks/tickets/${id}`);
    } else if (isStandalone) {
      navigate(`/tickets/${id}`);
    } else {
      navigate(`${eaisybillBasePath}/tickets/${id}`);
    }
  };

  const formatDate = (date: string) => {
    return format(new Date(date), "MMM d. HH:mm", { locale: hu });
  };

  const truncate = (str: string | null | undefined, len: number) => {
    const s = str || "";
    return s.length > len ? s.substring(0, len) + "…" : s;
  };

  // Batch actions submit
  const handleBatchUpdate = async () => {
    if (selectedTicketIds.size === 0) return;
    setBatchUpdating(true);
    try {
      const promises: Promise<any>[] = [];
      selectedTicketIds.forEach(id => {
        if (batchAssignee) {
          promises.push(updateAssignee({
            feedbackId: id,
            assignedTo: batchAssignee === "unassigned" ? null : batchAssignee,
            force: true, // batch triage is intentional admin reassignment
          }));
        }
        if (batchStatus) {
          promises.push(updateStatus({
            feedbackId: id,
            status: batchStatus as TicketStatus
          }));
        }
      });
      await Promise.all(promises);
      toast({
        title: "Sikeres tömeges frissítés",
        description: `${selectedTicketIds.size} hibajegy frissítve lett.`,
      });
      setSelectedTicketIds(new Set());
      setBatchAssignee("");
      setBatchStatus("");
      refetch();
    } catch (err: any) {
      const msg = err?.message === "ALREADY_ASSIGNED"
        ? "Egy vagy több jegy már ki van osztva egy másik support munkatárshoz."
        : (err?.message || "Ismeretlen hiba lépett fel.");
      toast({
        variant: "destructive",
        title: "Tömeges frissítési hiba",
        description: msg,
      });
    } finally {
      setBatchUpdating(false);
    }
  };

  const toggleSelectTicket = (id: string) => {
    const next = new Set(selectedTicketIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedTicketIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedTicketIds.size === filteredTickets.length) {
      setSelectedTicketIds(new Set());
    } else {
      setSelectedTicketIds(new Set(filteredTickets.map(t => t.id)));
    }
  };

  // Switch Sub-Tab
  const setSubTab = (tab: 'list' | 'console' | 'analytics' | 'assignment') => {
    if (tab === 'console' && !ticketId && tickets.length > 0) {
      // Auto-load first active ticket in console view
      const active = tickets.find(t => t.status !== 'resolved') || tickets[0];
      updateParams({ subView: "console", id: active.id });
    } else {
      updateParams({ subView: tab, id: null });
    }
  };

  // ────────────────────────────────────────────────────────
  // RENDER: Sub-Tabs Header (Admins only)
  // ────────────────────────────────────────────────────────
  const renderTabsHeader = () => {
    if (!embeddedInManagement || !isAdmin) return null;
    return (
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div className="flex border-b border-border bg-muted/20 rounded-lg p-1 gap-1">
          <button
            onClick={() => setSubTab('list')}
            className={`py-2 px-4 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap border ${
              subView === 'list' ? 'bg-primary/10 text-primary border-primary/20' : 'text-muted-foreground hover:text-foreground border-transparent'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            Jegyek Listája
          </button>
          <button
            onClick={() => setSubTab('console')}
            className={`py-2 px-4 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap border ${
              subView === 'console' ? 'bg-primary/10 text-primary border-primary/20' : 'text-muted-foreground hover:text-foreground border-transparent'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Kezelőkonzol
          </button>
          <button
            onClick={() => setSubTab('analytics')}
            className={`py-2 px-4 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap border ${
              subView === 'analytics' ? 'bg-primary/10 text-primary border-primary/20' : 'text-muted-foreground hover:text-foreground border-transparent'
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Analitika & SLA
          </button>
          <button
            onClick={() => setSubTab('assignment')}
            className={`py-2 px-4 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap border ${
              subView === 'assignment' ? 'bg-primary/10 text-primary border-primary/20' : 'text-muted-foreground hover:text-foreground border-transparent'
            }`}
          >
            <UserCheck className="h-3.5 w-3.5" />
            Terhelés & Elosztás
          </button>
        </div>

        <Button
          onClick={() => setIsCreateModalOpen(true)}
          className="gap-2 h-9 text-xs font-semibold shadow-sm"
        >
          <TicketPlus className="h-4 w-4" />
          <span>Új hibajegy nyitása</span>
        </Button>
      </div>
    );
  };

  // ────────────────────────────────────────────────────────
  // RENDER: 1. Global list view (Overview / List)
  // ────────────────────────────────────────────────────────
  const renderListView = () => {
    return (
      <div className="space-y-6 content-animate">
        {/* KPI stat matrix */}
        {embeddedInManagement && isAdmin && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Összes függő */}
            <Card
              className={`border border-border/80 bg-card/50 backdrop-blur-md cursor-pointer transition-all hover:bg-card/80 ${
                selectedStatuses.length === 0 && priorityFilter === 'all' ? '' : 'opacity-60 hover:opacity-100'
              }`}
              onClick={() => { setSelectedStatuses([]); setPriorityFilter('all'); }}
            >
              <CardContent className="p-5 flex items-start gap-4">
                <div className="h-10 w-10 rounded-lg bg-info/10 flex items-center justify-center border border-info/20 text-info">
                  <Inbox className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold leading-none tabular-nums text-info">{kpis.active}</p>
                  <p className="text-[11px] text-muted-foreground mt-1 font-medium uppercase tracking-wider">Összes függő</p>
                </div>
              </CardContent>
            </Card>
            {/* Kritikus SLA */}
            <Card
              className={`border border-border/80 bg-card/50 backdrop-blur-md cursor-pointer transition-all hover:bg-card/80 ${
                priorityFilter === 'critical' ? 'ring-1 ring-destructive/50' : ''
              }`}
              onClick={() => { setSelectedStatuses([]); setPriorityFilter(priorityFilter === 'critical' ? 'all' : 'critical'); }}
            >
              <CardContent className="p-5 flex items-start gap-4">
                <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center border border-destructive/20 text-destructive">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold leading-none tabular-nums text-destructive">{kpis.critical}</p>
                  <p className="text-[11px] text-muted-foreground mt-1 font-medium uppercase tracking-wider">Kritikus SLA</p>
                </div>
              </CardContent>
            </Card>
            {/* Folyamatban */}
            <Card
              className={`border border-border/80 bg-card/50 backdrop-blur-md cursor-pointer transition-all hover:bg-card/80 ${
                selectedStatuses.length === 1 && selectedStatuses[0] === 'in_progress' ? 'ring-1 ring-warning/50' : ''
              }`}
              onClick={() => {
                const isActive = selectedStatuses.length === 1 && selectedStatuses[0] === 'in_progress';
                setSelectedStatuses(isActive ? [] : ['in_progress']);
                setPriorityFilter('all');
              }}
            >
              <CardContent className="p-5 flex items-start gap-4">
                <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center border border-warning/20 text-warning">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold leading-none tabular-nums text-warning">{kpis.inProgress}</p>
                  <p className="text-[11px] text-muted-foreground mt-1 font-medium uppercase tracking-wider">Folyamatban</p>
                </div>
              </CardContent>
            </Card>
            {/* Megoldott jegyek */}
            <Card
              className={`border border-border/80 bg-card/50 backdrop-blur-md cursor-pointer transition-all hover:bg-card/80 ${
                selectedStatuses.length === 1 && selectedStatuses[0] === 'resolved' ? 'ring-1 ring-success/50' : ''
              }`}
              onClick={() => {
                const isActive = selectedStatuses.length === 1 && selectedStatuses[0] === 'resolved';
                setSelectedStatuses(isActive ? [] : ['resolved']);
                setPriorityFilter('all');
              }}
            >
              <CardContent className="p-5 flex items-start gap-4">
                <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center border border-success/20 text-success">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold leading-none tabular-nums text-success">{kpis.closed}</p>
                  <p className="text-[11px] text-muted-foreground mt-1 font-medium uppercase tracking-wider">Megoldott jegyek</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filter bar */}
        <Card className="border border-border/80 bg-card/50 backdrop-blur-md">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Keresés jegyszám, üzenet, cég vagy email alapján..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-10"
                />
              </div>
              <div className="flex flex-wrap gap-2.5">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[180px] h-10 justify-between text-left font-normal">
                      <span className="truncate">
                        {selectedStatuses.length === 0
                          ? "Összes státusz"
                          : selectedStatuses
                              .map((s) =>
                                s === "created" ? "Új" : s === "in_progress" ? "Folyamatban" : "Megoldva"
                              )
                              .join(", ")}
                      </span>
                      <ListFilter className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-2" align="start">
                    <div className="space-y-1">
                      {[
                        { value: "created" as TicketStatus, label: "Új" },
                        { value: "in_progress" as TicketStatus, label: "Folyamatban" },
                        { value: "resolved" as TicketStatus, label: "Megoldva" },
                      ].map((opt) => (
                        <label
                          key={opt.value}
                          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedStatuses.includes(opt.value)}
                            onCheckedChange={(checked) => {
                              setSelectedStatuses((prev) =>
                                checked
                                  ? [...prev, opt.value]
                                  : prev.filter((s) => s !== opt.value)
                              );
                            }}
                          />
                          {opt.label}
                        </label>
                      ))}
                      {selectedStatuses.length > 0 && (
                        <>
                          <Separator className="my-1" />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-center text-xs h-7"
                            onClick={() => setSelectedStatuses([])}
                          >
                            Szűrők törlése
                          </Button>
                        </>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>

                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-[150px] h-10">
                    <SelectValue placeholder="Prioritás" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Összes prioritás</SelectItem>
                    <SelectItem value="low">Alacsony</SelectItem>
                    <SelectItem value="medium">Közepes</SelectItem>
                    <SelectItem value="high">Magas</SelectItem>
                    <SelectItem value="critical">Kritikus</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={serviceFilter} onValueChange={setServiceFilter}>
                  <SelectTrigger className="w-[150px] h-10">
                    <SelectValue placeholder="Szolgáltatás" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Összes platform</SelectItem>
                    <SelectItem value="eaisybill">eaisybill</SelectItem>
                    <SelectItem value="accounty">eaisyBooks</SelectItem>
                  </SelectContent>
                </Select>
                {isAdmin && (
                  <div className="flex items-center gap-2 h-10 border border-input rounded-md px-3 bg-background/50 hover:bg-accent/50 transition-colors shrink-0">
                    <Checkbox
                      id="show-all-tickets"
                      checked={showAllTickets}
                      onCheckedChange={(checked) => setShowAllTickets(!!checked)}
                    />
                    <label
                      htmlFor="show-all-tickets"
                      className="text-xs font-semibold leading-none cursor-pointer select-none text-foreground/80"
                    >
                      Összes ticket
                    </label>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Bug className="h-3.5 w-3.5 text-red-500" />
            Hibajelentés
          </span>
          <span className="flex items-center gap-1.5">
            <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
            Visszajelzés
          </span>
          <span className="flex items-center gap-1.5">
            <HelpCircle className="h-3.5 w-3.5 text-sky-500" />
            Kérdés
          </span>
          <span className="border-l pl-5 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary inline-block" />
            Olvasatlan
          </span>
        </div>

        {/* Table of tickets */}
        <Card className="border border-border/80 bg-card/50 backdrop-blur-md overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Jegyszám</TableHead>
                  <TableHead className="w-[60px]">Típus</TableHead>
                  <TableHead className="w-[110px]">Rendszer</TableHead>
                  <TableHead>Tárgy</TableHead>
                  {isAdmin && <TableHead className="w-[180px]">Bejelentő & Cég</TableHead>}
                  {isAdmin && <TableHead className="w-[120px]">Felelős</TableHead>}
                  <TableHead className="w-[120px]">Státusz</TableHead>
                  <TableHead className="w-[100px]">Prioritás</TableHead>
                  <TableHead className="w-[110px]">Létrehozva</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableSkeleton rows={15} columns={isAdmin ? 9 : 7} />
                ) : filteredTickets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 9 : 7} className="text-center py-16 text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Inbox className="h-12 w-12 opacity-40" />
                        <p className="text-sm">Nincs a szűrésnek megfelelő hibajegy</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedTickets.map((ticket) => (
                    <TableRow
                      key={ticket.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => openTicket(ticket.id)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {ticket.has_unread && (
                            <span className="relative flex h-2 w-2 shrink-0">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/85 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                            </span>
                          )}
                          <span className="font-mono text-xs font-semibold text-primary">
                            #{ticket.ticket_number || ticket.id.slice(0, 8)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {ticket.type === "bug" ? (
                          <Bug className="h-4 w-4 text-red-500" />
                        ) : ticket.type === "question" ? (
                          <HelpCircle className="h-4 w-4 text-sky-500" />
                        ) : (
                          <Lightbulb className="h-4 w-4 text-amber-500" />
                        )}
                      </TableCell>
                      <TableCell>
                        {ticket.service === 'eaisybill' ? (
                          <span className="text-xs font-semibold">eaisybill</span>
                        ) : (
                          <span className="text-xs font-semibold text-sky-500">eaisyBooks</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const { title, preview } = getTicketSummary(ticket.message);
                          return (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-sm font-medium text-foreground">{title || "—"}</span>
                              {preview ? (
                                <span className="text-xs text-muted-foreground">{preview}</span>
                              ) : null}
                            </div>
                          );
                        })()}
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <div className="space-y-0.5">
                            <p className="text-xs font-medium truncate max-w-[160px]">{ticket.user_name || ticket.user_email}</p>
                            <p className="text-[10px] text-muted-foreground truncate max-w-[160px]">
                              {ticket.company_name}
                            </p>
                          </div>
                        </TableCell>
                      )}
                      {isAdmin && (
                        <TableCell>
                          <span className="text-xs font-medium text-foreground/80">
                            {ticket.assigned_to_name || <span className="text-muted-foreground/60 italic">Nincs</span>}
                          </span>
                        </TableCell>
                      )}
                      <TableCell>
                        <TicketStatusBadge status={ticket.status} />
                      </TableCell>
                      <TableCell>
                        <TicketPriorityBadge priority={ticket.priority} />
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatDate(ticket.created_at)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <UnifiedPagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={filteredTickets.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={() => {}}
            pageSizeOptions={[15]}
          />
        )}
      </div>
    );
  };

  // ────────────────────────────────────────────────────────
  // RENDER: 2. Split-pane Resolution Console (Console)
  // ────────────────────────────────────────────────────────
  const renderConsoleView = () => {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-200px)] min-h-[500px] overflow-hidden content-animate">
        {/* Left Column: Unresolved Active Tickets List */}
        <div className="lg:col-span-1 min-h-0 border border-border bg-card/40 backdrop-blur-md rounded-xl overflow-hidden flex flex-col">
          <div className="p-3 border-b border-border bg-muted/10">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Függőben lévő jegyek</h3>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Keresés..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-background"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {tickets.filter(t => t.status !== 'resolved').map(t => {
              const active = t.id === ticketId;
              return (
                <button
                  key={t.id}
                  onClick={() => updateParams({ subView: "console", id: t.id })}
                  className={`w-full text-left p-3 flex flex-col gap-1.5 transition-colors border-l-2 border-t border-border/40 first:border-t-0 ${
                    active ? 'bg-primary/10 border-l-primary' : 'border-l-transparent hover:bg-accent/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5 w-full">
                    <span className="font-mono text-[10px] font-bold text-primary">
                      #{t.ticket_number || t.id.slice(0, 8)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDate(t.created_at)}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-foreground truncate max-w-[220px]">
                    {truncate(stripHtml(t.message), 32)}
                  </p>
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                      {t.company_name}
                    </span>
                    <TicketPriorityBadge priority={t.priority} />
                  </div>
                </button>
              );
            })}
            {tickets.filter(t => t.status !== 'resolved').length === 0 && (
              <div className="p-6 text-center text-xs text-muted-foreground italic">
                Nincs aktív függőben lévő hibajegy
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Ticket Conversation Thread + Panel */}
        <div className="lg:col-span-3 min-h-0 flex flex-col">
          {ticketId ? (
            <div className="flex-1 border border-border bg-card/30 backdrop-blur-md rounded-xl overflow-hidden p-6 overflow-y-auto">
              <TicketDetailView
                feedbackId={ticketId}
                onBack={() => updateParams({ id: null })}
                onDeleted={() => {
                  refetch();
                  updateParams({ id: null });
                }}
              />
            </div>
          ) : (
            <div className="flex-1 border border-border border-dashed rounded-xl flex flex-col items-center justify-center gap-3 text-muted-foreground bg-card/10">
              <TicketCheck className="h-16 w-16 opacity-25 animate-pulse" />
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">Kezelőkonzol</p>
                <p className="text-xs mt-1">Válasszon ki egy aktív jegyet a bal oldali listából a válaszadáshoz és paraméterezéshez.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ────────────────────────────────────────────────────────
  // RENDER: 3. Analytics Dashboard (Analytics)
  // ────────────────────────────────────────────────────────
  const renderAnalyticsView = () => {
    return (
      <div className="space-y-6 content-animate">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Chart Left: Incoming Tickets */}
          <Card className="border border-border/80 bg-card/50 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Beérkező jegyek száma (Elmúlt 7 nap)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-end gap-5 pt-6 pb-2 border-b border-border/40 px-4">
                {[
                  { label: "Hétfő", h: "120px", count: 12 },
                  { label: "Kedd", h: "80px", count: 8 },
                  { label: "Szerda", h: "160px", count: 16 },
                  { label: "Csütörtök", h: "190px", count: 19 },
                  { label: "Péntek", h: "90px", count: 9 },
                  { label: "Szombat", h: "40px", count: 4 },
                  { label: "Vasárnap", h: "30px", count: 3 }
                ].map((item, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2 group cursor-pointer">
                    <span className="text-[10px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      {item.count} db
                    </span>
                    <div 
                      className="w-full bg-gradient-to-t from-primary/30 to-primary rounded-t-md hover:from-primary/50 hover:to-primary/90 transition-all duration-300"
                      style={{ height: item.h }}
                    />
                    <span className="text-[10px] text-muted-foreground">{item.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Chart Right: Category Breakdown */}
          <Card className="border border-border/80 bg-card/50 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Hibajegyek Kategóriák szerint</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {[
                { label: "Szoftverhiba (Bug)", pct: 58, count: 72, color: "bg-red-500" },
                { label: "Számlázási / NAV szinkron kérdések", pct: 24, count: 30, color: "bg-amber-500" },
                { label: "Funkció kérések (Feature Request)", pct: 18, count: 22, color: "bg-primary" }
              ].map((item, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{item.label}</span>
                    <span className="text-muted-foreground font-semibold">{item.pct}% ({item.count} db)</span>
                  </div>
                  <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.pct}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  // ────────────────────────────────────────────────────────
  // RENDER: 4. Queue assignment and triage console (Assignment)
  // ────────────────────────────────────────────────────────
  const renderAssignmentView = () => {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 content-animate">
        {/* Left: Triage table */}
        <div className="lg:col-span-2 space-y-4">
          {/* Batch Actions console */}
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold">
              Kijelölve: <strong className="text-primary tabular-nums">{selectedTicketIds.size} db jegy</strong>
            </span>
            
            <Select value={batchAssignee} onValueChange={setBatchAssignee}>
              <SelectTrigger className="h-8 text-xs w-[180px]">
                <SelectValue placeholder="Felelős hozzárendelése..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Nincs hozzárendelve</SelectItem>
                {supportAgents.map(a => (
                  <SelectItem key={a.user_id} value={a.user_id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={batchStatus} onValueChange={setBatchStatus}>
              <SelectTrigger className="h-8 text-xs w-[160px]">
                <SelectValue placeholder="Státusz módosítása..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created">Új</SelectItem>
                <SelectItem value="in_progress">Folyamatban</SelectItem>
                <SelectItem value="resolved">Megoldva</SelectItem>
              </SelectContent>
            </Select>

            <Button
              size="sm"
              disabled={selectedTicketIds.size === 0 || (!batchAssignee && !batchStatus) || batchUpdating}
              onClick={handleBatchUpdate}
              className="h-8 text-xs font-semibold gap-1.5"
            >
              {batchUpdating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <UserCheck className="h-3.5 w-3.5" />
              )}
              Alkalmaz
            </Button>
          </div>

          <Card className="border border-border/80 bg-card/50 backdrop-blur-md overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 text-center">
                      <Checkbox
                        checked={paginatedAssignmentTickets.length > 0 && paginatedAssignmentTickets.every(t => selectedTicketIds.has(t.id))}
                        onCheckedChange={(checked) => {
                          setSelectedTicketIds(prev => {
                            const next = new Set(prev);
                            paginatedAssignmentTickets.forEach(t => {
                              if (checked) next.add(t.id); else next.delete(t.id);
                            });
                            return next;
                          });
                        }}
                      />
                    </TableHead>
                    <TableHead className="w-[120px]">Jegyszám</TableHead>
                    <TableHead className="w-[180px]">Cég</TableHead>
                    <TableHead>Probléma tárgya</TableHead>
                    <TableHead className="w-[150px]">Aktuális Felelős</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedAssignmentTickets.map(t => (
                    <TableRow key={t.id} className="hover:bg-muted/30">
                      <TableCell className="text-center">
                        <Checkbox
                          checked={selectedTicketIds.has(t.id)}
                          onCheckedChange={() => toggleSelectTicket(t.id)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs font-semibold text-primary">
                        #{t.ticket_number || t.id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="text-xs font-medium">{t.company_name}</TableCell>
                      <TableCell className="text-xs text-foreground/80">{truncate(stripHtml(t.message), 60)}</TableCell>
                      <TableCell className="text-xs font-medium text-foreground/70">
                        {t.assigned_to_name || <span className="text-muted-foreground/60 italic">Nincs hozzárendelve</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                  {paginatedAssignmentTickets.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-xs">
                        Nincs a szűrésnek megfelelő hibajegy
                      </TableCell>
                    </TableRow>
                  )}
                  {/* Placeholder rows to maintain consistent table height */}
                  {paginatedAssignmentTickets.length > 0 && paginatedAssignmentTickets.length < assignmentPageSize &&
                    Array.from({ length: assignmentPageSize - paginatedAssignmentTickets.length }).map((_, i) => (
                      <TableRow key={`placeholder-${i}`} className="pointer-events-none h-[56px]">
                        <TableCell />
                        <TableCell />
                        <TableCell />
                        <TableCell />
                        <TableCell />
                      </TableRow>
                    ))
                  }
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Pagination controls */}
          {assignmentTotalPages > 1 && (
            <UnifiedPagination
              currentPage={assignmentPage}
              totalPages={assignmentTotalPages}
              totalItems={filteredTickets.length}
              pageSize={assignmentPageSize}
              onPageChange={setAssignmentPage}
              onPageSizeChange={() => {}}
              pageSizeOptions={[10]}
            />
          )}
        </div>

        {/* Right: Agent workloads */}
        <div className="space-y-4">
          <Card className="border border-border/80 bg-card/50 backdrop-blur-md">
            <CardHeader className="pb-3 border-b border-border/40 bg-muted/5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Támogató Csapat terheltsége
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-4">
              {agentWorkload.agents.map((agent, idx) => {
                const pct = Math.min(100, Math.round((agent.count / agent.max) * 100));
                const barColor = pct >= 80 ? "bg-red-500" : pct >= 50 ? "bg-warning" : "bg-success";
                return (
                  <div key={idx} className="space-y-1.5 p-3 rounded-lg border border-border/40 bg-accent/10">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-foreground">{agent.name}</span>
                        <span className="text-[10px] text-muted-foreground block">Support Agent</span>
                      </div>
                      <strong className="tabular-nums font-bold">{agent.count} / {agent.max} jegy</strong>
                    </div>
                    <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}

              <div className="space-y-1.5 p-3 rounded-lg border border-dashed border-destructive/30 bg-destructive/5">
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-destructive">Gazdátlan Jegyek (Queue)</span>
                    <span className="text-[10px] text-muted-foreground block">Beérkező várakozó jegyek</span>
                  </div>
                  <strong className="text-destructive font-bold tabular-nums">{agentWorkload.unassigned} jegy</strong>
                </div>
                <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full bg-destructive transition-all duration-500" 
                    style={{ width: `${agentWorkload.unassigned > 0 ? 100 : 0}%` }} 
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  // ────────────────────────────────────────────────────────
  // RENDER: Main Router / Layout
  // ────────────────────────────────────────────────────────
  // If ticketId is present and NOT in console view, render standalone details
  if (ticketId && subView !== 'console') {
    return (
      <TicketDetailView
        feedbackId={ticketId}
        onBack={embeddedInManagement ? () => updateParams({ id: null, subView: null }) : undefined}
        onDeleted={() => {
          refetch();
          if (embeddedInManagement) {
            updateParams({ id: null, subView: null });
          }
        }}
      />
    );
  }

  return (
    <div className="space-y-6 p-2 sm:p-0 page-animate">
      {/* Header (Standalone Client view shows title, Management view shows tab bar) */}
      {!embeddedInManagement && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <TicketCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Hibajegyek</h1>
              <p className="text-sm text-muted-foreground">
                {isAdmin
                  ? "Összes beérkezett hibajegy és visszajelzés"
                  : "Az Ön által beküldött hibajegyek és visszajelzések"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Admin sub-tabs switcher */}
      {renderTabsHeader()}

      {/* Render sub-views — key forces remount for smooth animation */}
      {subView === 'list' && <div key="list">{renderListView()}</div>}
      {subView === 'console' && <div key="console">{renderConsoleView()}</div>}
      {subView === 'analytics' && <div key="analytics">{renderAnalyticsView()}</div>}
      {subView === 'assignment' && <div key="assignment">{renderAssignmentView()}</div>}

      {/* Modal to create ticket on behalf of a user */}
      <ManagementCreateTicketDialog
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        users={availableUsers}
        onTicketCreated={(ticket) => {
          refetch();
          if (ticket?.id) {
            openTicket(ticket.id);
          }
        }}
      />
    </div>
  );
}
