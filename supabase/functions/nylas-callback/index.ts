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
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      return new Response(
        `<html><body><script>window.close();</script><p>Authorization failed: ${error}</p></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    if (!code || !state) {
      throw new Error('Missing code or state parameter');
    }

    // Extract user ID from state (format: uuid-timestamp)
    const lastHyphenIndex = state.lastIndexOf('-');
    const userId = state.substring(0, lastHyphenIndex);
    
    console.log('Processing OAuth callback for user:', userId);

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Exchange code for token using Nylas API
    const projectRef = new URL(supabaseUrl).host.split('.')[0];
    const redirectUri = `https://${projectRef}.supabase.co/functions/v1/nylas-callback`;
    const tokenResponse = await fetch('https://api.eu.nylas.com/v3/connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${nylasApiKey}`
      },
      body: JSON.stringify({
        client_id: nylasClientId,
        client_secret: nylasApiKey,
        redirect_uri: redirectUri,
        code: code,
        grant_type: 'authorization_code'
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      throw new Error(`Token exchange failed: ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    console.log('Token exchange successful:', tokenData);

    // Get account information from Nylas
    const accountResponse = await fetch(`https://api.eu.nylas.com/v3/grants/${tokenData.grant_id}`, {
      headers: {
        'Authorization': `Bearer ${nylasApiKey}`
      }
    });

    if (!accountResponse.ok) {
      const errorText = await accountResponse.text();
      console.error('Account fetch failed:', errorText);
      throw new Error(`Account fetch failed: ${errorText}`);
    }

    const accountData = await accountResponse.json();
    console.log('Account raw:', accountData);

    const grantInfo = accountData?.data ?? accountData;

    // Store token in database
    const { data, error: dbError } = await supabase
      .from('nylas_tokens')
      .upsert({
        user_id: userId,
        grant_id: tokenData.grant_id,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        email_address: grantInfo.email,
        provider: grantInfo.provider,
        expires_at: tokenData.expires_in ? 
          new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : null
      }, {
        onConflict: 'user_id,email_address'
      });

    if (dbError) {
      console.error('Database error:', dbError);
      throw dbError;
    }

    console.log('Token stored successfully for user:', userId);

    // Return success page that closes the popup
    return new Response(
      `<html>
        <body>
          <script>
            window.opener.postMessage({ success: true, email: '${grantInfo.email}' }, '*');
            window.close();
          </script>
          <p>Authorization successful! You can close this window.</p>
        </body>
      </html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );

  } catch (error: any) {
    console.error('Error in nylas-callback function:', error);
    
    return new Response(
      `<html>
        <body>
          <script>
            window.opener.postMessage({ error: '${error.message}' }, '*');
            window.close();
          </script>
          <p>Authorization failed: ${error.message}</p>
        </body>
      </html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
});