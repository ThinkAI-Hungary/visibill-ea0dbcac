import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { createHmac } from "https://deno.land/std@0.190.0/node/crypto.ts";

serve(async (req) => {
  try {
    console.log('Received Mailgun webhook');
    
    const contentType = req.headers.get('content-type');
    if (!contentType?.includes('multipart/form-data')) {
      throw new Error('Invalid content type');
    }

    // Parse form data
    const formData = await req.formData();
    
    // Verify webhook signature
    const timestamp = formData.get('timestamp') as string;
    const token = formData.get('token') as string;
    const signature = formData.get('signature') as string;
    
    const mailgunSigningKey = Deno.env.get('MAILGUN_SIGNING_KEY');
    if (mailgunSigningKey) {
      const hmac = createHmac('sha256', mailgunSigningKey);
      hmac.update(timestamp + token);
      const calculatedSignature = hmac.digest('hex');
      
      if (calculatedSignature !== signature) {
        console.error('Invalid signature');
        return new Response('Invalid signature', { status: 401 });
      }
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
        const { error: recordError } = await supabase
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
          });

        if (recordError) {
          console.error('Error creating invoice upload record:', recordError);
        } else {
          console.log('Invoice upload record created for:', attachment.name);
          
          // Trigger invoice processing
          const { error: processError } = await supabase.functions.invoke(
            'trigger-invoice-processing',
            {
              body: {
                file_url: publicUrl,
                user_id: alias.user_id,
              },
            }
          );

          if (processError) {
            console.error('Error triggering invoice processing:', processError);
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
