# Decision 026: Banki Integráció Jövője (Aggreg8 Open Banking PSD2 AISP)

**Status:** Decided  
**Date:** 2026-09-17  
**Utoljára frissítve:** 2026-09-17  

**Category:** Integrációk & Jövő  

**Question:** A banki adatok kezelése továbbra is manuális CSV/XLS import marad, vagy tervezünk Open Banking (PSD2) integrációt? Ha igen, mely szolgáltatóval és milyen banki lefedettséggel?

**Decision:**
A Visibill / eaisybill-prod az **Aggreg8 (PSD2 AISP v5.3.1)** felhőalapú Open Banking aggregátorát integrálja hivatalos MNB-licensszel rendelkező banki összekötőként.
1. **Hosted SyncUI Modell:** A felhasználó az Aggreg8 biztonságos felugró ablakában (SyncUI) választ bankot és azonosítja magát (OAuth/Push jóváhagyás). A Visibill soha nem fér hozzá a felhasználó netbankos belépési adataihoz (Zero Liability).
2. **180 napos PSD2 felhatalmazás:** A banki jóváhagyás 180 napig érvényes, a felületen visszaszámláló mutatja az érvényességet és egykattintásos meghosszabbítást biztosít.
3. **Automatikus & On-Demand szinkronizáció:** Napi automatikus webhook-alapú tranzakcióletöltés és manuálisan indítható frissítés.
4. **Banki lefedettség:** Az összes jelentős magyar bank (OTP, Erste, MBH, Raiffeisen, K&H, CIB, UniCredit) és nemzetközi neobank (Revolut, Wise).

**Jelenlegi implementáció:**
- Új Edge Function páros: `aggreg8-api` (JWT auth, flow indítás) és `aggreg8-callback` (webhook fogadó, tranzakció mentés).
- Új adatbázis táblák: `aggreg8_consents`, `aggreg8_accounts`, `aggreg8_settings`.
- `bank_transactions.bank_statement_id` oszlop nullable lett, így az Open Banking tranzakciók közvetlenül és azonnal bekerülnek a könyvelési párosító motorba.
- UI: Beállítások $\rightarrow$ Bankszámlák fülön dedikált `Aggreg8BankConnections` komponens 4 állapottal és élő Realtime szinkronizációval.

**Rationale:**
A manuális CSV/XLS kivonatok letöltése és feltöltése a könyvelők és vállalkozók legnagyobb időrabló folyamata volt. Az MNB által jóváhagyott PSD2 aggregáció 99%-kal csökkenti a manuális adminisztrációt, azonnali tranzakció-számla párosítást tesz lehetővé, és teljes jogi/adatvédelmi védelmet garantál.

## Kapcsolódó
- [A-119: Aggreg8 PSD2 Open Banking Integráció](../../architecture/decisions/A-119-aggreg8-psd2-open-banking-integration.md)
- [P-087: Aggreg8 Bankcsatlakozás és SyncUI UX](../../product/decisions/P-087-aggreg8-bank-connections-and-sync-ui-ux.md)
- [06-transactions-bank.md Adatbázis](../../architecture/database/06-transactions-bank.md)
