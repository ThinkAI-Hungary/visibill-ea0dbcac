# 01. Számlák és Bizonylatkezelés — HR Lokalizációs Leltár

**Modul hatóköre:** Számlalista (bejövő, kimenő, beküldött, díjbekérők), számla részletező panel, számlasor kontírozás, manuális számlarögzítés, Minimax és Számlázz.hu szinkron, duplikáció ellenőrzés és csoportos műveletek.  
**Összes érintett fájl:** 53 db  
**Összes feltárt hiányosság:** 829 db  
**Elsődleges i18n névtér:** `invoices` (továbbá `common`)

---

## 📈 1. Modul Statisztika és Hotspotok

### Kategóriák szerinti megoszlás
| Elem típusa | Előfordulás | Súlyosság / Hatás |
| :--- | :---: | :--- |
| **Értesítési ablakok (Toast)** | 93 db | Magas (P1) — Művelet-visszajelzés a felhasználónak |
| **Modálok és megerősítések (Dialog)** | 1 db | Kritikus (P0/P1) — Űrlapok és felugró ablakok |
| **Státusz jelvények (Badge)** | 0 db | Magas (P1) — Bizonylat- és tranzakció állapotok |
| **Feltételes állapotok (Ternary)** | 463 db | Magas (P1) — Táblázatcellákban megjelenő státuszok |
| **Táblázat oszlopok és menüpontok** | 56 db | Közepes (P2) — Adatstruktúra fejlécek és legördülők |
| **Űrlap súgók és helykitöltők (Props)** | 33 db | Közepes (P2) — `placeholder`, `title`, `tooltip` |
| **Közvetlen felületi szövegek (JSX)** | 143 db | Kritikus (P0) — Gombok, címkék, kártya tartalom |
| **Hiányzó szótárkulcsok (Missing HR key)** | 40 db | Magas (P1) — `t(...)` hívás ami nincs a horvát JSON-ban |


### Legtöbb lokalizációs hiányosságot tartalmazó komponensek:
- [ManualInvoiceCreateDialog.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx): ~~**67 db** lefordítandó elem~~ ✅ **MEGOLDVA** (67/67 elem lefordítva: `invoices:manual_create.*`, teljes HU és HR szótárfedettség)
- [InvoiceFilterBar.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/filters/InvoiceFilterBar.tsx): **59 db** lefordítandó elem
- [InvoiceItemsDialog.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx): **55 db** lefordítandó elem
- [InvoiceGlAccountSelector.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceGlAccountSelector.tsx): **51 db** lefordítandó elem
- [InvoiceItemRulesManager.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx): **50 db** lefordítandó elem
- [useInvoiceMutations.ts](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useInvoiceMutations.ts): **44 db** lefordítandó elem
- [channelConfigs.ts](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/upload/config/channelConfigs.ts): **43 db** lefordítandó elem
- [InvoiceVatCodeSelector.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/InvoiceVatCodeSelector.tsx): **40 db** lefordítandó elem

---

## 🔔 2. Értesítési Ablakok (Toasts) és Modális Megerősítések

