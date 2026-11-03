/* =====================================================
   ending.js : THE END (one of the ways the simulation ends). Used by review.html (second failed "leave") and review-write.html (third blocked review).
   window.theEnd.start({ delay }) :
     1. the screen is black. SIX webcam windows of the visitor appear at the same time, in red (no ascii, just a red filter).
     2. one by one they turn to TV static.
     3. then the entire screen is TV static.
     4. two seconds later the tab closes itself. (Browsers only allow that for a tab a script opened. Otherwise the page goes blank (about:blank).)
   No camera (or refused)? It uses the photo taken earlier, or a dark red window.
   ===================================================== */
(function () {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // the knobs (ms)
  const WINDOWS = 6;                      // how many face windows
  const HOLD = 3000;                      // how long they all sit there, watching, before the first one goes to static
  const STEP = 700;                       // time between one window turning to static and the next
  const BEFORE_FULL = 700;                // after the last window has gone to static, then the whole screen
  const FULL_HOLD = 2000;                 // the whole screen is static for this long, then the tab closes
  const TITLES = ['Proof of Origin', 'Statement of Truth', 'Certified 100% Real', 'Declaration of Realness', 'Certificate of Authenticity', 'Proof of Origin'];
  const FRAME = 'images/review-frame.png';

  const css = document.createElement('style');
  css.textContent = [
    '.end-layer { position: fixed; inset: 0; z-index: 1000; background: #000; overflow: hidden; cursor: none; }',
    '.end-layer .ct-win { animation: none; }',
    '.end-cam video, .end-cam img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); filter: grayscale(1) contrast(1.3) brightness(.9); }',
    '.end-cam::after { content: ""; position: absolute; inset: 0; background: #ff1212; mix-blend-mode: multiply; pointer-events: none; }',
    '.end-cam::before { content: ""; position: absolute; inset: 0; z-index: 1; background: repeating-linear-gradient(0deg, rgba(0,0,0,.28) 0 1px, transparent 1px 3px); pointer-events: none; }',
    '.end-cam .ct-rec { z-index: 3; }',
    '.end-blank { position: absolute; inset: 0; background: radial-gradient(ellipse at center, #5a0000, #1a0000); }',
    '.end-static { position: absolute; inset: 0; width: 100%; height: 100%; display: block; image-rendering: pixelated; }',
    '.end-full { position: absolute; inset: 0; z-index: 100; width: 100%; height: 100%; display: block; image-rendering: pixelated; }'
  ].join('\n');
  document.head.appendChild(css);

  let started = false, stream = null;
  const statics = [];                                                  // every canvas that is currently showing static
  function noiseLoop() {                                              // one loop draws static into all of them
    let last = 0;
    (function frame(t) {
      requestAnimationFrame(frame);
      if (!reduce && t - last < 55) return;                           // about 18 pictures a second (with reduced motion: one still picture each)
      last = t;
      statics.forEach(function (c) {
        if (reduce && c.drawn) return; c.drawn = true;
        const g = c.getContext('2d'), img = g.createImageData(c.width, c.height), d = img.data;
        for (let i = 0; i < d.length; i += 4) { const v = 20 + Math.random() * 235; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
        g.putImageData(img, 0, 0);
      });
    })(0);
  }
  function staticCanvas(w, h, cls) { const c = document.createElement('canvas'); c.width = w; c.height = h; c.className = cls; statics.push(c); return c; }

  function getCam() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return Promise.resolve(null);
    return Promise.race([
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false }).catch(function () { return null; }),
      new Promise(function (r) { setTimeout(function () { r(null); }, 2500); })
    ]);
  }
  function stopCam() { if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; } }

  function start(opts) {
    if (started) return; started = true;
    const delay = (opts && opts.delay) || 0;
    const layer = document.createElement('div'); layer.className = 'end-layer'; document.body.appendChild(layer);
    document.title = '...';
    noiseLoop();
    getCam().then(function (s) {
      stream = s;
      setTimeout(function () { windows(layer); }, delay);
    });
  }

  function windows(layer) {
    let photo = null; try { photo = sessionStorage.getItem('realStuf.facePhoto'); } catch (e) {}
    // a neat grid: 3 columns x 2 rows, evenly spaced and centred (on a phone: 2 columns x 3 rows)
    const phone = innerWidth < 700, cols = phone ? 2 : 3, rows = phone ? 3 : 2;
    const w = phone ? innerWidth * .42 : Math.max(240, innerWidth * .205), h = w * 945 / 1412, gapY = h * .37, wins = [];
    const top0 = Math.max(6, (innerHeight - (rows * h + (rows - 1) * gapY)) / 2);
    for (let i = 0; i < WINDOWS; i++) {
      const c = i % cols, r = Math.floor(i / cols);
      const cx = phone ? (c ? .73 : .27) : [.235, .5, .765][c];     // the centre of each column (share of the screen width)
      const left = cx * innerWidth - w / 2, top = top0 + r * (h + gapY);
      const win = document.createElement('div'); win.className = 'ct-win'; win.style.cssText = 'width:' + w + 'px;left:' + left + 'px;top:' + top + 'px;z-index:' + (i + 1);
      win.innerHTML = '<img class="ct-frame" alt="" src="' + FRAME + '"><div class="ct-body end-cam"></div><div class="ct-title">' + TITLES[i % TITLES.length] + '</div><button class="ct-x" type="button" tabindex="-1" aria-hidden="true"></button>';
      const body = win.querySelector('.ct-body');
      if (stream) { const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.autoplay = true; v.srcObject = stream; v.play().catch(function () {}); body.appendChild(v); }
      else if (photo) { const im = document.createElement('img'); im.alt = ''; im.src = photo; body.appendChild(im); }
      else { const b = document.createElement('div'); b.className = 'end-blank'; body.appendChild(b); }
      const rec = document.createElement('i'); rec.className = 'ct-rec'; rec.textContent = 'REC'; body.appendChild(rec);
      layer.appendChild(win); wins.push(win);
    }
    window.sfx && sfx('thud');                                        // all six at the same moment
    // one by one they turn to static
    const order = wins.map(function (_, i) { return i; }).sort(function () { return Math.random() - .5; });
    order.forEach(function (idx, n) {
      setTimeout(function () {
        const body = wins[idx].querySelector('.ct-body'); body.innerHTML = ''; body.classList.remove('end-cam'); body.style.background = '#000';
        body.appendChild(staticCanvas(96, 64, 'end-static'));
        window.sfx && sfx('tvstatic', .15 + n * .07);                  // the same noise as the red eye, quiet, a little louder with each window
      }, (reduce ? 300 : HOLD) + n * (reduce ? 200 : STEP));
    });
    const allStatic = (reduce ? 300 : HOLD) + (WINDOWS - 1) * (reduce ? 200 : STEP) + BEFORE_FULL;
    setTimeout(function () {                                          // the entire screen
      layer.appendChild(staticCanvas(280, 175, 'end-full')); stopCam();
      window.sfx && sfx('tvstatic', 1);                                // the full screen: as loud as the red eye
      setTimeout(close, reduce ? 800 : FULL_HOLD);
    }, allStatic);
  }
  function close() {
    window.close();                                                   // only works for a tab a script opened
    setTimeout(function () { location.replace('about:blank'); }, 400);
  }
  window.theEnd = { start: start };
})();
