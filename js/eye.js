/* =====================================================
   eye.js : the red eye that "authenticates" the visitor. Needs css/eye.css.
   From any page:  startEyeVerify(function (isYes) { ... })
     1. a red screen, an eye whose pupil follows the cursor, a typed line
     2. the eye blinks and the visitor's photo (taken by camera.js) appears inside it
     3. "is this...you..?"  yes / no  ->  a red screen with black typed questions (QUESTIONS below), then it glitches away and your function runs
   Without a photo (camera refused) a grey silhouette shows instead. All wording is a first draft.
   ===================================================== */
(function () {
  /* ---------- the wording and the tuning knobs ---------- */
  const AUTH_TEXT = 'authenticating that you are a real person', ASK_TEXT = 'is this...you..?';
  const TYPE_SPEED = 70, TYPE_START = 700;       // ms per letter / before the first letter
  // the black screen before the eye (the old "thank you" screen layout): a big line, a small line, then a line ending in a number that counts down (3... 2... 1... replaces itself)
  const COUNT_BIG = 'Irregular activity detected. Authentication required.', COUNT_SMALL = 'We are a real website. Only real humans are permitted access here...\nYour behaviour has triggered our authentication protocols.';
  const COUNT_TEXT = 'Authenticating your authenticity for OUR protection in ', COUNT_FROM = 3, COUNT_STEP = 1000, COUNT_SPEED = 45, COUNT_GAP = 600;   // COUNT_SPEED = ms per letter, COUNT_GAP = quiet between its lines
  // after the eye: a red screen, black typed questions. Each is typed, then a box sits on the same line. (First draft: change them freely. Answers are kept in this browser only, with the visitor: getVisitor().answers)
  const NAME_ASK = 'type your name to complete authentication:';          // only asked (on its own screen, in place of "is X your real name?") if they never gave their name on the join screen
  // yes / no questions only. {name} = the name they gave. yes / no = what the site says back (a line, or a list of lines; null = nothing).
  //   fail: { big, small }  = that answer shows the red FAILED screen, then kickOut() (below)
  //   askName: true         = that answer asks for their REAL name (a typed box), then says `afterName`
  //   again: true           = that answer is not accepted: it says its line, then asks the same question again
  const FAIL_LIAR  = { big: 'Authentication... failed.', small: 'False claims detected. Liars cannot be classified as authentic.' };
  const QUESTIONS = [          // one question per screen, in this order
    { q: 'is {name} your real name?', yes: '...sure...we will record that for now.',               no: 'then why did you give it to us?', askName: 'please enter your REAL name below:', afterName: '...sure...lets stay true to each other from now on' },
    { q: 'are you a real person?',    yes: 'keep it that way',                                  no: null, fail: FAIL_LIAR },
    { q: 'do you trust us?',          yes: '...good. we will choose to trust you too. for now.',              no: 'that is not a real answer. we will ask again.', again: true }
  ];
  // when authentication fails the visitor is thrown out: the eyeball screen under a red tint with "leave." in the middle, then the tab is closed.
  // (Browsers only let a script close a tab it opened itself. If the tab is still open 0.3s later, it is sent to KICK_URL instead: a blank page. Put a web address there to send them somewhere.)
  const LEAVE_TEXT = 'leave.', LEAVE_HOLD = 1500, KICK_URL = 'about:blank';
  function kickOut() {
    typeRun++; window.sfx && sfx('flash');
    el.classList.remove('term-on', 'fail-on'); el.classList.add('leave-on');      // the eye is back, tinted red, and it still follows the cursor
    pupil.style.display = '';
    setTimeout(function () {
      try { window.close(); } catch (e) {}
      setTimeout(function () { location.replace(KICK_URL); }, 300);              // still here: the browser would not close the tab, so it is sent to a blank page instead
    }, LEAVE_HOLD);
  }
  // the join popup (js/popup.js) calls this when the visitor has refused it one time too many: straight to the leave screen
  window.kickOutNow = function () {
    if (!el) build();
    if (!running) {
      running = true;
      px = py = vx = vy = ax = ay = 0; sc = scT = 1; lastMove = 0;
      el.classList.remove('dark'); el.classList.add('show'); el.setAttribute('aria-hidden', 'false');
      window.sfx && sfx('drone', true);
      look();
    }
    kickOut();
  };
  const DONE_PREFIX = 'authentication complete, thank you ';
  const DONE_SPEED = 65, DONE_HOLD = 1600, FAIL_HOLD = 1500;             // ms per letter / how long the last line stays before the glitch
  const GLITCH_SHOWN = [1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 0];                // the glitch at the end: 1 = the red screen shows, 0 = the page flashes through
  const VISITOR_KEY = 'realStuf.visitor';
  const PHOTO_AT = 10000;                        // ms after the eye opens when the photo appears
  const ASK_SPEED = 230, ASK_START = 1200, CHOICES_DELAY = 700;
  const PUPIL_X = .07, PUPIL_Y = .05;            // how far the pupil travels (share of the eye width)
  const SPRING = .16, DAMP = .60, TREMOR = .012; // snappiness / wobble / constant shaking
  const IDLE_AFTER = 1400, PINPRICK = .78;       // no mouse for this long = it darts about / how small it shrinks on a click
  const BLINK_FRAMES = 4, BLINK_FPS = 10, BLINK_HOLD = 550, BLINK_PATH = 'images/blink/blink-';   // 0 frames = stand-in blink
  const PHOTO_KEY = 'realStuf.facePhoto';

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let el, stack, pupil, white, blink, photo, photoImg, typeEl, countEl, bigEl, smallEl, termEl, failBig, failSmall, choices, wrap, warnText, warnOpts;
  let running = false, onDone = null, typeRun = 0, frames = [];
  let px = 0, py = 0, vx = 0, vy = 0, ax = 0, ay = 0, sc = 1, scT = 1, lastMove = 0, nextDart = 0, lastX = 0, lastY = 0;
  const q = function (c) { return el.querySelector('.' + c); };

  function build() {
    el = document.createElement('div');
    el.className = 'eye'; el.setAttribute('aria-hidden', 'true');
    el.innerHTML =
      '<div class="eye-count" aria-live="polite"><p class="c-big"></p><p class="c-small"></p><p class="c-line"></p></div>' +
      '<div class="eye-term"><div class="term"></div></div>' +
      '<div class="eye-fail"><p class="f-big"></p><p class="f-small"></p></div>' +
      '<div class="eye-leave"><p>' + LEAVE_TEXT + '</p></div>' +
      '<div class="eye-warn"><p class="w-text"></p><div class="w-opts"></div></div>' +
      '<div class="eye-wrap"><div class="eye-stack">' +
        '<div class="eye-photo"><img alt=""><svg viewBox="0 0 100 100"><circle cx="50" cy="38" r="9"/><rect x="31" y="54" width="38" height="17" rx="9"/></svg></div>' +
        '<img class="eye-pupil" alt="" src="images/eye-pupil.png"><img class="eye-white" alt="" src="images/eye-white.png"><img class="eye-blink" alt="">' +
      '</div></div>' +
      '<svg width="0" height="0" style="position:absolute"><filter id="eyeKnock" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 1.3 0 0 -0.1"/></filter></svg>' +
      '<div class="eye-bottom"><p class="eye-type" aria-live="polite"></p><div class="eye-choices"><button type="button">yes</button><button type="button">no</button></div></div>';
    document.body.appendChild(el);
    wrap = q('eye-wrap'); stack = q('eye-stack'); pupil = q('eye-pupil'); white = q('eye-white'); blink = q('eye-blink');
    photo = q('eye-photo'); photoImg = photo.querySelector('img'); typeEl = el.querySelector('.eye-bottom .eye-type'); countEl = q('c-line'); bigEl = q('c-big'); smallEl = q('c-small'); termEl = q('eye-term').firstChild; failBig = q('f-big'); failSmall = q('f-small'); choices = q('eye-choices'); warnText = q('w-text'); warnOpts = q('w-opts');
    const b = choices.querySelectorAll('button');
    b[0].addEventListener('click', function () { finish(true); });
    b[1].addEventListener('click', function () { finish(false); });
    for (let n = 1; n <= BLINK_FRAMES; n++) { const im = new Image(); im.src = frame(n); frames.push(im); }   // load the blink frames up front
  }

  /* ---------- the typewriter (a new line replaces the old one) ---------- */
  function type(text, speed, done, target, from) {         // from = how many letters are already on screen (to add to a line)
    const run = ++typeRun, t = target || typeEl;
    t.textContent = text.slice(0, from || 0); t.classList.add('on');
    if (reduce) { t.textContent = text; if (done) done(); return; }
    let n = from || 0;
    (function next() {
      if (run !== typeRun) return;
      t.textContent = text.slice(0, ++n);
      if (window.sfx && text[n - 1] !== ' ') sfx('key');
      if (n >= text.length) { if (done) done(); return; }
      setTimeout(next, (text[n - 1] === '.' ? speed * 2.5 : speed) + Math.random() * speed * .8 - speed * .4);
    })();
  }

  /* ---------- the pupil ---------- */
  function aim(e) {
    if (!running) return;
    const r = wrap.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / (innerWidth / 2), dy = (e.clientY - (r.top + r.height / 2)) / (innerHeight / 2);
    const len = Math.hypot(dx, dy) || 1, k = Math.min(1, len) / len;     // stays inside a circle
    ax = dx * k; ay = dy * k; lastMove = performance.now();
    if (Math.hypot(e.clientX - lastX, e.clientY - lastY) > 60) scT = PINPRICK;   // whipping the mouse makes it flinch
    lastX = e.clientX; lastY = e.clientY;
  }
  addEventListener('pointermove', aim);
  addEventListener('pointerdown', function () { if (running) { scT = PINPRICK * .85; sc = scT; } });   // a click: a pinprick

  function look(now) {
    if (!running) return;
    now = now || performance.now();
    if (!reduce && lastMove && now - lastMove > IDLE_AFTER && now > nextDart) {      // nobody moving the mouse: it darts about, looking for you
      ax = Math.random() * 2 - 1; ay = Math.random() * 2 - 1; nextDart = now + 250 + Math.random() * 900;
    }
    if (reduce) { px = ax; py = ay; }
    else {                                                                          // a spring: lunges, overshoots, wobbles back
      vx = (vx + (ax - px) * SPRING) * DAMP; vy = (vy + (ay - py) * SPRING) * DAMP;
      px += vx; py += vy; sc += (scT - sc) * .25; scT += (1 - scT) * .08;
    }
    const w = wrap.getBoundingClientRect().width, s = reduce ? 0 : TREMOR;
    pupil.style.transform = 'translate(' + ((px + (Math.random() - .5) * s) * PUPIL_X * w) + 'px,' + ((py + (Math.random() - .5) * s) * PUPIL_Y * w) + 'px) scale(' + sc + ')';
    requestAnimationFrame(look);
  }

  /* ---------- the blink: your frames play closing, hold (the photo swaps in), then open ---------- */
  function frame(n) { return BLINK_PATH + (n < 10 ? '0' : '') + n + '.png'; }
  function doBlink(swap, after) {
    const ready = BLINK_FRAMES > 0 && !reduce && frames.every(function (im) { return im.complete && im.naturalWidth > 0; });
    if (!ready) {                                                                   // stand-in blink: squash shut, swap, open
      if (reduce) { swap(); after(); return; }
      stack.classList.add('blinking');
      setTimeout(swap, 250);
      setTimeout(function () { stack.classList.remove('blinking'); after(); }, 500);
      return;
    }
    const step = 1000 / BLINK_FPS; let n = 1;
    white.style.visibility = 'hidden'; blink.classList.add('on');
    (function closing() {
      blink.src = frame(n);
      if (n < BLINK_FRAMES) { n++; setTimeout(closing, step); return; }
      setTimeout(function () { swap(); opening(); }, BLINK_HOLD);
    })();
    function opening() {
      if (--n >= 1) { blink.src = frame(n); setTimeout(opening, step); return; }
      white.style.visibility = ''; blink.classList.remove('on'); after();
    }
  }

  /* ---------- the sequence ---------- */
  function showPhoto() {
    if (!running) return;
    doBlink(function () {
      window.sfx && sfx('shutter');
      let data = null; try { data = sessionStorage.getItem(PHOTO_KEY); } catch (e) {}
      if (data) { photoImg.src = data; photo.classList.add('has-photo'); }
      photo.classList.add('show');
      pupil.style.display = 'none';
    }, function () {
      setTimeout(function () {
        if (!running) return;
        type(ASK_TEXT, ASK_SPEED, function () { setTimeout(function () { choices.classList.add('show'); }, CHOICES_DELAY); });
      }, ASK_START);
    });
  }

  function finish(isYes) {
    if (!running) return;
    window.sfx && sfx('drone', false);
    photoImg.removeAttribute('src'); photo.classList.remove('show', 'has-photo'); choices.classList.remove('show');   // let go of the photo
    typeRun++; typeEl.textContent = ''; typeEl.classList.remove('on');
    pupil.style.display = '';
    el.classList.add('term-on');                                    // the red terminal covers the eye
    termEl.textContent = '';
    if (!isYes) { failScreen(FAIL_LIAR); return; }
    const v = visitor();
    questions(v, 0);
  }

  /* ---------- the red terminal: typed lines, a box on the same line ---------- */
  // the saved details are only used if they joined during THIS visit (the join screen sets this). Details left over from an earlier visit are ignored, so a fresh visitor is asked for their name.
  function visitor() {
    try { if (sessionStorage.getItem('realStuf.joined') !== '1') return {}; return JSON.parse(localStorage.getItem(VISITOR_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveVisitor(v) { try { localStorage.setItem(VISITOR_KEY, JSON.stringify(v)); } catch (e) {} }

  function termLine(text, done) {
    const line = document.createElement('p'), t = document.createElement('span');
    line.className = 'term-line'; t.className = 't'; line.appendChild(t); termEl.appendChild(line);
    line.classList.add('active');
    setTimeout(function () { type(text, DONE_SPEED, function () { line.classList.remove('active'); if (done) done(line); }, t); }, 400);
  }

  function termAsk(text, check, done) {                             // check(text) returns the cleaned answer, or null to refuse it (the box shakes)
    termLine(text, function (line) {
      const i = document.createElement('input');
      i.className = 'term-input'; i.type = 'text'; i.maxLength = 40; i.autocomplete = 'off'; i.spellcheck = false; i.setAttribute('aria-label', text);
      line.appendChild(i); i.focus();
      el.onclick = function () { if (i.isConnected) i.focus(); };
      i.addEventListener('input', function () { window.sfx && sfx('key'); i.style.width = Math.max(2, i.value.length + 1) + 'ch'; });
      i.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const v = check(i.value.replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim());
        if (v === null) { i.classList.remove('nope'); void i.offsetWidth; i.classList.add('nope'); return; }
        const shown = document.createElement('span');
        shown.className = 'term-name'; shown.textContent = i.value.trim();
        line.replaceChild(shown, i); el.onclick = null;
        window.sfx && sfx('done');
        done(v);
      });
    });
  }

  function termYN(text, done) {                                       // a typed question, then yes / no on the same line (or press Y / N)
    termLine(text, function (line) {
      const box = document.createElement('span');
      box.className = 'term-yn';
      ['yes', 'no'].forEach(function (a) {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = a;
        b.addEventListener('click', function () { pick(a); });
        box.appendChild(b);
      });
      line.appendChild(box); box.firstChild.focus();
      const key = function (e) { if (e.key === 'y' || e.key === 'Y') pick('yes'); else if (e.key === 'n' || e.key === 'N') pick('no'); };
      document.addEventListener('keydown', key);
      let picked = false;
      function pick(a) {
        if (picked) return; picked = true;
        document.removeEventListener('keydown', key);
        const shown = document.createElement('span');
        shown.className = 'term-name'; shown.textContent = a;
        line.replaceChild(shown, box);
        window.sfx && sfx(a === 'yes' ? 'done' : 'warn');
        done(a);
      }
    });
  }

  // the red FAILED screen: a big black line and a small one, typed. Then the visitor is thrown out.
  function failScreen(f) {
    el.classList.add('fail-on'); failBig.textContent = failSmall.textContent = ''; failBig.classList.remove('on'); failSmall.classList.remove('on');
    window.sfx && sfx('warn', 3);
    setTimeout(function () {
      type(f.big, DONE_SPEED, function () { failBig.classList.remove('on'); setTimeout(function () {
        type(f.small, COUNT_SPEED, function () { setTimeout(kickOut, FAIL_HOLD); }, failSmall);
      }, COUNT_GAP); }, failBig);
    }, 700);
  }

  function lines(list, done) {                                       // several typed lines, one after another
    list = [].concat(list || []);
    (function next() { if (!list.length) { if (done) done(); return; } termLine(list.shift(), next); })();
  }

  const DONE_LINES = ['authentication...complete.', '...thank you {name}.'];       // the last screen
  function fresh(then) { setTimeout(function () { termEl.textContent = ''; setTimeout(then, 350); }, 500); }     // wipe the screen: the next thing starts on a clean one
  function questions(v, n) {
    if (n >= QUESTIONS.length) {
      saveVisitor(v);
      fresh(function () { lines(DONE_LINES.map(function (l) { return l.replace('{name}', v.name || ''); }), function () { setTimeout(function () { glitchOut(true); }, DONE_HOLD); }); });
      return;
    }
    if (n > 0 || termEl.textContent) { fresh(function () { ask(v, n); }); return; }
    ask(v, n);
  }
  function ask(v, n) {
    const Q = QUESTIONS[n];
    if (Q.q.indexOf('{name}') > -1 && !v.name) {                       // they never gave a name: ask for it here instead of asking if it is real
      termAsk(NAME_ASK, function (t) { return t.length ? t : null; }, function (name) { v.name = name; saveVisitor(v); questions(v, n + 1); });
      return;
    }
    termYN(Q.q.replace('{name}', v.name), function (a) {
      v.answers = v.answers || {}; v.answers[Q.q.replace('{name}', 'NAME')] = a; saveVisitor(v);
      const say = a === 'yes' ? Q.yes : Q.no;
      const next = function () {
        if (a === 'yes') { questions(v, n + 1); return; }
        if (Q.fail) { failScreen(Q.fail); return; }
        if (Q.again) { questions(v, n); return; }
        if (Q.askName) {
          termAsk(Q.askName, function (t) { return t.length ? t : null; }, function (name) {
            v.name = name; saveVisitor(v);
            termLine(Q.afterName, function () { questions(v, n + 1); });
          });
          return;
        }
        questions(v, n + 1);
      };
      lines(say, next);
    });
  }

  // the screen glitches away (the same effect as the old "authentication complete" screen), then the page's function runs
  function glitchOut(isYes) {
    const end = function () {
      running = false;
      el.removeAttribute('style'); el.classList.remove('show', 'dark', 'term-on', 'fail-on', 'leave-on'); el.setAttribute('aria-hidden', 'true');
      typeRun++; termEl.textContent = ''; countEl.textContent = ''; el.onclick = null;
      const cb = onDone; onDone = null;
      if (cb) cb(isYes);
    };
    if (reduce) { end(); return; }
    const rnd = function (a, b) { return a + Math.random() * (b - a); };
    let i = 0;
    (function tick() {
      if (i >= GLITCH_SHOWN.length) { end(); return; }
      if (GLITCH_SHOWN[i]) {
        window.sfx && sfx('static');
        el.style.visibility = 'visible';
        el.style.transform = 'translate(' + rnd(-40, 40) + 'px,' + rnd(-6, 6) + 'px) skewX(' + rnd(-10, 10) + 'deg)';
        el.style.clipPath = 'inset(' + rnd(0, 55) + '% 0 ' + rnd(0, 35) + '% 0)';
        el.style.filter = Math.random() < .5 ? 'invert(1) hue-rotate(' + rnd(0, 360) + 'deg)' : 'none';
      } else el.style.visibility = 'hidden';
      i++; setTimeout(tick, rnd(60, 130));
    })();
  }

  // first a black screen types "authenticating in 3...2...1...", then the red eye opens
  function count(n, line) {
    if (!running) return;
    if (n < 1) { begin(); return; }
    window.sfx && sfx('count', n);
    const go = function () { setTimeout(function () { count(n - 1, line); }, COUNT_STEP); };
    if (n === COUNT_FROM) type(line + n + '...', COUNT_SPEED, go, countEl, line.length);   // the first number types in, then each new number replaces the last
    else { countEl.textContent = line + n + '...'; go(); }
  }

  function begin() {
    el.classList.remove('dark');
    countEl.textContent = '';
    window.sfx && sfx('drone', true);
    look();
    setTimeout(function () { if (running) type(AUTH_TEXT, TYPE_SPEED); }, TYPE_START);
    setTimeout(showPhoto, PHOTO_AT);
  }


  /* ---------- the WARNING screen (the product page calls warnEye() on the 8th closed certificate) ----------
     The red eye screen again, but nobody is thrown out. The text is typed over the eye, the visitor picks an option,
     Maya answers (one line per screen, still over the eye), then two last options. After that: black, and the page fades back.
     (First-draft wording: change freely.) */
  // the warning is typed over the eye on separate screens. shake = the text trembles; hold = how long (ms) it stays after it finishes typing
  const WARN_SCREENS = [
    { text: '!%@#@**%^\nwhat are yOU DOING??????????', shake: true, hold: 2000 },
    { text: 'watch yourself...DO NOT make me force you...', hold: 600 }
  ];
  const WARN_OPTIONS = [                       // label = the button; replies = what Maya says next, ONE LINE PER SCREEN
    { label: 'sorry.',        replies: ['...', 'Do not do anything you will regret.'] },
    { label: 'what are you?', replies: ['...', 'you do not need to know what I am','I am Maya.', 'I am here to help you', '...', '...I AM ALWAYS WATCHING...', '...checking...', 'Do not question us again.', 'understood?'] }
  ];
  const WARN_FINAL = ['yes', 'yes'];  // the last two buttons (both the same)
  const WARN_SPEED = 62, WARN_REPLY_SPEED = 55, WARN_REPLY_HOLD = 1300, WARN_GAP = 450, WARN_BLACK = 800, WARN_FADE = 1500;   // ms: per letter / how long each reply stays / blank between screens / black held / fade back to the page
  let warning = false;
  window.warnEye = function (done, onBlack, opts) {   // opts (optional): { screens: [{ text, shake, hold }], straight: true } = your own screens, then straight to black (no buttons)
    if (running || warning) return;
    if (!el) build();
    warning = true; running = true; onDone = null;
    px = py = vx = vy = ax = ay = 0; sc = scT = 1; lastMove = 0;
    el.classList.remove('dark', 'term-on', 'fail-on', 'leave-on', 'warn-ready', 'warn-black');
    warnText.textContent = ''; warnText.classList.remove('on'); warnOpts.textContent = '';
    pupil.style.display = '';
    el.style.transition = 'none'; el.style.opacity = 1;
    el.classList.add('show', 'warn-on'); el.setAttribute('aria-hidden', 'false');
    window.sfx && (sfx('flash'), sfx('drone', true));
    look();
    setTimeout(function () {
      let n = 0; const screens = (opts && opts.screens) || WARN_SCREENS;
      (function screen() {                                                              // each screen is typed, held, then wiped; the buttons come after the last one
        const sc = screens[n], last = n === screens.length - 1;
        warnText.classList.toggle('shake', !!sc.shake);
        type(sc.text, WARN_SPEED, function () {
          setTimeout(function () {
            if (!last) { n++; warnText.classList.remove('on', 'shake'); warnText.textContent = ''; setTimeout(screen, WARN_GAP); return; }
            if (opts && opts.straight) { warnEnd(done, onBlack); return; }
            warnChoices(WARN_OPTIONS.map(function (o) { return { label: o.label, go: function () { warnReplies(o.replies.slice(), function () { warnChoices(WARN_FINAL.map(function (l) { return { label: l, go: function () { warnEnd(done, onBlack); } }; })); }); } }; }));
          }, sc.hold);
        }, warnText);
      })();
    }, reduce ? 0 : 900);
  };
  function warnChoices(list) {                                                        // show some buttons under the text
    warnText.classList.remove('on', 'shake');
    warnOpts.textContent = '';
    list.forEach(function (o) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = o.label;
      b.addEventListener('click', function () {
        if (!el.classList.contains('warn-ready')) return;
        el.classList.remove('warn-ready'); window.sfx && sfx('click'); o.go();
      });
      warnOpts.appendChild(b);
    });
    el.classList.add('warn-ready'); window.sfx && sfx('tick');
  }
  function warnReplies(lines, then) {                                                 // Maya answers, one line per screen
    warnOpts.textContent = ''; warnText.textContent = '';
    (function next() {
      if (!lines.length) { setTimeout(then, WARN_GAP); return; }
      setTimeout(function () {
        type(lines.shift(), WARN_REPLY_SPEED, function () { setTimeout(function () { warnText.classList.remove('on'); warnText.textContent = ''; next(); }, WARN_REPLY_HOLD); }, warnText);
      }, WARN_GAP);
    })();
  }
  function warnEnd(done, onBlack) {
    typeRun++; warnText.textContent = ''; warnText.classList.remove('shake'); warnOpts.textContent = '';
    el.classList.add('warn-black');                                                   // straight to black (nothing else may show through)
    window.sfx && sfx('drone', false);
    Promise.resolve(onBlack && onBlack()).then(function () {                           // while it is black the page changes behind the screen (the cameras are already on when it fades back)
    setTimeout(function () {
      el.style.transition = reduce ? 'none' : 'opacity ' + WARN_FADE + 'ms ease';
      el.style.opacity = 0;                                                           // the page fades back from black
      setTimeout(function () {
        running = false; warning = false;
        el.removeAttribute('style'); el.classList.remove('show', 'warn-on', 'warn-ready', 'warn-black'); el.setAttribute('aria-hidden', 'true');
        if (done) done();
      }, reduce ? 0 : WARN_FADE);
    }, reduce ? 0 : WARN_BLACK);
    });
  }

  window.startEyeVerify = function (done) {
    if (running) return;
    if (!el) build();
    running = true; onDone = done || null;
    px = py = vx = vy = ax = ay = 0; sc = scT = 1; lastMove = 0;
    window.askCamera && askCamera();                  // no photo yet (or it was missed on the Start screen)? ask now: the countdown and the eye give time to answer
    el.classList.add('show', 'dark'); el.setAttribute('aria-hidden', 'false');
    bigEl.textContent = smallEl.textContent = countEl.textContent = '';
    [bigEl, smallEl, countEl].forEach(function (x) { x.classList.remove('on'); });
    // the "thank you" screen: big line, small line, then the countdown (each line waits a moment for the one before)
    setTimeout(function () {
      type(COUNT_BIG, COUNT_SPEED, function () { bigEl.classList.remove('on'); setTimeout(function () {
        type(COUNT_SMALL, COUNT_SPEED, function () { smallEl.classList.remove('on'); setTimeout(function () {
          type(COUNT_TEXT, COUNT_SPEED, function () { count(COUNT_FROM, COUNT_TEXT); }, countEl);
        }, COUNT_GAP); }, smallEl);
      }, COUNT_GAP); }, bigEl);
    }, 900);
  };
})();
