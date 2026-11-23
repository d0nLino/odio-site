// Воронка на прокрутке.
// Синий эллипс внизу макета — это горло воронки. На прокрутке он раскрывается в глубокую
// 3D-яму: стенки темнеют с глубиной, по ним сходятся линии сетки.
// 1) Заголовок с плашками закручивается и проваливается в горло.
// 2) Сверху по спирали спускаются карточки работ, заходят за край воронки и уходят вниз.
// Без WebGL или при «уменьшить движение» остаётся статичная обложка из HTML.

import * as THREE from "three";

const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const canvas = document.getElementById("gl");
const mouthEl = document.getElementById("mouth");

const FONT = '"OT Neue Montreal", "Arial Narrow", sans-serif';
const C = { parme: "#d6cfff", orange: "#ff4000", bleu: "#3aa0ff", black: "#000", white: "#fff" };

// Карточки-заглушки 4:3. Потом заменим на картинки кейсов (1200×900 WebP) из R2.
const WORKS = [
  { name: "Avorio", sub: "Italian furniture, Dubai", bg: C.black, fg: C.white },
  { name: "Segrex", sub: "Brokers Club", bg: C.bleu, fg: C.white },
  { name: "Altamare", sub: "Superyacht refit, Dubai", bg: C.parme, fg: C.black },
  { name: "Restolab", sub: "Turnkey restaurants", bg: C.orange, fg: C.white },
  { name: "Sulina", sub: "Interior design", bg: "#f2f2f2", fg: C.black },
  { name: "Segrex", sub: "Development, Dubai", bg: "#0b1f3a", fg: C.white },
];

