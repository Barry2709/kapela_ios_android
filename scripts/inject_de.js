const fs = require('fs');

const path = 'C:/Users/Lenovo/AndroidStudioProjects/kapela_ios_android/src/utils/i18n.ts';
let content = fs.readFileSync(path, 'utf8');

const deKeys = JSON.parse(fs.readFileSync('de_keys.json', 'utf8'));

let deStr = '  de: {\n';
const keys = Object.keys(deKeys);
keys.forEach((k, i) => {
  const isLast = i === keys.length - 1;
  const val = String(deKeys[k]).replace(/'/g, "\\'").replace(/\n/g, '\\n');
  deStr += `    '${k}': '${val}'${isLast ? '' : ','}\n`;
});
deStr += '  }\n};';

const exportIndex = content.indexOf('export function getTranslation');
let preText = content.substring(0, exportIndex).trim();

preText = preText.replace(/\};\s*$/, '},\n' + deStr + '\n\n');

let finalContent = preText + content.substring(exportIndex);
finalContent = finalContent.replace(/lang\?: 'cs' \| 'sk' \| 'en'/g, "lang?: 'cs' | 'sk' | 'en' | 'de'");
finalContent = finalContent.replace(/: 'cs' \| 'sk' \| 'en' =>/g, ": 'cs' | 'sk' | 'en' | 'de' =>");
finalContent = finalContent.replace(/if \(locale.startsWith\('sk'\)\) return 'sk';/g, "if (locale.startsWith('sk')) return 'sk';\n      if (locale.startsWith('de')) return 'de';");
finalContent = finalContent.replace(/translations\.en \|\| translations\.cs/g, "translations.en || (translations as any).de || translations.cs");

fs.writeFileSync(path, finalContent);
console.log('Němčina injektována do i18n.ts');
