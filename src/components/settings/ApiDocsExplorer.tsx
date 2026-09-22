import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  FileCode2,
  Copy,
  Check,
  Play,
  Terminal,
  ShieldCheck,
  Zap,
  BookOpen,
  Send,
  Loader2,
  Sparkles,
  Maximize2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export interface EndpointDef {
  id: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  category: 'invoices' | 'partners' | 'transactions' | 'ledger' | 'reports' | 'companies' | 'categories' | 'nav' | 'auth' | 'tickets';
  categoryTitle: string;
  title: string;
  description: string;
  scope: 'read' | 'read_write';
  queryParams?: { name: string; type: string; required: boolean; description: string }[];
  bodyParams?: { name: string; type: string; required: boolean; description: string }[];
  curlExample: string;
  sampleBody?: string;
  sampleResponse: string;
}

export const BASE_URL = 'https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/customer-api';

export const ENDPOINTS: EndpointDef[] = [
  // ── INVOICES ──
  {
    id: 'get-invoices',
    method: 'GET',
    path: '/v1/invoices',
    category: 'invoices',
    categoryTitle: 'Számlák (Invoices)',
    title: 'Számlák listázása, szűrése & Hiánylista (has_image=false)',
    description: 'Bejövő és kimenő (NAV szinkronizált és rögzített) számlák lekérdezése lapozással. A has_image=false szűrővel gépileg azonnal lekérhető a számlaképpel még nem rendelkező tételek hiánylistája!',
    scope: 'read',
    queryParams: [
      { name: 'direction', type: 'string', required: false, description: 'all | inbound | outbound (alapértelmezett: all)' },
      { name: 'has_image', type: 'boolean', required: false, description: 'true: csak képpel rendelkező | false: HIÁNYLISTA (kép nélküli NAV számlák)' },
      { name: 'status', type: 'string', required: false, description: 'paid (fizetve) | unpaid (kifizetetlen) | all' },
      { name: 'date_from', type: 'string (YYYY-MM-DD)', required: false, description: 'Kibocsátás dátuma -tól szűrő' },
      { name: 'date_to', type: 'string (YYYY-MM-DD)', required: false, description: 'Kibocsátás dátuma -ig szűrő' },
      { name: 'partner_tax_number', type: 'string', required: false, description: 'Partner adószám szűrő (részleges egyezés)' },
      { name: 'include_items', type: 'boolean', required: false, description: 'true esetén beágyazza a számla tételsorait' },
      { name: 'page', type: 'number', required: false, description: 'Oldalszám (alapértelmezett: 1)' },
      { name: 'page_size', type: 'number', required: false, description: 'Tételek száma oldalanként (1-100, alapértelmezett: 50)' },
      { name: 'company_id', type: 'uuid', required: false, description: 'Cég azonosító (többcéges kulcsnál opcionálisan felülírható)' },
    ],
    curlExample: `curl -H "Authorization: Bearer <API_KEY>" \\
     "${BASE_URL}/v1/invoices?direction=inbound&has_image=false&limit=10"`,
    sampleResponse: JSON.stringify({
      success: true,
      data: {
        invoices: [
          {
            id: "a79a5eb7-e683-4c8c-be76-b9afef3f50e1",
            invoice_number: "FBADS-070-105702620",
            direction: "inbound",
            partner_name: "Meta Platforms Ireland Ltd.",
            partner_tax_number: "IE9692928F",
            gross_amount: 45200,
            net_amount: 45200,
            currency: "HUF",
            is_paid: true,
            issue_date: "2026-08-31",
            has_image: false,
            attachment_url: null,
            is_nav_synced: true,
            nav_status: "verified",
            processing_status: "feldolgozott"
          }
        ],
        pagination: { page: 1, page_size: 50, total_items: 12, total_pages: 1 }
      }
    }, null, 2)
  },
  {
    id: 'post-invoice-upload',
    method: 'POST',
    path: '/v1/invoices/upload',
    category: 'invoices',
    categoryTitle: 'Számlák (Invoices)',
    title: 'Számlakép feltöltése + Azonnali NAV párosítás',
    description: 'Számla PDF / kép feltöltése Base64 kódolással. A nav_invoice_number megadásával a rendszer automatikusan megkeresi és hozzárendeli a képet a meglévő NAV Online Számla tételhez!',
    scope: 'read_write',
    bodyParams: [
      { name: 'file_base64', type: 'string (base64)', required: true, description: 'A számla PDF vagy képfájl Base64 kódolású tartalma' },
      { name: 'nav_invoice_number', type: 'string', required: false, description: 'NAV bizonylatszám (ha megadod, azonnal összekapcsolja a tétellel)' },
      { name: 'file_name', type: 'string', required: false, description: 'Eredeti fájlnév (pl. szamla_202608.pdf)' },
      { name: 'direction', type: 'string', required: false, description: 'INBOUND | OUTBOUND (alapértelmezett: INBOUND)' },
      { name: 'company_id', type: 'uuid', required: false, description: 'Cég azonosítója' }
    ],
    curlExample: `curl -X POST -H "Authorization: Bearer <API_KEY>" -H "Content-Type: application/json" \\
     -d '{
       "file_base64": "JVBERi0xLjQKJcTl8uXr...",
       "nav_invoice_number": "FBADS-070-105702620",
       "file_name": "facebook_hirdetes_augusztus.pdf"
     }' \\
     "${BASE_URL}/v1/invoices/upload"`,
    sampleBody: JSON.stringify({
      file_base64: "JVBERi0xLjQKJcTl8uXr...",
      nav_invoice_number: "FBADS-070-105702620",
      file_name: "facebook_hirdetes_augusztus.pdf"
    }, null, 2),
    sampleResponse: JSON.stringify({
      success: true,
      message: "Számlakép sikeresen feltöltve és azonnal összekapcsolva a meglévő NAV-tétellel.",
      data: {
        matched: true,
        invoice_id: "a79a5eb7-e683-4c8c-be76-b9afef3f50e1",
        invoice_number: "FBADS-070-105702620",
        has_image: true,
        attachment_url: "https://.../storage/v1/object/public/invoice-uploads/.../facebook_hirdetes_augusztus.pdf",
        status: "feldolgozott",
        nav_status: "verified"
      }
    }, null, 2)
  },
  {
    id: 'get-invoice-single',
    method: 'GET',
    path: '/v1/invoices/:id',
    category: 'invoices',
    categoryTitle: 'Számlák (Invoices)',
    title: 'Számla részletei és tételsorai',
    description: 'Egyetlen számla összes fejlécadata, számlakép URL-je és tételsorai (mennyiség, egységár, ÁFA kulcs, nettó és bruttó sorösszegek).',
    scope: 'read',
    queryParams: [
      { name: 'company_id', type: 'uuid', required: false, description: 'Cég azonosítója' }
    ],
    curlExample: `curl -H "Authorization: Bearer <API_KEY>" \\
     "${BASE_URL}/v1/invoices/<INVOICE_ID>"`,
    sampleResponse: JSON.stringify({
      success: true,
      data: {
        invoice: {
          id: "e5654ff2-1771-43e9-ac83-5a124e1b86e3",
          invoice_number: "JJKMINX4-0016",
          direction: "inbound",
          partner_name: "Anthropic, PBC",
          gross_amount: 228.6,
          currency: "EUR",
          is_paid: false,
          has_image: true,
          attachment_url: "https://.../sample.pdf",
          items: [
            {
              id: "66ff0e32-4b8a-45e5-96c0-2c3d9e1b14b3",
              line_number: 1,
              description: "Max plan - 20x",
              quantity: 1,
              unit: "db",
              unit_price: 180,
              net_amount: 180,
              vat_rate: "27%",
              vat_amount: 48.6,
              gross_amount: 228.6
            }
          ]
        }
      }
    }, null, 2)
  },
  {
    id: 'patch-invoice',
    method: 'PATCH',
    path: '/v1/invoices/:id',
    category: 'invoices',
    categoryTitle: 'Számlák (Invoices)',
    title: 'Bizonylatszám javítása (OCR hiba) & Kép csatolása',
    description: 'Bizonylatszám javítása (pl. OCR félreolvasás korrekciója), számlakép hozzárendelése (attachment_url vagy közvetlen file_base64 feltöltés), fizetettségi állapot módosítása.',
    scope: 'read_write',
    bodyParams: [
      { name: 'invoice_number', type: 'string', required: false, description: 'Bizonylatszám javítása / módosítása (OCR korrekció)' },
      { name: 'attachment_url', type: 'string (URL)', required: false, description: 'Meglévő számlakép URL hozzárendelése' },
      { name: 'file_base64', type: 'string (base64)', required: false, description: 'Közvetlen PDF/kép feltöltése és csatolása a számlához' },
      { name: 'is_paid', type: 'boolean', required: false, description: 'Fizetett státusz (true vagy false)' },
      { name: 'payment_date', type: 'string (YYYY-MM-DD)', required: false, description: 'Kifizetés napja' },
      { name: 'category_id', type: 'uuid', required: false, description: 'Költség- vagy bevételi kategória' },
      { name: 'project_id', type: 'uuid', required: false, description: 'Projekt azonosító' }
    ],
    curlExample: `curl -X PATCH -H "Authorization: Bearer <API_KEY>" -H "Content-Type: application/json" \\
     -d '{"invoice_number": "INV-2026-001", "attachment_url": "https://.../szamla.pdf"}' \\
     "${BASE_URL}/v1/invoices/<INVOICE_ID>"`,
    sampleBody: JSON.stringify({ invoice_number: "INV-2026-001", is_paid: true }, null, 2),
    sampleResponse: JSON.stringify({
      success: true,
      message: "Számla adatai / bizonylatszáma / számlaképe sikeresen frissítve.",
      data: { invoice: { id: "e5654ff2-...", invoice_number: "INV-2026-001", has_image: true } }
    }, null, 2)
  },
  {
    id: 'get-invoice-image',
    method: 'GET',
    path: '/v1/invoices/:id/image',
    category: 'invoices',
    categoryTitle: 'Számlák (Invoices)',
    title: 'Számlakép letöltése / Signed URL',
    description: '1 óráig érvényes, közvetlen pre-signed URL generálása a csatolt bizonylathoz/számlaképhez. ?redirect=true paraméterrel azonnali 302 átirányítást hajt végre.',
    scope: 'read',
    queryParams: [
      { name: 'redirect', type: 'boolean', required: false, description: 'true esetén 302 HTTP átirányít a képre' },
      { name: 'company_id', type: 'uuid', required: false, description: 'Cég azonosító' },
    ],
    curlExample: `curl -H "Authorization: Bearer <API_KEY>" \\
     "${BASE_URL}/v1/invoices/<INVOICE_ID>/image"`,
    sampleResponse: JSON.stringify({
      success: true,
      data: {
        invoice_id: "a79a5eb7-e683-4c8c-be76-b9afef3f50e1",
        invoice_number: "FBADS-070-105702620",
        image_url: "https://vxxgvdlqvvchtlmqnrqf.supabase.co/storage/v1/object/sign/invoice-uploads/sample.pdf?token=...",
        expires_in_seconds: 3600
      }
    }, null, 2)
  },
  {
    id: 'delete-invoice',
    method: 'DELETE',
    path: '/v1/invoices/:id',
    category: 'invoices',
    categoryTitle: 'Számlák (Invoices)',
    title: 'Számla törlése',
    description: 'Feltöltött számla törlése tételsorokkal együtt. A NAV-szinkronizált számlákat védi az API (409 Conflict), kivéve ?force=true megadása esetén.',
    scope: 'read_write',
    queryParams: [
      { name: 'force', type: 'boolean', required: false, description: 'true esetén felülbírálja a NAV integritásvédelmi zárat' },
      { name: 'company_id', type: 'uuid', required: false, description: 'Cég azonosító' },
    ],
    curlExample: `curl -X DELETE -H "Authorization: Bearer <API_KEY>" \\
     "${BASE_URL}/v1/invoices/<INVOICE_ID>"`,
    sampleResponse: JSON.stringify({
      success: true,
      message: "Számla sikeresen törölve.",
      data: { id: "a79a5eb7-e683-4c8c-be76-b9afef3f50e1", invoice_number: "UPLOAD-123456" }
    }, null, 2)
  },
  {
    id: 'post-invoice-link',
    method: 'POST',
    path: '/v1/invoices/link',
    category: 'invoices',
    categoryTitle: 'Számlák (Invoices)',
    title: 'Számlakép és NAV-tétel összekötése',
    description: 'Meglévő számlakép (dokumentum URL) és NAV bizonylatszám közvetlen összekötése és opcionális bizonylatszám korrekció.',
    scope: 'read_write',
    bodyParams: [
      { name: 'invoice_id', type: 'uuid', required: false, description: 'Cél számla azonosítója (ha ismert)' },
      { name: 'invoice_number', type: 'string', required: false, description: 'Cél bizonylatszám (pl. NAV számlaszám)' },
      { name: 'attachment_url', type: 'string (URL)', required: false, description: 'Hozzárendelendő számlakép URL-je' },
      { name: 'source_invoice_id', type: 'uuid', required: false, description: 'Másik számla azonosítója, ahonnan át kell venni a számlaképet' }
    ],
    curlExample: `curl -X POST -H "Authorization: Bearer <API_KEY>" -H "Content-Type: application/json" \\
     -d '{
       "invoice_number": "FBADS-070-105702620",
       "attachment_url": "https://vxxgvdlqvvchtlmqnrqf.supabase.co/storage/v1/object/public/invoice-uploads/sample.pdf"
     }' \\
     "${BASE_URL}/v1/invoices/link"`,
    sampleBody: JSON.stringify({
      invoice_number: "FBADS-070-105702620",
      attachment_url: "https://vxxgvdlqvvchtlmqnrqf.supabase.co/storage/v1/object/public/invoice-uploads/sample.pdf"
    }, null, 2),
    sampleResponse: JSON.stringify({
      success: true,
      message: "Számlakép és NAV-tétel sikeresen összekötve / bizonylatszám javítva.",
      data: {
        invoice: {
          id: "a79a5eb7-e683-4c8c-be76-b9afef3f50e1",
          invoice_number: "FBADS-070-105702620",
          has_image: true,
          status: "feldolgozott",
          attachment_url: "https://.../sample.pdf"
        }
      }
    }, null, 2)
  },
  {
    id: 'post-invoice',
    method: 'POST',
    path: '/v1/invoices',
    category: 'invoices',
    categoryTitle: 'Számlák (Invoices)',
    title: 'Új számla rögzítése tételekkel',
    description: 'Új számla adatrekord felvitele strukturált tételsorokkal és összegekkel.',
    scope: 'read_write',
    bodyParams: [
      { name: 'direction', type: 'string', required: true, description: 'inbound | outbound' },
      { name: 'invoice_number', type: 'string', required: true, description: 'Bizonylatszám / sorszám' },
      { name: 'partner_name', type: 'string', required: true, description: 'Partner (vevő vagy szállító) megnevezése' },
      { name: 'partner_tax_number', type: 'string', required: false, description: 'Partner adószáma' },
      { name: 'issue_date', type: 'string (YYYY-MM-DD)', required: true, description: 'Kelt' },
      { name: 'due_date', type: 'string (YYYY-MM-DD)', required: false, description: 'Fizetési határidő' },
      { name: 'gross_amount', type: 'number', required: true, description: 'Bruttó végösszeg' },
      { name: 'currency', type: 'string', required: false, description: 'Pénznem (HUF, EUR, USD - alap: HUF)' },
      { name: 'items', type: 'array of objects', required: false, description: 'Tételsorok (description, net_amount, vat_rate, gross_amount)' }
    ],
    curlExample: `curl -X POST -H "Authorization: Bearer <API_KEY>" -H "Content-Type: application/json" \\
     -d '{
       "direction": "inbound",
       "invoice_number": "INV-2026-99",
       "partner_name": "Dropbox International",
       "issue_date": "2026-08-23",
       "due_date": "2026-09-05",
       "gross_amount": 15.74,
       "currency": "EUR"
     }' \\
     "${BASE_URL}/v1/invoices"`,
    sampleBody: JSON.stringify({
      direction: "inbound",
      invoice_number: "INV-2026-99",
      partner_name: "Dropbox International",
      issue_date: "2026-08-23",
      gross_amount: 15.74,
      currency: "EUR"
    }, null, 2),
    sampleResponse: JSON.stringify({
      success: true,
      message: "Számla sikeresen rögzítve.",
      data: { invoice: { id: "a1b2c3d4-...", invoice_number: "INV-2026-99", gross_amount: 15.74 } }
    }, null, 2)
  },

  // ── PARTNERS ──
  {
    id: 'get-partners',
    method: 'GET',
    path: '/v1/partners',
    category: 'partners',
    categoryTitle: 'Partnerek & Bank (Partners & Bank)',
    title: 'Partnertörzs listázása és keresése',
    description: 'Vevő és szállító partnerek lekérdezése név- és adószám kereséssel.',
    scope: 'read',
    queryParams: [
      { name: 'search', type: 'string', required: false, description: 'Keresőkifejezés (név vagy adószám részlet)' },
      { name: 'page', type: 'number', required: false, description: 'Oldalszám (alap: 1)' },
      { name: 'page_size', type: 'number', required: false, description: 'Tételek oldalanként (alap: 50)' }
    ],
    curlExample: `curl -H "Authorization: Bearer <API_KEY>" \\
     "${BASE_URL}/v1/partners?search=Dropbox"`,
    sampleResponse: JSON.stringify({
      success: true,
      data: {
        partners: [
          {
            id: "11b77c33-e421-4b69-a8c9-825172c00e28",
            name: "Dropbox International Unlimited Company",
            tax_number: "IE9852882W",
            partner_type: "supplier",
            email: "billing@dropbox.com",
            bank_account_number: "11773016-11112222-00000000"
          }
        ],
        pagination: { page: 1, page_size: 50, total_items: 1 }
      }
    }, null, 2)
  },
  {
    id: 'post-partner',
    method: 'POST',
    path: '/v1/partners',
    category: 'partners',
    categoryTitle: 'Partnerek & Bank (Partners & Bank)',
    title: 'Új partner rögzítése',
    description: 'Új partner (vevő vagy szállító) hozzáadása a cég partnertörzséhez.',
    scope: 'read_write',
    bodyParams: [
      { name: 'name', type: 'string', required: true, description: 'Partner hivatalos megnevezése' },
      { name: 'tax_number', type: 'string', required: false, description: 'Adószám (magyar vagy nemzetközi)' },
      { name: 'partner_type', type: 'string', required: false, description: 'customer (vevő) | supplier (szállító)' },
      { name: 'email', type: 'string', required: false, description: 'Kapcsolattartó vagy pénzügyi e-mail cím' },
      { name: 'address', type: 'string', required: false, description: 'Székhely címe' },
      { name: 'bank_account_number', type: 'string', required: false, description: 'Bankszámlaszám' }
    ],
    curlExample: `curl -X POST -H "Authorization: Bearer <API_KEY>" -H "Content-Type: application/json" \\
     -d '{"name": "Dropbox International", "tax_number": "IE9852882W", "partner_type": "supplier", "email": "billing@dropbox.com"}' \\
     "${BASE_URL}/v1/partners"`,
    sampleBody: JSON.stringify({
      name: "Dropbox International",
      tax_number: "IE9852882W",
      partner_type: "supplier",
      email: "billing@dropbox.com"
    }, null, 2),
    sampleResponse: JSON.stringify({
      success: true,
      message: "Partner sikeresen rögzítve.",
      data: { partner: { id: "11b77c33-...", name: "Dropbox International", tax_number: "IE9852882W" } }
    }, null, 2)
  },

  // ── TRANSACTIONS ──
  {
    id: 'get-transactions',
    method: 'GET',
    path: '/v1/transactions',
    category: 'transactions',
    categoryTitle: 'Partnerek & Bank (Partners & Bank)',
    title: 'Banki tranzakciók lekérdezése',
    description: 'Bankkivonati tranzakciók lekérése szűréssel és számlapárosítási információkkal.',
    scope: 'read',
    queryParams: [
      { name: 'unmatched_only', type: 'boolean', required: false, description: 'true esetén csak a párosítatlan tételeket adja vissza' },
      { name: 'date_from', type: 'string (YYYY-MM-DD)', required: false, description: 'Kivonati dátum -tól' },
      { name: 'date_to', type: 'string (YYYY-MM-DD)', required: false, description: 'Kivonati dátum -ig' },
      { name: 'page', type: 'number', required: false, description: 'Oldalszám' }
    ],
    curlExample: `curl -H "Authorization: Bearer <API_KEY>" \\
     "${BASE_URL}/v1/transactions?unmatched_only=true"`,
    sampleResponse: JSON.stringify({
      success: true,
      data: {
        transactions: [
          {
            id: "57262174-a698-4c75-ae90-7b561c28f110",
            booking_date: "2026-08-25",
            partner_name: "Dropbox",
            amount: -6202.93,
            currency: "HUF",
            matched: false,
            invoice_id: null
          }
        ]
      }
    }, null, 2)
  },
  {
    id: 'post-transaction-match',
    method: 'POST',
    path: '/v1/transactions/:id/match',
    category: 'transactions',
    categoryTitle: 'Partnerek & Bank (Partners & Bank)',
    title: 'Banki tétel összekapcsolása számlával',
    description: 'Egy bankkivonati tranzakció és a hozzá tartozó számla párosítása. Automatikusan beállítja a számla kifizetett státuszát is.',
    scope: 'read_write',
    bodyParams: [
      { name: 'invoice_id', type: 'uuid', required: true, description: 'A párosítandó számla belső azonosítója' }
    ],
    curlExample: `curl -X POST -H "Authorization: Bearer <API_KEY>" -H "Content-Type: application/json" \\
     -d '{"invoice_id": "<INVOICE_ID>"}' \\
     "${BASE_URL}/v1/transactions/<TRANSACTION_ID>/match"`,
    sampleBody: JSON.stringify({ invoice_id: "e5654ff2-1771-43e9-ac83-5a124e1b86e3" }, null, 2),
    sampleResponse: JSON.stringify({
      success: true,
      message: "Tranzakció és számla sikeresen összekapcsolva.",
      data: { matched: true, transaction_id: "57262174-...", invoice_id: "e5654ff2-..." }
    }, null, 2)
  },
  {
    id: 'post-transaction-unmatch',
    method: 'POST',
    path: '/v1/transactions/:id/unmatch',
    category: 'transactions',
    categoryTitle: 'Bank & Párosítás (Transactions)',
    title: 'Számlapárosítás visszavonása (Unmatch)',
    description: 'Banki tranzakció és számla összerendelésének feloldása. A korábban párosított számla fizetettségét automatikusan visszaállítja kifizetetlenre (DELETE /v1/transactions/:id/match szintén használható).',
    scope: 'read_write',
    curlExample: `curl -X POST -H "Authorization: Bearer <API_KEY>" \\
     "${BASE_URL}/v1/transactions/<TRANSACTION_ID>/unmatch"`,
    sampleResponse: JSON.stringify({
      success: true,
      message: "Párosítás sikeresen visszavonva.",
      data: { transaction_id: "57262174-...", unmatched_invoice_id: "e5654ff2-..." }
    }, null, 2)
  },
  {
    id: 'delete-transaction',
    method: 'DELETE',
    path: '/v1/transactions/:id',
    category: 'transactions',
    categoryTitle: 'Bank & Párosítás (Transactions)',
    title: 'Tranzakció törlése',
    description: 'Egyedi banki tranzakció törlése. Ha párosítva volt számlához, a párosítást előtte tisztán feloldja.',
    scope: 'read_write',
    curlExample: `curl -X DELETE -H "Authorization: Bearer <API_KEY>" \\
     "${BASE_URL}/v1/transactions/<TRANSACTION_ID>"`,
    sampleResponse: JSON.stringify({
      success: true,
      message: "Tranzakció sikeresen törölve.",
      data: { id: "57262174-a698-4c75-ae90-7b561c28f110" }
    }, null, 2)
  },
  {
    id: 'post-transactions-bulk-delete',
    method: 'POST',
    path: '/v1/transactions/bulk-delete',
    category: 'transactions',
    categoryTitle: 'Bank & Párosítás (Transactions)',
    title: 'Tömeges tranzakció törlés (Bulk Delete)',
    description: 'Akár 500 tranzakció egyidejű kötegelt törlése azonosító lista alapján. Duplikációk és hibás importok gyors tisztítására.',
    scope: 'read_write',
    bodyParams: [
      { name: 'ids', type: 'string[]', required: true, description: 'Törlendő tranzakció UUID azonosítók listája (max 500)' },
      { name: 'company_id', type: 'uuid', required: false, description: 'Cég azonosító' },
    ],
    curlExample: `curl -X POST -H "Authorization: Bearer <API_KEY>" -H "Content-Type: application/json" \\
     -d '{"ids": ["57262174-...", "a1b2c3d4-..."]}' \\
     "${BASE_URL}/v1/transactions/bulk-delete"`,
    sampleBody: JSON.stringify({ ids: ["57262174-a698-4c75-ae90-7b561c28f110"] }, null, 2),
    sampleResponse: JSON.stringify({
      success: true,
      message: "1 tranzakció sikeresen törölve.",
      data: { requested_count: 1, deleted_count: 1, deleted_ids: ["57262174-a698-4c75-ae90-7b561c28f110"] }
    }, null, 2)
  },

  // ── CATEGORIES ──
  {
    id: 'get-categories',
    method: 'GET',
    path: '/v1/categories',
    category: 'categories',
    categoryTitle: 'Kategóriák (Categories)',
    title: 'Kategóriatörzs lekérdezése',
    description: 'A céghez tartozó bevételi és költségkategóriák listája (ikon, szín, kapcsolódó főkönyvi számlák).',
    scope: 'read',
    queryParams: [
      { name: 'company_id', type: 'uuid', required: false, description: 'Cég azonosító' },
    ],
    curlExample: `curl -H "Authorization: Bearer <API_KEY>" \\
     "${BASE_URL}/v1/categories"`,
    sampleResponse: JSON.stringify({
      success: true,
      data: {
        categories: [
          { id: "cat-1", name: "Irodaszer & Eszközök", icon: "folder", color: "#3b82f6", gl_accounts: ["511", "512"] },
          { id: "cat-2", name: "Szoftver előfizetések", icon: "cloud", color: "#10b981", gl_accounts: ["521"] }
        ],
        count: 2
      }
    }, null, 2)
  },

  // ── NAV INTEGRATION ──
  {
    id: 'get-nav-status',
    method: 'GET',
    path: '/v1/nav/status',
    category: 'nav',
    categoryTitle: 'NAV Szinkron (NAV Status)',
    title: 'NAV technikai felhasználó és szinkron státusz',
    description: 'A cég NAV Online Számla kapcsolatának állapota, utolsó sikeres szinkronizáció időpontja és a legfrissebb szinkron naplóbejegyzések.',
    scope: 'read',
    queryParams: [
      { name: 'company_id', type: 'uuid', required: false, description: 'Cég azonosító' },
    ],
    curlExample: `curl -H "Authorization: Bearer <API_KEY>" \\
     "${BASE_URL}/v1/nav/status"`,
    sampleResponse: JSON.stringify({
      success: true,
      data: {
        company_id: "c132676d-85c5-4e2a-bde1-d966766bb94f",
        nav_configured: true,
        technical_user: "TEC***",
        environment: "production",
        last_sync: { timestamp: "2026-09-22T00:00:00Z", status: "success", invoices_fetched: 14 },
        recent_logs: []
      }
    }, null, 2)
  },
  {
    id: 'post-nav-sync',
    method: 'POST',
    path: '/v1/nav/sync',
    category: 'nav',
    categoryTitle: 'NAV Szinkron (NAV Sync)',
    title: 'Manuális NAV számla szinkronizáció indítása dátumtartománnyal',
    description: 'Lekéri a NAV Online Számla rendszeréből a számlákat a megadott dátumtartományra és irányra, elmenti őket, és automatikus tranzakció-újrapárosítási feladatot indít.',
    scope: 'read_write',
    bodyParams: [
      { name: 'date_from', type: 'string (YYYY-MM-DD)', required: true, description: 'Kezdő dátum (pl. 2026-04-01)' },
      { name: 'date_to', type: 'string (YYYY-MM-DD)', required: false, description: 'Záró dátum (alapértelmezetten a mai nap)' },
      { name: 'direction', type: 'string', required: false, description: "'inbound' (bejövő), 'outbound' (kimenő) vagy 'both' (mindkettő, alapértelmezett)" },
      { name: 'fetch_details', type: 'boolean', required: false, description: 'Tételszintű sorok letöltése (alapértelmezett: true)' },
      { name: 'company_id', type: 'uuid', required: false, description: 'Cél cég azonosító (többcéges kulcs esetén kötelező)' },
    ],
    curlExample: `curl -X POST -H "Authorization: Bearer <API_KEY>" -H "Content-Type: application/json" \\
     -d '{"date_from": "2026-04-01", "date_to": "2026-04-30", "direction": "inbound"}' \\
     "${BASE_URL}/v1/nav/sync"`,
    sampleBody: JSON.stringify({
      date_from: "2026-04-01",
      date_to: "2026-04-30",
      direction: "both",
      fetch_details: true
    }, null, 2),
    sampleResponse: JSON.stringify({
      success: true,
      message: "A manuális NAV szinkronizáció sikeresen lefutott.",
      data: {
        company_id: "c132676d-85c5-4e2a-bde1-d966766bb94f",
        date_from: "2026-04-01",
        date_to: "2026-04-30",
        direction: "both",
        inbound: { status: "completed", total_fetched: 14, total_inserted: 2, sync_log_id: "log-1" },
        outbound: { status: "completed", total_fetched: 8, total_inserted: 0, sync_log_id: "log-2" },
        total_invoices_fetched: 22,
        total_invoices_inserted: 2
      }
    }, null, 2)
  },

  // ── AUTH / ME ──
  {
    id: 'get-auth-me',
    method: 'GET',
    path: '/v1/auth/me',
    category: 'auth',
    categoryTitle: 'Azonosítás (Auth / Me)',
    title: 'API kulcs introspekció & Cég jogosultságok',
    description: 'A megadott Bearer tokenhez tartozó metaadatok: kulcs neve, jogosultsági kör (scope), rate limit és az elérhető cégek listája.',
    scope: 'read',
    curlExample: `curl -H "Authorization: Bearer <API_KEY>" \\
     "${BASE_URL}/v1/auth/me"`,
    sampleResponse: JSON.stringify({
      success: true,
      data: {
        key_id: "key-1234",
        name: "ERP M2M Integráció",
        scope: "read_write",
        rate_limit_per_minute: 120,
        accessible_companies: [
          { id: "c132676d-85c5-4e2a-bde1-d966766bb94f", name: "Mauroni Events Kft.", tax_number: "12345678-2-41" }
        ]
      }
    }, null, 2)
  },

  // ── LEDGER ──
  {
    id: 'get-ledger',
    method: 'GET',
    path: '/v1/ledger',
    category: 'ledger',
    categoryTitle: 'Főkönyvi Napló (General Ledger)',
    title: 'Kettős könyvviteli főkönyvi napló ERP rendszerekhez',
    description: 'Automatikus könyvelési naplóbejegyzések lekérése számlákhoz és banki tételekhez (Tartozik/Követel számlaszámok, összegek).',
    scope: 'read',
    queryParams: [
      { name: 'period', type: 'string (YYYY-MM)', required: false, description: 'Időszak szűrő (pl. 2026-08)' },
      { name: 'account_code', type: 'string', required: false, description: 'Főkönyvi számlaszám szűrő (pl. 381, 454, 911)' },
      { name: 'date_from', type: 'string (YYYY-MM-DD)', required: false, description: 'Könyvelési dátum -tól' },
      { name: 'date_to', type: 'string (YYYY-MM-DD)', required: false, description: 'Könyvelési dátum -ig' }
    ],
    curlExample: `curl -H "Authorization: Bearer <API_KEY>" \\
     "${BASE_URL}/v1/ledger?period=2026-08"`,
    sampleResponse: JSON.stringify({
      success: true,
      data: {
        entries: [
          {
            id: "d42b10ca-...",
            journal_date: "2026-08-25",
            debit_account: "521",
            credit_account: "454",
            amount: 6202.93,
            currency: "HUF",
            description: "Dropbox Plus előfizetés havidíj",
            source_type: "invoice"
          }
        ]
      }
    }, null, 2)
  },

  // ── REPORTS ──
  {
    id: 'get-reports-vat',
    method: 'GET',
    path: '/v1/reports/vat',
    category: 'reports',
    categoryTitle: 'Kimutatások & Riportok (Reports)',
    title: 'ÁFA-bevallás kimutatás és analitika',
    description: 'Havi vagy negyedéves ÁFA-bevallás adatok, fizetendő és levonható adó összegek és a nettó ÁFA pozíció.',
    scope: 'read',
    queryParams: [
      { name: 'year', type: 'number', required: false, description: 'Adóév (pl. 2026)' },
      { name: 'period', type: 'string (YYYY-MM)', required: false, description: 'Konkrét hónap szűrő (pl. 2026-08)' }
    ],
    curlExample: `curl -H "Authorization: Bearer <API_KEY>" \\
     "${BASE_URL}/v1/reports/vat?year=2026"`,
    sampleResponse: JSON.stringify({
      success: true,
      data: {
        vat_reports: [
          {
            period_year: 2026,
            period_month: 8,
            frequency: "H",
            status: "draft",
            total_payable_tax: 891810,
            total_deductible_tax: 599785.06,
            net_result: 292024.94,
            amount_to_pay: 292024.94,
            amount_reclaimable: 0
          }
        ]
      }
    }, null, 2)
  },
  {
    id: 'get-reports-pnl',
    method: 'GET',
    path: '/v1/reports/pnl',
    category: 'reports',
    categoryTitle: 'Kimutatások & Riportok (Reports)',
    title: 'Valós idejű Eredménykimutatás (P&L)',
    description: 'Időszaki nettó árbevétel, nettó ráfordítások/költségek, és a számított üzemi eredmény.',
    scope: 'read',
    queryParams: [
      { name: 'year', type: 'number', required: false, description: 'Év (pl. 2026, alapértelmezett: aktuális év)' }
    ],
    curlExample: `curl -H "Authorization: Bearer <API_KEY>" \\
     "${BASE_URL}/v1/reports/pnl?year=2026"`,
    sampleResponse: JSON.stringify({
      success: true,
      data: {
        year: 2026,
        revenue_net: 181575,
        expense_net: 55768005,
        operating_result_net: -55586430,
        currency: "HUF",
        invoice_count: 298
      }
    }, null, 2)
  },

  // ── COMPANIES & PROJECTS ──
  {
    id: 'get-companies',
    method: 'GET',
    path: '/v1/companies',
    category: 'companies',
    categoryTitle: 'Cégek & Projektek (Companies & Projects)',
    title: 'Elérhető cégek listája (Többcéges kulcs)',
    description: 'A megadott API kulccsal elérhető cégek listája és alapadatai (név, adószám, székhely, TEÁOR, ÁFA rendszer). Retrokompatibilis az ?action=companies hívással is.',
    scope: 'read',
    curlExample: `curl -H "Authorization: Bearer <API_KEY>" \\
     "${BASE_URL}/v1/companies"`,
    sampleResponse: JSON.stringify({
      success: true,
      data: {
        companies: [
          {
            id: "c132676d-85c5-4e2a-bde1-d966766bb94f",
            name: "Mauroni Events KFT.",
            tax_number: "26685458-2-41",
            address: "1051 Budapest, Sas utca 12.",
            vat_regime: "targyi_mentes"
          }
        ],
        count: 1
      }
    }, null, 2)
  },
  {
    id: 'patch-company',
    method: 'PATCH',
    path: '/v1/companies/:id',
    category: 'companies',
    categoryTitle: 'Cégek & Projektek (Companies & Projects)',
    title: 'Cégadatok módosítása (Név, Cím, TEÁOR, ÁFA)',
    description: 'Cég alapvető adatainak módosítása. Retrokompatibilis az ?action=update_company&company_id=<ID> hívással is.',
    scope: 'read_write',
    bodyParams: [
      { name: 'name', type: 'string', required: false, description: 'Cégnév' },
      { name: 'address', type: 'string', required: false, description: 'Székhely címe' },
      { name: 'description', type: 'string', required: false, description: 'Tevékenységi leírás' },
      { name: 'primary_teaor', type: 'string', required: false, description: 'Fő TEÁOR szám (pl. 9329)' },
      { name: 'vat_regime', type: 'string', required: false, description: 'ÁFA rendszer (alanyi_mentes, afa_koros, penzforgalmi, stb.)' }
    ],
    curlExample: `curl -X PATCH -H "Authorization: Bearer <API_KEY>" -H "Content-Type: application/json" \\
     -d '{"description": "Új leírás", "primary_teaor": "9329"}' \\
     "${BASE_URL}/v1/companies/<COMPANY_ID>"`,
    sampleBody: JSON.stringify({ description: "Új leírás", primary_teaor: "9329" }, null, 2),
    sampleResponse: JSON.stringify({
      success: true,
      message: "Cégadatok sikeresen frissítve.",
      data: { company: { id: "c132676d-...", name: "Mauroni Events KFT.", primary_teaor: "9329" } }
    }, null, 2)
  },
  {
    id: 'get-projects',
    method: 'GET',
    path: '/v1/projects',
    category: 'companies',
    categoryTitle: 'Cégek & Projektek (Companies & Projects)',
    title: 'Költséghelyek és projektek listázása',
    description: 'A céghez tartozó projektek és költséghelyek listája kódokkal és keretösszegekkel.',
    scope: 'read',
    curlExample: `curl -H "Authorization: Bearer <API_KEY>" \\
     "${BASE_URL}/v1/projects"`,
    sampleResponse: JSON.stringify({
      success: true,
      data: {
        projects: [
          {
            id: "a1b2c3d4-...",
            name: "Nyári Fesztivál 2026",
            project_code: "PRJ-FEST-2026",
            budget: 5000000,
            status: "active"
          }
        ]
      }
    }, null, 2)
  },
  {
    id: 'action-update-settings',
    method: 'POST',
    path: '?action=update_settings&company_id=<ID>',
    category: 'companies',
    categoryTitle: 'Cégek & Projektek (Companies & Projects)',
    title: 'Cégbeállítások frissítése (Munkaidő, Határidő)',
    description: 'Cég adminisztrációs és könyvelési beállításainak mentése (A-093 atomi upsert).',
    scope: 'read_write',
    bodyParams: [
      { name: 'work_start_time', type: 'string (HH:mm)', required: false, description: 'Munkanap kezdete (pl. 08:00)' },
      { name: 'work_end_time', type: 'string (HH:mm)', required: false, description: 'Munkanap vége (pl. 16:30)' },
      { name: 'admin_deadline', type: 'string (HH:mm)', required: false, description: 'Adminisztrációs határidő időpont' },
      { name: 'monthly_working_hours', type: 'number', required: false, description: 'Havi munkaóraszám (pl. 168)' },
      { name: 'gl_date_basis', type: 'string', required: false, description: 'kibocsatas | teljesites' }
    ],
    curlExample: `curl -X POST -H "Authorization: Bearer <API_KEY>" -H "Content-Type: application/json" \\
     -d '{"work_start_time": "08:30", "work_end_time": "17:00", "monthly_working_hours": 168}' \\
     "${BASE_URL}?action=update_settings&company_id=<COMPANY_ID>"`,
    sampleBody: JSON.stringify({ work_start_time: "08:30", work_end_time: "17:00", monthly_working_hours: 168 }, null, 2),
    sampleResponse: JSON.stringify({
      success: true,
      message: "Cégbeállítások sikeresen mentve (atomi upsert).",
      data: { settings: { work_start_time: "08:30", work_end_time: "17:00", monthly_working_hours: 168 } }
    }, null, 2)
  },
  // ── TICKETS (Hibajegyek & Ügyfélszolgálat) ──
  {
    id: 'get-tickets',
    method: 'GET',
    path: '/v1/tickets',
    category: 'tickets',
    categoryTitle: 'Hibajegyek (Tickets)',
    title: 'Hibajegyek listázása, szűrése & lapozása',
    description: 'A céghez tartozó hibajegyek lekérdezése lapozással, státusz (created, assigned, in_progress, waiting_confirmation, resolved), prioritás és típus szerint.',
    scope: 'read',
    queryParams: [
      { name: 'status', type: 'string', required: false, description: 'created | assigned | in_progress | waiting_confirmation | resolved | all' },
      { name: 'priority', type: 'string', required: false, description: 'low | medium | high | critical' },
      { name: 'type', type: 'string', required: false, description: 'bug | feedback | question' },
      { name: 'page', type: 'number', required: false, description: 'Oldalszám (alapértelmezett: 1)' },
      { name: 'page_size', type: 'number', required: false, description: 'Oldalméret (max: 100, alapértelmezett: 20)' },
      { name: 'company_id', type: 'uuid', required: false, description: 'Cég azonosító (többcéges kulcsnál)' },
    ],
    curlExample: `curl -H "Authorization: Bearer <API_KEY>" \\
     "${BASE_URL}/v1/tickets?status=in_progress&page=1"`,
    sampleResponse: JSON.stringify({
      success: true,
      data: {
        tickets: [
          {
            id: "47fdfaeb-9bc7-40bd-b65f-df6dba97490c",
            ticket_number: "EB-0130",
            type: "bug",
            service: "eaisybill",
            priority: "high",
            status: "in_progress",
            message: "A cég csoportos ÁFA-tag...",
            comment_count: 3,
            waiting_for_user_confirmation: false,
            needs_staff_response: false,
            created_at: "2026-09-16T12:38:48Z",
            updated_at: "2026-09-22T01:00:00Z"
          }
        ],
        pagination: { page: 1, page_size: 20, total_items: 1, total_pages: 1 }
      }
    }, null, 2)
  },
  {
    id: 'create-ticket',
    method: 'POST',
    path: '/v1/tickets',
    category: 'tickets',
    categoryTitle: 'Hibajegyek (Tickets)',
    title: 'Új hibajegy nyitása',
    description: 'Új hibajelentés, visszajelzés vagy kérdés feladása. A jegyszámot (EB-xxxx) és a létrehozási audit eseményt a szerver automatikusan generálja.',
    scope: 'read_write',
    bodyParams: [
      { name: 'type', type: 'string', required: true, description: 'bug | feedback | question' },
      { name: 'message', type: 'string', required: true, description: 'A probléma vagy észrevétel részletes leírása' },
      { name: 'priority', type: 'string', required: false, description: 'low | medium | high | critical (alapértelmezett: medium)' },
      { name: 'service', type: 'string', required: false, description: 'eaisybill | accounty (alapértelmezett: eaisybill)' },
      { name: 'page_url', type: 'string', required: false, description: 'Érintett oldal vagy külső URL' },
      { name: 'attachments', type: 'string[]', required: false, description: 'Csatolt fájlok / képek nyilvános URL-jei' },
      { name: 'company_id', type: 'uuid', required: false, description: 'Cég azonosító (többcéges kulcsnál)' },
    ],
    curlExample: `curl -X POST -H "Authorization: Bearer <API_KEY>" -H "Content-Type: application/json" \\
     -d '{"type": "bug", "priority": "high", "message": "Számla szinkronizáció timeout hiba.", "service": "eaisybill"}' \\
     "${BASE_URL}/v1/tickets"`,
    sampleBody: JSON.stringify({
      type: "bug",
      priority: "high",
      message: "Számla szinkronizáció timeout hiba a 2026-09-es időszakban.",
      service: "eaisybill"
    }, null, 2),
    sampleResponse: JSON.stringify({
      success: true,
      message: "Hibajegy sikeresen létrehozva.",
      data: {
        ticket: {
          id: "3e5a7b8c-1234-5678-9abc-def012345678",
          ticket_number: "EB-0131",
          type: "bug",
          service: "eaisybill",
          priority: "high",
          status: "created",
          message: "Számla szinkronizáció timeout hiba...",
          created_at: "2026-09-22T02:00:00Z"
        }
      }
    }, null, 2)
  },
  {
    id: 'get-ticket-detail',
    method: 'GET',
    path: '/v1/tickets/:id',
    category: 'tickets',
    categoryTitle: 'Hibajegyek (Tickets)',
    title: 'Egyedi hibajegy részletei & Publikus hozzászólások',
    description: 'Hibajegy adatlapjának lekérése UUID vagy EB-xxxx jegyszám alapján. A válasz tartalmazza a support és az ügyfél publikus párbeszédét (a belső support jegyzetek automatikusan szűrve vannak).',
    scope: 'read',
    queryParams: [
      { name: 'company_id', type: 'uuid', required: false, description: 'Cég azonosító (többcéges kulcsnál)' },
    ],
    curlExample: `curl -H "Authorization: Bearer <API_KEY>" \\
     "${BASE_URL}/v1/tickets/EB-0130"`,
    sampleResponse: JSON.stringify({
      success: true,
      data: {
        ticket: {
          id: "47fdfaeb-9bc7-40bd-b65f-df6dba97490c",
          ticket_number: "EB-0130",
          type: "bug",
          service: "eaisybill",
          priority: "high",
          status: "in_progress",
          message: "A cég csoportos ÁFA-tag...",
          waiting_for_user_confirmation: false,
          created_at: "2026-09-16T12:38:48Z"
        },
        comments: [
          {
            id: "b74569fd-9646-49dc-b10e-e02499aeca6f",
            user_name: "Support Admin",
            is_admin: true,
            message: "Vizsgáljuk a csoportos ÁFA szinkronizációs logokat.",
            created_at: "2026-09-16T13:00:00Z"
          }
        ]
      }
    }, null, 2)
  },
  {
    id: 'add-ticket-comment',
    method: 'POST',
    path: '/v1/tickets/:id/comments',
    category: 'tickets',
    categoryTitle: 'Hibajegyek (Tickets)',
    title: 'Hozzászólás küldése hibajegyhez',
    description: 'Új válasz vagy kiegészítő információ beküldése a hibajegyhez. Automatikusan értesíti a support csapatot és frissíti az utolsó ügyfél aktivitás dátumát.',
    scope: 'read_write',
    bodyParams: [
      { name: 'message', type: 'string', required: true, description: 'Hozzászólás szövege' },
      { name: 'attachments', type: 'string[]', required: false, description: 'Opcionális csatolmány URL-ek' },
      { name: 'company_id', type: 'uuid', required: false, description: 'Cég azonosító (többcéges kulcsnál)' },
    ],
    curlExample: `curl -X POST -H "Authorization: Bearer <API_KEY>" -H "Content-Type: application/json" \\
     -d '{"message": "Csatoltam a kért hibanaplót a megfigyelésekkel."}' \\
     "${BASE_URL}/v1/tickets/EB-0130/comments"`,
    sampleBody: JSON.stringify({
      message: "Csatoltam a kért hibanaplót a megfigyelésekkel."
    }, null, 2),
    sampleResponse: JSON.stringify({
      success: true,
      message: "Hozzászólás sikeresen elküldve.",
      data: {
        comment: {
          id: "c1234567-89ab-cdef-0123-456789abcdef",
          user_name: "API Felhasználó",
          is_admin: false,
          message: "Csatoltam a kért hibanaplót...",
          created_at: "2026-09-22T02:10:00Z"
        }
      }
    }, null, 2)
  },
  {
    id: 'confirm-ticket-resolution',
    method: 'POST',
    path: '/v1/tickets/:id/confirm-resolution',
    category: 'tickets',
    categoryTitle: 'Hibajegyek (Tickets)',
    title: 'Megoldás megerősítése & Jegy lezárása',
    description: 'Az ügyfél hivatalos megerősítése, hogy a felmerült probléma megoldódott. A hibajegy resolved státuszba kerül és audit záróesemény rögzül.',
    scope: 'read_write',
    bodyParams: [
      { name: 'company_id', type: 'uuid', required: false, description: 'Cég azonosító (többcéges kulcsnál)' },
    ],
    curlExample: `curl -X POST -H "Authorization: Bearer <API_KEY>" \\
     "${BASE_URL}/v1/tickets/EB-0130/confirm-resolution"`,
    sampleResponse: JSON.stringify({
      success: true,
      message: "Megoldás megerősítve, a hibajegy lezárásra került.",
      data: {
        id: "47fdfaeb-9bc7-40bd-b65f-df6dba97490c",
        ticket_number: "EB-0130",
        status: "resolved"
      }
    }, null, 2)
  }
];

