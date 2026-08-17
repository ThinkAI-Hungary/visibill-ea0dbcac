import sys
import os
from dotenv import load_dotenv
from supabase import create_client

# Explicitly load from worker's .env file
load_dotenv(r'c:\Users\adetw\.antigravity\visibill\visibill-worker\.env')

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(url, key)

def inspect():
    # 1. Check columns in public.profiles
    print("Checking columns in public.profiles...")
    try:
        res_profiles = supabase.table("profiles").select("*").limit(1).execute()
        if res_profiles.data:
            print("Columns in profiles:", list(res_profiles.data[0].keys()))
            print("Sample profile row:", res_profiles.data[0])
        else:
            print("No profiles found to inspect.")
    except Exception as e:
        print("Error inspecting profiles:", e)
        
    # 2. Check columns in public.company_members
    print("\nChecking columns in public.company_members...")
    try:
        res_members = supabase.table("company_members").select("*").limit(1).execute()
        if res_members.data:
            print("Columns in company_members:", list(res_members.data[0].keys()))
            print("Sample member row:", res_members.data[0])
        else:
            print("No members found to inspect.")
    except Exception as e:
        print("Error inspecting company_members:", e)

if __name__ == "__main__":
    inspect()
