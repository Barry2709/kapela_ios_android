const fs = require('fs');
const path = require('path');

// 1. treasury.tsx
const treasuryPath = path.join(__dirname, '../src/app/(tabs)/treasury.tsx');
let treasury = fs.readFileSync(treasuryPath, 'utf8');

// Filter chips in treasury
treasury = treasury.replace(
  /<ThemedText\s+type="smallBold"\s+style=\{\{\s*color:\s*isSelected\s*\?\s*'#fff'\s*:\s*theme\.text,\s*fontSize:\s*11\s*\}\}\s*>/g,
  `<ThemedText type="smallBold" style={{ color: isSelected ? '#fff' : theme.text, fontSize: 11, textAlign: 'center', lineHeight: 13 }} numberOfLines={1} ellipsizeMode="tail">`
);

// Transaction titles
treasury = treasury.replace(
  /\{getCleanTitle\(item\.title\)\}/g,
  `<ThemedText type="subtitle" style={{ fontSize: 16, fontWeight: 'bold', color: themeColor, textDecorationLine: item.isCancelled ? 'line-through' : 'none' }} numberOfLines={2} ellipsizeMode="tail">{getCleanTitle(item.title)}</ThemedText>`
);
// Fix double wrap if replaced
treasury = treasury.replace(/<ThemedText\s+type="subtitle"\s+style=\{\{\s*fontSize:\s*16,\s*fontWeight:\s*'bold',\s*color:\s*themeColor,\s*textDecorationLine:\s*item\.isCancelled\s*\?\s*'line-through'\s*:\s*'none',\s*\}\}>\s*<ThemedText[^>]+>\{getCleanTitle\(item\.title\)\}<\/ThemedText>\s*<\/ThemedText>/g,
  `<ThemedText type="subtitle" style={{ fontSize: 16, fontWeight: 'bold', color: themeColor, textDecorationLine: item.isCancelled ? 'line-through' : 'none' }} numberOfLines={2} ellipsizeMode="tail">{getCleanTitle(item.title)}</ThemedText>`
);

fs.writeFileSync(treasuryPath, treasury);


// 2. events.tsx
const eventsPath = path.join(__dirname, '../src/app/(tabs)/events.tsx');
let events = fs.readFileSync(eventsPath, 'utf8');

// Action toggle chips in events.tsx
events = events.replace(
  /<ThemedText\s+type="smallBold"\s+style=\{\{\s*color:\s*isSelected\s*\?\s*'#fff'\s*:\s*theme\.text,\s*fontSize:\s*12\s*\}\}\s*>/g,
  `<ThemedText type="smallBold" style={{ color: isSelected ? '#fff' : theme.text, fontSize: 11, textAlign: 'center', lineHeight: 13 }} numberOfLines={1} ellipsizeMode="tail">`
);

fs.writeFileSync(eventsPath, events);


// 3. repertoire.tsx
const repPath = path.join(__dirname, '../src/app/(tabs)/repertoire.tsx');
let rep = fs.readFileSync(repPath, 'utf8');

// Song titles in list
rep = rep.replace(
  /\{song\.title\}/g,
  `{song.title}`
);

fs.writeFileSync(repPath, rep);

console.log("Safeguards applied successfully.");
