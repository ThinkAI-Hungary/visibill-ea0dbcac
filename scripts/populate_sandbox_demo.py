import json
import urllib.request
import urllib.error
import sys

# Constants
URL = "https://vxxgvdlqvvchtlmqnrqf.supabase.co"
APIKEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NzAwNTAsImV4cCI6MjA3MzU0NjA1MH0.Ec9KFcjt89cY6FF9Nq9GnW1hzlnDUhQCCJ_LhWm2evY"
SANDBOX_USER_ID = "938e8745-2796-494f-b186-323d138d452e"
SANDBOX_COMPANY_ID = "59b545c0-5818-4499-ac5e-06afc0880e73"

# Category IDs
CAT_IT = "a0000001-0000-0000-0000-000000000007"       # IT es szoftver
CAT_OFFICE = "a0000001-0000-0000-0000-000000000001"   # Irodaszer
CAT_MARKETING = "a0000001-0000-0000-0000-000000000005"# Marketing
CAT_UTILITIES = "a0000001-0000-0000-0000-000000000003"# Kozuzemi dijak
CAT_CATERING = "a0000001-0000-0000-0000-000000000015" # Egyeb koltseg
CAT_BANK_FEE = "a0000001-0000-0000-0000-000000000008" # Bankkoltseg
CAT_SALARY = "a0000001-0000-0000-0000-000000000011"   # Berek es juttatasok
CAT_TAX = "a0000001-0000-0000-0000-000000000010"      # Adok es jaruiekok
CAT_SHIPPING = "a0000001-0000-0000-0000-000000000006" # Szallitas

# Project IDs
PROJ_WEBSHOP = "b0000001-0000-0000-0000-000000000001" # Webshop fejlesztes
PROJ_MKT_Q1 = "b0000001-0000-0000-0000-000000000002"  # Marketing kampany Q1
PROJ_OFFICE = "b0000001-0000-0000-0000-000000000003"  # Irodabovites

