# Decision 023: Tárgyi Eszközök

**Status:** Decided

**Category:** Pénzügyi Modulok

**Question:** Hogyan kezeli a rendszer a tárgyi eszközöket és az értékcsökkenést?

**Decision:**
- Teljes életciklus: active → disposed / sold / missing
- Értékcsökkenés: lineáris módszer, TAO sablonok (11 sablon), rate override lehetőség
- Aktiválási workflow: asset_events tábla (activation, transfer, disposal, inventory_check, value_change, reactivation)
- Számla-alapú eszköz létrehozás (source_invoice_id, source_invoice_type: submitted/nav)
- Dokumentum csatolás (documents JSONB), telephelyhez rendelés (location_id)
- GL szám hozzárendelés (gl_account_id)
- VTSZ/TESZOR kód rögzítés

**Rationale:** A magyar számviteli törvénynek megfelelő tárgyi eszköz nyilvántartás szükséges. A TAO sablonok biztosítják a helyes adóalap számítást. Az aktiválási workflow audit trail-t biztosít.
