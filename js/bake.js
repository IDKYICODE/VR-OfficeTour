/* Baked lighting.
   Offline (dev only, ?lightbake=1): a small CPU ray tracer computes, for every vertex of the static
   meshes, the indirect light that reaches it: sky through the windows, the ceiling / pendant lamps,
   and one or two diffuse bounces (colour bleed, soft occlusion, light falloff away from windows).
   Two channels are stored so the light switch still works: bakeDay (sky + bounced sun) and
   bakeLamp (artificial light). The direct sun stays live (sharp static shadow map).
   Runtime: the file is loaded, attached as vertex attributes, shade.js replaces the ambient term
   with it, and the hemisphere + point lights are removed (cheaper on a phone too). */
(function () {
  const T = AFRAME.THREE;
  const OV = (window.OV = window.OV || {});

  const NORECV = new Set(['glass', 'frost', 'blob', 'aoStrip', 'led', 'ledUp', 'ledSpot', 'logo', 'logoRed', 'tvScreen', 'screen0', 'screen1', 'screen2', 'ground']);
  const NOOCC = new Set([...NORECV, 'art0', 'art1', 'art2', 'board0', 'board1', 'drum', 'opal']);
  // linear-light average albedo per material, used for the bounce
  const ALB = {
    plaster: [0.85, 0.82, 0.76], teal: [0.012, 0.1, 0.117], terra: [0.4, 0.08, 0.043], trim: [0.96, 0.95, 0.93], frame: [0.01, 0.01, 0.012], red: [0.74, 0.02, 0.025],
    concrete: [0.33, 0.31, 0.28], carpet: [0.09, 0.11, 0.15], oak: [0.38, 0.22, 0.1], ceiling: [0.78, 0.78, 0.76], rug: [0.4, 0.27, 0.17],
    metal: [0.03, 0.03, 0.04], chrome: [0.55, 0.55, 0.55], black: [0.006, 0.006, 0.008], kb: [0.04, 0.04, 0.05], white: [0.85, 0.85, 0.82],
    stone: [0.8, 0.78, 0.74], walnut: [0.1, 0.05, 0.03], woodDesk: [0.45, 0.3, 0.17], cabinet: [0.78, 0.76, 0.72], cabinetG: [0.27, 0.36, 0.3],
    fabA: [0.04, 0.06, 0.09], fabE: [0.03, 0.035, 0.04], fabC: [0.69, 0.62, 0.52], fabD: [0.4, 0.08, 0.043], pot: [0.88, 0.86, 0.82],
    soil: [0.02, 0.012, 0.008], leafA: [0.03, 0.11, 0.035], leafB: [0.07, 0.21, 0.045], bin: [0.04, 0.045, 0.05], board0: [0.95, 0.95, 0.93],
    alu: [0.3, 0.3, 0.3], brass: [0.35, 0.27, 0.1], opal: [0.9, 0.88, 0.8], ledOff: [0, 0, 0],
    board1: [0.95, 0.95, 0.93], art0: [0.5, 0.4, 0.3], art1: [0.3, 0.3, 0.3], art2: [0.5, 0.45, 0.35],
  };
  // tuning (the stored values are raw irradiance; the gains below are applied at runtime so they can be changed without re-baking)
  OV.BAKE = { sunI: 3.4, skyL: 0.26, groundL: 0.2, lampL: 10, dayGain: 1, lampGain: 1 };
  const SUN_COL = [1, 0.94, 0.85], LAMP_COL = [1, 0.9, 0.76];

  OV.bakeMeshes = (root) => root.children.filter((m) => m.isMesh && m.name && !NORECV.has(m.name));
  const hashPos = (arr) => { let h = 0; for (let i = 0; i < arr.length; i += 3) h = (h + Math.round(arr[i] * 100) * 31 + Math.round(arr[i + 1] * 100) * 17 + Math.round(arr[i + 2] * 100) * 7) % 1000000007; return h; };

  /* ---------------- emitters (collected before meshes are merged) ---------------- */
  // Lamp positions (read before the pieces are merged). dir: -1 = faces down, +1 = faces up, 0 = all round.
  // Long strips become several points so the light spreads along them.
  OV.collectEmitters = function (B) {
    const out = [], bb = new T.Box3(), s = new T.Vector3(), c = new T.Vector3(), L = OV.BAKE.lampL;
    const each = (key, fn) => (B.map[key] || []).forEach((g) => { g.computeBoundingBox(); bb.copy(g.boundingBox); bb.getSize(s); bb.getCenter(c); fn(); });
    const strip = (J, dir, dy) => {
      const alongX = s.x >= s.z, len = alongX ? s.x : s.z, n = Math.max(1, Math.ceil(len / 0.8));
      for (let i = 0; i < n; i++) { const t = -len / 2 + (i + 0.5) * (len / n); out.push({ x: c.x + (alongX ? t : 0), y: c.y + dy, z: c.z + (alongX ? 0 : t), J: J / n, dir }); }
    };
    each('led', () => { if (s.y > 0.06) return; const a = s.x * s.z; if (a >= 0.0008) strip(L * a, -1, -0.004); });
    each('ledSpot', () => out.push({ x: c.x, y: c.y - 0.004, z: c.z, J: L * s.x * s.z * 6, dir: -1 }));
    each('ledUp', () => strip(L * s.x * s.z * 1.4, 1, 0.004));
    each('drum', () => out.push({ x: c.x, y: c.y, z: c.z, J: L * Math.PI * s.x * s.y * 0.6, dir: 0 }));
    each('opal', () => out.push({ x: c.x, y: c.y, z: c.z, J: L * Math.PI * s.x * s.x * 0.9, dir: 0 }));
    return out;
  };

  /* ---------------- ray tracing scene ---------------- */
  function buildScene(meshes) {
    let nv = 0; const vOff = [];
    meshes.forEach((m) => { vOff.push(nv); nv += m.geometry.attributes.position.count; });
    const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), vMesh = new Uint16Array(nv);
    meshes.forEach((m, i) => {
      const a = m.geometry.attributes; P.set(a.position.array, vOff[i] * 3); N.set(a.normal.array, vOff[i] * 3); vMesh.fill(i, vOff[i], vOff[i] + a.position.count);
    });
    let nt = 0; meshes.forEach((m) => { if (!NOOCC.has(m.name)) nt += m.geometry.index.count / 3; });
    const TV = new Int32Array(nt * 3), TM = new Uint16Array(nt), TG = new Float32Array(nt * 9); // a, e1, e2
    let k = 0;
    meshes.forEach((m, i) => {
      if (NOOCC.has(m.name)) return;
      const idx = m.geometry.index.array, off = vOff[i];
      for (let j = 0; j < idx.length; j += 3, k++) {
        const a = off + idx[j], b = off + idx[j + 1], c = off + idx[j + 2];
        TV[k * 3] = a; TV[k * 3 + 1] = b; TV[k * 3 + 2] = c; TM[k] = i;
        for (let q = 0; q < 3; q++) { const pa = P[a * 3 + q]; TG[k * 9 + q] = pa; TG[k * 9 + 3 + q] = P[b * 3 + q] - pa; TG[k * 9 + 6 + q] = P[c * 3 + q] - pa; }
      }
    });
    // uniform grid over the triangles
    let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (let i = 0; i < nv; i++) for (let q = 0; q < 3; q++) { const v = P[i * 3 + q]; if (v < mn[q]) mn[q] = v; if (v > mx[q]) mx[q] = v; }
    const cs = 0.5, o = mn.map((v) => v - 0.1), dim = mx.map((v, q) => Math.max(1, Math.ceil((v - o[q] + 0.1) / cs)));
    const nc = dim[0] * dim[1] * dim[2], start = new Int32Array(nc + 1);
    const cellRange = (t) => {
      const lo = [], hi = [];
      for (let q = 0; q < 3; q++) {
        const a = TG[t * 9 + q], b = a + TG[t * 9 + 3 + q], c = a + TG[t * 9 + 6 + q];
        lo[q] = Math.max(0, Math.floor((Math.min(a, b, c) - o[q]) / cs)); hi[q] = Math.min(dim[q] - 1, Math.floor((Math.max(a, b, c) - o[q]) / cs));
      }
      return [lo, hi];
    };
    const visit = (fn) => {
      for (let t = 0; t < nt; t++) {
        const [lo, hi] = cellRange(t);
        for (let z = lo[2]; z <= hi[2]; z++) for (let y = lo[1]; y <= hi[1]; y++) for (let x = lo[0]; x <= hi[0]; x++) fn((z * dim[1] + y) * dim[0] + x, t);
      }
    };
    visit((c) => start[c + 1]++);                                   // count triangles per cell
    for (let c = 0; c < nc; c++) start[c + 1] += start[c];          // prefix sum -> cell offsets
    const list = new Int32Array(start[nc]), fill = start.slice(0, nc);
    visit((c, t) => (list[fill[c]++] = t));                         // fill
    return { nv, nt, P, N, vMesh, TV, TM, TG, grid: { o, cs, dim, start, list }, vOff };
  }

  function makeTracer(S) {
    const { TG, grid } = S, { o: go, cs, dim, start, list } = grid, nt = S.nt, stamp = new Int32Array(nt);
    const [nx, ny, nz] = dim, bmax = [go[0] + nx * cs, go[1] + ny * cs, go[2] + nz * cs];
    let sid = 0;
    const hit = { tri: -1, u: 0, v: 0 };
    // returns hit distance or -1. any=true: stop at the first intersection (shadow rays)
    function trace(ox, oy, oz, dx, dy, dz, tmax, any) {
      sid++;
      let t0 = 0, t1 = tmax;
      const O = [ox, oy, oz], Dd = [dx, dy, dz];
      for (let q = 0; q < 3; q++) {
        if (Math.abs(Dd[q]) < 1e-12) { if (O[q] < go[q] || O[q] > bmax[q]) return -1; continue; }
        let ta = (go[q] - O[q]) / Dd[q], tb = (bmax[q] - O[q]) / Dd[q]; if (ta > tb) { const s = ta; ta = tb; tb = s; }
        if (ta > t0) t0 = ta; if (tb < t1) t1 = tb; if (t0 > t1) return -1;
      }
      const px = ox + dx * t0, py = oy + dy * t0, pz = oz + dz * t0;
      let ix = Math.min(nx - 1, Math.max(0, Math.floor((px - go[0]) / cs))), iy = Math.min(ny - 1, Math.max(0, Math.floor((py - go[1]) / cs))), iz = Math.min(nz - 1, Math.max(0, Math.floor((pz - go[2]) / cs)));
      const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
      const tdx = dx !== 0 ? cs / Math.abs(dx) : Infinity, tdy = dy !== 0 ? cs / Math.abs(dy) : Infinity, tdz = dz !== 0 ? cs / Math.abs(dz) : Infinity;
      let tmx = dx !== 0 ? ((dx > 0 ? go[0] + (ix + 1) * cs : go[0] + ix * cs) - ox) / dx : Infinity;
      let tmy = dy !== 0 ? ((dy > 0 ? go[1] + (iy + 1) * cs : go[1] + iy * cs) - oy) / dy : Infinity;
      let tmz = dz !== 0 ? ((dz > 0 ? go[2] + (iz + 1) * cs : go[2] + iz * cs) - oz) / dz : Infinity;
      let best = Infinity;
      for (;;) {
        const c = (iz * ny + iy) * nx + ix;
        for (let k = start[c], e = start[c + 1]; k < e; k++) {
          const t = list[k]; if (stamp[t] === sid) continue; stamp[t] = sid;
          const g = t * 9, e1x = TG[g + 3], e1y = TG[g + 4], e1z = TG[g + 5], e2x = TG[g + 6], e2y = TG[g + 7], e2z = TG[g + 8];
          const hx = dy * e2z - dz * e2y, hy = dz * e2x - dx * e2z, hz = dx * e2y - dy * e2x;
          const det = e1x * hx + e1y * hy + e1z * hz; if (det > -1e-10 && det < 1e-10) continue;
          const inv = 1 / det, sx0 = ox - TG[g], sy0 = oy - TG[g + 1], sz0 = oz - TG[g + 2];
          const u = (sx0 * hx + sy0 * hy + sz0 * hz) * inv; if (u < 0 || u > 1) continue;
          const qx = sy0 * e1z - sz0 * e1y, qy = sz0 * e1x - sx0 * e1z, qz = sx0 * e1y - sy0 * e1x;
          const v = (dx * qx + dy * qy + dz * qz) * inv; if (v < 0 || u + v > 1) continue;
          const tt = (e2x * qx + e2y * qy + e2z * qz) * inv;
          if (tt > 1e-4 && tt < best && tt <= tmax) { best = tt; hit.tri = t; hit.u = u; hit.v = v; if (any) return tt; }
        }
        let tn;
        if (tmx < tmy && tmx < tmz) { tn = tmx; if (best <= tn) break; ix += sx; tmx += tdx; if (ix < 0 || ix >= nx) break; }
        else if (tmy < tmz) { tn = tmy; if (best <= tn) break; iy += sy; tmy += tdy; if (iy < 0 || iy >= ny) break; }
        else { tn = tmz; if (best <= tn) break; iz += sz; tmz += tdz; if (iz < 0 || iz >= nz) break; }
        if (tn > t1) break;
      }
      return best === Infinity ? -1 : best;
    }
    return { trace, hit };
  }

  /* ---------------- the bake ---------------- */
  const skyL = (dy) => { // radiance of the sky / ground seen through a window, per channel
    const B = OV.BAKE;
    if (dy <= 0) return [B.groundL, B.groundL * 0.98, B.groundL * 0.92];
    const t = Math.pow(dy, 0.55);
    return [B.skyL * (1.0 - 0.45 * t), B.skyL * (0.96 - 0.18 * t), B.skyL * (0.86 + 0.14 * t)];
  };
  const rad = (i, n) => { let b = 0, f = 0.5, x = i; while (x > 0) { b += (x & 1) * f; x >>= 1; f *= 0.5; } return b; };
  function samples(n) { // cosine-weighted hemisphere, local frame (z = normal)
    const s = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const r = Math.sqrt((i + 0.5) / n), ph = 2 * Math.PI * rad(i + 1), z = Math.sqrt(1 - r * r); s[i * 3] = r * Math.cos(ph); s[i * 3 + 1] = r * Math.sin(ph); s[i * 3 + 2] = z; }
    return s;
  }

  OV.bakeLighting = async function (root, emitters, opts, onProgress) {
    const meshes = OV.bakeMeshes(root), S = buildScene(meshes), { trace, hit } = makeTracer(S), { nv, P, N, TV, TM, vMesh } = S;
    const B = OV.BAKE, o = Object.assign({ n1: 64, m: 48, iters: 2, smooth: 2 }, opts);
    const tick = () => new Promise((r) => setTimeout(r, 0));
    console.log(`[bake] ${meshes.length} meshes, ${nv} vertices, ${S.nt} occluder triangles, grid ${S.grid.dim.join('x')}, ${emitters.length} emitters`);

    const sun = OV.SUN_DIR, sunCol = SUN_COL;
    const dirDay = new Float32Array(nv * 3), sunOnly = new Float32Array(nv * 3), lampD = new Float32Array(nv * 3);
    const S1 = samples(o.n1), SM = samples(o.m);
    const t0 = performance.now();
    const dirOf = (S0, i, tx, ty, tz, bx, by, bz, nx, ny, nz, c, s) => { // sample i -> world dir with random spin
      const lx = S0[i * 3] * c - S0[i * 3 + 1] * s, ly = S0[i * 3] * s + S0[i * 3 + 1] * c, lz = S0[i * 3 + 2];
      return [tx * lx + bx * ly + nx * lz, ty * lx + by * ly + ny * lz, tz * lx + bz * ly + nz * lz];
    };
    const frame = (nx, ny, nz) => {
      let ax = 0, ay = 1, az = 0; if (Math.abs(ny) > 0.9) { ax = 1; ay = 0; }
      let tx = ay * nz - az * ny, ty = az * nx - ax * nz, tz = ax * ny - ay * nx; const l = Math.hypot(tx, ty, tz); tx /= l; ty /= l; tz /= l;
      return [tx, ty, tz, ny * tz - nz * ty, nz * tx - nx * tz, nx * ty - ny * tx];
    };

    /* pass 1: direct sky, direct sun (only for bouncing), direct lamps */
    for (let v = 0; v < nv; v++) {
      const nx = N[v * 3], ny = N[v * 3 + 1], nz = N[v * 3 + 2], ox = P[v * 3] + nx * 0.02, oy = P[v * 3 + 1] + ny * 0.02, oz = P[v * 3 + 2] + nz * 0.02;
      const [tx, ty, tz, bx, by, bz] = frame(nx, ny, nz), ang = Math.random() * 6.2832, c = Math.cos(ang), s = Math.sin(ang);
      let sr = 0, sg = 0, sb = 0;
      for (let i = 0; i < o.n1; i++) {
        const d = dirOf(S1, i, tx, ty, tz, bx, by, bz, nx, ny, nz, c, s);
        if (trace(ox, oy, oz, d[0], d[1], d[2], 1e4, true) < 0) { const L = skyL(d[1]); sr += L[0]; sg += L[1]; sb += L[2]; }
      }
      const k = Math.PI / o.n1; dirDay[v * 3] = sr * k; dirDay[v * 3 + 1] = sg * k; dirDay[v * 3 + 2] = sb * k;
      const ndl = nx * sun.x + ny * sun.y + nz * sun.z;
      if (ndl > 0 && trace(ox, oy, oz, sun.x, sun.y, sun.z, 300, true) < 0) for (let q = 0; q < 3; q++) sunOnly[v * 3 + q] = B.sunI * ndl * sunCol[q];
      let lr = 0, lg = 0, lb = 0;
      for (const e of emitters) {
        const dx = e.x - ox, dy = e.y - oy, dz = e.z - oz, d2 = dx * dx + dy * dy + dz * dz, d = Math.sqrt(d2); if (d < 0.05 || d > 11) continue;
        const cr = (nx * dx + ny * dy + nz * dz) / d; if (cr <= 0) continue;
        // a ceiling emitter faces down (normal 0,-1,0); the direction emitter->point is -(dx,dy,dz)/d, so cos = dy/d
        const cosEm = e.dir < 0 ? Math.max(0, dy / d) : e.dir > 0 ? Math.max(0, -dy / d) : 1;
        const E = (e.J * cr * cosEm) / d2; if (E < 0.006) continue;
        if (trace(ox, oy, oz, dx / d, dy / d, dz / d, d - 0.04, true) >= 0) continue;
        lr += E * LAMP_COL[0]; lg += E * LAMP_COL[1]; lb += E * LAMP_COL[2];
      }
      lampD[v * 3] = lr; lampD[v * 3 + 1] = lg; lampD[v * 3 + 2] = lb;
      if ((v & 1023) === 1023) { onProgress && onProgress('direct', v / nv * 0.4); await tick(); }
    }
    console.log('[bake] direct pass', Math.round(performance.now() - t0), 'ms');

    /* bounce passes: irradiance from what the surfaces around receive (diffuse, albedo-weighted) */
    let curDay = new Float32Array(nv * 3), curLamp = new Float32Array(nv * 3);
    for (let i = 0; i < nv * 3; i++) { curDay[i] = dirDay[i] + sunOnly[i]; curLamp[i] = lampD[i]; }
    let newDay = new Float32Array(nv * 3), newLamp = new Float32Array(nv * 3);
    const albOf = meshes.map((m) => ALB[m.name] || [0.5, 0.5, 0.5]);
    for (let it = 0; it < o.iters; it++) {
      for (let v = 0; v < nv; v++) {
        const nx = N[v * 3], ny = N[v * 3 + 1], nz = N[v * 3 + 2], ox = P[v * 3] + nx * 0.02, oy = P[v * 3 + 1] + ny * 0.02, oz = P[v * 3 + 2] + nz * 0.02;
        const [tx, ty, tz, bx, by, bz] = frame(nx, ny, nz), ang = Math.random() * 6.2832, c = Math.cos(ang), s = Math.sin(ang);
        let dr = 0, dg = 0, db = 0, lr = 0, lg = 0, lb = 0;
        for (let i = 0; i < o.m; i++) {
          const d = dirOf(SM, i, tx, ty, tz, bx, by, bz, nx, ny, nz, c, s);
          if (trace(ox, oy, oz, d[0], d[1], d[2], 60, false) < 0) continue;
          const t = hit.tri, a = TV[t * 3], b = TV[t * 3 + 1], cc = TV[t * 3 + 2], w0 = 1 - hit.u - hit.v, al = albOf[TM[t]];
          // surfaces seen from behind (back faces of thin geometry) contribute nothing sensible: require they face the ray
          dr += al[0] * (w0 * curDay[a * 3] + hit.u * curDay[b * 3] + hit.v * curDay[cc * 3]);
          dg += al[1] * (w0 * curDay[a * 3 + 1] + hit.u * curDay[b * 3 + 1] + hit.v * curDay[cc * 3 + 1]);
          db += al[2] * (w0 * curDay[a * 3 + 2] + hit.u * curDay[b * 3 + 2] + hit.v * curDay[cc * 3 + 2]);
          lr += al[0] * (w0 * curLamp[a * 3] + hit.u * curLamp[b * 3] + hit.v * curLamp[cc * 3]);
          lg += al[1] * (w0 * curLamp[a * 3 + 1] + hit.u * curLamp[b * 3 + 1] + hit.v * curLamp[cc * 3 + 1]);
          lb += al[2] * (w0 * curLamp[a * 3 + 2] + hit.u * curLamp[b * 3 + 2] + hit.v * curLamp[cc * 3 + 2]);
        }
        const k = 1 / o.m;
        newDay[v * 3] = dirDay[v * 3] + sunOnly[v * 3] + dr * k; newDay[v * 3 + 1] = dirDay[v * 3 + 1] + sunOnly[v * 3 + 1] + dg * k; newDay[v * 3 + 2] = dirDay[v * 3 + 2] + sunOnly[v * 3 + 2] + db * k;
        newLamp[v * 3] = lampD[v * 3] + lr * k; newLamp[v * 3 + 1] = lampD[v * 3 + 1] + lg * k; newLamp[v * 3 + 2] = lampD[v * 3 + 2] + lb * k;
        if ((v & 1023) === 1023) { onProgress && onProgress('bounce ' + (it + 1), 0.4 + 0.5 * (it + v / nv) / o.iters); await tick(); }
      }
      [curDay, newDay] = [newDay, curDay]; [curLamp, newLamp] = [newLamp, curLamp];
      console.log('[bake] bounce', it + 1, Math.round(performance.now() - t0), 'ms');
    }

    /* result = total minus the direct sun (which stays live); then smooth the Monte Carlo noise over each mesh's triangles */
    const day = new Float32Array(nv * 3), lamp = new Float32Array(nv * 3);
    for (let i = 0; i < nv * 3; i++) { day[i] = Math.max(0, curDay[i] - sunOnly[i]); lamp[i] = curLamp[i]; }
    const smoothArr = (arr, mesh, off) => {
      const idx = mesh.geometry.index.array, cnt = mesh.geometry.attributes.position.count, sum = new Float32Array(cnt * 3), n = new Float32Array(cnt);
      for (let pass = 0; pass < o.smooth; pass++) {
        sum.fill(0); n.fill(0);
        for (let j = 0; j < idx.length; j += 3) {
          const t3 = [idx[j], idx[j + 1], idx[j + 2]];
          for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) if (a !== b) { const u = t3[a], w = t3[b]; for (let q = 0; q < 3; q++) sum[u * 3 + q] += arr[(off + w) * 3 + q]; n[u]++; }
        }
        for (let u = 0; u < cnt; u++) if (n[u]) for (let q = 0; q < 3; q++) arr[(off + u) * 3 + q] = 0.4 * arr[(off + u) * 3 + q] + 0.6 * sum[u * 3 + q] / n[u];
      }
    };
    meshes.forEach((m, i) => { smoothArr(day, m, S.vOff[i]); smoothArr(lamp, m, S.vOff[i]); });
    onProgress && onProgress('done', 1);

    const half = new Uint16Array(nv * 6), dh = T.DataUtils.toHalfFloat;
    for (let v = 0; v < nv; v++) for (let q = 0; q < 3; q++) { half[v * 6 + q] = dh(Math.min(60000, day[v * 3 + q])); half[v * 6 + 3 + q] = dh(Math.min(60000, lamp[v * 3 + q])); }
    const meta = { version: 1, meshes: meshes.map((m, i) => ({ name: m.name, count: m.geometry.attributes.position.count, hash: hashPos(m.geometry.attributes.position.array) })), total: nv, bakedWith: Object.assign({}, B, o), seconds: Math.round((performance.now() - t0) / 1000) };
    return { half, meta };
  };

  OV._bake = { buildScene, makeTracer }; // exposed for tests

  OV.saveBake = async function (res) {
    await fetch('/save?dir=bake&name=bake.bin', { method: 'POST', body: res.half.buffer });
    await fetch('/save?dir=bake&name=bake.json', { method: 'POST', body: JSON.stringify(res.meta) });
  };

  /* ---------------- runtime ---------------- */
  // Returns true if the bake matched the geometry and was applied. Materials are patched so the
  // baked irradiance replaces ambient + hemisphere + diffuse IBL.
  OV.loadBake = async function (root, M) {
    try {
      const [mj, mb] = await Promise.all([fetch('assets/bake/bake.json'), fetch('assets/bake/bake.bin')]);
      if (!mj.ok || !mb.ok) return false;
      const meta = await mj.json(), buf = new Uint16Array(await mb.arrayBuffer()), meshes = OV.bakeMeshes(root);
      if (meta.meshes.length !== meshes.length) { console.warn('[bake] mesh list changed; using realtime lights (re-run ?lightbake=1)'); return false; }
      for (let i = 0; i < meshes.length; i++) {
        const m = meshes[i], a = meta.meshes[i];
        if (a.name !== m.name || a.count !== m.geometry.attributes.position.count || a.hash !== hashPos(m.geometry.attributes.position.array)) { console.warn('[bake] geometry changed at', m.name, '; using realtime lights'); return false; }
      }
      const fh = T.DataUtils.fromHalfFloat; let off = 0;
      meshes.forEach((m) => {
        const c = m.geometry.attributes.position.count, d = new Float32Array(c * 3), l = new Float32Array(c * 3);
        for (let v = 0; v < c; v++) for (let q = 0; q < 3; q++) { d[v * 3 + q] = fh(buf[(off + v) * 6 + q]); l[v * 3 + q] = fh(buf[(off + v) * 6 + 3 + q]); }
        m.geometry.setAttribute('bakeDay', new T.BufferAttribute(d, 3)); m.geometry.setAttribute('bakeLamp', new T.BufferAttribute(l, 3));
        off += c;
      });
      const done = new Set();
      meshes.forEach((m) => { if (!done.has(m.name) && M[m.name]) { done.add(m.name); OV.patchMaterial(M[m.name], { bake: true, sway: m.name.startsWith('leaf') }); } });
      OV.U.day.value = OV.BAKE.dayGain; OV.U.lamp.value = OV.BAKE.lampGain;
      return true;
    } catch (e) { console.warn('[bake] not loaded:', e.message); return false; }
  };
})();
