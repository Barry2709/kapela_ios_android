const fs = require('fs');

let file = 'src/app/(tabs)/index.tsx';
let c = fs.readFileSync(file, 'utf8');

if (!c.includes('<HelpModal')) {
  c = c.replace(
    /<SwitchBandModal/,
    "<HelpModal visible={showHelpModal} onClose={() => setShowHelpModal(false)} role={activeRoleView} />\n\n      <SwitchBandModal"
  );

  if (c.includes('<SwitchBandModal')) {
     console.log('SwitchBandModal found!');
  } else {
     // SwitchBandModal might not exist in index.tsx directly, let's insert it before the first Modal
     c = c.replace(
        /<Modal visible=\{showSwitchBandModal\}/,
        "<HelpModal visible={showHelpModal} onClose={() => setShowHelpModal(false)} role={activeRoleView} />\n\n      <Modal visible={showSwitchBandModal}"
     );
  }
}

fs.writeFileSync(file, c);
console.log('Injected missing <HelpModal /> into index.tsx!');
