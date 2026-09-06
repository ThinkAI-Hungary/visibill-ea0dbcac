import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsHeaders, checkAutomationShield } from "../_shared/client-guard.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Block unauthorized external script automation
  const blocked = checkAutomationShield(req);
  if (blocked) {
    return blocked;
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const authHeader = req.headers.get('Authorization');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY') || '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse companyId from request body
    const body = await req.json().catch(() => ({}));
    const companyId = body.companyId;

    if (!companyId) {
      return new Response(
        JSON.stringify({ error: 'companyId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is the company owner
    const { data: company, error: companyError } = await serviceClient
      .from('companies')
      .select('owner_id')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      return new Response(
        JSON.stringify({ error: 'Company not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (company.owner_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Csak a cég tulajdonosa törölheti a NAV kapcsolatot' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch credentials by company_id
    const { data: credentials, error: fetchError } = await serviceClient
      .from('user_nav_credentials')
      .select('password_secret_id, sign_key_secret_id, exchange_key_secret_id')
      .eq('company_id', companyId)
      .single();

    if (fetchError) {
      return new Response(
        JSON.stringify({ error: 'Credentials not found' }), 
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete secrets from Vault
    const secretIds = [
      credentials.password_secret_id,
      credentials.sign_key_secret_id,
      credentials.exchange_key_secret_id
    ].filter(id => id !== null);

    for (const secretId of secretIds) {
      const { error: deleteSecretError } = await serviceClient
        .from('vault.secrets')
        .delete()
        .eq('id', secretId);

      if (deleteSecretError) {
        console.error(`Error deleting secret ${secretId}:`, deleteSecretError);
      }
    }

    // Delete credentials by company_id
    const { error: deleteCredError } = await serviceClient
      .from('user_nav_credentials')
      .delete()
      .eq('company_id', companyId);

    if (deleteCredError) {
      return new Response(
        JSON.stringify({ error: 'Failed to delete credentials' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('NAV credentials deleted for company:', companyId, 'by owner:', user.id);

    return new Response(
      JSON.stringify({ success: true, message: 'NAV kapcsolat sikeresen leválasztva' }), 
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in delete-nav-credentials:', error);
    return new Response(
      JSON.stringify({ error: error.message }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
