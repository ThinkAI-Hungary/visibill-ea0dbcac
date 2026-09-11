import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ── Types ──────────────────────────────────────────────────────
export type TicketStatus = "created" | "assigned" | "in_progress" | "resolved";
export type TicketPriority = "low" | "medium" | "high" | "critical";
export type TicketType = "bug" | "feedback" | "question";

/**
 * Resolves the effective ticket lifecycle status.
 * If a ticket has an assignee and is in 'created', 'new', or 'open' state, it dynamically reflects 'assigned'.
 * If a ticket has no assignee and is marked 'assigned', it automatically falls back to 'created' (Nyitott).
 */
export function resolveEffectiveTicketStatus(status: string, assignedTo?: string | null): TicketStatus {
  const norm = status === "new" || status === "open" ? "created" : status;
  if (assignedTo && norm === "created") {
    return "assigned";
  }
  if (!assignedTo && norm === "assigned") {
    return "created";
  }
  return norm as TicketStatus;
}

export interface Ticket {
  id: string;
  ticket_number: string | null;
  type: string;
  service: string | null;
  message: string;
  status: string;
  priority: string | null;
  page_url: string | null;
  company_name: string | null;
  company_id: string | null;
  user_email: string | null;
  user_name: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
  attachments: string[] | null;
  comment_count: number;
  latest_comment_at: string | null;
  has_unread: boolean;
  assigned_to?: string | null;
  assigned_to_name?: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
  created_by_is_staff?: boolean;
  waiting_for_user_confirmation?: boolean;
  resolution_requested_at?: string | null;
  resolution_requested_by?: string | null;
  resolution_confirmed_at?: string | null;
}

export interface TicketComment {
  id: string;
  feedback_id: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  is_admin: boolean | null;
  message: string;
  attachments: string[] | null;
  created_at: string | null;
  is_internal?: boolean;
}

// ── Hook: Check if current user is support admin ──────────────
export function useIsSupportAdmin() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is_support_admin", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data, error } = await supabase
        .from("profiles")
        .select("is_support_admin")
        .eq("user_id", user.id)
        .single();
      if (error) return false;
      return data?.is_support_admin === true;
    },
    enabled: !!user,
    staleTime: 30 * 60 * 1000,
  });
}

// ── Hook: Check if current user is management (sees ALL tickets) ──
export function useIsManagementRole() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is_management_role", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .single();
      if (error) return false;
      return data?.role === 'management' || data?.role === 'thinkai';
    },
    enabled: !!user,
    staleTime: 30 * 60 * 1000,
  });
}

