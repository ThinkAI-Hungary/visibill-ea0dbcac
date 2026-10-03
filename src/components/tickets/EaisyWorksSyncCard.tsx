import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Briefcase, ExternalLink, Loader2, CheckCircle2, ArrowUpRight } from "lucide-react";
import { useEaisyWorksSync } from "@/hooks/useEaisyWorksSync";
import { getEaisyWorksConfig } from "@/services/eaisyworksService";
import type { Ticket } from "@/hooks/useTickets";
import { format } from "date-fns";
import { hu } from "date-fns/locale";

interface EaisyWorksSyncCardProps {
  ticket: Ticket;
  canManage: boolean;
}

export function EaisyWorksSyncCard({ ticket, canManage }: EaisyWorksSyncCardProps) {
  const { mutate: syncToWorks, isPending } = useEaisyWorksSync();
  const { baseUrl } = getEaisyWorksConfig();

  const isSynced = Boolean(ticket.eaisyworks_ticket_key || ticket.eaisyworks_ticket_id);
  const worksKey = ticket.eaisyworks_ticket_key || "PROJ";
  const syncedAt = ticket.eaisyworks_synced_at
    ? format(new Date(ticket.eaisyworks_synced_at), "yyyy. MMM d. HH:mm", { locale: hu })
    : null;

  const handleOpenWorks = () => {
    // Open the tasks list or specific task in EaisyWorks
    const targetUrl = `${baseUrl}/tasks`;
    window.open(targetUrl, "_blank", "noopener,noreferrer");
  };

  const handleCreateInWorks = () => {
    if (isPending || isSynced) return;
    syncToWorks(ticket);
  };

  return (
    <div className="rounded-none border border-border/60 bg-muted/10 p-3 space-y-2.5 transition-all">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Briefcase className="h-3.5 w-3.5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              eaisyWorks
            </span>
          </div>
        </div>

        {isSynced && (
          <Badge
            variant="outline"
            className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 font-mono text-[11px] gap-1 px-2 py-0.5"
          >
            <CheckCircle2 className="h-3 w-3" />
            <span>{worksKey}</span>
          </Badge>
        )}
      </div>

      {isSynced ? (
        <div className="pt-0.5 space-y-2">
          <p className="text-[11px] text-muted-foreground leading-tight">
            A hibajegy szinkronizálva lett az eaisyWorks feladatkezelőbe.
            {syncedAt && (
              <span className="block mt-0.5 text-[10px] text-muted-foreground/80">
                Létrehozva: {syncedAt}
              </span>
            )}
          </p>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleOpenWorks}
            className="w-full text-xs h-8 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 gap-1.5 font-medium transition-colors"
          >
            <span>Megnyitás eaisyWorks-ben</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <div className="pt-0.5 space-y-2">
          <p className="text-[11px] text-muted-foreground leading-tight">
            Feladat létrehozása az eaisyWorks rendszerben a hibajegy alapján.
          </p>

          {canManage ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCreateInWorks}
              disabled={isPending}
              className="w-full text-xs h-8 bg-background border-border hover:border-indigo-500/40 hover:bg-indigo-500/5 hover:text-indigo-600 dark:hover:text-indigo-400 gap-1.5 font-medium transition-all shadow-xs"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />
                  <span>Létrehozás folyamatban...</span>
                </>
              ) : (
                <>
                  <ArrowUpRight className="h-3.5 w-3.5 text-indigo-500" />
                  <span>eaisyWorks hibajegy létrehozása</span>
                </>
              )}
            </Button>
          ) : (
            <span className="text-[11px] text-muted-foreground italic">
              Kizárólag Management jogosultsággal adható át.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
