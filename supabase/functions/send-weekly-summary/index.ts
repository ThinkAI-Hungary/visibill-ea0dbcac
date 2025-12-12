import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "npm:resend@4.0.0";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import * as React from "npm:react@18.3.1";
import { WeeklySummaryEmail } from "../_shared/emails/weekly-summary.tsx";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface UserCompany {
  userId: string;
  userEmail: string;
  userName: string;
  companyId: string;
  companyName: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting weekly summary email job...");
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Calculate week range (last 7 days)
    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setHours(23, 59, 59, 999);
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);
    
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEndStr = weekEnd.toISOString().split('T')[0];
    
    console.log(`Week range: ${weekStartStr} to ${weekEndStr}`);
    
    // Get all users with weekly_summary enabled
    const { data: preferences, error: prefError } = await supabase
      .from('user_email_preferences')
      .select('user_id')
      .eq('weekly_summary', true);
    
    if (prefError) {
      console.error("Error fetching preferences:", prefError);
      throw prefError;
    }
    
    if (!preferences || preferences.length === 0) {
      console.log("No users with weekly summary enabled");
      return new Response(JSON.stringify({ sent: 0, message: "No users to notify" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const userIds = preferences.map(p => p.user_id);
    console.log(`Found ${userIds.length} users with weekly summary enabled`);
    
    // Get user emails from auth
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error("Error fetching users:", authError);
      throw authError;
    }
    
    const userEmails = new Map<string, { email: string; name: string }>();
    authData.users.forEach(user => {
      if (userIds.includes(user.id)) {
        userEmails.set(user.id, {
          email: user.email || '',
          name: user.user_metadata?.name || user.email?.split('@')[0] || 'Felhasználó'
        });
      }
    });
    
    // Get all companies for these users
    const { data: companies, error: compError } = await supabase
      .from('companies')
      .select('id, name, owner_id')
      .in('owner_id', userIds);
    
    if (compError) {
      console.error("Error fetching companies:", compError);
      throw compError;
    }
    
    // Build user-company pairs
    const userCompanies: UserCompany[] = [];
    companies?.forEach(company => {
      const userInfo = userEmails.get(company.owner_id);
      if (userInfo && userInfo.email) {
        userCompanies.push({
          userId: company.owner_id,
          userEmail: userInfo.email,
          userName: userInfo.name,
          companyId: company.id,
          companyName: company.name,
        });
      }
    });
    
    console.log(`Processing ${userCompanies.length} user-company pairs`);
    
    let sentCount = 0;
    const errors: string[] = [];
    const appUrl = "https://visibill.lovable.app";
    
    for (const uc of userCompanies) {
      try {
        console.log(`Processing ${uc.userEmail} - ${uc.companyName}`);
        
        // Fetch NAV invoices for this company in the week range
        const { data: navInvoices, error: navError } = await supabase
          .from('nav_invoices')
          .select('*')
          .eq('company_id', uc.companyId)
          .gte('invoice_issue_date', weekStartStr)
          .lte('invoice_issue_date', weekEndStr);
        
        if (navError) {
          console.error(`Error fetching NAV invoices for ${uc.companyId}:`, navError);
          errors.push(`NAV invoices error for ${uc.companyName}: ${navError.message}`);
          continue;
        }
        
        // Calculate outbound stats
        const outbound = navInvoices?.filter(i => i.invoice_direction === 'OUTBOUND') || [];
        const outboundCount = outbound.length;
        const outboundNetAmount = outbound.reduce((sum, i) => sum + (i.invoice_net_amount || 0), 0);
        const outboundGrossAmount = outbound.reduce((sum, i) => sum + (i.invoice_gross_amount || 0), 0);
        const outboundVat = outbound.reduce((sum, i) => sum + (i.invoice_vat_amount || 0), 0);
        
        // Calculate inbound stats
        const inbound = navInvoices?.filter(i => i.invoice_direction === 'INBOUND') || [];
        const inboundCount = inbound.length;
        const inboundNetAmount = inbound.reduce((sum, i) => sum + (i.invoice_net_amount || 0), 0);
        const inboundGrossAmount = inbound.reduce((sum, i) => sum + (i.invoice_gross_amount || 0), 0);
        const inboundVat = inbound.reduce((sum, i) => sum + (i.invoice_vat_amount || 0), 0);
        
        // VAT position
        const vatPosition = outboundVat - inboundVat;
        
        // Payable invoices (INBOUND, not paid)
        const { data: payableInvoices, error: payableError } = await supabase
          .from('nav_invoices')
          .select('invoice_gross_amount')
          .eq('company_id', uc.companyId)
          .eq('invoice_direction', 'INBOUND')
          .or('paid.is.null,paid.eq.false');
        
        const payableCount = payableInvoices?.length || 0;
        const payableAmount = payableInvoices?.reduce((sum, i) => sum + (i.invoice_gross_amount || 0), 0) || 0;
        
        // Missing invoices (INBOUND, not submitted)
        const { data: missingInvoices, error: missingError } = await supabase
          .from('nav_invoices')
          .select('id')
          .eq('company_id', uc.companyId)
          .eq('invoice_direction', 'INBOUND')
          .or('submitted.is.null,submitted.eq.false');
        
        const missingCount = missingInvoices?.length || 0;
        
        // Uploaded invoices this week
        const { data: uploadedInvoices, error: uploadError } = await supabase
          .from('invoices')
          .select('id')
          .eq('company_id', uc.companyId)
          .gte('letrehozva', weekStart.toISOString())
          .lte('letrehozva', weekEnd.toISOString());
        
        const uploadedCount = uploadedInvoices?.length || 0;
        
        // Processing errors this week
        const { data: errorUploads, error: errorUploadError } = await supabase
          .from('invoice_uploads')
          .select('id')
          .eq('company_id', uc.companyId)
          .eq('processing_status', 'failed')
          .gte('created_at', weekStart.toISOString())
          .lte('created_at', weekEnd.toISOString());
        
        const processingErrors = errorUploads?.length || 0;
        
        // New NAV invoices this week (by fetched_at)
        const newNavCount = navInvoices?.length || 0;
        
        // Format dates for display
        const formatDate = (date: Date) => {
          return date.toLocaleDateString('hu-HU', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          });
        };
        
        // Render email
        const html = await renderAsync(
          React.createElement(WeeklySummaryEmail, {
            userName: uc.userName,
            companyName: uc.companyName,
            weekStart: formatDate(weekStart),
            weekEnd: formatDate(weekEnd),
            outboundCount,
            outboundNetAmount,
            outboundGrossAmount,
            inboundCount,
            inboundNetAmount,
            inboundGrossAmount,
            vatPosition,
            payableCount,
            payableAmount,
            missingCount,
            newNavInvoices: newNavCount,
            uploadedInvoices: uploadedCount,
            processingErrors,
            dashboardUrl: appUrl,
            invoicesUrl: `${appUrl}/invoices`,
          })
        );
        
        // Send email
        const { error: sendError } = await resend.emails.send({
          from: "Visibill <noreply@visibill.hu>",
          to: [uc.userEmail],
          subject: `Visibill Heti Összesítő - ${uc.companyName} (${formatDate(weekStart)} - ${formatDate(weekEnd)})`,
          html,
        });
        
        if (sendError) {
          console.error(`Error sending email to ${uc.userEmail}:`, sendError);
          errors.push(`Send error for ${uc.userEmail}: ${sendError.message}`);
        } else {
          console.log(`Successfully sent weekly summary to ${uc.userEmail} for ${uc.companyName}`);
          sentCount++;
        }
        
      } catch (error) {
        console.error(`Error processing ${uc.userEmail}:`, error);
        errors.push(`Processing error for ${uc.userEmail}: ${error.message}`);
      }
    }
    
    console.log(`Weekly summary job completed. Sent: ${sentCount}, Errors: ${errors.length}`);
    
    return new Response(
      JSON.stringify({ 
        sent: sentCount, 
        errors: errors.length > 0 ? errors : undefined,
        message: `Successfully sent ${sentCount} weekly summaries` 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
    
  } catch (error) {
    console.error("Error in weekly summary job:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
