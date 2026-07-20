#!/usr/bin/env node
'use strict';
/**
 * archive-refs.js — preserve every reference in the Internet Archive Wayback
 * Machine and cache the best snapshot URL for use as a fallback link.
 *
 * Ported from the sibling `cronologia/fsp` project (its ADR-0006). tl's data is
 * simpler: all reference URLs live in `data/chronology.json` `references[]`
 * (there are no country dossiers or declaration corpora to walk), so this is a
 * trimmed version of fsp's script.
 *
 * For each reference URL found in data/chronology.json:
 *   1. Query the Wayback "availability" API for an existing snapshot.
 *   2. Unless --lookup-only is given: if none exists (or --save-all), trigger
 *      "Save Page Now" to archive the page, then re-check until it appears.
 *   3. Record the snapshot URL + timestamp into data/archives.json.
 *
 * References marked `official: true` (live pages whose content can be changed or
 * removed) get a FORCED fresh capture the first time they are seen, then are
 * marked `fresh` so later runs stay idempotent. tl carries no `official` refs
 * today, but the flag is honoured for parity with fsp.
 *
 * Design: data/chronology.json stays the hand-curated source of truth; this
 * script never edits it. The machine-generated cache lives in data/archives.json
 * ({ _meta, snapshots: { <url>: { archiveUrl, timestamp, … } } }), which
 * build.js merges in to render "archived" fallback links next to each reference.
 *
 * Usage:
 *   node scripts/archive-refs.js               check + archive missing, update cache
 *   node scripts/archive-refs.js --lookup-only record only EXISTING snapshots; never Save Page Now
 *   node scripts/archive-refs.js --dry-run     report only; write nothing
 *   node scripts/archive-refs.js --save-all    (re)archive every URL even if a snapshot exists
 *   node scripts/archive-refs.js --timeout=60  per-request timeout in seconds (default 45)
 *
 * Network: requires outbound HTTPS to archive.org / web.archive.org. Save Page
 * Now is rate-limited for anonymous use, so the script paces its requests; many
 * environments block archive.org entirely, which is why the full capture runs on
 * CI (see .github/workflows/wayback.yml). --lookup-only needs only the
 * availability API and is safe to run anywhere it is reachable, to seed the cache.
 *
 * Exit codes: 0 = all reachable references have a cached snapshot; 1 = one or
 * more URLs could not be archived (useful for CI gating).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'data', 'chronology.json');
const CACHE_FILE = path.join(ROOT, 'data', 'archives.json');

const AVAILABILITY_API = 'https://archive.org/wayback/available';
const SAVE_API = 'https://web.archive.org/save/';

// ---- CLI args -------------------------------------------------------------
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const SAVE_ALL = args.includes('--save-all');
const LOOKUP_ONLY = args.includes('--lookup-only');
const TIMEOUT_MS = (() => {
  const a = args.find((x) => x.startsWith('--timeout='));
  const n = a ? parseInt(a.split('=')[1], 10) : 45;
  return (Number.isFinite(n) ? n : 45) * 1000;
})();

const SAVE_POLL_ATTEMPTS = 6;     // times to re-check availability after a save
const SAVE_POLL_DELAY_MS = 8000;  // delay between availability polls
const PACING_DELAY_MS = 6000;     // polite delay between Save Page Now calls
const LOOKUP_DELAY_MS = 750;      // polite delay between availability lookups

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Collect the distinct reference URLs to archive, flagging those marked
 * `official: true`. All URLs come from `chronology.json` `references[]`.
 */
function collectUrls(data) {
  const byUrl = new Map();
  for (const ref of data.references || []) {
    if (ref && typeof ref.url === 'string' && /^https?:\/\//i.test(ref.url.trim())) {
      const url = ref.url.trim();
      byUrl.set(url, (byUrl.get(url) || false) || ref.official === true);
    }
  }
  return [...byUrl].map(([url, official]) => ({ url, official }));
}