| Forrás és sorszám | Elem | Megjelenő magyar szöveg | Javasolt horvát (HR) fordítás |
| :--- | :--- | :--- | :--- |
| [InvoiceFullEditDialog.tsx:L418](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceFullEditDialog.tsx#L418) | `toast_title` | Számla törölve | **— (Prevesti na HR)** |
| [InvoiceFullEditDialog.tsx:L418](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceFullEditDialog.tsx#L418) | `toast_desc` | A számla sora törölve lett. Az eredetileg feltöltött dokumentum megmarad... | **— (Prevesti na HR)** |
| [InvoiceFullEditDialog.tsx:L434](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceFullEditDialog.tsx#L434) | `toast_title` | Hiba | **Greška** |
| [InvoiceFullEditDialog.tsx:L528](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceFullEditDialog.tsx#L528) | `toast_title` | Sikeres törlés | **— (Prevesti na HR)** |
| [InvoiceFullEditDialog.tsx:L528](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceFullEditDialog.tsx#L528) | `toast_desc` | A számla és a hozzá tartozó feltöltött fájl véglegesen törölve lett a re... | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L733](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L733) | `toast_title` | VTSZ és súly mentve | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L733](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L733) | `toast_desc` | A tétel VTSZ száma és nettó tömege sikeresen mentésre került. | **Uspješno spremljeno** |
| [InvoiceItemsDialog.tsx:L738](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L738) | `toast_title` | Mentési hiba | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L1171](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L1171) | `toast_title` | Áfakód módosítási hiba | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L1186](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L1186) | `toast_title` | Áfakód sikeresen elmentve | **— (Prevesti na HR)** |
| [SupplierInvoiceAssignment.tsx:L106](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/SupplierInvoiceAssignment.tsx#L106) | `toast_title` | Hiba | **Greška** |
| [SupplierInvoiceAssignment.tsx:L106](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/SupplierInvoiceAssignment.tsx#L106) | `toast_desc` | Nem sikerült betölteni a számlákat. | **— (Prevesti na HR)** |
| [SupplierInvoiceAssignment.tsx:L130](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/SupplierInvoiceAssignment.tsx#L130) | `toast_title` | Hozzárendelés sikertelen | **— (Prevesti na HR)** |
| [SupplierInvoiceAssignment.tsx:L145](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/SupplierInvoiceAssignment.tsx#L145) | `toast_title` | Számla hozzárendelve | **— (Prevesti na HR)** |
| [SupplierInvoiceAssignment.tsx:L145](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/SupplierInvoiceAssignment.tsx#L145) | `toast_desc` | A számla sikeresen hozzárendelve a projekthez. | **— (Prevesti na HR)** |
| [SupplierInvoiceAssignment.tsx:L179](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/SupplierInvoiceAssignment.tsx#L179) | `toast_title` | Hozzárendelés törölve | **— (Prevesti na HR)** |
| [SupplierInvoiceAssignment.tsx:L179](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/SupplierInvoiceAssignment.tsx#L179) | `toast_desc` | A számla már nem tartozik ehhez a projekthez. | **— (Prevesti na HR)** |
| [InvoiceGlAccountSelector.tsx:L164](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceGlAccountSelector.tsx#L164) | `toast_title` | Kontírszám frissítve | **— (Prevesti na HR)** |
| [InvoiceGlAccountSelector.tsx:L164](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceGlAccountSelector.tsx#L164) | `toast_desc` | A kontírozási beállítás sikeresen elmentve. | **— (Prevesti na HR)** |
| [InvoiceGlAccountSelector.tsx:L178](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceGlAccountSelector.tsx#L178) | `toast_title` | Hiba a kontírszám mentésekor | **— (Prevesti na HR)** |
| [InvoiceItemAccrualModal.tsx:L186](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemAccrualModal.tsx#L186) | `toast_title` | Hiányzó elhatárolási főkönyvi szám | **— (Prevesti na HR)** |
| [InvoiceItemAccrualModal.tsx:L186](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemAccrualModal.tsx#L186) | `toast_desc` | Kérlek válassz ki egy elhatárolási számlát (pl. 392). | **— (Prevesti na HR)** |
| [InvoiceItemAccrualModal.tsx:L195](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemAccrualModal.tsx#L195) | `toast_title` | Hiányzó tétel kontírozás | **— (Prevesti na HR)** |
| [InvoiceItemAccrualModal.tsx:L195](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemAccrualModal.tsx#L195) | `toast_desc` | A számlatételt először le kell kontírozni (főkönyvi számlaszám hozzárend... | **— (Prevesti na HR)** |
| [InvoiceItemAccrualModal.tsx:L231](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemAccrualModal.tsx#L231) | `toast_title` | Időbeli elhatárolás sikeresen lekönyvelve | **— (Prevesti na HR)** |
| [InvoiceItemAccrualModal.tsx:L246](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemAccrualModal.tsx#L246) | `toast_title` | Hiba az elhatárolás mentésekor | **— (Prevesti na HR)** |
| [InvoiceItemAccrualModal.tsx:L262](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemAccrualModal.tsx#L262) | `toast_title` | Időbeli elhatárolás törölve | **— (Prevesti na HR)** |
| [InvoiceItemAccrualModal.tsx:L262](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemAccrualModal.tsx#L262) | `toast_desc` | A kapcsolódó vegyes napló tétel és nyilvántartási bejegyzés sikeresen tö... | **— (Prevesti na HR)** |
| [InvoiceItemAccrualModal.tsx:L273](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemAccrualModal.tsx#L273) | `toast_title` | Hiba a törlés során | **— (Prevesti na HR)** |
| [InvoiceItemRulesManager.tsx:L175](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L175) | `toast_title` | Hiba a státusz módosításakor | **— (Prevesti na HR)** |
| [InvoiceItemRulesManager.tsx:L187](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L187) | `toast_title` | Szabály törölve | **— (Prevesti na HR)** |
| [InvoiceItemRulesManager.tsx:L190](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L190) | `toast_title` | Hiba a törléskor | **— (Prevesti na HR)** |
| [InvoiceItemRulesManager.tsx:L227](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L227) | `toast_title` | Szabály sikeresen frissítve | **— (Prevesti na HR)** |
| [InvoiceItemRulesManager.tsx:L233](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L233) | `toast_title` | Új szabály létrehozva | **— (Prevesti na HR)** |
| [InvoiceItemRulesManager.tsx:L239](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L239) | `toast_title` | Mentési hiba | **— (Prevesti na HR)** |
| [InvoiceItemRulesManager.tsx:L259](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L259) | `toast_title` | Szabályok alkalmazása befejeződött | **— (Prevesti na HR)** |
| [InvoiceItemRulesManager.tsx:L272](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L272) | `toast_title` | Hiba a szabályok futtatásakor | **— (Prevesti na HR)** |
| [InvoiceRuleQuickSaveDialog.tsx:L105](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceRuleQuickSaveDialog.tsx#L105) | `toast_title` | Tétel besorolása frissítve | **— (Prevesti na HR)** |
| [InvoiceRuleQuickSaveDialog.tsx:L170](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceRuleQuickSaveDialog.tsx#L170) | `toast_title` | Szabály elmentve és tétel besorolva | **— (Prevesti na HR)** |
| [InvoiceRuleQuickSaveDialog.tsx:L188](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceRuleQuickSaveDialog.tsx#L188) | `toast_title` | Szabály mentési hiba | **— (Prevesti na HR)** |
| [ManualInvoiceCreateDialog.tsx:L161](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L161) | `toast_title` | NAV számla adatai betöltve | ✅ **Podaci NAV računa učitani** |
| [ManualInvoiceCreateDialog.tsx:L254](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L254) | `toast_title` | Összegek újraszámolva | ✅ **Iznosi ponovno izračunati** |
| [ManualInvoiceCreateDialog.tsx:L254](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L254) | `toast_desc` | A fejléc összegek frissültek a számlatételek alapján. | ✅ **Iznosi zaglavlja ažurirani su na temelju stavki računa.** |
| [ManualInvoiceCreateDialog.tsx:L263](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L263) | `toast_title` | Hiba | ✅ **Greška** |
| [ManualInvoiceCreateDialog.tsx:L263](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L263) | `toast_desc` | Nincs aktív cég azonosító. | ✅ **Nema aktivnog identifikatora tvrtke.** |
| [ManualInvoiceCreateDialog.tsx:L269](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L269) | `toast_title` | Hiányzó adat | ✅ **Nedostaju podaci** |
| [ManualInvoiceCreateDialog.tsx:L269](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L269) | `toast_desc` | A bizonylatsorszám megadása kötelező. | ✅ **Broj računa je obavezan.** |
| [ManualInvoiceCreateDialog.tsx:L275](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L275) | `toast_title` | Hiányzó partnernév | ✅ **Nedostaje naziv partnera** |
| [ManualInvoiceCreateDialog.tsx:L366](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L366) | `toast_title` | Már létező bizonylatsorszám | ✅ **Broj računa već postoji** |
| [ManualInvoiceCreateDialog.tsx:L366](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L366) | `toast_desc` | Ezzel a bizonylatsorszámmal már létezik számla a cégnél. | ✅ **Račun s ovim brojem već postoji za ovu tvrtku.** |
| [ManualInvoiceCreateDialog.tsx:L449](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L449) | `toast_title` | Számla sikeresen rögzítve | ✅ **Račun uspješno spremljen** |
| [ManualInvoiceCreateDialog.tsx:L464](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L464) | `toast_title` | Mentési hiba | ✅ **Greška pri spremanju** |
| [InvoiceVatCodeSelector.tsx:L248](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/vat/InvoiceVatCodeSelector.tsx#L248) | `toast_title` | Hiba a mentés során | **— (Prevesti na HR)** |
| [ExpandedInvoiceRow.tsx:L156](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/expanded-row/ExpandedInvoiceRow.tsx#L156) | `toast_title` | Párosítás megszüntetve! | **— (Prevesti na HR)** |
| [ExpandedInvoiceRow.tsx:L166](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/expanded-row/ExpandedInvoiceRow.tsx#L166) | `toast_title` | Hiba a párosítás megszüntetésekor | **— (Prevesti na HR)** |
| [InvoiceNotesSection.tsx:L143](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/expanded-row/InvoiceNotesSection.tsx#L143) | `toast_title` | Sikeres mentés | **Uspješno spremljeno** |
| [InvoiceNotesSection.tsx:L143](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/expanded-row/InvoiceNotesSection.tsx#L143) | `toast_desc` | Új jegyzet sikeresen rögzítve. | **— (Prevesti na HR)** |
| [InvoiceNotesSection.tsx:L155](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/expanded-row/InvoiceNotesSection.tsx#L155) | `toast_title` | Hiba | **Greška** |
| [InvoiceTableContainer.tsx:L287](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/table/InvoiceTableContainer.tsx#L287) | `toast_title` | Hiba történt a könyvelési státusz módosításakor | **Došlo je do greške** |
| [useDocumentUpload.ts:L63](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/upload/hooks/useDocumentUpload.ts#L63) | `toast_title` | Érvénytelen fájltípus | **— (Prevesti na HR)** |
| [useDocumentUpload.ts:L128](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/upload/hooks/useDocumentUpload.ts#L128) | `toast_title` | Nincs feltöltendő fájl | **— (Prevesti na HR)** |
| [useDocumentUpload.ts:L128](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/upload/hooks/useDocumentUpload.ts#L128) | `toast_desc` | Minden fájl ki lett hagyva. | **— (Prevesti na HR)** |
| [useDocumentUpload.ts:L139](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/upload/hooks/useDocumentUpload.ts#L139) | `toast_title` | Feldolgozás... | **— (Prevesti na HR)** |
| [useDocumentUpload.ts:L171](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/upload/hooks/useDocumentUpload.ts#L171) | `toast_title` | Sikeres feltöltés | **— (Prevesti na HR)** |
| [useDocumentUpload.ts:L177](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/upload/hooks/useDocumentUpload.ts#L177) | `toast_title` | Feltöltési hiba | **— (Prevesti na HR)** |
| [useDocumentUpload.ts:L193](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/upload/hooks/useDocumentUpload.ts#L193) | `toast_title` | Nincs kiválasztott fájl | **— (Prevesti na HR)** |
| [useDocumentUpload.ts:L193](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/upload/hooks/useDocumentUpload.ts#L193) | `toast_desc` | Kérlek válassz ki legalább egy fájlt a feltöltéshez. | **— (Prevesti na HR)** |
| [useDocumentUpload.ts:L202](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/upload/hooks/useDocumentUpload.ts#L202) | `toast_title` | Nem vagy bejelentkezve | **— (Prevesti na HR)** |
| [useDocumentUpload.ts:L202](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/upload/hooks/useDocumentUpload.ts#L202) | `toast_desc` | A feltöltéshez be kell jelentkezned. | **— (Prevesti na HR)** |
| [useDocumentUpload.ts:L211](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/upload/hooks/useDocumentUpload.ts#L211) | `toast_title` | Nincs kiválasztott cég | **— (Prevesti na HR)** |
| [useDocumentUpload.ts:L211](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/upload/hooks/useDocumentUpload.ts#L211) | `toast_desc` | A feltöltéshez válassz ki egy céget. | **— (Prevesti na HR)** |
| [useDocumentUpload.ts:L224](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/upload/hooks/useDocumentUpload.ts#L224) | `toast_title` | Már feltöltött fájlok észlelve | **Učitane datoteke** |
| [useInvoiceMutations.ts:L132](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useInvoiceMutations.ts#L132) | `toast_title` | Nincs kiválasztott cég | **— (Prevesti na HR)** |
| [useInvoiceMutations.ts:L145](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useInvoiceMutations.ts#L145) | `toast_title` | Nincs érvényes munkamenet | **— (Prevesti na HR)** |
| [useInvoiceMutations.ts:L260](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useInvoiceMutations.ts#L260) | `toast_title` | Szinkronizálás részben sikeres | **— (Prevesti na HR)** |
| [useInvoiceMutations.ts:L266](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useInvoiceMutations.ts#L266) | `toast_title` | Sikeres szinkronizálás! | **— (Prevesti na HR)** |
| [useInvoiceMutations.ts:L316](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useInvoiceMutations.ts#L316) | `toast_title` | Projekt hozzárendelve | **— (Prevesti na HR)** |
| [useInvoiceMutations.ts:L319](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useInvoiceMutations.ts#L319) | `toast_title` | Hiba a projekt hozzárendelésekor | **— (Prevesti na HR)** |
| [useInvoiceMutations.ts:L334](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useInvoiceMutations.ts#L334) | `toast_title` | Kategória hozzárendelve | **— (Prevesti na HR)** |
| [useInvoiceMutations.ts:L337](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useInvoiceMutations.ts#L337) | `toast_title` | Hiba a kategória hozzárendelésekor | **— (Prevesti na HR)** |
| [useInvoiceMutations.ts:L353](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useInvoiceMutations.ts#L353) | `toast_title` | Hiba a státusz frissítésekor | **— (Prevesti na HR)** |
| [useInvoiceMutations.ts:L425](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useInvoiceMutations.ts#L425) | `toast_title` | Nincs kijelölt számla | **— (Prevesti na HR)** |
| [useInvoiceMutations.ts:L459](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useInvoiceMutations.ts#L459) | `toast_title` | Hiba a csoportos kategória hozzárendelésnél | **— (Prevesti na HR)** |
| [useInvoiceMutations.ts:L499](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useInvoiceMutations.ts#L499) | `toast_title` | Hiba a csoportos projekt hozzárendelésnél | **— (Prevesti na HR)** |
| [useInvoiceMutations.ts:L588](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useInvoiceMutations.ts#L588) | `toast_title` | Sikeres törlés | **— (Prevesti na HR)** |
| [useInvoiceMutations.ts:L609](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useInvoiceMutations.ts#L609) | `toast_title` | Hiba a csoportos törléskor | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L2857](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L2857) | `Dialog Title/Description` | Tömeges Áfakód Módosítás | **— (Prevesti na HR)** |


---

## 🏷️ 3. Státusz Badge-ek, Jelvények és Feltételes Állapotok

| Forrás és sorszám | Elem | Megjelenő magyar szöveg | Javasolt horvát (HR) fordítás |
| :--- | :--- | :--- | :--- |
| [InvoiceDetailPopup.tsx:L99](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceDetailPopup.tsx#L99) | `ternary condition literal` | Feldolgozás alatt | **U obradi** |
| [InvoiceDetailPopup.tsx:L102](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceDetailPopup.tsx#L102) | `ternary condition literal` | Jóváhagyásra vár | **— (Prevesti na HR)** |
| [InvoiceDetailPopup.tsx:L103](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceDetailPopup.tsx#L103) | `ternary condition literal` | Jóváhagyva | **Odobreno** |
| [InvoiceDetailPopup.tsx:L104](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceDetailPopup.tsx#L104) | `ternary condition literal` | Elutasítva | **Odbijeno** |
| [InvoiceDetailPopup.tsx:L105](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceDetailPopup.tsx#L105) | `ternary condition literal` | Fizetésre vár | **— (Prevesti na HR)** |
| [InvoiceDetailPopup.tsx:L106](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceDetailPopup.tsx#L106) | `ternary condition literal` | Fizetve | **Plaćeno** |
| [InvoiceDetailPopup.tsx:L108](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceDetailPopup.tsx#L108) | `ternary condition literal` | Nyitott | **Otvoreno** |
| [InvoiceDetailPopup.tsx:L109](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceDetailPopup.tsx#L109) | `ternary condition literal` | Késedelmes | **— (Prevesti na HR)** |
| [InvoiceDetailPopup.tsx:L110](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceDetailPopup.tsx#L110) | `ternary condition literal` | Sztornózva | **— (Prevesti na HR)** |
| [InvoiceDetailPopup.tsx:L111](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceDetailPopup.tsx#L111) | `ternary condition literal` | Kontírozásra vár | **— (Prevesti na HR)** |
| [InvoiceDetailPopup.tsx:L112](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceDetailPopup.tsx#L112) | `ternary condition literal` | Hiba | **Greška** |
| [InvoiceDetailPopup.tsx:L394](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceDetailPopup.tsx#L394) | `ternary condition literal` | Normál szélesség | **— (Prevesti na HR)** |
| [InvoiceDetailPopup.tsx:L394](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceDetailPopup.tsx#L394) | `ternary condition literal` | Teljes szélesség (scrollmentes) | **— (Prevesti na HR)** |
| [InvoiceFullEditDialog.tsx:L108](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceFullEditDialog.tsx#L108) | `ternary condition literal` | átutalás | **— (Prevesti na HR)** |
| [InvoiceFullEditDialog.tsx:L419](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceFullEditDialog.tsx#L419) | `ternary condition literal` | Számla törölve | **— (Prevesti na HR)** |
| [InvoiceFullEditDialog.tsx:L431](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceFullEditDialog.tsx#L431) | `ternary condition literal` | Hiba a számla törlése során | **— (Prevesti na HR)** |
| [InvoiceFullEditDialog.tsx:L435](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceFullEditDialog.tsx#L435) | `ternary condition literal` | Hiba | **Greška** |
| [InvoiceFullEditDialog.tsx:L529](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceFullEditDialog.tsx#L529) | `ternary condition literal` | Sikeres törlés | **— (Prevesti na HR)** |
| [InvoiceFullEditDialog.tsx:L541](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceFullEditDialog.tsx#L541) | `ternary condition literal` | Hiba a számla és a fájl törlése során | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L734](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L734) | `ternary condition literal` | VTSZ és súly mentve | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L739](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L739) | `ternary condition literal` | Mentési hiba | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L1172](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L1172) | `ternary condition literal` | Áfakód módosítási hiba | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L1187](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L1187) | `ternary condition literal` | Áfakód sikeresen elmentve | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L1654](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L1654) | `ternary condition literal` | Vevői & ÁFA kontír | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L1654](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L1654) | `ternary condition literal` | Szállítói & ÁFA kontír | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L1953](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L1953) | `ternary condition literal` | Kimenő | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L1953](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L1953) | `ternary condition literal` | Bejövő | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L2006](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L2006) | `ternary condition literal` | Követel (K) fizetendő ÁFA számla: ${effectiveVatGl} | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L2007](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L2007) | `ternary condition literal` | Tartozik (T) levonható ÁFA számla: ${effectiveVatGl} | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L2462](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L2462) | `ternary condition literal` | Főkönyvi kontírozás szerkesztése (Tartozik és Követel) | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L2597](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L2597) | `ternary condition literal` | Követel | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L2603](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L2603) | `ternary condition literal` | Költség / ráfordítás / árbevétel | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L2603](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L2603) | `ternary condition literal` | Partner számla (szállító / vevő) | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L2674](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L2674) | `ternary condition literal` | Vevőkövetelés főkönyvi száma: | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L2674](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L2674) | `ternary condition literal` | Szállítói kötelezettség főkönyvi száma: | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L2678](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L2678) | `ternary condition literal` | Belföldi vevők (HUF) | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L2679](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L2679) | `ternary condition literal` | Külföldi vevők (Deviza) | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L2680](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L2680) | `ternary condition literal` | Kapcsolt vállalkozás | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L2682](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L2682) | `ternary condition literal` | Belföldi szállítók (HUF) | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L2683](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L2683) | `ternary condition literal` | Külföldi szállítók (Deviza) | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L2684](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L2684) | `ternary condition literal` | Belföldi szolgáltatók | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L2685](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L2685) | `ternary condition literal` | Szállítók (összevont) | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L2686](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L2686) | `ternary condition literal` | Egyéb kötelezettségek | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L3220](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L3220) | `ternary condition literal` | + VTSZ / Súly | **— (Prevesti na HR)** |
| [SupplierInvoiceAssignment.tsx:L108](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/SupplierInvoiceAssignment.tsx#L108) | `ternary condition literal` | Hiba | **Greška** |
| [SupplierInvoiceAssignment.tsx:L109](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/SupplierInvoiceAssignment.tsx#L109) | `ternary condition literal` | Nem sikerült betölteni a számlákat. | **— (Prevesti na HR)** |
| [SupplierInvoiceAssignment.tsx:L132](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/SupplierInvoiceAssignment.tsx#L132) | `ternary condition literal` | Hozzárendelés sikertelen | **— (Prevesti na HR)** |
| [SupplierInvoiceAssignment.tsx:L146](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/SupplierInvoiceAssignment.tsx#L146) | `ternary condition literal` | Számla hozzárendelve | **— (Prevesti na HR)** |
| [SupplierInvoiceAssignment.tsx:L147](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/SupplierInvoiceAssignment.tsx#L147) | `ternary condition literal` | A számla sikeresen hozzárendelve a projekthez. | **— (Prevesti na HR)** |
| [SupplierInvoiceAssignment.tsx:L180](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/SupplierInvoiceAssignment.tsx#L180) | `ternary condition literal` | Hozzárendelés törölve | **— (Prevesti na HR)** |
| [SupplierInvoiceAssignment.tsx:L181](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/SupplierInvoiceAssignment.tsx#L181) | `ternary condition literal` | A számla már nem tartozik ehhez a projekthez. | **— (Prevesti na HR)** |
| [UploadedFilesModal.tsx:L70](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/UploadedFilesModal.tsx#L70) | `ternary condition literal` | Számlák | **Računi** |
| [UploadedFilesModal.tsx:L79](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/UploadedFilesModal.tsx#L79) | `ternary condition literal` | Pénztárbizonylatok | **— (Prevesti na HR)** |
| [UploadedFilesModal.tsx:L85](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/UploadedFilesModal.tsx#L85) | `ternary condition literal` | bank-statements | **— (Prevesti na HR)** |
| [UploadedFilesModal.tsx:L86](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/UploadedFilesModal.tsx#L86) | `ternary condition literal` | bank | **— (Prevesti na HR)** |
| [UploadedFilesModal.tsx:L97](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/UploadedFilesModal.tsx#L97) | `ternary condition literal` | Tranzakciók | **— (Prevesti na HR)** |
| [UploadedFilesModal.tsx:L106](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/UploadedFilesModal.tsx#L106) | `ternary condition literal` | Bérek/Járulékok | **— (Prevesti na HR)** |
| [UploadHistory.tsx:L496](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/UploadHistory.tsx#L496) | `ternary condition literal` | Extraction hiba | **— (Prevesti na HR)** |
| [InvoiceStatusTables.tsx:L425](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/InvoiceStatusTables.tsx#L425) | `ternary condition literal` | + ${activeInvoices.length - visibleCount} további számla | **— (Prevesti na HR)** |
| [UploadChartOfAccountsModal.tsx:L283](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/UploadChartOfAccountsModal.tsx#L283) | `ternary condition literal` | Nyitó mérleg számla | **— (Prevesti na HR)** |
| [UploadChartOfAccountsModal.tsx:L292](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/UploadChartOfAccountsModal.tsx#L292) | `ternary condition literal` | Záró mérleg számla | **— (Prevesti na HR)** |
| [InvoiceGlAccountSelector.tsx:L24](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceGlAccountSelector.tsx#L24) | `ternary condition literal` | 311 - Belföldi vevők | **— (Prevesti na HR)** |
| [InvoiceGlAccountSelector.tsx:L24](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceGlAccountSelector.tsx#L24) | `ternary condition literal` | Standard belföldi forintos vevőkövetelés | **— (Prevesti na HR)** |
| [InvoiceGlAccountSelector.tsx:L25](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceGlAccountSelector.tsx#L25) | `ternary condition literal` | 312 - Külföldi vevők | **— (Prevesti na HR)** |
| [InvoiceGlAccountSelector.tsx:L25](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceGlAccountSelector.tsx#L25) | `ternary condition literal` | Exportértékesítés, devizás külföldi követelés | **— (Prevesti na HR)** |
| [InvoiceGlAccountSelector.tsx:L26](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceGlAccountSelector.tsx#L26) | `ternary condition literal` | 315 - Kapcsolt vállalkozások | **— (Prevesti na HR)** |
| [InvoiceGlAccountSelector.tsx:L26](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceGlAccountSelector.tsx#L26) | `ternary condition literal` | Cégcsoporton belüli vevőkövetelés | **— (Prevesti na HR)** |
| [InvoiceGlAccountSelector.tsx:L27](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceGlAccountSelector.tsx#L27) | `ternary condition literal` | 316 - Jelentős tulajdoni részesedés | **— (Prevesti na HR)** |
| [InvoiceGlAccountSelector.tsx:L27](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceGlAccountSelector.tsx#L27) | `ternary condition literal` | Jelentős tulajdoni viszonyban álló vevő | **— (Prevesti na HR)** |
| [InvoiceGlAccountSelector.tsx:L28](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceGlAccountSelector.tsx#L28) | `ternary condition literal` | 317 - Egyéb részesedési viszony | **— (Prevesti na HR)** |
| [InvoiceGlAccountSelector.tsx:L28](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceGlAccountSelector.tsx#L28) | `ternary condition literal` | Egyéb részesedési viszonyban álló vevő | **— (Prevesti na HR)** |
| [InvoiceGlAccountSelector.tsx:L32](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceGlAccountSelector.tsx#L32) | `ternary condition literal` | 4541 - Belföldi szállítók | **— (Prevesti na HR)** |
| [InvoiceGlAccountSelector.tsx:L32](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceGlAccountSelector.tsx#L32) | `ternary condition literal` | Belföldi szállítói kötelezettség | **— (Prevesti na HR)** |
| [InvoiceGlAccountSelector.tsx:L33](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceGlAccountSelector.tsx#L33) | `ternary condition literal` | 4542 - Külföldi szállítók | **— (Prevesti na HR)** |
| [InvoiceGlAccountSelector.tsx:L33](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceGlAccountSelector.tsx#L33) | `ternary condition literal` | Külföldi szállítói kötelezettség | **— (Prevesti na HR)** |
| [InvoiceGlAccountSelector.tsx:L34](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceGlAccountSelector.tsx#L34) | `ternary condition literal` | 4543 - Belföldi szolgáltatók | **— (Prevesti na HR)** |
| [InvoiceGlAccountSelector.tsx:L34](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceGlAccountSelector.tsx#L34) | `ternary condition literal` | Belföldi szolgáltatási szállítók | **— (Prevesti na HR)** |
| [InvoiceGlAccountSelector.tsx:L44](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceGlAccountSelector.tsx#L44) | `ternary condition literal` | 466 - Levonható ÁFA | **— (Prevesti na HR)** |
| [InvoiceGlAccountSelector.tsx:L44](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceGlAccountSelector.tsx#L44) | `ternary condition literal` | Előzetesen felszámított általános forgalmi adó | **— (Prevesti na HR)** |
| [InvoiceGlAccountSelector.tsx:L45](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceGlAccountSelector.tsx#L45) | `ternary condition literal` | 4668 - Levonható ÁFA (4668) | **— (Prevesti na HR)** |
| [InvoiceGlAccountSelector.tsx:L45](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceGlAccountSelector.tsx#L45) | `ternary condition literal` | Előzetesen felszámított ÁFA (4668) | **— (Prevesti na HR)** |
| [InvoiceGlAccountSelector.tsx:L49](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceGlAccountSelector.tsx#L49) | `ternary condition literal` | 467 - Fizetendő ÁFA | **— (Prevesti na HR)** |
| [InvoiceGlAccountSelector.tsx:L49](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceGlAccountSelector.tsx#L49) | `ternary condition literal` | Fizetendő általános forgalmi adó | **— (Prevesti na HR)** |
| [InvoiceGlAccountSelector.tsx:L165](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceGlAccountSelector.tsx#L165) | `ternary condition literal` | Kontírszám frissítve | **— (Prevesti na HR)** |
| [InvoiceGlAccountSelector.tsx:L166](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceGlAccountSelector.tsx#L166) | `ternary condition literal` | A kontírozási beállítás sikeresen elmentve. | **— (Prevesti na HR)** |
| [InvoiceGlAccountSelector.tsx:L179](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceGlAccountSelector.tsx#L179) | `ternary condition literal` | Hiba a kontírszám mentésekor | **— (Prevesti na HR)** |
| [InvoiceGlAccountSelector.tsx:L208](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceGlAccountSelector.tsx#L208) | `ternary condition literal` | Tartozik (T) vevőkövetelés számla | **— (Prevesti na HR)** |
| [InvoiceGlAccountSelector.tsx:L208](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceGlAccountSelector.tsx#L208) | `ternary condition literal` | Követel (K) szállítói kötelezettség számla | **— (Prevesti na HR)** |
| [InvoiceGlAccountSelector.tsx:L210](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceGlAccountSelector.tsx#L210) | `ternary condition literal` | Vevői számla: | **— (Prevesti na HR)** |
| [InvoiceGlAccountSelector.tsx:L210](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceGlAccountSelector.tsx#L210) | `ternary condition literal` | Szállítói számla: | **— (Prevesti na HR)** |
| [InvoiceGlAccountSelector.tsx:L250](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceGlAccountSelector.tsx#L250) | `ternary condition literal` | Követel (K) fizetendő ÁFA számla | **— (Prevesti na HR)** |
| [InvoiceGlAccountSelector.tsx:L250](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceGlAccountSelector.tsx#L250) | `ternary condition literal` | Tartozik (T) levonható ÁFA számla | **— (Prevesti na HR)** |
| [InvoiceItemAccrualModal.tsx:L142](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemAccrualModal.tsx#L142) | `ternary condition literal` | Költségek aktív időbeli elhatárolása | **— (Prevesti na HR)** |
| [InvoiceItemAccrualModal.tsx:L143](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemAccrualModal.tsx#L143) | `ternary condition literal` | Árbevételek passzív időbeli elhatárolása | **— (Prevesti na HR)** |
| [InvoiceItemAccrualModal.tsx:L187](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemAccrualModal.tsx#L187) | `ternary condition literal` | Hiányzó elhatárolási főkönyvi szám | **— (Prevesti na HR)** |
| [InvoiceItemAccrualModal.tsx:L188](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemAccrualModal.tsx#L188) | `ternary condition literal` | Kérlek válassz ki egy elhatárolási számlát (pl. 392). | **— (Prevesti na HR)** |
| [InvoiceItemAccrualModal.tsx:L196](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemAccrualModal.tsx#L196) | `ternary condition literal` | Hiányzó tétel kontírozás | **— (Prevesti na HR)** |
| [InvoiceItemAccrualModal.tsx:L232](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemAccrualModal.tsx#L232) | `ternary condition literal` | Időbeli elhatárolás sikeresen lekönyvelve | **— (Prevesti na HR)** |
| [InvoiceItemAccrualModal.tsx:L247](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemAccrualModal.tsx#L247) | `ternary condition literal` | Hiba az elhatárolás mentésekor | **— (Prevesti na HR)** |
| [InvoiceItemAccrualModal.tsx:L263](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemAccrualModal.tsx#L263) | `ternary condition literal` | Időbeli elhatárolás törölve | **— (Prevesti na HR)** |
| [InvoiceItemAccrualModal.tsx:L274](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemAccrualModal.tsx#L274) | `ternary condition literal` | Hiba a törlés során | **— (Prevesti na HR)** |
| [InvoiceItemAccrualModal.tsx:L444](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemAccrualModal.tsx#L444) | `ternary condition literal` | ${splitResult.totalDays} nap összesen | **— (Prevesti na HR)** |
| [InvoiceItemAccrualModal.tsx:L445](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemAccrualModal.tsx#L445) | `ternary condition literal` | ${splitResult.totalMonths} hónap összesen | **— (Prevesti na HR)** |
| [InvoiceItemAccrualModal.tsx:L461](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemAccrualModal.tsx#L461) | `ternary condition literal` | ${splitResult.currentPeriodMonths} hónap | **— (Prevesti na HR)** |
| [InvoiceItemAccrualModal.tsx:L475](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemAccrualModal.tsx#L475) | `ternary condition literal` | ${splitResult.nextPeriodDays} nap (${endYear}. évre) | **— (Prevesti na HR)** |
| [InvoiceItemAccrualModal.tsx:L476](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemAccrualModal.tsx#L476) | `ternary condition literal` | ${splitResult.nextPeriodMonths} hónap | **— (Prevesti na HR)** |
| [InvoiceItemAccrualModal.tsx:L497](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemAccrualModal.tsx#L497) | `ternary condition literal` | AIE (39-es számlacsoport) | **— (Prevesti na HR)** |
| [InvoiceItemAccrualModal.tsx:L497](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemAccrualModal.tsx#L497) | `ternary condition literal` | PIE (48-as számlacsoport) | **— (Prevesti na HR)** |
| [InvoiceItemRulesManager.tsx:L175](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L175) | `ternary condition literal` | Hiba a státusz módosításakor | **— (Prevesti na HR)** |
| [InvoiceItemRulesManager.tsx:L187](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L187) | `ternary condition literal` | Szabály törölve | **— (Prevesti na HR)** |
| [InvoiceItemRulesManager.tsx:L190](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L190) | `ternary condition literal` | Hiba a törléskor | **— (Prevesti na HR)** |
| [InvoiceItemRulesManager.tsx:L227](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L227) | `ternary condition literal` | Szabály sikeresen frissítve | **— (Prevesti na HR)** |
| [InvoiceItemRulesManager.tsx:L233](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L233) | `ternary condition literal` | Új szabály létrehozva | **— (Prevesti na HR)** |
| [InvoiceItemRulesManager.tsx:L239](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L239) | `ternary condition literal` | Mentési hiba | **— (Prevesti na HR)** |
| [InvoiceItemRulesManager.tsx:L260](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L260) | `ternary condition literal` | Szabályok alkalmazása befejeződött | **— (Prevesti na HR)** |
| [InvoiceItemRulesManager.tsx:L272](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L272) | `ternary condition literal` | Hiba a szabályok futtatásakor | **— (Prevesti na HR)** |
| [InvoiceItemRulesManager.tsx:L301](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L301) | `ternary condition literal` | Számlakontírozási Szabályok | **— (Prevesti na HR)** |
| [InvoiceItemRulesManager.tsx:L303](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L303) | `ternary condition literal` | Számlaszabály szerkesztése | **— (Prevesti na HR)** |
| [InvoiceItemRulesManager.tsx:L304](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L304) | `ternary condition literal` | Új számlakontírozási szabály létrehozása | **Novi račun** |
| [InvoiceItemRulesManager.tsx:L447](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L447) | `ternary condition literal` | Összes | **Sve** |
| [InvoiceItemRulesManager.tsx:L447](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L447) | `ternary condition literal` | Bejövő | **— (Prevesti na HR)** |
| [InvoiceItemRulesManager.tsx:L447](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L447) | `ternary condition literal` | Kimenő | **— (Prevesti na HR)** |
| [InvoiceItemRulesManager.tsx:L631](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L631) | `ternary condition literal` | Módosítás mentése | **— (Prevesti na HR)** |
| [InvoiceItemRulesManager.tsx:L631](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L631) | `ternary condition literal` | Szabály létrehozása | **— (Prevesti na HR)** |
| [InvoiceRuleQuickSaveDialog.tsx:L106](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceRuleQuickSaveDialog.tsx#L106) | `ternary condition literal` | Tétel besorolása frissítve | **— (Prevesti na HR)** |
| [InvoiceRuleQuickSaveDialog.tsx:L171](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceRuleQuickSaveDialog.tsx#L171) | `ternary condition literal` | Szabály elmentve és tétel besorolva | **— (Prevesti na HR)** |
| [InvoiceRuleQuickSaveDialog.tsx:L189](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceRuleQuickSaveDialog.tsx#L189) | `ternary condition literal` | Szabály mentési hiba | **— (Prevesti na HR)** |
| [ManualInvoiceCreateDialog.tsx:L91](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L91) | `ternary condition literal` | Átutalás | **— (Prevesti na HR)** |
| [ManualInvoiceCreateDialog.tsx:L162](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L162) | `ternary condition literal` | NAV számla adatai betöltve | **— (Prevesti na HR)** |
| [ManualInvoiceCreateDialog.tsx:L255](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L255) | `ternary condition literal` | Összegek újraszámolva | **— (Prevesti na HR)** |
| [ManualInvoiceCreateDialog.tsx:L256](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L256) | `ternary condition literal` | A fejléc összegek frissültek a számlatételek alapján. | **— (Prevesti na HR)** |
| [ManualInvoiceCreateDialog.tsx:L263](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L263) | `ternary condition literal` | Hiba | **Greška** |
| [ManualInvoiceCreateDialog.tsx:L263](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L263) | `ternary condition literal` | Nincs aktív cég azonosító. | **— (Prevesti na HR)** |
| [ManualInvoiceCreateDialog.tsx:L269](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L269) | `ternary condition literal` | Hiányzó adat | **— (Prevesti na HR)** |
| [ManualInvoiceCreateDialog.tsx:L269](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L269) | `ternary condition literal` | A bizonylatsorszám megadása kötelező. | **— (Prevesti na HR)** |
| [ManualInvoiceCreateDialog.tsx:L276](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L276) | `ternary condition literal` | Hiányzó partnernév | **— (Prevesti na HR)** |
| [ManualInvoiceCreateDialog.tsx:L277](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L277) | `ternary condition literal` | Az eladó nevének megadása kötelező. | **— (Prevesti na HR)** |
| [ManualInvoiceCreateDialog.tsx:L277](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L277) | `ternary condition literal` | A vevő nevének megadása kötelező. | **— (Prevesti na HR)** |
| [ManualInvoiceCreateDialog.tsx:L367](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L367) | `ternary condition literal` | Már létező bizonylatsorszám | **— (Prevesti na HR)** |
| [ManualInvoiceCreateDialog.tsx:L368](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L368) | `ternary condition literal` | Ezzel a bizonylatsorszámmal már létezik számla a cégnél. | **— (Prevesti na HR)** |
| [ManualInvoiceCreateDialog.tsx:L450](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L450) | `ternary condition literal` | Számla sikeresen rögzítve | **— (Prevesti na HR)** |
| [ManualInvoiceCreateDialog.tsx:L451](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L451) | `ternary condition literal` | A(z) ${invoiceNumber} számla bekerült a nyilvántartásba. | **— (Prevesti na HR)** |
| [ManualInvoiceCreateDialog.tsx:L461](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L461) | `ternary condition literal` | Hiba a számla manuális rögzítése során | **— (Prevesti na HR)** |
| [ManualInvoiceCreateDialog.tsx:L465](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L465) | `ternary condition literal` | Mentési hiba | **— (Prevesti na HR)** |
| [ManualInvoiceCreateDialog.tsx:L579](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L579) | `ternary condition literal` | Válassz dátumot | **— (Prevesti na HR)** |
| [PdfExportBanner.tsx:L84](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/PdfExportBanner.tsx#L84) | `ternary condition literal` | ${job.total_invoices} számla → | **— (Prevesti na HR)** |
| [PdfExportBanner.tsx:L88](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/PdfExportBanner.tsx#L88) | `ternary condition literal` | ${fileCount} PDF fájl | **— (Prevesti na HR)** |
| [PdfExportDialog.tsx:L155](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/PdfExportDialog.tsx#L155) | `ternary condition literal` | Aktuális hónap | **— (Prevesti na HR)** |
| [PdfExportDialog.tsx:L156](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/PdfExportDialog.tsx#L156) | `ternary condition literal` | Előző hónap | **— (Prevesti na HR)** |
| [PdfExportDialog.tsx:L157](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/PdfExportDialog.tsx#L157) | `ternary condition literal` | Aktuális negyedév | **— (Prevesti na HR)** |
| ... | ... | *(További 261 elem a teljes JSON leltárban)* | ... |


---

## 🖥️ 4. Felületi Kezelőszervek, Gombok, Fejlécek és Mezők (JSX & Props)

| Forrás és sorszám | Elem | Megjelenő magyar szöveg | Javasolt horvát (HR) fordítás |
| :--- | :--- | :--- | :--- |
| [InvoiceDetailPopup.tsx:L435](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceDetailPopup.tsx#L435) | `JSX node text` | ÁFA bevallás: | **— (Prevesti na HR)** |
| [InvoiceDetailPopup.tsx:L642](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceDetailPopup.tsx#L642) | `JSX node text` | ÁFA kód / 2665 sor | **— (Prevesti na HR)** |
| [InvoiceImagePreview.tsx:L132](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceImagePreview.tsx#L132) | `JSX node text` | Előnézet betöltése... | **— (Prevesti na HR)** |
| [InvoiceImagePreview.tsx:L144](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceImagePreview.tsx#L144) | `JSX node text` | Előnézet nem elérhető | **— (Prevesti na HR)** |
| [InvoiceImagePreview.tsx:L158](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceImagePreview.tsx#L158) | `JSX node text` | PDF betöltése... | **— (Prevesti na HR)** |
| [InvoiceImagePreview.tsx:L180](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceImagePreview.tsx#L180) | `JSX node text` | Kép betöltése... | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L2481](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L2481) | `JSX node text` | MÍNUSZOS TÉTEL | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L2565](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L2565) | `JSX node text` | Követel oldal | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L2726](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L2726) | `JSX node text` | Egyedi partner főkönyvi szám: | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L2857](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L2857) | `JSX node text` | Tömeges Áfakód Módosítás | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L2864](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L2864) | `JSX node text` | Áfakód | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L2886](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L2886) | `JSX node text` | Mégse | **Odustani** |
| [InvoiceItemsDialog.tsx:L3233](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L3233) | `JSX node text` | VTSZ & Nettó tömeg (kg) | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L3234](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L3234) | `JSX node text` | 6/B melléklet | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L3238](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L3238) | `JSX node text` | VTSZ / KN kód | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L3247](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L3247) | `JSX node text` | Nettó tömeg (kg) | **— (Prevesti na HR)** |
| [SupplierInvoiceAssignment.tsx:L225](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/SupplierInvoiceAssignment.tsx#L225) | `JSX node text` | Számlák betöltése... | **Učitavanje računa...** |
| [SupplierInvoiceAssignment.tsx:L233](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/SupplierInvoiceAssignment.tsx#L233) | `JSX node text` | Költségszámlák hozzárendelése | **— (Prevesti na HR)** |
| [SupplierInvoiceAssignment.tsx:L393](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/SupplierInvoiceAssignment.tsx#L393) | `JSX node text` | Nincsenek hozzárendelhető számlák | **— (Prevesti na HR)** |
| [UploadHistory.tsx:L593](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/UploadHistory.tsx#L593) | `JSX node text` | Nem sikerült betölteni a CSV tartalmát. | **— (Prevesti na HR)** |
| [UploadHistory.tsx:L622](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/UploadHistory.tsx#L622) | `JSX node text` | Csak az első 100 sor jelenik meg előnézetben. | **— (Prevesti na HR)** |
| [InvoiceDataExportDialog.tsx:L295](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceDataExportDialog.tsx#L295) | `JSX node text` | Fejléces Összesítő | **— (Prevesti na HR)** |
| [InvoiceDataExportDialog.tsx:L314](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceDataExportDialog.tsx#L314) | `JSX node text` | Tételes Kontírozott (NAV Audit) | **— (Prevesti na HR)** |
| [InvoiceDataExportDialog.tsx:L388](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceDataExportDialog.tsx#L388) | `JSX node text` | Egyéni dátumtartomány... | **— (Prevesti na HR)** |
| [InvoiceDataExportDialog.tsx:L397](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceDataExportDialog.tsx#L397) | `JSX node text` | Dátum -tól | **— (Prevesti na HR)** |
| [InvoiceDataExportDialog.tsx:L407](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceDataExportDialog.tsx#L407) | `JSX node text` | Dátum -ig | **— (Prevesti na HR)** |
| [InvoiceDataExportDialog.tsx:L439](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceDataExportDialog.tsx#L439) | `JSX node text` | Minden számla egyetlen közös táblázatban | **— (Prevesti na HR)** |
| [InvoiceDataExportDialog.tsx:L455](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceDataExportDialog.tsx#L455) | `JSX node text` | Fizetési mód szerint bontva (3 fül) | **— (Prevesti na HR)** |
| [InvoiceDataExportDialog.tsx:L456](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceDataExportDialog.tsx#L456) | `JSX node text` | Utalás és kártya, Készpénz és házipénztár, Egyéb | **— (Prevesti na HR)** |
| [InvoiceDataExportDialog.tsx:L509](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceDataExportDialog.tsx#L509) | `JSX node text` | Biz.szám | **— (Prevesti na HR)** |
| [InvoiceDataExportDialog.tsx:L510](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceDataExportDialog.tsx#L510) | `JSX node text` | Dátum | **Datum** |
| [InvoiceDataExportDialog.tsx:L511](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceDataExportDialog.tsx#L511) | `JSX node text` | Partner | **Partner** |
| [InvoiceDataExportDialog.tsx:L512](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceDataExportDialog.tsx#L512) | `JSX node text` | Bruttó összeg | **Bruto iznos** |
| [InvoiceGlAccountSelector.tsx:L221](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceGlAccountSelector.tsx#L221) | `JSX node text` | Mentés... | **Spremi...** |
| [InvoiceGlAccountSelector.tsx:L252](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceGlAccountSelector.tsx#L252) | `JSX node text` | ÁFA kontír: | **— (Prevesti na HR)** |
| [InvoiceGlAccountSelector.tsx:L259](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceGlAccountSelector.tsx#L259) | `JSX node text` | 467 - Fizetendő ÁFA | **— (Prevesti na HR)** |
| [InvoiceItemAccrualModal.tsx:L344](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemAccrualModal.tsx#L344) | `JSX node text` | Érintett számlatétel | **— (Prevesti na HR)** |
| [InvoiceItemAccrualModal.tsx:L350](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemAccrualModal.tsx#L350) | `JSX node text` | Tétel nettó | **— (Prevesti na HR)** |
| [InvoiceItemAccrualModal.tsx:L383](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemAccrualModal.tsx#L383) | `JSX node text` | Időszak kezdete: | **— (Prevesti na HR)** |
| [InvoiceItemAccrualModal.tsx:L392](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemAccrualModal.tsx#L392) | `JSX node text` | Időszak vége: | **— (Prevesti na HR)** |
| [InvoiceItemAccrualModal.tsx:L405](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemAccrualModal.tsx#L405) | `JSX node text` | Kalkulációs módszer | **— (Prevesti na HR)** |
| [InvoiceItemAccrualModal.tsx:L484](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemAccrualModal.tsx#L484) | `JSX node text` | Elhatárolási fordulónap: | **— (Prevesti na HR)** |
| [InvoiceItemAccrualModal.tsx:L488](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemAccrualModal.tsx#L488) | `JSX node text` | Feloldási dátum: | **— (Prevesti na HR)** |
| [InvoiceItemAccrualModal.tsx:L495](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemAccrualModal.tsx#L495) | `JSX node text` | Elhatárolási főkönyvi számla: | **— (Prevesti na HR)** |
| [InvoiceItemAccrualModal.tsx:L535](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemAccrualModal.tsx#L535) | `JSX node text` | A megadott időszak teljes egészében a tárgyévre esik. | **— (Prevesti na HR)** |
| [InvoiceItemAccrualModal.tsx:L546](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemAccrualModal.tsx#L546) | `JSX node text` | Elhatárolandó összeg: | **— (Prevesti na HR)** |
| [InvoiceItemRulesManager.tsx:L389](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L389) | `JSX node text` | Nincs rögzített számlaszabály | **— (Prevesti na HR)** |
| [InvoiceItemRulesManager.tsx:L484](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L484) | `JSX node text` | Szabály megnevezése | **— (Prevesti na HR)** |
| [InvoiceItemRulesManager.tsx:L494](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L494) | `JSX node text` | Keresendő szövegminta a tétel leírásában | **— (Prevesti na HR)** |
| [InvoiceItemRulesManager.tsx:L505](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L505) | `JSX node text` | Cél főkönyvi szám | **— (Prevesti na HR)** |
| [InvoiceItemRulesManager.tsx:L511](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L511) | `JSX node text` | Válassz főkönyvi számot... | **— (Prevesti na HR)** |
| [InvoiceItemRulesManager.tsx:L521](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L521) | `JSX node text` | Cél áfakód (opcionális) | **— (Prevesti na HR)** |
| [InvoiceItemRulesManager.tsx:L527](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L527) | `JSX node text` | Nincs hozzárendelt áfakód | **— (Prevesti na HR)** |
| [InvoiceItemRulesManager.tsx:L539](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L539) | `JSX node text` | Számla iránya | **— (Prevesti na HR)** |
| [InvoiceItemRulesManager.tsx:L545](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L545) | `JSX node text` | Összes számla (Bejövő & Kimenő) | **— (Prevesti na HR)** |
| [InvoiceItemRulesManager.tsx:L546](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L546) | `JSX node text` | Csak Bejövő (Költség / Beszerzés) | **— (Prevesti na HR)** |
| [InvoiceItemRulesManager.tsx:L547](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L547) | `JSX node text` | Csak Kimenő (Árbevétel / Értékesítés) | **— (Prevesti na HR)** |
| [InvoiceItemRulesManager.tsx:L552](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L552) | `JSX node text` | Illesztési típus | **— (Prevesti na HR)** |
| [InvoiceItemRulesManager.tsx:L558](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L558) | `JSX node text` | Tartalmazza (Részszó egyezés) | **— (Prevesti na HR)** |
| [InvoiceItemRulesManager.tsx:L559](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L559) | `JSX node text` | Pontos egyezés | **— (Prevesti na HR)** |
| [InvoiceItemRulesManager.tsx:L565](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L565) | `JSX node text` | Partner szűrés (opcionális) | **— (Prevesti na HR)** |
| [InvoiceItemRulesManager.tsx:L583](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L583) | `JSX node text` | Hatókör | **— (Prevesti na HR)** |
| [InvoiceRuleQuickSaveDialog.tsx:L206](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceRuleQuickSaveDialog.tsx#L206) | `JSX node text` | Számlakontírozási Szabály | **— (Prevesti na HR)** |
| [InvoiceRuleQuickSaveDialog.tsx:L219](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceRuleQuickSaveDialog.tsx#L219) | `JSX node text` | Keresendő szövegminta a tétel megnevezésében | **— (Prevesti na HR)** |
| [InvoiceRuleQuickSaveDialog.tsx:L297](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceRuleQuickSaveDialog.tsx#L297) | `JSX node text` | Szabály érvényességi hatóköre | **— (Prevesti na HR)** |
| [InvoiceRuleQuickSaveDialog.tsx:L331](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceRuleQuickSaveDialog.tsx#L331) | `JSX node text` | Könyvelőirodai sablon (Minden kezelt cégemnél) | **— (Prevesti na HR)** |
| [ManualInvoiceCreateDialog.tsx:L569](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L569) | `JSX node text` | Kelt (Kibocsátás) | **— (Prevesti na HR)** |
| [ManualInvoiceCreateDialog.tsx:L594](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L594) | `JSX node text` | Teljesítés dátuma | **Datum isporuke** |
| [ManualInvoiceCreateDialog.tsx:L648](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L648) | `JSX node text` | Bizonylat típusa | **— (Prevesti na HR)** |
| [ManualInvoiceCreateDialog.tsx:L654](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L654) | `JSX node text` | Normál számla | **— (Prevesti na HR)** |
| [ManualInvoiceCreateDialog.tsx:L655](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L655) | `JSX node text` | Díjbekérő (Proforma) | **— (Prevesti na HR)** |
| [ManualInvoiceCreateDialog.tsx:L656](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L656) | `JSX node text` | Előlegszámla | **— (Prevesti na HR)** |
| [ManualInvoiceCreateDialog.tsx:L657](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L657) | `JSX node text` | Végszámla | **— (Prevesti na HR)** |
| [ManualInvoiceCreateDialog.tsx:L667](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L667) | `JSX node text` | Összegek | **— (Prevesti na HR)** |
| [ManualInvoiceCreateDialog.tsx:L684](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L684) | `JSX node text` | Nettó összeg | **Neto iznos** |
| [ManualInvoiceCreateDialog.tsx:L697](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L697) | `JSX node text` | ÁFA összeg | **Iznos PDV-a** |
| [ManualInvoiceCreateDialog.tsx:L711](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L711) | `JSX node text` | Bruttó végösszeg | **— (Prevesti na HR)** |
| [ManualInvoiceCreateDialog.tsx:L726](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L726) | `JSX node text` | Pénznem | **Valuta** |
| [ManualInvoiceCreateDialog.tsx:L746](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L746) | `JSX node text` | Fizetés módja | **— (Prevesti na HR)** |
| [ManualInvoiceCreateDialog.tsx:L756](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L756) | `JSX node text` | Átutalás | **— (Prevesti na HR)** |
| [ManualInvoiceCreateDialog.tsx:L757](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L757) | `JSX node text` | Bankkártya | **— (Prevesti na HR)** |
| [ManualInvoiceCreateDialog.tsx:L758](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L758) | `JSX node text` | Készpénz | **— (Prevesti na HR)** |
| [ManualInvoiceCreateDialog.tsx:L759](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L759) | `JSX node text` | Utánvét | **— (Prevesti na HR)** |
| [ManualInvoiceCreateDialog.tsx:L760](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L760) | `JSX node text` | Kompenzáció | **— (Prevesti na HR)** |
| [ManualInvoiceCreateDialog.tsx:L761](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L761) | `JSX node text` | Egyéb | **— (Prevesti na HR)** |
| [ManualInvoiceCreateDialog.tsx:L769](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L769) | `JSX node text` | Kategória | **Kategorija** |
| [ManualInvoiceCreateDialog.tsx:L779](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L779) | `JSX node text` | Nincs kategória | **— (Prevesti na HR)** |
| [ManualInvoiceCreateDialog.tsx:L788](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L788) | `JSX node text` | Projekt | **Projekt** |
| [ManualInvoiceCreateDialog.tsx:L798](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L798) | `JSX node text` | Nincs projekt | **— (Prevesti na HR)** |
| [ManualInvoiceCreateDialog.tsx:L854](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L854) | `JSX node text` | Nincsenek rögzített számlatételek | **— (Prevesti na HR)** |
| [ManualInvoiceCreateDialog.tsx:L875](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L875) | `JSX node text` | Megnevezés | **— (Prevesti na HR)** |
| [ManualInvoiceCreateDialog.tsx:L877](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L877) | `JSX node text` | Egység | **— (Prevesti na HR)** |
| [ManualInvoiceCreateDialog.tsx:L878](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L878) | `JSX node text` | Egységár | **— (Prevesti na HR)** |
| [ManualInvoiceCreateDialog.tsx:L879](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L879) | `JSX node text` | Nettó | **— (Prevesti na HR)** |
| [ManualInvoiceCreateDialog.tsx:L880](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L880) | `JSX node text` | ÁFA % | **— (Prevesti na HR)** |
| [ManualInvoiceCreateDialog.tsx:L881](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L881) | `JSX node text` | Bruttó | **— (Prevesti na HR)** |
| [PdfExportDialog.tsx:L321](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/PdfExportDialog.tsx#L321) | `JSX node text` | Export indítása... | **— (Prevesti na HR)** |
| [PdfExportDialog.tsx:L322](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/PdfExportDialog.tsx#L322) | `JSX node text` | Várakozás a szerver válaszára | **— (Prevesti na HR)** |
| [SzamlazzSyncModal.tsx:L147](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/SzamlazzSyncModal.tsx#L147) | `JSX node text` | Kimenő számlák | **— (Prevesti na HR)** |
| [SzamlazzSyncModal.tsx:L153](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/SzamlazzSyncModal.tsx#L153) | `JSX node text` | Számlaképpel | **— (Prevesti na HR)** |
| [SzamlazzSyncModal.tsx:L159](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/SzamlazzSyncModal.tsx#L159) | `JSX node text` | Hiányzó kép | **— (Prevesti na HR)** |
| [SzamlazzSyncModal.tsx:L256](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/SzamlazzSyncModal.tsx#L256) | `JSX node text` | Hiba történt: | **Došlo je do greške** |
| [InvoiceDocumentDropzone.tsx:L136](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/manual-create/InvoiceDocumentDropzone.tsx#L136) | `JSX node text` | tallózz | **— (Prevesti na HR)** |
| [NavInvoicePicker.tsx:L135](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/manual-create/NavInvoicePicker.tsx#L135) | `JSX node text` | Válassz ki egy NAV számlát az adatok automatikus betöltéséhez... | **— (Prevesti na HR)** |
| [NavInvoicePicker.tsx:L184](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/manual-create/NavInvoicePicker.tsx#L184) | `JSX node text` | NAV számlák betöltése... | **Učitavanje računa...** |
| [NavInvoicePicker.tsx:L189](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/manual-create/NavInvoicePicker.tsx#L189) | `JSX node text` | Nem található NAV számla | **Nema podataka** |
| [TransactionMultiPicker.tsx:L139](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/manual-create/TransactionMultiPicker.tsx#L139) | `JSX node text` | Tranzakció kiválasztása vagy hozzáadása... | **— (Prevesti na HR)** |
| [TransactionMultiPicker.tsx:L187](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/manual-create/TransactionMultiPicker.tsx#L187) | `JSX node text` | Tranzakciók betöltése... | **— (Prevesti na HR)** |
| [TransactionMultiPicker.tsx:L192](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/manual-create/TransactionMultiPicker.tsx#L192) | `JSX node text` | Nem található tranzakció | **Nema podataka** |
| [TransactionMultiPicker.tsx:L292](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/manual-create/TransactionMultiPicker.tsx#L292) | `JSX node text` | Kiegyenlítés fedezete: | **— (Prevesti na HR)** |
| [NavInvoiceVatSummaryCard.tsx:L163](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/nav/NavInvoiceVatSummaryCard.tsx#L163) | `JSX node text` | Áfakulcs / Jogcím | **— (Prevesti na HR)** |
| [NavInvoiceVatSummaryCard.tsx:L164](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/nav/NavInvoiceVatSummaryCard.tsx#L164) | `JSX node text` | Adóalap (Nettó) | **— (Prevesti na HR)** |
| [NavInvoiceVatSummaryCard.tsx:L165](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/nav/NavInvoiceVatSummaryCard.tsx#L165) | `JSX node text` | ÁFA összege | **— (Prevesti na HR)** |
| [NavInvoiceVatSummaryCard.tsx:L166](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/nav/NavInvoiceVatSummaryCard.tsx#L166) | `JSX node text` | Bruttó érték | **— (Prevesti na HR)** |
| [NavInvoiceVatSummaryCard.tsx:L224](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/nav/NavInvoiceVatSummaryCard.tsx#L224) | `JSX node text` | Összesen: | **Ukupno:** |
| [InvoiceApprovalDialog.tsx:L163](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/dialogs/InvoiceApprovalDialog.tsx#L163) | `JSX node text` | Vevő a számlán: | **— (Prevesti na HR)** |
| [InvoiceApprovalDialog.tsx:L191](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/dialogs/InvoiceApprovalDialog.tsx#L191) | `JSX node text` | Számlán lévő vevő: | **— (Prevesti na HR)** |
| [InvoiceApprovalDialog.tsx:L196](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/dialogs/InvoiceApprovalDialog.tsx#L196) | `JSX node text` | Aktuális cég: | **— (Prevesti na HR)** |
| [ExpandedInvoiceRow.tsx:L371](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/expanded-row/ExpandedInvoiceRow.tsx#L371) | `JSX node text` | ÁFA kód & 2665 bevallási sor | **— (Prevesti na HR)** |
| [ExpandedInvoiceRow.tsx:L412](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/expanded-row/ExpandedInvoiceRow.tsx#L412) | `JSX node text` | ÁFA levonhatóság | **— (Prevesti na HR)** |
| [ExpandedInvoiceRow.tsx:L462](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/expanded-row/ExpandedInvoiceRow.tsx#L462) | `JSX node text` | Könyvelői jóváhagyással engedélyezve: | **— (Prevesti na HR)** |
| [GeneralLedgerBadgeSection.tsx:L26](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/expanded-row/GeneralLedgerBadgeSection.tsx#L26) | `JSX node text` | (árbevétel / költség) | **— (Prevesti na HR)** |
| [MatchedTransactionsSection.tsx:L85](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/expanded-row/MatchedTransactionsSection.tsx#L85) | `JSX node text` | Dátum: | **Datum:** |
| [MatchedTransactionsSection.tsx:L91](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/expanded-row/MatchedTransactionsSection.tsx#L91) | `JSX node text` | Összeg: | **Iznos:** |
| [MatchedTransactionsSection.tsx:L102](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/expanded-row/MatchedTransactionsSection.tsx#L102) | `JSX node text` | Leírás: | **— (Prevesti na HR)** |
| [MatchedTransactionsSection.tsx:L107](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/expanded-row/MatchedTransactionsSection.tsx#L107) | `JSX node text` | AI indoklás: | **— (Prevesti na HR)** |
| [InvoiceFilterBar.tsx:L463](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/filters/InvoiceFilterBar.tsx#L463) | `JSX node text` | TAM (tárgyi mentes) | **— (Prevesti na HR)** |
| [InvoiceFilterBar.tsx:L464](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/filters/InvoiceFilterBar.tsx#L464) | `JSX node text` | FAD (fordított adózás) | **— (Prevesti na HR)** |
| [InvoiceHeader.tsx:L117](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/header/InvoiceHeader.tsx#L117) | `JSX node text` | Export Excel (.xlsx) | **Izvoz u Excel (.xlsx)** |
| [InvoiceHeader.tsx:L122](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/header/InvoiceHeader.tsx#L122) | `JSX node text` | Export CSV (.csv) | **Izvoz u CSV (.csv)** |
| [InvoiceHeader.tsx:L129](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/header/InvoiceHeader.tsx#L129) | `JSX node text` | Export PDF (.pdf) | **Izvoz u PDF (.pdf)** |
| [NavInvoiceRow.tsx:L308](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/table/NavInvoiceRow.tsx#L308) | `JSX node text` | Ismeretlen partner | **— (Prevesti na HR)** |
| [NavInvoiceRow.tsx:L399](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/table/NavInvoiceRow.tsx#L399) | `JSX node text` | Levonható: | **— (Prevesti na HR)** |
| [NavInvoiceRow.tsx:L403](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/table/NavInvoiceRow.tsx#L403) | `JSX node text` | Nem levonható: | **— (Prevesti na HR)** |
| [NavInvoiceRow.tsx:L711](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/table/NavInvoiceRow.tsx#L711) | `JSX node text` | Kattintson az összerendeléshez és jóváhagyáshoz! | **— (Prevesti na HR)** |
| [NavInvoiceRow.tsx:L787](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/table/NavInvoiceRow.tsx#L787) | `JSX node text` | Számlatételek megtekintése | **— (Prevesti na HR)** |
| [SubmittedInvoiceRow.tsx:L213](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/table/SubmittedInvoiceRow.tsx#L213) | `JSX node text` | Ismeretlen partner | **— (Prevesti na HR)** |
| [SubmittedInvoiceRow.tsx:L367](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/table/SubmittedInvoiceRow.tsx#L367) | `JSX node text` | Levonható: | **— (Prevesti na HR)** |
| [SubmittedInvoiceRow.tsx:L371](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/table/SubmittedInvoiceRow.tsx#L371) | `JSX node text` | Nem levonható: | **— (Prevesti na HR)** |
| [SubmittedInvoiceRow.tsx:L429](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/table/SubmittedInvoiceRow.tsx#L429) | `JSX node text` | Kikontírozott / Könyvelve jelölés | **— (Prevesti na HR)** |
| [SubmittedInvoiceRow.tsx:L489](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/table/SubmittedInvoiceRow.tsx#L489) | `JSX node text` | Számlatételek megtekintése | **— (Prevesti na HR)** |
| [SubmittedInvoiceRow.tsx:L547](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/table/SubmittedInvoiceRow.tsx#L547) | `JSX node text` | Számla szerkesztése | **— (Prevesti na HR)** |
| [InvoiceImagePreview.tsx:L165](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceImagePreview.tsx#L165) | `prop:title` | Számla előnézet | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L1835](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L1835) | `prop:title` | A tétel szövegében időszak szerepel. Kattintson az időbeli elhatárolás v... | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L1853](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L1853) | `prop:title` | Időbeli elhatárolás (AIE / PIE) varázsló | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L2152](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L2152) | `prop:title` | T ↔ K kézileg felcserélve | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L2537](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L2537) | `prop:title` | Tartozik és Követel oldal megcserélése (T ↔ K) | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L2867](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L2867) | `prop:placeholder` | Válassz áfakódot... | **— (Prevesti na HR)** |
| [SupplierInvoiceAssignment.tsx:L237](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/SupplierInvoiceAssignment.tsx#L237) | `prop:placeholder` | Keresés bizonylatsorszám vagy szállító alapján... | **— (Prevesti na HR)** |
| [InvoiceDataExportDialog.tsx:L469](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceDataExportDialog.tsx#L469) | `prop:placeholder` | Keresés bizonylatszám, partner vagy összeg alapján... | **— (Prevesti na HR)** |
| [InvoiceGlAccountSelector.tsx:L224](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceGlAccountSelector.tsx#L224) | `prop:placeholder` | Válassz... | **— (Prevesti na HR)** |
| [InvoiceItemAccrualModal.tsx:L388](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemAccrualModal.tsx#L388) | `prop:placeholder` | ÉÉÉÉ-HH-NN | **— (Prevesti na HR)** |
| [InvoiceItemRulesManager.tsx:L376](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L376) | `prop:placeholder` | Keresés szabálynév, minta, főkönyvi szám vagy partner alapján... | **— (Prevesti na HR)** |
| [InvoiceItemRulesManager.tsx:L461](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L461) | `prop:title` | Szerkesztés | **Uredi** |
| [InvoiceItemRulesManager.tsx:L470](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L470) | `prop:title` | Törlés | **Obriši** |
| [InvoiceItemRulesManager.tsx:L488](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L488) | `prop:placeholder` | pl. Telekom számlák kontírozása | **— (Prevesti na HR)** |
| [InvoiceItemRulesManager.tsx:L498](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L498) | `prop:placeholder` | pl. Telekom, Üzemanyag, Előfizetés... | **— (Prevesti na HR)** |
| [InvoiceItemRulesManager.tsx:L570](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L570) | `prop:placeholder` | Partner neve... | **— (Prevesti na HR)** |
| [InvoiceItemRulesManager.tsx:L576](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceItemRulesManager.tsx#L576) | `prop:placeholder` | Partner adószáma... | **— (Prevesti na HR)** |
| [InvoiceRuleQuickSaveDialog.tsx:L223](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/InvoiceRuleQuickSaveDialog.tsx#L223) | `prop:placeholder` | pl. Üzemanyag, Könyvelési díj, Licenc... | **— (Prevesti na HR)** |
| [ManualInvoiceCreateDialog.tsx:L627](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L627) | `prop:placeholder` | pl. Partner Kft. | **— (Prevesti na HR)** |
| [ManualInvoiceCreateDialog.tsx:L641](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L641) | `prop:placeholder` | pl. Ügyfél Kft. | **— (Prevesti na HR)** |
| [ManualInvoiceCreateDialog.tsx:L895](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx#L895) | `prop:placeholder` | Tétel megnevezése | **— (Prevesti na HR)** |
| [NavInvoicePicker.tsx:L151](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/manual-create/NavInvoicePicker.tsx#L151) | `prop:placeholder` | Keresés sorszám, partner vagy összeg szerint... | **— (Prevesti na HR)** |
| [TransactionMultiPicker.tsx:L154](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/manual-create/TransactionMultiPicker.tsx#L154) | `prop:placeholder` | Keresés közlemény vagy összeg szerint... | **— (Prevesti na HR)** |
| [GeneralLedgerBadgeSection.tsx:L22](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/expanded-row/GeneralLedgerBadgeSection.tsx#L22) | `prop:title` | A számlatételek gazdasági tartalma szerinti árbevétel (9-es számlaosztál... | **— (Prevesti na HR)** |
| [MatchedTransactionsSection.tsx:L182](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/expanded-row/MatchedTransactionsSection.tsx#L182) | `prop:placeholder` | Keresés leírás, összeg vagy típus alapján... | **— (Prevesti na HR)** |
| [NavInvoiceRow.tsx:L52](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/table/NavInvoiceRow.tsx#L52) | `prop:placeholder` | Válassz... | **— (Prevesti na HR)** |
| [NavInvoiceRow.tsx:L322](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/table/NavInvoiceRow.tsx#L322) | `prop:title` | A vevő neve a beküldött saját számláról származik | **— (Prevesti na HR)** |
| [NavInvoiceRow.tsx:L610](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/table/NavInvoiceRow.tsx#L610) | `prop:aria-label` | Kikontírozva statusz valtoztatasa | **— (Prevesti na HR)** |
| [SubmittedInvoiceRow.tsx:L424](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/table/SubmittedInvoiceRow.tsx#L424) | `prop:aria-label` | Kikontírozva statusz valtoztatasa | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L2678](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L2678) | `table header / option label` | Belföldi vevők (HUF) | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L2679](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L2679) | `table header / option label` | Külföldi vevők (Deviza) | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L2680](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L2680) | `table header / option label` | Kapcsolt vállalkozás | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L2682](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L2682) | `table header / option label` | Belföldi szállítók (HUF) | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L2683](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L2683) | `table header / option label` | Külföldi szállítók (Deviza) | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L2684](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L2684) | `table header / option label` | Belföldi szolgáltatók | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L2685](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L2685) | `table header / option label` | Szállítók (összevont) | **— (Prevesti na HR)** |
| [InvoiceItemsDialog.tsx:L2686](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx#L2686) | `table header / option label` | Egyéb kötelezettségek | **— (Prevesti na HR)** |
| [UploadedFilesModal.tsx:L70](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/UploadedFilesModal.tsx#L70) | `table header / option label` | Számlák | **Računi** |
| ... | ... | *(További 46 elem a teljes JSON leltárban)* | ... |


---

## 🔑 5. Hiányzó vagy Nem Szinkronizált i18n Szótárkulcsok

| Forrás és sorszám | Elem | Megjelenő magyar szöveg | Javasolt horvát (HR) fordítás |
| :--- | :--- | :--- | :--- |
| [InvoiceFullEditDialog.tsx:L583](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceFullEditDialog.tsx#L583) | `t('invoices:dialogs.full_edit.totals_recalculated_title') missing in hr/invoices.json` | Összegek újraszámolva | **— (Prevesti na HR)** |
| [InvoiceFullEditDialog.tsx:L584](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceFullEditDialog.tsx#L584) | `t('invoices:dialogs.full_edit.totals_recalculated_desc') missing in hr/invoices.json` | A fejléc összegeit sikeresen frissítettük a tételek alapján. | **— (Prevesti na HR)** |
| [InvoiceFullEditDialog.tsx:L690](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceFullEditDialog.tsx#L690) | `t('invoices:dialogs.full_edit.amounts_section') missing in hr/invoices.json` | Összegek | **— (Prevesti na HR)** |
| [InvoiceFullEditDialog.tsx:L699](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceFullEditDialog.tsx#L699) | `t('invoices:dialogs.full_edit.recalculate_tooltip') missing in hr/invoices.json` | Fejléc összegek újraszámolása a tételek összegéből | **— (Prevesti na HR)** |
| [InvoiceFullEditDialog.tsx:L702](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceFullEditDialog.tsx#L702) | `t('invoices:dialogs.full_edit.recalculate_btn') missing in hr/invoices.json` | Újraszámolás a tételekből | **— (Prevesti na HR)** |
| [InvoiceFullEditDialog.tsx:L773](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceFullEditDialog.tsx#L773) | `t('invoices:columns.payment_method') missing in hr/invoices.json` | Fizetés módja | **— (Prevesti na HR)** |
| [InvoiceFullEditDialog.tsx:L1001](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceFullEditDialog.tsx#L1001) | `t('invoices:dialogs.full_edit.sync_to_header') missing in hr/invoices.json` | Fejléc összegek frissítése a tételekből | **— (Prevesti na HR)** |
| [InvoiceImageDialog.tsx:L315](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceImageDialog.tsx#L315) | `t('invoices:dialogs.image.submitted_voucher') missing in hr/invoices.json` | Beküldött Bizonylat | **— (Prevesti na HR)** |
| [InvoiceImageDialog.tsx:L320](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceImageDialog.tsx#L320) | `t('invoices:dialogs.image.submitted_source_desc') missing in hr/invoices.json` | Feldolgozott számla adatai | **— (Prevesti na HR)** |
| [InvoiceImageDialog.tsx:L331](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceImageDialog.tsx#L331) | `t('invoices:dialogs.image.submitted_data') missing in hr/invoices.json` | Beküldött bizonylat | **— (Prevesti na HR)** |
| [InvoiceImageDialog.tsx:L363](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceImageDialog.tsx#L363) | `t('invoices:dialogs.image.gross_total') missing in hr/invoices.json` | Bruttó végösszeg | **— (Prevesti na HR)** |
| [InvoiceImageDialog.tsx:L379](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceImageDialog.tsx#L379) | `t('invoices:dialogs.image.no_physical_image_submitted_desc') missing in hr/invoices.json` | A bizonylat adatai strukturáltan rögzítésre kerültek a rendszerben. Fizi... | **— (Prevesti na HR)** |
| [UploadedFilesModal.tsx:L297](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/UploadedFilesModal.tsx#L297) | `t('invoices:status.processed') missing in hr/invoices.json` | Feldolgozva | **Obrađeno** |
| [UploadedFilesModal.tsx:L300](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/UploadedFilesModal.tsx#L300) | `t('invoices:status.processing') missing in hr/invoices.json` | Folyamatban | **U tijeku** |
| [UploadedFilesModal.tsx:L306](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/UploadedFilesModal.tsx#L306) | `t('common:status.ignored') missing in hr/common.json` | Mellőzve | **— (Prevesti na HR)** |
| [UploadedFilesModal.tsx:L308](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/UploadedFilesModal.tsx#L308) | `t('invoices:status.cmr_attached') missing in hr/invoices.json` | Dok. párosítva | **— (Prevesti na HR)** |
| [UploadedFilesModal.tsx:L310](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/UploadedFilesModal.tsx#L310) | `t('invoices:status.cmr_orphaned') missing in hr/invoices.json` | Vár a számlára | **— (Prevesti na HR)** |
| [UploadedFilesModal.tsx:L312](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/UploadedFilesModal.tsx#L312) | `t('invoices:status.cmr_escalated') missing in hr/invoices.json` | Eszkaláció | **— (Prevesti na HR)** |
| [UploadedFilesModal.tsx:L314](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/UploadedFilesModal.tsx#L314) | `t('invoices:status.pending') missing in hr/invoices.json` | Függőben | **Na čekanju** |
| [InvoiceStatusTables.tsx:L283](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/InvoiceStatusTables.tsx#L283) | `t('dashboard:inbound_status.more_invoices_count') missing in hr/dashboard.json` | db számla | **— (Prevesti na HR)** |
| [InvoiceStatusTables.tsx:L290](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/InvoiceStatusTables.tsx#L290) | `t('dashboard:inbound_status.missing_notice_label') missing in hr/dashboard.json` | Beküldésre vár: | **— (Prevesti na HR)** |
| [InvoiceStatusTables.tsx:L293](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/InvoiceStatusTables.tsx#L293) | `t('dashboard:inbound_status.pieces') missing in hr/dashboard.json` | db számlakép | **— (Prevesti na HR)** |
| [RecentInvoices.tsx:L94](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/RecentInvoices.tsx#L94) | `t('dashboard:recent_invoices.empty_desc') missing in hr/dashboard.json` | A beérkező számlák a feldolgozás után automatikusan itt fognak megjelenni. | **— (Prevesti na HR)** |
| [RecentInvoices.tsx:L173](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/RecentInvoices.tsx#L173) | `t('dashboard:recent_invoices.preview_title') missing in hr/dashboard.json` | Számlakép megtekintése | **— (Prevesti na HR)** |
| [ManualPaymentDialog.tsx:L67](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualPaymentDialog.tsx#L67) | `t('common:errors.unexpected') missing in hr/common.json` | Nem sikerült rögzíteni a kifizetést. | **— (Prevesti na HR)** |
| [StornoSettleDialog.tsx:L71](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/StornoSettleDialog.tsx#L71) | `t('common:errors.unexpected') missing in hr/common.json` | A művelet nem sikerült. Kérjük próbálja újra. | **— (Prevesti na HR)** |
| [InvoiceApprovalDialog.tsx:L128](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/dialogs/InvoiceApprovalDialog.tsx#L128) | `t('common:errors.unexpected') missing in hr/common.json` | Kérjük próbálja újra. | **— (Prevesti na HR)** |
| [SuggestedInvoiceLinkDialog.tsx:L80](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/dialogs/SuggestedInvoiceLinkDialog.tsx#L80) | `t('common:errors.unexpected') missing in hr/common.json` | Nem sikerült az összerendelés végrehajtása. | **— (Prevesti na HR)** |
| [InvoiceNotesSection.tsx:L360](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/expanded-row/InvoiceNotesSection.tsx#L360) | `t('common:cancel') missing in hr/common.json` | Mégse | **Odustani** |
| [InvoiceNotesSection.tsx:L373](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/expanded-row/InvoiceNotesSection.tsx#L373) | `t('common:save') missing in hr/common.json` | Mentés | **Spremi** |
| [InvoiceFilterBar.tsx:L72](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/filters/InvoiceFilterBar.tsx#L72) | `t('invoices:filters.date_basis_issue_tooltip') missing in hr/invoices.json` | Kibocsátás kelte: számlák hivatalos kiállítási dátuma alapján gyűjti és ... | **— (Prevesti na HR)** |
| [InvoiceFilterBar.tsx:L86](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/filters/InvoiceFilterBar.tsx#L86) | `t('invoices:filters.date_basis_delivery_tooltip') missing in hr/invoices.json` | Teljesítés dátuma: a gazdasági teljesítés napja alapján gyűjti és szűri ... | **— (Prevesti na HR)** |
| [InvoiceFilterBar.tsx:L452](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/filters/InvoiceFilterBar.tsx#L452) | `t('invoices:filters.vat_rate') missing in hr/invoices.json` | ÁFA-kulcs | **— (Prevesti na HR)** |
| [InvoiceFilterBar.tsx:L457](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/filters/InvoiceFilterBar.tsx#L457) | `t('invoices:filters.vat_rate_all') missing in hr/invoices.json` | Minden ÁFA-kulcs | **— (Prevesti na HR)** |
| [InvoiceHeader.tsx:L97](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/header/InvoiceHeader.tsx#L97) | `t('invoices:actions.accounting_rules') missing in hr/invoices.json` | Könyvelési szabályok | **Računovodstvena pravila** |
| [useGlInvoiceDocumentResolver.ts:L90](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useGlInvoiceDocumentResolver.ts#L90) | `t('accounting:general_ledger.doc_resolver.not_found_title') missing in hr/accounting.json` | Bizonylat nem található | **Nema podataka** |
| [useGlInvoiceDocumentResolver.ts:L367](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useGlInvoiceDocumentResolver.ts#L367) | `t('common:error') missing in hr/common.json` | Hiba történt | **Došlo je do greške** |


---

## 🚀 6. Moduláris Javítási Javaslat

1. A modulban szereplő hardkódolt feliratokat ki kell szervezni a `src/locales/hu/invoices.json` és `src/locales/hr/invoices.json` fájlokba.
2. A `toast({{ title: '...', description: '...' }})` hívásoknál kötelező bevezetni a `t('{ns}:toasts.title')` és `t('{ns}:toasts.desc')` formátumot.
3. A táblázatokban és badge-ekben szereplő hardkódolt magyar string literálokat (`'Fizetve'`, `'Függőben'`) fel kell váltani a központi állapotfordító segédfüggvénnyel vagy szótári kulccsal.
