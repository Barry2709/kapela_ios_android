const fs = require('fs');

let file = 'src/components/band-header.tsx';
let c = fs.readFileSync(file, 'utf8');

const oldResponderStart = `onStartShouldSetPanResponder: () => false,`;
const newResponderStart = `onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        if (activeRoleView !== 'fan') return false;
        return Math.abs(gestureState.dx) > 30; // Vyšší priorita zachycení gesta pro fanoušky
      },`;

c = c.replace(oldResponderStart, newResponderStart);
fs.writeFileSync(file, c);
console.log('Fixed PanResponder capture logic');
