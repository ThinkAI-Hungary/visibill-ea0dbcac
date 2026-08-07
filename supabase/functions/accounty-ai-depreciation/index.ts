import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AssetToSuggest {
  id: string;
  name: string;
  cost: number;
  description: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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

    const { assets } = await req.json() as { assets: AssetToSuggest[] };
    if (!assets || !Array.isArray(assets) || assets.length === 0) {
      return new Response(JSON.stringify({ error: "Assets array is required" }), {
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

    const systemPrompt = `You are a professional Hungarian tax advisor AI. Your task is to recommend the most optimal Individual Entrepreneur (Egyéni Vállalkozó) depreciation (Értékcsökkenés / ÉCS) method and rate for a list of assets based on Szja tv. 11. sz. melléklet.
    
    Available depreciation methods:
    - "linear": Lineáris (Egyenletes leírás) - Default for regular assets. Standard rates: 33.3% for IT/computing/software, 20% for vehicles/cars, 14.5% for general furniture/machinery, 2% for buildings/real estate.
    - "declining_balance": Degresszív - Nettó érték szerinti (declining balance using net value).
    - "sum_of_years_digits": Degresszív - Évek számának összege (sum of years digits). Recommended for assets with fast technological obsolescence.
    - "progressive": Progresszív (increasing depreciation over time).
    - "performance": Teljesítményarányos (performance-based, e.g. based on km or hours run). Good for production machinery or high-use vehicles.
    - "multiplier": Szorzószámos (using multipliers).
    - "absolute": Abszolút összegű (annual fixed amount).
    - "immediate": Azonnali (100% write-off in the first year). Mandatory for any asset with cost LESS than 200,000 HUF.
    
    Guidelines:
    1. If cost < 200000, you MUST suggest method: "immediate" and rate: 100.
    2. For IT equipment (laptop, PC, phone), suggest "linear" with rate: 33.3.
    3. For cars/vans/vehicles, suggest "linear" with rate: 20.
    4. For office furniture/air conditioners/fixtures, suggest "linear" with rate: 14.5.
    5. Return the predictions in JSON format as an array of objects containing the asset id, suggested method (method), suggested annual rate percent (rate), and a brief Hungarian explanation (explanation) justifying your decision.
    
    Example output format:
    {
      "suggestions": [
        { "id": "1", "method": "linear", "rate": 33.3, "explanation": "Számítástechnikai eszköz Szja tv. szerinti 33.3%-os lineáris leírási kulccsal." }
      ]
    }`;

    let apiUrl = "https://api.openai.com/v1/chat/completions";
    let apiModel = "gpt-4o-mini";
    let apiKey = openaiKey || "";

    if (deepseekKey) {
      apiUrl = "https://api.deepseek.com/chat/completions";
      apiModel = "deepseek-chat";
      apiKey = deepseekKey;
    }

    const aiResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: apiModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify({ assets }) }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      throw new Error(`AI API error: ${errText}`);
    }

    const responseData = await aiResponse.json();
    const resultText = responseData.choices[0].message.content;
    const { suggestions } = JSON.parse(resultText);

    return new Response(JSON.stringify({ suggestions }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("AI depreciation suggestion error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
