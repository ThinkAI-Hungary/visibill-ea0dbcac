import React from 'npm:react@18.3.1'
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'
import { Resend } from 'npm:resend@4.0.0'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { EmailConfirmation } from './_templates/email-confirmation.tsx'
import { PasswordReset } from './_templates/password-reset.tsx'

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string)
const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET') as string

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  try {
    console.log('[SEND-EMAIL] Function started')
    
    const payload = await req.text()
    const headers = Object.fromEntries(req.headers)
    
    // Verify webhook signature
    const wh = new Webhook(hookSecret)
    let webhookData
    
    try {
      webhookData = wh.verify(payload, headers) as {
        user: {
          email: string
        }
        email_data: {
          token: string
          token_hash: string
          redirect_to: string
          email_action_type: string
          site_url: string
        }
      }
      console.log('[SEND-EMAIL] Webhook verified successfully')
    } catch (error) {
      console.error('[SEND-EMAIL] Webhook verification failed:', error)
      return new Response(
        JSON.stringify({ error: 'Invalid webhook signature' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const {
      user,
      email_data: { token, token_hash, redirect_to, email_action_type },
    } = webhookData

    console.log('[SEND-EMAIL] Processing email:', {
      email: user.email,
      type: email_action_type,
    })

    let html: string
    let subject: string

    // Select template based on email action type
    if (email_action_type === 'signup') {
      subject = 'Erősítsd meg az email címed - Visibill'
      html = await renderAsync(
        React.createElement(EmailConfirmation, {
          supabase_url: Deno.env.get('SUPABASE_URL') ?? '',
          token,
          token_hash,
          redirect_to,
          email_action_type,
          email: user.email,
        })
      )
    } else if (email_action_type === 'recovery') {
      subject = 'Jelszó visszaállítás - Visibill'
      html = await renderAsync(
        React.createElement(PasswordReset, {
          supabase_url: Deno.env.get('SUPABASE_URL') ?? '',
          token,
          token_hash,
          redirect_to,
          email_action_type,
        })
      )
    } else {
      console.error('[SEND-EMAIL] Unsupported email action type:', email_action_type)
      return new Response(
        JSON.stringify({ error: 'Unsupported email action type' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('[SEND-EMAIL] Sending email via Resend')
    
    const { error } = await resend.emails.send({
      from: 'Visibill <info@mail.visibill.hu>',
      to: [user.email],
      subject,
      html,
    })

    if (error) {
      console.error('[SEND-EMAIL] Resend error:', error)
      throw error
    }

    console.log('[SEND-EMAIL] Email sent successfully')

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('[SEND-EMAIL] Error:', error)
    return new Response(
      JSON.stringify({
        error: {
          message: error.message,
        },
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
