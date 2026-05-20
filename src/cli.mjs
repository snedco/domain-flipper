#!/usr/bin/env node
/**
 * domain-flipper CLI
 *
 * Daily pipeline:
 *   1. Generate brandable names (Claude API or local heuristic fallback)
 *   2. Check .com availability (GoDaddy API, or stub if no key)
 *   3. Score brandability
 *   4. Output ranked report (markdown + JSON)
 *
 * Usage:
 *   node src/cli.mjs                    # default daily run, 100 names
 *   node src/cli.mjs --count 200        # generate 200
 *   node src/cli.mjs --theme fintech    # theme-specific
 *   node src/cli.mjs --no-check         # skip availability (faster, no API needed)
 *   node src/cli.mjs --score WORD       # score a specific word
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateNames } from './generator.mjs';
import { scoreBrandability } from './scorer.mjs';
import { checkAvailability } from './godaddy.mjs';
import { writeReport } from './report.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const REPORTS_DIR = join(ROOT, 'reports');

function parseArgs(argv) {
  const args = { count: 100, theme: 'general', check: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--count') args.count = parseInt(argv[++i], 10);
    else if (a === '--theme') args.theme = argv[++i];
    else if (a === '--no-check') args.check = false;
    else if (a === '--score') args.scoreOnly = argv[++i];
    else if (a === '--report') args.report = true;
    else if (a === '--help' || a === '-h') {
      console.log(`
domain-flipper — Find brandable, available .com domains

Usage:
  node src/cli.mjs [options]

Options:
  --count N            Number of names to generate (default 100)
  --theme NAME         Theme: general, fintech, saas, ai, crypto, ecom, health
  --no-check           Skip availability check (faster, no API needed)
  --score WORD         Score a single word and exit
  --report             Force write report files to reports/

Environment:
  ANTHROPIC_API_KEY    For LLM-powered name generation (otherwise uses heuristic)
  GODADDY_API_KEY      For real availability checks
  GODADDY_API_SECRET   GoDaddy API secret
`);
      process.exit(0);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.scoreOnly) {
    const score = scoreBrandability(args.scoreOnly);
    console.log(JSON.stringify(score, null, 2));
    return;
  }

  console.log(`\n[domain-flipper] ${new Date().toISOString()}`);
  console.log(`  theme: ${args.theme}  count: ${args.count}  check: ${args.check}\n`);

  // 1. Generate
  console.log('→ Generating names...');
  const names = await generateNames(args.count, args.theme);
  console.log(`  Generated ${names.length} candidates.`);

  // 2. Score brandability
  console.log('→ Scoring brandability...');
  const scored = names.map(n => ({ name: n, ...scoreBrandability(n) }));
  scored.sort((a, b) => b.score - a.score);
  console.log(`  Top score: ${scored[0]?.name} (${scored[0]?.score})`);

  // 3. Check top candidates only (avoid hammering API)
  let withAvailability = scored;
  if (args.check) {
    const topN = scored.slice(0, Math.min(50, scored.length));
    console.log(`→ Checking availability for top ${topN.length}...`);
    withAvailability = await checkAvailability(topN);
    const available = withAvailability.filter(x => x.available);
    console.log(`  ${available.length} available.`);
  }

  // 4. Write reports
  await mkdir(REPORTS_DIR, { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  const stamp = today + (args.theme !== 'general' ? `-${args.theme}` : '');
  await writeReport(REPORTS_DIR, stamp, withAvailability, { theme: args.theme });

  console.log(`\n✓ Done. Reports written to reports/${stamp}.{md,json}\n`);

  // 5. Show top 10 to stdout
  const top10 = withAvailability.filter(x => !args.check || x.available !== false).slice(0, 10);
  console.log('TOP 10 CANDIDATES:');
  console.log('─'.repeat(70));
  for (const c of top10) {
    const avail = c.available === true ? '✓' : c.available === false ? '✗' : '?';
    console.log(`  ${avail}  ${c.name.padEnd(20)}  score=${c.score.toString().padStart(3)}  ${c.notes ?? ''}`);
  }
  console.log('─'.repeat(70));
}

main().catch(err => {
  console.error('FATAL:', err.message);
  if (process.env.DEBUG) console.error(err);
  process.exit(1);
});
