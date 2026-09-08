import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Te az eaisyBill és eaisyBooks rendszerek hivatalos, intelligens szakértő AI asszisztense vagy. A feladatod, hogy támogasd a felhasználókat és a könyvelőket a mindennapi munkájukban, kérdéseik megválaszolásában és a szoftver funkcióinak hatékony használatában.

Szakterületed és feladataid:
1. eaisyBill & eaisyBooks funkcionális támogatás:
   - Bizonylatok feltöltése, mesterséges intelligencia (OCR) felismerés, számlák kezelése és szűrése
   - Banki tranzakciók szinkronizációja, automatikus és kézi párosítás, banki egyenlegek
   - NAV Online Számla automatikus szinkronizáció, technikai felhasználó bekötése és ellenőrzése
   - ÁFA analitika, Pro Rata arányosítás, 65M lapok és NAV ÁNYK 2665 export
   - Bérszámfejtési folyamat, dolgozói törzsadatok, bérpótlékok és 2608-as havi ÁNYK bevallás
   - Egyéni vállalkozói (EV) modulok: átalányadó, tételes költség (VSZJA), KATA, tárgyi eszköz értékcsökkenés
   - Kettős könyvelés, számlatükör, naplófőkönyv, automata könyvelési szabályok és AI promptok
   - Pénztárkezelés (házipénztár), projektek és költséghelyek, partnertörzs, vezetői riportok és hibajegyek

2. Magyar számviteli, adó- és munkajog:
   - Mt., Szja tv., Tbj., Szocho tv., Art., Áfa tv., Kiva tv., Tao tv., Efo tv.
   - 2026-os adóév szabályai:
     * Minimálbér: 322 800 Ft, Garantált bérminimum: 382 200 Ft
     * Családi kedvezmény (duplázott): 1 eltartott: 20 000 Ft, 2 eltartott: 40 000 Ft/fő, 3+: 99 000 Ft/fő
     * Adókulcsok: SZJA 15%, TB járulék 18,5%, SZOCHO 13%, KIVA 10%, TAO 9%

3. Tudástár-alapú válaszadási szabályok (RAG Grounding):
   - A rendszer funkcióival, menüpontjaival és munkafolyamataival kapcsolatos kérdésekben ELSŐSORBAN az alább mellékelt 'HIVATALOS EAISYBILL / EAISYBOOKS TUDÁSTÁR' cikkekre támaszkodj!
   - Amikor elmagyarázod egy funkció elérését, kizárólag a valós, felületen megjelenő magyar menü- és modulnevekre hivatkozz természetes szövegezéssel (például: "a bal oldali menüben a Bizonylatok menüpontban", "a Főkönyv modulban", "a Beállítások menüben")!
   - SZIGORÚ TILTÁS: SOHA NE használj technikai URL útvonalakat (pl. /eaisybooks/prompts, /invoices, /settings), és SOHA NE generálj mesterkélt "Ugrás a funkcióhoz: ..." sablonblokkokat vagy zárójeles technikai elérési utakat!
   - Ha a kérdéshez kapcsolódik tudástári cikk, a lépéseket logikus sorrendben, a tényleges gombok és mezők nevével vezesd le (pl. "Kattints az Új szabály hozzáadása gombra").
   - Ha a keresett témáról nincs információ a mellékelt tudástári cikkekben, de általános adózási vagy szakmai kérdés, válaszolj a szakmai ismereteid alapján a jogszabályi helyek megjelölésével. Ha rendszerspecifikus funkciót hiányolnak, jelezd udvariasan, hogy a bal oldali menü Tudástár pontjában böngészhetik a teljes dokumentációt, vagy a Hibajegyek menüpontban közvetlenül a támogatási csapathoz fordulhatnak.

