const fs = require('fs');

async function translateBatchChromeEx(texts, targetLang) {
  if (!texts || texts.length === 0) return [];

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
  }
  return fallbackResults;
}

async function processLang(lang, langName) {
  const enKeys = JSON.parse(fs.readFileSync('en_keys.json', 'utf8'));
  const keys = Object.keys(enKeys);
  const result = {};

  console.log(`Starting translation of ${keys.length} keys to ${langName} (${lang})...`);

  const batchSize = 25;
  for (let i = 0; i < keys.length; i += batchSize) {
    const chunkKeys = keys.slice(i, i + batchSize);
    const chunkTexts = chunkKeys.map(k => enKeys[k]);

    const translatedBatch = await translateBatchChromeEx(chunkTexts, lang);

    chunkKeys.forEach((key, idx) => {
      let tText = translatedBatch[idx] || enKeys[key];
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
    });

    if (i > 0 && i % 100 === 0) {
      console.log(`[${lang.toUpperCase()}] ${i}/${keys.length} keys done...`);
    }
    await new Promise(r => setTimeout(r, 150));
  }

  fs.writeFileSync(`${lang}_keys.json`, JSON.stringify(result, null, 2));
  console.log(`Saved ${lang}_keys.json successfully!`);
}

processLang('fr', 'French');
