import sys, os
os.environ["PYTHONIOENCODING"] = "utf-8"
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, r"c:\Users\adetw\.antigravity\visibill\visibill-worker")
from dotenv import load_dotenv
load_dotenv(r"c:\Users\adetw\.antigravity\visibill\visibill-worker\.env")
from supabase import create_client
sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

print("=== CHECKING USER ASSIGNMENTS ===")
# User IDs from screenshot
# Teszt Senior Könyvelő: '03bf83aa-1b90-44a8-ae12-09288d73a827'
user_id = '03bf83aa-1b90-44a8-ae12-09288d73a827'
assigns = sb.table("accounty_assignments").select("*").eq("accountant_user_id", user_id).execute()
for a in assigns.data:
    cid = a.get("company_id")
    comp = sb.table("companies").select("*").eq("id", cid).execute()
    c_name = comp.data[0].get("name") if comp.data else "None"
    print(f"Company ID: {cid}, Name: {c_name}")
