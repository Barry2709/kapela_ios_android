const fs = require('fs');

const path = 'C:/Users/Lenovo/AndroidStudioProjects/kapela_ios_android/src/utils/i18n.ts';
let content = fs.readFileSync(path, 'utf8');

const keys = {
  cs: {
    'band.country.label': 'Země původu',
    'band.country.modalTitle': 'Vyberte zemi původu',
    'band.country.searchPlaceholder': 'Hledat zemi...',
    'band.country.selectBtn': 'Vybrat zemi',
  },
  sk: {
    'band.country.label': 'Krajina pôvodu',
    'band.country.modalTitle': 'Vyberte krajinu pôvodu',
    'band.country.searchPlaceholder': 'Hľadať krajinu...',
    'band.country.selectBtn': 'Vybrať krajinu',
  },
  en: {
    'band.country.label': 'Country of origin',
    'band.country.modalTitle': 'Select country of origin',
    'band.country.searchPlaceholder': 'Search country...',
    'band.country.selectBtn': 'Select country',
  },
  de: {
    'band.country.label': 'Herkunftsland',
    'band.country.modalTitle': 'Herkunftsland auswählen',
    'band.country.searchPlaceholder': 'Land suchen...',
    'band.country.selectBtn': 'Land auswählen',
  }
};

for (const lang of ['cs', 'sk', 'en', 'de']) {
  const marker = `${lang}: {`;
  const idx = content.indexOf(marker);
  if (idx !== -1) {
    let toInsert = '';
    for (const [k, v] of Object.entries(keys[lang])) {
      toInsert += `\n    '${k}': '${v.replace(/'/g, "\\\\'")}',`;
    }
    content = content.slice(0, idx + marker.length) + toInsert + content.slice(idx + marker.length);
  }
}

fs.writeFileSync(path, content);
console.log('Country i18n keys added!');
