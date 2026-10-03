# EaisyWorks Nyilt REST API Dokumentacio (v1)

> **Base URL:** `http://2.28.55.167`
> **Verzio:** 1.0 (Enterprise REST & Webhooks)
> **Formatum:** JSON (`Content-Type: application/json`)

---

## 1. Integracios Szerepkorok & Munkaterulet (Workspace) Hozzaarendeles

> **Szerepkorok:** Az EaisyWorks a SZERVER (adatszolgaltato es feladatkezelo), mig a kulso szoftverek (pl. EasyCRM, Webshop, Sentry) a KLIENSEK.
> **Workspace Scoping:** Az EaisyWorks-ben kiadott API kulcs eleve a cel Workspace-hez van kotve. Ezert:
> 1. A `GET /api/v1/workspaces` hivas a beallitott kulccsal automatikusan csak az engedelyezett cel munkateruletet adja vissza, igy a kliens beallitasaiban a lenyilo valaszto azonnal ki tudja jelolni.
> 2. A `POST /api/v1/tickets` vegponton a `workspace_id` elkuldese nem kotelezo: uresen hagyva automatikusan az API kulcshoz tarsitott munkateruletre erkezik a hibajegy.

---

## 2. Altalanos Integracios es Hitelesitesi Iranyelvek

A rendszer ketfele modon teszi lehetove a kulso rendszerek es AI ugynokok kapcsolodasat:

1. **Kozvetlen Allando API Kulcs:**
   - Fejlec: `Authorization: Bearer ew_live_...` vagy `X-API-Key: ew_live_...`
   - Gyors integraciokhoz, megbizhato backend szerverekhez javasolt.

2. **1 Oras M2M Bearer Token (Ajánlott OAuth flow):**
   - Lepes: Kuldj egy `POST /api/v1/auth/token` kerest az API kulccsal.
   - Valasz: Egy 3600 masodpercig ervenyes `ew_tok_...` ideiglenes access token.
   - Tovabbi keresek fejlece: `Authorization: Bearer ew_tok_...`

### Ratelimit Szabalyok
- **Token bevaltas (`/api/v1/auth/token`):** Max. 30 keres / perc / IP.
- **Altalanos vegpontok:** Max. 120 keres / perc / API kulcs.

---

## 3. API Vegpontok Reszletes Katalógusa

### 2.1. [POST] /api/v1/auth/token
**Cim:** 1 oras Bearer Token bevaltasa API kulcsbol
**Kategoria:** Hitelesites & M2M | **Jogosultsag:** Olvasas (read_only vagy read_write)
**Hitelesites:** Nyilvanos

**Leiras:** Allando ew_live_ kezdetu API kulcsbol 3600 masodpercig ervenyes ideiglenes M2M Bearer tokent allit ki. A gyorsabb integracio erdekeben a vegpontok kozvetlenul is elfogadjak az ew_live_ kulcsot az Authorization vagy X-API-Key fejlecben.
> Megjegyzes: Ratelimit: 30 keres per perc per IP cim.

#### Parameterek:
| Parameter | Hely | Tipus | Kotelezo? | Leiras |
| :--- | :--- | :--- | :--- | :--- |
| `X-API-Key` | Header | `string` | Opcionalis | Allando API kulcs (ew_live_...) |
| `Content-Type` | Header | `string` | **Igen** | application/json |

#### Keres Torzs (JSON Body minta):
```json
{
  "api_key": "ew_live_pelda_kulcs_1234567890abcdef"
}
```

#### Sikeres Valasz (200 OK):
```json
{
  "success": true,
  "token_type": "Bearer",
  "access_token": "ew_tok_9876543210fedcba...",
  "expires_in": 3600,
  "scopes": [
    "workspace:read",
    "tasks:read",
    "tasks:create",
    "tasks:update"
  ],
  "permission_level": "read_write",
  "organization_id": "org_uuid_here",
  "project_id": "project_uuid_here",
  "workspaceId": "workspace_uuid_here"
}
```

#### Integracios Kodreszletek:
**cURL:**
```bash
curl -X POST "http://2.28.55.167/api/v1/auth/token" \
  -H "Content-Type: application/json" \
  -d '{"api_key": "ew_live_ca6453..."}'
```

**TypeScript / Node.js:**
```typescript
const res = await fetch("http://2.28.55.167/api/v1/auth/token", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ api_key: "ew_live_ca6453..." })
});
const data = await res.json();
console.log("Bearer token:", data.access_token);
```

