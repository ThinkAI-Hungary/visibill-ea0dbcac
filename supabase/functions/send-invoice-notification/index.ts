import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "npm:resend@4.0.0";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import React from "npm:react@18.3.1";
import { InvoiceProcessedEmail } from "../_shared/emails/invoice-processed.tsx";

const resend = new Resend(Deno.env.get("RESEND_API_KEY") as string);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[SEND-INVOICE-NOTIFICATION] Function started");

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        auth: {
          persistSession: false,
        },
      }
    );

    // Get notification data from request body
    const { 
      userId, 
      email, 
      name, 
      fileName, 
      status, 
      errorMessage,
      invoiceDetails 
    } = await req.json();

    console.log("[SEND-INVOICE-NOTIFICATION] Sending notification to:", email);

    if (!email || !fileName || !status) {
      throw new Error("Email, fileName, and status are required");
    }

    // Render the email template
    const html = await renderAsync(
      React.createElement(InvoiceProcessedEmail, {
        name: name || email.split("@")[0],
        fileName,
        status: status as 'success' | 'error',
        errorMessage,
        invoiceDetails,
      })
    );

    // Send the email
    const { data, error } = await resend.emails.send({
      from: "Visibill <notifications@resend.dev>",
      to: [email],
      subject: status === 'success' 
        ? `✅ Invoice Processed: ${fileName}` 
        : `⚠️ Invoice Processing Error: ${fileName}`,
      html,
    });

    if (error) {
      console.error("[SEND-INVOICE-NOTIFICATION] Error sending email:", error);
      throw error;
    }

    console.log("[SEND-INVOICE-NOTIFICATION] Notification email sent successfully:", data);

    return new Response(
      JSON.stringify({ success: true, data }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[SEND-INVOICE-NOTIFICATION] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
