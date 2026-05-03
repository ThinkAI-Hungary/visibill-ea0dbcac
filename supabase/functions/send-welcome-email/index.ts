import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const APP_URL = "https://app.visibill.hu";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildWelcomeHtml(name: string, verifyUrl: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu',sans-serif;margin:0;padding:0;">
<div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
  <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:40px 32px;text-align:center;">
    <h1 style="color:#2dd4bf;font-size:28px;font-weight:700;margin:0 0 8px 0;">Visibill</h1>
    <p style="color:#94a3b8;font-size:14px;margin:0;">Sz\u00e1mlakezel\u00e9s egyszer\u0171en</p>
  </div>
  <div style="padding:32px;">
    <h2 style="color:#1e293b;font-size:22px;font-weight:600;margin:0 0 16px 0;">\u00dcdv\u00f6zl\u00fcnk, ${name}! \ud83c\udf89</h2>
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 20px 0;">K\u00f6sz\u00f6nj\u00fck, hogy regisztr\u00e1lt\u00e1l a Visibillbe! K\u00e9rj\u00fck, er\u0151s\u00edtsd meg az email c\u00edmedet az al\u00e1bbi gombra kattintva:</p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${verifyUrl}" target="_blank" style="display:inline-block;padding:14px 40px;background:linear-gradient(135deg,#14b8a6 0%,#2dd4bf 100%);color:#ffffff;text-decoration:none;border-radius:8px;font-size:16px;font-weight:600;">Email c\u00edm meger\u0151s\u00edt\u00e9se</a>
    </div>
    <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;padding:20px;margin:24px 0;">
      <h3 style="color:#0f766e;font-size:16px;font-weight:600;margin:0 0 12px 0;">Meger\u0151s\u00edt\u00e9s ut\u00e1n ezeket teheted:</h3>
      <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 8px 0;">\u2705 Hozd l\u00e9tre a c\u00e9gedet a be\u00e1ll\u00edt\u00e1s var\u00e1zsl\u00f3ban</p>
      <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 8px 0;">\u2705 K\u00f6sd \u00f6ssze a NAV Online Sz\u00e1mla rendszerrel</p>
      <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 8px 0;">\u2705 T\u00f6ltsd fel az els\u0151 sz\u00e1ml\u00e1dat</p>
      <p style="color:#475569;font-size:14px;line-height:1.6;margin:0;">\u2705 Hozz l\u00e9tre email aliast a sz\u00e1mlafogad\u00e1shoz</p>
    </div>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
    <p style="color:#94a3b8;font-size:13px;line-height:1.5;margin:0 0 8px 0;">Ha a gomb nem m\u0171k\u00f6dik, m\u00e1sold be ezt a linket a b\u00f6ng\u00e9sz\u0151dbe:</p>
    <p style="color:#14b8a6;font-size:12px;word-break:break-all;margin:0 0 16px 0;">${verifyUrl}</p>
    <p style="color:#94a3b8;font-size:13px;line-height:1.5;margin:0;">Ha nem te regisztr\u00e1lt\u00e1l, nyugodtan figyelmen k\u00edv\u00fcl hagyhatod ezt az emailt.</p>
  </div>
  <div style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;">
    <p style="color:#94a3b8;font-size:12px;margin:0;">\u00a9 2026 Visibill \u2013 Sz\u00e1mlakezel\u00e9s egyszer\u0171en</p>
  </div>
</div>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("[SEND-WELCOME-EMAIL] Function started");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { userId, email, name } = await req.json();
    console.log("[SEND-WELCOME-EMAIL] Sending to:", email, "userId:", userId);

    if (!email || !userId) {
      throw new Error("Email and userId are required");
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, email_verify_token, email_verified")
      .eq("user_id", userId)
      .single();

    if (profileError) {
      console.error("[SEND-WELCOME-EMAIL] Profile fetch error:", profileError.message);
      throw new Error("Failed to fetch profile");
    }

    if (profile?.email_verified === true) {
      console.log("[SEND-WELCOME-EMAIL] Already verified, skipping");
      return new Response(
        JSON.stringify({ success: true, message: "Already verified" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let verifyToken = profile?.email_verify_token;

    if (!verifyToken) {
      console.log("[SEND-WELCOME-EMAIL] Token is null, generating fresh token");
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      verifyToken = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');

      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({ email_verify_token: verifyToken, email_verified: false })
        .eq("id", profile!.id);

      if (updateError) {
        console.error("[SEND-WELCOME-EMAIL] Token update error:", updateError.message);
        throw new Error("Failed to update verification token");
      }
      console.log("[SEND-WELCOME-EMAIL] New token saved");
    }

    const verifyUrl = `${APP_URL}/auth?verify_token=${verifyToken}`;
    console.log("[SEND-WELCOME-EMAIL] Verify URL generated (app domain)");

    const displayName = name || email.split("@")[0];
    const html = buildWelcomeHtml(displayName, verifyUrl);

    // Send via Resend API directly (no npm import needed)
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Visibill <info@mail.visibill.hu>",
        to: [email],
        subject: "Er\u0151s\u00edtsd meg az email c\u00edmed - Visibill",
        html,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("[SEND-WELCOME-EMAIL] Resend error:", JSON.stringify(resendData));
      throw new Error(resendData.message || "Resend API error");
    }

    console.log("[SEND-WELCOME-EMAIL] Email sent successfully:", resendData);

    return new Response(
      JSON.stringify({ success: true, data: resendData }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[SEND-WELCOME-EMAIL] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