// Настройки движения — их и подкручиваем.
const CFG = {
  tilt: 26,            // угол взгляда на воронку, градусы (эллипс 770×340 из макета ≈ 26°)
  fov: 30,
  depth: 2.6,          // глубина воронки в радиусах горла
  openEnd: 0.14,       // к этой доле прокрутки воронка раскрыта полностью
  textEnd: 0.34,       // к этой доле текст полностью провалился
  cardStart: 0.08,     // когда появляется первая карточка
  cardDur: 0.26,       // сколько прокрутки занимает путь одной карточки
  rimShare: 0.6,       // доля пути над воронкой, остальное — внутри
  turns: 1.4,          // оборотов спирали за путь
  cardPx: 230,         // ширина карточки на экране у края воронки, px (компьютер)
};

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

  let W = 0, H = 0, DPR = 1, mobile = false;

  // ================= Текст (2D-слой с шейдером) =================
  const textCanvas = document.createElement("canvas");
  const textTex = new THREE.CanvasTexture(textCanvas);
  textTex.premultiplyAlpha = true;
  textTex.minFilter = THREE.LinearFilter;
  textTex.generateMipmaps = false;

  const textMat = new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false, premultipliedAlpha: true,
    uniforms: {
      uTex: { value: textTex },
      uRes: { value: new THREE.Vector2(1, 1) },
      uC: { value: new THREE.Vector2(0.5, 0.85) },
      uMouth: { value: new THREE.Vector2(100, 44) },
      uT: { value: 0 },
      uOpen: { value: 0 },
      uBlur: { value: new THREE.Vector4(0, 1, 2, 0) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform sampler2D uTex;
      uniform vec2 uRes;    // экран, CSS-пиксели
      uniform vec2 uC;      // центр горла, пиксели от верхнего левого угла
      uniform vec2 uMouth;  // полуоси эллипса горла, пиксели
      uniform float uT;     // 0 — текст на месте, 1 — провалился
      uniform float uOpen;  // насколько раскрыта воронка
      uniform vec4 uBlur;   // размытие низа последней строки: начало, полное, конец, радиус
      varying vec2 vUv;

      // Приливное растяжение, как у чёрной дыры: ближняя к горлу часть притягивается
      // сильнее дальней. Прямое отображение r -> s * r^k: вдоль радиуса объект
      // растягивается в k раз сильнее, чем поперёк, и стягивается в нить к центру.
      // Внутренние части вращаются быстрее внешних — нить закручивается в спираль.
      vec2 toSrc(vec2 p) {
        vec2 d = p - uC;
        float sq = uMouth.y / uMouth.x;
        d.y /= sq;
        float R = length(uRes) * 0.6;
        float rd = length(d) / R;
        float t = uT;
        float k = 1.0 + 5.0 * t * t;                       // во сколько раз радиальное растяжение сильнее
        float s = max(1.0 - 0.92 * pow(t, 1.3), 0.002);    // общее притяжение к центру
        float rs = pow(max(rd / s, 1e-6), 1.0 / k);        // обратное отображение: где это было в тексте
        float th = t * t * 1.6 / (0.12 + rs);              // дифференциальное вращение
        vec2 dir = d / max(length(d), 1e-5);
        float c = cos(th), sn = sin(th);
        dir = mat2(c, -sn, sn, c) * dir;
        vec2 o = dir * rs * R;
        o.y *= sq;
        return uC + o;
      }
      vec4 tap(vec2 s) {
        vec2 uv = s / uRes;
        if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec4(0.0);
        return texture2D(uTex, vec2(uv.x, 1.0 - uv.y));
      }
      void main() {
        vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uRes;
        vec2 rel = p - uC;
        vec2 radial = normalize(rel + 1e-4);
        float smear = uT * uT * 70.0;                       // смаз вдоль линии падения
        vec2 base = toSrc(p);
        float b = uBlur.w * smoothstep(uBlur.x, uBlur.y, base.y) * (1.0 - step(uBlur.z, base.y)) + uT * 8.0;
        vec4 acc = vec4(0.0);
        for (int i = 0; i < 16; i++) {
          float fi = float(i);
          float a = fi * 2.39996;
          vec2 disk = vec2(cos(a), sin(a)) * sqrt((fi + 0.5) / 16.0);
          vec2 pi = p + radial * (fi / 15.0 - 0.5) * smear;
          acc += tap(toSrc(pi) + disk * b);
        }
        acc /= 16.0;
        // внутри горла текст проваливается: гаснет и синеет, когда воронка раскрыта
        float e = length(rel / uMouth);
        float inside = (1.0 - smoothstep(0.75, 1.02, e)) * uOpen * smoothstep(0.02, 0.4, uT);
        acc.rgb = mix(acc.rgb, vec3(0.02, 0.09, 0.23) * acc.a, inside * 0.6);
        acc *= 1.0 - inside * (0.35 + 0.65 * smoothstep(1.0, 0.2, e));
        acc *= 1.0 - smoothstep(0.85, 1.0, uT);
        gl_FragColor = acc;
      }
    `,
  });
  const textScene = new THREE.Scene();
  textScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), textMat));
  const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  function drawText() {
    textCanvas.width = Math.round(W * DPR); textCanvas.height = Math.round(H * DPR);
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
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = C.black;
    const m = ctx.measureText("HÍ");
    const asc = m.fontBoundingBoxAscent || fs * 0.8, desc = m.fontBoundingBoxDescent || fs * 0.2;
    lines.forEach((t, i) => ctx.fillText(t, W / 2, top + i * lh + (lh - (asc + desc)) / 2 + asc));

    const labels = [
      { t: "BRANDING & COMMUNICATION", bg: C.parme, fg: C.black, x: 231, y: 132 },
      { t: "DIGITAL PRODUCTS", bg: C.orange, fg: C.white, x: 140, y: 172 },
      { t: "WEB DESIGN", bg: C.bleu, fg: C.white, x: 241, y: 212 },
    ];
    const lfs = mobile ? 11 : 20 * u, lhgt = mobile ? 24 : 32 * u, pad = mobile ? 8 : 12 * u;
    ctx.font = `500 ${lfs}px ${FONT}`;
    if ("letterSpacing" in ctx) ctx.letterSpacing = `${lfs * 0.1}px`;
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    labels.forEach((l, i) => {
      const w = ctx.measureText(l.t).width + pad * 2;
      const x = mobile ? W / 2 - w / 2 : W / 2 + l.x * u;
      const y = mobile ? top + blockH + 18 + i * (lhgt + 6) : top + l.y * u;
      ctx.fillStyle = l.bg; ctx.fillRect(x, y, w, lhgt);
      ctx.fillStyle = l.fg; ctx.fillText(l.t, x + pad, y + lhgt / 2 + lfs * 0.04);
    });
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
    textTex.needsUpdate = true;

    const lastTop = top + 3 * lh;
    textMat.uniforms.uBlur.value.set(lastTop + lh * 0.45, lastTop + lh * 0.95, lastTop + lh * 1.15, mobile ? 6 : 20 * u);
  }

  // ================= 3D: воронка и карточки =================
  const cam = new THREE.PerspectiveCamera(CFG.fov, 1, 0.1, 200);
  const tilt = THREE.MathUtils.degToRad(CFG.tilt);
  const CAM_D = 20;
  cam.position.set(0, CAM_D * Math.sin(tilt), CAM_D * Math.cos(tilt));
  cam.lookAt(0, 0, 0);

  const funnelScene = new THREE.Scene();
  const cardScene = new THREE.Scene();
  const DEEP = new THREE.Color("#04122e");

  // Невидимый «пол» страницы с дыркой: всё ниже края воронки видно только через горло.
  const floor = new THREE.Mesh(
    new THREE.RingGeometry(1, 400, 96, 1),
    new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.renderOrder = -1;
  funnelScene.add(floor);   // пишет глубину первым: прячет и наружную сторону стенок, и карточки ниже края

  // Стенки воронки: поверхность вращения в форме рупора, единичный радиус и глубина.
  const PROFILE = (v) => 1 / (1 + 6 * v);       // радиус на глубине v (0 — край, 1 — дно)
  const pts = [];
  for (let i = 0; i <= 48; i++) { const v = i / 48; pts.push(new THREE.Vector2(PROFILE(v), -v)); }
  const funnelMat = new THREE.ShaderMaterial({
    transparent: true, side: THREE.DoubleSide, depthWrite: true,
    uniforms: { uOpen: { value: 0 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpen;
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        float v = vUv.y;                                  // 0 — край, 1 — дно
        vec3 bleu = vec3(0.227, 0.627, 1.0);
        vec3 deep = vec3(0.016, 0.07, 0.18);
        float k = pow(v, 0.22) * uOpen;                      // темнеет быстрее — дно уходит в черноту
        vec3 col = mix(bleu, deep, k);
        // сетка: меридианы и кольца, кольца бегут вниз
        float fu = fract(vUv.x * 36.0);
        float mer = 1.0 - smoothstep(0.0, 0.05 + v * 0.2, min(fu, 1.0 - fu));
        float fr = fract(log(1.0 + 6.0 * v) * 3.2 - uTime);
        float ring = 1.0 - smoothstep(0.0, 0.06, min(fr, 1.0 - fr));
        float grid = max(mer, ring) * uOpen * (1.0 - v) * 0.22;
        col += grid;
        float a = smoothstep(0.0, 0.035, v) * 0.97 + 0.03;   // мягкий край — его рисует CSS-свечение
        gl_FragColor = vec4(col * a, a);
      }
    `,
    premultipliedAlpha: true,
  });
  const funnel = new THREE.Mesh(new THREE.LatheGeometry(pts, 96), funnelMat);
  funnelScene.add(funnel);
  const cap = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: DEEP }));
  cap.rotation.x = -Math.PI / 2;
  funnelScene.add(cap);

  // Карточки
  function cardTexture(w) {
    const c = document.createElement("canvas");
    c.width = 800; c.height = 600;
    const x = c.getContext("2d");
    x.fillStyle = w.bg; x.fillRect(0, 0, 800, 600);
    const g = x.createRadialGradient(600, 470, 10, 600, 470, 520);
    g.addColorStop(0, "rgba(58,160,255,0.55)"); g.addColorStop(1, "rgba(58,160,255,0)");
    x.fillStyle = g; x.fillRect(0, 0, 800, 600);
    x.fillStyle = w.fg;
    x.font = `500 150px ${FONT}`; x.textBaseline = "top";
    x.fillText(w.name.toUpperCase(), 44, 40);
    x.font = `500 32px ${FONT}`;
    if ("letterSpacing" in x) x.letterSpacing = "3.2px";
    x.fillText(w.sub.toUpperCase(), 46, 540);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }
  const textures = WORKS.map(cardTexture);
  const cardGeo = new THREE.PlaneGeometry(1, 0.75, 32, 24);  // 4:3, плотная сетка — чтобы карточка гнулась при растяжении
  const cards = [];
  function makeCards(n) {
    cards.forEach((c) => { cardScene.remove(c.mesh); c.mesh.material.dispose(); });
    cards.length = 0;
    for (let i = 0; i < n; i++) {
      const mat = new THREE.ShaderMaterial({
        transparent: true, side: THREE.DoubleSide, depthWrite: true,
        uniforms: {
          uTex: { value: textures[i % textures.length] },
          uBend: { value: 0 }, uOp: { value: 0 }, uFog: { value: 0 },
          uStretch: { value: 0 }, uSize: { value: 1 }, uTarget: { value: new THREE.Vector3() },
          uDeep: { value: new THREE.Vector3(DEEP.r, DEEP.g, DEEP.b) },
        },
        vertexShader: /* glsl */ `
          uniform float uBend, uStretch, uSize;
          uniform vec3 uTarget;     // точка притяжения — дно воронки
          varying vec2 vUv;
          void main() {
            vUv = uv;
            vec3 p = position;
            p.z -= uBend * p.x * p.x;
            vec3 w = (modelMatrix * vec4(p, 1.0)).xyz;
            vec3 c = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
            vec3 a = normalize(uTarget - c);
            vec3 o = w - c;
            float par = dot(o, a);                 // вдоль направления падения
            vec3 perp = o - par * a;               // поперёк
            // приливное растяжение: ближний к дыре край уходит вперёд сильнее дальнего
            par = par * (1.0 + uStretch) + uStretch * 0.9 * par * abs(par) / uSize;
            perp /= 1.0 + 0.6 * uStretch;          // карточка сужается, превращаясь в ленту
            vec3 nw = c + a * (par + uStretch * uSize * 0.25) + perp;
            gl_Position = projectionMatrix * viewMatrix * vec4(nw, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform sampler2D uTex;
          uniform float uOp, uFog;
          uniform vec3 uDeep;
          varying vec2 vUv;
          void main() {
            vec4 c = texture2D(uTex, gl_FrontFacing ? vUv : vec2(1.0 - vUv.x, vUv.y));
            if (!gl_FrontFacing) c.rgb *= 0.55;
            gl_FragColor = vec4(c.rgb, c.a * uOp);
            #include <colorspace_fragment>
            gl_FragColor.rgb = mix(gl_FragColor.rgb, uDeep, uFog);   // в глубине тонет в темноте
          }
        `,
      });
      const mesh = new THREE.Mesh(cardGeo, mat);
      mesh.visible = false;
      cardScene.add(mesh);
      cards.push({ mesh, a0: (i * 2.39996) % (Math.PI * 2) });
    }
  }

  // ================= Раскладка =================
  const mouth = new THREE.Vector2();
  let Rrim = 1, k = 0.01, yTop = 10, Rtop = 5, cardW = 3;

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
    textMat.uniforms.uMouth.value.set(r.width / 2, r.height / 2);

    // центр горла (начало координат) проецируется ровно в центр синего эллипса
    cam.aspect = W / H;
    cam.setViewOffset(W, H, W / 2 - mouth.x, H / 2 - mouth.y, W, H);
    cam.updateProjectionMatrix();
    k = (2 * CAM_D * Math.tan(THREE.MathUtils.degToRad(CFG.fov / 2))) / H;   // мир на пиксель у горла
    Rrim = (r.width / 2) * k;
    floor.scale.setScalar(Rrim);
    funnel.scale.set(Rrim, Rrim * CFG.depth, Rrim);
    cap.scale.setScalar(Rrim * PROFILE(1));
    yTop = (mouth.y * k) / Math.cos(tilt) + 2;
    Rtop = (mobile ? 0.45 : 0.3) * W * k;
    cardW = (mobile ? 170 : CFG.cardPx) * k;

    const n = mobile ? 16 : 24;
    if (cards.length !== n) makeCards(n);
    drawText();
    dirty = true;
  }

  // ================= Прокрутка =================
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  let target = 0, prog = 0, dirty = true;
  function readScroll() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    target = max > 0 ? window.scrollY / max : 0;
  }

  function update(p) {
    const open = smooth(0, CFG.openEnd, p);
    const D = Rrim * CFG.depth * Math.max(open, 0.002);
    funnel.scale.y = D;
    cap.position.y = -D;
    cap.visible = open > 0.01;
    funnelMat.uniforms.uOpen.value = open;
    funnelMat.uniforms.uTime.value = p * 6;
    textMat.uniforms.uOpen.value = open;
    textMat.uniforms.uT.value = smooth(0, CFG.textEnd, p);

    const n = cards.length;
    const gap = (1 - 0.06 - CFG.cardDur - CFG.cardStart) / (n - 1);
    cards.forEach((c, i) => {
      const q = (p - (CFG.cardStart + i * gap)) / CFG.cardDur;
      const mesh = c.mesh;
      if (q <= 0 || q >= 1) { mesh.visible = false; return; }
      mesh.visible = true;
      let x, y, R, fog = 0, sc = 1, st = 0;
      if (q < CFG.rimShare) {                     // над воронкой: широкая спираль вниз к краю
        const s = q / CFG.rimShare;
        y = yTop * Math.pow(1 - s, 1.25);
        R = Rtop + (Rrim * 0.72 - Rtop) * Math.pow(s, 0.85);
        st = 2.2 * Math.pow(s, 2.2);             // на подлёте к краю начинает тянуть
      } else {                                    // внутри: по стенке рупора в глубину
        const s = (q - CFG.rimShare) / (1 - CFG.rimShare);
        const v = Math.pow(s, 1.15) * 0.96;
        y = -D * v;
        R = Rrim * 0.72 * PROFILE(v);
        fog = Math.min(1, Math.pow(v, 0.7) * 1.1) * open;
        sc = 1 - 0.5 * v;
        st = 2.2 + 9.0 * Math.pow(s, 1.1);       // внутри — вытягивается в нить
      }
      const ang = c.a0 + Math.PI * 2 * CFG.turns * (0.75 * q + 0.25 * q * q * q);
      mesh.position.set(R * Math.sin(ang), y, R * Math.cos(ang));
      mesh.rotation.set(0, ang, 0);
      const s = cardW * sc;
      mesh.scale.set(s, s, s);
      const u = mesh.material.uniforms;
      u.uBend.value = Math.min(1.5, s / (2 * Math.max(R, 0.05)));
      u.uOp.value = smooth(0, 0.05, q) * (1 - smooth(0.9, 1, q));
      u.uFog.value = fog;
      u.uStretch.value = st * open;
      u.uSize.value = s;
      u.uTarget.value.set(0, -D * 1.05, 0);
    });

    document.body.classList.toggle("outro-on", p > 0.9);
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    const d = target - prog;
    if (Math.abs(d) > 0.00005 || dirty) {
      prog += d * (1 - Math.exp(-dt * 6));
      if (Math.abs(target - prog) < 0.00005) prog = target;
      update(prog);
      renderer.clear();
      renderer.render(funnelScene, cam);         // яма
      renderer.render(textScene, orthoCam);      // текст поверх, проваливается в горло
      renderer.render(cardScene, cam);           // карточки; пол с дыркой прячет то, что ниже края
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
