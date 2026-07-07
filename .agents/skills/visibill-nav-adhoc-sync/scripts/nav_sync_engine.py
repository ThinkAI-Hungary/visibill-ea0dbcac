import hashlib
import uuid
import requests
import json
import time
import sys
import re
import base64
import argparse
from datetime import datetime, timedelta

def sha3_512_hash(text: str) -> str:
    return hashlib.sha3_512(text.encode('utf-8')).hexdigest().upper()

def sha512_hash(text: str) -> str:
    return hashlib.sha512(text.encode('utf-8')).hexdigest().upper()

def generate_request_id():
    return "RID" + datetime.now().strftime("%Y%m%d%H%M%S") + str(uuid.uuid4()).replace('-', '').upper()[:10]

def get_iso_timestamp():
    return datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')

def extract_tag(xml, tag):
    match = re.search(f'<(?:[^:]+:)?{tag}>(.*?)</(?:[^:]+:)?{tag}>', xml, re.DOTALL)
    return match.group(1).strip() if match else None

def clean_text(text):
    if not text: return text
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

class NAVClient:
    def __init__(self, creds):
        self.creds = creds
        self.base_url = 'https://api.onlineszamla.nav.gov.hu/invoiceService/v3'
        if creds.get('is_test_environment'):
            self.base_url = 'https://api-test.onlineszamla.nav.gov.hu/invoiceService/v3'

    def _get_auth_xml(self, request_id, timestamp):
        password_hash = sha512_hash(self.creds['nav_password'])
        compact_timestamp = timestamp.replace('-', '').replace(':', '').replace('T', '')[:14]
        signature_base = f"{request_id}{compact_timestamp}{self.creds['nav_sign_key']}"
        signature = sha3_512_hash(signature_base)
        
        return f"""
  <common:user>
    <common:login>{self.creds['nav_username']}</common:login>
    <common:passwordHash cryptoType="SHA-512">{password_hash}</common:passwordHash>
    <common:taxNumber>{self.creds['nav_tax_number']}</common:taxNumber>
    <common:requestSignature cryptoType="SHA3-512">{signature}</common:requestSignature>
  </common:user>
  <software>
    <softwareId>{self.creds['software_id']}</softwareId>
    <softwareName>Visibill</softwareName>
    <softwareOperation>ONLINE_SERVICE</softwareOperation>
    <softwareMainVersion>1.0</softwareMainVersion>
    <softwareDevName>Visibill</softwareDevName>
    <softwareDevContact>support@visibill.hu</softwareDevContact>
  </software>"""

    def get_token(self):
        request_id = generate_request_id()
        timestamp = get_iso_timestamp()
        auth_xml = self._get_auth_xml(request_id, timestamp)
        
        xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<TokenExchangeRequest xmlns="http://schemas.nav.gov.hu/OSA/3.0/api" xmlns:common="http://schemas.nav.gov.hu/NTCA/1.0/common">
  <common:header>
    <common:requestId>{request_id}</common:requestId>
    <common:timestamp>{timestamp}</common:timestamp>
    <common:requestVersion>3.0</common:requestVersion>
    <common:headerVersion>1.0</common:headerVersion>
  </common:header>
  {auth_xml}
