# 05. Beállítások, Integrációk és Globális UI — HR Lokalizációs Leltár

**Modul hatóköre:** Vezérlőpult KPI kártyák és árfolyam-különbözet, Cégbeállítások, Minimax API és számlázó integrációk, Projektek és Kategóriák, Jegyzetek, Hibajegyek, Tudásbázis, Globális Oldalsáv és Dátumválasztó.  
**Összes érintett fájl:** 196 db  
**Összes feltárt hiányosság:** 4077 db  
**Elsődleges i18n névtér:** `settings` (továbbá `common`)

---

## 📈 1. Modul Statisztika és Hotspotok

### Kategóriák szerinti megoszlás
| Elem típusa | Előfordulás | Súlyosság / Hatás |
| :--- | :---: | :--- |
| **Értesítési ablakok (Toast)** | 438 db | Magas (P1) — Művelet-visszajelzés a felhasználónak |
| **Modálok és megerősítések (Dialog)** | 11 db | Kritikus (P0/P1) — Űrlapok és felugró ablakok |
| **Státusz jelvények (Badge)** | 19 db | Magas (P1) — Bizonylat- és tranzakció állapotok |
| **Feltételes állapotok (Ternary)** | 2236 db | Magas (P1) — Táblázatcellákban megjelenő státuszok |
| **Táblázat oszlopok és menüpontok** | 271 db | Közepes (P2) — Adatstruktúra fejlécek és legördülők |
| **Űrlap súgók és helykitöltők (Props)** | 219 db | Közepes (P2) — `placeholder`, `title`, `tooltip` |
| **Közvetlen felületi szövegek (JSX)** | 832 db | Kritikus (P0) — Gombok, címkék, kártya tartalom |
| **Hiányzó szótárkulcsok (Missing HR key)** | 51 db | Magas (P1) — `t(...)` hívás ami nincs a horvát JSON-ban |


### Legtöbb lokalizációs hiányosságot tartalmazó komponensek:
- [ApiDocsExplorer.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/ApiDocsExplorer.tsx): **202 db** lefordítandó elem
- [SuperadminConstants.ts](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/management/components/superadmin/SuperadminConstants.ts): **143 db** lefordítandó elem
- [PermissionConstants.ts](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/management/components/permissions/PermissionConstants.ts): **136 db** lefordítandó elem
- [Projects.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/Projects.tsx): **119 db** lefordítandó elem
- [EmptyStateDashboard.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx): **118 db** lefordítandó elem
- [Settings.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/Settings.tsx): **116 db** lefordítandó elem
- [EscalationListPage.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/EscalationListPage.tsx): **110 db** lefordítandó elem
- [IconPicker.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/IconPicker.tsx): **89 db** lefordítandó elem

---

## 🔔 2. Értesítési Ablakok (Toasts) és Modális Megerősítések

