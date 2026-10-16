// ─── Product page behaviour ──────────────────────────────────────
//   • the GitHub star count (from 10 stars on)
//   • the download for this device is highlighted
//   • the demo video plays only while on screen
//   • people who used the app at this address get "Open the app"
(function () {
  var REPO = 'thrishankkuntimaddi/ExpenseTracker';

  try {
    var cached = JSON.parse(localStorage.getItem('etl_gh') || 'null');
    var show = function (n) { if (n >= 10) document.querySelectorAll('[data-stars]').forEach(function (el) { el.textContent = n >= 1000 ? (n / 1000).toFixed(1) + 'k' : n; }); };
    if (cached && Date.now() - cached.at < 3600e3) show(cached.stars);
    else fetch('https://api.github.com/repos/' + REPO).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d) return;
      show(d.stargazers_count);
      try { localStorage.setItem('etl_gh', JSON.stringify({ stars: d.stargazers_count, at: Date.now() })); } catch (e) { /* private mode */ }
    }).catch(function () {});
  } catch (e) { /* storage unavailable */ }

  var ua = navigator.userAgent, pick = null;
  if (/Android/i.test(ua)) pick = 'android';
  else if (/iPhone|iPad|iPod/.test(ua)) pick = 'web';
  else if (/Windows/.test(ua)) pick = 'windows';
  else if (/Mac OS X|Macintosh/.test(ua)) pick = 'mac-arm';
  else if (/Linux/.test(ua)) pick = 'linux';
  var card = pick && document.querySelector('[data-platform="' + pick + '"]');
  if (card) {
    card.classList.add('suggested');
    var primary = document.querySelector('[data-download-primary]');
    if (primary && pick !== 'web') { primary.href = card.href; primary.textContent = 'Download for ' + card.querySelector('b').textContent; }
  }

  var vid = document.querySelector('video[data-autoplay]');
  if (vid && 'IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) vid.play().catch(function () {}); else vid.pause(); }); }, { threshold: 0.4 }).observe(vid);
  } else if (vid) vid.setAttribute('controls', '');

  try {
    if (Object.keys(localStorage).some(function (k) { return /^et_(device_id|theme|motion)/.test(k); })) document.getElementById('moved').hidden = false;
  } catch (e) { /* storage unavailable */ }
})();
