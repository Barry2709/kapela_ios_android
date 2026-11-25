const fs = require('fs');

const updateToggleFn = `  const handleToggleFanGoing = async (concert: Concert) => {
    const targetBandId = concert.bandId || activeBand?.id;
    if (!targetBandId) return;

    try {
      const savedName = currentUser?.displayName || (await AsyncStorage.getItem('savedFanName')) || 'Fanoušek';
      const savedUid = currentUser?.uid || (await AsyncStorage.getItem('savedFanEmail')) || 'fan_' + savedName.toLowerCase().replace(/\\s+/g, '_');

      // Optimistic Update v UI
      const updatedConcerts = concerts.map(c => {
        if (c.id === concert.id) {
          const newAttendees = { ...(c.attendees || {}) };
          const matchingKeys = Object.keys(newAttendees).filter(k => {
            if (k === savedUid) return true;
            const record = newAttendees[k];
            if (record && typeof record === 'object' && (record as any).name && savedName) {
              return (record as any).name.toLowerCase() === savedName.toLowerCase();
            }
            return false;
          });

          if (matchingKeys.length > 0) {
            matchingKeys.forEach(k => delete newAttendees[k]); // Nejdu
          } else {
            newAttendees[savedUid] = { // Jdu
              status: 'yes',
              // @ts-ignore
              name: savedName,
              role: 'fan',
              updatedAt: Date.now(),
            };
          }
          return { ...c, attendees: newAttendees };
        }
        return c;
      });

      // Okamžitá aktualizace na obrazovce (bez čekání na server)
      setConcerts(updatedConcerts);

      // Aktualizace v datech Firebase na pozadí
      const currentAttendees = { ...(concert.attendees || {}) };
      const matchingKeysDb = Object.keys(currentAttendees).filter(k => {
        if (k === savedUid) return true;
        const record = currentAttendees[k];
        if (record && typeof record === 'object' && (record as any).name && savedName) {
          return (record as any).name.toLowerCase() === savedName.toLowerCase();
        }
        return false;
      });

      if (matchingKeysDb.length > 0) {
        // Tady je klíčový moment: ve Firebase místo delete (což nefunguje s merge: true uvnitř updateConcert)
        // musíme hodnotu explicitně nastavit na null nebo pole poslat natvrdo.
        // Pro update objektů ve Firebase, nastavení na null nebo změna statusu vyřeší update problému.
        matchingKeysDb.forEach(k => {
          currentAttendees[k] = { status: 'no', role: 'fan', updatedAt: Date.now() };
        });
      } else {
        currentAttendees[savedUid] = {
          status: 'yes',
          // @ts-ignore
          name: savedName,
          role: 'fan',
          updatedAt: Date.now(),
        };
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
  /const handleToggleFanGoing = async [\s\S]*?catch \(e\) \{\s*console\.error\("Chyba při ukládání účasti:", e\);\s*\/\/[^\n]*\n\s*\}\s*\};/,
  updateToggleFn
);

fs.writeFileSync(indexFile, idxCode);

// 2. Update events.tsx
let eventsFile = 'src/app/(tabs)/events.tsx';
let evtCode = fs.readFileSync(eventsFile, 'utf8');

evtCode = evtCode.replace(
  /const handleToggleFanGoing = async [\s\S]*?catch \(e\) \{\s*console\.error\("Chyba při ukládání účasti:", e\);\s*\/\/[^\n]*\n\s*\}\s*\};/,
  updateToggleFn
);

fs.writeFileSync(eventsFile, evtCode);

console.log('Successfully fixed Firebase deletion issue by using status: no!');
