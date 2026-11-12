const fs = require('fs');
const path = require('path');

// 1) Replace inside index.tsx
const indexTsxPath = path.join(__dirname, '../src/app/(tabs)/index.tsx');
let indexTsx = fs.readFileSync(indexTsxPath, 'utf8');
indexTsx = indexTsx.replace(/'Zkouška'/g, 't(\'events.defaultRehearsalTitle\')');
indexTsx = indexTsx.replace(/'Koncert'/g, 't(\'events.defaultConcertTitle\')');
indexTsx = indexTsx.replace(/'Člen kapely'/g, 't(\'events.unknownMember\')');
indexTsx = indexTsx.replace(/"Nepodařilo se uložit docházku\."/g, 't(\'home.attendance.errorMsg\')');
indexTsx = indexTsx.replace(/"Nelze upravit profil"/g, 't(\'band.edit.errorTitle\')');
indexTsx = indexTsx.replace(/"Nastala chyba při úpravě profilu kapely\."/g, 't(\'band.edit.errorMsg\')');
indexTsx = indexTsx.replace(/>Co připravit:</g, '>{t(\'events.whatToPrepare\')}</');
fs.writeFileSync(indexTsxPath, indexTsx);

// 2) Replace inside events.tsx
const eventsTsxPath = path.join(__dirname, '../src/app/(tabs)/events.tsx');
let eventsTsx = fs.readFileSync(eventsTsxPath, 'utf8');
eventsTsx = eventsTsx.replace(/Alert\.alert\("Chyba", "Nepodařilo se uložit docházku\."\)/g, 'Alert.alert(t(\'home.attendance.errorTitle\'), t(\'home.attendance.errorMsg\'))');
eventsTsx = eventsTsx.replace(/>Zrušeno</g, '>{t(\'form.rehearsal.cancelledLabel\')}<');
eventsTsx = eventsTsx.replace(/Zkouška v:/g, '{t(\'events.rehearsalIn\')}');
eventsTsx = eventsTsx.replace(/Důvod:/g, '{t(\'events.reason\')}');
fs.writeFileSync(eventsTsxPath, eventsTsx);

// 3) Replace inside repertoire.tsx
const repTsxPath = path.join(__dirname, '../src/app/(tabs)/repertoire.tsx');
let repTsx = fs.readFileSync(repTsxPath, 'utf8');
repTsx = repTsx.replace(/'Kapelník'/g, "t('onboarding.defaultAdminName')");
fs.writeFileSync(repTsxPath, repTsx);

// 4) Replace inside treasury.tsx
const treasuryTsxPath = path.join(__dirname, '../src/app/(tabs)/treasury.tsx');
let treasuryTsx = fs.readFileSync(treasuryTsxPath, 'utf8');
treasuryTsx = treasuryTsx.replace(/"Nepodařilo se načíst fotografii z galerie\."/g, "t('treasury.alert.errorPhoto')");
treasuryTsx = treasuryTsx.replace(/'🚫 Zrušená akce \(Nezapočteno\)'/g, "t('treasury.status.cancelled')");
treasuryTsx = treasuryTsx.replace(/'⏳ Plánovaný \(Budoucí akce\)'/g, "t('treasury.status.planned')");
treasuryTsx = treasuryTsx.replace(/'🟢 Skutečný příjem'/g, "t('treasury.status.realIncome')");
treasuryTsx = treasuryTsx.replace(/'🔴 Výdej'/g, "t('treasury.status.expense')");
fs.writeFileSync(treasuryTsxPath, treasuryTsx);

// 5) Add Absence Form
const addAbsPath = path.join(__dirname, '../src/components/add-absence-form.tsx');
let addAbs = fs.readFileSync(addAbsPath, 'utf8');
addAbs = addAbs.replace(/'Vyplňte prosím důvod absence\.'/g, "t('form.absence.errorReason')");
addAbs = addAbs.replace(/'Neznámý člen'/g, "t('form.absence.unknownMember')");
addAbs = addAbs.replace(/'Vyberte člena, kterého se absence týká\.'/g, "t('form.absence.errorMember')");
addAbs = addAbs.replace(/'Upozornění na událost během absence'/g, "t('form.absence.warning')");
fs.writeFileSync(addAbsPath, addAbs);

