import requests

url = "https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/management-stats?action=errors"

token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.YO-8-3sg4m--ms7MCvtwBLOo7ygqxaTbdtvwVwCin_Q"

headers = {
    "Authorization": f"Bearer {token}",
    "apikey": token
}

res = requests.get(url, headers=headers)
print("Status Code:", res.status_code)
data = res.json()
print("Total Errors in payload:", data.get("totalErrors"))
print("First 5 errors:")
for e in data.get("errors", [])[:5]:
    print(f"  [{e.get('created_at')}] [{e.get('source')}] {e.get('company_name')} -> {e.get('error_message')[:100]}")
