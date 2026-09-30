// tests/ui.test.js - drives the REAL index.html + src/main.js + src/ui.js in a headless DOM (jsdom).
//   node tests/ui.test.js
// Skips (exit 0) if jsdom is not installed:  npm install
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

let JSDOM;
try { ({ JSDOM } = await import('jsdom')); } catch {
  console.log('jsdom not installed - skipping UI test (run `npm install` to enable it).');
  process.exit(0);
}

const root = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost:8000/?seed=5', pretendToBeVisual: true });
const { window } = dom;

// Expose the browser globals the modules expect.
globalThis.__MARS_TEST__ = true;
window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} }); // reduce-motion => performance mode
window.confirm = () => true;
for (const k of ['window', 'document', 'location', 'CustomEvent', 'Event', 'KeyboardEvent', 'HTMLElement', 'SVGElement', 'Element', 'Node',
  'NodeList', 'HTMLCollection', 'MutationObserver', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'matchMedia', 'confirm']) {
  try { Object.defineProperty(globalThis, k, { value: k === 'window' ? window : window[k], configurable: true, writable: true }); } catch { /* read-only global in Node */ }
}

let ok = 0, bad = 0;
const test = async (name, fn) => {
  try { await fn(); ok++; console.log('  ok  ', name); } catch (e) { bad++; console.log('  FAIL', name, '\n       ', e.message); }
};
const assert = (c, m = 'assertion failed') => { if (!c) throw new Error(m); };
const $ = (s) => window.document.querySelector(s);
const $$ = (s) => [...window.document.querySelectorAll(s)];
const click = (sel) => $(sel).dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
const text = (sel) => $(sel).textContent.trim();
const pickRadio = (name, value) => { const r = $(`input[name="${name}"][value="${value}"]`); r.checked = true; r.dispatchEvent(new window.Event('change', { bubbles: true })); };

const { boot } = await import('../src/main.js');
const loaders = {
  loadCache: async (n) => JSON.parse(await readFile(new URL(`data/cache/${n}`, root), 'utf8')),
  loadLevel: async (id) => JSON.parse(await readFile(new URL(`game/src/levels/${id}.json`, root), 'utf8')),
};

console.log('== boot');
await test('a failing level loader shows a friendly error instead of hanging', async () => {
  const r = await boot({ loaders: { ...loaders, loadLevel: async () => { throw new Error('boom'); } }, search: '' });
  assert(r === null);
  assert($('#btn-start').disabled && /could not load/i.test(text('#btn-start')));
  assert(!$('#boot-note').hidden, 'help note should be visible');
});
const app = await boot({ loaders, search: '?seed=5' });
await test('boot succeeds: start enabled, 3 missions listed, boot flag set', () => {
  assert(app && app.levels.length === 3);
  assert(!$('#btn-start').disabled && text('#btn-start') === 'Start mission');
  assert($$('input[name="level"]').length === 3);
  assert(window.__MARS_BOOTED === true && $('#boot-note').hidden);
});
await test('mission description follows the selected mission', () => {
  pickRadio('level', 1);
  assert(/dust storms/i.test(text('#level-desc')), text('#level-desc'));
  pickRadio('level', 0);
});
await test('footer is honest about the data source (synthetic sample)', () => {
  assert(/SAMPLE/i.test(text('#data-status')) && /synthetic/i.test(text('#data-status')), text('#data-status'));
  assert(/not a NASA product/i.test(text('.footer')));
});

