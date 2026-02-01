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

    const { company_name, company_id } = await req.json();

    if (!company_name) {
      throw new Error('Company name is required');
    }

    if (!company_id) {
      throw new Error('Company ID is required');
    }

    // Check if alias already exists for this company
    const { data: existingAlias } = await supabase
      .from('email_aliases')
      .select('*')
      .eq('company_id', company_id)
      .maybeSingle();

    // Return existing alias only if it has a valid (non-empty) alias_email
    if (existingAlias && existingAlias.alias_email && existingAlias.alias_email.trim() !== '') {
      return new Response(
        JSON.stringify({ alias: existingAlias }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // If alias record exists but alias_email is empty, we'll update it
    const existingAliasId = existingAlias?.id;
    const existingMailgunRouteId = existingAlias?.mailgun_route_id;

    // Get Mailgun credentials
    const mailgunApiKey = Deno.env.get('MAILGUN_API_KEY');
    const mailgunDomain = Deno.env.get('MAILGUN_DOMAIN');

    if (!mailgunApiKey || !mailgunDomain) {
      throw new Error('Mailgun not configured');
    }

    // Generate slug from company name
    const baseSlug = company_name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[^a-z0-9]+/g, '')
      .substring(0, 20); // Limit length

    // Find a unique slug by checking existing aliases
    const { data: existingAliases } = await supabase
      .from('email_aliases')
      .select('alias_email')
      .like('alias_email', `${baseSlug}%@${mailgunDomain}`);

    let uniqueNumber = 1;
    if (existingAliases && existingAliases.length > 0) {
      // Extract numbers from existing aliases and find max
      const numbers = existingAliases
        .map(a => {
          const match = a.alias_email.match(new RegExp(`^${baseSlug}(\\d+)@`));
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter(n => n > 0);
      
      if (numbers.length > 0) {
        uniqueNumber = Math.max(...numbers) + 1;
      }
    }

    const aliasEmail = `${baseSlug}${uniqueNumber}@${mailgunDomain}`;

    // Create Mailgun route (EU region)
    const routeUrl = `https://api.eu.mailgun.net/v3/routes`;
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
      
      let errorMessage = 'Failed to create Mailgun route';
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.message && errorJson.message.includes('quota')) {
          errorMessage = 'Mailgun route limit reached. Please upgrade your Mailgun plan or delete existing routes.';
        } else {
          errorMessage = errorJson.message || errorMessage;
        }
      } catch {
        errorMessage = errorText || routeResponse.statusText;
      }
      
      throw new Error(errorMessage);
    }

    const routeData = await routeResponse.json();
    console.log('Mailgun route created:', routeData);

    // Store in database with company_id (update if exists with empty alias, otherwise insert)
    let alias;
    let dbError;

    if (existingAliasId) {
      // Update existing record with empty alias_email
      const result = await supabase
        .from('email_aliases')
        .update({
          alias_email: aliasEmail,
          company_name,
          status: 'active',
          mailgun_route_id: routeData.route?.id,
          verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingAliasId)
        .select()
        .single();
      alias = result.data;
      dbError = result.error;
    } else {
      // Insert new record
      const result = await supabase
        .from('email_aliases')
        .insert({
          user_id: user.id,
          alias_email: aliasEmail,
          company_name,
          company_id,
          status: 'active',
          mailgun_route_id: routeData.route?.id,
          verified_at: new Date().toISOString(),
        })
        .select()
        .single();
      alias = result.data;
      dbError = result.error;
    }

    if (dbError) {
      console.error('Database error:', dbError);
      // Try to cleanup Mailgun route if DB insert fails
      if (routeData.route?.id) {
        await fetch(`https://api.eu.mailgun.net/v3/routes/${routeData.route.id}`, {
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
