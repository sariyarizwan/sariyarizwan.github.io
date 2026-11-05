/* Forecast it: draw the next 16 weeks of a seasonal series, then compare against the actual numbers
   and an additive Holt-Winters model. Pointer drag or keyboard (←/→ week, ↑/↓ value, Enter reveals). */
(() => {
  'use strict';
  const SR = window.SR || (window.SR = {});
  SR.games = SR.games || {};
  const NS = 'http://www.w3.org/2000/svg';
  const WEEKS = 52, SHOW = 36, M = 13, ROUNDS = 3;
  const SETS = [
    { name: 'Fleet work orders per week', unit: 'orders', base: 180, trend: 1.1, amp: 34, noise: 8 },
    { name: 'Support calls per week', unit: 'calls', base: 640, trend: -2.4, amp: 92, noise: 24 },
    { name: 'Lab samples per week', unit: 'samples', base: 400, trend: 3.6, amp: 58, noise: 17 },
  ];
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const pct = (n) => n.toFixed(1) + '%';

  function makeSeries(set, seed) {
    let s = seed;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    const ph = rnd() * M;
    const out = [];
    for (let w = 0; w < WEEKS; w++) {
      const season = Math.sin(2 * Math.PI * (w + ph) / M) + 0.35 * Math.sin(4 * Math.PI * (w + ph) / M);
      out.push(Math.max(5, set.base + set.trend * w + set.amp * season + set.noise * gauss()));
    }
    return out;
  }
  // additive Holt-Winters, fitted on the visible history
  function holtWinters(y, m, h) {
    const a = 0.35, b = 0.08, g = 0.3;
    const mean = (arr) => arr.reduce((p, c) => p + c, 0) / arr.length;
    let L = mean(y.slice(0, m));
    let T = (mean(y.slice(m, 2 * m)) - L) / m;
    const S = y.slice(0, m).map((v) => v - L);
    for (let t = m; t < y.length; t++) {
      const Lp = L, Tp = T;
      L = a * (y[t] - S[t - m]) + (1 - a) * (Lp + Tp);
      T = b * (L - Lp) + (1 - b) * Tp;
      S[t] = g * (y[t] - L) + (1 - g) * S[t - m];
    }
    const f = [];
    for (let k = 1; k <= h; k++) f.push(L + k * T + S[y.length - m + ((k - 1) % m)]);
    return f;
  }
  const mape = (guess, act) => 100 * guess.reduce((s, g, i) => s + Math.abs(g - act[i]) / act[i], 0) / act.length;

  function mount(root, api) {
    let round = 0, scores = [], series = [], model = [], guess = [], revealed = false, kw = SHOW;
    let W = 640, H = 340, lo = 0, hi = 1, drawing = false, lastW = -1;
    const P = { l: 46, r: 14, t: 18, b: 30 };
    const seed0 = 1 + Math.floor(Math.random() * 1e6);

    root.innerHTML = `
      <div class="gm">
        <div class="gm-top">
          <div><p class="gm-k" data-k></p><h3 class="gm-h">Forecast <em>it</em></h3></div>
          <dl class="gm-hud"><div><dt>Round</dt><dd data-round>1 / ${ROUNDS}</dd></div><div><dt>Your error</dt><dd data-you>–</dd></div><div><dt>Model error</dt><dd class="sig" data-model>–</dd></div></dl>
        </div>
        <div class="gm-body">
          <div class="fc-wrap"><svg class="fc-svg" role="application" tabindex="0" aria-label="Forecast drawing area" aria-describedby="fc-help"></svg>
            <p class="fc-hint" aria-hidden="true"><b>Draw here →</b><br>drag across the shaded weeks</p></div>
          <p class="fc-key" aria-hidden="true"><span><i></i>history</span><span><i class="k-u"></i>your forecast</span><span><i class="k-a"></i>actual</span><span><i class="k-m"></i>model</span></p>
          <p class="gm-live" aria-live="polite" data-live></p>
        </div>
        <div class="gm-bar">
          <p class="gm-help" id="fc-help">Drag across the shaded weeks to draw your forecast. Keyboard: <kbd>←</kbd> <kbd>→</kbd> pick a week, <kbd>↑</kbd> <kbd>↓</kbd> set its value (hold <kbd>Shift</kbd> for bigger steps), <kbd>Enter</kbd> to reveal.</p>
          <div class="gm-actions"><button class="btn" type="button" data-clear>Clear</button><button class="btn btn-primary" type="button" data-go>Reveal the actuals<span class="bi">→</span></button></div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const svg = $('.fc-svg'), wrap = $('.fc-wrap'), hint = $('.fc-hint'), live = $('[data-live]'), go = $('[data-go]'), clear = $('[data-clear]');

    const X = (w) => P.l + (w / (WEEKS - 1)) * (W - P.l - P.r);
    const Y = (v) => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b);
    const wOf = (x) => Math.round(((x - P.l) / (W - P.l - P.r)) * (WEEKS - 1));
    const vOf = (y) => lo + (1 - (y - P.t) / (H - P.t - P.b)) * (hi - lo);
    const el = (tag, at, par) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); (par || svg).appendChild(e); return e; };
    const path = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
    let userPath = null, dotsG = null, curG = null;

    function filled() {
      const out = [];
      let prevW = SHOW - 1, prevV = series[SHOW - 1];
      for (let w = SHOW; w < WEEKS; w++) {
        if (guess[w] != null) { out.push(guess[w]); prevW = w; prevV = guess[w]; continue; }
        let nw = -1;
        for (let j = w + 1; j < WEEKS; j++) if (guess[j] != null) { nw = j; break; }
        out.push(nw < 0 ? prevV : prevV + (guess[nw] - prevV) * (w - prevW) / (nw - prevW));
      }
      return out;
    }
    function drawUser() {
      const has = guess.some((v) => v != null);
      const f = filled();
      const pts = [[X(SHOW - 1), Y(series[SHOW - 1])]].concat(f.map((v, i) => [X(SHOW + i), Y(v)]));
      userPath.setAttribute('d', has || revealed ? path(pts) : '');
      dotsG.innerHTML = '';
      guess.forEach((v, w) => { if (v != null && !revealed) el('circle', { cx: X(w), cy: Y(v), r: 2.6, class: 'fc-dot' }, dotsG); });
      curG.innerHTML = '';
      if (document.activeElement === svg && !revealed) {
        const v = guess[kw] != null ? guess[kw] : f[kw - SHOW];
        el('line', { x1: X(kw), x2: X(kw), y1: P.t, y2: H - P.b, class: 'fc-cur-line' }, curG);
        el('circle', { cx: X(kw), cy: Y(v), r: 4.5, class: 'fc-cur' }, curG);
      }
      hint.classList.toggle('is-off', has || revealed);
    }
    function render() {
      const r = wrap.getBoundingClientRect();
      W = Math.max(300, r.width); H = Math.max(260, r.height);
      P.l = W < 480 ? 38 : 46;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.innerHTML = '';
      el('rect', { x: X(SHOW - 0.5), y: P.t, width: X(WEEKS - 1) - X(SHOW - 0.5) + 6, height: H - P.t - P.b, class: 'fc-zone' });
      for (let i = 0; i <= 4; i++) {
        const v = lo + (hi - lo) * i / 4, y = Y(v);
        el('line', { x1: P.l, x2: W - P.r, y1: y, y2: y, class: 'fc-grid' });
        const t = el('text', { x: P.l - 8, y: y + 3.5, 'text-anchor': 'end' }); t.textContent = fmt(v);
      }
      el('line', { x1: P.l, x2: W - P.r, y1: H - P.b, y2: H - P.b, class: 'fc-axis' });
      for (let w = 0; w < WEEKS; w += 13) { const t = el('text', { x: X(w), y: H - P.b + 18, 'text-anchor': w ? 'middle' : 'start' }); t.textContent = 'wk ' + (w + 1); }
      el('line', { x1: X(SHOW - 0.5), x2: X(SHOW - 0.5), y1: P.t - 6, y2: H - P.b, class: 'fc-zone-edge' });
      const tl = el('text', { x: X(SHOW - 0.5) + 6, y: P.t + 4, class: 'fc-lab' }); tl.textContent = 'Today';
      el('path', { d: path(series.slice(0, SHOW).map((v, w) => [X(w), Y(v)])), class: 'fc-hist' });
      if (revealed) {
        const f = filled();
        const act = series.slice(SHOW - 1).map((v, i) => [X(SHOW - 1 + i), Y(v)]);
        const gap = act.concat(f.map((v, i) => [X(SHOW + i), Y(v)]).reverse());
        el('path', { d: path(gap) + 'Z', class: 'fc-gap' });
        el('path', { d: path([[X(SHOW - 1), Y(series[SHOW - 1])]].concat(model.map((v, i) => [X(SHOW + i), Y(v)]))), class: 'fc-mod fc-draw is-pre', pathLength: 1 });
        el('path', { d: path(act), class: 'fc-act fc-draw is-pre', pathLength: 1 });
        requestAnimationFrame(() => requestAnimationFrame(() => svg.querySelectorAll('.is-pre').forEach((p) => p.classList.remove('is-pre'))));
      }
      userPath = el('path', { class: 'fc-user' });
      dotsG = el('g', {}); curG = el('g', {});
      drawUser();
    }
    function startRound() {
      const set = SETS[round % SETS.length];
      series = makeSeries(set, seed0 + round * 7919);
      model = holtWinters(series.slice(0, SHOW), M, WEEKS - SHOW);
      const h = series.slice(0, SHOW), mn = Math.min(...h), mx = Math.max(...h), span = mx - mn;
      lo = Math.max(0, mn - span * 0.45); hi = mx + span * 0.55;
      guess = []; revealed = false; kw = SHOW;
      $('[data-k]').textContent = `Round ${round + 1} of ${ROUNDS} · ${set.name} · simulated`;
      $('[data-round]').textContent = `${round + 1} / ${ROUNDS}`;
      $('[data-you]').textContent = '–'; $('[data-model]').textContent = '–';
      go.innerHTML = 'Reveal the actuals<span class="bi">→</span>'; clear.disabled = false;
      live.textContent = '';
      render();
    }
    function reveal() {
      if (revealed) return;
      revealed = true;
      const act = series.slice(SHOW), you = mape(filled(), act), mod = mape(model, act);
      scores.push({ you, mod });
      $('[data-you]').textContent = pct(you); $('[data-model]').textContent = pct(mod);
      const verdict = you < mod ? 'You beat the model.' : you < mod * 1.5 ? 'Close. The model edges it.' : 'The model wins this round. The pattern repeats every 13 weeks.';
      live.innerHTML = `Your error <b>${pct(you)}</b> · model ${pct(mod)}. ${verdict}`;
      api.announce(`Your error ${pct(you)}, model ${pct(mod)}. ${verdict}`);
      clear.disabled = true;
      go.innerHTML = (round + 1 < ROUNDS ? 'Next round' : 'See the results') + '<span class="bi">→</span>';
      render();
    }
    function finish() {
      const avg = scores.reduce((s, x) => s + x.you, 0) / scores.length;
      const mAvg = scores.reduce((s, x) => s + x.mod, 0) / scores.length;
      const wins = scores.filter((x) => x.you < x.mod).length;
      const best = api.saveBest('forecast', +avg.toFixed(1), pct(avg), true);
      const res = document.createElement('div');
      res.className = 'gm-res';
      res.innerHTML = `<div class="gm-res-in" role="dialog" aria-modal="false" aria-labelledby="fc-res-h">
        <p class="gm-res-k" id="fc-res-h">Average forecast error</p>
        <p class="gm-res-big">${pct(avg)}</p>
        ${best ? '<p class="gm-res-new">New personal best</p>' : ''}
        <p class="gm-res-p">The model averaged <b>${pct(mAvg)}</b>, and you beat it in <b>${wins} of ${ROUNDS}</b> rounds. Real forecasting adds holidays, promotions and a lot of checking. The Fleet Forecaster in my work section does this for a 10-year plan.</p>
        <div class="gm-actions"><button class="btn btn-primary" type="button" data-again>Play again<span class="bi">→</span></button><a class="btn" href="#cs-fleet">See Fleet Forecaster</a></div></div>`;
      $('.gm-body').appendChild(res);
      api.announce(`Average error ${pct(avg)}. Model ${pct(mAvg)}. You beat it in ${wins} of ${ROUNDS} rounds.`);
      const again = res.querySelector('[data-again]');
      again.addEventListener('click', () => { res.remove(); round = 0; scores = []; startRound(); svg.focus(); });
      again.focus();
    }
    function onGo() {
      if (!revealed) reveal();
      else if (round + 1 < ROUNDS) { round++; startRound(); svg.focus(); }
      else finish();
    }
    function setAt(clientX, clientY) {
      const r = svg.getBoundingClientRect();
      const x = (clientX - r.left) * (W / r.width), y = (clientY - r.top) * (H / r.height);
      const w = Math.min(WEEKS - 1, Math.max(SHOW, wOf(x)));
      const v = Math.min(hi, Math.max(lo, vOf(y)));
      if (lastW >= SHOW && lastW !== w) {
        const a = Math.min(lastW, w), b = Math.max(lastW, w), va = lastW < w ? guess[lastW] : v, vb = lastW < w ? v : guess[lastW];
        for (let k = a + 1; k < b; k++) guess[k] = va + (vb - va) * (k - a) / (b - a);
      }
      guess[w] = v; lastW = w; kw = w;
      drawUser();
    }
    svg.addEventListener('pointerdown', (e) => { if (revealed) return; drawing = true; lastW = -1; svg.setPointerCapture(e.pointerId); setAt(e.clientX, e.clientY); });
    svg.addEventListener('pointermove', (e) => { if (drawing) setAt(e.clientX, e.clientY); });
    const stop = () => { drawing = false; lastW = -1; };
    svg.addEventListener('pointerup', stop); svg.addEventListener('pointercancel', stop);
    svg.addEventListener('focus', drawUser); svg.addEventListener('blur', drawUser);
    svg.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); onGo(); return; }
      if (revealed) return;
      const step = (hi - lo) / (e.shiftKey ? 10 : 40);
      const cur = () => (guess[kw] != null ? guess[kw] : filled()[kw - SHOW]);
      if (e.key === 'ArrowRight') { const v = cur(); kw = Math.min(WEEKS - 1, kw + 1); if (guess[kw] == null) guess[kw] = v; }
      else if (e.key === 'ArrowLeft') kw = Math.max(SHOW, kw - 1);
      else if (e.key === 'ArrowUp') guess[kw] = Math.min(hi, cur() + step);
      else if (e.key === 'ArrowDown') guess[kw] = Math.max(lo, cur() - step);
      else if (e.key === 'Home') kw = SHOW;
      else if (e.key === 'End') kw = WEEKS - 1;
      else return;
      e.preventDefault();
      drawUser();
      live.textContent = `Week ${kw + 1}: ${fmt(cur())} ${SETS[round % SETS.length].unit}`;
    });
    go.addEventListener('click', onGo);
    clear.addEventListener('click', () => { guess = []; drawUser(); svg.focus(); });
    let rt = 0;
    const ro = 'ResizeObserver' in window ? new ResizeObserver(() => { cancelAnimationFrame(rt); rt = requestAnimationFrame(render); }) : null;
    if (ro) ro.observe(wrap);
    startRound();
    svg.focus({ preventScroll: true });
    SR.games.forecast.unmount = () => { if (ro) ro.disconnect(); root.innerHTML = ''; };
  }

  SR.games.forecast = { mount };
})();
