-- Run this in Supabase SQL Editor to seed the notes templates
INSERT INTO public.annual_report_notes_templates (section_key, section_title, default_text, order_num, is_required, category) VALUES
('general_info', 'I. Általános információk', 'A társaság a Számvitelről szóló 2000. évi C. törvény előírásai szerint, a kettős könyvvitel szabályainak megfelelően vezeti könyveit.

A beszámoló a Sztv. szerinti éves beszámoló formájában készül.

A mérleg fordulónapja: tárgyév december 31.
A mérlegkészítés időpontja: a beszámoló aláírásának napja.', 1, true, 'general_info'),

('accounting_policy', 'II. Számviteli politika összefoglalása', 'A társaság a Számviteli politikáját a Sztv. előírásaival összhangban alakította ki. A számviteli politika tartalmazza az értékelési eljárásokat, az értékcsökkenési leírás módszereit, és a leltározási szabályzatot.

Az üzleti év megegyezik a naptári évvel.
A könyvvezetés pénzneme: magyar forint (HUF).', 2, true, 'general_info'),

('valuation_methods', 'III. Értékelési eljárások', 'Az immateriális javak és a tárgyi eszközök értékelése: bekerülési értéken, csökkentve az elszámolt értékcsökkenéssel.

A készletek értékelése: bekerülési értéken (FIFO módszerrel).
A követelések értékelése: könyv szerinti értéken, szükség esetén értékvesztés elszámolásával.
A pénzeszközök értékelése: könyv szerinti értéken.
A kötelezettségek értékelése: könyv szerinti értéken.', 3, true, 'valuation'),

('depreciation_methods', 'IV. Értékcsökkenési leírás módszerei', 'A társaság a tárgyi eszközök és immateriális javak után lineáris módszerrel számolja el az értékcsökkenést.

Az alkalmazott leírási kulcsok:
- Épületek: 2%
- Gépek, berendezések: 14,5%
- Járművek: 20%
- Számítástechnikai eszközök: 33%
- 100.000 Ft alatti eszközök: egyösszegű leírás', 4, true, 'valuation'),

('asset_movement', 'V. Tárgyi eszközök bruttó érték alakulása', 'A tárgyi eszközök bruttó értékének és halmozott értékcsökkenésének változását az alábbi táblázat mutatja be.', 5, true, 'asset_details'),

('receivables_info', 'VI. Követelések és kötelezettségek', 'A társaság követelései és kötelezettségei lejárat szerint:

- Éven belüli követelések: a mérlegben szereplő összeg
- Éven túli követelések: nincs
- Éven belüli kötelezettségek: a mérlegben szereplő összeg
- Éven túli kötelezettségek: nincs', 6, false, 'asset_details'),

('equity_changes', 'VII. Saját tőke változásának bemutatása', 'A saját tőke összetevőinek változását az alábbi táblázat mutatja.', 7, true, 'equity'),

('employee_info', 'VIII. Létszám- és személyi jellegű ráfordítások', 'A társaság foglalkoztatottainak átlagos statisztikai létszáma a tárgyévben: ___ fő.

Személyi jellegű ráfordítások:
- Bérköltség: ___ Ft
- Bérjárulékok: ___ Ft', 8, false, 'other'),

('off_balance_sheet', 'IX. Mérlegen kívüli tételek', 'A társaságnak a mérleg fordulónapján mérlegen kívüli kötelezettségei és követelései nincsenek.', 9, false, 'other'),

('subsequent_events', 'X. Mérlegfordulónap utáni események', 'A mérleg fordulónapja és a mérlegkészítés időpontja között a társaság vagyoni, pénzügyi és jövedelmi helyzetét érintő lényeges esemény nem történt.', 10, false, 'other')
ON CONFLICT (section_key) DO NOTHING;
