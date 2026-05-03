import "https://deno.land/x/xhr@0.1.0/mod.ts";
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

    console.log('Processing bank statement upload:', uploadId);
    
    // Get upload details from database
    const { data: upload, error: fetchError } = await supabase
      .from('bank_statement_uploads')
      .select('*')
      .eq('id', uploadId)
      .single();

    if (fetchError || !upload) {
      console.error('Error fetching upload:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Upload not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update status to processing
    const { error: updateError } = await supabase
      .from('bank_statement_uploads')
      .update({ processing_status: 'processing' })
      .eq('id', uploadId);

    if (updateError) {
      console.error('Error updating status:', updateError);
    }

    // Send webhook if URL is provided
    if (webhookUrl) {
      try {
        console.log('Sending webhook to:', webhookUrl);
        
        const webhookPayload = {
          uploadId: upload.id,
          fileName: upload.file_name,
          fileUrl: upload.file_url,
          fileSize: upload.file_size,
          fileType: upload.file_type,
          userId: upload.user_id,
          companyId: upload.company_id,
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
          console.log('Webhook sent successfully');
          
          // Update status to webhook_sent
          await supabase
            .from('bank_statement_uploads')
            .update({ processing_status: 'webhook_sent' })
            .eq('id', uploadId);
            
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: 'Bank statement processing triggered successfully',
              uploadId 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          console.error('Webhook failed:', webhookResponse.status, webhookResponse.statusText);
          
          // Update status to webhook_failed
          await supabase
            .from('bank_statement_uploads')
            .update({ 
              processing_status: 'webhook_failed',
              error_message: `Webhook failed: ${webhookResponse.status} ${webhookResponse.statusText}`
            })
            .eq('id', uploadId);
            
          return new Response(
            JSON.stringify({ 
              error: 'Webhook failed',
              details: `${webhookResponse.status} ${webhookResponse.statusText}`
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (webhookError) {
        console.error('Webhook error:', webhookError);
        
        // Update status to webhook_failed
        await supabase
          .from('bank_statement_uploads')
          .update({ 
            processing_status: 'webhook_failed',
            error_message: `Webhook error: ${webhookError.message}`
          })
          .eq('id', uploadId);
          
        return new Response(
          JSON.stringify({ 
            error: 'Webhook error',
            details: webhookError.message
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Bank statement processing started (no webhook configured)',
        uploadId 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in trigger-bank-statement-processing function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});