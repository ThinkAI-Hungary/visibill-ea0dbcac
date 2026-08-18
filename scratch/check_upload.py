import sys
import os
from dotenv import load_dotenv
from supabase import create_client

sys.path.insert(0, r'c:\Users\adetw\.antigravity\visibill\visibill-worker')
load_dotenv(r'c:\Users\adetw\.antigravity\visibill\visibill-worker\.env')

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(url, key)

def main():
    print("Fetching recent uploads...")
    res = supabase.table("invoice_uploads").select("*").order("created_at", desc=True).limit(5).execute()
    for row in res.data:
        print(f"ID: {row.get('id')}")
        print(f"  File name: {row.get('file_name')}")
        print(f"  Status: {row.get('upload_status')}")
        print(f"  Created at: {row.get('created_at')}")
        print(f"  Error message: {row.get('error_message')}")
        print(f"  Metadata: {row.get('metadata')}")
        print("-" * 40)

if __name__ == "__main__":
    main()