console.log('\n== playing');
await test('Start mission swaps intro for the dashboard and fills every meter', () => {
  click('#btn-start');
  assert($('#intro').hidden && !$('#game').hidden && !$('#btn-menu').hidden);
  for (const k of ['lifeSupport', 'radiation', 'power', 'food', 'shield']) {
    const m = $(`[data-stat="${k}"]`);
    assert(Number.isFinite(Number(m.getAttribute('aria-valuenow'))) && Number(m.getAttribute('aria-valuenow')) > 0, `${k} meter empty`);
    assert(text(`.panel__value[data-value="${k}"]`) !== '–', `${k} label empty`);
  }
  assert(text('[data-value="day"]') === '1' && text('[data-value="solLimit"]') === '20', 'sol counter');
  assert(text('[data-value="phase"]') === 'day' && text('[data-value="actionPoints"]') === '3');
  assert(text('[data-value="outlook"]') === 'Clear skies', text('[data-value="outlook"]'));
  assert(/Scrubber/.test(text('[data-value="sub-lifeSupport"]')) && /dust on panels/.test(text('[data-value="sub-power"]')));
  assert($$('#events .event').length >= 1);
});
await test('the action hint updates with the selected action and target', () => {
  pickRadio('type', 'upgrade'); pickRadio('target', 'food');
  const h = text('#action-hint');
  assert(/Upgrade Greenhouse/.test(h) && /2 AP/.test(h) && /food/.test(h), h);
  pickRadio('type', 'allocate'); pickRadio('target', 'power');
  assert(/Conserve mode/.test(text('#action-hint')));
});
await test('Commit action spends action points and logs the result', () => {
  pickRadio('type', 'allocate'); pickRadio('target', 'power');
  click('#btn-commit');
  assert(text('[data-value="actionPoints"]') === '2', text('[data-value="actionPoints"]'));
  assert(/Conserve mode/.test(text('#events')), text('#events'));
  assert(/conserve mode on/.test(text('[data-value="sub-power"]')));
});
await test('End turn moves day -> night, and night uses one fewer action point', () => {
  click('#btn-end');
  assert(text('[data-value="phase"]') === 'night' && window.document.body.dataset.phase === 'night');
  assert(text('[data-value="actionPoints"]') === '2');
  click('#btn-end');
  assert(text('[data-value="day"]') === '2' && text('[data-value="phase"]') === 'day');
});
await test('raw/simplified toggle switches meter text to percentages', () => {
  click('#btn-data');
  assert(/^\d+%$/.test(text('.panel__value[data-value="power"]')), text('.panel__value[data-value="power"]'));
  click('#btn-data');
  assert(/^(Critical|Low|Steady|Strong)$/.test(text('.panel__value[data-value="power"]')));
});
await test('high contrast toggle sets the data attribute', () => {
  click('#btn-contrast');
  assert(window.document.documentElement.dataset.contrast === 'high');
  click('#btn-contrast');
  assert(window.document.documentElement.dataset.contrast === 'normal');
});
await test('malformed action events do not break the page', () => {
  window.document.dispatchEvent(new window.CustomEvent('game:action', { detail: { type: 'explode', target: 'moon' } }));
  window.document.dispatchEvent(new window.CustomEvent('game:action'));
  assert(!$('#game').hidden);
});

console.log('\n== finishing a mission');
await test('playing turns until the mission ends shows the end screen with a lesson', () => {
  let guard = 0;
  while ($('#end').hidden && guard++ < 200) {
    pickRadio('type', 'repair'); pickRadio('target', 'power'); click('#btn-commit');
    pickRadio('target', 'lifeSupport'); click('#btn-commit');
    click('#btn-end');
  }
  assert(!$('#end').hidden, 'end screen never appeared');
  assert(text('#end-title').length > 3 && text('#end-lesson').length > 40 && text('#end-badge').length > 0);
  assert(/^\d+$/.test(text('#end-score')) && text('#end-seed') === '5', 'seed from ?seed=5 should be shown: ' + text('#end-seed'));
  assert($('#btn-commit').disabled && $('#btn-end').disabled, 'controls must be locked after the end');
});
await test('Play again restarts the same mission with controls enabled', () => {
  click('#btn-again');
  assert($('#end').hidden && !$('#btn-commit').disabled);
  assert(text('[data-value="day"]') === '1' && text('[data-value="actionPoints"]') === '3');
});
await test('Mission menu (with confirm) returns to the intro and lets you pick another mission', () => {
  click('#btn-menu');
  assert(!$('#intro').hidden && $('#game').hidden);
  pickRadio('level', 2); click('#btn-start');
  assert(text('[data-value="solLimit"]') === '40', text('[data-value="solLimit"]'));
});
await test('level 2 shows a storm warning in the outlook before the storm arrives', () => {
  click('#btn-menu'); pickRadio('level', 1); click('#btn-start');
  const seen = new Set();
  for (let i = 0; i < 12 && $('#end').hidden; i++) { seen.add(text('[data-value="outlook"]')); click('#btn-end'); }
  assert(seen.has('Clear skies') && (seen.has('Dust storm building') || seen.has('Hazy, dust rising')), [...seen].join(' | '));
});
await test('during a dust storm the dust readout and veil react', () => {
  click('#btn-menu'); pickRadio('level', 1); click('#btn-start');
  let maxDust = 0;
  for (let i = 0; i < 24 && $('#end').hidden; i++) {
    maxDust = Math.max(maxDust, parseInt(text('[data-value="dust"]'), 10));
    click('#btn-end');
  }
  assert(maxDust >= 60, 'expected storm dust >= 60%, got ' + maxDust);
});

console.log('\n== accessibility basics');
await test('every form control has a label, every meter has a name and range', () => {
  for (const i of $$('input')) assert(i.closest('label'), 'input without label: ' + i.name);
  for (const m of $$('[role="meter"]')) assert(m.getAttribute('aria-labelledby') && m.hasAttribute('aria-valuemin') && m.hasAttribute('aria-valuemax'));
  assert($('#end').getAttribute('role') === 'dialog' && $('#end').getAttribute('aria-labelledby') === 'end-title');
  assert($('html').getAttribute('lang') === 'en');
});

console.log(`\n${ok} passed, ${bad} failed`);
window.close();
process.exit(bad ? 1 : 0);
