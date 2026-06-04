import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'npm:resend@4.0.0'

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  to: string
  subject: string
  htmlBody: string
  textBody: string
  companyName: string
  companyId: string
  category: 'urgent' | 'normal' | 'callback'
  messageId: string
  portalLink?: string
  missingItemIds?: string[]
  replyTo?: string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const body: RequestBody = await req.json()
    const {
      to,
      subject,
      htmlBody,
      textBody,
      companyName,
      companyId,
      category,
      messageId,
      portalLink,
      missingItemIds,
      replyTo,
    } = body

    if (!to || !subject || !htmlBody) {
      return new Response(JSON.stringify({ error: 'Missing required fields: to, subject, htmlBody' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`[accounty-email] Sending to ${to} for company "${companyName}", subject: "${subject}"`)

    // Send via Resend
    const { data: sendData, error: resendError } = await resend.emails.send({
      from: `Accounty (Visibill) <info@mail.visibill.hu>`,
      reply_to: replyTo || user.email || undefined,
      to: [to],
      subject,
      html: htmlBody,
      text: textBody,
    })

    const status = resendError ? 'error' : 'sent'
    const errorMessage = resendError ? JSON.stringify(resendError) : null

    // Log to outgoing_emails table
    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    await serviceSupabase.from('outgoing_emails').insert({
      user_id: user.id,
      company_id: companyId,
      company_name: companyName,
      recipient_email: to,
      subject,
      category,
      message_id: messageId,
      portal_link: portalLink || null,
      missing_item_ids: missingItemIds || [],
      status,
      error_message: errorMessage,
      resend_id: sendData?.id || null,
    })

    if (resendError) {
      console.error('[accounty-email] Resend error:', resendError)
      return new Response(JSON.stringify({ error: resendError }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`[accounty-email] Success! Resend ID: ${sendData?.id}`)
    return new Response(JSON.stringify({ success: true, resendId: sendData?.id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[accounty-email] Unexpected error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
