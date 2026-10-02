// src/scene.js - the playable Mars base: astronaut, buildings, relief rocket, dust, flares.
// Pure presentation. Reads UI state, never touches game rules. Animated with anime.js.
import { animate } from './vendor/anime.esm.min.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const NS = 'http://www.w3.org/2000/svg';
const X = { power: 150, lifeSupport: 340, food: 560, shield: 760 };
const COL = { power: '#ffd166', lifeSupport: '#7fd6ff', food: '#5fe3b4', shield: '#c9a8ff' };
const GY = 286;
const cine = () => document.body.dataset.mode === 'cinematic';
const put = (el, x, y, sx = 1, sy = sx, r = 0) => { el.style.transform = `translate(${x}px,${y}px) rotate(${r}deg) scale(${sx},${sy})`; };

let ready = false, ax = 450, queue = 0, chain = Promise.resolve();
let solLimit = 20, lastPhase = null, lastRad = 0, rocket = { x: 800, y: 70, s: 0.5 };
let dust = 0, landed = false;

function mk(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
  (parent || $('#fx')).append(e);
  return e;
}
const tween = (o, to, opts) => new Promise((res) => animate(o, { ...to, ...opts, onComplete: res }));

/** Little particle burst at (x,y). */
function burst(x, y, color, n = 8, spread = 34) {
  if (!cine()) return;
  for (let i = 0; i < n; i++) {
    const c = mk('circle', { cx: x, cy: y, r: 2 + Math.random() * 2, fill: color });
    animate(c, {
      translateX: (Math.random() - 0.5) * spread * 2, translateY: -Math.random() * spread - 8,
      opacity: [1, 0], scale: [1, 0.2], duration: 500 + Math.random() * 400, ease: 'outQuad', onComplete: () => c.remove(),
    });
  }
}
function ring(x, y, color) {
  if (!cine()) return;
  const c = mk('circle', { cx: x, cy: y, r: 8, fill: 'none', stroke: color, 'stroke-width': 3 });
  animate(c, { r: [8, 58], opacity: [1, 0], duration: 900, ease: 'outExpo', onComplete: () => c.remove() });
}
function pop(t) {
  const el = $(`.bld[data-target="${t}"] .pop`);
  if (el && cine()) animate(el, { scaleY: [1, 1.14, 1], scaleX: [1, 0.94, 1], duration: 800, ease: 'outElastic(1, .5)' });
}
function shake(t) {
  const el = $(`.bld[data-target="${t}"] .pop`);
  if (el && cine()) animate(el, { rotate: [0, -4, 4, -3, 3, 0], duration: 500, ease: 'inOutSine' });
}

function walk(to) {
  const o = { x: ax };
  const dist = Math.abs(to - ax);
  if (!cine() || dist < 2) { ax = to; put($('#astro'), ax, GY - 4); return Promise.resolve(); }
  const dir = to > ax ? 1 : -1;
  return tween(o, { x: to }, {
    duration: Math.min(1300, dist * 4 + 200), ease: 'inOutSine',
    onUpdate: () => { ax = o.x; put($('#astro'), ax, GY - 4 - Math.abs(Math.sin(ax / 9)) * 5, dir, 1, Math.sin(ax / 9) * 3 * dir); },
  }).then(() => put($('#astro'), ax, GY - 4, dir, 1));
}

async function work(type, t) {
  const bx = X[t];
  await walk(bx + (bx > ax ? -46 : 46));
  const a = $('#astro');
  if (type === 'repair') { for (let i = 0; i < 4; i++) { burst(bx, GY - 40, '#ffd166', 6); shake(t); await new Promise((r) => setTimeout(r, 200)); } }
  else if (type === 'upgrade') { ring(bx, GY - 40, COL[t]); ring(bx, GY - 40, '#fff'); pop(t); burst(bx, GY - 70, COL[t], 14, 50); await new Promise((r) => setTimeout(r, 500)); }
  else if (type === 'research') {
    const b = mk('circle', { cx: bx, cy: GY - 110, r: 9, fill: '#fff6b0' });
    animate(b, { translateY: [10, -30], scale: [0.4, 1.6, 1], opacity: [0, 1, 0], duration: 1100, ease: 'outQuad', onComplete: () => b.remove() });
    burst(bx, GY - 110, '#fff6b0', 10, 40);
    await new Promise((r) => setTimeout(r, 700));
  } else if (type === 'allocate') {
    const orb = mk('circle', { cx: X.power, cy: GY - 30, r: 7, fill: COL[t], filter: 'url(#glow)' });
    animate(orb, { translateX: bx - X.power, translateY: [0, -30, 0], duration: 800, ease: 'inOutQuad', onComplete: () => { orb.remove(); ring(bx, GY - 40, COL[t]); pop(t); } });
    await new Promise((r) => setTimeout(r, 800));
  }
  animate(a, { scale: [1, 1.05, 1], duration: 300 });
}

