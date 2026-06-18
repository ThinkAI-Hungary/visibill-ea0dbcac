import sys, os
sys.path.insert(0, r"c:\Users\adetw\.antigravity\visibill\visibill-worker")
from dotenv import load_dotenv
load_dotenv(r"c:\Users\adetw\.antigravity\visibill\visibill-worker\.env")
from supabase import create_client
sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

print("--- Viktor Jámbor profiles ---")
res = sb.table("profiles").select("*").ilike("name", "%Viktor%").execute()
for p in res.data:
    print(p)
    uid = p.get("user_id") or p.get("id")
    print("Assignments:")
    assigns = sb.table("accounty_assignments").select("*").eq("accountant_user_id", uid).execute()
    for a in assigns.data:
        print(f"  Company: {a.get('company_id')}, Firm: {a.get('accounting_firm_id')}, Role: {a.get('role')}")
