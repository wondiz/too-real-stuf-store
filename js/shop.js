/* =====================================================
   shop.js : the shop page. One page serves every category: shop.html?c=women (men, kids, new, sale).
     - sets the heading, the highlighted nav item and the product codes (W14, M14 ...)
     - draws the 12 cards (same photos as the home page), hearts, click-through to the product page
     - the page numbers (they all show the same shirts: "all one of a kind")
     - (the "you have been authenticated" block at the bottom was removed)
   ===================================================== */

const CATS = {
  'new':   { title: 'NEW IN', letter: 'N' },
  'men':   { title: 'MEN',    letter: 'M' },
  'women': { title: 'WOMEN',  letter: 'W' },
  'kids':  { title: 'KIDS',   letter: 'K' },
  'sale':  { title: 'SALE',   letter: 'S' }
};
const key = (new URLSearchParams(location.search).get('c') || 'women').toLowerCase();
const cat = CATS[key] || CATS.women;

// heading, tab title, and which nav item is underlined
document.getElementById('shopTitle').textContent = cat.title;
document.title = cat.title + ' · Real Stuf.™';
document.querySelectorAll('.nav li').forEach(function (li) {
  li.classList.toggle('here', li.textContent.trim().toUpperCase() === cat.title);
});

// the cards
const SHIRT = 'images/tshirt.png';
const PEOPLE = ['images/card_hover_5.png', 'images/card_hover_1.png', 'images/card_hover_2.png', 'images/card_hover_3.png', 'images/card_hover_4.png'];
const NUMS = ['14', '23', '09', '21'];          // the four codes repeat along every row
const COUNT = 18;                                  // cards per page (6 across x 3 rows)
const HEART_SVG =
  '<svg viewBox="0 0 27 33" width="27" height="33"><path d="M13.5 29C4 22 2 16.5 2 12.2 2 8 5 5.5 8.2 5.5c2.2 0 4 1.2 5.3 3.2 1.3-2 3.1-3.2 5.3-3.2C22 5.5 25 8 25 12.2 25 16.5 23 22 13.5 29Z" fill="none" stroke="#000" stroke-width="1.6"/></svg>';

// THE VANISHING CARDS: wherever the cursor goes, that shirt is "purchased" by someone else 2 seconds ago. The last card left can't be taken: it is the only one they can click into.
const BUYERS = ['Mia', 'Jordan', 'Priya', 'Lucas', 'Aiko', 'Tom', 'Sofia', 'Dev', 'Hannah', 'Mateo', 'Chloe', 'Omar', 'Ellie', 'Noah', 'Yuki', 'Sam'];   // first draft: edit freely
const SOLD_TEXT = function (name) { return 'purchased by ' + name + ' 2 seconds ago!'; };
const SOLD_DELAY = 90;                            // ms the cursor must rest on a card before it goes (so a flick across the grid does not wipe everything)
// THE PHOTO BLINK: now and then, for one frame, the model in the hover photo looks straight at the camera. Needs a second picture per photo (the same name + _look): images/card_hover_1_look.png ... If a _look picture is missing, that photo simply never blinks.
const BLINK_CHANCE = 0.5;                         // chance per hover. TESTING value. For the real thing use about 0.07 (roughly one hover in fourteen)
const BLINK_AFTER = 0;                            // hovers at the start with no blink at all (so they learn the normal behaviour first). Try 4 or 5 for the real thing
const BLINK_MS = 110, BLINK_AT = 300, BLINK_SELL = 760;   // ms: how long the look lasts / when it happens after the hover starts / when the card goes after a blink hover
const lookOk = {};                                // which _look pictures exist
let hovers = 0;
const lookOf = function (src) { return src.replace(/\.png$/, '_look.png'); };
PEOPLE.forEach(function (src) { const im = new Image(); im.onload = function () { lookOk[src] = true; }; im.src = lookOf(src); });   // which _look pictures exist
const soldOn = {};                                // which cards are gone, per page: soldOn[page][i] = the buyer's name

const grid = document.getElementById('grid');
const hearted = {};                              // which hearts are filled, so they survive a page change

