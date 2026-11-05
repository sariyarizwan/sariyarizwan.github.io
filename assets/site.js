/* Enhancement layer. The page is complete and readable without this script:
   hidden start states only apply once this file adds `.motion` to <html>. */
(() => {
  'use strict';
  const d = document.documentElement;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const motionOK = () => !reduce.matches;
  const G = window.gsap;
  const hasG = !!G && motionOK();
  if (motionOK()) d.classList.add('motion');
  if (G) {
    [window.ScrollTrigger, window.SplitText, window.Flip].forEach((p) => p && G.registerPlugin(p));
  }

  /* ---------- Shared state: the page-wide skill filter ---------- */
  const SR = (window.SR = {
    filter: null,
    setFilter(key) {
      this.filter = key && key !== this.filter ? key : null;
      document.dispatchEvent(new CustomEvent('sr:filter', { detail: this.filter }));
    },
    clear() { if (this.filter) this.setFilter(null); },
    hasG, motionOK, $, $$,
  });

  /* ---------- Theme toggle (circular reveal where View Transitions exist) ---------- */
  const themeBtn = $('.theme-btn');
  const metaTheme = $('meta[name="theme-color"]');
  const current = () => (d.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
  const applyTheme = (t) => {
    d.setAttribute('data-theme', t);
    if (metaTheme) metaTheme.setAttribute('content', t === 'light' ? '#F1ECE2' : '#100F0D');
    if (themeBtn) themeBtn.setAttribute('aria-label', t === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
    try { localStorage.setItem('sr-theme', t); } catch (e) { /* storage unavailable */ }
    document.dispatchEvent(new CustomEvent('sr:theme', { detail: t }));
  };
  if (themeBtn) {
    themeBtn.setAttribute('aria-label', current() === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
    themeBtn.addEventListener('click', () => {
      const next = current() === 'light' ? 'dark' : 'light';
      if (!document.startViewTransition || !motionOK()) return applyTheme(next);
      const r = themeBtn.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const rad = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      const vt = document.startViewTransition(() => applyTheme(next));
      vt.ready.then(() => {
        d.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${rad}px at ${x}px ${y}px)`] },
          { duration: 750, easing: 'cubic-bezier(.32,.72,0,1)', pseudoElement: '::view-transition-new(root)' });
      }).catch(() => {});
    });
  }

  /* ---------- Mobile menu (<details>) ---------- */
  const menu = $('.menu');
  if (menu) {
    $$('a', menu).forEach((a) => a.addEventListener('click', () => menu.removeAttribute('open')));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.hasAttribute('open')) { menu.removeAttribute('open'); $('summary', menu).focus(); }
    });
    menu.addEventListener('toggle', () => { document.body.style.overflow = menu.open ? 'hidden' : ''; });
  }

  /* ---------- Scrollspy ---------- */
  const navLinks = $$('.nav-links a[href^="#"]');
  if (navLinks.length && 'IntersectionObserver' in window) {
    const byId = Object.fromEntries(navLinks.map((a) => [a.getAttribute('href').slice(1), a]));
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        navLinks.forEach((a) => a.removeAttribute('aria-current'));
        if (byId[en.target.id]) byId[en.target.id].setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(byId).forEach((id) => { const el = document.getElementById(id); if (el) spy.observe(el); });
  }

  /* ---------- Scroll reveals ---------- */
  const revealEls = $$('.rv');
  if (motionOK() && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-in'));
  }

  /* ---------- Section headings: word-by-word rise ---------- */
  if (hasG && window.SplitText && window.ScrollTrigger) {
    const splitHeadings = () => $$('.h2').forEach((h) => {
      window.SplitText.create(h, {
        type: 'words', mask: 'words', aria: 'auto', autoSplit: true,
        onSplit: (self) => G.from(self.words, {
          yPercent: 115, duration: 1.15, ease: 'expo.out', stagger: 0.06,
          scrollTrigger: { trigger: h, start: 'top 88%', once: true },
        }),
      });
    });
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(splitHeadings);
  }

  /* ---------- Copy to clipboard ---------- */
  const status = $('#sr-status');
  $$('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const text = btn.getAttribute('data-copy');
      try { await navigator.clipboard.writeText(text); } catch (e) { return; }
      btn.classList.add('is-done');
      const use = $('use', btn);
      if (use) use.setAttribute('href', '#i-check');
      if (status) status.textContent = 'Email address copied to the clipboard.';
      setTimeout(() => { btn.classList.remove('is-done'); if (use) use.setAttribute('href', '#i-copy'); if (status) status.textContent = ''; }, 2200);
    });
  });

  /* ---------- Footer year ---------- */
  $$('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });

  /* ---------- Section modules register below ---------- */

  /* ---------- About: count-ups (final values are already in the HTML) ---------- */
  const counters = $$('.cnt[data-to]');
  if (motionOK() && counters.length && 'IntersectionObserver' in window) {
    const run = (el) => {
      const to = +el.dataset.to, from = +(el.dataset.from || 0), dur = 1500, t0 = performance.now();
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 4);
        el.textContent = String(Math.round(from + (to - from) * e));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    const cio = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { cio.unobserve(en.target); setTimeout(() => run(en.target), 250); } });
    }, { threshold: 0.6 });
    counters.forEach((el) => {
      if (el.getBoundingClientRect().top > innerHeight) el.textContent = el.dataset.from || '0';
      cio.observe(el);
    });
  }

  /* ---------- Experience: interactive gantt ---------- */
  const plot = $('.g-plot');
  const rolesWrap = $('.roles');
  if (plot && rolesWrap) {
    const rowsWrap = $('.g-rows', plot);
    const rows = $$('.g-row', plot);
    const arts = rows.map((r) => document.getElementById(r.hash.slice(1)));
    const gantt = plot.closest('.gantt');
    const tip = $('.g-tip', gantt);
    const now = new Date();
    const [fy] = plot.dataset.from.split('-').map(Number);
    const endY = Math.max(+plot.dataset.to.split('-')[0], now.getFullYear() + 1);
    const years = endY - fy, span = years * 12;
    const idx = (ym) => { const [y, m] = ym.split('-').map(Number); return (y - fy) * 12 + (m - 1); };
    const todayIdx = (now.getFullYear() - fy) * 12 + now.getMonth() + (now.getDate() - 1) / 31;
    const fmtDur = (m) => {
      const y = Math.floor(m / 12), r = m % 12;
      return [y ? `${y} yr${y > 1 ? 's' : ''}` : '', r ? `${r} mo` : ''].filter(Boolean).join(' ') || '1 mo';
    };
    plot.style.setProperty('--years', String(years));
    if (years !== 6) {
      const axis = $('.g-axis', plot);
      axis.textContent = '';
      for (let y = fy; y <= endY; y++) {
        const s = document.createElement('span');
        s.style.left = `${((y - fy) / years) * 100}%`; s.textContent = String(y); axis.appendChild(s);
      }
    }
    rows.forEach((row, i) => {
      const s = idx(row.dataset.start);
      const e = row.dataset.end ? idx(row.dataset.end) + 1 : todayIdx;
      const bar = $('.g-bar', row);
      bar.style.setProperty('--l', `${(s / span) * 100}%`);
      bar.style.setProperty('--w', `${(Math.max(e - s, 0.5) / span) * 100}%`);
      const mile = $('.g-mile', row);
      if (mile && row.dataset.mile) mile.style.setProperty('--l', `${((idx(row.dataset.mile) + 1) / span) * 100}%`);
      if (!row.dataset.end) {
        const months = (now.getFullYear() - fy) * 12 + now.getMonth() - s + 1;
        const dur = $('.dur', arts[i]);
        if (dur) dur.textContent = fmtDur(Math.max(1, months));
      }
    });
    const today = $('.g-today', plot);
    if (today) {
      today.style.setProperty('--x', String(Math.min(todayIdx / span, 1)));
      $('span', today).textContent = `Today · ${now.toLocaleString('en-US', { month: 'short' })} ${now.getFullYear()}`;
    }

    // Tabs: the rows select which role card is shown.
    rowsWrap.setAttribute('role', 'tablist');
    rowsWrap.setAttribute('aria-label', 'Roles by date');
    rowsWrap.setAttribute('aria-orientation', 'vertical');
    rolesWrap.classList.add('is-tabbed');
    rows.forEach((row, i) => {
      row.id = `tab-${arts[i].id}`;
      row.setAttribute('role', 'tab');
      row.setAttribute('aria-controls', arts[i].id);
      arts[i].setAttribute('role', 'tabpanel');
      arts[i].setAttribute('aria-labelledby', row.id);
      arts[i].tabIndex = 0;
    });
    let sel = -1;
    const select = (i, o = {}) => {
      if (i !== sel) {
        sel = i;
        rows.forEach((r, j) => { r.setAttribute('aria-selected', String(j === i)); r.tabIndex = j === i ? 0 : -1; });
        arts.forEach((a, j) => { a.hidden = j !== i; });
      }
      if (o.focus) rows[i].focus();
      if (o.hash) history.replaceState(null, '', `#${arts[i].id}`);
    };
    select(0);
    rows.forEach((row, i) => row.addEventListener('click', (e) => { e.preventDefault(); select(i, { hash: true }); }));
    rowsWrap.addEventListener('keydown', (e) => {
      const n = { ArrowDown: sel + 1, ArrowRight: sel + 1, ArrowUp: sel - 1, ArrowLeft: sel - 1, Home: 0, End: rows.length - 1 }[e.key];
      if (n === undefined) return;
      e.preventDefault();
      select((n + rows.length) % rows.length, { focus: true, hash: true });
    });
    const openRole = (id, scroll) => {
      const i = arts.findIndex((a) => a.id === id);
      if (i < 0) return false;
      select(i, { hash: true });
      if (scroll) gantt.scrollIntoView({ behavior: motionOK() ? 'smooth' : 'auto', block: 'start' });
      return true;
    };
    document.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('a[href^="#exp-"]');
      if (a && !a.classList.contains('g-row') && openRole(a.hash.slice(1), true)) e.preventDefault();
    });
    if (location.hash.indexOf('#exp-') === 0) openRole(location.hash.slice(1), true);
    SR.selectRole = (id) => openRole(id, true);
    SR.roleSkills = () => arts.map((a) => ({ id: a.id, name: $('h3', a).textContent, title: $('.role-title', a).textContent, start: rows[arts.indexOf(a)].dataset.start, end: rows[arts.indexOf(a)].dataset.end, skills: a.dataset.skills.split(/\s+/) }));

    // Tooltip on hover and keyboard focus.
    const hideTip = () => { tip.hidden = true; };
    const showTip = (row) => {
      const a = arts[rows.indexOf(row)];
      tip.textContent = '';
      const b = document.createElement('b'); b.textContent = `${$('h3', a).textContent} · ${$('.role-title', a).textContent}`;
      const w = document.createElement('span'); w.className = 't-when'; w.textContent = `${$('.role-when span', a).textContent} · ${$('.dur', a).textContent}`;
      const h = document.createElement('span'); h.className = 't-head'; h.textContent = a.dataset.headline;
      tip.append(b, w, h);
      tip.hidden = false;
      const br = $('.g-bar', row).getBoundingClientRect(), gr = gantt.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
      let left = br.left - gr.left + Math.min(br.width, 240) / 2 - tw / 2;
      left = Math.max(12, Math.min(left, gr.width - tw - 12));
      let top = br.top - gr.top - th - 12;
      if (top < 8) top = br.bottom - gr.top + 12;
      tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    };
    rows.forEach((row) => {
      row.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') showTip(row); });
      row.addEventListener('pointerleave', hideTip);
      row.addEventListener('focus', () => { if (row.matches(':focus-visible')) showTip(row); });
      row.addEventListener('blur', hideTip);
    });

    // Bars draw in once.
    if (hasG && window.ScrollTrigger) {
      G.from($$('.g-bar', plot), { scaleX: 0, duration: 1.3, ease: 'expo.out', stagger: 0.07, scrollTrigger: { trigger: plot, start: 'top 82%', once: true } });
      G.from($$('.g-mile, .g-today', plot), { opacity: 0, duration: 0.7, delay: 0.9, scrollTrigger: { trigger: plot, start: 'top 82%', once: true } });
    }

    // Cross-filter: dim roles that never used the selected skill.
    document.addEventListener('sr:filter', (e) => {
      const k = e.detail;
      let firstMatch = -1;
      rows.forEach((r, i) => {
        const has = !k || (` ${arts[i].dataset.skills} `).includes(` ${k} `);
        r.classList.toggle('is-dim', !has);
        if (has && firstMatch < 0) firstMatch = i;
      });
      if (k && firstMatch >= 0 && rows[sel].classList.contains('is-dim')) select(firstMatch);
    });
  }

  /* ---------- Skills: category filter, evidence counts, evidence panel ---------- */
  const cloud = $('#sk-cloud');
  if (cloud && SR.roleSkills) {
    const roles = SR.roleSkills();
    const tabs = $$('.sk-tabs [data-cat]');
    const chips = $$('.chip', cloud);
    const ev = $('.evidence');
    const evDefault = $('.ev-default', ev), evPicked = $('.ev-picked', ev), evChart = $('.ev-chart', ev);
    const catLabel = Object.fromEntries(tabs.map((t) => [t.dataset.cat, t.firstChild.textContent.trim()]));
    const label = {};
    $$('.chip[data-skill]').forEach((c) => { if (!label[c.dataset.skill]) label[c.dataset.skill] = c.firstChild.textContent.trim(); });
    const usedBy = (k) => roles.filter((r) => r.skills.includes(k));
    const now = new Date();
    const mIdx = (ym) => { const [y, m] = ym.split('-').map(Number); return y * 12 + (m - 1); };
    const nowIdx = now.getFullYear() * 12 + now.getMonth();
    const firstYear = 2021;
    const yearsOf = (rs) => {
      const months = new Set();
      rs.forEach((r) => { const s = mIdx(r.start), e = r.end ? mIdx(r.end) : nowIdx; for (let m = s; m <= e; m++) months.add(m); });
      const years = new Set([...months].map((m) => Math.floor(m / 12)));
      return { months: months.size, years };
    };
    chips.forEach((c) => { const n = usedBy(c.dataset.skill).length; if (n) $('.n', c).textContent = String(n); });

    // Default panel: most-used tools by number of roles.
    const ranked = Object.keys(label)
      .map((k) => ({ k, n: usedBy(k).length, core: !!$(`.chip.core[data-skill="${k}"]`, cloud) }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n || b.core - a.core)
      .slice(0, 10);
    const max = ranked.length ? ranked[0].n : 1;
    const cap = document.createElement('p'); cap.className = 'ev-cap'; cap.textContent = `Roles using each tool, out of ${roles.length}`;
    const ol = document.createElement('ol'); ol.className = 'ev-bars';
    ranked.forEach((x) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'evb'; b.dataset.skill = x.k;
      b.setAttribute('aria-label', `${label[x.k]}: used in ${x.n} of ${roles.length} roles`);
      b.innerHTML = '<span class="evb-l"></span><span class="evb-t"><i></i></span><span class="evb-n"></span>';
      $('.evb-l', b).textContent = label[x.k];
      $('i', b).style.setProperty('--v', String(x.n / max));
      $('.evb-n', b).textContent = String(x.n);
      li.appendChild(b); ol.appendChild(li);
    });
    evChart.append(cap, ol);
    evChart.hidden = false;
    const note = $('.ev-note', ev); if (note) note.hidden = true;
    if (hasG && window.ScrollTrigger) {
      G.from($$('.evb-t i', ol), { scaleX: 0, duration: 1.2, ease: 'expo.out', stagger: 0.05, scrollTrigger: { trigger: ol, start: 'top 85%', once: true } });
    }

    // Picked panel: one tool, its years of use and where it shows up.
    const renderPicked = (k) => {
      const rs = usedBy(k);
      const chip = $(`.chip[data-skill="${k}"]`, cloud);
      evPicked.textContent = '';
      const add = (tag, cls, text) => { const el = document.createElement(tag); if (cls) el.className = cls; if (text != null) el.textContent = text; evPicked.appendChild(el); return el; };
      add('p', 'ev-k', `Selected · ${chip ? catLabel[chip.dataset.cat] : 'Tool'}`);
      add('h3', 'ev-h', label[k] || k);
      if (rs.length) {
        const y = yearsOf(rs);
        const sum = add('p', 'ev-sum');
        sum.innerHTML = `Used in <b>${rs.length}</b> of ${roles.length} roles · about <b>${(y.months / 12).toFixed(1)}</b> years`;
        const strip = add('div', 'ev-years'); strip.setAttribute('aria-hidden', 'true');
        strip.style.setProperty('--n', String(now.getFullYear() - firstYear + 1));
        for (let yr = firstYear; yr <= now.getFullYear(); yr++) {
          const s = document.createElement('span'); s.textContent = `’${String(yr).slice(2)}`;
          if (y.years.has(yr)) s.className = 'on';
          strip.appendChild(s);
        }
        add('p', 'ev-sub', 'Roles');
        const ul = add('ul', 'ev-list');
        rs.forEach((r) => {
          const li = document.createElement('li'); const a = document.createElement('a');
          a.href = `#${r.id}`; a.textContent = `${r.name} · ${r.title}`;
          const sp = document.createElement('span'); sp.textContent = `${r.start.slice(0, 4)}–${r.end ? r.end.slice(0, 4) : 'now'}`;
          a.appendChild(sp); li.appendChild(a); ul.appendChild(li);
        });
      } else {
        add('p', 'ev-none', 'Part of my toolkit, but not tied to one of the roles listed here.');
      }
      const work = $$('[data-skills]').filter((el) => !el.classList.contains('role') && (` ${el.dataset.skills} `).includes(` ${k} `));
      if (work.length) {
        add('p', 'ev-sub', 'Work');
        const ul = add('ul', 'ev-list');
        work.forEach((w) => {
          const h = $('h3', w); if (!h || !w.id) return;
          const li = document.createElement('li'); const a = document.createElement('a');
          a.href = `#${w.id}`; a.textContent = h.textContent;
          const sp = document.createElement('span'); sp.textContent = w.dataset.kind || 'Project';
          a.appendChild(sp); li.appendChild(a); ul.appendChild(li);
        });
      }
      const clear = add('button', 'btn btn-plain ev-clear', 'Clear selection');
      clear.type = 'button';
      clear.addEventListener('click', () => SR.clear());
    };

    // Category tabs (Flip-animated filtering).
    const showCat = (cat, animate) => {
      tabs.forEach((t) => t.setAttribute('aria-pressed', String(t.dataset.cat === cat)));
      const apply = () => chips.forEach((c) => {
        const on = cat === 'all' || (cat === 'core' ? c.classList.contains('core') : c.dataset.cat === cat);
        c.style.display = on ? '' : 'none';
      });
      if (animate && hasG && window.Flip) {
        const state = window.Flip.getState(chips);
        apply();
        window.Flip.from(state, {
          duration: 0.55, ease: 'power3.inOut', absolute: true, stagger: 0.004, nested: false,
          onEnter: (els) => G.fromTo(els, { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.45, ease: 'power3.out', stagger: 0.008 }),
          onLeave: (els) => G.to(els, {
            opacity: 0, scale: 0.85, duration: 0.3,
            onComplete: () => els.forEach((el) => { el.style.display = 'none'; G.set(el, { clearProps: 'opacity,scale,transform' }); }),
          }),
        });
      } else apply();
    };
    tabs.forEach((t) => t.addEventListener('click', () => showCat(t.dataset.cat, true)));
    showCat('core', false);

    // Any skill chip or evidence bar sets the page-wide filter.
    document.addEventListener('click', (e) => {
      const t = e.target.closest && e.target.closest('button.chip[data-skill], button.evb[data-skill]');
      if (t) SR.setFilter(t.dataset.skill);
    });
    document.addEventListener('sr:filter', (e) => {
      const k = e.detail;
      $$('button.chip[data-skill]').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.skill === k)));
      evDefault.hidden = !!k; evPicked.hidden = !k;
      if (k) renderPicked(k);
    });
    $$('button.chip[data-skill]').forEach((c) => c.setAttribute('aria-pressed', 'false'));
  }

  /* ---------- Education & research timeline ---------- */
  const rail = $('.rail');
  if (rail) {
    const items = $$('.r-item', rail);
    const fbtns = $$('.edu-filter [data-type]');
    const layout = () => {
      $$('.r-year', rail).forEach((y) => {
        const list = y.nextElementSibling;
        const any = list && $$('.r-item', list).some((it) => !it.hidden);
        y.hidden = !any; if (list) list.hidden = !any;
      });
    };
    fbtns.forEach((b) => b.addEventListener('click', () => {
      const t = b.dataset.type;
      fbtns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      let n = 0;
      items.forEach((it) => {
        it.hidden = !(t === 'all' || it.dataset.type === t);
        it.classList.remove('is-pop');
        if (!it.hidden && motionOK()) { void it.offsetWidth; it.style.setProperty('--i', String(n++)); it.classList.add('is-pop'); }
      });
      layout();
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    }));
    layout();
    const fill = $('.rail-fill', rail);
    if (hasG && window.ScrollTrigger && fill) {
      G.fromTo(fill, { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: rail, start: 'top 75%', end: 'bottom 60%', scrub: 0.6 } });
    }
  }

  /* ---------- Work filter: BI case studies, Data & ML builds, Security builds ---------- */
  const wkBtns = $$('.wk-filter [data-group]');
  if (wkBtns.length) {
    const cards = $$('#work article[data-group]');
    const groups = $$('#work div[data-for]');
    wkBtns.forEach((b) => b.addEventListener('click', () => {
      const g = b.dataset.group;
      wkBtns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      let n = 0;
      cards.forEach((c) => {
        c.hidden = !(g === 'all' || c.dataset.group === g);
        c.classList.remove('is-pop');
        if (!c.hidden && motionOK() && c.classList.contains('is-in')) { void c.offsetWidth; c.style.setProperty('--i', String(Math.min(n++, 6))); c.classList.add('is-pop'); }
      });
      groups.forEach((grid) => {
        const any = $$('article', grid).some((a) => !a.hidden);
        grid.hidden = !any;
        const h = $(`#work h3[data-for="${grid.dataset.for}"]`);
        if (h) h.hidden = !any;
      });
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    }));
  }

  /* ---------- Page-wide cross-filter: pill, dimming, Esc ---------- */
  const pill = $('.fpill');
  if (pill) {
    const labelOf = (k) => { const c = $(`.chip[data-skill="${k}"]`); return c ? c.firstChild.textContent.trim() : k; };
    const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
    document.addEventListener('sr:filter', (e) => {
      const k = e.detail;
      let work = 0;
      $$('.xf[data-skills]').forEach((el) => {
        const has = !k || (` ${el.dataset.skills} `).includes(` ${k} `);
        el.classList.toggle('is-dim', !has);
        if (k && has) work++;
      });
      if (!k) { pill.hidden = true; if (status) status.textContent = 'Skill filter cleared.'; return; }
      const roles = SR.roleSkills ? SR.roleSkills().filter((r) => r.skills.includes(k)).length : 0;
      $('.fp-skill', pill).textContent = labelOf(k);
      $('.fp-n', pill).textContent = `${plural(roles, 'role')} · ${plural(work, 'project')}`;
      pill.hidden = false;
      if (status) status.textContent = `Filtered by ${labelOf(k)}: ${plural(roles, 'role')} and ${plural(work, 'project')} match.`;
    });
    $('.fp-x', pill).addEventListener('click', () => SR.clear());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && SR.filter && !(menu && menu.open) && !document.querySelector('dialog[open]')) SR.clear();
    });
  }

  /* ---------- Lazy loader for games, the SQL console and their styles ---------- */
  const loaded = {};
  const load = (src, css) => loaded[src] || (loaded[src] = new Promise((res, rej) => {
    const el = document.createElement(css ? 'link' : 'script');
    if (css) { el.rel = 'stylesheet'; el.href = src; } else { el.src = src; el.async = true; }
    el.onload = () => res();
    el.onerror = () => { delete loaded[src]; el.remove(); rej(new Error('Could not load ' + src)); };
    document.head.appendChild(el);
  }));
  SR.load = load;
  SR.games = SR.games || {};
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem('sr-best-' + k) || 'null'); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem('sr-best-' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  };
  const say = (msg) => { if (!status) return; status.textContent = ''; setTimeout(() => { status.textContent = msg; }, 40); };
  SR.say = say;

  /* ---------- Play: three games, loaded on first start ---------- */
  const play = $('#play');
  if (play) {
    const tabs = $$('.pt', play);
    const stage = $('#play-stage');
    const go = $('.ps-go', stage);
    const names = { forecast: 'Forecast it', badrows: 'Bad Row Patrol', doctor: 'Chart Doctor' };
    const showBest = (k) => { const b = store.get(k); const el = $(`[data-best="${k}"]`, play); if (el) el.textContent = b && b.label ? b.label : 'none yet'; };
    tabs.forEach((t) => showBest(t.dataset.game));
    const api = {
      motionOK, gsap: hasG ? G : null, announce: say,
      best: (k) => store.get(k),
      saveBest(k, value, label, lowerIsBetter) {
        const cur = store.get(k);
        const better = !cur || (lowerIsBetter ? value < cur.value : value > cur.value);
        if (better) { store.set(k, { value, label }); showBest(k); }
        return better;
      },
    };
    let current = null;
    let selected = 'forecast';
    const select = (k) => {
      selected = k;
      tabs.forEach((t) => { const on = t.dataset.game === k; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
      stage.setAttribute('aria-labelledby', 'pt-' + k);
      if (go) go.firstChild.textContent = 'Start ' + names[k];
    };
    const open = async (k) => {
      select(k);
      if (current && SR.games[current] && SR.games[current].unmount) SR.games[current].unmount();
      current = null;
      stage.innerHTML = `<p class="ps-load">Loading ${names[k]}…</p>`;
      try { await Promise.all([load('assets/play/play.css', true), load(`assets/play/${k}.js`)]); } catch (e) {
        stage.innerHTML = '<p class="ps-load">The game could not load. Check the connection and pick it again.</p>';
        return;
      }
      stage.innerHTML = '';
      current = k;
      SR.games[k].mount(stage, api);
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => open(t.dataset.game));
      t.addEventListener('keydown', (e) => {
        let j = -1;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % tabs.length;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') j = 0;
        else if (e.key === 'End') j = tabs.length - 1;
        if (j < 0) return;
        e.preventDefault();
        tabs.forEach((x, n) => { x.tabIndex = n === j ? 0 : -1; });
        tabs[j].focus();
      });
    });
    if (go) go.addEventListener('click', () => open(selected));
    if ('IntersectionObserver' in window) {
      const warm = new IntersectionObserver((es) => { if (es[0].isIntersecting) { load('assets/play/play.css', true).catch(() => {}); warm.disconnect(); } }, { rootMargin: '600px 0px' });
      warm.observe(play);
    }
  }

  /* ---------- SQL console: "/" anywhere, the console links, or #sql ---------- */
  const openSQL = async (opener) => {
    try { await Promise.all([load('assets/console.css', true), load('assets/console.js')]); } catch (e) { say('The SQL console could not load.'); return; }
    if (SR.sql) SR.sql.open(opener);
  };
  $$('.q-open').forEach((b) => b.addEventListener('click', () => openSQL(b)));
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (document.querySelector('dialog[open]') || (menu && menu.open)) return;
    e.preventDefault();
    openSQL(document.activeElement);
  });
  if (location.hash === '#sql') openSQL(null);

  /* ---------- Scroll readout: the page read like a query (decorative) ---------- */
  const scan = $('.scan');
  const scanLine = $('.scan-line');
  if (scan || scanLine) {
    const sel = '.kpi, .role, .sk-cloud .chip, .cs, .proj, .pt, .r-item';
    const secs = [['intro', $('.hero')]].concat($$('main > .section').map((s) => [s.id, s]));
    const tEl = scan && $('.scan-t b', scan);
    const nEl = scan && $('.scan-n', scan);
    let tops = [], secTops = [], docH = 0, pending = false;
    const measure = () => {
      const y = scrollY;
      tops = $$(sel).filter((r) => r.offsetParent !== null).map((r) => r.getBoundingClientRect().top + y).sort((a, b) => a - b);
      secTops = secs.filter((s) => s[1]).map(([n, el]) => [n, el.getBoundingClientRect().top + y]);
      docH = document.documentElement.scrollHeight;
    };
    const update = () => {
      pending = false;
      const bottom = scrollY + innerHeight;
      let lo = 0, hi = tops.length;
      while (lo < hi) { const m = (lo + hi) >> 1; if (tops[m] < bottom) lo = m + 1; else hi = m; }
      const done = bottom >= docH - 4;
      const total = tops.length;
      const n = done ? total : lo;
      let name = 'intro';
      for (const [k, t] of secTops) if (t <= scrollY + innerHeight * 0.4) name = k;
      if (tEl) tEl.textContent = name;
      if (nEl) nEl.textContent = `${n.toLocaleString('en-US')} / ${total.toLocaleString('en-US')} rows · ${Math.round((total ? n / total : 0) * 100)}%`;
      const p = (total ? n / total : 0).toFixed(3);
      if (scan) { scan.style.setProperty('--p', p); scan.classList.toggle('is-done', done); }
      if (scanLine) scanLine.style.setProperty('--p', p);
    };
    const req = () => { if (!pending) { pending = true; requestAnimationFrame(update); } };
    const remeasure = () => { measure(); req(); };
    measure(); update();
    addEventListener('scroll', req, { passive: true });
    addEventListener('resize', remeasure);
    addEventListener('load', remeasure);
    if ('ResizeObserver' in window) { let rt = 0; new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(remeasure, 120); }).observe(document.body); }
  }
})();
