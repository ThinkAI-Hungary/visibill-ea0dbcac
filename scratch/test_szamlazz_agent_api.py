import requests
from supabase import create_client

url = "https://vxxgvdlqvvchtlmqnrqf.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.YO-8-3sg4m--ms7MCvtwBLOo7ygqxaTbdtvwVwCin_Q"
supabase = create_client(url, key)

# Get Think AI Kft's saved agent key
res = supabase.table("companies").select("szamlazz_agent_key").eq("id", "ecf31039-b539-4e04-bbea-70ea48c701bb").single().execute()
agent_key = res.data.get("szamlazz_agent_key")

print(f"Loaded Agent Key: {agent_key[:10]}... (len: {len(agent_key)})")

def test_inv(inv_num):
    xml_body = f"""<?xml version="1.0" encoding="UTF-8"?>
<xmlszamlapdf xmlns="http://www.szamlazz.hu/xmlszamlapdf">
  <beallitasok>
    <szamlaAgentKulcs>{agent_key}</szamlaAgentKulcs>
    <pdfValasz>true</pdfValasz>
  </beallitasok>
  <fejlec>
    <szamlaszam>{inv_num}</szamlaszam>
  </fejlec>
</xmlszamlapdf>"""

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Visibill/1.0",
    }

    xml_bytes = xml_body.encode('utf-8')

    # Test 1: POST form field action-xmlszamlapdf as file tuple
    files1 = {
        'action-xmlszamlapdf': ('action.xml', xml_bytes, 'application/xml')
    }
    res1 = requests.post("https://www.szamlazz.hu/szamla/", files=files1)
    print("\n--- Test 1 (files action-xmlszamlapdf) ---")
    print("Status:", res1.status_code, "Content-Type:", res1.headers.get("content-type"))
    print("Body snippet:", res1.content[:300])

    # Test 2: POST form field action-xmlszamla as file tuple
    files2 = {
        'action-xmlszamla': ('action.xml', xml_bytes, 'application/xml')
    }
    res2 = requests.post("https://www.szamlazz.hu/szamla/", files=files2)
    print("\n--- Test 2 (files action-xmlszamla) ---")
    print("Status:", res2.status_code, "Content-Type:", res2.headers.get("content-type"))
    print("Body snippet:", res2.content[:300])

test_inv("E-SZAMLA-2026-102")
