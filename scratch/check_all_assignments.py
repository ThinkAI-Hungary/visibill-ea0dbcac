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
    
    # Let's check when these assignments were created
    res = supabase.table("accounty_assignments").select("*").eq("accountant_user_id", user_id).execute()
    print(f"Total assignments for user {user_id}: {len(res.data)}")
    for a in res.data[:5]:
        print(f"ID: {a.get('id')}, Company ID: {a.get('company_id')}, Created At: {a.get('created_at')}, Role: {a.get('role')}")
        
    # Let's check who else has role='iroda_admin' in assignments
    res_admins = supabase.table("accounty_assignments").select("*").eq("role", "iroda_admin").execute()
    print(f"\nTotal iroda_admin assignments in system: {len(res_admins.data)}")
    users_with_iroda_admin = set(a.get('accountant_user_id') for a in res_admins.data)
    print("Users with iroda_admin assignment role:", users_with_iroda_admin)

if __name__ == "__main__":
    main()
