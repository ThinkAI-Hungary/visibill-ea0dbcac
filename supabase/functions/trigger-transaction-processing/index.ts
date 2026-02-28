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

    const { uploadId, webhookUrl, fileUrl, fileName, companyId } = await req.json();

    if (!uploadId) {
      return new Response(
        JSON.stringify({ error: 'Upload ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing transaction upload trigger:', { uploadId, webhookUrl });

    // Update processing status
    await supabase
      .from('transaction_uploads')
      .update({ 
        processing_status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', uploadId);

    if (webhookUrl) {
      const webhookPayload = {
        file_url: fileUrl,
        file_name: fileName,
        upload_id: uploadId,
        company_id: companyId,
        supabaseUrl: supabaseUrl
      };

      console.log('Sending webhook to N8N (fire-and-forget):', { webhookUrl });

      // Fire-and-forget: don't await the webhook response
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload)
      }).then(async (res) => {
        if (res.ok) {
          console.log('Webhook sent successfully');
          await supabase
            .from('transaction_uploads')
            .update({ processing_status: 'webhook_sent', updated_at: new Date().toISOString() })
            .eq('id', uploadId);
        } else {
          console.error('Webhook failed with status:', res.status);
          await supabase
            .from('transaction_uploads')
            .update({ processing_status: 'webhook_failed', error_message: `Webhook failed: ${res.status}`, updated_at: new Date().toISOString() })
            .eq('id', uploadId);
        }
      }).catch(async (err) => {
        console.error('Webhook error:', err);
        await supabase
          .from('transaction_uploads')
          .update({ processing_status: 'webhook_failed', error_message: `Webhook error: ${err.message}`, updated_at: new Date().toISOString() })
          .eq('id', uploadId);
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        uploadId,
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
