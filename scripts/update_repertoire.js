const fs = require('fs');
const path = require('path');

const i18nPath = path.join(__dirname, '../src/utils/i18n.ts');
let i18nContent = fs.readFileSync(i18nPath, 'utf8');

const keysToAdd = {
  cs: {
    'repertoire.action.addSongToRep': 'Přidat novou píseň do repertoáru',
    'repertoire.action.manualEntry': 'Ruční zápis (Napsat z klávesnice)',
    'repertoire.action.fromDisk': 'Z disku (Lokální paměť / Soubory)',
    'repertoire.action.fromGDrive': 'Z Google Disku',
    'repertoire.action.fromICloud': 'Z iCloud Drive',
  },
  sk: {
    'repertoire.action.addSongToRep': 'Pridať novú pieseň do repertoáru',
    'repertoire.action.manualEntry': 'Ručný zápis (Napísať z klávesnice)',
    'repertoire.action.fromDisk': 'Z disku (Lokálna pamäť / Súbory)',
    'repertoire.action.fromGDrive': 'Z Google Disku',
    'repertoire.action.fromICloud': 'Z iCloud Drive',
  },
  en: {
    'repertoire.action.addSongToRep': 'Add new song to repertoire',
    'repertoire.action.manualEntry': 'Manual Entry (Type from keyboard)',
    'repertoire.action.fromDisk': 'From Disk (Local Storage / Files)',
    'repertoire.action.fromGDrive': 'From Google Drive',
    'repertoire.action.fromICloud': 'From iCloud Drive',
  }
};

for (const lang of ['cs', 'sk', 'en']) {
  const marker = `${lang}: {`;
  const idx = i18nContent.indexOf(marker);
  if (idx !== -1) {
    let toInsert = '';
    for (const [k, v] of Object.entries(keysToAdd[lang])) {
      toInsert += `\n    '${k}': '${v}',`;
    }
    i18nContent = i18nContent.slice(0, idx + marker.length) + toInsert + i18nContent.slice(idx + marker.length);
  }
}

fs.writeFileSync(i18nPath, i18nContent);
console.log('Keys added to i18n.ts');
