/* =====================================================
   boot.js : the code screen runs (lines print, the RAM counts, the loading percentages climb),
   it flashes white, then the "Start" screen appears. Any key or click skips ahead
   (the screen itself says "ESC to skip").
   ===================================================== */
(function () {
  /* ---------- the tuning knobs (ms) ---------- */
  const LINE_GAP  = 160;    // how often the next line prints
  const RAM_MS    = 600;    // how long the RAM check takes to count up
  const LOAD_MS   = 190;    // how long each "Loaded ..." percentage takes to climb
  const HOLD_MS   = 500;    // pause after the last line before the flash
  const FLASH_MS  = 90;     // the white flash just before it cuts away
  const SKIP_AT   = 1200;   // with "reduce motion" on, show everything at once and leave after this long

  const boot = document.getElementById('boot');
  const portal = document.getElementById('portal');
  const lines = boot.querySelectorAll('.ln');
  const res = boot.querySelectorAll('.res');
  const ram = document.getElementById('ram'), ramOk = document.getElementById('ramOk');
  const loadN = document.getElementById('loadN');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const d = new Date();
  document.getElementById('today').textContent =
    String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0') + '/' + d.getFullYear();

  const timers = [];
  function at(ms, fn) { timers.push(setTimeout(fn, ms)); }
  function on(el) { el.classList.add('on'); }

  // count a number up from 0 to its final value
  function countUp(el, ms, done) {
    const end = +el.textContent, t0 = performance.now();
    (function step(now) {
      const k = Math.min(1, ((now || t0) - t0) / ms);
      el.textContent = Math.round(end * k);
      if (k < 1) timers.push(requestAnimationFrame(step)); else if (done) done();
    })();
  }

  /* ---------- the sequence ---------- */
  let t = 0;
  function run() {
    ramOk.hidden = true; loadN.textContent = '10';
    lines.forEach(function (l, i) {                 // lines 0 and 1 are already on
      if (i < 2) return;
      at(t += LINE_GAP, function () {
        on(l);
        if (l.contains(ram)) countUp(ram, RAM_MS, function () { ramOk.hidden = false; });
        if (l.classList.contains('res')) { loadN.textContent = String(11 + Array.prototype.indexOf.call(res, l)); countUp(l.querySelector('span'), LOAD_MS); }
      });
      if (l.contains(ram)) t += RAM_MS;             // wait for the RAM check before the next line
    });
    at(t + LOAD_MS + HOLD_MS, leave);
  }

  /* ---------- leaving ---------- */
  let done = false;
  function showPortal() {
    if (done) return;
    done = true;
    boot.hidden = true;
    portal.hidden = false;
    window.askCamera && askCamera(true);     // the camera permission box appears with the Start screen
  }
  function leave() {
    timers.forEach(function (id) { clearTimeout(id); cancelAnimationFrame(id); });
    boot.classList.add('out');
    setTimeout(showPortal, FLASH_MS);
  }

  if (reduce) { lines.forEach(on); at(SKIP_AT, leave); } else { run(); }
  document.addEventListener('keydown', leave, { once: true });
  document.addEventListener('click', leave, { once: true });
})();
