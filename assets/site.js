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
})();
