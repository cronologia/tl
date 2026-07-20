'use strict';
// Invariants over the real committed data + a smoke test of the full render.
// Zero-dependency (node:test / node:assert).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { renderPage, figureSlug, buildFigureMatchers, renderFigurePage } = require('../build.js');

const ROOT = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'chronology.json'), 'utf8'));

test('every sources[] entry resolves to a reference id or a URL', () => {
  const ids = new Set(data.references.map((r) => r.id));
  const check = (sources, at) => {
    for (const s of sources || []) {
      assert.ok(ids.has(s) || /^https?:\/\//.test(s), `${at}: unknown source "${s}"`);
    }
  };
  data.facts.forEach((f, i) => check(f.sources, `facts[${i}]`));
  data.events.forEach((e, i) => check(e.sources, `events[${i}]`));
  data.figures.forEach((f, i) => check(f.sources, `figures[${i}]`));
  (data.organizations || []).forEach((o, i) => check(o.sources, `organizations[${i}]`));
});

test('reference ids are unique', () => {
  const seen = new Set();
  for (const r of data.references) {
    assert.ok(!seen.has(r.id), `duplicate reference id ${r.id}`);
    seen.add(r.id);
  }
});

test('events are dated plausibly and titled', () => {
  for (const e of data.events) {
    assert.ok(Number.isFinite(e.year) && e.year > 1500 && e.year < 2100, `bad year ${e.year}`);
    assert.ok(e.title && e.title.length > 3, `event ${e.year} missing title`);
    assert.equal(typeof e.dateVerified, 'boolean', `event "${e.title}" missing dateVerified`);
  }
});

test('renderPage produces a full page with analytics and every section', () => {
  const html = renderPage(data, {});
  assert.match(html, /<!DOCTYPE html>/);
  assert.match(html, /G-R9LV1QZHVE/, 'Google Analytics tag missing');
  assert.match(html, new RegExp('id="chronology"'));
  assert.match(html, new RegExp('id="references"'));
  for (const r of data.references) {
    assert.ok(html.includes(r.url.replace(/&/g, '&amp;')), `reference ${r.id} not rendered`);
  }
});

test('figure slugs are unique and non-empty', () => {
  const seen = new Set();
  for (const f of data.figures) {
    const slug = figureSlug(f.name);
    assert.ok(slug && /^[a-z0-9-]+$/.test(slug), `bad slug for ${f.name}: "${slug}"`);
    assert.ok(!seen.has(slug), `duplicate figure slug ${slug}`);
    seen.add(slug);
  }
});

test('every figure page is rendered, self-linked, and in sync (no drift)', () => {
  let archives = {};
  try {
    archives = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'archives.json'), 'utf8')).snapshots || {};
  } catch { /* no archive cache yet */ }
  for (const { fig, tokens } of buildFigureMatchers(data.figures)) {
    const html = renderFigurePage(fig, data.events, tokens, archives, data.meta, data.references);
    assert.ok(html.includes(`<h1>${fig.name.replace(/&/g, '&amp;')}`) || html.includes(fig.name.replace(/&/g, '&amp;').replace(/'/g, '&#39;')), `${fig.name} page missing its name`);
    assert.match(html, /href="\.\.\/index\.html"/, `${fig.name} page missing back-link`);
    const file = path.join(ROOT, 'docs', 'figures', `${figureSlug(fig.name)}.html`);
    const built = fs.readFileSync(file, 'utf8');
    assert.equal(built, html, `docs/figures/${figureSlug(fig.name)}.html out of date — run node build.js`);
  }
});

test('committed docs/index.html is the current render (no drift)', () => {
  const built = fs.readFileSync(path.join(ROOT, 'docs', 'index.html'), 'utf8');
  let archives = {};
  try {
    archives = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'archives.json'), 'utf8')).snapshots || {};
  } catch { /* no archive cache yet */ }
  assert.equal(built, renderPage(data, archives), 'docs/ out of date — run node build.js');
});
