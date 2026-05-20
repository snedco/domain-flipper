/**
 * GoDaddy availability checker.
 *
 * Uses the GoDaddy Domains API (https://developer.godaddy.com).
 * Falls back to DNS lookup if no API key is present (less accurate but works).
 *
 * Required env:
 *   GODADDY_API_KEY      Your GoDaddy developer key
 *   GODADDY_API_SECRET   Your GoDaddy developer secret
 *   GODADDY_OTE          Set to "1" to use OTE (test) endpoint
 */

import dns from 'node:dns/promises';

const API_PROD = 'https://api.godaddy.com';
const API_OTE = 'https://api.ote-godaddy.com';

function endpoint() {
  return process.env.GODADDY_OTE === '1' ? API_OTE : API_PROD;
}

async function checkOne(name) {
  const apiKey = process.env.GODADDY_API_KEY;
  const apiSecret = process.env.GODADDY_API_SECRET;
  const domain = `${name}.com`;

  if (apiKey && apiSecret) {
    // Real GoDaddy API call
    try {
      const url = `${endpoint()}/v1/domains/available?domain=${encodeURIComponent(domain)}&checkType=FAST`;
      const resp = await fetch(url, {
        headers: {
          'Authorization': `sso-key ${apiKey}:${apiSecret}`,
          'Accept': 'application/json',
        },
      });
      if (!resp.ok) {
        const errText = await resp.text();
        // 429 = rate limited; 401 = bad creds
        return { available: null, error: `${resp.status}: ${errText.slice(0, 100)}` };
      }
      const data = await resp.json();
      return {
        available: data.available === true,
        price: data.price ? data.price / 1_000_000 : null, // GoDaddy returns micro-units
        currency: data.currency ?? 'USD',
      };
    } catch (e) {
      return { available: null, error: e.message };
    }
  }

  // Fallback: DNS-based heuristic.
  // If domain resolves to nothing AND has no SOA, it's MAYBE available.
  // This is unreliable — many parked domains return NXDOMAIN.
  try {
    await dns.lookup(domain);
    return { available: false, source: 'dns' };
  } catch (e) {
    if (e.code === 'ENOTFOUND') {
      // Might be available, might be parked. Mark as candidate.
      return { available: true, source: 'dns', confidence: 'low' };
    }
    return { available: null, error: e.code };
  }
}

export async function checkAvailability(items, concurrency = 5) {
  const results = [];
  const queue = [...items];
  const workers = [];

  // Throttle: 1 request every 200ms per worker = ~25 req/sec across 5 workers
  // GoDaddy rate limit is generous but be polite
  async function worker() {
    while (queue.length) {
      const item = queue.shift();
      const result = await checkOne(item.name);
      results.push({ ...item, ...result });
      await new Promise(r => setTimeout(r, 200));
    }
  }
  for (let i = 0; i < concurrency; i++) workers.push(worker());
  await Promise.all(workers);

  // Preserve original order (by score)
  results.sort((a, b) => b.score - a.score);
  return results;
}
