// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { sha3_512 } from "npm:js-sha3"; // for requestSignature (SHA3-512)

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function utcTimestampYYYYMMDDHHMMSS(d = new Date()): string {
  const pad = (n: number, l = 2) => n.toString().padStart(l, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds())
  );
}

async function sha512UpperHex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-512", data);
  const hex = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  return hex.toUpperCase();
}

function buildHeader({ login, password, taxNumber, signatureKey }: {
  login: string; password: string; taxNumber: string; signatureKey: string;
}) {
  const requestId = crypto.randomUUID().replace(/-/g, "").slice(0, 32).toUpperCase();
  const timestamp = utcTimestampYYYYMMDDHHMMSS();
  const requestSignature = sha3_512(requestId + timestamp + signatureKey).toUpperCase();

  return { requestId, timestamp, requestSignature, taxNumber, login };
}

async function buildUserXml(login: string, plainPassword: string, requestSignature: string) {
  const passwordHash = await sha512UpperHex(plainPassword); // cryptoType must be SHA-512
  return `
    <user>
      <login>${login}</login>
      <passwordHash cryptoType="SHA-512">${passwordHash}</passwordHash>
      <requestSignature cryptoType="SHA3-512">${requestSignature}</requestSignature>
    </user>`;
}

function softwareXml() {
  // Fill these with your own software metadata
  return `
    <software>
      <softwareId>LOVABLE_DEMO_001</softwareId>
      <softwareName>Lovable NAV Connector</softwareName>
      <softwareOperation>ONLINE_SERVICE</softwareOperation>
      <softwareMainVersion>1.0</softwareMainVersion>
      <softwareDevName>Your Company</softwareDevName>
      <softwareDevContact>info@example.com</softwareDevContact>
      <softwareDevCountryCode>HU</softwareDevCountryCode>
      <softwareDevTaxNumber>00000000</softwareDevTaxNumber>
    </software>`;
}

function xmlEnvelope(header: {requestId:string; timestamp:string}, bodyXml: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
  <QueryRequest xmlns="http://schemas.nav.gov.hu/OSA/3.0/api">
    <header>
      <requestId>${header.requestId}</requestId>
      <timestamp>${header.timestamp}</timestamp>
      <requestVersion>3.0</requestVersion>
    </header>
    ${bodyXml}
  </QueryRequest>`;
}

async function queryInvoiceDigestXml(args: {
  login: string; password: string; signatureKey: string; taxNumber: string;
  direction: "INBOUND"|"OUTBOUND"; page: number;
  issueDateFrom?: string; issueDateTo?: string; // yyyy-MM-dd
  insDateTimeFrom?: string; insDateTimeTo?: string; // yyyy-MM-ddTHH:mm:ssZ
}) {
  const { requestId, timestamp, requestSignature } = buildHeader(args);
  const mandatory =
    (args.issueDateFrom && args.issueDateTo)
      ? `<mandatoryQueryParams>
           <invoiceIssueDate>
             <dateFrom>${args.issueDateFrom}</dateFrom>
             <dateTo>${args.issueDateTo}</dateTo>
           </invoiceIssueDate>
         </mandatoryQueryParams>`
      : `<mandatoryQueryParams>
           <insDate>
             <dateTimeFrom>${args.insDateTimeFrom}</dateTimeFrom>
             <dateTimeTo>${args.insDateTimeTo}</dateTimeTo>
           </insDate>
         </mandatoryQueryParams>`;

  const body = `
    <userHeader>
      <taxNumber>${args.taxNumber}</taxNumber>
    </userHeader>
    ${softwareXml()}
    <page>${args.page}</page>
    <invoiceDirection>${args.direction}</invoiceDirection>
    <invoiceQueryParams>
      ${mandatory}
    </invoiceQueryParams>`;

  return {
    xml: xmlEnvelope({ requestId, timestamp }, `${await buildUserXml(args.login, args.password, requestSignature)}${body}`),
    requestId, timestamp
  };
}

async function queryInvoiceDataXml(args: {
  login: string; password: string; signatureKey: string; taxNumber: string;
  direction: "INBOUND"|"OUTBOUND";
  invoiceNumber: string; batchIndex?: number; supplierTaxNumber?: string;
}) {
  const { requestId, timestamp, requestSignature } = buildHeader(args);

  const invoiceNumberQuery = `
    <invoiceNumberQuery>
      <invoiceNumber>${args.invoiceNumber}</invoiceNumber>
      <invoiceDirection>${args.direction}</invoiceDirection>
      ${args.batchIndex ? `<batchIndex>${args.batchIndex}</batchIndex>` : ``}
      ${args.supplierTaxNumber ? `<supplierTaxNumber>${args.supplierTaxNumber}</supplierTaxNumber>` : ``}
    </invoiceNumberQuery>`;

  const body = `
    <userHeader>
      <taxNumber>${args.taxNumber}</taxNumber>
    </userHeader>
    ${softwareXml()}
    ${invoiceNumberQuery}`;

  return {
    xml: xmlEnvelope({ requestId, timestamp }, `${await buildUserXml(args.login, args.password, requestSignature)}${body}`),
    requestId, timestamp
  };
}

async function callNav(xml: string, endpoint: "queryInvoiceDigest" | "queryInvoiceData", useTest = true) {
  const base = useTest
    ? "https://api-test.onlineszamla.nav.gov.hu"
    : "https://api.onlineszamla.nav.gov.hu";
  const url = `${base}/invoiceService/v3/${endpoint}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/xml" },
    body: xml,
  });
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, body: text };
  }
  return { ok: true, status: res.status, body: text };
}

