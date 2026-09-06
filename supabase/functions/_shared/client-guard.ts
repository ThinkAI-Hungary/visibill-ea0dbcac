/**
 * Client Guard for Visibill Edge Functions
 * Blocks unauthorized script-based automation (node, python, curl, postman, etc.)
 * attempting to invoke user-facing Edge Functions with user tokens outside the official webapp.
 */

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

export function checkAutomationShield(req: Request): Response | null {
  // 1. Service role / internal caller bypass (Worker, cron jobs, internal services)
  const authHeader = req.headers.get('authorization') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (serviceKey && authHeader.includes(serviceKey)) {
    return null;
  }

  const userAgent = (req.headers.get('user-agent') || '').toLowerCase();
  const clientInfo = (req.headers.get('x-client-info') || '').toLowerCase();
  const origin = req.headers.get('origin') || '';
  const referer = req.headers.get('referer') || '';

  // 2. Detect known script runners & CLI automation tools
  const isScript =
    userAgent.startsWith('node') ||
    userAgent.includes('node-fetch') ||
    userAgent.includes('axios') ||
    userAgent.includes('undici') ||
    userAgent.startsWith('python') ||
    userAgent.includes('aiohttp') ||
    userAgent.includes('requests') ||
    userAgent.includes('urllib') ||
    userAgent.startsWith('curl') ||
    userAgent.startsWith('wget') ||
    userAgent.includes('postman') ||
    userAgent.includes('insomnia') ||
    userAgent.includes('httpie') ||
    userAgent.startsWith('powershell') ||
    userAgent.includes('go-http-client') ||
    clientInfo.includes('supabase-js-node');

  if (isScript) {
    return new Response(
      JSON.stringify({
        code: 'AUTOMATION_BLOCKED',
        error: 'A közvetlen szkript-alapú automatizáció le van tiltva a Visibill rendszerében. Kérjük használd a hivatalos webes felületet!',
        details: 'Direct script automation is restricted. Please use the official Visibill web application.',
      }),
      {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // 4. Missing browser origin & referer on non-webapp requests
  // Modern browsers making cross-origin fetch to Supabase ALWAYS provide Origin
  if (!origin && !referer && !userAgent.startsWith('deno')) {
    return new Response(
      JSON.stringify({
        code: 'AUTOMATION_BLOCKED',
        error: 'A közvetlen szkript-alapú automatizáció le van tiltva a Visibill rendszerében. Kérjük használd a hivatalos webes felületet!',
        details: 'Direct script automation is restricted. Please use the official Visibill web application.',
      }),
      {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Allow legitimate webapp browser requests
  return null;
}
