import sys, os
os.environ["PYTHONIOENCODING"] = "utf-8"
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, r"c:\Users\adetw\.antigravity\visibill\visibill-worker")
from dotenv import load_dotenv
load_dotenv(r"c:\Users\adetw\.antigravity\visibill\visibill-worker\.env")
from supabase import create_client
sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

print("=== VIKTOR JAMBOR ===")
profiles = sb.table("profiles").select("*").ilike("name", "%Viktor%").execute()
for p in profiles.data:
    uid = p.get("user_id")
    print(f"User: {p.get('name')}, ID: {uid}")
    assigns = sb.table("accounty_assignments").select("*").eq("accountant_user_id", uid).execute()
    for a in assigns.data:
        cid = a.get("company_id")
        fid = a.get("accounting_firm_id")
        c_data = sb.table("companies").select("name").eq("id", cid).maybe_single().execute()
        f_data = sb.table("companies").select("name").eq("id", fid).maybe_single().execute()
        c_name = c_data.data.get("name") if c_data.data else "None"
        f_name = f_data.data.get("name") if f_data.data else "None"
        print(f"  Assignment - Company: {c_name} ({cid}), Firm: {f_name} ({fid}), Role: {a.get('role')}")
