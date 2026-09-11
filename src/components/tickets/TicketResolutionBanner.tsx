import React, { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  Loader2,
  Clock,
  Send,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useRespondTicketResolution } from "@/hooks/useTickets";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { hu } from "date-fns/locale";
import { ThinkAiIcon } from "./ThinkAiBadge";

interface TicketResolutionBannerProps {
  ticketId: string;
  isReporter: boolean;
  isAdmin: boolean;
  waitingForConfirmation: boolean;
  resolutionRequestedAt?: string | null;
  onSuccess?: () => void;
}

export function TicketResolutionBanner({
  ticketId,
  isReporter,
  isAdmin,
  waitingForConfirmation,
  resolutionRequestedAt,
  onSuccess,
}: TicketResolutionBannerProps) {
  const { toast } = useToast();
  const { mutate: respondResolution, isPending } = useRespondTicketResolution();
  const [showRejectReason, setShowRejectReason] = useState(false);
  const [rejectComment, setRejectComment] = useState("");

  const handleConfirm = useCallback(() => {
    respondResolution(
      {
        feedbackId: ticketId,
        confirmed: true,
      },
      {
        onSuccess: () => {
          toast({
            title: "Hibajegy lezárva",
            description: "Köszönjük a visszajelzést! A hibajegyet sikeresen megoldottnak jelöltük és lezártuk.",
          });
          onSuccess?.();
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Hiba történt",
            description: err?.message || "Nem sikerült lezárni a hibajegyet.",
          });
        },
      }
    );
  }, [ticketId, respondResolution, toast, onSuccess]);

  const handleRejectSubmit = useCallback(() => {
    respondResolution(
      {
        feedbackId: ticketId,
        confirmed: false,
        comment: rejectComment.trim() ? rejectComment.trim() : undefined,
      },
      {
        onSuccess: () => {
          toast({
            title: "Visszajelzés elküldve",
            description: "A támogatási csapat értesült a problémáról és folytatja a hibajegy kezelését.",
          });
          setShowRejectReason(false);
          setRejectComment("");
          onSuccess?.();
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Hiba történt",
            description: err?.message || "Nem sikerült elküldeni a visszajelzést.",
          });
        },
      }
    );
  }, [ticketId, rejectComment, respondResolution, toast, onSuccess]);

  if (!waitingForConfirmation) {
    return null;
  }

  const formattedRequestDate = resolutionRequestedAt
    ? format(new Date(resolutionRequestedAt), "yyyy. MMM d. HH:mm", { locale: hu })
    : null;

  // 1. Ügyfél (bejelentő) felülete
  if (isReporter) {
    return (
      <Card className="rounded-none border border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.07] via-teal-500/[0.04] to-background shadow-xs overflow-hidden transition-all my-3 animate-in fade-in duration-300">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="h-10 w-10 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-xs">
                <ThinkAiIcon className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground leading-snug">
                  Kérjük, jelezzen vissza:
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  Megoldódott az Ön által jelentett probléma?
                </p>
                {formattedRequestDate && (
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground/80 mt-1">
                    <Clock className="h-3 w-3" />
                    <span>Javaslat elküldve: {formattedRequestDate}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Fő CTA Gombok */}
            {!showRejectReason && (
              <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto pt-2 sm:pt-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRejectReason(true)}
                  disabled={isPending}
                  className="flex-1 sm:flex-initial text-xs h-9 border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 hover:text-amber-800 transition-colors"
                >
                  <XCircle className="h-4 w-4 mr-1.5 text-amber-500" />
                  Nem, még fennáll
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleConfirm}
                  disabled={isPending}
                  className="flex-1 sm:flex-initial text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs font-medium gap-1.5 transition-all"
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  )}
                  Igen, megoldódott
                </Button>
              </div>
            )}
          </div>

          {/* Elutasítás / Részletek kifejtése doboz */}
          {showRejectReason && (
            <div className="mt-4 pt-3 border-t border-border/50 space-y-2.5 animate-in fade-in duration-200">
              <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <HelpCircle className="h-3.5 w-3.5 text-amber-500" />
                Kérjük, írja le röviden, miért áll még fenn a probléma:
              </label>
              <Textarea
                value={rejectComment}
                onChange={(e) => setRejectComment(e.target.value)}
                placeholder="Pl. a hiba még mindig jelentkezik bizonyos számláknál, vagy a következő hibaüzenetet kapom..."
                rows={3}
                className="text-xs resize-none"
                disabled={isPending}
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowRejectReason(false);
                    setRejectComment("");
                  }}
                  disabled={isPending}
                  className="text-xs h-8"
                >
                  Mégse
                </Button>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={handleRejectSubmit}
                  disabled={isPending}
                  className="text-xs h-8 gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  Visszajelzés küldése
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // 2. Management / Support Munkatárs felülete
  if (isAdmin) {
    return (
      <Card className="rounded-none border border-sky-500/30 bg-gradient-to-br from-sky-500/[0.07] via-cyan-500/[0.03] to-background shadow-xs overflow-hidden my-3 animate-in fade-in duration-300">
        <CardContent className="p-3.5 sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-8 w-8 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                <Clock className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-semibold text-sky-950 dark:text-sky-200 truncate">
                    Megoldás-visszaigazolás kiküldve az ügyfélnek
                  </h4>
                  <span className="inline-flex items-center px-2 py-0.2 rounded-full text-[10px] font-medium bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/20">
                    Várakozás ügyfélre
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                  Az ügyfél értesítést kapott. Ha megerősíti a megoldást, a hibajegy automatikusan lezárásra kerül.
                  {formattedRequestDate && ` (Kiküldve: ${formattedRequestDate})`}
                </p>
              </div>
            </div>

            {/* Admin direkt lezárás opció, ha az ügyfél nem válaszolna */}
            <div className="shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleConfirm}
                disabled={isPending}
                className="text-xs h-7 px-2.5 border-sky-500/30 text-sky-700 dark:text-sky-300 hover:bg-sky-500/10 gap-1"
              >
                {isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                )}
                Közvetlen lezárás
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}
