const fs = require('fs');
const content = fs.readFileSync('src/utils/i18n.ts', 'utf8');

const regex = /^\s*['"]([^'"]+)['"]\s*:\s*['"](.*)['"],?\s*$/gm;
const enKeys = {};

// We need to isolate the 'en: {' block.
const enIndex = content.indexOf('en: {');
const nextBlockIndex = content.indexOf('};', enIndex); // Just approximate
const enBlock = content.substring(enIndex, nextBlockIndex);

let match;
while ((match = regex.exec(enBlock)) !== null) {
  enKeys[match[1]] = match[2];
}

fs.writeFileSync('en_keys.json', JSON.stringify(enKeys, null, 2));
console.log('Damped ' + Object.keys(enKeys).length + ' keys');