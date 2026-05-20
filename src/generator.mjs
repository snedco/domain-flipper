/**
 * Name generator.
 *
 * Two modes:
 *   1. LLM mode (ANTHROPIC_API_KEY set) — Claude generates brandable candidates
 *   2. Heuristic mode (no key) — local syllable/morpheme combinatorial generator
 */

const THEMES = {
  general: {
    morphemes_prefix: ['mo', 'lu', 'no', 'ri', 'tan', 'kal', 'vex', 'zo', 'sil', 'ner', 'aer', 'oro'],
    morphemes_root: ['velo', 'nova', 'vana', 'mira', 'pari', 'sora', 'vira', 'kina', 'fano', 'roxa'],
    morphemes_suffix: ['ly', 'io', 'ix', 'a', 'us', 'on', 'is', 'ai', 'ica', 'ora'],
  },
  fintech: {
    morphemes_prefix: ['fi', 'pay', 'cap', 'cred', 'mon', 'bank', 'fund', 'val', 'qore', 'flux'],
    morphemes_root: ['vault', 'ledger', 'asset', 'flow', 'streak', 'capital', 'mint'],
    morphemes_suffix: ['fi', 'pay', 'wallet', 'ly', 'io', 'cap', 'flow'],
  },
  saas: {
    morphemes_prefix: ['use', 'app', 'op', 'flux', 'dash', 'meta', 'sync', 'co', 'nex'],
    morphemes_root: ['stack', 'desk', 'forge', 'craft', 'flow', 'hub', 'pulse'],
    morphemes_suffix: ['io', 'ly', 'app', 'hq', 'os', 'ai', 'works'],
  },
  ai: {
    morphemes_prefix: ['neo', 'syn', 'meta', 'oxa', 'thin', 'gen', 'cog', 'nex'],
    morphemes_root: ['mind', 'sense', 'spark', 'pulse', 'forge', 'core', 'sage'],
    morphemes_suffix: ['ai', 'ly', 'iq', 'os', 'io', 'lab'],
  },
  crypto: {
    morphemes_prefix: ['cyber', 'meta', 'on', 'nox', 'chain', 'dao', 'flux'],
    morphemes_root: ['vault', 'block', 'chain', 'ledger', 'token', 'mint', 'flow'],
    morphemes_suffix: ['dao', 'fi', 'chain', 'block', 'io', 'cap'],
  },
  ecom: {
    morphemes_prefix: ['shop', 'kart', 'tien', 'pur', 'mer', 'velo'],
    morphemes_root: ['cart', 'store', 'mart', 'shelf', 'crate', 'pop'],
    morphemes_suffix: ['shop', 'kart', 'mart', 'ly', 'co', 'io'],
  },
  health: {
    morphemes_prefix: ['vita', 'med', 'cura', 'wel', 'lumi', 'flora', 'aera'],
    morphemes_root: ['heal', 'cure', 'bloom', 'tone', 'rest', 'core'],
    morphemes_suffix: ['med', 'rx', 'care', 'ly', 'io', 'ai'],
  },
};

// Heuristic generator: combine prefix + root, or prefix + suffix, or root + suffix
function generateHeuristic(count, theme) {
  const t = THEMES[theme] ?? THEMES.general;
  const names = new Set();
  const maxAttempts = count * 12;

  for (let i = 0; i < maxAttempts && names.size < count; i++) {
    const r = Math.random();
    let n;
    if (r < 0.3) {
      n = pick(t.morphemes_prefix) + pick(t.morphemes_root);
    } else if (r < 0.6) {
      n = pick(t.morphemes_prefix) + pick(t.morphemes_suffix);
    } else if (r < 0.85) {
      n = pick(t.morphemes_root) + pick(t.morphemes_suffix);
    } else {
      // 3-part composition for variety
      n = pick(t.morphemes_prefix) + pick(t.morphemes_root) + pick(t.morphemes_suffix);
    }
    n = n.toLowerCase().replace(/[^a-z]/g, '');
    if (n.length >= 4 && n.length <= 11) names.add(n);
  }
  return [...names];
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// LLM generator: use Anthropic Claude API
async function generateLLM(count, theme) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  // Dynamic import so we don't crash if SDK not installed
  let Anthropic;
  try {
    Anthropic = (await import('@anthropic-ai/sdk')).default;
  } catch {
    console.warn('  @anthropic-ai/sdk not installed — falling back to heuristic generator.');
    return null;
  }

  const client = new Anthropic({ apiKey });

  const themeContext = {
    general: 'general-purpose tech / consumer brand names',
    fintech: 'fintech, payments, lending, banking',
    saas: 'B2B SaaS, productivity, developer tools',
    ai: 'AI, machine learning, agentic products',
    crypto: 'crypto, web3, DeFi, on-chain protocols',
    ecom: 'e-commerce, DTC consumer brands',
    health: 'healthcare, wellness, longevity',
  }[theme] ?? 'general';

  const prompt = `Generate exactly ${count} brandable, ownable, .com-quality startup name candidates suitable for ${themeContext}.

Constraints:
- 4 to 11 characters
- Pronounceable in English (no awkward consonant clusters)
- Memorable, evocative, no generic dictionary words
- Diverse — vary endings, syllables, vibes
- Lowercase only, letters only, no hyphens or numbers
- Avoid obviously taken names (Google, Tesla, Stripe, etc.)
- Mix of: invented words, classical roots, latin/greek-inspired, modern coined

Output ONLY a JSON array of strings, no commentary, no markdown. Example:
["vexora","tanlux","norio","milara","kalivo"]`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text.trim();
  // Extract JSON array (sometimes Claude wraps in markdown)
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('LLM did not return JSON array. Got: ' + text.slice(0, 200));
  const names = JSON.parse(match[0]);
  return names
    .map(n => String(n).toLowerCase().replace(/[^a-z]/g, ''))
    .filter(n => n.length >= 4 && n.length <= 11);
}

export async function generateNames(count, theme) {
  // Try LLM first, fall back to heuristic
  try {
    const llmNames = await generateLLM(count, theme);
    if (llmNames && llmNames.length > 0) {
      console.log(`  LLM mode: generated ${llmNames.length} names via Claude.`);
      return llmNames;
    }
  } catch (e) {
    console.warn(`  LLM generation failed (${e.message.slice(0, 80)}) — falling back to heuristic.`);
  }
  console.log(`  Heuristic mode (no ANTHROPIC_API_KEY set).`);
  return generateHeuristic(count, theme);
}
