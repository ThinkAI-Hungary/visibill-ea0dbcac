import sys
import asyncio
import os
from dotenv import load_dotenv
import litellm

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
    from prompts import get_prompt
    prompt = get_prompt("vamhatarozat")
    
    # Enable litellm debugging
    litellm.set_verbose = True
    
    try:
        response = await litellm.acompletion(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": f"COMPANY_NAME: VICTORIA MUSIC KFT.\nCOMPANY_TAX: 12970553\n\nOCR text:\n{OCR_TEXT}"}
            ],
            temperature=0.0,
            max_tokens=4096
        )
        print("Success!")
        print("Finish Reason:", response.choices[0].finish_reason)
        print("Content:", response.choices[0].message.content)
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    asyncio.run(main())
