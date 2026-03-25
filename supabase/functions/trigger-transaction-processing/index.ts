import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();

    // Support batch format: { uploads: [...], webhookUrl, companyId }
    // Also support legacy single format: { uploadId, webhookUrl, fileUrl, fileName, companyId }
    const { webhookUrl, companyId } = body;
    const uploads: { uploadId: string; fileUrl: string; fileName: string }[] = body.uploads || [
      { uploadId: body.uploadId, fileUrl: body.fileUrl, fileName: body.fileName }
    ];

    if (!uploads.length || !uploads[0].uploadId) {
      return new Response(
        JSON.stringify({ error: 'At least one upload is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing batch transaction upload trigger:', { count: uploads.length, webhookUrl });

    // Update all uploads to processing status
    const uploadIds = uploads.map(u => u.uploadId);
    await supabase
      .from('transaction_uploads')
      .update({ 
        processing_status: 'processing',
        updated_at: new Date().toISOString()
      })
      .in('id', uploadIds);

    if (webhookUrl) {
      const webhookPayload = {
        uploads: uploads.map(u => ({
          file_url: u.fileUrl,
          file_name: u.fileName,
          upload_id: u.uploadId,
        })),
        company_id: companyId,
        supabaseUrl: supabaseUrl
      };

      console.log('Sending batch webhook to N8N (fire-and-forget):', { webhookUrl, count: uploads.length });

      // Fire-and-forget
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload)
      }).then(async (res) => {
        const status = res.ok ? 'webhook_sent' : 'webhook_failed';
        const update: Record<string, string> = { 
          processing_status: status, 
          updated_at: new Date().toISOString() 
        };
        if (!res.ok) {
          update.error_message = `Webhook failed: ${res.status}`;
          console.error('Webhook failed with status:', res.status);
        } else {
          console.log('Batch webhook sent successfully');
        }
        await supabase
          .from('transaction_uploads')
          .update(update)
          .in('id', uploadIds);
      }).catch(async (err) => {
        console.error('Webhook error:', err);
        await supabase
          .from('transaction_uploads')
          .update({ 
            processing_status: 'webhook_failed', 
            error_message: `Webhook error: ${err.message}`, 
            updated_at: new Date().toISOString() 
          })
          .in('id', uploadIds);
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        uploadIds,
        status: webhookUrl ? 'webhook_sent' : 'processing'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in trigger-transaction-processing:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
