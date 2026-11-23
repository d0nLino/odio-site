// Воронка на прокрутке.
// 1) Заголовок с плашками рисуется в текстуру и по прокрутке закручивается и всасывается
//    в «горло» воронки — синий эллипс внизу экрана.
// 2) Сверху по спирали спускаются карточки работ и исчезают в том же горле.
// Без WebGL или при «уменьшить движение» остаётся статичная обложка из HTML.

import * as THREE from "three";

const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const canvas = document.getElementById("gl");
const mouthEl = document.getElementById("mouth");

const FONT = '"OT Neue Montreal", "Barlow Condensed", "Arial Narrow", sans-serif';
const C = { parme: "#d6cfff", orange: "#ff4000", bleu: "#3aa0ff", black: "#000", white: "#fff" };

// Карточки-заглушки. Потом заменим на картинки кейсов из R2.
const WORKS = [
  { name: "Avorio", sub: "Italian furniture, Dubai", bg: C.black, fg: C.white },
  { name: "Segrex", sub: "Brokers Club", bg: C.bleu, fg: C.white },
  { name: "Altamare", sub: "Superyacht refit, Dubai", bg: C.parme, fg: C.black },
  { name: "Restolab", sub: "Turnkey restaurants", bg: C.orange, fg: C.white },
  { name: "Sulina", sub: "Interior design", bg: "#f2f2f2", fg: C.black },
  { name: "Segrex", sub: "Development, Dubai", bg: "#0b1f3a", fg: C.white },
];

function webglOK() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); }
  catch (e) { return false; }
}

if (!reduce && webglOK()) start().catch((e) => console.error(e));

