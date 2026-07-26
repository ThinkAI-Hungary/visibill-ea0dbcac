import json
import urllib.request
import urllib.error

URL = "https://vxxgvdlqvvchtlmqnrqf.supabase.co"
APIKEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NzAwNTAsImV4cCI6MjA3MzU0NjA1MH0.Ec9KFcjt89cY6FF9Nq9GnW1hzlnDUhQCCJ_LhWm2evY"
SANDBOX_COMPANY_ID = "59b545c0-5818-4499-ac5e-06afc0880e73"

def make_request(path, method, body=None, token=None):
    headers = {
        "apikey": APIKEY,
        "Content-Type": "application/json"
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
        
    data = json.dumps(body).encode('utf-8') if body else None
    req = urllib.request.Request(f"{URL}{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as res:
            res_content = res.read().decode('utf-8')
            return json.loads(res_content) if res_content else {}
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode('utf-8')
        print(f"HTTP Error {e.code} on {method} {path}: {err_msg}")
        raise e
    except Exception as e:
        print(f"Error on {method} {path}: {e}")
        raise e

def main():
    print("Logging in as sandbox@thinkai.hu...")
    login_res = make_request("/auth/v1/token?grant_type=password", "POST", {
        "email": "sandbox@thinkai.hu",
        "password": "SANDBOXTHINKAI."
    })
    token = login_res["access_token"]
    print("Login successful!")

    # Check if transaction already exists
    print("Checking if test transaction exists...")
    existing = make_request(f"/rest/v1/transactions?company_id=eq.{SANDBOX_COMPANY_ID}&description=eq.Transfers%20Kft.%20-%20Szamlak:%20TEST-UTAL-01&select=id", "GET", token=token)
    if existing:
        print("Test transaction already exists. Deleting it to ensure clean seed...")
        make_request(f"/rest/v1/transactions?id=eq.{existing[0]['id']}", "DELETE", token=token)

    new_tx = {
        "company_id": SANDBOX_COMPANY_ID,
        "amount": -15000,
        "currency": "HUF",
        "description": "Transfers Kft. - Szamlak: TEST-UTAL-01",
        "transaction_date": "2026-07-27",
        "type": "payment",
        "match_type": None,
        "confidence_score": 0.0,
        "is_verified": False,
        "reason": None
    }

    print("Inserting new unmatched transaction...")
    res = make_request("/rest/v1/transactions", "POST", new_tx, token=token)
    print("Successfully seeded unmatched bank transaction!")

if __name__ == "__main__":
    main()
