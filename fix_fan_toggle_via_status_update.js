const fs = require('fs');

const toggleLogic = `  const handleToggleFanGoing = async (concert: Concert) => {
    const targetBandId = concert.bandId || activeBand?.id;
    if (!targetBandId) return;

    try {
      const savedName = currentUser?.displayName || (await AsyncStorage.getItem('savedFanName')) || 'Fanoušek';
      const savedUid = currentUser?.uid || (await AsyncStorage.getItem('savedFanEmail')) || 'fan_' + savedName.toLowerCase().replace(/\\s+/g, '_');

      // Optimistic Update v UI
      const updatedConcerts = concerts.map(c => {
        if (c.id === concert.id) {
          const newAttendees = { ...(c.attendees || {}) };

          let existingKey = savedUid;
          const matchingKeys = Object.keys(newAttendees).filter(k => {
            if (k === savedUid) return true;
            const record = newAttendees[k];
            if (record && typeof record === 'object' && (record as any).name && savedName) {
              return (record as any).name.toLowerCase() === savedName.toLowerCase();
            }
            return false;
          });

          if (matchingKeys.length > 0) {
            existingKey = matchingKeys[0];
          }

          const currentRecord = newAttendees[existingKey];
          const currentStatus = typeof currentRecord === 'string' ? currentRecord : currentRecord?.status;

          if (currentStatus === 'yes') {
            // Pokud byl 'yes', změníme ho na 'no'
            newAttendees[existingKey] = {
              status: 'no',
              // @ts-ignore
              name: savedName,
              updatedAt: Date.now(),
            } as any;
            newAttendees[existingKey].role = 'fan';
          } else {
            // Pokud ještě nebyl, nebo byl 'no' / 'maybe', nastavíme 'yes'
            newAttendees[existingKey] = {
              status: 'yes',
              // @ts-ignore
              name: savedName,
              updatedAt: Date.now(),
            } as any;
            newAttendees[existingKey].role = 'fan';
          }
          return { ...c, attendees: newAttendees };
        }
        return c;
      });

      // Okamžitá aktualizace na obrazovce
      setConcerts(updatedConcerts);

      // Aktualizace v datech Firebase na pozadí
      const currentAttendees = { ...(concert.attendees || {}) };

      let existingKeyDb = savedUid;
      const matchingKeysDb = Object.keys(currentAttendees).filter(k => {
        if (k === savedUid) return true;
        const record = currentAttendees[k];
        if (record && typeof record === 'object' && (record as any).name && savedName) {
          return (record as any).name.toLowerCase() === savedName.toLowerCase();
        }
        return false;
      });

      if (matchingKeysDb.length > 0) {
        existingKeyDb = matchingKeysDb[0];
      }

      const dbRecord = currentAttendees[existingKeyDb];
      const dbStatus = typeof dbRecord === 'string' ? dbRecord : dbRecord?.status;

      if (dbStatus === 'yes') {
        currentAttendees[existingKeyDb] = { status: 'no', updatedAt: Date.now() } as any;
        (currentAttendees[existingKeyDb] as any).name = savedName;
        (currentAttendees[existingKeyDb] as any).role = 'fan';
      } else {
        currentAttendees[existingKeyDb] = { status: 'yes', updatedAt: Date.now() } as any;
        (currentAttendees[existingKeyDb] as any).name = savedName;
        (currentAttendees[existingKeyDb] as any).role = 'fan';
      }

      await updateConcert(targetBandId, concert.id, { attendees: currentAttendees as any });
    } catch (e) {
      console.error("Chyba při ukládání účasti:", e);
    }
  };`;

// 1. Update index.tsx
let indexFile = 'src/app/(tabs)/index.tsx';
let idxCode = fs.readFileSync(indexFile, 'utf8');

idxCode = idxCode.replace(
  /const handleToggleFanGoing = async [\s\S]*?catch \(e\) \{\s*console\.error\("Chyba při ukládání účasti:", e\);\s*\/\/[^\n]*\n\s*\}\s*\};/g,
  toggleLogic
);
// Also fallback if the comments were already removed
idxCode = idxCode.replace(
  /const handleToggleFanGoing = async [\s\S]*?catch \(e\) \{\s*console\.error\("Chyba při ukládání účasti:", e\);\s*\}\s*\};/g,
  toggleLogic
);

fs.writeFileSync(indexFile, idxCode);

// 2. Update events.tsx
let eventsFile = 'src/app/(tabs)/events.tsx';
let evtCode = fs.readFileSync(eventsFile, 'utf8');

evtCode = evtCode.replace(
  /const handleToggleFanGoing = async [\s\S]*?catch \(e\) \{\s*console\.error\("Chyba při ukládání účasti:", e\);\s*\/\/[^\n]*\n\s*\}\s*\};/g,
  toggleLogic
);
evtCode = evtCode.replace(
  /const handleToggleFanGoing = async [\s\S]*?catch \(e\) \{\s*console\.error\("Chyba při ukládání účasti:", e\);\s*\}\s*\};/g,
  toggleLogic
);

fs.writeFileSync(eventsFile, evtCode);

console.log('Successfully switched Fan toggle behavior to yes/no updates instead of deletion!');
