/* ============================================================
   CANON COLLAGE SHOWCASE — scroll engine
   drives: WebGL state, reveals, parallax,
   horizontal shutter strip, manifesto words, aperture HUD,
   nav / HUD, cursor
   ============================================================ */
(function () {
  'use strict';

  var S = window.SHOWTIME || (window.SHOWTIME = { scroll: 0, vel: 0, mx: 0.5, my: 0.5 });
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* -------------------------------------------------- LOADER */
  (function loader() {
    var bar = $('.loader-bar i');
    var pct = $('.loader-pct');
    var p = 0, done = false;
    var start = performance.now();
    var q = new URLSearchParams(location.search);

    // intro is time-based so lazy-loaded images below the fold never stall it
    var tick = setInterval(function () {
      var elapsed = performance.now() - start;
      p = Math.max(p, Math.min(96, (elapsed / 1500) * 100 + Math.random() * 4));
      if (bar) bar.style.width = p.toFixed(1) + '%';
      if (pct) pct.textContent = (p < 10 ? '0' : '') + Math.floor(p);
    }, 90);

    var imgs = $$('img[loading="eager"]');
    var loaded = imgs.length;
    imgs.forEach(function (im) {
      if (im.complete) return;
      var bump = function () { loaded++; };
      im.addEventListener('load', bump, { once: true });
      im.addEventListener('error', bump, { once: true });
    });

    function finish() {
      if (done) return; done = true;
      clearInterval(tick);
      if (bar) bar.style.width = '100%';
      if (pct) pct.textContent = '100';
      setTimeout(function () {
        document.body.classList.remove('is-loading');
        document.body.classList.add('loaded');
        kickReveals();
      }, 320);
    }
    if (document.readyState === 'complete') setTimeout(finish, 850);
    else window.addEventListener('load', function () { setTimeout(finish, 450); });
    setTimeout(finish, 3600); // hard safety

    /* debug helpers:
       ?nointro=1  skip the intro
       ?y=1234     jump to a scroll offset
       ?shot=1     screenshot mode (nointro + no animation)      */
    if (q.has('shot')) document.documentElement.classList.add('shot-mode');
    if (q.has('nointro') || q.has('shot')) { clearInterval(tick); finish(); }
    if (q.has('y')) {
      window.addEventListener('load', function () {
        setTimeout(function () {
          window.scrollTo({ top: parseInt(q.get('y'), 10) || 0, behavior: 'instant' });
        }, 250);
      });
    }
  })();

  /* -------------------------------------------------- REVEALS */
  var revealObs = null;
  function kickReveals() {
    var targets = $$('.reveal, .reveal-group');
    if (!('IntersectionObserver' in window)) {
      targets.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    revealObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); revealObs.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
    targets.forEach(function (el) { revealObs.observe(el); });
  }
  kickReveals();

  /* -------------------------------------------------- MANIFESTO WORDS */
  var manifesto = $('#manifesto-text');
  var words = [];
  if (manifesto) {
    var raw = manifesto.textContent.replace(/\s+/g, ' ').trim().split(' ');
    var hot = { SELL: 1, CARTS: 1, CHECKOUT: 1, NO: 1 };
    manifesto.innerHTML = raw.map(function (w) {
      var key = w.replace(/[^A-Z']/g, '');
      return '<span class="w' + (hot[key] ? ' hot' : '') + '">' + w + '</span>';
    }).join(' ');
    words = $$('.w', manifesto);
  }

  /* -------------------------------------------------- SECTION HUD / NAV */
  var sections = $$('[data-hud]');
  var hudNum = $('#hud-num'), hudLabel = $('#hud-label');
  var navLinks = $$('.nav-links a');

  function updateHUD() {
    var mid = window.innerHeight * 0.5, best = null, bestD = Infinity;
    for (var i = 0; i < sections.length; i++) {
      var r = sections[i].getBoundingClientRect();
      if (r.top <= mid && r.bottom >= mid) { best = sections[i]; break; }
      var d = Math.min(Math.abs(r.top - mid), Math.abs(r.bottom - mid));
      if (d < bestD) { bestD = d; best = sections[i]; }
    }
    if (!best) return;
    var n = best.getAttribute('data-hud');
    if (hudNum && hudNum.textContent !== n) hudNum.textContent = n;
    var l = best.getAttribute('data-hud-label');
    if (hudLabel && hudLabel.textContent !== l) hudLabel.textContent = l;

    var id = best.id;
    navLinks.forEach(function (a) {
      a.classList.toggle('on', a.getAttribute('href') === '#' + id);
    });
  }

  /* -------------------------------------------------- APERTURE HUD */
  var blades = $('#ap-blades');
  var fstop = $('#fstop');
  var STOPS = ['f/1.4', 'f/2', 'f/2.8', 'f/4', 'f/5.6', 'f/8', 'f/11', 'f/16', 'f/22'];
  var lastStop = '';

  /* -------------------------------------------------- ELEMENTS */
  var parallaxEls = $$('[data-speed]');
  var strip = $('#strip-track');
  var stripSec = $('#shutter');
  var stripMeter = $('#strip-meter');
  var progressBar = $('#progress-bar');
  var nav = $('.nav');

  var stripDist = 0;
  function measure() {
    if (strip) stripDist = Math.max(0, strip.scrollWidth - window.innerWidth);
  }
  measure();
  window.addEventListener('resize', measure);
  window.addEventListener('load', measure);

  /* -------------------------------------------------- POINTER -> GL */
  document.addEventListener('mousemove', function (e) {
    S.mx = e.clientX / window.innerWidth;
    S.my = 1 - e.clientY / window.innerHeight;
  }, { passive: true });

  /* -------------------------------------------------- FRAME LOOP */
  var smoothScroll = 0, prevSmooth = 0;

  function frame() {
    requestAnimationFrame(frame);

    var vh = window.innerHeight;
    var max = Math.max(1, document.documentElement.scrollHeight - vh);
    var raw = clamp(window.scrollY / max, 0, 1);

    // smoothed page progress + velocity
    smoothScroll = lerp(smoothScroll, raw, reduced ? 1 : 0.09);
    var v = smoothScroll - prevSmooth;
    prevSmooth = smoothScroll;
    S.vel = lerp(S.vel, clamp(v * 9, -1, 1), 0.18);
    S.scroll = smoothScroll;

    if (progressBar) progressBar.style.transform = 'scaleX(' + smoothScroll.toFixed(4) + ')';
    if (nav) nav.classList.toggle('stuck', window.scrollY > 40);

    // aperture HUD — stop down as you descend, blades swirl with the scroll
    if (blades) blades.setAttribute('transform', 'rotate(' + (smoothScroll * 320).toFixed(1) + ' 50 50)');
    if (fstop) {
      var s = STOPS[clamp(Math.round(smoothScroll * (STOPS.length - 1)), 0, STOPS.length - 1)];
      if (s !== lastStop) { lastStop = s; fstop.textContent = s; }
    }

    // parallax (read rects first, then write — no layout thrash)
    if (!reduced) {
      var i, rect;
      for (i = 0; i < parallaxEls.length; i++) {
        rect = parallaxEls[i].getBoundingClientRect();
        parallaxEls[i]._vis = rect.bottom > -100 && rect.top < vh + 100;
        parallaxEls[i]._y = ((rect.top + rect.height / 2) - vh / 2) *
                             parseFloat(parallaxEls[i].getAttribute('data-speed'));
      }
      for (i = 0; i < parallaxEls.length; i++) {
        if (parallaxEls[i]._vis) {
          parallaxEls[i].style.translate = '0 ' + parallaxEls[i]._y.toFixed(1) + 'px';
        }
      }
    }

    // horizontal SHUTTER strip
    if (strip && stripSec) {
      var sr = stripSec.getBoundingClientRect();
      var sp = clamp(-sr.top / Math.max(1, sr.height - vh), 0, 1);
      strip.style.transform = 'translate3d(' + (-sp * stripDist).toFixed(1) + 'px,0,0)';
      if (stripMeter) stripMeter.style.width = (sp * 100).toFixed(1) + '%';
    }

    // manifesto word reveal
    if (manifesto && words.length) {
      var mr = manifesto.getBoundingClientRect();
      if (mr.bottom > -100 && mr.top < vh + 100) {
        var wp = clamp((vh * 0.84 - mr.top) / (mr.height + vh * 0.22), 0, 1);
        var count = Math.round(wp * words.length * 1.14);
        for (var w = 0; w < words.length; w++) {
          var on = w < count;
          if (on !== words[w]._on) {
            words[w]._on = on;
            words[w].classList.toggle('on', on);
          }
        }
      }
    }

    updateHUD();
  }
  requestAnimationFrame(frame);

  /* -------------------------------------------------- CURSOR */
  var cursor = $('.cursor');
  if (cursor && window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
    var dot = $('.cursor-dot', cursor), ring = $('.cursor-ring', cursor);
    var mx = -100, my = -100, rx = -100, ry = -100;

    document.addEventListener('mousemove', function (e) {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = 'translate(' + mx + 'px,' + my + 'px) translate(-50%,-50%)';
    });
    (function cursorLoop() {
      rx = lerp(rx, mx, 0.16); ry = lerp(ry, my, 0.16);
      ring.style.transform = 'translate(' + rx.toFixed(1) + 'px,' + ry.toFixed(1) + 'px) translate(-50%,-50%)';
      requestAnimationFrame(cursorLoop);
    })();

    document.addEventListener('mouseover', function (e) {
      if (e.target.closest('a,button,[data-cursor],.cut')) cursor.classList.add('is-hover');
    });
    document.addEventListener('mouseout', function (e) {
      if (e.target.closest('a,button,[data-cursor],.cut')) cursor.classList.remove('is-hover');
    });
    document.addEventListener('mousedown', function () { cursor.classList.add('is-down'); });
    document.addEventListener('mouseup', function () { cursor.classList.remove('is-down'); });
  }

  /* -------------------------------------------------- ANCHOR SCROLL */
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (id.length < 2) return;
      var el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: reduced ? 'instant' : 'smooth' });
    });
  });

  /* -------------------------------------------------- SAFETY: no GL */
  if (document.body.classList.contains('no-gl')) {
    document.documentElement.style.background = '#08080a';
  }

  console.log('%c CANON COLLAGE SHOWCASE ',
    'background:#e4002b;color:#fff;font-weight:bold;padding:4px 8px',
    '| scroll-driven WebGL — showcase only, nothing for sale.');
})();
