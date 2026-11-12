const fs = require('fs');

async function translateText(text, targetLang) {
  if (!text || text.trim() === '') return text;
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    let translated = '';
    if (json && json[0]) {
      json[0].forEach(item => {
        if (item[0]) translated += item[0];
      });
    }
    return translated || text;
  } catch (e) {
    return text;
  }
}

async function translateForLangBatch(lang, langName) {
  if (fs.existsSync(`${lang}_keys.json`)) {
    console.log(`${langName} already exists, skipping.`);
    return;
  }

  const enKeys = JSON.parse(fs.readFileSync('en_keys.json', 'utf8'));
  const translatedKeys = {};
  const keys = Object.keys(enKeys);

  console.log(`Starting batched translation of ${keys.length} keys to ${langName} (${lang})...`);

  const batchSize = 15;
  for (let i = 0; i < keys.length; i += batchSize) {
    const batchKeys = keys.slice(i, i + batchSize);
    await Promise.all(batchKeys.map(async (key) => {
      const enText = enKeys[key];
      let tText = await translateText(enText, lang);
      tText = tText.replace(/\{\s*([a-zA-Z0-9_]+)\s*\}/g, '{$1}');

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

      translatedKeys[key] = tText;
    }));

    if (i % 150 === 0) {
      console.log(`[${lang.toUpperCase()}] Translated ${i}/${keys.length}`);
    }
    await new Promise(r => setTimeout(r, 100));
  }

  fs.writeFileSync(`${lang}_keys.json`, JSON.stringify(translatedKeys, null, 2));
  console.log(`Done translating to ${langName}!`);
}

async function main() {
  await translateForLangBatch('es', 'Spanish');
  await translateForLangBatch('fr', 'French');
  console.log('Batch translations completed!');
}

main();
