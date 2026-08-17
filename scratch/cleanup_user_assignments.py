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
    thinkai_company_id = "ecf31039-b539-4e04-bbea-70ea48c701bb"
    
    print("Deleting incorrect assignments for Nagy Daniel...")
    # Delete all assignments except Think Ai Kft
    res = supabase.table("accounty_assignments")\
        .delete()\
        .eq("accountant_user_id", user_id)\
        .neq("company_id", thinkai_company_id)\
        .execute()
        
    print(f"Deleted {len(res.data) if res.data else 0} incorrect assignments.")
    if res.data:
        for a in res.data:
            print(f"  Deleted assignment ID: {a.get('id')} for Company ID: {a.get('company_id')}")

if __name__ == "__main__":
    main()
