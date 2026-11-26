# 🛠️ Příkazy pro Build, Aktualizace a Poznámky k aplikaci

## 🚨 0. Závazná pravidla pro vývojáře (AI Agent Code Guidelines)
*Tato pravidla jsou striktně vyžadována a dodržována při každé úpravě projektu.*

1. **🌐 100% Internacionalizace (Všech 7 jazyků současně):**
   - Jakýkoliv nový UI text, popisek, tlačítko, chybová zpráva nebo nadpis **nesmí být zapsán natvrdo česky** v komponentách (`.tsx`).
   - Všechny texty musí být okamžitě přidány do `src/utils/i18n.ts` pro **všech 7 podporovaných jazyků** (`cs`, `sk`, `en`, `de`, `pl`, `es`, `fr`).

2. **💬 Pravidlo "Návrh ➔ Schválení ➔ Realizace":**
   - Před jakoukoliv úpravou kódu vývojář **nejprve v chatu předloží stručný a jasný návrh řešení**.
   - Kód se upravuje **až po výslovném potvrzení uživatele** (*"ok"*, *"ano"*, *"realizuj"*).

3. **🐙 Automatická synchronizace na GitHub:**
   - Po každé schválené a provedené úpravě kódu se automaticky spustí `git add .`, `git commit` s výstižným anglickým popisem změn a `git push origin master`.

4. **🛡️ Nedotknutelnost fungujícího kódu:**
   - Zásadně nerozbíjet ani nepřemazávat již funkční okolní komponenty, logiku ani zavedené datové struktury ve Firebase Firestore.

5. **🚀 Tiché neblokující EAS Updates:**
   - Odesílání bezdrátových aktualizací (`eas update`) probíhá na pozadí, bez zbytečných a otravných čekacích smyček v chatu.

6. **⚡ Okamžitá odezva UI (Optimistic Updates):**
   - Interaktivní tlačítka (docházka, Jdu/Nejdu) musí vizuálně reagovat v paměti zařízení okamžitě bez čekání na databázi a bez problikávání celého seznamu.

---

## ⚡ 1. Rychlé aktualizace vzduchem (EAS Update)
*Používá se pro rychlé změny v JavaScriptu / TypeScriptu (změny v UI, textech, funkcích bez nových nativních knihoven).*

- **Aktualizace aktivní produkční větve (Android i iOS):**
  ```bash
  npm run update:prod
  ```
  *(nebo přímý příkaz: `set EAS_SKIP_AUTO_FINGERPRINT=1&& eas update --branch production --environment production`)*

- **Aktualizace testovací větve (preview):**
  ```bash
  npm run update:preview
  ```

---

## 🤖 2. Sestavení pro Android (Build APK)
*Používá se, když se přidají nové pluginy/nativní moduly do telefonu.*

- **Vygenerování instalačního souboru APK:**
  ```bash
  eas build --platform android --profile preview
  ```
  *Výsledkem je odkaz na stažení souboru `.apk`, který lze přímo nainstalovat do telefonu.*

- **Kontrola stavu posledního sestavení v terminálu:**
  ```bash
  eas build:list --platform android --limit 1
  ```

---

## 🍏 3. Sestavení pro iOS (iPhone / iPad)

- **A) Odeslání přímo do TestFlightu (Apple Developer účet):**
  ```bash
  eas build --platform ios --profile production --auto-submit
  ```
  *Expo sestaví balíček na Macu a automaticky jej nahraje do App Store Connect / TestFlight.*

- **B) Vygenerování IPA pro instalaci přes kabel (Sideloadly / AltStore):**
  ```bash
  eas build --platform ios --profile sideload
  ```

---

## 🚀 4. Sestavení pro obě platformy naráz (Android + iOS)

- **Spustit sestavení pro Android i iOS současně (vyčištění mezipaměti):**
  ```bash
  eas build --platform all --profile preview --clear-cache
  ```

---

## 🩺 5. Diagnostika a kontrola projektu

- **Kontrola zdraví projektu a kompatibility knihoven:**
  ```bash
  npx expo-doctor
  ```

