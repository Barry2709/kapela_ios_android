const fs = require('fs');

const path = 'C:/Users/Lenovo/AndroidStudioProjects/kapela_ios_android/src/utils/i18n.ts';
let content = fs.readFileSync(path, 'utf8');

function formatLangBlock(langKey, jsonFile) {
  const keysObj = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  let str = `  ${langKey}: {\n`;
  const keys = Object.keys(keysObj);
  keys.forEach((k, i) => {
    const isLast = i === keys.length - 1;
    const val = String(keysObj[k]).replace(/'/g, "\\'").replace(/\n/g, '\\n');
    str += `    '${k}': '${val}'${isLast ? '' : ','}\n`;
  });
  str += '  }';
  return str;
}

const plBlock = formatLangBlock('pl', 'pl_keys.json');
const esBlock = formatLangBlock('es', 'es_keys.json');
const frBlock = formatLangBlock('fr', 'fr_keys.json');

const exportIndex = content.indexOf('export function getTranslation');
let preText = content.substring(0, exportIndex).trim();

// Replace the closing `}` of `de` or `translations` with `,` and add `pl`, `es`, `fr`
preText = preText.replace(/\};\s*$/, '},\n' + plBlock + ',\n' + esBlock + ',\n' + frBlock + '\n};');

let postText = content.substring(exportIndex);

// Update types and functions in postText
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

const finalContent = preText + '\n\n' + postText;
fs.writeFileSync(path, finalContent);
console.log('Successfully injected PL, ES, FR into i18n.ts!');
