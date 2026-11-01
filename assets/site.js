// Enhancement only: the page is complete without this script.
(function () {
  var menu = document.querySelector('.nav-menu');
  if (!menu) return;
  menu.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () { menu.removeAttribute('open'); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menu.hasAttribute('open')) {
      menu.removeAttribute('open');
      menu.querySelector('summary').focus();
    }
  });
})();
