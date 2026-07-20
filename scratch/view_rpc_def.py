import os
import psycopg2
from urllib.parse import urlparse

# Get DB URL from env
db_url = "postgresql://postgres:postgres@localhost:54322/postgres"

# Connect
conn = psycopg2.connect(db_url)
cur = conn.cursor()

# Query definition
cur.execute("""
    SELECT pg_get_functiondef(p.oid)
    FROM pg_proc p
    INNER JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'suggest_gl_mappings';
""")
row = cur.fetchone()
if row:
    print(row[0])
else:
    print("Function not found")

cur.close()
conn.close()