**Python:**
```python
import requests

res = requests.post(
    "http://2.28.55.167/api/v1/auth/token",
    json={"api_key": "ew_live_ca6453..."}
)
access_token = res.json().get("access_token")
print("Bearer token:", access_token)
```

**PHP:**
```php
<?php
$ch = curl_init("http://2.28.55.167/api/v1/auth/token");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ["Content-Type: application/json"]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(["api_key" => "ew_live_ca6453..."]));
$response = json_decode(curl_exec($ch), true);
curl_close($ch);
$accessToken = $response["access_token"];
?>
```

---

### 2.2. [POST] /api/v1/tickets
**Cim:** Uj kulso hibajegy bekuldese masik rendszerbol
**Kategoria:** Kulso Hibajegyek (Tickets) | **Jogosultsag:** Iras/Olvasas (read_write)
**Hitelesites:** Kotelezo

**Leiras:** Kulso szoftverekbol, weboldalakrol vagy monitoring rendszerekbol erkezo hibajegyek automatikus fogadasa. Letrehoz egy uj feladatot a kivalasztott munkateruleten, kulso azonosito es bekuldo telemetria rogzitesevel, valamint automatikus [Hibajegy] kategoriacimkevel.
> Megjegyzes: A priority lehet: 'low', 'medium', 'high', 'urgent'. Alapertelmezett: 'medium'.

#### Parameterek:
| Parameter | Hely | Tipus | Kotelezo? | Leiras |
| :--- | :--- | :--- | :--- | :--- |
| `Authorization` | Header | `string` | **Igen** | Bearer <token> vagy Bearer <ew_live_...> |
| `Content-Type` | Header | `string` | **Igen** | application/json |

#### Keres Torzs (JSON Body minta):
```json
{
  "title": "Bejelentkezesi hiba: 500-as kod a fizetes oldalon",
  "description": "A felhasznalo a SimplePay gombra kattintva timeout hibat kapott.",
  "priority": "high",
  "source_app": "Webshop Frontend v2.4",
  "reporter_name": "Kovacs Peter",
  "reporter_email": "peter@pelda.hu",
  "external_id": "TICKET-94182",
  "workspace_id": "ws_uuid_vagy_ures_ha_kulcshoz_kotott",
  "category_name": "Fizetesi Rendszer",
  "extra_data": {
    "browser": "Chrome 122.0.0",
    "os": "Windows 11",
    "cart_total": 45900,
    "currency": "HUF"
  }
}
```

#### Sikeres Valasz (200 OK):
```json
{
  "success": true,
  "message": "Hibajegy sikeresen letrehozva a works rendszerben!",
  "ticket": {
    "id": "task_uuid_here",
    "key": "PROJ-108",
    "title": "Bejelentkezesi hiba: 500-as kod a fizetes oldalon",
    "status": "todo",
    "priority": "high",
    "workspace_id": "ws_uuid_here",
    "category_id": "cat_uuid_here",
    "is_completed": false
  }
}
```

#### Integracios Kodreszletek:
**cURL:**
```bash
curl -X POST "http://2.28.55.167/api/v1/tickets" \
  -H "Authorization: Bearer ew_live_ca6453..." \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Bug report masik rendszerbol",
    "description": "Rendeles leadaskor a modal nem zarodik be.",
    "priority": "urgent",
    "source_app": "ShopApp v3",
    "reporter_email": "ugyfel@ceg.hu",
    "external_id": "SHOP-552"
  }'
```

**TypeScript / Node.js:**
```typescript
const res = await fetch("http://2.28.55.167/api/v1/tickets", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ew_live_ca6453...",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    title: "Bug report masik rendszerbol",
    description: "Rendeles leadaskor a modal nem zarodik be.",
    priority: "urgent",
    source_app: "ShopApp v3",
    reporter_email: "ugyfel@ceg.hu",
    external_id: "SHOP-552"
  })
});
const result = await res.json();
console.log("Letrehozott hibajegy:", result.ticket);
```

**Python:**
```python
import requests

payload = {
    "title": "Bug report masik rendszerbol",
    "description": "Rendeles leadaskor a modal nem zarodik be.",
    "priority": "urgent",
    "source_app": "ShopApp v3",
    "reporter_email": "ugyfel@ceg.hu",
    "external_id": "SHOP-552"
}
res = requests.post(
    "http://2.28.55.167/api/v1/tickets",
    headers={"Authorization": "Bearer ew_live_ca6453..."},
    json=payload
)
print(res.json())
```

