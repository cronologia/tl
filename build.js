#!/usr/bin/env node
/**
 * Cronologia — static site generator.
 *
 * Zero dependencies. Reads data/chronology.json and compiles a self-contained
 * static website into docs/ (chosen so it can be served directly by GitHub
 * Pages from the `docs/` folder on the default branch).
 *
 * Same architecture as the sibling `cronologia/fsp` project (see its ADRs
 * 0001–0003): JSON is the single source of truth, the compiler is dependency-
 * free, and the compiled docs/ folder is committed.
 *
 * Usage: node build.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data', 'chronology.json');
const ARCHIVES_FILE = path.join(ROOT, 'data', 'archives.json');
const SRC_DIR = path.join(ROOT, 'src');
const OUT_DIR = path.join(ROOT, 'docs');

// Google Analytics (gtag.js). Injected into the <head> of every generated page.
// The measurement ID is shared across the Cronologia projects and is a public
// identifier, not a secret.
const ANALYTICS = `  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-R9LV1QZHVE"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-R9LV1QZHVE');
  </script>`;

/** Minimal HTML escaper for text interpolated into the page. */
function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Format a 14-digit Wayback timestamp (YYYYMMDDhhmmss) as YYYY-MM-DD. */
function formatArchiveTs(ts) {
  if (!ts || ts.length < 8) return '';
  return `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`;
}

/** Load the committed Latin America SVG (Natural Earth, public domain). */
function loadLatamSvg() {
  try {
    return fs.readFileSync(path.join(SRC_DIR, 'latam.svg'), 'utf8');
  } catch {
    return '';
  }
}

/** Load the machine-generated Wayback snapshot cache (url -> snapshot), if any. */
function loadArchives() {
  try {
    const parsed = JSON.parse(fs.readFileSync(ARCHIVES_FILE, 'utf8'));
    return (parsed && parsed.snapshots) || {};
  } catch {
    return {};
  }
}

/**
 * Render superscript citation markers ("[1] [2]") for a `sources` array of
 * reference ids, linking to the anchored References list. Raw URLs are allowed
 * as a migration path and render as [web].
 */
function renderCites(sources, refNumById) {
  if (!Array.isArray(sources) || sources.length === 0) return '';
  const marks = sources
    .map((s) => {
      if (refNumById.has(s)) {
        const n = refNumById.get(s);
        return `<a href="#ref-${n}" title="Reference ${n}">[${n}]</a>`;
      }
      if (/^https?:\/\//.test(s)) {
        return `<a href="${esc(s)}" rel="noopener noreferrer" target="_blank">[web]</a>`;
      }
      return '';
    })
    .filter(Boolean)
    .join(' ');
  return marks ? `<sup class="cite">${marks}</sup>` : '';
}

/** Group events by decade for the chronology's section headers. */
function decadeOf(year) {
  return `${Math.floor(year / 10) * 10}s`;
}

function renderEventRow(ev, refNumById) {
  const flag = ev.dateVerified === false
    ? ' <span class="flag" title="Date not yet verified against a primary source">?</span>'
    : '';
  const text = ev.text ? ` <span class="muted">— ${esc(ev.text)}</span>` : '';
  return `        <tr>
          <td class="year">${esc(ev.year)}</td>
          <td>${esc(ev.date || '')}${flag}</td>
          <td>${esc(ev.place || '')}</td>
          <td><strong>${esc(ev.title)}</strong>${text}${renderCites(ev.sources, refNumById)}</td>
        </tr>`;
}

function renderFigureCard(fig, refNumById) {
  const meta = [fig.dates, fig.country].filter(Boolean).map(esc).join(' · ');
  return `      <div class="party-card">
        <h3><a href="figures/${esc(figureSlug(fig.name))}.html">${esc(fig.name)}</a></h3>
        ${meta ? `<p class="country">${meta}</p>` : ''}
        <p class="figures">${esc(fig.role)}${renderCites(fig.sources, refNumById)}</p>
        ${fig.notes ? `<p class="party-notes">${esc(fig.notes)}</p>` : ''}
      </div>`;
}

