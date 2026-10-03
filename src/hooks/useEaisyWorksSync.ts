import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { createEaisyWorksTicket, type SyncTicketResult } from "@/services/eaisyworksService";
import type { Ticket } from "@/hooks/useTickets";

export function useEaisyWorksSync() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation<SyncTicketResult, Error, Ticket>({
    mutationFn: async (ticket: Ticket) => {
      const result = await createEaisyWorksTicket(ticket);
      if (!result.success) {
        throw new Error(result.error || "Nem sikerült létrehozni a hibajegyet a worksben.");
      }
      return result;
    },
    onSuccess: (data, ticket) => {
      toast({
        title: "eaisyWorks feladat létrehozva!",
        description: data.ticketKey
          ? `Sikeresen szinkronizálva. Feladat azonosító: ${data.ticketKey}`
          : "A hibajegy sikeresen megnyílt az eaisyWorks rendszerben.",
      });

      // Invalidate ticket details and list queries to immediately reflect the new key
      queryClient.invalidateQueries({ queryKey: ["ticket_detail", ticket.id] });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["ticket_events", ticket.id] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "eaisyWorks szinkronizáció sikertelen",
        description: error.message || "Hiba történt a feladat továbbítása során.",
      });
    },
  });
}
