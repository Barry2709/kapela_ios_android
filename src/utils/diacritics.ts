// CP1250 byte map (Windows Latin 2)
const cp1250Map: Record<number, string> = {
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
const cp895Map: Record<number, string> = {
  0x80: 'Č', 0x81: 'ü', 0x82: 'é', 0x83: 'ď', 0x84: 'ä', 0x85: 'Ď', 0x86: 'Ť', 0x87: 'č',
  0x88: 'ě', 0x89: 'Ě', 0x8A: 'Ĺ', 0x8B: 'Í', 0x8C: 'ľ', 0x8D: 'ĺ', 0x8E: 'Ä', 0x8F: 'Á',
  0x90: 'É', 0x91: 'ž', 0x92: 'Ž', 0x93: 'ô', 0x94: 'ö', 0x95: 'Ó', 0x96: 'ů', 0x97: 'Ú',
  0x98: 'ý', 0x99: 'Ö', 0x9A: 'Ü', 0x9B: 'Š', 0x9C: 'L', 0x9D: 'Ý', 0x9E: 'R', 0x9F: 't',
  0xA0: 'á', 0xA1: 'í', 0xA2: 'ó', 0xA3: 'ú', 0xA4: 'ň', 0xA5: 'Ň', 0xA6: 'Š', 0xA7: 'š',
  0xA8: 'Ř', 0xA9: 'ř', 0xAA: 'ť'
};

// CP852 byte map (DOS Latin 2)
const cp852Map: Record<number, string> = {
  0x80: 'Ç', 0x81: 'ü', 0x82: 'é', 0x83: 'â', 0x84: 'ä', 0x85: 'ů', 0x86: 'ć', 0x87: 'ç',
  0x88: 'ł', 0x89: 'ë', 0x8A: 'Ő', 0x8B: 'ő', 0x8C: 'î', 0x8D: 'Ź', 0x8E: 'Ä', 0x8F: 'Ć',
  0x90: 'É', 0x91: 'Ĺ', 0x92: 'ĺ', 0x93: 'ô', 0x94: 'ö', 0x95: 'L', 0x96: 'l', 0x97: 'Ś',
  0x98: 'ś', 0x99: 'Ö', 0x9A: 'Ü', 0x9B: 'Ť', 0x9C: 'ť', 0x9D: 'Ł', 0x9E: 'Ø', 0x9F: 'č',
  0xA0: 'á', 0xA1: 'í', 0xA2: 'ó', 0xA3: 'ú', 0xA4: 'Ą', 0xA5: 'ą', 0xA6: 'Ž', 0xA7: 'ž',
  0xA8: 'Ę', 0xA9: 'ę', 0xAA: 'Ź', 0xAB: 'ź', 0xAC: 'Č', 0xAD: 'ş', 0xAE: '«', 0xAF: '»',
  0xD4: 'ď', 0xD2: 'Ď', 0xE4: 'ň', 0xE3: 'Ň', 0xFC: 'ř', 0xFB: 'Ř', 0xE7: 'š', 0xE6: 'Š',
  0xEC: 'ě', 0xEB: 'Ě', 0xED: 'Y', 0xDD: 'Ý'
};

// Converts Base64 string directly to Uint8Array without string encoding corruption
export function base64ToUint8Array(base64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }

  let bufferLength = base64.length * 0.75;
  if (base64[base64.length - 1] === '=') {
    bufferLength--;
    if (base64[base64.length - 2] === '=') {
      bufferLength--;
    }
  }

  const bytes = new Uint8Array(bufferLength);
  let p = 0;
  for (let i = 0; i < base64.length; i += 4) {
    const encoded1 = lookup[base64.charCodeAt(i)];
    const encoded2 = lookup[base64.charCodeAt(i + 1)];
    const encoded3 = lookup[base64.charCodeAt(i + 2)];
    const encoded4 = lookup[base64.charCodeAt(i + 3)];

    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    if (p < bufferLength) {
      bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    }
    if (p < bufferLength) {
      bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
    }
  }

  return bytes;
}

