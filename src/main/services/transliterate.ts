/**
 * Fast deterministic Devanagari-to-Roman (Hinglish) transliteration
 */

const VOWELS: { [key: string]: string } = {
  'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo',
  'ऋ': 'ri', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au',
};

const MATRAS: { [key: string]: string } = {
  'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo',
  'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au',
  'ं': 'n', 'ँ': 'n', 'ः': 'h', '्': '',
};

const CONSONANTS: { [key: string]: string } = {
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
  'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
  'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
  'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v',
  'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
  'क्ष': 'ksh', 'त्र': 'tr', 'ज्ञ': 'gy',
  'ड़': 'd', 'ढ़': 'dh', 'फ़': 'f', 'ज़': 'z',
};

export function devanagariToHinglish(text: string): string {
  let result = '';
  const len = text.length;

  for (let i = 0; i < len; i++) {
    const char = text[i];
    const nextChar = i + 1 < len ? text[i + 1] : '';

    if (VOWELS[char]) {
      result += VOWELS[char];
    } else if (CONSONANTS[char]) {
      const base = CONSONANTS[char];
      if (MATRAS[nextChar] !== undefined) {
        result += base + MATRAS[nextChar];
        i++; // skip matra
      } else if (nextChar === '्') {
        result += base; // halant, no inherent vowel
        i++; // skip halant
      } else {
        // Inherent 'a' sound unless at end of word or before punctuation/space
        const isEnd = i + 1 >= len || nextChar === ' ' || nextChar === '\n' || /[.,!?।]/.test(nextChar);
        result += isEnd ? base : base + 'a';
      }
    } else if (MATRAS[char] !== undefined) {
      result += MATRAS[char];
    } else if (char === '।') {
      result += '.';
    } else {
      result += char;
    }
  }

  return result;
}

export function isDevanagari(text: string): boolean {
  return /[\u0900-\u097F]/.test(text);
}
