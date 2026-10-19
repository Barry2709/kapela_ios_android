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