</TokenExchangeRequest>"""

        response = requests.post(f"{self.base_url}/tokenExchange", data=xml.encode('utf-8'), headers={'Content-Type': 'application/xml'})
        if response.status_code != 200: return None
        return extract_tag(response.text, 'encodedExchangeToken')

    def query_digest(self, token, date_from, date_to, direction='OUTBOUND'):
        request_id = generate_request_id()
        timestamp = get_iso_timestamp()
        auth_xml = self._get_auth_xml(request_id, timestamp)
        
        xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<QueryInvoiceDigestRequest xmlns="http://schemas.nav.gov.hu/OSA/3.0/api" xmlns:common="http://schemas.nav.gov.hu/NTCA/1.0/common">
  <common:header>
    <common:requestId>{request_id}</common:requestId>
    <common:timestamp>{timestamp}</common:timestamp>
    <common:requestVersion>3.0</common:requestVersion>
    <common:headerVersion>1.0</common:headerVersion>
  </common:header>
  {auth_xml}
  <exchangeToken>{token}</exchangeToken>
  <invoiceQueryParams>
    <mandatoryQueryParams>
      <invoiceIssueDate>
        <invoiceIssueDateFrom>{date_from}</invoiceIssueDateFrom>
        <invoiceIssueDateTo>{date_to}</invoiceIssueDateTo>
      </invoiceIssueDate>
    </mandatoryQueryParams>
    <invoiceDirection>{direction}</invoiceDirection>
  </invoiceQueryParams>
</QueryInvoiceDigestRequest>"""

        response = requests.post(f"{self.base_url}/queryInvoiceDigest", data=xml.encode('utf-8'), headers={'Content-Type': 'application/xml'})
        if response.status_code != 200: return []
        
        digests = re.findall(r'<(?:[^:]+:)?invoiceDigest>([\s\S]*?)</(?:[^:]+:)?invoiceDigest>', response.text)
        invoices = []
        for d in digests:
            invoices.append({
                'invoice_number': extract_tag(d, 'invoiceNumber'),
                'invoice_issue_date': extract_tag(d, 'invoiceIssueDate'),
                'invoice_delivery_date': extract_tag(d, 'invoiceDeliveryDate'),
                'supplier_tax_number': extract_tag(d, 'supplierTaxNumber'),
                'customer_tax_number': extract_tag(d, 'customerTaxNumber'),
                'invoice_operation': extract_tag(d, 'invoiceOperation'),
                'invoice_net_amount': float(extract_tag(d, 'invoiceNetAmount') or 0),
                'invoice_vat_amount': float(extract_tag(d, 'invoiceVatAmount') or 0),
                'invoice_gross_amount': float(extract_tag(d, 'invoiceGrossAmount') or 0),
                'payment_method': extract_tag(d, 'paymentMethod'),
                'currency': extract_tag(d, 'currency') or 'HUF',
                'supplier_name': extract_tag(d, 'supplierName'),
                'customer_name': extract_tag(d, 'customerName'),
                'invoice_direction': direction
            })
        return invoices

    def query_details(self, invoice_number):
        request_id = generate_request_id()
        timestamp = get_iso_timestamp()
        auth_xml = self._get_auth_xml(request_id, timestamp)
        
        xml_template = f"""<?xml version="1.0" encoding="UTF-8"?>
<QueryInvoiceDataRequest xmlns="http://schemas.nav.gov.hu/OSA/3.0/api" xmlns:common="http://schemas.nav.gov.hu/NTCA/1.0/common">
  <common:header>
    <common:requestId>{request_id}</common:requestId>
    <common:timestamp>{timestamp}</common:timestamp>
    <common:requestVersion>3.0</common:requestVersion>
    <common:headerVersion>1.0</common:headerVersion>
  </common:header>
  {auth_xml}
  <invoiceNumberQuery>
    <invoiceNumber>{invoice_number}</invoiceNumber>
    <invoiceDirection>{{direction}}</invoiceDirection>
  </invoiceNumberQuery>
</QueryInvoiceDataRequest>"""
        
        # Try OUTBOUND then INBOUND
        for direction in ['OUTBOUND', 'INBOUND']:
            xml = xml_template.replace('{direction}', direction)
            response = requests.post(f"{self.base_url}/queryInvoiceData", data=xml.encode('utf-8'), headers={'Content-Type': 'application/xml'})
            if response.status_code == 200 and 'invoiceData' in response.text:
                data = extract_tag(response.text, 'invoiceData')
                return base64.b64decode(data).decode('utf-8')
        return None

