import sys
import asyncio
import os
from datetime import date
from dotenv import load_dotenv

sys.path.insert(0, r'c:\Users\adetw\.antigravity\visibill\visibill-worker')
os.chdir(r'c:\Users\adetw\.antigravity\visibill\visibill-worker')

load_dotenv()

OCR_TEXT = """
NEMZETI ADÓ- ÉS VÁMHIVATAL
Nemzeti Adó- és Vámhivatal Dél-Budapesti Adó- és Vámiga

Iktatószám: 7405619570

Adózó / Ügyfél: VICTORIA MUSIC KFT.
Adószám / adóazonosító 12970553
EORI-szám: HU0000292539
Lakcím / Székhely: 1024 Budapest,
Fény utca 15.

Ügyszám: 7405618430
Pénzügyi azonosító: 10128AF0DN4KL0
Ügyintéző: Rotter Dóra, őrmester

Telefonszám: 1-278-3160
Tárgy: Vámtartozás közlése
Melléklet: -

VÁMUNO KFT
1051 Budapest, Hercegprímás utca 2
Közvetlen képviselő útján

VICTORIA MUSIC KFT.
1024 Budapest, Fény utca 15.

HATÁROZAT

A 26HUI0128A0ES1YLR1 számon benyújtott vám-árunyilatkozattal kapcsolatban az alábbi fizetési kötelezettsége keletkezett:

Összeg (Ft) Számlaszám
Végleges antidömping vám 0 -
Végleges kiegyenlítő vám 0 -
Behozatali vám 99514
Behozatali vámok összesen: 99500 10032000-01820203

Felfüggesztett jövedéki adó 0 -
Jövedéki adó összesen: 0 10032000-01037612
Felfüggesztett dohány általános forgalmi adó 0 -
Felfüggesztett általános forgalmi adó 0 -

Általános forgalmi adó összesen: 968324 10032000-01037203

A keletkezett fizetési kötelezettséget az elfogadott árunyilatkozaton feltüntetett fizetési mód szerint kell teljesíteni.
Fizetési határidő: a határozat közlését követő naptól számított 10. nap. Az előírt összeget a fenti pénzügyi azonosítóra hivatkozással, a vám és egyéb terhek megfizetésére vonatkozó vámjogszabályi

Nemzeti Adó- és Vámhivatal Dél-Budapesti Adó- és Vámigazgatósága
1096 Budapest Haller utca 3-5. Telefon: 1-299-4000
https://nav.gov.hu/ugyfeliranytu/ha-levelet-kap-a-nav-tol/ha-levelet-kap-a-nav-

A dokumentumot elektronikusan hitelesítette
Nemzeti Adó- és Vámhivatal
2026.05.26. 09:11
"""

async def main():
    from processor import process_ocr_text
    from models import VamhatarozatOutput

    print("Running process_ocr_text...")
    invoice_type, extraction, error_msg, responses = await process_ocr_text(
        OCR_TEXT,
        company_name="VICTORIA MUSIC KFT.",
        company_tax="12970553",
        document_category="invoice"
    )

    print("--- RESULT ---")
    print(f"invoice_type: {invoice_type}")
    print(f"error_msg: {error_msg}")
    if extraction:
        print(f"Extraction class: {extraction.__class__.__name__}")
        print(f"szamlaszam: {extraction.szamlaszam}")
        print(f"reference_number: {extraction.reference_number}")
        print(f"adojogi_megjegyzes: {extraction.adojogi_megjegyzes}")
        print(f"kibocsatas_datuma: {extraction.kibocsatas_datuma}")
        print(f"fizetesi_hatarido: {extraction.fizetesi_hatarido}")
        print(f"adoalap_osszesen: {extraction.adoalap_osszesen}")
        print(f"afa_osszeg_osszesen: {extraction.afa_osszeg_osszesen}")
        print(f"brutto_vegosszeg: {extraction.brutto_vegosszeg}")
        print(f"vevo_nev: {extraction.vevo_nev}")
        print(f"vevo_vat_id: {extraction.vevo_vat_id}")

        assert invoice_type == "vamhatarozat"
        assert isinstance(extraction, VamhatarozatOutput)
        assert extraction.szamlaszam == "10128AF0DN4KL0"
        assert extraction.reference_number == "7405619570"
        assert extraction.adojogi_megjegyzes == "26HUI0128A0ES1YLR1"
        assert extraction.adoalap_osszesen == 99500.0
        assert extraction.afa_osszeg_osszesen == 968324.0
        assert extraction.brutto_vegosszeg == 1067824.0
        assert extraction.kibocsatas_datuma == date(2026, 5, 26)
        # Note: 2026-05-26 + 10 days = 2026-06-05
        assert extraction.fizetesi_hatarido == date(2026, 6, 5)

        print("\nALL PIPELINE CHECKS PASSED SUCCESSFULLY!")
    else:
        print("EXTRACTION FAILED!")

if __name__ == "__main__":
    asyncio.run(main())
