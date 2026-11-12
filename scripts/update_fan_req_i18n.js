const fs = require('fs');

const path = 'C:/Users/Lenovo/AndroidStudioProjects/kapela_ios_android/src/utils/i18n.ts';
let content = fs.readFileSync(path, 'utf8');

const keys = {
  cs: {
    'fans.form.email': 'E-mail (volitelný)',
    'fans.form.phone': 'Telefon (volitelný)',
    'fans.errorReq': 'Vyplňte prosím jméno fanouška.',
    'onboarding.errorFan': 'Vyplňte prosím své jméno a vyberte kapelu.',
  },
  sk: {
    'fans.form.email': 'E-mail (voliteľný)',
    'fans.form.phone': 'Telefón (voliteľný)',
    'fans.errorReq': 'Vyplňte prosím meno fanúšika.',
    'onboarding.errorFan': 'Vyplňte prosím svoje meno a vyberte kapelu.',
  },
  en: {
    'fans.form.email': 'Email (optional)',
    'fans.form.phone': 'Phone (optional)',
    'fans.errorReq': 'Please fill in fan name.',
    'onboarding.errorFan': 'Please fill in your name and select a band.',
  },
  de: {
    'fans.form.email': 'E-Mail (optional)',
    'fans.form.phone': 'Telefon (optional)',
    'fans.errorReq': 'Bitte geben Sie den Namen des Fans ein.',
    'onboarding.errorFan': 'Bitte geben Sie Ihren Namen ein und wählen Sie eine Band aus.',
  },
  pl: {
    'fans.form.email': 'E-mail (opcjonalnie)',
    'fans.form.phone': 'Telefon (opcjonalnie)',
    'fans.errorReq': 'Proszę podać imię fana.',
    'onboarding.errorFan': 'Proszę podać swoje imię i wybrać zespół.',
  },
  es: {
    'fans.form.email': 'Correo electrónico (opcional)',
    'fans.form.phone': 'Teléfono (opcional)',
    'fans.errorReq': 'Por favor, introduce el nombre del fan.',
    'onboarding.errorFan': 'Por favor, introduce tu nombre y selecciona una banda.',
  },
  fr: {
    'fans.form.email': 'E-mail (optionnel)',
    'fans.form.phone': 'Téléphone (optionnel)',
    'fans.errorReq': 'Veuillez saisir le nom du fan.',
    'onboarding.errorFan': 'Veuillez saisir votre nom et sélectionner un groupe.',
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
console.log('Updated fan requirements i18n keys!');
