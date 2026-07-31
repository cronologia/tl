'use strict';
// tl-local extension: per-figure pages. Slugs are published URLs, matching is
// conservative (unique-surname rule), and every locale gets a page while the
// legacy pre-i18n /figures/<slug>.html URL survives as a redirect stub.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  figureSlug, buildFigureMatchers, relatedEvents, relatedEventIdx,
  renderFigurePage, figureRedirectStub, localizeData, loadDict, siteBase,
} = require('../build.js');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'chronology.json'), 'utf8'));

test('slugs are stable, ascii, and unique across the real figures', () => {
  assert.equal(figureSlug('Gustavo Gutiérrez'), 'gustavo-gutierrez');
  assert.equal(figureSlug('Óscar Romero (San Salvador)'), 'oscar-romero');
  const slugs = data.figures.map((f) => figureSlug(f.name));
  assert.equal(new Set(slugs).size, slugs.length, 'duplicate slug would overwrite a page');
});

test('the two Boffs never cross-match (unique-surname rule)', () => {
  const matchers = buildFigureMatchers(data.figures);
  const boffs = matchers.filter(({ fig }) => /Boff/.test(fig.name));
  assert.ok(boffs.length >= 2, 'fixture assumption: both Boffs present');
  for (const { tokens } of boffs) {
    assert.ok(!tokens.includes('Boff'), 'bare shared surname must not be a token');
  }
});

test('related events are index-mapped, so locales agree on the match set', () => {
  const matchers = buildFigureMatchers(data.figures);
  const es = localizeData(data, loadDict('es'), 'es');
  for (const [k, { tokens }] of matchers.entries()) {
    const idx = relatedEventIdx(data.events, tokens);
    // Same indices applied to the localized copy = same events, translated.
    const years = idx.map((i) => data.events[i].year);
    const esYears = idx.map((i) => es.events[i].year);
    assert.deepEqual(esYears, years, `figure ${k}: locale disagreement`);
  }
  // compat wrapper agrees with the idx form
  const t0 = matchers[0].tokens;
  assert.deepEqual(relatedEvents(data.events, t0), relatedEventIdx(data.events, t0).map((i) => data.events[i]));
});

test('a localized figure page carries switcher, hreflang, disclaimer and local citations', () => {
  const base = siteBase(data.meta);
  const es = localizeData(data, loadDict('es'), 'es');
  const matchers = buildFigureMatchers(data.figures);
  const k = 0;
  const related = relatedEventIdx(data.events, matchers[k].tokens).map((i) => es.events[i]);
  const html = renderFigurePage(es.figures[k], related, {}, es, { lang: 'es', base, sourceName: data.figures[k].name });
  const slug = figureSlug(data.figures[k].name);
  assert.match(html, new RegExp(`href="\\.\\./\\.\\./en/figures/${slug}\\.html"`), 'two-level switcher link');
  assert.match(html, new RegExp(`hreflang="pt" href="${base}pt/figures/${slug}\\.html"`));
  assert.match(html, /i18n-disclaimer/);
  assert.match(html, /\.\.\/\.\.\/styles\.css/);
});

test('the legacy stub redirects into the locale tree and keeps the old URL canonical-free', () => {
  const base = siteBase(data.meta);
  const html = figureRedirectStub('gustavo-gutierrez', base);
  assert.match(html, /location\.replace\('\.\.\/' \+ pick \+ '\/figures\/gustavo-gutierrez\.html'\)/);
  assert.match(html, /url=\.\.\/en\/figures\/gustavo-gutierrez\.html/);
  assert.match(html, new RegExp(`canonical" href="${base}en/figures/gustavo-gutierrez\\.html"`));
});
