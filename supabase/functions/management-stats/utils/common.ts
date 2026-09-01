import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

export function roleLabel(role: string | null | undefined) {
  const normalized = `${role || ""}`.toLowerCase();
  if (normalized === "owner") return "CEO";
  if (normalized === "admin") return "ADMIN";
  if (normalized === "employee") return "EMPLOYEE";
  if (normalized === "member") return "MEMBER";
  return role || "MEMBER";
}

export function isCompletedMessage(msg: string | null | undefined): boolean {
  if (!msg) return true;
  const lower = msg.toLowerCase();
  return lower === "job completed" || lower.includes("job completed");
}

export function startOfMonthIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/** Paginate through all auth users (fast path: get_auth_emails RPC, fallback: GoTrue Admin API). */
export async function listAllAuthUsers(admin: ReturnType<typeof createClient>): Promise<Map<string, string>> {
  const emailByUserId = new Map<string, string>();

  // 1. Fast path: query auth.users via get_auth_emails SQL RPC (service_role) - runs in ~1-2ms
  try {
    const { data: rows, error } = await admin.rpc("get_auth_emails" as any);
    if (!error && rows && Array.isArray(rows) && rows.length > 0) {
      for (const r of rows as Array<{ id: string; email: string }>) {
        emailByUserId.set(r.id, r.email || "");
      }
      return emailByUserId;
    }
  } catch { /* ignore — fallback to Admin API below */ }

  // 2. Fallback: GoTrue Admin API pagination
  const PAGE_SIZE = 1000;
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error || !data?.users?.length) break;

    for (const u of data.users) {
      emailByUserId.set(u.id, u.email || "");
    }

    hasMore = data.users.length === PAGE_SIZE;
    page++;
  }

  return emailByUserId;
}

export function sortLlmRows(rows: any[], sortBy: string, sortDir: string) {
  const allowed = new Set(["created_at", "input_tokens", "output_tokens", "estimated_cost_usd"]);
  const key = allowed.has(sortBy) ? sortBy : "created_at";
  const direction = sortDir === "asc" ? 1 : -1;

  return [...rows].sort((a, b) => {
    const av = key === "created_at" ? new Date(a.created_at).getTime() : Number(a[key] || 0);
    const bv = key === "created_at" ? new Date(b.created_at).getTime() : Number(b[key] || 0);
    return (av - bv) * direction;
  });
}
