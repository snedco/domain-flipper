/**
 * Report writer. Emits a daily markdown + JSON report.
 */

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function writeReport(dir, stamp, results, meta = {}) {
  // JSON report (machine-readable)
  const jsonPath = join(dir, `${stamp}.json`);
  await writeFile(jsonPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    theme: meta.theme,
    total_candidates: results.length,
    available: results.filter(r => r.available === true).length,
    results,
  }, null, 2), 'utf-8');

  // Markdown report (human-readable)
  const mdPath = join(dir, `${stamp}.md`);
  const available = results.filter(r => r.available === true);
  const unavailable = results.filter(r => r.available === false);
  const unknown = results.filter(r => r.available === null || r.available === undefined);

  const md = [];
  md.push(`# Domain Flipper Report — ${stamp}`);
  md.push('');
  md.push(`**Generated:** ${new Date().toISOString()}`);
  md.push(`**Theme:** ${meta.theme ?? 'general'}`);
  md.push(`**Total candidates:** ${results.length}`);
  md.push(`**Available (.com):** ${available.length}`);
  md.push(`**Unavailable:** ${unavailable.length}`);
  md.push(`**Unknown:** ${unknown.length}`);
  md.push('');

  if (available.length > 0) {
    md.push(`## ✓ Available .com domains (ranked by brandability)`);
    md.push('');
    md.push('| Rank | Name | Score | Price | Notes |');
    md.push('|---:|---|---:|---:|---|');
    available.forEach((r, i) => {
      const price = r.price != null ? `$${r.price.toFixed(2)}` : '—';
      md.push(`| ${i + 1} | **${r.name}.com** | ${r.score} | ${price} | ${r.notes ?? ''} |`);
    });
    md.push('');
  }

  if (unknown.length > 0) {
    md.push(`## ? Unknown availability`);
    md.push('');
    md.push('These hit API errors or weren\'t checked. Manually verify.');
    md.push('');
    md.push('| Name | Score | Reason |');
    md.push('|---|---:|---|');
    unknown.slice(0, 20).forEach(r => {
      md.push(`| ${r.name}.com | ${r.score} | ${r.error ?? '—'} |`);
    });
    md.push('');
  }

  md.push(`## Methodology`);
  md.push('');
  md.push('- Names generated via Claude API (haiku) or local morpheme combinator');
  md.push('- Brandability scored across length, pronounceability, vowel ratio, suffix, start letter, uniqueness, trademark risk');
  md.push('- Availability checked via GoDaddy API (FAST mode) — DNS fallback if no key');
  md.push('- Top 50 by brandability score are availability-checked to limit API calls');
  md.push('');

  md.push(`## Next steps`);
  md.push('');
  md.push('1. Pick names with score ≥ 60');
  md.push('2. Manually verify trademark via USPTO TESS: https://tmsearch.uspto.gov');
  md.push('3. Check social handles: namechk.com or instantusername.com');
  md.push('4. Buy on GoDaddy / Namecheap / Porkbun');
  md.push('5. Park on Atom (atom.com), Sedo, or Dan.com to flip');

  await writeFile(mdPath, md.join('\n'), 'utf-8');

  return { jsonPath, mdPath };
}