**PHP:**
```php
<?php
$data = [
    "title" => "Bug report masik rendszerbol",
    "description" => "Rendeles leadaskor a modal nem zarodik be.",
    "priority" => "urgent",
    "source_app" => "ShopApp v3",
    "reporter_email" => "ugyfel@ceg.hu",
    "external_id" => "SHOP-552"
];
$ch = curl_init("http://2.28.55.167/api/v1/tickets");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer ew_live_ca6453...",
    "Content-Type: application/json"
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
$response = json_decode(curl_exec($ch), true);
curl_close($ch);
print_r($response);
?>
```

---

### 2.3. [GET] /api/v1/tickets
**Cim:** Hibajegyek lekerese es allapotanak lekerdezese
**Kategoria:** Kulso Hibajegyek (Tickets) | **Jogosultsag:** Olvasas (read_only vagy read_write)
**Hitelesites:** Kotelezo

**Leiras:** Lekerheti a bekuldott hibajegyek es feladatok listajat, aktualis allapotukat (todo, in_progress, review, done), felelosuket es prioritasaikat.

#### Parameterek:
| Parameter | Hely | Tipus | Kotelezo? | Leiras |
| :--- | :--- | :--- | :--- | :--- |
| `workspace_id` | Query | `string` | Opcionalis | Munkaterulet UUID szureshez |
| `project_id` | Query | `string` | Opcionalis | Projekt UUID szureshez |
| `status` | Query | `string` | Opcionalis | Allapot szures (todo, in_progress, review, done) |
| `priority` | Query | `string` | Opcionalis | Prioritas szures (low, medium, high, urgent) |
| `limit` | Query | `number` | Opcionalis | Talalati korlat (1-100, alap: 50) |

#### Sikeres Valasz (200 OK):
```json
{
  "success": true,
  "count": 2,
  "tickets": [
    {
      "id": "task_uuid",
      "key": "PROJ-108",
      "title": "Bejelentkezesi hiba",
      "status": "in_progress",
      "priority": "urgent",
      "assigned_to": "user_uuid",
      "profiles": {
        "display_name": "Fejleszto Janos",
        "email": "janos@ceg.hu"
      }
    }
  ]
}
```

#### Integracios Kodreszletek:
**cURL:**
```bash
curl -X GET "http://2.28.55.167/api/v1/tickets?status=in_progress&limit=20" \
  -H "Authorization: Bearer ew_live_ca6453..."
```

**TypeScript / Node.js:**
```typescript
const res = await fetch("http://2.28.55.167/api/v1/tickets?status=in_progress", {
  headers: { "Authorization": "Bearer ew_live_ca6453..." }
});
const data = await res.json();
console.log("Hibajegyek szama:", data.count);
```

**Python:**
```python
import requests

res = requests.get(
    "http://2.28.55.167/api/v1/tickets?status=in_progress",
    headers={"Authorization": "Bearer ew_live_ca6453..."}
)
print("Hibajegyek:", res.json())
```

**PHP:**
```php
<?php
$ch = curl_init("http://2.28.55.167/api/v1/tickets?status=in_progress");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer ew_live_ca6453..."]);
$response = json_decode(curl_exec($ch), true);
curl_close($ch);
print_r($response);
?>
```

---

### 2.4. [GET] /api/v1/tasks
**Cim:** Feladatok listazasa szuresi feltetelekkel
**Kategoria:** Feladatok (Tasks) | **Jogosultsag:** Olvasas (read_only vagy read_write)
**Hitelesites:** Kotelezo

**Leiras:** Visszaadja a szervezet vagy a felhatalmazott munkaterulet feladatait statusz, prioritas es projekt szerint szurve.

#### Parameterek:
| Parameter | Hely | Tipus | Kotelezo? | Leiras |
| :--- | :--- | :--- | :--- | :--- |
| `workspace_id` | Query | `string` | Opcionalis | Munkaterulet UUID |
| `project_id` | Query | `string` | Opcionalis | Projekt UUID |
| `status` | Query | `string` | Opcionalis | todo, in_progress, review, done |
| `priority` | Query | `string` | Opcionalis | low, medium, high, urgent |