| Forrás és sorszám | Elem | Megjelenő magyar szöveg | Javasolt horvát (HR) fordítás |
| :--- | :--- | :--- | :--- |
| [CMREscalationDialog.tsx:L184](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CMREscalationDialog.tsx#L184) | `toast_title` | CMR párosítva! ✅ | **— (Prevesti na HR)** |
| [CMREscalationDialog.tsx:L189](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CMREscalationDialog.tsx#L189) | `toast_title` | Pozíciószám mentve | **— (Prevesti na HR)** |
| [CMREscalationDialog.tsx:L198](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CMREscalationDialog.tsx#L198) | `toast_title` | Hiba a párosítás során | **— (Prevesti na HR)** |
| [CompanySelector.tsx:L71](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CompanySelector.tsx#L71) | `toast_title` | Érvénytelen adószám | **— (Prevesti na HR)** |
| [CompanySelector.tsx:L71](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CompanySelector.tsx#L71) | `toast_desc` | Kérjük, adj meg legalább 8 számjegyet az adószámból a lekérdezéshez! | **— (Prevesti na HR)** |
| [CompanySelector.tsx:L83](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CompanySelector.tsx#L83) | `toast_title` | Nem sikerült lekérdezni a cégadatokat | **— (Prevesti na HR)** |
| [CompanySelector.tsx:L107](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CompanySelector.tsx#L107) | `toast_title` | Cégadatok sikeresen betöltve a NAV-ból! | **— (Prevesti na HR)** |
| [CompanySelector.tsx:L112](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CompanySelector.tsx#L112) | `toast_title` | Hiba a NAV lekérdezés során | **— (Prevesti na HR)** |
| [CompanySelector.tsx:L161](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CompanySelector.tsx#L161) | `toast_title` | A cég neve kötelező! | **— (Prevesti na HR)** |
| [CompanySelector.tsx:L162](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CompanySelector.tsx#L162) | `toast_title` | Az adószám kötelező! | **— (Prevesti na HR)** |
| [CompanySelector.tsx:L193](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CompanySelector.tsx#L193) | `toast_title` | Cég sikeresen létrehozva! | **— (Prevesti na HR)** |
| [CompanySelector.tsx:L197](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CompanySelector.tsx#L197) | `toast_title` | Hiba történt a cég létrehozása során | **Došlo je do greške** |
| [CompanySelector.tsx:L205](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CompanySelector.tsx#L205) | `toast_title` | A csatlakozási kód kötelező! | **— (Prevesti na HR)** |
| [CompanySelector.tsx:L224](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CompanySelector.tsx#L224) | `toast_title` | Már tagja vagy ennek a cégnek! | **— (Prevesti na HR)** |
| [CompanySelector.tsx:L228](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CompanySelector.tsx#L228) | `toast_title` | Érvénytelen csatlakozási kód! | **— (Prevesti na HR)** |
| [CompanySelector.tsx:L232](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CompanySelector.tsx#L232) | `toast_title` | A csatlakozási kód lejárt! Kérj új kódot a cég tulajdonosától. | **— (Prevesti na HR)** |
| [CompanySelector.tsx:L246](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CompanySelector.tsx#L246) | `toast_title` | Sikeresen csatlakoztál a céghez! | **— (Prevesti na HR)** |
| [CompanySelector.tsx:L250](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CompanySelector.tsx#L250) | `toast_title` | Hiba történt a csatlakozás során | **Došlo je do greške** |
| [CompanySelector.tsx:L299](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CompanySelector.tsx#L299) | `toast_title` | Cég sikeresen frissítve! | **— (Prevesti na HR)** |
| [CompanySelector.tsx:L303](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CompanySelector.tsx#L303) | `toast_title` | Hiba történt a cég frissítése során | **Došlo je do greške** |
| [CompanySelector.tsx:L355](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CompanySelector.tsx#L355) | `toast_title` | Cég sikeresen törölve! | **— (Prevesti na HR)** |
| [CompanySelector.tsx:L359](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CompanySelector.tsx#L359) | `toast_title` | Hiba történt a cég törlése során | **Došlo je do greške** |
| [CourierReportTab.tsx:L841](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CourierReportTab.tsx#L841) | `toast_title` | Nincs exportálható adat | **— (Prevesti na HR)** |
| [CourierReportTab.tsx:L884](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CourierReportTab.tsx#L884) | `toast_title` | Export sikertelen | **— (Prevesti na HR)** |
| [EmailAliasManager.tsx:L81](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/EmailAliasManager.tsx#L81) | `toast_title` | Email alias létrehozva | **— (Prevesti na HR)** |
| [EmailAliasManager.tsx:L81](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/EmailAliasManager.tsx#L81) | `toast_desc` | Az email alias sikeresen generálva | **— (Prevesti na HR)** |
| [EmailAliasManager.tsx:L117](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/EmailAliasManager.tsx#L117) | `toast_title` | Hiba | **Greška** |
| [EmailAliasManager.tsx:L133](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/EmailAliasManager.tsx#L133) | `toast_title` | Másolva | **— (Prevesti na HR)** |
| [EmailAliasManager.tsx:L133](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/EmailAliasManager.tsx#L133) | `toast_desc` | Az email cím a vágólapra került | **— (Prevesti na HR)** |
| [EmailAliasManager.tsx:L139](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/EmailAliasManager.tsx#L139) | `toast_title` | Másolási hiba | **— (Prevesti na HR)** |
| [EmailAliasManager.tsx:L139](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/EmailAliasManager.tsx#L139) | `toast_desc` | Nem sikerült másolni az email címet | **— (Prevesti na HR)** |
| [EmailPreferences.tsx:L63](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/EmailPreferences.tsx#L63) | `toast_title` | Nem sikerült betölteni az email beállításokat | **— (Prevesti na HR)** |
| [EmailPreferences.tsx:L87](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/EmailPreferences.tsx#L87) | `toast_title` | Beállítás frissítve | **— (Prevesti na HR)** |
| [EmailPreferences.tsx:L90](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/EmailPreferences.tsx#L90) | `toast_title` | Nem sikerült frissíteni a beállítást | **— (Prevesti na HR)** |
| [LiveNotificationProvider.tsx:L325](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/LiveNotificationProvider.tsx#L325) | `toast_title` | Dokumentum párosítva! | **— (Prevesti na HR)** |
| [LiveNotificationProvider.tsx:L464](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/LiveNotificationProvider.tsx#L464) | `toast_title` | Tranzakciók feldolgozva! | **— (Prevesti na HR)** |
| [NylasEmailConnect.tsx:L46](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/NylasEmailConnect.tsx#L46) | `toast_title` | Hiba | **Greška** |
| [NylasEmailConnect.tsx:L46](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/NylasEmailConnect.tsx#L46) | `toast_desc` | Nem sikerült betölteni a kapcsolt email fiókokat | **— (Prevesti na HR)** |
| [NylasEmailConnect.tsx:L88](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/NylasEmailConnect.tsx#L88) | `toast_title` | Kapcsolódás sikertelen | **— (Prevesti na HR)** |
| [NylasEmailConnect.tsx:L111](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/NylasEmailConnect.tsx#L111) | `toast_title` | Kapcsolódási hiba | **— (Prevesti na HR)** |
| [NylasEmailConnect.tsx:L141](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/NylasEmailConnect.tsx#L141) | `toast_title` | Lekapcsolási hiba | **— (Prevesti na HR)** |
| [SupportModeBanner.tsx:L108](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/SupportModeBanner.tsx#L108) | `toast_title` | Support mód hamarosan lejár! | **— (Prevesti na HR)** |
| [SupportModeBanner.tsx:L134](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/SupportModeBanner.tsx#L134) | `toast_title` | Hiba a support mód leállításakor | **— (Prevesti na HR)** |
| [AiAssistantChat.tsx:L561](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ai/AiAssistantChat.tsx#L561) | `toast_title` | Másolva | **— (Prevesti na HR)** |
| [AiAssistantChat.tsx:L561](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ai/AiAssistantChat.tsx#L561) | `toast_desc` | Az üzenet szövege a vágólapra másolva. | **— (Prevesti na HR)** |
| [AiAssistantChat.tsx:L688](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ai/AiAssistantChat.tsx#L688) | `toast_title` | Hiba a törlés során | **— (Prevesti na HR)** |
| [AiAssistantChat.tsx:L688](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ai/AiAssistantChat.tsx#L688) | `toast_desc` | Nem sikerült törölni a beszélgetést. | **— (Prevesti na HR)** |
| [AiAssistantChat.tsx:L701](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ai/AiAssistantChat.tsx#L701) | `toast_title` | Bejelentkezés szükséges | **— (Prevesti na HR)** |
| [AiAssistantChat.tsx:L701](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ai/AiAssistantChat.tsx#L701) | `toast_desc` | A csevegés használatához kérlek jelentkezz be újra. | **— (Prevesti na HR)** |
| [AiAssistantChat.tsx:L711](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ai/AiAssistantChat.tsx#L711) | `toast_title` | Túl gyors | **— (Prevesti na HR)** |
| [AiAssistantChat.tsx:L711](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ai/AiAssistantChat.tsx#L711) | `toast_desc` | Kérlek várj egy pillanatot a következő üzenet előtt. | **— (Prevesti na HR)** |
| [AiAssistantChat.tsx:L888](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ai/AiAssistantChat.tsx#L888) | `toast_title` | Hiba a válaszadás során | **— (Prevesti na HR)** |
| [AiAssistantChat.tsx:L942](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ai/AiAssistantChat.tsx#L942) | `toast_title` | Hiba a visszajelzés rögzítésekor | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L118](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L118) | `toast_title` | Érvénytelen adószám | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L118](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L118) | `toast_desc` | Kérjük, adj meg legalább 8 számjegyet az adószámból a lekérdezéshez! | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L130](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L130) | `toast_title` | Nem sikerült lekérdezni a cégadatokat | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L149](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L149) | `toast_title` | Cégadatok sikeresen betöltve a NAV-ból! | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L154](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L154) | `toast_title` | Hiba a NAV lekérdezés során | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L206](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L206) | `toast_title` | A projekt neve kötelező! | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L229](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L229) | `toast_title` | A kategória neve kötelező! | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L275](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L275) | `toast_title` | NAV kapcsolat sikeresen ellenőrizve! | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L291](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L291) | `toast_title` | Kérjük, add meg a cég nevét a generáláshoz! | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L295](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L295) | `toast_title` | Kérjük, add meg az elsődleges TEÁOR kódot a generáláshoz! | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L308](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L308) | `toast_title` | Cégleírás sikeresen generálva! | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L314](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L314) | `toast_title` | Generálás sikertelen | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L334](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L334) | `toast_title` | A munkamenet lejárt | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L334](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L334) | `toast_desc` | Kérjük, jelentkezzen be újra a folytatáshoz. | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L422](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L422) | `toast_title` | NAV mentési figyelmeztetés | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L501](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L501) | `toast_title` | NAV számlák szinkronizálása elindult a háttérben | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L512](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L512) | `toast_title` | Beállítás sikeres! Üdvözöljük a eaisybill-ben! | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L526](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L526) | `toast_title` | Hiba történt a beállítás során | **Došlo je do greške** |
| [EmptyStateDashboard.tsx:L540](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L540) | `toast_title` | A csatlakozási kód kötelező! | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L559](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L559) | `toast_title` | Már tagja vagy ennek a cégnek! | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L563](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L563) | `toast_title` | Érvénytelen csatlakozási kód! | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L567](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L567) | `toast_title` | A csatlakozási kód lejárt! Kérj új kódot a cég tulajdonosától. | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L581](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L581) | `toast_title` | Sikeresen csatlakoztál a céghez! | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L594](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L594) | `toast_title` | Hiba történt a csatlakozás során | **Došlo je do greške** |
| [NavUpoM2mCard.tsx:L210](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/NavUpoM2mCard.tsx#L210) | `toast_title` | Kliensazonosító másolva! | **— (Prevesti na HR)** |
| [NavUpoM2mCard.tsx:L223](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/NavUpoM2mCard.tsx#L223) | `toast_title` | Teszt sandbox adatok betöltve | **— (Prevesti na HR)** |
| [NavUpoM2mCard.tsx:L223](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/NavUpoM2mCard.tsx#L223) | `toast_desc` | A NAV tesztkörnyezeti demó adatai kitöltve. Kattints az aktiválásra! | **— (Prevesti na HR)** |
| [NavUpoM2mCard.tsx:L260](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/NavUpoM2mCard.tsx#L260) | `toast_title` | Sikeres aktiválás! | **— (Prevesti na HR)** |
| [NavUpoM2mCard.tsx:L273](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/NavUpoM2mCard.tsx#L273) | `toast_title` | Aktiválási hiba | **— (Prevesti na HR)** |
| [NavUpoM2mCard.tsx:L299](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/NavUpoM2mCard.tsx#L299) | `toast_title` | Szinkronizáció folyamatban a NAV-nál | **— (Prevesti na HR)** |
| [NavUpoM2mCard.tsx:L299](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/NavUpoM2mCard.tsx#L299) | `toast_desc` | A NAV szervere még készíti az adatállományt. Pár perc múlva próbáld újra! | **— (Prevesti na HR)** |
| [NavUpoM2mCard.tsx:L304](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/NavUpoM2mCard.tsx#L304) | `toast_title` | Dolgozói jogviszonyok szinkronizálva! | **— (Prevesti na HR)** |
| [NavUpoM2mCard.tsx:L315](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/NavUpoM2mCard.tsx#L315) | `toast_title` | Hiba a dolgozók lekérdezésekor | **— (Prevesti na HR)** |
| [NavUpoM2mCard.tsx:L339](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/NavUpoM2mCard.tsx#L339) | `toast_title` | EFO alkalmi munka napok lekérdezve! | **— (Prevesti na HR)** |
| [NavUpoM2mCard.tsx:L351](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/NavUpoM2mCard.tsx#L351) | `toast_title` | Hiba az EFO adatok szinkronizálásakor | **— (Prevesti na HR)** |
| [NavUpoM2mCard.tsx:L381](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/NavUpoM2mCard.tsx#L381) | `toast_title` | Kapcsolati ellenőrzés sikertelen | **— (Prevesti na HR)** |
| [NavUpoM2mCard.tsx:L405](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/NavUpoM2mCard.tsx#L405) | `toast_title` | Beállítások elmentve | **— (Prevesti na HR)** |
| [NavUpoM2mCard.tsx:L405](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/NavUpoM2mCard.tsx#L405) | `toast_desc` | Az automatikus háttérszinkronizációs szabályok frissültek. | **— (Prevesti na HR)** |
| [NavUpoM2mCard.tsx:L412](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/NavUpoM2mCard.tsx#L412) | `toast_title` | Hiba a mentés során | **— (Prevesti na HR)** |
| [NavUpoM2mCard.tsx:L432](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/NavUpoM2mCard.tsx#L432) | `toast_desc` | Az aláírókulcsok és azonosítók véglegesen törölve lettek az adatbázisból. | **— (Prevesti na HR)** |
| [NavUpoM2mCard.tsx:L440](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/NavUpoM2mCard.tsx#L440) | `toast_title` | Hiba a kapcsolat bontásakor | **— (Prevesti na HR)** |
| [SzamlazzAgentForm.tsx:L77](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/SzamlazzAgentForm.tsx#L77) | `toast_title` | Hiányos adat | **— (Prevesti na HR)** |
| [SzamlazzAgentForm.tsx:L77](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/SzamlazzAgentForm.tsx#L77) | `toast_desc` | Kérlek add meg a Számlázz.hu Agent API kulcsot! | **— (Prevesti na HR)** |
| [SzamlazzAgentForm.tsx:L86](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/SzamlazzAgentForm.tsx#L86) | `toast_title` | Érvénytelen kulcs formátum | **— (Prevesti na HR)** |
| [SzamlazzAgentForm.tsx:L86](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/SzamlazzAgentForm.tsx#L86) | `toast_desc` | A Számlázz.hu Agent kulcs jellemzően 42 karakter hosszú. | **— (Prevesti na HR)** |
| [KnowledgeArticleReader.tsx:L51](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/knowledge-base/KnowledgeArticleReader.tsx#L51) | `toast_title` | Cikk linkje másolva | **— (Prevesti na HR)** |
| [KnowledgeArticleReader.tsx:L51](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/knowledge-base/KnowledgeArticleReader.tsx#L51) | `toast_desc` | A cikk közvetlen hivatkozása a vágólapra került. | **— (Prevesti na HR)** |
| [KnowledgeArticleStructuredContent.tsx:L373](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/knowledge-base/KnowledgeArticleStructuredContent.tsx#L373) | `toast_title` | Útvonal másolva | **— (Prevesti na HR)** |
| [NavCredentialsForm.tsx:L191](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/nav/NavCredentialsForm.tsx#L191) | `toast_title` | Hiányos adatok | **— (Prevesti na HR)** |
| [NavCredentialsForm.tsx:L220](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/nav/NavCredentialsForm.tsx#L220) | `toast_title` | Kapcsolat tesztelése... | **— (Prevesti na HR)** |
| [NavCredentialsForm.tsx:L220](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/nav/NavCredentialsForm.tsx#L220) | `toast_desc` | NAV API kapcsolat ellenőrzése a mentés előtt... | **— (Prevesti na HR)** |
| [NavCredentialsForm.tsx:L319](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/nav/NavCredentialsForm.tsx#L319) | `toast_title` | Sikeres mentés | **Uspješno spremljeno** |
| [NavCredentialsForm.tsx:L319](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/nav/NavCredentialsForm.tsx#L319) | `toast_desc` | NAV hitelesítő adatok sikeresen mentve és validálva. | **— (Prevesti na HR)** |
| [NavCredentialsForm.tsx:L328](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/nav/NavCredentialsForm.tsx#L328) | `toast_title` | Mentési hiba | **— (Prevesti na HR)** |
| [NavCredentialsForm.tsx:L363](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/nav/NavCredentialsForm.tsx#L363) | `toast_title` | Sikeres validálás | **— (Prevesti na HR)** |
| [NavCredentialsForm.tsx:L376](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/nav/NavCredentialsForm.tsx#L376) | `toast_title` | Validálási hiba | **— (Prevesti na HR)** |
| [NavCredentialsForm.tsx:L415](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/nav/NavCredentialsForm.tsx#L415) | `toast_title` | Adatok szinkronizálása | **— (Prevesti na HR)** |
| [NavCredentialsForm.tsx:L487](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/nav/NavCredentialsForm.tsx#L487) | `toast_title` | Szinkronizálási hiba | **— (Prevesti na HR)** |
| [NavCredentialsForm.tsx:L493](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/nav/NavCredentialsForm.tsx#L493) | `toast_title` | Részleges szinkronizáció | **— (Prevesti na HR)** |
| [NavCredentialsForm.tsx:L505](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/nav/NavCredentialsForm.tsx#L505) | `toast_title` | Nincs új adat | **— (Prevesti na HR)** |
| [NavCredentialsForm.tsx:L510](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/nav/NavCredentialsForm.tsx#L510) | `toast_title` | Szinkronizálás kész | **— (Prevesti na HR)** |
| [NavCredentialsForm.tsx:L562](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/nav/NavCredentialsForm.tsx#L562) | `toast_title` | Sikeres leválasztás | **— (Prevesti na HR)** |
| [NavCredentialsForm.tsx:L562](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/nav/NavCredentialsForm.tsx#L562) | `toast_desc` | A NAV API kapcsolat sikeresen leválasztva. | **— (Prevesti na HR)** |
| [NavCredentialsForm.tsx:L586](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/nav/NavCredentialsForm.tsx#L586) | `toast_title` | Hiba | **Greška** |
| [NavSyncSettingsDialog.tsx:L105](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/nav/NavSyncSettingsDialog.tsx#L105) | `toast_title` | Hiba történt | **Došlo je do greške** |
| [NavSyncSettingsDialog.tsx:L128](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/nav/NavSyncSettingsDialog.tsx#L128) | `toast_title` | Beállítások mentve | **— (Prevesti na HR)** |
| [NavSyncSettingsDialog.tsx:L128](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/nav/NavSyncSettingsDialog.tsx#L128) | `toast_desc` | A NAV automatikus szinkronizációs beállítások sikeresen frissítve. | **— (Prevesti na HR)** |
| [NavSyncSettingsDialog.tsx:L135](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/nav/NavSyncSettingsDialog.tsx#L135) | `toast_title` | Mentési hiba | **— (Prevesti na HR)** |
| [ApiDocsExplorer.tsx:L1077](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/ApiDocsExplorer.tsx#L1077) | `toast_title` | Másolva | **— (Prevesti na HR)** |
| [ApiDocsExplorer.tsx:L1077](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/ApiDocsExplorer.tsx#L1077) | `toast_desc` | Vágólapra helyezve. | **— (Prevesti na HR)** |
| [ApiDocsExplorer.tsx:L1084](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/ApiDocsExplorer.tsx#L1084) | `toast_title` | Hiányzó API kulcs | **— (Prevesti na HR)** |
| [ApiDocsExplorer.tsx:L1084](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/ApiDocsExplorer.tsx#L1084) | `toast_desc` | Adj meg egy érvényes API kulcsot (pl. vb_...) a teszteléshez! | **— (Prevesti na HR)** |
| [ApiDocsExplorer.tsx:L1144](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/ApiDocsExplorer.tsx#L1144) | `toast_title` | Hálózati hiba | **— (Prevesti na HR)** |
| [ApiKeysCard.tsx:L139](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/ApiKeysCard.tsx#L139) | `toast_desc` | Az API kulcs sikeresen legenerálva! Kérjük mentsd el a kulcsot. | **— (Prevesti na HR)** |
| [ApiKeysCard.tsx:L152](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/ApiKeysCard.tsx#L152) | `toast_title` | Hiba történt | **Došlo je do greške** |
| [ApiKeysCard.tsx:L171](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/ApiKeysCard.tsx#L171) | `toast_desc` | Az API kulcs sikeresen vissza lett vonva. A további kérések elutasításra... | **— (Prevesti na HR)** |
| [ApiKeysCard.tsx:L177](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/ApiKeysCard.tsx#L177) | `toast_title` | Hiba a visszavonáskor | **— (Prevesti na HR)** |
| [ApiKeysCard.tsx:L189](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/ApiKeysCard.tsx#L189) | `toast_title` | Kimásolva | **— (Prevesti na HR)** |
| [ApiKeysCard.tsx:L189](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/ApiKeysCard.tsx#L189) | `toast_desc` | API kulcs a vágólapra másolva. | **— (Prevesti na HR)** |
| [BusinessSection.tsx:L158](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/BusinessSection.tsx#L158) | `toast_desc` | Telephely sikeresen hozzáadva. | **— (Prevesti na HR)** |
| [BusinessSection.tsx:L163](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/BusinessSection.tsx#L163) | `toast_title` | Hiba | **Greška** |
| [BusinessSection.tsx:L163](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/BusinessSection.tsx#L163) | `toast_desc` | Nem sikerült a telephely hozzáadása. | **— (Prevesti na HR)** |
| [BusinessSection.tsx:L172](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/BusinessSection.tsx#L172) | `toast_desc` | Telephely eltávolítva. | **— (Prevesti na HR)** |
| [BusinessSection.tsx:L174](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/BusinessSection.tsx#L174) | `toast_desc` | Nem sikerült a telephely törlése. | **— (Prevesti na HR)** |
| [EaisybillPermissionPanel.tsx:L179](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/EaisybillPermissionPanel.tsx#L179) | `toast_title` | Hiba | **Greška** |
| [TicketDetailView.tsx:L1454](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/tickets/TicketDetailView.tsx#L1454) | `toast_title` | Hiba | **Greška** |
| [AuthContext.tsx:L226](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/contexts/AuthContext.tsx#L226) | `toast_title` | Regisztráció sikertelen | **— (Prevesti na HR)** |
| [AuthContext.tsx:L267](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/contexts/AuthContext.tsx#L267) | `toast_title` | Bejelentkezés sikertelen | **— (Prevesti na HR)** |
| [AuthContext.tsx:L373](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/contexts/AuthContext.tsx#L373) | `toast_title` | Hitelesítés sikertelen | **— (Prevesti na HR)** |
| [AuthContext.tsx:L373](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/contexts/AuthContext.tsx#L373) | `toast_desc` | A jelenlegi jelszó helytelen | **— (Prevesti na HR)** |
| [AuthContext.tsx:L386](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/contexts/AuthContext.tsx#L386) | `toast_title` | Jelszó módosítás sikertelen | **— (Prevesti na HR)** |
| [AuthContext.tsx:L392](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/contexts/AuthContext.tsx#L392) | `toast_title` | Sikeres | **Uspješno** |
| [AuthContext.tsx:L392](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/contexts/AuthContext.tsx#L392) | `toast_desc` | Jelszó sikeresen megváltoztatva | **— (Prevesti na HR)** |
| [ErrorControlPanel.tsx:L226](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/management/components/errors/ErrorControlPanel.tsx#L226) | `toast_title` | Hibák törölve | **— (Prevesti na HR)** |
| [ErrorControlPanel.tsx:L234](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/management/components/errors/ErrorControlPanel.tsx#L234) | `toast_title` | Törlés sikertelen | **— (Prevesti na HR)** |
| [ErrorControlPanel.tsx:L234](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/management/components/errors/ErrorControlPanel.tsx#L234) | `toast_desc` | Hiba történt a törlés során. | **Došlo je do greške** |
| [ErrorControlPanel.tsx:L295](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/management/components/errors/ErrorControlPanel.tsx#L295) | `toast_title` | Nem támogatott | **— (Prevesti na HR)** |
| ... | ... | *(További 246 elem a teljes JSON leltárban)* | ... |


---

## 🏷️ 3. Státusz Badge-ek, Jelvények és Feltételes Állapotok

| Forrás és sorszám | Elem | Megjelenő magyar szöveg | Javasolt horvát (HR) fordítás |
| :--- | :--- | :--- | :--- |
| [NavCredentialsForm.tsx:L673](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/nav/NavCredentialsForm.tsx#L673) | `Badge JSX` | Sikertelen | **Neuspješno** |
| [NavCredentialsForm.tsx:L675](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/nav/NavCredentialsForm.tsx#L675) | `Badge JSX` | Aktív / Sikeres | **— (Prevesti na HR)** |
| [NavCredentialsForm.tsx:L677](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/nav/NavCredentialsForm.tsx#L677) | `Badge JSX` | Nincs adat | **Nema podataka** |
| [EscalationListPage.tsx:L148](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/EscalationListPage.tsx#L148) | `Badge JSX` | Párosítva | **— (Prevesti na HR)** |
| [EscalationListPage.tsx:L149](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/EscalationListPage.tsx#L149) | `Badge JSX` | Páratlan | **— (Prevesti na HR)** |
| [EscalationListPage.tsx:L354](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/EscalationListPage.tsx#L354) | `Badge JSX` | Eszkaláció | **— (Prevesti na HR)** |
| [Integrations.tsx:L306](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/Integrations.tsx#L306) | `Badge JSX` | <Clock className="w-3 h-3 mr-1" />Futó | **— (Prevesti na HR)** |
| [Integrations.tsx:L389](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/Integrations.tsx#L389) | `badgeText property` | M2M Gép-gép | **— (Prevesti na HR)** |
| [Integrations.tsx:L414](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/Integrations.tsx#L414) | `badgeText property` | Alias aktív | **— (Prevesti na HR)** |
| [Integrations.tsx:L423](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/Integrations.tsx#L423) | `badgeText property` | Archívum | **— (Prevesti na HR)** |
| [Integrations.tsx:L437](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/Integrations.tsx#L437) | `badgeText property` | API hozzáférés | **— (Prevesti na HR)** |
| [ShipmentMatchingDashboard.tsx:L383](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/ShipmentMatchingDashboard.tsx#L383) | `Badge JSX` | ✓ Párosított | **— (Prevesti na HR)** |
| [ShipmentMatchingDashboard.tsx:L385](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/ShipmentMatchingDashboard.tsx#L385) | `Badge JSX` | ⚠ Felülvizsgálat | **— (Prevesti na HR)** |
| [ShipmentMatchingDashboard.tsx:L387](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/ShipmentMatchingDashboard.tsx#L387) | `Badge JSX` | ✕ Eszkaláció | **— (Prevesti na HR)** |
| [ShipmentMatchingDashboard.tsx:L389](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/ShipmentMatchingDashboard.tsx#L389) | `Badge JSX` | ○ Várakozó | **— (Prevesti na HR)** |
| [AppSidebar.tsx:L102](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/AppSidebar.tsx#L102) | `ternary condition literal` | Áttekintés | **— (Prevesti na HR)** |
| [AppSidebar.tsx:L105](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/AppSidebar.tsx#L105) | `ternary condition literal` | Irányítópult | **— (Prevesti na HR)** |
| [AppSidebar.tsx:L106](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/AppSidebar.tsx#L106) | `ternary condition literal` | Kategóriák | **— (Prevesti na HR)** |
| [AppSidebar.tsx:L107](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/AppSidebar.tsx#L107) | `ternary condition literal` | Projektek | **— (Prevesti na HR)** |
| [AppSidebar.tsx:L108](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/AppSidebar.tsx#L108) | `ternary condition literal` | Partnertörzs | **— (Prevesti na HR)** |
| [AppSidebar.tsx:L113](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/AppSidebar.tsx#L113) | `ternary condition literal` | Pénzügyek | **— (Prevesti na HR)** |
| [AppSidebar.tsx:L116](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/AppSidebar.tsx#L116) | `ternary condition literal` | Számlák | **Računi** |
| [AppSidebar.tsx:L117](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/AppSidebar.tsx#L117) | `ternary condition literal` | Kintlévőség | **Potraživanja** |
| [AppSidebar.tsx:L118](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/AppSidebar.tsx#L118) | `ternary condition literal` | Tranzakciók | **— (Prevesti na HR)** |
| [AppSidebar.tsx:L119](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/AppSidebar.tsx#L119) | `ternary condition literal` | Házipénztár | **Blagajna** |
| [AppSidebar.tsx:L120](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/AppSidebar.tsx#L120) | `ternary condition literal` | Utalások | **— (Prevesti na HR)** |
| [AppSidebar.tsx:L125](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/AppSidebar.tsx#L125) | `ternary condition literal` | Könyvelés | **— (Prevesti na HR)** |
| [AppSidebar.tsx:L128](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/AppSidebar.tsx#L128) | `ternary condition literal` | Főkönyv | **Glavna knjiga** |
| [AppSidebar.tsx:L129](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/AppSidebar.tsx#L129) | `ternary condition literal` | Folyószámla | **— (Prevesti na HR)** |
| [AppSidebar.tsx:L130](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/AppSidebar.tsx#L130) | `ternary condition literal` | Eredménykimutatás | **Račun dobiti i gubitka** |
| [AppSidebar.tsx:L131](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/AppSidebar.tsx#L131) | `ternary condition literal` | Mérleg | **Bilanca** |
| [AppSidebar.tsx:L132](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/AppSidebar.tsx#L132) | `ternary condition literal` | Beszámoló | **— (Prevesti na HR)** |
| [AppSidebar.tsx:L133](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/AppSidebar.tsx#L133) | `ternary condition literal` | ÁFA Bevallás | **— (Prevesti na HR)** |
| [AppSidebar.tsx:L134](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/AppSidebar.tsx#L134) | `ternary condition literal` | Napló | **Dnevnik** |
| [AppSidebar.tsx:L135](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/AppSidebar.tsx#L135) | `ternary condition literal` | Könyvelési szabályok | **Računovodstvena pravila** |
| [AppSidebar.tsx:L140](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/AppSidebar.tsx#L140) | `ternary condition literal` | HR & Eszközök | **— (Prevesti na HR)** |
| [AppSidebar.tsx:L143](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/AppSidebar.tsx#L143) | `ternary condition literal` | Bérek/járulékok | **— (Prevesti na HR)** |
| [AppSidebar.tsx:L144](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/AppSidebar.tsx#L144) | `ternary condition literal` | Munkaidő | **Radno vrijeme** |
| [AppSidebar.tsx:L150](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/AppSidebar.tsx#L150) | `ternary condition literal` | Szállítmányozás | **— (Prevesti na HR)** |
| [AppSidebar.tsx:L154](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/AppSidebar.tsx#L154) | `ternary condition literal` | Excel Import | **— (Prevesti na HR)** |
| [AppSidebar.tsx:L154](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/AppSidebar.tsx#L154) | `ternary condition literal` | shipment-import | **— (Prevesti na HR)** |
| [AppSidebar.tsx:L155](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/AppSidebar.tsx#L155) | `ternary condition literal` | Eszkaláció | **— (Prevesti na HR)** |
| [AppSidebar.tsx:L163](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/AppSidebar.tsx#L163) | `ternary condition literal` | Integrációk | **— (Prevesti na HR)** |
| [AppSidebar.tsx:L164](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/AppSidebar.tsx#L164) | `ternary condition literal` | Árfolyamok | **— (Prevesti na HR)** |
| [AppSidebar.tsx:L540](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/AppSidebar.tsx#L540) | `ternary condition literal` | Feltöltés | **Učitaj** |
| [AppSidebar.tsx:L577](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/AppSidebar.tsx#L577) | `ternary condition literal` | Tudástár | **— (Prevesti na HR)** |
| [AppSidebar.tsx:L616](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/AppSidebar.tsx#L616) | `ternary condition literal` | Fejlesztői napló | **— (Prevesti na HR)** |
| [AppSidebar.tsx:L930](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/AppSidebar.tsx#L930) | `ternary condition literal` | Felhasználó | **— (Prevesti na HR)** |
| [CategoryCard.tsx:L131](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CategoryCard.tsx#L131) | `ternary condition literal` | Kategória szerkesztése | **— (Prevesti na HR)** |
| [CategoryCard.tsx:L131](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CategoryCard.tsx#L131) | `ternary condition literal` | Új kategória | **— (Prevesti na HR)** |
| [CMREscalationDialog.tsx:L185](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CMREscalationDialog.tsx#L185) | `ternary condition literal` | CMR párosítva! ✅ | **— (Prevesti na HR)** |
| [CMREscalationDialog.tsx:L190](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CMREscalationDialog.tsx#L190) | `ternary condition literal` | Pozíciószám mentve | **— (Prevesti na HR)** |
| [CMREscalationDialog.tsx:L199](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CMREscalationDialog.tsx#L199) | `ternary condition literal` | Hiba a párosítás során | **— (Prevesti na HR)** |
| [CompanySelector.tsx:L72](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CompanySelector.tsx#L72) | `ternary condition literal` | Érvénytelen adószám | **— (Prevesti na HR)** |
| [CompanySelector.tsx:L84](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CompanySelector.tsx#L84) | `ternary condition literal` | Nem sikerült lekérdezni a cégadatokat | **— (Prevesti na HR)** |
| [CompanySelector.tsx:L108](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CompanySelector.tsx#L108) | `ternary condition literal` | Cégadatok sikeresen betöltve a NAV-ból! | **— (Prevesti na HR)** |
| [CompanySelector.tsx:L113](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CompanySelector.tsx#L113) | `ternary condition literal` | Hiba a NAV lekérdezés során | **— (Prevesti na HR)** |
| [CompanySelector.tsx:L161](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CompanySelector.tsx#L161) | `ternary condition literal` | A cég neve kötelező! | **— (Prevesti na HR)** |
| [CompanySelector.tsx:L162](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CompanySelector.tsx#L162) | `ternary condition literal` | Az adószám kötelező! | **— (Prevesti na HR)** |
| [CompanySelector.tsx:L193](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CompanySelector.tsx#L193) | `ternary condition literal` | Cég sikeresen létrehozva! | **— (Prevesti na HR)** |
| [CompanySelector.tsx:L197](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CompanySelector.tsx#L197) | `ternary condition literal` | Hiba történt a cég létrehozása során | **Došlo je do greške** |
| [CompanySelector.tsx:L205](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CompanySelector.tsx#L205) | `ternary condition literal` | A csatlakozási kód kötelező! | **— (Prevesti na HR)** |
| [CompanySelector.tsx:L224](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CompanySelector.tsx#L224) | `ternary condition literal` | Már tagja vagy ennek a cégnek! | **— (Prevesti na HR)** |
| [CompanySelector.tsx:L228](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CompanySelector.tsx#L228) | `ternary condition literal` | Érvénytelen csatlakozási kód! | **— (Prevesti na HR)** |
| [CompanySelector.tsx:L246](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CompanySelector.tsx#L246) | `ternary condition literal` | Sikeresen csatlakoztál a céghez! | **— (Prevesti na HR)** |
| [CompanySelector.tsx:L250](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CompanySelector.tsx#L250) | `ternary condition literal` | Hiba történt a csatlakozás során | **Došlo je do greške** |
| [CompanySelector.tsx:L299](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CompanySelector.tsx#L299) | `ternary condition literal` | Cég sikeresen frissítve! | **— (Prevesti na HR)** |
| [CompanySelector.tsx:L303](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CompanySelector.tsx#L303) | `ternary condition literal` | Hiba történt a cég frissítése során | **Došlo je do greške** |
| [CompanySelector.tsx:L355](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CompanySelector.tsx#L355) | `ternary condition literal` | Cég sikeresen törölve! | **— (Prevesti na HR)** |
| [CompanySelector.tsx:L359](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CompanySelector.tsx#L359) | `ternary condition literal` | Hiba történt a cég törlése során | **Došlo je do greške** |
| [CompanySelector.tsx:L455](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CompanySelector.tsx#L455) | `ternary condition literal` | OIB / Horvát adószám (11 számjegy) | **— (Prevesti na HR)** |
| [CourierReportTab.tsx:L841](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CourierReportTab.tsx#L841) | `ternary condition literal` | Nincs exportálható adat | **— (Prevesti na HR)** |
| [CourierReportTab.tsx:L859](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CourierReportTab.tsx#L859) | `ternary condition literal` | Párosított | **— (Prevesti na HR)** |
| [CourierReportTab.tsx:L860](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CourierReportTab.tsx#L860) | `ternary condition literal` | Tranzakció párosítva | **— (Prevesti na HR)** |
| [CourierReportTab.tsx:L861](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CourierReportTab.tsx#L861) | `ternary condition literal` | NAV számla párosítva | **— (Prevesti na HR)** |
| [CourierReportTab.tsx:L862](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CourierReportTab.tsx#L862) | `ternary condition literal` | Összesítő | **— (Prevesti na HR)** |
| [CourierReportTab.tsx:L863](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CourierReportTab.tsx#L863) | `ternary condition literal` | Párosítatlan | **— (Prevesti na HR)** |
| [CourierReportTab.tsx:L873](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CourierReportTab.tsx#L873) | `ternary condition literal` | Igen | **— (Prevesti na HR)** |
| [CourierReportTab.tsx:L873](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CourierReportTab.tsx#L873) | `ternary condition literal` | Nem | **— (Prevesti na HR)** |
| [CourierReportTab.tsx:L884](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CourierReportTab.tsx#L884) | `ternary condition literal` | Export sikertelen | **— (Prevesti na HR)** |
| [CourierReportTab.tsx:L968](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CourierReportTab.tsx#L968) | `ternary condition literal` | — Összesen: ${formatAmount(stats.total)} | **— (Prevesti na HR)** |
| [CourierReportTab.tsx:L1153](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CourierReportTab.tsx#L1153) | `ternary condition literal` | ${selectedIds.size} sor kijelölve | **— (Prevesti na HR)** |
| [CourierReportTab.tsx:L1296](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CourierReportTab.tsx#L1296) | `ternary condition literal` | keretből: ${formatAmount(row.cod_amount)} | **— (Prevesti na HR)** |
| [CourierReportTab.tsx:L1312](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CourierReportTab.tsx#L1312) | `ternary condition literal` | Beszámítás: ${row.recipient_name} | **— (Prevesti na HR)** |
| [EmailAliasManager.tsx:L82](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/EmailAliasManager.tsx#L82) | `ternary condition literal` | Email alias létrehozva | **— (Prevesti na HR)** |
| [EmailAliasManager.tsx:L83](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/EmailAliasManager.tsx#L83) | `ternary condition literal` | Az email alias sikeresen generálva | **— (Prevesti na HR)** |
| [EmailAliasManager.tsx:L119](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/EmailAliasManager.tsx#L119) | `ternary condition literal` | Hiba | **Greška** |
| [EmailAliasManager.tsx:L134](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/EmailAliasManager.tsx#L134) | `ternary condition literal` | Másolva | **— (Prevesti na HR)** |
| [EmailAliasManager.tsx:L135](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/EmailAliasManager.tsx#L135) | `ternary condition literal` | Az email cím a vágólapra került | **— (Prevesti na HR)** |
| [EmailAliasManager.tsx:L141](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/EmailAliasManager.tsx#L141) | `ternary condition literal` | Másolási hiba | **— (Prevesti na HR)** |
| [EmailAliasManager.tsx:L142](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/EmailAliasManager.tsx#L142) | `ternary condition literal` | Nem sikerült másolni az email címet | **— (Prevesti na HR)** |
| [EmailPreferences.tsx:L63](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/EmailPreferences.tsx#L63) | `ternary condition literal` | Nem sikerült betölteni az email beállításokat | **— (Prevesti na HR)** |
| [EmailPreferences.tsx:L87](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/EmailPreferences.tsx#L87) | `ternary condition literal` | Beállítás frissítve | **— (Prevesti na HR)** |
| [EmailPreferences.tsx:L90](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/EmailPreferences.tsx#L90) | `ternary condition literal` | Nem sikerült frissíteni a beállítást | **— (Prevesti na HR)** |
| [FeedbackFab.tsx:L110](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/FeedbackFab.tsx#L110) | `ternary condition literal` | AI Asszisztens bezárása | **— (Prevesti na HR)** |
| [FeedbackFab.tsx:L110](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/FeedbackFab.tsx#L110) | `ternary condition literal` | AI Asszisztens előhívása | **— (Prevesti na HR)** |
| [FeedbackFab.tsx:L123](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/FeedbackFab.tsx#L123) | `ternary condition literal` | AI bezárása | **— (Prevesti na HR)** |
| [GlobalDatePicker.tsx:L35](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/GlobalDatePicker.tsx#L35) | `ternary condition literal` | Időszak: | **— (Prevesti na HR)** |
| [GlobalDatePicker.tsx:L45](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/GlobalDatePicker.tsx#L45) | `ternary condition literal` | Ez a hónap | **— (Prevesti na HR)** |
| [GlobalDatePicker.tsx:L53](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/GlobalDatePicker.tsx#L53) | `ternary condition literal` | Előző hónap | **— (Prevesti na HR)** |
| [GlobalDatePicker.tsx:L61](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/GlobalDatePicker.tsx#L61) | `ternary condition literal` | Ez az év | **— (Prevesti na HR)** |
| [IconPicker.tsx:L30](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/IconPicker.tsx#L30) | `ternary condition literal` | Pénzügyek | **— (Prevesti na HR)** |
| [IconPicker.tsx:L42](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/IconPicker.tsx#L42) | `ternary condition literal` | Üzlet | **— (Prevesti na HR)** |
| [IconPicker.tsx:L73](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/IconPicker.tsx#L73) | `ternary condition literal` | Szállítás | **— (Prevesti na HR)** |
| [IconPicker.tsx:L95](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/IconPicker.tsx#L95) | `ternary condition literal` | Közüzemi | **— (Prevesti na HR)** |
| [IconPicker.tsx:L102](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/IconPicker.tsx#L102) | `ternary condition literal` | Egyéb | **— (Prevesti na HR)** |
| [IconPicker.tsx:L107](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/IconPicker.tsx#L107) | `ternary condition literal` | Oktatás | **— (Prevesti na HR)** |
| [IconPicker.tsx:L110](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/IconPicker.tsx#L110) | `ternary condition literal` | Egészségügy | **— (Prevesti na HR)** |
| [IconPicker.tsx:L115](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/IconPicker.tsx#L115) | `ternary condition literal` | Karbantartás | **— (Prevesti na HR)** |
| [IconPicker.tsx:L150](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/IconPicker.tsx#L150) | `ternary condition literal` | IT & Technológia | **— (Prevesti na HR)** |
| [IconPicker.tsx:L277](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/IconPicker.tsx#L277) | `ternary condition literal` | Zöld | **— (Prevesti na HR)** |
| [IconPicker.tsx:L278](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/IconPicker.tsx#L278) | `ternary condition literal` | Kék | **— (Prevesti na HR)** |
| [IconPicker.tsx:L279](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/IconPicker.tsx#L279) | `ternary condition literal` | Sárga | **— (Prevesti na HR)** |
| [IconPicker.tsx:L280](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/IconPicker.tsx#L280) | `ternary condition literal` | Cián | **— (Prevesti na HR)** |
| [IconPicker.tsx:L283](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/IconPicker.tsx#L283) | `ternary condition literal` | Rózsaszín | **— (Prevesti na HR)** |
| [IconPicker.tsx:L284](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/IconPicker.tsx#L284) | `ternary condition literal` | Indigó | **— (Prevesti na HR)** |
| [IconPicker.tsx:L285](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/IconPicker.tsx#L285) | `ternary condition literal` | Türkiz | **— (Prevesti na HR)** |
| [IconPicker.tsx:L288](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/IconPicker.tsx#L288) | `ternary condition literal` | Halvány zöld | **— (Prevesti na HR)** |
| [IconPicker.tsx:L289](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/IconPicker.tsx#L289) | `ternary condition literal` | Acélkék | **— (Prevesti na HR)** |
| [IconPicker.tsx:L290](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/IconPicker.tsx#L290) | `ternary condition literal` | Borostyán | **— (Prevesti na HR)** |
| [IconPicker.tsx:L291](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/IconPicker.tsx#L291) | `ternary condition literal` | Halvány cián | **— (Prevesti na HR)** |
| [IconPicker.tsx:L293](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/IconPicker.tsx#L293) | `ternary condition literal` | Bordó | **— (Prevesti na HR)** |
| [IconPicker.tsx:L295](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/IconPicker.tsx#L295) | `ternary condition literal` | Óceán | **— (Prevesti na HR)** |
| [IconPicker.tsx:L297](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/IconPicker.tsx#L297) | `ternary condition literal` | Szürke | **— (Prevesti na HR)** |
| [LanguageSwitcher.tsx:L89](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/LanguageSwitcher.tsx#L89) | `ternary condition literal` | Nyelvválasztó | **— (Prevesti na HR)** |
| [LiveNotificationProvider.tsx:L97](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/LiveNotificationProvider.tsx#L97) | `ternary condition literal` | A következő fájl sikeresen fel lett dolgozva: ${fileName} | **— (Prevesti na HR)** |
| [LiveNotificationProvider.tsx:L145](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/LiveNotificationProvider.tsx#L145) | `ternary condition literal` | ${fileName} sikeresen párosítva egy fuvarhoz. | **— (Prevesti na HR)** |
| [LiveNotificationProvider.tsx:L156](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/LiveNotificationProvider.tsx#L156) | `ternary condition literal` | ${fileName} — vár a megfelelő számlára. | **— (Prevesti na HR)** |
| [LiveNotificationProvider.tsx:L168](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/LiveNotificationProvider.tsx#L168) | `ternary condition literal` | ${fileName} — eltérés, kézi ellenőrzés szükséges. | **— (Prevesti na HR)** |
| [LiveNotificationProvider.tsx:L326](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/LiveNotificationProvider.tsx#L326) | `ternary condition literal` | Dokumentum párosítva! | **— (Prevesti na HR)** |
| [LiveNotificationProvider.tsx:L327](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/LiveNotificationProvider.tsx#L327) | `ternary condition literal` | ${fileName} sikeresen párosítva lett egy fuvarhoz. | **— (Prevesti na HR)** |
| [LiveNotificationProvider.tsx:L465](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/LiveNotificationProvider.tsx#L465) | `ternary condition literal` | Tranzakciók feldolgozva! | **— (Prevesti na HR)** |
| [LiveNotificationProvider.tsx:L573](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/LiveNotificationProvider.tsx#L573) | `ternary condition literal` | A következő riport sikeresen fel lett dolgozva: ${fileName} | **— (Prevesti na HR)** |
| [LiveNotificationProvider.tsx:L636](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/LiveNotificationProvider.tsx#L636) | `ternary condition literal` | CMR fuvarlevél | **— (Prevesti na HR)** |
| [LiveNotificationProvider.tsx:L637](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/LiveNotificationProvider.tsx#L637) | `ternary condition literal` | Megrendelés | **— (Prevesti na HR)** |
| [LiveNotificationProvider.tsx:L646](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/LiveNotificationProvider.tsx#L646) | `ternary condition literal` | ${label} párosítva! | **— (Prevesti na HR)** |
| [LiveNotificationProvider.tsx:L654](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/LiveNotificationProvider.tsx#L654) | `ternary condition literal` | ${label} eszkalálva | **— (Prevesti na HR)** |
| [LiveNotificationProvider.tsx:L664](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/LiveNotificationProvider.tsx#L664) | `ternary condition literal` | ${fileName} rögzítve — vár a megfelelő számlára. | **— (Prevesti na HR)** |
| [LiveNotificationProvider.tsx:L685](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/LiveNotificationProvider.tsx#L685) | `ternary condition literal` | ${label} utólag párosítva! | **— (Prevesti na HR)** |
| [LiveNotificationProvider.tsx:L686](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/LiveNotificationProvider.tsx#L686) | `ternary condition literal` | ${row.file_name} párosítva lett egy fuvarhoz. | **— (Prevesti na HR)** |
| [NylasEmailConnect.tsx:L48](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/NylasEmailConnect.tsx#L48) | `ternary condition literal` | Hiba | **Greška** |
| [NylasEmailConnect.tsx:L49](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/NylasEmailConnect.tsx#L49) | `ternary condition literal` | Nem sikerült betölteni a kapcsolt email fiókokat | **— (Prevesti na HR)** |
| [NylasEmailConnect.tsx:L90](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/NylasEmailConnect.tsx#L90) | `ternary condition literal` | Kapcsolódás sikertelen | **— (Prevesti na HR)** |
| [NylasEmailConnect.tsx:L113](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/NylasEmailConnect.tsx#L113) | `ternary condition literal` | Kapcsolódási hiba | **— (Prevesti na HR)** |
| [NylasEmailConnect.tsx:L143](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/NylasEmailConnect.tsx#L143) | `ternary condition literal` | Lekapcsolási hiba | **— (Prevesti na HR)** |
| [ProductTour.tsx:L66](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ProductTour.tsx#L66) | `ternary condition literal` | Üdvözöljük a eaisyBill-ben! | **— (Prevesti na HR)** |
| [ProductTour.tsx:L76](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ProductTour.tsx#L76) | `ternary condition literal` | Modulváltó | **— (Prevesti na HR)** |
| [ProductTour.tsx:L87](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ProductTour.tsx#L87) | `ternary condition literal` | Cégválasztó | **— (Prevesti na HR)** |
| [ProductTour.tsx:L97](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ProductTour.tsx#L97) | `ternary condition literal` | Irányítópult | **— (Prevesti na HR)** |
| [ProductTour.tsx:L106](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ProductTour.tsx#L106) | `ternary condition literal` | Számlák | **Računi** |
| ... | ... | *(További 1797 elem a teljes JSON leltárban)* | ... |


---

## 🖥️ 4. Felületi Kezelőszervek, Gombok, Fejlécek és Mezők (JSX & Props)

| Forrás és sorszám | Elem | Megjelenő magyar szöveg | Javasolt horvát (HR) fordítás |
| :--- | :--- | :--- | :--- |
| [CategoryCard.tsx:L136](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CategoryCard.tsx#L136) | `JSX node text` | Kategória neve | **— (Prevesti na HR)** |
| [CategoryCard.tsx:L147](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CategoryCard.tsx#L147) | `JSX node text` | Címkék (számla típusok) | **— (Prevesti na HR)** |
| [CMREscalationDialog.tsx:L252](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CMREscalationDialog.tsx#L252) | `JSX node text` | Feladó: | **— (Prevesti na HR)** |
| [CMREscalationDialog.tsx:L254](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CMREscalationDialog.tsx#L254) | `JSX node text` | Tárgy: | **— (Prevesti na HR)** |
| [CompanySelector.tsx:L442](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CompanySelector.tsx#L442) | `JSX node text` | Ország / Joghatóság | **— (Prevesti na HR)** |
| [CompanySelector.tsx:L448](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CompanySelector.tsx#L448) | `JSX node text` | 🇭🇺 Magyarország (NAV Online Számla) | **— (Prevesti na HR)** |
| [CompanySelector.tsx:L449](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CompanySelector.tsx#L449) | `JSX node text` | 🇭🇷 Hrvatska / Horvátország (OIB, PDV) | **— (Prevesti na HR)** |
| [CompanySelector.tsx:L479](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CompanySelector.tsx#L479) | `JSX node text` | NAV lekérdezés | **— (Prevesti na HR)** |
| [ErrorBoundary.tsx:L130](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ErrorBoundary.tsx#L130) | `JSX node text` | Frissítések letöltése... | **— (Prevesti na HR)** |
| [NylasEmailConnect.tsx:L155](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/NylasEmailConnect.tsx#L155) | `JSX node text` | Email kapcsolatok betöltése... | **— (Prevesti na HR)** |
| [NylasEmailConnect.tsx:L176](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/NylasEmailConnect.tsx#L176) | `JSX node text` | Kapcsolt fiókok | **— (Prevesti na HR)** |
| [OfflineBanner.tsx:L29](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/OfflineBanner.tsx#L29) | `JSX node text` | Nincs internetkapcsolat — az alkalmazás offline módban működik | **— (Prevesti na HR)** |
| [SupportModeBanner.tsx:L170](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/SupportModeBanner.tsx#L170) | `JSX node text` | Kilépés a support nézetből... | **— (Prevesti na HR)** |
| [SupportModeBanner.tsx:L171](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/SupportModeBanner.tsx#L171) | `JSX node text` | Ideiglenes hozzáférések eltávolítása | **— (Prevesti na HR)** |
| [SzepCardTab.tsx:L150](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/SzepCardTab.tsx#L150) | `JSX node text` | Összes tranzakció | **— (Prevesti na HR)** |
| [SzepCardTab.tsx:L162](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/SzepCardTab.tsx#L162) | `JSX node text` | Bruttó bevétel | **— (Prevesti na HR)** |
| [SzepCardTab.tsx:L174](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/SzepCardTab.tsx#L174) | `JSX node text` | Jutalék | **— (Prevesti na HR)** |
| [SzepCardTab.tsx:L186](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/SzepCardTab.tsx#L186) | `JSX node text` | Nettó (utalandó) | **— (Prevesti na HR)** |
| [SzepCardTab.tsx:L195](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/SzepCardTab.tsx#L195) | `JSX node text` | SZÉP Kártya tranzakciók | **— (Prevesti na HR)** |
| [SzepCardTab.tsx:L248](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/SzepCardTab.tsx#L248) | `JSX node text` | Minden alszámla | **— (Prevesti na HR)** |
| [SzepCardTab.tsx:L249](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/SzepCardTab.tsx#L249) | `JSX node text` | Szálláshely | **— (Prevesti na HR)** |
| [SzepCardTab.tsx:L250](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/SzepCardTab.tsx#L250) | `JSX node text` | Vendéglátás | **— (Prevesti na HR)** |
| [SzepCardTab.tsx:L251](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/SzepCardTab.tsx#L251) | `JSX node text` | Szabadidő | **— (Prevesti na HR)** |
| [SzepCardTab.tsx:L264](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/SzepCardTab.tsx#L264) | `JSX node text` | Minden bank | **— (Prevesti na HR)** |
| [SzepCardTab.tsx:L316](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/SzepCardTab.tsx#L316) | `JSX node text` | Dátum | **Datum** |
| [SzepCardTab.tsx:L317](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/SzepCardTab.tsx#L317) | `JSX node text` | Kártyatulajdonos | **— (Prevesti na HR)** |
| [SzepCardTab.tsx:L318](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/SzepCardTab.tsx#L318) | `JSX node text` | Alszámla | **— (Prevesti na HR)** |
| [SzepCardTab.tsx:L319](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/SzepCardTab.tsx#L319) | `JSX node text` | Bruttó | **— (Prevesti na HR)** |
| [SzepCardTab.tsx:L321](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/SzepCardTab.tsx#L321) | `JSX node text` | Nettó | **— (Prevesti na HR)** |
| [SzepCardTab.tsx:L322](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/SzepCardTab.tsx#L322) | `JSX node text` | Bank | **— (Prevesti na HR)** |
| [SzepCardTab.tsx:L323](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/SzepCardTab.tsx#L323) | `JSX node text` | Utalás | **— (Prevesti na HR)** |
| [SzepCardTab.tsx:L324](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/SzepCardTab.tsx#L324) | `JSX node text` | Bizonylatszám | **— (Prevesti na HR)** |
| [SzepCardTab.tsx:L340](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/SzepCardTab.tsx#L340) | `JSX node text` | Nincs SZÉP kártya tranzakció | **— (Prevesti na HR)** |
| [SzepCardTab.tsx:L341](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/SzepCardTab.tsx#L341) | `JSX node text` | A megadott feltételekkel nem találhatók tranzakciók. | **Nema podataka** |
| [AiAssistantChat.tsx:L251](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ai/AiAssistantChat.tsx#L251) | `JSX node text` | Beszélgetések | **— (Prevesti na HR)** |
| [AiAssistantChat.tsx:L279](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ai/AiAssistantChat.tsx#L279) | `JSX node text` | Nincs korábbi beszélgetés | **— (Prevesti na HR)** |
| [AiAssistantChat.tsx:L1207](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ai/AiAssistantChat.tsx#L1207) | `JSX node text` | AI Asszisztens · A válaszok tájékoztató jellegűek | **— (Prevesti na HR)** |
| [AiAssistantDrawer.tsx:L51](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ai/AiAssistantDrawer.tsx#L51) | `JSX node text` | applikáció támogatás | **— (Prevesti na HR)** |
| [MessageFeedbackWidget.tsx:L97](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ai/MessageFeedbackWidget.tsx#L97) | `JSX node text` | Hasznosnak jelölve | **— (Prevesti na HR)** |
| [MessageFeedbackWidget.tsx:L118](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ai/MessageFeedbackWidget.tsx#L118) | `JSX node text` | Nem volt hasznos | **— (Prevesti na HR)** |
| [MessageFeedbackWidget.tsx:L212](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ai/MessageFeedbackWidget.tsx#L212) | `JSX node text` | Igen | **— (Prevesti na HR)** |
| [MessageFeedbackWidget.tsx:L225](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ai/MessageFeedbackWidget.tsx#L225) | `JSX node text` | Nem | **— (Prevesti na HR)** |
| [ChangelogTimeline.tsx:L104](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/changelog/ChangelogTimeline.tsx#L104) | `JSX node text` | Nincs találat a megadott szűrésre | **— (Prevesti na HR)** |
| [CondoFundModal.tsx:L81](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/condo/CondoFundModal.tsx#L81) | `JSX node text` | Alap típusa | **— (Prevesti na HR)** |
| [CondoFundModal.tsx:L114](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/condo/CondoFundModal.tsx#L114) | `JSX node text` | Aktuális egyenleg (Ft) | **— (Prevesti na HR)** |
| [CondoFundModal.tsx:L125](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/condo/CondoFundModal.tsx#L125) | `JSX node text` | Cél egyenleg (Ft) | **— (Prevesti na HR)** |
| [CondoFundModal.tsx:L138](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/condo/CondoFundModal.tsx#L138) | `JSX node text` | Havi hozzájárulás / lakás (Ft) | **— (Prevesti na HR)** |
| [CondoFundModal.tsx:L150](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/condo/CondoFundModal.tsx#L150) | `JSX node text` | Leírás | **— (Prevesti na HR)** |
| [CondoMaintenanceModal.tsx:L126](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/condo/CondoMaintenanceModal.tsx#L126) | `JSX node text` | Kategória | **Kategorija** |
| [CondoMaintenanceModal.tsx:L136](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/condo/CondoMaintenanceModal.tsx#L136) | `JSX node text` | Prioritás | **— (Prevesti na HR)** |
| [CondoMaintenanceModal.tsx:L149](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/condo/CondoMaintenanceModal.tsx#L149) | `JSX node text` | Státusz | **— (Prevesti na HR)** |
| [CondoMaintenanceModal.tsx:L159](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/condo/CondoMaintenanceModal.tsx#L159) | `JSX node text` | Finanszírozás | **— (Prevesti na HR)** |
| [CondoMaintenanceModal.tsx:L165](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/condo/CondoMaintenanceModal.tsx#L165) | `JSX node text` | Üzemeltetési alap | **— (Prevesti na HR)** |
| [CondoMaintenanceModal.tsx:L166](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/condo/CondoMaintenanceModal.tsx#L166) | `JSX node text` | Felújítási alap | **— (Prevesti na HR)** |
| [CondoMaintenanceModal.tsx:L167](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/condo/CondoMaintenanceModal.tsx#L167) | `JSX node text` | Tartalék alap | **— (Prevesti na HR)** |
| [CondoMaintenanceModal.tsx:L174](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/condo/CondoMaintenanceModal.tsx#L174) | `JSX node text` | Becsült költség (Ft) | **— (Prevesti na HR)** |
| [CondoMaintenanceModal.tsx:L184](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/condo/CondoMaintenanceModal.tsx#L184) | `JSX node text` | Tényleges költség (Ft) | **— (Prevesti na HR)** |
| [CondoMaintenanceModal.tsx:L196](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/condo/CondoMaintenanceModal.tsx#L196) | `JSX node text` | Kivitelező | **— (Prevesti na HR)** |
| [CondoMaintenanceModal.tsx:L207](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/condo/CondoMaintenanceModal.tsx#L207) | `JSX node text` | Tervezett dátum | **— (Prevesti na HR)** |
| [CondoMaintenanceModal.tsx:L216](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/condo/CondoMaintenanceModal.tsx#L216) | `JSX node text` | Befejezés dátuma | **— (Prevesti na HR)** |
| [CondoMaintenanceModal.tsx:L227](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/condo/CondoMaintenanceModal.tsx#L227) | `JSX node text` | Megjegyzés | **— (Prevesti na HR)** |
| [CondoUnitModal.tsx:L87](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/condo/CondoUnitModal.tsx#L87) | `JSX node text` | Típus | **— (Prevesti na HR)** |
| [CondoUnitModal.tsx:L113](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/condo/CondoUnitModal.tsx#L113) | `JSX node text` | Albetét szám * | **— (Prevesti na HR)** |
| [CondoUnitModal.tsx:L123](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/condo/CondoUnitModal.tsx#L123) | `JSX node text` | Terület (m²) | **— (Prevesti na HR)** |
| [CondoUnitModal.tsx:L149](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/condo/CondoUnitModal.tsx#L149) | `JSX node text` | Elérhetőség | **— (Prevesti na HR)** |
| [CondoUnitModal.tsx:L158](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/condo/CondoUnitModal.tsx#L158) | `JSX node text` | Tulajdoni hányad | **— (Prevesti na HR)** |
| [CondoUnitModal.tsx:L173](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/condo/CondoUnitModal.tsx#L173) | `JSX node text` | Havi közös költség (Ft) * | **— (Prevesti na HR)** |
| [CondoUnitModal.tsx:L186](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/condo/CondoUnitModal.tsx#L186) | `JSX node text` | Megjegyzés | **— (Prevesti na HR)** |
| [ActivityLogFilters.tsx:L167](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/ActivityLogFilters.tsx#L167) | `JSX node text` | Nincs találat | **— (Prevesti na HR)** |
| [ActivityLogFilters.tsx:L385](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/ActivityLogFilters.tsx#L385) | `JSX node text` | Műveletek | **— (Prevesti na HR)** |
| [ActivityLogFilters.tsx:L431](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/ActivityLogFilters.tsx#L431) | `JSX node text` | Időszak | **— (Prevesti na HR)** |
| [ActivityLogFilters.tsx:L456](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/ActivityLogFilters.tsx#L456) | `JSX node text` | Mettől | **— (Prevesti na HR)** |
| [ActivityLogFilters.tsx:L583](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/ActivityLogFilters.tsx#L583) | `JSX node text` | Felhasználók | **— (Prevesti na HR)** |
| [ActivityLogPdfDialog.tsx:L57](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/ActivityLogPdfDialog.tsx#L57) | `JSX node text` | Dokumentum keresése és betöltése... | **— (Prevesti na HR)** |
| [ActivityLogPdfDialog.tsx:L67](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/ActivityLogPdfDialog.tsx#L67) | `JSX node text` | A fájl nem található. | **Nema podataka** |
| [ActivityLogPdfDialog.tsx:L68](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/ActivityLogPdfDialog.tsx#L68) | `JSX node text` | Ez a fájl már nem létezik a rendszerben — valószínűleg törölve lett, vag... | **— (Prevesti na HR)** |
| [ActivityLogPdfDialog.tsx:L72](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/ActivityLogPdfDialog.tsx#L72) | `JSX node text` | A fájl nem PDF formátumú. | **— (Prevesti na HR)** |
| [ActivityLogPdfDialog.tsx:L73](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/ActivityLogPdfDialog.tsx#L73) | `JSX node text` | A fájl neve .pdf-re végződik, de a tartalma nem PDF dokumentum, ezért ne... | **— (Prevesti na HR)** |
| [ActivityLogPdfDialog.tsx:L77](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/ActivityLogPdfDialog.tsx#L77) | `JSX node text` | A fájl jelenleg nem elérhető. | **— (Prevesti na HR)** |
| [ActivityLogPdfDialog.tsx:L78](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/ActivityLogPdfDialog.tsx#L78) | `JSX node text` | A rendszer megtalálta a fájlt, de nem sikerült letölteni. Ellenőrizd az ... | **— (Prevesti na HR)** |
| [ActivityLogPdfDialog.tsx:L82](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/ActivityLogPdfDialog.tsx#L82) | `JSX node text` | A dokumentum nem tölthető be. | **— (Prevesti na HR)** |
| [ActivityLogPdfDialog.tsx:L83](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/ActivityLogPdfDialog.tsx#L83) | `JSX node text` | Ismeretlen hiba történt a fájl betöltése közben. | **Došlo je do greške** |
| [ActivityLogSheet.tsx:L1136](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/ActivityLogSheet.tsx#L1136) | `JSX node text` | Az aktuális cég eseményeinek idővonala. | **— (Prevesti na HR)** |
| [ActivityLogTimelineItem.tsx:L99](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/ActivityLogTimelineItem.tsx#L99) | `JSX node text` | Feladó: | **— (Prevesti na HR)** |
| [ActivityLogTimelineItem.tsx:L108](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/ActivityLogTimelineItem.tsx#L108) | `JSX node text` | (Ismeretlen feladó) | **— (Prevesti na HR)** |
| [ActivityLogTimelineItem.tsx:L113](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/ActivityLogTimelineItem.tsx#L113) | `JSX node text` | Tárgy: | **— (Prevesti na HR)** |
| [ActivityLogTimelineItem.tsx:L121](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/ActivityLogTimelineItem.tsx#L121) | `JSX node text` | Csatolmány: | **— (Prevesti na HR)** |
| [ActivityLogTimelineItem.tsx:L247](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/ActivityLogTimelineItem.tsx#L247) | `JSX node text` | Létrejött számla: | **— (Prevesti na HR)** |
| [ActivityLogTimelineItem.tsx:L273](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/ActivityLogTimelineItem.tsx#L273) | `JSX node text` | Manuális feltöltésből | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L606](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L606) | `JSX node text` | Cég hozzáadása | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L607](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L607) | `JSX node text` | Regisztrálj új céget vagy csatlakozz egy meglévőhöz | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L612](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L612) | `JSX node text` | Új cég regisztrációja | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L613](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L613) | `JSX node text` | Csatlakozás meglévőhöz | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L617](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L617) | `JSX node text` | Ország / Joghatóság | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L623](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L623) | `JSX node text` | 🇭🇺 Magyarország (HU) | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L624](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L624) | `JSX node text` | 🇭🇷 Horvátország (HR) | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L653](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L653) | `JSX node text` | NAV lekérdezés | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L665](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L665) | `JSX node text` | Cég neve * | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L675](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L675) | `JSX node text` | Székhely | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L685](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L685) | `JSX node text` | Elsődleges TEÁOR kód | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L697](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L697) | `JSX node text` | Cég tevékenységének bemutatása (AI alapú kontírozáshoz) | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L721](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L721) | `JSX node text` | Csatlakozási kód | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L753](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L753) | `JSX node text` | Projektek létrehozása (opcionális) | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L766](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L766) | `JSX node text` | Nincs ügyfél | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L801](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L801) | `JSX node text` | Ügyfél neve | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L812](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L812) | `JSX node text` | Leírás | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L821](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L821) | `JSX node text` | Státusz | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L827](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L827) | `JSX node text` | Aktív | **Aktivno** |
| [EmptyStateDashboard.tsx:L829](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L829) | `JSX node text` | Szüneteltetve | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L830](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L830) | `JSX node text` | Törölve | **Obrisano** |
| [EmptyStateDashboard.tsx:L855](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L855) | `JSX node text` | Kategóriák (opcionális) | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L888](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L888) | `JSX node text` | Kategória neve | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L897](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L897) | `JSX node text` | Kulcsszavak (vesszővel elválasztva) | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L929](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L929) | `JSX node text` | NAV Integráció (opcionális) | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L941](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L941) | `JSX node text` | A NAV API sikeresen validálva | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L956](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L956) | `JSX node text` | Csoportos ÁFA-alanyhoz (csoportazonosító számhoz) | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L964](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L964) | `JSX node text` | NAV felhasználónév * | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L974](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L974) | `JSX node text` | Adószám (8 számjegy) * | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L987](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L987) | `JSX node text` | NAV jelszó * | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L1000](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L1000) | `JSX node text` | Aláíró kulcs * | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L1086](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L1086) | `JSX node text` | Üdvözöljük! | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L1097](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L1097) | `JSX node text` | Összes számla | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L1108](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L1108) | `JSX node text` | Kimenő számlaösszeg (nettó) | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L1113](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L1113) | `JSX node text` | Kimenő számlák nettó összege | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L1119](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L1119) | `JSX node text` | Kimenő számlaösszeg (bruttó) | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L1124](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L1124) | `JSX node text` | Kimenő számlák bruttó összege | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L1130](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L1130) | `JSX node text` | Összesített érték | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L1135](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L1135) | `JSX node text` | Minden számla átváltva | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L1141](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L1141) | `JSX node text` | Kifizetendő ÁFA | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L1155](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L1155) | `JSX node text` | ÁFA Elemzés | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L1156](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L1156) | `JSX node text` | Havi ÁFA bontás | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L1167](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L1167) | `JSX node text` | Bevételek és Kiadások | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L1168](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L1168) | `JSX node text` | Éves áttekintés | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L1181](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L1181) | `JSX node text` | Legutóbbi Számlák | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L1182](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L1182) | `JSX node text` | A legfrissebb bejegyzések | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L1186](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L1186) | `JSX node text` | Nincs megjeleníthető adat | **— (Prevesti na HR)** |
| [EmptyStateDashboard.tsx:L1221](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/EmptyStateDashboard.tsx#L1221) | `JSX node text` | Üdvözöljük a eaisybill-ben! | **— (Prevesti na HR)** |
| [FadDashboardCard.tsx:L67](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/FadDashboardCard.tsx#L67) | `JSX node text` | Nettó összeg | **Neto iznos** |
| [UserActivityDialog.tsx:L93](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/UserActivityDialog.tsx#L93) | `JSX node text` | Dátum | **Datum** |
| [UserActivityDialog.tsx:L94](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/UserActivityDialog.tsx#L94) | `JSX node text` | Művelet | **— (Prevesti na HR)** |
| [UserActivityDialog.tsx:L95](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/UserActivityDialog.tsx#L95) | `JSX node text` | Típus | **— (Prevesti na HR)** |
| [UserActivityDialog.tsx:L96](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/UserActivityDialog.tsx#L96) | `JSX node text` | Célpont | **— (Prevesti na HR)** |
| [BillingoIntegrationCard.tsx:L19](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/BillingoIntegrationCard.tsx#L19) | `JSX node text` | Billingo Link Letöltés | **— (Prevesti na HR)** |
| [BillingoIntegrationCard.tsx:L52](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/BillingoIntegrationCard.tsx#L52) | `JSX node text` | Kulcs beállítás: | **— (Prevesti na HR)** |
| [BillingoIntegrationCard.tsx:L65](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/BillingoIntegrationCard.tsx#L65) | `JSX node text` | Támogatott formátum: Billingo e-mail értesítők | **— (Prevesti na HR)** |
| [EmailAccountCard.tsx:L204](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/EmailAccountCard.tsx#L204) | `JSX node text` | Műveletek | **— (Prevesti na HR)** |
| [EmailAccountCard.tsx:L266](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/EmailAccountCard.tsx#L266) | `JSX node text` | Nincs konfigurálva | **— (Prevesti na HR)** |
| [EmailAccountCard.tsx:L378](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/EmailAccountCard.tsx#L378) | `JSX node text` | Mégse | **Odustani** |
| [EmailAccountDialog.tsx:L216](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/EmailAccountDialog.tsx#L216) | `JSX node text` | Fiók elnevezése | **— (Prevesti na HR)** |
| [EmailAccountDialog.tsx:L228](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/EmailAccountDialog.tsx#L228) | `JSX node text` | Fiók aktív | **— (Prevesti na HR)** |
| [EmailAccountDialog.tsx:L233](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/EmailAccountDialog.tsx#L233) | `JSX node text` | Alapértelmezett SMTP | **— (Prevesti na HR)** |
| [EmailAccountDialog.tsx:L238](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/EmailAccountDialog.tsx#L238) | `JSX node text` | Alapértelmezett IMAP | **— (Prevesti na HR)** |
| [EmailAccountDialog.tsx:L292](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/EmailAccountDialog.tsx#L292) | `JSX node text` | Felhasználónév (Email) | **— (Prevesti na HR)** |
| [EmailAccountDialog.tsx:L303](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/EmailAccountDialog.tsx#L303) | `JSX node text` | Jelszó / App Password | **— (Prevesti na HR)** |
| [EmailAccountDialog.tsx:L315](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/EmailAccountDialog.tsx#L315) | `JSX node text` | Titkosítás | **— (Prevesti na HR)** |
| [EmailAccountDialog.tsx:L323](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/EmailAccountDialog.tsx#L323) | `JSX node text` | Nincs | **— (Prevesti na HR)** |
| [EmailSettingsForm.tsx:L86](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/EmailSettingsForm.tsx#L86) | `JSX node text` | Levelező fiókok betöltése... | **— (Prevesti na HR)** |
| [EmailSettingsForm.tsx:L96](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/EmailSettingsForm.tsx#L96) | `JSX node text` | Saját Levelező Fiókok (IMAP / SMTP) | **— (Prevesti na HR)** |
| [EmailSettingsForm.tsx:L122](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/EmailSettingsForm.tsx#L122) | `JSX node text` | Még nincs bekötött saját levelező fiók | **— (Prevesti na HR)** |
| [NavUpoM2mCard.tsx:L575](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/NavUpoM2mCard.tsx#L575) | `JSX node text` | Kliensazonosító megadása | **— (Prevesti na HR)** |
| [NavUpoM2mCard.tsx:L601](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/NavUpoM2mCard.tsx#L601) | `JSX node text` | Kód generálása a NAV-nál | **— (Prevesti na HR)** |
| [NavUpoM2mCard.tsx:L622](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/NavUpoM2mCard.tsx#L622) | `JSX node text` | Aktiválás a Visibillben | **— (Prevesti na HR)** |
| [NavUpoM2mCard.tsx:L667](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/NavUpoM2mCard.tsx#L667) | `JSX node text` | Felhasználónév (10 kar.) | **— (Prevesti na HR)** |
| [NavUpoM2mCard.tsx:L676](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/NavUpoM2mCard.tsx#L676) | `JSX node text` | Felhasználó Jelszó (10 kar.) | **— (Prevesti na HR)** |
| [NavUpoM2mCard.tsx:L686](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/NavUpoM2mCard.tsx#L686) | `JSX node text` | Aláírókulcs 1. fele (10 kar.) | **— (Prevesti na HR)** |
| [NavUpoM2mCard.tsx:L695](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/NavUpoM2mCard.tsx#L695) | `JSX node text` | Nonce kód (10 kar.) | **— (Prevesti na HR)** |
| [NavUpoM2mCard.tsx:L775](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/NavUpoM2mCard.tsx#L775) | `JSX node text` | Aktív (SHA-256) | **— (Prevesti na HR)** |
| [NavUpoM2mCard.tsx:L789](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/NavUpoM2mCard.tsx#L789) | `JSX node text` | Dolgozói jogviszonyok (T1041) | **— (Prevesti na HR)** |
| [NavUpoM2mCard.tsx:L819](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/NavUpoM2mCard.tsx#L819) | `JSX node text` | EFO alkalmi munkavállalók | **— (Prevesti na HR)** |
| [NavUpoM2mCard.tsx:L849](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/NavUpoM2mCard.tsx#L849) | `JSX node text` | Kapcsolat Ellenőrzése | **— (Prevesti na HR)** |
| [NavUpoM2mCard.tsx:L941](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/NavUpoM2mCard.tsx#L941) | `JSX node text` | Felhasznált: | **— (Prevesti na HR)** |
| [NavUpoM2mCard.tsx:L984](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/NavUpoM2mCard.tsx#L984) | `JSX node text` | Automatizációs Szabályok | **— (Prevesti na HR)** |
| [NavUpoM2mCard.tsx:L988](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/NavUpoM2mCard.tsx#L988) | `JSX node text` | Napi EFO automatikus szinkron | **— (Prevesti na HR)** |
| [NavUpoM2mCard.tsx:L989](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/NavUpoM2mCard.tsx#L989) | `JSX node text` | Minden éjfélkor automatikusan frissíti az alkalmi munka napokat | **— (Prevesti na HR)** |
| [NavUpoM2mCard.tsx:L1000](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/NavUpoM2mCard.tsx#L1000) | `JSX node text` | Dolgozói jogviszony ellenőrzés | **— (Prevesti na HR)** |
| [NavUpoM2mCard.tsx:L1001](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/NavUpoM2mCard.tsx#L1001) | `JSX node text` | Heti rendszerességgel ellenőrzi az új T1041 bejelentéseket | **— (Prevesti na HR)** |
| [NavUpoM2mCard.tsx:L1042](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/NavUpoM2mCard.tsx#L1042) | `JSX node text` | Mégse | **Odustani** |
| [NavUpoM2mCard.tsx:L1102](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/NavUpoM2mCard.tsx#L1102) | `JSX node text` | Munkavállaló Neve | **— (Prevesti na HR)** |
| [NavUpoM2mCard.tsx:L1103](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/NavUpoM2mCard.tsx#L1103) | `JSX node text` | Adóazonosító | **— (Prevesti na HR)** |
| [NavUpoM2mCard.tsx:L1104](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/integrations/NavUpoM2mCard.tsx#L1104) | `JSX node text` | TAJ szám | **— (Prevesti na HR)** |
| ... | ... | *(További 1039 elem a teljes JSON leltárban)* | ... |


---

## 🔑 5. Hiányzó vagy Nem Szinkronizált i18n Szótárkulcsok

| Forrás és sorszám | Elem | Megjelenő magyar szöveg | Javasolt horvát (HR) fordítás |
| :--- | :--- | :--- | :--- |
| [CourierReportTab.tsx:L1005](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CourierReportTab.tsx#L1005) | `t('common:export') missing in hr/common.json` | Exportálás | **— (Prevesti na HR)** |
| [CourierReportTab.tsx:L1012](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CourierReportTab.tsx#L1012) | `t('transactions:export.excel') missing in hr/transactions.json` | Excel export (.xlsx) | **— (Prevesti na HR)** |
| [CourierReportTab.tsx:L1016](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CourierReportTab.tsx#L1016) | `t('transactions:export.csv') missing in hr/transactions.json` | CSV export (.csv) | **— (Prevesti na HR)** |
| [CourierReportTab.tsx:L1172](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CourierReportTab.tsx#L1172) | `t('common:export') missing in hr/common.json` | Kijelöltek exportálása | **— (Prevesti na HR)** |
| [ReportFilesDialog.tsx:L110](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/courier/ReportFilesDialog.tsx#L110) | `t('common:errors.unknown') missing in hr/common.json` | Ismeretlen hiba történt. | **Došlo je do greške** |
| [DashboardMetrics.tsx:L146](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/DashboardMetrics.tsx#L146) | `t('dashboard:kpis.consolidated') missing in hr/dashboard.json` | dashboard:kpis.consolidated | **— (Prevesti na HR)** |
| [DashboardMetrics.tsx:L196](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/DashboardMetrics.tsx#L196) | `t('common:status.invoices_uploaded') missing in hr/common.json` | Bizonylat összesen | **— (Prevesti na HR)** |
| [DashboardMetrics.tsx:L225](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/DashboardMetrics.tsx#L225) | `t('common:status.payable') missing in hr/common.json` | Fizetendő | **Za plaćanje** |
| [DashboardMetrics.tsx:L225](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/DashboardMetrics.tsx#L225) | `t('common:status.claimable') missing in hr/common.json` | Visszaigényelhető | **— (Prevesti na HR)** |
| [DashboardMetrics.tsx:L238](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/DashboardMetrics.tsx#L238) | `t('dashboard:kpis.cash_negative') missing in hr/dashboard.json` | Negatív | **— (Prevesti na HR)** |
| [DashboardMetrics.tsx:L240](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/DashboardMetrics.tsx#L240) | `t('dashboard:kpis.cash_ok') missing in hr/dashboard.json` | Rendben | **— (Prevesti na HR)** |
| [FxDifferencesSection.tsx:L380](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/FxDifferencesSection.tsx#L380) | `t('dashboard:fx_differences.monthly_trend') missing in hr/dashboard.json` | Havi nettó árfolyam-eredmény | **— (Prevesti na HR)** |
| [FxDifferencesSection.tsx:L420](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/FxDifferencesSection.tsx#L420) | `t('common:no_data') missing in hr/common.json` | Nincs adat | **Nema podataka** |
| [FxDifferencesSection.tsx:L440](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/FxDifferencesSection.tsx#L440) | `t('common:buttons.edit') missing in hr/common.json` | Szerkesztés | **Uredi** |
| [FxDifferencesSection.tsx:L506](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/FxDifferencesSection.tsx#L506) | `t('common:buttons.cancel') missing in hr/common.json` | Mégse | **Odustani** |
| [FxDifferencesSection.tsx:L510](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/FxDifferencesSection.tsx#L510) | `t('common:buttons.save') missing in hr/common.json` | Mentés | **Spremi** |
| [FxDifferencesSection.tsx:L543](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/FxDifferencesSection.tsx#L543) | `t('common:all') missing in hr/common.json` | Mind | **— (Prevesti na HR)** |
| [FxDifferencesSection.tsx:L566](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/FxDifferencesSection.tsx#L566) | `t('dashboard:fx_differences.search_placeholder') missing in hr/dashboard.json` | Keresés... | **Pretraži...** |
| [FxDifferencesSection.tsx:L585](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/FxDifferencesSection.tsx#L585) | `t('dashboard:fx_differences.no_matching_items') missing in hr/dashboard.json` | Nincs a feltételeknek megfelelő árfolyam-tétel. | **— (Prevesti na HR)** |
| [MetricCard.tsx:L139](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/MetricCard.tsx#L139) | `t('kpis.currencies_count') missing in hr/dashboard.json` | kpis.currencies_count | **— (Prevesti na HR)** |
| [UnifiedFinancialCockpit.tsx:L1111](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/UnifiedFinancialCockpit.tsx#L1111) | `t('dashboard:unmatched_items.items') missing in hr/dashboard.json` | tétel | **— (Prevesti na HR)** |
| [UnifiedFinancialCockpit.tsx:L1198](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/UnifiedFinancialCockpit.tsx#L1198) | `t('common:no_results') missing in hr/common.json` | Nincs találat a keresésre. | **— (Prevesti na HR)** |
| [UnifiedFinancialCockpit.tsx:L1209](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/UnifiedFinancialCockpit.tsx#L1209) | `t('common:try_different_search') missing in hr/common.json` | Próbálkozz más kifejezéssel vagy töröld a keresést. | **— (Prevesti na HR)** |
| [UnifiedFinancialCockpit.tsx:L1401](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/UnifiedFinancialCockpit.tsx#L1401) | `t('common:loading') missing in hr/common.json` | Betöltés... | **— (Prevesti na HR)** |
| [UnmatchedItemsModal.tsx:L253](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/UnmatchedItemsModal.tsx#L253) | `t('dashboard:unmatched_items.items') missing in hr/dashboard.json` | db számla | **— (Prevesti na HR)** |
| [UnmatchedItemsModal.tsx:L267](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/UnmatchedItemsModal.tsx#L267) | `t('dashboard:unmatched_items.items') missing in hr/dashboard.json` | db tranzakció | **— (Prevesti na HR)** |
| [NavCredentialsForm.tsx:L759](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/nav/NavCredentialsForm.tsx#L759) | `t('settings:integrations.nav.group_vat_warning_title') missing in hr/settings.json` | Csoportos ÁFA-alanyiság észlelve | **— (Prevesti na HR)** |
| [NavCredentialsForm.tsx:L926](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/nav/NavCredentialsForm.tsx#L926) | `t('settings:integrations.nav.group_vat_form_title') missing in hr/settings.json` | Fontos tudnivaló csoportos ÁFA-tagoknak | **— (Prevesti na HR)** |
| [BusinessSection.tsx:L211](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/BusinessSection.tsx#L211) | `t('business.country') missing in hr/settings.json` | Ország / Joghatóság | **— (Prevesti na HR)** |
| [BusinessSection.tsx:L373](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/settings/BusinessSection.tsx#L373) | `t('common:loading') missing in hr/common.json` | Betöltés... | **— (Prevesti na HR)** |
| [useAutoCategorizeJob.ts:L127](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useAutoCategorizeJob.ts#L127) | `t('common:error_occurred') missing in hr/common.json` | Váratlan hiba történt. | **Došlo je do greške** |
| [useSzamlazzSync.ts:L154](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useSzamlazzSync.ts#L154) | `t('common:error') missing in hr/common.json` | Hiba történt | **Došlo je do greške** |
| [GeneralLedgerPage.tsx:L451](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/GeneralLedgerPage.tsx#L451) | `t('common:status.ready') missing in hr/common.json` | Kész! | **— (Prevesti na HR)** |
| [GeneralLedgerPage.tsx:L665](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/GeneralLedgerPage.tsx#L665) | `t('accounting:general_ledger.ai_progress.title') missing in hr/accounting.json` | AI Tételbesorolás folyamatban | **— (Prevesti na HR)** |
| [GeneralLedgerPage.tsx:L674](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/GeneralLedgerPage.tsx#L674) | `t('accounting:general_ledger.ai_progress.status_with_count') missing in hr/accounting.json` | accounting:general_ledger.ai_progress.status_with_count | **— (Prevesti na HR)** |
| [GeneralLedgerPage.tsx:L679](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/GeneralLedgerPage.tsx#L679) | `t('accounting:general_ledger.ai_progress.status_starting') missing in hr/accounting.json` | Kontextus gyűjtése és tételek előkészítése a mesterséges intelligenciána... | **— (Prevesti na HR)** |
| [GeneralLedgerPage.tsx:L685](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/GeneralLedgerPage.tsx#L685) | `t('common:status.starting') missing in hr/common.json` | Indítás... | **— (Prevesti na HR)** |
| [Onboarding.tsx:L660](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/Onboarding.tsx#L660) | `t('common:error') missing in hr/common.json` | Hiba | **Greška** |
| [Onboarding.tsx:L1031](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/Onboarding.tsx#L1031) | `t('common:export_error') missing in hr/common.json` | Exportálási hiba | **— (Prevesti na HR)** |
| [Onboarding.tsx:L1032](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/Onboarding.tsx#L1032) | `t('common:error_occurred') missing in hr/common.json` | Hiba történt az exportálás során. | **Došlo je do greške** |
| [Onboarding.tsx:L1080](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/Onboarding.tsx#L1080) | `t('common:no_permission') missing in hr/common.json` | Nincs írási jogosultságod | **— (Prevesti na HR)** |
| [Projects.tsx:L787](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/Projects.tsx#L787) | `t('common:no_permission') missing in hr/common.json` | Nincs írási jogosultságod | **— (Prevesti na HR)** |
| [Projects.tsx:L1160](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/Projects.tsx#L1160) | `t('invoices:columns.supplier') missing in hr/invoices.json` | Szállító | **Dobavljač** |
| [Projects.tsx:L1161](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/Projects.tsx#L1161) | `t('invoices:columns.customer') missing in hr/invoices.json` | Ügyfél | **— (Prevesti na HR)** |


---

## 🚀 6. Moduláris Javítási Javaslat

1. A modulban szereplő hardkódolt feliratokat ki kell szervezni a `src/locales/hu/settings.json` és `src/locales/hr/settings.json` fájlokba.
2. A `toast({{ title: '...', description: '...' }})` hívásoknál kötelező bevezetni a `t('{ns}:toasts.title')` és `t('{ns}:toasts.desc')` formátumot.
3. A táblázatokban és badge-ekben szereplő hardkódolt magyar string literálokat (`'Fizetve'`, `'Függőben'`) fel kell váltani a központi állapotfordító segédfüggvénnyel vagy szótári kulccsal.
