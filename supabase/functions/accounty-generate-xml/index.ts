import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Escape special XML characters
function escapeXml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const anonClient = createClient(supabaseUrl, supabaseAnonKey);
    const token = authHeader.replace("Bearer ", "");
    
    // Verify user is authenticated
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse payload
    const { type, data } = await req.json();
    if (!type || !data) {
      return new Response(JSON.stringify({ error: "Type and data parameters are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let xml = "";

    if (type === "cashbook-anyk") {
      const {
        companyName,
        companyTaxNumber,
        companyAddress,
        taxYear,
        periodFrom,
        periodTo,
        entries = [],
      } = data;

      const totalBevetel = entries
        .filter((e: any) => e.direction === 'bevetel' && !e.isStorno)
        .reduce((sum: number, e: any) => sum + e.amount, 0);

      const totalKiadas = entries
        .filter((e: any) => e.direction === 'kiadas' && !e.isStorno)
        .reduce((sum: number, e: any) => sum + e.amount, 0);

      const balance = totalBevetel - totalKiadas;

      xml += `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<penztarkonyv xmlns="http://www.nav.gov.hu/penztarkonyv" verzio="2026.1">\n`;
      xml += `  <fejlec>\n`;
      xml += `    <adozo>\n`;
      xml += `      <nev>${escapeXml(companyName || 'Egyéni Vállalkozó')}</nev>\n`;
      xml += `      <adoszam>${escapeXml(companyTaxNumber || '')}</adoszam>\n`;
      xml += `      <cim>${escapeXml(companyAddress || '')}</cim>\n`;
      xml += `    </adozo>\n`;
      xml += `    <idoszak>\n`;
      xml += `      <adoev>${taxYear}</adoev>\n`;
      xml += `      <tol>${escapeXml(periodFrom || `${taxYear}-01-01`)}</tol>\n`;
      xml += `      <ig>${escapeXml(periodTo || `${taxYear}-12-31`)}</ig>\n`;
      xml += `    </idoszak>\n`;
      xml += `  </fejlec>\n`;

      xml += `  <tetelek>\n`;
      entries.forEach((e: any) => {
        xml += `    <tetel id="${e.id}">\n`;
        xml += `      <sorszam>${e.serialNumber}</sorszam>\n`;
        xml += `      <datum>${e.entryDate}</datum>\n`;
        xml += `      <bizonylatszam>${escapeXml(e.documentNumber)}</bizonylatszam>\n`;
        xml += `      <megnevezes>${escapeXml(e.description)}</megnevezes>\n`;
        xml += `      <irany>${e.direction}</irany>\n`;
        xml += `      <kategoria>${escapeXml(e.category)}</kategoria>\n`;
        xml += `      <kategoria_megnevezes>${escapeXml(e.categoryLabel)}</kategoria_megnevezes>\n`;
        xml += `      <osszeg>${e.amount}</osszeg>\n`;
        xml += `      <afa_osszeg>${e.vatAmount}</afa_osszeg>\n`;
        xml += `      <lezart>${e.periodClosed ? 'igen' : 'nem'}</lezart>\n`;
        xml += `      <storno>${e.isStorno ? 'igen' : 'nem'}</storno>\n`;
        xml += `    </tetel>\n`;
      });
      xml += `  </tetelek>\n`;

      xml += `  <osszesites>\n`;
      xml += `    <osszes_bevetel>${totalBevetel}</osszes_bevetel>\n`;
      xml += `    <osszes_kiadas>${totalKiadas}</osszes_kiadas>\n`;
      xml += `    <egyenleg>${balance}</egyenleg>\n`;
      xml += `  </osszesites>\n`;
      xml += `</penztarkonyv>\n`;

    } else if (type === "cashbook-onya") {
      const {
        companyName,
        companyTaxNumber,
        taxYear,
        periodFrom,
        periodTo,
        entries = [],
      } = data;

      xml += `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<onya_penztarkonyv xmlns="http://www.nav.gov.hu/onya" verzio="1.0">\n`;
      xml += `  <meta>\n`;
      xml += `    <adoszam>${escapeXml(companyTaxNumber || '')}</adoszam>\n`;
      xml += `    <nev>${escapeXml(companyName || '')}</nev>\n`;
      xml += `    <idoszak_tol>${escapeXml(periodFrom || `${taxYear}-01-01`)}</idoszak_tol>\n`;
      xml += `    <idoszak_ig>${escapeXml(periodTo || `${taxYear}-12-31`)}</idoszak_ig>\n`;
      xml += `  </meta>\n`;

      xml += `  <bizonylatok>\n`;
      entries.forEach((e: any) => {
        xml += `    <bizonylat>\n`;
        xml += `      <sorszam>${e.serialNumber}</sorszam>\n`;
        xml += `      <teljesites_datum>${e.entryDate}</teljesites_datum>\n`;
        xml += `      <bizonylatszam>${escapeXml(e.documentNumber)}</bizonylatszam>\n`;
        xml += `      <megnevezes>${escapeXml(e.description)}</megnevezes>\n`;
        xml += `      <tipus>${e.direction === 'bevetel' ? 'Bevétel' : 'Kiadás'}</tipus>\n`;
        xml += `      <kategoria_kod>${escapeXml(e.category)}</kategoria_kod>\n`;
        xml += `      <kategoria_nev>${escapeXml(e.categoryLabel)}</kategoria_nev>\n`;
        xml += `      <osszeg_huf>${e.amount}</osszeg_huf>\n`;
        xml += `      <afa_huf>${e.vatAmount}</afa_huf>\n`;
        xml += `      <stornozott>${e.isStorno ? '1' : '0'}</stornozott>\n`;
        xml += `    </bizonylat>\n`;
      });
      xml += `  </bizonylatok>\n`;
      xml += `</onya_penztarkonyv>\n`;

    } else if (type === "kata-anyk") {
      const {
        taxYear,
        periodFrom,
        periodTo,
        retPeriod,
        amount,
        taxNum8,
        taxNumVat,
        taxNumCounty,
        taxNum,
        taxId,
        clientName,
        clientAddress,
        clientEmail,
        clientPhone,
      } = data;

      const currentDate = new Date().toISOString().slice(0, 10);

      xml += `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<!-- Nemzeti Adó- és Vámhivatal ÁNYK XML Export -->\n`;
      xml += `<nyomtatvanyok xmlns="http://www.nav.gov.hu/nyomtatvanyok" verzio="1.0">\n`;
      xml += `  <nyomtatvany>\n`;
      xml += `    <nyomtatvanyinformacio>\n`;
      xml += `      <nyomtatvanyazonosito>${taxYear}KATA</nyomtatvanyazonosito>\n`;
      xml += `      <verzio>1.0</verzio>\n`;
      xml += `    </nyomtatvanyinformacio>\n`;
      xml += `    <mezok>\n`;
      xml += `      <mezo eazon="01_0001_adoszam_torzs">${taxNum8}</mezo>\n`;
      xml += `      <mezo eazon="01_0002_adoszam_afa">${taxNumVat}</mezo>\n`;
      xml += `      <mezo eazon="01_0003_adoszam_megye">${taxNumCounty}</mezo>\n`;
      xml += `      <mezo eazon="01_0004_adoszam_teljes">${taxNum}</mezo>\n`;
      xml += `      <mezo eazon="01_0005_adoazonosito">${taxId}</mezo>\n`;
      xml += `      <mezo eazon="01_0006_adozo_nev">${escapeXml(clientName)}</mezo>\n`;
      xml += `      <mezo eazon="01_0007_szekhely_cim">${escapeXml(clientAddress)}</mezo>\n`;
      xml += `      <mezo eazon="01_0008_email">${escapeXml(clientEmail)}</mezo>\n`;
      xml += `      <mezo eazon="01_0009_telefon">${escapeXml(clientPhone)}</mezo>\n`;
      xml += `      <mezo eazon="01_0010_adoev">${taxYear}</mezo>\n`;
      xml += `      <mezo eazon="01_0011_idoszak_tol">${periodFrom}</mezo>\n`;
      xml += `      <mezo eazon="01_0012_idoszak_ig">${periodTo}</mezo>\n`;
      xml += `      <mezo eazon="01_0013_bevallastipus">M</mezo>\n`;
      xml += `      <mezo eazon="01_0014_idoszak_megnevezes">${escapeXml(retPeriod)}</mezo>\n`;
      xml += `      <mezo eazon="02_0001_aktiv_honapok_szama">6</mezo>\n`;
      xml += `      <mezo eazon="02_0002_fizetendo_ado">${amount}</mezo>\n`;
      xml += `      <mezo eazon="03_0001_nyilatkozat_adat_valos">1</mezo>\n`;
      xml += `      <mezo eazon="03_0002_kelt_hely">Budapest</mezo>\n`;
      xml += `      <mezo eazon="03_0003_kelt_datum">${currentDate}</mezo>\n`;
      xml += `    </mezok>\n`;
      xml += `  </nyomtatvany>\n`;
      xml += `</nyomtatvanyok>\n`;
    } else {
      return new Response(JSON.stringify({ error: "Unsupported XML type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ xml }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error", details: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
