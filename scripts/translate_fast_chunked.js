const fs = require('fs');

async function translateChunk(texts, targetLang) {
  const DELIMITER = ' ||| ';
  const joinedText = texts.join(DELIMITER);

  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(joinedText)}`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    let fullTranslated = '';
    if (json && json[0]) {
      json[0].forEach(item => {
        if (item[0]) fullTranslated += item[0];
      });
    }

    if (!fullTranslated) return texts;

    // Split back
    const parts = fullTranslated.split('|||').map(s => s.trim());
    if (parts.length === texts.length) {
      return parts;
    } else {
      console.warn(`[${targetLang}] Chunk split mismatch: expected ${texts.length}, got ${parts.length}. Falling back to line items.`);
      return parts.length > 0 ? parts : texts;
    }
  } catch (e) {
    console.error(`[${targetLang}] Error translating chunk:`, e);
    return texts;
  }
}

async function translateLang(lang, langName) {
  const enKeys = JSON.parse(fs.readFileSync('en_keys.json', 'utf8'));
  const keys = Object.keys(enKeys);
  const result = {};

  console.log(`Translating ${keys.length} keys for ${langName} (${lang}) using chunking...`);

  const chunkSize = 25; // Translate 25 strings at once
  for (let i = 0; i < keys.length; i += chunkSize) {
    const chunkKeys = keys.slice(i, i + chunkSize);
    const chunkTexts = chunkKeys.map(k => enKeys[k]);

    const translatedTexts = await translateChunk(chunkTexts, lang);

    chunkKeys.forEach((key, idx) => {
      let tText = translatedTexts[idx] || enKeys[key];
      // Fix variable placeholders
      tText = tText.replace(/\{\s*([a-zA-Z0-9_]+)\s*\}/g, '{$1}');

      // Key overrides
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
    });

    console.log(`[${lang.toUpperCase()}] Processed ${Math.min(i + chunkSize, keys.length)}/${keys.length}`);
    await new Promise(r => setTimeout(r, 200));
  }

  fs.writeFileSync(`${lang}_keys.json`, JSON.stringify(result, null, 2));
  console.log(`Saved ${lang}_keys.json!`);
}

async function run() {
  await translateLang('es', 'Spanish');
  await translateLang('fr', 'French');
  console.log('Finished chunked translation for ES and FR!');
}

run();
