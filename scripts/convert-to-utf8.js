const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'texty');

// CP1250 byte map (Windows Latin 2)
const cp1250Map = {
  0x80: '€', 0x82: '‚', 0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡',
  0x89: '‰', 0x8A: 'Š', 0x8B: '‹', 0x8C: 'Ś', 0x8D: 'Ť', 0x8E: 'Ž', 0x8F: 'Ź',
  0x90: '‘', 0x91: '’', 0x92: '“', 0x93: '”', 0x94: '•', 0x95: '–', 0x96: '—',
  0x98: '™', 0x9A: 'š', 0x9B: '›', 0x9C: 'ś', 0x9D: 'ť', 0x9E: 'ž', 0x9F: 'ź',
  0xA0: ' ', 0xA1: 'ˇ', 0xA2: '˘', 0xA3: 'Ł', 0xA4: '¤', 0xA5: 'Ą', 0xA6: '¦', 0xA7: '§',
  0xA8: '¨', 0xA9: '©', 0xAA: 'Ş', 0xAB: '«', 0xAC: '¬', 0xAD: '­', 0xAE: '®', 0xAF: 'Ż',
  0xB0: '°', 0xB1: '±', 0xB2: '˛', 0xB3: 'ł', 0xB4: '´', 0xB5: 'µ', 0xB6: '¶', 0xB7: '·',
  0xB8: '¸', 0xB9: 'ą', 0xBA: 'ş', 0xBB: '»', 0xBC: 'Ľ', 0xBD: '˝', 0xBE: 'ľ', 0xBF: 'ż',
  0xC0: 'Ŕ', 0xC1: 'Á', 0xC2: 'Â', 0xC3: 'Ă', 0xC4: 'Ä', 0xC5: 'Ĺ', 0xC6: 'Ć', 0xC7: 'Ç',
  0xC8: 'Č', 0xC9: 'É', 0xCA: 'Ę', 0xCB: 'Ë', 0xCC: 'Ě', 0xCD: 'Í', 0xCE: 'Î', 0xCF: 'Ď',
  0xD0: 'Đ', 0xD1: 'Ń', 0xD2: 'Ň', 0xD3: 'Ó', 0xD4: 'Ô', 0xD5: 'Ő', 0xD6: 'Ö', 0xD7: '×',
  0xD8: 'Ř', 0xD9: 'Ů', 0xDA: 'Ú', 0xDB: 'Ű', 0xDC: 'Ü', 0xDD: 'Ý', 0xDE: 'Ţ', 0xDF: 'ß',
  0xE0: 'ŕ', 0xE1: 'á', 0xE2: 'â', 0xE3: 'ă', 0xE4: 'ä', 0xE5: 'ĺ', 0xE6: 'ć', 0xE7: 'ç',
  0xE8: 'č', 0xE9: 'é', 0xEA: 'ę', 0xEB: 'ë', 0xEC: 'ě', 0xED: 'í', 0xEE: 'î', 0xEF: 'ď',
  0xF0: 'đ', 0xF1: 'ń', 0xF2: 'ň', 0xF3: 'ó', 0xF4: 'ô', 0xF5: 'ő', 0xF6: 'ö', 0xF7: '÷',
  0xF8: 'ř', 0xF9: 'ů', 0xFA: 'ú', 0xFB: 'ű', 0xFC: 'ü', 0xFD: 'ý', 0xFE: 'ţ', 0xFF: '˙'
};

