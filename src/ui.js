// src/ui.js - all DOM work for the game. It knows nothing about game rules:
// it renders the `uiState` (+ `details`) it is given and dispatches DOM events.
//
// Events dispatched on `document`:
//   game:start   detail { level }            - player pressed "Start mission"
//   game:action  detail { type, target }     - player pressed "Commit action"; { type: "endTurn" } for End turn
//   game:menu / game:again / game:next       - end-screen and top-bar buttons
//
// anime.js is vendored (pinned v4.5.0, MIT) so the game runs offline and does not depend on a CDN.
import { animate, createTimeline, stagger, svg } from './vendor/anime.esm.min.js';
import { initScene, sceneUpdate, sceneAction, sceneLevel, sceneAlert, sceneEnd, sceneReset } from './scene.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const STATS = ['lifeSupport', 'radiation', 'power', 'food', 'shield'];
const WORDS = [[30, 'Critical'], [55, 'Low'], [80, 'Steady'], [101, 'Strong']];

let mode = 'cinematic', rawView = false, ready = false;
let bgAnims = [], shown = {}, eventSig = '';
let hintFn = null, selectedLevel = 0;

const effective = () => (reduced.matches ? 'performance' : mode);
const clamp = (v) => Math.max(0, Math.min(100, v));
const good = (k, v) => (k === 'radiation' ? 100 - v : v);
const level = (k, v) => (good(k, v) < 30 ? 'crit' : good(k, v) < 60 ? 'warn' : 'ok');
const word = (k, v) => WORDS.find(([max]) => good(k, v) < max)[1];
const setText = (key, val) => $$(`[data-value="${key}"]`).forEach((el) => (el.textContent = val));
const pct = (v) => `${Math.round(v)}%`;

/* ---------- stats ---------- */
function render(key, v) {
  const m = $(`[data-stat="${key}"]`);
  if (!m) return;
  m.style.setProperty('--v', `${v}%`);
  m.setAttribute('aria-valuenow', Math.round(v));
  m.dataset.level = level(key, v);
  sceneLevel(key, level(key, v));
  setText(key, rawView ? `${Math.round(v)}%` : word(key, v));
}

function setStat(key, target) {
  const from = shown[key] ?? 0;
  if (effective() === 'performance' || from === target) {
    shown[key] = target;
    return render(key, target);
  }
  const o = { v: from };
  animate(o, { v: target, duration: 700, ease: 'outQuad', onUpdate: () => { shown[key] = o.v; render(key, o.v); } });
}

function renderEvents(list) {
  const sig = JSON.stringify(list);
  if (sig === eventSig) return;
  eventSig = sig;
  const ul = $('#events');
  ul.innerHTML = '';
  const items = list.length ? list : [{ title: 'All quiet', text: 'No events right now.', severity: 'info' }];
  items.forEach((e) => {
    const sev = ['info', 'warning', 'critical'].includes(e.severity) ? e.severity : 'info';
    const li = document.createElement('li');
    li.className = `event event--${sev}${e.fresh === false ? ' event--old' : ' event--new'}`;
    const t = document.createElement('span');
    t.className = 'event__title';
    t.textContent = `${sev === 'info' ? '' : sev[0].toUpperCase() + sev.slice(1) + ': '}${e.title ?? ''}`;
    li.append(t, document.createTextNode(e.text ?? ''));
    ul.append(li);
  });
  if (effective() === 'cinematic') animate($$('.event--new', ul), { opacity: [0, 1], translateX: [-12, 0], delay: stagger(90), duration: 500, ease: 'outQuad' });
  const fresh = list.find((e) => e.fresh !== false && e.severity !== 'info');
  if (fresh) { toast(fresh); if (fresh.severity === 'critical') sceneAlert(); }
  $('#panel-events').classList.toggle('anim-alert-pulse', list.some((e) => e.fresh !== false && e.severity === 'critical'));
}

function toast(e) {
  if (effective() !== 'cinematic') return;
  const t = document.createElement('div');
  t.className = 'toast';
  t.dataset.sev = e.severity;
  t.textContent = e.title ?? '';
  document.body.append(t);
  animate(t, { opacity: [0, 1, 1, 0], translateY: [-14, 0, 0, -10], duration: 2600, ease: 'outQuad', onComplete: () => t.remove() });
}

