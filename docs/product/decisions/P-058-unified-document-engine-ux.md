# P-058 — Egységes Export & Dokumentumgeneráló Motor (DocumentEngine) UX

**Dátum:** 2026-08-31  
**Státusz:** ✅ Decided  
**Kategória:** Felhasználói Élmény / Dokumentum és Adat Export  
**Érintett képernyők:** Számlák, Tranzakciók, Főkönyv, Bérszámfejtés, Pénztár, ÁFA bevallás, Éves beszámoló

---

## Kontextus

A felhasználók rendszeresen exportálnak adatokat különböző formátumokban (PDF nyomtatványok, Excel/CSV táblázatok, NAV ÁNYK XML nyomtatványok). A korábbi működés során eltérő volt a fájlelnevezés, a letöltési folyamat visszajelzése, és egyes böngészőkben az Excel hibásan kezelte a magyar ékezetes CSV fájlokat (UTF-8 BOM hiánya miatt).

---

## Döntés

1. **Egységes Letöltési és Visszajelzési Élmény:**
   - Minden export művelet automatikusan zöld Toast értesítést ad a letöltés indulásakor (`"<Dokumentum név> sikeresen exportálva (<FORMÁTUM>)"`).
   - A letöltött fájlok neve egységes struktúrát követ: `<bizonylat_tipus>_<ceg_vagy_azonosito>_<datum>.<kiterjesztes>`.
2. **Magyar Excel Kompatibilitás (UTF-8 BOM):**
   - Minden CSV export automatikusan megkapja az `\uFEFF` Byte Order Mark (BOM) előtagot, így a Microsoft Excel dupla kattintásra is hibátlanul, helyes magyar ékezetekkel nyitja meg a táblázatokat.
3. **Azonnali Előnézet és Nyomtatás:**
   - A bérjegyzékek, kifizetési jegyzékek, ÁFA bevallások és éves beszámolók esetén elérhető a megtekintés / nyomtatás új böngészőfülön vagy beágyazott modális ablakban.

---

## Következmények
* Megbízható, egységes export folyamat minden felületen.
* 0 karakterkódolási panasz Excel megnyitáskor.
* Zökkenőmentes ÁNYK import a hivatalos NAV nyomtatványokhoz.

---

## Kapcsolódó
- ADR: [A-063: Unified DocumentEngine Architecture](../../architecture/decisions/A-063-unified-document-engine-architecture.md)
- BRD: [046: Unified DocumentEngine Business Rules](../../business/decisions/046-unified-document-engine.md)
