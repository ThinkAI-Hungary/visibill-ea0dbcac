async function run() {
  console.log('Invoking Edge Function nav-auto-sync via fetch...');
  const response = await fetch('https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/nav-auto-sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-cron-secret': '886385fde37a16003b76453d885476aff2e99da78c413123181e9422738abac9'
    },
    body: JSON.stringify({
      detailsOnly: true
    })
  });

  const status = response.status;
  const text = await response.text();
  console.log(`Response status: ${status}`);
  console.log(`Response body:`, text);
}

run();
