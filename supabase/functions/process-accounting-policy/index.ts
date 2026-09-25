import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsHeaders, checkAutomationShield } from "../_shared/client-guard.ts";
import { Buffer } from "node:buffer";

interface ProcessPolicyRequest {
  policyId: string;
  extractedText?: string;
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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const anonClient = createClient(supabaseUrl, supabaseAnonKey);
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");

    // Verify user is authenticated
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { policyId, extractedText: clientProvidedText } = await req.json() as ProcessPolicyRequest;
    if (!policyId) {
      return new Response(JSON.stringify({ error: "policyId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch policy record
    const { data: policy, error: policyErr } = await serviceClient
      .from("company_accounting_policies")
      .select("*")
      .eq("id", policyId)
      .single();

    if (policyErr || !policy) {
      return new Response(JSON.stringify({ error: "Policy not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const companyId = policy.company_id;

    // Verify user has access to company
    const { data: member } = await serviceClient
      .from("company_members")
      .select("id")
      .eq("company_id", companyId)
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: company } = await serviceClient
      .from("companies")
      .select("id, name, owner_id")
      .eq("id", companyId)
      .single();

    const isOwner = company?.owner_id === user.id;

    const { data: assignment } = await serviceClient
      .from("accounty_assignments")
      .select("id")
      .eq("company_id", companyId)
      .eq("accountant_user_id", user.id)
      .maybeSingle();

    if (!member && !isOwner && !assignment) {
      return new Response(JSON.stringify({ error: "Access denied to company policy" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update status to processing
    await serviceClient
      .from("company_accounting_policies")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", policyId);

    // 2. Obtain text from document
    let documentText = (clientProvidedText || "").trim();

    if (!documentText) {
      console.log(`Downloading policy file from storage: ${policy.file_path}`);
      const { data: fileBlob, error: downloadErr } = await serviceClient
        .storage
        .from("accounting_policies")
        .download(policy.file_path);

      if (downloadErr || !fileBlob) {
        throw new Error(`Failed to download policy file: ${downloadErr?.message || "empty file"}`);
      }

      const arrayBuffer = await fileBlob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (policy.file_name.toLowerCase().endsWith(".pdf") || policy.file_type === "application/pdf") {
        try {
          const pdfParse = (await import("npm:pdf-parse@1.1.1")).default;
          const parsed = await pdfParse(buffer);
          documentText = parsed.text || "";
        } catch (e: any) {
          console.error("PDF parse error:", e);
          throw new Error(`Nem sikerült a PDF szövegének kinyerése: ${e.message}`);
        }
      } else if (
        policy.file_name.toLowerCase().endsWith(".docx") || 
        policy.file_type.includes("wordprocessingml")
      ) {
        try {
          const mammoth = (await import("npm:mammoth@1.8.0")).default;
          const parsed = await mammoth.extractRawText({ buffer });
          documentText = parsed.value || "";
        } catch (e: any) {
          console.error("DOCX parse error:", e);
          throw new Error(`Nem sikerült a DOCX szövegének kinyerése: ${e.message}`);
        }
      } else {
        // Fallback: try reading as plain text
        documentText = new TextDecoder().decode(buffer);
      }
    }

    if (!documentText || documentText.trim().length < 20) {
      throw new Error("A feltöltött dokumentumból nem sikerült érdemi szöveget kinyerni.");
    }

    // Truncate document text safely to avoid token limit while preserving critical rules
    const maxChars = 35000;
    const truncatedText = documentText.length > maxChars 
      ? documentText.substring(0, maxChars) + "\n\n[... A dokumentum további része levágva ...]"
      : documentText;

    // 3. Call AI LLM to extract accounting rules
    const deepseekKey = Deno.env.get("DEEPSEEK_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    if (!deepseekKey && !openaiKey) {
      throw new Error("No AI API key configured (neither DEEPSEEK_API_KEY nor OPENAI_API_KEY)");
    }

    let apiUrl = "https://api.openai.com/v1/chat/completions";
    let apiModel = "gpt-4o-mini";
    let apiKey = openaiKey || "";

    if (deepseekKey) {
      apiUrl = "https://api.deepseek.com/chat/completions";
      apiModel = "deepseek-chat";
      apiKey = deepseekKey;
    }

    const systemPrompt = `Te egy mesterszintű magyar könyvvizsgáló és számviteli szakértő AI vagy.
A feladatod, hogy a megadott magyar számviteli politika (vagy annak kivonata) alapján pontosan kinyerd a cégre vonatkozó konkrét könyvelési és számviteli szabályokat az alábbi 4 főkategóriában:

1. 'fixed_assets' (Tárgyi eszközök és Értékcsökkenés):
   - 'low_value_asset_threshold': Kisértékű tárgyi eszköz azonnali egyösszegű leírási értékhatára (pl. 200 000 Ft vagy 100 000 Ft).
   - 'depreciation_rates': Értékcsökkenési leírási kulcsok/évek kategóriánként (gépek, járművek, irodatechnika, ingatlan).
   - 'residual_value_rule': Maradványérték megállapításának elve (pl. van-e maradványérték, vagy 0).

2. 'petty_cash' (Pénzkezelési és Házipénztár szabályzat):
   - 'petty_cash_daily_max_balance': Maximális napi záró készpénzállomány keretösszeg (Ft).
   - 'petty_cash_single_payment_limit': Egyedi készpénzkifizetés felső határa (Ft).
   - 'petty_cash_inventory_frequency': Pénztárellenőrzés / rovatolás gyakorisága (pl. "havonta", "negyedévente").

3. 'currency' (Devizaértékelés és Árfolyamok):
   - 'fx_rate_source': Választott árfolyam forrása (pl. "MNB hivatalos középárfolyam" vagy számlavezető bank neve).
   - 'fx_year_end_revaluation': Év végi devizaátértékelés elve és jelentősségi értékhatára.

4. 'inventory_gl' (Számlakontírozás és Készletértékelés):
   - 'inventory_valuation_method': Készletértékelési eljárás (pl. "FIFO" vagy "Mérlegelt átlagár").
   - 'gl_cost_class_preference': Költségek elszámolásának rendje (pl. "Kizárólag 5-ös költségnemek", vagy "5-ös és 6/7-es költséghely/költségviselő").
   - 'default_payment_term_days': Szabályzat szerinti fizetési határidő (napok száma).
   - 'materiality_threshold': Jelentős összegű hiba értékhatára (pl. "mérlegfőösszeg 2%-a vagy 100 millió Ft").

SZIGORÚ FORMÁTUM:
Kizárólag érvényes JSON választ adj vissza a következő formában, semmi mást ne írj:
{
  "summary": "1-3 mondatos összefoglaló a számviteli politika főbb jellemzőiről",
  "rules": [
    {
      "rule_category": "fixed_assets",
      "rule_key": "low_value_asset_threshold",
      "rule_name": "Kisértékű tárgyi eszköz leírási értékhatár",
      "rule_value": { "amount": 200000, "currency": "HUF" },
      "description": "A 200 000 Ft egyedi beszerzési érték alatti tárgyi eszközök használatbavételkor egyösszegben elszámolhatók értékcsökkenési leírásként.",
      "source_quote": "A 200.000 Ft egyedi bekerülési érték alatti vagyoni értékű jogok, szellemi termékek, tárgyi eszközök a használatbavételkor egyösszegben kerülnek elszámolásra."
    }
  ]
}

Ha egy adott szabály nem található meg kifejezetten a szövegben, akkor a magyar Számviteli Törvény (Sztv.) szerinti szokásos alapértelmezett értéket vedd figyelembe a rule_value-ban, a source_quote-ba pedig írd be, hogy "Sztv. szerinti általános alapértelmezés".`;

    const userPrompt = `Cégnév: ${company?.name || "Ismeretlen cég"}\nDokumentum neve: ${policy.file_name}\n\nDokumentum szöveges tartalma:\n${truncatedText}`;

    console.log(`Calling LLM API for policy ${policyId}...`);
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
          { role: "user", content: userPrompt }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      throw new Error(`AI API hiba (${aiResponse.status}): ${errText}`);
    }

    const aiJson = await aiResponse.json();
    const rawContent = aiJson.choices?.[0]?.message?.content?.trim() || "{}";
    
    let parsedResult: { summary?: string; rules?: any[] } = {};
    try {
      parsedResult = JSON.parse(rawContent);
    } catch (e: any) {
      console.error("JSON parse error from AI content:", rawContent);
      throw new Error("Az AI válasza nem volt érvényes JSON formátumú.");
    }

    const rules = Array.isArray(parsedResult.rules) ? parsedResult.rules : [];
    const summary = parsedResult.summary || "Számviteli politika feldolgozva.";

    console.log(`Extracted ${rules.length} rules for policy ${policyId}`);

    // 4. Save extracted rules into company_accounting_rules table as draft
    // Remove previous draft rules for this policy if any
    await serviceClient
      .from("company_accounting_rules")
      .delete()
      .eq("policy_id", policyId);

    if (rules.length > 0) {
      const rulesToInsert = rules.map((r: any) => ({
        company_id: companyId,
        policy_id: policyId,
        rule_category: r.rule_category || "fixed_assets",
        rule_key: r.rule_key || "generic_rule",
        rule_name: r.rule_name || "Számviteli szabály",
        rule_value: typeof r.rule_value === "object" && r.rule_value !== null ? r.rule_value : { value: r.rule_value },
        description: r.description || "",
        source_quote: r.source_quote || "",
        status: "draft",
        user_overridden: false,
      }));

      const { error: insertErr } = await serviceClient
        .from("company_accounting_rules")
        .insert(rulesToInsert);

      if (insertErr) {
        console.error("Error inserting accounting rules:", insertErr);
        throw new Error(`Nem sikerült elmenteni a kinyert szabályokat: ${insertErr.message}`);
      }
    }

    // 5. Update policy record
    await serviceClient
      .from("company_accounting_policies")
      .update({
        status: "processed",
        extracted_summary: summary,
        updated_at: new Date().toISOString(),
      })
      .eq("id", policyId);

    return new Response(JSON.stringify({
      success: true,
      policyId,
      summary,
      rulesCount: rules.length,
      rules,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Process accounting policy error:", err);

    // Try to update policy status to error if policyId is known
    try {
      const reqClone = req.clone();
      const body = await reqClone.json().catch(() => ({}));
      if (body?.policyId) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
        await serviceClient
          .from("company_accounting_policies")
          .update({
            status: "error",
            error_message: err.message || "Ismeretlen hiba történt a feldolgozás során.",
            updated_at: new Date().toISOString(),
          })
          .eq("id", body.policyId);
      }
    } catch (ignore) {
      // ignore secondary error
    }

    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
