import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { NavClient, NavCredentials } from '../_shared/nav/index.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Invalid user token');
    }

    const body = await req.json();
    const { action, company_id, credentials } = body;

    switch (action) {
      case 'validate_credentials': {
        const { data: credsResult, error: credsError } = await supabaseClient
          .rpc('get_nav_credentials', { p_user_id: user.id, p_company_id: company_id || null });

        if (credsError || !credsResult || credsResult.error) {
          throw new Error('Could not retrieve credentials');
        }

        const client = new NavClient(credsResult as NavCredentials);
        const result = await client.validateCredentials();

        const updateQuery = supabaseClient
          .from('user_nav_credentials')
          .update({
            validation_status: result.status,
            validation_error: result.error,
            last_validated_at: new Date().toISOString()
          });

        if (company_id) {
          await updateQuery.eq('company_id', company_id);
        } else {
          await updateQuery.eq('user_id', user.id);
        }

        return new Response(
          JSON.stringify({
            success: result.valid,
            status: result.status,
            message: result.message,
            error: result.error,
            requestId: result.requestId,
            env: result.env,
            details: result.details
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'validate_credentials_inline': {
        if (!credentials) throw new Error('No credentials provided');
        const client = new NavClient(credentials as NavCredentials);
        const result = await client.validateCredentials();

        return new Response(
          JSON.stringify({
            success: result.valid,
            status: result.status,
            message: result.message,
            error: result.error,
            requestId: result.requestId,
            env: result.env
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'request_token': {
        const { data: credsResult, error: credsError } = await supabaseClient
          .rpc('get_nav_credentials', { p_user_id: user.id, p_company_id: company_id || null });

        if (credsError || !credsResult || credsResult.error) {
          throw new Error('Could not retrieve credentials');
        }

        const client = new NavClient(credsResult as NavCredentials);
        const token = await client.requestToken();

        return new Response(
          JSON.stringify({
            success: true,
            token,
            expires_in: 600
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error('Invalid action');
    }

  } catch (error: any) {
    console.error('[NAV-TOKEN] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