async function start() {
  try { await document.fonts.load(`500 100px ${FONT}`); } catch (e) {}

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;

  let W = 0, H = 0, DPR = 1;
  let mobile = false;

  // ---------- Текст ----------
  const textCanvas = document.createElement("canvas");
  const textTex = new THREE.CanvasTexture(textCanvas);
  textTex.premultiplyAlpha = true;
  textTex.minFilter = THREE.LinearFilter;
  textTex.generateMipmaps = false;

  const textMat = new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    premultipliedAlpha: true,
    uniforms: {
      uTex: { value: textTex },
      uRes: { value: new THREE.Vector2(1, 1) },
      uC: { value: new THREE.Vector2(0.5, 0.85) },
      uT: { value: 0 },
      uBlur: { value: new THREE.Vector4(0, 1, 2, 0) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform sampler2D uTex;
      uniform vec2 uRes;   // экран в CSS-пикселях
      uniform vec2 uC;     // центр горла воронки, пиксели от верхнего левого угла
      uniform float uT;    // 0 — текст на месте, 1 — полностью всосан
      uniform vec4 uBlur;  // размытие низа последней строки: начало, полное, конец строки, радиус
      varying vec2 vUv;

      const float SQUASH = 0.5;   // воронка видна под углом — круг сжат по вертикали

      vec2 toSrc(vec2 p) {
        vec2 d = p - uC;
        d.y /= SQUASH;
        float R = length(uRes) * 0.5;
        float r = length(d) / R;
        float s = 1.0 - uT * (0.6 + 0.4 * exp(-r * 2.5));     // сжатие к центру
        s = max(s, 0.0005);
        float th = uT * uT * 9.0 * exp(-r * 1.6) + uT * 0.5;   // закручивание, сильнее у горла
        float c = cos(th), sn = sin(th);
        d = mat2(c, -sn, sn, c) * d;
        d /= s;
        d.y *= SQUASH;
        return uC + d;
      }

      vec4 tap(vec2 s) {
        vec2 uv = s / uRes;
        if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec4(0.0);
        return texture2D(uTex, vec2(uv.x, 1.0 - uv.y));
      }

      void main() {
        vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uRes;
        vec2 rel = p - uC;
        vec2 tang = normalize(vec2(-rel.y, rel.x) + 1e-4);
        float smear = uT * uT * 60.0;                          // смаз по направлению вращения

        vec2 base = toSrc(p);
        float b = uBlur.w * smoothstep(uBlur.x, uBlur.y, base.y) * (1.0 - step(uBlur.z, base.y)) + uT * 10.0;

        vec4 acc = vec4(0.0);
        for (int i = 0; i < 16; i++) {
          float fi = float(i);
          float a = fi * 2.39996;                              // золотой угол
          float rr = sqrt((fi + 0.5) / 16.0);
          vec2 disk = vec2(cos(a), sin(a)) * rr;
          vec2 pi = p + tang * (fi / 15.0 - 0.5) * smear;
          acc += tap(toSrc(pi) + disk * b);
        }
        acc /= 16.0;
        float fade = 1.0 - smoothstep(0.82, 1.0, uT);
        gl_FragColor = acc * fade;
      }
    `,
  });
  const textScene = new THREE.Scene();
  textScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), textMat));
  const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  function drawText() {
    const cw = Math.round(W * DPR), ch = Math.round(H * DPR);
    textCanvas.width = cw; textCanvas.height = ch;
    const ctx = textCanvas.getContext("2d");
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const u = W / 1920;
    const lines = ["O'DÍO:", "THE DESIGN", "PARTNER FOR", "LEADERS"];
    const fs = mobile ? W * 0.17 : 240 * u;
    const lh = fs * 0.85;
    const blockH = lh * lines.length;
    const top = mobile ? H * 0.46 - blockH / 2 - 40 : (H - blockH) / 2;

    ctx.font = `500 ${fs}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = C.black;
    const m = ctx.measureText("HÍ");
    const asc = m.fontBoundingBoxAscent || fs * 0.8;
    const desc = m.fontBoundingBoxDescent || fs * 0.2;
    lines.forEach((t, i) => {
      const y = top + i * lh + (lh - (asc + desc)) / 2 + asc;
      ctx.fillText(t, W / 2, y);
    });

    // плашки
    const labels = [
      { t: "BRANDING & COMMUNICATION", bg: C.parme, fg: C.black, x: 231, y: 132 },
      { t: "DIGITAL PRODUCTS", bg: C.orange, fg: C.white, x: 140, y: 172 },
      { t: "WEB DESIGN", bg: C.bleu, fg: C.white, x: 241, y: 212 },
    ];
    const lfs = mobile ? 11 : 20 * u;
    const lhgt = mobile ? 24 : 32 * u;
    const pad = mobile ? 8 : 12 * u;
    ctx.font = `500 ${lfs}px ${FONT}`;
    if ("letterSpacing" in ctx) ctx.letterSpacing = `${lfs * 0.1}px`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    labels.forEach((l, i) => {
      const w = ctx.measureText(l.t).width + pad * 2;
      let x, y;
      if (mobile) { x = W / 2 - w / 2; y = top + blockH + 18 + i * (lhgt + 6); }
      else { x = W / 2 + l.x * u; y = top + l.y * u; }
      ctx.fillStyle = l.bg; ctx.fillRect(x, y, w, lhgt);
      ctx.fillStyle = l.fg; ctx.fillText(l.t, x + pad, y + lhgt / 2 + lfs * 0.04);
    });
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";

    textTex.needsUpdate = true;
    const lastTop = top + 3 * lh;
    textMat.uniforms.uBlur.value.set(lastTop + lh * 0.45, lastTop + lh * 0.95, lastTop + lh * 1.15, mobile ? 6 : 20 * u);
  }

  // ---------- Карточки ----------
  const cardScene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  cam.position.set(0, 0, 20);
  cam.lookAt(0, 0, 0);

  function cardTexture(w) {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 640;
    const x = c.getContext("2d");
    x.fillStyle = w.bg; x.fillRect(0, 0, 512, 640);
    const g = x.createRadialGradient(380, 520, 10, 380, 520, 420);
    g.addColorStop(0, "rgba(58,160,255,0.55)"); g.addColorStop(1, "rgba(58,160,255,0)");
    x.fillStyle = g; x.fillRect(0, 0, 512, 640);
    x.fillStyle = w.fg;
    x.font = `500 112px ${FONT}`;
    x.textBaseline = "top";
    x.fillText(w.name.toUpperCase(), 32, 36);
    x.font = `500 26px ${FONT}`;
    if ("letterSpacing" in x) x.letterSpacing = "2.6px";
    x.fillText(w.sub.toUpperCase(), 34, 590);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }
  const textures = WORKS.map(cardTexture);

  const cardGeo = new THREE.PlaneGeometry(1, 1.25, 24, 1);
  const cards = [];
  function makeCards(n) {
    cards.forEach((c) => { cardScene.remove(c.mesh); c.mesh.material.dispose(); });
    cards.length = 0;
    for (let i = 0; i < n; i++) {
      const mat = new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        uniforms: { uTex: { value: textures[i % textures.length] }, uBend: { value: 0 }, uOp: { value: 0 } },
        vertexShader: /* glsl */ `
          uniform float uBend;
          varying vec2 vUv;
          void main() {
            vUv = uv;
            vec3 p = position;
            p.z -= uBend * p.x * p.x;               // карточка изогнута по цилиндру воронки
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform sampler2D uTex;
          uniform float uOp;
          varying vec2 vUv;
          void main() {
            vec4 c = texture2D(uTex, gl_FrontFacing ? vUv : vec2(1.0 - vUv.x, vUv.y));
            if (!gl_FrontFacing) c.rgb *= 0.55;     // изнанка темнее
            gl_FragColor = vec4(c.rgb, c.a * uOp);
            #include <colorspace_fragment>
          }
        `,
      });
      const mesh = new THREE.Mesh(cardGeo, mat);
      mesh.visible = false;
      cardScene.add(mesh);
      cards.push({ mesh, a0: (i * 2.39996) % (Math.PI * 2) });
    }
  }

  // ---------- Геометрия сцены ----------
  let mouth = new THREE.Vector2();     // центр горла в пикселях
  let M = new THREE.Vector3();         // он же в мире
  let worldH = 1, worldW = 1;

  function layout() {
    W = window.innerWidth; H = window.innerHeight;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    mobile = W < 768;
    renderer.setPixelRatio(DPR);
    renderer.setSize(W, H, false);

    const r = mouthEl.getBoundingClientRect();
    mouth.set(r.left + r.width / 2, Math.min(r.top + r.height / 2, H * 0.9));
    textMat.uniforms.uRes.value.set(W, H);
    textMat.uniforms.uC.value.copy(mouth);

    cam.aspect = W / H;
    cam.updateProjectionMatrix();
    worldH = 2 * cam.position.z * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    worldW = worldH * cam.aspect;
    const k = worldH / H;
    M.set((mouth.x - W / 2) * k, -(mouth.y - H / 2) * k, 0);

    const n = mobile ? 16 : 24;
    if (cards.length !== n) makeCards(n);
    drawText();
    dirty = true;
  }

  // ---------- Прокрутка ----------
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  let target = 0, prog = 0, dirty = true;
  function readScroll() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    target = max > 0 ? window.scrollY / max : 0;
  }

  const CARD_START = 0.1, CARD_DUR = 0.42;
  function update(p) {
    textMat.uniforms.uT.value = smooth(0.0, 0.36, p);

    const n = cards.length;
    const gap = (1 - 0.06 - CARD_DUR - CARD_START) / (n - 1);
    const Rmax = Math.min(mobile ? worldW * 0.55 : worldW * 0.36, 8);
    const yTop = worldH / 2 + 2.2;
    const size = mobile ? 2.4 : 2.9;
    cards.forEach((c, i) => {
      const q = (p - (CARD_START + i * gap)) / CARD_DUR;
      const mesh = c.mesh;
      if (q <= 0 || q >= 1) { mesh.visible = false; return; }
      mesh.visible = true;
      const R = Rmax * Math.pow(1 - q, 1.25) + 0.05;
      const ang = c.a0 + Math.PI * 2 * 1.6 * Math.pow(q, 1.4);
      const y = yTop + (M.y - yTop) * (1 - Math.pow(1 - q, 1.7));
      mesh.position.set(M.x + R * Math.sin(ang), y, R * Math.cos(ang));
      mesh.rotation.set(0, ang, 0);
      const s = size * (1 - 0.88 * Math.pow(q, 1.3));
      mesh.scale.set(s, s, s);
      mesh.material.uniforms.uBend.value = Math.min(1.2, 1 / (2 * R / s));
      mesh.material.uniforms.uOp.value = smooth(0, 0.05, q) * (1 - smooth(0.8, 1, q));
    });

    document.body.classList.toggle("outro-on", p > 0.9);
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    const d = target - prog;
    if (Math.abs(d) > 0.00005 || dirty) {
      prog += d * (1 - Math.exp(-dt * 6));       // плавное догоняние прокрутки
      if (Math.abs(target - prog) < 0.00005) prog = target;
      update(prog);
      renderer.clear();
      renderer.render(textScene, orthoCam);
      renderer.render(cardScene, cam);
      dirty = false;
    }
    requestAnimationFrame(frame);
  }

  document.body.classList.add("gl");
  layout();
  readScroll();
  prog = target;
  window.addEventListener("scroll", readScroll, { passive: true });
  let rz;
  window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { layout(); readScroll(); }, 120); });
  requestAnimationFrame(frame);
}
