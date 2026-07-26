import json
import urllib.request
import urllib.error
import sys

URL = "https://vxxgvdlqvvchtlmqnrqf.supabase.co"
APIKEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NzAwNTAsImV4cCI6MjA3MzU0NjA1MH0.Ec9KFcjt89cY6FF9Nq9GnW1hzlnDUhQCCJ_LhWm2evY"
SANDBOX_USER_ID = "938e8745-2796-494f-b186-323d138d452e"
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

    # Check if a manual invoice with this number already exists
    print("Checking if invoice TEST-UTAL-01 exists...")
    existing = make_request(f"/rest/v1/invoices?company_id=eq.{SANDBOX_COMPANY_ID}&bizonylatsorszam=eq.TEST-UTAL-01&select=id", "GET", token=token)
    if existing:
        print("Invoice TEST-UTAL-01 already exists. Deleting it to ensure clean seed...")
        make_request(f"/rest/v1/invoices?id=eq.{existing[0]['id']}", "DELETE", token=token)

    new_invoice = {
        "user_id": SANDBOX_USER_ID,
        "company_id": SANDBOX_COMPANY_ID,
        "bizonylatsorszam": "TEST-UTAL-01",
        "kibocsatas_datuma": "2026-07-25",
        "elado_nev": "Transfers Kft.",
        "elado_cim": "1052 Budapest, Deák Ferenc tér 1.",
        "elado_vat_id": "22334455-2-42",
        "vevo_nev": "Think AI Kft.",
        "vevo_cim": "1234 Budapest, Sandbox utca 1",
        "vevo_vat_id": "12345678-2-42",
        "adoalap_osszesen": 11811,
        "afa_osszeg_osszesen": 3189,
        "brutto_vegosszeg": 15000,
        "fizetendo_osszeg": 15000,
        "fizetesi_hatarido": "2026-07-26",
        "fizetesi_mod": "TRANSFER",
        "penznem": "HUF",
        "fizetve": False,
        "statusz": "feldolgozott",
        "invoice_direction": "INBOUND",
        "invoice_type": "sima_szla",
        "teljesites_datuma": "2026-07-25",
        "bankszamlaszam_iban": "10201006-50075436-00000000"
    }

    print("Inserting new unpaid invoice...")
    res = make_request("/rest/v1/invoices", "POST", new_invoice, token=token)
    print("Successfully seeded unpaid invoice TEST-UTAL-01!")

if __name__ == "__main__":
    main()
