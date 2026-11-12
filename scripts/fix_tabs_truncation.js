const fs = require('fs');
const path = require('path');

const tabsPath = path.join(__dirname, '../src/components/app-tabs.tsx');
let content = fs.readFileSync(tabsPath, 'utf8');

// Replace all <ThemedText in app-tabs.tsx that render tab titles
content = content.replace(/<ThemedText\s+type="smallBold"\s+style=\{\{([^}]+)\}\}(?:\s+numberOfLines=\{1\})?\s*>/g, (match, p1) => {
  let styleStr = p1;
  if (!styleStr.includes('textAlign')) {
    styleStr += ", textAlign: 'center'";
  }
  if (!styleStr.includes('lineHeight')) {
    styleStr += ', lineHeight: 12';
  }
  return `<ThemedText\n              type="smallBold"\n              style={{${styleStr}}}\n              numberOfLines={1}\n              ellipsizeMode="tail"\n            >`;
});

fs.writeFileSync(tabsPath, content);
console.log('App tabs truncation updated successfully!');
