/* =====================================================
   review-tee.js : the floating shirt in the review window (review.html).
   It is your Blender model, Models/tee.glb, floating and swaying on the dark screen. js/review-portal.js tells it what to look like for the
   current question (by sending an "rp:tee" event), and it changes: ONE certificate, a MILLION certificates, none, a certificate with a typo,
   a laminated one, a "100% real" label, the back of the shirt, two identical shirts ...
   The certificate pictures are images/cert-1.png ... cert-6.png (yours). Until they exist it paints its own stand-ins.
   If the model or WebGL can't load, a flat picture (images/shop-shirt.png) stays instead.
   ===================================================== */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const MODEL = 'Models/tee.glb';
const CERT_PICS = ['images/cert-4.png', 'images/cert-2.png', 'images/cert-1.png', 'images/cert-3.png', 'images/cert-5.png', 'images/cert-6.png'];   // the ORDER matters: the first one is the certificate on the shirt (the Authenticity Certificate), and the next ones are the nested / extra ones
const FIT = 0.84;            // how much of the canvas height the shirt fills
const SWAY = 0.3;            // how far it swings left and right on its own (radians)
const MANY = 520;            // how many certificates "a million" is
const GAP = 0.012;           // how far the certificates float in front of the cloth (x the shirt's width)

const stage = document.getElementById('stage');
const canvas = document.getElementById('tee');
if (stage && canvas) init();

function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function flat() {                                  // no 3D: keep the flat picture
  const img = document.createElement('img'); img.className = 'rp-flat'; img.alt = ''; img.src = 'images/shop-shirt.png';
  stage.insertBefore(img, canvas); canvas.remove();
}

