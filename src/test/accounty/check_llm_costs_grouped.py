import os
import sys
from datetime import datetime
from collections import defaultdict
from supabase import create_client

URL = "https://vxxgvdlqvvchtlmqnrqf.supabase.co"
KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.YO-8-3sg4m--ms7MCvtwBLOo7ygqxaTbdtvwVwCin_Q"

def main():
    client = create_client(URL, KEY)
    
    # Query all records
    res = client.table("llm_koltsegek") \
        .select("*") \
        .order("created_at", desc=True) \
        .execute()
        
    data = res.data
    print(f"Total log records retrieved: {len(data)}\n")
    
    # Analyze by date and pipeline
    daily_stats = defaultdict(lambda: defaultdict(lambda: {
        "cost": 0.0,
        "input_tokens": 0,
        "output_tokens": 0,
        "calls": 0,
        "runs": 0
    }))
    
    for row in data:
        created_at_str = row.get("created_at")
        if not created_at_str:
            continue
        
        # Parse date part "YYYY-MM-DD"
        date_str = created_at_str.split("T")[0]
        
        pipeline = row.get("pipeline", "unknown")
        cost = float(row.get("estimated_cost_usd") or 0.0)
        in_tok = int(row.get("input_tokens") or 0)
        out_tok = int(row.get("output_tokens") or 0)
        calls = int(row.get("llm_calls") or 0)
        
        stats = daily_stats[date_str][pipeline]
        stats["cost"] += cost
        stats["input_tokens"] += in_tok
        stats["output_tokens"] += out_tok
        stats["calls"] += calls
        stats["runs"] += 1

    # Print daily costs with safe ASCII
    dates = sorted(daily_stats.keys(), reverse=True)
    
    print("-" * 90)
    print(f"{'Datum':<12} | {'Pipeline':<20} | {'Koltseg (USD)':<15} | {'Hivasok':<10} | {'Bemeno token':<15} | {'Kimeno token':<15}")
    print("-" * 90)
    
    for dt in dates[:10]: # Last 10 days
        pipelines = sorted(daily_stats[dt].keys())
        for pipe in pipelines:
            stats = daily_stats[dt][pipe]
            print(f"{dt:<12} | {pipe:<20} | ${stats['cost']:<14.4f} | {stats['calls']:<10} | {stats['input_tokens']:<15} | {stats['output_tokens']:<15}")
        print("-" * 90)

if __name__ == "__main__":
    main()
