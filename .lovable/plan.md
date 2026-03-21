
Célzott audit eredménye:

1. A polling fallback nem 1x fut le, hanem 2x
- A `src/pages/ManualUpload.tsx` fájlban a `pollForProcessed` helper kétszer van meghívva:
  - `pollForProcessed(5000)`
  - `pollForProcessed(15000)`
- Tehát jelenleg 5 mp és 15 mp után kérdez rá.

2. Azért nem jött értesítés, mert a feldolgozás később történt meg, mint a 2 poll
- Az utolsó 4 feltöltésnél a `salary_files` rekordok kb. `15:56:08–11` között jöttek létre.
- A hozzájuk tartozó `salary` sorok csak kb. `15:56:32–35` között jelentek meg.
- Ez azt jelenti, hogy a tényleges feldolgozás kb. 21–27 másodperccel később készült el.
- Emiatt:
  - az 5 mp-es poll túl korai volt
  - a 15 mp-es poll is túl korai volt
  - így egyik sem találta meg a feldolgozott sorokat, ezért nem jelent meg toast

3. A másodlagos realtime trigger sem tudott elsülni
- A `LiveNotificationProvider` jelenleg két salary-alapú sikeres értesítési úton dolgozik:
  - `salary` INSERT esemény → toast
  - `salary_files` UPDATE, ha `status === 'completed'` → toast
- Az adatbázisban a mostani 4 fájl státusza nem `completed`, hanem `webhook_sent`.
- Emiatt a `salary_files` UPDATE ágon sem keletkezik toast.
- Közben a `salary` INSERT realtime események továbbra sem látszanak megbízhatóan a kliensen.

Következtetés:
- A mostani fallback logika nem elég hosszú.
- A mostani státusz-logika sem elég jó, mert a tényleges feldolgozás után is `webhook_sent` marad a rekord.
- Ezért most három védelmi réteg közül mindhárom hibázik:
  1. realtime `salary` INSERT nem érkezik meg
  2. `salary_files.status` nem vált `completed`-re
  3. a polling túl hamar leáll

Javítási terv:

1. Polling fallback átírása fix 2 próbáról valódi retry ciklusra
- A `ManualUpload.tsx`-ben a 2 darab fix `setTimeout` helyett készítek egy bounded polling loopot.
- Példa működés:
  - 5 másodpercenként ellenőriz
  - maximum 60–90 másodpercig
  - azonnal leáll, ha a feldolgozás kész
- Ellenőrzési feltétel:
  - van legalább 1 `salary` sor az adott `salary_file_id`-hez
  - vagy a `salary_files.status` már terminális sikeres állapotba került

2. A siker feltételét bővítem
- Nem csak `completed` státuszt fogunk elfogadni.
- A jelenlegi rendszerben a `webhook_sent` azt jelenti, hogy a webhook elment, de ez önmagában még nem garantál feldolgozást.
- Ezért a toast elsődleges feltétele a kapcsolódó `salary` sor(ok) megjelenése lesz.
- A státusz csak másodlagos jel marad.

3. DB-oldali állapotzárás bevezetése
- Javasolt adatbázis-javítás:
  - amikor beszúródik az első `salary` rekord egy `salary_file_id`-hez, a parent `salary_files.status` automatikusan váltson `completed`-re
- Ezt egy egyszerű DB triggerrel lehet stabilan megoldani.
- Előny:
  - a rendszer állapota valós lesz
  - a `LiveNotificationProvider` meglévő `status === 'completed'` logikája is használhatóvá válik
  - az upload history is konzisztens marad

4. LiveNotificationProvider megerősítése
- Kiegészítem úgy, hogy salary feldolgozásnál ne csak realtime eventre támaszkodjon.
- Beépítek egy globális fallback ellenőrzést a friss, még nem jelzett salary feltöltésekre.
- Így akkor is tud toastot küldeni, ha a feltöltő oldal már nem aktív, vagy a realtime esemény kimarad.

5. Naplózás a végső validáláshoz
- Ideiglenesen részletes console logokat tennék be:
  - mikor indul a poll
  - melyik próbálkozásnál jár
  - mikor talál `salary` sort
  - mikor küldi ki a toastot
  - mikor tiltja le a duplikációt a deduplikáló logika
- Így egy következő feltöltésnél pontosan vissza lehet követni az egész folyamatot.

Érintett fájlok:
- `src/pages/ManualUpload.tsx`
- `src/components/LiveNotificationProvider.tsx`
- új Supabase migration a `salary_files -> completed` triggerhez

Várható eredmény a javítás után:
- ha a feldolgozás 20–40 másodperc múlva készül el, akkor is megjön az értesítés
- a toast nem csak realtime INSERT-re fog támaszkodni
- a `salary_files` állapot ténylegesen lezáródik `completed`-re
- a bérek/járulékok sikeres feldolgozása stabilan jelezhető lesz
