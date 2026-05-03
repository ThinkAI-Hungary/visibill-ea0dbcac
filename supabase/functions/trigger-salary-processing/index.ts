import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { uploadId, webhookUrl } = await req.json();

    if (!uploadId) {
      console.error('Missing uploadId');
      return new Response(
        JSON.stringify({ error: 'Missing uploadId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing salary file upload:', uploadId);

    // Get upload details from database
    const { data: upload, error: fetchError } = await supabase
      .from('salary_files')
      .select('*')
      .eq('id', uploadId)
      .single();

    if (fetchError || !upload) {
      console.error('Error fetching salary file upload:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Upload not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update status to processing
    const { error: updateError } = await supabase
      .from('salary_files')
      .update({
        status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', uploadId);

    if (updateError) {
      console.error('Error updating status:', updateError);
    }

    // Send webhook if URL is provided
    if (webhookUrl) {
      try {
        console.log('Sending salary webhook to:', webhookUrl);

        const webhookPayload = {
          uploadId: upload.id,
          fileName: upload.file_name,
          fileUrl: upload.file_url,
          userId: upload.user_id,
          companyId: upload.company_id,
          description: upload.description,
          recipientName: upload.recipient_name,
          paymentType: upload.payment_type,
          amountToTransfer: upload.amount_to_transfer,
          uploadedAt: upload.created_at,
          metadata: upload.metadata
        };

        const webhookResponse = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(webhookPayload),
        });

        if (webhookResponse.ok) {
          console.log('Salary webhook sent successfully');

          // Update status to webhook_sent
          await supabase
            .from('salary_files')
            .update({
              status: 'webhook_sent',
              updated_at: new Date().toISOString()
            })
            .eq('id', uploadId);

          return new Response(
            JSON.stringify({
              success: true,
              message: 'Salary processing triggered successfully',
              uploadId
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          console.error('Webhook failed:', webhookResponse.status, webhookResponse.statusText);

          await supabase
            .from('salary_files')
            .update({
              status: 'webhook_failed',
              metadata: {
                ...(upload.metadata || {}),
                error: `Webhook failed: ${webhookResponse.status} ${webhookResponse.statusText}`
              },
              updated_at: new Date().toISOString()
            })
            .eq('id', uploadId);

          return new Response(
            JSON.stringify({
              success: false,
              error: 'Webhook failed',
              details: `${webhookResponse.status} ${webhookResponse.statusText}`,
              uploadId
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (webhookError) {
        console.error('Webhook error:', webhookError);

        await supabase
          .from('salary_files')
          .update({
            status: 'webhook_failed',
            metadata: {
              ...(upload.metadata || {}),
              error: `Webhook error: ${webhookError.message}`
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', uploadId);

        return new Response(
          JSON.stringify({
            success: false,
            error: 'Webhook error',
            details: webhookError.message,
            uploadId
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Salary processing started (no webhook configured)',
        uploadId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in trigger-salary-processing function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
