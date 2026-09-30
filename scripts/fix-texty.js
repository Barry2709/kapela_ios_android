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

function fixDiacritics(text) {
  if (!text) return '';
  return text
    .replace(/[\0\uFFFD]/g, '')
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
}

function processFile(filePath) {
  const buf = fs.readFileSync(filePath);

  let isUtf8 = true;
  let hasMultiByte = false;
  let i = 0;
  while (i < buf.length) {
    const b = buf[i];
    if (b <= 0x7F) {
      i++;
    } else if ((b & 0xE0) === 0xC0) {
      if (i + 1 >= buf.length || (buf[i + 1] & 0xC0) !== 0x80) { isUtf8 = false; break; }
      hasMultiByte = true;
      i += 2;
    } else if ((b & 0xF0) === 0xE0) {
      if (i + 2 >= buf.length || (buf[i + 1] & 0xC0) !== 0x80 || (buf[i + 2] & 0xC0) !== 0x80) { isUtf8 = false; break; }
      hasMultiByte = true;
      i += 3;
    } else {
      isUtf8 = false;
      break;
    }
  }

  if (isUtf8 && (hasMultiByte || buf.length > 0)) {
    const text = buf.toString('utf8');
    if (scoreCzechText(text) >= 0) {
      fs.writeFileSync(filePath, fixDiacritics(text), 'utf8');
      return;
    }
  }

  const cand1250 = decodeMappedBytes(buf, cp1250Map);
  const cand895 = decodeMappedBytes(buf, cp895Map);

  const score1250 = scoreCzechText(cand1250);
  const score895 = scoreCzechText(cand895);

  let best = cand1250;
  if (score895 > score1250) {
    best = cand895;
  }

  fs.writeFileSync(filePath, fixDiacritics(best), 'utf8');
}

const files = fs.readdirSync(dir);
for (const f of files) {
  if (f.endsWith('.txt') || f.endsWith('.pro') || f.endsWith('.chordpro') || f.endsWith('.mss')) {
    processFile(path.join(dir, f));
  }
}
console.log('Processed all files in texty directory to clean UTF-8.');
