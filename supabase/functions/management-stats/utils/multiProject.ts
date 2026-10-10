import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { ProjectClient } from "../types.ts";

let _cachedProjectClients: ProjectClient[] | null = null;

export function getMonitoringAdmin(admin: ReturnType<typeof createClient>): ReturnType<typeof createClient> {
  const prodUrl = Deno.env.get("PROD_SUPABASE_URL");
  const prodKey = Deno.env.get("PROD_SERVICE_ROLE_KEY") || Deno.env.get("PROD_SUPABASE_SERVICE_ROLE_KEY");
  if (prodUrl && prodKey) {
    return createClient(prodUrl, prodKey);
  }
  return admin;
}

export function getProjectClients(admin: ReturnType<typeof createClient>): ProjectClient[] {
  if (_cachedProjectClients) {
    return _cachedProjectClients;
  }
  const currentUrl = Deno.env.get("SUPABASE_URL") || "";
  const isDev = currentUrl.includes("qhvcdqkqpgpdxogqqvyr");

  const clients: ProjectClient[] = [];

  const prodUrl = Deno.env.get("PROD_SUPABASE_URL");
  const prodKey = Deno.env.get("PROD_SERVICE_ROLE_KEY") || Deno.env.get("PROD_SUPABASE_SERVICE_ROLE_KEY");

  if (isDev) {
    if (prodUrl && prodKey) {
      try {
        clients.push({ name: "PROD", client: createClient(prodUrl, prodKey) });
      } catch (e) {
        console.warn("[project-clients] PROD client creation failed:", e);
      }
    }
    clients.push({ name: "DEV", client: admin });
  } else {
    clients.push({ name: "PROD", client: admin });
    const devUrl = Deno.env.get("DEV_SUPABASE_URL");
    const devKey = Deno.env.get("DEV_SERVICE_ROLE_KEY") || Deno.env.get("DEV_SUPABASE_SERVICE_ROLE_KEY");
    if (devUrl && devKey) {
      try {
        clients.push({ name: "DEV", client: createClient(devUrl, devKey) });
      } catch (e) {
        console.warn("[project-clients] DEV client creation failed:", e);
      }
    }
  }

  const vswebUrl = Deno.env.get("VSWEB_SUPABASE_URL");
  const vswebKey = Deno.env.get("VSWEB_SERVICE_ROLE_KEY");
  if (vswebUrl && vswebKey) {
    try {
      clients.push({ name: "VSWEB", client: createClient(vswebUrl, vswebKey) });
    } catch (e) {
      console.warn("[project-clients] VSWEB client creation failed:", e);
    }
  }

  const thinkUrl = Deno.env.get("THINKERMAN_SUPABASE_URL");
  const thinkKey = Deno.env.get("THINKERMAN_SERVICE_ROLE_KEY");
  if (thinkUrl && thinkKey) {
    try {
      clients.push({ name: "THINKERMAN", client: createClient(thinkUrl, thinkKey) });
    } catch (e) {
      console.warn("[project-clients] THINKERMAN client creation failed:", e);
    }
  }

  _cachedProjectClients = clients;
  return clients;
}

export function getCurrentProjectName(): string {
  const currentUrl = Deno.env.get("SUPABASE_URL") || "";
  return currentUrl.includes("qhvcdqkqpgpdxogqqvyr") ? "DEV" : "PROD";
}

export function getClientForProject(
  admin: ReturnType<typeof createClient>,
  projectName?: string
): ReturnType<typeof createClient> {
  const currentProject = getCurrentProjectName();
  const isDev = currentProject === "DEV";

  // CRITICAL DEV ISOLATION: When running in the DEV environment,
  // mutations must NEVER route to PROD.
  if (isDev) {
    return admin;
  }

  if (!projectName || projectName.toUpperCase() === currentProject) {
    return admin;
  }

  const clients = getProjectClients(admin);
  const pc = clients.find(p => p.name.toUpperCase() === projectName.toUpperCase());
  return pc?.client || admin;
}

