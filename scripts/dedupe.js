const fs = require('fs');

const path = 'C:/Users/Lenovo/AndroidStudioProjects/kapela_ios_android/src/utils/i18n.ts';
let content = fs.readFileSync(path, 'utf8');

// Parse the entire translations object
// We can find where 'export const translations = {' starts
const startIdx = content.indexOf('export const translations =');
const endIdx = content.indexOf('export function getTranslation');

let translationsBlock = content.substring(startIdx, endIdx);

// Extract each lang block (cs: { ... }, sk: { ... }, en: { ... }, de: { ... })
const langs = ['cs', 'sk', 'en', 'de', 'pl', 'es', 'fr'];

langs.forEach(lang => {
  const regex = new RegExp(`(${lang}:\\s*\\{)([\\s\\S]*?)(\\n  \\})`);
  const match = translationsBlock.match(regex);
  if (match) {
    const lines = match[2].split('\n');
    const seenKeys = new Set();
    const cleanLines = [];

    // Reverse to keep the last duplicate
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      const keyMatch = line.match(/^\s*['"]([^'"]+)['"]\s*:/);
      if (keyMatch) {
        const key = keyMatch[1];
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          cleanLines.unshift(line);
        }
      } else {
        cleanLines.unshift(line);
      }
    }

    const newLangBlock = match[1] + cleanLines.join('\n') + match[3];
    translationsBlock = translationsBlock.replace(match[0], newLangBlock);
  }
});

content = content.substring(0, startIdx) + translationsBlock + content.substring(endIdx);
fs.writeFileSync(path, content);
console.log('Strict deduplication complete.');
