import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { ProjectClient } from "../types.ts";

let _cachedProjectClients: ProjectClient[] | null = null;

export function getProjectClients(admin: ReturnType<typeof createClient>): ProjectClient[] {
  if (_cachedProjectClients) {
    return _cachedProjectClients;
  }
  const clients: ProjectClient[] = [
    { name: "PROD", client: admin },
  ];

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

export function getClientForProject(admin: ReturnType<typeof createClient>, projectName: string): ReturnType<typeof createClient> {
  const clients = getProjectClients(admin);
  const pc = clients.find(p => p.name.toUpperCase() === projectName.toUpperCase());
  return pc?.client || admin;
}