function renderOrgCard(org, refNumById) {
  const meta = [org.founded ? `Founded ${org.founded}` : null, org.place].filter(Boolean).map(esc).join(' · ');
  return `      <div class="related-card">
        <h3>${esc(org.name)}</h3>
        ${meta ? `<p class="related-meta">${meta}</p>` : ''}
        <p>${esc(org.relation)}${renderCites(org.sources, refNumById)}</p>
        ${org.notes ? `<p class="related-meta">${esc(org.notes)}</p>` : ''}
        ${org.url ? `<p class="related-link"><a href="${esc(org.url)}" rel="noopener noreferrer" target="_blank">${esc(org.url)}</a></p>` : ''}
      </div>`;
}

/**
 * Render the Latin America map section: the committed Natural Earth SVG with
 * countries highlighted per data.map.countries[] (tier: "core" | "presence"),
 * a hover/focus caption, and an accessible card list of the same data.
 */
function renderMapSection(map, refNumById) {
  if (!map || !Array.isArray(map.countries) || map.countries.length === 0) return '';
  let svg = loadLatamSvg();
  if (!svg) return '';

  for (const c of map.countries) {
    const marker = `id="ne-${c.code}" class="latam-c"`;
    svg = svg.replace(
      marker,
      `id="ne-${c.code}" class="latam-c map-${esc(c.tier)}" tabindex="0" data-name="${esc(c.name)}" data-note="${esc(c.note)}"`
    );
  }

  const cards = map.countries
    .map((c) => `      <div class="related-card map-card-${esc(c.tier)}">
        <h3>${esc(c.name)}</h3>
        <p>${esc(c.note)}${renderCites(c.sources, refNumById)}</p>
      </div>`)
    .join('\n');

  return `    <section id="map">
      <h2>Map</h2>
      <p class="section-intro">${esc(map.note)}</p>
      <div class="map-cols">
        <div class="atlas-map">
${svg}
          <p class="ptl-caption" id="map-caption" aria-live="polite">Hover or focus a country for details.</p>
          <div class="ptl-legend">
            <span class="ptl-key"><span class="atlas-swatch map-core"></span> major center of the movement</span>
            <span class="ptl-key"><span class="atlas-swatch map-presence"></span> documented presence / conference host</span>
            <span class="ptl-key"><span class="atlas-swatch map-none"></span> not yet documented here</span>
          </div>
          <p class="atlas-credit">Boundaries: Natural Earth (public domain).</p>
        </div>
        <div class="party-grid map-cards">
${cards}
        </div>
      </div>
      <script>
        (function () {
          var cap = document.getElementById('map-caption');
          if (!cap) return;
          var reset = function () { cap.textContent = 'Hover or focus a country for details.'; };
          document.querySelectorAll('#map .latam-c[data-name]').forEach(function (el) {
            var show = function () { cap.textContent = el.getAttribute('data-name') + ' — ' + el.getAttribute('data-note'); };
            el.addEventListener('mouseenter', show);
            el.addEventListener('focus', show);
            el.addEventListener('mouseleave', reset);
            el.addEventListener('blur', reset);
          });
        })();
      </script>
    </section>
`;
}

function renderReference(r, n, archives) {
  const snap = archives[r.url];
  const archived = snap && snap.archiveUrl
    ? ` · <a class="archive-link" href="${esc(snap.archiveUrl)}" rel="noopener noreferrer" target="_blank">🗄 archived${snap.timestamp ? ` ${esc(formatArchiveTs(snap.timestamp))}` : ''}</a>`
    : '';
  return `        <li id="ref-${n}">
          <a href="${esc(r.url)}" rel="noopener noreferrer" target="_blank">${esc(r.title)}</a>${archived}
          <span class="ref-meta">${esc(r.publisher)} · ${esc(r.type)}</span>
        </li>`;
}

