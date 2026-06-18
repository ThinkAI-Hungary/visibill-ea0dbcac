import sys, os
os.environ["PYTHONIOENCODING"] = "utf-8"
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, r"c:\Users\adetw\.antigravity\visibill\visibill-worker")
from dotenv import load_dotenv
load_dotenv(r"c:\Users\adetw\.antigravity\visibill\visibill-worker\.env")
from supabase import create_client
sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

print("=== ALL ASSIGNMENTS ===")
assigns = sb.table("accounty_assignments").select("*").execute()
for a in assigns.data:
    uid = a.get("accountant_user_id")
    cid = a.get("company_id")
    fid = a.get("accounting_firm_id")
    
    u_data = sb.table("profiles").select("name").eq("user_id", uid).maybe_single().execute()
    c_data = sb.table("companies").select("name").eq("id", cid).maybe_single().execute()
    f_data = sb.table("companies").select("name").eq("id", fid).maybe_single().execute()
    
    u_name = u_data.data.get("name") if u_data.data else "None"
    c_name = c_data.data.get("name") if c_data.data else "None"
    f_name = f_data.data.get("name") if f_data.data else "None"
    
    print(f"User: {u_name} ({uid}), Company: {c_name} ({cid}), Firm: {f_name} ({fid}), Role: {a.get('role')}")
