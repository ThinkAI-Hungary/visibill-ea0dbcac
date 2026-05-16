-- ============================================================
-- ÁFA BEVALLÁS — Seed: 2665 Sor Struktúra Referencia
-- ============================================================
-- Ez a fájl NEM hoz létre táblát, hanem egy lookup-táblát tölt fel
-- a 2665-ös nyomtatvány minden releváns sorával.
-- A frontend ezt használja a táblázat renderelésére.

CREATE TABLE IF NOT EXISTS vat_form_rows (
  row_number TEXT PRIMARY KEY,
  section TEXT NOT NULL,       -- 'payable', 'deductible', 'settlement', 'detail', 'm_sheet'
  page TEXT NOT NULL,          -- 'A-01', 'A-02', 'A-03', 'A-05'
  label TEXT NOT NULL,
  has_base BOOLEAN DEFAULT true,
  has_tax BOOLEAN DEFAULT true,
  is_summary BOOLEAN DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0
);

ALTER TABLE vat_form_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vat_form_rows_read" ON vat_form_rows FOR SELECT USING (true);

-- A-01: Fizetendő általános forgalmi adó (01-36)
INSERT INTO vat_form_rows (row_number, section, page, label, has_base, has_tax, is_summary, sort_order) VALUES
  ('01', 'payable', 'A-01', 'Közösségen kívülre történő termékértékesítés, szolgáltatásnyújtás', true, true, false, 10),
  ('02', 'payable', 'A-01', 'Közösségen belülre történő, adólevonási joggal járó adómentes termékértékesítés', true, true, false, 20),
  ('03', 'payable', 'A-01', 'Új közlekedési eszköz Közösségen belülre történő értékesítésének összege', true, false, false, 30),
  ('04', 'payable', 'A-01', 'Áfa tv. 142. §-a szerinti termékértékesítés, szolgáltatásnyújtás és az adólevonással járó adómentes belföldi értékesítés ellenértéke', true, false, false, 40),
  ('110', 'payable', 'A-01', '0 %-os kulcs alá tartozó értékesítés', true, false, false, 50),
  ('05', 'payable', 'A-01', '5 %-os kulcs alá tartozó értékesítés', true, true, false, 60),
  ('06', 'payable', 'A-01', '18 %-os kulcs alá tartozó értékesítés', true, true, false, 70),
  ('07', 'payable', 'A-01', '27 %-os kulcs alá tartozó értékesítés', true, true, false, 80),
  ('08', 'payable', 'A-01', 'Közérdekű vagy egyéb speciális jellegére tekintettel adómentes értékesítés', true, false, false, 90),
  ('09', 'payable', 'A-01', 'Különleges eljárással megállapított adó', true, true, false, 100),
  ('10', 'payable', 'A-01', 'Saját vállalkozáson belül végzett beruházás után fizetendő adó', true, true, false, 110),
  ('11', 'payable', 'A-01', 'Közösségen belülről történő adómentes termékbeszerzés', true, false, false, 120),
  ('112', 'payable', 'A-01', 'Közösségen belülről történő 0 %-os kulcs alá tartozó termékbeszerzés', true, false, false, 125),
  ('12', 'payable', 'A-01', 'Közösségen belülről történő 5 %-os kulcs alá tartozó termékbeszerzés', true, true, false, 130),
  ('13', 'payable', 'A-01', 'Közösségen belülről történő 18 %-os kulcs alá tartozó termékbeszerzés', true, true, false, 140),
  ('14', 'payable', 'A-01', 'Közösségen belülről történő 27 %-os kulcs alá tartozó termékbeszerzés', true, true, false, 150),
  ('15', 'payable', 'A-01', 'Közösségen belülről történő új közlekedési eszköz beszerzés (27 %-os adómérték)', true, true, false, 160),
  ('16', 'payable', 'A-01', 'Közösségen belülről történő jövedéki termékbeszerzés (27 %-os adóérték)', true, true, false, 170),
  ('17', 'payable', 'A-01', 'Adómentes szolgáltatás igénybevétel (közösségi adóalanyok és harmadik országbeli adóalanytól)', true, false, false, 180),
  ('18', 'payable', 'A-01', 'Közösségi adóalanytól igénybe vett szolgáltatás utáni adófizetési kötelezettség (27 %-os adómérték)', true, true, false, 190),
  ('19', 'payable', 'A-01', 'Közösségi adóalanytól igénybe vett szolgáltatás utáni egyéb adófizetési kötelezettség', true, true, false, 200),
  ('113', 'payable', 'A-01', 'Közösségen belül az Áfa tv. 91. § (2) bek. szerinti ügylet esetén a beszerzőt termelő termékértékesítés címén fizetendő 0 %-os mértékű adóalap', true, false, false, 205),
  ('20', 'payable', 'A-01', 'Közösségen belül az Áfa tv. 91. § (2) bek. szerinti ügylet: 5%-os mértékű adója', true, true, false, 210),
  ('21', 'payable', 'A-01', 'Közösségen belül az Áfa tv. 91. § (2) bek. szerinti ügylet: 18%-os mértékű adója', true, true, false, 220),
  ('22', 'payable', 'A-01', 'Közösségen belül az Áfa tv. 91. § (2) bek. szerinti ügylet: 27%-os mértékű adója', true, true, false, 230),
  ('23', 'payable', 'A-01', 'Adómentes termékimport', true, false, false, 240),
  ('114', 'payable', 'A-01', '0 %-os mértékű termékimport', true, false, false, 245),
  ('24', 'payable', 'A-01', 'Termékimport címén fizetendő 5 %-os mértékű adó', true, true, false, 250),
  ('25', 'payable', 'A-01', 'Termékimport címén fizetendő 18 %-os mértékű adó', true, true, false, 260),
  ('26', 'payable', 'A-01', 'Termékimport címén fizetendő 27 %-os mértékű adó', true, true, false, 270),
  ('27', 'payable', 'A-01', 'Harmadik országbeli adóalanytól igénybevett szolgáltatás utáni adófizetési kötelezettség', true, true, false, 280),
  ('28', 'payable', 'A-01', 'Az Áfa tv. 32. §, 34. § szerinti termékbeszerzés (27 %-os adómérték)', true, true, false, 290),
  ('29', 'payable', 'A-01', 'Az Áfa tv. 142. §-a alapján a fordított adózás szabályai szerint fizetendő adó', true, true, false, 300),
  ('30', 'payable', 'A-01', 'Az Áfa tv. 99. § (9) bekezdés alapján fizetendő adót csökkentő tétel', true, true, false, 310),
  ('31', 'payable', 'A-01', 'Az Áfa tv. 153/C. § alapján adót növelő tétel összesen', true, true, false, 320),
  ('35', 'payable', 'A-01', 'Egyéb', true, true, false, 330),
  ('36', 'payable', 'A-01', 'Összesen (01-35. sorok, 110. és 112-114. sorok)', true, true, true, 340),

  -- A-02: Részletező + Levonható (37-71)
  ('37', 'detail', 'A-02', 'Az Áfa tv. 98. §-a szerinti termékexport ellenértéke a 01. sorból', true, false, false, 400),
  ('38', 'detail', 'A-02', 'Adóraktárba beraktározott és ott továbbértékesített vagy kiraktározott áruk ellenértéke', true, false, false, 410),
  ('39', 'detail', 'A-02', 'Közösségi beszerzésből származó, adóraktárba adómentesen beraktározott áru ellenértéke a 11. sor összegéből', true, false, false, 420),
  ('40', 'detail', 'A-02', 'Közösségi megbízás alapján belföldön történő fel- vagy összeszereléstárgyát képező termékértékesítések összege a 05-07. sorokból', true, false, false, 430),
  ('41', 'detail', 'A-02', 'Távolsági értékesítés összege a 05-07. sorokból', true, false, false, 440),
  ('42', 'detail', 'A-02', 'Közösségi megbízás alapján belföldön történő fel- vagy összeszereléstárgyát képező termékbeszerzés összege a 28. sorból', true, false, false, 450),
  ('43', 'detail', 'A-02', 'Tárgyieszköz-értékesítés a 36. sor összegéből (apport nélkül)', true, true, false, 460),
  ('44', 'detail', 'A-02', 'Apportértékesítés a 36. sor összegéből', true, true, false, 470),
  ('45', 'detail', 'A-02', 'Előleg címén kapott összeg a 05-07. sorok összegéből', true, false, false, 480),
  ('46', 'detail', 'A-02', 'Előleg címén kapott összeg a 01. és 04. sorok összegéből', true, false, false, 490),
  ('47', 'detail', 'A-02', 'Közösségen belülre, nem adóalany részére történő új közlekedési eszköz értékesítése a 03. sorból', true, false, false, 500),
  ('48', 'detail', 'A-02', 'Jövedékiadó-tartalom a 11., 16. sorok adóalapjában', true, false, false, 510),
  ('49', 'detail', 'A-02', 'Az utazásszervezési szolgáltatásnyújtás után fizetendő adó a 09. sor összegéből', true, true, false, 520),
  ('50', 'detail', 'A-02', 'Az Áfa tv. XVI. fejezete alá tartozó értékesítés adója a 09. sor összegéből', true, true, false, 530),
  ('51', 'detail', 'A-02', 'A fordított adózás szabályai szerint ingatlan után fizetendő adó a 29. sor összegéből', true, false, false, 540),
  ('52', 'detail', 'A-02', 'A fordított adózás szabályai szerint hulladék után fizetendő adó a 29. sor összegéből', true, false, false, 550),
  ('53', 'detail', 'A-02', 'A fordított adózás szabályai szerint az üvegházhatású gáz kibocsátására jogosító vagyoni értékű jog átruházása esetén fizetendő adó a 29. sor összegéből', true, true, false, 560),
  ('54', 'detail', 'A-02', 'Az Áfa tv. 142. §-ban meghatározott fordított adózás szabályai szerinti szolgáltatás igénybevétele esetén fizetendő adó a 29. sor összegéből', true, false, false, 570),
  ('55', 'detail', 'A-02', 'Közösségen belülre, illetve belföldre történő értékesítésből az adóraktározási eljárás kapcsán adóbiztosítékkal érintett értékesítés adója a 36. sor összegéből', true, false, false, 580),
  ('56', 'detail', 'A-02', 'Az importáló által teljesített, Közösségen belülre történő értékesítésből az adómentes termékimport kapcsán adóbiztosítékkal érintett értékesítés a 02. sorból', true, false, false, 590),
  ('57', 'detail', 'A-02', 'Az importáló/az adófizetésre kötelezett által teljesített, de a közvetett vámjogi képviselő/az adóraktár üzemeltetője által bevallott, Közösségen belülre történő adómentes értékesítés összege a 02. sorból', true, false, false, 600),
  ('58', 'detail', 'A-02', 'Az 57. sor szerinti adózó által teljesített/bevallott, Közösségen belülre történő új közlekedési eszköz adómentes értékesítésének összege a 03. sorból', true, false, false, 610),
  ('59', 'detail', 'A-02', 'Az importáló által teljesített, de a közvetett vámjogi képviselő által önadózás keretében bevallott adómentes termékimport összege a 23. sorból', true, false, false, 620),
  ('60', 'detail', 'A-02', 'Az importáló által teljesített, de a közvetett vámjogi képviselő által önadózás keretében bevallott 5 %-os adókulcsú termékimport összege a 24. sorból', true, true, false, 630),
  ('61', 'detail', 'A-02', 'Az importáló által teljesített, de a közvetett vámjogi képviselő által önadózás keretében bevallott 18 %-os adókulcsú termékimport összege a 25. sorból', true, true, false, 640),
  ('62', 'detail', 'A-02', 'Az importáló által teljesített, de a közvetett vámjogi képviselő által önadózás keretében bevallott 27 %-os adókulcsú termékimport összege a 26. sorból', true, true, false, 650),

  -- LEVONHATÓ ÁFA (63-79)
  ('63', 'deductible', 'A-02', 'Adómentes belföldi termékbeszerzés adóalapja', true, false, false, 700),
  ('111', 'deductible', 'A-02', '0 %-os kulcs alá tartozó belföldi termékbeszerzés, szolgáltatás után', true, false, false, 705),
  ('64', 'deductible', 'A-02', '5 %-os kulcs alá tartozó belföldi termékbeszerzés, szolgáltatás után', true, true, false, 710),
  ('65', 'deductible', 'A-02', '18 %-os kulcs alá tartozó belföldi termékbeszerzés, szolgáltatás után', true, true, false, 720),
  ('66', 'deductible', 'A-02', '27 %-os kulcs alá tartozó belföldi termékbeszerzés, szolgáltatás után', true, true, false, 730),
  ('67', 'deductible', 'A-02', 'Harmadik országbeli és közösségi adóalanytól igénybe vett szolgáltatás, illetve saját nevében beszerző terméket saját nevében beszerzőként fizetett adóból levonható összeg', true, true, false, 740),
  ('68', 'deductible', 'A-02', 'Arányosítás alkalmazásával levonható adórész (Eredeti adóalap, arányosított adó)', true, true, false, 750),
  ('69', 'deductible', 'A-02', 'Közösségen belüli termékbeszerzés után levonható adó összege', true, true, false, 760),
  ('70', 'deductible', 'A-02', 'Importált termék után (kivetéssel) megfizetett adó levonható része', true, true, false, 770),
  ('71', 'deductible', 'A-02', 'Importált termék után (önadózással) megfizetett adó levonható része', true, true, false, 780),

  -- A-03: Levonható folyt. (72-79)
  ('72', 'deductible', 'A-03', '7 %-os mértékű mezőgazdasági kompenzációs felár', true, true, false, 800),
  ('73', 'deductible', 'A-03', '12 %-os mértékű mezőgazdasági kompenzációs felár', true, true, false, 810),
  ('74', 'deductible', 'A-03', 'Saját vállalkozáson belül végzett beruházás után', true, true, false, 820),
  ('75', 'deductible', 'A-03', 'Egyéb', true, true, false, 830),
  ('76', 'deductible', 'A-03', 'Összesen (63-75. sorok és 111. sor összege)', true, true, true, 840),
  ('77', 'deductible', 'A-03', 'Tárgyi eszköz beszerzése után levonható adó összege a 76. sor összegéből (apport nélkül)', true, false, false, 850),
  ('78', 'deductible', 'A-03', 'Apportbeszerzés után levonható adó összege a 76. sor összegéből', true, false, false, 860),
  ('79', 'deductible', 'A-03', 'Saját vállalkozásban megvalósuló, még nem aktivált beruházás összege a 76. sor összegéből', true, true, false, 870),

  -- ELSZÁMOLÁS (82-86)
  ('82', 'settlement', 'A-03', 'Előző időszakról beszámítható csökkentő tétel összege (előző időszak 86. sor / manuális)', false, true, false, 900),
  ('83', 'settlement', 'A-03', 'Tárgyidőszakban megállapított fizetendő adó együttes összegének és a levonható előzetesen felszámított adónak a különbözete (36. sor - 76. sor - 82. sor)', false, true, true, 910),
  ('84', 'settlement', 'A-03', 'Befizetendő adó összege (a 83. sor adata, ha előjel nélküli)', false, true, false, 920),
  ('85', 'settlement', 'A-03', 'Visszaigényelhető adó összege (a negatív előjelű 83. sor, ha visszaigénylésre egyébként jogosult)', false, true, false, 930),
  ('86', 'settlement', 'A-03', 'Következő időszakra átvihető követelés összege', false, true, false, 940),

  -- A-05: M-lap összesítő (105-109)
  ('105', 'm_sheet', 'A-05', 'Termékbeszerzés / szolgáltatás-igénybevétel számlatételeinek összege összesen', true, true, true, 1000),
  ('106', 'm_sheet', 'A-05', 'Termékbeszerzés / szolgáltatás-igénybevétel tételesen részletezett korrekcióinak összege összesen', true, true, true, 1010),
  ('108', 'm_sheet', 'A-05', 'Összesítő jelentésekben szereplő termékbeszerzés / szolgáltatás-igénybevétel összege összesen (A 105., 106. sorok adata összesen)', true, true, true, 1020),
  ('109', 'm_sheet', 'A-05', 'A levonásba helyezett, áthárított adó számított összege meghaladja az összesítő jelentésekben szereplő összesen adó összeget', false, true, false, 1030)
ON CONFLICT (row_number) DO NOTHING;