/** URL-safe slug for a figure name (accent-folded, e.g. "Óscar Romero" -> "oscar-romero"). */
function figureSlug(name) {
  return String(name)
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/\s*\([^)]*\)\s*/g, ' ')                  // drop parentheticals
    .replace(/\s*\/\s*/g, '-')                         // "A / B" -> "a-b"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Build, for each figure, the set of distinct name strings used to find the
 * chronology events that involve them. Matching is deliberately conservative:
 * full-name variants always, plus a bare surname ONLY when that surname is
 * unique across figures (so the two Boffs never cross-match). Tokens shorter
 * than 4 characters are dropped to avoid noise.
 */
function buildFigureMatchers(figures) {
  const variantsOf = (name) => {
    const out = new Set();
    for (const part of String(name).split('/')) {
      const p = part.trim();
      if (!p) continue;
      const paren = p.match(/\(([^)]*)\)/);
      const base = p.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
      if (base.length >= 4) out.add(base);
      if (paren && paren[1].trim().length >= 4) out.add(paren[1].trim());
    }
    return [...out];
  };
  const surnameOf = (v) => {
    const w = v.split(/\s+/).filter((x) => !/^(de|da|do|dos|la|del|von|van)$/i.test(x));
    const last = w[w.length - 1] || '';
    return last.length >= 4 ? last : '';
  };
  // Count surname occurrences to detect collisions (e.g. "Boff").
  const surnameCounts = new Map();
  const perFig = figures.map((f) => {
    const variants = variantsOf(f.name);
    const surnames = [...new Set(variants.map(surnameOf).filter(Boolean))];
    for (const s of surnames) surnameCounts.set(s, (surnameCounts.get(s) || 0) + 1);
    return { fig: f, variants, surnames };
  });
  return perFig.map(({ fig, variants, surnames }) => {
    const tokens = new Set(variants);
    for (const s of surnames) if (surnameCounts.get(s) === 1) tokens.add(s);
    return { fig, tokens: [...tokens] };
  });
}

/** Whole-word, accent-aware test that `haystack` contains `token`. */
function mentions(haystack, token) {
  const t = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}])${t}([^\\p{L}]|$)`, 'u').test(haystack);
}

/** Events (in chronological order) that mention a figure, by its match tokens. */
function relatedEvents(events, tokens) {
  return [...events]
    .sort((a, b) => a.year - b.year || String(a.date || '').localeCompare(String(b.date || '')))
    .filter((ev) => {
      const hay = `${ev.title} ${ev.text || ''}`;
      return tokens.some((tok) => mentions(hay, tok));
    });
}

/**
 * Render a standalone per-figure page (docs/figures/<slug>.html): the figure's
 * bio, a self-contained references list (its own cited sources plus those of the
 * related events), and the chronology events that involve them, each linking
 * back to the main chronology. Citations are numbered locally to this page.
 */
function renderFigurePage(fig, events, tokens, archives, meta, references) {
  const related = relatedEvents(events, tokens);

  // Local reference numbering: figure sources first, then related-event sources.
  const byId = new Map((references || []).map((r) => [r.id, r]));
  const localIds = [];
  const push = (sources) => {
    for (const s of sources || []) if (!localIds.includes(s)) localIds.push(s);
  };
  push(fig.sources);
  related.forEach((ev) => push(ev.sources));
  const localRefById = new Map();
  const localRefs = [];
  for (const id of localIds) {
    const ref = byId.get(id);
    if (ref) { localRefs.push(ref); localRefById.set(id, localRefs.length); }
  }

  const metaLine = [fig.dates, fig.country].filter(Boolean).map(esc).join(' · ');
  const eventRows = related.map((ev) => {
    const flag = ev.dateVerified === false ? ' <span class="flag" title="Date not yet verified against a primary source">?</span>' : '';
    const text = ev.text ? ` <span class="muted">— ${esc(ev.text)}</span>` : '';
    return `        <tr>
          <td class="year">${esc(ev.year)}</td>
          <td>${esc(ev.date || '')}${flag}</td>
          <td><strong>${esc(ev.title)}</strong>${text}${renderCites(ev.sources, localRefById)}</td>
        </tr>`;
  }).join('\n');

  const refList = localRefs.map((r, i) => renderReference(r, i + 1, archives)).join('\n');

  return `<!DOCTYPE html>
