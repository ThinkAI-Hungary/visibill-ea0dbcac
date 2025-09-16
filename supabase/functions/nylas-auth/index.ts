import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const nylasClientId = Deno.env.get('NYLAS_CLIENT_ID')!;
const nylasApiKey = Deno.env.get('NYLAS_API_KEY')!;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get user from JWT
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    
    if (userError || !user) {
      throw new Error('Invalid user token');
    }

    const { action } = await req.json();

    if (action === 'get_auth_url') {
      // Generate OAuth URL for Nylas
      const projectRef = new URL(supabaseUrl).host.split('.')[0];
      const redirectUri = `https://${projectRef}.supabase.co/functions/v1/nylas-callback`;
      const state = `${user.id}-${Date.now()}`;
      
      const authUrl = `https://api.eu.nylas.com/v3/connect/auth?` +
        `client_id=${nylasClientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `state=${state}&` +
        `scope=https://www.googleapis.com/auth/gmail.readonly`;

      console.log('Generated auth URL:', authUrl);

      return new Response(
        JSON.stringify({ 
          authUrl,
          state 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (action === 'get_tokens') {
      // Fetch user's stored tokens
      const { data: tokens, error } = await supabase
        .from('nylas_tokens')
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      return new Response(
        JSON.stringify({ tokens }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (action === 'disconnect') {
      const { email_address } = await req.json();
      
      // Delete the stored token
      const { error } = await supabase
        .from('nylas_tokens')
        .delete()
        .eq('user_id', user.id)
        .eq('email_address', email_address);

      if (error) {
        throw error;
      }

      return new Response(
        JSON.stringify({ success: true }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    throw new Error('Invalid action');

  } catch (error: any) {
    console.error('Error in nylas-auth function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});