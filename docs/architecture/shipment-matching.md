# Shipment Matching — Frontend Architektúra

> [!IMPORTANT]
> **Kliens-specifikus feature.** A Szállítmányozás modul jelenleg kizárólag a **HRT Spedition** ügyfél számára érhető el.
> Alapértelmezetten **MINDEN cégnél kikapcsolt** (beleértve admin felhasználókat is!), 
> és csak az `eaisybill_module_permissions` DB táblán keresztül engedélyezhető per-user/per-company alapon.
> Lásd: [§ 6. Module Permission System](#6-module-permission-system-menü-ki-bekapcsolás)

> **Modul:** HRT Spedition fuvar-számla párosítás  
> **Feltétel:** `shipment_matching` modul engedélyezve az `eaisybill_module_permissions` táblában  
> **Cross-ref:** [Worker ARCHITECTURE.md § 3.7](../../../worker/docs/ARCHITECTURE.md) | [HRTSPED DECISIONS](../../../HRTSPED/docs/DECISIONS.md) | [Permission hook](../../src/hooks/useEaisybillPermissions.ts)

---

## 1. Menü és routing

| Menüpont | Route | Komponens | Leírás |
|----------|-------|-----------|--------|
| Fuvarok | `/shipments` | `ShipmentMatchingDashboard.tsx` | Fuvar-számla párosítás + transport dokumentumok |

A menüpont csak akkor jelenik meg, ha a céghez ÉS a felhasználóhoz engedélyezve van a `shipment_matching` modul
az `eaisybill_module_permissions` táblában. Admin felhasználók SEM látják alapértelmezetten!

---

## 2. Komponensek

### 2.1 ShipmentMatchingDashboard.tsx

**Fő oldal** — összesítő dashboard az összes fuvarról, párosított számlákról és dokumentumokról.

#### Funkciók:
- **Összesítő statisztikák**: Párosított / Függőben arányok (donut chart + bar chart)
- **Szűrők**: Mind | Párosított | Felülvizsgálat | Eszkalált | Várakozó
- **Kereső**: Pozíciószám, fuvaros, számlaszám
- **Expandable rows**: Kattintásra megjelenik a párosított számla + csatolt dokumentumok

#### Adatlekérdezés:
```typescript
supabase
  .from('shipments')
  .select(`
    *, 
    shipment_matches(*), 
    transport_documents(*)
  `)
  .eq('company_id', companyId)
  .order('loading_date', { ascending: false })
```

#### Transport dokumentumok megjelenítése:
- A `transport_documents` a `linked_shipment_id` FK-n keresztül kapcsolódik
- **Ha `linked_shipment_id` null** → a dokumentum NEM jelenik meg a Fuvarok oldalon
- Típus badge-ek: `CMR` (kék), `NALOG` (lila), `POD` (narancs), `OTHER` (szürke)

### 2.2 UploadHistory.tsx (transport doc status)

Az upload history polling logikája biztosítja, hogy a transport dokumentumok mindig láthatók maradjanak:

#### Status badge mapping:
| `processing_status` | Badge | Szín |
|---------------------|-------|------|
| `pending`, `uploaded` | Feltöltve | szürke |
| `processing`, `webhook_sent` | Feldolgozás alatt | fekete |
| `processed`, `completed` | Feldolgozva | zöld |
| `cmr_attached` | Dokumentum párosítva | zöld |
| `cmr_orphaned` | Árva dokumentum | sárga |
| `cmr_escalated` | Eszkaláció szükséges | narancs |
| `ignored` | Mellőzve | szürke |
| `error`, `failed` | A feltöltés sikertelen | piros |

#### Polling logika:
```typescript
refetchInterval: (query) => {
  const recs = query.state.data?.records || [];
  const hasActiveJobs = recs.some(r => 
    processingStatuses.has(r.processing_status) || 
    pendingStatuses.has(r.processing_status)
  );
  // 90s window — CMR/nalog detekció akár 60s is lehet Vision OCR-rel
  const recentUpload = newestCreatedAt && 
    (Date.now() - new Date(newestCreatedAt).getTime()) < 90_000;
  return (hasActiveJobs || recentUpload) ? 3000 : false;
};
```

**FONTOS**: A query `.neq('processing_status', 'ignored')` szűrővel fut.
Ezért a worker SOHA NEM állíthatja `ignored`-ra a státuszt amíg a CMR detekció fut!

### 2.3 UploadedFilesModal.tsx

Feltöltött fájlok kezelése (CRUD) — itt minden fájl látható, beleértve az `ignored` státuszúakat is,
mert ez a query NEM szűr `ignored`-ra.

---

## 3. Adatfolyam (end-to-end)

```
Feltöltés (ManualUpload.tsx)
  │
  ▼
invoice_uploads tábla (status: pending)
  │
  ▼ PGMQ trigger
  │
Worker: AI Classification
  ├── számla → processed (Invoice pipeline)
  └── nem_beazonosithato → Transport Doc Detection
       │
       ├── CMR/nalog/POD detektálva
       │    ├── Position number extraction (fájlnév + OCR)
       │    ├── Invoice matching (shipments.position_number)
       │    ├── Shipment linking (find_shipment_for_invoice)
       │    ├── transport_documents INSERT
       │    └── invoice_uploads.status → cmr_attached
       │
       └── Nem transport doc
            └── invoice_uploads.status → ignored
  │
  ▼ Frontend polling (3s, 90s window)
  │
UploadHistory: status badge frissül élőben
ShipmentMatchingDashboard: transport doc megjelenik a fuvar alatt
```

---

## 4. DB táblák (cross-reference)

### shipments
Selexped RPA-ból importált fuvar adatok.

| Mező | Leírás |
|------|--------|
| `position_number` | E/2627512 formátum — a matching kulcs |
| `carrier_name` | Fuvaros neve |
| `loading_date` / `delivery_date` | Felrakás/lerakás dátuma |
| `calculated_amount` | Kalkulált összeg (EUR) |

### shipment_matches
Fuvar-számla párosítás eredménye.

| Mező | Leírás |
|------|--------|
| `shipment_id` | FK → shipments |
| `matched_invoice_id` | FK → invoices |
| `confidence_score` | 0.0-1.0 |
| `match_status` | matched/escalated/pending |

### transport_documents
CMR, nalog, POD és egyéb dokumentumok.

| Mező | Leírás |
|------|--------|
| `linked_invoice_id` | FK → invoices (nullable) |
| `linked_shipment_id` | FK → shipments (nullable) — **KELL a frontend megjelenítéshez!** |
| `document_type` | cmr/nalog/pod/other |
| `position_number` | E/2627512 formátum |
| `status` | matched/orphaned/escalated |

---

## 5. Ismert gotchák

### 5.1 Transport doc nem jelenik meg a Fuvaroknál
**Ok:** `linked_shipment_id` null → a PostgREST `transport_documents(*)` join nem tartalmazza.
**Fix:** Worker `find_shipment_for_invoice()` → kitölti a `linked_shipment_id`-t.

### 5.2 Dokumentumok eltűnnek a feltöltés historyból
**Ok:** Worker `ignored`-ra állítja a státuszt CMR detekció ELŐTT → frontend `.neq('ignored')` kiszűri.
**Fix:** Worker: status marad `processing` a CMR detekció alatt, `ignored` csak ha NEM transport doc.

### 5.3 Nalog nem detektálódik
**Ok:** `NOT_TRANSPORT_KEYWORDS` (számla/Rechnung) az OCR-ben → `detect_transport_document()` reject.
**Fix:** Fájlnév tag check (Strategy 1) ELŐBB fut mint NOT_TRANSPORT_KEYWORDS.

---

## 6. Module Permission System (menü ki-/bekapcsolás)

> **Cross-ref:** [useEaisybillPermissions.ts](../../src/hooks/useEaisybillPermissions.ts) | [EaisybillPermissionPanel.tsx](../../src/components/settings/EaisybillPermissionPanel.tsx) | [AppSidebar.tsx](../../src/components/AppSidebar.tsx)

### 6.1 Architektúra áttekintés

Az eaisybill **moduláris jogosultságkezelést** használ, ami lehetővé teszi:
- **Cég-specifikus** menü elemek ki-/bekapcsolását
- **User-specifikus** jogosultságok testreszabását per-cég alapon
- **Szerepkör-alapú** statikus alapértelmezéseket DB override-dal felülírva

```
┌─────────────────────────────────────────────────────────┐
│                    AppSidebar.tsx                        │
│  navigationGroups[] → visibleGroups (filtered by perms) │
│  Minden NavItem-nek van moduleKey: EaisybillModule      │
└──────────────────────────────┬──────────────────────────┘
                               │ canAccess(moduleKey)
                               ▼
┌─────────────────────────────────────────────────────────┐
│               useEaisybillPermissions()                 │
│                                                         │
│  1. DB override check (eaisybill_module_permissions)    │
│     └── Ha van override → return override.can_read      │
│  2. Shipment modules → return false (MINDIG disabled!)  │
│  3. Static role defaults (admin/member/assistant/...)    │
└──────────────────────────────┬──────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────┐
│          eaisybill_module_permissions tábla              │
│  (company_id, user_id, module_name, can_read, can_write)│
└─────────────────────────────────────────────────────────┘
```

### 6.2 DB séma

```sql
eaisybill_module_permissions (
  id          UUID PRIMARY KEY,
  company_id  UUID NOT NULL REFERENCES companies(id),
  user_id     UUID NOT NULL REFERENCES auth.users(id),
  module_name TEXT NOT NULL,      -- 'shipment_matching', 'invoices', stb.
  can_read    BOOLEAN DEFAULT true,
  can_write   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ,
  UNIQUE(company_id, user_id, module_name)
)
```

### 6.3 Modul kulcsok (EaisybillModule type)

| Csoport | Module key | Menüpont | Alapértelmezett |
|---------|-----------|----------|-----------------|
| **Áttekintés** | `dashboard` | Irányítópult | ✅ Mindenki |
| | `categories` | Kategóriák | ✅ Mindenki |
| | `projects` | Projektek | ✅ Mindenki |
| | `partners` | Partnertörzs | ✅ Mindenki |
| **Pénzügyek** | `invoices` | Számlák | ✅ Mindenki |
| | `receivables` | Kintlévőség | ✅ Mindenki |
| | `transactions` | Tranzakciók | ✅ Mindenki |
| | `petty_cash` | Házipénztár | ✅ Mindenki |
| **Könyvelés** | `general_ledger` | Főkönyv | 🔒 Member+ |
| | `profit_loss` | Eredménykimutatás | 🔒 Member+ |
| | `balance_sheet` | Mérleg | 🔒 Member+ |
| | `annual_report` | Beszámoló | 🔒 Member+ |
| | `vat_return` | ÁFA Bevallás | 🔒 Member+ |
| **HR & Eszközök** | `salaries` | Bérek/járulékok | 🔒 Admin only |
| | `working_time` | Munkaidő | ✅ Mindenki |
| | `fixed_assets` | TENY | 🔒 Member+ |
| **Szállítmányozás** | `shipment_matching` | Fuvarok | ❌ **Disabled by default!** |
| | `shipment_import` | Excel Import | ❌ **Disabled by default!** |
| **Rendszer** | `integrations` | Integrációk | 🔒 Admin only |
| | `exchange_rates` | Árfolyamok | ✅ Mindenki |

### 6.4 Jogosultsági prioritás

```
1. DB override (eaisybill_module_permissions) — ha létezik, ő nyer
2. Speciális szabályok:
   - shipment_matching, shipment_import → MINDIG false (DB override nélkül)
3. Static role defaults:
   - Admin/Owner: MINDEN modul elérhető (kivéve shipment!)
   - Member: Minden KIVÉVE ADMIN_ONLY_MODULES
   - Assistant: Alap pénzügyi + admin funkciók NÉLKÜL
   - Viewer: Read-only pénzügyi adatok
   - Employee: Csak working_time
```

> [!WARNING]
> **A Szállítmányozás modulok (shipment_matching, shipment_import) speciális kezelésűek!**  
> Ezek az EGYETLEN modulok, amelyek **Admin felhasználóknál is kikapcsoltak** alapértelmezetten.
> Engedélyezéshez KÖTELEZŐ DB override szükséges az `eaisybill_module_permissions` táblában.

### 6.5 Admin felület: EaisybillPermissionPanel

A **Beállítások** oldalon (`/settings`) az Admin felhasználók testreszabhatják a jogosultságokat:

**Helye:** `src/components/settings/EaisybillPermissionPanel.tsx`

**Funkciók:**
- Felhasználó kiválasztás (nem-admin members)
- Modulonkénti R (olvasás) / W (írás) toggle
- Csoportos műveletek: R+, W+, Tilt, Reset
- Keresés modulnévre
- "Reset" → törli az override-ot, visszaáll a szerepkör alapértelmezésre

**Korlátozások:**
- Admin/Owner felhasználók NEM konfigurálhatók (mindig teljes hozzáférés — shipment kivétel!)
- A panel csak admin/owner felhasználóknak jelenik meg

### 6.6 Új kliens-specifikus modul bekapcsolása (howto)

Egy új cég Szállítmányozás moduljának engedélyezéséhez:

```sql
-- 1. Kérdezd le a company_id-t és user_id-t
SELECT id FROM companies WHERE name ILIKE '%HRT%';
SELECT id FROM auth.users WHERE email = 'user@example.com';

-- 2. Engedélyezd a shipment modulokat a felhasználónak
INSERT INTO eaisybill_module_permissions (company_id, user_id, module_name, can_read, can_write)
VALUES
  ('company-uuid', 'user-uuid', 'shipment_matching', true, true),
  ('company-uuid', 'user-uuid', 'shipment_import', true, true);
```

Vagy az Admin felületen: **Beállítások → Jogosultságkezelő → Felhasználó kiválasztás → Szállítmányozás csoport → R+, W+**

### 6.7 Sidebar menü filterelés (technikai)

Az `AppSidebar.tsx` a `visibleGroups` useMemo-ban szűri a menüelemeket:

```typescript
const visibleGroups = useMemo(() => {
  return navigationGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => {
        if (!item.moduleKey) return true;     // Nincs module key → mindig látható
        return canAccess(item.moduleKey);      // Permission check
      }),
    }))
    .filter(group => group.items.length > 0); // Üres csoportok eltűnnek
}, [canAccess, basePath]);
```

**Eredmény:** Ha a Szállítmányozás csoport összes eleme disabled → az egész "Szállítmányozás" csoport nem jelenik meg a sidebarban.