/** Called when the player commits an action. */
export function sceneAction(type, target) {
  if (!ready || !X[target]) return;
  if (!cine()) { pop(target); return; }
  if (queue > 2) return;
  queue++;
  chain = chain.then(() => work(type, target)).catch(() => {}).then(() => { queue--; });
}

function moveRocket(f, dur = 1600) {
  const to = { x: 800 - 350 * f, y: 70 + 60 * f, s: 0.5 + 0.35 * f };
  const el = $('#rocket');
  if (!cine()) { rocket = to; put(el, to.x, to.y, to.s); return; }
  const o = { ...rocket };
  tween(o, to, { duration: dur, ease: 'inOutQuad', onUpdate: () => { rocket = { ...o }; put(el, o.x, o.y + Math.sin(o.x / 30) * 3, o.s); } });
}

function flare(strong) {
  if (!cine()) return;
  const bubble = $('#bubble');
  animate(bubble, { strokeWidth: [3, 9, 3], duration: 900, ease: 'outQuad' });
  const n = strong ? 14 : 7;
  for (let i = 0; i < n; i++) {
    const x = 60 + Math.random() * 780;
    const l = mk('line', { x1: x, y1: -10, x2: x - 20, y2: 20, stroke: '#ff8a96', 'stroke-width': 2.5, 'stroke-linecap': 'round' });
    animate(l, { translateY: [0, 130 + Math.random() * 90], translateX: [0, -30], opacity: [1, 0], duration: 800 + Math.random() * 500, delay: i * 50, ease: 'inQuad', onComplete: () => l.remove() });
  }
  animate('#scene', { translateX: [0, -4, 4, -2, 0], duration: 350, ease: 'inOutSine' });
}

/** Called from ui.js with the full status payload. */
export function sceneUpdate(d) {
  if (!ready) return;
  if (Number.isFinite(d.details?.solLimit)) solLimit = d.details.solLimit;
  if (Number.isFinite(d.day)) {
    const f = Math.min(1, Math.max(0, (d.day - 1) / solLimit));
    if (!landed) moveRocket(f);
    const left = Math.max(0, solLimit - d.day + 1);
    $$('[data-value="eta"]').forEach((e) => (e.textContent = `${left} sol${left === 1 ? '' : 's'}`));
    landed = false;
  }
  if (d.phase && d.phase !== lastPhase) {
    const night = d.phase === 'night';
    const t = cine() ? 1400 : 0;
    animate('#night', { opacity: night ? 0.78 : 0, duration: t, ease: 'inOutSine' });
    animate('#sun', { translateY: night ? 200 : 0, opacity: night ? 0 : 1, duration: t, ease: 'inOutSine' });
    animate('#moon', { translateY: night ? 0 : -160, opacity: night ? 1 : 0, duration: t, ease: 'inOutSine' });
    animate('.lamp', { opacity: night ? [0.5, 1] : [1, 0.6], duration: t });
    lastPhase = d.phase;
  }
  if (Number.isFinite(d.dust)) {
    dust = d.dust;
    animate('#dust', { opacity: Math.min(1, dust * 1.4), duration: cine() ? 900 : 0 });
    $('#dust').style.display = dust < 0.08 ? 'none' : '';
  }
  if (Number.isFinite(d.shield)) $('#bubble').style.opacity = 0.15 + (d.shield / 100) * 0.65;
  if (Number.isFinite(d.details?.panelDust)) $('#pdust').style.opacity = Math.min(0.85, d.details.panelDust / 100 * 1.1);
  if (Number.isFinite(d.radiation)) {
    if (d.radiation - lastRad >= 2) flare(d.radiation - lastRad >= 6);
    lastRad = d.radiation;
    $('#scene').dataset.rad = d.radiation > 60 ? 'hi' : d.radiation > 35 ? 'mid' : 'lo';
  }
}

export function sceneLevel(key, level) {
  const b = $(`.bld[data-target="${key}"]`);
  if (!b) return;
  if (b.dataset.level !== level && level === 'crit') shake(key);
  b.dataset.level = level;
}

