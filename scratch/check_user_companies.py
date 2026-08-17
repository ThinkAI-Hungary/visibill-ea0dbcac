import sys
import os
from dotenv import load_dotenv
from supabase import create_client

# Explicitly load from worker's .env file
load_dotenv(r'c:\Users\adetw\.antigravity\visibill\visibill-worker\.env')

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(url, key)

def check_memberships():
    user_id = "88230876-6dc3-4881-aed1-b99bcdb9df52"
    
    # 1. Query company_members for this user
    print("Querying public.company_members for user_id...")
    res = supabase.table("company_members").select("*, companies(name)").eq("user_id", user_id).execute()
    print("Memberships:")
    for m in res.data:
        print(f"  Company: {m.get('companies', {}).get('name')} (ID: {m.get('company_id')}), Role: {m.get('role')}")
        
    # 2. Query all companies to see if RLS or something else is bypassed or if there is another table
    # Let's check the user profile
    print("\nQuerying public.profiles for user_id...")
    res_prof = supabase.table("profiles").select("*").eq("user_id", user_id).execute()
    print("Profile:", res_prof.data)

if __name__ == "__main__":
    check_memberships()
