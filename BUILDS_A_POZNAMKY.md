# 🛠️ Příkazy pro Build, Aktualizace a Poznámky k aplikaci

Tento soubor slouží jako přehledný manuál všech klíčových příkazů pro sestavování balíčků (APK / IPA), odesílání do TestFlightu a rychlé aktualizace vzduchem (OTA).

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
3. Kapelník/člen si v aplikaci (např. v nastavení kapely nebo při prvním startu) jednou "vybere" ten svůj lokální kapelní kalendář ze seznamu, do kterého má aplikace sahat. Její systémové ID se uloží lokálně (do `AsyncStorage` jako `localSyncCalendarId`).
4. **Zápis:** Kdykoli uživatel (kapelník nebo člen pro absence) klikne na tlačítko "Uložit" v `events.tsx`, aplikace:
   - A) Pošle data do Firebase.
   - B) Paralelně si přes `Calendar.createEventAsync(localSyncCalendarId, ...)` zapíše tu samou událost nativně do telefonu.
5. Zbytek zařídí operační systém. Protože uživatel zapsal událost do systémového kalendáře, který je synchronizovaný na iCloud nebo Google, mobil ji sám od sebe propíše na server, odkud se hned sesynchronizuje ostatním do jejich telefonů.

**Výhoda:** Naprosto "blbuvzdorné". Nemusíme do aplikace vkládat Google API klíče, dělat složitý backend ani se trápit s OAuth právy k cizím účtům. Pokud člen smaže nebo edituje událost, aplikace zavolá `Calendar.updateEventAsync` nebo `Calendar.deleteEventAsync` (pomocí lokálního ID události, které si navážeme do záznamu koncertu ve Firebase).