<html lang="${esc(meta.language || 'en')}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(fig.name)} — ${esc(meta.title)}</title>
  <meta name="description" content="${esc(fig.name)}: ${esc(fig.role)}">
${ANALYTICS}
  <link rel="stylesheet" href="../styles.css">
</head>
<body>
  <header class="site-header">
    <div class="wrap">
      <p class="updated"><a href="../index.html">← ${esc(meta.title)}</a></p>
      <h1>${esc(fig.name)}</h1>
      ${metaLine ? `<p class="subtitle">${metaLine}</p>` : ''}
      <p class="lead">${esc(fig.role)}${renderCites(fig.sources, localRefById)}</p>
    </div>
  </header>

  <main class="wrap">
    <section id="related">
      <h2>In the chronology</h2>
      ${related.length
        ? `<p class="section-intro">${related.length} event${related.length === 1 ? '' : 's'} in the <a href="../index.html#chronology">chronology</a> involve this figure.</p>
      <div class="table-scroll">
      <table class="meetings">
        <thead><tr><th>Year</th><th>Date</th><th>Event</th></tr></thead>
        <tbody>
${eventRows}
        </tbody>
      </table>
      </div>`
        : `<p class="section-intro">No dated chronology events reference this figure yet; see the <a href="../index.html#chronology">chronology</a>.</p>`}
    </section>

    ${localRefs.length ? `<section id="references">
      <h2>References</h2>
      <ol class="references">
${refList}
      </ol>
    </section>` : ''}
  </main>

  <footer class="site-footer">
    <div class="wrap">
      <p>Compiled static site generated from <code>data/chronology.json</code> by <code>build.js</code>.
      Part of the Cronologia project family. <a href="../index.html">Back to the chronology</a>.</p>
    </div>
  </footer>
</body>
</html>
`;
}

function renderPage(data, archives) {
  const { meta, facts, events, figures, organizations, disambiguation, references } = data;

  // Stable citation numbering: references keep their file order.
  const refNumById = new Map(references.map((r, i) => [r.id, i + 1]));

  const sortedEvents = [...events].sort((a, b) => a.year - b.year || String(a.date || '').localeCompare(String(b.date || '')));

  // Chronology rows with a decade header row whenever the decade changes.
  let lastDecade = null;
  const eventRows = sortedEvents
    .map((ev) => {
      const d = decadeOf(ev.year);
      const header = d !== lastDecade
        ? `        <tr class="decade-row"><th colspan="4">${esc(d)}</th></tr>\n`
        : '';
      lastDecade = d;
      return header + renderEventRow(ev, refNumById);
    })
    .join('\n');

  const factRows = (facts || [])
    .map((f) => {
      const flag = f.verified === false ? ' <span class="flag" title="Not yet verified against a primary source">?</span>' : '';
      return `        <dt>${esc(f.label)}</dt>\n        <dd>${esc(f.value)}${flag}${renderCites(f.sources, refNumById)}</dd>`;
    })
    .join('\n');

  const disambigCards = ((disambiguation && disambiguation.items) || [])
    .map((it) => `      <div class="cp-card">
        <h3>${esc(it.title)}</h3>
        <p>${esc(it.text)}${renderCites(it.sources, refNumById)}</p>
      </div>`)
    .join('\n');

  const archivedRefs = references.filter((r) => archives[r.url] && archives[r.url].archiveUrl).length;

  return `<!DOCTYPE html>
<html lang="${esc(meta.language || 'en')}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(meta.title)}</title>
  <meta name="description" content="${esc(meta.description)}">
