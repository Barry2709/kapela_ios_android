const fs = require('fs');

async function translateText(text, targetLang = 'de') {
  if (!text || text.trim() === '') return text;

  // Někdy jsou v textu proměnné jako {count} nebo {bandName}.
  // Tyto by bylo lepší dočasně nahradit, ale zkusíme to rovnou, translate.googleapis je občas nechá.

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
    console.error('Translation error:', e);
    return text; // fallback
  }
}

async function run() {
  const enKeys = JSON.parse(fs.readFileSync('en_keys.json', 'utf8'));
  const deKeys = {};

  const keys = Object.keys(enKeys);
  console.log(`Starting translation of ${keys.length} keys...`);

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const enText = enKeys[key];

    // Hardcoded some common music/band terms if needed, otherwise rely on Google Translate
    let deText = await translateText(enText, 'de');

    // Fix placeholders that might get spaces added by translator, e.g. { count } -> {count}
    deText = deText.replace(/\\{\\s*([a-zA-Z0-9_]+)\\s*\\}/g, '{$1}');

    // Also, handle some specific known translations to sound natural
    if (enText === 'Home') deText = 'Startseite';
    if (enText === 'Events') deText = 'Veranstaltungen';
    if (enText === 'Repertoire') deText = 'Repertoire';
    if (enText === 'Treasury') deText = 'Kasse';
    if (enText === 'Band') deText = 'Band';
    if (enText === 'Settings') deText = 'Einstellungen';
    if (enText === 'Bandleader') deText = 'Bandleader';
    if (enText === 'Rehearsal') deText = 'Probe';
    if (enText === 'Concert') deText = 'Konzert';

    deKeys[key] = deText;

    if (i % 50 === 0) {
      console.log(`Translated ${i}/${keys.length}`);
    }
    // Small delay to prevent rate limit
    await new Promise(r => setTimeout(r, 100));
  }

  fs.writeFileSync('de_keys.json', JSON.stringify(deKeys, null, 2));
  console.log('Done translating!');
}

run();