/** fetch JSON with a timeout; returns null on any failure. */
async function fetchJson(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'tl-archive-refs/1.0 (+https://github.com/cronologia/tl)' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Normalise a Wayback snapshot URL to https. */
function toHttps(u) {
  return typeof u === 'string' ? u.replace(/^http:\/\//, 'https://') : u;
}

/** Look up the closest existing snapshot for a URL, or null. */
async function lookupSnapshot(url) {
  const api = `${AVAILABILITY_API}?url=${encodeURIComponent(url)}`;
  const json = await fetchJson(api);
  const closest = json && json.archived_snapshots && json.archived_snapshots.closest;
  if (closest && closest.available && closest.url) {
    return {
      archiveUrl: toHttps(closest.url),
      timestamp: closest.timestamp || null,
      status: closest.status || null,
    };
  }
  return null;
}

/** Trigger Save Page Now, then poll availability until the snapshot appears. */
async function savePage(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    await fetch(SAVE_API + url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'tl-archive-refs/1.0 (+https://github.com/cronologia/tl)' },
    });
  } catch {
    // Save endpoint is best-effort; we confirm via availability polling below.
  } finally {
    clearTimeout(t);
  }
  for (let i = 0; i < SAVE_POLL_ATTEMPTS; i++) {
    await sleep(SAVE_POLL_DELAY_MS);
    const snap = await lookupSnapshot(url);
    if (snap) return snap;
  }
  return null;
}

function loadCache() {
  try {
    const parsed = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    if (parsed && typeof parsed === 'object' && parsed.snapshots) return parsed;
  } catch {
    /* fall through to fresh cache */
  }
  return { _meta: {}, snapshots: {} };
}

function writeCache(cache) {
  cache._meta = {
    generatedBy: 'scripts/archive-refs.js',
    lastRun: new Date().toISOString(),
    count: Object.keys(cache.snapshots).length,
  };
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2) + '\n');
}

async function main() {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const urls = collectUrls(data);
  const cache = loadCache();

  console.log(
    `Found ${urls.length} reference URL(s) in chronology.json.` +
      `${LOOKUP_ONLY ? ' (lookup-only)' : ''}${DRY_RUN ? ' (dry-run)' : ''}`
  );

  let archived = 0;
  let saved = 0;
  let failed = 0;
  let first = true;

  for (const { url, official } of urls) {
    const cached = cache.snapshots[url];
    const haveFresh = !!(cached && cached.fresh);
    // A cached snapshot is enough — except for official pages we haven't yet
    // captured ourselves, which we force-save once (never in --lookup-only).
    if (cached && cached.archiveUrl && !SAVE_ALL && (!official || haveFresh || LOOKUP_ONLY)) {
      console.log(`  ✓ cached     ${url}`);
      archived++;
      continue;
    }

    let snap = await lookupSnapshot(url);
    // Force a new capture when: --save-all, no snapshot exists, or this is an
    // official page without a fresh (self-made) capture — but never in lookup-only.
    const mustSave = !LOOKUP_ONLY && (SAVE_ALL || !snap || (official && !haveFresh));

    if (mustSave) {
      if (DRY_RUN) {
        console.log(`  · would save ${official ? '(official) ' : ''}${url}${snap ? ' (re-archive)' : ' (no snapshot)'}`);
        if (!snap) { failed++; continue; }
      } else {
        if (!first) await sleep(PACING_DELAY_MS);
        first = false;
        console.log(`  ⟳ saving${official ? ' (official)' : ''}…    ${url}`);
        const fresh = await savePage(url);
        if (fresh) { snap = fresh; snap.fresh = true; saved++; }
      }
    }

    if (snap) {
      cache.snapshots[url] = {
        archiveUrl: snap.archiveUrl,
        timestamp: snap.timestamp,
        status: snap.status,
        fresh: !!(snap.fresh || haveFresh),
        checkedAt: new Date().toISOString(),
      };
      console.log(`  ✓ archived   ${url} -> ${snap.archiveUrl}${snap.fresh ? ' (fresh)' : ''}`);
      archived++;
    } else {
      console.log(`  ${LOOKUP_ONLY ? '·' : '✗'} ${LOOKUP_ONLY ? 'no snapshot' : 'FAILED    '} ${url}`);
      failed++;
    }
    if (LOOKUP_ONLY && !DRY_RUN) await sleep(LOOKUP_DELAY_MS);
  }

  if (!DRY_RUN) writeCache(cache);

  // In lookup-only mode a missing snapshot is not a failure to gate on — those
  // URLs simply have not been captured yet and will be by a full CI run.
  console.log(
    `\nDone. ${archived} archived (${saved} newly saved), ${failed} ${LOOKUP_ONLY ? 'not yet captured' : 'failed'}.` +
      (DRY_RUN ? ' No files written.' : ` Cache: ${path.relative(ROOT, CACHE_FILE)}`)
  );
  process.exit(!LOOKUP_ONLY && failed > 0 ? 1 : 0);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('archive-refs failed:', err);
    process.exit(1);
  });
}

module.exports = { collectUrls };
