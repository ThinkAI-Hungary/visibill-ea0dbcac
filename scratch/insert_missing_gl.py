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
    # 1. Find Victoria Music Kft by tax number or name
    print("Finding Victoria Music Kft...")
    comp_res = supabase.table("companies").select("*").ilike("name", "%Victoria Music%").execute()
    if not comp_res.data:
        print("Victoria Music Kft not found.")
        return
        
    company = comp_res.data[0]
    company_id = company.get("id")
    print(f"Found Company: {company.get('name')} (ID: {company_id})")
    
    # 2. Find active custom preset for this company
    print("\nFinding active custom preset...")
    preset_res = supabase.table("chart_of_accounts_presets")\
        .select("*")\
        .eq("company_id", company_id)\
        .eq("is_active", True)\
        .execute()
        
    if not preset_res.data:
        print("No active preset found for this company.")
        return
        
    preset = preset_res.data[0]
    preset_id = preset.get("id")
    print(f"Found Active Preset: {preset.get('name')} (ID: {preset_id}, Type: {preset.get('type')})")
    
    # 3. Check if GL 92 already exists in gl_accounts for this preset
    gl_res = supabase.table("gl_accounts")\
        .select("*")\
        .eq("preset_id", preset_id)\
        .eq("gl_number", "92")\
        .execute()
        
    if gl_res.data:
        print("\nGL Account 92 already exists for this preset:")
        print(gl_res.data[0])
    else:
        print("\nGL Account 92 is missing. Inserting...")
        insert_res = supabase.table("gl_accounts").insert({
            "preset_id": preset_id,
            "gl_number": "92",
            "short_name": "EXPORTÉRTÉKESÍTÉS ÁRBEVÉTELE",
            "description": None
        }).execute()
        print("Insert Result:", insert_res.data)

if __name__ == "__main__":
    main()
