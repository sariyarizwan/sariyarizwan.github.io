// Enhancement only: the page is complete without this script.
(function () {
  var menu = document.querySelector('.nav-menu');
  if (menu) {
    menu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { menu.removeAttribute('open'); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.hasAttribute('open')) {
        menu.removeAttribute('open');
        menu.querySelector('summary').focus();
      }
    });
    document.addEventListener('click', function (e) {
      if (menu.hasAttribute('open') && !menu.contains(e.target)) menu.removeAttribute('open');
    });
  }

  var head = document.querySelector('.site-head');
  if (head) {
    var onScroll = function () { head.classList.toggle('scrolled', window.scrollY > 8); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // Keep the timeline current: recompute bar positions, the axis and the today marker from data-start/data-end.
  var tl = document.querySelector('.timeline');
  if (tl) {
    var now = new Date();
    var startY = 2021, endY = Math.max(2027, now.getFullYear() + 1);
    var span = (endY - startY) * 12;
    var monthIndex = function (ym) { var p = ym.split('-'); return (+p[0] - startY) * 12 + (+p[1] - 1); };
    var todayIdx = (now.getFullYear() - startY) * 12 + now.getMonth() + (now.getDate() - 1) / 31;
    var axis = tl.querySelector('.tl-axis');
    if (axis && endY !== 2027) {
      var labels = '';
      for (var y = startY; y <= endY; y++) labels += '<span style="left:' + ((y - startY) * 12 / span * 100) + '%">' + y + '</span>';
      axis.innerHTML = labels;
      tl.querySelectorAll('.tl-track').forEach(function (t) { t.style.backgroundSize = (100 / (endY - startY)) + '% 100%'; });
    }
    tl.querySelectorAll('.tl-bar[data-start]').forEach(function (bar) {
      var s = monthIndex(bar.dataset.start);
      var e = bar.dataset.end ? monthIndex(bar.dataset.end) + 1 : todayIdx;
      bar.style.left = (s / span * 100) + '%';
      bar.style.width = (Math.max(e - s, 0.5) / span * 100) + '%';
    });
    var mark = tl.querySelector('.tl-today');
    if (mark) mark.style.setProperty('--x', String(Math.min(todayIdx / span, 1)));
  }

  // Mark the nav link for the section currently in view.
  var links = Array.prototype.slice.call(document.querySelectorAll('.nav-desk a[href^="#"]'));
  if (!links.length || !('IntersectionObserver' in window)) return;
  var byId = {};
  links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      links.forEach(function (a) { a.removeAttribute('aria-current'); });
      var link = byId[entry.target.id];
      if (link) link.setAttribute('aria-current', 'true');
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  Object.keys(byId).forEach(function (id) {
    var el = document.getElementById(id);
    if (el) io.observe(el);
  });
})();
