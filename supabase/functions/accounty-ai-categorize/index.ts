import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsHeaders, checkAutomationShield } from "../_shared/client-guard.ts";

interface InvoiceToPredict {
  id: string;
  partnerName: string;
  grossAmount: number;
  direction: 'bejovo' | 'kimeno';
}

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

    const { invoices } = await req.json() as { invoices: InvoiceToPredict[] };
    if (!invoices || !Array.isArray(invoices) || invoices.length === 0) {
      return new Response(JSON.stringify({ error: "Invoices array is required" }), {
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

    const systemPrompt = `You are a professional Hungarian accountant AI. Your task is to categorize a list of invoices into the Hungarian Individual Entrepreneur (Egyéni Vállalkozó) Single-Entry Cashbook (Pénztárkönyv) categories.

Available categories for INCOMING sales (direction: "kimeno"):
- "bevetel_adokoteles": Default for almost all sales. Business revenue, sales of services/goods.
- "bevetel_be_nem_szamito": Loans, subsidies, capital deposits.

Available categories for OUTGOING expenses (direction: "bejovo"):
- "kiadas_anyag_arubeszerzes": Purchasing goods for resale, inventory, tools, office supplies, hardware, packaging.
- "kiadas_kozvetitett_szolgaltatas": Services purchased to be directly resold to customers.
- "kiadas_alkalmazott_ber_kozteher": Employee payroll, wage taxes, social security contributions for staff.
- "kiadas_egyeb_koltseg": Default for general expenses. Office rent, utilities, bookkeeping fees, bank fees, marketing, phone bills, travel costs, software subscriptions.
- "kiadas_beruhazasi_koltseg": Investing in fixed assets (depreciable assets valued above 200,000 HUF).
- "kiadas_egyeb_nem_koltseg": Non-business expenses, taxes paid (SZJA, local business tax, chambers), loan repayments.

Analyze the partner name and amount to make your prediction. Return the predictions in JSON format as an array of objects containing the invoice id, predicted category, and a brief Hungarian explanation (explanation).

Example output:
{
  "predictions": [
    { "id": "1", "category": "kiadas_anyag_arubeszerzes", "explanation": "Irodaszer beszerzés" }
  ]
}`;

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
          { role: "user", content: JSON.stringify({ invoices }) }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
    });

    if (!openaiResponse.ok) {
      const errText = await openaiResponse.text();
      throw new Error(`OpenAI API error: ${errText}`);
    }

    const responseData = await openaiResponse.json();
    const resultText = responseData.choices[0].message.content;
    const { predictions } = JSON.parse(resultText);

    return new Response(JSON.stringify({ predictions }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("AI categorization error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
