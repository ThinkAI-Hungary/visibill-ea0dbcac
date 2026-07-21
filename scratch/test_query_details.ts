import crypto from 'crypto';
import zlib from 'zlib';

const credentials = {
  nav_username: "el9bpmed6fx2q7t",
  nav_password: "NatasaKornel2025#",
  nav_tax_number: "14160877",
  nav_sign_key: "56-bb1a-f3e6e9cc58695AJATW2DO749",
  nav_exchange_key: "af175AJATW2DNPLL",
  software_id: "HU141608775E576346",
  is_test_environment: false
};

const navApiUrl = 'https://api.onlineszamla.nav.gov.hu/invoiceService/v3';

function generateRequestId() {
  const datePart = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `RID${datePart}${randomPart}`;
}

function getCompactTimestamp(d: Date): string {
  return d.toISOString().replace(/\D/g, '').slice(0, 14);
}

function sha3_512(data: string): string {
  return crypto.createHash('sha3-512').update(data).digest('hex').toUpperCase();
}

function sha512(data: string): string {
  return crypto.createHash('sha512').update(data).digest('hex').toUpperCase();
}

async function getNavToken(): Promise<string> {
  const requestId = generateRequestId();
  const now = new Date();
  const timestamp = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const compactTimestamp = getCompactTimestamp(now);

  const passwordHash = sha512(credentials.nav_password);
  const signatureInput = requestId + compactTimestamp + credentials.nav_sign_key;
  const signature = sha3_512(signatureInput);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<TokenExchangeRequest xmlns="http://schemas.nav.gov.hu/OSA/3.0/api" xmlns:common="http://schemas.nav.gov.hu/NTCA/1.0/common">
  <common:header>
    <common:requestId>${requestId}</common:requestId>
    <common:timestamp>${timestamp}</common:timestamp>
    <common:requestVersion>3.0</common:requestVersion>
    <common:headerVersion>1.0</common:headerVersion>
  </common:header>
  <common:user>
    <common:login>${credentials.nav_username}</common:login>
    <common:passwordHash cryptoType="SHA-512">${passwordHash}</common:passwordHash>
    <common:taxNumber>${credentials.nav_tax_number}</common:taxNumber>
    <common:requestSignature cryptoType="SHA3-512">${signature}</common:requestSignature>
  </common:user>
  <software>
    <softwareId>${credentials.software_id}</softwareId>
    <softwareName>Visibill</softwareName>
    <softwareOperation>ONLINE_SERVICE</softwareOperation>
    <softwareMainVersion>1.0</softwareMainVersion>
    <softwareDevName>Visibill</softwareDevName>
    <softwareDevContact>support@visibill.hu</softwareDevContact>
  </software>
</TokenExchangeRequest>`;

  const response = await fetch(`${navApiUrl}/tokenExchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/xml' },
    body: xml
  });

  const text = await response.text();
  const match = text.match(/<(?:ns2:)?encodedExchangeToken>([^<]+)<\/(?:ns2:)?encodedExchangeToken>/);
  if (!match) {
    throw new Error(`Token exchange failed: ${text}`);
  }

  // Decrypt token
  const encodedToken = match[1];
  const key = Buffer.from(credentials.nav_exchange_key, 'utf-8');
  const encrypted = Buffer.from(encodedToken, 'base64');
  const decipher = crypto.createDecipheriv('aes-128-ecb', key, null);
  decipher.setAutoPadding(false);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf-8').trim();
}

async function queryInvoiceData(token: string, invoiceNumber: string, direction: string) {
  const requestId = generateRequestId();
  const now = new Date();
  const timestamp = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const compactTimestamp = getCompactTimestamp(now);

  const passwordHash = sha512(credentials.nav_password);
  const signatureInput = requestId + compactTimestamp + credentials.nav_sign_key;
  const signature = sha3_512(signatureInput);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<QueryInvoiceDataRequest xmlns="http://schemas.nav.gov.hu/OSA/3.0/api" xmlns:common="http://schemas.nav.gov.hu/NTCA/1.0/common">
  <common:header>
    <common:requestId>${requestId}</common:requestId>
    <common:timestamp>${timestamp}</common:timestamp>
    <common:requestVersion>3.0</common:requestVersion>
    <common:headerVersion>1.0</common:headerVersion>
  </common:header>
  <common:user>
    <common:login>${credentials.nav_username}</common:login>
    <common:passwordHash cryptoType="SHA-512">${passwordHash}</common:passwordHash>
    <common:taxNumber>${credentials.nav_tax_number}</common:taxNumber>
    <common:requestSignature cryptoType="SHA3-512">${signature}</common:requestSignature>
  </common:user>
  <software>
    <softwareId>${credentials.software_id}</softwareId>
    <softwareName>Visibill</softwareName>
    <softwareOperation>ONLINE_SERVICE</softwareOperation>
    <softwareMainVersion>1.0</softwareMainVersion>
    <softwareDevName>Visibill</softwareDevName>
    <softwareDevContact>support@visibill.hu</softwareDevContact>
  </software>
  <invoiceNumberQuery>
    <invoiceNumber>${invoiceNumber}</invoiceNumber>
    <invoiceDirection>${direction}</invoiceDirection>
  </invoiceNumberQuery>
</QueryInvoiceDataRequest>`;

  const response = await fetch(`${navApiUrl}/queryInvoiceData`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/xml' },
    body: xml
  });

  const text = await response.text();
  console.log(`\n--- Response for ${invoiceNumber} ---`);
  console.log(text);
  
  const invoiceDataMatch = text.match(/<(?:ns2:)?invoiceData>([^<]+)<\/(?:ns2:)?invoiceData>/);
  const compressionMatch = text.match(/<(?:ns2:)?compressedContentIndicator>([^<]+)<\/(?:ns2:)?compressedContentIndicator>/);
  
  if (invoiceDataMatch) {
    const isCompressed = compressionMatch && compressionMatch[1] === 'true';
    const buf = Buffer.from(invoiceDataMatch[1], 'base64');
    let decoded = '';
    
    if (isCompressed) {
      decoded = zlib.gunzipSync(buf).toString('utf-8');
      console.log('\n--- Decoded (Gunzipped) Invoice XML ---');
    } else {
      decoded = buf.toString('utf-8');
      console.log('\n--- Decoded Invoice XML ---');
    }
    console.log(decoded.slice(0, 3000));
  } else {
    console.log('No invoiceData tag found in the response.');
  }
}

async function main() {
  try {
    const token = await getNavToken();
    console.log('Got exchange token:', token);
    await queryInvoiceData(token, 'SZ/3290006/03957/00016', 'INBOUND');
    await queryInvoiceData(token, '9012026000029136', 'INBOUND');
  } catch (err: any) {
    console.error('Error:', err.message);
  }
}

main();
