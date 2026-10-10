/* ============================================================
   Donation Plinko: interaction layer
   Includes a small purpose-built physics sim for the coin demo.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- header, nav, reveals ---------- */

  var header = document.getElementById('siteHeader');
  var hamburger = document.getElementById('hamburger');
  var overlay = document.getElementById('navOverlay');
  var HEADER_H = 72;

  function onScroll() {
    if (header) header.classList.toggle('scrolled', window.scrollY > 12);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  function closeMenu() {
    if (!hamburger || !overlay) return;
    hamburger.classList.remove('active');
    hamburger.setAttribute('aria-expanded', 'false');
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  if (hamburger && overlay) {
    hamburger.addEventListener('click', function () {
      var open = overlay.classList.contains('open');
      if (open) { closeMenu(); return; }
      hamburger.classList.add('active');
      hamburger.setAttribute('aria-expanded', 'true');
      overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
    });
    overlay.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { closeMenu(); });
    });
  }

  /* smooth scroll with header offset */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (!id || id === '#') return;
      var el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      var y = el.getBoundingClientRect().top + window.scrollY - HEADER_H - 12;
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    });
  });

  /* reveal on scroll */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        var sibs = Array.prototype.slice.call(
          el.parentElement ? el.parentElement.querySelectorAll(':scope > .reveal') : [el]
        );
        var i = Math.max(0, sibs.indexOf(el));
        el.style.transitionDelay = Math.min(i * 90, 360) + 'ms';
        el.classList.add('in');
        ro.unobserve(el);
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -60px 0px' });
    reveals.forEach(function (el) { ro.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }

  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---------- the Plinko demo ---------- */

  var canvas = document.getElementById('plinkoCanvas');
  var dropBtn = document.getElementById('dropBtn');
  var dropCountEl = document.getElementById('dropCount');
  if (!canvas || !canvas.getContext) return;

  var ctx = canvas.getContext('2d');
  var W = 0, H = 0, DPR = 1;

  var ROWS = 8;            // peg rows
  var COLS0 = 3;           // pegs in the first row
  var S = 46;              // peg spacing (recomputed on resize)
  var PR = 6;              // peg radius
  var BR = 7.2;            // ball radius
  var MARGIN_X = 0;
  var Y_TOP = 0;
  var Y_ROW = 0;
  var Y_LAST = 0;
  var FLOOR_Y = 0;
  var SLOTS = 11;

  var pegs = [];
  var balls = [];
  var flashes = [];        // {slot, t}
  var dropped = 0;

  var GRAVITY = 1450;
  var RESTITUTION = 0.44;
  var JITTER = 0.30;       // tangential randomness on peg hits
  var WALL_DAMP = 0.55;

  var COL = {
    peg: '#2B333D',
    pegRim: 'rgba(227,168,60,.55)',
    pegTop: 'rgba(255,255,255,.13)',
    coin0: '#F7D68F',
    coin1: '#D9A33C',
    coin2: '#8E6416',
    line: 'rgba(255,255,255,.06)'
  };

  function layout() {
    var rect = canvas.getBoundingClientRect();
    W = Math.max(240, Math.round(rect.width));
    H = Math.max(220, Math.round(rect.height));
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    MARGIN_X = Math.max(14, W * 0.075);
    var usable = W - MARGIN_X * 2;
    var widest = COLS0 + (ROWS - 1);          // pegs in the last row
    S = usable / (widest - 1);
    PR = Math.max(3.2, S * 0.135);
    BR = Math.max(4.0, S * 0.155);

    Y_TOP = H * 0.145;
    FLOOR_Y = H * 0.845;
    Y_ROW = (H * 0.775 - Y_TOP) / (ROWS - 1);
    Y_LAST = Y_TOP + (ROWS - 1) * Y_ROW;

    pegs = [];
    for (var r = 0; r < ROWS; r++) {
      var n = COLS0 + r;
      var span = (n - 1) * S;
      var x0 = (W - span) / 2;
      for (var c = 0; c < n; c++) {
        pegs.push({ x: x0 + c * S, y: Y_TOP + r * Y_ROW, r: PR });
      }
    }
  }

  function slotWidth() { return W / SLOTS; }
  function slotOf(x) {
    var i = Math.floor(x / slotWidth());
    return Math.max(0, Math.min(SLOTS - 1, i));
  }

  function makeBall() {
    return {
      x: W / 2 + (Math.random() - 0.5) * Math.min(10, W * 0.03),
      y: -BR * 2,
      vx: (Math.random() - 0.5) * 14,
      vy: 0,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 7,
      still: 0,
      rest: 0,
      dead: false
    };
  }

  function drop() {
    if (balls.length > 7) return;
    balls.push(makeBall());
    dropped++;
    if (dropCountEl) dropCountEl.textContent = String(dropped);
  }

  function step(dt) {
    for (var i = balls.length - 1; i >= 0; i--) {
      var b = balls[i];

      /* resting in a slot: hold for a beat, then fade out */
      if (b.rest > 0) {
        b.rest += dt;
        b.vr *= 0.90;
        b.rot += b.vr * dt;
        if (b.rest > 1.15) balls.splice(i, 1);
        continue;
      }

      b.vy += GRAVITY * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.rot += b.vr * dt;
      b.vr *= 0.995;

      /* walls */
      if (b.x < BR) { b.x = BR; b.vx = Math.abs(b.vx) * WALL_DAMP; b.vr += 1.2; }
      if (b.x > W - BR) { b.x = W - BR; b.vx = -Math.abs(b.vx) * WALL_DAMP; b.vr -= 1.2; }

      /* pegs */
      for (var p = 0; p < pegs.length; p++) {
        var pg = pegs[p];
        var dx = b.x - pg.x;
        var dy = b.y - pg.y;
        var minD = BR + pg.r;
        if (dx * dx + dy * dy > (minD + 1) * (minD + 1)) continue;

        var d = Math.sqrt(dx * dx + dy * dy) || 0.0001;
        var nx = dx / d;
        var ny = dy / d;

        /* separate */
        b.x = pg.x + nx * (minD + 0.35);
        b.y = pg.y + ny * (minD + 0.35);

        var vn = b.vx * nx + b.vy * ny;
        if (vn < 0) {
          b.vx -= (1 + RESTITUTION) * vn * nx;
          b.vy -= (1 + RESTITUTION) * vn * ny;
          /* tangential nudge so it never balances on a peg */
          var tx = -ny, ty = nx;
          var j = (Math.random() - 0.5) * JITTER * Math.abs(vn);
          b.vx += tx * j;
          b.vy += ty * j;
          b.vr += (Math.random() - 0.5) * 2.4;
        }
      }

      /* anti-stall: if it barely moves, kick it */
      if (Math.abs(b.vy) < 26 && Math.abs(b.vx) < 14) {
        b.still += dt;
        if (b.still > 0.16) {
          b.vx += (Math.random() - 0.5) * 90;
          b.vy += 40;
          b.still = 0;
        }
      } else { b.still = 0; }

      /* landing: settle into the slot */
      if (b.y + BR >= FLOOR_Y) {
        b.y = FLOOR_Y - BR;
        b.vx = 0;
        b.vy = 0;
        b.vr *= 0.4;
        b.rest = 0.0001;
        flashes.push({ slot: slotOf(b.x), t: 1 });
      }

      if (b.dead || b.y > H + 40) balls.splice(i, 1);
    }

    for (var f = flashes.length - 1; f >= 0; f--) {
      flashes[f].t -= dt * 1.5;
      if (flashes[f].t <= 0) flashes.splice(f, 1);
    }
  }

  function drawPeg(pg) {
    ctx.beginPath();
    ctx.arc(pg.x, pg.y, pg.r, 0, Math.PI * 2);
    ctx.fillStyle = COL.peg;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = COL.pegRim;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(pg.x - pg.r * 0.28, pg.y - pg.r * 0.32, pg.r * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = COL.pegTop;
    ctx.fill();
  }

  function drawCoin(b) {
    var g = ctx.createRadialGradient(
      b.x - BR * 0.35, b.y - BR * 0.4, BR * 0.15,
      b.x, b.y, BR
    );
    g.addColorStop(0, COL.coin0);
    g.addColorStop(0.55, COL.coin1);
    g.addColorStop(1, COL.coin2);

    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.rot);
    ctx.beginPath();
    ctx.arc(0, 0, BR, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = 'rgba(255,235,190,.55)';
    ctx.stroke();
    /* milled edge notch so rotation reads */
    ctx.beginPath();
    ctx.moveTo(-BR * 0.62, 0);
    ctx.lineTo(BR * 0.62, 0);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = 'rgba(90,60,10,.4)';
    ctx.stroke();
    ctx.restore();
  }

  function render() {
    ctx.clearRect(0, 0, W, H);

    /* slot glow */
    var sw = slotWidth();
    for (var f = 0; f < flashes.length; f++) {
      var fl = flashes[f];
      var a = Math.max(0, fl.t) * 0.5;
      var gx = fl.slot * sw;
      var lg = ctx.createLinearGradient(0, FLOOR_Y - H * 0.3, 0, FLOOR_Y);
      lg.addColorStop(0, 'rgba(227,168,60,0)');
      lg.addColorStop(1, 'rgba(227,168,60,' + a.toFixed(3) + ')');
      ctx.fillStyle = lg;
      ctx.fillRect(gx, FLOOR_Y - H * 0.3, sw, H * 0.3);
    }

    /* slot dividers, only below the peg field so the bins read as bins */
    ctx.strokeStyle = COL.line;
    ctx.lineWidth = 1;
    var divTop = Y_LAST + PR * 2.4;
    for (var i = 1; i < SLOTS; i++) {
      ctx.beginPath();
      ctx.moveTo(i * sw, divTop);
      ctx.lineTo(i * sw, FLOOR_Y);
      ctx.stroke();
    }

    /* collection band */
    ctx.fillStyle = 'rgba(255,255,255,.028)';
    ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);
    ctx.strokeStyle = 'rgba(227,168,60,.34)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, FLOOR_Y);
    ctx.lineTo(W, FLOOR_Y);
    ctx.stroke();

    for (var p = 0; p < pegs.length; p++) drawPeg(pegs[p]);
    for (var b = 0; b < balls.length; b++) drawCoin(balls[b]);
  }

  /* fixed-step loop */
  var last = 0, acc = 0;
  var STEP = 1 / 120;
  var running = true;

  function frame(ts) {
    if (!last) last = ts;
    var dt = Math.min((ts - last) / 1000, 0.05);
    last = ts;
    acc += dt;
    var guard = 0;
    while (acc >= STEP && guard < 12) { step(STEP); acc -= STEP; guard++; }
    if (guard >= 12) acc = 0;
    if (!document.hidden) render();
    if (running) requestAnimationFrame(frame);
  }

  document.addEventListener('visibilitychange', function () {
    last = 0; acc = 0;
    if (!document.hidden) render();
  });

  /* resize */
  var rt = null;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { layout(); render(); }, 140);
  });

  layout();
  render();
  requestAnimationFrame(frame);

  /* first drop shortly after load so the demo is not empty */
  setTimeout(function () { if (!document.hidden) drop(); }, 900);

  /* idle auto-drop: keeps the machine visibly working, capped so the
     counter stays honest rather than ticking up forever */
  var autoDrops = 0;
  var AUTO_MAX = 8;
  var AUTO_EVERY = 2200;
  var autoTimer = setInterval(function () {
    if (document.hidden) return;
    if (!running) return;
    if (balls.length > 0) return;
    if (autoDrops >= AUTO_MAX) return;
    autoDrops++;
    drop();
  }, AUTO_EVERY);

  /* a real visitor interacting re-arms the idle loop */
  function userDrop() { autoDrops = 0; drop(); }

  if (dropBtn) dropBtn.addEventListener('click', function () {
    userDrop();
    dropBtn.blur();
  });

  canvas.addEventListener('pointerdown', function (e) {
    var rect = canvas.getBoundingClientRect();
    var x = e.clientX - rect.left;
    /* bias the drop toward where they tapped */
    var nb = makeBall();
    nb.x = Math.max(BR + 2, Math.min(W - BR - 2, x));
    nb.vx = (Math.random() - 0.5) * 10;
    if (balls.length <= 7) {
      balls.push(nb);
      dropped++;
      autoDrops = 0; /* interacting re-arms the idle loop */
      if (dropCountEl) dropCountEl.textContent = String(dropped);
    }
  });

  /* pause the sim when the canvas is far offscreen (battery) */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      running = entries[0].isIntersecting;
      if (running) { last = 0; requestAnimationFrame(frame); }
    }, { threshold: 0 }).observe(canvas);
  }
})();
