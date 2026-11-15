const fs = require('fs');
let file = 'src/app/_layout.tsx';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
  /<Stack screenOptions=\{\{ headerShown: false \}\} \/>/,
  `<GestureHandlerRootView style={{ flex: 1 }}>\n        <Stack screenOptions={{ headerShown: false }} />\n      </GestureHandlerRootView>`
);

// We need to import GestureHandlerRootView in _layout.tsx!
if (!c.includes('import { GestureHandlerRootView }')) {
  c = "import { GestureHandlerRootView } from 'react-native-gesture-handler';\n" + c;
}

fs.writeFileSync(file, c);
console.log('Fixed GestureHandler Root wrapping directly around the router Stack.');

// 2. Fix the logo container in band-header.tsx - DO NOT Wrap the WHOLE component, just wrap the Image itself so it intercepts correctly
let fileH = 'src/components/band-header.tsx';
let cH = fs.readFileSync(fileH, 'utf8');

cH = cH.replace(/<GestureHandlerRootView[\s\S]*?<GestureDetector gesture=\{panGesture\}>/,
`    <View style={[styles.header, { paddingTop: insets.top + 3 }]}>
      <GestureDetector gesture={panGesture}>`);

cH = cH.replace(/<\/GestureDetector>\n\s*<\/GestureHandlerRootView>/,
`      </GestureDetector>
    </View>`);

fs.writeFileSync(fileH, cH);
console.log('Cleaned up BandHeader nested roots');
