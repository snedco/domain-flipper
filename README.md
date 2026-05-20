# Domain Flipper

> Autonomous brandable .com finder. Generates, scores, and checks availability. Daily reports via GitHub Actions.

```
$ node src/cli.mjs --count 200 --theme ai

[domain-flipper] 2026-05-20
  theme: ai  count: 200  check: true

→ Generating names...
  LLM mode: generated 200 names via Claude.
→ Scoring brandability...
  Top score: cogsai (88)
→ Checking availability for top 50...
  17 available.

✓ Done. Reports written to reports/2026-05-20-ai.{md,json}

TOP 10 CANDIDATES:
──────────────────────────────────────────────────────
  ✓  cogsai      score= 88  short modern-suffix
  ✓  thinix      score= 85  modern-suffix ideal-length
  ✓  syncai      score= 82  modern-suffix ideal-length
  ✓  mindly      score= 80  modern-suffix ideal-length
  ✗  sparkio     score= 78  modern-suffix
  ...
```

## What it does

A daily pipeline that:

1. **Generates** 100–500 brandable name candidates (via Claude API or local morpheme combinator)
2. **Scores** each on length, pronounceability, vowel ratio, suffix quality, trademark risk, etc. (0–100)
3. **Checks** .com availability via GoDaddy API for the top scorers
4. **Reports** a ranked markdown + JSON output

Run it daily via GitHub Actions, get a fresh batch of buyable domains every morning. Buy the winners on GoDaddy / Namecheap / Porkbun. Park on Atom.com or Sedo. Flip for $500–5K each.

## Setup

```bash
git clone https://github.com/snedco/domain-flipper.git
cd domain-flipper
npm install
```

### Environment variables

| Variable | Required? | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | Optional | Better name generation via Claude. Without it, uses local heuristic. |
| `GODADDY_API_KEY` | Optional | Real availability checks. Without it, falls back to DNS-based heuristic. |
| `GODADDY_API_SECRET` | Optional | Required with GODADDY_API_KEY. |
| `GODADDY_OTE` | Optional | Set to `1` to use GoDaddy's OTE test endpoint. |

Get GoDaddy API credentials at: https://developer.godaddy.com/keys

## Usage

```bash
# Default daily run (100 names, general theme, checks availability)
node src/cli.mjs

# Larger batch
node src/cli.mjs --count 500

# Theme-specific
node src/cli.mjs --theme fintech
node src/cli.mjs --theme ai
node src/cli.mjs --theme saas
node src/cli.mjs --theme crypto
node src/cli.mjs --theme ecom
node src/cli.mjs --theme health

# Generate-only, no availability check (faster, no API needed)
node src/cli.mjs --count 200 --no-check

# Score a single name
node src/cli.mjs --score vexora
```

## Scoring methodology

| Factor | Max | What it rewards |
|---|---:|---|
| Length | 25 | 5–7 chars ideal, 4–8 good |
| Pronounceability | 15 | CVCV / CVCVC alternation |
| Vowel ratio | 10 | 35–55% vowels |
| Suffix | 12 | Modern endings (-io, -ai, -ly, -us, -ix) |
| Start letter | 8 | Strong starts (v, z, x, k, q, n, l, r, m) |
| Uniqueness | 5 | No common-word substrings |
| Consonant clusters | −20 | Penalty for 3+ consonants in a row |
| Trademark risk | −50 | Hard penalty for major-brand substrings |
| Triple letters | −10 | "aaa" type penalty |

## Daily automation (GitHub Actions)

The included workflow runs at 8 AM CT every day across 4 themes (general, fintech, saas, ai), commits reports to `reports/`, and uploads as artifacts.

To enable, push to a repo and add these secrets in **Settings → Secrets and variables → Actions**:

- `ANTHROPIC_API_KEY`
- `GODADDY_API_KEY`
- `GODADDY_API_SECRET`

## Output

Reports go to `reports/YYYY-MM-DD-<theme>.md` and `.json`. Example:

```markdown
# Domain Flipper Report — 2026-05-20

**Available .com domains (ranked by brandability)**

| Rank | Name | Score | Price | Notes |
|---:|---|---:|---:|---|
| 1 | **cogsai.com** | 88 | $11.99 | short modern-suffix |
| 2 | **thinix.com** | 85 | $11.99 | modern-suffix ideal-length |
| 3 | **syncai.com** | 82 | $11.99 | modern-suffix ideal-length |
```

## Workflow (the actual business)

1. **Daily generate** — GitHub Action runs at 8 AM, fills `reports/` with fresh candidates
2. **Skim top 10 per theme** — pick names that hit you as ownable + memorable
3. **Verify trademark** — manual check on USPTO TESS (https://tmsearch.uspto.gov)
4. **Check social handles** — namechk.com to make sure @handle is available
5. **Buy** — GoDaddy / Namecheap / Porkbun, usually $10–15
6. **List** — Atom.com (curated marketplace), Sedo, Dan.com, Afternic
7. **Wait or sell direct** — outbound to relevant startups in the niche

Realistic numbers:
- Bulk buy 20 domains / mo at $12 = $240/mo
- Sell 2 / yr at $2K avg = $4K/yr revenue
- Net positive after year 1, scales with portfolio

## License

MIT. Use it, fork it, improve it.

## Built by

[Lee Snedaker](https://stackio.ai), Austin, TX. Part of the Stackio.ai studio.
