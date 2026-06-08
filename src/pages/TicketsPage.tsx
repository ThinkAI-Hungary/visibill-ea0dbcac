import React, { useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
} from "lucide-react";
import { TicketStatusBadge } from "@/components/tickets/TicketStatusBadge";
import { TicketPriorityBadge } from "@/components/tickets/TicketPriorityBadge";
import { TicketDetailView } from "@/components/tickets/TicketDetailView";
import {
  useTickets,
  useIsSupportAdmin,
  type TicketStatus,
} from "@/hooks/useTickets";
import { useScopedBasePath } from "@/lib/navigation";
import { format } from "date-fns";
import { hu } from "date-fns/locale";

export default function TicketsPage() {
  const { ticketId } = useParams<{ ticketId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const eaisybillBasePath = useScopedBasePath();

  // Detect context for list navigation (back from detail)
  const isAccounty = location.pathname.startsWith("/accounty");
  const isStandalone = location.pathname.startsWith("/tickets");

  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");
  const [search, setSearch] = useState("");

  const { data: tickets = [], isLoading } = useTickets(statusFilter);
  const { data: isAdmin } = useIsSupportAdmin();

  // If ticketId is present, show detail view
  if (ticketId) {
    return <TicketDetailView feedbackId={ticketId} />;
  }

  const filteredTickets = search
    ? tickets.filter(
        (t) =>
          t.ticket_number?.toLowerCase().includes(search.toLowerCase()) ||
          t.message.toLowerCase().includes(search.toLowerCase()) ||
          t.user_email?.toLowerCase().includes(search.toLowerCase()) ||
          t.company_name?.toLowerCase().includes(search.toLowerCase())
      )
    : tickets;

  // Navigate to ticket within current context to preserve sidebar layout
  const openTicket = (id: string) => {
    if (isAccounty) {
      navigate(`/accounty/tickets/${id}`);
    } else if (isStandalone) {
      navigate(`/tickets/${id}`);
    } else {
      navigate(`${eaisybillBasePath}/tickets/${id}`);
    }
  };

  const formatDate = (date: string) => {
    return format(new Date(date), "MMM d. HH:mm", { locale: hu });
  };

  const truncate = (str: string, len: number) =>
    str.length > len ? str.substring(0, len) + "…" : str;

  return (
    <div className="space-y-6 p-2 sm:p-0 page-animate">
      {/* Header */}
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

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Keresés jegyszám, üzenet, email alapján..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as TicketStatus | "all")}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Szűrés státusz..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Összes státusz</SelectItem>
                <SelectItem value="created">Új</SelectItem>
                <SelectItem value="in_progress">Folyamatban</SelectItem>
                <SelectItem value="resolved">Megoldva</SelectItem>
              </SelectContent>
            </Select>
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
        <span className="border-l pl-5 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-primary inline-block" />
          Olvasatlan
        </span>
        <span className="border-l pl-5 flex items-center gap-1.5">
          <span className="inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium bg-blue-500/10 text-blue-600 border-blue-500/20">Új</span>
          <span className="inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/10 text-amber-600 border-amber-500/20">Folyamatban</span>
          <span className="inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Megoldva</span>
        </span>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Inbox className="h-12 w-12 opacity-40" />
              <p className="text-sm">Nincs megjeleníthető hibajegy</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[130px]">Jegyszám</TableHead>
                  <TableHead className="w-[60px]">Típus</TableHead>
                  <TableHead className="w-[110px]">Szolgáltatás</TableHead>
                  <TableHead>Tárgy</TableHead>
                  {isAdmin && <TableHead className="w-[140px]">Bejelentő</TableHead>}
                  <TableHead className="w-[120px]">Státusz</TableHead>
                  <TableHead className="w-[100px]">Prioritás</TableHead>
                  <TableHead className="w-[80px] text-center">
                    <MessageSquare className="h-4 w-4 mx-auto" />
                  </TableHead>
                  <TableHead className="w-[110px]">Létrehozva</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTickets.map((ticket) => (
                  <TableRow
                    key={ticket.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => openTicket(ticket.id)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {ticket.has_unread && (
                          <span className="relative flex h-2.5 w-2.5 shrink-0">
                            <span className="animate-pulse-dot absolute inline-flex h-full w-full rounded-full bg-primary/50" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
                          </span>
                        )}
                        <span className="font-mono text-sm font-medium">
                          {ticket.ticket_number}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {ticket.type === "bug" ? (
                        <Bug className="h-4 w-4 text-red-500" />
                      ) : (
                        <Lightbulb className="h-4 w-4 text-amber-500" />
                      )}
                    </TableCell>
                    <TableCell>
                      {ticket.service === 'eaisybill' ? (
                        <span className="text-xs font-medium">
                          <span className="text-foreground/80">e</span>
                          <span className="font-bold text-primary">ai</span>
                          <span className="text-foreground/80">sy</span>
                          <span className="text-primary">bill</span>
                        </span>
                      ) : ticket.service === 'accounty' ? (
                        <span className="text-xs font-black bg-gradient-to-br from-red-500 via-red-600 to-red-700 bg-clip-text text-transparent">
                          Accounty
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{truncate(ticket.message, 80)}</span>
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="text-xs truncate">{ticket.user_email}</p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {ticket.company_name}
                          </p>
                        </div>
                      </TableCell>
                    )}
                    <TableCell>
                      <TicketStatusBadge status={ticket.status} />
                    </TableCell>
                    <TableCell>
                      <TicketPriorityBadge priority={ticket.priority} />
                    </TableCell>
                    <TableCell className="text-center">
                      {ticket.comment_count > 0 ? (
                        <Badge variant="secondary" className="text-xs tabular-nums">
                          {ticket.comment_count}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(ticket.created_at)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