function init() {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); }
  catch (e) { console.warn('review-tee: no WebGL, keeping the flat picture.'); flat(); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const hemi = new THREE.HemisphereLight(0xffffff, 0x777f8c, 1.3); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(1.2, 2, 3); scene.add(key);
  const fill = new THREE.DirectionalLight(0xdfe6ff, .5); fill.position.set(-2, .5, 1.5); scene.add(fill);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 30);
  const pivot = new THREE.Group(); scene.add(pivot);

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let size = null, holder = null, holder2 = null, decor = null, fx = window.__rpTee || {}, camZ = 4, camTarget = 4, camBase = 4, spinTarget = 0, pop = 0, anger = 0;
  const pool = [];                       // certificate pictures: yours when they load, painted stand-ins until then
  let usingPics = false;

  /* ---------- the certificate pictures ---------- */
  function paint(variant, seed) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 360; const g = c.getContext('2d'), r = rng(seed);
    g.fillStyle = '#f6efd8'; g.fillRect(0, 0, 512, 360);
    g.strokeStyle = '#b01010'; g.lineWidth = 8; g.strokeRect(14, 14, 484, 332); g.lineWidth = 2; g.strokeRect(28, 28, 456, 304);
    g.fillStyle = '#7a0b0b'; g.textAlign = 'center';
    g.font = '700 34px "Inria Serif", Georgia, serif';
    g.fillText(variant === 'typo' ? 'CERTIFCATE OF AUTHENTISITY' : 'CERTIFICATE OF AUTHENTICITY', 256, 84);
    g.font = '400 20px "Inria Serif", Georgia, serif'; g.fillStyle = '#333';
    g.fillText('this item is 100% REAL', 256, 128); g.fillText('(it says so right here)', 256, 156);
    g.beginPath(); g.arc(112, 260, 42, 0, 7); g.fillStyle = '#b01010'; g.fill();
    g.fillStyle = '#f6efd8'; g.font = '700 16px "Inria Serif", Georgia, serif'; g.fillText('REAL', 112, 266);
    g.strokeStyle = '#223'; g.lineWidth = 2; g.beginPath(); g.moveTo(200, 286); g.lineTo(440, 286); g.stroke();
    g.fillStyle = '#223'; g.font = 'italic 30px "Brush Script MT", cursive';
    const sig = variant === 'stranger' ? 'D. Wexlerbaum' : variant === 'self' ? 'the t-shirt' : ['M. Aya', 'R. Stuf', 'A. Real'][Math.floor(r() * 3)];
    g.fillText(sig, 320, 276);
    g.font = '400 14px "Courier New", monospace'; g.fillStyle = '#555'; g.fillText(variant === 'stranger' ? 'signed: (who?)' : 'signed', 320, 306);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  const stand = { normal: [paint('normal', 1), paint('normal', 2), paint('normal', 3)], typo: paint('typo', 4), stranger: paint('stranger', 5), self: paint('self', 6) };
  const loader = new THREE.TextureLoader();
  const slots = [];                                                // filled by position, so the order above holds even if a picture loads late
  CERT_PICS.forEach(function (src, idx) {                          // your pictures replace the stand-ins as they load
    loader.load(src, function (t) {
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; slots[idx] = t;
      pool.length = 0; slots.forEach(function (x) { if (x) pool.push(x); });
      usingPics = true; if (holder) build(false);
    }, undefined, function () {});
  });
  const normalTex = function (k) { return usingPics ? pool[k % pool.length] : stand.normal[k % stand.normal.length]; };
  const aspectOf = function (t) { return t.image && t.image.width ? t.image.width / t.image.height : 512 / 360; };

  function tag(text, fake) {                                       // the sewn-in label
    const c = document.createElement('canvas'); c.width = 256; c.height = 112; const g = c.getContext('2d');
    g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, 256, 112); g.strokeStyle = fake ? '#d00' : '#444'; g.lineWidth = 4; g.strokeRect(6, 6, 244, 100);
    g.fillStyle = fake ? '#d00' : '#111'; g.font = '700 ' + Math.min(46, Math.floor(226 / (text.length * .62))) + 'px "Courier New", monospace'; g.textAlign = 'center'; g.fillText(text, 128, 70);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function qrTex() {                                              // a QR code (pretend: three squares and noise)
    const N = 25, c = document.createElement('canvas'); c.width = c.height = 300; const g = c.getContext('2d'), r = rng(11), m = 300 / (N + 4);
    g.fillStyle = '#fff'; g.fillRect(0, 0, 300, 300); g.fillStyle = '#000';
    const finder = function (x, y) { g.fillRect((x + 2) * m, (y + 2) * m, 7 * m, 7 * m); g.fillStyle = '#fff'; g.fillRect((x + 3) * m, (y + 3) * m, 5 * m, 5 * m); g.fillStyle = '#000'; g.fillRect((x + 4) * m, (y + 4) * m, 3 * m, 3 * m); };
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const inF = (x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9);
      if (!inF && r() > .5) g.fillRect((x + 2) * m, (y + 2) * m, m + .5, m + .5);
    }
    finder(0, 0); finder(N - 7, 0); finder(0, N - 7);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
  function wordsTex(seed) {                                       // scattered "I AM REAL", all sizes (red on clear, white on red, red on yellow)
    return canvasTex(560, 660, function (g, w, h) {
      const r = rng(seed + 3); g.textBaseline = 'middle'; g.textAlign = 'center';
      for (let i = 0; i < 46; i++) {
        const size = 16 + Math.pow(r(), 1.8) * 92, x = r() * w, y = r() * h, kind = Math.floor(r() * 3), txt = 'I AM REAL', font = (r() > .5 ? '700 ' : '400 ') + size + 'px "Inria Serif", Georgia, serif';
        g.save(); g.translate(x, y); g.rotate((r() - .5) * .35); g.font = font; const tw = g.measureText(txt).width;
        if (kind === 1) { g.fillStyle = '#e8112d'; g.fillRect(-tw / 2 - size * .2, -size * .62, tw + size * .4, size * 1.24); g.fillStyle = '#fff'; }
        else if (kind === 2) { g.fillStyle = '#ffd400'; g.fillRect(-tw / 2 - size * .2, -size * .62, tw + size * .4, size * 1.24); g.fillStyle = '#e8112d'; }
        else g.fillStyle = '#e8112d';
        g.fillText(txt, 0, 0); g.restore();
      }
    });
  }
  function passportTex() { return canvasTex(300, 420, function (g, w, h) {
    g.fillStyle = '#10264f'; g.fillRect(0, 0, w, h); g.strokeStyle = '#c9a54a'; g.lineWidth = 4; g.strokeRect(14, 14, w - 28, h - 28);
    g.fillStyle = '#c9a54a'; g.textAlign = 'center'; g.font = '700 38px "Inria Serif", Georgia, serif'; g.fillText('PASSPORT', w / 2, 90);
    g.font = '400 20px "Inria Serif", Georgia, serif'; g.fillText('REAL STUF.', w / 2, 125); g.beginPath(); g.arc(w / 2, 230, 52, 0, 7); g.lineWidth = 4; g.stroke();
    g.font = '700 26px "Inria Serif", Georgia, serif'; g.fillText('REAL', w / 2, 238); g.font = '400 16px "Courier New", monospace'; g.fillText('nationality: real', w / 2, 360); }); }
  function birthTex() { return canvasTex(420, 300, function (g, w, h) {
    g.fillStyle = '#f6efd8'; g.fillRect(0, 0, w, h); g.strokeStyle = '#6b4a1e'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20); g.fillStyle = '#4a3410'; g.textAlign = 'center';
    g.font = '700 30px "Inria Serif", Georgia, serif'; g.fillText('BIRTH CERTIFICATE', w / 2, 62); g.font = '400 19px "Courier New", monospace'; g.textAlign = 'left';
    g.fillText('name:  A Real T-shirt', 36, 120); g.fillText('born:  100% real', 36, 156); g.fillText('date:  real day / real month', 36, 192); g.fillText('witness:  we saw it', 36, 228);
    g.beginPath(); g.arc(w - 70, h - 60, 30, 0, 7); g.fillStyle = '#b01010'; g.fill(); }); }
  function stickerTex(text) { return canvasTex(420, 150, function (g, w, h) {
    g.fillStyle = '#ffc800'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; g.textAlign = 'center'; g.font = '700 46px Arial, Helvetica, sans-serif';
    const parts = String(text).split(' '); const l1 = parts.slice(0, Math.ceil(parts.length / 2)).join(' '), l2 = parts.slice(Math.ceil(parts.length / 2)).join(' ');
    g.fillText(l1, w / 2, 62); g.fillText(l2, w / 2, 116); g.fillStyle = '#d00'; g.beginPath(); g.arc(w - 26, 26, 10, 0, 7); g.fill(); }); }
  function eyeTex() { return canvasTex(420, 260, function (g, w, h) {
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(14, h / 2); g.quadraticCurveTo(w / 2, -40, w - 14, h / 2); g.quadraticCurveTo(w / 2, h + 40, 14, h / 2); g.fill();
    g.lineWidth = 6; g.strokeStyle = '#111'; g.stroke(); g.fillStyle = '#c00'; g.beginPath(); g.arc(w / 2, h / 2, 62, 0, 7); g.fill(); g.fillStyle = '#000'; g.beginPath(); g.arc(w / 2, h / 2, 30, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(w / 2 - 12, h / 2 - 14, 9, 0, 7); g.fill(); }); }
  const sheenTex = (function () {
    const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 128, 64); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.42, 'rgba(255,255,255,.0)'); gr.addColorStop(.5, 'rgba(255,255,255,.75)'); gr.addColorStop(.58, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 64); return new THREE.CanvasTexture(c);
  })();

  /* ---------- the model ---------- */
  new GLTFLoader().load(MODEL, function (gltf) {
    const model = gltf.scene;
    model.traverse(function (o) {
      if (!o.isMesh) return;
      const old = o.material;
      o.material = new THREE.MeshLambertMaterial({ color: old.color ? old.color.clone() : 0xffffff, side: THREE.DoubleSide });
    });
    const box = new THREE.Box3().setFromObject(model);
    model.position.sub(box.getCenter(new THREE.Vector3()));
    size = box.getSize(new THREE.Vector3());
    holder = new THREE.Group(); holder.add(model); pivot.add(holder);
    holder2 = new THREE.Group(); holder2.add(model.clone()); holder2.visible = false; pivot.add(holder2);
    camZ = camTarget = camBase = (size.y / FIT / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.set(0, 0, camZ);
    build(true);
    requestAnimationFrame(frame);
  }, undefined, function (e) { console.warn('review-tee: could not load ' + MODEL + ' (is the page opened from a web server? is the folder called Models?)', e); flat(); });

  /* ---------- what is on the shirt for this question ---------- */
  function build(animate) {
    if (!holder) return;
    if (decor) { holder.remove(decor); decor.traverse(function (o) { if (o.isMesh && o.material) o.material.dispose(); if (o.isMesh && o.geometry) o.geometry.dispose(); }); }
    decor = new THREE.Group(); holder.add(decor);
    const W = size.x, H = size.y, zf = size.z / 2 + GAP * W;
    const side = new THREE.Group(); decor.add(side);
    if (fx.view === 'back') { side.rotation.y = Math.PI; }          // the back of the shirt: the certificates are stuck on the back too, so they follow the turn
    const r = rng(7 + (fx.seed || 0));
    let order = 1;
    const plane = function (tex, w, x, y, rot, mat) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat || new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      const a = aspectOf(tex); m.scale.set(w, w / a, 1); m.position.set(x, y, zf); m.rotation.z = rot; m.renderOrder = order++; side.add(m); return m;
    };
    const n = fx.n === 'many' ? MANY : Math.max(0, Math.round(fx.n || 0));
    if (fx.n === 'many') {
      const geo = new THREE.PlaneGeometry(1, 1), mats = [0, 1, 2].map(function (k) { return new THREE.MeshBasicMaterial({ map: normalTex(k), transparent: true, depthWrite: false, side: THREE.DoubleSide }); });
      const per = Math.ceil(n / 3);
      mats.forEach(function (mat, k) {
        const im = new THREE.InstancedMesh(geo, mat, per), d = new THREE.Object3D(), a = aspectOf(mat.map);
        for (let i = 0; i < per; i++) {
          const w = (.12 + r() * .24) * W; d.position.set((r() - .5) * .95 * W, (r() - .5) * .95 * H, zf); d.rotation.set(0, 0, (r() - .5) * 1.4); d.scale.set(w, w / a, 1); d.updateMatrix(); im.setMatrixAt(i, d.matrix);
        }
        im.renderOrder = 1 + k; side.add(im);
      });
    } else {
      for (let i = 0; i < n; i++) {
        const variant = i === 0 ? (fx.v || 'normal') : 'normal';
        const tex = variant === 'normal' ? normalTex(i) : (usingPics ? normalTex(i) : stand[variant]);
        const w = (fx.big && i === 0 ? .66 : (n === 1 ? .36 : .24 + r() * .08)) * W;
        const x = n === 1 ? 0 : (r() - .5) * .5 * W, y = n === 1 ? -.03 * H : (r() - .55) * .52 * H;
        const m = plane(tex, w, x, y, n === 1 ? .04 : (r() - .5) * .6);
        if (fx.glossy && i === 0) {                                  // laminated: a shiny layer over it
          const sh = plane(sheenTex, w * 1.04, x, y, .04, new THREE.MeshBasicMaterial({ map: sheenTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
          sh.scale.y = m.scale.y * 1.04; sh.userData.sheen = true; sh.userData.x0 = x; sh.userData.w = w; sh.renderOrder = 900;
          const edge = plane(tex, w * 1.07, x, y, .04, new THREE.MeshBasicMaterial({ color: 0xcfe8f5, transparent: true, opacity: .35, depthWrite: false, side: THREE.DoubleSide })); edge.renderOrder = 0; edge.scale.y = m.scale.y * 1.07;
        }
      }
    }
    if (fx.nest) {                                                  // a certificate stuck on the certificate, and on that one ...
      let w = .36 * W, x = 0, y = -.03 * H;
      for (let k = 1; k <= fx.nest; k++) { w *= .55; x += .1 * W / k; y -= .07 * H / k; const m = plane(normalTex(k), w, x, y, .09 * k); m.renderOrder = 300 + k; }
    }
    if (fx.words) { const m = plane(wordsTex(fx.seed || 0), .56 * W, 0, -.02 * H, 0); m.scale.y = .66 * H; m.renderOrder = 400; }
    if (fx.docs) { plane(passportTex(), .2 * W, -.14 * W, .02 * H, -.14).renderOrder = 410; plane(birthTex(), .3 * W, .1 * W, -.07 * H, .1).renderOrder = 420; }
    if (fx.sticker) plane(stickerTex(fx.sticker), .38 * W, 0, .06 * H, -.04).renderOrder = 430;
    if (fx.eye) plane(eyeTex(), .42 * W, 0, .04 * H, 0).renderOrder = 440;
    if (fx.qr) { const m = plane(qrTex(), .34 * W, 0, -.02 * H, 0); m.renderOrder = 940; }
    if (fx.label) {
      const t = tag(fx.label === 'fake' ? '100% FAKE' : fx.label === 'real' ? '100% REAL' : String(fx.label).toUpperCase(), fx.label === 'fake');
      const m = plane(t, .3 * W, 0, .22 * H, 0); m.renderOrder = 950;
    }
    holder2.visible = !!fx.twin;
    camBase = ((size.y / FIT / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * (fx.twin ? 1.75 : 1);
    spinTarget = fx.view === 'back' ? 0 : 0;                          // (the back view turns the whole shirt, below)
    if (animate !== false) pop = 1;
  }

  window.addEventListener('rp:tee', function (e) { fx = e.detail || {}; window.__rpTee = fx; build(true); });

  /* ---------- every frame ---------- */
  let last = performance.now(), t = 0, xShift = 0, turn = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(.1, (now - last) / 1000); last = now; t += dt;
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    if (canvas.dataset.w !== w + 'x' + h) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); canvas.dataset.w = w + 'x' + h; }
    const k = 1 - Math.exp(-3.2 * dt);
    if (size) { const wideFit = (size.x * 1.12 / FIT / 2) / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect); camTarget = Math.max(camBase, wideFit); }   // a narrow window (the result screen): move back so the whole shirt still fits
    camZ += (camTarget - camZ) * k; camera.position.z = camZ;
    const want = fx.view === 'back' ? Math.PI : 0;
    turn += (want - turn) * (1 - Math.exp(-2.6 * dt));
    anger += ((fx.anger || 0) - anger) * k;
    const sway = reduce ? 0 : Math.sin(t * .9) * SWAY * (fx.view === 'back' ? .5 : 1);
    pivot.rotation.y = turn + sway;
    const bob = reduce ? 0 : Math.sin(t * 1.3) * size.y * .02;
    const shake = anger > .5 ? (Math.random() - .5) * size.y * .02 * (anger - .5) * 2 : 0;
    pivot.position.set(shake, bob, 0);
    const spread = fx.twin ? .55 * size.x : 0; xShift += (spread - xShift) * k;
    holder.position.x = -xShift; holder2.position.x = xShift;
    pop *= Math.exp(-5 * dt); decor.scale.setScalar(1 + .12 * pop);
    hemi.color.setRGB(1, 1 - anger * .6, 1 - anger * .6);
    decor.traverse(function (o) { if (o.userData.sheen) o.position.x = o.userData.x0 + Math.sin(t * 1.4) * o.userData.w * .4; });
    renderer.render(scene, camera);
  }
}
