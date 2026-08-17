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
    email = "nagyd965@gmail.com"
    company_id = "ecf31039-b539-4e04-bbea-70ea48c701bb" # Think Ai Kft
    
    # 1. Lookup user by email using lookup_user_by_email RPC
    print(f"Calling lookup_user_by_email RPC for '{email}'...")
    res = supabase.rpc("lookup_user_by_email", {"p_email": email}).execute()
    
    user_id = None
    if res.data:
        user_id = res.data[0].get("user_id")
        name = res.data[0].get("name")
        print(f"FOUND! User ID: {user_id}, Name: {name}")
    else:
        print(f"User {email} not found via RPC lookup.")
        
        # Since it is not found, let's try creating the user via Auth Admin API
        print(f"Attempting to create/invite user '{email}' via Auth Admin API...")
        try:
            admin_res = supabase.auth.admin.create_user({
                "email": email,
                "email_confirm": True,
                "user_metadata": {"name": email.split("@")[0]}
            })
            if hasattr(admin_res, 'user'):
                user_id = admin_res.user.id
                print(f"SUCCESS! Created new user with ID: {user_id}")
            elif hasattr(admin_res, 'data') and admin_res.data:
                user_id = admin_res.data.id if hasattr(admin_res.data, 'id') else admin_res.data.get('id')
                print(f"SUCCESS! Created new user with ID: {user_id}")
            else:
                print("Failed to parse admin create response:", admin_res)
        except Exception as e:
            print("Error creating user via Auth Admin:", e)
            return

    if not user_id:
        print("Could not obtain user ID. Aborting.")
        return

    # 2. Grant eaisybill access in public.profiles
    print(f"\nGranting eaisybill_access to profile for user_id '{user_id}'...")
    # First check if profile exists
    profile_res = supabase.table("profiles").select("*").eq("user_id", user_id).execute()
    if profile_res.data:
        # Update existing profile
        update_res = supabase.table("profiles").update({
            "eaisybill_access": True,
            "eaisybooks_access": True
        }).eq("user_id", user_id).execute()
        print("Profile updated:", update_res.data)
    else:
        # Insert profile
        insert_res = supabase.table("profiles").insert({
            "user_id": user_id,
            "name": email.split("@")[0],
            "eaisybill_access": True,
            "eaisybooks_access": True
        }).execute()
        print("Profile inserted:", insert_res.data)

    # 3. Add to company_members
    print(f"\nAdding user to company_members (company_id: {company_id})...")
    # Check if membership already exists
    member_res = supabase.table("company_members").select("*").eq("user_id", user_id).eq("company_id", company_id).execute()
    if member_res.data:
        print("Membership already exists:", member_res.data)
    else:
        add_res = supabase.table("company_members").insert({
            "user_id": user_id,
            "company_id": company_id,
            "role": "member"
        }).execute()
        print("Membership added:", add_res.data)

if __name__ == "__main__":
    main()
