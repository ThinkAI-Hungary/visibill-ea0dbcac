from supabase import create_client

url = "https://vxxgvdlqvvchtlmqnrqf.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.YO-8-3sg4m--ms7MCvtwBLOo7ygqxaTbdtvwVwCin_Q"
supabase = create_client(url, key)

# Get Think Ai Kft user_id
res = supabase.table("company_members").select("user_id").eq("company_id", "ecf31039-b539-4e04-bbea-70ea48c701bb").limit(1).execute()
user_id = res.data[0]["user_id"] if res.data else None
print(f"Think Ai Kft Owner User ID: {user_id}")

# Check user profile/email
if user_id:
    user_res = supabase.auth.admin.get_user_by_id(user_id)
    print(f"User Email: {user_res.user.email}")
