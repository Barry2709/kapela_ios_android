const fs = require('fs');

const path = 'C:/Users/Lenovo/AndroidStudioProjects/kapela_ios_android/src/utils/i18n.ts';
let content = fs.readFileSync(path, 'utf8');

// Find where 'de: {' was inserted
const csIdx = content.indexOf('cs: {');
const csBlock = content.substring(0, csIdx);

function parseJSONKeys(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const enKeys = parseJSONKeys('en_keys.json');
const plKeys = parseJSONKeys('pl_keys.json');
const esKeys = parseJSONKeys('es_keys.json');
const frKeys = parseJSONKeys('fr_keys.json');

// Rebuild cs and sk blocks from what we had or extract from i18n
// Actually, let's extract 'cs' and 'sk' objects directly from i18n.ts before 'de:'
const skIdx = content.indexOf('sk: {');
const enIdx = content.indexOf('en: {');
const deIdx = content.indexOf('de: {');

const csText = content.substring(csIdx + 5, skIdx).trim();
const skText = content.substring(skIdx + 5, enIdx).trim();

// Format JS object string safely
function buildObjectString(obj) {
  let res = '{\n';
  const keys = Object.keys(obj);
  keys.forEach((k, i) => {
    const isLast = i === keys.length - 1;
    // Clean string for JS object literal
    let val = String(obj[k]);
    val = val.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
    res += `    '${k}': '${val}'${isLast ? '' : ','}\n`;
  });
  res += '  }';
  return res;
}

let newTranslations = 'export const translations = {\n  cs: ' + csText + '\n  sk: ' + skText + '\n  en: ' + buildObjectString(enKeys) + ',\n  pl: ' + buildObjectString(plKeys) + ',\n  es: ' + buildObjectString(esKeys) + ',\n  fr: ' + buildObjectString(frKeys) + '\n};';

const exportIndex = content.indexOf('export function getTranslation');
let postText = content.substring(exportIndex);

// Update types
postText = postText.replace(/lang\?: 'cs' \| 'sk' \| 'en' \| 'de'/g, "lang?: 'cs' | 'sk' | 'en' | 'de' | 'pl' | 'es' | 'fr'");
postText = postText.replace(/: 'cs' \| 'sk' \| 'en' \| 'de' =>/g, ": 'cs' | 'sk' | 'en' | 'de' | 'pl' | 'es' | 'fr' =>");

// Update getSystemLanguage
const systemLangCode = `const getSystemLanguage = (): 'cs' | 'sk' | 'en' | 'de' | 'pl' | 'es' | 'fr' => {
    try {
      const locale = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
      if (locale.startsWith('sk')) return 'sk';
      if (locale.startsWith('de')) return 'de';
      if (locale.startsWith('pl')) return 'pl';
      if (locale.startsWith('es')) return 'es';
      if (locale.startsWith('fr')) return 'fr';
      if (locale.startsWith('cs') || locale.startsWith('cz')) return 'cs';
      return 'en';
    } catch {
      return 'en';
    }
  };`;

postText = postText.replace(/const getSystemLanguage = [\s\S]*?\n  \};/g, systemLangCode);

const finalFile = csBlock + newTranslations + '\n\n' + postText;
fs.writeFileSync(path, finalFile);
console.log('Clean injection done!');