#### Sikeres Valasz (200 OK):
```json
{
  "success": true,
  "count": 14,
  "tasks": [
    {
      "id": "task_uuid",
      "key": "DEV-42",
      "title": "Adatbazis migracio ellenorzese",
      "status": "todo",
      "priority": "high",
      "workspace_id": "ws_uuid",
      "project_id": "proj_uuid"
    }
  ]
}
```

#### Integracios Kodreszletek:
**cURL:**
```bash
curl -X GET "http://2.28.55.167/api/v1/tasks" \
  -H "Authorization: Bearer ew_live_ca6453..."
```

**TypeScript / Node.js:**
```typescript
const res = await fetch("http://2.28.55.167/api/v1/tasks", {
  headers: { "Authorization": "Bearer ew_live_ca6453..." }
});
const data = await res.json();
console.log(data.tasks);
```

**Python:**
```python
import requests
res = requests.get("http://2.28.55.167/api/v1/tasks", headers={"Authorization": "Bearer ew_live_ca6453..."})
print(res.json())
```

**PHP:**
```php
<?php
$ch = curl_init("http://2.28.55.167/api/v1/tasks");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer ew_live_ca6453..."]);
$response = json_decode(curl_exec($ch), true);
curl_close($ch);
?>
```

---

### 2.5. [POST] /api/v1/tasks
**Cim:** Uj feladat letrehozasa
**Kategoria:** Feladatok (Tasks) | **Jogosultsag:** Iras/Olvasas (read_write)
**Hitelesites:** Kotelezo

**Leiras:** Uj feladat felvetele a rendszerbe. Felelos rendelheto hozza UUID vagy e-mail cim alapjan, valamint hatarido, prioritas, kategoria es fuggoseg allithato be.

#### Keres Torzs (JSON Body minta):
```json
{
  "title": "API dokumentacio elkeszitese",
  "description": "Interaktiv dokumentacio integracioja az API kulcsok oldalra.",
  "priority": "high",
  "status": "todo",
  "workspace_id": "ws_uuid_ha_nem_a_kulcsbol_adodik",
  "assigned_to": "fejleszto@ceg.hu",
  "due_date": "2026-10-15T18:00:00Z"
}
```

#### Sikeres Valasz (200 OK):
```json
{
  "success": true,
  "message": "Feladat sikeresen letrehozva!",
  "task": {
    "id": "task_uuid",
    "key": "PROJ-109",
    "title": "API dokumentacio elkeszitese",
    "status": "todo",
    "priority": "high"
  }
}
```

#### Integracios Kodreszletek:
**cURL:**
```bash
curl -X POST "http://2.28.55.167/api/v1/tasks" \
  -H "Authorization: Bearer ew_live_ca6453..." \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Uj task az API-bol",
    "description": "Leiras szovege...",
    "priority": "medium",
    "workspace_id": "WORKSPACE_UUID"
  }'
```

**TypeScript / Node.js:**
```typescript
const res = await fetch("http://2.28.55.167/api/v1/tasks", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ew_live_ca6453...",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    title: "Uj task az API-bol",
    description: "Leiras szovege...",
    priority: "medium",
    workspace_id: "WORKSPACE_UUID"
  })
});
const result = await res.json();
console.log(result.task);
```

**Python:**
```python
import requests
payload = {
    "title": "Uj task az API-bol",
    "description": "Leiras szovege...",
    "priority": "medium",
    "workspace_id": "WORKSPACE_UUID"
}
res = requests.post("http://2.28.55.167/api/v1/tasks", headers={"Authorization": "Bearer ew_live_ca6453..."}, json=payload)
print(res.json())
```

**PHP:**
```php
<?php
$data = [
    "title" => "Uj task az API-bol",
    "priority" => "medium",
    "workspace_id" => "WORKSPACE_UUID"
];
$ch = curl_init("http://2.28.55.167/api/v1/tasks");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer ew_live_ca6453...",
    "Content-Type: application/json"
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
$response = json_decode(curl_exec($ch), true);
curl_close($ch);
?>
```

---

### 2.6. [GET] /api/v1/tasks/:id
**Cim:** Egyetlen feladat lekerese (UUID vagy PROJ-123 kulcs)
**Kategoria:** Feladatok (Tasks) | **Jogosultsag:** Olvasas (read_only vagy read_write)
**Hitelesites:** Kotelezo

**Leiras:** Lekeri a feladat reszletes adatait, alfeladatait, megjegyzeseket es a hozza tartozo audit naplot. Az azonosito lehet belsou UUID vagy emberi kulcs (pl. PROJ-108).

