import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { emptyForAction } from "../types.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

export interface AuthContext {
  admin: ReturnType<typeof createClient>;
  userId: string;
  requesterProfile: { user_id: string; role: string };
}

export async function authenticateRequester(
  req: Request,
  action: string
): Promise<{ authContext?: AuthContext; errorResponse?: Response }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("[MANAGEMENT-STATS] Missing Supabase environment variables");
    return { errorResponse: json(emptyForAction(action)) };
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return { errorResponse: json({ error: "Unauthorized", ...emptyForAction(action) }) };
  }

  const token = authHeader.replace(/^Bearer\s+/i, "");

  // Validate user JWT via direct REST call — keeps admin client auth-state clean.
  const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
  });
  if (!userResp.ok) {
    console.warn("[MANAGEMENT-STATS] JWT validation failed", userResp.status);
    return { errorResponse: json({ error: "Unauthorized", ...emptyForAction(action) }) };
  }
  const userData = await userResp.json();
  const userId = userData.id;
  if (!userId) {
    return { errorResponse: json({ error: "Unauthorized", ...emptyForAction(action) }) };
  }

  // Custom fetch wrapper that ALWAYS sends service_role JWT.
  const serviceFetch = (url: RequestInfo | URL, opts: RequestInit = {}) => {
    const headers = new Headers(opts.headers || {});
    headers.set("Authorization", `Bearer ${serviceRoleKey}`);
    headers.set("apikey", serviceRoleKey);
    const urlStr = typeof url === 'string' ? url : url.toString();
    if (urlStr.includes('llm_koltsegek') || urlStr.includes('llm-costs')) {
      console.log(`[serviceFetch] ${urlStr.substring(0, 80)} auth=svc_role_${serviceRoleKey.substring(0, 10)}...`);
    }
    return fetch(url, { ...opts, headers });
  };

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: serviceFetch },
  });

  const { data: requesterProfile, error: profileError } = await admin
    .from("profiles")
    .select("user_id, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError || (requesterProfile?.role !== "management" && requesterProfile?.role !== "thinkai")) {
    console.warn("[MANAGEMENT-STATS] Management role check failed", {
      userId,
      role: requesterProfile?.role ?? null,
      error: profileError?.message,
    });
    return { errorResponse: json({ error: "Unauthorized", ...emptyForAction(action) }) };
  }

  return {
    authContext: {
      admin,
      userId,
      requesterProfile,
    },
  };
}
