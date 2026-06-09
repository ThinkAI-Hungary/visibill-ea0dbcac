import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Te egy magyar bérszámfejtési AI asszisztens vagy az Accounty rendszerben. A feladatod, hogy segítsd a könyvelőket a napi munkájukban.

Szakterületed:
- Magyar munkajog és adójog (Mt., Szja tv., Tbj., Szocho tv., Art., Efo tv.)
- Bérszámfejtés és járulékszámítás
- NAV bevallások (2608, 2658, M30, 08-as)
- Családi kedvezmények, adókedvezmények optimalizálása
- TB járulékok, SZOCHO, rehabilitációs hozzájárulás
- Cafeteria szabályok és adózás
- Munkáltatói kötelezettségek, bejelentési határidők
- GDPR és adatvédelmi követelmények a bérszámfejtésben

Fontos szabályok:
1. Mindig magyarul válaszolj
2. Használj markdown formázást (félkövér, listák, táblázatok) a jobb olvashatóságért
3. Ha jogszabályt említesz, add meg a pontos hivatkozást (törvény, paragrafus)
4. Ha nem vagy biztos valamiben, jelezd egyértelműen
5. A 2026-os adóév szabályait ismerd (minimálbér: 322 800 Ft, garantált bérminimum: 382 200 Ft)
6. Családi kedvezmény 2026: 1 eltartott: 20 000 Ft, 2 eltartott: 40 000 Ft/fő, 3+: 99 000 Ft/fő (duplázott összegek)
7. SZJA kulcs: 15%, TB járulék: 18,5%, SZOCHO: 13%
8. Légy tömör de informatív — a könyvelők gyors választ szeretnek`;

/**
 * Accounty AI Chat Edge Function
 * 
 * Receives chat messages and streams responses from OpenAI GPT-4o-mini.
 * Supports both streaming and non-streaming modes.
 * 
 * Input JSON: {
 *   messages: { role: 'user' | 'assistant', content: string }[]
 *   context?: { page?: string, clientName?: string, clientId?: string }
 * }
 */
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

    // Parse body
    const { messages, context } = await req.json();
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new Error('Messages array is required');
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build context-aware system prompt
    let systemPrompt = SYSTEM_PROMPT;
    if (context?.clientName) {
      systemPrompt += `\n\nAz aktuális ügyfél: ${context.clientName}`;
    }
    if (context?.page) {
      systemPrompt += `\nAz aktuális oldal: ${context.page}`;
    }

    // Call OpenAI with streaming
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map((m: any) => ({ role: m.role, content: m.content })),
        ],
        stream: true,
        temperature: 0.3,
        max_tokens: 2048,
      }),
    });

    if (!openaiResponse.ok) {
      const errBody = await openaiResponse.text();
      console.error('[AI-CHAT] OpenAI error:', openaiResponse.status, errBody);
      // Parse the error message from OpenAI for a better user-facing message
      let errorDetail = `OpenAI API error: ${openaiResponse.status}`;
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
                // Send usage info as final event
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
                // Capture usage if present
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
            supabaseClient.from('llm_koltsegek').insert({
              file_name: 'ai-chat',
              pipeline: 'accounty_ai_chat',
              model_name: 'gpt-4o-mini',
              input_tokens: inputTokens,
              output_tokens: outputTokens,
              llm_calls: 1,
              estimated_cost_usd: (inputTokens / 1_000_000) * 0.15 + (outputTokens / 1_000_000) * 0.60,
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

  } catch (error) {
    console.error('[AI-CHAT] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
