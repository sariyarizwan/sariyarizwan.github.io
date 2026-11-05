/* Chart Doctor: four misleading charts, three real faults each plus two decoys.
   Pick the faults from the checklist (or click the guilty part of the chart); every correct diagnosis
   redraws the chart without that fault. Grade by wrong picks across all four. */
(() => {
  'use strict';
  const SR = window.SR || (window.SR = {});
  SR.games = SR.games || {};

  const FAULTS = {
    truncated: ['The value axis does not start at zero', 'It starts at zero now, so a 10% rise looks like a 10% rise.'],
    rainbow: ['Every bar has its own colour', 'One colour for the series; only the latest value is highlighted.'],
    fake3d: ['The 3D effect distorts the heights', 'Flat bars: the height is the value and nothing else.'],
    pie3d: ['The tilted 3D pie makes front slices look bigger', 'Flat pie, so each angle matches its share.'],
    slices: ['Nine slices, most too thin to compare', 'The five smallest vendors are grouped into Other.'],
    legend: ['You have to match colours to a legend', 'Labels sit on the slices, no legend lookups.'],
    dual: ['Two y-axes with unrelated scales fake a correlation', 'Two panels on one time axis: signups grew 20%, revenue doubled.'],
    units: ['No axis titles or units', 'Each panel says what it measures and in which unit.'],
    cumul: ['The title says monthly, but it plots a running total', 'Monthly values now, so the summer dip is visible.'],
    shuffle: ['The months are out of order', 'Months back in calendar order.'],
  };
  const DECOYS = {
    colours: ['It needs more colours to stand out', 'Not a fault: colour should carry meaning, and more of it carries less.'],
    pie: ['It should be a pie chart', 'Not a fault: pies are the weakest way to compare values over time.'],
    few: ['Too few data points to chart', 'Not a fault: six quarters is plenty for a trend.'],
    title: ['The title is too long', 'Not a fault: the title was fine; the encoding was the problem.'],
    grid: ['Gridlines should be removed entirely', 'Not a fault: light gridlines help people read values.'],
    bold: ['It should be 3D for emphasis', 'Not a fault: 3D adds distortion, never emphasis.'],
    sort: ['Slices should be in alphabetical order', 'Not a fault: sorting by size, as it is, reads best.'],
    font: ['The numbers need a bigger font', 'Not a fault: the type was readable; the scale was misleading.'],
  };
  const PATIENTS = [
    { t: 'Quarterly revenue', s: '$K · Q1 2024 to Q2 2025', kind: 'bar', faults: ['truncated', 'rainbow', 'fake3d'], decoys: ['colours', 'pie'],
      labels: ["Q1 '24", 'Q2', 'Q3', 'Q4', "Q1 '25", 'Q2'], values: [820, 846, 851, 866, 884, 902] },
    { t: 'Market share by vendor', s: '% of contracts · 2025', kind: 'pie', faults: ['pie3d', 'slices', 'legend'], decoys: ['sort', 'title'],
      labels: ['Northwind', 'Contoso', 'Fabrikam', 'Litware', 'Tailspin', 'Adatum', 'Proseware', 'Lucerne', 'Wingtip'], values: [34, 22, 16, 9, 7, 5, 3, 2, 2] },
    { t: 'Signups and revenue', s: 'Jan to Dec 2025', kind: 'dual', faults: ['dual', 'units', 'truncated'], decoys: ['grid', 'few'],
      labels: ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'], a: [1210, 1225, 1240, 1236, 1262, 1280, 1290, 1318, 1335, 1350, 1390, 1452], b: [41, 44, 47, 46, 52, 56, 58, 63, 67, 71, 80, 92] },
    { t: 'Support tickets per month', s: '2025', kind: 'col', faults: ['cumul', 'shuffle', 'rainbow'], decoys: ['bold', 'font'],
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], values: [310, 296, 332, 340, 301, 262, 238, 229, 251, 284, 303, 322], order: [3, 0, 7, 1, 10, 5, 2, 9, 4, 11, 6, 8] },
  ];
  const RAINBOW = ['#E8453C', '#F39C12', '#F4D03F', '#2ECC71', '#3498DB', '#9B59B6', '#E91E63', '#1ABC9C', '#FF7F50', '#8E44AD', '#16A085', '#D35400'];
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

  // ---------- renderers: return SVG markup for a patient given the faults still present ----------
  let VW = 520;
  const VH = 300, P = { l: 48, r: 14, t: 16, b: 34 };
  function axisTicks(lo, hi, n) { const out = []; for (let i = 0; i <= n; i++) out.push(lo + (hi - lo) * i / n); return out; }
  function bars(p, on) {
    let labels = p.labels.slice(), values = p.values.slice();
    if (p.kind === 'col' && on.cumul) { let s = 0; values = values.map((v) => (s += v)); }
    if (p.kind === 'col' && on.shuffle) { labels = p.order.map((i) => p.labels[i]); values = p.order.map((i) => values[i]); }
    const max = Math.max(...values);
    const lo = on.truncated ? Math.floor(Math.min(...values) * 0.97 / 10) * 10 : 0;
    const hi = Math.ceil(max * 1.08 / 50) * 50;
    const Y = (v) => P.t + (1 - (v - lo) / (hi - lo)) * (VH - P.t - P.b);
    const n = values.length, slot = (VW - P.l - P.r) / n, bw = slot * (n > 8 ? 0.62 : 0.56);
    let g = '';
    axisTicks(lo, hi, 4).forEach((v) => { g += `<line class="cd-gr" x1="${P.l}" x2="${VW - P.r}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${P.l - 8}" y="${Y(v) + 4}" text-anchor="end">${Math.round(v).toLocaleString('en-US')}</text>`; });
    values.forEach((v, i) => {
      const x = P.l + i * slot + (slot - bw) / 2, y = Y(v), h = VH - P.b - y;
      const last = i === n - 1;
      if (on.fake3d) {
        const dx = 9, dy = 7;
        g += `<polygon class="cd-side" points="${x + bw},${y} ${x + bw + dx},${y - dy} ${x + bw + dx},${VH - P.b - dy} ${x + bw},${VH - P.b}"/><polygon class="cd-side" points="${x},${y} ${x + dx},${y - dy} ${x + bw + dx},${y - dy} ${x + bw},${y}"/>`;
      }
      g += `<rect class="cd-bar cd-mark${!on.rainbow && last ? ' hi' : ''}" style="--i:${i}${on.rainbow ? `;fill:${RAINBOW[i % RAINBOW.length]}` : ''}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1, h).toFixed(1)}"/>`;
      g += `<text x="${(x + bw / 2).toFixed(1)}" y="${VH - P.b + 18}" text-anchor="middle">${esc(labels[i])}</text>`;
      if (!on.truncated && !on.cumul && n <= 8) g += `<text class="t-v" x="${(x + bw / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle">${v}</text>`;
    });
    g += `<line class="cd-ax" x1="${P.l}" x2="${VW - P.r}" y1="${VH - P.b}" y2="${VH - P.b}"/>`;
    const hot = {
      truncated: [0, P.t, P.l, VH - P.t - P.b],
      rainbow: [P.l, P.t, VW - P.l - P.r, (VH - P.t - P.b) * 0.5],
      fake3d: [P.l, (VH - P.t - P.b) * 0.5, VW - P.l - P.r, (VH - P.t - P.b) * 0.5],
      cumul: [VW * 0.55, P.t, VW * 0.45 - P.r, (VH - P.t - P.b) * 0.5],
      shuffle: [P.l, VH - P.b, VW - P.l - P.r, P.b],
    };
    return { svg: g, hot };
  }
  function pie(p, on) {
    let labels = p.labels.slice(), values = p.values.slice();
    if (!on.slices) { const keep = 4; const other = values.slice(keep).reduce((a, b) => a + b, 0); labels = labels.slice(0, keep).concat('Other'); values = values.slice(0, keep).concat(other); }
    const total = values.reduce((a, b) => a + b, 0);
    const r = Math.min(112, VW * 0.24), cx = on.legend ? r + 30 : VW / 2, cy = 150, ry = on.pie3d ? r * 0.5 : r, depth = on.pie3d ? 22 : 0, lx0 = VW * 0.64;
    const shades = ['var(--sig)', 'var(--ink-2)', 'var(--bar-2)', 'var(--bar)', 'var(--ink-3)'];
    const col = (i) => (on.slices ? RAINBOW[i % RAINBOW.length] : shades[i % shades.length]);
    let g = '', a0 = -Math.PI / 2;
    const pt = (a, rr, ryy, dz) => [cx + Math.cos(a) * rr, cy + Math.sin(a) * ryy + (dz || 0)];
    if (depth) {
      g += `<ellipse cx="${cx}" cy="${cy + depth}" rx="${r}" ry="${ry}" style="fill:var(--bar);opacity:.6"/>`;
      g += `<rect x="${cx - r}" y="${cy}" width="${2 * r}" height="${depth}" style="fill:var(--bar);opacity:.6"/>`;
    }
    values.forEach((v, i) => {
      const a1 = a0 + (v / total) * Math.PI * 2;
      const [x0, y0] = pt(a0, r, ry), [x1, y1] = pt(a1, r, ry);
      const big = a1 - a0 > Math.PI ? 1 : 0;
      g += `<path class="cd-mark cd-fade" style="--i:${i};fill:${col(i)}" stroke="var(--bg-2)" stroke-width="1.5" d="M${cx},${cy} L${x0.toFixed(1)},${y0.toFixed(1)} A${r},${ry} 0 ${big} 1 ${x1.toFixed(1)},${y1.toFixed(1)} Z"/>`;
      if (!on.legend && v / total > 0.04) {
        const am = (a0 + a1) / 2, [lx, ly] = pt(am, r * 0.68, ry * 0.68);
        const dark = i === 0 || on.slices;
        g += `<text x="${lx.toFixed(1)}" y="${(ly - 2).toFixed(1)}" text-anchor="middle" style="fill:${dark ? 'var(--on-sig)' : 'var(--bg)'};font-size:10.5px">${esc(labels[i])}</text><text x="${lx.toFixed(1)}" y="${(ly + 11).toFixed(1)}" text-anchor="middle" style="fill:${dark ? 'var(--on-sig)' : 'var(--bg)'};font-size:10.5px">${Math.round(100 * v / total)}%</text>`;
      }
      a0 = a1;
    });
    if (on.legend) labels.forEach((l, i) => { const y = 34 + i * 26; g += `<rect x="${lx0}" y="${y - 9}" width="11" height="11" style="fill:${col(i)}"/><text x="${lx0 + 18}" y="${y + 1}">${esc(l)}</text>`; });
    const hot = { pie3d: [cx - r, cy, 2 * r, ry + depth], slices: [cx, cy - ry, r, ry], legend: [lx0 - 10, 16, VW - lx0 + 10, 240] };
    return { svg: g, hot };
  }
  function dual(p, on) {
    const n = p.a.length;
    const X = (i, x0, x1) => x0 + i * (x1 - x0) / (n - 1);
    let g = '';
    if (on.dual) {
      const loA = on.truncated ? 1200 : 0, hiA = 1460, loB = on.truncated ? 40 : 0, hiB = 95;
      const YA = (v) => P.t + (1 - (v - loA) / (hiA - loA)) * (VH - P.t - P.b), YB = (v) => P.t + (1 - (v - loB) / (hiB - loB)) * (VH - P.t - P.b);
      axisTicks(loA, hiA, 4).forEach((v, i) => { g += `<line class="cd-gr" x1="${P.l}" x2="${VW - 44}" y1="${YA(v)}" y2="${YA(v)}"/><text x="${P.l - 8}" y="${YA(v) + 4}" text-anchor="end">${Math.round(v)}</text>`; const vb = loB + (hiB - loB) * i / 4; g += `<text x="${VW - 38}" y="${YB(vb) + 4}" class="t-sig">${Math.round(vb)}</text>`; });
      g += `<path class="cd-ln cd-mark cd-fade" d="${p.a.map((v, i) => (i ? 'L' : 'M') + X(i, P.l, VW - 44).toFixed(1) + ' ' + YA(v).toFixed(1)).join('')}"/>`;
      g += `<path class="cd-ln b cd-mark cd-fade" d="${p.b.map((v, i) => (i ? 'L' : 'M') + X(i, P.l, VW - 44).toFixed(1) + ' ' + YB(v).toFixed(1)).join('')}"/>`;
      p.labels.forEach((l, i) => { g += `<text x="${X(i, P.l, VW - 44).toFixed(1)}" y="${VH - P.b + 18}" text-anchor="middle">${l}</text>`; });
      if (!on.units) g += `<text x="${P.l}" y="10" class="t-ink">Signups / month</text><text x="${VW - 4}" y="10" text-anchor="end" class="t-sig">Revenue, $K</text>`;
    } else {
      const panel = (vals, lo, hi, y0, y1, cls, title, fmt) => {
        const Y = (v) => y0 + (1 - (v - lo) / (hi - lo)) * (y1 - y0);
        let s = '';
        [lo, (lo + hi) / 2, hi].forEach((v) => { s += `<line class="cd-gr" x1="${P.l}" x2="${VW - P.r}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${P.l - 8}" y="${Y(v) + 4}" text-anchor="end">${fmt(v)}</text>`; });
        s += `<path class="cd-ln ${cls} cd-mark cd-fade" d="${vals.map((v, i) => (i ? 'L' : 'M') + X(i, P.l, VW - P.r).toFixed(1) + ' ' + Y(v).toFixed(1)).join('')}"/>`;
        if (!on.units) s += `<text x="${P.l}" y="${y0 - 6}" class="${cls ? 't-sig' : 't-ink'}">${title}</text>`;
        return s;
      };
      const loA = on.truncated ? 1200 : 0, loB = on.truncated ? 40 : 0;
      g += panel(p.a, loA, 1500, 28, 118, '', 'Signups per month', (v) => (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : Math.round(v)));
      g += panel(p.b, loB, 100, 168, VH - P.b, 'b', 'Revenue per month, $K', (v) => Math.round(v));
      p.labels.forEach((l, i) => { g += `<text x="${X(i, P.l, VW - P.r).toFixed(1)}" y="${VH - P.b + 18}" text-anchor="middle">${l}</text>`; });
    }
    g += `<line class="cd-ax" x1="${P.l}" x2="${VW - P.r}" y1="${VH - P.b}" y2="${VH - P.b}"/>`;
    const hot = { dual: [VW - 50, P.t, 50, VH - P.t - P.b], units: [0, 0, VW, 16], truncated: [0, P.t, P.l, VH - P.t - P.b] };
    return { svg: g, hot };
  }
  const render = (p, on) => (p.kind === 'pie' ? pie(p, on) : p.kind === 'dual' ? dual(p, on) : bars(p, on));

  function mount(root, api) {
    VW = root.getBoundingClientRect().width < 640 ? 380 : 520;
    let idx = 0, wrongTotal = 0, found = new Set(), picked = new Set();
    let seed = 1 + Math.floor(Math.random() * 1e6);
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    root.innerHTML = `
      <div class="gm">
        <div class="gm-top">
          <div><p class="gm-k" data-k></p><h3 class="gm-h">Chart <em>Doctor</em></h3></div>
          <dl class="gm-hud"><div><dt>Patient</dt><dd data-p>1 / 4</dd></div><div><dt>Found</dt><dd class="sig" data-f>0 / 3</dd></div><div><dt>Wrong picks</dt><dd data-w>0</dd></div></dl>
        </div>
        <div class="gm-body">
          <div class="cd">
            <figure class="cd-chart"><figcaption><p class="cd-chart-t" data-t></p><p class="cd-chart-s" data-s></p></figcaption><svg class="cd-svg" viewBox="0 0 ${VW} ${VH}" role="img" aria-labelledby="cd-desc"><title id="cd-desc">The chart under diagnosis</title><g data-g></g><g data-hot></g></svg></figure>
            <div class="cd-list"><p class="cd-q">What is wrong with this chart? Pick three.</p><div class="cd-opts" data-opts></div><p class="gm-live" aria-live="polite" data-live></p></div>
          </div>
        </div>
        <div class="gm-bar">
          <p class="gm-help">Choose from the list, or click the part of the chart that is lying. Each correct diagnosis redraws the chart. Two of the five options are fine as they are.</p>
          <div class="gm-actions"><div class="cd-steps" aria-hidden="true"><i></i><i></i><i></i><i></i></div><button class="btn btn-primary" type="button" data-next disabled>Next patient<span class="bi">→</span></button></div>
        </div>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const gEl = $('[data-g]'), hotEl = $('[data-hot]'), svg = $('.cd-svg'), opts = $('[data-opts]'), live = $('[data-live]'), next = $('[data-next]');

    function draw(animate) {
      const p = PATIENTS[idx];
      const on = {}; p.faults.forEach((f) => { on[f] = !found.has(f); });
      const r = render(p, on);
      gEl.innerHTML = r.svg;
      hotEl.innerHTML = '';
      p.faults.forEach((f) => {
        if (found.has(f) || !r.hot[f]) return;
        const [x, y, w, h] = r.hot[f];
        hotEl.insertAdjacentHTML('beforeend', `<rect class="cd-hot" data-f="${f}" x="${x}" y="${y}" width="${w}" height="${h}"><title>${esc(FAULTS[f][0])}</title></rect>`);
      });
      $('[data-g]').closest('svg').querySelector('title').textContent = `${p.t}: ${3 - found.size} problems left to find`;
      if (animate && api.motionOK()) {
        svg.classList.remove('is-new'); void svg.offsetWidth; svg.classList.add('is-new');
        const G = api.gsap;
        if (G) G.from(gEl.querySelectorAll('.cd-mark'), { opacity: 0, y: 10, duration: 0.6, ease: 'expo.out', stagger: 0.03 });
      }
    }
    function choose(key) {
      const p = PATIENTS[idx];
      if (picked.has(key) || found.size === 3) return;
      picked.add(key);
      const btn = opts.querySelector(`[data-key="${key}"]`);
      const real = p.faults.includes(key);
      btn.setAttribute('aria-disabled', 'true');
      btn.classList.add(real ? 'is-right' : 'is-wrong');
      btn.querySelector('.box').textContent = real ? '✓' : '×';
      const note = document.createElement('small');
      note.textContent = real ? FAULTS[key][1] : DECOYS[key][1];
      btn.lastElementChild.appendChild(note);
      if (real) { found.add(key); draw(true); live.textContent = `Correct. ${FAULTS[key][1]}`; }
      else { wrongTotal++; live.textContent = DECOYS[key][1]; }
      $('[data-f]').textContent = `${found.size} / 3`;
      $('[data-w]').textContent = wrongTotal;
      if (found.size === 3) {
        live.textContent = idx < PATIENTS.length - 1 ? 'Diagnosis complete. The chart tells the truth now.' : 'All four charts fixed.';
        next.disabled = false;
        next.firstChild.textContent = idx < PATIENTS.length - 1 ? 'Next patient' : 'See your grade';
        next.focus();
      }
    }
    function load() {
      const p = PATIENTS[idx];
      found = new Set(); picked = new Set();
      $('[data-k]').textContent = `Patient ${idx + 1} of ${PATIENTS.length} · simulated data`;
      $('[data-p]').textContent = `${idx + 1} / ${PATIENTS.length}`;
      $('[data-f]').textContent = '0 / 3';
      $('[data-t]').textContent = p.t; $('[data-s]').textContent = p.s;
      root.querySelectorAll('.cd-steps i').forEach((el, i) => { el.className = i < idx ? 'on' : i === idx ? 'now' : ''; });
      const keys = p.faults.concat(p.decoys).map((k) => [k, rnd()]).sort((a, b) => a[1] - b[1]).map((x) => x[0]);
      opts.innerHTML = keys.map((k) => `<button class="cd-opt" type="button" data-key="${k}"${p.faults.includes(k) ? ' data-real="1"' : ''}><span class="box" aria-hidden="true"></span><span>${esc((FAULTS[k] || DECOYS[k])[0])}</span></button>`).join('');
      next.disabled = true; next.firstChild.textContent = 'Next patient';
      live.textContent = '';
      draw(false);
    }
    const grade = (w) => (w === 0 ? 'A+' : w <= 1 ? 'A' : w <= 3 ? 'B' : w <= 5 ? 'C' : 'D');
    function finish() {
      const gr = grade(wrongTotal);
      const best = api.saveBest('doctor', wrongTotal, gr, true);
      const res = document.createElement('div');
      res.className = 'gm-res';
      res.innerHTML = `<div class="gm-res-in" role="dialog" aria-modal="false" aria-labelledby="cd-res-h">
        <p class="gm-res-k" id="cd-res-h">Your grade</p>
        <p class="gm-res-big"><em>${gr}</em></p>
        ${best ? '<p class="gm-res-new">New personal best</p>' : ''}
        <p class="gm-res-p">Twelve faults found with <b>${wrongTotal}</b> wrong ${wrongTotal === 1 ? 'pick' : 'picks'}. Every one of these shows up in real dashboards; catching them before a director does is half the job.</p>
        <div class="gm-actions"><button class="btn btn-primary" type="button" data-again>Play again<span class="bi">→</span></button></div></div>`;
      $('.gm-body').appendChild(res);
      api.announce(`Grade ${gr}, with ${wrongTotal} wrong picks.`);
      const again = res.querySelector('[data-again]');
      again.addEventListener('click', () => { res.remove(); idx = 0; wrongTotal = 0; $('[data-w]').textContent = '0'; load(); opts.querySelector('button').focus(); });
      again.focus();
    }
    opts.addEventListener('click', (e) => { const b = e.target.closest('.cd-opt'); if (b) choose(b.dataset.key); });
    hotEl.addEventListener('click', (e) => { const h = e.target.closest('.cd-hot'); if (h) choose(h.dataset.f); });
    next.addEventListener('click', () => { if (idx < PATIENTS.length - 1) { idx++; load(); opts.querySelector('button').focus(); } else finish(); });
    load();
    const first = opts.querySelector('button'); if (first) first.focus({ preventScroll: true });
    SR.games.doctor.unmount = () => { root.innerHTML = ''; };
  }

  SR.games.doctor = { mount };
})();