// Tiny helper to extract a few fields from the digest XML for easy rendering.
function pickDigests(xml: string) {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const get = (sel: string) => doc?.getElementsByTagName(sel)[0]?.textContent ?? null;

  const currentPage = Number(get("currentPage") ?? 1);
  const availablePage = Number(get("availablePage") ?? currentPage);

  const nodes = [...doc.getElementsByTagName("invoiceDigest")];
  const items = nodes.map(n => ({
    invoiceNumber: n.getElementsByTagName("invoiceNumber")[0]?.textContent ?? "",
    supplierTaxNumber: n.getElementsByTagName("supplierTaxNumber")[0]?.textContent ?? "",
    customerTaxNumber: n.getElementsByTagName("customerTaxNumber")[0]?.textContent ?? "",
    invoiceOperation: n.getElementsByTagName("invoiceOperation")[0]?.textContent ?? "",
    insDate: n.getElementsByTagName("insDate")[0]?.textContent ?? "",
  }));
  return { currentPage, availablePage, items, rawXml: xml };
}

function base64ToUtf8(b64: string) {
  try { return new TextDecoder().decode(Uint8Array.from(atob(b64), c => c.charCodeAt(0))); }
  catch { return null; }
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: cors });

  try {
    const { action, test } = Object.fromEntries(new URL(req.url).searchParams);
    const body = await req.json();

    if (action === "list") {
      const { xml } = await queryInvoiceDigestXml(body);
      const r = await callNav(xml, "queryInvoiceDigest", test !== "false");
      if (!r.ok) return new Response(JSON.stringify(r), { status: r.status, headers: { ...cors, "content-type": "application/json" } });
      const picked = pickDigests(r.body);
      return new Response(JSON.stringify({ ok: true, ...picked }), { headers: { ...cors, "content-type": "application/json" } });
    }

    if (action === "data") {
      const { xml } = await queryInvoiceDataXml(body);
      const r = await callNav(xml, "queryInvoiceData", test !== "false");
      if (!r.ok) return new Response(JSON.stringify(r), { status: r.status, headers: { ...cors, "content-type": "application/json" } });

      // Pull <invoiceData> (BASE64) if present
      const doc = new DOMParser().parseFromString(r.body, "text/xml");
      const b64 = doc.getElementsByTagName("invoiceData")[0]?.textContent ?? null;
      const decodedXml = b64 ? base64ToUtf8(b64) : null;
      return new Response(JSON.stringify({ ok: true, rawXml: r.body, invoiceXml: decodedXml }), { headers: { ...cors, "content-type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: false, error: "Unknown action" }), { status: 400, headers: { ...cors, "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { ...cors, "content-type": "application/json" } });
  }
});