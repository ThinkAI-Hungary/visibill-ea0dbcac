import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
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

    // Create Supabase client with anon key to validate user JWT
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });
    
    // Get user from JWT
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    
    if (userError || !user) {
      console.error('User validation error:', userError);
      throw new Error('Invalid user token');
    }

    // Create admin client for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const requestBody = await req.json();
    const { action, email_address } = requestBody;

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
        `scope=https://www.googleapis.com/auth/gmail.modify`;

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
      const { data: tokens, error } = await supabaseAdmin
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
      if (!email_address) {
        throw new Error('Email address is required for disconnect action');
      }
      
      console.log('Disconnecting email:', email_address, 'for user:', user.id);
      
      // Delete the stored token
      const { error } = await supabaseAdmin
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