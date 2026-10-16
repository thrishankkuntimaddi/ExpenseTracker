// ─── Product page behaviour ──────────────────────────────────────
//   • sections fade in as they appear
//   • live GitHub stars / forks / latest version
//   • the download for this device is highlighted
//   • the demo video plays only while on screen
//   • star rating + note → a prefilled GitHub feedback issue
(function () {
  var REPO = 'thrishankkuntimaddi/ExpenseTracker';

  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  } else reveals.forEach(function (el) { el.classList.add('in'); });

  // GitHub numbers (cached for an hour: the API allows 60 calls an hour per visitor)
  function fmt(n) { return n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : String(n); }
  function show(d) {
    // A count only once it means something; the stats card always shows it
    document.querySelectorAll('[data-stars]').forEach(function (el) { el.textContent = d.stars >= 10 || el.tagName === 'DD' ? fmt(d.stars) : ''; });
    document.querySelectorAll('[data-forks]').forEach(function (el) { el.textContent = fmt(d.forks); });
    // Small numbers read as "nobody uses this": show them from 10 stars on
    document.querySelectorAll('.repo-stats [data-stars], .repo-stats [data-forks]').forEach(function (el) { el.parentNode.hidden = d.stars < 10; });
    if (d.version) document.querySelectorAll('[data-version]').forEach(function (el) { el.textContent = d.version; });
  }
  try {
    var cached = JSON.parse(localStorage.getItem('etl_gh') || 'null');
    if (cached && Date.now() - cached.at < 3600e3) show(cached);
    else Promise.all([
      fetch('https://api.github.com/repos/' + REPO).then(function (r) { return r.ok ? r.json() : null; }),
      fetch('https://api.github.com/repos/' + REPO + '/releases/latest').then(function (r) { return r.ok ? r.json() : null; }),
    ]).then(function (res) {
      if (!res[0]) return;
      var d = { stars: res[0].stargazers_count, forks: res[0].forks_count, version: res[1] && res[1].tag_name, at: Date.now() };
      show(d);
      try { localStorage.setItem('etl_gh', JSON.stringify(d)); } catch { /* private mode */ }
    }).catch(function () {});
  } catch { /* storage unavailable */ }

  // The download for this device
  var ua = navigator.userAgent, pick = null;
  if (/Android/i.test(ua)) pick = 'android';
  else if (/iPhone|iPad|iPod/.test(ua)) pick = 'web';
  else if (/Windows/.test(ua)) pick = 'windows';
  else if (/Mac OS X|Macintosh/.test(ua)) pick = 'mac-arm';
  else if (/Linux/.test(ua)) pick = 'linux';
  if (pick) {
    var card = document.querySelector('[data-platform="' + pick + '"]');
    if (card) {
      card.classList.add('suggested');
      document.querySelectorAll('[data-download-primary]').forEach(function (primary) {
        if (pick !== 'web') { primary.href = card.href; primary.textContent = 'Download for ' + card.querySelector('b').textContent.replace(' — Apple chip', ''); }
      });
    }
  }

  // Demo video: play while visible (muted), pause when not
  var vid = document.querySelector('video[data-autoplay]');
  if (vid && 'IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) vid.play().catch(function () {}); else vid.pause(); }); }, { threshold: 0.4 }).observe(vid);
  } else if (vid) vid.setAttribute('controls', '');

  // Feedback: stars + note → a prefilled GitHub issue
  var rating = 0, send = document.getElementById('fb-send'), text = document.getElementById('fb-text');
  var stars = document.querySelectorAll('[data-rate]');
  function paint() { stars.forEach(function (s) { var on = Number(s.dataset.rate) <= rating; s.classList.toggle('on', on); s.setAttribute('aria-checked', String(Number(s.dataset.rate) === rating)); }); update(); }
  function update() {
    var title = rating ? 'Feedback: ' + '★'.repeat(rating) + '☆'.repeat(5 - rating) : 'Feedback';
    var body = (rating ? 'Rating: ' + rating + '/5\n\n' : '') + (text.value.trim() || '(write your note here)') + '\n\n— sent from the product page';
    send.href = 'https://github.com/' + REPO + '/issues/new?labels=feedback&title=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(body);
  }
  stars.forEach(function (s) { s.addEventListener('click', function () { rating = Number(s.dataset.rate); paint(); }); });
  if (text) text.addEventListener('input', update);

})();
