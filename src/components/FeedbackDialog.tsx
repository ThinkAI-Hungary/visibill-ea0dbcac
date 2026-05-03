import React, { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Bug,
  MessageSquareText,
  Send,
  Loader2,
  Info,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const { user } = useAuth();
  const { companies, selectedCompany } = useCompany();
  const { toast } = useToast();

  const [companyId, setCompanyId] = useState<string>(selectedCompany?.id || "");
  const [type, setType] = useState<string>("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Reset form when dialog opens
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        setCompanyId(selectedCompany?.id || "");
        setType("");
        setMessage("");
        setSubmitted(false);
      }
      onOpenChange(isOpen);
    },
    [onOpenChange, selectedCompany]
  );

  const selectedCompanyObj = companies.find((c) => c.id === companyId);
  const canSubmit = companyId && type && message.trim().length >= 10;

  const handleSubmit = async () => {
    if (!canSubmit || !user) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from("feedback" as any).insert({
        user_id: user.id,
        company_id: companyId,
        company_name: selectedCompanyObj?.name || null,
        type,
        message: message.trim(),
        user_email: user.email || null,
        user_name: user.user_metadata?.name || null,
      } as any);

      if (error) throw error;

      setSubmitted(true);
      toast({
        title: "Visszajelzés elküldve",
        description: "Köszönjük a visszajelzést! Csapatunk hamarosan áttekinti.",
      });
    } catch (err: any) {
      console.error("Feedback submit error:", err);
      toast({
        variant: "destructive",
        title: "Hiba történt",
        description: "A visszajelzés küldése sikertelen. Kérjük próbálja újra.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <MessageSquareText className="h-5 w-5 text-primary" />
            Visszajelzés küldése
          </DialogTitle>
          <DialogDescription>
            Segítsen nekünk jobbá tenni a Visibill-t! Jelezzen hibákat vagy ossza meg
            véleményét.
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          /* ── Success state ── */
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-lg font-semibold">Köszönjük!</p>
              <p className="text-sm text-muted-foreground">
                A visszajelzése sikeresen elküldve. Csapatunk hamarosan áttekinti.
              </p>
            </div>
            <Button variant="outline" onClick={() => handleOpenChange(false)} className="mt-2">
              Bezárás
            </Button>
          </div>
        ) : (
          /* ── Form ── */
          <div className="space-y-5 py-2">
            {/* Company selector */}
            <div className="space-y-2">
              <Label htmlFor="feedback-company" className="text-sm font-medium">
                Cég
              </Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger id="feedback-company">
                  <SelectValue placeholder="Válasszon céget..." />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type selector */}
            <div className="space-y-2">
              <Label htmlFor="feedback-type" className="text-sm font-medium">
                Típus
              </Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="feedback-type">
                  <SelectValue placeholder="Válasszon típust..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">
                    <span className="flex items-center gap-2">
                      <Bug className="h-4 w-4 text-red-500" />
                      Hibajelentés
                    </span>
                  </SelectItem>
                  <SelectItem value="feedback">
                    <span className="flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-amber-500" />
                      Visszajelzés / Javaslat
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Message */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="feedback-message" className="text-sm font-medium">
                  Üzenet
                </Label>
                {message.trim().length > 0 && message.trim().length < 10 && (
                  <span className="text-xs text-muted-foreground">
                    Minimum 10 karakter ({message.trim().length}/10)
                  </span>
                )}
              </div>
              <Textarea
                id="feedback-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  type === "bug"
                    ? "Írja le a hibát minél részletesebben..."
                    : "Ossza meg véleményét vagy javaslatát..."
                }
                className="min-h-[120px] resize-y"
              />
            </div>

            {/* Guidelines footer */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Info className="h-4 w-4" />
                Hogyan írjunk jó visszajelzést?
              </div>
              <div className="grid gap-2 text-xs text-muted-foreground">
                {type === "bug" ? (
                  <>
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-red-400 shrink-0" />
                      <span>
                        <strong>Probléma leírása:</strong> Mi történt pontosan? Mi volt az
                        elvárt viselkedés?
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-red-400 shrink-0" />
                      <span>
                        <strong>Lépések:</strong> Milyen lépések után jelentkezett a hiba?
                        (pl. „Rákattintottam a Mentés gombra a számla szerkesztésnél")
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-red-400 shrink-0" />
                      <span>
                        <strong>Környezet:</strong> Melyik böngészőt használja? (Chrome,
                        Firefox, Edge stb.)
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-start gap-2">
                      <Lightbulb className="h-3.5 w-3.5 mt-0.5 text-amber-400 shrink-0" />
                      <span>
                        <strong>Funkció leírása:</strong> Milyen új funkciót szeretne? Hogyan
                        segítené a munkáját?
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Lightbulb className="h-3.5 w-3.5 mt-0.5 text-amber-400 shrink-0" />
                      <span>
                        <strong>Felhasználási eset:</strong> Milyen helyzetben használná a
                        javasolt funkciót?
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Lightbulb className="h-3.5 w-3.5 mt-0.5 text-amber-400 shrink-0" />
                      <span>
                        <strong>Prioritás:</strong> Mennyire fontos ez a fejlesztés az Ön
                        számára?
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Submit */}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={submitting}
              >
                Mégse
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                className="gap-2"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Küldés
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
