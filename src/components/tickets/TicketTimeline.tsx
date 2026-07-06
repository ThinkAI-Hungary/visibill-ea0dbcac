import React from "react";
import {
  PlusCircle,
  ArrowRight,
  MessageSquare,
  Clock,
  Loader2,
  Headset,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useTicketEvents, type TicketEvent } from "@/hooks/useTickets";
import { format } from "date-fns";
import { hu } from "date-fns/locale";

const STATUS_LABELS: Record<string, string> = {
  new: "Új",
  created: "Új",
  in_progress: "Folyamatban",
  resolved: "Megoldva",
};

const STATUS_COLORS: Record<string, string> = {
  new: "text-blue-500",
  created: "text-blue-500",
  in_progress: "text-amber-500",
  resolved: "text-emerald-500",
};

function EventIcon({ type }: { type: TicketEvent["event_type"] }) {
  switch (type) {
    case "created":
      return (
        <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center ring-4 ring-background">
          <PlusCircle className="h-4 w-4 text-primary" />
        </div>
      );
    case "status_changed":
      return (
        <div className="h-8 w-8 rounded-full bg-amber-500/15 flex items-center justify-center ring-4 ring-background">
          <ArrowRight className="h-4 w-4 text-amber-500" />
        </div>
      );
    case "comment_added":
      return (
        <div className="h-8 w-8 rounded-full bg-blue-500/15 flex items-center justify-center ring-4 ring-background">
          <MessageSquare className="h-4 w-4 text-blue-500" />
        </div>
      );
    case "assignee_changed":
      return (
        <div className="h-8 w-8 rounded-full bg-blue-500/15 flex items-center justify-center ring-4 ring-background">
          <Headset className="h-4 w-4 text-blue-500" />
        </div>
      );
  }
}

function EventContent({ event }: { event: TicketEvent }) {
  const actorName = event.actor_name || event.actor_email || "Rendszer";
  const isAdmin = event.metadata?.is_admin === true;

  switch (event.event_type) {
    case "created":
      return (
        <div>
          <p className="text-sm">
            <span className="font-medium">{actorName}</span>{" "}
            <span className="text-muted-foreground">létrehozta a jegyet</span>
          </p>
          {event.new_value && (
            <p className="text-xs font-mono text-primary mt-0.5">
              {event.new_value}
            </p>
          )}
        </div>
      );

    case "status_changed":
      return (
        <div>
          <p className="text-sm">
            <span className="font-medium">{actorName}</span>{" "}
            <span className="text-muted-foreground">módosította a státuszt</span>
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className={`text-xs font-medium ${STATUS_COLORS[event.old_value || ""] || "text-muted-foreground"}`}>
              {STATUS_LABELS[event.old_value || ""] || event.old_value}
            </span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className={`text-xs font-medium ${STATUS_COLORS[event.new_value || ""] || "text-muted-foreground"}`}>
              {STATUS_LABELS[event.new_value || ""] || event.new_value}
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
              <span className="text-[10px] ml-1.5 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium align-middle">
                Support
              </span>
            )}{" "}
            <span className="text-muted-foreground">hozzászólást írt</span>
          </p>
        </div>
      );

    case "assignee_changed":
      return (
        <div>
          <p className="text-sm">
            <span className="font-medium">{actorName}</span>{" "}
            <span className="text-muted-foreground">módosította a felelőst</span>
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-xs text-muted-foreground font-medium">
              {event.old_value || "Nincs felelős"}
            </span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-primary font-medium">
              {event.new_value || "Nincs felelős"}
            </span>
          </div>
        </div>
      );
  }
}

interface TicketTimelineProps {
  feedbackId: string;
}

export function TicketTimeline({ feedbackId }: TicketTimelineProps) {
  const { data: events = [], isLoading } = useTicketEvents(feedbackId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (events.length === 0) return null;

  const formatDate = (date: string) => {
    return format(new Date(date), "MMM d. HH:mm", { locale: hu });
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Jegy története</h3>
        </div>

        {/* Timeline */}
        <div className="relative max-h-[50vh] overflow-y-auto pr-1">
          {/* Vertical line */}
          <div className="absolute left-[15px] top-4 bottom-4 w-px bg-border" />

          <div className="space-y-0">
            {events.map((event, idx) => (
              <div
                key={event.id}
                className="relative flex gap-3 pb-6 last:pb-0 group"
              >
                {/* Icon */}
                <div className="relative z-10 shrink-0">
                  <EventIcon type={event.event_type} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <EventContent event={event} />
                  <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDate(event.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
