import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { logError } from "../_shared/error-logger.ts";
import { corsHeaders, checkAutomationShield } from "../_shared/client-guard.ts";

const MAX_RETRIES = 3;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Block unauthorized external script automation
  const blocked = checkAutomationShield(req);
  if (blocked) {
    return blocked;
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

    // Check if alias already exists for this company with a valid alias_email
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

    // Get Mailgun credentials
    const mailgunApiKey = Deno.env.get('MAILGUN_API_KEY');
    const mailgunDomain = Deno.env.get('MAILGUN_DOMAIN');

    if (!mailgunApiKey || !mailgunDomain) {
      throw new Error('Mailgun not configured');
    }

    // Generate slug from company name (normalize and clean)
    const baseSlug = company_name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[^a-z0-9]+/g, '')
      .substring(0, 20); // Limit length

    if (!baseSlug) {
      throw new Error('Invalid company name - cannot generate slug');
    }

    // Use service role client for querying all aliases (bypasses RLS)
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Function to find next available number for this slug
    const findNextNumber = async (): Promise<number> => {
      // Query ALL aliases that start with this slug prefix (global, not user-specific)
      const { data: existingAliases, error: queryError } = await serviceClient
        .from('email_aliases')
        .select('alias_email')
        .like('alias_email', `${baseSlug}%@${mailgunDomain}`);

      if (queryError) {
        console.error('Error querying existing aliases:', queryError);
        throw queryError;
      }

      console.log(`Found ${existingAliases?.length || 0} existing aliases with slug prefix "${baseSlug}"`);

      if (!existingAliases || existingAliases.length === 0) {
        return 1;
      }

      // Extract numbers from existing aliases: baseSlugN@domain
      const numbers: number[] = [];
      const regex = new RegExp(`^${baseSlug}(\\d+)@${mailgunDomain.replace('.', '\\.')}$`);
      
      for (const alias of existingAliases) {
        if (!alias.alias_email) continue;
        const match = alias.alias_email.match(regex);
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num)) {
            numbers.push(num);
          }
        }
      }

      console.log(`Extracted numbers: ${JSON.stringify(numbers)}`);

      if (numbers.length === 0) {
        return 1;
      }

      // Return max + 1
      const maxNum = Math.max(...numbers);
      console.log(`Max number found: ${maxNum}, next: ${maxNum + 1}`);
      return maxNum + 1;
    };

    // Retry loop for handling unique constraint conflicts
    let alias = null;
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const uniqueNumber = await findNextNumber();
        const aliasEmail = `${baseSlug}${uniqueNumber}@${mailgunDomain}`;

        console.log(`Attempt ${attempt}: Creating alias "${aliasEmail}"`);

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
          
          // Log before throwing
          await logError(serviceClient, {
            error_type: 'mailgun',
            component: 'create-email-alias',
            action: 'create_route',
            message: `Mailgun route creation failed: ${errorMessage}`,
            user_id: user.id,
            company_id,
            context: { aliasEmail, attempt, statusCode: routeResponse.status },
          });
          throw new Error(errorMessage);
        }

        const routeData = await routeResponse.json();
        console.log('Mailgun route created:', routeData);

        // Store in database (update if exists with empty alias, otherwise insert)
        let dbResult;

        if (existingAliasId) {
          // Update existing record with empty alias_email
          dbResult = await serviceClient
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
        } else {
          // Insert new record
          dbResult = await serviceClient
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
        }

        if (dbResult.error) {
          // Check if it's a unique constraint violation
          if (dbResult.error.code === '23505' || dbResult.error.message?.includes('duplicate') || dbResult.error.message?.includes('unique')) {
            console.log(`Unique constraint violation on attempt ${attempt}, retrying...`);
            
            // Cleanup Mailgun route
            if (routeData.route?.id) {
              await fetch(`https://api.eu.mailgun.net/v3/routes/${routeData.route.id}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Basic ${btoa(`api:${mailgunApiKey}`)}`,
                },
              });
            }
            
            lastError = dbResult.error;
            continue; // Retry with next number
          }
          
          // Other database error - cleanup and throw
          console.error('Database error:', dbResult.error);
          if (routeData.route?.id) {
            await fetch(`https://api.eu.mailgun.net/v3/routes/${routeData.route.id}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Basic ${btoa(`api:${mailgunApiKey}`)}`,
              },
            });
          }
          throw dbResult.error;
        }

        alias = dbResult.data;
        console.log('Alias created successfully:', alias);
        break; // Success, exit retry loop

      } catch (err) {
        lastError = err;
        console.error(`Attempt ${attempt} failed:`, err);
        
        if (attempt === MAX_RETRIES) {
          throw new Error(`Failed to create alias after ${MAX_RETRIES} attempts: ${lastError?.message || 'Unknown error'}`);
        }
      }
    }

    if (!alias) {
      throw new Error('Failed to create alias');
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
    try {
      const svc = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      await logError(svc, {
        error_type: 'email_alias',
        component: 'create-email-alias',
        action: 'unhandled_exception',
        message: error.message || 'Failed to create email alias',
        context: { stack: error.stack },
      });
    } catch { /* ignore logging failure */ }
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