// CP895 byte map (Kamenických DOS Czech)
const cp895Map = {
  0x80: 'Č', 0x81: 'ü', 0x82: 'é', 0x83: 'ď', 0x84: 'ä', 0x85: 'Ď', 0x86: 'Ť', 0x87: 'č',
  0x88: 'ě', 0x89: 'Ě', 0x8A: 'Ĺ', 0x8B: 'Í', 0x8C: 'ľ', 0x8D: 'ĺ', 0x8E: 'Ä', 0x8F: 'Á',
  0x90: 'É', 0x91: 'ž', 0x92: 'Ž', 0x93: 'ô', 0x94: 'ö', 0x95: 'Ó', 0x96: 'ů', 0x97: 'Ú',
  0x98: 'ý', 0x99: 'Ö', 0x9A: 'Ü', 0x9B: 'Š', 0x9C: 'L', 0x9D: 'Ý', 0x9E: 'R', 0x9F: 't',
  0xA0: 'á', 0xA1: 'í', 0xA2: 'ó', 0xA3: 'ú', 0xA4: 'ň', 0xA5: 'Ň', 0xA6: 'Š', 0xA7: 'š',
  0xA8: 'Ř', 0xA9: 'ř', 0xAA: 'ť'
};

// CP852 byte map (DOS Latin 2)
const cp852Map = {
  0x80: 'Ç', 0x81: 'ü', 0x82: 'é', 0x83: 'â', 0x84: 'ä', 0x85: 'ů', 0x86: 'ć', 0x87: 'ç',
  0x88: 'ł', 0x89: 'ë', 0x8A: 'Ő', 0x8B: 'ő', 0x8C: 'î', 0x8D: 'Ź', 0x8E: 'Ä', 0x8F: 'Ć',
  0x90: 'É', 0x91: 'Ĺ', 0x92: 'ĺ', 0x93: 'ô', 0x94: 'ö', 0x95: 'L', 0x96: 'l', 0x97: 'Ś',
  0x98: 'ś', 0x99: 'Ö', 0x9A: 'Ü', 0x9B: 'Ť', 0x9C: 'ť', 0x9D: 'Ł', 0x9E: 'Ø', 0x9F: 'č',
  0xA0: 'á', 0xA1: 'í', 0xA2: 'ó', 0xA3: 'ú', 0xA4: 'Ą', 0xA5: 'ą', 0xA6: 'Ž', 0xA7: 'ž',
  0xA8: 'Ę', 0xA9: 'ę', 0xAA: 'Ź', 0xAB: 'ź', 0xAC: 'Č', 0xAD: 'ş', 0xAE: '«', 0xAF: '»',
  0xD4: 'ď', 0xD2: 'Ď', 0xE4: 'ň', 0xE3: 'Ň', 0xFC: 'ř', 0xFB: 'Ř', 0xE7: 'š', 0xE6: 'Š',
  0xEC: 'ě', 0xEB: 'Ě', 0xED: 'Y', 0xDD: 'Ý'
};

function decodeMappedBytes(bytes, map) {
  let result = '';
  for (let j = 0; j < bytes.length; j++) {
    const b = bytes[j];
    if (b <= 0x7F) {
      result += String.fromCharCode(b);
    } else {
      result += map[b] || String.fromCharCode(b);
    }
  }
  return result;
}