#### Parameterek:
| Parameter | Hely | Tipus | Kotelezo? | Leiras |
| :--- | :--- | :--- | :--- | :--- |
| `id` | Path (URL) | `string` | **Igen** | Feladat UUID vagy Kulcs (pl. PROJ-42) |

#### Sikeres Valasz (200 OK):
```json
{
  "success": true,
  "task": {
    "id": "task_uuid",
    "key": "PROJ-108",
    "title": "Bejelentkezesi hiba",
    "status": "in_progress",
    "comments": [],
    "subtasks": []
  }
}
```

#### Integracios Kodreszletek:
**cURL:**
```bash
curl -X GET "http://2.28.55.167/api/v1/tasks/PROJ-108" \
  -H "Authorization: Bearer ew_live_ca6453..."
```

**TypeScript / Node.js:**
```typescript
const res = await fetch("http://2.28.55.167/api/v1/tasks/PROJ-108", {
  headers: { "Authorization": "Bearer ew_live_ca6453..." }
});
const data = await res.json();
console.log(data.task);
```

**Python:**
```python
import requests
res = requests.get("http://2.28.55.167/api/v1/tasks/PROJ-108", headers={"Authorization": "Bearer ew_live_ca6453..."})
print(res.json())
```

**PHP:**
```php
<?php
$ch = curl_init("http://2.28.55.167/api/v1/tasks/PROJ-108");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer ew_live_ca6453..."]);
$response = json_decode(curl_exec($ch), true);
curl_close($ch);
?>
```

---

### 2.7. [PATCH] /api/v1/tasks/:id
**Cim:** Feladat modositasa vagy allapotvaltas
**Kategoria:** Feladatok (Tasks) | **Jogosultsag:** Iras/Olvasas (read_write)
**Hitelesites:** Kotelezo

**Leiras:** Modosithato a feladat allapota (status), felelose (assigned_to), prioritas (priority), cime, leirasa vagy elvegezettsege (is_completed).

#### Parameterek:
| Parameter | Hely | Tipus | Kotelezo? | Leiras |
| :--- | :--- | :--- | :--- | :--- |
| `id` | Path (URL) | `string` | **Igen** | Feladat UUID vagy Kulcs (pl. PROJ-42) |

#### Keres Torzs (JSON Body minta):
```json
{
  "status": "done",
  "is_completed": true,
  "comment": "A hiba javitva es elesitve a v2.4.1 verzioban."
}
```

#### Sikeres Valasz (200 OK):
```json
{
  "success": true,
  "message": "Feladat sikeresen frissitve!",
  "task": {
    "id": "task_uuid",
    "key": "PROJ-108",
    "status": "done",
    "is_completed": true
  }
}
```

#### Integracios Kodreszletek:
**cURL:**
```bash
curl -X PATCH "http://2.28.55.167/api/v1/tasks/PROJ-108" \
  -H "Authorization: Bearer ew_live_ca6453..." \
  -H "Content-Type: application/json" \
  -d '{"status": "done", "is_completed": true}'
```

**TypeScript / Node.js:**
```typescript
const res = await fetch("http://2.28.55.167/api/v1/tasks/PROJ-108", {
  method: "PATCH",
  headers: {
    "Authorization": "Bearer ew_live_ca6453...",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ status: "done", is_completed: true })
});
const result = await res.json();
console.log(result);
```

**Python:**
```python
import requests
res = requests.patch(
    "http://2.28.55.167/api/v1/tasks/PROJ-108",
    headers={"Authorization": "Bearer ew_live_ca6453..."},
    json={"status": "done", "is_completed": True}
)
print(res.json())
```

**PHP:**
```php
<?php
$data = ["status" => "done", "is_completed" => true];
$ch = curl_init("http://2.28.55.167/api/v1/tasks/PROJ-108");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "PATCH");
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer ew_live_ca6453...",
    "Content-Type: application/json"
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
$response = json_decode(curl_exec($ch), true);
curl_close($ch);
?>
```

---

### 2.8. [DELETE] /api/v1/tasks/:id
**Cim:** Feladat torlese
**Kategoria:** Feladatok (Tasks) | **Jogosultsag:** Iras/Olvasas (read_write)
**Hitelesites:** Kotelezo

**Leiras:** Veglegesen torli a feladatot az adatbazisbol (az audit naploban a torlesi esemeny rogzitesre kerul).

