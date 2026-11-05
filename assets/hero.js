/* Hero data field: points stream in, assemble into a chart, then morph through four
   charts in step with the readout card. Canvas 2D, no library. Pauses off-screen, on
   hidden tabs and on request; draws a single static frame under reduced motion. */
(() => {
  'use strict';
  const canvas = document.querySelector('.hero-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const hero = canvas.closest('.hero');
  const stage = hero.querySelector('.hero-stage');
  const ctrl = hero.querySelector('.hero-ctrl');
  const readouts = Array.from(hero.querySelectorAll('.ro'));
  const roN = hero.querySelector('.ro-n');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const HOLD = 5600;

  let W = 0, H = 0, dpr = 1, box = null, N = 0;
  let X, Y, VX, VY, TX, TY, K, SEED, COL, DIM;
  let shapes = [], cur = 0, switchedAt = 0, started = 0;
  let raf = 0, paused = false, onScreen = true, tabVisible = !document.hidden;
  let palette = [], blend = 'lighter', axisColor = 'rgba(255,255,255,.14)';
  const mouse = { x: -9999, y: -9999, on: false };
  let AX = new Float32Array(0), AY = AX, AS = AX;

  const rand = mulberry32(20260611);
  function mulberry32(a) {
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const gauss = () => { let u = 0, v = 0; while (!u) u = rand(); while (!v) v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

  function readTheme() {
    const cs = getComputedStyle(document.documentElement);
    palette = ['--teal', '--violet', '--amber'].map((v) => cs.getPropertyValue(v).trim() || '#45E3C4');
    blend = cs.getPropertyValue('--particle-blend').trim() || 'lighter';
    axisColor = cs.getPropertyValue('--hair-2').trim() || axisColor;
  }

  /* ---------- Shapes: each returns {pts:[x,y,color,dim][], axes:fn} inside box ---------- */
  function bars(n, b) {
    const count = 12, hs = [], jit = [0, .05, -.03, .06, .01, -.02, .07, .02, .09, .03, .1, .12];
    for (let i = 0; i < count; i++) hs.push(Math.min(.96, .2 + .66 * Math.pow(i / (count - 1), 1.3) + jit[i] * .6));
    const slot = b.w / count, bw = slot * .6, base = b.y + b.h;
    const area = hs.reduce((s, h) => s + h, 0);
    const pts = [];
    hs.forEach((h, i) => {
      const m = Math.round(n * h / area), bx = b.x + i * slot + (slot - bw) / 2, bh = h * b.h;
      for (let j = 0; j < m && pts.length < n; j++) {
        const yy = base - rand() * bh;
        const top = (base - yy) / bh > .82;
        pts.push([bx + rand() * bw, yy, i === count - 1 ? 2 : top ? 1 : 0, rand() < .25]);
      }
    });
    while (pts.length < n) pts.push([b.x + rand() * b.w, base - rand() * 4, 0, true]);
    return { pts, axes: (c) => { c.beginPath(); c.moveTo(b.x, base + 6); c.lineTo(b.x + b.w, base + 6); c.stroke(); } };
  }
  function drop(n, b) {
    const base = b.y + b.h, pts = [];
    const f = (t) => base - b.h * (.06 + .9 * Math.exp(-4.4 * t));
    const onCurve = Math.round(n * .55);
    for (let i = 0; i < onCurve; i++) {
      const t = rand(), x = b.x + t * b.w;
      pts.push([x + gauss() * .8, f(t) + gauss() * 1.6, t > .93 ? 2 : 0, false]);
    }
    while (pts.length < n) {
      const t = rand(), x = b.x + t * b.w, top = f(t);
      const y = top + Math.pow(rand(), 1.8) * (base - top);
      pts.push([x, y, 1, true]);
    }
    return { pts, axes: (c) => { c.beginPath(); c.moveTo(b.x - 6, b.y); c.lineTo(b.x - 6, base + 6); c.lineTo(b.x + b.w, base + 6); c.stroke(); } };
  }
  function scatter(n, b) {
    const base = b.y + b.h, pts = [];
    const lineN = Math.round(n * .22);
    for (let i = 0; i < lineN; i++) {
      const t = rand();
      pts.push([b.x + t * b.w, base - b.h * (.12 + .72 * t) + gauss() * .7, 2, false]);
    }
    const centers = [[.18, .24], [.48, .5], [.8, .78]];
    while (pts.length < n) {
      const c = centers[Math.floor(rand() * centers.length)];
      const t = Math.min(1, Math.max(0, c[0] + gauss() * .1));
      const y = base - b.h * (.12 + .72 * t) + gauss() * b.h * .085;
      pts.push([b.x + t * b.w, Math.min(base, Math.max(b.y, y)), rand() < .35 ? 0 : 1, rand() < .4]);
    }
    return { pts, axes: (c) => { c.beginPath(); c.moveTo(b.x - 6, b.y); c.lineTo(b.x - 6, base + 6); c.lineTo(b.x + b.w, base + 6); c.stroke(); } };
  }
  function donut(n, b) {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2, ro = Math.min(b.w, b.h) * .48, ri = ro * .64, pts = [];
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2, r = Math.sqrt(ri * ri + rand() * (ro * ro - ri * ri));
      const share = a / (Math.PI * 2);
      const ang = a - Math.PI / 2;
      pts.push([cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, share < .3 ? 2 : share < .65 ? 0 : 1, share >= .3 && rand() < .35]);
    }
    return { pts, axes: () => {} };
  }
  const builders = [bars, drop, scatter, donut];

  /* ---------- Layout ---------- */
  function measure() {
    const hr = hero.getBoundingClientRect(), sr = stage.getBoundingClientRect();
    W = Math.max(1, hr.width); H = Math.max(1, hr.height);
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const ro = stage.querySelector('.readout');
    const reserve = ro ? ro.getBoundingClientRect().height + 28 : 0;
    const pad = Math.min(24, sr.width * .05);
    box = { x: sr.left - hr.left + pad, y: sr.top - hr.top + pad, w: sr.width - pad * 2, h: Math.max(80, sr.height - pad - reserve) };
    const am = Math.round(Math.min(220, Math.max(70, (W * H) / 7000)));
    if (AX.length !== am) {
      AX = new Float32Array(am); AY = new Float32Array(am); AS = new Float32Array(am);
      for (let i = 0; i < am; i++) { AX[i] = rand() * W; AY[i] = rand() * H; AS[i] = .15 + rand() * .5; }
    }
    const want = Math.round(Math.min(1800, Math.max(560, (W * H) / 820)));
    if (want !== N) allocate(want);
    shapes = builders.map((fn) => { const s = fn(N, box); s.pts.sort((a, c) => a[0] - c[0]); return s; });
  }
  function allocate(n) {
    const old = N; N = n;
    const grow = (a, Ctor) => { const z = new Ctor(n); if (a) z.set(a.subarray(0, Math.min(old, n))); return z; };
    X = grow(X, Float32Array); Y = grow(Y, Float32Array); VX = grow(VX, Float32Array); VY = grow(VY, Float32Array);
    TX = grow(TX, Float32Array); TY = grow(TY, Float32Array); K = grow(K, Float32Array); SEED = grow(SEED, Float32Array);
    COL = grow(COL, Uint8Array); DIM = grow(DIM, Uint8Array);
    for (let i = old; i < n; i++) {
      X[i] = -rand() * W * .7 - 20; Y[i] = rand() * H; SEED[i] = rand() * 1000; K[i] = .55 + rand() * .7;
    }
  }
  function target(idx) {
    const pts = shapes[idx].pts;
    const order = Array.from({ length: N }, (_, i) => i).sort((a, b) => X[a] - X[b]);
    for (let j = 0; j < N; j++) {
      const i = order[j], p = pts[j];
      TX[i] = p[0]; TY[i] = p[1]; COL[i] = p[2]; DIM[i] = p[3] ? 1 : 0; K[i] = .5 + rand() * .75;
    }
    cur = idx; switchedAt = performance.now();
    readouts.forEach((r, i) => r.classList.toggle('is-on', i === idx));
    if (roN) roN.textContent = `${idx + 1} / ${readouts.length}`;
  }

  /* ---------- Render ---------- */
  function draw(now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const axA = Math.min(1, Math.max(0, (now - switchedAt - 500) / 900));
    if (axA > 0) {
      ctx.globalAlpha = axA; ctx.strokeStyle = axisColor; ctx.lineWidth = 1;
      shapes[cur].axes(ctx);
      ctx.globalAlpha = 1;
    }
    if (mouse.on && blend === 'lighter') {
      const g = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 170);
      g.addColorStop(0, 'rgba(69,227,196,.10)'); g.addColorStop(1, 'rgba(69,227,196,0)');
      ctx.fillStyle = g; ctx.fillRect(mouse.x - 170, mouse.y - 170, 340, 340);
    }
    ctx.globalAlpha = .32; ctx.fillStyle = palette[1]; ctx.beginPath();
    for (let i = 0; i < AX.length; i++) ctx.rect(AX[i], AY[i], 1.4, 1.4);
    ctx.fill(); ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = blend;
    for (let c = 0; c < 3; c++) {
      for (let dim = 0; dim < 2; dim++) {
        ctx.globalAlpha = dim ? .38 : .92;
        ctx.fillStyle = palette[c];
        ctx.beginPath();
        for (let i = 0; i < N; i++) {
          if (COL[i] !== c || DIM[i] !== dim) continue;
          const s = dim ? 1.7 : 2.3;
          ctx.rect(X[i] - s / 2, Y[i] - s / 2, s, s);
        }
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  function step(now) {
    const ramp = Math.min(1, (now - started) / 1600);
    const k = .012 + .05 * ramp, damp = .8;
    for (let i = 0; i < AX.length; i++) { AX[i] += AS[i] * .35; AY[i] -= AS[i] * .08; if (AX[i] > W) AX[i] = 0; if (AY[i] < 0) AY[i] = H; }
    const R = 120, R2 = R * R, tt = now * .0012;
    for (let i = 0; i < N; i++) {
      const jx = Math.sin(tt + SEED[i]) * 1.1, jy = Math.cos(tt * .9 + SEED[i] * 1.3) * 1.1;
      let ax = (TX[i] + jx - X[i]) * k * K[i], ay = (TY[i] + jy - Y[i]) * k * K[i];
      if (mouse.on) {
        const dx = X[i] - mouse.x, dy = Y[i] - mouse.y, d2 = dx * dx + dy * dy;
        if (d2 < R2 && d2 > .01) { const d = Math.sqrt(d2), f = (1 - d / R) * 3.2; ax += dx / d * f; ay += dy / d * f; }
      }
      VX[i] = (VX[i] + ax) * damp; VY[i] = (VY[i] + ay) * damp;
      X[i] += VX[i]; Y[i] += VY[i];
    }
  }
  let lastT = 0;
  function loop(now) {
    raf = 0;
    if (!running()) { lastT = 0; return; }
    if (now - switchedAt > HOLD) target((cur + 1) % shapes.length);
    // Fixed 60 Hz physics steps, so slow or throttled frames still converge on time.
    const steps = lastT ? Math.min(6, Math.max(1, Math.round((now - lastT) / 16.67))) : 1;
    lastT = now;
    for (let s = 0; s < steps; s++) step(now);
    draw(now);
    raf = requestAnimationFrame(loop);
  }
  const running = () => !paused && onScreen && tabVisible && !reduce.matches;
  function kick() { if (ready && !raf && running()) raf = requestAnimationFrame(loop); }

  function staticFrame() {
    target(0);
    for (let i = 0; i < N; i++) { X[i] = TX[i]; Y[i] = TY[i]; }
    switchedAt = -1e6; draw(performance.now());
  }

  /* ---------- Wiring ---------- */
  function init() {
    readTheme(); measure();
    started = performance.now(); ready = true;
    if (reduce.matches) { staticFrame(); return; }
    target(0); kick();
    if (ctrl) ctrl.hidden = false;
  }
  if (ctrl) ctrl.addEventListener('click', () => {
    paused = !paused;
    ctrl.setAttribute('aria-pressed', String(paused));
    ctrl.setAttribute('aria-label', paused ? 'Play background animation' : 'Pause background animation');
    const use = ctrl.querySelector('use');
    if (use) use.setAttribute('href', paused ? '#i-play' : '#i-pause');
    if (!paused) { switchedAt = performance.now(); kick(); }
  });
  hero.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const r = hero.getBoundingClientRect();
    mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.on = true;
  }, { passive: true });
  hero.addEventListener('pointerleave', () => { mouse.on = false; });
  new IntersectionObserver((en) => { onScreen = en[0].isIntersecting; kick(); }).observe(hero);
  document.addEventListener('visibilitychange', () => { tabVisible = !document.hidden; kick(); });
  document.addEventListener('sr:theme', () => { readTheme(); if (ready && !running()) draw(performance.now()); });
  reduce.addEventListener('change', () => {
    if (!ready) return;
    if (reduce.matches) { if (ctrl) ctrl.hidden = true; staticFrame(); } else { if (ctrl) ctrl.hidden = false; kick(); }
  });
  let rz = 0, ready = false;
  new ResizeObserver(() => {
    if (!ready) return;
    clearTimeout(rz);
    rz = setTimeout(() => {
      measure(); target(cur);
      if (!running()) { for (let i = 0; i < N; i++) { X[i] = TX[i]; Y[i] = TY[i]; } draw(performance.now()); }
    }, 120);
  }).observe(hero);

  const start = () => requestAnimationFrame(() => setTimeout(init, 0));
  if (document.readyState === 'complete') start(); else addEventListener('load', start, { once: true });
})();