export interface ApiDocsViewProps {
  defaultApiKey?: string;
  isInline?: boolean;
  onMaximize?: () => void;
}

export function ApiDocsView({
  defaultApiKey = '',
  isInline = false,
  onMaximize,
}: ApiDocsViewProps) {
  const { toast } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'endpoints' | 'tester' | 'quickstart'>('endpoints');
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null);

  // Interactive Live Tester state
  const [testEndpointId, setTestEndpointId] = useState<string>('get-invoices');
  const [testApiKey, setTestApiKey] = useState<string>(defaultApiKey || '');
  const [testQueryString, setTestQueryString] = useState<string>('limit=5&direction=inbound');
  const [testRequestBody, setTestRequestBody] = useState<string>('{\n  "is_paid": true\n}');
  const [testingLoading, setTestingLoading] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    status: number;
    durationMs: number;
    data: any;
  } | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: 'Másolva', description: 'Vágólapra helyezve.' });
  };

  const selectedDef = ENDPOINTS.find((e) => e.id === testEndpointId) || ENDPOINTS[0];

  const handleExecuteTest = async () => {
    if (!testApiKey.trim()) {
      toast({
        title: 'Hiányzó API kulcs',
        description: 'Adj meg egy érvényes API kulcsot (pl. vb_...) a teszteléshez!',
        variant: 'destructive',
      });
      return;
    }

    setTestingLoading(true);
    setTestResult(null);

    const startTime = performance.now();
    try {
      let finalPath = selectedDef.path;
      if (testQueryString.trim()) {
        finalPath += (finalPath.includes('?') ? '&' : '?') + testQueryString.trim();
      }

      const url = `${BASE_URL}${finalPath}`;
      const opts: RequestInit = {
        method: selectedDef.method,
        headers: {
          Authorization: `Bearer ${testApiKey.trim()}`,
          'Content-Type': 'application/json',
        },
      };

      if ((selectedDef.method === 'POST' || selectedDef.method === 'PATCH' || selectedDef.method === 'DELETE') && testRequestBody.trim()) {
        opts.body = testRequestBody.trim();
      }

      const res = await fetch(url, opts);
      const durationMs = Math.round(performance.now() - startTime);
      const data = await res.json().catch(() => null);

      setTestResult({
        status: res.status,
        durationMs,
        data,
      });

      if (res.ok) {
        toast({
          title: `Sikeres hívás: HTTP ${res.status}`,
          description: `Válaszidő: ${durationMs} ms`,
          className: 'bg-green-50 text-green-900 border-green-200',
        });
      } else {
        toast({
          title: `Hívási hiba: HTTP ${res.status}`,
          description: data?.error?.message || 'Nem várt hiba történt.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      setTestResult({
        status: 0,
        durationMs: Math.round(performance.now() - startTime),
        data: { error: err.message },
      });
      toast({
        title: 'Hálózati hiba',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setTestingLoading(false);
    }
  };

  const filteredEndpoints =
    selectedCategory === 'all'
      ? ENDPOINTS
      : ENDPOINTS.filter((e) => e.category === selectedCategory);

  return (
    <div className={`space-y-4 ${isInline ? '' : 'p-1'}`}>
      {/* Top Header / Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/50">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <FileCode2 className="h-4 w-4 text-primary shrink-0" />
            <span className="font-bold text-sm text-foreground">Hivatalos Ügyfél REST API v1</span>
            <Badge variant="outline" className="text-[10px] text-primary border-primary/30">RESTful JSON</Badge>
            <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Zap className="h-3 w-3 mr-1" />
              120 req/min
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Teljes funkcionalitás: Számlák, Bank, Partnerek, Főkönyvi napló, ÁFA- és Eredménykimutatások.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-[11px] font-mono bg-muted px-2 py-1 rounded select-all border border-border/40">
            <span className="text-muted-foreground">Base:</span>
            <span className="text-foreground font-semibold">.../customer-api</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 ml-1"
              onClick={() => handleCopy(BASE_URL, 'base-url')}
              title="Base URL másolása"
            >
              {copiedId === 'base-url' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
            onClick={() => window.open(`${BASE_URL}/v1/openapi.json`, '_blank')}
            title="OpenAPI 3.0.3 hivatalos specifikáció megnyitása / letöltése JSON formátumban"
          >
            <FileCode2 className="h-3.5 w-3.5" />
            OpenAPI 3 JSON
          </Button>

          {isInline && onMaximize && (
            <Button
              variant="outline"
              size="sm"
              onClick={onMaximize}
              className="h-7 text-xs gap-1.5 bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary"
            >
              <Maximize2 className="h-3 w-3" />
              Nagyítás
            </Button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
        <TabsList className="grid grid-cols-3 w-full sm:w-[480px] h-8 text-xs mb-3">
          <TabsTrigger value="endpoints" className="gap-1.5 text-xs">
            <BookOpen className="h-3.5 w-3.5" />
            Végpontok ({ENDPOINTS.length})
          </TabsTrigger>
          <TabsTrigger value="tester" className="gap-1.5 text-xs text-primary font-semibold">
            <Play className="h-3.5 w-3.5 fill-primary/20" />
            Élő API Tesztelő
          </TabsTrigger>
          <TabsTrigger value="quickstart" className="gap-1.5 text-xs">
            <Terminal className="h-3.5 w-3.5" />
            Gyors Útmutató
          </TabsTrigger>
        </TabsList>

        {/* ── TAB 1: ENDPOINTS CATALOG ── */}
        <TabsContent value="endpoints" className="space-y-4">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <Button
              size="sm"
              variant={selectedCategory === 'all' ? 'default' : 'outline'}
              onClick={() => setSelectedCategory('all')}
              className="h-7 text-xs rounded-full"
            >
              Összes ({ENDPOINTS.length})
            </Button>
            <Button
              size="sm"
              variant={selectedCategory === 'invoices' ? 'default' : 'outline'}
              onClick={() => setSelectedCategory('invoices')}
              className="h-7 text-xs rounded-full"
            >
              Számlák ({ENDPOINTS.filter((e) => e.category === 'invoices').length})
            </Button>
            <Button
              size="sm"
              variant={selectedCategory === 'partners' ? 'default' : 'outline'}
              onClick={() => setSelectedCategory('partners')}
              className="h-7 text-xs rounded-full"
            >
              Partnerek ({ENDPOINTS.filter((e) => e.category === 'partners').length})
            </Button>
            <Button
              size="sm"
              variant={selectedCategory === 'transactions' ? 'default' : 'outline'}
              onClick={() => setSelectedCategory('transactions')}
              className="h-7 text-xs rounded-full"
            >
              Bank & Párosítás ({ENDPOINTS.filter((e) => e.category === 'transactions').length})
            </Button>
            <Button
              size="sm"
              variant={selectedCategory === 'categories' ? 'default' : 'outline'}
              onClick={() => setSelectedCategory('categories')}
              className="h-7 text-xs rounded-full"
            >
              Kategóriák ({ENDPOINTS.filter((e) => e.category === 'categories').length})
            </Button>
            <Button
              size="sm"
              variant={selectedCategory === 'nav' ? 'default' : 'outline'}
              onClick={() => setSelectedCategory('nav')}
              className="h-7 text-xs rounded-full"
            >
              NAV ({ENDPOINTS.filter((e) => e.category === 'nav').length})
            </Button>
            <Button
              size="sm"
              variant={selectedCategory === 'ledger' ? 'default' : 'outline'}
              onClick={() => setSelectedCategory('ledger')}
              className="h-7 text-xs rounded-full"
            >
              Főkönyv ({ENDPOINTS.filter((e) => e.category === 'ledger').length})
            </Button>
            <Button
              size="sm"
              variant={selectedCategory === 'reports' ? 'default' : 'outline'}
              onClick={() => setSelectedCategory('reports')}
              className="h-7 text-xs rounded-full"
            >
              Kimutatások ({ENDPOINTS.filter((e) => e.category === 'reports').length})
            </Button>
            <Button
              size="sm"
              variant={selectedCategory === 'companies' ? 'default' : 'outline'}
              onClick={() => setSelectedCategory('companies')}
              className="h-7 text-xs rounded-full"
            >
              Cégek & Projektek ({ENDPOINTS.filter((e) => e.category === 'companies').length})
            </Button>
            <Button
              size="sm"
              variant={selectedCategory === 'tickets' ? 'default' : 'outline'}
              onClick={() => setSelectedCategory('tickets')}
              className="h-7 text-xs rounded-full"
            >
              Hibajegyek ({ENDPOINTS.filter((e) => e.category === 'tickets').length})
            </Button>
            <Button
              size="sm"
              variant={selectedCategory === 'auth' ? 'default' : 'outline'}
              onClick={() => setSelectedCategory('auth')}
              className="h-7 text-xs rounded-full"
            >
              Auth ({ENDPOINTS.filter((e) => e.category === 'auth').length})
            </Button>
          </div>

          {/* Endpoints Cards */}
          <div className="space-y-3">
            {filteredEndpoints.map((ep) => {
              const isDetailsExpanded = expandedEndpoint === ep.id;
              return (
                <Card key={ep.id} className="border-border/60 hover:border-primary/40 transition-colors shadow-sm bg-background/60">
                  <CardContent className="p-3.5 space-y-2.5">
                    {/* Top Row: Method, Path, Scope, Try Button */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/30 pb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          className={`font-mono text-[10px] font-bold px-2 py-0.5 ${
                            ep.method === 'GET'
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30'
                              : ep.method === 'POST'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                              : ep.method === 'DELETE'
                              ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                          }`}
                          variant="outline"
                        >
                          {ep.method}
                        </Badge>
                        <code className="text-xs font-mono font-semibold text-foreground bg-muted px-2 py-0.5 rounded">
                          {ep.path}
                        </code>
                        <span className="text-xs font-semibold text-foreground hidden md:inline">
                          — {ep.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[9px] text-muted-foreground">
                          {ep.scope === 'read_write' ? 'Írás / Olvasás' : 'Csak Olvasás'}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[11px] text-primary gap-1 px-2"
                          onClick={() => {
                            setTestEndpointId(ep.id);
                            if (ep.sampleBody) setTestRequestBody(ep.sampleBody);
                            setActiveTab('tester');
                          }}
                        >
                          <Play className="h-3 w-3" />
                          Tesztelés
                        </Button>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {ep.description}
                    </p>

                    {/* Parameters Table */}
                    {((ep.queryParams && ep.queryParams.length > 0) || (ep.bodyParams && ep.bodyParams.length > 0)) && (
                      <div className="rounded-md border border-border/50 bg-muted/20 overflow-hidden text-[11px]">
                        <div className="bg-muted/40 px-3 py-1 font-semibold text-foreground text-[10px] uppercase tracking-wider flex justify-between">
                          <span>Paraméterek ({ep.queryParams ? 'Query URL' : 'JSON Body'})</span>
                          <span>Típus & Leírás</span>
                        </div>
                        <div className="divide-y divide-border/30">
                          {(ep.queryParams || ep.bodyParams || []).map((param) => (
                            <div key={param.name} className="px-3 py-1 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                              <div className="flex items-center gap-1.5">
                                <code className="font-mono font-semibold text-foreground text-[10px]">{param.name}</code>
                                {param.required && (
                                  <Badge variant="destructive" className="text-[9px] py-0 px-1 h-3.5">
                                    kötelező
                                  </Badge>
                                )}
                              </div>
                              <div className="text-muted-foreground text-right sm:max-w-md text-[10px]">
                                <span className="text-foreground/70 font-mono mr-1.5">[{param.type}]</span>
                                <span>{param.description}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* cURL Snippet */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground font-medium flex items-center gap-1">
                          <Terminal className="h-3 w-3 text-primary" />
                          cURL teszt parancs:
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 text-[10px] text-muted-foreground hover:text-foreground gap-1 px-1.5"
                            onClick={() => setExpandedEndpoint(isDetailsExpanded ? null : ep.id)}
                          >
                            {isDetailsExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            {isDetailsExpanded ? 'Minta válasz elrejtése' : 'Minta válasz JSON'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 text-[10px] gap-1 text-muted-foreground hover:text-foreground px-1.5"
                            onClick={() => handleCopy(ep.curlExample, ep.id)}
                          >
                            {copiedId === ep.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                            {copiedId === ep.id ? 'Másolva' : 'Másolás'}
                          </Button>
                        </div>
                      </div>
                      <pre className="bg-zinc-950 text-zinc-100 p-2.5 rounded font-mono text-[11px] overflow-x-auto select-all leading-relaxed">
                        {ep.curlExample}
                      </pre>
                    </div>

                    {/* Collapsible Sample Response */}
                    {isDetailsExpanded && (
                      <div className="space-y-1 pt-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground font-medium">Mintaválasz (JSON):</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 text-[10px] gap-1 text-muted-foreground px-1.5"
                            onClick={() => handleCopy(ep.sampleResponse, `${ep.id}-resp`)}
                          >
                            {copiedId === `${ep.id}-resp` ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                            Másolás
                          </Button>
                        </div>
                        <pre className="bg-zinc-950 text-emerald-400 p-2.5 rounded font-mono text-[10px] overflow-x-auto max-h-[220px] select-all leading-relaxed">
                          {ep.sampleResponse}
                        </pre>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ── TAB 2: INTERACTIVE LIVE RUNNER ── */}
        <TabsContent value="tester" className="space-y-4">
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 space-y-1.5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-semibold text-xs text-foreground">Élő Végpont Tesztelő (In-Browser API Runner)</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Közvetlenül a böngészőből küldhetsz valós HTTP hívást az éles Customer API-nak. Válaszd ki a végpontot, add meg a fejlécben használandó API kulcsodat, és kattints a küldésre!
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Tesztelendő Végpont</Label>
              <select
                className="w-full h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={testEndpointId}
                onChange={(e) => {
                  setTestEndpointId(e.target.value);
                  const def = ENDPOINTS.find((x) => x.id === e.target.value);
                  if (def?.sampleBody) setTestRequestBody(def.sampleBody);
                }}
              >
                {ENDPOINTS.map((ep) => (
                  <option key={ep.id} value={ep.id}>
                    [{ep.method}] {ep.path} — {ep.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">API Kulcs (Bearer Token)</Label>
              <Input
                placeholder="vb_..."
                value={testApiKey}
                onChange={(e) => setTestApiKey(e.target.value)}
                className="font-mono text-xs h-8"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">URL Query Paraméterek</Label>
            <Input
              placeholder="pl. direction=inbound&status=unpaid&limit=5"
              value={testQueryString}
              onChange={(e) => setTestQueryString(e.target.value)}
              className="font-mono text-xs h-8"
            />
          </div>

          {(selectedDef.method === 'POST' || selectedDef.method === 'PATCH') && (
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Kéréstörzs (JSON Body)</Label>
              <textarea
                rows={4}
                value={testRequestBody}
                onChange={(e) => setTestRequestBody(e.target.value)}
                className="w-full rounded-md border border-input bg-zinc-950 text-zinc-100 p-2 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-ring leading-relaxed"
              />
            </div>
          )}

          <Button
            onClick={handleExecuteTest}
            disabled={testingLoading}
            size="sm"
            className="gap-2 text-xs"
          >
            {testingLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Hívás küldése folyamatban...
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                Teszt hívás küldése
              </>
            )}
          </Button>

          {/* Test Response Viewer */}
          {testResult && (
            <div className="rounded-lg border border-border bg-card p-3.5 space-y-2.5">
              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">Élő Válasz:</span>
                  <Badge
                    variant={testResult.status >= 200 && testResult.status < 300 ? 'default' : 'destructive'}
                    className="text-xs font-mono"
                  >
                    HTTP {testResult.status}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">({testResult.durationMs} ms)</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] gap-1"
                  onClick={() => handleCopy(JSON.stringify(testResult.data, null, 2), 'test-result')}
                >
                  {copiedId === 'test-result' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  Másolás
                </Button>
              </div>

              <pre className="bg-zinc-950 text-zinc-100 p-3 rounded font-mono text-xs overflow-x-auto max-h-[320px] leading-relaxed select-all">
                {JSON.stringify(testResult.data, null, 2)}
              </pre>
            </div>
          )}
        </TabsContent>

        {/* ── TAB 3: QUICKSTART & AUTH ── */}
        <TabsContent value="quickstart" className="space-y-3.5 text-xs">
          <div className="rounded-lg border border-border bg-card p-3.5 space-y-2.5">
            <h4 className="font-semibold text-xs text-foreground flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Hitelesítés & Biztonsági Előírások
            </h4>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Minden API kéréshez szükséges a legenerált <code className="text-foreground font-semibold">vb_...</code> kezdetű kulcs átadása a HTTP Authorization fejlécben:
            </p>
            <pre className="bg-zinc-950 text-zinc-100 p-2.5 rounded font-mono text-[11px] select-all">
              Authorization: Bearer vb_1234567890abcdef...
            </pre>
            <div className="space-y-1 text-muted-foreground text-[11px]">
              <p>• <strong>Sebességkorlát:</strong> Alapértelmezetten 120 kérés / perc kulcsonként. A határérték elérése esetén <code className="text-destructive font-mono">429 RATE_LIMITED</code> választ kapsz.</p>
              <p>• <strong>Többcéges Kulcs:</strong> Ha globális kulcsot generálsz, egyetlen kulccsal az összes saját céged adataihoz hozzáférsz!</p>
              <p>• <strong>Audit Napló:</strong> Minden kérés (IP cím, végpont, státuszkód, időtartam) automatikusan rögzítésre kerül az audit naplóban.</p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-3.5 space-y-2">
            <h4 className="font-semibold text-xs text-foreground flex items-center gap-2">
              <Terminal className="h-4 w-4 text-primary" />
              Node.js / TypeScript Kód Példa
            </h4>
            <pre className="bg-zinc-950 text-zinc-100 p-2.5 rounded font-mono text-[11px] overflow-x-auto select-all leading-relaxed">
{`const API_KEY = "vb_...";
const BASE_URL = "${BASE_URL}";

async function getInvoices() {
  const response = await fetch(\`\${BASE_URL}/v1/invoices?direction=inbound&limit=25\`, {
    headers: {
      "Authorization": \`Bearer \${API_KEY}\`,
      "Content-Type": "application/json"
    }
  });

  const { data } = await response.json();
  console.log("Számlák listája:", data.invoices);
}

getInvoices();`}
            </pre>
          </div>

          <div className="rounded-lg border border-border bg-card p-3.5 space-y-2">
            <h4 className="font-semibold text-xs text-foreground">Standard Hibaválasz Formátum</h4>
            <pre className="bg-zinc-950 text-rose-400 p-2.5 rounded font-mono text-[11px] overflow-x-auto select-all leading-relaxed">
{`{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "A számla bizonylatszáma már létezik."
  }
}`}
            </pre>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface Props {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerButton?: React.ReactNode;
  defaultApiKey?: string;
}

export function ApiDocsExplorer({
  open,
  onOpenChange,
  triggerButton,
  defaultApiKey = '',
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {triggerButton && <DialogTrigger asChild>{triggerButton}</DialogTrigger>}
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-5 pb-3 border-b bg-muted/20">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <FileCode2 className="h-5 w-5 text-primary" />
            Hivatalos Ügyfél REST API v1 — Fejlesztői Portál
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">
            Verziózott RESTful JSON végpontok számlákhoz, bankhoz, partnerekhez és könyveléshez.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-5">
          <ApiDocsView defaultApiKey={defaultApiKey} isInline={false} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