def parse_invoice_xml(xml):
    lines = re.findall(r'<(?:[^:]+:)?line>([\s\S]*?)</(?:[^:]+:)?line>', xml)
    items = []
    for line_xml in lines:
        items.append({
            'line_number': int(extract_tag(line_xml, 'lineNumber') or 0),
            'line_description': clean_text(extract_tag(line_xml, 'lineDescription')),
            'quantity': float(extract_tag(line_xml, 'quantity') or 0),
            'unit_of_measure': clean_text(extract_tag(line_xml, 'unitOfMeasure') or extract_tag(line_xml, 'unitOfMeasureOwn')),
            'unit_price': float(extract_tag(line_xml, 'unitPrice') or extract_tag(line_xml, 'unitPriceHUF') or 0),
            'net_amount': float(extract_tag(line_xml, 'lineNetAmount') or extract_tag(line_xml, 'lineNetAmountData') or 0),
            'vat_rate': clean_text(extract_tag(line_xml, 'vatPercentage') or extract_tag(line_xml, 'vatRate') or extract_tag(line_xml, 'vatExemption')),
            'vat_amount': float(extract_tag(line_xml, 'lineVatAmount') or extract_tag(line_xml, 'lineVatAmountHUF') or 0),
            'gross_amount': float(extract_tag(line_xml, 'lineGrossAmount') or extract_tag(line_xml, 'lineGrossAmountData') or 0),
            'product_code': clean_text(extract_tag(line_xml, 'productCodeValue') or extract_tag(line_xml, 'productCodeOwnValue'))
        })
    
    total_gross = float(extract_tag(xml, 'invoiceGrossAmount') or extract_tag(xml, 'invoiceGrossAmountHUF') or 0)
    is_cash = 'cashAccountingIndicator' in xml or 'PÉNZFORGALMI ELSZÁMOLÁS' in xml.upper() or 'PENZFORGALMI ELSZAMOLAS' in xml.upper()
    
    return {
        'items': items,
        'total_gross_amount': total_gross,
        'is_cash_accounting': is_cash
    }

def main():
    parser = argparse.ArgumentParser(description='NAV Ad-hoc Sync Engine')
    parser.add_argument('command', choices=['digest', 'details'], help='Command to run')
    parser.add_argument('--creds', required=True, help='JSON credentials string')
    parser.add_argument('--start-date', help='Start date (YYYY-MM-DD) for digest')
    parser.add_argument('--end-date', help='End date (YYYY-MM-DD) for digest')
    parser.add_argument('--invoices', help='JSON list of invoices for details (id, invoice_number)')
    
    args = parser.parse_args()
    creds = json.loads(args.creds)
    client = NAVClient(creds)

    if args.command == 'digest':
        token = client.get_token()
        if not token:
            print(json.dumps({"error": "Failed to get token"}), file=sys.stderr)
            sys.exit(1)
        
        all_invoices = []
        start = datetime.strptime(args.start_date, '%Y-%m-%d')
        end = datetime.strptime(args.end_date, '%Y-%m-%d')
        
        curr = start
        while curr <= end:
            chunk_end = min(curr + timedelta(days=30), end)
            s_str = curr.strftime('%Y-%m-%d')
            e_str = chunk_end.strftime('%Y-%m-%d')
            
            for direction in ['OUTBOUND', 'INBOUND']:
                all_invoices.extend(client.query_digest(token, s_str, e_str, direction))
                time.sleep(0.5)
            curr = chunk_end + timedelta(days=1)
            
        print(json.dumps(all_invoices, indent=2))

    elif args.command == 'details':
        invoices = json.loads(args.invoices)
        results = []
        for inv in invoices:
            xml = client.query_details(inv['invoice_number'])
            if xml:
                details = parse_invoice_xml(xml)
                details['nav_invoice_id'] = inv.get('id')
                details['invoice_number'] = inv['invoice_number']
                results.append(details)
            time.sleep(0.5)
        print(json.dumps(results, indent=2))

if __name__ == "__main__":
    main()