// ── Hook: Fetch tickets list ──────────────────────────────────
export function useTickets(statusFilter?: TicketStatus | "all") {
  const { user } = useAuth();
  const { data: isSupportAdmin } = useIsSupportAdmin();
  const { data: isManagement } = useIsManagementRole();

  return useQuery({
    queryKey: ["tickets", user?.id, statusFilter, isSupportAdmin, isManagement],
    queryFn: async () => {
      if (!user) return [];

      // 1. Fetch tickets with assigned profile name and creator profile name
      let query = supabase
        .from("feedback")
        .select("*, assigned_to_profile:profiles!feedback_assigned_to_fkey(name), created_by_profile:profiles!feedback_created_by_fkey(name, is_support_admin, role)")
        .order("created_at", { ascending: false });

      if (statusFilter && statusFilter !== "all") {
        if (statusFilter === "created") {
          query = query.in("status", ["created", "new", "open"]);
        } else {
          query = query.eq("status", statusFilter);
        }
      }

      // Support admins can fetch all tickets they have access to;
      // client-side filtering is applied on the page if they choose to view only own/unassigned.

      const { data: tickets, error } = await query;
      if (error) throw error;
      if (!tickets || tickets.length === 0) return [];

      const ticketIds = tickets.map((t) => t.id);

      // 2. Fetch comment counts + latest OTHER-party comment time
      const { data: comments } = await supabase
        .from("ticket_comments")
        .select("feedback_id, created_at, user_id")
        .in("feedback_id", ticketIds);

      // For unread detection: only comments from OTHER users
      const otherComments = (comments || []).filter((c) => c.user_id !== user.id);

      // Total comment count (all comments)
      const commentCountMap = new Map<string, number>();
      (comments || []).forEach((c) => {
        commentCountMap.set(c.feedback_id, (commentCountMap.get(c.feedback_id) || 0) + 1);
      });

      // Latest OTHER-party comment per ticket (for unread detection)
      const latestOtherMap = new Map<string, string>();
      otherComments.forEach((c) => {
        if (!c.created_at) return;
        const existing = latestOtherMap.get(c.feedback_id);
        if (!existing || c.created_at > existing) {
          latestOtherMap.set(c.feedback_id, c.created_at);
        }
      });

      // 3. Fetch read timestamps
      const { data: reads } = await supabase
        .from("ticket_reads")
        .select("feedback_id, last_read_at")
        .eq("user_id", user.id)
        .in("feedback_id", ticketIds);

      const readMap = new Map<string, string>();
      (reads || []).forEach((r) => {
        if (r.last_read_at) readMap.set(r.feedback_id, r.last_read_at);
      });

      // 4. Combine
      return tickets.map((t): Ticket => {
        const lastRead = readMap.get(t.id);
        const latestOther = latestOtherMap.get(t.id) || null;
        const isCreatedByOther = Boolean(t.created_by && t.created_by !== user.id);
        const createdByProfile = (t as any).created_by_profile;
        const isCreatedByStaff = Boolean(
          createdByProfile?.is_support_admin ||
          ['thinkai', 'management'].includes(createdByProfile?.role)
        );

        const isConfirmationRequestedByOther = Boolean(
          (t as any).waiting_for_user_confirmation &&
          (t as any).resolution_requested_by &&
          (t as any).resolution_requested_by !== user.id
        );
        const confirmationRequestedAt = (t as any).resolution_requested_at || null;

        let hasUnread = false;
        if (latestOther && (!lastRead || latestOther > lastRead)) {
          hasUnread = true;
        } else if (isCreatedByOther && (!lastRead || t.created_at > lastRead)) {
          hasUnread = true;
        } else if (
          isConfirmationRequestedByOther &&
          confirmationRequestedAt &&
          (!lastRead || confirmationRequestedAt > lastRead)
        ) {
          hasUnread = true;
        }

        return {
          id: t.id,
          ticket_number: t.ticket_number,
          type: t.type,
          service: (t as any).service || null,
          message: t.message,
          status: resolveEffectiveTicketStatus(t.status, t.assigned_to),
          priority: t.priority,
          page_url: t.page_url,
          company_name: t.company_name,
          company_id: t.company_id,
          user_email: t.user_email,
          user_name: t.user_name,
          user_id: t.user_id,
          created_at: t.created_at,
          updated_at: t.updated_at,
          attachments: t.attachments || null,
          comment_count: commentCountMap.get(t.id) || 0,
          latest_comment_at: latestOther,
          has_unread: hasUnread,
          assigned_to: t.assigned_to,
          assigned_to_name: (t as any).assigned_to_profile?.name || null,
          created_by: t.created_by || null,
          created_by_name: createdByProfile?.name || null,
          created_by_is_staff: isCreatedByStaff,
          waiting_for_user_confirmation: Boolean((t as any).waiting_for_user_confirmation),
          resolution_requested_at: (t as any).resolution_requested_at || null,
          resolution_requested_by: (t as any).resolution_requested_by || null,
          resolution_confirmed_at: (t as any).resolution_confirmed_at || null,
        };
      });
    },
    enabled: !!user,
  });
}

