import json
import sys

def generate_upsert_sql(invoices, user_id, company_id):
    if not invoices: return ""
    sql = "INSERT INTO public.nav_invoices (user_id, company_id, invoice_number, invoice_direction, invoice_issue_date, invoice_delivery_date, supplier_tax_number, customer_tax_number, invoice_operation, invoice_net_amount, invoice_vat_amount, invoice_gross_amount, payment_method, currency, supplier_name, customer_name, fetched_at) VALUES\n"
    rows = []
    for inv in invoices:
        s_name = f"'{inv['supplier_name'].replace(\"'\", \"''\")}'" if inv['supplier_name'] else "NULL"
        c_name = f"'{inv['customer_name'].replace(\"'\", \"''\")}'" if inv['customer_name'] else "NULL"
        i_num = inv['invoice_number'].replace("'", "''")
        row = f"('{user_id}', '{company_id}', '{i_num}', '{inv['invoice_direction']}', '{inv['invoice_issue_date']}', '{inv['invoice_delivery_date']}', '{inv['supplier_tax_number'] or ''}', '{inv['customer_tax_number'] or ''}', '{inv['invoice_operation']}', {inv['invoice_net_amount']}, {inv['invoice_vat_amount']}, {inv['invoice_gross_amount']}, '{inv['payment_method']}', '{inv['currency']}', {s_name}, {c_name}, NOW())"
        rows.append(row)
    sql += ",\n".join(rows)
    sql += "\nON CONFLICT (company_id, invoice_number) DO UPDATE SET invoice_direction = EXCLUDED.invoice_direction, invoice_issue_date = EXCLUDED.invoice_issue_date, invoice_delivery_date = EXCLUDED.invoice_delivery_date, invoice_net_amount = EXCLUDED.invoice_net_amount, invoice_vat_amount = EXCLUDED.invoice_vat_amount, invoice_gross_amount = EXCLUDED.invoice_gross_amount, supplier_name = EXCLUDED.supplier_name, customer_name = EXCLUDED.customer_name, fetched_at = NOW() RETURNING id, invoice_number;"
    return sql

def generate_details_sql(details):
    if not details: return ""
    update_sql = ""
    item_rows = []
    for res in details:
        inv_id = res['nav_invoice_id']
        update_sql += f"UPDATE public.nav_invoices SET details_fetched = true, is_cash_accounting = {'true' if res['is_cash_accounting'] else 'false'}, invoice_gross_amount = {res['total_gross_amount']} WHERE id = '{inv_id}';\n"
        for item in res['items']:
            desc = f"'{item['line_description'].replace(\"'\", \"''\")}'" if item['line_description'] else "NULL"
            uom = f"'{item['unit_of_measure'].replace(\"'\", \"''\")}'" if item['unit_of_measure'] else "NULL"
            pcode = f"'{item['product_code'].replace(\"'\", \"''\")}'" if item['product_code'] else "NULL"
            row = f"('{inv_id}', {item['line_number']}, {desc}, {item['quantity']}, {uom}, {item['unit_price']}, {item['net_amount']}, '{item['vat_rate'].replace(\"'\", \"''\")}', {item['vat_amount']}, {item['gross_amount']}, {pcode})"
            item_rows.append(row)
    
    insert_sql = ""
    if item_rows:
        insert_sql = "INSERT INTO public.nav_invoice_items (nav_invoice_id, line_number, line_description, quantity, unit_of_measure, unit_price, net_amount, vat_rate, vat_amount, gross_amount, product_code) VALUES\n"
        insert_sql += ",\n".join(item_rows) + ";"
    
    return update_sql + "\n" + insert_sql

if __name__ == "__main__":
    # This is a helper script, not meant to be run directly with complex logic
    pass