#### Parameterek:
| Parameter | Hely | Tipus | Kotelezo? | Leiras |
| :--- | :--- | :--- | :--- | :--- |
| `id` | Path (URL) | `string` | **Igen** | Feladat UUID vagy Kulcs |

#### Sikeres Valasz (200 OK):
```json
{
  "success": true,
  "message": "Feladat sikeresen torolve!"
}
```

#### Integracios Kodreszletek:
**cURL:**
```bash
curl -X DELETE "http://2.28.55.167/api/v1/tasks/task_uuid" \
  -H "Authorization: Bearer ew_live_ca6453..."
```

**TypeScript / Node.js:**
```typescript
const res = await fetch("http://2.28.55.167/api/v1/tasks/task_uuid", {
  method: "DELETE",
  headers: { "Authorization": "Bearer ew_live_ca6453..." }
});
const result = await res.json();
console.log(result);
```

**Python:**
```python
import requests
res = requests.delete("http://2.28.55.167/api/v1/tasks/task_uuid", headers={"Authorization": "Bearer ew_live_ca6453..."})
print(res.json())
```

**PHP:**
```php
<?php
$ch = curl_init("http://2.28.55.167/api/v1/tasks/task_uuid");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "DELETE");
curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer ew_live_ca6453..."]);
$response = json_decode(curl_exec($ch), true);
curl_close($ch);
?>
```

---

### 2.9. [GET] /api/v1/workspaces
**Cim:** Munkateruletek lekerese
**Kategoria:** Munkateruletek | **Jogosultsag:** Olvasas (read_only vagy read_write)
**Hitelesites:** Kotelezo

**Leiras:** Visszaadja a szervezethez vagy projekthez tartozo munkateruletek listajat.

#### Parameterek:
| Parameter | Hely | Tipus | Kotelezo? | Leiras |
| :--- | :--- | :--- | :--- | :--- |
| `project_id` | Query | `string` | Opcionalis | Projekt UUID szureshez |

#### Sikeres Valasz (200 OK):
```json
{
  "success": true,
  "count": 3,
  "workspaces": [
    {
      "id": "ws_uuid",
      "name": "Fejlesztes & Teszteles",
      "slug": "fejlesztes-teszteles",
      "status": "active",
      "project_id": "proj_uuid"
    }
  ]
}
```

#### Integracios Kodreszletek:
**cURL:**
```bash
curl -X GET "http://2.28.55.167/api/v1/workspaces" \
  -H "Authorization: Bearer ew_live_ca6453..."
```

**TypeScript / Node.js:**
```typescript
const res = await fetch("http://2.28.55.167/api/v1/workspaces", {
  headers: { "Authorization": "Bearer ew_live_ca6453..." }
});
const data = await res.json();
console.log(data.workspaces);
```

**Python:**
```python
import requests
res = requests.get("http://2.28.55.167/api/v1/workspaces", headers={"Authorization": "Bearer ew_live_ca6453..."})
print(res.json())
```

**PHP:**
```php
<?php
$ch = curl_init("http://2.28.55.167/api/v1/workspaces");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer ew_live_ca6453..."]);
$response = json_decode(curl_exec($ch), true);
curl_close($ch);
?>
```

---

### 2.10. [GET] /api/v1/workspaces/:id
**Cim:** Teljes munkaterulet fa export (Tasks + Milestones + Members)
**Kategoria:** Munkateruletek | **Jogosultsag:** Olvasas (read_only vagy read_write)
**Hitelesites:** Kotelezo

**Leiras:** Egyetlen atomi hivasban adja vissza a munkaterulet adatait, az osszes feladatot, merfoldkovet, kategoriat es a rendelt munkatarsakat. Kifejezetten AI ugynokokhoz es kulso szinkronizaciokhoz javasolt.

#### Parameterek:
| Parameter | Hely | Tipus | Kotelezo? | Leiras |
| :--- | :--- | :--- | :--- | :--- |
| `id` | Path (URL) | `string` | **Igen** | Munkaterulet UUID vagy slug |

#### Sikeres Valasz (200 OK):
```json
{
  "success": true,
  "workspace": {
    "id": "ws_uuid",
    "name": "Backend Core",
    "slug": "backend-core"
  },
  "tree": {
    "tasks": [],
    "milestones": [],
    "categories": [],
    "members": []
  }
}
```