${ANALYTICS}
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="site-header">
    <div class="wrap">
      <h1>${esc(meta.title)}</h1>
      <p class="subtitle">${esc(meta.subtitle)}</p>
      <p class="lead">${esc(meta.description)}</p>
      <p class="updated">Last updated: ${esc(meta.lastUpdated)}</p>
      <div class="viz-chips">
        <a href="#map">🗺 Latam map</a>
        <a href="#chronology">📜 Chronology</a>
      </div>
    </div>
  </header>

  <nav class="site-nav">
    <div class="wrap">
      <a href="#about">About</a>
      <a href="#chronology">Chronology</a>
      ${data.map ? '<a href="#map">Map</a>' : ''}
      <a href="#figures">Key figures</a>
      <a href="#organizations">Organizations</a>
      ${disambigCards ? '<a href="#disambiguation">Disambiguation</a>' : ''}
      <a href="#references">References</a>
    </div>
  </nav>

  <main class="wrap">
    <section id="about">
      <h2>About</h2>
      <p class="notice">${esc(meta.dataQualityNote)}</p>
      <dl class="facts">
${factRows}
      </dl>
    </section>

    <section id="chronology">
      <h2>Chronology</h2>
      <p class="section-intro">Key events in chronological order. A <span class="flag">?</span> flag marks
      dates not yet verified against a primary source.</p>
      <div class="table-scroll">
      <table class="meetings">
        <thead>
          <tr><th>Year</th><th>Date</th><th>Place</th><th>Event</th></tr>
        </thead>
        <tbody>
${eventRows}
        </tbody>
      </table>
      </div>
    </section>

${renderMapSection(data.map, refNumById)}
    <section id="figures">
      <h2>Key figures</h2>
      <div class="party-grid">
${figures.map((f) => renderFigureCard(f, refNumById)).join('\n')}
      </div>
    </section>

    <section id="organizations">
      <h2>Related organizations</h2>
      <div class="party-grid">
${(organizations || []).map((o) => renderOrgCard(o, refNumById)).join('\n')}
      </div>
    </section>

${disambigCards ? `    <section id="disambiguation">
      <h2>Disambiguation &amp; nuance</h2>
      ${disambiguation.note ? `<p class="notice notice-attribution">${esc(disambiguation.note)}</p>` : ''}
      <div class="party-grid">
${disambigCards}
      </div>
    </section>
` : ''}
    <section id="references">
      <h2>References</h2>
      <p class="section-intro">${references.length} sources${archivedRefs ? ` · ${archivedRefs} with an Internet Archive fallback` : ''}. Sources span the
      spectrum of perspectives by design; contested claims are attributed to their authors.</p>
      <ol class="references">
${references.map((r, i) => renderReference(r, i + 1, archives)).join('\n')}
      </ol>
    </section>
  </main>

  <footer class="site-footer">
    <div class="wrap">
      <p>Compiled static site generated from <code>data/chronology.json</code> by <code>build.js</code>. Open data — corrections welcome via pull request.
      Part of the Cronologia project family.</p>
    </div>
  </footer>
</body>
</html>
`;
}

function main() {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const archives = loadArchives();

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), renderPage(data, archives));
  fs.copyFileSync(path.join(SRC_DIR, 'styles.css'), path.join(OUT_DIR, 'styles.css'));
  // Disable Jekyll processing on GitHub Pages.
  fs.writeFileSync(path.join(OUT_DIR, '.nojekyll'), '');

  // Per-figure pages (docs/figures/<slug>.html).
  const figuresDir = path.join(OUT_DIR, 'figures');
  fs.mkdirSync(figuresDir, { recursive: true });
  const matchers = buildFigureMatchers(data.figures);
  for (const { fig, tokens } of matchers) {
    fs.writeFileSync(
      path.join(figuresDir, `${figureSlug(fig.name)}.html`),
      renderFigurePage(fig, data.events, tokens, archives, data.meta, data.references)
    );
  }

  const archivedRefs = data.references.filter((r) => archives[r.url] && archives[r.url].archiveUrl).length;
  console.log(
    `Built docs/index.html + ${data.figures.length} figure pages (${data.events.length} events, ` +
    `${data.references.length} references, ${archivedRefs} with archive fallback).`
  );
}

// Run the build only when invoked directly; when required (tests) just expose
// the pure helpers so they can be unit-tested without generating docs/.
if (require.main === module) main();

module.exports = {
  esc, formatArchiveTs, renderCites, decadeOf, renderPage,
  figureSlug, buildFigureMatchers, relatedEvents, renderFigurePage,
};
