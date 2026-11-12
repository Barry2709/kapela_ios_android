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

async function translateForLang(lang, langName) {
  const enKeys = JSON.parse(fs.readFileSync('en_keys.json', 'utf8'));
  const translatedKeys = {};
  const keys = Object.keys(enKeys);

  console.log(`Starting translation of ${keys.length} keys to ${langName} (${lang})...`);

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const enText = enKeys[key];

    let tText = await translateText(enText, lang);
    tText = tText.replace(/\{\s*([a-zA-Z0-9_]+)\s*\}/g, '{$1}');

    // Specific overrides for core navigation/music terms
    if (key === 'settings.language.system') {
      if (lang === 'pl') tText = 'Domyślny język systemu';
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
      if (lang === 'pl') tText = 'Główna';
      if (lang === 'es') tText = 'Inicio';
      if (lang === 'fr') tText = 'Accueil';
    }
    if (key === 'nav.events') {
      if (lang === 'pl') tText = 'Wydarzenia';
      if (lang === 'es') tText = 'Eventos';
      if (lang === 'fr') tText = 'Événements';
    }
    if (key === 'nav.repertoire') {
      if (lang === 'pl') tText = 'Repertuar';
      if (lang === 'es') tText = 'Repertorio';
      if (lang === 'fr') tText = 'Répertoire';
    }
    if (key === 'nav.treasury') {
      if (lang === 'pl') tText = 'Skarbiec';
      if (lang === 'es') tText = 'Tesorería';
      if (lang === 'fr') tText = 'Trésorerie';
    }
    if (key === 'nav.band') {
      if (lang === 'pl') tText = 'Zespół';
      if (lang === 'es') tText = 'Banda';
      if (lang === 'fr') tText = 'Groupe';
    }

    translatedKeys[key] = tText;

    if (i % 100 === 0) {
      console.log(`[${lang.toUpperCase()}] Translated ${i}/${keys.length}`);
    }
    await new Promise(r => setTimeout(r, 60));
  }

  fs.writeFileSync(`${lang}_keys.json`, JSON.stringify(translatedKeys, null, 2));
  console.log(`Done translating to ${langName}!`);
}

async function main() {
  await translateForLang('pl', 'Polish');
  await translateForLang('es', 'Spanish');
  await translateForLang('fr', 'French');
  console.log('All 3 languages translated successfully!');
}

main();
