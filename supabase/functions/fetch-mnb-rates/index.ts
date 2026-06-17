import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Fetch daily MNB exchange rates and upsert into daily_exchange_rates.
 * 
 * MNB SOAP API: https://www.mnb.hu/arfolyamok.asmx
 * 
 * POST body:
 *   { date_from: "2026-01-01", date_to: "2026-06-16", currencies?: ["EUR","USD","GBP","CHF"] }
 * 
 * If currencies is omitted, fetches EUR, USD, GBP, CHF by default.
 */

const DEFAULT_CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'PLN', 'CZK', 'RON', 'SEK', 'NOK', 'DKK', 'JPY', 'CAD', 'AUD'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Auth check (optional — cron calls and auto-fetch from dashboard may not have a valid user token)
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser(
          authHeader.replace('Bearer ', '')
        );
        if (!userError && user) {
          console.log('[MNB-RATES] Authenticated user:', user.id);
        } else {
          console.log('[MNB-RATES] Auth header present but no valid user — continuing as service call');
        }
      } catch {
        console.log('[MNB-RATES] Auth check failed — continuing as service call');
      }
    } else {
      console.log('[MNB-RATES] Running as cron/service call (no auth)');
    }

    const body = await req.json().catch(() => ({}));
    const dateFrom = body.date_from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const dateTo = body.date_to || new Date().toISOString().split('T')[0];
    const currencies: string[] = body.currencies || DEFAULT_CURRENCIES;

    console.log(`[MNB-RATES] Fetching rates from ${dateFrom} to ${dateTo} for ${currencies.join(', ')}`);

    // Build SOAP request for MNB
    const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:mnb="http://www.mnb.hu/webservices/">
  <soap:Body>
    <mnb:GetExchangeRates>
      <mnb:startDate>${dateFrom}</mnb:startDate>
      <mnb:endDate>${dateTo}</mnb:endDate>
      <mnb:currencyNames>${currencies.join(',')}</mnb:currencyNames>
    </mnb:GetExchangeRates>
  </soap:Body>
</soap:Envelope>`;

    const response = await fetch('http://www.mnb.hu/arfolyamok.asmx', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://www.mnb.hu/webservices/MNBArfolyamServiceSoap/GetExchangeRates',
      },
      body: soapBody,
    });

    if (!response.ok) {
      throw new Error(`MNB SOAP API error: ${response.status} ${response.statusText}`);
    }

    const xmlResponse = await response.text();
    console.log('[MNB-RATES] MNB response length:', xmlResponse.length);

    // Parse the SOAP response
    // The response contains XML like:
    // <GetExchangeRatesResult>
    //   <MNBExchangeRates>
    //     <Day date="2026-01-02">
    //       <Rate unit="1" curr="EUR">410,25</Rate>
    //       <Rate unit="1" curr="USD">380,10</Rate>
    //     </Day>
    //   </MNBExchangeRates>
    // </GetExchangeRatesResult>

    // Extract the inner XML from CDATA or element
    const resultMatch = xmlResponse.match(/<GetExchangeRatesResult>([\s\S]*?)<\/GetExchangeRatesResult>/);
    if (!resultMatch) {
      throw new Error('Failed to parse MNB response: no GetExchangeRatesResult found');
    }

    let innerXml = resultMatch[1].trim();
    // If wrapped in CDATA, unwrap
    if (innerXml.startsWith('<![CDATA[')) {
      innerXml = innerXml.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '');
    }
    // Unescape HTML entities
    innerXml = innerXml.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

    // Parse Day elements
    const dayRegex = /<Day date="(\d{4}-\d{2}-\d{2})">([\s\S]*?)<\/Day>/g;
    const rateRegex = /<Rate unit="(\d+)" curr="(\w+)">([\d,]+)<\/Rate>/g;

    const rows: { rate_date: string; currency: string; rate: number; source: string }[] = [];

    let dayMatch;
    while ((dayMatch = dayRegex.exec(innerXml)) !== null) {
      const rateDate = dayMatch[1];
      const dayContent = dayMatch[2];

      let rateMatch;
      rateRegex.lastIndex = 0;
      while ((rateMatch = rateRegex.exec(dayContent)) !== null) {
        const unit = parseInt(rateMatch[1], 10);
        const currency = rateMatch[2];
        const rateValue = parseFloat(rateMatch[3].replace(',', '.'));

        if (!isNaN(rateValue) && unit > 0) {
          rows.push({
            rate_date: rateDate,
            currency,
            rate: rateValue / unit, // Normalize to 1 unit = X HUF
            source: 'MNB',
          });
        }
      }
    }

    console.log(`[MNB-RATES] Parsed ${rows.length} rate entries across ${new Set(rows.map(r => r.rate_date)).size} days`);

    if (rows.length === 0) {
      return new Response(
        JSON.stringify({ success: true, inserted: 0, message: 'No rates found in the given date range' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Upsert in batches of 500
    const BATCH_SIZE = 500;
    let totalUpserted = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from('daily_exchange_rates')
        .upsert(batch, { onConflict: 'rate_date,currency,source' });

      if (error) {
        console.error(`[MNB-RATES] Upsert error at batch ${i}:`, error);
        throw new Error(`Failed to upsert rates: ${error.message}`);
      }
      totalUpserted += batch.length;
    }

    console.log(`[MNB-RATES] Successfully upserted ${totalUpserted} rate entries`);

    return new Response(
      JSON.stringify({
        success: true,
        inserted: totalUpserted,
        days: new Set(rows.map(r => r.rate_date)).size,
        currencies: [...new Set(rows.map(r => r.currency))],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[MNB-RATES] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
