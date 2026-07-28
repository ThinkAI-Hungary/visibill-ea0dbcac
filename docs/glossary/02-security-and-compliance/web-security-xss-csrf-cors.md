# 🌐 Web Security — XSS, CSRF, CORS & CSP (Böngészőbiztonság)

> **Utoljára frissítve:** 2026-07-25  
> **Kapcsolódó doksi:** [A-040: Multi-Tab Auth Flow Isolation](../../architecture/decisions/A-040-multi-tab-auth-flow-isolation.md) | [GLOSSARY Index](../index.md)

---

## 📖 Fogalom Meghatározása

A **Web Security (Webes Biztonság)** a böngésző és a webszerver közötti kommunikáció, valamint a kliens oldalon futó kódrészletek védelmét takarja a leggyakoribb kiber-támadási formákkal szemben.

---

## 🚨 A 4 Legfőbb Webes Sérülékenység & Védelem

### 1. XSS (Cross-Site Scripting)
- **Támadás:** A támadó kártékony JavaScript kódot szúr be az alkalmazásba (pl. egy számla megjegyzés mezőjébe vagy egy hibajegybe), amely a többi felhasználó böngészőjében lefutva ellopja a munkamenetet.
- **Védelem a Visibillben:**  
  - A React natívan eszképeli (escape-eli) a dinamikus változókat az JSX-ben.
  - Veszélyes HTML renderelés (`dangerouslySetInnerHTML`) szigorúan tiltott vagy felülvizsgált `DOMPurify` fertőtlenítéssel fut.

### 2. CSRF (Cross-Site Request Forgery)
- **Támadás:** A támadó egy külső kártékony weboldalról észrevétlenül kérést indít a felhasználó nevében a Visibill API felé (kihasználva az automatikusan küldött cookie-kat).
- **Védelem a Visibillben:**  
  - A Visibill **nem használ auth cookie-kat** a Supabase API-hoz, hanem **Bearer JWT tokent** küld az `Authorization` fejlécben.
  - A böngésző nem küldi el automatikusan a JWT tokent a külső weboldalak kéréseivel, így a CSRF támadás kivitelezhetetlen.

### 3. CORS (Cross-Origin Resource Sharing)
- **Támadás / Hálózati szabály:** A böngésző azonos eredet politikája (Same-Origin Policy) megakadályozza, hogy a `https://visibill.hu` domain-en futó frontend lekérdezhesse egy idegen domain API-ját.
- **Védelem a Visibillben:**  
  - A Supabase Edge Function-ök explicit `Access-Control-Allow-Origin` és `Access-Control-Allow-Headers` fejléceket adnak vissza:

```typescript
// Cors headers az Edge Function-ökben:
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
```

### 4. CSP (Content Security Policy) & Multi-Tab Isolation [A-040]
- **Támadás:** Idegen külső scriptek vagy iFrame-ek beágyazása.
- **Védelem a Visibillben:** A biztonsági auth tokenek a böngésző **`sessionStorage`**-ában tárolódnak, így egyetlen rosszindulatú külső iFrame vagy eltérő böngészőlap sem fér hozzá az aktív munkamenethez.