function draw(page) {
  grid.innerHTML = '';
  for (let i = 0; i < COUNT; i++) {
    const n = (page - 1) * COUNT + i;            // every page shows the same shirt (they are all "one of a kind")
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.i = i;
    const buyer = soldOn[page] && soldOn[page][i];
    if (buyer) card.classList.add('sold');
    card.innerHTML =
      '<div class="box"></div>' +
      '<div class="pic"><img alt="" src="' + SHIRT + '"></div>' +
      '<div class="hover"><img alt="" src="' + PEOPLE[n % PEOPLE.length] + '"><span>click to view</span></div>' +
      '<button class="heart' + (hearted[i + ':' + page] ? ' on' : '') + '" aria-label="Save">' + HEART_SVG + '</button>' +
      '<p class="name">IM THE REAL ONE</p>' +
      '<p class="price">A$199</p>' +
      '<p class="code">' + cat.letter + NUMS[i % NUMS.length] + '</p>' +
      '<p class="soldmsg">' + (buyer ? SOLD_TEXT(buyer) : '') + '</p>';
    grid.appendChild(card);
  }
}

let page = 1;
draw(page);

let soldCount = 0;                                // how many cards have sold out in this visit to the page
function liveCards() { return grid.querySelectorAll('.card:not(.sold)'); }
function sell(card) {                              // this card is gone (unless it is the last one)
  if (card.classList.contains('sold') || liveCards().length <= 1) return false;
  const name = BUYERS[Math.floor(Math.random() * BUYERS.length)];
  (soldOn[page] = soldOn[page] || {})[card.dataset.i] = name;
  card.querySelector('.soldmsg').textContent = SOLD_TEXT(name);
  card.classList.add('sold');
  window.sfx && sfx('tick');
  soldCount++; window.dispatchEvent(new CustomEvent('realstuf:sold', { detail: soldCount }));    // js/assistant.js: Maya comments on how fast they go
  return true;
}
let sellT = null, blinkT = null, blinkBack = null;
function stopHover() {
  clearTimeout(sellT); clearTimeout(blinkT);
  if (blinkBack) { blinkBack(); blinkBack = null; }
}
grid.addEventListener('pointerover', function (e) {
  const card = e.target.closest('.card');
  if (!card || e.pointerType === 'touch' || card.classList.contains('sold')) return;
  if (card.contains(e.relatedTarget)) return;                               // moving inside the same card
  stopHover();
  hovers++;
  const img = card.querySelector('.hover img'), src = img && img.getAttribute('src');
  const blink = img && lookOk[src] && hovers > BLINK_AFTER && Math.random() < BLINK_CHANCE;
  if (blink) {
    blinkT = setTimeout(function () {                                       // one frame: the model looks at the camera
      img.src = lookOf(src);
      blinkBack = function () { img.src = src; };
      setTimeout(function () { if (blinkBack) { blinkBack(); blinkBack = null; } }, BLINK_MS);
    }, BLINK_AT);
  }
  sellT = setTimeout(function () { sell(card); }, blink ? BLINK_SELL : SOLD_DELAY);
});
grid.addEventListener('pointerout', function (e) {
  const card = e.target.closest('.card');
  if (card && !card.contains(e.relatedTarget)) stopHover();
});

grid.addEventListener('click', function (e) {
  const card0 = e.target.closest('.card');
  if (card0 && card0.classList.contains('sold')) return;                     // nothing to click: it is gone
  if (card0 && liveCards().length > 1 && sell(card0)) return;               // a tap / click with no hover first: it goes instead of opening
  const heart = e.target.closest('.heart');
  if (heart) {
    heart.classList.toggle('on');
    hearted[heart.closest('.card').dataset.i + ':' + page] = heart.classList.contains('on');
    return;
  }
  if (e.target.closest('.card')) location.href = 'product.html';
});

// page numbers: 1 2 3 4 5 and ">>"
const pager = document.getElementById('pager');
const LAST = 5;
function go(p) {
  page = Math.max(1, Math.min(LAST, p));
  pager.querySelectorAll('[data-p]').forEach(function (b) { b.classList.toggle('on', +b.dataset.p === page); });
  draw(page);
  window.sfx && sfx('tick');
  const top = document.querySelector('.shop-head');
  top && top.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}
pager.addEventListener('click', function (e) {
  const b = e.target.closest('button');
  if (!b) return;
  go(b.classList.contains('next') ? page + 1 : +b.dataset.p);
});

