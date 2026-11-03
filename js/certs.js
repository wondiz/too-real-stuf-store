/* =====================================================
   certs.js : "Authenticate Here!" on the product page opens CERTIFICATES. Closing one opens more.
   Every closed one makes Maya more upset. (No explosion any more: she just stays furious and keeps making more.)
   Needs: css/certs.css and js/assistant.js loaded first. Put your pictures in images/ (names below).
   ===================================================== */
(function () {
  /* ---------- what you can change ---------- */
  const CERTS = ['images/cert-1.png', 'images/cert-2.png', 'images/cert-3.png', 'images/cert-4.png', 'images/cert-5.png', 'images/cert-6.png'];   // one picture per window; they repeat
  const FRAME = 'images/review-frame.png';
  const WIN_W = 440;            // window width in px (a phone gets less). The certificate is shrunk to fit inside it.
  const SPAWN_ON_CLOSE = 2;     // closing one opens this many
  const WARN_AT = 5;            // the Nth certificate closed: the red eye warning screen (warnEye in eye.js). It was 8
  const MAX_OPEN = 10;           // never more than this many on screen at once
  const TITLES = ['Certificate of Authenticity', 'Declaration of Realness', 'Proof of Origin', 'Statement of Truth', 'Certified 100% Real'];

  // what she says: [after the Nth certificate is closed]. 1-2 she is anxious, 3-4 she is getting aggressive. (First draft: change freely.)
  const CLOSED  = [
    ['...why did you close it?', 'it says everything is real. it says so right on it.'],            // after 1
    ['please. stop closing them.', 'they are proof. read them.'],                                   // after 2
    ['...you did not read it.', 'you closed it before you read it.', 'read them. please.'],           // after 3
    ['I SAID THEY ARE PROOF.', 'READ THEM.', 'I WILL MAKE MORE.']                                   // after 4
  ];

  // the agreement: the way out of the cameras. The next time they try to close one of their own faces, an agreement asks for their signature.
  // It has to look somewhat like the name they gave on the join screen (nothing on the pad tells them: only the small note below it).
  const SIGN_AGREEMENT = ['AGREEMENT', 'I will never question Maya or Real Stuf.'];
  const SIGN_ASK     = ['...you want to close it?', 'sign the agreement first.'];                  // Maya (typed), when they first try to close a camera
  const SIGN_AGAIN   = [['sign it.'], ['the agreement. sign it.'], ['I AM NOT ASKING.']];          // each further try while the agreement is open
  const SIGN_NOTE    = 'if your name was real, your signature would match.';          // small text under the pad
  const SIGN_PASS    = 50;                // how well the signature must match the name (out of 100)
  const SIGN_HINT_AFTER = 3;              // failed tries before Maya helps
  const SIGN_HINT = ['...your name.', 'write your name. on the line.'];
  const SIGNED_LINES = ['fine...we can close them for now.'];                                      // Maya, once it is signed (replies come back)
  const FURIOUS = [['...', 'I WILL NOT STOP.'], ['EVERYTHING HERE IS REAL.'], ['READ. THEM.'], ['I AM REAL.']];   // after the 4th: she just stays angry

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const KEY = 'realStuf.certs';
  let closed = 0, spawned = 0, first = true, z = 10, fancam = false, stream = null, signed = false;
  try { signed = sessionStorage.getItem('realStuf.signed') === '1'; if (signed) fancam = false; } catch (e) {}
  try { fancam = sessionStorage.getItem('realStuf.fancam') === '1'; } catch (e) {}
  try { const s = JSON.parse(sessionStorage.getItem(KEY) || '{}'); closed = s.closed || 0; first = s.first !== false; } catch (e) {}
  const save = function () { try { sessionStorage.setItem(KEY, JSON.stringify({ closed: closed, first: first })); } catch (e) {} };
    let layer = null;

  // the live fancam: after the warning the certificates show the visitor. Needs the camera; if it is refused, the photo taken earlier is shown instead; if there is none, the certificate stays.
  let camP = null;
  function prepCam() {
    if (stream || camP || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return camP || Promise.resolve();
    camP = (window.camAllowed ? camAllowed() : Promise.resolve(true)).then(function (ok) { return ok ? navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false }) : null; }).then(function (s) {
      if (s) stream = s;       // (no box here: the camera is only asked for on the Start screen; if it was not allowed there, the photo is used)
    }).catch(function () {}).then(function () { camP = null; });
    return camP;
  }
  addEventListener('pagehide', function () { if (stream) stream.getTracks().forEach(function (x) { x.stop(); }); });
  // the ASCII filter: one hidden camera feed is sampled into a small grid of letters, and every fancam window shows that text
  const COLS = 140, ROWS = Math.round(COLS * .337), RAMP = ' .:-=+*#%@', FPS = 10;     // COLS = letters across (more = more detail); ROWS follows from it so the picture fits the window's shape
  let src = null, srcPhoto = null, grid = null, loopT = null;
  function ascii() {
    if (!grid) { grid = document.createElement('canvas'); grid.width = COLS; grid.height = ROWS; }
    const g = grid.getContext('2d', { willReadFrequently: true });
    const s = (stream && src && src.videoWidth) ? src : srcPhoto;
    if (!s) return null;
    const sw = s.videoWidth || s.naturalWidth, sh = s.videoHeight || s.naturalHeight;
    if (!sw) return null;
    const want = (COLS * .6) / ROWS, have = sw / sh;                  // "cover": crop the picture to the window's shape
    let cw = sw, ch = sh, cx = 0, cy = 0;
    if (have > want) { cw = sh * want; cx = (sw - cw) / 2; } else { ch = sw / want; cy = (sh - ch) / 2; }
    g.save(); g.translate(COLS, 0); g.scale(-1, 1);                    // mirrored, like a mirror
    g.drawImage(s, cx, cy, cw, ch, 0, 0, COLS, ROWS); g.restore();
    const d = g.getImageData(0, 0, COLS, ROWS).data; let out = '';
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const i = (y * COLS + x) * 4, l = .3 * d[i] + .59 * d[i + 1] + .11 * d[i + 2];
        out += RAMP[Math.max(0, Math.min(RAMP.length - 1, Math.floor((l - 25) / 205 * RAMP.length)))];
      }
      out += '\n';
    }
    return out;
  }
  function startAscii() {
    if (loopT) return;
    if (stream && !src) { src = document.createElement('video'); src.muted = true; src.playsInline = true; src.srcObject = stream; src.play().catch(function () {}); }
    if (!stream && !srcPhoto) { let p = null; try { p = sessionStorage.getItem('realStuf.facePhoto'); } catch (e) {} if (p) { srcPhoto = new Image(); srcPhoto.src = p; } }
    loopT = setInterval(function () {
      const pres = document.querySelectorAll('.ct-ascii');
      if (!pres.length) return;
      if (stream && !src) { src = document.createElement('video'); src.muted = true; src.playsInline = true; src.srcObject = stream; src.play().catch(function () {}); }   // the camera arrived late
      const txt = ascii(); if (txt) pres.forEach(function (p) { p.textContent = txt; });
    }, 1000 / FPS);
  }
  function camInto(win) {
    const body = win.querySelector('.ct-body'); if (!body || body.dataset.cam) return;
    let photo = null; try { photo = sessionStorage.getItem('realStuf.facePhoto'); } catch (e) {}
    if (!stream && !photo) return;                                    // no camera, no photo: the certificate stays
    body.dataset.cam = '1';
    const pre = document.createElement('pre'); pre.className = 'ct-ascii'; pre.style.fontSize = (93.63 / COLS / .6) + 'cqw';   // the letters shrink as there are more of them pre.setAttribute('aria-label', 'a live picture of you');
    body.textContent = ''; body.appendChild(pre);
    const rec = document.createElement('i'); rec.className = 'ct-rec'; rec.textContent = 'REC'; body.appendChild(rec);
    startAscii();
  }

  function open() { return layer ? layer.querySelectorAll('.ct-win:not(.out)').length : 0; }
  function say(lines) { window.maya && maya.say(lines, null, true); }

  /* where a new window may land: not on top of the text of the review (the question, the answers, the reply, the caption under the shirt).
     It tries many random spots and takes the first one that touches none of it; on a screen so small that there is no such spot, the one that covers the least. */
  const KEEP_CLEAR = ['.rp-bar', '#cap'];                                // the parts of the review page whose text must stay readable
  function freeSpot(w, h) {
    const rects = [];
    KEEP_CLEAR.forEach(function (sel) { const el = document.querySelector(sel); if (el) { const r = el.getBoundingClientRect(); if (r.width && r.height) rects.push(r); } });
    let best = null;
    for (let k = 0; k < 60; k++) {
      const x = Math.max(8, Math.random() * (innerWidth - w - 16) + 8), y = Math.max(60, Math.random() * (innerHeight - h - 90) + 60);
      let hit = 0;
      rects.forEach(function (r) { const ox = Math.min(x + w, r.right) - Math.max(x, r.left), oy = Math.min(y + h, r.bottom) - Math.max(y, r.top); if (ox > 0 && oy > 0) hit += ox * oy; });
      if (!best || hit < best.hit) best = { x: x, y: y, hit: hit };
      if (!hit) break;
    }
    return best;
  }

  function spawn(i) {
    if (!layer) { layer = document.createElement('div'); layer.className = 'ct-layer'; document.body.appendChild(layer); }
    if (open() >= MAX_OPEN) return;
    const n = spawned++;
    const w = Math.min(WIN_W, innerWidth * .8), h = w * 945 / 1412;
    const win = document.createElement('div');
    win.className = 'ct-win'; win.style.width = w + 'px'; win.style.zIndex = ++z;
    const at = freeSpot(w, h);                                        // random, but never on top of the review's text (when there is room for that)
    win.style.left = at.x + 'px'; win.style.top = at.y + 'px';
    win.innerHTML = '<img class="ct-frame" alt="" src="' + FRAME + '"><div class="ct-body"><img alt="A certificate of authenticity" src="' + CERTS[n % CERTS.length] + '"></div>' +
      '<div class="ct-title">' + TITLES[n % TITLES.length] + '</div><button class="ct-x" type="button" aria-label="Close this certificate"></button>';
    layer.appendChild(win);
    if (fancam) { prepCam(); camInto(win); }
    window.sfx && sfx(first ? 'certthud' : 'certslip'); if (first) { first = false; save(); }

    // click brings it to the front; the title bar drags it
    win.addEventListener('pointerdown', function () { win.style.zIndex = ++z; });
    const bar = win.querySelector('.ct-title');
    bar.addEventListener('pointerdown', function (e) {
      const ox = e.clientX - win.offsetLeft, oy = e.clientY - win.offsetTop;
      bar.setPointerCapture(e.pointerId);
      const move = function (m) { win.style.left = (m.clientX - ox) + 'px'; win.style.top = (m.clientY - oy) + 'px'; };
      bar.addEventListener('pointermove', move);
      bar.addEventListener('pointerup', function () { bar.removeEventListener('pointermove', move); }, { once: true });
    });
    win.querySelector('.ct-x').addEventListener('click', function () { close(win); });
  }


  /* ---------- the agreement window: sign it (so it looks like your name) to be let go ---------- */
  const SIGN_FONT = function (px) { return 'italic ' + px + 'px "Segoe Script","Brush Script MT","Lucida Handwriting","Snell Roundhand","Apple Chancery",cursive'; };
  let sgLayer = null, sgFails = 0, sgTries = 0;
  const visitorName = function () { try { return (JSON.parse(localStorage.getItem('realStuf.visitor') || '{}').name || '').trim().slice(0, 24); } catch (e) { return ''; } };

  function makeTemplate(name, cw, ch) {                                // the name in a handwriting font: where to draw the faint guide, and its ink points to compare against
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    const g = c.getContext('2d'); g.font = SIGN_FONT(100);
    const fs = Math.max(20, Math.min(100 * (cw * .8) / Math.max(1, g.measureText(name).width), ch * .55));
    g.clearRect(0, 0, cw, ch); g.font = SIGN_FONT(fs); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000'; g.fillText(name, cw / 2, ch * .5);
    const d = g.getImageData(0, 0, cw, ch).data, pts = [];
    for (let y = 0; y < ch; y += 3) for (let x = 0; x < cw; x += 3) if (d[(y * cw + x) * 4 + 3] > 100) pts.push({ x: x, y: y });
    return { fs: fs, pts: pts, len: pts.length * 9 / (fs * .08) };    // len = a rough guess at how long the pen path of that name is
  }
  const GX = 36, GY = 12;
  function cellsOf(pts) {                                              // the points squeezed into the same box and dropped onto a coarse grid
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    pts.forEach(function (p) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); });
    const s = new Set(); const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0);
    pts.forEach(function (p) { s.add(Math.min(GX - 1, Math.floor((p.x - x0) / w * GX)) + ',' + Math.min(GY - 1, Math.floor((p.y - y0) / h * GY))); });
    return s;
  }
  const near = function (s, cell) {                                    // is this cell, or a neighbour of it, in the set?
    const a = cell.split(','), x = +a[0], y = +a[1];
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) if (s.has((x + i) + ',' + (y + j))) return true;
    return false;
  };
  function judgeSign(strokes, tpl) {                                   // -> { score, verdict: 'short' | 'scribble' | 'nomatch' | 'real' }
    let len = 0; const pts = [];
    strokes.forEach(function (s) {
      for (let i = 0; i < s.length; i++) {
        if (i) { const dx = s[i].x - s[i - 1].x, dy = s[i].y - s[i - 1].y, l = Math.hypot(dx, dy); len += l; const k = Math.ceil(l / 4); for (let m = 1; m < k; m++) pts.push({ x: s[i - 1].x + dx * m / k, y: s[i - 1].y + dy * m / k }); }
        pts.push(s[i]);
      }
    });
    if (pts.length < 20 || len < 120) return { score: 0, verdict: 'short' };
    if (!tpl) return { score: 100, verdict: 'real' };                  // they never gave a name: any real attempt will do
    const ratio = len / tpl.len;
    if (ratio < .3) return { score: 0, verdict: 'short' };
    const U = cellsOf(pts), T = cellsOf(tpl.pts);
    let cov = 0, pre = 0; T.forEach(function (c) { if (near(U, c)) cov++; }); U.forEach(function (c) { if (near(T, c)) pre++; });
    const R = cov / T.size, P = pre / U.size, score = Math.round(100 * (R + P ? 2 * R * P / (R + P) : 0));
    if (ratio > 3.2) return { score: Math.min(score, 40), verdict: 'scribble' };
    return { score: score, verdict: score >= SIGN_PASS ? 'real' : 'nomatch' };
  }

  function showSignature() {
    if (signed || sgLayer) return;
    const name = visitorName();
    sgLayer = document.createElement('div'); sgLayer.className = 'sg-layer'; document.body.appendChild(sgLayer);
    const w = Math.min(600, innerWidth * .92);
    const win = document.createElement('div');
    win.className = 'sg-win'; win.style.width = w + 'px'; win.style.left = Math.max(8, (innerWidth - w) / 2) + 'px'; win.style.top = Math.max(60, (innerHeight - w * 945 / 1412) / 2 - 10) + 'px';
    win.innerHTML = '<img class="ct-frame" alt="" src="' + FRAME + '"><div class="ct-body sg-body"><p class="sg-h">' + SIGN_AGREEMENT[0] + '</p><p class="sg-t">' + SIGN_AGREEMENT[1] + '</p>' +
      '<div class="sg-pad"><canvas class="sg-canvas"></canvas><i class="sg-x">x</i><i class="sg-line"></i></div>' +
      '<p class="sg-note">' + SIGN_NOTE + '</p><p class="sg-msg"></p><p class="sg-score"></p><div class="sg-btns"><button type="button" class="sg-clear">clear</button><button type="button" class="sg-ok">sign</button></div></div><div class="ct-title">Agreement</div>';
    sgLayer.appendChild(win);
    window.sfx && sfx('thud');
    const pad = win.querySelector('.sg-pad'), cv = win.querySelector('.sg-canvas'), msg = win.querySelector('.sg-msg'), scoreEl = win.querySelector('.sg-score');
    const cw = pad.clientWidth, ch = pad.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = cw * dpr; cv.height = ch * dpr;
    const tpl = name ? makeTemplate(name, cw, ch) : null;
    const g = cv.getContext('2d'); g.scale(dpr, dpr); g.lineWidth = 2.6; g.lineCap = g.lineJoin = 'round'; g.strokeStyle = '#111';
    let strokes = [], cur = null;
    const at = function (e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * (cw / r.width), y: (e.clientY - r.top) * (ch / r.height) }; };
    cv.addEventListener('pointerdown', function (e) {
      if (win.classList.contains('done')) return;
      cur = [at(e)]; strokes.push(cur); cv.setPointerCapture(e.pointerId);
      g.beginPath(); g.moveTo(cur[0].x, cur[0].y); g.lineTo(cur[0].x + .01, cur[0].y); g.stroke(); msg.textContent = ''; scoreEl.textContent = '';
    });
    cv.addEventListener('pointermove', function (e) { if (!cur) return; const p = at(e); cur.push(p); g.lineTo(p.x, p.y); g.stroke(); });
    const up = function () { cur = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    win.querySelector('.sg-clear').addEventListener('click', function () { strokes = []; cur = null; g.clearRect(0, 0, cw, ch); msg.textContent = ''; scoreEl.textContent = ''; window.sfx && sfx('click'); });
    win.querySelector('.sg-ok').addEventListener('click', function () {
      if (win.classList.contains('done')) return;
      const j = judgeSign(strokes, tpl);
      scoreEl.textContent = (tpl && j.verdict !== 'short') ? 'MATCH: ' + j.score + '%' : '';
      msg.textContent = { short: 'that is not a signature.', scribble: 'that is not a signature. that is a scribble.', nomatch: 'that does not look like ' + (name || 'you') + '.', real: '...signed.' }[j.verdict];
      if (j.verdict === 'real') { win.classList.add('done'); scoreEl.classList.add('good'); signedOff(win); return; }
      window.sfx && sfx('warn', 1);
      if (++sgFails === SIGN_HINT_AFTER && window.maya) maya.say(SIGN_HINT, null, true);
    });
  }

  function signAttempt() {                                             // they tried to close one of their own faces
    if (!sgLayer) { window.maya && maya.say(SIGN_ASK, null, true); setTimeout(showSignature, 900); return; }
    window.maya && maya.say(SIGN_AGAIN[sgTries++ % SIGN_AGAIN.length], null, true);
  }

  // the way in for the review gate (js/gate.js): the red eye warning, then Maya asks for the agreement, and when it is signed she lets them through. No cameras.
  let sgCb = null, sgLines = null;
  function gateSign(cb, ask, signedLines) {
    if (!window.warnEye) { cb && cb(); return; }
    warnEye(function () { say(ask); setTimeout(function () { sgCb = cb; sgLines = signedLines; showSignature(); }, 2200); });
  }

  function signedOff(win) {
    if (sgCb) {                                                        // signed for the gate: the window goes, Maya lets them in
      const cb = sgCb, lines = sgLines; sgCb = null; window.sfx && sfx('done');
      setTimeout(function () { win.classList.add('out'); setTimeout(function () { if (sgLayer) { sgLayer.remove(); sgLayer = null; } }, 220); say(lines); setTimeout(cb, 4200); }, 1000);
      return;
    }                                            // signed: the window goes, the cameras die one by one, Maya calms down (for now)
    signed = true; fancam = false;
    try { sessionStorage.setItem('realStuf.signed', '1'); sessionStorage.removeItem('realStuf.fancam'); } catch (e) {}
    window.sfx && sfx('done');
    setTimeout(function () {
      win.classList.add('out'); setTimeout(function () { if (sgLayer) { sgLayer.remove(); sgLayer = null; } }, 220);
      const wins = layer ? Array.prototype.slice.call(layer.querySelectorAll('.ct-win')) : [];
      wins.forEach(function (w, i) { setTimeout(function () { window.sfx && sfx('click'); w.classList.add('out'); setTimeout(function () { w.remove(); }, 200); }, 250 + i * 220); });
      setTimeout(function () {
        if (stream) { stream.getTracks().forEach(function (x) { x.stop(); }); stream = null; }
        if (loopT) { clearInterval(loopT); loopT = null; }
        if (layer) { layer.remove(); layer = null; }
        if (window.maya && maya.calm) maya.calm(SIGNED_LINES);
      }, 600 + wins.length * 220);
    }, 1400);
  }

  // the two camera windows of the review gate (js/gate.js): they show the visitor (red, ASCII), they cannot be closed, and they stay until the gate lets them through
  let camLock = false;
  function cams(n) {
    if (camLock) return; camLock = true; fancam = true;
    Promise.race([prepCam(), new Promise(function (r) { setTimeout(r, 3000); })]).then(function () {
      if (!camLock) return;
      for (let i = 0; i < (n || 2); i++) setTimeout(function () { if (camLock) spawn(); }, i * 450);
    });
  }
  function camsOff() {
    if (!camLock) return; camLock = false; fancam = false;
    if (layer) { layer.querySelectorAll('.ct-win').forEach(function (w) { w.classList.add('out'); setTimeout(function () { w.remove(); }, 220); }); setTimeout(function () { if (layer && !layer.children.length) { layer.remove(); layer = null; } }, 400); }
    if (stream) { stream.getTracks().forEach(function (x) { x.stop(); }); stream = null; }
    if (loopT) { clearInterval(loopT); loopT = null; } src = null;
  }

  // the review portal (js/review-portal.js) uses the windows as plain spam: closing one just closes it (no more windows, no warnings), and they can all be cleared
  let calmMode = false;
  function clearAll() {
    if (!layer) return;
    layer.querySelectorAll('.ct-win:not(.out)').forEach(function (w, i) { setTimeout(function () { window.sfx && sfx('click'); w.classList.add('out'); setTimeout(function () { w.remove(); }, 200); }, i * 140); });
  }
  function close(win) {
    if (calmMode) { window.sfx && sfx('click'); win.classList.add('out'); setTimeout(function () { win.remove(); }, reduce ? 0 : 200); return; }
    if (camLock) { window.sfx && sfx('warn', 1); return; }              // the gate's cameras cannot be closed
    if (fancam && !signed) { signAttempt(); return; }                    // they cannot close their own face until they have signed
    window.sfx && sfx('click');
    win.classList.add('out');
    setTimeout(function () { win.remove(); }, reduce ? 0 : 200);
    closed++; save();
    for (let i = 0; i < SPAWN_ON_CLOSE; i++) setTimeout(function () { spawn(); }, 150 + i * 220);   // closing one makes more
    say(closed <= CLOSED.length ? CLOSED[closed - 1] : FURIOUS[(closed - CLOSED.length - 1) % FURIOUS.length]);
  }

  // what the review game (js/review-game.js) uses
  window.certs = { calm: function () { calmMode = true; }, clearAll: clearAll, cams: cams, camsOff: camsOff, camsOn: function () { return camLock; }, gateSign: gateSign, spawn: function (n) { for (let i = 0; i < (n || 1); i++) setTimeout(spawn, i * 200); }, signed: function () { return signed; } };

})();
