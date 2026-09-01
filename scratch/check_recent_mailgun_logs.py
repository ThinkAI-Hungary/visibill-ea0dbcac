import os
from supabase import create_client

url = "https://vxxgvdlqvvchtlmqnrqf.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.YO-8-3sg4m--ms7MCvtwBLOo7ygqxaTbdtvwVwCin_Q"

supabase = create_client(url, key)

print("=== RECENT ERROR LOGS ===")
res_logs = supabase.table("app_error_logs").select("*").order("created_at", desc=True).limit(10).execute()
import sys

for log in res_logs.data:
    msg = str(log.get('message')).encode('ascii', 'replace').decode()
    print(f"[{log.get('created_at')}] {log.get('component')} / {log.get('action')}: {msg[:100]}")

print("\n=== RECENT INVOICE UPLOADS ===")
res_uploads = supabase.table("invoice_uploads").select("*").order("created_at", desc=True).limit(10).execute()
for up in res_uploads.data:
    fn = str(up.get('file_name')).encode('ascii', 'replace').decode()
    print(f"[{up.get('created_at')}] {fn} | Status: {up.get('upload_status')} / {up.get('processing_status')} | Company: {up.get('company_id')}")

print("\n=== EMAIL ALIASES ===")
res_aliases = supabase.table("email_aliases").select("*").execute()
for al in res_aliases.data:
    print(f"Alias: {al.get('alias_email')} | Company: {al.get('company_id')}")

print("\n=== COMPANIES WITH SZAMLAZZ AGENT KEY ===")
res_comp = supabase.table("companies").select("id, name, szamlazz_agent_key").execute()
for c in res_comp.data:
    key_status = "SET (" + c.get('szamlazz_agent_key')[:6] + "...)" if c.get('szamlazz_agent_key') else "NONE"
    cname = str(c.get('name')).encode('ascii', 'replace').decode()
    print(f"Company: {cname} ({c.get('id')}) | Key: {key_status}")

