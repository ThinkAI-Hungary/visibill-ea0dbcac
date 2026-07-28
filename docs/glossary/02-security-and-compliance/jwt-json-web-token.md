# 🔑 JWT — JSON Web Token (Munkamenet Hitelesítés)

> **Utoljára frissítve:** 2026-07-25  
> **Kapcsolódó doksi:** [A-009: Auth RBAC Architecture](../../architecture/decisions/A-009-auth-rbac.md) | [A-021: Email Auth Flow](../../architecture/decisions/A-021-email-auth-flow-redesign.md) | [GLOSSARY Index](../index.md)

---

## 📖 Fogalom Meghatározása

A **JWT (JSON Web Token)** egy nyílt iparági szabvány (RFC 7519), amely abban segít, hogy két fél (kliens és szerver) között biztonságos, kriptografikusan aláírt formában továbbítsunk adatokat (claims).

A Supabase Auth a sikeres bejelentkezés után egy JWT access token-t bocsát ki a böngésző számára, amelyet a kliens minden későbbi HTTP kérésnél a `Authorization: Bearer <JWT>` fejlécben küld el.

---

## 🧩 A JWT Felépítése (3 Rész)

Egy JWT 3 ponttal elválasztott Base64URL kodolású sztringből áll: `Header.Payload.Signature`

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInN1YiI6ImFiYzEyMyIsInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzU3OTcwMDUwfQ.Signature
```

1. **Header:** A használt aláíró algoritmust határozza meg (pl. HMAC SHA256 / RS256).
2. **Payload (Claims):** A felhasználó adatai (`sub`: user_id, `email`, `role`: `authenticated`, `exp`: lejárati idő bélyeg).
3. **Signature:** Az adatbázis titkos JWT Secret kulcsával generált digitális aláírás, amely garantálja, hogy a token nem hamisítható.

---

## 💡 Használat a Visibill Architektúrában

### 1. Frontend & API Hívások
A React alkalmazás a Supabase kliensen keresztül tárolja a tokent (`sessionStorage` / `localStorage`). Minden Edge Function hívásnál elküldi a tokent:

```typescript
const session = await supabase.auth.getSession();
const response = await fetch(`${SUPABASE_URL}/functions/v1/management-stats`, {
  headers: {
    Authorization: `Bearer ${session.data.session?.access_token}`,
  },
});
```

### 2. Edge Function JWT Validation
Az Edge Function-ök (`management-stats`, `send-email`) az alábbi módon ellenőrzik a beérkező JWT-t:

```typescript
// management-stats/index.ts
const authHeader = req.headers.get("Authorization");
const token = authHeader?.replace("Bearer ", "");

const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
if (error || !user) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
}
```

---

## 🛡️ Multi-Tab Munkamenet Izoláció (A-040)

A Visibill biztonsági architektúrája ([A-040]) a JWT tokent a böngésző **`sessionStorage`**-ában tárolja (nem `localStorage`-ban). Ez megakadályozza a fülek közötti token-szivárgást és biztosítja, hogy egy másodlagos fülön végzett kijelentkezés vagy fiókváltás ne állítsa át észrevétlenül az első fül munkamenetét.