// Pure JS UTF-8 Uint8Array decoder (independent of TextDecoder which is absent in React Native Hermes)
export function decodeUtf8Bytes(bytes: Uint8Array, offset = 0): string {
  let result = '';
  let i = offset;
  while (i < bytes.length) {
    const c = bytes[i++];
    if (c < 0x80) {
      result += String.fromCharCode(c);
    } else if (c > 0xbf && c < 0xe0) {
      if (i >= bytes.length) break;
      const c2 = bytes[i++];
      result += String.fromCharCode(((c & 0x1f) << 6) | (c2 & 0x3f));
    } else if (c > 0xdf && c < 0xf0) {
      if (i + 1 >= bytes.length) break;
      const c2 = bytes[i++];
      const c3 = bytes[i++];
      result += String.fromCharCode(((c & 0x0f) << 12) | ((c2 & 0x3f) << 6) | (c3 & 0x3f));
    } else {
      if (i + 2 >= bytes.length) break;
      const c2 = bytes[i++];
      const c3 = bytes[i++];
      const c4 = bytes[i++];
      let u = (((c & 0x07) << 18) | ((c2 & 0x3f) << 12) | ((c3 & 0x3f) << 6) | (c4 & 0x3f)) - 0x10000;
      result += String.fromCharCode(0xd800 + (u >> 10), 0xdc00 + (u & 0x3ff));
    }
  }
  return result;
}

// Map bytes using custom map
function decodeMappedBytes(bytes: Uint8Array, map: Record<number, string>, offset = 0): string {
  let result = '';
  for (let j = offset; j < bytes.length; j++) {
    const b = bytes[j];
    if (b <= 0x7F) {
      result += String.fromCharCode(b);
    } else {
      result += map[b] || String.fromCharCode(b);
    }
  }
  return result;
}

// Calculate Czech quality score for text
function scoreCzechText(text: string): number {
  if (!text) return -100;
  let score = 0;
  // Common Czech diacritics
  const czechMatches = text.match(/[áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/g);
  if (czechMatches) score += czechMatches.length * 5;

  // Penalty for unusual control/garbage chars from misdecoding
  const garbageMatches = text.match(/[~§€¤†‡‰ˇ˘˛˝ĽľŔŕĹĺ]/g);
  if (garbageMatches) score -= garbageMatches.length * 4;

  // Bonus for common Czech words
  const czechWords = text.match(/\b(je|v|na|se|z|já|má|ale|pár|a|i|to|pro|jak|nebo|veď|mě|dál|cesto|však|všech|všechny|někde|chtěl|měl|každá|žáru)\b/gi);
  if (czechWords) score += czechWords.length * 10;

  return score;
}

// Decodes raw bytes to Czech text trying UTF-16, UTF-8, CP1250, Kamenických (CP895), and CP852
export function decodeBytesToCzechText(bytes: Uint8Array): string {
  if (!bytes || bytes.length === 0) return '';

  // UTF-16 LE BOM
  if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
    let str = '';
    for (let j = 2; j < bytes.length - 1; j += 2) {
      str += String.fromCharCode(bytes[j] | (bytes[j + 1] << 8));
    }
    return fixCzechDiacritics(str);
  }

  // UTF-16 BE BOM
  if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
    let str = '';
    for (let j = 2; j < bytes.length - 1; j += 2) {
      str += String.fromCharCode((bytes[j] << 8) | bytes[j + 1]);
    }
    return fixCzechDiacritics(str);
  }

  // UTF-16 LE bez BOM (detekce nulových bajtů)
  let nulls = 0;
  for (let j = 0; j < Math.min(100, bytes.length); j++) {
    if (bytes[j] === 0) nulls++;
  }
  if (nulls > 10) {
    let str = '';
    for (let j = 0; j < bytes.length - 1; j += 2) {
      const code = bytes[j] | (bytes[j + 1] << 8);
      if (code !== 0) str += String.fromCharCode(code);
    }
    return fixCzechDiacritics(str);
  }

  let offset = 0;
  // UTF-8 BOM
  if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    offset = 3;
  }

  // Check UTF-8 validity
  let isUtf8 = true;
  let hasMultiByte = false;
  let i = offset;
  while (i < bytes.length) {
    const b = bytes[i];
    if (b <= 0x7F) {
      i++;
    } else if ((b & 0xE0) === 0xC0) {
      if (i + 1 >= bytes.length || (bytes[i + 1] & 0xC0) !== 0x80) { isUtf8 = false; break; }
      hasMultiByte = true;
      i += 2;
    } else if ((b & 0xF0) === 0xE0) {
      if (i + 2 >= bytes.length || (bytes[i + 1] & 0xC0) !== 0x80 || (bytes[i + 2] & 0xC0) !== 0x80) { isUtf8 = false; break; }
      hasMultiByte = true;
      i += 3;
    } else if ((b & 0xF8) === 0xF0) {
      if (i + 3 >= bytes.length || (bytes[i + 1] & 0xC0) !== 0x80 || (bytes[i + 2] & 0xC0) !== 0x80 || (bytes[i + 3] & 0xC0) !== 0x80) { isUtf8 = false; break; }
      hasMultiByte = true;
      i += 4;
    } else {
      isUtf8 = false;
      break;
    }
  }

  if (isUtf8 && (hasMultiByte || offset > 0)) {
    try {
      const decodedUtf8 = decodeUtf8Bytes(bytes, offset);
      if (scoreCzechText(decodedUtf8) >= 0) {
        return fixCzechDiacritics(decodedUtf8);
      }
    } catch (e) {}
  }

  // Candidate 1: CP1250
  const candidateCp1250 = decodeMappedBytes(bytes, cp1250Map, offset);
  const score1250 = scoreCzechText(candidateCp1250);

  // Candidate 2: Kamenických (CP895)
  const candidateCp895 = decodeMappedBytes(bytes, cp895Map, offset);
  const score895 = scoreCzechText(candidateCp895);

  // Candidate 3: CP852
  const candidateCp852 = decodeMappedBytes(bytes, cp852Map, offset);
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

