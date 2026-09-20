import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function checkAutomationShield(req: Request): Response | null {
  const authHeader = req.headers.get("authorization") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceKey && authHeader.includes(serviceKey)) {
    return null;
  }

  const userAgent = (req.headers.get("user-agent") || "").toLowerCase();
  const clientInfo = (req.headers.get("x-client-info") || "").toLowerCase();
  const origin = req.headers.get("origin") || "";
  const referer = req.headers.get("referer") || "";

  const isScript =
    userAgent.startsWith("node") ||
    userAgent.includes("node-fetch") ||
    userAgent.includes("axios") ||
    userAgent.includes("undici") ||
    userAgent.startsWith("python") ||
    userAgent.includes("aiohttp") ||
    userAgent.includes("requests") ||
    userAgent.includes("urllib") ||
    userAgent.startsWith("curl") ||
    userAgent.startsWith("wget") ||
    userAgent.includes("postman") ||
    userAgent.includes("insomnia") ||
    userAgent.includes("httpie") ||
    userAgent.startsWith("powershell") ||
    userAgent.includes("go-http-client") ||
    clientInfo.includes("supabase-js-node");

  if (isScript) {
    return new Response(
      JSON.stringify({
        code: "AUTOMATION_BLOCKED",
        error: "A közvetlen szkript-alapú automatizáció le van tiltva a Visibill rendszerében. Kérjük használd a hivatalos webes felületet!",
        details: "Direct script automation is restricted. Please use the official Visibill web application.",
      }),
      {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  if (!origin && !referer && !userAgent.startsWith("deno")) {
    return new Response(
      JSON.stringify({
        code: "AUTOMATION_BLOCKED",
        error: "A közvetlen szkript-alapú automatizáció le van tiltva a Visibill rendszerében. Kérjük használd a hivatalos webes felületet!",
        details: "Direct script automation is restricted. Please use the official Visibill web application.",
      }),
      {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  return null;
}

interface InvoiceItemCandidate {
  key: string;
  invoiceId?: string;
  navInvoiceId?: string;
  invoiceNumber: string;
  supplierName: string;
  grossAmount: number;
  currency: string;
  lineItems: string[];
  taxCore?: string;
}

interface CategoryInfo {
  id: string;
  name: string;
  description: string | null;
}

interface AICategorizationResult {
  item_index: number;
  category_id: string | null;
  confidence: "high" | "medium" | "low";
  reason: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const automationBlock = checkAutomationShield(req);
  if (automationBlock) {
    return automationBlock;
  }

  let currentJobId: string | null = null;
  let serviceClient: any = null;

  const updateJob = async (updates: Record<string, any>) => {
    if (!currentJobId || !serviceClient) return;
    try {
      await serviceClient
        .from("auto_categorize_jobs")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", currentJobId);
    } catch (e) {
      console.warn("[AUTO-CATEGORIZE] Failed to update job:", e);
    }
  };

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

    const token = authHeader.replace("Bearer ", "").trim();
    const isServiceRole = token === supabaseServiceKey;

    const body = await req.json().catch(() => ({}));
    const { companyId, limit = 100, jobId, userId } = body as {
      companyId?: string;
      limit?: number;
      jobId?: string;
      userId?: string;
    };

    let effectiveUserId: string | null = null;

    if (isServiceRole) {
      // System / cron background call (e.g. from nav-auto-sync)
      effectiveUserId = userId || null;
    } else {
      const anonClient = createClient(supabaseUrl, supabaseAnonKey);
      const { data: { user }, error: authError } = await anonClient.auth.getUser(token);

      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      effectiveUserId = user.id;
    }

    if (!companyId) {
      return new Response(JSON.stringify({ error: "companyId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    currentJobId = jobId || null;

    // 0. Concurrency guard: Check if an active job is already running in the last 5 minutes
    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: existingActiveJobs } = await serviceClient
      .from("auto_categorize_jobs")
      .select("*")
      .eq("company_id", companyId)
      .in("status", ["pending", "processing"])
      .gt("created_at", fiveMinsAgo)
      .order("created_at", { ascending: false })
      .limit(1);

    if (existingActiveJobs && existingActiveJobs.length > 0) {
      const activeJob = existingActiveJobs[0];
      if (!currentJobId || currentJobId !== activeJob.id) {
        console.log(`[AUTO-CATEGORIZE] Active job already running for company ${companyId}: ${activeJob.id}`);
        return new Response(
          JSON.stringify({
            success: true,
            jobId: activeJob.id,
            status: activeJob.status,
            totalInvoices: activeJob.total_invoices,
            processedCount: activeJob.processed_invoices,
            categorizedCount: activeJob.categorized_count,
            message: "Már folyamatban van egy automatikus kategorizálási feladat ennél a cégnél.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // If no jobId was passed by the client, create one in the database
    if (!currentJobId) {
      const { data: newJob, error: createJobErr } = await serviceClient
        .from("auto_categorize_jobs")
        .insert({
          company_id: companyId,
          user_id: effectiveUserId,
          status: "pending",
          total_invoices: 0,
          processed_invoices: 0,
          categorized_count: 0,
        })
        .select("id")
        .single();

      if (!createJobErr && newJob?.id) {
        currentJobId = newJob.id;
      }
    }

    // 1. Fetch company categories
    const { data: categoriesData, error: catError } = await serviceClient
      .from("categories")
      .select("id, name, description")
      .eq("company_id", companyId);

    if (catError) {
      await updateJob({ status: "error", error_message: "Failed to fetch categories: " + catError.message });
      return new Response(JSON.stringify({ error: "Failed to fetch categories", details: catError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const categories: CategoryInfo[] = categoriesData || [];
    if (categories.length === 0) {
      await updateJob({
        status: "completed",
        total_invoices: 0,
        processed_invoices: 0,
        categorized_count: 0,
        completed_at: new Date().toISOString(),
      });
      return new Response(
        JSON.stringify({
          success: true,
          jobId: currentJobId,
          processedCount: 0,
          categorizedCount: 0,
          uncategorizedCount: 0,
          message: "A cégnek nincsenek kategóriái létrehozva.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validCategoryIds = new Set(categories.map((c) => c.id));

    // 2. Fetch uncategorized INBOUND invoices from both tables
    const maxItems = Math.min(Math.max(1, limit), 200);

    const [uploadedRes, navRes] = await Promise.all([
      serviceClient
        .from("invoices")
        .select(`
          id,
          bizonylatsorszam,
          elado_nev,
          elado_vat_id,
          brutto_vegosszeg,
          penznem,
          invoice_items (
            line_description,
            net_amount
          )
        `)
        .eq("company_id", companyId)
        .eq("invoice_direction", "INBOUND")
        .is("category_id", null)
        .limit(maxItems),

      serviceClient
        .from("nav_invoices")
        .select(`
          id,
          invoice_number,
          supplier_name,
          supplier_tax_number,
          invoice_gross_amount,
          currency,
          nav_invoice_items (
            line_description,
            product_code,
            net_amount
          )
        `)
        .eq("company_id", companyId)
        .eq("invoice_direction", "INBOUND")
        .is("category_id", null)
        .limit(maxItems),
    ]);

    if (uploadedRes.error) {
      console.error("[AUTO-CATEGORIZE] Failed to fetch uploaded invoices:", uploadedRes.error);
    }
    if (navRes.error) {
      console.error("[AUTO-CATEGORIZE] Failed to fetch NAV invoices:", navRes.error);
    }

    // 3. Merge & Deduplicate candidates by invoice number / id
    const candidateMap = new Map<string, InvoiceItemCandidate>();

    // Add uploaded invoices
    for (const inv of uploadedRes.data || []) {
      const invNum = (inv.bizonylatsorszam || "").trim();
      const key = invNum.toLowerCase() || `up_${inv.id}`;
      const lineItems = (inv.invoice_items || [])
        .map((i: any) => (i.line_description || "").trim())
        .filter((desc: string) => desc.length > 0)
        .slice(0, 10);

      const rawTax = (inv.elado_vat_id || "").replace(/[^0-9]/g, "");
      const taxCore = rawTax.length >= 8 ? rawTax.slice(0, 8) : undefined;

      candidateMap.set(key, {
        key,
        invoiceId: inv.id,
        invoiceNumber: invNum,
        supplierName: (inv.elado_nev || "").trim() || "(ismeretlen szállító)",
        grossAmount: parseFloat(inv.brutto_vegosszeg) || 0,
        currency: inv.penznem || "HUF",
        lineItems,
        taxCore,
      });
    }

    // Add / merge NAV invoices
    for (const nav of navRes.data || []) {
      const invNum = (nav.invoice_number || "").trim();
      const key = invNum.toLowerCase() || `nav_${nav.id}`;
      const navItems = (nav.nav_invoice_items || [])
        .map((i: any) => (i.line_description || "").trim())
        .filter((desc: string) => desc.length > 0)
        .slice(0, 10);

      const rawNavTax = (nav.supplier_tax_number || "").replace(/[^0-9]/g, "");
      const navTaxCore = rawNavTax.length >= 8 ? rawNavTax.slice(0, 8) : undefined;

      const existing = candidateMap.get(key);
      if (existing) {
        existing.navInvoiceId = nav.id;
        if (existing.lineItems.length === 0 && navItems.length > 0) {
          existing.lineItems = navItems;
        }
        if (!existing.supplierName || existing.supplierName === "(ismeretlen szállító)") {
          existing.supplierName = (nav.supplier_name || "").trim() || existing.supplierName;
        }
        if (!existing.taxCore && navTaxCore) {
          existing.taxCore = navTaxCore;
        }
      } else {
        candidateMap.set(key, {
          key,
          navInvoiceId: nav.id,
          invoiceNumber: invNum,
          supplierName: (nav.supplier_name || "").trim() || "(ismeretlen szállító)",
          grossAmount: parseFloat(nav.invoice_gross_amount) || 0,
          currency: nav.currency || "HUF",
          lineItems: navItems,
          taxCore: navTaxCore,
        });
      }
    }

    const candidates = Array.from(candidateMap.values());
    if (candidates.length === 0) {
      await updateJob({
        status: "completed",
        total_invoices: 0,
        processed_invoices: 0,
        categorized_count: 0,
        completed_at: new Date().toISOString(),
      });
      return new Response(
        JSON.stringify({
          success: true,
          jobId: currentJobId,
          processedCount: 0,
          categorizedCount: 0,
          uncategorizedCount: 0,
          message: "Minden bejövő számla rendelkezik már kategóriával.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3.5 Partner History Majority Pre-Pass
    // In accordance with user rules: If a partner already has established invoices at this company,
    // and there is a strict majority category (top_count > second_count), auto-assign it directly.
    // Ties (top_count == second_count) and unknown partners (0 history) are forwarded to the AI.
    const { data: partnerRules, error: partnerRulesErr } = await serviceClient
      .rpc("get_company_partner_majority_categories", { p_company_id: companyId });

    if (partnerRulesErr) {
      console.warn("[AUTO-CATEGORIZE] Failed to fetch partner majority rules via RPC:", partnerRulesErr);
    }

    const partnerCategoryMap = new Map<string, string>();
    const partnerTaxCoreMap = new Map<string, string>();

    if (!partnerRulesErr && Array.isArray(partnerRules)) {
      for (const row of partnerRules) {
        if (row.category_id && validCategoryIds.has(row.category_id)) {
          if (row.supplier_name) {
            partnerCategoryMap.set(row.supplier_name.trim().toLowerCase(), row.category_id);
          }
          if (row.tax_core) {
            partnerTaxCoreMap.set(row.tax_core.trim(), row.category_id);
          }
        }
      }
    }

    const aiCandidates: InvoiceItemCandidate[] = [];
    const ruleCategorizedResults: { candidate: InvoiceItemCandidate; category_id: string; reason: string }[] = [];

    for (const candidate of candidates) {
      const normSupplier = (candidate.supplierName || "").trim().toLowerCase();
      let historicalCatId = normSupplier ? partnerCategoryMap.get(normSupplier) : undefined;
      let matchReason = "Partner korábbi számláinak többsége alapján automatikusan besorolva";

      // If exact partner name didn't match, check if 8-digit Hungarian tax core matches
      if (!historicalCatId && candidate.taxCore) {
        historicalCatId = partnerTaxCoreMap.get(candidate.taxCore);
        if (historicalCatId) {
          matchReason = `Partner adószám törzsszám (${candidate.taxCore}) többségi szabálya alapján automatikusan besorolva`;
        }
      }

      if (historicalCatId) {
        ruleCategorizedResults.push({
          candidate,
          category_id: historicalCatId,
          reason: matchReason,
        });
      } else {
        aiCandidates.push(candidate);
      }
    }

    console.log(
      `[AUTO-CATEGORIZE] Pre-pass completed: ${ruleCategorizedResults.length} invoices resolved via partner history majority, ${aiCandidates.length} passed to AI.`
    );

    let aiCategorizedCount = 0;
    let lastAiError: string | null = null;
    const updatesInvoices: { id: string; category_id: string }[] = [];
    const updatesNavInvoices: { id: string; category_id: string }[] = [];
    const updatesByInvoiceNumber: { invoice_number: string; category_id: string }[] = [];

    // Push partner-history rule-based matches
    for (const item of ruleCategorizedResults) {
      if (item.candidate.invoiceId) {
        updatesInvoices.push({ id: item.candidate.invoiceId, category_id: item.category_id });
      }
      if (item.candidate.navInvoiceId) {
        updatesNavInvoices.push({ id: item.candidate.navInvoiceId, category_id: item.category_id });
      }
      if (item.candidate.invoiceNumber) {
        updatesByInvoiceNumber.push({ invoice_number: item.candidate.invoiceNumber, category_id: item.category_id });
      }
    }

    // Signal processing state with total candidate count and already resolved rule matches
    await updateJob({
      status: "processing",
      total_invoices: candidates.length,
      processed_invoices: ruleCategorizedResults.length,
      categorized_count: ruleCategorizedResults.length,
    });

    // 4. Setup AI Client ONLY if there are candidates requiring AI decision (ties or new partners)
    if (aiCandidates.length > 0) {
      const deepseekKey = Deno.env.get("DEEPSEEK_API_KEY");
      const openaiKey = Deno.env.get("OPENAI_API_KEY");

      if (!openaiKey && !deepseekKey) {
        // If some invoices were categorized by partner rules, don't fail completely; log warning
        if (ruleCategorizedResults.length > 0) {
          lastAiError = "Nincs konfigurálva AI kulcs a bizonytalan/új partnerek besorolásához.";
        } else {
          await updateJob({ status: "error", error_message: "Nincs konfigurálva mesterséges intelligencia API kulcs." });
          return new Response(
            JSON.stringify({ error: "Nincs konfigurálva mesterséges intelligencia API kulcs (OPENAI_API_KEY vagy DEEPSEEK_API_KEY)." }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        let apiUrl = "https://api.openai.com/v1/chat/completions";
        let apiModel = Deno.env.get("OPENAI_CHAT_MODEL") || "gpt-4o-mini";
        let apiKey = openaiKey || "";

        if (!openaiKey && deepseekKey) {
          apiUrl = "https://api.deepseek.com/chat/completions";
          apiModel = "deepseek-chat";
          apiKey = deepseekKey;
        }

        // Format categories for prompt
        const categoriesPromptText = categories
          .map((c) => `- ID: "${c.id}" | Név: "${c.name}"${c.description ? ` | Leírás: ${c.description}` : ""}`)
          .join("\n");

        const systemPrompt = `Te egy precíz magyar könyvelői és pénzügyi asszisztens vagy.
A feladatod bejövő költségszámlák besorolása a megadott vállalati kiadási kategóriák egyikébe.

ELÉRHETŐ KATEGÓRIÁK:
${categoriesPromptText}

SZABÁLYOK:
1. Csak a fenti kategória ID-k közül válassz!
2. A döntést a szállító neve és a számlán szereplő tételsorok megnevezése alapján hozd meg.
3. Megbízhatósági szintek:
   - "high": Egyértelmű, biztos illeszkedés (pl. Vízművek -> Közüzemi díjak, Google Cloud -> IT és szoftver).
   - "medium": Valószínű illeszkedés a partner vagy a tételek alapján.
   - "low": Bizonytalan vagy gyenge egyezés. Ebben az esetben a category_id legyen NULL!
4. Ha a számla egyik kategóriába sem illik bele pontosan, vagy nem egyértelmű, a category_id KÖTELEZŐEN NULL legyen!
5. NE találgass! Inkább hagyd üresen (null), mint téves kategóriát adj!
6. KIZÁRÓLAG érvényes JSON tömböt adj vissza a válaszban, semmi egyéb magyarázó szöveget vagy markdown blokkot ne írj!

VÁLASZ FORMÁTUM:
[
  {
    "item_index": 0,
    "category_id": "<uuid>" | null,
    "confidence": "high" | "medium" | "low",
    "reason": "Rövid indoklás magyarul (max 1 mondat)"
  }
]`;

        // 5. Batch processing (20 invoices per call, executed in parallel)
        const BATCH_SIZE = 20;
        const batchList: InvoiceItemCandidate[][] = [];
        for (let i = 0; i < aiCandidates.length; i += BATCH_SIZE) {
          batchList.push(aiCandidates.slice(i, i + BATCH_SIZE));
        }

        console.log(`[AUTO-CATEGORIZE] Starting parallel AI processing of ${aiCandidates.length} candidates in ${batchList.length} batches.`);

        let processedAiSoFar = 0;

        const fetchWithRetry = async (url: string, options: RequestInit, maxRetries = 3): Promise<Response> => {
          let attempt = 0;
          while (attempt < maxRetries) {
            try {
              const res = await fetch(url, options);
              if ((res.status === 429 || res.status >= 500) && attempt < maxRetries - 1) {
                attempt++;
                const backoffMs = Math.pow(2, attempt) * 600 + Math.random() * 300;
                console.warn(`[AUTO-CATEGORIZE] AI request returned HTTP ${res.status}, retrying attempt ${attempt}/${maxRetries} in ${Math.round(backoffMs)}ms...`);
                await new Promise((r) => setTimeout(r, backoffMs));
                continue;
              }
              return res;
            } catch (netErr: any) {
              if (attempt < maxRetries - 1) {
                attempt++;
                const backoffMs = Math.pow(2, attempt) * 600 + Math.random() * 300;
                console.warn(`[AUTO-CATEGORIZE] Network error (${netErr?.message}), retrying attempt ${attempt}/${maxRetries} in ${Math.round(backoffMs)}ms...`);
                await new Promise((r) => setTimeout(r, backoffMs));
                continue;
              }
              throw netErr;
            }
          }
          return fetch(url, options);
        };

        const batchPromises = batchList.map(async (batch, batchIdx) => {
          try {
            const userPromptInvoices = batch.map((c, idx) => ({
              index: idx,
              partner: c.supplierName,
              osszeg: `${c.grossAmount} ${c.currency}`,
              tetelek: c.lineItems.length > 0 ? c.lineItems.join(", ") : "Nincsenek részletes tételek",
            }));

            const response = await fetchWithRetry(apiUrl, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: apiModel,
                messages: [
                  { role: "system", content: systemPrompt },
                  {
                    role: "user",
                    content: `Kérlek kategorizáld a következő ${batch.length} bejövő számlát:\n${JSON.stringify(userPromptInvoices, null, 2)}`,
                  },
                ],
              }),
            });

            if (!response.ok) {
              const errBody = await response.text();
              console.error(`[AUTO-CATEGORIZE] Batch ${batchIdx + 1} AI API error: ${response.status} - ${errBody}`);
              processedAiSoFar += batch.length;
              await updateJob({
                processed_invoices: Math.min(ruleCategorizedResults.length + processedAiSoFar, candidates.length),
              });
              return { error: `AI API hiba (${response.status})`, results: [] };
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content || "";

            let cleanedJson = content.trim();
            if (cleanedJson.startsWith("```json")) {
              cleanedJson = cleanedJson.substring(7);
            } else if (cleanedJson.startsWith("```")) {
              cleanedJson = cleanedJson.substring(3);
            }
            if (cleanedJson.endsWith("```")) {
              cleanedJson = cleanedJson.substring(0, cleanedJson.length - 3);
            }
            cleanedJson = cleanedJson.trim();

            let parsed: AICategorizationResult[] = [];
            try {
              parsed = JSON.parse(cleanedJson);
            } catch (pErr) {
              console.error(`[AUTO-CATEGORIZE] Batch ${batchIdx + 1} JSON parse error:`, pErr, "Raw text:", content);
              processedAiSoFar += batch.length;
              await updateJob({
                processed_invoices: Math.min(ruleCategorizedResults.length + processedAiSoFar, candidates.length),
              });
              return { error: "Érvénytelen AI válaszformátum", results: [] };
            }

            if (!Array.isArray(parsed)) {
              console.error(`[AUTO-CATEGORIZE] Batch ${batchIdx + 1} Expected array, got:`, typeof parsed);
              processedAiSoFar += batch.length;
              await updateJob({
                processed_invoices: Math.min(ruleCategorizedResults.length + processedAiSoFar, candidates.length),
              });
              return { error: "Érvénytelen AI válaszformátum", results: [] };
            }

            const batchResults: { candidate: InvoiceItemCandidate; category_id: string; reason: string }[] = [];
            for (const item of parsed) {
              const candidate = batch[item.item_index];
              if (!candidate) continue;

              if (
                item.category_id &&
                validCategoryIds.has(item.category_id) &&
                (item.confidence === "high" || item.confidence === "medium")
              ) {
                batchResults.push({
                  candidate,
                  category_id: item.category_id,
                  reason: item.reason,
                });
              }
            }

            // Increment progress count and update job record in real-time
            processedAiSoFar += batch.length;
            await updateJob({
              processed_invoices: Math.min(ruleCategorizedResults.length + processedAiSoFar, candidates.length),
              categorized_count: ruleCategorizedResults.length + aiCategorizedCount + batchResults.length,
            });

            console.log(`[AUTO-CATEGORIZE] Batch ${batchIdx + 1}/${batchList.length} completed: ${batchResults.length}/${batch.length} categorized.`);
            return { results: batchResults };
          } catch (batchErr: any) {
            console.error(`[AUTO-CATEGORIZE] Batch ${batchIdx + 1} exception:`, batchErr);
            processedAiSoFar += batch.length;
            await updateJob({
              processed_invoices: Math.min(ruleCategorizedResults.length + processedAiSoFar, candidates.length),
            });
            return { error: batchErr?.message || "Batch hiba", results: [] };
          }
        });

        const batchExecutionResults = await Promise.all(batchPromises);

        for (const res of batchExecutionResults) {
          if (res.error && !lastAiError) {
            lastAiError = res.error;
          }
          for (const item of res.results) {
            aiCategorizedCount++;
            if (item.candidate.invoiceId) {
              updatesInvoices.push({ id: item.candidate.invoiceId, category_id: item.category_id });
            }
            if (item.candidate.navInvoiceId) {
              updatesNavInvoices.push({ id: item.candidate.navInvoiceId, category_id: item.category_id });
            }
            if (item.candidate.invoiceNumber) {
              updatesByInvoiceNumber.push({ invoice_number: item.candidate.invoiceNumber, category_id: item.category_id });
            }
          }
        }
      }
    }

    const totalCategorized = ruleCategorizedResults.length + aiCategorizedCount;

    // 6. Persist updates in database
    const updatePromises: Promise<any>[] = [];

    // Explicit ID updates for uploaded invoices
    for (const u of updatesInvoices) {
      updatePromises.push(
        serviceClient
          .from("invoices")
          .update({ category_id: u.category_id })
          .eq("id", u.id)
          .eq("company_id", companyId)
          .is("category_id", null)
      );
    }

    // Explicit ID updates for NAV invoices
    for (const u of updatesNavInvoices) {
      updatePromises.push(
        serviceClient
          .from("nav_invoices")
          .update({ category_id: u.category_id })
          .eq("id", u.id)
          .eq("company_id", companyId)
          .is("category_id", null)
      );
    }

    // Cross-table synchronization by invoice number
    for (const u of updatesByInvoiceNumber) {
      updatePromises.push(
        serviceClient
          .from("invoices")
          .update({ category_id: u.category_id })
          .eq("bizonylatsorszam", u.invoice_number)
          .eq("company_id", companyId)
          .is("category_id", null)
      );
      updatePromises.push(
        serviceClient
          .from("nav_invoices")
          .update({ category_id: u.category_id })
          .eq("invoice_number", u.invoice_number)
          .eq("company_id", companyId)
          .is("category_id", null)
      );
    }

    await Promise.allSettled(updatePromises);

    console.log(
      `[AUTO-CATEGORIZE] Done: ${candidates.length} total, ${ruleCategorizedResults.length} rule-categorized, ${aiCategorizedCount} AI-categorized (${totalCategorized} total categorized).`
    );

    let statusMessage = undefined;
    if (totalCategorized === 0 && lastAiError) {
      statusMessage = lastAiError;
    } else if (totalCategorized === 0) {
      statusMessage = "A számlák feldolgozásra kerültek, de az AI megbízhatósági szintje alapján egyik kategóriába sem volt egyértelmű besorolás.";
    }

    // Mark job as completed
    await updateJob({
      status: "completed",
      total_invoices: candidates.length,
      processed_invoices: candidates.length,
      categorized_count: totalCategorized,
      completed_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        jobId: currentJobId,
        processedCount: candidates.length,
        categorizedCount: totalCategorized,
        ruleCategorizedCount: ruleCategorizedResults.length,
        aiCategorizedCount,
        uncategorizedCount: candidates.length - totalCategorized,
        message: statusMessage,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[AUTO-CATEGORIZE] Fatal error:", err);
    await updateJob({
      status: "error",
      error_message: err.message || "Ismeretlen hiba történt az automatikus kategorizálás során.",
      completed_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ error: err.message || "Ismeretlen hiba történt az automatikus kategorizálás során." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
