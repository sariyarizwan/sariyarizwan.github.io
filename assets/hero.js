/* Hero: a career chart drowned in noise, with a lens that removes the noise and shows the trend.
   The steps of the trend sit at real role changes; the four results are HTML annotations (real text).
   Pointer, touch (horizontal drag) and arrow keys move the lens; it glides on its own when idle.
   Pauses off-screen, in hidden tabs and on request; one static frame under reduced motion. */
(() => {
  'use strict';
  const fig = document.querySelector('.hero-fig');
  const cv = fig && fig.querySelector('.hero-canvas');
  const cx = cv && cv.getContext && cv.getContext('2d');
  if (!cx) return;
  const plot = fig.querySelector('.hf-plot');
  const lab = fig.querySelector('.hf-lens');
  const ctrl = fig.querySelector('.hero-ctrl');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const anns = Array.from(fig.querySelectorAll('.hf-ann li')).map((li) => ({
    li, x: parseFloat(li.style.getPropertyValue('--x')), on: false,
    text: li.textContent.replace(/\s+/g, ' ').trim()
  }));

  const T0 = 2021, T1 = 2027, SPAN = T1 - T0, PARK = 2025.75;
  const L = (t, c, k) => 1 / (1 + Math.exp(-(t - c) * k));
  const sig = (t) => 0.1 + 0.19 * L(t, 2021.6, 6) + 0.2 * L(t, 2023.6, 6) + 0.27 * L(t, 2025.5, 7) + 0.12 * L(t, 2026.5, 8) + 0.04 * (t - T0) / SPAN;

  // seeded data: each point has a noisy reading and the underlying signal
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const N = innerWidth < 640 ? 1000 : 1700;
  const PT = new Float32Array(N), PN = new Float32Array(N), PS = new Float32Array(N), PV = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const t = T0 + 0.05 + rnd() * (SPAN - 0.2), v = sig(t);
    let n = rnd() < 0.04 ? 0.05 + rnd() * 0.9 : v + gauss() * 0.19;
    while (n < 0.03 || n > 0.97) n = v + gauss() * 0.19;
    PT[i] = t; PV[i] = v; PS[i] = v + gauss() * 0.011; PN[i] = n;
  }

  let W = 0, H = 0, D = 1, pad = { l: 42, r: 8, t: 56, b: 30 };
  const X = (t) => pad.l + (t - T0) / SPAN * (W - pad.l - pad.r);
  const Tx = (x) => T0 + (x - pad.l) / (W - pad.l - pad.r) * SPAN;
  const Y = (v) => pad.t + (1 - v) * (H - pad.t - pad.b);

  const C = {};
  const hex = (h, a) => { h = h.trim().replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); const n = parseInt(h, 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
  function readTheme() {
    const cs = getComputedStyle(document.documentElement);
    const g = (k) => cs.getPropertyValue(k).trim() || '#888888';
    C.ink = g('--ink'); C.ink2 = g('--ink-2'); C.ink3 = g('--ink-3'); C.sig = g('--sig'); C.bg = g('--bg');
    C.grid = hex(C.ink, 0.075); C.axis = hex(C.ink, 0.28); C.glass = hex(C.bg, 0.86); C.hatch = hex(C.ink, 0.07);
    C.sigSoft = hex(C.sig, 0.28); C.ring = hex(C.ink, 0.85);
  }
  function size() {
    const r = plot.getBoundingClientRect();
    const cs = getComputedStyle(plot);
    pad = { l: parseFloat(cs.getPropertyValue('--pl')) || 42, r: parseFloat(cs.getPropertyValue('--pr')) || 8, t: parseFloat(cs.getPropertyValue('--pt')) || 56, b: parseFloat(cs.getPropertyValue('--pb')) || 30 };
    W = Math.max(1, r.width); H = Math.max(1, r.height); D = Math.min(1.5, devicePixelRatio || 1);
    cv.width = Math.round(W * D); cv.height = Math.round(H * D); cx.setTransform(D, 0, 0, D, 0, 0);
  }

  // lens state
  let lx = 0, ly = 0, tx = 0, ty = 0, mode = 'auto', phase = 0, idleAt = 0, last = 0;
  const radius = () => (W < 520 ? Math.max(46, W * 0.15) : Math.max(60, Math.min(112, W * 0.13)));
  const onCurve = (t, wob) => { tx = X(t); ty = Y(sig(t)) + (wob || 0); };
  const phaseFor = (t) => { const u = Math.min(1, Math.max(0, (t - T0 - 0.4) / (SPAN - 0.8))); return Math.acos(1 - 2 * u) / (2 * Math.PI); };

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmt = (t) => { t = Math.min(T1 - 0.01, Math.max(T0, t)); const y = Math.floor(t); return months[Math.min(11, Math.floor((t - y) * 12))] + " '" + String(y).slice(2); };

  function draw() {
    const R = radius();
    cx.clearRect(0, 0, W, H);
    // grid and axes
    cx.lineWidth = 1; cx.strokeStyle = C.grid; cx.setLineDash([2, 4]);
    cx.beginPath(); for (let v = 0.25; v < 1; v += 0.25) { const y = Math.round(Y(v)) + 0.5; cx.moveTo(pad.l, y); cx.lineTo(W - pad.r, y); } cx.stroke();
    cx.setLineDash([]); cx.strokeStyle = C.axis;
    cx.beginPath(); cx.moveTo(pad.l + 0.5, pad.t - 14); cx.lineTo(pad.l + 0.5, H - pad.b + 0.5); cx.lineTo(W - pad.r, H - pad.b + 0.5); cx.stroke();
    cx.fillStyle = C.ink3; cx.font = '500 10px "JetBrains Mono", ui-monospace, monospace'; cx.textAlign = 'center'; cx.textBaseline = 'alphabetic';
    const narrow = W < 460;
    for (let y = T0; y <= T1; y++) {
      const x = X(y); cx.fillRect(Math.round(x), H - pad.b, 1, 5);
      if (y < T1 && (!narrow || (y - T0) % 2 === 0 || y === T1 - 1)) cx.fillText(narrow ? "'" + String(y).slice(2) : String(y), x + (X(y + 1) - x) / 2, H - pad.b + 19);
    }
    // noise: fades out inside the lens
    cx.fillStyle = C.ink2;
    let nIn = 0, sN = 0, sS = 0;
    for (let i = 0; i < N; i++) {
      const x = X(PT[i]), yn = Y(PN[i]);
      const dn = Math.hypot(x - lx, yn - ly);
      const k = Math.min(1, Math.max(0, (dn - R * 0.86) / (R * 0.16)));
      if (k > 0) { cx.globalAlpha = 0.44 * k; cx.fillRect(x - 0.8, yn - 0.8, 1.7, 1.7); }
      if (Math.abs(x - lx) < R) { nIn++; const dv = PN[i] - PV[i], ds = PS[i] - PV[i]; sN += dv * dv; sS += ds * ds; }
    }
    cx.globalAlpha = 1;
    // the lens: glass, hatch, trend and the signal points
    cx.save();
    cx.beginPath(); cx.arc(lx, ly, R, 0, Math.PI * 2); cx.fillStyle = C.glass; cx.fill(); cx.clip();
    cx.strokeStyle = C.hatch; cx.beginPath();
    for (let gx = Math.floor((lx - R) / 14) * 14; gx < lx + R; gx += 14) { cx.moveTo(gx + 0.5, ly - R); cx.lineTo(gx + 0.5, ly + R); }
    cx.stroke();
    cx.beginPath();
    for (let x = lx - R; x <= lx + R; x += 2) { const y = Y(sig(Tx(x))); x === lx - R ? cx.moveTo(x, y) : cx.lineTo(x, y); }
    cx.strokeStyle = C.sigSoft; cx.lineWidth = 6; cx.stroke(); cx.strokeStyle = C.sig; cx.lineWidth = 1.6; cx.stroke();
    cx.fillStyle = C.sig;
    for (let i = 0; i < N; i++) { const x = X(PT[i]); if (Math.abs(x - lx) > R) continue; const ys = Y(PS[i]); if (Math.hypot(x - lx, ys - ly) < R) cx.fillRect(x - 1, ys - 1, 2.1, 2.1); }
    cx.restore();
    cx.strokeStyle = C.ring; cx.lineWidth = 1;
    cx.beginPath(); cx.arc(lx, ly, R, 0, Math.PI * 2); cx.stroke();
    cx.beginPath();
    for (let a = 0; a < 4; a++) { const c = Math.cos(a * Math.PI / 2), s = Math.sin(a * Math.PI / 2); cx.moveTo(lx + c * (R - 7), ly + s * (R - 7)); cx.lineTo(lx + c * (R + 7), ly + s * (R + 7)); }
    cx.stroke();

    // readout and annotations
    if (lab) {
      const pct = sN > 0 ? Math.round(100 * (1 - Math.sqrt(sS / sN))) : 0;
      lab.innerHTML = `${fmt(Tx(lx - R))} – ${fmt(Tx(lx + R))}<br>n=${nIn} · noise <em>−${pct}%</em>`;
      const lw = lab.offsetWidth, lh = lab.offsetHeight;
      let px = lx + R * 0.74, py = ly + R * 0.74;
      if (px + lw > W) px = lx - R * 0.74 - lw;
      if (py + lh > H - pad.b) py = ly - R * 0.74 - lh;
      lab.style.transform = `translate(${Math.round(Math.max(0, px))}px,${Math.round(Math.max(0, py))}px)`;
      lab.classList.add('is-on');
    }
    const lt = Tx(lx);
    for (const a of anns) {
      const hot = Math.abs(pad.l + a.x * (W - pad.l - pad.r) - lx) < R * 0.8;
      if (hot !== a.on) { a.on = hot; a.li.classList.toggle('is-hot', hot); }
    }
    const near = anns.find((a) => a.on);
    cv.setAttribute('aria-valuenow', lt.toFixed(2));
    cv.setAttribute('aria-valuetext', fmt(lt).replace(" '", ' 20') + (near ? ': ' + near.text : ''));
  }

  // animation loop: runs while gliding or while the lens is still catching up
  let raf = 0, paused = false, onScreen = true, tabVisible = !document.hidden, ready = false;
  const auto = () => mode === 'auto' && !paused && !reduce.matches;
  const live = () => onScreen && tabVisible;
  function frame(now) {
    raf = 0;
    const dt = Math.min(64, now - (last || now)); last = now;
    if (mode !== 'auto' && idleAt && now - idleAt > 3200) { mode = 'auto'; phase = phaseFor(Tx(lx)); }
    if (auto()) { phase += dt / 30000; const u = 0.5 - 0.5 * Math.cos(phase * 2 * Math.PI); onCurve(T0 + 0.4 + u * (SPAN - 0.8), Math.sin(phase * 14) * 18); }
    const k = reduce.matches ? 1 : 1 - Math.pow(0.86, dt / 16.7);
    lx += (tx - lx) * k; ly += (ty - ly) * k;
    draw();
    if (live() && (auto() || Math.abs(tx - lx) + Math.abs(ty - ly) > 0.4)) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (ready && !raf && live()) { last = 0; raf = requestAnimationFrame(frame); } };

  // input
  const hold = () => { mode = 'user'; idleAt = performance.now(); };
  function aim(e) {
    const r = cv.getBoundingClientRect();
    tx = Math.min(W - pad.r, Math.max(pad.l, e.clientX - r.left)); ty = Math.min(H - pad.b, Math.max(pad.t - 20, e.clientY - r.top));
    hold(); kick();
  }
  cv.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' || cv.classList.contains('is-drag')) aim(e); });
  cv.addEventListener('pointerdown', (e) => { cv.classList.add('is-drag'); aim(e); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((n) => cv.addEventListener(n, () => { cv.classList.remove('is-drag'); idleAt = performance.now(); }));
  cv.addEventListener('keydown', (e) => {
    let t = Tx(tx);
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') t += 0.25;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') t -= 0.25;
    else if (e.key === 'PageUp') t += 1; else if (e.key === 'PageDown') t -= 1;
    else if (e.key === 'Home') t = T0 + 0.3; else if (e.key === 'End') t = T1 - 0.3;
    else return;
    e.preventDefault();
    onCurve(Math.min(T1 - 0.2, Math.max(T0 + 0.2, t))); hold(); kick();
  });
  cv.addEventListener('blur', () => { idleAt = performance.now(); kick(); });

  function setPaused(p) {
    paused = p;
    if (!ctrl) return;
    ctrl.setAttribute('aria-pressed', String(p));
    ctrl.querySelector('span').textContent = p ? 'Play' : 'Pause';
    const use = ctrl.querySelector('use'); if (use) use.setAttribute('href', p ? '#i-play' : '#i-pause');
    if (!p) { mode = 'auto'; phase = phaseFor(Tx(lx)); }
    kick();
  }
  if (ctrl) ctrl.addEventListener('click', () => setPaused(!paused));

  function settle() {
    if (ctrl) ctrl.hidden = reduce.matches;
    if (reduce.matches) { onCurve(PARK); lx = tx; ly = ty; draw(); } else kick();
  }

  function start() {
    readTheme(); size();
    phase = phaseFor(2024.9); onCurve(2024.9); lx = tx; ly = ty;
    ready = true; draw(); settle();
    if ('ResizeObserver' in window) {
      let w = W;
      new ResizeObserver(() => { const t = Tx(lx); size(); if (Math.abs(W - w) > 1) { w = W; } onCurve(Math.min(T1 - 0.2, Math.max(T0 + 0.2, t))); lx = tx; ly = ty; draw(); kick(); }).observe(plot);
    }
    if ('IntersectionObserver' in window) new IntersectionObserver((es) => { onScreen = es[0].isIntersecting; kick(); }).observe(plot);
  }
  document.addEventListener('visibilitychange', () => { tabVisible = !document.hidden; kick(); });
  document.addEventListener('sr:theme', () => { if (!ready) return; readTheme(); draw(); });
  reduce.addEventListener('change', () => { if (ready) settle(); });
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(start);
})();
