// Targets anime.js v4.x (ES module build). Pin a exact version for release, e.g. animejs@4.0.2.
import { animate, createTimeline, stagger, svg } from 'https://cdn.jsdelivr.net/npm/animejs@4/+esm';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const STATS = ['lifeSupport', 'radiation', 'power', 'food', 'shield'];
const WORDS = [[30, 'Critical'], [55, 'Low'], [80, 'Steady'], [101, 'Strong']];

let mode = 'cinematic', rawView = false, ready = false;
let bgAnims = [], shown = {}, eventSig = '';

const effective = () => (reduced.matches ? 'performance' : mode);
const clamp = (v) => Math.max(0, Math.min(100, v));
const good = (k, v) => (k === 'radiation' ? 100 - v : v);
const level = (k, v) => (good(k, v) < 30 ? 'crit' : good(k, v) < 60 ? 'warn' : 'ok');
const word = (k, v) => WORDS.find(([max]) => good(k, v) < max)[1];
const setText = (key, val) => $$(`[data-value="${key}"]`).forEach((el) => (el.textContent = val));

/* ---------- stats ---------- */
function render(key, v) {
  const m = $(`[data-stat="${key}"]`);
  if (!m) return;
  m.style.setProperty('--v', `${v}%`);
  m.setAttribute('aria-valuenow', Math.round(v));
  m.dataset.level = level(key, v);
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
    li.className = `event event--${sev}`;
    const t = document.createElement('span');
    t.className = 'event__title';
    t.textContent = `${sev === 'info' ? '' : sev[0].toUpperCase() + sev.slice(1) + ': '}${e.title ?? ''}`;
    li.append(t, document.createTextNode(e.text ?? ''));
    ul.append(li);
  });
  if (effective() === 'cinematic') animate($$('.event', ul), { opacity: [0, 1], translateX: [-12, 0], delay: stagger(90), duration: 500, ease: 'outQuad' });
  $('#panel-events').classList.toggle('anim-alert-pulse', list.some((e) => e.severity === 'critical'));
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
}

/* ---------- animated background ---------- */
function buildBackground() {
  bgAnims.forEach((a) => a.pause());
  bgAnims = [];
  const cine = effective() === 'cinematic';
  const stars = $('.bg__stars');
  stars.innerHTML = '';
  (cine ? [40, 30, 20] : [16]).forEach((n, i) => {
    const layer = document.createElement('div');
    layer.className = 'bg__layer';
    layer.dataset.depth = (i + 1) * 8;
    for (let j = 0; j < n; j++) {
      const s = document.createElement('i');
      s.className = 'bg__star';
      s.style.cssText = `left:${Math.random() * 100}%;top:${Math.random() * 100}%;--sz:${1 + i}px`;
      layer.append(s);
    }
    stars.append(layer);
  });
  const orbits = $('.bg__orbits');
  orbits.innerHTML = '';
  $('#nebA').setAttribute('d', 'M0 320 C150 120 350 520 500 320 S850 120 1000 320 V700 H0Z');
  if (!cine) return;
  bgAnims.push(animate('.bg__star', { opacity: [0.25, 1], duration: 2400, delay: stagger(60, { from: 'random' }), loop: true, alternate: true, ease: 'inOutSine' }));
  bgAnims.push(animate('#nebA', { d: svg.morphTo($('#nebB')), duration: 16000, ease: 'inOutSine', loop: true, alternate: true }));
  [0, 1].forEach((i) => {
    const o = document.createElement('div');
    o.className = 'bg__orbit';
    o.style.setProperty('--r', `${62 + i * 30}vmin`);
    o.innerHTML = '<i class="bg__sat"></i>';
    orbits.append(o);
    bgAnims.push(animate(o, { rotate: i ? -360 : 360, duration: 70000 + i * 40000, ease: 'linear', loop: true }));
  });
}

export function setPerformanceMode(m) {
  mode = m === 'performance' ? 'performance' : 'cinematic';
  document.body.dataset.mode = effective();
  const b = $('#btn-mode');
  b.textContent = `Mode: ${mode === 'performance' ? 'Performance' : 'Cinematic'}`;
  b.setAttribute('aria-pressed', String(mode === 'performance'));
  buildBackground();
}

/* ---------- input + wiring ---------- */
const DEMO = [
  { day: 3, phase: 'day', actionPoints: 3, lifeSupport: 82, radiation: 12, power: 78, food: 64, shield: 90, dust: 0.05, events: [{ title: 'Calm sol', text: 'Clear skies over the outpost.', severity: 'info' }] },
  { day: 4, phase: 'night', actionPoints: 2, lifeSupport: 80, radiation: 14, power: 34, food: 60, shield: 88, dust: 0.7, events: [{ title: 'Dust storm', text: 'Panels are clogged and power is dropping.', severity: 'warning' }] },
  { day: 5, phase: 'day', actionPoints: 1, lifeSupport: 71, radiation: 78, power: 41, food: 55, shield: 52, dust: 0.3, events: [{ title: 'Radiation warning', text: 'Shield integrity is falling.', severity: 'critical' }] },
];

const send = (detail) => document.dispatchEvent(new CustomEvent('game:action', { detail }));
const press = (el) => { el.classList.remove('anim-press'); void el.offsetWidth; el.classList.add('anim-press'); };
const pick = (name) => $(`input[name="${name}"]:checked`)?.value;

export function initUI() {
  if (ready) return;
  ready = true;
  setPerformanceMode(mode);
  reduced.addEventListener('change', () => setPerformanceMode(mode));

  createTimeline({ defaults: { ease: 'outExpo', duration: 900 } })
    .add('.intro__title', { opacity: [0, 1], translateY: [28, 0] })
    .add('.intro__sub', { opacity: [0, 1], translateY: [20, 0] }, '-=550')
    .add('.intro__cta', { opacity: [0, 1], scale: [0.9, 1] }, '-=550');

  $('#btn-start').addEventListener('click', () => {
    $('#intro').hidden = true;
    $('#game').hidden = false;
    $$('.panel').forEach((p, i) => { p.style.setProperty('--i', i); p.classList.add('anim-panel-enter'); });
    $('#game h1').tabIndex = -1;
    $('#game h1').focus();
  });
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
    send(detail); press(e.currentTarget);
    $('#sr-status').textContent = `Sent: ${detail.type} ${detail.target}`;
  });
  $('#btn-end').addEventListener('click', (e) => {
    send({ type: 'endTurn' }); press(e.currentTarget);
    $('#sr-status').textContent = 'Turn ended';
  });

  if (new URLSearchParams(location.search).get('demo') === '1') {
    let i = 0;
    const b = $('#btn-demo');
    b.hidden = false;
    b.addEventListener('click', () => updateStatusPanel(DEMO[i++ % DEMO.length]));
  }
}

window.GameUI = { initUI, setPerformanceMode, updateStatusPanel };
initUI(); // module scripts run after parsing; initUI is idempotent if called again
