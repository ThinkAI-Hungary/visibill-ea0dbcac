
A probléma oka megvan: a jelenlegi `src/index.css` felülírja az összes Sonner toast alapállapotát így:

```css
[data-sonner-toaster] [data-sonner-toast] {
  translate: calc(100% + 2rem) 0;
  opacity: 0;
}
```

Ez minden meglévő toastot is ugyanabból a jobb oldali “belépési sávból” renderel újra, miközben a Sonner közben átszámolja a saját függőleges `transform: var(--y)` pozícióját. Emiatt a régebbi toast először az új toast szintjére kerül vizuálisan, ráfed, majd csak utána rendeződik feljebb. A feltöltött képek pontosan ezt a hibát mutatják.

Megvalósítási terv:

1. Sonner animációs override újratervezése `src/index.css`-ben
- El kell távolítani a mostani globális `translate` alapállapotot a teljes `[data-sonner-toast]` selectorból.
- Nem szabad minden toastot “offscreen” állapotba tenni.
- A vízszintes animációt csak a valóban belépő/kilépő toastokra szabad alkalmazni.

2. Belépő toast animáció szűkítése az új, front toast-ra
- A Sonner saját állapotaira kell építeni:
  - `data-mounted="true"`
  - `data-front="true"`
  - `data-expanded="true"`
- A cél, hogy csak az újonnan érkező toast csússzon be jobbról a saját végső függőleges helyére.
- A régebbi toastoknál csak a Sonner eredeti `transform 400ms` vertical reflow-ja maradjon aktív.

3. Kilépő toast animáció külön kezelése
- A kimenő toastnál nem a teljes listát kell eltolni vízszintesen.
- A front toast removal állapotára célzott szabály kell, ami jobbra kicsúsztatja az eltűnő elemet, miközben a többiek csak függőlegesen rendeződnek át.
- A Sonner eredeti `--y` logikáját meg kell tartani, nem szabad nullázni vagy globálisan lecserélni.

4. A jelenlegi CSS ütközések megszüntetése
- A mostani blokk:
  ```css
  [data-sonner-toaster] [data-sonner-toast] { ... }
  [data-mounted="true"] { ... }
  [data-removed="true"] { ... }
  ```
  teljes cserére szorul.
- A Sonner saját alap CSS-e szerint a toastok:
  - `position: absolute`
  - `transform: var(--y)`
  - `transition: transform 400ms, opacity 400ms, height 400ms`
- Erre kell ráépíteni úgy, hogy a vízszintes motion ne írja felül a teljes lista viselkedését.

5. Sonner konfiguráció ellenőrzése
- A `src/components/ui/sonner.tsx` alapján ezek rendben vannak és maradhatnak:
  - `position="bottom-right"`
  - `expand={true}`
  - `gap={10}`
  - `visibleToasts={6}`
- Az `App.tsx`-ben a Sonner toaster megfelelően be van kötve.
- A régi Radix toaster (`src/components/ui/toaster.tsx`) jelenleg még mountolva van `App.tsx`-ben; ha nem használt vizuálisan, érdemes az implementáláskor ellenőrizni, nincs-e zavaró mellékhatása, de a konkrét overlap hibát most a Sonner CSS override okozza.

6. Elfogadási kritériumok
A javítás akkor tekinthető késznek, ha:
- Az első toast jobbról balra becsúszik.
- A második az első fölé érkezik, saját sávjába csúszva, overlap nélkül.
- A harmadik ugyanígy a második fölé érkezik.
- Új toast érkezésekor a régebbi toastok nem jelennek meg az új toast szintjén egy pillanatra sem.
- Lejáratkor csak az eltűnő toast csúszik ki jobbra, a többi kizárólag függőlegesen rendeződik át.

Technikai megjegyzés:
A helyes irány nem a teljes `transform` lecserélése és nem a teljes listára adott `translate` alapállapot, hanem egy célzott enter/exit megoldás, ami a Sonner saját `var(--y)` stack-elését békén hagyja. A jelenlegi hiba éppen abból ered, hogy most minden toast ugyanazzal a horizontális kezdőállapottal indul, nem csak az új.
