from supabase import create_client
import sys

sys.stdout.reconfigure(encoding='utf-8')

url = "https://vxxgvdlqvvchtlmqnrqf.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.YO-8-3sg4m--ms7MCvtwBLOo7ygqxaTbdtvwVwCin_Q"
supabase = create_client(url, key)

res = supabase.table("email_aliases").select("*").eq("company_id", "ecf31039-b539-4e04-bbea-70ea48c701bb").execute()

print("Alias record in DB:")
for r in res.data:
    print(r)
