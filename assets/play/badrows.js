/* Bad Row Patrol: rows ride a conveyor toward the warehouse. Reject the bad ones (NULLs, duplicates,
   impossible dates, negative or absurd quantities) and let clean rows through. 45 seconds.
   Mouse/touch: click a bad row. Keyboard (focus the belt): X rejects the front row, P or Space passes it.
   Reduced motion: the belt stops and rows wait in a queue; every decision advances it. */
(() => {
  'use strict';
  const SR = window.SR || (window.SR = {});
  SR.games = SR.games || {};
  const TIME = 45, LANES = 3;
  const REGIONS = ['NJ', 'NY', 'PA', 'CT'];
  const WHY = { null: 'NULL date', dupe: 'duplicate row', date: 'impossible date', neg: 'negative qty', out: 'outlier ×50' };

  function mount(root, api) {
    const still = !api.motionOK();
    root.innerHTML = `
      <div class="gm">
        <div class="gm-top">
          <div><p class="gm-k">45 seconds · simulated work-order feed</p><h3 class="gm-h">Bad Row <em>Patrol</em></h3></div>
          <dl class="gm-hud"><div><dt>Time</dt><dd data-t>${TIME}</dd></div><div><dt>Score</dt><dd class="sig" data-s>0</dd></div><div><dt>Data quality</dt><dd data-q>100%</dd></div><div><dt>Streak</dt><dd data-k>0</dd></div></dl>
        </div>
        <div class="gm-body">
          <div class="br-arena" tabindex="0" role="application" aria-label="Conveyor of data rows" aria-describedby="br-help"><i class="br-time" aria-hidden="true"></i><div class="br-gate" aria-hidden="true"><span>Warehouse</span></div></div>
          <p class="br-legend" aria-hidden="true"><span>Reject: <b>NULL</b> fields · <b>duplicate</b> rows (keep the first copy) · <b>impossible dates</b> · <b>negative</b> or <b>×50</b> quantities</span><span>Let clean rows reach the warehouse</span></p>
          <p class="gm-live" aria-live="polite" data-live></p>
        </div>
        <div class="gm-bar">
          <p class="gm-help" id="br-help">${still ? 'Rows wait in a queue. ' : ''}Click a bad row to reject it. Keyboard: focus the belt, then <kbd>X</kbd> rejects the outlined row and <kbd>P</kbd> or <kbd>Space</kbd> passes it.</p>
          <div class="gm-actions"><button class="btn btn-primary" type="button" data-go>Start the belt<span class="bi">→</span></button></div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const arena = $('.br-arena'), gate = $('.br-gate'), bar = $('.br-time'), live = $('[data-live]'), go = $('[data-go]');
    const hud = { t: $('[data-t]'), s: $('[data-s]'), q: $('[data-q]'), k: $('[data-k]') };

    let rows = [], running = false, raf = 0, last = 0, elapsed = 0, spawnIn = 0, nextId = 2041;
    let score = 0, quality = 100, streak = 0, caught = 0, missed = 0, wrong = 0, passed = 0;
    let AW = 0, AH = 0, GW = 84, RW = 280, RH = 44, front = null;
    let seed = 1 + Math.floor(Math.random() * 1e6);
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    const pad = (n) => String(n).padStart(2, '0');

    function measure() {
      const r = arena.getBoundingClientRect();
      AW = r.width; AH = r.height; GW = gate.offsetWidth || 84;
      RW = AW < 520 ? 196 : 280; RH = AW < 520 ? 40 : 44;
    }
    function makeRow() {
      const id = nextId++;
      const d = { id, date: `2025-${pad(1 + Math.floor(rnd() * 12))}-${pad(1 + Math.floor(rnd() * 28))}`, qty: String(12 + Math.floor(rnd() * 280)), reg: pick(REGIONS), bad: '' };
      if (rnd() < 0.36) {
        const kinds = ['null', 'date', 'neg', 'out'];
        const clean = rows.filter((r) => !r.bad && !r.gone);
        if (clean.length) kinds.push('dupe', 'dupe');
        const k = pick(kinds);
        d.bad = k;
        if (k === 'null') { if (rnd() < 0.5) d.date = 'NULL'; else d.qty = 'NULL'; }
        else if (k === 'date') d.date = pick(['2025-13-40', '2025-02-30', '2025-00-17', '2025-06-31']);
        else if (k === 'neg') d.qty = '−' + (3 + Math.floor(rnd() * 60));
        else if (k === 'out') d.qty = (Math.round(+d.qty * 50)).toLocaleString('en-US');
        else if (k === 'dupe') { const c = pick(clean); d.id = c.id; d.date = c.date; d.qty = c.qty; d.reg = c.reg; nextId--; }
      }
      return d;
    }
    function addRow(lane) {
      const d = makeRow();
      const el = document.createElement('button');
      el.type = 'button'; el.className = 'br-row'; el.tabIndex = -1;
      if (d.bad) el.dataset.bad = d.bad;
      el.innerHTML = `<span class="c-id">#${d.id}</span><span>${d.date}</span><span>${d.qty}</span><span class="c-r">${d.reg}</span>`;
      el.setAttribute('aria-label', `Row ${d.id}, date ${d.date}, quantity ${d.qty}, ${d.reg}`);
      const r = Object.assign(d, { el, lane, x: -RW - 8, y: 0, gone: false });
      el.addEventListener('click', () => decide(r, 'reject'));
      arena.appendChild(el);
      rows.push(r);
      return r;
    }
    function tag(r, text, ok) {
      const t = document.createElement('span');
      t.className = 'br-tag' + (ok ? ' is-ok' : '');
      t.textContent = text;
      t.style.left = Math.max(4, Math.min(AW - 130, r.x + 10)) + 'px';
      t.style.top = Math.max(4, r.y - 18) + 'px';
      arena.appendChild(t);
      setTimeout(() => t.remove(), 950);
    }
    function remove(r, cls) {
      r.gone = true; r.el.classList.add('is-gone');
      if (cls) r.el.classList.add(cls);
      setTimeout(() => r.el.remove(), cls ? 260 : 0);
      rows = rows.filter((x) => x !== r);
    }
    function flashGate() { gate.classList.remove('is-hit'); void gate.offsetWidth; gate.classList.add('is-hit'); }
    function decide(r, how) {
      if (!running || r.gone) return;
      if (how === 'reject') {
        if (r.bad) { streak++; caught++; score += 100 + 10 * (streak - 1); tag(r, `✓ ${WHY[r.bad]}`, false); remove(r, 'is-good-hit'); }
        else { streak = 0; wrong++; score = Math.max(0, score - 50); quality = Math.max(0, quality - 2); tag(r, 'clean row, −50', true); r.el.classList.remove('is-bad-hit'); void r.el.offsetWidth; r.el.classList.add('is-bad-hit'); if (still) remove(r); }
      } else {
        land(r);
      }
      if (still) layout();
      hudUpdate();
    }
    function land(r) {
      if (r.bad) { missed++; streak = 0; quality = Math.max(0, quality - 4); tag(r, `missed ${WHY[r.bad]}`, false); flashGate(); }
      else { passed++; score += 10; }
      remove(r);
    }
    function hudUpdate() {
      hud.t.textContent = Math.max(0, Math.ceil(TIME - elapsed));
      hud.s.textContent = score.toLocaleString('en-US');
      hud.q.textContent = quality + '%';
      hud.k.textContent = streak;
      bar.style.transform = `scaleX(${Math.max(0, 1 - elapsed / TIME)})`;
    }
    function markFront() {
      let f = null;
      for (const r of rows) if (!r.gone && (!f || (still ? r.slot < f.slot : r.x > f.x))) f = r;
      if (f !== front) {
        if (front) front.el.classList.remove('is-front');
        front = f;
        if (front) {
          front.el.classList.add('is-front');
          if (document.activeElement === arena) live.textContent = `Inspecting row ${front.id}: date ${front.date}, quantity ${front.qty}, ${front.reg}`;
        }
      }
    }
    function layout() {
      // reduced motion: a still queue, front row at the top
      const q = rows.filter((r) => !r.gone);
      q.forEach((r, i) => { r.slot = i; r.x = AW - GW - RW - 18; r.y = 14 + i * (RH + 10); r.el.style.transform = `translate(${r.x}px,${r.y}px)`; });
      while (running && rows.length < Math.max(3, Math.floor((AH - 20) / (RH + 10)))) { const r = addRow(0); r.slot = rows.length - 1; layout(); return; }
      markFront();
    }
    function laneY(l) { const h = AH / LANES; return h * l + (h - RH) / 2; }
    function frame(now) {
      raf = 0;
      if (!running) return;
      const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
      if (!document.hidden) elapsed += dt;
      if (!still) {
        const p = Math.min(1, elapsed / TIME);
        const v = (AW < 520 ? 46 : 70) + (AW < 520 ? 60 : 95) * p;
        spawnIn -= dt;
        if (spawnIn <= 0) {
          const lanes = [0, 1, 2].filter((l) => !rows.some((r) => r.lane === l && r.x < 24));
          if (lanes.length) { const r = addRow(pick(lanes)); r.y = laneY(r.lane); }
          spawnIn = 1.15 - 0.62 * p + rnd() * 0.3;
        }
        for (const r of rows.slice()) {
          if (r.gone) continue;
          r.x += v * dt;
          r.el.style.transform = `translate(${r.x.toFixed(1)}px,${r.y.toFixed(1)}px)`;
          if (r.x + RW >= AW - GW) land(r);
        }
        markFront();
      }
      hudUpdate();
      if (elapsed >= TIME) { end(); return; }
      raf = requestAnimationFrame(frame);
    }
    function start() {
      rows.forEach((r) => r.el.remove());
      rows = []; front = null; elapsed = 0; spawnIn = 0; score = 0; quality = 100; streak = 0; caught = 0; missed = 0; wrong = 0; passed = 0; nextId = 2041;
      const old = root.querySelector('.gm-res'); if (old) old.remove();
      measure(); running = true; last = 0;
      go.disabled = true; go.firstChild.textContent = 'Belt running';
      if (still) layout();
      hudUpdate();
      arena.focus({ preventScroll: true });
      api.announce('Belt started. 45 seconds.');
      raf = requestAnimationFrame(frame);
    }
    function end() {
      running = false; cancelAnimationFrame(raf); raf = 0;
      rows.forEach((r) => r.el.remove()); rows = []; front = null;
      go.disabled = false; go.firstChild.textContent = 'Run it again';
      const clicks = caught + wrong;
      const acc = clicks ? Math.round(100 * caught / clicks) : 0;
      const best = api.saveBest('badrows', score, score.toLocaleString('en-US'), false);
      const res = document.createElement('div');
      res.className = 'gm-res';
      res.innerHTML = `<div class="gm-res-in" role="dialog" aria-modal="false" aria-labelledby="br-res-h">
        <p class="gm-res-k" id="br-res-h">Final score</p>
        <p class="gm-res-big">${score.toLocaleString('en-US')}</p>
        ${best ? '<p class="gm-res-new">New personal best</p>' : ''}
        <p class="gm-res-p">You caught <b>${caught}</b> bad rows and let <b>${missed}</b> slip into the warehouse, with <b>${acc}%</b> accuracy and <b>${quality}%</b> data quality at the end. In real pipelines these checks run as tests on every load, so nobody has to play this at 2 a.m.</p>
        <div class="gm-actions"><button class="btn btn-primary" type="button" data-again>Play again<span class="bi">→</span></button></div></div>`;
      $('.gm-body').appendChild(res);
      api.announce(`Time. Score ${score}. Caught ${caught}, missed ${missed}, data quality ${quality} percent.`);
      const again = res.querySelector('[data-again]');
      again.addEventListener('click', start);
      again.focus();
    }
    go.addEventListener('click', start);
    arena.addEventListener('keydown', (e) => {
      if (!running) { if (e.key === 'Enter') { e.preventDefault(); start(); } return; }
      const k = e.key.toLowerCase();
      if (!front) return;
      if (k === 'x' || k === 'delete' || k === 'backspace') { e.preventDefault(); decide(front, 'reject'); }
      else if (k === 'p' || k === ' ' || k === 'enter') { e.preventDefault(); decide(front, 'pass'); }
      markFront();
    });
    arena.addEventListener('focus', () => { if (front) live.textContent = `Inspecting row ${front.id}: date ${front.date}, quantity ${front.qty}, ${front.reg}`; });
    const onResize = () => { measure(); if (still) layout(); else rows.forEach((r) => { r.y = laneY(r.lane); }); };
    addEventListener('resize', onResize);
    measure();
    SR.games.badrows.unmount = () => { running = false; cancelAnimationFrame(raf); removeEventListener('resize', onResize); root.innerHTML = ''; };
  }

  SR.games.badrows = { mount };
})();
