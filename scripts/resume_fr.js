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
  const frKeys = JSON.parse(fs.readFileSync('fr_keys.json', 'utf8'));
  const keys = Object.keys(enKeys);

  console.log(`Resuming French translation from key 750 to ${keys.length}...`);

  for (let i = 750; i < keys.length; i++) {
    const key = keys[i];
    const enText = enKeys[key];

    let tText = await translateTextMyMemory(enText, 'fr');
    tText = tText.replace(/\{\s*([a-zA-Z0-9_]+)\s*\}/g, '{$1}');

    frKeys[key] = tText;
    await new Promise(r => setTimeout(r, 80));
  }

  fs.writeFileSync('fr_keys.json', JSON.stringify(frKeys, null, 2));
  console.log('Saved complete fr_keys.json successfully!');
}

runFR();
