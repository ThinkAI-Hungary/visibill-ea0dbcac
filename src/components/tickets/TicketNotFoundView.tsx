import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, TicketX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface TicketNotFoundViewProps {
  onBack: () => void;
  ticketsBase?: string;
}

export function TicketNotFoundView({ onBack }: TicketNotFoundViewProps) {
  return (
    <div className="space-y-6 p-2 sm:p-0 page-animate">
      {/* Top back navigation */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="shrink-0 h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-card/60"
          aria-label="Vissza"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground border-border/60">
            Hibajegy
          </Badge>
          <span className="text-xs text-muted-foreground font-medium">/</span>
          <span className="text-xs text-muted-foreground">404</span>
        </div>
      </div>

      {/* Centered 404 Hero Card */}
      <div className="py-8 sm:py-16 flex items-center justify-center">
        <Card className="max-w-md w-full border border-border/80 bg-card/40 backdrop-blur-md rounded-2xl shadow-xl shadow-black/5 dark:shadow-black/20 text-center">
          <CardContent className="pt-10 pb-10 px-6 sm:px-8 space-y-6">
            {/* Ambient Icon Capsule */}
            <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
              <div className="absolute inset-0 rounded-2xl bg-destructive/10 blur-md" />
              <div className="relative h-20 w-20 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive shadow-sm">
                <TicketX className="h-10 w-10 text-destructive" strokeWidth={1.75} />
              </div>
            </div>

            {/* Title & Description */}
            <div className="space-y-2">
              <div className="flex justify-center">
                <Badge
                  variant="outline"
                  className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 border-destructive/30 text-destructive bg-destructive/5"
                >
                  404 • Nem található
                </Badge>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground pt-1">
                A hibajegy nem található
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                A keresett hibajegy nem létezik, időközben törlésre került, vagy nincs megfelelő jogosultsága a megtekintéséhez.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                onClick={onBack}
                variant="default"
                className="w-full sm:w-auto gap-2 shadow-sm font-medium px-5"
              >
                <ArrowLeft className="h-4 w-4" />
                Vissza a hibajegyekhez
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
