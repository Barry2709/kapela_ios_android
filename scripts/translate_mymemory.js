const fs = require('fs');

async function translateTextMyMemory(text, targetLang) {
  if (!text || text.trim() === '') return text;

  // Clean text before sending
  const cleanText = text.trim();
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanText)}&langpair=en|${targetLang}`;

  try {
    const res = await fetch(url);
    const json = await res.json();
    if (json && json.responseData && json.responseData.translatedText) {
      let tText = json.responseData.translatedText;
      // Fix uppercase response if mymemory returns weird uppercase
      if (tText.toUpperCase() === tText && cleanText.toUpperCase() !== cleanText) {
        tText = tText.charAt(0).toUpperCase() + tText.slice(1).toLowerCase();
      }
      return tText;
    }
  } catch (e) {
    console.error(`Error translating "${cleanText}":`, e.message);
  }
  return text;
}

async function runLang(lang, langName) {
  const enKeys = JSON.parse(fs.readFileSync('en_keys.json', 'utf8'));
  const keys = Object.keys(enKeys);
  const result = {};

  console.log(`Translating ${keys.length} keys to ${langName} (${lang}) via MyMemory...`);

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const enText = enKeys[key];

    let tText = await translateTextMyMemory(enText, lang);
    tText = tText.replace(/\{\s*([a-zA-Z0-9_]+)\s*\}/g, '{$1}');

    // Overrides for navigation and settings
    if (key === 'settings.language.system') {
      if (lang === 'es') tText = 'Predeterminado del sistema';
      if (lang === 'fr') tText = 'Par défaut du système';
    }
    if (key === 'settings.language.cs') tText = 'Čeština';
    if (key === 'settings.language.sk') tText = 'Slovenčina';
    if (key === 'settings.language.en') tText = 'English';
    if (key === 'settings.language.de') tText = 'Deutsch';
    if (key === 'settings.language.pl') tText = 'Polski';
    if (key === 'settings.language.es') tText = 'Español';
    if (key === 'settings.language.fr') tText = 'Français';

    if (key === 'nav.home') {
      if (lang === 'es') tText = 'Inicio';
      if (lang === 'fr') tText = 'Accueil';
    }
    if (key === 'nav.events') {
      if (lang === 'es') tText = 'Eventos';
      if (lang === 'fr') tText = 'Événements';
    }
    if (key === 'nav.repertoire') {
      if (lang === 'es') tText = 'Repertorio';
      if (lang === 'fr') tText = 'Répertoire';
    }
    if (key === 'nav.treasury') {
      if (lang === 'es') tText = 'Tesorería';
      if (lang === 'fr') tText = 'Trésorerie';
    }
    if (key === 'nav.band') {
      if (lang === 'es') tText = 'Banda';
      if (lang === 'fr') tText = 'Groupe';
    }

    result[key] = tText;

    if (i > 0 && i % 50 === 0) {
      console.log(`[${lang.toUpperCase()}] ${i}/${keys.length} keys processed...`);
      // Save progress
      fs.writeFileSync(`${lang}_keys.json`, JSON.stringify(result, null, 2));
    }
    await new Promise(r => setTimeout(r, 120));
  }

  fs.writeFileSync(`${lang}_keys.json`, JSON.stringify(result, null, 2));
  console.log(`Saved ${lang}_keys.json successfully!`);
}

async function main() {
  await runLang('es', 'Spanish');
  await runLang('fr', 'French');
  console.log('All MyMemory translations finished!');
}

main();
