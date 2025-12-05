import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { uploadId, webhookUrl } = await req.json();

    if (!uploadId) {
      return new Response(
        JSON.stringify({ error: 'Upload ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing invoice upload trigger:', { uploadId, webhookUrl });

    // Get upload details from the database
    const { data: upload, error: uploadError } = await supabase
      .from('invoice_uploads')
      .select('*')
      .eq('id', uploadId)
      .single();

    if (uploadError || !upload) {
      console.error('Error fetching upload:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Upload not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update processing status to 'processing'
    const { error: updateError } = await supabase
      .from('invoice_uploads')
      .update({ 
        processing_status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', uploadId);

    if (updateError) {
      console.error('Error updating upload status:', updateError);
    }

    // If webhook URL is provided, trigger N8N workflow
    if (webhookUrl) {
      try {
        const webhookPayload = {
          uploadId: upload.id,
          userId: upload.user_id,
          companyId: upload.company_id,
          fileName: upload.file_name,
          fileSize: upload.file_size,
          fileType: upload.file_type,
          fileUrl: upload.file_url,
          uploadedAt: upload.created_at,
          supabaseUrl: supabaseUrl
        };

        console.log('Sending webhook to N8N:', { webhookUrl, payload: webhookPayload });

        const webhookResponse = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(webhookPayload)
        });

        if (!webhookResponse.ok) {
          throw new Error(`Webhook failed with status: ${webhookResponse.status}`);
        }
 
        console.log('Webhook sent successfully to N8N');
 
        // Update status to indicate webhook was sent
        await supabase
          .from('invoice_uploads')
          .update({ 
            processing_status: 'webhook_sent',
            updated_at: new Date().toISOString()
          })
          .eq('id', uploadId);
 
      } catch (webhookError) {
        console.error('Error sending webhook:', webhookError);
        
        // Update status to indicate webhook failed
        await supabase
          .from('invoice_uploads')
          .update({ 
            processing_status: 'webhook_failed',
            error_message: `Webhook failed: ${webhookError.message}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', uploadId);
 
        // Ne dobjunk 500-at a kliensnek, csak jelezzük az állapotot
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'Webhook failed', 
            details: webhookError.message,
            uploadId: uploadId
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
 
    return new Response(
      JSON.stringify({ 
        success: true, 
        uploadId: uploadId,
        status: webhookUrl ? 'webhook_sent' : 'processing'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in trigger-invoice-processing function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});