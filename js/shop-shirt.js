/* =====================================================
   shop-shirt.js : the floating shirt in the middle of the shop page. It is your Blender model, Models/tee.glb.
   It faces the front, sways gently, and can be dragged round (it eases back to the front when let go).
   If the model can't load (or WebGL is missing) the flat picture images/shop-shirt.png stays instead.
   ===================================================== */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const MODEL = 'models/tee.glb';
const FIT   = 0.9;      // how much of the canvas height the shirt fills
const SWAY  = 0.32;     // how far it swings left and right on its own (radians)
const EASE  = 2.2;
const BACK_AT = 1.9;    // turned this far round (radians) = it is showing its back (once Maya is suspicious it snaps to the front)      // how fast it eases back to the front after a drag

const hero   = document.querySelector('.shop-hero');
const canvas = document.getElementById('shirt3d');
if (hero && canvas) init();

function init() {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); }
  catch (e) { console.warn('shop-shirt: no WebGL, keeping the flat picture.'); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f9a, 1.35));
  const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(1.2, 2, 3); scene.add(key);
  const fill = new THREE.DirectionalLight(0xdfe6ff, .5); fill.position.set(-2, .5, 1.5); scene.add(fill);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 20);
  const pivot = new THREE.Group();
  scene.add(pivot);
  let bob = 0;           // how far it floats up (set once the model is measured); the bobbing is done here, not with a CSS animation on the canvas

  new GLTFLoader().load(MODEL, function (gltf) {
    const model = gltf.scene;
    model.traverse(function (o) {
      if (!o.isMesh) return;
      const old = o.material;
      o.material = new THREE.MeshLambertMaterial({ color: old.color ? old.color.clone() : 0xffffff, side: THREE.DoubleSide });
    });
    const box = new THREE.Box3().setFromObject(model);
    model.position.sub(box.getCenter(new THREE.Vector3()));
    pivot.add(model);
    const size = box.getSize(new THREE.Vector3());
    bob = 0.024 * size.y / FIT;
    camera.position.set(0, 0, (size.y / FIT / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    hero.classList.add('has3d');
    requestAnimationFrame(frame);
  }, undefined, function (e) {
    console.warn('shop-shirt: could not load ' + MODEL + ' (is the page opened from a web server? is the folder called Models?)', e);
  });

  // drag to turn it
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let drag = false, lastX = 0, spin = 0, t = 0;
  canvas.addEventListener('pointerdown', function (e) { drag = true; lastX = e.clientX; canvas.setPointerCapture(e.pointerId); canvas.classList.add('grab'); });
  canvas.addEventListener('pointermove', function (e) {
    if (!drag) return;
    spin += (e.clientX - lastX) * 0.012; lastX = e.clientX;
    // once Maya is suspicious of the visitor, turning it to the back is not allowed: it snaps to the front and she says so (js/paranoia.js)
    const turned = Math.abs(THREE.MathUtils.euclideanModulo(spin + Math.PI, Math.PI * 2) - Math.PI);
    if (turned > BACK_AT && window.maya && maya.eyed()) { spin = 0; drag = false; canvas.classList.remove('grab'); window.dispatchEvent(new CustomEvent('realstuf:shirtback')); }
  });
  function release() { drag = false; canvas.classList.remove('grab'); spin = THREE.MathUtils.euclideanModulo(spin + Math.PI, Math.PI * 2) - Math.PI; }   // shortest way back to the front
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    if (canvas.dataset.w !== w + 'x' + h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      canvas.dataset.w = w + 'x' + h;
    }
    if (!drag) spin -= spin * Math.min(1, dt * EASE);
    t += dt;
    pivot.rotation.y = spin + (reduce ? 0 : Math.sin(t * 0.6) * SWAY);
    pivot.rotation.x = reduce ? 0 : Math.sin(t * 0.7) * 0.03;
    pivot.position.y = reduce ? 0 : (1 - Math.cos(t * 2 * Math.PI / 5)) / 2 * bob;   // same 5s float as the shadow
    renderer.render(scene, camera);
  }
}
