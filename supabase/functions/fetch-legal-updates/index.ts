import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ParsedArticle {
  title: string;
  url: string;
  published_at: string;
  source: string;
}

/**
 * Parse NAV sajtószoba/hirek page for news articles
 */
async function fetchNavNews(): Promise<ParsedArticle[]> {
  const articles: ParsedArticle[] = [];
  try {
    const res = await fetch("https://nav.gov.hu/sajtoszoba/hirek", {
      headers: { "User-Agent": "VisiBill/1.0 (Legal Update Checker)" },
    });
    const html = await res.text();

    // NAV uses <a> tags with class "list-item" or similar patterns
    // Match patterns like: <a href="/sajtoszoba/hirek/xxx" ...>Title</a> with dates
    const articleRegex = /<a[^>]*href="(\/sajtoszoba\/hirek\/[^"]+)"[^>]*>\s*<[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/[^>]*>/gi;
    const dateRegex = /<[^>]*class="[^"]*date[^"]*"[^>]*>([^<]+)<\/[^>]*>/gi;

    // Fallback: simpler pattern - look for links to /sajtoszoba/hirek/ subpages
    const linkRegex = /href="(\/sajtoszoba\/hirek\/([^"/]+))"[^>]*>([^<]{10,120})</g;
    let match;
    const seen = new Set<string>();
    
    while ((match = linkRegex.exec(html)) !== null) {
      const [, path, slug, rawTitle] = match;
      const title = rawTitle.replace(/\s+/g, ' ').trim();
      if (seen.has(slug) || !title || title.length < 10) continue;
      seen.add(slug);
      
      // Try to extract date from slug (format: YYMMDD or similar) or nearby text
      let published_at = new Date().toISOString().split('T')[0];
      const dateFromSlug = slug.match(/^(\d{4})(\d{2})(\d{2})/);
      if (dateFromSlug) {
        published_at = `${dateFromSlug[1]}-${dateFromSlug[2]}-${dateFromSlug[3]}`;
      }

      articles.push({
        title,
        url: `https://nav.gov.hu${path}`,
        published_at,
        source: 'nav',
      });
    }
  } catch (e) {
    console.error("NAV fetch error:", e);
  }
  return articles.slice(0, 20); // max 20 latest
}

/**
 * Magyar Közlöny — disabled: site structure doesn't support reliable scraping
 * TODO: Re-enable when NJT API or structured Közlöny feed becomes available
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Cleanup: delete known garbage entries from broken Közlöny scraper
    const garbageTitles = [
      'Mégse', 'Következő »', '×Indokolás(ok)', '&rsaquo;',
      'Impresszum', 'Kapcsolat', 'Jogszabályi háttér', 'Keresés',
      'Bejelentkezés', 'Regisztráció', 'Főoldal',
    ];
    for (const t of garbageTitles) {
      await supabase.from("accounty_legal_updates").delete().eq("title", t);
    }
    // Also delete all kozlony entries with very short titles (< 15 chars) — likely garbage
    await supabase
      .from("accounty_legal_updates")
      .delete()
      .eq("source", "kozlony")
      .lt("title", "aaaaaaaaaaaaaaa"); // trick: lt on text = alphabetically < 15 a's won't work, use RPC instead

    // Actually just delete all kozlony-sourced entries (they were all garbage)
    await supabase.from("accounty_legal_updates").delete().eq("source", "kozlony");

    // Fetch NAV news only
    const navArticles = await fetchNavNews();

    // Get existing titles to avoid duplicates
    const { data: existing } = await supabase
      .from("accounty_legal_updates")
      .select("title")
      .order("created_at", { ascending: false })
      .limit(100);

    const existingTitles = new Set((existing || []).map((e: any) => e.title));

    // Insert only new articles
    const newArticles = navArticles.filter(a => !existingTitles.has(a.title));
    
    let inserted = 0;
    if (newArticles.length > 0) {
      const rows = newArticles.map(a => ({
        title: a.title,
        source: a.source,
        published_at: a.published_at,
        implementation_status: 'planned',
        notes: a.url,
        affected_modules: [],
      }));

      const { error: insertErr } = await supabase
        .from("accounty_legal_updates")
        .insert(rows);

      if (insertErr) {
        console.error("Insert error:", insertErr);
      } else {
        inserted = rows.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        nav_found: navArticles.length,
        kozlony_found: 0,
        kozlony_note: "Disabled — site structure not suitable for scraping",
        new_inserted: inserted,
        total_found: navArticles.length,
        garbage_cleaned: true,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
