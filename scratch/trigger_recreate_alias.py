import requests

url = "https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/create-email-alias"

token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.YO-8-3sg4m--ms7MCvtwBLOo7ygqxaTbdtvwVwCin_Q"

headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json",
    "apikey": token
}

payload = {
    "company_name": "Think Ai Kft",
    "company_id": "ecf31039-b539-4e04-bbea-70ea48c701bb"
}

print("Calling create-email-alias for Think Ai Kft...")
res = requests.post(url, json=payload, headers=headers)
print("Status Code:", res.status_code)
print("Response:", res.text)
