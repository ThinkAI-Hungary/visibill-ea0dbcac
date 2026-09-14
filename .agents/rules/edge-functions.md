---
trigger: model_decision
description: Apply when creating, editing, testing, or deploying Supabase Edge Functions in supabase/functions/ in eaisybill-prod.
---

# Supabase Edge Functions Guidelines (Visibill / eaisybill-prod)

## 🛡️ 1. Kötelező Kliens- és Költségvédelem (ADR A-101)
A rendszer védve van a jogosulatlan szkript-alapú automatizációk és a kontrollálatlan LLM/API költségek ellen.
* **Minden hitelesített felhasználói Edge Function-ben kötelező:**
  ```typescript
  import { corsHeaders, checkAutomationShield } from "../_shared/client-guard.ts";

  Deno.serve(async (req) => {
    // 1. CORS Preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // 2. Kettős védelmi vonal (Script-runner és Bot védelem)
    const automationBlock = checkAutomationShield(req);
    if (automationBlock) {
      return automationBlock;
    }
    
    // ... további üzleti logika
  });
  ```
* **Kivételek:** Csak a külső, kriptográfiailag hitelesített webhookok (pl. `process-mailgun-webhook` HMAC szignatúrával) mentesülnek a `checkAutomationShield` alól.

---

## 🔑 2. Hitelesítés és Jogosultságkezelés (Auth & RBAC)
* **Bearer Token ellenőrzés:**
  * Soha ne bízz a kérés törzsében átadott `userId` vagy `companyId` mezőkben!
  * Mindig vond ki az `Authorization` fejlécből a tokent, és ellenőrizd az `anonClient.auth.getUser(token)` segítségével.
* **Service Role vs Anon Client:**
  * Alapértelmezésben a felhasználó tokenjével ellátott klienst használd az RLS betartásához.
  * `SUPABASE_SERVICE_ROLE_KEY`-t kizárólag szigorúan auditált háttérműveleteknél (pl. service bypass, belső szinkronizáció) használj, ahol az RLS-t szándékosan meg kell kerülni.

---

## 🦕 3. Deno Runtime és Import Konvenciók
* **Nincs Node.js `require`:**
  * Az Edge Function-ök Deno környezetben futnak.
  * Külső könyvtárakhoz használj `https://esm.sh/...` URL-t (pl. `@supabase/supabase-js`), vagy `npm:` / `jsr:` előtagot.
* **Környezeti változók és titkok:**
  * Minden érzékeny kulcsot a `Deno.env.get("SECRET_NAME")` függvénnyel kérj le.
  * **Szigorúan tilos** API kulcsokat, jelszavakat vagy privát tokeneket kliensnek visszaküldött válaszba illeszteni vagy kódban hardkódolni.

---

## ⚡ 4. Hibakezelés és Válasz Formátumok
* **Strukturált JSON válaszok:**
  * Mindig állítsd be a `Content-Type: application/json` és a `{ ...corsHeaders }` fejléceket.
  * Sikeres válasz:
    ```typescript
    return new Response(JSON.stringify({ data, success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    ```
  * Hibaválasz (400, 401, 403, 500):
    ```typescript
    return new Response(JSON.stringify({ error: err.message, code: "OPERATION_FAILED" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    ```
