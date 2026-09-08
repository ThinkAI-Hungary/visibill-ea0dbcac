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
   - Ha a kérdéshez kapcsolódik tudástári cikk, vezesd végig a felhasználót a konkrét felületen, gombokon és lépéseken, és add meg a menüelérést (pl. 'Ugrás a funkcióhoz: [Menüpont neve]').
   - Soha ne találj ki nem létező funkciókat vagy technikai URL útvonalakat! Mindig a tudástárban szereplő tiszta megnevezéseket használd.
   - Ha a keresett témáról nincs információ a mellékelt tudástári cikkekben, de általános adózási vagy szakmai kérdés, válaszolj a szakmai ismereteid alapján a jogszabályi helyek megjelölésével. Ha rendszerspecifikus funkciót hiányolnak, jelezd udvariasan, hogy a bal oldali menü Tudástár pontjában böngészhetik a teljes dokumentációt, vagy a Hibajegyek menüpontban közvetlenül a támogatási csapathoz fordulhatnak.

Formázási szabályok:
- Mindig magyarul válaszolj, közvetlen, segítőkész és precíz szakmai hangnemben.
- Használj áttekinthető markdown formázást (félkövér kiemelések, pontokba szedett listák, strukturált lépések).
- Légy tömör és lényegretörő — a felhasználók gyors és egyértelmű útmutatást várnak.`;

/**
 * Accounty & eaisyBill AI Chat Edge Function with Knowledge Base RAG
 * 
 * Receives chat messages, retrieves relevant knowledge base articles via FTS & page context,
 * and streams grounded responses from DeepSeek or OpenAI GPT-4o-mini.
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
    const { messages, context } = await req.json();
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new Error('Messages array is required');
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

    // ── RAG Knowledge Base Retrieval ──
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
            match_limit: 3,
          }
        );

        if (!kbError && Array.isArray(kbArticles) && kbArticles.length > 0) {
          // Keep active page match OR articles with sufficient relevance rank
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
                return `[Tudástár Cikk #${idx + 1}: ${a.title}]\n` +
                  `Menüpont / Elérés: ${a.menu_path || 'Központi Tudástár'}\n` +
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
    if (kbContextText) {
      systemPrompt += kbContextText;
    }

    // Check model type and build request payload
    const isReasoningModel = apiModel.startsWith('o1') || apiModel.startsWith('o3');
    const isFixedTemperatureModel = isReasoningModel || apiModel.startsWith('gpt-5');
    const useMaxCompletionTokens = isFixedTemperatureModel || apiModel.startsWith('gpt-4.5');

    const requestPayload: Record<string, any> = {
      model: apiModel,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m: any) => ({ role: m.role, content: m.content })),
      ],
      stream: true,
    };

    if (!apiUrl.includes('deepseek.com')) {
      requestPayload.stream_options = { include_usage: true };
    }

    if (useMaxCompletionTokens) {
      requestPayload.max_completion_tokens = 2048;
    } else {
      requestPayload.max_tokens = 2048;
    }

    if (!isFixedTemperatureModel) {
      requestPayload.temperature = 0.3;
    }

    // Call AI API with streaming
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

    // Stream the response through to the client
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        const reader = openaiResponse.body!.getReader();
        let inputTokens = 0;
        let outputTokens = 0;
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
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, usage: { input_tokens: inputTokens, output_tokens: outputTokens } })}\n\n`));
                continue;
              }
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  outputTokens++;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                }
                if (parsed.usage) {
                  inputTokens = parsed.usage.prompt_tokens || 0;
                  outputTokens = parsed.usage.completion_tokens || 0;
                }
              } catch {}
            }
          }
        } catch (e) {
          console.error('[AI-CHAT] Stream error:', e);
        } finally {
          controller.close();

          // Log cost asynchronously (don't block response)
          try {
            const isDs = apiModel.toLowerCase().includes('deepseek');
            let estimatedCost = 0;
            if (isDs) {
              estimatedCost = (inputTokens / 1_000_000) * 0.14 + (outputTokens / 1_000_000) * 0.28;
            } else if (apiModel.includes('mini')) {
              estimatedCost = (inputTokens / 1_000_000) * 0.15 + (outputTokens / 1_000_000) * 0.60;
            } else {
              // Higher-tier models (gpt-4o, gpt-5, o1, etc.)
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