// ── Hook: Fetch unread count (for sidebar badge) ──────────────
export function useUnreadTicketCount() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Subscribe to realtime changes on ticket_comments and feedback
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('unread-ticket-count')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_comments',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["unread_ticket_count"] });
          queryClient.invalidateQueries({ queryKey: ["tickets"] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'feedback',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["unread_ticket_count"] });
          queryClient.invalidateQueries({ queryKey: ["tickets"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const { data: isSupportAdmin } = useIsSupportAdmin();
  const { data: isManagement } = useIsManagementRole();

  return useQuery({
    queryKey: ["unread_ticket_count", user?.id, isSupportAdmin, isManagement],
    queryFn: async () => {
      if (!user) return 0;

      const { data, error } = await (supabase.rpc as any)("get_unread_ticket_count", {
        p_user_id: user.id,
      });

      if (error) throw error;
      return (data || 0) as number;
    },
    enabled: !!user,
    staleTime: 60 * 1000,
  });
}

// ── Types: Ticket Event ───────────────────────────────────────
export interface TicketEvent {
  id: string;
  feedback_id: string;
  event_type:
    | "created"
    | "status_changed"
    | "comment_added"
    | "assignee_changed"
    | "resolution_requested"
    | "resolution_confirmed"
    | "resolution_rejected";
  actor_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
  old_value: string | null;
  new_value: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

// ── Hook: Fetch ticket events (timeline) ──────────────────────
export function useTicketEvents(feedbackId: string | null) {
  return useQuery({
    queryKey: ["ticket_events", feedbackId],
    queryFn: async () => {
      if (!feedbackId) return [];

      const { data, error } = await supabase
        .from("ticket_events")
        .select("*")
        .eq("feedback_id", feedbackId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as TicketEvent[];
    },
    enabled: !!feedbackId,
  });
}

// ── Hook: Fetch single ticket detail with comments ────────────
export function useTicketDetail(feedbackId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["ticket_detail", feedbackId],
    queryFn: async () => {
      if (!feedbackId || !user) return null;

      const { data: ticket, error } = await supabase
        .from("feedback")
        .select("*, assigned_to_profile:profiles!feedback_assigned_to_fkey(name), created_by_profile:profiles!feedback_created_by_fkey(name, is_support_admin, role)")
        .eq("id", feedbackId)
        .maybeSingle();

      if (error) throw error;
      if (!ticket) return null;

      const { data: comments } = await supabase
        .from("ticket_comments")
        .select("*")
        .eq("feedback_id", feedbackId)
        .order("created_at", { ascending: true });

      const createdByProfile = (ticket as any).created_by_profile;
      const isCreatedByStaff = Boolean(
        createdByProfile?.is_support_admin ||
        ['thinkai', 'management'].includes(createdByProfile?.role)
      );

      return {
        ticket: {
          ...ticket,
          status: resolveEffectiveTicketStatus(ticket.status, ticket.assigned_to),
          assigned_to_name: (ticket as any).assigned_to_profile?.name || null,
          created_by_name: createdByProfile?.name || null,
          created_by_is_staff: isCreatedByStaff,
          waiting_for_user_confirmation: Boolean((ticket as any).waiting_for_user_confirmation),
          resolution_requested_at: (ticket as any).resolution_requested_at || null,
          resolution_requested_by: (ticket as any).resolution_requested_by || null,
          resolution_confirmed_at: (ticket as any).resolution_confirmed_at || null,
        },
        comments: (comments || []) as TicketComment[],
      };
    },
    enabled: !!feedbackId && !!user,
  });
}

// ── Mutation: Add comment / internal note ─────────────────────
export function useAddComment() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: isAdmin } = useIsSupportAdmin();

  return useMutation({
    mutationFn: async ({
      feedbackId,
      message,
      attachments,
      isInternal = false,
    }: {
      feedbackId: string;
      message: string;
      attachments?: string[];
      isInternal?: boolean;
    }) => {
      if (!user) throw new Error("Not authenticated");

      // Fetch current profile name (may differ from auth metadata)
      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("user_id", user.id)
        .single();

      const displayName = profile?.name || user.user_metadata?.name || user.email;

      const { data, error } = await supabase
        .from("ticket_comments")
        .insert({
          feedback_id: feedbackId,
          user_id: user.id,
          user_name: displayName,
          user_email: user.email || null,
          is_admin: isAdmin || false,
          message: message,
          is_internal: isInternal,
          ...(attachments && attachments.length > 0 ? { attachments } : {}),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { feedbackId }) => {
      queryClient.invalidateQueries({ queryKey: ["ticket_detail", feedbackId] });
      queryClient.invalidateQueries({ queryKey: ["ticket_events", feedbackId] });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["unread_ticket_count"] });
    },
  });
}

// ── Mutation: Update ticket status ────────────────────────────
export function useUpdateTicketStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      feedbackId,
      status,
    }: {
      feedbackId: string;
      status: TicketStatus;
    }) => {
      const { error } = await supabase
        .from("feedback")
        .update({ status })
        .eq("id", feedbackId);

      if (error) throw error;
    },
    onSuccess: (_, { feedbackId }) => {
      queryClient.invalidateQueries({ queryKey: ["ticket_detail", feedbackId] });
      queryClient.invalidateQueries({ queryKey: ["ticket_events", feedbackId] });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}

// ── Mutation: Update ticket priority ──────────────────────────
export function useUpdateTicketPriority() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      feedbackId,
      priority,
    }: {
      feedbackId: string;
      priority: TicketPriority;
    }) => {
      const { error } = await supabase
        .from("feedback")
        .update({ priority })
        .eq("id", feedbackId);

      if (error) throw error;
    },
    onSuccess: (_, { feedbackId }) => {
      queryClient.invalidateQueries({ queryKey: ["ticket_detail", feedbackId] });
      queryClient.invalidateQueries({ queryKey: ["ticket_events", feedbackId] });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}