#### Integracios Kodreszletek:
**cURL:**
```bash
curl -X GET "http://2.28.55.167/api/v1/workspaces/WORKSPACE_UUID" \
  -H "Authorization: Bearer ew_live_ca6453..."
```

**TypeScript / Node.js:**
```typescript
const res = await fetch("http://2.28.55.167/api/v1/workspaces/WORKSPACE_UUID", {
  headers: { "Authorization": "Bearer ew_live_ca6453..." }
});
const data = await res.json();
console.log("Feladatok szama a workspace-ben:", data.tree.tasks.length);
```

**Python:**
```python
import requests
res = requests.get("http://2.28.55.167/api/v1/workspaces/WORKSPACE_UUID", headers={"Authorization": "Bearer ew_live_ca6453..."})
print(res.json().get("tree"))
```

**PHP:**
```php
<?php
$ch = curl_init("http://2.28.55.167/api/v1/workspaces/WORKSPACE_UUID");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer ew_live_ca6453..."]);
$response = json_decode(curl_exec($ch), true);
curl_close($ch);
?>
```

---

### 2.11. [GET] /api/v1/projects
**Cim:** Projektek lekerese munkateruletekkel
**Kategoria:** Projektek | **Jogosultsag:** Olvasas (read_only vagy read_write)
**Hitelesites:** Kotelezo

**Leiras:** Visszaadja a szervezethez tartozo projektek adatait, kodprefixuket (pl. PROJ), hataridejuket es a hozza kapcsolodo munkateruleteket.

#### Sikeres Valasz (200 OK):
```json
{
  "success": true,
  "count": 2,
  "projects": [
    {
      "id": "proj_uuid",
      "name": "EaisyWorks V2",
      "key_prefix": "EW",
      "status": "active",
      "workspaces": []
    }
  ]
}
```

#### Integracios Kodreszletek:
**cURL:**
```bash
curl -X GET "http://2.28.55.167/api/v1/projects" \
  -H "Authorization: Bearer ew_live_ca6453..."
```

**TypeScript / Node.js:**
```typescript
const res = await fetch("http://2.28.55.167/api/v1/projects", {
  headers: { "Authorization": "Bearer ew_live_ca6453..." }
});
const data = await res.json();
console.log(data.projects);
```

**Python:**
```python
import requests
res = requests.get("http://2.28.55.167/api/v1/projects", headers={"Authorization": "Bearer ew_live_ca6453..."})
print(res.json())
```

**PHP:**
```php
<?php
$ch = curl_init("http://2.28.55.167/api/v1/projects");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer ew_live_ca6453..."]);
$response = json_decode(curl_exec($ch), true);
curl_close($ch);
?>
```

---

### 2.12. [GET] /api/v1/milestones
**Cim:** Merfoldkovek listazasa
**Kategoria:** Merfoldkovek | **Jogosultsag:** Olvasas (read_only vagy read_write)
**Hitelesites:** Kotelezo

**Leiras:** Lekeri a merfoldkovek listajat projekt alapjan, keszultsegi allapotukkal es hataridejukkel.

#### Parameterek:
| Parameter | Hely | Tipus | Kotelezo? | Leiras |
| :--- | :--- | :--- | :--- | :--- |
| `project_id` | Query | `string` | Opcionalis | Projekt UUID szureshez |

#### Sikeres Valasz (200 OK):
```json
{
  "success": true,
  "count": 4,
  "milestones": [
    {
      "id": "milestone_uuid",
      "name": "Alfa Verzio Atadasa",
      "status": "in_progress",
      "due_date": "2026-11-01"
    }
  ]
}
```

#### Integracios Kodreszletek:
**cURL:**
```bash
curl -X GET "http://2.28.55.167/api/v1/milestones?project_id=PROJ_UUID" \
  -H "Authorization: Bearer ew_live_ca6453..."
```

**TypeScript / Node.js:**
```typescript
const res = await fetch("http://2.28.55.167/api/v1/milestones", {
  headers: { "Authorization": "Bearer ew_live_ca6453..." }
});
const data = await res.json();
console.log(data.milestones);
```

**Python:**
```python
import requests
res = requests.get("http://2.28.55.167/api/v1/milestones", headers={"Authorization": "Bearer ew_live_ca6453..."})
print(res.json())
```

**PHP:**
```php
<?php
$ch = curl_init("http://2.28.55.167/api/v1/milestones");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer ew_live_ca6453..."]);
$response = json_decode(curl_exec($ch), true);
curl_close($ch);
?>
```

---