// Zabezpečí, že PRVNÍ PÍSMENO (přeskočí čísla, tečky i mezeru) bude VŽDY VELKÉ!
// Např. "001. jasná zpráva" -> "001. Jasná zpráva", "04. veď mě dál" -> "04. Veď mě dál"
export function capitalizeFirstLetter(str: string): string {
  if (!str) return '';
  const clean = fixCzechDiacritics(str.trim());
  if (!clean) return '';

  return clean.replace(/([a-zA-ZáčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ])/, (match) => match.toUpperCase());
}

// Detekuje, zda má člen kapely u sebe v profilu zadaný zpěv/vokály (necitlivé na diakritiku a velikost písmen)
export function hasVocalsInProfile(member: any): boolean {
  if (!member) return false;
  const normalize = (s?: any) => (typeof s === 'string' ? s : '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const text = `${normalize(member.instrument)} ${normalize(member.nickname)} ${normalize(member.nick)} ${normalize(member.displayName)} ${normalize(member.name)} ${normalize(member.firstName)} ${normalize(member.lastName)}`;
  return /zpev|vokal|sing|zpiv|vokaly/i.test(text);
}

// Bezpečně získá neprázdné zobrazené jméno/přezdívku člena ze VŠECH možných klíčů v databázi (nickname, nick, displayName, name, firstName, email)
export function getMemberDisplayName(m: any): string {
  if (!m) return 'Člen';

  // 1. Přezdívka z libovolného klíče
  const nick = m.nickname || m.nick || m.prezdivka || m.displayName || m.name;
  if (nick && typeof nick === 'string' && nick.trim().length > 0) {
    return nick.trim();
  }

  // 2. Křestní jméno a příjmení
  const first = m.firstName || m.jmeno;
  const last = m.lastName || m.prijmeni;

  if (first && typeof first === 'string' && first.trim().length > 0) {
    if (last && typeof last === 'string' && last.trim().length > 0) {
      return `${first.trim()} ${last.trim()}`;
    }
    return first.trim();
  }

  if (last && typeof last === 'string' && last.trim().length > 0) {
    return last.trim();
  }

  // 3. E-mail
  if (m.email && typeof m.email === 'string' && m.email.trim().length > 0) {
    return m.email.split('@')[0];
  }

  return 'Člen';
}

// Repairs broken Czech diacritics from Mojibake or wrong encoding conversions
export function fixCzechDiacritics(str: string): string {
  if (!str) return '';

  let text = str
    // Standard UTF-8 decoded as Win1252 / ISO-8859-1 / CP1250
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

  // Regex pattern matching optional bracketed chords between letters
  const C = '(\\s*(?:\\[[^\\]]+\\]\\s*)?)';

  // Kamenických / CP852 / corrupted imports repairs (with chord brackets tolerance)
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
    .replace(/Mělýn/g, 'Mlýn')
    .replace(/mělýn/g, 'mlýn')
    .replace(/Mělýny/g, 'Mlýny')
    .replace(/mělýny/g, 'mlýny')
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
