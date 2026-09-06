import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsHeaders, checkAutomationShield } from "../_shared/client-guard.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const automationBlock = checkAutomationShield(req);
  if (automationBlock) {
    return automationBlock;
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const anonClient = createClient(supabaseUrl, supabaseAnonKey);
    const token = authHeader.replace("Bearer ", "");
    
    // Verify user is authenticated
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { teaorCode, companyName } = await req.json() as { teaorCode: string; companyName?: string };
    if (!teaorCode) {
      return new Response(JSON.stringify({ error: "teaorCode is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const deepseekKey = Deno.env.get("DEEPSEEK_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    if (!deepseekKey && !openaiKey) {
      return new Response(JSON.stringify({ error: "No API key configured (neither DEEPSEEK_API_KEY nor OPENAI_API_KEY)" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let apiUrl = "https://api.openai.com/v1/chat/completions";
    let apiModel = "gpt-4o-mini";
    let apiKey = openaiKey || "";

    if (deepseekKey) {
      apiUrl = "https://api.deepseek.com/chat/completions";
      apiModel = "deepseek-chat";
      apiKey = deepseekKey;
    }

    const systemPrompt = `Te egy magyar könyvelő asszisztens AI vagy. A feladatod, hogy a megadott TEÁOR kód és cégnév alapján írj egy rövid, tömör és professzionális cégleírást (2-3 mondat), amely leírja a vállalkozás fő tevékenységét és üzletmenetét. Ez a leírás később a könyvelő programban segíti az AI-t a bejövő és kimenő számlák helyes kontírozásában (például a beszerzett eszközök anyag- vagy árubesorolásában).
    Mindig magyarul válaszolj, szakmai stílusban, felesleges bevezetés vagy lezárás nélkül. Csak magát a generált cégleírást add vissza, semmi mást!`;

    const openaiResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: apiModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Cégnév: ${companyName || 'Nincs megadva'}\nElsődleges TEÁOR: ${teaorCode}` }
        ],
        temperature: 0.5,
        max_tokens: 500,
      }),
    });

    if (!openaiResponse.ok) {
      const errText = await openaiResponse.text();
      throw new Error(`OpenAI API error: ${errText}`);
    }

    const responseData = await openaiResponse.json();
    const description = responseData.choices[0].message.content.trim();

    return new Response(JSON.stringify({ description }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("AI description generation error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
