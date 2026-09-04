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
      status: "new",
    })
    .select("id, ticket_number, status, priority, type, service, created_at, user_id, user_email, user_name, company_name")
    .single();

  if (insertError) {
    console.error("[MANAGEMENT-STATS create-ticket] Error inserting feedback:", insertError);
    return { error: `Nem sikerült létrehozni a hibajegyet: ${insertError.message}` };
  }

  // 5. Check admin name for internal audit event
  let adminName = "Support Admin";
  try {
    const { data: adminProf } = await admin
      .from("profiles")
      .select("name")
      .eq("user_id", adminUserId)
      .maybeSingle();
    if (adminProf?.name) {
      adminName = adminProf.name;
    }
  } catch (_) {}

  // 6. Insert audit trail in ticket_events (so support knows it was created on behalf by this admin)
  try {
    await admin.from("ticket_events").insert({
      feedback_id: ticketId,
      event_type: "created",
      actor_id: adminUserId,
      actor_name: adminName,
      new_value: ticket.ticket_number,
      metadata: {
        created_on_behalf: true,
        created_by_admin_id: adminUserId,
        created_by_admin_name: adminName,
        target_user_id: targetUserId,
        target_user_email: targetEmail,
        target_user_name: targetName,
      },
    });
  } catch (eventErr) {
    console.warn("[MANAGEMENT-STATS create-ticket] Failed to log admin audit event:", eventErr);
  }

  return {
    success: true,
    ticket,
  };
}
