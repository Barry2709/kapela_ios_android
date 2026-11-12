const fs = require('fs');

const path = 'C:/Users/Lenovo/AndroidStudioProjects/kapela_ios_android/src/utils/i18n.ts';
let content = fs.readFileSync(path, 'utf8');

const keys = {
  cs: {
    'calendar.noEvents': 'Na tento den nejsou plánovány žádné akce.',
    'calendar.section.concerts': 'Koncerty a akce',
    'calendar.section.rehearsals': 'Zkoušky',
    'calendar.section.absences': 'Absence',
  },
  sk: {
    'calendar.noEvents': 'Na tento deň nie sú plánované žiadne akcie.',
    'calendar.section.concerts': 'Koncerty a akcie',
    'calendar.section.rehearsals': 'Skúšky',
    'calendar.section.absences': 'Absencie',
  },
  en: {
    'calendar.noEvents': 'No events planned for this day.',
    'calendar.section.concerts': 'Concerts and Events',
    'calendar.section.rehearsals': 'Rehearsals',
    'calendar.section.absences': 'Absences',
  },
  de: {
    'calendar.noEvents': 'Keine Veranstaltungen für diesen Tag geplant.',
    'calendar.section.concerts': 'Konzerte & Veranstaltungen',
    'calendar.section.rehearsals': 'Proben',
    'calendar.section.absences': 'Abwesenheiten',
  },
  pl: {
    'calendar.noEvents': 'Brak wydarzeń zaplanowanych na ten dzień.',
    'calendar.section.concerts': 'Koncerty i wydarzenia',
    'calendar.section.rehearsals': 'Próby',
    'calendar.section.absences': 'Nieobecności',
  },
  es: {
    'calendar.noEvents': 'No hay eventos programados para este día.',
    'calendar.section.concerts': 'Conciertos y eventos',
    'calendar.section.rehearsals': 'Ensayos',
    'calendar.section.absences': 'Ausencias',
  },
  fr: {
    'calendar.noEvents': 'Aucun événement prévu pour ce jour.',
    'calendar.section.concerts': 'Concerts et événements',
    'calendar.section.rehearsals': 'Répétitions',
    'calendar.section.absences': 'Absences',
  }
};

for (const lang of ['cs', 'sk', 'en', 'de', 'pl', 'es', 'fr']) {
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
console.log('Calendar keys added!');
