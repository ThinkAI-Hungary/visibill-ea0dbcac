import crypto from 'crypto';
import zlib from 'zlib';
import fs from 'fs';

const credentials = {
  nav_username: "0ohlqqbe82v3rlr",
  nav_password: "1024Victoria",
  nav_tax_number: "12970553",
  nav_sign_key: "19-9860-89eb75a404e15FP0WZA75OMZ",
  nav_exchange_key: "9c715FP0WZA75EQ4",
  software_id: "HU1297055362BDE7EC",
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

  const encodedToken = match[1];
  const key = Buffer.from(credentials.nav_exchange_key, 'utf-8');
  const encrypted = Buffer.from(encodedToken, 'base64');
  const decipher = crypto.createDecipheriv('aes-128-ecb', key, null);
  decipher.setAutoPadding(false);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf-8').trim();
}

async function saveInvoiceXml(token: string, invoiceNumber: string, filename: string) {
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
    <invoiceDirection>INBOUND</invoiceDirection>
  </invoiceNumberQuery>
</QueryInvoiceDataRequest>`;

  const response = await fetch(`${navApiUrl}/queryInvoiceData`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/xml' },
    body: xml
  });

  const text = await response.text();
  const dataMatch = text.match(/<(?:\w+:)?invoiceData>([\s\S]*?)<\/(?:\w+:)?invoiceData>/);
  if (dataMatch) {
    const isCompressed = text.includes('compressedContentIndicator>true');
    const buf = Buffer.from(dataMatch[1].trim(), 'base64');
    const decoded = isCompressed ? zlib.gunzipSync(buf).toString('utf-8') : buf.toString('utf-8');
    fs.writeFileSync(`scratch/${filename}`, decoded, 'utf-8');
    console.log(`Saved decoded XML to scratch/${filename}`);
  } else {
    console.log(`Could not find invoiceData for ${invoiceNumber}`);
  }
}

async function main() {
  try {
    const token = await getNavToken();
    await saveInvoiceXml(token, 'A27700851/1970/00002', 'victoria_odd.xml');
  } catch (err: any) {
    console.error('Error:', err.message);
  }
}

main();
