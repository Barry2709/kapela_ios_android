const fs = require('fs');

async function translateText(text, targetLang) {
  if (!text || text.trim() === '') return text;
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    let translated = '';
    if (json && json[0]) {
      json[0].forEach(item => {
        if (item[0]) translated += item[0];
      });
    }
    return translated || text;
  } catch (e) {
    return text;
  }
}

async function run() {
  const fileContent = fs.readFileSync('src/constants/countries.ts', 'utf8');

  // Extract WORLD_COUNTRIES array
  const match = fileContent.match(/export const WORLD_COUNTRIES: Country\[\] = (\[[\s\S]*?\]);/);
  if (!match) {
    console.error('Could not find WORLD_COUNTRIES');
    return;
  }

  const countries = JSON.parse(match[1]);
  console.log(`Translating ${countries.length} countries to PL, ES, FR...`);

  for (let i = 0; i < countries.length; i++) {
    const c = countries[i];
    const enName = c.en || c.cs;

    if (!c.pl) c.pl = await translateText(enName, 'pl');
    if (!c.es) c.es = await translateText(enName, 'es');
    if (!c.fr) c.fr = await translateText(enName, 'fr');

    if (i % 25 === 0) console.log(`Translated ${i}/${countries.length} countries`);
    await new Promise(r => setTimeout(r, 50));
  }

  const newFileContent = `export interface Country {
  code: string;
  flag: string;
  cs: string;
  sk: string;
  en: string;
  de: string;
  pl: string;
  es: string;
  fr: string;
}

export const WORLD_COUNTRIES: Country[] = ${JSON.stringify(countries, null, 2)};

export function getSortedCountries(lang: string = 'cs'): { code: string; flag: string; name: string }[] {
  const normalizedLang = (['sk', 'de', 'en', 'pl', 'es', 'fr'].includes(lang) ? lang : 'cs') as 'cs' | 'sk' | 'en' | 'de' | 'pl' | 'es' | 'fr';

  const list = WORLD_COUNTRIES.map(c => ({
    code: c.code,
    flag: c.flag,
    name: c[normalizedLang] || c.cs || c.en,
  }));

  return list.sort((a, b) => a.name.localeCompare(b.name, normalizedLang));
}

export function getCountryDisplayName(code?: string, lang: string = 'cs'): string {
  if (!code) return '';
  const country = WORLD_COUNTRIES.find(c => c.code.toUpperCase() === code.toUpperCase());
  if (!country) return code;
  const normalizedLang = (['sk', 'de', 'en', 'pl', 'es', 'fr'].includes(lang) ? lang : 'cs') as 'cs' | 'sk' | 'en' | 'de' | 'pl' | 'es' | 'fr';
  return \`\${country.flag} \${country[normalizedLang] || country.cs}\`;
}
`;

  fs.writeFileSync('src/constants/countries.ts', newFileContent);
  console.log('src/constants/countries.ts updated with PL, ES, FR!');
}

run();
