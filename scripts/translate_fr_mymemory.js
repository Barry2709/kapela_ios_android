const fs = require('fs');

async function translateTextMyMemory(text, targetLang) {
  if (!text || text.trim() === '') return text;

  const cleanText = text.trim();
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanText)}&langpair=en|${targetLang}&de=devtest982@gmail.com`;

  try {
    const res = await fetch(url);
    const json = await res.json();
    if (json && json.responseData && json.responseData.translatedText) {
      let tText = json.responseData.translatedText;
      // If MyMemory returns warning HTML/text fallback to text
      if (tText.includes('Mymemory warning') || tText.includes('MYMEMORY WARNING')) {
        return text;
      }
      return tText;
    }
  } catch (e) {
    console.error(`Error translating "${cleanText}":`, e.message);
  }
  return text;
}

async function runFR() {
  const enKeys = JSON.parse(fs.readFileSync('en_keys.json', 'utf8'));
  const keys = Object.keys(enKeys);
  const result = {};

  console.log(`Translating ${keys.length} keys to French (fr) via MyMemory + Email...`);

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const enText = enKeys[key];

    let tText = await translateTextMyMemory(enText, 'fr');
    tText = tText.replace(/\{\s*([a-zA-Z0-9_]+)\s*\}/g, '{$1}');

    if (key === 'settings.language.system') tText = 'Par défaut du système';
    if (key === 'settings.language.cs') tText = 'Čeština';
    if (key === 'settings.language.sk') tText = 'Slovenčina';
    if (key === 'settings.language.en') tText = 'English';
    if (key === 'settings.language.de') tText = 'Deutsch';
    if (key === 'settings.language.pl') tText = 'Polski';
    if (key === 'settings.language.es') tText = 'Español';
    if (key === 'settings.language.fr') tText = 'Français';

    if (key === 'nav.home') tText = 'Accueil';
    if (key === 'nav.events') tText = 'Événements';
    if (key === 'nav.repertoire') tText = 'Répertoire';
    if (key === 'nav.treasury') tText = 'Trésorerie';
    if (key === 'nav.band') tText = 'Groupe';

    result[key] = tText;

    if (i > 0 && i % 50 === 0) {
      console.log(`[FR] ${i}/${keys.length} keys processed...`);
      fs.writeFileSync('fr_keys.json', JSON.stringify(result, null, 2));
    }
    await new Promise(r => setTimeout(r, 100));
  }

  fs.writeFileSync('fr_keys.json', JSON.stringify(result, null, 2));
  console.log('Saved fr_keys.json successfully!');
}

runFR();