function scoreCzechText(text) {
  if (!text) return -100;
  let score = 0;
  const czechMatches = text.match(/[áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/g);
  if (czechMatches) score += czechMatches.length * 5;

  const garbageMatches = text.match(/[~§€¤†‡‰ˇ˘˛˝ĽľŔŕĹĺ]/g);
  if (garbageMatches) score -= garbageMatches.length * 4;

  const czechWords = text.match(/\b(je|v|na|se|z|já|má|ale|pár|a|i|to|pro|jak|nebo|veď|mě|dál|cesto|však|všech|všechny|někde|chtěl|měl|každá|žáru)\b/gi);
  if (czechWords) score += czechWords.length * 10;

  return score;
}

function fixCzechDiacritics(str) {
  if (!str) return '';

  let text = str
    .replace(/\0/g, '') // Remove UTF-16 null bytes
    .replace(/Ã¡/g, 'á')
    .replace(/Ã©/g, 'é')
    .replace(/Ã­/g, 'í')
    .replace(/Ã½/g, 'ý')
    .replace(/Ã³/g, 'ó')
    .replace(/Ãº/g, 'ú')
    .replace(/Ã¹/g, 'ů')
    .replace(/Ã¨/g, 'č')
    .replace(/Ã¬/g, 'ě')
    .replace(/Ã²/g, 'ň')
    .replace(/Å¡/g, 'š')
    .replace(/┼¡/g, 'š')
    .replace(/Lˇ/g, 'š')
    .replace(/L\^/g, 'š')
    .replace(/Å\u00a1/g, 'š')
    .replace(/Åž/g, 'š')
    .replace(/Å¾/g, 'ž')
    .replace(/┼¾/g, 'ž')
    .replace(/Å™/g, 'ř')
    .replace(/┼™/g, 'ř')
    .replace(/┼¥/g, 'ť')
    .replace(/Å¥/g, 'ť')
    .replace(/ÄŤ/g, 'č')
    .replace(/Äť/g, 'ť')
    .replace(/Ä›/g, 'ě')
    .replace(/Åˆ/g, 'ň')
    .replace(/Ã/g, 'Á')
    .replace(/Ã‰/g, 'É')
    .replace(/Ã“/g, 'Ó')
    .replace(/Ãš/g, 'Ú')
    .replace(/Å/g, 'Š')
    .replace(/Å½/g, 'Ž')
    .replace(/Å˜/g, 'Ř')
    .replace(/Å¤/g, 'Ť');

  const C = '(\\s*(?:\\[[^\\]]+\\]\\s*)?)';

  text = text
    .replace(new RegExp(`ka~d${C}á`, 'g'), 'každ$1á')
    .replace(new RegExp(`ka~d${C}é`, 'g'), 'každ$1é')
    .replace(new RegExp(`ka~d${C}ý`, 'g'), 'každ$1ý')
    .replace(new RegExp(`ka~d${C}o`, 'g'), 'každ$1o')
    .replace(new RegExp(`v~dy${C}e`, 'g'), 'vždyť$1')
    .replace(new RegExp(`v~dy`, 'g'), 'vždy')
    .replace(new RegExp(`~${C}ár`, 'g'), 'ž$1ár')
    .replace(new RegExp(`~${C}ád`, 'g'), 'ž$1ád')
    .replace(new RegExp(`mo~n`, 'g'), 'možn')
    .replace(new RegExp(`tě~k`, 'g'), 'těžk')
    .replace(new RegExp(`~e`, 'g'), 'že')
    .replace(new RegExp(`~í`, 'g'), 'ží')
    .replace(new RegExp(`~á`, 'g'), 'žá')
    .replace(new RegExp(`~o`, 'g'), 'žo')
    .replace(new RegExp(`va${C}ak`, 'g'), 'vš$1ak')
    .replace(new RegExp(`va${C}ech`, 'g'), 'vš$1ech')
    .replace(new RegExp(`va${C}echn`, 'g'), 'vš$1echn')
    .replace(new RegExp(`va${C}í`, 'g'), 'vš$1í')
    .replace(new RegExp(`va${C}em`, 'g'), 'vš$1em')
    .replace(new RegExp(`N${C}kde`, 'g'), 'Ně$1kde')
    .replace(new RegExp(`n${C}kde`, 'g'), 'ně$1kde')
    .replace(new RegExp(`cht${C}l`, 'g'), 'chtě$1l')
    .replace(new RegExp(`(\\b)m${C}l(\\b)`, 'g'), '$1mě$2l$3')
    .replace(new RegExp(`(\\b)a${C}e(\\b)`, 'g'), '$1a$2le$3')
    .replace(new RegExp(`ve${C}\\s+m\\s+dál`, 'gi'), 'veď$1 mě dál')
    .replace(new RegExp(`ve${C}\\s+m\\s`, 'gi'), 'veď$1 mě ')
    .replace(new RegExp(`kon\\s+${C}í`, 'g'), 'kon$1í')
    .replace(new RegExp(`kon${C}\\s+ía`, 'g'), 'kon$1čí')
    .replace(new RegExp(`kon${C}\\s+ím`, 'g'), 'kon$1čím')
    .replace(/`ţ1\./g, '1.')
    .replace(/`ţ/g, '');

  return text;
}

function decodeBytes(buffer) {
  // Check UTF-16 LE BOM (0xFF, 0xFE)
  if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
    const str = buffer.toString('utf16le');
    return fixCzechDiacritics(str);
  }
  // Check UTF-16 BE BOM (0xFE, 0xFF)
  if (buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) {
    const swapped = Buffer.alloc(buffer.length - 2);
    for (let i = 2; i < buffer.length; i += 2) {
      swapped[i - 2] = buffer[i + 1];
      swapped[i - 1] = buffer[i];
    }
    return fixCzechDiacritics(swapped.toString('utf16le'));
  }

  // Check if buffer contains UTF-16 null bytes
  let nullCount = 0;
  for (let i = 0; i < Math.min(100, buffer.length); i++) {
    if (buffer[i] === 0) nullCount++;
  }
  if (nullCount > 10) {
    const str = buffer.toString('utf16le');
    return fixCzechDiacritics(str);
  }

  // Check UTF-8 validity
  let isUtf8 = true;
  let hasMultiByte = false;
  let i = 0;
  while (i < buffer.length) {
    const b = buffer[i];
    if (b <= 0x7F) {
      i++;
    } else if ((b & 0xE0) === 0xC0) {
      if (i + 1 >= buffer.length || (buffer[i + 1] & 0xC0) !== 0x80) { isUtf8 = false; break; }
      hasMultiByte = true;
      i += 2;
    } else if ((b & 0xF0) === 0xE0) {
      if (i + 2 >= buffer.length || (buffer[i + 1] & 0xC0) !== 0x80 || (buffer[i + 2] & 0xC0) !== 0x80) { isUtf8 = false; break; }
      hasMultiByte = true;
      i += 3;
    } else if ((b & 0xF8) === 0xF0) {
      if (i + 3 >= buffer.length || (buffer[i + 1] & 0xC0) !== 0x80 || (buffer[i + 2] & 0xC0) !== 0x80 || (buffer[i + 3] & 0xC0) !== 0x80) { isUtf8 = false; break; }
      hasMultiByte = true;
      i += 4;
    } else {
      isUtf8 = false;
      break;
    }
  }

  if (isUtf8 && hasMultiByte) {
    const utf8Str = buffer.toString('utf8');
    if (scoreCzechText(utf8Str) >= 0) {
      return fixCzechDiacritics(utf8Str);
    }
  }

  const candidateCp1250 = decodeMappedBytes(buffer, cp1250Map);
  const score1250 = scoreCzechText(candidateCp1250);

  const candidateCp895 = decodeMappedBytes(buffer, cp895Map);
  const score895 = scoreCzechText(candidateCp895);

  const candidateCp852 = decodeMappedBytes(buffer, cp852Map);
  const score852 = scoreCzechText(candidateCp852);

  let bestText = candidateCp1250;
  let maxScore = score1250;

  if (score895 > maxScore) {
    bestText = candidateCp895;
    maxScore = score895;
  }
  if (score852 > maxScore) {
    bestText = candidateCp852;
    maxScore = score852;
  }

  return fixCzechDiacritics(bestText);
}

// Restore originals from git if needed or convert
const files = fs.readdirSync(dir);
let convertedCount = 0;

for (const file of files) {
  if (!file.endsWith('.txt') && !file.endsWith('.pro') && !file.endsWith('.chordpro') && !file.endsWith('.mss')) continue;
  const filePath = path.join(dir, file);
  const buffer = fs.readFileSync(filePath);

  const decodedText = decodeBytes(buffer);
  fs.writeFileSync(filePath, decodedText, 'utf8');
  convertedCount++;
}

console.log(`Successfully converted ${convertedCount} files in ${dir} to clean UTF-8.`);
