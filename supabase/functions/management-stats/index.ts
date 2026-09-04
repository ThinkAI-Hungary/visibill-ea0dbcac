import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, json, authenticateRequester } from "./middleware/auth.ts";
import { emptyForAction, emptyOverview, emptyCompanyDetail, emptyUserDetail } from "./types.ts";
import { buildOverview, buildCompanyDetail, buildUserDetail } from "./handlers/overviewHandler.ts";
import { buildLLMCosts } from "./handlers/llmCostsHandler.ts";
import { buildErrors, deleteErrors, deleteAllErrors, retryErrors } from "./handlers/errorsHandler.ts";
import { buildUserPermissions, updatePermissions, deleteUser } from "./handlers/permissionsHandler.ts";
import { buildSuperadminData } from "./handlers/superadminHandler.ts";
import { buildFiles, updateFileStatus, deleteFiles } from "./handlers/filesHandler.ts";
import { buildWorkerStatus } from "./handlers/workerHandler.ts";
import { createTicketOnBehalf } from "./handlers/ticketsHandler.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "GET" && req.method !== "POST") {
      return json({ error: "Method not allowed" });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "overview";
    console.log(`[MANAGEMENT-STATS v140] ${new Date().toISOString()} action=${action}`);

    const { authContext, errorResponse } = await authenticateRequester(req, action);
    if (errorResponse || !authContext) {
      return errorResponse || json({ error: "Unauthorized", ...emptyForAction(action) });
    }

    const { admin } = authContext;

    if (action === "overview") {
      return json(await buildOverview(admin));
    }

    if (action === "company-detail") {
      const companyId = url.searchParams.get("companyId");
      if (!companyId) return json(emptyCompanyDetail);
      return json(await buildCompanyDetail(admin, companyId, url));
    }

    if (action === "errors") {
      return json(await buildErrors(admin, url));
    }

    if (action === "delete-errors") {
      if (req.method !== "POST") return json({ error: "POST required" });
      const body = await req.json().catch(() => ({}));
      return json(await deleteErrors(admin, body));
    }

    if (action === "retry-errors") {
      if (req.method !== "POST") return json({ error: "POST required" });
      const body = await req.json().catch(() => ({}));
      return json(await retryErrors(admin, body));
    }

    if (action === "delete-all-errors") {
      if (req.method !== "POST") return json({ error: "POST required" });
      return json(await deleteAllErrors(admin));
    }

    if (action === "user-detail") {
      const selectedUserId = url.searchParams.get("userId");
      if (!selectedUserId) return json(emptyUserDetail);
      return json(await buildUserDetail(admin, selectedUserId));
    }

    if (action === "user-permissions") {
      const targetUserId = url.searchParams.get("userId");
      if (!targetUserId) return json({ error: "userId required" });
      return json(await buildUserPermissions(admin, targetUserId));
    }

    if (action === "update-permissions") {
      if (req.method !== "POST") return json({ error: "POST required" });
      const body = await req.json().catch(() => ({}));
      return json(await updatePermissions(admin, body));
    }

    if (action === "delete-user") {
      if (req.method !== "POST") return json({ error: "POST required" });
      const body = await req.json().catch(() => ({}));
      return json(await deleteUser(admin, body));
    }

    if (action === "superadmin-module-data") {
      const companyId = url.searchParams.get("companyId");
      if (!companyId || !/^[0-9a-f-]{36}$/.test(companyId)) {
        return json({ error: "Invalid companyId" }, 400);
      }
      return json(await buildSuperadminData(admin, companyId, url));
    }

    if (action === "files") {
      return json(await buildFiles(admin, url));
    }

    if (action === "update-file-status") {
      if (req.method !== "POST") return json({ error: "POST required" });
      const body = await req.json().catch(() => ({}));
      return json(await updateFileStatus(admin, body));
    }

    if (action === "delete-files") {
      if (req.method !== "POST") return json({ error: "POST required" });
      const body = await req.json().catch(() => ({}));
      return json(await deleteFiles(admin, body));
    }

    if (action === "worker-status") {
      const period = url.searchParams.get("period") || "all";
      return json(await buildWorkerStatus(admin, period));
    }

    if (action === "llm-costs") {
      const period = url.searchParams.get("period") || "7d";
      return json(await buildLLMCosts(admin, period));
    }

    if (action === "create-ticket") {
      if (req.method !== "POST") return json({ error: "POST required" }, 405);
      const body = await req.json().catch(() => ({}));
      const res = await createTicketOnBehalf(admin, body, authContext.userId);
      return json(res, res.error ? 400 : 200);
    }

    return json({ error: "Unknown action", ...emptyOverview });
  } catch (error) {
    console.error("[MANAGEMENT-STATS] Unexpected error", error);
    const action = new URL(req.url).searchParams.get("action") || "overview";
    return json(emptyForAction(action));
  }
});
