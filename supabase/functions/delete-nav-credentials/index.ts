import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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

    // Create client for user authentication
    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY') || '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user authentication
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }), 
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('User authenticated:', user.id);

    // Create service role client for vault operations
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch user's NAV credentials
    const { data: credentials, error: fetchError } = await serviceClient
      .from('user_nav_credentials')
      .select('password_secret_id, sign_key_secret_id, exchange_key_secret_id')
      .eq('user_id', user.id)
      .single();

    if (fetchError) {
      console.error('Error fetching credentials:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Credentials not found' }), 
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Credentials found, deleting secrets...');

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
        // Continue deleting other secrets even if one fails
      } else {
        console.log(`Secret ${secretId} deleted successfully`);
      }
    }

    // Delete user_nav_credentials record
    const { error: deleteCredError } = await serviceClient
      .from('user_nav_credentials')
      .delete()
      .eq('user_id', user.id);

    if (deleteCredError) {
      console.error('Error deleting credentials:', deleteCredError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete credentials' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('NAV credentials deleted successfully for user:', user.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'NAV kapcsolat sikeresen leválasztva' 
      }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in delete-nav-credentials:', error);
    return new Response(
      JSON.stringify({ error: error.message }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
