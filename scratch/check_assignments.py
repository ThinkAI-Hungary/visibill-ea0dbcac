import sys
import os
from dotenv import load_dotenv
from supabase import create_client

# Explicitly load from worker's .env file
load_dotenv(r'c:\Users\adetw\.antigravity\visibill\visibill-worker\.env')

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(url, key)

def main():
    user_id = "88230876-6dc3-4881-aed1-b99bcdb9df52"
    
    print("Querying accounty_assignments for user_id...")
    res = supabase.table("accounty_assignments").select("*, companies!accounty_assignments_company_id_fkey(name)").eq("accountant_user_id", user_id).execute()
    print("Assignments count:", len(res.data))
    for a in res.data:
        comp_name = a.get('companies', {}).get('name') if a.get('companies') else 'None'
        comp_name_safe = str(comp_name).encode('ascii', 'replace').decode('ascii')
        print(f"  Company: {comp_name_safe} (ID: {a.get('company_id')}), Role: {a.get('role')}, Main: {a.get('is_main_accountant')}")

if __name__ == "__main__":
    main()
