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
    console.log('=== Mailgun Webhook Received ===');
    
    const contentType = req.headers.get('content-type') || '';
    console.log('Content-Type:', contentType);
    console.log('Method:', req.method);
    
    // Initialize variables for parsed data
    let recipient: string | null = null;
    let sender: string | null = null;
    let subject: string | null = null;
    let bodyPlain: string | null = null;
    let timestamp: string | null = null;
    let token: string | null = null;
    let signature: string | null = null;
    let attachments: File[] = [];
    let attachmentCount = 0;

    // Parse based on content type
    if (contentType.includes('multipart/form-data')) {
      console.log('Parsing as multipart/form-data');
      const formData = await req.formData();
      
      // Log all form fields for debugging
      console.log('Form fields received:');
      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          console.log(`  ${key}: [File] ${value.name} (${value.type}, ${value.size} bytes)`);
        } else {
          console.log(`  ${key}: ${String(value).substring(0, 100)}${String(value).length > 100 ? '...' : ''}`);
        }
      }
      
      recipient = formData.get('recipient') as string;
      sender = formData.get('sender') as string;
      subject = formData.get('subject') as string;
      bodyPlain = formData.get('body-plain') as string;
      timestamp = formData.get('timestamp') as string;
      token = formData.get('token') as string;
      signature = formData.get('signature') as string;
      attachmentCount = parseInt(formData.get('attachment-count') as string || '0');
      
      // Collect attachments
      for (let i = 1; i <= attachmentCount; i++) {
        const attachment = formData.get(`attachment-${i}`);
        if (attachment instanceof File) {
          attachments.push(attachment);
        }
      }
      
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      console.log('Parsing as application/x-www-form-urlencoded');
      const text = await req.text();
      console.log('Raw body (first 500 chars):', text.substring(0, 500));
      
      const params = new URLSearchParams(text);
      
      recipient = params.get('recipient');
      sender = params.get('sender');
      subject = params.get('subject');
      bodyPlain = params.get('body-plain');
      timestamp = params.get('timestamp');
      token = params.get('token');
      signature = params.get('signature');
      attachmentCount = parseInt(params.get('attachment-count') || '0');
      
      console.log('Parsed URL-encoded data - recipient:', recipient, 'sender:', sender);
      
    } else if (contentType.includes('application/json')) {
      console.log('Parsing as application/json');
      const json = await req.json();
      console.log('JSON body:', JSON.stringify(json).substring(0, 500));
      
      // Mailgun JSON format can vary - handle both flat and nested structures
      recipient = json.recipient || json['event-data']?.message?.headers?.to;
      sender = json.sender || json['event-data']?.message?.headers?.from;
      subject = json.subject || json['event-data']?.message?.headers?.subject;
      bodyPlain = json['body-plain'] || json.bodyPlain;
      timestamp = json.timestamp?.toString();
      token = json.token;
      signature = json.signature;
      attachmentCount = json['attachment-count'] || json.attachmentCount || 0;
      
      console.log('Parsed JSON data - recipient:', recipient, 'sender:', sender);
      
    } else {
      // Unknown content type - log and attempt to read as text for debugging
      console.log('Unknown content type, attempting to read body for debugging');
      try {
        const text = await req.text();
        console.log('Raw body (first 1000 chars):', text.substring(0, 1000));
      } catch (e) {
        console.log('Could not read body as text');
      }
      throw new Error(`Unsupported content type: ${contentType}`);
    }

    console.log('Parsed email data:', { recipient, sender, subject, attachmentCount });

    // Verify webhook signature if signing key is configured
    const mailgunSigningKey = Deno.env.get('MAILGUN_SIGNING_KEY');
    if (mailgunSigningKey && timestamp && token && signature) {
      const isValid = await verifySignature(timestamp, token, signature, mailgunSigningKey);
      if (!isValid) {
        console.error('Invalid webhook signature');
        return new Response('Invalid signature', { status: 401 });
      }
      console.log('Webhook signature verified');
    } else {
      console.log('Signature verification skipped (no signing key or missing signature fields)');
    }

    // Validate required fields
    if (!recipient) {
      console.error('No recipient found in webhook data');
      return new Response(JSON.stringify({ error: 'No recipient specified' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Get the alias from database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Looking up alias for recipient:', recipient);

    const { data: alias, error: aliasError } = await supabase
      .from('email_aliases')
      .select('user_id, company_name, company_id')
      .eq('alias_email', recipient)
      .eq('status', 'active')
      .single();

    if (aliasError || !alias) {
      console.error('Alias not found for:', recipient, 'Error:', aliasError);
      return new Response(JSON.stringify({ error: 'Alias not found', recipient }), {
        headers: { 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    console.log('Found alias for user:', alias.user_id, 'company:', alias.company_name, 'company_id:', alias.company_id);

    // Helper: Érvényes számla csatolmány-e?
    const isValidInvoiceAttachment = (file: File): boolean => {
      const fileName = file.name.toLowerCase();
      const fileType = file.type.toLowerCase();
      
      // Minimális fájlméret (1KB) - túl kicsi fájlok kiszűrése
      if (file.size < 1024) {
        console.log(`Skipping too small file: ${file.name} (${file.size} bytes)`);
        return false;
      }
      
      // Engedélyezett MIME típusok
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
        'application/vnd.ms-excel', // xls
      ];
      
      // Engedélyezett kiterjesztések (fallback ha a MIME type nem pontos)
      const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.xlsx', '.xls'];
      
      const hasAllowedType = allowedTypes.includes(fileType);
      const hasAllowedExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
      
      if (!hasAllowedType && !hasAllowedExtension) {
        console.log(`Skipping unsupported file: ${file.name} (type: ${fileType})`);
        return false;
      }
      
      return true;
    };

    // Process attachments (only available with multipart/form-data)
    if (attachments.length > 0) {
      console.log('Processing', attachments.length, 'attachments');
      
      for (const attachment of attachments) {
        // Szűrés: csak releváns formátumok és min 1KB méret
        if (!isValidInvoiceAttachment(attachment)) {
          continue;
        }
        
        console.log(`Processing valid attachment: ${attachment.name}, type: ${attachment.type}, size: ${attachment.size}`);
        
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

        console.log('File uploaded successfully:', fileName);

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('invoice-uploads')
          .getPublicUrl(fileName);

        // Create invoice upload record
        const { data: uploadRecord, error: recordError } = await supabase
          .from('invoice_uploads')
          .insert({
            user_id: alias.user_id,
            company_id: alias.company_id,
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
          console.log('Invoice upload record created:', uploadRecord.id);
          
          // Trigger invoice processing via N8N webhook
          const webhookUrl = 'https://n8n.thinkaikontir.hu/webhook/bd504dd3-8af8-45d6-90f6-cfc635a22da6';

          console.log(`Triggering invoice processing: ${webhookUrl}`);
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
            console.error(`Error triggering processing to ${webhookUrl}:`, processError);
          } else {
            console.log(`Successfully triggered processing for ${webhookUrl}`);
          }
        }
      }
    } else {
      console.log('No attachments to process (attachmentCount:', attachmentCount, ')');
      
      // Log if we expected attachments but didn't get any files
      if (attachmentCount > 0 && !contentType.includes('multipart/form-data')) {
        console.log('WARNING: Attachments expected but content-type is not multipart/form-data. Attachments may need to be fetched separately.');
      }
    }

    console.log('=== Webhook processing completed successfully ===');

    return new Response(JSON.stringify({ 
      success: true,
      recipient,
      attachmentsProcessed: attachments.length
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('=== Error in process-mailgun-webhook ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
