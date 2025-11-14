import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper logging function for enhanced debugging
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Client for user authentication (uses anon key + user's JWT)
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { 
      global: { 
        headers: { Authorization: req.headers.get('Authorization')! } 
      }
    }
  );

  // Client for database operations (uses service role key)
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    logStep("Authenticating user with token");
    
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No customer found, returning default teszt tier");
      
      // Ensure user has local subscription record
      await ensureUserSubscription(supabaseAdmin, user.id, 'teszt', 999999);
      
      return new Response(JSON.stringify({ 
        subscribed: false, 
        tier: 'teszt',
        product_id: null,
        subscription_end: null 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });
    const hasActiveSub = subscriptions.data.length > 0;
    let productId = null;
    let subscriptionEnd = null;
    let tier = 'teszt'; // Default to teszt tier
    let invoiceLimit = 999999; // Default unlimited limit

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      logStep("Active subscription found", { subscriptionId: subscription.id, endDate: subscriptionEnd });
      
      productId = subscription.items.data[0].price.product;
      
      // Determine tier and invoice limit based on product name
      const product = await stripe.products.retrieve(productId as string);
      const productName = product.name.toLowerCase();
      
      if (productName.includes('teszt')) {
        tier = 'teszt';
        invoiceLimit = 999999; // Unlimited
      } else if (productName.includes('tuna')) {
        tier = 'tuna';
        invoiceLimit = extractInvoiceLimit(productName);
      } else if (productName.includes('shark')) {
        tier = 'shark';
        invoiceLimit = extractInvoiceLimit(productName);
      } else if (productName.includes('orca')) {
        tier = 'orca';
        invoiceLimit = extractInvoiceLimit(productName);
      }
      
      logStep("Determined subscription tier", { productId, tier, productName, invoiceLimit });
      
      // Update local subscription record
      await ensureUserSubscription(supabaseAdmin, user.id, tier, invoiceLimit, customerId, subscription.id, productId as string);
    } else {
      logStep("No active subscription found, using default teszt tier");
      await ensureUserSubscription(supabaseAdmin, user.id, 'teszt', 999999);
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      tier: tier,
      product_id: productId,
      subscription_end: subscriptionEnd
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

// Helper function to extract invoice limit from product name (e.g., "Tuna 50 Havi" -> 50)
function extractInvoiceLimit(productName: string): number {
  const match = productName.match(/(\d+)/);
  return match ? parseInt(match[1]) : 3;
}

// Helper function to ensure user subscription record exists and is updated
async function ensureUserSubscription(
  supabaseClient: any,
  userId: string,
  tier: string,
  invoiceLimit: number,
  stripeCustomerId?: string,
  stripeSubscriptionId?: string,
  stripeProductId?: string
) {
  try {
    const { error } = await supabaseClient
      .from('user_subscriptions')
      .upsert({
        user_id: userId,
        tier: tier,
        invoice_limit: invoiceLimit,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        stripe_product_id: stripeProductId,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      console.error('Error upserting user subscription:', error);
    }
  } catch (error) {
    console.error('Error in ensureUserSubscription:', error);
  }
}