const fs = require('fs');

const path = 'C:/Users/Lenovo/AndroidStudioProjects/kapela_ios_android/src/utils/i18n.ts';
let content = fs.readFileSync(path, 'utf8');

// The language string
const deKeys = {
  'settings.language.de': 'Deutsch',
};

// Also let's fix the duplicates that still persist.
// The dedupe script removes duplicates but we want to make sure 'settings.language.de' is inside cs, sk, en, de
const langs = ['cs', 'sk', 'en', 'de'];
langs.forEach(lang => {
  const marker = `${lang}: {`;
  let idx = content.indexOf(marker);
  if (idx !== -1) {
    let toInsert = `\n    'settings.language.de': 'Deutsch',`;
    content = content.slice(0, idx + marker.length) + toInsert + content.slice(idx + marker.length);
  }
});

fs.writeFileSync(path, content);
console.log('Added DE to languages settings UI');
