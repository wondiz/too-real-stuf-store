/* =====================================================
   promo-browse.js : the four photos in the strip near the bottom of the home page (the lookbook, scrolls sideways).
   Hover one: it fades a little and says BROWSE. Click it: the product page.
   Put it on home.html after js/home.js. Change STRIP below if your strip has another class name.
   ===================================================== */
(function () {
  const STRIP = '.strip';            // the sideways strip of photos
  const GO = 'product.html';         // where a click goes
  const WORD = 'BROWSE';
  const FADE = .38;                  // how dark the fade is (0 = none, 1 = black)

  const strip = document.querySelector(STRIP);
  if (!strip) return;
  const css = document.createElement('style');
  css.textContent =
    STRIP + ' img{cursor:pointer}' +
    '.pb{position:absolute;z-index:3;display:grid;place-items:center;pointer-events:none;opacity:0;transition:opacity .3s ease;background:rgba(0,0,0,' + FADE + ');color:#fff;' +
    'font:400 clamp(20px,2.6vw,38px)/1 var(--data,"Courier New",monospace);letter-spacing:.28em;padding-left:.28em}' +
    '.pb.on{opacity:1}' +
    '@media (prefers-reduced-motion:reduce){.pb{transition:none}}';
  document.head.appendChild(css);
  if (getComputedStyle(strip).position === 'static') strip.style.position = 'relative';

  const veil = document.createElement('div');                      // one fade, moved onto whichever photo the cursor is over
  veil.className = 'pb'; veil.textContent = WORD; veil.setAttribute('aria-hidden', 'true');
  strip.appendChild(veil);

  strip.addEventListener('pointerover', function (e) {
    const img = e.target.closest && e.target.closest('img');
    if (!img || !strip.contains(img)) return;
    veil.style.left = img.offsetLeft + 'px'; veil.style.top = img.offsetTop + 'px';
    veil.style.width = img.offsetWidth + 'px'; veil.style.height = img.offsetHeight + 'px';
    veil.classList.add('on');
  });
  strip.addEventListener('pointerleave', function () { veil.classList.remove('on'); });
  strip.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('img')) location.href = GO;
  });
})();
