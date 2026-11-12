const fs = require('fs');
const path = require('path');

// Fix syntax in index.tsx
let indexTsxPath = path.join(__dirname, '../src/app/(tabs)/index.tsx');
let indexTsx = fs.readFileSync(indexTsxPath, 'utf8');
indexTsx = indexTsx.replace(/>\{t\('events\.whatToPrepare'\)\}<\/\/ThemedText>/g, '>{t(\'events.whatToPrepare\')}</ThemedText>');
fs.writeFileSync(indexTsxPath, indexTsx);

// Fix syntax in add-concert-form.tsx
let addConcertPath = path.join(__dirname, '../src/components/add-concert-form.tsx');
let addConcert = fs.readFileSync(addConcertPath, 'utf8');
addConcert = addConcert.replace(/placeholder=t\(/g, 'placeholder={t(');
addConcert = addConcert.replace(/placeholder=\{t\('([^']+)'\)\n/g, 'placeholder={t(\'$1\')}\n');
fs.writeFileSync(addConcertPath, addConcert);

// Fix syntax in add-song-form.tsx
let addSongPath = path.join(__dirname, '../src/components/add-song-form.tsx');
let addSong = fs.readFileSync(addSongPath, 'utf8');
addSong = addSong.replace(/placeholder=t\(/g, 'placeholder={t(');
addSong = addSong.replace(/placeholder=\{t\('([^']+)'\)\n/g, 'placeholder={t(\'$1\')}\n');
fs.writeFileSync(addSongPath, addSong);

// Fix syntax in audio-recorder.tsx
let audioPath = path.join(__dirname, '../src/components/audio-recorder.tsx');
let audio = fs.readFileSync(audioPath, 'utf8');
audio = audio.replace(/placeholder=t\(/g, 'placeholder={t(');
audio = audio.replace(/placeholder=\{t\('([^']+)'\)\n/g, 'placeholder={t(\'$1\')}\n');
fs.writeFileSync(audioPath, audio);

console.log("Hotovo JSX Syntax fix");
