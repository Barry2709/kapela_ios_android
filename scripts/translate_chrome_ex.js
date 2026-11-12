const fs = require('fs');

async function translateBatchChromeEx(texts, targetLang) {
  if (!texts || texts.length === 0) return [];

  // Use line breaks for multiple items
  const query = texts.join('\n');
  const url = `https://translate.googleapis.com/translate_a/single?client=dict_chrome_ex&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(query)}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      }
    });

    const json = await res.json();
    if (json && json[0]) {
      const translatedItems = json[0].map(item => item[0] ? item[0].replace(/\n$/, '') : '');
      if (translatedItems.length === texts.length) {
        return translatedItems;
      }
    }
  } catch (e) {
    console.error(`Batch error for ${targetLang}:`, e.message);
  }

  // Fallback item by item
  const fallbackResults = [];
  for (const t of texts) {
    try {
      const u = `https://translate.googleapis.com/translate_a/single?client=dict_chrome_ex&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(t)}`;
      const r = await fetch(u, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        }
      });
      const j = await r.json();
      if (j && j[0] && j[0][0] && j[0][0][0]) {
        fallbackResults.push(j[0][0][0]);
      } else {
        fallbackResults.push(t);
      }
    } catch {
      fallbackResults.push(t);
    }
    await new Promise(res => setTimeout(res, 100));
  }
  return fallbackResults;
}

async function processLang(lang, langName) {
  const enKeys = JSON.parse(fs.readFileSync('en_keys.json', 'utf8'));
  const keys = Object.keys(enKeys);
  const result = {};

  console.log(`Starting translation of ${keys.length} keys to ${langName} (${lang})...`);

  const batchSize = 15;
  for (let i = 0; i < keys.length; i += batchSize) {
    const chunkKeys = keys.slice(i, i + batchSize);
    const chunkTexts = chunkKeys.map(k => enKeys[k]);

    const translatedBatch = await translateBatchChromeEx(chunkTexts, lang);

    chunkKeys.forEach((key, idx) => {
      let tText = translatedBatch[idx] || enKeys[key];
      // Clean placeholders
      tText = tText.replace(/\{\s*([a-zA-Z0-9_]+)\s*\}/g, '{$1}');

      // Overrides
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

    if (i > 0 && i % 150 === 0) {
      console.log(`[${lang.toUpperCase()}] ${i}/${keys.length} keys done...`);
    }
    await new Promise(r => setTimeout(r, 200));
  }

  fs.writeFileSync(`${lang}_keys.json`, JSON.stringify(result, null, 2));
  console.log(`Saved ${lang}_keys.json successfully!`);
}

async function main() {
  await processLang('es', 'Spanish');
  await processLang('fr', 'French');
  console.log('Finished translating ES and FR!');
}

main();
