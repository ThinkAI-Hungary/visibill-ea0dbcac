import sys
import os
import json
from dotenv import load_dotenv
from supabase import create_client

sys.path.insert(0, r'c:\Users\adetw\.antigravity\visibill\visibill-worker')
load_dotenv(r'c:\Users\adetw\.antigravity\visibill\visibill-worker\.env')

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(url, key)

UPLOAD_ID = "4c94617f-0397-46da-b265-0479c2bd9af3"

def main():
    print(f"Fetching upload record for {UPLOAD_ID}...")
    res = supabase.table("invoice_uploads").select("*").eq("id", UPLOAD_ID).execute()
    if not res.data:
        print("Record not found!")
        return
    row = res.data[0]

    # Reset upload status
    print("Resetting upload status to 'uploaded'...")
    supabase.table("invoice_uploads").update({
        "upload_status": "uploaded",
        "error_message": None,
        "metadata": None  # clear old metadata (refusal text)
    }).eq("id", UPLOAD_ID).execute()

    # Build job payload
    payload = {
        "id": UPLOAD_ID,
        "upload_id": UPLOAD_ID,
        "user_id": row.get("user_id"),
        "company_id": row.get("company_id"),
        "file_url": row.get("file_url"),
        "file_name": row.get("file_name"),
        "file_type": row.get("file_type"),
        "file_size": row.get("file_size"),
        "metadata": {}
    }
    
    # Enqueue to pgmq queue invoice_jobs
    # PGMQ enqueue RPC: pgmq_send(queue_name, message)
    print("Enqueueing job to PGMQ...")
    # Wait, the pgmq send signature is: pgmq.send(queue_name, message_json)
    # E.g. select pgmq_send('invoice_jobs', '{"upload_id": ...}')
    try:
        supabase.rpc("pgmq_send_retry", {
            "queue_name": "invoice_jobs",
            "msg": payload
        }).execute()
        print("Successfully enqueued job! The worker should pick it up shortly.")
    except Exception as e:
        print("Failed to call pgmq_send_retry RPC:", e)

if __name__ == "__main__":
    main()