- **Automatická oprava verzí balíčků dle verze Expo SDK:**
  ```bash
  npx expo install --fix
  ```

---

## 📝 6. Uživatelské poznámky
*(Zde budeme postupně zapisovat další vaše poznámky a instrukce dle potřeby)*

- **Účet Expo (EAS):** Aktivní plán Starter.
- **Aktivní kanál pro aktualizace v aplikaci:** `production`.

## 7. Novinky


### Zápis Akcí do nativních Kalendářů pomocí expo-calendar
Tento koncept řeší zápis (ukládání) událostí z aplikace přímo do systémového sdíleného kalendáře v telefonu.

**Jak to bude fungovat na straně uživatele:**
1. Každý člen kapely (který chce funkci používat) musí mít ve svém iPhonu/Androidu již běžně nasdílen a povolen kalendář kapely (např. přes svůj Google/Apple účet na úrovni systému iOS/Android).
2. Při prvním uložení nebo úpravě koncertu/zkoušky se aplikace přes `expo-calendar` podívá na všechny dostupné kalendáře, které daný telefon zná.
3. Kapelník/člen si v aplikaci (např. v nastavení kapely nebo při prvním startu) jednou "vybere" ten svůj lokální kapelní kalendář ze seznamu, do kterého má aplikace sahat. Jejich systémové ID se uloží lokálně (do `AsyncStorage` jako `localSyncCalendarId`).
4. **Zápis:** Kdykoli uživatel (kapelník nebo člen pro absence) klikne na tlačítko "Uložit" v `events.tsx`, aplikace:
   - A) Pošle data do Firebase.
   - B) Paralelně si přes `Calendar.createEventAsync(localSyncCalendarId, ...)` zapíše tu samou událost nativně do telefonu.
5. Zbytek zařídí operační systém. Protože uživatel zapsal událost do systémového kalendáře, který je synchronizovaný na iCloud nebo Google, mobil ji sám od sebe propíše na server, odkud se hned sesynchronizuje ostatním do jejich telefonů.

**Výhoda:** Naprosto "blbuvzdorné". Nemusíme do aplikace vkládat Google API klíče, dělat složitý backend ani se trápit s OAuth právy k cizím účtům. Pokud člen smaže nebo edituje událost, aplikace zavolá `Calendar.updateEventAsync` nebo `Calendar.deleteEventAsync` (pomocí lokálního ID události, které si navážeme do záznamu koncertu ve Firebase).

---

## 💡 8. Návrhy na vylepšení a plánované funkce

### 🎸 Hraní a zkoušení
- **Pódiový režim (Stage Mode):** Režim zpěvníku s černým pozadím, obřími písmeny, zamezením zhasínání displeje a podporou přepínání písniček přes Bluetooth pedál na pódiu.
- **Tisk / Export Setlistu do PDF:** Jedním klikem vygenerovat čistý A4 setlist na pódium ke stažení do PDF nebo tisku před koncertem.
- **Optický Metronom ve Zpěvníku:** Nastavení BPM u písničky a optické blikání tempa na kraji displeje při zkoušce.
- **Offline Zpěvník:** Automatická záloha textů a akordů do paměti telefonu pro hraní na místech bez signálu (sklepy, hrady, lesní festivaly).
- **Transpozice Akordů ve Zpěvníku:** Tlačítko `+1` / `-1` půltónu pro okamžité automatické přetransponování akordů.

### 🚐 Logistika, financování a správa
- **Kalkulačka cestovních náhrad (Cesťák):** Automatický výpočet ceny benzínu/našlapaných km na koncert podle auta vybraného z garáže kapely.
- **Přikládání účtenek k Pokladně:** Možnost vyfotit papírovou účtenku (za benzín, struny, blány) a přiložit ji přímo k výdeji v Pokladně.
- **Harmonogram Dne Akce (Day Sheet / Run of Show):** Podrobný časový plán dne minutu po minutě (*Sraz ➔ Příjezd ➔ Zvukovka ➔ Večeře ➔ Koncert ➔ Odjezd*).
- **Katalog Pořadatelů & Klubů:** Databáze kontaktů na pořadatele a zvukaře s hodnocením a poznámkami z minulých hraní.

