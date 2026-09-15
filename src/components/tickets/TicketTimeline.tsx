import React from "react";
import {
  PlusCircle,
  ArrowRight,
  MessageSquare,
  Clock,
  Loader2,
  Headset,
  CheckCircle2,
  XCircle,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useTicketEvents, type TicketEvent } from "@/hooks/useTickets";
import { ThinkAiBadge } from "./ThinkAiBadge";
import { format } from "date-fns";
import { getDateFnsLocale } from "@/lib/locale/formatters";
import { useTranslation } from "react-i18next";

const STATUS_COLORS: Record<string, string> = {
  new: "text-blue-500",
  created: "text-blue-500",
  open: "text-blue-500",
  assigned: "text-purple-500",
  in_progress: "text-amber-500",
  resolved: "text-emerald-500",
};

function EventIcon({ type, isStaff }: { type: TicketEvent["event_type"]; isStaff?: boolean }) {
  let icon: React.ReactNode;
  let colorClasses = "";

  switch (type) {
    case "created":
      icon = isStaff ? <Headset className="h-4 w-4" /> : <PlusCircle className="h-4 w-4" />;
      colorClasses = "bg-primary/10 border-primary/30 text-primary";
      break;
    case "status_changed":
      icon = <ArrowRight className="h-4 w-4" />;
      colorClasses = "bg-amber-500/10 border-amber-500/30 text-amber-500";
      break;
    case "comment_added":
      icon = <MessageSquare className="h-4 w-4" />;
      colorClasses = "bg-blue-500/10 border-blue-500/30 text-blue-500";
      break;
    case "assignee_changed":
      icon = <Headset className="h-4 w-4" />;
      colorClasses = "bg-blue-600/10 border-blue-600/30 text-blue-600";
      break;
    case "resolution_requested":
      icon = <Sparkles className="h-4 w-4" />;
      colorClasses = "bg-sky-500/10 border-sky-500/30 text-sky-500";
      break;
    case "resolution_confirmed":
      icon = <CheckCircle2 className="h-4 w-4" />;
      colorClasses = "bg-emerald-500/10 border-emerald-500/30 text-emerald-500";
      break;
    case "resolution_rejected":
      icon = <XCircle className="h-4 w-4" />;
      colorClasses = "bg-amber-500/10 border-amber-500/30 text-amber-500";
      break;
  }

  return (
    <div className="h-8 w-8 rounded-full bg-card flex items-center justify-center ring-4 ring-card shrink-0 shadow-xs">
      <div className={`h-full w-full rounded-full border flex items-center justify-center ${colorClasses}`}>
        {icon}
      </div>
    </div>
  );
}

function EventContent({
  event,
  isStaffInitiatedTicket,
}: {
  event: TicketEvent;
  isStaffInitiatedTicket?: boolean;
}) {
  const { t: rawT } = useTranslation(['tickets', 'common']);
  const t = (key: string, opts?: any): any => rawT((key.includes(':') ? key : `tickets:${key}`) as any, opts);
  const actorName = event.actor_name || event.actor_email || t('detail.timeline.system');
  const isAdmin = event.metadata?.is_admin === true;

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      new: t('status.created'),
      created: t('status.created'),
      open: t('status.created'),
      assigned: t('status.assigned'),
      in_progress: t('status.in_progress'),
      resolved: t('status.resolved'),
    };
    return map[status] || status;
  };

  switch (event.event_type) {
    case "created": {
      const isStaffCreated = Boolean(
        event.metadata?.created_by_staff ||
        event.metadata?.created_on_behalf ||
        event.metadata?.is_admin ||
        isStaffInitiatedTicket
      );

      return (
        <div>
          <p className="text-sm">
            <span className="font-medium">{actorName}</span>
            {isStaffCreated && (
              <ThinkAiBadge size="xs" className="ml-1.5" />
            )}{" "}
            <span className="text-muted-foreground">
              {t('detail.timeline.created_ticket')}
            </span>
          </p>
          {event.new_value && (
            <p className="text-xs font-mono text-primary mt-0.5">
              {event.new_value}
            </p>
          )}
        </div>
      );
    }

    case "status_changed":
      return (
        <div>
          <p className="text-sm">
            <span className="font-medium">{actorName}</span>{" "}
            <span className="text-muted-foreground">{t('detail.timeline.changed_status')}</span>
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className={`text-xs font-medium ${STATUS_COLORS[event.old_value || ""] || "text-muted-foreground"}`}>
              {getStatusLabel(event.old_value || "")}
            </span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className={`text-xs font-medium ${STATUS_COLORS[event.new_value || ""] || "text-muted-foreground"}`}>
              {getStatusLabel(event.new_value || "")}
            </span>
          </div>
        </div>
      );

    case "comment_added":
      return (
        <div>
          <p className="text-sm">
            <span className="font-medium">{actorName}</span>
            {isAdmin && (
              <ThinkAiBadge size="xs" className="ml-1.5" />
            )}{" "}
            <span className="text-muted-foreground">{t('detail.timeline.added_comment')}</span>
          </p>
        </div>
      );

    case "assignee_changed":
      return (
        <div>
          <p className="text-sm">
            <span className="font-medium">{actorName}</span>{" "}
            <span className="text-muted-foreground">{t('detail.timeline.changed_assignee')}</span>
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-xs text-muted-foreground font-medium">
              {event.old_value || t('detail.timeline.no_assignee')}
            </span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-primary font-medium">
              {event.new_value || t('detail.timeline.no_assignee')}
            </span>
          </div>
        </div>
      );

    case "resolution_requested":
      return (
        <div>
          <p className="text-sm">
            <span className="font-medium">{actorName}</span>
            {isAdmin && <ThinkAiBadge size="xs" className="ml-1.5" />}
            {" "}
            <span className="text-muted-foreground">{t('detail.timeline.requested_resolution')}</span>
          </p>
          <p className="text-xs text-sky-600 dark:text-sky-400 mt-0.5">
            {t('detail.timeline.waiting_client_confirm')}
          </p>
        </div>
      );

    case "resolution_confirmed":
      return (
        <div>
          <p className="text-sm">
            <span className="font-medium">{actorName}</span>{" "}
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">{t('detail.timeline.confirmed_resolution')}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('detail.timeline.ticket_auto_closed')}
          </p>
        </div>
      );

    case "resolution_rejected":
      return (
        <div>
          <p className="text-sm">
            <span className="font-medium">{actorName}</span>{" "}
            <span className="text-amber-600 dark:text-amber-400">{t('detail.timeline.reported_still_persists')}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('detail.timeline.investigation_continues')}
          </p>
        </div>
      );
  }
}

