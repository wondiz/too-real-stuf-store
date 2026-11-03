/* =====================================================
   vignette.js : the dark, eye-shaped vignette. A clear oval follows the cursor and the dark closes in around it.
   How dark it is depends on how suspicious Maya is of the visitor (her story stage, from js/assistant.js).
   It only SETS the numbers: the look itself is "HORROR LAYER" in css/mainpage.css (body::after, reads --dread, --mx, --my).
   Put this script AFTER js/assistant.js on every page that has Maya.
   ===================================================== */
(function () {
  /* ---------- what you can change ---------- */
  // dread per stage: 0 = no vignette, 1 = the darkest (and tightest)
  const LEVEL = {
    new:        0,      // she has just said hello
    busy:       0.12,   // they picked one of her messages
    popup:      0.20,   // the join popup is up
    suspicious: 0.50,   // they closed the popup: she is suspicious
    captcha:    0.50,
    free:       0.60,   // "ok youre free to look around... for now..."
    alert:      0.80,   // the robotic activity alert
    eye:        0.90,   // the red eye is looking at them
    done:       1       // after the eye: she insists everything is real, but doesn't trust them. The darkest it gets.
  };
  const SPEED = 0.35;     // how fast it moves to a new level (1 = instantly, smaller = slower, creeping)
  /* ---------------------------------------------------- */

  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;
  let now = 0;
  // extra darkness added on top of her stage, each time the visitor refuses the cookies notification (DECLINE or its X). It stays for the visit.
  const BUMP_KEY = 'realStuf.dreadBump';
  let bump = 0; try { bump = +sessionStorage.getItem(BUMP_KEY) || 0; } catch (e) {}
  addEventListener('realstuf:dread', function (e) {
    bump = Math.min(0.5, bump + (e.detail || 0.1));
    try { sessionStorage.setItem(BUMP_KEY, String(bump)); } catch (err) {}
  });

  if (fine) addEventListener('pointermove', function (e) {            // the clear spot follows the cursor (on a phone it stays in the middle)
    root.style.setProperty('--mx', (e.clientX / innerWidth * 100) + '%');
    root.style.setProperty('--my', (e.clientY / innerHeight * 100) + '%');
  }, { passive: true });

  function target() {
    const m = window.maya;
    if (!m) return 0;
    const t = LEVEL[m.stage()];
    return Math.min(1, (t === undefined ? 0 : t) + (t === 0 ? 0 : bump));      // (before she has noticed them at all (level 0) there is nothing to darken)
  }
  function tick() {
    const t = target();
    now += (t - now) * (reduce ? 1 : SPEED * 0.25);                    // (ticks every 250ms)
    if (Math.abs(t - now) < 0.002) now = t;
    root.style.setProperty('--dread', now.toFixed(3));
  }
  now = target();                                                      // a new page starts where the last one left off
  tick();
  setInterval(tick, 250);
})();