### 2.13. [GET] /api/v1/members
**Cim:** Szervezeti tagok es munkatarsak lekerese
**Kategoria:** Csapattagok | **Jogosultsag:** Olvasas (read_only vagy read_write)
**Hitelesites:** Kotelezo

**Leiras:** Visszaadja a szervezet munkatarsait azonositojukkal, nevukkel, e-mail cimukkel es szerepkorukkel. Kivalo a feladatok automatikus feleloshöz rendelesenek elokeszitesere.

#### Sikeres Valasz (200 OK):
```json
{
  "success": true,
  "count": 5,
  "members": [
    {
      "id": "member_uuid",
      "profile_id": "profile_uuid",
      "role": "member",
      "name": "Kovacs Peter",
      "email": "peter@ceg.hu"
    }
  ]
}
```

#### Integracios Kodreszletek:
**cURL:**
```bash
curl -X GET "http://2.28.55.167/api/v1/members" \
  -H "Authorization: Bearer ew_live_ca6453..."
```

**TypeScript / Node.js:**
```typescript
const res = await fetch("http://2.28.55.167/api/v1/members", {
  headers: { "Authorization": "Bearer ew_live_ca6453..." }
});
const data = await res.json();
console.log(data.members);
```

**Python:**
```python
import requests
res = requests.get("http://2.28.55.167/api/v1/members", headers={"Authorization": "Bearer ew_live_ca6453..."})
print(res.json())
```

**PHP:**
```php
<?php
$ch = curl_init("http://2.28.55.167/api/v1/members");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer ew_live_ca6453..."]);
$response = json_decode(curl_exec($ch), true);
curl_close($ch);
?>
```

---

### 2.14. [POST] /api/organizations/:orgId/webhooks
**Cim:** Kimeno Webhook esemenyek (Realtime ertesitesek)
**Kategoria:** Kiemelt Webhookok | **Jogosultsag:** Iras/Olvasas (read_write)
**Hitelesites:** Kotelezo

**Leiras:** A rendszer esemenyvezerelten HTTP POST uzeneteket kuld a megadott vegpontra a feladatok es merfoldkovek eletciklussa soran. Minden keres tartalmaz egy HMAC SHA-256 alairast a 'X-Webhook-Signature' fejlecben.
> Megjegyzes: Tamogatott esemenyek: task.created, task.status_changed, task.completed, task.approved, task.rejected, milestone.completed.

#### Keres Torzs (JSON Body minta):
```json
{
  "event": "task.created",
  "timestamp": "2026-09-29T16:00:00Z",
  "organization_id": "org_uuid",
  "data": {
    "task_id": "task_uuid",
    "key": "PROJ-110",
    "title": "Kritikus szerver leallas",
    "status": "todo",
    "priority": "urgent"
  }
}
```

#### Sikeres Valasz (200 OK):
```json
{
  "status": "A kulso szervernek 200 OK koddal kell valaszolnia 5 masodpercen belul"
}
```

#### Integracios Kodreszletek:
**cURL:**
```bash
# Webhook hitelesites ellenorzese (HMAC SHA-256):
# Alairas a fejlecben: X-Webhook-Signature: sha256=<HASH>
```

**TypeScript / Node.js:**
```typescript
import crypto from "crypto";

export function verifyWebhook(rawBody: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac("sha256", secret);
  const digest = "sha256=" + hmac.update(rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}
```

**Python:**
```python
import hmac
import hashlib

def verify_webhook(raw_body: bytes, signature: str, secret: str) -> bool:
    expected = "sha256=" + hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
```

**PHP:**
```php
<?php
function verify_webhook($rawBody, $signature, $secret) {
    $expected = "sha256=" . hash_hmac("sha256", $rawBody, $secret);
    return hash_equals($expected, $signature);
}
?>
```

---

## 3. Kimeno Webhookok es Alairas Ellenorzes

A szervezet beallitasaiban rogzitett webhook vegpontokra a rendszer JSON payloadot kuld a feladatok es merfoldkovek statuszvaltasakor.
A kulso szerver a keres hitelesseget a `X-Webhook-Signature` fejlec alapjan ellenorizheti HMAC SHA-256 algoritmussal.

### Node.js Ellenorzo Pelda:
```typescript
import crypto from "crypto";

export function verifyWebhookSignature(rawBody: string, signatureHeader: string, webhookSecret: string): boolean {
  const expected = "sha256=" + crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
}
```