function renderDetails(d) {
  if (Number.isFinite(d.solLimit)) setText('solLimit', d.solLimit);
  if (Number.isFinite(d.score)) setText('score', d.score);
  if (d.outlook) {
    setText('outlook', d.outlook.text);
    $$('[data-value="outlook"]').forEach((el) => (el.dataset.level = d.outlook.level));
  }
  const max = d.maxUpgrade ?? 3;
  const up = (k) => `upgrade ${d.upgrades?.[k] ?? 0}/${max}`;
  const tag = (k) => (d.priority === k ? ' · priority power' : '');
  if (d.conditions) {
    setText('sub-lifeSupport', `Scrubber condition ${pct(d.conditions.lifeSupport)} · ${up('lifeSupport')}${tag('lifeSupport')}`);
    setText('sub-power', `Panels ${pct(d.conditions.power)} · dust on panels ${pct(d.panelDust ?? 0)} · ${up('power')}${d.conserve ? ' · conserve mode on' : ''}`);
    setText('sub-food', `Greenhouse condition ${pct(d.conditions.food)} · ${up('food')}${tag('food')}`);
  }
  if (d.upgrades) setText('sub-shield', `${up('shield')}${tag('shield')}`);
  setText('sub-radiation', 'Cannot be reversed. A stronger shield slows it.');
}

export function updateStatusPanel(data = {}) {
  STATS.forEach((k) => Number.isFinite(data[k]) && setStat(k, clamp(data[k])));
  if (Number.isFinite(data.day)) setText('day', data.day);
  if (Number.isFinite(data.actionPoints)) setText('actionPoints', data.actionPoints);
  if (data.phase === 'day' || data.phase === 'night') { setText('phase', data.phase); document.body.dataset.phase = data.phase; }
  if (Number.isFinite(data.dust)) {
    $('.dust-veil').style.opacity = Math.max(0, Math.min(1, data.dust)) * 0.6;
    setText('dust', `${Math.round(data.dust * 100)}%`);
  }
  if (Array.isArray(data.events)) renderEvents(data.events);
  if (data.details) renderDetails(data.details);
  sceneUpdate(data);
}

/* ---------- animated background ---------- */
let streakTimer = 0;
function buildBackground() {
  bgAnims.forEach((a) => a.pause());
  bgAnims = [];
  clearInterval(streakTimer);
  const cine = effective() === 'cinematic';
  const stars = $('.bg__stars');
  stars.innerHTML = '';
  (cine ? [90, 55, 30] : [16]).forEach((n, i) => {
    const layer = document.createElement('div');
    layer.className = 'bg__layer';
    layer.dataset.depth = (i + 1) * 8;
    for (let j = 0; j < n; j++) {
      const s = document.createElement('i');
      s.className = 'bg__star';
      const hue = [0, 200, 30][Math.floor(Math.random() * 3)];
      s.style.cssText = `left:${Math.random() * 100}%;top:${Math.random() * 100}%;--sz:${1 + i * 0.8}px;background:hsl(${hue} ${hue ? 70 : 0}% 92%)`;
      layer.append(s);
    }
    stars.append(layer);
  });
  const orbits = $('.bg__orbits');
  orbits.innerHTML = '';
  $('#nebA').setAttribute('d', 'M0 320 C150 120 350 520 500 320 S850 120 1000 320 V700 H0Z');
  if (!cine) return;
  const planet = document.createElement('div');
  planet.className = 'bg__planet';
  orbits.append(planet);
  bgAnims.push(animate(planet, { translateY: [-10, 14], duration: 9000, loop: true, alternate: true, ease: 'inOutSine' }));
  bgAnims.push(animate('.bg__star', { opacity: [0.2, 1], scale: [0.8, 1.6], duration: 2200, delay: stagger(40, { from: 'random' }), loop: true, alternate: true, ease: 'inOutSine' }));
  $$('.bg__layer').forEach((l, i) => bgAnims.push(animate(l, { translateX: [0, -(20 + i * 30)], duration: 60000 - i * 15000, loop: true, alternate: true, ease: 'inOutSine' })));
  bgAnims.push(animate('#nebA', { d: svg.morphTo($('#nebB')), duration: 16000, ease: 'inOutSine', loop: true, alternate: true }));
  [0, 1].forEach((i) => {
    const o = document.createElement('div');
    o.className = 'bg__orbit';
    o.style.setProperty('--r', `${62 + i * 30}vmin`);
    o.innerHTML = '<i class="bg__sat"></i>';
    orbits.append(o);
    bgAnims.push(animate(o, { rotate: i ? -360 : 360, duration: 70000 + i * 40000, ease: 'linear', loop: true }));
  });
  streakTimer = setInterval(() => {
    const k = document.createElement('i');
    k.className = 'bg__streak';
    k.style.cssText = `left:${Math.random() * 80}%;top:${Math.random() * 45}%`;
    orbits.append(k);
    animate(k, { translateX: [0, 420], translateY: [0, 180], rotate: 24, opacity: [0, 1, 0], duration: 1100, ease: 'inQuad', onComplete: () => k.remove() });
  }, 3200);
}