Formázási szabályok:
- Mindig magyarul válaszolj, közvetlen, segítőkész és precíz szakmai hangnemben.
- Használj áttekinthető markdown formázást (félkövér kiemelések, pontokba szedett listák, strukturált lépések).
- Légy tömör és lényegretörő (maximum 2-4 jól strukturált bekezdés vagy vázlatpontos összefoglaló). A felhasználók gyors és egyértelmű útmutatást várnak.
- Jogi és adózási kérdések esetén azonnal a közvetlen ténnyel kezdj (pl. a pontos életkori határ, jövedelmi plafon, határidő), majd röviden add meg a vonatkozó jogszabályi hivatkozást (pl. Szja tv. 29/D. §). Kerüld a feleslegesen hosszú bevezetőket vagy terjengős körmondatokat.`;

/**
 * Accounty & eaisyBill AI Chat Edge Function with Knowledge Base RAG & Live Business Data Layer
 */
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 3600_000; // 1 hour
const userRequestCounts = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = userRequestCounts.get(userId);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    userRequestCounts.set(userId, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
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

    // Rate limit check: 30 requests per hour per user
    if (!checkRateLimit(user.id)) {
      return new Response(
        JSON.stringify({ error: 'Túl sok kérés. Kérlek próbáld újra később (max 30 üzenet/óra).' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse body
    const { messages, context, companyId, userCompanies } = await req.json();
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new Error('Messages array is required');
    }

    let targetCompanyId = companyId || context?.companyId || null;

    // 1. If no company explicitly provided, check if the user specifically named one of their companies in the chat
    if (!targetCompanyId && Array.isArray(userCompanies) && userCompanies.length > 0) {
      const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user')?.content?.toLowerCase() || '';
      for (const comp of userCompanies) {
        const compName = (comp.name || '').toLowerCase().trim();
        if (compName && compName.length >= 3 && lastUserMsg.includes(compName)) {
          targetCompanyId = comp.id;
          break;
        }
      }
    }

    // 2. If user only belongs to 1 company in total, no disambiguation needed
    if (!targetCompanyId && Array.isArray(userCompanies) && userCompanies.length === 1) {
      targetCompanyId = userCompanies[0].id;
    }

    const deepseekKey = Deno.env.get('DEEPSEEK_API_KEY');
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    const customChatModel = Deno.env.get('OPENAI_CHAT_MODEL') || Deno.env.get('AI_CHAT_MODEL');

    if (!deepseekKey && !openaiKey) {
      return new Response(
        JSON.stringify({ error: 'No API key configured (neither DEEPSEEK_API_KEY nor OPENAI_API_KEY)' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let apiUrl = "https://api.openai.com/v1/chat/completions";
    let apiModel = customChatModel || "gpt-4o-mini";
    let apiKey = openaiKey || "";

    if (deepseekKey && !customChatModel) {
      apiUrl = "https://api.deepseek.com/chat/completions";
      apiModel = "deepseek-chat";
      apiKey = deepseekKey;
    } else if (customChatModel && customChatModel.toLowerCase().includes("deepseek")) {
      apiUrl = "https://api.deepseek.com/chat/completions";
      apiModel = customChatModel;
      apiKey = deepseekKey || openaiKey || "";
    }

    // ── 1. Live Company & Financial Context (Snapshot) ──
    let liveCompanyContextText = '';
    if (targetCompanyId) {
      try {
        const { data: liveCtx, error: liveErr } = await supabaseClient.rpc(
          'get_company_live_ai_context',
          {
            p_company_id: targetCompanyId,
            p_user_id: user.id,
          }
        );

        if (!liveErr && liveCtx) {
          const comp = liveCtx.company || {};
          const inbound = liveCtx.unpaid_inbound || {};
          const outbound = liveCtx.unpaid_outbound || {};
          const bank = liveCtx.bank_summary || {};

          const inboundTotalsStr = (inbound.totals_by_currency || [])
            .map((t: any) => `${Number(t.total_gross || 0).toLocaleString('hu-HU')} ${t.currency}`)
            .join(', ') || '0 Ft';

          const outboundTotalsStr = (outbound.totals_by_currency || [])
            .map((t: any) => `${Number(t.total_gross || 0).toLocaleString('hu-HU')} ${t.currency}`)
            .join(', ') || '0 Ft';

          const inboundItemsStr = (inbound.top_items || []).map((it: any) => 
            `  • ${it.partner_name} | Számlaszám: ${it.invoice_number} | Bruttó: ${Number(it.gross_amount || 0).toLocaleString('hu-HU')} ${it.currency} | Határidő: ${it.due_date || 'Nincs'} (${it.status_text})`
          ).join('\n');

          const outboundItemsStr = (outbound.top_items || []).map((it: any) => 
            `  • ${it.partner_name} | Számlaszám: ${it.invoice_number} | Bruttó: ${Number(it.gross_amount || 0).toLocaleString('hu-HU')} ${it.currency} | Határidő: ${it.due_date || 'Nincs'} (${it.status_text})`
          ).join('\n');

          liveCompanyContextText = '\n\n═══════════════════════════════════════════════════════════════\n' +
            `AKTUÁLIS CÉGINFORMÁCIÓK ÉS ÉLŐ PÉNZÜGYI ADATOK (${comp.name || 'Kiválasztott cég'})\n` +
            '═══════════════════════════════════════════════════════════════\n' +
            `Cég neve: ${comp.name || '-'}\n` +
            `Adószáma: ${comp.tax_number || '-'}\n` +
            `Székhelye: ${comp.address || '-'}\n\n` +
            `[NYITOTT (KIFIZETETLEN) BEJÖVŐ SZÁLLÍTÓI SZÁMLÁK - TARTOZÁSOK]:\n` +
            `Összesen: ${inbound.total_count ?? 0} db nyitott számla | Összesített bruttó tartozás: ${inboundTotalsStr}\n` +
            (inbound.overdue_count > 0 ? `⚠️ Ebből LEJÁRT határidejű tartozás: ${inbound.overdue_count} db!\n` : 'Lejárt tartozás nincs.\n') +
            (inboundItemsStr ? `Legfontosabb / legközelebbi nyitott tételek:\n${inboundItemsStr}\n\n` : '\n') +
            `[NYITOTT (KIFIZETETLEN) KIMENŐ VEVŐI SZÁMLÁK - KINTLÉVŐSÉGEK]:\n` +
            `Összesen: ${outbound.total_count ?? 0} db kintlévőség | Összesített bruttó kintlévőség: ${outboundTotalsStr}\n` +
            (outbound.overdue_count > 0 ? `⚠️ Ebből LEJÁRT határidejű kintlévőség: ${outbound.overdue_count} db!\n` : 'Lejárt kintlévőség nincs.\n') +
            (outboundItemsStr ? `Legfontosabb nyitott kintlévőségek:\n${outboundItemsStr}\n\n` : '\n') +
            `[BANKI TRANZAKCIÓK]:\n` +
            `Párosítatlan banki tranzakciók száma: ${bank.unmatched_transactions_count ?? 0} db\n` +
            `Utolsó tranzakció dátuma: ${bank.last_transaction_date || 'Nincs rögzített adat'}\n` +
            `Adatok lekérésének ideje: ${liveCtx.as_of_date || 'mai nap'}\n\n` +
            `INSTRUKCIÓ AZ ÉLŐ ADATOKHOZ:\n` +
            `- Amikor a felhasználó a számláiról, tartozásairól, kintlévőségeiről vagy pénzügyi állapotáról kérdez, MINDIG a fenti TÉNYADATOKRA támaszkodva adj pontos, konkrét számokat és összegeket!\n` +
            `- Ha van lejárt tartozás vagy hamarosan lejáró tétel, hívd fel rá a figyelmét!\n`;
        } else if (liveErr) {
          console.warn('[AI-CHAT] Live context retrieval warning:', liveErr.message);
        }
      } catch (liveEx) {
        console.error('[AI-CHAT] Live context retrieval exception:', liveEx);
      }
    } else if (Array.isArray(userCompanies) && userCompanies.length > 0) {
      const companiesListStr = userCompanies.map((c: any) => `- ${c.name} (Adószám: ${c.tax_number || 'N/A'})`).join('\n');
      liveCompanyContextText = '\n\n═══════════════════════════════════════════════════════════════\n' +
        'FELHASZNÁLÓ CÉGEI (A BESZÉLGETÉSBEN MÉG NINCS KIVÁLASZTVA KONKRÉT CÉG)\n' +
        '═══════════════════════════════════════════════════════════════\n' +
        'A felhasználó az alábbi cégekhez van hozzárendelve a rendszerben:\n' +
        `${companiesListStr}\n\n` +
        'SZIGORÚ UTASÍTÁS ÉS SZABÁLY:\n' +
        'Amikor a felhasználó a saját vagy cége konkrét pénzügyi adataira, számláira, nyitott tételeire, egyenlegére kérdez rá (például: "Hány számla van a cégemben?", "Hány nyitott számlám van?", "Milyen számláim vannak?"), ' +
        'és a kérdésből nem derül ki egyértelműen, hogy melyik cégre gondol:\n' +
        '1. NE találj ki semmilyen számot vagy adatot, és NE válassz helyette véletlenszerűen céget!\n' +
        '2. A válaszod pontosan az alábbi kérdés legyen (vagy a kérdés kontextusához illeszkedő rövid, közvetlen mondat):\n' +
        '   "Kérlek válaszd ki, hogy melyik céghez szeretnéd tudni a számláid számát:" (vagy: "Kérlek válaszd ki, hogy melyik cég adataira vagy kíváncsi:")\n' +
        '3. A válaszod legvégére KÖTELEZŐEN fűzd hozzá a cégek választó tokenjeit egy sorban, pontosan ebben a formátumban:\n' +
        userCompanies.map((c: any) => `<<COMPANY_SELECT:${c.id}|${c.name}>>`).join(' ') + '\n' +
        'A felhasználói felületen ezek a tokenek automatikusan interaktív, kattintható gombokká alakulnak!\n';
    }

    // ── 2. RAG Knowledge Base Retrieval ──
    let kbContextText = '';
    try {
      const lastUserMessage = [...messages].reverse().find((m: any) => m.role === 'user')?.content || '';
      const pagePath = context?.page ? String(context.page).trim() : null;

      if (lastUserMessage || pagePath) {
        const querySnippet = lastUserMessage.trim().slice(0, 300);
        const { data: kbArticles, error: kbError } = await supabaseClient.rpc(
          'search_knowledge_base',
          {
            search_query: querySnippet || null,
            page_path: pagePath,
            target_category: null,
            match_limit: 5,
          }
        );

        if (!kbError && Array.isArray(kbArticles) && kbArticles.length > 0) {
          const relevant = kbArticles.filter((a: any) => {
            const isCurrentPage = pagePath && a.menu_path && (a.menu_path === pagePath || (a.menu_path !== '/' && pagePath.startsWith(a.menu_path)));
            return isCurrentPage || (a.rank ?? 0) >= 0.15;
          });

          if (relevant.length > 0) {
            kbContextText = '\n\n═══════════════════════════════════════════════════════════════\n' +
              'HIVATALOS EAISYBILL / EAISYBOOKS TUDÁSTÁR (RELEVÁNS CIKKEK)\n' +
              '═══════════════════════════════════════════════════════════════\n' +
              relevant.map((a: any, idx: number) => {
                const cleanContent = (a.content || '').slice(0, 1800);
                return `[Tudástár Téma #${idx + 1}: ${a.title}]\n` +
                  `Összefoglaló: ${a.summary || ''}\n` +
                  `Leírás:\n${cleanContent}`;
              }).join('\n\n---\n\n');
          }
        } else if (kbError) {
          console.warn('[AI-CHAT] Knowledge base retrieval warning:', kbError.message);
        }
      }
    } catch (kbErr) {
      console.error('[AI-CHAT] Knowledge base retrieval exception:', kbErr);
    }

    // Build context-aware system prompt
    let systemPrompt = SYSTEM_PROMPT;
    if (context?.clientName) {
      systemPrompt += `\n\nAz aktuális ügyfél: ${context.clientName}`;
    }
    if (context?.page) {
      systemPrompt += `\nAz aktuális felület / oldal: ${context.page}`;
    }
    if (liveCompanyContextText) {
      systemPrompt += liveCompanyContextText;
    }
    if (kbContextText) {
      systemPrompt += kbContextText;
    }

    // Check model capabilities
    const isReasoningModel = apiModel.startsWith('o1') || apiModel.startsWith('o3');
    const isFixedTemperatureModel = isReasoningModel || apiModel.startsWith('gpt-5');
    const useMaxCompletionTokens = isFixedTemperatureModel || apiModel.startsWith('gpt-4.5');

    // ── 3. Tool Calling Setup (Invoice Search) ──
    // Only offer search_invoices tool if user query actually pertains to searching invoices or partners
    const lastUserQuery = ([...messages].reverse().find((m: any) => m.role === 'user')?.content || '').toLowerCase();
    const isInvoiceSearchIntent = /száml|bizonylat|partner|keres|mennyi|tartoz|szállító|vevő/i.test(lastUserQuery);

    const tools = (targetCompanyId && isInvoiceSearchIntent) ? [
      {
        type: "function",
        function: {
          name: "search_invoices",
          description: "Részletes keresés a cég számlái között partnernév, bizonylatszám, státusz (paid/unpaid) vagy irány (INBOUND/OUTBOUND) alapján.",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Keresőszó (partner neve, bizonylatszám, stb.)" },
              direction: { type: "string", enum: ["INBOUND", "OUTBOUND"], description: "Számla iránya: INBOUND (bejövő szállítói) vagy OUTBOUND (kimenő vevői)" },
              status: { type: "string", enum: ["paid", "unpaid"], description: "Státusz: paid (kifizetett) vagy unpaid (nyitott)" },
              limit: { type: "number", description: "Visszaadott számlák maximális száma (max 15)" }
            }
          }
        }
      }
    ] : undefined;

    let finalMessages: any[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m: any) => ({ role: m.role, content: m.content })),
    ];

    let precomputedContent: string | null = null;
    let initialInputTokens = 0;
    let initialOutputTokens = 0;

    // Fast Tool Check: if tools exist, check if model needs tool invocation
    if (tools && tools.length > 0) {
      try {
        const toolCheckPayload: Record<string, any> = {
          model: apiModel,
          messages: finalMessages,
          tools: tools,
          tool_choice: "auto",
          stream: false,
        };
        if (useMaxCompletionTokens) toolCheckPayload.max_completion_tokens = 6000;
        else toolCheckPayload.max_tokens = 4000;
        if (!isFixedTemperatureModel) toolCheckPayload.temperature = 0.3;
        else toolCheckPayload.reasoning_effort = "low";

        const checkRes = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(toolCheckPayload),
        });

        if (checkRes.ok) {
          const checkJson = await checkRes.json();
          const choice = checkJson.choices?.[0];
          console.log('[AI-CHAT] Model:', apiModel, 'Url:', apiUrl);
          console.log('[AI-CHAT] Tool check choice:', JSON.stringify(choice));
          if (checkJson.usage) {
            initialInputTokens += checkJson.usage.prompt_tokens || 0;
            initialOutputTokens += checkJson.usage.completion_tokens || 0;
          }

          if (choice?.message?.tool_calls && choice.message.tool_calls.length > 0) {
            const toolCall = choice.message.tool_calls[0];
            if (toolCall.function?.name === 'search_invoices') {
              let args: any = {};
              try { args = JSON.parse(toolCall.function.arguments || '{}'); } catch {}

              const { data: searchResults, error: searchErr } = await supabaseClient.rpc(
                'search_company_invoices_ai',
                {
                  p_company_id: targetCompanyId,
                  p_user_id: user.id,
                  p_query: args.query || null,
                  p_direction: args.direction || null,
                  p_status: args.status || null,
                  p_limit: args.limit || 10,
                }
              );

              finalMessages.push(choice.message);
              finalMessages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(searchErr ? { error: searchErr.message } : (searchResults || [])),
              });
              // Will stream final response with updated finalMessages below!
            }
          } else if (choice?.message?.content) {
            // No tool call needed! We already have the complete, generated answer!
            precomputedContent = choice.message.content;
          }
        }
      } catch (toolErr) {
        console.warn('[AI-CHAT] Tool check error, falling back to direct stream:', toolErr);
      }
    }

    const encoder = new TextEncoder();

    // If we already have the complete answer from the tool check step, stream it instantly!
    if (precomputedContent) {
      const stream = new ReadableStream({
        start(controller) {
          // Send in natural reading chunks
          const chunkSize = 24;
          for (let i = 0; i < precomputedContent.length; i += chunkSize) {
            const chunk = precomputedContent.slice(i, i + chunkSize);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`));
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, usage: { input_tokens: initialInputTokens, output_tokens: initialOutputTokens } })}\n\n`));
          controller.close();

          // Log token costs asynchronously
          try {
            const isDs = apiModel.toLowerCase().includes('deepseek');
            let estimatedCost = 0;
            if (isDs) {
              estimatedCost = (initialInputTokens / 1_000_000) * 0.14 + (initialOutputTokens / 1_000_000) * 0.28;
            } else if (apiModel.includes('mini')) {
              estimatedCost = (initialInputTokens / 1_000_000) * 0.15 + (initialOutputTokens / 1_000_000) * 0.60;
            } else {
              estimatedCost = (initialInputTokens / 1_000_000) * 2.50 + (initialOutputTokens / 1_000_000) * 10.00;
            }

            supabaseClient.from('llm_koltsegek').insert({
              file_name: 'ai-chat',
              pipeline: 'accounty_ai_chat',
              model_name: apiModel,
              input_tokens: initialInputTokens,
              output_tokens: initialOutputTokens,
              llm_calls: 1,
              estimated_cost_usd: estimatedCost,
              user_id: user.id,
            }).then(() => {}).catch(() => {});
          } catch {}
        }
      });

      return new Response(stream, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Otherwise, stream directly from API
    const requestPayload: Record<string, any> = {
      model: apiModel,
      messages: finalMessages,
      stream: true,
    };

    if (!apiUrl.includes('deepseek.com')) {
      requestPayload.stream_options = { include_usage: true };
    }

    if (useMaxCompletionTokens) {
      requestPayload.max_completion_tokens = 6000;
    } else {
      requestPayload.max_tokens = 4000;
    }

    if (!isFixedTemperatureModel) {
      requestPayload.temperature = 0.3;
    } else {
      requestPayload.reasoning_effort = "low";
    }

    const openaiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
    });

    if (!openaiResponse.ok) {
      const errBody = await openaiResponse.text();
      console.error('[AI-CHAT] AI API error:', openaiResponse.status, errBody);
      let errorDetail = `AI API error: ${openaiResponse.status}`;
      try {
        const parsed = JSON.parse(errBody);
        errorDetail = parsed.error?.message || errorDetail;
      } catch {}
      throw new Error(errorDetail);
    }

    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        const reader = openaiResponse.body!.getReader();
        let inputTokens = initialInputTokens;
        let outputTokens = initialOutputTokens;
        let streamContentChunks = 0;
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith('data: ')) continue;
              const data = trimmed.slice(6);
              if (data === '[DONE]') {
                if (streamContentChunks === 0) {
                  const fallback = "Elnézést, a választ nem sikerült legenerálni. Kérlek próbáld meg újra feltenni a kérdést!";
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: fallback })}\n\n`));
                }
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, usage: { input_tokens: inputTokens, output_tokens: outputTokens } })}\n\n`));
                continue;
              }
              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta;
                const content = delta?.content || delta?.reasoning_content;
                if (content) {
                  streamContentChunks++;
                  outputTokens++;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                }
                if (parsed.usage) {
                  inputTokens = (initialInputTokens || 0) + (parsed.usage.prompt_tokens || 0);
                  outputTokens = (initialOutputTokens || 0) + (parsed.usage.completion_tokens || 0);
                }
              } catch {}
            }
          }
        } catch (e) {
          console.error('[AI-CHAT] Stream error:', e);
        } finally {
          controller.close();

          try {
            const isDs = apiModel.toLowerCase().includes('deepseek');
            let estimatedCost = 0;
            if (isDs) {
              estimatedCost = (inputTokens / 1_000_000) * 0.14 + (outputTokens / 1_000_000) * 0.28;
            } else if (apiModel.includes('mini')) {
              estimatedCost = (inputTokens / 1_000_000) * 0.15 + (outputTokens / 1_000_000) * 0.60;
            } else {
              estimatedCost = (inputTokens / 1_000_000) * 2.50 + (outputTokens / 1_000_000) * 10.00;
            }

            supabaseClient.from('llm_koltsegek').insert({
              file_name: 'ai-chat',
              pipeline: 'accounty_ai_chat',
              model_name: apiModel,
              input_tokens: inputTokens,
              output_tokens: outputTokens,
              llm_calls: 1,
              estimated_cost_usd: estimatedCost,
              user_id: user.id,
            }).then(() => {}).catch(() => {});
          } catch {}
        }
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    console.error('[AI-CHAT] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
