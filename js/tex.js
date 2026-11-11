/* Procedural PBR textures. Everything is painted on canvases at load time so the
   sample needs no image files. For a real scanned office these get replaced by
   baked KTX2 textures; this file is the stand-in. */
(function () {
  const T = AFRAME.THREE;
  const OV = (window.OV = window.OV || {});

  const mix = (a, b, t) => a + (b - a) * t;
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

  OV.rng = function (seed) {
    let s = seed >>> 0;
    return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  };

  function hash(i, j, s) {
    let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967295;
  }
  // tileable value noise on [0,1)^2 with lattice fx*fy
  function vnoise(x, y, fx, fy, s) {
    const X = x * fx, Y = y * fy, i = Math.floor(X), j = Math.floor(Y);
    const u = X - i, v = Y - j, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
    const i1 = (i + 1) % fx, j1 = (j + 1) % fy;
    const a = hash(i, j, s), b = hash(i1, j, s), c = hash(i, j1, s), d = hash(i1, j1, s);
    return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv;
  }
  function fbm(x, y, fx, fy, oct, s) {
    let sum = 0, amp = 0.5, tot = 0;
    for (let k = 0; k < oct; k++) { sum += amp * vnoise(x, y, fx << k, fy << k, s + k * 17); tot += amp; amp *= 0.5; }
    return sum / tot;
  }

  const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  // fn(u,v,rgbOut,x,y) fills rgb (0..1) and returns bump (0..1)
  function pixels(w, h, fn) {
    const col = canvasOf(w, h), bmp = canvasOf(w, h);
    const cc = col.getContext('2d'), bc = bmp.getContext('2d');
    const ci = cc.createImageData(w, h), bi = bc.createImageData(w, h);
    const cd = ci.data, bd = bi.data, px = [0, 0, 0];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const b = fn(x / w, y / h, px, x, y), o = (y * w + x) * 4;
      cd[o] = px[0] * 255; cd[o + 1] = px[1] * 255; cd[o + 2] = px[2] * 255; cd[o + 3] = 255;
      const g = b * 255; bd[o] = g; bd[o + 1] = g; bd[o + 2] = g; bd[o + 3] = 255;
    }
    cc.putImageData(ci, 0, 0); bc.putImageData(bi, 0, 0);
    return { col, bmp };
  }

  function toTex(canvas, srgb, repeat) {
    const t = new T.CanvasTexture(canvas);
    if (repeat !== false) t.wrapS = t.wrapT = T.RepeatWrapping;
    t.colorSpace = srgb ? T.SRGBColorSpace : T.NoColorSpace;
    t.anisotropy = 8;
    return t;
  }
  const pair = (r, out, name) => { out[name] = toTex(r.col, true); out[name + 'Bump'] = toTex(r.bmp, false); };

  /* ---------- tileable surface textures ---------- */
  function concrete(S) { // polished terrazzo-ish concrete, one tile = 2 m
    return pixels(S, S, (u, v, p) => {
      const n = fbm(u, v, 4, 4, 4, 11), m = fbm(u, v, 32, 32, 2, 5);
      const b = 0.6 + (n - 0.5) * 0.16 + (m - 0.5) * 0.05;
      let r = b * 1.02, g = b, bl = b * 0.96, bump = n * 0.5 + m * 0.2;
      const cell = vnoise(u, v, 96, 96, 3);
      if (cell > 0.8) {
        const k = hash(Math.floor(u * 96), Math.floor(v * 96), 9);
        if (k < 0.4) { r *= 0.55; g *= 0.55; bl *= 0.58; }
        else if (k < 0.75) { r *= 1.25; g *= 1.2; bl *= 1.1; }
        else { r *= 0.9; g *= 0.78; bl *= 0.65; }
        bump += 0.25;
      }
      if (u < 0.003 || v < 0.003) { r *= 0.78; g *= 0.78; bl *= 0.78; bump *= 0.2; } // control joint
      p[0] = r; p[1] = g; p[2] = bl; return bump;
    });
  }

  function carpet(S) { // 4x4 carpet tiles per texture, tile = 0.5 m
    return pixels(S, S, (u, v, p, x, y) => {
      const ti = Math.floor(u * 4), tj = Math.floor(v * 4);
      const tint = 0.9 + 0.1 * hash(ti, tj, 3);
      const fib = vnoise(u, v, S >> 1, S >> 1, 7) * 0.6 + hash(x, y, 2) * 0.4;
      const low = fbm(u, v, 6, 6, 3, 21);
      const f = tint * (0.86 + 0.28 * fib) * (0.94 + 0.12 * low);
      const du = (u * 4) % 1, dv = (v * 4) % 1;
      const edge = Math.min(du, 1 - du, dv, 1 - dv);
      const groove = edge < 0.006 ? 0.5 : 1;
      p[0] = 0.27 * f * groove; p[1] = 0.31 * f * groove; p[2] = 0.38 * f * groove;
      return groove < 1 ? 0.1 : fib;
    });
  }

  // o: planks (rows per tile), light/dark rgb, seed, seams, fine (grain frequency)
  function wood(S, o) {
    return pixels(S, S, (u, v, p) => {
      const row = Math.floor(v * o.planks), fv = v * o.planks - row;
      const uu = (u + hash(row, 0, o.seed)) % 1;
      const t = fbm(uu, v, 3, o.fine, 4, o.seed + row * 7);
      const ring = sstep(0.3, 0.7, 0.5 + 0.5 * Math.sin(t * 38));
      const k = clamp01(0.5 * ring + 0.5 * fbm(uu, v, 2, 8, 3, o.seed));
      const tint = 0.93 + 0.14 * hash(row, 1, o.seed);
      let r = mix(o.dark[0], o.light[0], k) * tint, g = mix(o.dark[1], o.light[1], k) * tint, b = mix(o.dark[2], o.light[2], k) * tint;
      let bump = ring * 0.6 + 0.2;
      if (o.seams && (fv < 0.012 || fv > 0.988 || uu < 0.003 || uu > 0.997)) { r *= 0.5; g *= 0.5; b *= 0.5; bump = 0; }
      p[0] = r; p[1] = g; p[2] = b; return bump;
    });
  }

  function ceilingTile(S) { // 2x2 acoustic tiles per texture, tile = 0.6 m
    return pixels(S, S, (u, v, p, x, y) => {
      const du = (u * 2) % 1, dv = (v * 2) % 1;
      const edge = Math.min(du, 1 - du, dv, 1 - dv);
      let b = 0.93 + (fbm(u, v, 8, 8, 3, 4) - 0.5) * 0.06, bump = 0.7;
      if (hash(x, y, 5) > 0.986) { b *= 0.72; bump = 0.2; }
      if (edge < 0.008) { b *= 0.55; bump = 0; }
      p[0] = b; p[1] = b; p[2] = b * 0.985; return bump;
    });
  }

  function weave(S) { // fabric: tile = 0.12 m
    return pixels(S, S, (u, v, p) => {
      const w = 0.5 + 0.5 * Math.sin(u * 48 * Math.PI) * Math.sin(v * 48 * Math.PI);
      const n = fbm(u, v, 16, 16, 2, 8);
      const c = 0.82 + 0.12 * w + 0.06 * n;
      p[0] = c; p[1] = c; p[2] = c; return w * 0.7 + n * 0.3;
    });
  }

  function plasterBump(S) {
    return pixels(S, S, (u, v, p, x, y) => {
      const n = fbm(u, v, 8, 8, 5, 31) * 0.7 + hash(x, y, 1) * 0.15;
      p[0] = p[1] = p[2] = 1; return n;
    });
  }

  /* ---------- one-off canvases (screens, art, logo, sky, shadows) ---------- */
  function screen(kind, w, h) {
    const c = canvasOf(w, h), x = c.getContext('2d'), r = OV.rng(100 + kind);
    if (kind === 0) { // code editor
      x.fillStyle = '#1b1e2b'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#232738'; x.fillRect(0, 0, w, 20); x.fillStyle = '#161926'; x.fillRect(0, 20, 64, h);
      const cols = ['#7aa2f7', '#bb9af7', '#9ece6a', '#e0af68', '#c0caf5', '#f7768e'];
      for (let i = 0; i < 22; i++) {
        let xx = 82 + Math.floor(r() * 3) * 18;
        for (let j = 0, n = 1 + Math.floor(r() * 4); j < n; j++) {
          const len = 18 + r() * 80; x.fillStyle = cols[Math.floor(r() * cols.length)];
          x.fillRect(xx, 30 + i * 11.4, len, 5); xx += len + 8;
        }
      }
    } else if (kind === 1) { // analytics dashboard
      x.fillStyle = '#f2f4f8'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#1d5a60'; x.fillRect(0, 0, w, 26);
      for (let i = 0; i < 3; i++) { x.fillStyle = '#fff'; x.fillRect(14 + i * 162, 40, 150, 62); x.fillStyle = '#1d5a60'; x.fillRect(24 + i * 162, 52, 60 + r() * 50, 8); x.fillStyle = '#b4573b'; x.fillRect(24 + i * 162, 70, 40, 18); }
      x.fillStyle = '#fff'; x.fillRect(14, 116, 300, 160);
      for (let i = 0; i < 12; i++) { const bh = 20 + r() * 110; x.fillStyle = i % 3 ? '#4f9aa3' : '#1d5a60'; x.fillRect(26 + i * 23, 266 - bh, 15, bh); }
      x.fillStyle = '#fff'; x.fillRect(326, 116, 172, 160);
      x.strokeStyle = '#b4573b'; x.lineWidth = 3; x.beginPath();
      for (let i = 0; i <= 8; i++) { const px = 336 + i * 19, py = 240 - r() * 90; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke();
    } else { // design doc
      x.fillStyle = '#e9e6e0'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#fff'; x.fillRect(110, 12, 292, h - 24);
      x.fillStyle = '#d9c3a5'; x.fillRect(128, 28, 256, 100);
      x.fillStyle = '#b4573b'; x.beginPath(); x.arc(256, 78, 34, 0, 7); x.fill();
      x.fillStyle = '#222'; x.fillRect(128, 146, 150, 9);
      x.fillStyle = '#999'; for (let i = 0; i < 6; i++) x.fillRect(128, 168 + i * 14, 256 - r() * 90, 5);
    }
    return toTex(c, true, false);
  }

  function tvSlide() {
    const c = canvasOf(1024, 576), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 1024, 576); g.addColorStop(0, '#12383c'); g.addColorStop(1, '#1d5a60');
    x.fillStyle = g; x.fillRect(0, 0, 1024, 576);
    x.fillStyle = '#f3efe8'; x.font = '700 78px Helvetica, Arial, sans-serif'; x.fillText('Q4 Roadmap', 70, 170);
    x.font = '400 34px Helvetica, Arial, sans-serif'; x.fillStyle = '#b8d7da'; x.fillText('Lumen Studio · Weekly sync', 74, 226);
    const bars = [0.35, 0.55, 0.45, 0.8, 0.65, 0.95];
    bars.forEach((b, i) => { x.fillStyle = i % 2 ? '#b4573b' : '#e8c9a0'; x.fillRect(80 + i * 140, 520 - b * 230, 96, b * 230); });
    return toTex(c, true, false);
  }

  // extra TV slides, painted at runtime (cheap, they are mostly flat shapes)
  OV.makeSlides = function () {
    const mk = (draw) => {
      const c = canvasOf(1024, 576), x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, 1024, 576); g.addColorStop(0, '#12383c'); g.addColorStop(1, '#1d5a60');
      x.fillStyle = g; x.fillRect(0, 0, 1024, 576); draw(x); return toTex(c, true, false);
    };
    const pill = (x, px, py, w, text, fill) => {
      x.fillStyle = fill; x.beginPath(); x.roundRect(px, py, w, 64, 32); x.fill();
      x.fillStyle = '#12383c'; x.font = '600 30px Helvetica, Arial, sans-serif'; x.textBaseline = 'middle'; x.fillText(text, px + 28, py + 33);
    };
    const welcome = mk((x) => {
      x.fillStyle = '#f3efe8'; x.font = '700 84px Helvetica, Arial, sans-serif'; x.fillText('Welcome', 70, 170);
      x.fillStyle = '#b8d7da'; x.font = '400 36px Helvetica, Arial, sans-serif'; x.fillText('to Lumen Studio', 74, 232);
      pill(x, 74, 320, 300, 'Reception', '#e8c9a0'); pill(x, 74, 400, 420, 'Open workspace', '#e8c9a0'); pill(x, 74, 480, 380, 'Meeting room', '#e8c9a0');
    });
    const plan = mk((x) => {
      x.fillStyle = '#f3efe8'; x.font = '700 52px Helvetica, Arial, sans-serif'; x.fillText('Floor plan', 60, 90);
      const ox = 72, oy = 130, s = 44; // 1 m = 44 px
      [['Reception', 0, 6, '#2b7a82'], ['Open workspace', 6, 14, '#4f9aa3'], ['Meeting room', 14, 20, '#b4573b']].forEach(([n, a, b, col]) => {
        x.fillStyle = col; x.fillRect(ox + a * s + 2, oy + 2, (b - a) * s - 4, 10 * s - 4);
        x.fillStyle = '#f3efe8'; x.font = '600 28px Helvetica, Arial, sans-serif'; x.textBaseline = 'alphabetic'; x.fillText(n, ox + a * s + 16, oy + 44);
      });
      x.fillStyle = '#12383c'; x.fillRect(ox + 6 * s - 6, oy + 4.2 * s, 12, 1.6 * s); x.fillRect(ox + 14 * s - 6, oy + 4.4 * s, 12, 1.2 * s);
    });
    return [welcome, plan];
  };

  function art(kind) {
    const w = 512, h = 640, c = canvasOf(w, h), x = c.getContext('2d');
    if (kind === 0) {
      x.fillStyle = '#efe6d6'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#b4573b'; x.beginPath(); x.arc(256, 250, 150, 0, 7); x.fill();
      x.fillStyle = '#1d5a60'; x.fillRect(0, 400, w, 240);
      x.fillStyle = '#e8c9a0'; x.beginPath(); x.arc(256, 400, 150, Math.PI, 0); x.fill();
      x.fillStyle = '#efe6d6'; x.fillRect(0, 440, w, 6);
    } else if (kind === 1) {
      x.fillStyle = '#1d5a60'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 9; i++) { x.strokeStyle = ['#e8c9a0', '#b4573b', '#efe6d6'][i % 3]; x.lineWidth = 16; x.beginPath(); for (let k = 0; k <= 20; k++) { const px = k * 26, py = 70 + i * 62 + Math.sin(k * 0.6 + i) * 22; k ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke(); }
    } else {
      x.fillStyle = '#e9e2d3'; x.fillRect(0, 0, w, h);
      const pal = ['#1d5a60', '#b4573b', '#e8c9a0', '#2b2d31', '#4f9aa3'], r = OV.rng(9);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) { x.fillStyle = pal[Math.floor(r() * pal.length)]; if (r() > 0.25) x.fillRect(20 + i * 118, 20 + j * 120, 108, 110); }
    }
    return toTex(c, true, false);
  }

  function logo() {
    const c = canvasOf(1024, 256), x = c.getContext('2d');
    x.textBaseline = 'middle'; x.fillStyle = '#f6f1e7';
    x.font = '800 150px Helvetica, Arial, sans-serif';
    if (x.letterSpacing !== undefined) x.letterSpacing = '26px';
    x.fillText('LUMEN', 40, 120);
    x.fillStyle = '#e8c9a0'; x.font = '400 46px Helvetica, Arial, sans-serif';
    if (x.letterSpacing !== undefined) x.letterSpacing = '20px';
    x.fillText('STUDIO', 46, 222);
    return toTex(c, true, false);
  }

  function sky() {
    const c = canvasOf(16, 512), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#5f97d6'); g.addColorStop(0.38, '#a9cdee'); g.addColorStop(0.5, '#f4ead9'); g.addColorStop(0.52, '#a8a49c'); g.addColorStop(1, '#6f7378');
    x.fillStyle = g; x.fillRect(0, 0, 16, 512);
    return toTex(c, true, false);
  }

  function skyline() { // three layers of building silhouettes, wraps seamlessly around a cylinder
    const W = 4096, Hh = 256, c = canvasOf(W, Hh), x = c.getContext('2d'), r = OV.rng(77);
    const layers = [['#8a9bb0', 0.55, 40, 120], ['#6f8198', 0.75, 30, 150], ['#566a82', 1, 24, 190]];
    layers.forEach(([col, a, minH, maxH], li) => {
      x.fillStyle = col; x.globalAlpha = a;
      for (let px = -40; px < W; ) {
        const bw = 36 + r() * 120, bh = minH + r() * (maxH - minH) * (0.4 + 0.6 * r());
        for (const off of [0, -W]) {
          x.fillRect(px + off, Hh - bh, bw, bh);
          if (r() > 0.7) x.fillRect(px + off + bw * 0.3, Hh - bh - 18 - r() * 22, bw * 0.4, 30); // roof block / mast
        }
        px += bw + (li === 0 ? 4 : r() * 14);
      }
    });
    x.globalAlpha = 1;
    return toTex(c, true, false);
  }

  function blob() { // soft contact shadow: alpha only
    const S = 128, c = canvasOf(S, S), x = c.getContext('2d'), im = x.createImageData(S, S);
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const dx = Math.max(Math.abs(i / S - 0.5) - 0.2, 0), dy = Math.max(Math.abs(j / S - 0.5) - 0.2, 0);
      const d = Math.sqrt(dx * dx + dy * dy), a = Math.pow(1 - sstep(0, 0.3, d), 1.7) * 0.62;
      const o = (j * S + i) * 4; im.data[o + 3] = a * 255;
    }
    x.putImageData(im, 0, 0);
    return toTex(c, true, false);
  }

  function aoStrip() { // dark at v=0, fades to 0 at v=1
    const c = canvasOf(4, 128), x = c.getContext('2d'), im = x.createImageData(4, 128);
    for (let j = 0; j < 128; j++) for (let i = 0; i < 4; i++) im.data[(j * 4 + i) * 4 + 3] = Math.pow(1 - j / 127, 2.2) * 0.5 * 255;
    x.putImageData(im, 0, 0);
    const t = toTex(c, true, false); t.wrapS = T.RepeatWrapping; return t;
  }

  OV.makeTextures = async function (Q, step) {
    const S = Q.tex, out = {}, wait = step || (async () => {});
    await wait('Floors', 0.05);
    pair(concrete(S), out, 'concrete');
    pair(carpet(S), out, 'carpet'); await wait('Wood', 0.2);
    pair(wood(S, { planks: 6, light: [0.76, 0.6, 0.42], dark: [0.55, 0.4, 0.26], seed: 3, seams: true, fine: 56 }), out, 'oak');
    pair(wood(S >> 1, { planks: 1, light: [0.8, 0.64, 0.45], dark: [0.62, 0.46, 0.3], seed: 8, seams: false, fine: 40 }), out, 'oakF');
    pair(wood(S >> 1, { planks: 1, light: [0.4, 0.26, 0.17], dark: [0.2, 0.12, 0.08], seed: 13, seams: false, fine: 48 }), out, 'walnut');
    await wait('Surfaces', 0.45);
    pair(ceilingTile(S >> 1), out, 'ceil');
    pair(weave(256), out, 'weave');
    const pb = plasterBump(S >> 1); out.plasterBump = toTex(pb.bmp, false);
    await wait('Screens & art', 0.65);
    out.screen0 = screen(0, 512, 288); out.screen1 = screen(1, 512, 288); out.screen2 = screen(2, 512, 288);
    out.tv = tvSlide(); out.art0 = art(0); out.art1 = art(1); out.art2 = art(2); out.logo = logo();
    out.sky = sky(); out.skyline = skyline(); out.blob = blob(); out.aoStrip = aoStrip();
    await wait('Lighting', 0.8);
    return out;
  };

  /* Bake: ?bake=1 on the local dev server (tools/serve.py) writes every generated
     texture to assets/tex/ once. Normal loads then fetch those files instead of
     spending seconds of CPU painting them (a big win on a phone). */
  const ALPHA = new Set(['logo', 'blob', 'aoStrip', 'skyline']);
  OV.bakeTextures = async function (tex) {
    const manifest = {};
    for (const [name, t] of Object.entries(tex)) {
      const png = ALPHA.has(name), file = name + (png ? '.png' : '.jpg');
      const blob = await new Promise((res) => t.image.toBlob(res, png ? 'image/png' : 'image/jpeg', 0.9));
      await fetch('/save?name=' + file, { method: 'POST', body: blob });
      manifest[name] = { file, srgb: t.colorSpace === T.SRGBColorSpace, repeat: t.wrapS === T.RepeatWrapping };
    }
    await fetch('/save?name=manifest.json', { method: 'POST', body: JSON.stringify(manifest) });
    return manifest;
  };

  OV.loadTextures = async function (Q, step) {
    const wait = step || (async () => {});
    if (!Q.gen) {
      try {
        const res = await fetch('assets/tex/manifest.json');
        if (!res.ok) throw new Error('no manifest');
        const man = await res.json(), names = Object.keys(man), out = {}, loader = new T.TextureLoader();
        let n = 0;
        await Promise.all(names.map(async (name) => {
          const m = man[name], t = await loader.loadAsync('assets/tex/' + m.file);
          t.colorSpace = m.srgb ? T.SRGBColorSpace : T.NoColorSpace;
          if (m.repeat) t.wrapS = t.wrapT = T.RepeatWrapping;
          t.anisotropy = 8; out[name] = t; wait('Loading textures', 0.05 + 0.75 * (++n / names.length));
        }));
        return out;
      } catch (e) { console.warn('baked textures unavailable, generating:', e.message); }
    }
    return OV.makeTextures(Q, step);
  };
})();