// 6) Add Concert form
const addConcertPath = path.join(__dirname, '../src/components/add-concert-form.tsx');
let addConcert = fs.readFileSync(addConcertPath, 'utf8');
addConcert = addConcert.replace(/'Pořadatel'/g, "t('form.concert.orgRole.organizer')");
addConcert = addConcert.replace(/'Zvukař'/g, "t('form.concert.orgRole.sound')");
addConcert = addConcert.replace(/'Kontakt'/g, "t('form.concert.orgRole.contact')");
addConcert = addConcert.replace(/'Zkušebna'/g, "t('form.concert.defaultDeparture')");
addConcert = addConcert.replace(/"Např. Festival Klášterec, Městské slavnosti"/g, "t('form.concert.placeholder.festival')");
addConcert = addConcert.replace(/"Např. Amfiteátr, Zámecký park Klášterec"/g, "t('form.concert.placeholder.location')");
addConcert = addConcert.replace(/"Např. Jan Novák"/g, "t('form.concert.placeholder.contactName')");
addConcert = addConcert.replace(/"Např. \+420 777 123 456"/g, "t('form.concert.placeholder.contactPhone')");
addConcert = addConcert.replace(/"Např. novak@poradatel.cz"/g, "t('form.concert.placeholder.contactEmail')");
fs.writeFileSync(addConcertPath, addConcert);

// 7) Add Inquiry form
const inquiryPath = path.join(__dirname, '../src/components/add-inquiry-form.tsx');
let inquiry = fs.readFileSync(inquiryPath, 'utf8');
inquiry = inquiry.replace(/'Zábava'/g, "t('form.inquiry.eventType.party')");
inquiry = inquiry.replace(/'Country bál'/g, "t('form.inquiry.eventType.countryBall')");
inquiry = inquiry.replace(/'Městská akce'/g, "t('form.inquiry.eventType.cityEvent')");
inquiry = inquiry.replace(/'Soukromá'/g, "t('form.inquiry.eventType.private')");
inquiry = inquiry.replace(/'Jiné'/g, "t('form.inquiry.eventType.other')");
fs.writeFileSync(inquiryPath, inquiry);

// 8) Add Rehearsal form
const rehPath = path.join(__dirname, '../src/components/add-rehearsal-form.tsx');
let reh = fs.readFileSync(rehPath, 'utf8');
reh = reh.replace(/'Zkušebna'/g, "t('form.rehearsal.places.room')");
reh = reh.replace(/'Vyplňte prosím místo konání zkoušky\.'/g, "t('form.rehearsal.errorLocation')");
reh = reh.replace(/'Klub'/g, "t('form.rehearsal.places.club')");
reh = reh.replace(/'Sál'/g, "t('form.rehearsal.places.hall')");
reh = reh.replace(/'Nové písničky 1-5'/g, "t('form.rehearsal.tips.songs')");
reh = reh.replace(/'Zpěvy v refrénu'/g, "t('form.rehearsal.tips.vocals')");
reh = reh.replace(/'Vzít si noty'/g, "t('form.rehearsal.tips.notes')");
reh = reh.replace(/'Příprava na koncert'/g, "t('form.rehearsal.tips.prep')");
fs.writeFileSync(rehPath, reh);

// 9) Add Ride form
const ridePath = path.join(__dirname, '../src/components/add-ride-form.tsx');
let ride = fs.readFileSync(ridePath, 'utf8');
ride = ride.replace(/'Řidič'/g, "t('form.ride.defaultDriver')");
fs.writeFileSync(ridePath, ride);

// 10) Add Song Form
const songPath = path.join(__dirname, '../src/components/add-song-form.tsx');
let song = fs.readFileSync(songPath, 'utf8');
song = song.replace(/>Vložit:</g, ">{t('form.song.insert')}<");
song = song.replace(/"Zde napište nebo vložte text písně s akordy v hranatých závorkách \[C\]\.\.\."/g, "t('form.song.placeholder.lyrics')");
fs.writeFileSync(songPath, song);

// 11) Add Vehicle form
const vehiclePath = path.join(__dirname, '../src/components/add-vehicle-form.tsx');
let vehicle = fs.readFileSync(vehiclePath, 'utf8');
vehicle = vehicle.replace(/'Benzín'/g, "t('form.vehicle.fuel.gas')");
fs.writeFileSync(vehiclePath, vehicle);

// 12) Audio recorder
const audioPath = path.join(__dirname, '../src/components/audio-recorder.tsx');
let audio = fs.readFileSync(audioPath, 'utf8');
audio = audio.replace(/'Importovaný záznam'/g, "t('audio.importedRecord')");
audio = audio.replace(/'Nová nahrávka'/g, "t('audio.newRecord')");
audio = audio.replace(/"Název nahrávky\.\.\."/g, "t('audio.placeholder.name')");
fs.writeFileSync(audioPath, audio);

// 13) Song lyrics viewer
const slvPath = path.join(__dirname, '../src/components/song-lyrics-viewer.tsx');
let slv = fs.readFileSync(slvPath, 'utf8');
slv = slv.replace(/'Kapelník'/g, "t('onboarding.defaultAdminName')");
slv = slv.replace(/'Aplikace nemá přístup k mikrofonu\.'/g, "t('audio.errorMicDenied')");
slv = slv.replace(/'Nepodařilo se spustit nahrávání\.'/g, "t('audio.errorStartRec')");
slv = slv.replace(/'Nahrávka uložena'/g, "t('audio.savedRecord')");
fs.writeFileSync(slvPath, slv);

console.log("Hotovo JSX");
