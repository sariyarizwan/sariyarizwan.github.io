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
    if (metaTheme) metaTheme.setAttribute('content', t === 'light' ? '#F3F5F8' : '#07090D');
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

  /* ---------- Cursor light on cards ---------- */
  if (matchMedia('(hover: hover)').matches) {
    let raf = 0, ev = null;
    document.addEventListener('pointermove', (e) => {
      ev = e;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const card = ev.target.closest && ev.target.closest('.card');
        if (!card) return;
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${ev.clientX - r.left}px`);
        card.style.setProperty('--my', `${ev.clientY - r.top}px`);
      });
    }, { passive: true });
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
})();
