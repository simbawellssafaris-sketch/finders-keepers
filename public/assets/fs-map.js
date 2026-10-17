/* Finders Safaris — itinerary route map.
   Pale cartography, a directional route, and pins that follow the itinerary
   as the reader scrolls. Needs fs-geo.js and a window.FS_ROUTE config. */
(function () {
  'use strict';

  var GEO = window.FS_GEO;
  var CFG = window.FS_ROUTE;
  if (!GEO || !CFG) return;

  var NS = 'http://www.w3.org/2000/svg';
  function el(n, a) {
    var e = document.createElementNS(NS, n);
    for (var k in a) if (a[k] !== null && a[k] !== undefined) e.setAttribute(k, a[k]);
    return e;
  }

  var STATIC = !!CFG.static;
  var single = CFG.stops.length === 1;

  var host = STATIC
    ? document.querySelector('.map-frame')
    : (document.querySelector('.map-sticky') || document.querySelector('[data-fs-map]'));
  if (!host) return;

  /* ---------- projection ----------
     Equirectangular with longitudes squeezed by cos(mid-latitude), so shapes
     keep sensible proportions at country scale. */
  var lat0 = CFG.stops.reduce(function (s, p) { return s + p[1]; }, 0) / CFG.stops.length;
  var kx = Math.cos(lat0 * Math.PI / 180);
  function px(lon) { return lon * kx * 100; }
  function py(lat) { return -lat * 100; }

  function ringPath(ring) {
    var d = '';
    for (var i = 0; i < ring.length; i++)
      d += (i ? 'L' : 'M') + px(ring[i][0]).toFixed(1) + ' ' + py(ring[i][1]).toFixed(1);
    return d + 'Z';
  }
  function shapePath(rec) { return rec.r.map(ringPath).join(''); }

  /* ---------- scaffolding ---------- */
  var placeholder = host.querySelector('.map-placeholder');
  if (placeholder) placeholder.remove();
  if (STATIC) { host.textContent = ''; host.style.position = 'relative'; host.style.display = 'block'; }

  var wrap = document.createElement('div');
  wrap.className = STATIC ? 'fsm fsm-static' : 'fsm';
  var svg = el('svg', { class: 'fsm-svg', xmlns: NS, preserveAspectRatio: 'xMidYMid meet' });
  wrap.appendChild(svg);

  var gContext = el('g', { class: 'fsm-context' });
  var gFocus   = el('g', { class: 'fsm-focus' });
  var gLakes   = el('g', { class: 'fsm-lakes' });
  var gName    = el('g', { class: 'fsm-names' });
  var gRoute   = el('g', { class: 'fsm-route' });
  var gArrows  = el('g', { class: 'fsm-arrows' });
  var gPins    = el('g', { class: 'fsm-pins' });
  [gContext, gFocus, gLakes, gName, gRoute, gArrows, gPins].forEach(function (g) { svg.appendChild(g); });

  var region = CFG.region || 'africa';
  Object.keys(GEO.context).forEach(function (id) {
    var rec = GEO.context[id];
    if (rec.g.indexOf(region) === -1) return;
    gContext.appendChild(el('path', { d: shapePath(rec), class: 'fsm-land' }));
  });
  Object.keys(GEO.focus).forEach(function (id) {
    if (id === CFG.focus) return;
    var rec = GEO.focus[id];
    if (rec.g.indexOf(region) === -1) return;
    gContext.appendChild(el('path', { d: shapePath(rec), class: 'fsm-land' }));
  });

  /* real lakes traced on top of the land, so a route near Victoria or
     Kariba reads against actual water rather than a flat background */
  if (GEO.lakes) Object.keys(GEO.lakes).forEach(function (id) {
    var rec = GEO.lakes[id];
    if (rec.g.indexOf(region) === -1) return;
    gLakes.appendChild(el('path', { d: shapePath(rec), class: 'fsm-lake' }));
  });

  var focusRec = CFG.focus && GEO.focus[CFG.focus];
  if (focusRec) gFocus.appendChild(el('path', { d: shapePath(focusRec), class: 'fsm-country' }));

  /* the country's own name, set quietly into the map like an atlas */
  var nameText = null;
  if (focusRec && focusRec.c && focusRec.n) {
    nameText = el('text', {
      class: 'fsm-countryname', x: px(focusRec.c[0]).toFixed(1),
      y: py(focusRec.c[1]).toFixed(1), 'text-anchor': 'middle'
    });
    nameText.textContent = focusRec.n.toUpperCase();
    gName.appendChild(nameText);
  }

  /* ---------- route ---------- */
  var pts = CFG.stops.map(function (s) { return [px(s[2]), py(s[1])]; });

  /* a gentle bow, and the control point back so we can sit an arrow on it */
  function arc(a, b) {
    var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    var dx = b[0] - a[0], dy = b[1] - a[1];
    var len = Math.hypot(dx, dy) || 1;
    var k = Math.min(len * 0.14, 80);
    var c = [mx - dy / len * k, my + dx / len * k];
    return {
      d: 'M' + a[0].toFixed(1) + ' ' + a[1].toFixed(1) +
         'Q' + c[0].toFixed(1) + ' ' + c[1].toFixed(1) + ' ' + b[0].toFixed(1) + ' ' + b[1].toFixed(1),
      /* midpoint of a quadratic is ¼P0 + ½C + ¼P2; its tangent is simply P2−P0 */
      mid: [0.25 * a[0] + 0.5 * c[0] + 0.25 * b[0], 0.25 * a[1] + 0.5 * c[1] + 0.25 * b[1]],
      angle: Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI
    };
  }

  /* a journey that ends where it began gets a dashed closing leg */
  var returns = CFG.stops.length > 2 &&
    CFG.stops[0][0].toLowerCase() === CFG.stops[CFG.stops.length - 1][0].toLowerCase();

  var legs = [], arrows = [];
  if (!STATIC) {
    for (var i = 0; i < pts.length - 1; i++) {
      var a = arc(pts[i], pts[i + 1]);
      var cls = 'fsm-leg' + (returns && i === pts.length - 2 ? ' is-return' : '');
      legs.push(gRoute.appendChild(el('path', { d: a.d, class: cls })));
      var mk = el('path', {
        class: 'fsm-arrow', d: 'M-5 -4.4 L5.4 0 L-5 4.4 Z',
        transform: 'translate(' + a.mid[0].toFixed(1) + ',' + a.mid[1].toFixed(1) + ') rotate(' + a.angle.toFixed(1) + ')'
      });
      mk.__at = a;
      arrows.push(gArrows.appendChild(mk));
    }
  }

  var dots = [], labels = [];
  var pins = CFG.stops.map(function (s, idx) {
    var g = el('g', { class: 'fsm-pin', transform: 'translate(' + pts[idx][0].toFixed(1) + ',' + pts[idx][1].toFixed(1) + ')' });
    var dot = el('circle', { class: 'fsm-dot', r: 6 });
    var t = el('text', { class: 'fsm-label', x: 0, y: 0, 'text-anchor': 'middle' });
    t.textContent = s[0];
    g.appendChild(dot); g.appendChild(t);
    dots.push(dot); labels.push(t);
    gPins.appendChild(g);
    return g;
  });

  /* Everything above is drawn in map units, so rescale it each frame to hold a
     constant on-screen size however far we are zoomed in. */
  function rescale(vbWidth) {
    var w = host.getBoundingClientRect().width || 700;
    var k = vbWidth / w;
    for (var i = 0; i < dots.length; i++) {
      dots[i].setAttribute('r', (5 * k).toFixed(2));
      labels[i].setAttribute('y', (16 * k).toFixed(2));
      labels[i].setAttribute('font-size', (11 * k).toFixed(2));
      labels[i].setAttribute('stroke-width', (3.5 * k).toFixed(2));
    }
    for (var j = 0; j < arrows.length; j++) {
      var a = arrows[j].__at;
      arrows[j].setAttribute('transform',
        'translate(' + a.mid[0].toFixed(1) + ',' + a.mid[1].toFixed(1) + ') rotate(' + a.angle.toFixed(1) + ') scale(' + k.toFixed(3) + ')');
    }
    if (nameText) {
      nameText.setAttribute('font-size', (13 * k).toFixed(2));
      nameText.setAttribute('letter-spacing', (2.4 * k).toFixed(2));
    }
  }

  /* ---------- framing ---------- */
  var MIN_SPAN = 260;
  function boundsOf(list, pad, minSpan) {
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    list.forEach(function (p) {
      x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]);
      y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
    });
    var min = minSpan || MIN_SPAN;
    var w = x1 - x0, h = y1 - y0;
    if (w < min) { var cx = (x0 + x1) / 2; x0 = cx - min / 2; w = min; }
    if (h < min) { var cy = (y0 + y1) / 2; y0 = cy - min / 2; h = min; }
    var m = Math.max(w, h) * pad;
    return [x0 - m, y0 - m, w + m * 2, h + m * 2];
  }

  var overview;
  if (focusRec) {
    var b = focusRec.b;
    overview = boundsOf([[px(b[0]), py(b[1])], [px(b[2]), py(b[3])]].concat(pts), 0.10);
  } else {
    overview = boundsOf(pts, single ? 0.35 : 0.85, single ? 900 : undefined);
  }

  function fitAspect(vb) {
    var r = host.getBoundingClientRect();
    var pa = (r.width && r.height) ? r.width / r.height : 0.8;
    var x = vb[0], y = vb[1], w = vb[2], h = vb[3];
    var cx = x + w / 2, cy = y + h / 2;
    if (w / h < pa) w = h * pa; else h = w / pa;
    return [cx - w / 2, cy - h / 2, w, h];
  }

  var cur = fitAspect(overview);
  function apply(v) {
    svg.setAttribute('viewBox', v.map(function (n) { return n.toFixed(1); }).join(' '));
    rescale(v[2]);
  }
  apply(cur);

  var raf = null, DUR = 900;
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function tweenTo(target) {
    var from = cur.slice(), t0 = performance.now();
    if (raf) cancelAnimationFrame(raf);
    (function step(now) {
      var t = Math.min(1, (now - t0) / DUR), e = ease(t);
      cur = from.map(function (v, i) { return v + (target[i] - v) * e; });
      apply(cur);
      if (t < 1) raf = requestAnimationFrame(step);
    })(performance.now());
  }

  /* ---------- chrome ---------- */
  var controls = document.createElement('div');
  controls.className = 'fsm-controls';
  controls.innerHTML =
    '<button type="button" class="fsm-btn" data-act="in"  aria-label="Zoom in">+</button>' +
    '<button type="button" class="fsm-btn" data-act="out" aria-label="Zoom out">−</button>' +
    '<button type="button" class="fsm-btn fsm-btn-fit" data-act="fit" aria-label="Show whole route">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/><path d="M11 8v6"/><path d="M8 11h6"/></svg>' +
    '</button>';
  wrap.appendChild(controls);

  function zoom(f) {
    var cx = cur[0] + cur[2] / 2, cy = cur[1] + cur[3] / 2;
    var w = cur[2] * f, h = cur[3] * f;
    tweenTo([cx - w / 2, cy - h / 2, w, h]);
  }
  controls.addEventListener('click', function (e) {
    var b = e.target.closest('.fsm-btn'); if (!b) return;
    var act = b.dataset.act;
    if (act === 'in') zoom(0.65);
    else if (act === 'out') zoom(1 / 0.65);
    else { active = -1; paint(-1); tweenTo(fitAspect(overview)); }
  });

  var cap = document.createElement('div');
  cap.className = 'fsm-caption';
  cap.innerHTML = '<span class="fsm-cap-idx"></span><span class="fsm-cap-name"></span>';
  wrap.appendChild(cap);

  host.appendChild(wrap);

  /* ---------- following the itinerary ---------- */
  var tags = STATIC ? [] : [].slice.call(document.querySelectorAll('.days-col .location-tag'));
  var active = -1;

  function paint(idx) {
    pins.forEach(function (g, i) {
      g.classList.toggle('is-active', i === idx);
      g.classList.toggle('is-done', idx > -1 && i < idx);
    });
    legs.forEach(function (p, i) { p.classList.toggle('is-done', idx > -1 && i < idx); });
    arrows.forEach(function (p, i) { p.classList.toggle('is-done', idx > -1 && i < idx); });
    var s = CFG.stops[idx];
    cap.querySelector('.fsm-cap-idx').textContent =
      s ? 'Stop ' + (idx + 1) + ' of ' + CFG.stops.length : '';
    cap.querySelector('.fsm-cap-name').textContent =
      s ? s[0] : (CFG.overviewLabel || 'Full route');
  }

  function setActive(idx, animate) {
    if (idx === active) return;
    active = idx;
    paint(idx);
    var near = [pts[idx]];
    if (pts[idx - 1]) near.push(pts[idx - 1]);
    if (pts[idx + 1]) near.push(pts[idx + 1]);
    var target = fitAspect(boundsOf(near, focusRec ? 0.55 : 1.2));
    if (animate) tweenTo(target); else { cur = target; apply(cur); }
  }

  function onScroll() {
    var mid = window.innerHeight * 0.45, idx = -1;
    for (var i = 0; i < tags.length; i++) {
      if (tags[i].getBoundingClientRect().top <= mid) idx = i; else break;
    }
    if (idx === -1) {
      if (active !== -1) { active = -1; paint(-1); tweenTo(fitAspect(overview)); }
      return;
    }
    setActive(Math.min(idx, CFG.stops.length - 1), true);
  }

  paint(-1);
  if (single) setActive(0, false);

  var ticking = false;
  if (!STATIC) window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { onScroll(); ticking = false; });
  }, { passive: true });

  window.addEventListener('resize', function () { apply(cur); });

  pins.forEach(function (g, i) {
    if (STATIC || !tags[i]) return;
    g.style.cursor = 'pointer';
    g.addEventListener('click', function () {
      tags[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });

  if (!STATIC && !single) onScroll();
})();