### 🎛️ Technika & Zvuk
- **Interaktivní Zvukařský Input List (Channel Strip):** Tabulka zvukařských vstupů (*Kopák: Mic 1, Basa: DI 1, Zpěv 1: XLR...*) s možností poslat pořadateli a zvukaři jediný odkaz před akcí.
- **Interaktivní Editor Stageplanu:** Rychlé poskládání rozestavení nástrojů na pódiu (bicí, aparáty, odposlechy) s okamžitým exportem do PDF.
- **Servisní Deník Nástrojů & Dodávky:** Připomínky na výměnu strun, výměnu elektronek v zesilovači, seřízení nástrojů nebo výměnu oleje a technickou kontrolu kapelního auta.

### 🎙️ Tvorba, statistiky a fanklub
- **Banka Hudebních Nápadů (Voice Memos):** Rychlé nahrání kytarového riffu nebo melodie z mobilu na zkoušce, přiřazení k pracovnímu názvu písničky a sdílení ostatním pro poslech v autě.
- **Kapelní Statistiky:** Přehledné grafy – kolik koncertů kapela odehrála za rok, celkový výdělek, nejčastěji hrané písničky a procentuální docházka členů na zkouškách.
- **Generátor Plakátů na Socials:** Jedním klikem vytvořit z koncertu hezký grafický obrázek (Story) pro sdílení na Instagram / Facebook.
- **Evidování a prodej Merche:** Jednoduché počítadlo triček, CD a placek prodeje na stánku během koncertu.
- **Hlasování o Přídavek:** Fanoušci přihlášení do fanklubu mohou před koncertem v aplikaci hlasovat, jakou bonusovou písničku chce dav slyšet jako přídavek.

### 🎉 Speciální funkce pro Fanoušky
- **Digitální Karta Fanklubu (Fan Pass):** Digitální průkazka s QR kódem pro slevu na merch nebo nápoj zdarma na koncertě.
- **Živý Odpočet do Koncertu:** Animovaný odpočet dní, hodin a minut do startu nejbližšího koncertu přímo na hlavní stránce.
- **Přidat Koncert do Osobního Kalendáře:** Uložení koncertu do osobního kalendáře v mobilu jedním kliknutím s připomínkou.
- **Zákulisní Setlist po Koncertu:** Zobrazení seznamu odehraných písniček s možností lajkovat/srdíčkovat oblíbené songy.
- **Písnička na Přání:** Možnost poslat kapelníkům vzkaz/přání na písničku před koncertem.
- **Notifikace podle Města / Kraje:** Upozornění do mobilu pouze při vyhlášení nového koncertu v blízkém okolí fanouška.
- **Fotostěna od Fanoušků:** Nahrávání vlastních fotek z davu pod pódiem do schvalovaného alba ve Fotogalerii.
- **Rychlá Navigace na Místo Koncertu (GPS):** Tlačítko pro spuštění Waze / Google Maps s přesnou adresou klubu nebo festivalu.
- **Pozvat Přátele na Akci:** Generování pozvánky s odkazem do WhatsAppu / Messengeru na 1 klik.
- **Soutěže o Lístky:** Bleskové soutěže přímo v aplikaci o volné vstupenky na nadcházející koncert.
- **30s Zvukové Ukázky Písniček:** Přehrávač krátkých audio ukázek studiových nahrávek.
- **Digitální Podpis Kapely:** Možnost nechat si podepsat virtuální podpiskartu členy kapely na displeji mobilu.

