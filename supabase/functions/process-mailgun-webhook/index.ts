import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

// Helper function to verify Mailgun webhook signature using Web Crypto API
async function verifySignature(timestamp: string, token: string, signature: string, signingKey: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const data = encoder.encode(timestamp + token);
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(signingKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, data);
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex === signature;
}

serve(async (req) => {
  try {
    console.log('Received Mailgun webhook');
    
    const contentType = req.headers.get('content-type');
    if (!contentType?.includes('multipart/form-data')) {
      throw new Error('Invalid content type');
    }

    // Parse form data
    const formData = await req.formData();
    
    // Verify webhook signature (optional but recommended)
    const timestamp = formData.get('timestamp') as string;
    const token = formData.get('token') as string;
    const signature = formData.get('signature') as string;
    
    const mailgunSigningKey = Deno.env.get('MAILGUN_SIGNING_KEY');
    if (mailgunSigningKey && timestamp && token && signature) {
      const isValid = await verifySignature(timestamp, token, signature, mailgunSigningKey);
      if (!isValid) {
        console.error('Invalid webhook signature');
        return new Response('Invalid signature', { status: 401 });
      }
      console.log('Webhook signature verified');
    }

    // Extract email data
    const recipient = formData.get('recipient') as string;
    const sender = formData.get('sender') as string;
    const subject = formData.get('subject') as string;
    const bodyPlain = formData.get('body-plain') as string;
    
    console.log('Email received:', { recipient, sender, subject });

    // Get the alias from database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: alias, error: aliasError } = await supabase
      .from('email_aliases')
      .select('user_id, company_name')
      .eq('alias_email', recipient)
      .eq('status', 'active')
      .single();

    if (aliasError || !alias) {
      console.error('Alias not found for:', recipient);
      return new Response('Alias not found', { status: 404 });
    }

    console.log('Found alias for user:', alias.user_id, 'company:', alias.company_name);

    // Process attachments
    const attachmentCount = parseInt(formData.get('attachment-count') as string || '0');
    console.log('Attachments:', attachmentCount);

    for (let i = 1; i <= attachmentCount; i++) {
      const attachment = formData.get(`attachment-${i}`);
      if (attachment instanceof File) {
        console.log(`Processing attachment ${i}:`, attachment.name, attachment.type);
        
        // Upload to Supabase storage
        const fileName = `${alias.user_id}/${Date.now()}-${attachment.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('invoice-uploads')
          .upload(fileName, attachment, {
            contentType: attachment.type,
            upsert: false,
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('invoice-uploads')
          .getPublicUrl(fileName);

        // Create invoice upload record
        const { data: uploadRecord, error: recordError } = await supabase
          .from('invoice_uploads')
          .insert({
            user_id: alias.user_id,
            file_name: attachment.name,
            file_type: attachment.type,
            file_size: attachment.size,
            file_url: publicUrl,
            upload_status: 'uploaded',
            processing_status: 'pending',
            metadata: {
              source: 'email_alias',
              company_name: alias.company_name,
              sender,
              subject,
              received_at: new Date().toISOString(),
            },
          })
          .select()
          .single();

        if (recordError) {
          console.error('Error creating invoice upload record:', recordError);
        } else {
          console.log('Invoice upload record created for:', attachment.name);
          
          // Trigger invoice processing to both N8N webhooks (test and prod)
          const webhookUrls = [
            'https://n8n.thinkaikontir.hu/webhook-test/bd504dd3-8af8-45d6-90f6-cfc635a22da6',
            'https://n8n.thinkaikontir.hu/webhook/bd504dd3-8af8-45d6-90f6-cfc635a22da6'
          ];

          for (const webhookUrl of webhookUrls) {
            console.log(`Triggering invoice processing with webhook: ${webhookUrl}`);
            const { error: processError } = await supabase.functions.invoke(
              'trigger-invoice-processing',
              {
                body: {
                  uploadId: uploadRecord.id,
                  webhookUrl,
                },
              }
            );

            if (processError) {
              console.error(`Error triggering invoice processing to ${webhookUrl}:`, processError);
            } else {
              console.log(`Successfully triggered processing for ${webhookUrl}`);
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('Error in process-mailgun-webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
