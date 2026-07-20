import os
from dotenv import load_dotenv
from supabase import create_client

# Load env from visibill-worker
dotenv_path = r"c:\Users\adetw\.antigravity\visibill\visibill-worker\.env"
load_dotenv(dotenv_path)

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

client = create_client(url, key)

def safe_str(s):
    if not s:
        return ""
    return str(s).encode("ascii", errors="replace").decode("ascii")

# Get companies
companies = client.table("companies").select("id, name").execute().data
print("Companies:")
for c in companies:
    print(f"  - {safe_str(c['name'])} (ID: {c['id']})")

# Let's inspect the active presets and mappings for each company
for c in companies:
    co_id = c['id']
    # Get presets
    presets = client.table("chart_of_accounts_presets").select("id, name, company_id").eq("company_id", co_id).execute().data
    # Also fetch generic presets
    generic_presets = client.table("chart_of_accounts_presets").select("id, name, company_id").is_("company_id", "null").execute().data
    all_presets = presets + generic_presets
    
    print(f"\nSuggestions for company '{safe_str(c['name'])}':")
    for p in all_presets:
        is_generic = p.get('company_id') is None
        # Call suggest_gl_mappings RPC
        try:
            res = client.rpc("suggest_gl_mappings", {
                "p_company_id": co_id,
                "p_preset_id": p['id']
            }).execute()
            
            pnl_suggs = [s for s in (res.data or []) if s.get("pnl_structure_id")]
            print(f"  Preset: {safe_str(p['name'])} ({'Generic' if is_generic else 'Custom'}) - ID: {p['id']}")
            print(f"    - Total suggestions: {len(res.data or [])}")
            print(f"    - P&L suggestions: {len(pnl_suggs)}")
            if len(pnl_suggs) > 0:
                print(f"      Examples:")
                for s in pnl_suggs[:3]:
                    print(f"        * {s['gl_number']} {safe_str(s['short_name'])} -> {s['pnl_row_code']} {safe_str(s['pnl_row_name'])}")
        except Exception as e:
            print(f"  Preset: {safe_str(p['name'])} - Error: {e}")