# Static UUIDs for demo scenarios to ensure clean relations
# Hex-compliant prefixes: f1, f2, f3, f4, f5, f6, f7
T_IDS = [f"f1000000-0000-0000-0000-0000000000{i:02d}" for i in range(1, 30)]
I_IDS = [f"f2000000-0000-0000-0000-0000000000{i:02d}" for i in range(1, 30)]
N_IDS = [f"f3000000-0000-0000-0000-0000000000{i:02d}" for i in range(1, 30)]
S_IDS = [f"f4000000-0000-0000-0000-0000000000{i:02d}" for i in range(1, 30)]
SF_IDS = [f"f5000000-0000-0000-0000-0000000000{i:02d}" for i in range(1, 30)]
U_IDS = [f"f6000000-0000-0000-0000-0000000000{i:02d}" for i in range(1, 10)]
CR_IDS = [f"f7000000-0000-0000-0000-0000000000{i:02d}" for i in range(1, 10)]

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

    # Verify Company ID
    print(f"Verifying target company ID: {SANDBOX_COMPANY_ID}...")
    companies = make_request("/rest/v1/companies?select=id,name", "GET", token=token)
    sandbox_comp = [c for c in companies if c['id'] == SANDBOX_COMPANY_ID]
    if not sandbox_comp:
        print(f"CRITICAL ERROR: Company {SANDBOX_COMPANY_ID} not found for this user!")
        sys.exit(1)
    print(f"Company verified: {sandbox_comp[0]['name']}")

    # ╔══════════════════════════════════════════════════════════════════════╗
    # ║ STEP 1: SAFE CLEANUP — Only delete SANDBOX company rows            ║
    # ╚══════════════════════════════════════════════════════════════════════╝
    print("\n--- Starting Clean Up for SANDBOX company data ---")

    # 1aa. Delete courier_reports
    print("Deleting courier_reports...")
    make_request(f"/rest/v1/courier_reports?company_id=eq.{SANDBOX_COMPANY_ID}", "DELETE", token=token)

    # 1ab. Delete report_uploads
    print("Deleting report_uploads...")
    make_request(f"/rest/v1/report_uploads?company_id=eq.{SANDBOX_COMPANY_ID}", "DELETE", token=token)

    # 1a. Unlink transactions on invoices and nav_invoices
    print("Unlinking transactions from invoices...")
    make_request(f"/rest/v1/invoices?company_id=eq.{SANDBOX_COMPANY_ID}", "PATCH", {"transaction_id": None}, token=token)
    print("Unlinking transactions from nav_invoices...")
    make_request(f"/rest/v1/nav_invoices?company_id=eq.{SANDBOX_COMPANY_ID}", "PATCH", {"transaction_id": None}, token=token)

    # 1b. Unlink matched_invoice_id on transactions
    print("Unlinking matched invoices from transactions...")
    make_request(f"/rest/v1/transactions?company_id=eq.{SANDBOX_COMPANY_ID}", "PATCH", {"matched_invoice_id": None}, token=token)

    # 1c. Delete nav_invoice_items
    print("Fetching nav_invoices to delete their items...")
    nav_invs = make_request(f"/rest/v1/nav_invoices?company_id=eq.{SANDBOX_COMPANY_ID}&select=id", "GET", token=token)
    nav_inv_ids = [n['id'] for n in nav_invs]
    if nav_inv_ids:
        print(f"Deleting nav_invoice_items for {len(nav_inv_ids)} nav_invoices...")
        # Delete in chunks or with in filter
        ids_str = ",".join(nav_inv_ids)
        make_request(f"/rest/v1/nav_invoice_items?nav_invoice_id=in.({ids_str})", "DELETE", token=token)

    # 1cc. Delete invoice_items
    print("Fetching invoices to delete their items...")
    invs = make_request(f"/rest/v1/invoices?company_id=eq.{SANDBOX_COMPANY_ID}&select=id", "GET", token=token)
    inv_ids = [i['id'] for i in invs]
    if inv_ids:
        print(f"Deleting invoice_items for {len(inv_ids)} invoices...")
        ids_str = ",".join(inv_ids)
        make_request(f"/rest/v1/invoice_items?invoice_id=in.({ids_str})", "DELETE", token=token)

    # 1d. Delete nav_invoices
    print("Deleting nav_invoices...")
    make_request(f"/rest/v1/nav_invoices?company_id=eq.{SANDBOX_COMPANY_ID}", "DELETE", token=token)

    # 1e. Delete invoices
    print("Deleting invoices...")
    make_request(f"/rest/v1/invoices?company_id=eq.{SANDBOX_COMPANY_ID}", "DELETE", token=token)

    # 1ea. Delete categories
    print("Deleting categories...")
    make_request(f"/rest/v1/categories?company_id=eq.{SANDBOX_COMPANY_ID}", "DELETE", token=token)

    # 1eb. Delete projects
    print("Deleting projects...")
    make_request(f"/rest/v1/projects?company_id=eq.{SANDBOX_COMPANY_ID}", "DELETE", token=token)

    # 1f. Delete salaries
    print("Deleting salaries...")
    make_request(f"/rest/v1/salary?company_id=eq.{SANDBOX_COMPANY_ID}", "DELETE", token=token)

    # 1g. Delete salary files
    print("Deleting salary files...")
    make_request(f"/rest/v1/salary_files?company_id=eq.{SANDBOX_COMPANY_ID}", "DELETE", token=token)

    # 1h. Delete taxes
    print("Deleting taxes...")
    make_request(f"/rest/v1/tax?company_id=eq.{SANDBOX_COMPANY_ID}", "DELETE", token=token)

    # 1i. Delete transactions
    print("Deleting transactions...")
    make_request(f"/rest/v1/transactions?company_id=eq.{SANDBOX_COMPANY_ID}", "DELETE", token=token)

    # 1j. Delete transaction uploads
    print("Deleting transaction uploads...")
    make_request(f"/rest/v1/transaction_uploads?company_id=eq.{SANDBOX_COMPANY_ID}", "DELETE", token=token)

    # 1k. Delete invoice uploads
    print("Deleting invoice uploads...")
    make_request(f"/rest/v1/invoice_uploads?company_id=eq.{SANDBOX_COMPANY_ID}", "DELETE", token=token)

    print("Cleanup completed successfully! Database is primed.")

    # ╔══════════════════════════════════════════════════════════════════════╗
    # ║ STEP 2: INSERT CURATED DATA — 15 Scenarios                         ║
    # ╚══════════════════════════════════════════════════════════════════════╝
    print("\n--- Seeding 15 Curated Demo Scenarios ---")

    # 2aa. Insert Categories
    categories_to_insert = [
        {"id": CAT_IT, "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID, "name": "IT és szoftver", "description": "Szoftver licencek, hosting, IT szolgáltatások"},
        {"id": CAT_OFFICE, "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID, "name": "Irodaszer", "description": "Irodai kellekek, papír, írószer"},
        {"id": CAT_MARKETING, "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID, "name": "Marketing", "description": "Reklám, online marketing, PR kampányok"},
        {"id": CAT_UTILITIES, "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID, "name": "Közüzemi díjak", "description": "Víz, gáz, villany, internet díjak"},
        {"id": CAT_CATERING, "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID, "name": "Egyéb költség", "description": "Reprezentáció, catering, egyéb dologi kiadások"},
        {"id": CAT_BANK_FEE, "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID, "name": "Bankköltség", "description": "Tranzakciós díjak, számlavezetési díj"},
        {"id": CAT_SALARY, "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID, "name": "Bérek és juttatások", "description": "Személyi jellegű kifizetések, nettó bérek"},
        {"id": CAT_TAX, "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID, "name": "Adók és járulékok", "description": "ÁFA, járulékok, egyéb adónemek"},
        {"id": CAT_SHIPPING, "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID, "name": "Szállítás", "description": "Futárszolgálati díjak, postaköltségek"}
    ]
    print("Inserting categories...")
    make_request("/rest/v1/categories", "POST", categories_to_insert, token=token)

    # 2ab. Insert Projects
    projects_to_insert = [
        {
            "id": PROJ_WEBSHOP, "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID,
            "name": "Webshop fejlesztés", "description": "A vállalati webáruház motor cseréje és mobil optimalizálása",
            "project_code": "PRJ-001", "project_type": "IT", "client_name": "Belső projekt",
            "budget": 2500000, "start_date": "2026-01-01", "end_date": "2026-12-31", "status": "active"
        },
        {
            "id": PROJ_MKT_Q1, "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID,
            "name": "Marketing kampány Q1", "description": "Tavaszi online marketing kampány, PPC és tartalomgyártás",
            "project_code": "PRJ-002", "project_type": "Marketing", "client_name": "Belső projekt",
            "budget": 1500000, "start_date": "2026-02-01", "end_date": "2026-05-31", "status": "completed"
        },
        {
            "id": PROJ_OFFICE, "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID,
            "name": "Irodabővítés", "description": "Új irodai munkaállomások kialakítása és bútorok beszerzése",
            "project_code": "PRJ-003", "project_type": "Operations", "client_name": "Belső projekt",
            "budget": 800000, "start_date": "2026-03-01", "end_date": "2026-06-30", "status": "completed"
        }
    ]
    print("Inserting projects...")
    make_request("/rest/v1/projects", "POST", projects_to_insert, token=token)

    # 2a. Insert Transactions (Insert first so we can reference them)
    transactions_to_insert = [
        # Case 1: Telekom Outgoing Auto-Matched
        {
            "id": T_IDS[0], "company_id": SANDBOX_COMPANY_ID, "amount": -15420, "currency": "HUF",
            "description": "Magyar Telekom Nyrt. Havidíj - NAV-2026-0001", "transaction_date": "2026-06-02",
            "type": "payment", "match_type": "auto", "confidence_score": 1.0, "is_verified": True, "reason": "Exact amount and name match"
        },
        # Case 2: Hetzner Outgoing EUR Auto-Matched
        {
            "id": T_IDS[1], "company_id": SANDBOX_COMPANY_ID, "amount": -17212, "currency": "HUF",
            "description": "Hetzner Online GmbH EUR 42.50 kártyás fizetés", "transaction_date": "2026-06-06",
            "type": "payment", "match_type": "auto", "confidence_score": 1.0, "is_verified": True, "reason": "Amount matches after EUR/HUF conversion"
        },
        # Case 3: Alfa Kft Incoming Auto-Matched
        {
            "id": T_IDS[2], "company_id": SANDBOX_COMPANY_ID, "amount": 450000, "currency": "HUF",
            "description": "Alfa Kft. - Tanácsadási díj NAV-2026-OUT01", "transaction_date": "2026-05-22",
            "type": "receipt", "match_type": "auto", "confidence_score": 1.0, "is_verified": True, "reason": "Exact invoice number in comment"
        },
        # Case 4: Origo Office manual match candidate (Name mismatch)
        {
            "id": T_IDS[3], "company_id": SANDBOX_COMPANY_ID, "amount": -8400, "currency": "HUF",
            "description": "Origo Irodaszer - irodaszer vásárlás", "transaction_date": "2026-06-11",
            "type": "payment", "match_type": None, "confidence_score": 0.85, "is_verified": False, "reason": "Amount matches exactly, name is similar"
        },
        # Case 5: Google Cloud manual match candidate (Amount mismatch)
        {
            "id": T_IDS[4], "company_id": SANDBOX_COMPANY_ID, "amount": -12490, "currency": "HUF",
            "description": "GOOGLE*CLOUD Ireland - IT service", "transaction_date": "2026-06-09",
            "type": "payment", "match_type": None, "confidence_score": 0.78, "is_verified": False, "reason": "Name matches exactly, amount has minor discrepancy"
        },
        # Case 8: Gamma Bt Bulk match (Two invoices: 150k + 200k = 350k)
        {
            "id": T_IDS[5], "company_id": SANDBOX_COMPANY_ID, "amount": 350000, "currency": "HUF",
            "description": "Gamma Bt. - Projekt számlák kiegyenlítése", "transaction_date": "2026-06-03",
            "type": "receipt", "match_type": "auto", "confidence_score": 0.9, "is_verified": True, "reason": "Sum of multiple outstanding invoices matches exactly"
        },
        # Case 11: Unmatched Bank Fee
        {
            "id": T_IDS[6], "company_id": SANDBOX_COMPANY_ID, "amount": -1200, "currency": "HUF",
            "description": "OTP Bank - Havi számlavezetési és zárlati díj", "transaction_date": "2026-05-31",
            "type": "payment", "match_type": None, "confidence_score": 0.0, "is_verified": False, "reason": "Bank charge - no invoice expected"
        },
        # Case 12: Unmatched Petrol Card Purchase
        {
            "id": T_IDS[7], "company_id": SANDBOX_COMPANY_ID, "amount": -18500, "currency": "HUF",
            "description": "MOL Töltőállomás Budapest - Üzemanyag", "transaction_date": "2026-06-14",
            "type": "payment", "match_type": None, "confidence_score": 0.0, "is_verified": False, "reason": "Card payment - pending receipt upload"
        },
        # Case 13: Salary Payment
        {
            "id": T_IDS[8], "company_id": SANDBOX_COMPANY_ID, "amount": -480000, "currency": "HUF",
            "description": "Utalás: Havi bér Nagy János - Május", "transaction_date": "2026-06-10",
            "type": "payment", "match_type": "auto", "confidence_score": 1.0, "is_verified": True, "reason": "Matched to salary ledger"
        },
        # Case 14: Tax Payment
        {
            "id": T_IDS[9], "company_id": SANDBOX_COMPANY_ID, "amount": -250000, "currency": "HUF",
            "description": "NAV Áfa befizetés 2026 Q1", "transaction_date": "2026-05-15",
            "type": "payment", "match_type": "auto", "confidence_score": 1.0, "is_verified": True, "reason": "Matched to tax record"
        },
        # Case 16: Suggested Match Transaction (Optic-Net)
        {
            "id": T_IDS[10], "company_id": SANDBOX_COMPANY_ID, "amount": -15600, "currency": "HUF",
            "description": "OPTIC-NET KFT - internetszolgáltatás", "transaction_date": "2026-06-12",
            "type": "payment", "match_type": None, "confidence_score": 0.85, "is_verified": False, "reason": "Amount matches exactly, name is similar"
        },
        # Case 17: GLS COD Payout (receipt/utánvét)
        {
            "id": T_IDS[11], "company_id": SANDBOX_COMPANY_ID, "amount": 142800, "currency": "HUF",
            "description": "10918001-00000002-56360099 GLS GENERAL LOG.SYSTEMS HUNG.CSO COD-2026.06.05/Közv.futárpostai szolg. ellenérték 26112", "transaction_date": "2026-06-05",
            "type": "receipt", "match_type": "auto", "confidence_score": 1.0, "is_verified": True, "reason": "Courier COD payout settlement"
        },
        # Case 18: MPL/POSTA COD Payout (receipt/utánvét)
        {
            "id": T_IDS[12], "company_id": SANDBOX_COMPANY_ID, "amount": 84900, "currency": "HUF",
            "description": "0020173780 MAGYAR POSTA ZRT. PB2P15 0028810,2892 UTV VSWEB KFT. 26120", "transaction_date": "2026-06-06",
            "type": "receipt", "match_type": "auto", "confidence_score": 1.0, "is_verified": True, "reason": "Courier COD payout settlement"
        },
        # Case 19: Mixpakk COD Payout (receipt/utánvét)
        {
            "id": T_IDS[13], "company_id": SANDBOX_COMPANY_ID, "amount": 110325, "currency": "HUF",
            "description": "12012204-01675611-00200001 MIXPAKK KFT. utánvét 26132", "transaction_date": "2026-06-07",
            "type": "receipt", "match_type": "auto", "confidence_score": 1.0, "is_verified": True, "reason": "Courier COD payout settlement"
        },
        # Case 20: Mixpakk Courier Service Fees (payment/kifizetés)
        {
            "id": T_IDS[14], "company_id": SANDBOX_COMPANY_ID, "amount": -38200, "currency": "HUF",
            "description": "12012204-01675611-00100004 Mixpakk kft 2026/1842 26205", "transaction_date": "2026-06-10",
            "type": "payment", "match_type": "auto", "confidence_score": 1.0, "is_verified": True, "reason": "Payment for shipping invoice"
        }
    ]

    print("Inserting transactions...")
    make_request("/rest/v1/transactions", "POST", transactions_to_insert, token=token)

    # 2b. Insert Invoices (linked to Transactions where applicable)
    invoices_to_insert = [
        # Case 1: Telekom (Paid / Matched)
        {
            "id": I_IDS[0], "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID,
            "bizonylatsorszam": "NAV-2026-0001", "kibocsatas_datuma": "2026-06-01",
            "elado_nev": "Magyar Telekom Nyrt.", "elado_cim": "1097 Budapest, Könyves Kálmán körút 36.", "elado_vat_id": "10811886-2-44",
            "vevo_nev": "SANDBOX", "vevo_cim": "1234 Budapest, Sandbox utca 1", "vevo_vat_id": "12345678-2-42",
            "adoalap_osszesen": 12142, "afa_osszeg_osszesen": 3278, "brutto_vegosszeg": 15420, "fizetendo_osszeg": 15420,
            "fizetesi_hatarido": "2026-06-15", "fizetesi_mod": "TRANSFER", "penznem": "HUF", "fizetve": True, "statusz": "kifizetve",
            "category_id": CAT_IT, "project_id": PROJ_WEBSHOP, "transaction_id": T_IDS[0], "invoice_direction": "INBOUND",
            "invoice_type": "sima_szla", "teljesites_datuma": "2026-06-01", "feldolgozva": "2026-06-01T12:00:00Z"
        },
        # Case 2: Hetzner (Paid / Matched EUR)
        {
            "id": I_IDS[1], "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID,
            "bizonylatsorszam": "HTZ-889310", "kibocsatas_datuma": "2026-06-05",
            "elado_nev": "Hetzner Online GmbH", "elado_cim": "Industriestr. 25, 91710 Gunzenhausen, Germany", "elado_vat_id": "DE202897834",
            "vevo_nev": "SANDBOX", "vevo_cim": "1234 Budapest, Sandbox utca 1", "vevo_vat_id": "12345678-2-42",
            "adoalap_osszesen": 42.50, "afa_osszeg_osszesen": 0, "brutto_vegosszeg": 42.50, "fizetendo_osszeg": 42.50,
            "fizetesi_hatarido": "2026-06-19", "fizetesi_mod": "CARD", "penznem": "EUR", "fizetve": True, "statusz": "kifizetve",
            "category_id": CAT_IT, "project_id": PROJ_WEBSHOP, "transaction_id": T_IDS[1], "invoice_direction": "INBOUND",
            "invoice_type": "sima_szla", "teljesites_datuma": "2026-06-05", "feldolgozva": "2026-06-05T12:00:00Z"
        },
        # Case 3: Alfa Kft (Outbound Paid / Matched)
        {
            "id": I_IDS[2], "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID,
            "bizonylatsorszam": "NAV-2026-OUT01", "kibocsatas_datuma": "2026-05-20",
            "elado_nev": "SANDBOX", "elado_cim": "1234 Budapest, Sandbox utca 1", "elado_vat_id": "12345678-2-42",
            "vevo_nev": "Alfa Kft.", "vevo_cim": "1118 Budapest, Rétköz utca 5.", "vevo_vat_id": "98765432-1-11",
            "adoalap_osszesen": 354330, "afa_osszeg_osszesen": 95670, "brutto_vegosszeg": 450000, "fizetendo_osszeg": 450000,
            "fizetesi_hatarido": "2026-06-04", "fizetesi_mod": "TRANSFER", "penznem": "HUF", "fizetve": True, "statusz": "kifizetve",
            "category_id": CAT_MARKETING, "project_id": PROJ_MKT_Q1, "transaction_id": T_IDS[2], "invoice_direction": "OUTBOUND",
            "invoice_type": "sima_szla", "teljesites_datuma": "2026-05-20", "feldolgozva": "2026-05-20T12:00:00Z"
        },
        # Case 4: Origo Office (Manual Match Pending - unlinked in DB)
        {
            "id": I_IDS[3], "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID,
            "bizonylatsorszam": "ORG-2026-884", "kibocsatas_datuma": "2026-06-10",
            "elado_nev": "Origo Office Kft.", "elado_cim": "1062 Budapest, Andrássy út 72.", "elado_vat_id": "12903847-2-42",
            "vevo_nev": "SANDBOX", "vevo_cim": "1234 Budapest, Sandbox utca 1", "vevo_vat_id": "12345678-2-42",
            "adoalap_osszesen": 6614, "afa_osszeg_osszesen": 1786, "brutto_vegosszeg": 8400, "fizetendo_osszeg": 8400,
            "fizetesi_hatarido": "2026-06-24", "fizetesi_mod": "TRANSFER", "penznem": "HUF", "fizetve": False, "statusz": "feldolgozott",
            "category_id": CAT_OFFICE, "project_id": PROJ_OFFICE, "transaction_id": None, "invoice_direction": "INBOUND",
            "invoice_type": "sima_szla", "teljesites_datuma": "2026-06-10", "feldolgozva": "2026-06-10T12:00:00Z"
        },
        # Case 5: Google Cloud (Manual Match Pending - unlinked in DB)
        {
            "id": I_IDS[4], "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID,
            "bizonylatsorszam": "GCP-99201", "kibocsatas_datuma": "2026-06-08",
            "elado_nev": "Google Cloud Ireland Ltd.", "elado_cim": "Gordon House, Barrow Street, Dublin 4, Ireland", "elado_vat_id": "IE6388648W",
            "vevo_nev": "SANDBOX", "vevo_cim": "1234 Budapest, Sandbox utca 1", "vevo_vat_id": "12345678-2-42",
            "adoalap_osszesen": 12500, "afa_osszeg_osszesen": 0, "brutto_vegosszeg": 12500, "fizetendo_osszeg": 12500,
            "fizetesi_hatarido": "2026-06-22", "fizetesi_mod": "CARD", "penznem": "HUF", "fizetve": False, "statusz": "feldolgozott",
            "category_id": CAT_IT, "project_id": PROJ_WEBSHOP, "transaction_id": None, "invoice_direction": "INBOUND",
            "invoice_type": "sima_szla", "teljesites_datuma": "2026-06-08", "feldolgozva": "2026-06-08T12:00:00Z"
        },
        # Case 6: MVM Energetika (Unpaid / Unmatched Inbound)
        {
            "id": I_IDS[5], "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID,
            "bizonylatsorszam": "MVM-2026-55921", "kibocsatas_datuma": "2026-06-12",
            "elado_nev": "MVM Energetika Zrt.", "elado_cim": "1031 Budapest, Szentendrei út 207.", "elado_vat_id": "10760798-2-44",
            "vevo_nev": "SANDBOX", "vevo_cim": "1234 Budapest, Sandbox utca 1", "vevo_vat_id": "12345678-2-42",
            "adoalap_osszesen": 30630, "afa_osszeg_osszesen": 8270, "brutto_vegosszeg": 38900, "fizetendo_osszeg": 38900,
            "fizetesi_hatarido": "2026-06-26", "fizetesi_mod": "TRANSFER", "penznem": "HUF", "fizetve": False, "statusz": "feldolgozott",
            "category_id": CAT_UTILITIES, "project_id": None, "transaction_id": None, "invoice_direction": "INBOUND",
            "invoice_type": "sima_szla", "teljesites_datuma": "2026-06-12", "feldolgozva": "2026-06-12T12:00:00Z"
        },
        # Case 7: Beta Zrt (Unpaid / Unmatched Outbound)
        {
            "id": I_IDS[6], "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID,
            "bizonylatsorszam": "NAV-2026-OUT02", "kibocsatas_datuma": "2026-06-15",
            "elado_nev": "SANDBOX", "elado_cim": "1234 Budapest, Sandbox utca 1", "elado_vat_id": "12345678-2-42",
            "vevo_nev": "Beta Zrt.", "vevo_cim": "1055 Budapest, Kossuth Lajos tér 1.", "vevo_vat_id": "87654321-2-12",
            "adoalap_osszesen": 944882, "afa_osszeg_osszesen": 255118, "brutto_vegosszeg": 1200000, "fizetendo_osszeg": 1200000,
            "fizetesi_hatarido": "2026-06-30", "fizetesi_mod": "TRANSFER", "penznem": "HUF", "fizetve": False, "statusz": "feldolgozott",
            "category_id": CAT_MARKETING, "project_id": PROJ_MKT_Q1, "transaction_id": None, "invoice_direction": "OUTBOUND",
            "invoice_type": "sima_szla", "teljesites_datuma": "2026-06-15", "feldolgozva": "2026-06-15T12:00:00Z"
        },
        # Case 8: Gamma Bt Bulk Match - Invoice 1 (150,000 HUF)
        {
            "id": I_IDS[7], "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID,
            "bizonylatsorszam": "NAV-2026-OUT03", "kibocsatas_datuma": "2026-06-01",
            "elado_nev": "SANDBOX", "elado_cim": "1234 Budapest, Sandbox utca 1", "elado_vat_id": "12345678-2-42",
            "vevo_nev": "Gamma Bt.", "vevo_cim": "1024 Budapest, Lövőház utca 12.", "vevo_vat_id": "55443322-1-42",
            "adoalap_osszesen": 118110, "afa_osszeg_osszesen": 31890, "brutto_vegosszeg": 150000, "fizetendo_osszeg": 150000,
            "fizetesi_hatarido": "2026-06-15", "fizetesi_mod": "TRANSFER", "penznem": "HUF", "fizetve": True, "statusz": "kifizetve",
            "category_id": CAT_MARKETING, "project_id": PROJ_MKT_Q1, "transaction_id": T_IDS[5], "invoice_direction": "OUTBOUND",
            "invoice_type": "sima_szla", "teljesites_datuma": "2026-06-01", "feldolgozva": "2026-06-01T12:00:00Z"
        },
        # Case 8: Gamma Bt Bulk Match - Invoice 2 (200,000 HUF)
        {
            "id": I_IDS[8], "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID,
            "bizonylatsorszam": "NAV-2026-OUT04", "kibocsatas_datuma": "2026-06-01",
            "elado_nev": "SANDBOX", "elado_cim": "1234 Budapest, Sandbox utca 1", "elado_vat_id": "12345678-2-42",
            "vevo_nev": "Gamma Bt.", "vevo_cim": "1024 Budapest, Lövőház utca 12.", "vevo_vat_id": "55443322-1-42",
            "adoalap_osszesen": 157480, "afa_osszeg_osszesen": 42520, "brutto_vegosszeg": 200000, "fizetendo_osszeg": 200000,
            "fizetesi_hatarido": "2026-06-15", "fizetesi_mod": "TRANSFER", "penznem": "HUF", "fizetve": True, "statusz": "kifizetve",
            "category_id": CAT_MARKETING, "project_id": PROJ_MKT_Q1, "transaction_id": T_IDS[5], "invoice_direction": "OUTBOUND",
            "invoice_type": "sima_szla", "teljesites_datuma": "2026-06-01", "feldolgozva": "2026-06-01T12:00:00Z"
        },
        # Case 9: Cash / Petty Cash Payment (No transaction_id link, fizetési mód CASH, Paid=True)
        {
            "id": I_IDS[9], "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID,
            "bizonylatsorszam": "KP-2026-0042", "kibocsatas_datuma": "2026-06-07",
            "elado_nev": "Kézműves Pékség & Catering", "elado_cim": "1052 Budapest, Vitkovics Mihály utca 3.", "elado_vat_id": "88776655-2-41",
            "vevo_nev": "SANDBOX", "vevo_cim": "1234 Budapest, Sandbox utca 1", "vevo_vat_id": "12345678-2-42",
            "adoalap_osszesen": 5354, "afa_osszeg_osszesen": 1446, "brutto_vegosszeg": 6800, "fizetendo_osszeg": 6800,
            "fizetesi_hatarido": "2026-06-07", "fizetesi_mod": "CASH", "penznem": "HUF", "fizetve": True, "statusz": "kifizetve",
            "category_id": CAT_CATERING, "project_id": None, "transaction_id": None, "invoice_direction": "INBOUND",
            "invoice_type": "sima_szla", "teljesites_datuma": "2026-06-07", "feldolgozva": "2026-06-07T12:00:00Z"
        },
        # Case 10: Adobe Creative Cloud in "Processing" state (Feldolgozva=False, Status=processing, no trans link)
        {
            "id": I_IDS[10], "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID,
            "bizonylatsorszam": "ADB-2294105", "kibocsatas_datuma": "2026-06-16",
            "elado_nev": "Adobe Systems Software", "elado_cim": "4-6 Riverwalk, Citywest Business Campus, Saggart, Dublin 24, Ireland", "elado_vat_id": "IE9743525W",
            "vevo_nev": "SANDBOX", "vevo_cim": "1234 Budapest, Sandbox utca 1", "vevo_vat_id": "12345678-2-42",
            "adoalap_osszesen": 11803, "afa_osszeg_osszesen": 3187, "brutto_vegosszeg": 14990, "fizetendo_osszeg": 14990,
            "fizetesi_hatarido": "2026-06-30", "fizetesi_mod": "CARD", "penznem": "HUF", "fizetve": False, "statusz": "feldolgozas_alatt",
            "category_id": CAT_IT, "project_id": None, "transaction_id": None, "invoice_direction": "INBOUND",
            "invoice_type": "sima_szla", "teljesites_datuma": "2026-06-16", "feldolgozva": None
        },
        # Case 15: Proforma / Draft Outbound Invoice
        {
            "id": I_IDS[11], "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID,
            "bizonylatsorszam": "DRAFT-2026-001", "kibocsatas_datuma": "2026-06-15",
            "elado_nev": "SANDBOX", "elado_cim": "1234 Budapest, Sandbox utca 1", "elado_vat_id": "12345678-2-42",
            "vevo_nev": "Delta Kft.", "vevo_cim": "1083 Budapest, Práter utca 22.", "vevo_vat_id": "22334455-2-42",
            "adoalap_osszesen": 78740, "afa_osszeg_osszesen": 21260, "brutto_vegosszeg": 100000, "fizetendo_osszeg": 100000,
            "fizetesi_hatarido": "2026-06-29", "fizetesi_mod": "TRANSFER", "penznem": "HUF", "fizetve": False, "statusz": "feldolgozott",
            "category_id": CAT_MARKETING, "project_id": PROJ_MKT_Q1, "transaction_id": None, "invoice_direction": "OUTBOUND",
            "invoice_type": "dijbekero_proforma", "teljesites_datuma": "2026-06-15", "feldolgozva": "2026-06-15T12:00:00Z"
        },
        # Case 21: Outbound Overdue 1-30 Days (receivables)
        {
            "id": I_IDS[12], "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID,
            "bizonylatsorszam": "NAV-2026-OUT05", "kibocsatas_datuma": "2026-05-20",
            "elado_nev": "SANDBOX", "elado_cim": "1234 Budapest, Sandbox utca 1", "elado_vat_id": "12345678-2-42",
            "vevo_nev": "Zeta Kft.", "vevo_cim": "1119 Budapest, Fehérvári út 88.", "vevo_vat_id": "77889900-2-11",
            "adoalap_osszesen": 141732, "afa_osszeg_osszesen": 38268, "brutto_vegosszeg": 180000, "fizetendo_osszeg": 180000,
            "fizetesi_hatarido": "2026-06-04", "fizetesi_mod": "TRANSFER", "penznem": "HUF", "fizetve": False, "statusz": "feldolgozott",
            "category_id": CAT_MARKETING, "project_id": PROJ_MKT_Q1, "transaction_id": None, "invoice_direction": "OUTBOUND",
            "invoice_type": "sima_szla", "teljesites_datuma": "2026-05-20", "feldolgozva": "2026-05-20T12:00:00Z"
        },
        # Case 22: Outbound Overdue 31-180 Days (receivables)
        {
            "id": I_IDS[13], "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID,
            "bizonylatsorszam": "NAV-2026-OUT06", "kibocsatas_datuma": "2026-04-01",
            "elado_nev": "SANDBOX", "elado_cim": "1234 Budapest, Sandbox utca 1", "elado_vat_id": "12345678-2-42",
            "vevo_nev": "Theta Bt.", "vevo_cim": "6000 Kecskemét, Széchenyi tér 3.", "vevo_vat_id": "11223344-1-03",
            "adoalap_osszesen": 275591, "afa_osszeg_osszesen": 74409, "brutto_vegosszeg": 350000, "fizetendo_osszeg": 350000,
            "fizetesi_hatarido": "2026-04-15", "fizetesi_mod": "TRANSFER", "penznem": "HUF", "fizetve": False, "statusz": "feldolgozott",
            "category_id": CAT_MARKETING, "project_id": PROJ_MKT_Q1, "transaction_id": None, "invoice_direction": "OUTBOUND",
            "invoice_type": "sima_szla", "teljesites_datuma": "2026-04-01", "feldolgozva": "2026-04-01T12:00:00Z"
        },
        # Case 23: Outbound Overdue 180+ Days (receivables)
        {
            "id": I_IDS[14], "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID,
            "bizonylatsorszam": "NAV-2025-OUT99", "kibocsatas_datuma": "2025-11-10",
            "elado_nev": "SANDBOX", "elado_cim": "1234 Budapest, Sandbox utca 1", "elado_vat_id": "12345678-2-42",
            "vevo_nev": "Kappa Kft.", "vevo_cim": "4024 Debrecen, Piac utca 12.", "vevo_vat_id": "55667788-2-09",
            "adoalap_osszesen": 503937, "afa_osszeg_osszesen": 136063, "brutto_vegosszeg": 640000, "fizetendo_osszeg": 640000,
            "fizetesi_hatarido": "2025-11-24", "fizetesi_mod": "TRANSFER", "penznem": "HUF", "fizetve": False, "statusz": "feldolgozott",
            "category_id": CAT_MARKETING, "project_id": PROJ_MKT_Q1, "transaction_id": None, "invoice_direction": "OUTBOUND",
            "invoice_type": "sima_szla", "teljesites_datuma": "2025-11-10", "feldolgozva": "2025-11-10T12:00:00Z"
        }
    ]

    print("Inserting invoices...")
    make_request("/rest/v1/invoices", "POST", invoices_to_insert, token=token)

    # 2c. Update Transactions matched_invoice_id for cases where they were unlinked during transaction insert
    # Case 1 (Telekom): match Transaction t01 to Invoice i01
    print("Updating matched_invoice_id for Auto-matched Transactions...")
    make_request(f"/rest/v1/transactions?id=eq.{T_IDS[0]}", "PATCH", {"matched_invoice_id": I_IDS[0]}, token=token)
    # Case 2 (Hetzner): match Transaction t02 to Invoice i02
    make_request(f"/rest/v1/transactions?id=eq.{T_IDS[1]}", "PATCH", {"matched_invoice_id": I_IDS[1]}, token=token)
    # Case 3 (Alfa): match Transaction t03 to Invoice i03
    make_request(f"/rest/v1/transactions?id=eq.{T_IDS[2]}", "PATCH", {"matched_invoice_id": I_IDS[2]}, token=token)
    # Case 8 (Gamma Bt Bulk): match Transaction t06 to Invoice i08 (we link to one of the invoices to show matching)
    make_request(f"/rest/v1/transactions?id=eq.{T_IDS[5]}", "PATCH", {"matched_invoice_id": I_IDS[7]}, token=token)
    # Case 16: link Suggested Match Transaction to its NAV Invoice
    make_request(f"/rest/v1/transactions?id=eq.{T_IDS[10]}", "PATCH", {"matched_invoice_id": N_IDS[10]}, token=token)
    # Courier Cases matched_invoice_id links:
    make_request(f"/rest/v1/transactions?id=eq.{T_IDS[11]}", "PATCH", {"matched_invoice_id": N_IDS[11]}, token=token)
    make_request(f"/rest/v1/transactions?id=eq.{T_IDS[12]}", "PATCH", {"matched_invoice_id": N_IDS[12]}, token=token)
    make_request(f"/rest/v1/transactions?id=eq.{T_IDS[13]}", "PATCH", {"matched_invoice_id": N_IDS[13]}, token=token)
    make_request(f"/rest/v1/transactions?id=eq.{T_IDS[14]}", "PATCH", {"matched_invoice_id": N_IDS[14]}, token=token)

    # 2d. Insert NAV Invoices (corresponds to invoices in NAV sync)
    nav_invoices_to_insert = [
        # Case 1: Telekom Inbound
        {
            "id": N_IDS[0], "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID,
            "invoice_number": "NAV-2026-0001", "invoice_direction": "INBOUND", "invoice_operation": "CREATE",
            "supplier_name": "Magyar Telekom Nyrt.", "supplier_tax_number": "10811886-2-44", "supplier_address": "1097 Budapest, Könyves Kálmán körút 36.",
            "customer_name": "SANDBOX", "customer_tax_number": "12345678-2-42", "customer_address": "1234 Budapest, Sandbox utca 1",
            "invoice_issue_date": "2026-06-01", "invoice_delivery_date": "2026-06-01",
            "invoice_net_amount": 12142, "invoice_gross_amount": 15420, "invoice_vat_amount": 3278,
            "currency": "HUF", "payment_method": "TRANSFER", "paid": True, "submitted": True, "details_fetched": True,
            "category_id": CAT_IT, "project_id": PROJ_WEBSHOP, "transaction_id": T_IDS[0]
        },
        # Case 2: Hetzner Inbound
        {
            "id": N_IDS[1], "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID,
            "invoice_number": "HTZ-889310", "invoice_direction": "INBOUND", "invoice_operation": "CREATE",
            "supplier_name": "Hetzner Online GmbH", "supplier_tax_number": "DE202897834", "supplier_address": "Industriestr. 25, 91710 Gunzenhausen, Germany",
            "customer_name": "SANDBOX", "customer_tax_number": "12345678-2-42", "customer_address": "1234 Budapest, Sandbox utca 1",
            "invoice_issue_date": "2026-06-05", "invoice_delivery_date": "2026-06-05",
            "invoice_net_amount": 42.50, "invoice_gross_amount": 42.50, "invoice_vat_amount": 0,
            "currency": "EUR", "payment_method": "CARD", "paid": True, "submitted": True, "details_fetched": True,
            "category_id": CAT_IT, "project_id": PROJ_WEBSHOP, "transaction_id": T_IDS[1]
        },
        # Case 3: Alfa Kft Outbound
        {
            "id": N_IDS[2], "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID,
            "invoice_number": "NAV-2026-OUT01", "invoice_direction": "OUTBOUND", "invoice_operation": "CREATE",
            "supplier_name": "SANDBOX", "supplier_tax_number": "12345678-2-42", "supplier_address": "1234 Budapest, Sandbox utca 1",
            "customer_name": "Alfa Kft.", "customer_tax_number": "98765432-1-11", "customer_address": "1118 Budapest, Rétköz utca 5.",
            "invoice_issue_date": "2026-05-20", "invoice_delivery_date": "2026-05-20",
            "invoice_net_amount": 354330, "invoice_gross_amount": 450000, "invoice_vat_amount": 95670,
            "currency": "HUF", "payment_method": "TRANSFER", "paid": True, "submitted": True, "details_fetched": True,
            "category_id": CAT_MARKETING, "project_id": PROJ_MKT_Q1, "transaction_id": T_IDS[2]
        },
        # Case 4: Origo Office Inbound
        {
            "id": N_IDS[3], "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID,
            "invoice_number": "ORG-2026-884", "invoice_direction": "INBOUND", "invoice_operation": "CREATE",
            "supplier_name": "Origo Office Kft.", "supplier_tax_number": "12903847-2-42", "supplier_address": "1062 Budapest, Andrássy út 72.",
            "customer_name": "SANDBOX", "customer_tax_number": "12345678-2-42", "customer_address": "1234 Budapest, Sandbox utca 1",
            "invoice_issue_date": "2026-06-10", "invoice_delivery_date": "2026-06-10",
            "invoice_net_amount": 6614, "invoice_gross_amount": 8400, "invoice_vat_amount": 1786,
            "currency": "HUF", "payment_method": "TRANSFER", "paid": False, "submitted": True, "details_fetched": True,
            "category_id": CAT_OFFICE, "project_id": PROJ_OFFICE, "transaction_id": None
        },
        # Case 5: Google Cloud Inbound
        {
            "id": N_IDS[4], "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID,
            "invoice_number": "GCP-99201", "invoice_direction": "INBOUND", "invoice_operation": "CREATE",
            "supplier_name": "Google Cloud Ireland Ltd.", "supplier_tax_number": "IE6388648W", "supplier_address": "Gordon House, Barrow Street, Dublin 4, Ireland",
            "customer_name": "SANDBOX", "customer_tax_number": "12345678-2-42", "customer_address": "1234 Budapest, Sandbox utca 1",
            "invoice_issue_date": "2026-06-08", "invoice_delivery_date": "2026-06-08",
            "invoice_net_amount": 12500, "invoice_gross_amount": 12500, "invoice_vat_amount": 0,
            "currency": "HUF", "payment_method": "CARD", "paid": False, "submitted": True, "details_fetched": True,
            "category_id": CAT_IT, "project_id": PROJ_WEBSHOP, "transaction_id": None
        },
        # Case 6: MVM Inbound
        {
            "id": N_IDS[5], "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID,
            "invoice_number": "MVM-2026-55921", "invoice_direction": "INBOUND", "invoice_operation": "CREATE",
            "supplier_name": "MVM Energetika Zrt.", "supplier_tax_number": "10760798-2-44", "supplier_address": "1031 Budapest, Szentendrei út 207.",
            "customer_name": "SANDBOX", "customer_tax_number": "12345678-2-42", "customer_address": "1234 Budapest, Sandbox utca 1",
            "invoice_issue_date": "2026-06-12", "invoice_delivery_date": "2026-06-12",
            "invoice_net_amount": 30630, "invoice_gross_amount": 38900, "invoice_vat_amount": 8270,
            "currency": "HUF", "payment_method": "TRANSFER", "paid": False, "submitted": True, "details_fetched": True,
            "category_id": CAT_UTILITIES, "project_id": None, "transaction_id": None
        },
        # Case 7: Beta Zrt Outbound
        {
            "id": N_IDS[6], "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID,
            "invoice_number": "NAV-2026-OUT02", "invoice_direction": "OUTBOUND", "invoice_operation": "CREATE",
            "supplier_name": "SANDBOX", "supplier_tax_number": "12345678-2-42", "supplier_address": "1234 Budapest, Sandbox utca 1",
            "customer_name": "Beta Zrt.", "customer_tax_number": "87654321-2-12", "customer_address": "1055 Budapest, Kossuth Lajos tér 1.",
            "invoice_issue_date": "2026-06-15", "invoice_delivery_date": "2026-06-15",
            "invoice_net_amount": 944882, "invoice_gross_amount": 1200000, "invoice_vat_amount": 255118,
            "currency": "HUF", "payment_method": "TRANSFER", "paid": False, "submitted": True, "details_fetched": True,
            "category_id": CAT_MARKETING, "project_id": PROJ_MKT_Q1, "transaction_id": None
        },
        # Case 8: Gamma Bt Outbound 1
        {
            "id": N_IDS[7], "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID,
            "invoice_number": "NAV-2026-OUT03", "invoice_direction": "OUTBOUND", "invoice_operation": "CREATE",
            "supplier_name": "SANDBOX", "supplier_tax_number": "12345678-2-42", "supplier_address": "1234 Budapest, Sandbox utca 1",
            "customer_name": "Gamma Bt.", "customer_tax_number": "55443322-1-42", "customer_address": "1024 Budapest, Lövőház utca 12.",
            "invoice_issue_date": "2026-06-01", "invoice_delivery_date": "2026-06-01",
            "invoice_net_amount": 118110, "invoice_gross_amount": 150000, "invoice_vat_amount": 31890,
            "currency": "HUF", "payment_method": "TRANSFER", "paid": True, "submitted": True, "details_fetched": True,
            "category_id": CAT_MARKETING, "project_id": PROJ_MKT_Q1, "transaction_id": T_IDS[5]
        },
        # Case 8: Gamma Bt Outbound 2
        {
            "id": N_IDS[8], "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID,
            "invoice_number": "NAV-2026-OUT04", "invoice_direction": "OUTBOUND", "invoice_operation": "CREATE",
            "supplier_name": "SANDBOX", "supplier_tax_number": "12345678-2-42", "supplier_address": "1234 Budapest, Sandbox utca 1",
            "customer_name": "Gamma Bt.", "customer_tax_number": "55443322-1-42", "customer_address": "1024 Budapest, Lövőház utca 12.",
            "invoice_issue_date": "2026-06-01", "invoice_delivery_date": "2026-06-01",
            "invoice_net_amount": 157480, "invoice_gross_amount": 200000, "invoice_vat_amount": 42520,
            "currency": "HUF", "payment_method": "TRANSFER", "paid": True, "submitted": True, "details_fetched": True,
            "category_id": CAT_MARKETING, "project_id": PROJ_MKT_Q1, "transaction_id": T_IDS[5]
        },
        # Case 9b: Cash Paid Inbound NAV Invoice (green, paid=True, no transaction link)
        {
            "id": N_IDS[9], "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID,
            "invoice_number": "NAV-2026-KP01", "invoice_direction": "INBOUND", "invoice_operation": "CREATE",
            "supplier_name": "Pékség és Kávézó Kft.", "supplier_tax_number": "22334411-2-42", "supplier_address": "1051 Budapest, Sas utca 4.",
            "customer_name": "SANDBOX", "customer_tax_number": "12345678-2-42", "customer_address": "1234 Budapest, Sandbox utca 1",
            "invoice_issue_date": "2026-06-08", "invoice_delivery_date": "2026-06-08",
            "invoice_net_amount": 3307, "invoice_gross_amount": 4200, "invoice_vat_amount": 893,
            "currency": "HUF", "payment_method": "CASH", "paid": True, "submitted": True, "details_fetched": True,
            "category_id": CAT_CATERING, "project_id": None, "transaction_id": None
        },
        # Case 16: Suggested Match Inbound NAV Invoice (Optic-Net)
        {
            "id": N_IDS[10], "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID,
            "invoice_number": "NAV-2026-SUGG01", "invoice_direction": "INBOUND", "invoice_operation": "CREATE",
            "supplier_name": "Optic-Net Kft.", "supplier_tax_number": "99887766-2-42", "supplier_address": "1117 Budapest, Budafoki út 56.",
            "customer_name": "SANDBOX", "customer_tax_number": "12345678-2-42", "customer_address": "1234 Budapest, Sandbox utca 1",
            "invoice_issue_date": "2026-06-11", "invoice_delivery_date": "2026-06-11",
            "invoice_net_amount": 12283, "invoice_gross_amount": 15600, "invoice_vat_amount": 3317,
            "currency": "HUF", "payment_method": "TRANSFER", "paid": False, "submitted": False, "details_fetched": True,
            "category_id": CAT_IT, "project_id": PROJ_WEBSHOP, "transaction_id": None
        },
        # Case 17: Outbound Sale Invoice delivered by GLS
        {
            "id": N_IDS[11], "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID,
            "invoice_number": "OUT-2026-GLS01", "invoice_direction": "OUTBOUND", "invoice_operation": "CREATE",
            "supplier_name": "SANDBOX", "supplier_tax_number": "12345678-2-42", "supplier_address": "1234 Budapest, Sandbox utca 1",
            "customer_name": "Kiss Péter", "customer_tax_number": None, "customer_address": "1145 Budapest, Róna utca 120.",
            "invoice_issue_date": "2026-06-03", "invoice_delivery_date": "2026-06-03",
            "invoice_net_amount": 112441, "invoice_gross_amount": 142800, "invoice_vat_amount": 30359,
            "currency": "HUF", "payment_method": "TRANSFER", "paid": True, "submitted": True, "details_fetched": True,
            "category_id": None, "project_id": None, "transaction_id": T_IDS[11]
        },
        # Case 18: Outbound Sale Invoice delivered by Posta/MPL
        {
            "id": N_IDS[12], "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID,
            "invoice_number": "OUT-2026-MPL01", "invoice_direction": "OUTBOUND", "invoice_operation": "CREATE",
            "supplier_name": "SANDBOX", "supplier_tax_number": "12345678-2-42", "supplier_address": "1234 Budapest, Sandbox utca 1",
            "customer_name": "Nagy Éva", "customer_tax_number": None, "customer_address": "9024 Győr, Baross Gábor út 15.",
            "invoice_issue_date": "2026-06-04", "invoice_delivery_date": "2026-06-04",
            "invoice_net_amount": 66850, "invoice_gross_amount": 84900, "invoice_vat_amount": 18050,
            "currency": "HUF", "payment_method": "TRANSFER", "paid": True, "submitted": True, "details_fetched": True,
            "category_id": None, "project_id": None, "transaction_id": T_IDS[12]
        },
        # Case 19: Outbound Sale Invoice delivered by Mixpakk
        {
            "id": N_IDS[13], "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID,
            "invoice_number": "OUT-2026-MPX01", "invoice_direction": "OUTBOUND", "invoice_operation": "CREATE",
            "supplier_name": "SANDBOX", "supplier_tax_number": "12345678-2-42", "supplier_address": "1234 Budapest, Sandbox utca 1",
            "customer_name": "Szabó János", "customer_tax_number": None, "customer_address": "4028 Debrecen, Kassai út 26.",
            "invoice_issue_date": "2026-06-05", "invoice_delivery_date": "2026-06-05",
            "invoice_net_amount": 86870, "invoice_gross_amount": 110325, "invoice_vat_amount": 23455,
            "currency": "HUF", "payment_method": "TRANSFER", "paid": True, "submitted": True, "details_fetched": True,
            "category_id": None, "project_id": None, "transaction_id": T_IDS[13]
        },
        # Case 20: Inbound Shipping Fees Invoice issued by Mixpakk
        {
            "id": N_IDS[14], "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID,
            "invoice_number": "MPX-2026-1842", "invoice_direction": "INBOUND", "invoice_operation": "CREATE",
            "supplier_name": "MIXPAKK KFT.", "supplier_tax_number": "12012204-2-41", "supplier_address": "1107 Budapest, Száva utca 9.",
            "customer_name": "SANDBOX", "customer_tax_number": "12345678-2-42", "customer_address": "1234 Budapest, Sandbox utca 1",
            "invoice_issue_date": "2026-06-08", "invoice_delivery_date": "2026-06-08",
            "invoice_net_amount": 30079, "invoice_gross_amount": 38200, "invoice_vat_amount": 8121,
            "currency": "HUF", "payment_method": "TRANSFER", "paid": True, "submitted": True, "details_fetched": True,
            "category_id": CAT_SHIPPING, "project_id": None, "transaction_id": T_IDS[14]
        },
        # Case 21: Outbound Overdue 1-30 Days (receivables)
        {
            "id": N_IDS[15], "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID,
            "invoice_number": "NAV-2026-OUT05", "invoice_direction": "OUTBOUND", "invoice_operation": "CREATE",
            "supplier_name": "SANDBOX", "supplier_tax_number": "12345678-2-42", "supplier_address": "1234 Budapest, Sandbox utca 1",
            "customer_name": "Zeta Kft.", "customer_tax_number": "77889900-2-11", "customer_address": "1119 Budapest, Fehérvári út 88.",
            "invoice_issue_date": "2026-05-20", "invoice_delivery_date": "2026-05-20",
            "invoice_net_amount": 141732, "invoice_gross_amount": 180000, "invoice_vat_amount": 38268,
            "currency": "HUF", "payment_method": "TRANSFER", "paid": False, "submitted": True, "details_fetched": True,
            "category_id": CAT_MARKETING, "project_id": PROJ_MKT_Q1, "transaction_id": None
        },
        # Case 22: Outbound Overdue 31-180 Days (receivables)
        {
            "id": N_IDS[16], "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID,
            "invoice_number": "NAV-2026-OUT06", "invoice_direction": "OUTBOUND", "invoice_operation": "CREATE",
            "supplier_name": "SANDBOX", "supplier_tax_number": "12345678-2-42", "supplier_address": "1234 Budapest, Sandbox utca 1",
            "customer_name": "Theta Bt.", "customer_tax_number": "11223344-1-03", "customer_address": "6000 Kecskemét, Széchenyi tér 3.",
            "invoice_issue_date": "2026-04-01", "invoice_delivery_date": "2026-04-01",
            "invoice_net_amount": 275591, "invoice_gross_amount": 350000, "invoice_vat_amount": 74409,
            "currency": "HUF", "payment_method": "TRANSFER", "paid": False, "submitted": True, "details_fetched": True,
            "category_id": CAT_MARKETING, "project_id": PROJ_MKT_Q1, "transaction_id": None
        },
        # Case 23: Outbound Overdue 180+ Days (receivables)
        {
            "id": N_IDS[17], "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID,
            "invoice_number": "NAV-2025-OUT99", "invoice_direction": "OUTBOUND", "invoice_operation": "CREATE",
            "supplier_name": "SANDBOX", "supplier_tax_number": "12345678-2-42", "supplier_address": "1234 Budapest, Sandbox utca 1",
            "customer_name": "Kappa Kft.", "customer_tax_number": "55667788-2-09", "customer_address": "4024 Debrecen, Piac utca 12.",
            "invoice_issue_date": "2025-11-10", "invoice_delivery_date": "2025-11-10",
            "invoice_net_amount": 503937, "invoice_gross_amount": 640000, "invoice_vat_amount": 136063,
            "currency": "HUF", "payment_method": "TRANSFER", "paid": False, "submitted": True, "details_fetched": True,
            "category_id": CAT_MARKETING, "project_id": PROJ_MKT_Q1, "transaction_id": None
        }
    ]

    print("Inserting nav_invoices...")
    make_request("/rest/v1/nav_invoices", "POST", nav_invoices_to_insert, token=token)

    nav_invoice_items_to_insert = [
        # Case 1: Telekom (4 items)
        {
            "nav_invoice_id": N_IDS[0], "line_number": 1, "line_description": "Helyi hálózati internet (száloptika)",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 5000, "net_amount": 5000, "vat_rate": 0.27, "vat_amount": 1350, "gross_amount": 6350
        },
        {
            "nav_invoice_id": N_IDS[0], "line_number": 2, "line_description": "Mobil havidíj - marketing csoport",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 4000, "net_amount": 4000, "vat_rate": 0.27, "vat_amount": 1080, "gross_amount": 5080
        },
        {
            "nav_invoice_id": N_IDS[0], "line_number": 3, "line_description": "Mobil havidíj - fejlesztési csoport",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 2500, "net_amount": 2500, "vat_rate": 0.27, "vat_amount": 675, "gross_amount": 3175
        },
        {
            "nav_invoice_id": N_IDS[0], "line_number": 4, "line_description": "SMS küldési forgalmi díj",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 642, "net_amount": 642, "vat_rate": 0.27, "vat_amount": 173, "gross_amount": 815
        },
        # Case 2: Hetzner (4 items)
        {
            "nav_invoice_id": N_IDS[1], "line_number": 1, "line_description": "Cloud Server CX21 (vCPU/RAM)",
            "quantity": 1, "unit_of_measure": "MONTH", "unit_price": 15.00, "net_amount": 15.00, "vat_rate": 0.0, "vat_amount": 0, "gross_amount": 15.00
        },
        {
            "nav_invoice_id": N_IDS[1], "line_number": 2, "line_description": "Cloud Server CX31 (Database)",
            "quantity": 1, "unit_of_measure": "MONTH", "unit_price": 20.00, "net_amount": 20.00, "vat_rate": 0.0, "vat_amount": 0, "gross_amount": 20.00
        },
        {
            "nav_invoice_id": N_IDS[1], "line_number": 3, "line_description": "Primary IPv4 Address",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 4.50, "net_amount": 4.50, "vat_rate": 0.0, "vat_amount": 0, "gross_amount": 4.50
        },
        {
            "nav_invoice_id": N_IDS[1], "line_number": 4, "line_description": "Block Storage Volume (50GB)",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 3.00, "net_amount": 3.00, "vat_rate": 0.0, "vat_amount": 0, "gross_amount": 3.00
        },
        # Case 3: Alfa Kft (5 items)
        {
            "nav_invoice_id": N_IDS[2], "line_number": 1, "line_description": "Szoftverfejlesztési tanácsadás - Senior",
            "quantity": 6, "unit_of_measure": "HOUR", "unit_price": 30000, "net_amount": 180000, "vat_rate": 0.27, "vat_amount": 48600, "gross_amount": 228600
        },
        {
            "nav_invoice_id": N_IDS[2], "line_number": 2, "line_description": "Rendszerarchitektúra tervezés",
            "quantity": 2, "unit_of_measure": "HOUR", "unit_price": 35000, "net_amount": 70000, "vat_rate": 0.27, "vat_amount": 18900, "gross_amount": 88900
        },
        {
            "nav_invoice_id": N_IDS[2], "line_number": 3, "line_description": "Projekt koordináció és agilis coaching",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 50000, "net_amount": 50000, "vat_rate": 0.27, "vat_amount": 13500, "gross_amount": 63500
        },
        {
            "nav_invoice_id": N_IDS[2], "line_number": 4, "line_description": "UI/UX drótváz tervezés",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 40000, "net_amount": 40000, "vat_rate": 0.27, "vat_amount": 10800, "gross_amount": 50800
        },
        {
            "nav_invoice_id": N_IDS[2], "line_number": 5, "line_description": "QA manuális tesztelés",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 14330, "net_amount": 14330, "vat_rate": 0.27, "vat_amount": 3870, "gross_amount": 18200
        },
        # Case 4: Origo Office (5 items)
        {
            "nav_invoice_id": N_IDS[3], "line_number": 1, "line_description": "Fénymásolópapír A4 (Rotatrim)",
            "quantity": 1, "unit_of_measure": "CSOMAG", "unit_price": 2000, "net_amount": 2000, "vat_rate": 0.27, "vat_amount": 540, "gross_amount": 2540
        },
        {
            "nav_invoice_id": N_IDS[3], "line_number": 2, "line_description": "Golyóstoll kék (Schneider)",
            "quantity": 10, "unit_of_measure": "DB", "unit_price": 150, "net_amount": 1500, "vat_rate": 0.27, "vat_amount": 405, "gross_amount": 1905
        },
        {
            "nav_invoice_id": N_IDS[3], "line_number": 3, "line_description": "Iratrendező mappa (Dossier)",
            "quantity": 2, "unit_of_measure": "DB", "unit_price": 800, "net_amount": 1600, "vat_rate": 0.27, "vat_amount": 432, "gross_amount": 2032
        },
        {
            "nav_invoice_id": N_IDS[3], "line_number": 4, "line_description": "Post-it öntapadós jegyzetlap",
            "quantity": 2, "unit_of_measure": "DB", "unit_price": 400, "net_amount": 800, "vat_rate": 0.27, "vat_amount": 216, "gross_amount": 1016
        },
        {
            "nav_invoice_id": N_IDS[3], "line_number": 5, "line_description": "Szövegkiemelő készlet (4 db)",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 714, "net_amount": 714, "vat_rate": 0.27, "vat_amount": 193, "gross_amount": 907
        },
        # Case 5: Google Cloud (4 items)
        {
            "nav_invoice_id": N_IDS[4], "line_number": 1, "line_description": "Compute Engine VM Instance (n1-standard-1)",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 6000, "net_amount": 6000, "vat_rate": 0.0, "vat_amount": 0, "gross_amount": 6000
        },
        {
            "nav_invoice_id": N_IDS[4], "line_number": 2, "line_description": "Cloud Storage Standard Storage",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 3000, "net_amount": 3000, "vat_rate": 0.0, "vat_amount": 0, "gross_amount": 3000
        },
        {
            "nav_invoice_id": N_IDS[4], "line_number": 3, "line_description": "Google Cloud SQL (MySQL instance)",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 2500, "net_amount": 2500, "vat_rate": 0.0, "vat_amount": 0, "gross_amount": 2500
        },
        {
            "nav_invoice_id": N_IDS[4], "line_number": 4, "line_description": "Operations Suite Logging & Monitoring",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 1000, "net_amount": 1000, "vat_rate": 0.0, "vat_amount": 0, "gross_amount": 1000
        },
        # Case 6: MVM Energetika (4 items)
        {
            "nav_invoice_id": N_IDS[5], "line_number": 1, "line_description": "Villamos energia rendszerhasználati díj",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 12000, "net_amount": 12000, "vat_rate": 0.27, "vat_amount": 3240, "gross_amount": 15240
        },
        {
            "nav_invoice_id": N_IDS[5], "line_number": 2, "line_description": "Villamos energia forgalmi díj",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 10000, "net_amount": 10000, "vat_rate": 0.27, "vat_amount": 2700, "gross_amount": 12700
        },
        {
            "nav_invoice_id": N_IDS[5], "line_number": 3, "line_description": "Rendszerhasználati alapdíj",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 5000, "net_amount": 5000, "vat_rate": 0.27, "vat_amount": 1350, "gross_amount": 6350
        },
        {
            "nav_invoice_id": N_IDS[5], "line_number": 4, "line_description": "Meddő energia díj és egyéb tételek",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 3630, "net_amount": 3630, "vat_rate": 0.27, "vat_amount": 980, "gross_amount": 4610
        },
        # Case 7: Beta Zrt (4 items)
        {
            "nav_invoice_id": N_IDS[6], "line_number": 1, "line_description": "SaaS Enterprise Licenc előfizetés (12 hónap)",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 600000, "net_amount": 600000, "vat_rate": 0.27, "vat_amount": 162000, "gross_amount": 762000
        },
        {
            "nav_invoice_id": N_IDS[6], "line_number": 2, "line_description": "Rendszerintegráció és API testreszabás",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 200000, "net_amount": 200000, "vat_rate": 0.27, "vat_amount": 54000, "gross_amount": 254000
        },
        {
            "nav_invoice_id": N_IDS[6], "line_number": 3, "line_description": "Onboarding képzés és workshop (2 alkalom)",
            "quantity": 2, "unit_of_measure": "DB", "unit_price": 50000, "net_amount": 100000, "vat_rate": 0.27, "vat_amount": 27000, "gross_amount": 127000
        },
        {
            "nav_invoice_id": N_IDS[6], "line_number": 4, "line_description": "Prémium 24/7 SLA támogatás (1. negyedév)",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 44882, "net_amount": 44882, "vat_rate": 0.27, "vat_amount": 12118, "gross_amount": 57000
        },
        # Case 8: Gamma Bt Outbound 1 (3 items)
        {
            "nav_invoice_id": N_IDS[7], "line_number": 1, "line_description": "Weboldal audit és SEO javaslatcsomag",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 50000, "net_amount": 50000, "vat_rate": 0.27, "vat_amount": 13500, "gross_amount": 63500
        },
        {
            "nav_invoice_id": N_IDS[7], "line_number": 2, "line_description": "Konkurencia elemzés és kulcsszókutatás",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 40000, "net_amount": 40000, "vat_rate": 0.27, "vat_amount": 10800, "gross_amount": 50800
        },
        {
            "nav_invoice_id": N_IDS[7], "line_number": 3, "line_description": "Marketing kampány koncepciótervezés",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 28110, "net_amount": 28110, "vat_rate": 0.27, "vat_amount": 7590, "gross_amount": 35700
        },
        # Case 8: Gamma Bt Outbound 2 (3 items)
        {
            "nav_invoice_id": N_IDS[8], "line_number": 1, "line_description": "Google Ads és Facebook hirdetéskezelés",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 80000, "net_amount": 80000, "vat_rate": 0.27, "vat_amount": 21600, "gross_amount": 101600
        },
        {
            "nav_invoice_id": N_IDS[8], "line_number": 2, "line_description": "Landing page szövegírás és tartalomgyártás",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 50000, "net_amount": 50000, "vat_rate": 0.27, "vat_amount": 13500, "gross_amount": 63500
        },
        {
            "nav_invoice_id": N_IDS[8], "line_number": 3, "line_description": "Havi jelentések és analitika elemzés",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 27480, "net_amount": 27480, "vat_rate": 0.27, "vat_amount": 7420, "gross_amount": 34900
        },
        # Case 9b: Cash Paid Inbound Items (2 items)
        {
            "nav_invoice_id": N_IDS[9], "line_number": 1, "line_description": "Olasz eszpresszó kávé elvitelre",
            "quantity": 4, "unit_of_measure": "DB", "unit_price": 500, "net_amount": 2000, "vat_rate": 0.27, "vat_amount": 540, "gross_amount": 2540
        },
        {
            "nav_invoice_id": N_IDS[9], "line_number": 2, "line_description": "Croissant csokoládés és vajas",
            "quantity": 2, "unit_of_measure": "DB", "unit_price": 653.5, "net_amount": 1307, "vat_rate": 0.27, "vat_amount": 353, "gross_amount": 1660
        },
        # Case 16: Suggested Match Inbound Items (2 items)
        {
            "nav_invoice_id": N_IDS[10], "line_number": 1, "line_description": "Mikrohullámú internet havidíj",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 9000, "net_amount": 9000, "vat_rate": 0.27, "vat_amount": 2430, "gross_amount": 11430
        },
        {
            "nav_invoice_id": N_IDS[10], "line_number": 2, "line_description": "Fix IP cím szolgáltatás",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 3283, "net_amount": 3283, "vat_rate": 0.27, "vat_amount": 887, "gross_amount": 4170
        },
        # Case 17: GLS Delivered Order Items (3 items)
        {
            "nav_invoice_id": N_IDS[11], "line_number": 1, "line_description": "Gamer fejhallgató vezeték nélküli (A-tipus)",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 60000, "net_amount": 60000, "vat_rate": 0.27, "vat_amount": 16200, "gross_amount": 76200
        },
        {
            "nav_invoice_id": N_IDS[11], "line_number": 2, "line_description": "Mechanikus gamer billentyűzet (B-tipus)",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 50000, "net_amount": 50000, "vat_rate": 0.27, "vat_amount": 13500, "gross_amount": 63500
        },
        {
            "nav_invoice_id": N_IDS[11], "line_number": 3, "line_description": "GLS Házhozszállítási díj",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 2441, "net_amount": 2441, "vat_rate": 0.27, "vat_amount": 659, "gross_amount": 3100
        },
        # Case 18: MPL Delivered Order Items (3 items)
        {
            "nav_invoice_id": N_IDS[12], "line_number": 1, "line_description": "Ergonomikus irodai szék (mesh szürke)",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 40000, "net_amount": 40000, "vat_rate": 0.27, "vat_amount": 10800, "gross_amount": 50800
        },
        {
            "nav_invoice_id": N_IDS[12], "line_number": 2, "line_description": "Vezeték nélküli egér és egéralátét szett",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 25000, "net_amount": 25000, "vat_rate": 0.27, "vat_amount": 6750, "gross_amount": 31750
        },
        {
            "nav_invoice_id": N_IDS[12], "line_number": 3, "line_description": "MPL Csomagküldési alapdíj",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 1850, "net_amount": 1850, "vat_rate": 0.27, "vat_amount": 500, "gross_amount": 2350
        },
        # Case 19: Mixpakk Delivered Order Items (3 items)
        {
            "nav_invoice_id": N_IDS[13], "line_number": 1, "line_description": "Külső SSD meghajtó 2TB USB-C",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 50000, "net_amount": 50000, "vat_rate": 0.27, "vat_amount": 13500, "gross_amount": 63500
        },
        {
            "nav_invoice_id": N_IDS[13], "line_number": 2, "line_description": "Monitor tartó konzol (dupla karos)",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 35000, "net_amount": 35000, "vat_rate": 0.27, "vat_amount": 9450, "gross_amount": 44450
        },
        {
            "nav_invoice_id": N_IDS[13], "line_number": 3, "line_description": "Mixpakk Express szállítási díj",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 1870, "net_amount": 1870, "vat_rate": 0.27, "vat_amount": 505, "gross_amount": 2375
        },
        # Case 20: Mixpakk Shipping Service Fee Items (4 items)
        {
            "nav_invoice_id": N_IDS[14], "line_number": 1, "line_description": "Csomagszállítási szolgáltatási alapdíj (32 db)",
            "quantity": 32, "unit_of_measure": "DB", "unit_price": 625, "net_amount": 20000, "vat_rate": 0.27, "vat_amount": 5400, "gross_amount": 25400
        },
        {
            "nav_invoice_id": N_IDS[14], "line_number": 2, "line_description": "Üzemanyag felár és autópályadíj hozzájárulás",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 5000, "net_amount": 5000, "vat_rate": 0.27, "vat_amount": 1350, "gross_amount": 6350
        },
        {
            "nav_invoice_id": N_IDS[14], "line_number": 3, "line_description": "Utánvétkezelési (COD) adminisztrációs díj",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 3000, "net_amount": 3000, "vat_rate": 0.27, "vat_amount": 810, "gross_amount": 3810
        },
        {
            "nav_invoice_id": N_IDS[14], "line_number": 4, "line_description": "Csomagbiztosítási díj (értéknyilvánítás)",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 2079, "net_amount": 2079, "vat_rate": 0.27, "vat_amount": 561, "gross_amount": 2640
        },
        # Case 21: Zeta Kft. (3 items)
        {
            "nav_invoice_id": N_IDS[15], "line_number": 1, "line_description": "Havi IT üzemeltetési támogatás - május",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 80000, "net_amount": 80000, "vat_rate": 0.27, "vat_amount": 21600, "gross_amount": 101600
        },
        {
            "nav_invoice_id": N_IDS[15], "line_number": 2, "line_description": "Tűzfal konfiguráció és biztonsági audit",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 50000, "net_amount": 50000, "vat_rate": 0.27, "vat_amount": 13500, "gross_amount": 63500
        },
        {
            "nav_invoice_id": N_IDS[15], "line_number": 3, "line_description": "Felhasználói fiókok migrációja",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 11732, "net_amount": 11732, "vat_rate": 0.27, "vat_amount": 3168, "gross_amount": 14900
        },
        # Case 22: Theta Bt. (3 items)
        {
            "nav_invoice_id": N_IDS[16], "line_number": 1, "line_description": "Reszponzív webdesign tervezés",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 150000, "net_amount": 150000, "vat_rate": 0.27, "vat_amount": 40500, "gross_amount": 190500
        },
        {
            "nav_invoice_id": N_IDS[16], "line_number": 2, "line_description": "Webáruház integrációs modul fejlesztés",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 100000, "net_amount": 100000, "vat_rate": 0.27, "vat_amount": 27000, "gross_amount": 127000
        },
        {
            "nav_invoice_id": N_IDS[16], "line_number": 3, "line_description": "Tartalomfeltöltés és termékadatbázis tisztítás",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 25591, "net_amount": 25591, "vat_rate": 0.27, "vat_amount": 6909, "gross_amount": 32500
        },
        # Case 23: Kappa Kft. (3 items)
        {
            "nav_invoice_id": N_IDS[17], "line_number": 1, "line_description": "Vállalati arculattervezés és logó design",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 300000, "net_amount": 300000, "vat_rate": 0.27, "vat_amount": 81000, "gross_amount": 381000
        },
        {
            "nav_invoice_id": N_IDS[17], "line_number": 2, "line_description": "Brand arculati kézikönyv elkészítése",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 150000, "net_amount": 150000, "vat_rate": 0.27, "vat_amount": 40500, "gross_amount": 190500
        },
        {
            "nav_invoice_id": N_IDS[17], "line_number": 3, "line_description": "Névjegykártya és levélpapír sablonok",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 53937, "net_amount": 53937, "vat_rate": 0.27, "vat_amount": 14563, "gross_amount": 68500
        }
    ]

    print("Inserting nav_invoice_items...")
    make_request("/rest/v1/nav_invoice_items", "POST", nav_invoice_items_to_insert, token=token)

    # 2ee. Insert submitted Invoice items (matches NAV items where applicable)
    invoice_items_to_insert = [
        # Case 1: Telekom (4 items)
        {
            "invoice_id": I_IDS[0], "line_number": 1, "line_description": "Helyi hálózati internet (száloptika)",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 5000, "net_amount": 5000, "vat_rate": 0.27, "vat_amount": 1350, "gross_amount": 6350
        },
        {
            "invoice_id": I_IDS[0], "line_number": 2, "line_description": "Mobil havidíj - marketing csoport",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 4000, "net_amount": 4000, "vat_rate": 0.27, "vat_amount": 1080, "gross_amount": 5080
        },
        {
            "invoice_id": I_IDS[0], "line_number": 3, "line_description": "Mobil havidíj - fejlesztési csoport",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 2500, "net_amount": 2500, "vat_rate": 0.27, "vat_amount": 675, "gross_amount": 3175
        },
        {
            "invoice_id": I_IDS[0], "line_number": 4, "line_description": "SMS küldési forgalmi díj",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 642, "net_amount": 642, "vat_rate": 0.27, "vat_amount": 173, "gross_amount": 815
        },
        # Case 2: Hetzner (4 items)
        {
            "invoice_id": I_IDS[1], "line_number": 1, "line_description": "Cloud Server CX21 (vCPU/RAM)",
            "quantity": 1, "unit_of_measure": "MONTH", "unit_price": 15.00, "net_amount": 15.00, "vat_rate": 0.0, "vat_amount": 0, "gross_amount": 15.00
        },
        {
            "invoice_id": I_IDS[1], "line_number": 2, "line_description": "Cloud Server CX31 (Database)",
            "quantity": 1, "unit_of_measure": "MONTH", "unit_price": 20.00, "net_amount": 20.00, "vat_rate": 0.0, "vat_amount": 0, "gross_amount": 20.00
        },
        {
            "invoice_id": I_IDS[1], "line_number": 3, "line_description": "Primary IPv4 Address",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 4.50, "net_amount": 4.50, "vat_rate": 0.0, "vat_amount": 0, "gross_amount": 4.50
        },
        {
            "invoice_id": I_IDS[1], "line_number": 4, "line_description": "Block Storage Volume (50GB)",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 3.00, "net_amount": 3.00, "vat_rate": 0.0, "vat_amount": 0, "gross_amount": 3.00
        },
        # Case 3: Alfa Kft (5 items)
        {
            "invoice_id": I_IDS[2], "line_number": 1, "line_description": "Szoftverfejlesztési tanácsadás - Senior",
            "quantity": 6, "unit_of_measure": "HOUR", "unit_price": 30000, "net_amount": 180000, "vat_rate": 0.27, "vat_amount": 48600, "gross_amount": 228600
        },
        {
            "invoice_id": I_IDS[2], "line_number": 2, "line_description": "Rendszerarchitektúra tervezés",
            "quantity": 2, "unit_of_measure": "HOUR", "unit_price": 35000, "net_amount": 70000, "vat_rate": 0.27, "vat_amount": 18900, "gross_amount": 88900
        },
        {
            "invoice_id": I_IDS[2], "line_number": 3, "line_description": "Projekt koordináció és agilis coaching",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 50000, "net_amount": 50000, "vat_rate": 0.27, "vat_amount": 13500, "gross_amount": 63500
        },
        {
            "invoice_id": I_IDS[2], "line_number": 4, "line_description": "UI/UX drótváz tervezés",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 40000, "net_amount": 40000, "vat_rate": 0.27, "vat_amount": 10800, "gross_amount": 50800
        },
        {
            "invoice_id": I_IDS[2], "line_number": 5, "line_description": "QA manuális tesztelés",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 14330, "net_amount": 14330, "vat_rate": 0.27, "vat_amount": 3870, "gross_amount": 18200
        },
        # Case 4: Origo Office (5 items)
        {
            "invoice_id": I_IDS[3], "line_number": 1, "line_description": "Fénymásolópapír A4 (Rotatrim)",
            "quantity": 1, "unit_of_measure": "CSOMAG", "unit_price": 2000, "net_amount": 2000, "vat_rate": 0.27, "vat_amount": 540, "gross_amount": 2540
        },
        {
            "invoice_id": I_IDS[3], "line_number": 2, "line_description": "Golyóstoll kék (Schneider)",
            "quantity": 10, "unit_of_measure": "DB", "unit_price": 150, "net_amount": 1500, "vat_rate": 0.27, "vat_amount": 405, "gross_amount": 1905
        },
        {
            "invoice_id": I_IDS[3], "line_number": 3, "line_description": "Iratrendező mappa (Dossier)",
            "quantity": 2, "unit_of_measure": "DB", "unit_price": 800, "net_amount": 1600, "vat_rate": 0.27, "vat_amount": 432, "gross_amount": 2032
        },
        {
            "invoice_id": I_IDS[3], "line_number": 4, "line_description": "Post-it öntapadós jegyzetlap",
            "quantity": 2, "unit_of_measure": "DB", "unit_price": 400, "net_amount": 800, "vat_rate": 0.27, "vat_amount": 216, "gross_amount": 1016
        },
        {
            "invoice_id": I_IDS[3], "line_number": 5, "line_description": "Szövegkiemelő készlet (4 db)",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 714, "net_amount": 714, "vat_rate": 0.27, "vat_amount": 193, "gross_amount": 907
        },
        # Case 5: Google Cloud (4 items)
        {
            "invoice_id": I_IDS[4], "line_number": 1, "line_description": "Compute Engine VM Instance (n1-standard-1)",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 6000, "net_amount": 6000, "vat_rate": 0.0, "vat_amount": 0, "gross_amount": 6000
        },
        {
            "invoice_id": I_IDS[4], "line_number": 2, "line_description": "Cloud Storage Standard Storage",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 3000, "net_amount": 3000, "vat_rate": 0.0, "vat_amount": 0, "gross_amount": 3000
        },
        {
            "invoice_id": I_IDS[4], "line_number": 3, "line_description": "Google Cloud SQL (MySQL instance)",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 2500, "net_amount": 2500, "vat_rate": 0.0, "vat_amount": 0, "gross_amount": 2500
        },
        {
            "invoice_id": I_IDS[4], "line_number": 4, "line_description": "Operations Suite Logging & Monitoring",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 1000, "net_amount": 1000, "vat_rate": 0.0, "vat_amount": 0, "gross_amount": 1000
        },
        # Case 6: MVM Energetika (4 items)
        {
            "invoice_id": I_IDS[5], "line_number": 1, "line_description": "Villamos energia rendszerhasználati díj",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 12000, "net_amount": 12000, "vat_rate": 0.27, "vat_amount": 3240, "gross_amount": 15240
        },
        {
            "invoice_id": I_IDS[5], "line_number": 2, "line_description": "Villamos energia forgalmi díj",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 10000, "net_amount": 10000, "vat_rate": 0.27, "vat_amount": 2700, "gross_amount": 12700
        },
        {
            "invoice_id": I_IDS[5], "line_number": 3, "line_description": "Rendszerhasználati alapdíj",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 5000, "net_amount": 5000, "vat_rate": 0.27, "vat_amount": 1350, "gross_amount": 6350
        },
        {
            "invoice_id": I_IDS[5], "line_number": 4, "line_description": "Meddő energia díj és egyéb tételek",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 3630, "net_amount": 3630, "vat_rate": 0.27, "vat_amount": 980, "gross_amount": 4610
        },
        # Case 7: Beta Zrt (4 items)
        {
            "invoice_id": I_IDS[6], "line_number": 1, "line_description": "SaaS Enterprise Licenc előfizetés (12 hónap)",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 600000, "net_amount": 600000, "vat_rate": 0.27, "vat_amount": 162000, "gross_amount": 762000
        },
        {
            "invoice_id": I_IDS[6], "line_number": 2, "line_description": "Rendszerintegráció és API testreszabás",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 200000, "net_amount": 200000, "vat_rate": 0.27, "vat_amount": 54000, "gross_amount": 254000
        },
        {
            "invoice_id": I_IDS[6], "line_number": 3, "line_description": "Onboarding képzés és workshop (2 alkalom)",
            "quantity": 2, "unit_of_measure": "DB", "unit_price": 50000, "net_amount": 100000, "vat_rate": 0.27, "vat_amount": 27000, "gross_amount": 127000
        },
        {
            "invoice_id": I_IDS[6], "line_number": 4, "line_description": "Prémium 24/7 SLA támogatás (1. negyedév)",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 44882, "net_amount": 44882, "vat_rate": 0.27, "vat_amount": 12118, "gross_amount": 57000
        },
        # Case 8: Gamma Bt Outbound 1 (3 items)
        {
            "invoice_id": I_IDS[7], "line_number": 1, "line_description": "Weboldal audit és SEO javaslatcsomag",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 50000, "net_amount": 50000, "vat_rate": 0.27, "vat_amount": 13500, "gross_amount": 63500
        },
        {
            "invoice_id": I_IDS[7], "line_number": 2, "line_description": "Konkurencia elemzés és kulcsszókutatás",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 40000, "net_amount": 40000, "vat_rate": 0.27, "vat_amount": 10800, "gross_amount": 50800
        },
        {
            "invoice_id": I_IDS[7], "line_number": 3, "line_description": "Marketing kampány koncepciótervezés",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 28110, "net_amount": 28110, "vat_rate": 0.27, "vat_amount": 7590, "gross_amount": 35700
        },
        # Case 8: Gamma Bt Outbound 2 (3 items)
        {
            "invoice_id": I_IDS[8], "line_number": 1, "line_description": "Google Ads és Facebook hirdetéskezelés",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 80000, "net_amount": 80000, "vat_rate": 0.27, "vat_amount": 21600, "gross_amount": 101600
        },
        {
            "invoice_id": I_IDS[8], "line_number": 2, "line_description": "Landing page szövegírás és tartalomgyártás",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 50000, "net_amount": 50000, "vat_rate": 0.27, "vat_amount": 13500, "gross_amount": 63500
        },
        {
            "invoice_id": I_IDS[8], "line_number": 3, "line_description": "Havi jelentések és analitika elemzés",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 27480, "net_amount": 27480, "vat_rate": 0.27, "vat_amount": 7420, "gross_amount": 34900
        },
        # Case 9: Cash Petty Cash (3 items)
        {
            "invoice_id": I_IDS[9], "line_number": 1, "line_description": "Kézműves sós péksütemény tál (mini pogácsák)",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 2500, "net_amount": 2500, "vat_rate": 0.27, "vat_amount": 675, "gross_amount": 3175
        },
        {
            "invoice_id": I_IDS[9], "line_number": 2, "line_description": "Mini szendvicsek (lazacos, sonkás)",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 2000, "net_amount": 2000, "vat_rate": 0.27, "vat_amount": 540, "gross_amount": 2540
        },
        {
            "invoice_id": I_IDS[9], "line_number": 3, "line_description": "Házikészítésű limonádé és ásványvíz",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 854, "net_amount": 854, "vat_rate": 0.27, "vat_amount": 231, "gross_amount": 1085
        },
        # Case 10: Adobe CC (3 items)
        {
            "invoice_id": I_IDS[10], "line_number": 1, "line_description": "Adobe Photoshop Single App Monthly",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 6000, "net_amount": 6000, "vat_rate": 0.27, "vat_amount": 1620, "gross_amount": 7620
        },
        {
            "invoice_id": I_IDS[10], "line_number": 2, "line_description": "Adobe Acrobat Pro Monthly",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 4000, "net_amount": 4000, "vat_rate": 0.27, "vat_amount": 1080, "gross_amount": 5080
        },
        {
            "invoice_id": I_IDS[10], "line_number": 3, "line_description": "Creative Cloud Storage Add-on (100GB)",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 1803, "net_amount": 1803, "vat_rate": 0.27, "vat_amount": 487, "gross_amount": 2290
        },
        # Case 15: Draft/Proforma (3 items)
        {
            "invoice_id": I_IDS[11], "line_number": 1, "line_description": "Havi marketing kampány előleg - június",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 40000, "net_amount": 40000, "vat_rate": 0.27, "vat_amount": 10800, "gross_amount": 50800
        },
        {
            "invoice_id": I_IDS[11], "line_number": 2, "line_description": "Tartalomtervezési díj - június",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 25000, "net_amount": 25000, "vat_rate": 0.27, "vat_amount": 6750, "gross_amount": 31750
        },
        {
            "invoice_id": I_IDS[11], "line_number": 3, "line_description": "Adminisztrációs és riportálási díj",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 13740, "net_amount": 13740, "vat_rate": 0.27, "vat_amount": 3710, "gross_amount": 17450
        },
        # Case 21: Zeta Kft. (3 items)
        {
            "invoice_id": I_IDS[12], "line_number": 1, "line_description": "Havi IT üzemeltetési támogatás - május",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 80000, "net_amount": 80000, "vat_rate": 0.27, "vat_amount": 21600, "gross_amount": 101600
        },
        {
            "invoice_id": I_IDS[12], "line_number": 2, "line_description": "Tűzfal konfiguráció és biztonsági audit",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 50000, "net_amount": 50000, "vat_rate": 0.27, "vat_amount": 13500, "gross_amount": 63500
        },
        {
            "invoice_id": I_IDS[12], "line_number": 3, "line_description": "Felhasználói fiókok migrációja",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 11732, "net_amount": 11732, "vat_rate": 0.27, "vat_amount": 3168, "gross_amount": 14900
        },
        # Case 22: Theta Bt. (3 items)
        {
            "invoice_id": I_IDS[13], "line_number": 1, "line_description": "Reszponzív webdesign tervezés",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 150000, "net_amount": 150000, "vat_rate": 0.27, "vat_amount": 40500, "gross_amount": 190500
        },
        {
            "invoice_id": I_IDS[13], "line_number": 2, "line_description": "Webáruház integrációs modul fejlesztés",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 100000, "net_amount": 100000, "vat_rate": 0.27, "vat_amount": 27000, "gross_amount": 127000
        },
        {
            "invoice_id": I_IDS[13], "line_number": 3, "line_description": "Tartalomfeltöltés és termékadatbázis tisztítás",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 25591, "net_amount": 25591, "vat_rate": 0.27, "vat_amount": 6909, "gross_amount": 32500
        },
        # Case 23: Kappa Kft. (3 items)
        {
            "invoice_id": I_IDS[14], "line_number": 1, "line_description": "Vállalati arculattervezés és logó design",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 300000, "net_amount": 300000, "vat_rate": 0.27, "vat_amount": 81000, "gross_amount": 381000
        },
        {
            "invoice_id": I_IDS[14], "line_number": 2, "line_description": "Brand arculati kézikönyv elkészítése",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 150000, "net_amount": 150000, "vat_rate": 0.27, "vat_amount": 40500, "gross_amount": 190500
        },
        {
            "invoice_id": I_IDS[14], "line_number": 3, "line_description": "Névjegykártya és levélpapír sablonok",
            "quantity": 1, "unit_of_measure": "DB", "unit_price": 53937, "net_amount": 53937, "vat_rate": 0.27, "vat_amount": 14563, "gross_amount": 68500
        }
    ]

    print("Inserting invoice_items...")
    make_request("/rest/v1/invoice_items", "POST", invoice_items_to_insert, token=token)

    # 2f. Insert Salaries (linked to Salary Transaction Case 13)
    salaries_to_insert = [
        {
            "id": S_IDS[0], "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID,
            "név": "Nagy János", "munkavallalo_neve": "Nagy János", "összeg": 480000, "tipus": "salary",
            "fizetesi_mod": "TRANSFER", "statusz": "paid", "dátum": "2026-06-10", "kifizetes_ideje": "2026-06-10",
            "megjegyzes": "Májusi nettó bérkifizetés", "transaction_id": T_IDS[8]
        }
    ]
    print("Inserting salaries...")
    make_request("/rest/v1/salary", "POST", salaries_to_insert, token=token)

    # 2g. Insert Taxes (linked to Tax Transaction Case 14)
    taxes_to_insert = [
        {
            "user_id": SANDBOX_USER_ID, "company_id": SANDBOX_COMPANY_ID,
            "adonem": "ÁFA", "osszeg": 250000, "datum": "2026-05-15"
        }
    ]
    print("Inserting taxes...")
    make_request("/rest/v1/tax", "POST", taxes_to_insert, token=token)

    # 2h. Insert Report Uploads
    report_uploads_to_insert = [
        {
            "id": U_IDS[0],
            "company_id": SANDBOX_COMPANY_ID,
            "user_id": SANDBOX_USER_ID,
            "file_name": "GLS_100022429_20260430_080254.xlsx",
            "file_url": "http://dummy.url/GLS_100022429_20260430_080254.xlsx",
            "report_type": "gls",
            "processing_status": "completed",
            "upload_status": "completed",
            "metadata": {"rows_parsed": 1, "rows_matched_full": 1, "rows_matched_partial": 0, "rows_unmatched": 0}
        },
        {
            "id": U_IDS[1],
            "company_id": SANDBOX_COMPANY_ID,
            "user_id": SANDBOX_USER_ID,
            "file_name": "POSTA_0020173780_utalas_riport.csv",
            "file_url": "http://dummy.url/POSTA_0020173780_utalas_riport.csv",
            "report_type": "mpl",
            "processing_status": "completed",
            "upload_status": "completed",
            "metadata": {"rows_parsed": 1, "rows_matched_full": 1, "rows_matched_partial": 0, "rows_unmatched": 0}
        },
        {
            "id": U_IDS[2],
            "company_id": SANDBOX_COMPANY_ID,
            "user_id": SANDBOX_USER_ID,
            "file_name": "mixpack_riport_2026_06.csv",
            "file_url": "http://dummy.url/mixpack_riport_2026_06.csv",
            "report_type": "mixpack",
            "processing_status": "completed",
            "upload_status": "completed",
            "metadata": {"rows_parsed": 2, "rows_matched_full": 2, "rows_matched_partial": 0, "rows_unmatched": 0}
        }
    ]
    print("Inserting report uploads...")
    make_request("/rest/v1/report_uploads", "POST", report_uploads_to_insert, token=token)

    # 2i. Insert Courier Reports
    courier_reports_to_insert = [
        # GLS Item row
        {
            "id": CR_IDS[0],
            "company_id": SANDBOX_COMPANY_ID,
            "upload_id": U_IDS[0],
            "report_type": "gls",
            "row_type": "item",
            "package_number": "3810012294025",
            "reference_number": "OUT-2026-GLS01",
            "delivery_date": "2026-06-03",
            "cod_amount": 142800,
            "recipient_name": "Kiss Péter",
            "recipient_address": "1145 Budapest, Róna utca 120.",
            "matched_transaction_id": T_IDS[11],
            "matched_nav_invoice_id": N_IDS[11],
            "match_status": "full",
            "match_confidence": 1.0,
            "match_reason": "Matched automatically by package number and invoice reference"
        },
        # GLS Total/Summary row
        {
            "id": CR_IDS[1],
            "company_id": SANDBOX_COMPANY_ID,
            "upload_id": U_IDS[0],
            "report_type": "gls",
            "row_type": "total",
            "package_number": None,
            "reference_number": None,
            "delivery_date": "2026-06-05",
            "cod_amount": 142800,
            "recipient_name": "Összesítés / Total COD",
            "recipient_address": None,
            "matched_transaction_id": T_IDS[11],
            "matched_nav_invoice_id": None,
            "match_status": "total",
            "match_confidence": 1.0,
            "match_reason": "GLS summary total row"
        },
        # MPL Item row
        {
            "id": CR_IDS[2],
            "company_id": SANDBOX_COMPANY_ID,
            "upload_id": U_IDS[1],
            "report_type": "mpl",
            "row_type": "item",
            "package_number": "PB2P150028810",
            "reference_number": "OUT-2026-MPL01",
            "delivery_date": "2026-06-04",
            "cod_amount": 84900,
            "recipient_name": "Nagy Éva",
            "recipient_address": "9024 Győr, Baross Gábor út 15.",
            "matched_transaction_id": T_IDS[12],
            "matched_nav_invoice_id": N_IDS[12],
            "match_status": "full",
            "match_confidence": 1.0,
            "match_reason": "Matched automatically by package number and invoice reference"
        },
        # Mixpack Item row (COD Payout)
        {
            "id": CR_IDS[3],
            "company_id": SANDBOX_COMPANY_ID,
            "upload_id": U_IDS[2],
            "report_type": "mixpack",
            "row_type": "item",
            "package_number": "MPX99201840",
            "reference_number": "OUT-2026-MPX01",
            "delivery_date": "2026-06-05",
            "cod_amount": 110325,
            "recipient_name": "Szabó János",
            "recipient_address": "4028 Debrecen, Kassai út 26.",
            "matched_transaction_id": T_IDS[13],
            "matched_nav_invoice_id": N_IDS[13],
            "match_status": "full",
            "match_confidence": 1.0,
            "match_reason": "Matched automatically by package number and invoice reference"
        },
        # Mixpack Total row
        {
            "id": CR_IDS[4],
            "company_id": SANDBOX_COMPANY_ID,
            "upload_id": U_IDS[2],
            "report_type": "mixpack",
            "row_type": "total",
            "package_number": None,
            "reference_number": None,
            "delivery_date": "2026-06-07",
            "cod_amount": 110325,
            "recipient_name": "Összesítés / Total COD",
            "recipient_address": None,
            "matched_transaction_id": T_IDS[13],
            "matched_nav_invoice_id": None,
            "match_status": "total",
            "match_confidence": 1.0,
            "match_reason": "Mixpack summary total row"
        }
    ]
    print("Inserting courier reports...")
    make_request("/rest/v1/courier_reports", "POST", courier_reports_to_insert, token=token)

    print("\n🎉 Seeding completed successfully! 15 scenarios are now live on SANDBOX.")

if __name__ == "__main__":
    main()