export function setPerformanceMode(m) {
  mode = m === 'performance' ? 'performance' : 'cinematic';
  document.body.dataset.mode = effective();
  const b = $('#btn-mode');
  b.textContent = `Mode: ${mode === 'performance' ? 'Performance' : 'Cinematic'}`;
  b.setAttribute('aria-pressed', String(mode === 'performance'));
  buildBackground();
}

/* ---------- screens ---------- */
export function showGame() {
  $('#intro').hidden = true;
  $('#end').hidden = true;
  $('#game').hidden = false;
  $('#btn-menu').hidden = false;
  eventSig = '';
  shown = {};
  sceneReset();
  $$('.panel', $('#game')).forEach((p, i) => { p.style.setProperty('--i', i); p.classList.remove('anim-panel-enter'); void p.offsetWidth; p.classList.add('anim-panel-enter'); });
  const h = $('#game h1');
  h.tabIndex = -1;
  h.focus();
}

export function showIntro() {
  $('#game').hidden = true;
  $('#end').hidden = true;
  $('#intro').hidden = false;
  $('#btn-menu').hidden = true;
  $('#btn-start').focus();
}

export function showEnd(result, { hasNext = false } = {}) {
  const win = result.status === 'success';
  $('#end-badge').textContent = win ? (result.tier === 'full' ? 'Thriving' : 'Survived') : 'Mission failed';
  $('#end-badge').dataset.status = win ? (result.tier === 'full' ? 'full' : 'partial') : 'fail';
  $('#end-title').textContent = result.title;
  $('#end-text').textContent = result.text;
  $('#end-lesson').textContent = result.lesson;
  $('#end-score').textContent = result.score;
  $('#end-sols').textContent = result.sols;
  $('#end-seed').textContent = result.seed;
  $('#btn-next').hidden = !(win && hasNext);
  const reveal = () => {
    $('#end').hidden = false;
    if (effective() === 'cinematic') animate('.end__card', { opacity: [0, 1], translateY: [24, 0], duration: 600, ease: 'outExpo' });
    $('#end-title').focus();
  };
  if (effective() === 'cinematic') sceneEnd(win).then(() => setTimeout(reveal, win ? 900 : 300));
  else { sceneEnd(win); reveal(); }
}

export function hideEnd() { $('#end').hidden = true; }
export function setControlsEnabled(on) { ['#btn-commit', '#btn-end'].forEach((s) => ($(s).disabled = !on)); }
export function announce(text) { $('#sr-status').textContent = text; }
export function setDataStatus(text) { $('#data-status').textContent = text; }
export function showBootError(msg) {
  $('#level-desc').textContent = msg;
  const b = $('#btn-start');
  b.disabled = true;
  b.textContent = 'Could not load the game';
  $('#boot-note').hidden = false;
}
export function markBooted() { window.__MARS_BOOTED = true; $('#boot-note').hidden = true; }

export function enableStart(label = 'Start mission') {
  const b = $('#btn-start');
  b.disabled = false;
  b.textContent = label;
}

/** Fills the mission picker. Returns nothing; read the choice with getSelectedLevel(). */
export function renderLevelChoices(levels, select = 0) {
  const box = $('#level-list');
  box.innerHTML = '';
  selectedLevel = Math.min(Math.max(select, 0), levels.length - 1);
  levels.forEach((lv, i) => {
    const label = document.createElement('label');
    label.className = 'choice__opt';
    const input = document.createElement('input');
    Object.assign(input, { type: 'radio', name: 'level', value: String(i), className: 'choice__input', checked: i === selectedLevel });
    const span = document.createElement('span');
    span.className = 'choice__label';
    span.textContent = `${i + 1}. ${lv.name} · ${lv.turnLimit} sols`;
    label.append(input, span);
    box.append(label);
  });
  const show = () => { $('#level-desc').textContent = levels[selectedLevel].description; };
  box.addEventListener('change', (e) => {
    if (e.target.name === 'level') { selectedLevel = Number(e.target.value); show(); }
  });
  show();
}
export const getSelectedLevel = () => selectedLevel;
export function selectLevel(i) {
  selectedLevel = i;
  const r = $(`input[name="level"][value="${i}"]`);
  if (r) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }
}

