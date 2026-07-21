async function run() {
  console.log('Invoking Edge Function nav-auto-sync via fetch...');
  try {
    const response = await fetch('https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/nav-auto-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': 'JGqfiN0Y6gFWHRPnsekm5BLElXrQdaVw2DpzCOxU4738M1ATutovZcKhSby9jI'
      },
      body: JSON.stringify({
        detailsOnly: true
      })
    });

    const status = response.status;
    const text = await response.text();
    console.log(`Response status: ${status}`);
    console.log(`Response body:`, text);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

run();
