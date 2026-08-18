// Use built-in fetch

async function main() {
  const url = "https://vxxgvdlqvvchtlmqnrqf.supabase.co/rest/v1/";
  const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.YO-8-3sg4m--ms7MCvtwBLOo7ygqxaTbdtvwVwCin_Q";

  try {
    const response = await fetch(url, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("=== EXPOSED PATHS ===");
    const paths = Object.keys(data.paths);
    const rpcs = paths.filter(p => p.startsWith('/rpc/'));
    
    console.log("Found", rpcs.length, "exposed RPCs:");
    rpcs.sort().forEach(r => console.log("  ", r));

  } catch (err) {
    console.error("Error:", err);
  }
}

main();
