import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createTicketOnBehalf } from "../api/managementApi";
import type { CreateTicketOnBehalfPayload, CreateTicketResponse } from "../api/types";
import { useToast } from "@/hooks/use-toast";

export function useManagementCreateTicket() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation<CreateTicketResponse, Error, CreateTicketOnBehalfPayload>({
    mutationFn: async (payload) => {
      const res = await createTicketOnBehalf(payload);
      if (res?.error) {
        throw new Error(res.error);
      }
      return res;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["management-overview"] });
      queryClient.invalidateQueries({ queryKey: ["unread_ticket_count"] });
      queryClient.invalidateQueries({ queryKey: ["ticket_counts"] });
      toast({
        title: "Hibajegy sikeresen létrehozva",
        description: data.ticket?.ticket_number
          ? `Jegyszám: ${data.ticket.ticket_number} (Felhasználó: ${data.ticket.user_name || data.ticket.user_email || 'Kliens'})`
          : "A hibajegy rögzítve lett a felhasználó nevében.",
      });
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "Hiba a jegy létrehozásakor",
        description: err?.message || "Nem sikerült létrehozni a hibajegyet.",
      });
    },
  });
}
