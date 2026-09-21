import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

export interface CreateTicketPayload {
  targetUserId: string;
  companyId?: string | null;
  companyName?: string | null;
  service?: string;
  type: string;
  priority?: string;
  message: string;
  attachments?: string[];
  assignedTo?: string | null;
  pageUrl?: string;
}

export async function createTicketOnBehalf(
  admin: SupabaseClient,
  body: unknown,
  adminUserId: string
) {
  const payload = body as CreateTicketPayload;
  if (!payload || typeof payload !== "object") {
    return { error: "Érvénytelen kérés törzs (payload required)" };
  }

  const {
    targetUserId,
    companyId,
    companyName,
    service = "eaisybill",
    type = "feedback",
    priority = "medium",
    message,
    attachments = [],
    assignedTo,
    pageUrl,
  } = payload;

  if (!targetUserId || typeof targetUserId !== "string") {
    return { error: "A célfelhasználó (targetUserId) megadása kötelező." };
  }

  const cleanMessage = (message || "").trim();
  if (!cleanMessage) {
    return { error: "A hibajegy leírása (message) nem lehet üres." };
  }

  // 1. Fetch target user's details
  let targetEmail: string | null = null;
  let targetName: string | null = null;

  // Try profiles first
  const { data: profile } = await admin
    .from("profiles")
    .select("name")
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (profile?.name) {
    targetName = profile.name;
  }

  // Fetch email from auth.users via admin API
  try {
    const { data: userData } = await admin.auth.admin.getUserById(targetUserId);
    if (userData?.user) {
      targetEmail = userData.user.email || null;
      if (!targetName && userData.user.user_metadata?.name) {
        targetName = userData.user.user_metadata.name;
      }
    }
  } catch (err) {
    console.warn("[MANAGEMENT-STATS create-ticket] Failed to fetch auth user details:", err);
  }

  if (!targetName && targetEmail) {
    targetName = targetEmail.split("@")[0];
  }

  // 2. Resolve company name if companyId provided without companyName
  let resolvedCompanyName = companyName || null;
  if (companyId && !resolvedCompanyName) {
    const { data: comp } = await admin
      .from("companies")
      .select("name")
      .eq("id", companyId)
      .maybeSingle();
    if (comp?.name) {
      resolvedCompanyName = comp.name;
    }
  }

  // 3. Pre-generate ticket ID
  const ticketId = crypto.randomUUID();

  // 4. Insert feedback row with target user identity
  const { data: ticket, error: insertError } = await admin
    .from("feedback")
    .insert({
      id: ticketId,
      user_id: targetUserId,
      created_by: adminUserId,
      user_email: targetEmail,
      user_name: targetName,
      company_id: companyId || null,
      company_name: resolvedCompanyName,
      service,
      type,
      priority,
      message: cleanMessage,
      page_url: pageUrl || "/management?view=tickets",
      attachments: attachments && attachments.length > 0 ? attachments : null,
      assigned_to: assignedTo || null,
      status: assignedTo ? "assigned" : "created",
    })
    .select("id, ticket_number, status, priority, type, service, created_at, user_id, user_email, user_name, company_name, created_by")
    .single();

  if (insertError) {
    console.error("[MANAGEMENT-STATS create-ticket] Error inserting feedback:", insertError);
    return { error: `Nem sikerült létrehozni a hibajegyet: ${insertError.message}` };
  }

  // 5. Mark ticket as read for the creator admin
  try {
    await admin.from("ticket_reads").insert({
      feedback_id: ticketId,
      user_id: adminUserId,
      last_read_at: new Date().toISOString(),
    });
  } catch (readErr) {
    console.warn("[MANAGEMENT-STATS create-ticket] Failed to record creator ticket_reads:", readErr);
  }

  return {
    success: true,
    ticket,
  };
}

export async function sendOverdueTicketReminders(admin: SupabaseClient) {
  const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Find tickets where status != 'resolved', waiting_for_user_confirmation != true, assigned_to is not null
  // and needs_staff_response is true, and last_customer_message_at <= cutoff48h
  const { data: overdueTickets, error } = await admin
    .from("feedback")
    .select("id, ticket_number, company_name, message, assigned_to, last_customer_message_at, last_reminder_sent_at")
    .not("status", "eq", "resolved")
    .neq("waiting_for_user_confirmation", true)
    .not("assigned_to", "is", null)
    .eq("needs_staff_response", true)
    .lte("last_customer_message_at", cutoff48h);

  if (error) {
    console.error("[MANAGEMENT-STATS send-ticket-reminders] Query error:", error);
    return { error: `Hiba a jegyek lekérdezésekor: ${error.message}` };
  }

  const eligibleTickets = (overdueTickets || []).filter(t => 
    !t.last_reminder_sent_at || t.last_reminder_sent_at <= cutoff24h
  );

  const results: Array<{ ticketId: string; ticketNumber: string | null; assigneeId: string; success: boolean }> = [];

  for (const t of eligibleTickets) {
    try {
      // 1. Fetch assignee profile & email
      const { data: assigneeProfile } = await admin
        .from("profiles")
        .select("name, user_id")
        .eq("user_id", t.assigned_to)
        .maybeSingle();

      let assigneeEmail: string | null = null;
      try {
        const { data: authUser } = await admin.auth.admin.getUserById(t.assigned_to);
        assigneeEmail = authUser?.user?.email || null;
      } catch (err) {
        console.warn("[reminders] Failed to get user email:", err);
      }

      // 2. Record reminder event in ticket_events
      await admin.from("ticket_events").insert({
        feedback_id: t.id,
        event_type: "reminder_sent",
        actor_id: t.assigned_to,
        actor_name: assigneeProfile?.name || "Rendszer",
        actor_email: assigneeEmail,
        metadata: {
          automated: true,
          overdue_hours: Math.floor((Date.now() - new Date(t.last_customer_message_at).getTime()) / (1000 * 60 * 60)),
          recipient_email: assigneeEmail,
        },
      });

      // 3. Update last_reminder_sent_at
      await admin
        .from("feedback")
        .update({ last_reminder_sent_at: new Date().toISOString() })
        .eq("id", t.id);

      results.push({
        ticketId: t.id,
        ticketNumber: t.ticket_number,
        assigneeId: t.assigned_to,
        success: true,
      });
    } catch (err: any) {
      console.error(`[reminders] Error processing ticket ${t.id}:`, err);
      results.push({
        ticketId: t.id,
        ticketNumber: t.ticket_number,
        assigneeId: t.assigned_to,
        success: false,
      });
    }
  }

  return {
    success: true,
    totalOverdue: overdueTickets?.length || 0,
    remindersSent: results.length,
    details: results,
  };
}

