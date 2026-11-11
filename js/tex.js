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
  OV.toTex = toTex; OV.canvasOf = canvasOf;
  // tangent-space normal map from a height canvas (Sobel, wraps so tiles stay seamless)
  function normalFrom(src, strength) {
    const w = src.width, h = src.height, sd = src.getContext('2d').getImageData(0, 0, w, h).data;
    const c = canvasOf(w, h), x = c.getContext('2d'), im = x.createImageData(w, h), d = im.data;
    const H = (i, j) => sd[((((j % h) + h) % h) * w + (((i % w) + w) % w)) * 4];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const nx = -((H(i + 1, j) - H(i - 1, j)) / 255) * strength, ny = ((H(i, j + 1) - H(i, j - 1)) / 255) * strength, l = Math.hypot(nx, ny, 1), o = (j * w + i) * 4;
      d[o] = (nx / l * 0.5 + 0.5) * 255; d[o + 1] = (ny / l * 0.5 + 0.5) * 255; d[o + 2] = (1 / l * 0.5 + 0.5) * 255; d[o + 3] = 255;
    }
    x.putImageData(im, 0, 0); return c;
  }
  // grey roughness map from fn(u, v, x, y) -> 0..1 (three reads the green channel)
  function roughMap(S, fn) {
    const c = canvasOf(S, S), x = c.getContext('2d'), im = x.createImageData(S, S), d = im.data;
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const o = (j * S + i) * 4, v = clamp01(fn(i / S, j / S, i, j)) * 255; d[o] = d[o + 1] = d[o + 2] = v; d[o + 3] = 255; }
    x.putImageData(im, 0, 0); return c;
  }
  // o.n: normal strength, o.rough: fn for a roughness map (painted at half size, it is smooth)
  const pair = (r, out, name, o) => {
    out[name] = toTex(r.col, true); out[name + 'Normal'] = toTex(normalFrom(r.bmp, o.n), false);
    if (o.rough) out[name + 'Rough'] = toTex(roughMap(Math.max(256, r.col.width >> 1), o.rough), false);
  };
  function leafTex() { // pale base with a bright midrib and slanted side veins; tinted by the material colour
    const c = canvasOf(64, 128), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#cfcfcf'); x.fillStyle = g; x.fillRect(0, 0, 64, 128);
    x.strokeStyle = 'rgba(120,120,120,0.55)'; x.lineWidth = 1.4;
    for (let k = 0; k < 11; k++) { const y = 12 + k * 10; x.beginPath(); x.moveTo(32, y + 8); x.lineTo(4, y - 6); x.moveTo(32, y + 8); x.lineTo(60, y - 6); x.stroke(); }
    x.strokeStyle = '#ffffff'; x.lineWidth = 3; x.beginPath(); x.moveTo(32, 2); x.lineTo(32, 126); x.stroke();
    return toTex(c, true, false);
  }

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
      const base = [0.27, 0.31, 0.38];
      p[0] = base[0] * f * groove; p[1] = base[1] * f * groove; p[2] = base[2] * f * groove;
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

  function ceilingTile(S) { // painted plasterboard: very fine orange-peel, board joints every 2.4 m (one per tile)
    return pixels(S, S, (u, v, p, x, y) => {
      let b = 0.94 + (fbm(u, v, 4, 4, 3, 4) - 0.5) * 0.035 + (hash(x, y, 5) - 0.5) * 0.012, bump = 0.5 + fbm(u, v, 48, 48, 2, 9) * 0.4;
      const e = Math.min(u, 1 - u, v, 1 - v);
      if (e < 0.0015) { b *= 0.9; bump = 0.3; }
      p[0] = b; p[1] = b; p[2] = b * 0.99; return bump;
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

  function clouds() { // soft cloud layer, wraps around; transparent below the horizon
    const W = 1024, Hh = 256, c = canvasOf(W, Hh), x = c.getContext('2d'), im = x.createImageData(W, Hh), d = im.data;
    for (let j = 0; j < Hh; j++) {
      const v = 1 - j / Hh;
      for (let i = 0; i < W; i++) {
        const u = i / W, n = fbm(u, v, 6, 3, 5, 91) * 0.75 + fbm(u, v, 12, 6, 3, 17) * 0.35;
        let a = sstep(0.5, 0.8, n) * sstep(0.42, 0.56, v) * (1 - 0.6 * sstep(0.82, 1, v));
        const o = (j * W + i) * 4; d[o] = 246; d[o + 1] = 247; d[o + 2] = 251; d[o + 3] = a * 235;
      }
    }
    x.putImageData(im, 0, 0);
    return toTex(c, true);
  }
  OV.makeClouds = clouds;

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
    await OV.brand.ready(); // the logo image
    const S = Q.tex, out = {}, wait = step || (async () => {});
    await wait('Floors', 0.05);
    // polished concrete: glossy overall, rougher where worn, with the odd scratch
    pair(concrete(S), out, 'concrete', { n: 2.2, rough: (u, v, x, y) => 0.16 + 0.55 * Math.pow(fbm(u, v, 3, 3, 4, 41), 1.6) + (hash(x, y, 3) > 0.996 ? 0.25 : 0) });
    pair(carpet(S), out, 'carpet', { n: 7 }); await wait('Wood', 0.2);
    pair(wood(S, { planks: 6, light: [0.76, 0.6, 0.42], dark: [0.55, 0.4, 0.26], seed: 3, seams: true, fine: 56 }), out, 'oak', { n: 2.6, rough: (u, v) => 0.3 + 0.3 * fbm(u, v, 2, 40, 3, 5) });
    pair(wood(S >> 1, { planks: 1, light: [0.8, 0.64, 0.45], dark: [0.62, 0.46, 0.3], seed: 8, seams: false, fine: 40 }), out, 'oakF', { n: 2.4, rough: (u, v) => 0.26 + 0.28 * fbm(u, v, 2, 36, 3, 8) });
    pair(wood(S >> 1, { planks: 1, light: [0.4, 0.26, 0.17], dark: [0.2, 0.12, 0.08], seed: 13, seams: false, fine: 48 }), out, 'walnut', { n: 2.4, rough: (u, v) => 0.22 + 0.26 * fbm(u, v, 2, 44, 3, 13) });
    await wait('Surfaces', 0.45);
    pair(ceilingTile(S >> 1), out, 'ceil', { n: 1.2 });
    pair(weave(256), out, 'weave', { n: 6 });
    const pb = plasterBump(S >> 1); out.plasterNormal = toTex(normalFrom(pb.bmp, 3), false);
    out.leaf = leafTex();
    await wait('Screens & art', 0.65);
    const BR = OV.brand;
    out.screen0 = BR.screen(0); out.screen1 = BR.screen(1); out.screen2 = BR.screen(2);
    out.tv = BR.slide(); out.art0 = BR.art(0); out.art1 = BR.art(1); out.art2 = BR.art(2); out.logo = BR.logoTex(true); out.logoRed = BR.logoTex(false);
    out.sky = sky(); out.skyline = skyline(); out.clouds = clouds(); out.blob = blob(); out.aoStrip = aoStrip();
    await wait('Lighting', 0.8);
    return out;
  };

  /* Bake: ?bake=1 on the local dev server (tools/serve.py) writes every generated
     texture to assets/tex/ once. Normal loads then fetch those files instead of
     spending seconds of CPU painting them (a big win on a phone). */
  const ALPHA = new Set(['logo', 'logoRed', 'blob', 'aoStrip', 'skyline', 'clouds']);
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
    await OV.brand.ready();
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
        if (!out.clouds) out.clouds = clouds(); // added after the first bake: paint it at load until re-baked
        if (!out.logoRed) out.logoRed = OV.brand.logoTex(false);
        return out;
      } catch (e) { console.warn('baked textures unavailable, generating:', e.message); }
    }
    return OV.makeTextures(Q, step);
  };
})();