### 📱 Inspirace u Světových Aplikací (Bandsintown, Spotify, MasterTour, Setlist.fm)
- **Tlačítko "Zúčastním se / Jdu" (Bandsintown style):** Tlačítko u koncertu, které zvýší počítadlo fanoušků chystajících se na akci a ukáže ostatním, kolik lidí z fanklubu dorazí.
- **Oficiální Odkazy na Vstupenky (Ticket Links):** Tlačítko *"Koupit lístek"* u akce, které fanouška přesměruje přímo na GoOut, Ticketportal nebo web pořadatele.
- **Hudební Přehrávač Singlů (Spotify style):** Přehrávač nejnovějších skladeb kapely na pozadí aplikace při prohlížení fotogalerie či akcí.
- **Archiv Minulých Koncertů & Vzpomínky (Setlist.fm style):** Historie všech proběhlých koncertů s počtem návštěvníků, fotkami a videoklipy z dané noci.
- **Automatický Export do Google / Apple Kalendáře (iCal Feed):** Unikátní odkaz pro každou kapelu, který si členové vloží do iPhonu/Androidu a kalendář se jim aktualizuje sám bez otevírání aplikace.
- **Rychlý Souhrn pro Zvukaře (Gig Sheet PDF):** Stažení jednopránkového přehledu pro zvukaře/pořadatele obsahujícího Input List, Stageplan a Časový harmonogram v 1 souboru.
- **Garáž & Správa Výbavy (Gear Inventory):** Seznam kapelních nástrojů, mikrofonů a beden se sériovými čísly a pořizovací cenou pro případ pojištění nebo ztráty.

### 🤖 Automatizace, AI a Interaktivita (Gemini, Gamifikace & Výkon)
- **Hlasové Dotazy na Aplikaci (AI Voice Assistant):** Hlasové dotazy typu *"Kdy máme zkoušku?"* nebo *"Kde je sobota koncert?"* bez proklikávání menu.
- **Automatické Připomínky Nepotvrzené Docházky:** Upozornění členům 48 hodin před akcí, pokud nepotvrdili docházku.
- **Inteligentní Generátor Setlistu:** Automatické sestavení 60minutového setlistu podle tempa (BPM), tónin a oblíbenosti u fanoušků.
- **Generátor Smluv o Vystoupení v PDF:** Předvyplněné smlouvy o vystoupení v PDF pro pořadatele na 1 kliknutí.
- **Žebříček a Odznaky pro Fanoušky:** Odznaky pro věrné fanoušky (*Super Fanoušek*, *Věrný člen*, *Dopisovatel*).
- **Digitální Kolo Štěstí na Merch:** Zatočení kolem štěstí 1x za měsíc o slevové kupony na merch nebo pivo.
- **Rychlé Ankety Uvnitř Kapely (Band Polls):** Hlasování členů kapely o termínech, tričkách či playlistu.
- **A/B Porovnávač Verzí Nahrávek:** Přepínání tlačítkem A/B pro porovnání nahrávky zkoušky se starým a novým aranžmá.

### 💳 Monetizace, Zákulisí & Komunita
- **Dobrovolné Vstupné / Dýška Kapely (Digital Tipping):** Možnost pro fanoušky poslat kapela drobné "dýško" na benzin/album přes QR kód nebo platební bránu na 1 klik.
- **Exkluzivní Zákulisní Videa (Backstage Shorts):** Krátká 15s videa ze šatny, zkoušky nebo cesty na koncert jen pro přihlášené fanoušky.
- **Předobjednávky Merche s Vyzvednutím na Koncertě (Pre-Order Merch):** Rezervace trička konkrétní velikosti v aplikaci s předáním na stánku podle QR kódu.
- **Živé Oznámení na Koncertě (Live Stage Broadcast):** Notifikace do mobilu fanoušků v klubu *"Za 3 minuty začínáme!"*.
- **Akordy a Tabulátory pro Muzikanty:** Zobrazení oficiálních akordů a kytarových tabulatur pro fanoušky, kteří hrají na nástroj.
- **Lokační Hra "Razítko z Koncertu" (GPS Check-in):** Získání digitálního razítka v aplikaci za fyzickou účast na koncertě po ověření GPS polohy.
- **Předprodejní Exkluzivní Přístup pro Fanklub:** Možnost pro členy fanklubu koupit si lístky na koncert o 24 hodin dříve než veřejnost.
- **Bazar Použité Výbavy Kapely (Band Flea Market):** Sekce, kde kapela může fanouškům nabídnout k prodeji staré kytarové pedály, činely nebo podepsané blány.
- **Widget na Plochu Mobilu (Android / iOS Widget):** Miniaplikace na plochu telefonu zobrazující název a datum příštího koncertu bez otevírání apky.
