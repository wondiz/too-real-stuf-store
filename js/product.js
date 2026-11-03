/* =====================================================
   product.js : the product page's own bits (nothing creepy yet):
   "<< Back" and the three open/close sections.
   (The "you may also like" cards come from home.js; Ibbi and the rest are on every page.)
   ===================================================== */

// "<< Back" goes to wherever they came from, or the home page
document.getElementById('back').addEventListener('click', function (e) {
  if (history.length > 1 && document.referrer) { e.preventDefault(); history.back(); }
});

// DESCRIPTIONS / DETAILS / SHIPPING AND RETURNS open and close
document.querySelectorAll('.acc-head').forEach(function (head) {
  head.addEventListener('click', function () {
    head.setAttribute('aria-expanded', head.getAttribute('aria-expanded') !== 'true');
  });
});
