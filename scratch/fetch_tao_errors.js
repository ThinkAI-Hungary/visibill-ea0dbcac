const apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.YO-8-3sg4m--ms7MCvtwBLOo7ygqxaTbdtvwVwCin_Q";
const baseUrl = "https://vxxgvdlqvvchtlmqnrqf.supabase.co/rest/v1/app_error_logs";

async function run() {
  try {
    // We will query logs where message/component/url/context contains "tao" or "wizard" or "annual" or "yearend" or "year-end"
    const searchTerms = ["tao", "wizard", "annual", "year", "ledg"];
    
    // Let's just fetch the last 100 error logs and filter them in JavaScript to be 100% robust.
    const url = `${baseUrl}?select=*&order=created_at.desc&limit=100`;
    const res = await fetch(url, {
      headers: {
        "apikey": apiKey,
        "Authorization": `Bearer ${apiKey}`
      }
    });
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status} - ${await res.text()}`);
    }
    const logs = await res.json();
    
    console.log(`Fetched ${logs.length} logs. Filtering for Tao/wizard/annual/ledger related logs...`);
    
    const filtered = logs.filter(log => {
      const text = JSON.stringify(log).toLowerCase();
      return searchTerms.some(term => text.includes(term));
    });
    
    console.log(JSON.stringify(filtered.slice(0, 10), null, 2));
  } catch (err) {
    console.error("Error fetching logs:", err);
  }
}

run();
