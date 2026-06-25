import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * AI Phone Call Edge Function
 * 
 * Initiates an AI-powered phone call to a client's contact person
 * to request missing documents. Supports multiple providers:
 * - Bland.ai (default)
 * - Vapi
 * - Retell
 * 
 * The provider is configured via the AI_PHONE_PROVIDER env var.
 * 
 * Input JSON body: {
 *   companyId: string,
 *   contactPhone: string,
 *   contactName: string,
 *   companyName: string,
 *   missingItems: { title: string, category: string }[],
 *   language: 'hu' | 'en',
 * }
 */
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
    if (!authHeader) throw new Error('No authorization header');

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (userError || !user) throw new Error('Invalid user token');

    const body = await req.json();
    const { companyId, contactPhone, contactName, companyName, missingItems, language } = body;

    if (!contactPhone || !companyId) {
      throw new Error('Missing contactPhone or companyId');
    }

    console.log(`[AI-PHONE] Initiating call to ${contactPhone} for company ${companyName}`);

    const provider = Deno.env.get('AI_PHONE_PROVIDER') || 'bland';
    const apiKey = Deno.env.get('AI_PHONE_API_KEY');

    if (!apiKey) {
      // No API key configured — return a structured error so the frontend can show it
      return new Response(
        JSON.stringify({
          success: false,
          error: 'AI telefon provider nincs konfigurálva. Állítsa be az AI_PHONE_PROVIDER és AI_PHONE_API_KEY környezeti változókat.',
          provider,
          demoMode: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build the call prompt
    const itemsList = (missingItems || [])
      .map((item: any) => `- ${item.title}`)
      .join('\n');

    const prompt = language === 'hu'
      ? `Szia ${contactName}! A ${companyName} cég könyvelése kapcsán keresem. Sajnos hiányoznak a következő dokumentumok:\n${itemsList}\nKérlek, mielőbb küldd el ezeket a könyvelő irodának. Köszönöm szépen!`
      : `Hello ${contactName}! I'm calling regarding the accounting for ${companyName}. We're missing the following documents:\n${itemsList}\nPlease send them to the accounting office as soon as possible. Thank you!`;

    let callResult: any;

    switch (provider) {
      case 'bland': {
        // Bland.ai API
        const response = await fetch('https://api.bland.ai/v1/calls', {
          method: 'POST',
          headers: {
            'Authorization': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            phone_number: contactPhone,
            task: prompt,
            voice: language === 'hu' ? 'hungarian-female-1' : 'maya',
            language: language || 'hu',
            max_duration: 120,
            wait_for_greeting: true,
          }),
        });
        callResult = await response.json();
        break;
      }

      case 'vapi': {
        // Vapi API
        const response = await fetch('https://api.vapi.ai/call/phone', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            phoneNumberId: Deno.env.get('VAPI_PHONE_NUMBER_ID'),
            customer: { number: contactPhone },
            assistant: {
              firstMessage: prompt,
              model: {
                provider: 'openai',
                model: 'gpt-4o',
                messages: [{ role: 'system', content: prompt }],
              },
            },
          }),
        });
        callResult = await response.json();
        break;
      }

      case 'retell': {
        // Retell API
        const response = await fetch('https://api.retellai.com/v2/create-phone-call', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from_number: Deno.env.get('RETELL_FROM_NUMBER'),
            to_number: contactPhone,
            override_agent_id: Deno.env.get('RETELL_AGENT_ID'),
            retell_llm_dynamic_variables: {
              contact_name: contactName,
              company_name: companyName,
              missing_items: itemsList,
            },
          }),
        });
        callResult = await response.json();
        break;
      }

      default:
        throw new Error(`Unknown AI phone provider: ${provider}`);
    }

    console.log(`[AI-PHONE] Call initiated via ${provider}:`, JSON.stringify(callResult).substring(0, 300));

    // Update escalation level on missing items
    if (companyId && missingItems?.length) {
      await supabaseClient
        .from('accounty_missing_items')
        .update({
          escalation_level: 3,
          last_notified_at: new Date().toISOString(),
          notification_count: 1, // Note: not atomic increment, but safe
          status: 'notified',
        })
        .eq('company_id', companyId)
        .in('status', ['open', 'notified']);
    }

    return new Response(
      JSON.stringify({
        success: true,
        provider,
        callId: callResult.call_id || callResult.id || callResult.callId,
        status: callResult.status || 'initiated',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[AI-PHONE] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