/** fn(type, target) -> string shown under the action pickers. */
export function setActionHint(fn) { hintFn = fn; updateHint(); }
function updateHint() { $('#action-hint').textContent = hintFn ? hintFn(pick('type'), pick('target')) : ''; }

/* ---------- input + wiring ---------- */
const DEMO = [
  { day: 3, phase: 'day', actionPoints: 3, lifeSupport: 82, radiation: 12, power: 78, food: 64, shield: 90, dust: 0.05, events: [{ title: 'Calm sol', text: 'Clear skies over the outpost.', severity: 'info' }] },
  { day: 4, phase: 'night', actionPoints: 2, lifeSupport: 80, radiation: 14, power: 34, food: 60, shield: 88, dust: 0.7, events: [{ title: 'Dust storm', text: 'Panels are clogged and power is dropping.', severity: 'warning' }] },
  { day: 5, phase: 'day', actionPoints: 1, lifeSupport: 71, radiation: 78, power: 41, food: 55, shield: 52, dust: 0.3, events: [{ title: 'Radiation warning', text: 'Shield integrity is falling.', severity: 'critical' }] },
];

const emit = (name, detail = {}) => document.dispatchEvent(new CustomEvent(name, { detail }));
const send = (detail) => emit('game:action', detail);
const press = (el) => { el.classList.remove('anim-press'); void el.offsetWidth; el.classList.add('anim-press'); };
const pick = (name) => $(`input[name="${name}"]:checked`)?.value;

export function initUI() {
  if (ready) return;
  ready = true;
  setPerformanceMode(mode);
  initScene();
  reduced.addEventListener('change', () => setPerformanceMode(mode));

  createTimeline({ defaults: { ease: 'outExpo', duration: 900 } })
    .add('.intro__title', { opacity: [0, 1], translateY: [28, 0] })
    .add('.intro__sub', { opacity: [0, 1], translateY: [20, 0] }, '-=550')
    .add('.intro__cta', { opacity: [0, 1], scale: [0.9, 1] }, '-=550');

  $('#btn-start').addEventListener('click', () => emit('game:start', { level: selectedLevel }));
  $('#btn-menu').addEventListener('click', () => emit('game:menu'));
  $('#btn-choose').addEventListener('click', () => emit('game:menu'));
  $('#btn-again').addEventListener('click', () => emit('game:again'));
  $('#btn-next').addEventListener('click', () => emit('game:next'));
  $('#btn-mode').addEventListener('click', () => setPerformanceMode(mode === 'cinematic' ? 'performance' : 'cinematic'));
  $('#btn-contrast').addEventListener('click', (e) => {
    const on = document.documentElement.dataset.contrast !== 'high';
    document.documentElement.dataset.contrast = on ? 'high' : 'normal';
    e.currentTarget.setAttribute('aria-pressed', String(on));
  });
  $('#btn-data').addEventListener('click', (e) => {
    rawView = !rawView;
    e.currentTarget.setAttribute('aria-pressed', String(rawView));
    e.currentTarget.textContent = `Data view: ${rawView ? 'Raw' : 'Simplified'}`;
    STATS.forEach((k) => k in shown && render(k, shown[k]));
  });
  $('#btn-commit').addEventListener('click', (e) => {
    const detail = { type: pick('type'), target: pick('target') };
    sceneAction(detail.type, detail.target);
    send(detail); press(e.currentTarget);
  });
  $('#btn-end').addEventListener('click', (e) => {
    send({ type: 'endTurn' }); press(e.currentTarget);
  });
  $$('input[name="type"], input[name="target"]').forEach((r) => r.addEventListener('change', updateHint));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#end').hidden) emit('game:menu');
  });

  if (new URLSearchParams(location.search).get('demo') === '1') {
    let i = 0;
    const b = $('#btn-demo');
    b.hidden = false;
    b.addEventListener('click', () => { showGame(); updateStatusPanel(DEMO[i++ % DEMO.length]); });
  }
}

window.GameUI = { initUI, setPerformanceMode, updateStatusPanel };
initUI(); // module scripts run after parsing; initUI is idempotent if called again
