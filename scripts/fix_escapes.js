const fs = require('fs');
const path = 'C:/Users/Lenovo/AndroidStudioProjects/kapela_ios_android/src/utils/i18n.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/\\\\'e-mail/g, "\\'e-mail");
content = content.replace(/\\\\'enregistrer/g, "\\'enregistrer");
content = content.replace(/l\\\\'e-mail/g, "l\\'e-mail");

fs.writeFileSync(path, content);
console.log('Fixed escapes in i18n.ts');
