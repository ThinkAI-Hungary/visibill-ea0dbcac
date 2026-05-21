# Decision 024: Kintlévőség & Fizetési Felszólítás

**Status:** Decided

**Category:** Pénzügyi Modulok

**Question:** Hogyan kezeli a rendszer a kintlévőségeket és a fizetési felszólításokat?

**Decision:**
- KintlevoPage — lejárt számlák nyomon követése, szűrés
- Fizetési felszólító email küldés (send-dunning-email Edge Function)
- dunning_sends tábla: adós adatok (cégnév, adószám, email), számla azonosítók, összeg, pénznem, küldési állapot
- Email küldés Mailgun-on keresztül

**Rationale:** A kintlévőségek kezelése és az automatikus fizetési felszólítás csökkenti a késedelmes fizetéseket és javítja a cash flow-t.
