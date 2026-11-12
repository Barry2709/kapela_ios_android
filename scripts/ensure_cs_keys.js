const fs = require('fs');

const path = 'C:/Users/Lenovo/AndroidStudioProjects/kapela_ios_android/src/utils/i18n.ts';
let content = fs.readFileSync(path, 'utf8');

// Extract all keys from pl, es, fr, de, en
const plKeys = JSON.parse(fs.readFileSync('pl_keys.json', 'utf8'));
const esKeys = JSON.parse(fs.readFileSync('es_keys.json', 'utf8'));
const frKeys = parseJSON('fr_keys.json');

function parseJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const extraKeys = {
  'settings.language.pl': 'Polština',
  'settings.language.es': 'Španělština',
  'settings.language.fr': 'Francouzština',
  'band.country.label': 'Země původu',
  'band.country.modalTitle': 'Vyberte zemi původu',
  'band.country.searchPlaceholder': 'Hledat zemi...',
  'band.country.selectBtn': 'Vybrat zemi',
};

// Add to cs: {
const csMarker = 'cs: {';
const csIdx = content.indexOf(csMarker);
if (csIdx !== -1) {
  let toInsert = '';
  for (const [k, v] of Object.entries(extraKeys)) {
    toInsert += `\n    '${k}': '${v}',`;
  }
  content = content.slice(0, csIdx + csMarker.length) + toInsert + content.slice(csIdx + csMarker.length);
}

fs.writeFileSync(path, content);
console.log('Extra keys added to cs block!');
