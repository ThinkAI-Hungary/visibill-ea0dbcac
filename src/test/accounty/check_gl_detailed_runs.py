import os
import sys
from datetime import datetime
from supabase import create_client

URL = "https://vxxgvdlqvvchtlmqnrqf.supabase.co"
KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.YO-8-3sg4m--ms7MCvtwBLOo7ygqxaTbdtvwVwCin_Q"

def main():
    client = create_client(URL, KEY)
    
    # Query all gl_classification records since 2026-07-12
    res = client.table("llm_koltsegek") \
        .select("*") \
        .eq("pipeline", "gl_classification") \
        .gte("created_at", "2026-07-12T00:00:00") \
        .order("created_at", desc=True) \
        .execute()
        
    data = res.data
    print(f"Total gl_classification records: {len(data)}\n")
    
    # Get company details to match company_id with company names
    comp_res = client.table("companies").select("id, name").execute()
    company_map = {c["id"]: c["name"] for c in comp_res.data}
    
    print("-" * 120)
    print(f"{'Date':<10} | {'Company Name':<30} | {'File Name / Job':<25} | {'Cost (USD)':<10} | {'Calls':<8} | {'Input Tok':<12} | {'Output Tok':<12}")
    print("-" * 120)
    
    for row in data:
        created_at_str = row.get("created_at").split("T")[0]
        comp_id = row.get("company_id")
        comp_name = company_map.get(comp_id, comp_id or "Unknown")
        file_name = row.get("file_name", "N/A")
        cost = float(row.get("estimated_cost_usd") or 0.0)
        calls = int(row.get("llm_calls") or 0)
        in_tok = int(row.get("input_tokens") or 0)
        out_tok = int(row.get("output_tokens") or 0)
        
        # Truncate company name/file name if too long for tabular print
        if len(comp_name) > 30:
            comp_name = comp_name[:27] + "..."
        if len(file_name) > 25:
            file_name = file_name[:22] + "..."
            
        print(f"{created_at_str:<10} | {comp_name:<30} | {file_name:<25} | ${cost:<9.4f} | {calls:<8} | {in_tok:<12} | {out_tok:<12}")

if __name__ == "__main__":
    main()
