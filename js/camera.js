/* =====================================================
   camera.js : asks for the camera ONCE (when the Start screen appears) and takes one photo, then switches the camera off.
   The photo stays in this tab only (sessionStorage): it is never uploaded. The eye (eye.js) reads it from there.
   The browser's own permission box can't be hidden or restyled: that's a privacy rule of every browser.
   If it's refused, nothing breaks: the eye just shows a grey silhouette.
   ===================================================== */
(function () {
  const KEY = 'realStuf.facePhoto', WIDTH = 720, SETTLE = 900, WAIT_MAX = 8000;   // WAIT_MAX: Start never waits longer than this for the visitor to answer
  let pending = null;

  // askCamera(true) = always take a fresh photo (the Start screen). askCamera() = only if there isn't one yet.
  // camAllowed(): resolves true only if the visitor has ALREADY allowed the camera (answered on the Start screen). Every other page uses this, so the permission box
  // never appears again after index.html. (Browsers that cannot report the state answer true, as before.)
  window.camAllowed = function () {
    try { if (!navigator.permissions || !navigator.permissions.query) return Promise.resolve(true);
      return navigator.permissions.query({ name: 'camera' }).then(function (s) { return s.state === 'granted'; }, function () { return true; }); } catch (e) { return Promise.resolve(true); }
  };

  window.askCamera = function (fresh) {
    if (pending) return pending;
    if (!fresh) { try { if (sessionStorage.getItem(KEY)) return Promise.resolve(); } catch (e) {} return camAllowed().then(function (ok) { if (ok) return ask(false); }); }      // only the Start button is allowed to open the permission box
    return ask(true);
  };
  function ask(fresh) {
    if (pending) return pending;
    try { if (fresh) sessionStorage.removeItem(KEY); else if (sessionStorage.getItem(KEY)) return; } catch (e) {}
    console.info('camera: asking...');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { console.warn('camera: not available here (needs https:// or localhost)'); return Promise.resolve(); }
    pending = navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false }).then(function (stream) {
      const v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.srcObject = stream;
      const stop = function () { stream.getTracks().forEach(function (t) { t.stop(); }); };
      return v.play().then(function () { return new Promise(function (r) { setTimeout(r, SETTLE); }); }).then(function () {
        if (v.videoWidth) {
          const c = document.createElement('canvas'), k = Math.min(1, WIDTH / v.videoWidth);
          c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k);
          c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
          try { sessionStorage.setItem(KEY, c.toDataURL('image/jpeg', .85)); console.info('camera: photo taken'); } catch (e) {}
        }
        stop();
      }).catch(stop);
    }).catch(function (e) { console.warn('camera:', e && e.name); }).then(function () { pending = null; });     // refused or done: either way, stop waiting
    return pending;
  }

  // if the visitor presses Start while the photo is still being taken, wait a moment for it (leaving the page would cancel it)
  document.addEventListener('click', function (e) {
    const a = e.target.closest && e.target.closest('a.start');
    if (!a || !pending) return;
    e.preventDefault();
    Promise.race([pending, new Promise(function (r) { setTimeout(r, WAIT_MAX); })]).then(function () { location.href = a.href; });
  });
})();
