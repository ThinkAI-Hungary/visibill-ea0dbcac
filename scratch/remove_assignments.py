import sys, os
os.environ["PYTHONIOENCODING"] = "utf-8"
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, r"c:\Users\adetw\.antigravity\visibill\visibill-worker")
from dotenv import load_dotenv
load_dotenv(r"c:\Users\adetw\.antigravity\visibill\visibill-worker\.env")
from supabase import create_client
sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

# Viktor Jámbor user ID
viktor_id = "5abff3e7-0b0e-47eb-9198-4db551668caf"

# Find Mauroni and Fóliavilág company IDs
companies = []
r1 = sb.table("companies").select("id, name").ilike("name", "%Mauroni%").execute()
companies.extend(r1.data)
r2 = sb.table("companies").select("id, name").ilike("name", "%Fólia%").execute()
companies.extend(r2.data)

for c in companies:
    print(f"Feldolgozás: {c['name']} (ID: {c['id']})")
    # Delete assignments where accountant_user_id is not Viktor Jámbor
    res = sb.table("accounty_assignments").delete().eq("company_id", c['id']).neq("accountant_user_id", viktor_id).execute()
    print(f"  Törölt hozzárendelések száma: {len(res.data)}")

