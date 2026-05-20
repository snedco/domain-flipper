/**
 * Brandability scorer.
 *
 * Returns score 0–100 with breakdown. Higher = better.
 *
 * Factors:
 *   - Length (sweet spot: 5–8 chars)
 *   - Pronounceability (alternating consonant/vowel patterns score higher)
 *   - Memorability (uniqueness vs common patterns)
 *   - Suffix / ending (-io, -ly, -ai, -us etc. modern; -ing, -er penalty)
 *   - Vowel/consonant ratio (closer to 50/50 = easier to say)
 *   - No double letters at start (xxasaur loses)
 *   - Trademark-friendly (no real-word substring of major brands)
 */

const VOWELS = 'aeiouy';
const COMMON_WORDS_PENALTY = ['the', 'and', 'app', 'web', 'pro', 'free', 'best', 'fast', 'super', 'mega'];
const MAJOR_BRAND_SUBSTRINGS = [
  'google', 'apple', 'amazon', 'microsoft', 'meta', 'tesla', 'stripe',
  'shopify', 'tiktok', 'twitter', 'facebook', 'youtube', 'netflix', 'spotify',
  'uber', 'airbnb', 'snapchat', 'instagram', 'adobe', 'salesforce', 'oracle',
  'nvidia', 'openai', 'anthropic', 'claude', 'chatgpt', 'midjourney',
];

const MODERN_SUFFIXES = ['io', 'ai', 'ly', 'us', 'ix', 'on', 'iq', 'os', 'fi', 'co', 'oo'];
const WEAK_SUFFIXES = ['ing', 'er', 'est', 'ed', 'ation', 'ment'];

const STRONG_STARTS = ['v', 'z', 'x', 'k', 'q', 'n', 'l', 'r', 'm'];
const WEAK_STARTS = ['h', 'w', 'g']; // not bad, just less brandable
const VERY_WEAK_STARTS = ['p', 'b', 'd'].length; // commonly oversaturated, leave neutral

function isVowel(c) { return VOWELS.includes(c); }

function consonantClusterPenalty(name) {
  // Penalize 3+ consonants in a row
  let max = 0, run = 0;
  for (const c of name) {
    if (!isVowel(c)) { run++; max = Math.max(max, run); }
    else run = 0;
  }
  return max >= 3 ? -10 : max >= 4 ? -20 : 0;
}

function vowelRatioScore(name) {
  const vowels = [...name].filter(isVowel).length;
  const ratio = vowels / name.length;
  // Sweet spot: 0.35–0.55
  if (ratio >= 0.35 && ratio <= 0.55) return 10;
  if (ratio >= 0.25 && ratio <= 0.65) return 5;
  return 0;
}

function lengthScore(name) {
  const len = name.length;
  if (len >= 5 && len <= 7) return 25;       // sweet spot
  if (len >= 4 && len <= 8) return 18;
  if (len === 9) return 10;
  if (len === 10) return 5;
  return 0;
}

function suffixScore(name) {
  for (const sfx of MODERN_SUFFIXES) {
    if (name.endsWith(sfx)) return 12;
  }
  for (const sfx of WEAK_SUFFIXES) {
    if (name.endsWith(sfx)) return -8;
  }
  return 0;
}

function startScore(name) {
  if (STRONG_STARTS.includes(name[0])) return 8;
  if (WEAK_STARTS.includes(name[0])) return 3;
  return 5; // neutral
}

function pronounceability(name) {
  // Reward CVCV or CVCVC patterns (consonant-vowel alternation)
  let alt = 0;
  for (let i = 0; i < name.length - 1; i++) {
    if (isVowel(name[i]) !== isVowel(name[i + 1])) alt++;
  }
  const ratio = alt / (name.length - 1);
  if (ratio >= 0.7) return 15;
  if (ratio >= 0.5) return 10;
  if (ratio >= 0.3) return 4;
  return 0;
}

function uniquenessScore(name) {
  // Penalize obvious common substrings
  for (const w of COMMON_WORDS_PENALTY) {
    if (name.includes(w)) return -8;
  }
  return 5;
}

function trademarkRisk(name) {
  // Hard penalty if it contains a major brand substring
  for (const b of MAJOR_BRAND_SUBSTRINGS) {
    if (name.includes(b)) return -50;
  }
  // Soft penalty if name starts with common brand prefix
  if (name.startsWith('goog') || name.startsWith('amaz') || name.startsWith('appl')) {
    return -30;
  }
  return 0;
}

function doubleLetterPenalty(name) {
  if (/(.)\1\1/.test(name)) return -10; // 3+ same letter in a row
  return 0;
}

export function scoreBrandability(rawName) {
  const name = String(rawName).toLowerCase().replace(/[^a-z]/g, '');
  if (!name) return { score: 0, breakdown: { invalid: true }, notes: 'empty after sanitization' };

  const factors = {
    length: lengthScore(name),
    pronounceability: pronounceability(name),
    vowelRatio: vowelRatioScore(name),
    suffix: suffixScore(name),
    start: startScore(name),
    uniqueness: uniquenessScore(name),
    clusters: consonantClusterPenalty(name),
    trademark: trademarkRisk(name),
    doubles: doubleLetterPenalty(name),
  };

  const total = Object.values(factors).reduce((s, v) => s + v, 0);
  const score = Math.max(0, Math.min(100, total));

  // Generate notes for top scorers
  const notes = [];
  if (factors.trademark < 0) notes.push('trademark-risk');
  if (factors.clusters < 0) notes.push('hard-to-say');
  if (name.length <= 5) notes.push('short');
  if (factors.suffix === 12) notes.push('modern-suffix');
  if (factors.length === 25) notes.push('ideal-length');

  return {
    score,
    breakdown: factors,
    notes: notes.join(' '),
  };
}
