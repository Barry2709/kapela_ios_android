const fs = require('fs');
const file = 'src/app/(tabs)/index.tsx';
let c = fs.readFileSync(file, 'utf8');

if (!c.includes("import { HelpModal }")) {
  c = c.replace(
    /import \{ BandHeader \} from '@\/components\/band-header';/,
    "import { BandHeader } from '@/components/band-header';\nimport { HelpModal } from '@/components/help-modal';"
  );
}

if (!c.includes('const [showHelpModal, setShowHelpModal] = useState(false);')) {
  c = c.replace(
    /const \[showSwitchBandModal, setShowSwitchBandModal\] = useState\(false\);/,
    "const [showSwitchBandModal, setShowSwitchBandModal] = useState(false);\n  const [showHelpModal, setShowHelpModal] = useState(false);"
  );
}

if (!c.includes('<HelpModal')) {
  c = c.replace(
    /<SwitchBandModal/,
    "<HelpModal visible={showHelpModal} onClose={() => setShowHelpModal(false)} role={activeRoleView} />\n\n      <SwitchBandModal"
  );
}

const oldLogoutBtn = `<Pressable onPress={handleOpenSwitchModal} style={[styles.logoutBtnInline, { marginRight: 8, backgroundColor: 'rgba(33, 150, 243, 0.1)', borderColor: 'rgba(33, 150, 243, 0.4)' }]}>`;
const newBtnGroup = `<Pressable onPress={() => setShowHelpModal(true)} style={[styles.logoutBtnInline, { marginRight: 8, paddingHorizontal: 10 }]}>
                <SymbolView name={{ ios: 'questionmark.circle.fill', android: 'help', web: 'help' }} size={16} tintColor={theme.text} />
              </Pressable>

              <Pressable onPress={handleOpenSwitchModal} style={[styles.logoutBtnInline, { marginRight: 8, backgroundColor: 'rgba(33, 150, 243, 0.1)', borderColor: 'rgba(33, 150, 243, 0.4)' }]}>`;

if (c.includes(oldLogoutBtn)) {
  c = c.replace(oldLogoutBtn, newBtnGroup);
  fs.writeFileSync(file, c);
  console.log('Successfully injected Help Button into loggedInRow!');
}