interface TicketTimelineProps {
  feedbackId: string;
  isStaffInitiated?: boolean;
}

export function TicketTimeline({ feedbackId, isStaffInitiated }: TicketTimelineProps) {
  const { t: rawT } = useTranslation(['tickets', 'common']);
  const t = (key: string, opts?: any): any => rawT((key.includes(':') ? key : `tickets:${key}`) as any, opts);
  const { data: events = [], isLoading } = useTicketEvents(feedbackId);

  // Deduplicate events: keep only 1 'created' event (prefer staff metadata), remove duplicate IDs,
  // and suppress redundant 'comment_added' events generated automatically alongside 'resolution_confirmed'
  const displayEvents = React.useMemo(() => {
    let hasCreated = false;
    const seenIds = new Set<string>();

    const sorted = [...events].sort((a, b) => {
      if (a.event_type === "created" && b.event_type === "created") {
        const aStaff = Boolean(a.metadata?.created_by_staff || a.metadata?.created_on_behalf);
        const bStaff = Boolean(b.metadata?.created_by_staff || b.metadata?.created_on_behalf);
        if (aStaff && !bStaff) return -1;
        if (!aStaff && bStaff) return 1;
      }
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    // Collect timestamps of all resolution_confirmed events
    const resolutionConfirmedEvents = sorted.filter(
      (e) => e.event_type === "resolution_confirmed"
    );

    return sorted.filter((event) => {
      if (seenIds.has(event.id)) return false;
      seenIds.add(event.id);

      if (event.event_type === "created") {
        if (hasCreated) return false;
        hasCreated = true;
      }

      // If this is a comment_added event generated right alongside a resolution_confirmed event,
      // hide it so it doesn't appear as a redundant "hozzászólást írt" event.
      if (event.event_type === "comment_added") {
        const isPairedWithConfirmation = resolutionConfirmedEvents.some((rc) => {
          const timeDiff = Math.abs(
            new Date(event.created_at).getTime() - new Date(rc.created_at).getTime()
          );
          // Within 15 seconds of confirmation and same actor
          const sameActor =
            (rc.actor_id && rc.actor_id === event.actor_id) ||
            (rc.actor_email && rc.actor_email === event.actor_email) ||
            (rc.actor_name && rc.actor_name === event.actor_name);
          return timeDiff <= 15000 && sameActor;
        });

        if (isPairedWithConfirmation) {
          return false;
        }
      }

      return true;
    });
  }, [events]);

  if (isLoading) {
    return (
      <Card className="rounded-none shadow-none">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (displayEvents.length === 0) return null;

  const formatDate = (date: string) => {
    return format(new Date(date), "MMM d. HH:mm", { locale: getDateFnsLocale() });
  };

  return (
    <Card className="rounded-none shadow-none">
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">{t('detail.timeline.title')}</h3>
        </div>

        {/* Timeline */}
        <div className="relative max-h-[50vh] overflow-y-auto pr-1">
          <div className="space-y-0">
            {displayEvents.map((event, index) => {
              const isStaffCreated =
                event.event_type === "created" &&
                Boolean(
                  event.metadata?.created_by_staff ||
                  event.metadata?.created_on_behalf ||
                  event.metadata?.is_admin ||
                  isStaffInitiated
                );

              return (
                <div
                  key={event.id}
                  className="relative flex gap-3 pb-6 last:pb-0 group"
                >
                  {/* Per-item connecting line to next event - connects continuously regardless of scroll height */}
                  {index < displayEvents.length - 1 && (
                    <div
                      className="absolute left-4 top-4 -bottom-2 w-px bg-border -translate-x-1/2 z-0"
                      aria-hidden="true"
                    />
                  )}

                  {/* Icon */}
                  <div className="relative z-10 shrink-0">
                    <EventIcon type={event.event_type} isStaff={isStaffCreated} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pt-0.5 z-10">
                    <EventContent
                      event={event}
                      isStaffInitiatedTicket={isStaffInitiated}
                    />
                    <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(event.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
