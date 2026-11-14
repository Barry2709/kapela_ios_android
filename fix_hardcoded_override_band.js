const fs = require('fs');

let file = 'src/app/(tabs)/index.tsx';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
  /<BandHeader overrideBand=\{earliestBandForFan\} \/>/,
  "<BandHeader />"
);

fs.writeFileSync(file, c);
console.log('Fixed hardcoded earliestBandForFan loop!');