export function sceneAlert() { if (cine()) animate('.scene', { translateY: [0, -5, 4, -2, 0], duration: 420, ease: 'inOutSine' }); }

/** Mission over: rocket lands (win) or leaves (fail). Resolves when the animation is done. */
export function sceneEnd(win) {
  if (!ready) return Promise.resolve();
  landed = true;
  const el = $('#rocket'), o = { ...rocket };
  const to = win ? { x: 450, y: GY + 2, s: 1 } : { x: 1100, y: -160, s: 0.4 };
  if (!cine()) { put(el, to.x, to.y, to.s); return Promise.resolve(); }
  $('#flame').style.opacity = 1;
  return tween(o, to, {
    duration: win ? 2600 : 1800, ease: win ? 'outCubic' : 'inQuad',
    onUpdate: () => put(el, o.x, o.y, o.s, o.s, win ? 0 : 35 * (1 - o.s)),
  }).then(() => {
    if (win) {
      $('#flame').style.opacity = 0;
      [X.power, X.lifeSupport, X.food, X.shield].forEach((x, i) => setTimeout(() => { ring(x, GY - 40, '#5fe3b4'); burst(x, GY - 60, '#fff6b0', 12, 50); }, i * 220));
      animate('#astro', { translateY: [0, -14, 0, -14, 0], duration: 900, delay: 300 });
    }
  });
}

export function sceneReset() {
  if (!ready) return;
  landed = false; lastRad = 0; ax = 450; lastPhase = null;
  put($('#astro'), ax, GY - 4);
  $('#flame').style.opacity = 1;
  rocket = { x: 800, y: 70, s: 0.5 };
  put($('#rocket'), rocket.x, rocket.y, rocket.s);
  $('#fx').innerHTML = '';
}

export function initScene() {
  if (ready || !$('#scene')) return;
  ready = true;
  // dust particles
  const dg = $('#dust');
  for (let i = 0; i < 46; i++) mk('circle', { cx: Math.random() * 900, cy: 120 + Math.random() * 200, r: 1 + Math.random() * 2.5, fill: '#e59a72', opacity: 0.4 + Math.random() * 0.5 }, dg);
  sceneReset();
  // interaction: click / keyboard a building to target it
  const select = (t) => {
    const r = $(`input[name="target"][value="${t}"]`);
    if (r) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }
  };
  const mark = () => {
    const t = $('input[name="target"]:checked')?.value;
    $$('.bld').forEach((b) => b.classList.toggle('sel', b.dataset.target === t));
    if (t && cine() && !queue) { queue++; chain = chain.then(() => walk(X[t] + (X[t] > ax ? -46 : 46))).catch(() => {}).then(() => { queue--; }); }
  };
  $$('.bld').forEach((b) => {
    b.addEventListener('click', () => select(b.dataset.target));
    b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(b.dataset.target); } });
    b.addEventListener('mouseenter', () => cine() && animate(b.querySelector('.pop'), { scale: 1.06, duration: 250, ease: 'outQuad' }));
    b.addEventListener('mouseleave', () => cine() && animate(b.querySelector('.pop'), { scale: 1, duration: 300, ease: 'outQuad' }));
  });
  $$('input[name="target"]').forEach((r) => r.addEventListener('change', mark));
  mark();
  if (!cine()) return;
  // idle life
  animate('#astro .helmet', { translateY: [0, -1.5], duration: 1400, loop: true, alternate: true, ease: 'inOutSine' });
  animate('#flame', { scaleY: [0.7, 1.3], scaleX: [1, 0.8], duration: 140, loop: true, alternate: true, ease: 'linear' });
  animate('.ring', { rotate: 360, duration: 6000, loop: true, ease: 'linear' });
  animate('.plant', { rotate: [-5, 5], duration: 1800, loop: true, alternate: true, ease: 'inOutSine', delay: (_, i) => i * 250 });
  animate('.lamp', { opacity: [0.45, 1], duration: 1100, loop: true, alternate: true, ease: 'inOutSine', delay: (_, i) => i * 200 });
  animate('#bubble', { strokeDashoffset: [0, -60], duration: 3500, loop: true, ease: 'linear' });
  animate('#dust circle', { translateX: [-60, 980], duration: () => 3000 + Math.random() * 4000, delay: () => Math.random() * 2000, loop: true, ease: 'linear' });
}
