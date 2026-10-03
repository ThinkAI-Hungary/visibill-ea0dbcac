import { supabase } from "@/integrations/supabase/client";
import type { Ticket } from "@/hooks/useTickets";
import { stripHtml, getTicketSummary } from "@/lib/utils";

export interface EaisyWorksConfig {
  apiKey: string;
  baseUrl: string;
}

export interface SyncTicketResult {
  success: boolean;
  ticketKey?: string;
  ticketId?: string;
  directUrl?: string;
  error?: string;
}

/**
 * Retrieves the current EaisyWorks integration config from environment variables.
 */
export function getEaisyWorksConfig(): EaisyWorksConfig {
  const apiKey =
    import.meta.env.VITE_EAISYWORKS_API_KEY ||
    import.meta.env.VITE_AISY_WORKS_API_KEY ||
    (import.meta.env as any).EAISYWORKS_API_KEY ||
    (import.meta.env as any).AISY_WORKS_API_KEY ||
    "";

  let rawBaseUrl =
    import.meta.env.VITE_EAISYWORKS_BASE_URL ||
    (import.meta.env as any).EAISYWORKS_BASE_URL ||
    "http://2.28.55.167";

  // When running locally in browser dev server, route through the Vite proxy
  // (/eaisyworks-api) to prevent browser CORS and Mixed Content blocking.
  if (
    typeof window !== "undefined" &&
    import.meta.env.MODE !== "test" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") &&
    rawBaseUrl.includes("2.28.55.167")
  ) {
    rawBaseUrl = "/eaisyworks-api";
  }

  const baseUrl = rawBaseUrl.replace(/\/+$/, "");

  return { apiKey, baseUrl };
}

/**
 * Maps Eaisybill ticket priority to EaisyWorks priority:
 * 'low' | 'medium' | 'high' | 'urgent'
 */
function mapPriority(priority: string | null | undefined): 'low' | 'medium' | 'high' | 'urgent' {
  const p = (priority || '').toLowerCase();
  if (p === 'critical') return 'urgent';
  if (p === 'high') return 'high';
  if (p === 'low') return 'low';
  return 'medium';
}

/**
 * Maps Eaisybill ticket type to human-readable Hungarian prefix
 */
function mapTypeLabel(type: string | null | undefined): string {
  const t = (type || '').toLowerCase();
  if (t === 'bug') return 'Hiba';
  if (t === 'question') return 'Kérdés';
  return 'Visszajelzés';
}

/**
 * Sends an Eaisybill ticket to EaisyWorks via REST API (POST /api/v1/tickets)
 * and links the returned task key and ID to the local ticket in Supabase.
 */
export async function createEaisyWorksTicket(ticket: Ticket): Promise<SyncTicketResult> {
  const { apiKey, baseUrl } = getEaisyWorksConfig();

  if (!apiKey) {
    return {
      success: false,
      error: "Hiányzik az EaisyWorks API kulcs. Kérlek állítsd be a VITE_EAISYWORKS_API_KEY környezeti változót a .env.local fájlban.",
    };
  }

  // 1. Prepare clean title and text content
  const { title: summaryTitle, preview } = getTicketSummary(ticket.message);
  const typeLabel = mapTypeLabel(ticket.type);
  const rawTitle = summaryTitle || preview || 'Ügyféli megkeresés';
  const title = `${typeLabel}: ${rawTitle}`.slice(0, 150);

  const cleanDescription = stripHtml(ticket.message);
  const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://app.eaisybill.hu';
  const managementTicketUrl = `${originUrl}/management?view=tickets&id=${ticket.id}`;

  const description = [
    cleanDescription,
    "",
    "---",
    "### 📌 Eaisybill Rendszerinformációk",
    `- **Jegy azonosító:** ${ticket.ticket_number || ticket.id}`,
    `- **Ügyfél:** ${ticket.user_name || 'Névtelen'} (${ticket.user_email || 'nincs email'})`,
    `- **Cég:** ${ticket.company_name || 'N/A'}`,
    ticket.category ? `- **Kategória:** ${ticket.category}` : null,
    ticket.page_url ? `- **Érintett oldal:** ${ticket.page_url}` : null,
    `- **Eaisybill hivatkozás:** ${managementTicketUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  const payload = {
    title,
    description,
    priority: mapPriority(ticket.priority),
    source_app: "eaisybill",
    reporter_name: ticket.user_name || ticket.user_email || "Eaisybill Felhasználó",
    reporter_email: ticket.user_email || undefined,
    external_id: ticket.ticket_number || ticket.id,
    category_name: ticket.category || typeLabel,
    extra_data: {
      ticket_id: ticket.id,
      ticket_number: ticket.ticket_number,
      company_id: ticket.company_id,
      company_name: ticket.company_name,
      service: ticket.service,
      page_url: ticket.page_url,
      attachments: ticket.attachments || [],
    },
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`${baseUrl}/api/v1/tickets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const resJson = await response.json().catch(() => ({}));

    if (!response.ok || !resJson?.success) {
      const errMsg = resJson?.message || resJson?.error || `HTTP ${response.status} hiba történt a küldés során`;
      return {
        success: false,
        error: errMsg,
      };
    }

    const createdTicket = resJson.ticket || {};
    const worksId = createdTicket.id || "";
    const worksKey = createdTicket.key || "";
    const directUrl = createdTicket.direct_url || "";

    if (!worksId && !worksKey) {
      return {
        success: false,
        error: "A szerver sikeres választ adott, de nem érkezett feladat azonosító.",
      };
    }

    // 2. Link in Supabase via RPC (with direct update fallback)
    try {
      const { error: rpcError } = await supabase.rpc("link_eaisyworks_ticket", {
        p_ticket_id: ticket.id,
        p_works_id: worksId,
        p_works_key: worksKey,
      });

      if (rpcError) {
        console.warn("[EaisyWorks] RPC link failed, falling back to direct table update:", rpcError);
        await supabase
          .from("feedback")
          .update({
            eaisyworks_ticket_id: worksId,
            eaisyworks_ticket_key: worksKey,
            eaisyworks_synced_at: new Date().toISOString(),
          } as any)
          .eq("id", ticket.id);
      }
    } catch (dbErr) {
      console.error("[EaisyWorks] Database linking error:", dbErr);
    }

    return {
      success: true,
      ticketId: worksId,
      ticketKey: worksKey,
      directUrl: directUrl || undefined,
    };
  } catch (err: any) {
    if (err.name === "AbortError") {
      return {
        success: false,
        error: "A kérés időtúllépés miatt megszakadt (15s timeout). Ellenőrizd a szerver elérhetőségét.",
      };
    }
    const isNetworkOrCors = err.message === "Failed to fetch" || err.name === "TypeError";
    return {
      success: false,
      error: isNetworkOrCors
        ? "Hálózati kapcsolódási hiba történt az EaisyWorks szerverhez (Failed to fetch). Ellenőrizd a dev szerver futását vagy a hálózati elérést."
        : err.message || "Váratlan hálózati hiba történt az EaisyWorks API hívásakor.",
    };
  }
}
