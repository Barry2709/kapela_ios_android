const fs = require('fs');
const execSync = require('child_process').execSync;

try {
  // Smažeme zámek balíčků, aby se vygeneroval čistý
  if (fs.existsSync('package-lock.json')) fs.unlinkSync('package-lock.json');
  console.log('Smazán package-lock.json');

  // Přeinstalujeme všechny balíčky načisto bez konfliktů
  console.log('Instaluji NPM balíčky...');
  execSync('npm install', { stdio: 'inherit' });
  console.log('NPM moduly nainstalovány.');

  // Uložíme kód na GitHub
  console.log('Ukládám čistý build config...');
  execSync('git add package.json package-lock.json');
  execSync('git commit -m "Clean dependencies for EAS build" || true');
  execSync('git push origin master || true');

} catch (e) {
  console.error("Chyba:", e);
}
