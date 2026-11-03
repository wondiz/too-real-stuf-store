/* =====================================================
   popup.js : opens popup.html over the current page.
   From any page:  openJoinPopup()   (and closeJoinPopup() if you ever need it)
                   openJoinPopup({ escalate: true })  = the version where every "No thanks." / X turns the screen redder, ending in the leave screen
                   joinPopupOpen()  = is it up right now?
   Listen for what the visitor did:  window.addEventListener('realstuf:popup', e => e.detail)  // 'open', 'close' or 'join'
   ===================================================== */
(function () {
  let frame = null, back = null;
  const pre = document.createElement('link'); pre.rel = 'prefetch'; pre.href = 'popup.html'; document.head.appendChild(pre);   // loads the file early so the dissolve starts right away

  window.closeJoinPopup = function () {
    if (!frame) return;
    frame.remove(); frame = null;
    document.body.style.overflow = '';
    if (back) { back.focus && back.focus(); back = null; }
  };

  window.joinPopupOpen = function () { return !!frame; };

  window.openJoinPopup = function (opt) {
    if (frame) return;
    back = document.activeElement;
    frame = document.createElement('iframe');
    frame.src = 'popup.html' + (opt && opt.escalate ? '?esc=1' : '');
    frame.title = 'Join the Real Stuf. Community';
    frame.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0;background:transparent;z-index:58;color-scheme:normal';   // 58: over Ibbi (56)
    frame.addEventListener('load', function () { frame && frame.contentWindow.focus(); });
    document.body.appendChild(frame);
    document.body.style.overflow = 'hidden';
    window.dispatchEvent(new CustomEvent('realstuf:popup', { detail: 'open' }));
  };

  window.addEventListener('message', function (e) {
    const d = e.data;
    if (!frame || e.source !== frame.contentWindow || !d || d.realStuf !== 'popup') return;
    window.dispatchEvent(new CustomEvent('realstuf:popup', { detail: d.action }));
    if (d.action === 'close') closeJoinPopup();
    if (d.action === 'stage') window.sfx && sfx('warn', d.n);                       // each "No thanks." in the escalating popup is worse
    if (d.action === 'giveup') window.kickOutNow ? kickOutNow() : location.replace('about:blank');   // out of patience: the leave screen (js/eye.js)
  });
})();
