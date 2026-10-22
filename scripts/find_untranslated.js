const fs = require('fs');
const path = require('path');

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);
  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      if (!fullPath.includes('i18n.ts')) {
        arrayOfFiles.push(fullPath);
      }
    }
  });
  return arrayOfFiles;
}

const allTsxFiles = getAllFiles('C:/Users/Lenovo/AndroidStudioProjects/kapela_ios_android/src');

const results = [];

allTsxFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const relativePath = file.replace('C:/Users/Lenovo/AndroidStudioProjects/kapela_ios_android/', '');

  // Find Czech words in JSX text or string literals
  // Czech accented chars: [ěščřžýáíéůúťďňĚŠČŘŽÝÁÍÉŮÚŤĎŇ]
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    // Check if line contains czech characters and doesn't look like a comment or console.log
    if (/[ěščřžýáíéůúťďňĚŠČŘŽÝÁÍÉŮÚŤĎŇ]/.test(line)) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*') && !trimmed.includes('console.')) {
        results.push({ file: relativePath, line: index + 1, text: trimmed });
      }
    }
  });
});

console.log(`Found ${results.length} lines with untranslated Czech text:`);
results.forEach(r => {
  console.log(`${r.file}:${r.line} -> ${r.text}`);
});
