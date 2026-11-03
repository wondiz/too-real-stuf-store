/* =====================================================
   checks.js : two things you can trigger from any page (needs css/checks.css)
     showCaptcha(onPass)                      a plain "I'm not a robot" box. Clicking it spins, ticks, then onPass() runs.
     showAlert({ title, text, button, onClick, native })   an alert with one button (text is optional). onClick runs when it's pressed.
                                              native: true = the browser's own alert() (button always says OK); otherwise a laptop-style one you can word yourself.
   ===================================================== */
(function () {
  const SPIN_MS = 1300, TICK_MS = 800;            // how long it "checks", and how long the tick stays before the box goes
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function overlay(cls, html) {                   // a fixed layer that fades in; page scrolling is locked while it's up
    const o = document.createElement('div');
    o.className = 'chk ' + cls;
    o.innerHTML = html;
    document.body.appendChild(o);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function () { requestAnimationFrame(function () { o.classList.add('show'); }); });
    return o;
  }
  function remove(o, then, ms) {
    o.classList.remove('show');
    setTimeout(function () { o.remove(); document.body.style.overflow = ''; if (then) then(); }, reduce ? 0 : ms || 700);
  }

  window.showCaptcha = function (onPass) {
    const o = overlay('chk-captcha',
      '<div class="cap" role="dialog" aria-label="Verification" tabindex="-1"><div class="cap-row">' +
      '<button class="cap-box" type="button" role="checkbox" aria-checked="false" aria-label="I\'m not a robot"></button>' +
      '<span>I\'m not a robot</span></div><div class="cap-foot">Real Stuf. verification</div></div>');
    const box = o.querySelector('.cap-box');
    o.querySelector('.cap').focus();                 // focus the box, not the button, so the button doesn't look pressed
    box.addEventListener('click', function () {
      if (box.classList.contains('spin') || box.classList.contains('ok')) return;
      window.sfx && sfx('click');
      box.classList.add('spin');
      setTimeout(function () {
        box.classList.remove('spin'); box.classList.add('ok'); box.setAttribute('aria-checked', 'true');
        window.sfx && sfx('done');
        setTimeout(function () { remove(o, onPass); }, reduce ? 300 : TICK_MS);
      }, reduce ? 0 : SPIN_MS);
    });
  };

  window.showAlert = function (opt) {
    if (opt.native) {                               // a REAL browser alert(): drawn by the browser, always an "OK" button, stops the page until it's pressed
      window.sfx && sfx('warn', 1);
      setTimeout(function () { window.alert((opt.title || '') + (opt.text ? '\n\n' + opt.text : '')); if (opt.onClick) opt.onClick(); }, 60);
      return;
    }
    const o = overlay('chk-alert',
      '<div class="al" role="alertdialog" aria-labelledby="alT" tabindex="-1"><svg viewBox="0 0 44 44"><path d="M22 5 L41 38 H3 Z"/><path d="M22 17 V27 M22 32 V33"/></svg>' +
      '<b id="alT"></b><p></p><button type="button"></button></div>');
    o.querySelector('b').textContent = opt.title || '';
    o.querySelector('p').textContent = opt.text || '';
    if (!opt.text) o.querySelector('p').remove();
    const b = o.querySelector('button');
    b.textContent = opt.button || 'OK';
    o.querySelector('.al').focus();
    window.sfx && sfx('warn', 1);
    b.addEventListener('click', function () { window.sfx && sfx('click'); remove(o, opt.onClick, 150); });
  };
})();
