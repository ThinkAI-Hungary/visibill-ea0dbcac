import sys
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(r'c:\Users\adetw\.antigravity\visibill\visibill-worker\.env')

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(url, key)

def main():
    # Query function definitions from pg_catalog via postgrest if possible,
    # or just query pg_proc using a select statement or RPC if there's one.
    # Wait, postgrest exposes tables/views. Let's see if we can read information_schema or similar.
    try:
        res = supabase.table("pg_proc").select("*").limit(5).execute()
        print("pg_proc data:", res.data)
    except Exception as e:
        print("Could not query pg_proc table directly:", e)
        
    # Let's try RPC pg_proc or pg_catalog if exposed
    # Or let's see if we can find all functions via supabase.rpc
    # Wait, we can query the swagger API docs of postgrest!
    # Postgrest exposes /rpc/ or / to get the schema including all functions!
    import httpx
    try:
        headers = {"apikey": key, "Authorization": f"Bearer {key}"}
        resp = httpx.get(f"{url}/rest/v1/", headers=headers)
        if resp.status_code == 200:
            swagger = resp.json()
            paths = swagger.get("paths", {})
            rpcs = [p for p in paths.keys() if p.startswith("/rpc/")]
            print("\nExposed RPCs:")
            for r in sorted(rpcs):
                print(r)
        else:
            print(f"Failed to get Swagger schema: {resp.status_code} {resp.text}")
    except Exception as e:
        print("Failed to query Swagger API:", e)

if __name__ == "__main__":
    main()