// ── Mutation: Update ticket assignee ──────────────────────────
export function useUpdateTicketAssignee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      feedbackId,
      assignedTo,
      force = false,
    }: {
      feedbackId: string;
      assignedTo: string | null;
      force?: boolean;
    }) => {
      // Check current state before assigning for race condition prevention & status transitions
      let currentStatus: string | null = null;
      const { data: current, error: checkError } = await supabase
        .from("feedback")
        .select("assigned_to, status")
        .eq("id", feedbackId)
        .single();

      if (checkError) throw checkError;

      if (assignedTo && !force) {
        // If already assigned to someone else, reject
        if (current?.assigned_to && current.assigned_to !== assignedTo) {
          throw new Error("ALREADY_ASSIGNED");
        }
      }
      currentStatus = current?.status || null;

      const updatePayload: Record<string, any> = { assigned_to: assignedTo };

      // Auto-transition status:
      // If currently created/new/open and getting an assignee -> transition to 'assigned' (Hozzárendelt)
      if (assignedTo && (currentStatus === "created" || currentStatus === "new" || currentStatus === "open")) {
        updatePayload.status = "assigned";
      } else if (!assignedTo && currentStatus === "assigned") {
        // If removing assignee and currently 'assigned' -> transition back to 'created' (Nyitott)
        updatePayload.status = "created";
      }

      const { error } = await supabase
        .from("feedback")
        .update(updatePayload)
        .eq("id", feedbackId);

      if (error) throw error;
    },
    onSuccess: (_, { feedbackId }) => {
      queryClient.invalidateQueries({ queryKey: ["ticket_detail", feedbackId] });
      queryClient.invalidateQueries({ queryKey: ["ticket_events", feedbackId] });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}

// ── Hook: Fetch support agents ────────────────────────────────
export function useSupportAgents() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["support_agents", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, name")
        .eq("is_support_admin", true)
        .order("name", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

// ── Mutation: Mark ticket as read ─────────────────────────────
export function useMarkTicketRead() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (feedbackId: string) => {
      if (!user) throw new Error("Not authenticated");

      if (!feedbackId) return;

      const { error } = await supabase
        .from("ticket_reads")
        .upsert(
          {
            feedback_id: feedbackId,
            user_id: user.id,
            last_read_at: new Date().toISOString(),
          },
          { onConflict: "feedback_id,user_id" }
        );

      if (error) {
        // If ticket does not exist or was deleted, ignore foreign key constraint (23503) gracefully
        if (error.code === "23503") {
          return;
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["unread_ticket_count"] });
    },
  });
}

// ── Mutation: Delete ticket (management only) ─────────────────
export function useDeleteTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (feedbackId: string) => {
      // Cascade delete handles ticket_comments, ticket_events, ticket_reads
      const { error } = await supabase
        .from("feedback")
        .delete()
        .eq("id", feedbackId);

      if (error) throw error;

      // Supabase silently returns success even when RLS blocks the delete (0 rows affected).
      // Verify the row is actually gone:
      const { data: still } = await supabase
        .from("feedback")
        .select("id")
        .eq("id", feedbackId)
        .maybeSingle();

      if (still) {
        throw new Error("Nincs jogosultságod a hibajegy törléséhez.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["unread_ticket_count"] });
      queryClient.invalidateQueries({ queryKey: ["ticket_detail"] });
    },
  });
}

// ── Mutation: Update ticket attachments ───────────────────────
export function useUpdateTicketAttachments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      feedbackId,
      attachments,
    }: {
      feedbackId: string;
      attachments: string[];
    }) => {
      const { error } = await supabase
        .from("feedback")
        .update({ attachments })
        .eq("id", feedbackId);

      if (error) throw error;
    },
    onSuccess: (_, { feedbackId }) => {
      queryClient.invalidateQueries({ queryKey: ["ticket_detail", feedbackId] });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}

// ── Mutation: Request ticket resolution confirmation ──────────
export function useRequestTicketResolution() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      feedbackId,
      comment,
      attachments,
    }: {
      feedbackId: string;
      comment?: string;
      attachments?: string[];
    }) => {
      const { data, error } = await (supabase.rpc as any)("request_ticket_resolution", {
        p_feedback_id: feedbackId,
        p_comment: comment || null,
        p_attachments: attachments && attachments.length > 0 ? attachments : null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { feedbackId }) => {
      queryClient.invalidateQueries({ queryKey: ["ticket_detail", feedbackId] });
      queryClient.invalidateQueries({ queryKey: ["ticket_events", feedbackId] });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["unread_ticket_count"] });
    },
  });
}

// ── Mutation: Respond to ticket resolution confirmation ───────
export function useRespondTicketResolution() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      feedbackId,
      confirmed,
      comment,
    }: {
      feedbackId: string;
      confirmed: boolean;
      comment?: string;
    }) => {
      const { data, error } = await (supabase.rpc as any)("respond_to_ticket_resolution", {
        p_feedback_id: feedbackId,
        p_confirmed: confirmed,
        p_comment: comment || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { feedbackId }) => {
      queryClient.invalidateQueries({ queryKey: ["ticket_detail", feedbackId] });
      queryClient.invalidateQueries({ queryKey: ["ticket_events", feedbackId] });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["unread_ticket_count"] });
    },
  });
}


