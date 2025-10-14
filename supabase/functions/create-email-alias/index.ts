import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { company_name } = await req.json();

    if (!company_name) {
      throw new Error('Company name is required');
    }

    // Get Mailgun credentials
    const mailgunApiKey = Deno.env.get('MAILGUN_API_KEY');
    const mailgunDomain = Deno.env.get('MAILGUN_DOMAIN');

    if (!mailgunApiKey || !mailgunDomain) {
      throw new Error('Mailgun not configured');
    }

    // Generate alias email (slug from company name)
    const slug = company_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    
    const aliasEmail = `${slug}@${mailgunDomain}`;

    // Create Mailgun route
    const routeUrl = `https://api.eu.mailgun.org/v3/routes`;
    const forwardUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-mailgun-webhook`;
    
    const routeResponse = await fetch(routeUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`api:${mailgunApiKey}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        priority: '0',
        description: `Invoice forwarding for ${company_name}`,
        expression: `match_recipient("${aliasEmail}")`,
        action: `forward("${forwardUrl}")`,
      }),
    });

    if (!routeResponse.ok) {
      const errorText = await routeResponse.text();
      console.error('Mailgun route creation failed:', errorText);
      throw new Error(`Failed to create Mailgun route: ${routeResponse.statusText}`);
    }

    const routeData = await routeResponse.json();
    console.log('Mailgun route created:', routeData);

    // Store in database
    const { data: alias, error: dbError } = await supabase
      .from('email_aliases')
      .insert({
        user_id: user.id,
        alias_email: aliasEmail,
        company_name,
        status: 'active',
        mailgun_route_id: routeData.route?.id,
        verified_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      // Try to cleanup Mailgun route if DB insert fails
      if (routeData.route?.id) {
        await fetch(`https://api.eu.mailgun.org/v3/routes/${routeData.route.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Basic ${btoa(`api:${mailgunApiKey}`)}`,
          },
        });
      }
      throw dbError;
    }

    return new Response(
      JSON.stringify({ alias }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in create-email-alias:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
