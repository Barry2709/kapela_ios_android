const fs = require('fs');
const path = require('path');

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);
  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else if (file.endsWith('.tsx')) {
      if (!fullPath.includes('i18n.ts')) {
        arrayOfFiles.push(fullPath);
      }
    }
  });
  return arrayOfFiles;
}

const allTsxFiles = getAllFiles('C:/Users/Lenovo/AndroidStudioProjects/kapela_ios_android/src');

const czechRegex = /[ěščřžýáíéůúťďňĚŠČŘŽÝÁÍÉŮÚŤĎŇ]/;

const UI_STRINGS = [];

allTsxFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const relativePath = file.replace('C:/Users/Lenovo/AndroidStudioProjects/kapela_ios_android/', '');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Ignore comments
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
    if (trimmed.includes('console.')) return;

    // Look for JSX text between tags or quotes with czech characters that don't call t(...)
    if (czechRegex.test(trimmed)) {
      // Exclude lines that use t('...') unless there's a hardcoded czech string on the same line
      const hasTCall = /t\(['"][a-zA-Z0-9._-]+['"]\)/.test(trimmed);

      // Look for JSX text like <ThemedText>Český text</ThemedText> or Alert.alert("Český text") or placeholder="Český text"
      const isJsxText = />[^<]*[ěščřžýáíéůúťďňĚŠČŘŽÝÁÍÉŮÚŤĎŇ][^<]*</.test(trimmed);
      const isAlert = /Alert\.alert\(/.test(trimmed) && czechRegex.test(trimmed);
      const isPlaceholder = /placeholder=["'][^"']*[ěščřžýáíéůúťďňĚŠČŘŽÝÁÍÉŮÚŤĎŇ]/.test(trimmed);
      const isStringProp = /["'][^"']*[ěščřžýáíéůúťďňĚŠČŘŽÝÁÍÉŮÚŤĎŇ][^"']*["']/.test(trimmed) && !trimmed.includes('styles.');

      if (isJsxText || isAlert || isPlaceholder || (isStringProp && !hasTCall)) {
        UI_STRINGS.push({ file: relativePath, line: index + 1, text: trimmed });
      }
    }
  });
});

console.log(`FOUND ${UI_STRINGS.length} UNTRANSLATED UI LINES:\n`);
UI_STRINGS.forEach(s => console.log(`${s.file}:${s.line}\n  -> ${s.text}\n`));
