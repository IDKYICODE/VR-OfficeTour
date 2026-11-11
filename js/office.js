/* The office: reception (polished concrete) -> open workspace (carpet tiles) ->
   meeting room (oak), 20 x 10 m, 2.9 m ceiling. Built procedurally so the sample
   needs no model files. Coordinates: x east, z south, y up. */
(function () {
  const T = AFRAME.THREE;
  const OV = (window.OV = window.OV || {});
  const H = 2.9, W = 20, D = 10, WT = 0.22, PT = 0.15;

  // yaw in degrees; -90 faces +x (east), 180 faces +z (south), 0 faces -z (north)
  OV.SPOTS = [
    { id: 'entrance', name: 'Entrance', x: 3.0, z: 1.4, yaw: 180 },
    { id: 'lounge', name: 'Lounge', x: 2.5, z: 3.7, yaw: -90 },
    { id: 'desk', name: 'Reception', x: 3.0, z: 5.9, yaw: 180 },
    { id: 'office', name: 'Open Office', x: 7.1, z: 5.0, yaw: -90 },
    { id: 'pods', name: 'Workstations', x: 10.0, z: 5.0, yaw: 180 },
    { id: 'meeting', name: 'Meeting Room', x: 17.0, z: 8.7, yaw: 0 },
    { id: 'view', name: 'Window View', x: 19.0, z: 5.0, yaw: -90 },
  ];

  OV.quality = function () {
    const qs = new URLSearchParams(location.search);
    const ua = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
    const mobile = qs.has('q') ? qs.get('q') === 'low' : ua;
    return { mobile, tex: mobile ? 512 : 1024, shadow: mobile ? 2048 : 4096, lights: mobile ? 3 : 5, debug: qs.has('debug'), bake: qs.has('bake'), gen: qs.has('gen') || qs.has('bake') };
  };

  /* ---------------- materials ---------------- */
  function materials(tex) {
    const S = (o) => new T.MeshStandardMaterial(o);
    const Bm = (o) => new T.MeshBasicMaterial(o);
    const bump = { bumpMap: tex.weaveBump, bumpScale: 0.8 };
    const M = {
      plaster: S({ color: 0xf1ede6, roughness: 0.94, bumpMap: tex.plasterBump, bumpScale: 0.5 }),
      teal: S({ color: 0x1d5a60, roughness: 0.88, bumpMap: tex.plasterBump, bumpScale: 0.5 }),
      terra: S({ color: 0xa9503a, roughness: 0.88, bumpMap: tex.plasterBump, bumpScale: 0.5 }),
      trim: S({ color: 0xfbfaf7, roughness: 0.42 }),
      frame: S({ color: 0x14161a, roughness: 0.45, metalness: 0.6 }),
      concrete: S({ map: tex.concrete, bumpMap: tex.concreteBump, bumpScale: 0.35, roughness: 0.28 }),
      carpet: S({ map: tex.carpet, bumpMap: tex.carpetBump, bumpScale: 1.2, roughness: 1 }),
      oak: S({ map: tex.oak, bumpMap: tex.oakBump, bumpScale: 0.5, roughness: 0.4 }),
      ceiling: S({ map: tex.ceil, bumpMap: tex.ceilBump, bumpScale: 0.6, roughness: 0.95 }),
      rug: S({ color: 0xd2b08c, map: tex.weave, ...bump, roughness: 1 }),
      ground: S({ color: 0x3b3e42, roughness: 1 }),
      metal: S({ color: 0x2a2c30, metalness: 0.85, roughness: 0.38 }),
      chrome: S({ color: 0xd5d8dc, metalness: 1, roughness: 0.2 }),
      black: S({ color: 0x111114, roughness: 0.5, metalness: 0.1 }),
      kb: S({ color: 0x3b3e44, roughness: 0.6 }),
      white: S({ color: 0xeeeeea, roughness: 0.4 }),
      stone: S({ color: 0xe8e6e0, roughness: 0.16 }),
      walnut: S({ color: 0xffffff, map: tex.walnut, bumpMap: tex.walnutBump, bumpScale: 0.4, roughness: 0.42 }),
      woodDesk: S({ color: 0xffffff, map: tex.oakF, bumpMap: tex.oakFBump, bumpScale: 0.4, roughness: 0.5 }),
      cabinet: S({ color: 0xe6e4de, roughness: 0.5 }),
      cabinetG: S({ color: 0x8fa397, roughness: 0.5 }),
      fabA: S({ color: 0x3a4756, map: tex.weave, ...bump, roughness: 0.95 }),
      fabE: S({ color: 0x30343a, map: tex.weave, ...bump, roughness: 0.95 }),
      fabC: S({ color: 0xd8cfc0, map: tex.weave, ...bump, roughness: 0.95 }),
      fabD: S({ color: 0xa9503a, map: tex.weave, ...bump, roughness: 0.95 }),
      pot: S({ color: 0xf1efe9, roughness: 0.35 }),
      soil: S({ color: 0x2a1d15, roughness: 1 }),
      leafA: S({ color: 0x2f5e34, roughness: 0.55, side: T.DoubleSide }),
      leafB: S({ color: 0x4d7d3b, roughness: 0.55, side: T.DoubleSide }),
      led: Bm({ color: new T.Color().setRGB(1, 0.93, 0.8) }),
      drum: S({ color: 0xf3e6cf, emissive: 0xffd49a, emissiveIntensity: 0.85, roughness: 0.9, side: T.DoubleSide }),
      whiteboard: S({ color: 0xffffff, roughness: 0.12 }),
      glass: S({ color: 0xcfe6ee, roughness: 0.04, transparent: true, opacity: 0.13, side: T.DoubleSide, depthWrite: false }),
      frost: S({ color: 0xffffff, roughness: 0.6, transparent: true, opacity: 0.5, side: T.DoubleSide, depthWrite: false }),
      logo: Bm({ map: tex.logo, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
      tvScreen: Bm({ map: tex.tv }),
      blob: Bm({ map: tex.blob, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
      aoStrip: Bm({ map: tex.aoStrip, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    };
    M.carpet.color.setRGB(1.4, 1.4, 1.45); // baked carpet texture is dark; lift it without re-baking
    for (let i = 0; i < 3; i++) { M['screen' + i] = Bm({ map: tex['screen' + i] }); M['art' + i] = S({ map: tex['art' + i], roughness: 0.8 }); }
    return M;
  }
  const NOSHADOW = { cast: false, recv: false };
  const FLAGS = {
    blob: NOSHADOW, aoStrip: NOSHADOW, led: NOSHADOW, logo: NOSHADOW, tvScreen: NOSHADOW,
    glass: { cast: false, recv: false, order: 5 }, frost: { cast: false, recv: false, order: 5 },
    ground: { cast: false }, screen0: NOSHADOW, screen1: NOSHADOW, screen2: NOSHADOW,
  };

  /* ---------------- structure ---------------- */
  // A straight wall with openings. openings: {a,b,y0,y1,type:'door'|'window'|'entry'}
  function wall(B, o) {
    const { axis, line, a, b, thick, inner } = o, f = 0.05;
    const ops = (o.openings || []).slice().sort((p, q) => p.a - q.a);
    const rb = (key, s0, s1, y0, y1, po, pt, tile) => {
      const len = s1 - s0, hh = y1 - y0;
      if (len < 1e-4 || hh < 1e-4) return;
      const c = (s0 + s1) / 2, cy = (y0 + y1) / 2;
      if (axis === 'x') B.w.box(key, len, hh, pt, c, cy, line + po, { tile });
      else B.w.box(key, pt, hh, len, line + po, cy, c, { tile });
    };
    const col = (s0, s1) => B.colliders.push(axis === 'x'
      ? { x0: s0, x1: s1, z0: line - thick / 2, z1: line + thick / 2 }
      : { x0: line - thick / 2, x1: line + thick / 2, z0: s0, z1: s1 });
    const base = (s0, s1) => (o.sides || []).forEach((sd) => rb('trim', s0, s1, 0, 0.11, sd * (thick / 2 + 0.008), 0.016));
    const solid = (s0, s1) => { rb('plaster', s0, s1, 0, H, 0, thick, 1.5); col(s0, s1); base(s0, s1); };

    let cur = a;
    for (const op of ops) {
      if (op.a > cur) solid(cur, op.a);
      const y0 = op.y0 || 0, y1 = op.y1 || 2.2, type = op.type || 'door';
      if (y0 > 0) { rb('plaster', op.a, op.b, 0, y0, 0, thick, 1.5); base(op.a, op.b); }
      rb('plaster', op.a, op.b, y1, H, 0, thick, 1.5);
      if (type === 'door') {
        rb('trim', op.a, op.a + f, 0, y1, 0, thick + 0.03);
        rb('trim', op.b - f, op.b, 0, y1, 0, thick + 0.03);
        rb('trim', op.a, op.b, y1 - f, y1, 0, thick + 0.03);
      } else {
        col(op.a, op.b);
        rb('glass', op.a, op.b, y0, y1, 0, 0.01);
        rb('frame', op.a, op.b, y0, y0 + f, 0, 0.07); rb('frame', op.a, op.b, y1 - f, y1, 0, 0.07);
        rb('frame', op.a, op.a + f, y0, y1, 0, 0.07); rb('frame', op.b - f, op.b, y0, y1, 0, 0.07);
        const n = Math.max(1, Math.round((op.b - op.a) / (type === 'entry' ? 0.7 : 1.7)));
        for (let i = 1; i < n; i++) { const s = op.a + (op.b - op.a) * i / n; rb('frame', s - f / 2, s + f / 2, y0, y1, 0, 0.07); }
        if (type === 'window') rb('trim', op.a - 0.02, op.b + 0.02, y0 - 0.035, y0, inner * (thick / 2 + 0.025), 0.15);
        else { // entry: kick plate + long pull handles
          rb('frame', op.a, op.b, 0, 0.14, 0, 0.08);
          const m = (op.a + op.b) / 2;
          for (const s of [-0.12, 0.12]) rb('chrome', m + s - 0.012, m + s + 0.012, 0.85, 1.95, inner * 0.07, 0.025);
        }
      }
      cur = op.b;
    }
    if (cur < b) solid(cur, b);
  }

  // long thin soft shadow strips where floor meets wall
  function aoLine(B, axis, line, a, b, n, skips) {
    const w = 0.6, segs = [];
    let cur = a;
    (skips || []).slice().sort((p, q) => p[0] - q[0]).forEach(([s0, s1]) => { if (s0 > cur) segs.push([cur, s0]); cur = s1; });
    if (cur < b) segs.push([cur, b]);
    segs.forEach(([s0, s1]) => (axis === 'x' ? B.strip(s0, line, s1, line, 0, n, w) : B.strip(line, s0, line, s1, n, 0, w)));
  }

  function glassPartition(B) { // x = 14, with a glazed door gap at z 4.4..5.6
    const x = 14, t = 0.06, w = B.w, d0 = 4.4, d1 = 5.6;
    [[0, d0], [d1, D]].forEach(([s0, s1]) => {
      const len = s1 - s0, n = Math.max(1, Math.round(len / 1.1)), step = len / n;
      w.box('glass', 0.01, H - 0.2, len, x, 0.1 + (H - 0.2) / 2, (s0 + s1) / 2);
      w.box('frost', 0.014, 0.3, len, x, 1.15, (s0 + s1) / 2);
      w.box('frame', t, 0.1, len, x, 0.05, (s0 + s1) / 2);
      w.box('frame', t, 0.1, len, x, H - 0.05, (s0 + s1) / 2);
      for (let i = 0; i <= n; i++) w.box('frame', t, H, 0.05, x, H / 2, s0 + i * step);
      B.colliders.push({ x0: x - 0.05, x1: x + 0.05, z0: s0, z1: s1 });
    });
    w.box('glass', 0.01, H - 2.3 - 0.1, d1 - d0, x, 2.3 + (H - 2.4) / 2, (d0 + d1) / 2);
    w.box('frame', t, 0.06, d1 - d0, x, 2.3, (d0 + d1) / 2);
    w.box('frame', t, 2.3, 0.05, x, 1.15, d0); w.box('frame', t, 2.3, 0.05, x, 1.15, d1);
  }

  /* ---------------- furniture ---------------- */
  function officeChair(g, fab) { // front = local +z
    g.cyl('metal', 0.03, 0.03, 0.34, 0, 0.27, 0, { seg: 10 });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      g.box('metal', 0.27, 0.03, 0.05, c * 0.135, 0.12, s * 0.135, { ry: -a });
      g.sph('black', 0.032, c * 0.265, 0.04, s * 0.265);
    }
    g.rbox(fab, 0.5, 0.09, 0.48, 0.035, 0, 0.5, 0.02, { tile: 0.16 });
    g.rbox(fab, 0.46, 0.5, 0.07, 0.03, 0, 0.82, -0.22, { rx: -0.1, tile: 0.16 });
    for (const sx of [-1, 1]) { g.box('black', 0.045, 0.025, 0.26, sx * 0.275, 0.7, 0); g.box('metal', 0.03, 0.17, 0.03, sx * 0.275, 0.61, 0.02); }
    g.collide(0.55, 0.55, 0, 0);
    // sit spot: ry is the facing of the sitter; exit -1 = pull the chair back, +1 = stand up forwards
    g.b.seats.push({ x: g.ox + Math.sin(g.ry) * 0.02, z: g.oz + Math.cos(g.ry) * 0.02, ry: g.ry, eye: 1.22, exit: -1, hy: 1.2 });
  }

  function sofa(g, w, fab) { // front = local +z
    const a = 0.26;
    g.rbox(fab, w, 0.28, 0.92, 0.05, 0, 0.26, 0, { tile: 0.16 });
    g.rbox(fab, w, 0.5, 0.24, 0.08, 0, 0.6, -0.34, { tile: 0.16 });
    for (const sx of [-1, 1]) g.rbox(fab, a, 0.5, 0.92, 0.08, sx * (w / 2 - a / 2), 0.42, 0, { tile: 0.16 });
    const n = w > 1.5 ? 2 : 1, cw = (w - 2 * a) / n;
    for (let i = 0; i < n; i++) {
      const cx = -((n - 1) / 2) * cw + i * cw;
      g.rbox(fab, cw - 0.02, 0.16, 0.7, 0.06, cx, 0.46, 0.1, { tile: 0.16 });
      g.rbox(fab, cw - 0.02, 0.4, 0.17, 0.07, cx, 0.66, -0.2, { rx: -0.16, tile: 0.16 });
      const sp = new T.Vector3(cx, 0, 0.1).applyMatrix4(g.M);
      g.b.seats.push({ x: sp.x, z: sp.z, ry: g.ry, eye: 1.12, exit: 1, hy: 0.95 });
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.cyl('walnut', 0.025, 0.02, 0.12, sx * (w / 2 - 0.1), 0.06, sz * 0.36, { seg: 8 });
    g.collide(w + 0.05, 1.0, 0, 0);
  }

  function plant(B, x, z, s, seed, pot) {
    const g = B.group(x, z, 0), r = OV.rng(seed);
    const prof = [[0, 0], [0.15, 0], [0.19, 0.05], [0.21, 0.36], [0.23, 0.4], [0.2, 0.4], [0.2, 0.37]].map((p) => new T.Vector2(p[0] * s, p[1] * s));
    g.geo(pot || 'pot', new T.LatheGeometry(prof, 22), 0, 0, 0);
    g.cyl('soil', 0.2 * s, 0.2 * s, 0.02, 0, 0.36 * s, 0, { seg: 16 });
    const n = Math.round(34 * s);
    for (let i = 0; i < n; i++) {
      const len = 0.5 * s * (0.7 + r() * 0.8), wid = 0.13 * s * (0.8 + r() * 0.5);
      const lg = new T.PlaneGeometry(wid, len, 1, 4), p = lg.attributes.position;
      for (let k = 0; k < p.count; k++) {
        const t = (p.getY(k) + len / 2) / len;
        p.setXYZ(k, p.getX(k) * (0.3 + 0.7 * Math.sin(Math.PI * Math.min(1, t * 1.12))), t * len, t * t * len * 0.4);
      }
      lg.computeVertexNormals();
      g.geo(r() > 0.5 ? 'leafA' : 'leafB', lg, 0, 0.38 * s, 0, { rx: 0.12 + r() * 0.75, ry: r() * Math.PI * 2 });
    }
    g.collide(0.5 * s, 0.5 * s, 0, 0);
    B.blob(x, z, 0.9 * s, 0.9 * s);
  }

  function workstation(B, xc, zc, side, k, r) {
    const dz = zc + side * 0.4, ry = side < 0 ? Math.PI : 0; // desk local +z points at the occupant
    const d = B.group(xc, dz, ry);
    d.rbox('woodDesk', 1.5, 0.04, 0.8, 0.008, 0, 0.72, 0, { tile: 0.8, col: true });
    for (const sx of [-1, 1]) d.box('metal', 0.035, 0.7, 0.62, sx * 0.69, 0.35, 0);
    d.box('white', 1.3, 0.34, 0.02, 0, 0.5, -0.34);
    if (r() > 0.45) { // drawer pedestal
      const px = r() > 0.5 ? 0.44 : -0.44;
      d.box('white', 0.42, 0.56, 0.52, px, 0.31, 0.0);
      for (let i = 0; i < 3; i++) d.box('chrome', 0.18, 0.012, 0.012, px, 0.12 + i * 0.18, 0.265);
    }
    // monitor: panel at far edge, screen faces the occupant
    d.box('black', 0.22, 0.012, 0.16, 0, 0.746, -0.1);
    d.box('black', 0.035, 0.27, 0.02, 0, 0.88, -0.14);
    d.rbox('black', 0.62, 0.37, 0.025, 0.008, 0, 1.06, -0.12);
    d.plane('screen' + (k % 3), 0.6, 0.348, 0, 1.06, -0.1065);
    d.box('black', 0.43, 0.016, 0.15, 0, 0.748, 0.12); d.box('kb', 0.41, 0.004, 0.13, 0, 0.758, 0.12);
    d.rbox('black', 0.06, 0.026, 0.105, 0.012, 0.32, 0.753, 0.14);
    if (r() > 0.4) d.cyl('pot', 0.04, 0.035, 0.09, -0.55, 0.785, 0.0, { seg: 12 });
    if (r() > 0.5) d.box('white', 0.2, 0.012, 0.28, -0.5, 0.746, 0.18, { ry: 0.25 });
    B.blob(xc, dz, 1.75, 1.05);
    officeChair(B.group(xc, zc + side * 1.25, side < 0 ? 0 : Math.PI), k % 2 ? 'fabA' : 'fabE');
    B.blob(xc, zc + side * 1.25, 0.9, 0.9);
  }

  function pendantDrum(B, x, z, y, r) {
    const g = B.group(x, z, 0);
    g.box('black', 0.008, H - y, 0.008, 0, (H + y) / 2, 0);
    g.geo('drum', new T.CylinderGeometry(r, r * 1.05, 0.2, 28, 1, true), 0, y, 0);
    g.sph('led', 0.05, 0, y - 0.06, 0);
  }
  function lightBar(B, x, z, y) {
    const g = B.group(x, z, 0);
    g.box('trim', 1.5, 0.05, 0.07, 0, y, 0); g.box('led', 1.46, 0.01, 0.05, 0, y - 0.03, 0);
    for (const sx of [-0.6, 0.6]) g.box('black', 0.006, H - y, 0.006, sx, (H + y) / 2, 0);
  }
  function artwork(g, key, w, h, lx, ly, lz) {
    g.box('frame', w + 0.06, h + 0.06, 0.035, lx, ly, lz + 0.018);
    g.plane(key, w, h, lx, ly, lz + 0.0365);
  }

  /* ---------------- rooms ---------------- */
  function reception(B, r) {
    const w = B.w;
    // accent wall + logo
    w.box('teal', 6, H, 0.03, 3, H / 2, D - 0.015);
    w.plane('logo', 3.4, 0.85, 3.0, 1.9, D - 0.034, { ry: Math.PI });
    w.box('led', 3.6, 0.02, 0.03, 3.0, H - 0.12, D - 0.06); // cove glow strip
    // reception desk (visitors approach from the north)
    const rd = B.group(3.0, 7.9, Math.PI);
    rd.box('walnut', 3.4, 0.95, 0.05, 0, 0.475, 0.39);
    for (let i = 0; i < 46; i++) rd.box('walnut', 0.05, 0.95, 0.05, -1.65 + i * 0.0735, 0.475, 0.43);
    rd.rbox('stone', 3.6, 0.05, 1.0, 0.015, 0, 1.045, 0, { col: true });
    rd.box('walnut', 3.2, 0.04, 0.5, 0, 0.76, -0.18);
    for (const sx of [-1, 1]) rd.box('walnut', 0.05, 1.0, 0.95, sx * 1.7, 0.5, 0);
    rd.box('led', 3.4, 0.02, 0.02, 0, 0.98, 0.46); rd.box('led', 3.3, 0.015, 0.015, 0, 0.03, 0.47);
    rd.cyl('pot', 0.07, 0.05, 0.22, -1.3, 1.18, 0.1, { seg: 14 });
    B.blob(3.0, 7.9, 3.9, 1.5);
    const rc = B.group(3.0, 8.85, Math.PI); officeChair(rc, 'fabA'); B.blob(3.0, 8.85, 0.9, 0.9);
    const cr = B.group(3.0, 9.72, Math.PI);
    cr.rbox('walnut', 2.8, 0.75, 0.4, 0.012, 0, 0.375, 0, { col: true });
    cr.rbox('stone', 2.84, 0.03, 0.44, 0.01, 0, 0.765, 0);
    cr.cyl('pot', 0.08, 0.06, 0.26, -0.9, 0.91, 0, { seg: 14 }); cr.cyl('pot', 0.06, 0.05, 0.2, -0.6, 0.88, 0.02, { seg: 14 });
    cr.box('cabinet', 0.3, 0.05, 0.22, 0.7, 0.8, 0); cr.box('terra', 0.26, 0.06, 0.2, 0.7, 0.855, 0, {});
    B.blob(3.0, 9.72, 3.1, 0.9);
    // lounge in the north-east corner
    w.box('rug', 3.0, 0.012, 2.2, 4.2, 0.006, 2.4, { tile: 1 });
    const sf = B.group(5.35, 2.4, -Math.PI / 2); sofa(sf, 2.2, 'fabC');
    sf.rbox('fabD', 0.42, 0.4, 0.13, 0.05, -0.72, 0.64, 0.02, { rx: -0.25, rz: 0.2, tile: 0.16 });
    B.blob(5.3, 2.4, 1.3, 2.7);
    const ac = B.group(4.0, 4.05, Math.PI); sofa(ac, 0.95, 'fabD'); B.blob(4.0, 4.05, 1.4, 1.4);
    const ct = B.group(4.0, 2.4, 0);
    ct.cyl('walnut', 0.5, 0.5, 0.04, 0, 0.4, 0, { seg: 32, tile: 0.8 }); ct.collide(0.95, 0.95, 0, 0);
    for (let i = 0; i < 3; i++) ct.cyl('metal', 0.018, 0.018, 0.38, Math.cos(i * 2.094) * 0.3, 0.19, Math.sin(i * 2.094) * 0.3, { seg: 8 });
    ct.box('white', 0.26, 0.04, 0.19, 0.1, 0.44, 0.05, { ry: 0.3 }); ct.box('terra', 0.22, 0.035, 0.17, 0.1, 0.48, 0.05, { ry: 0.5 });
    ct.cyl('pot', 0.07, 0.05, 0.16, -0.18, 0.5, -0.1, { seg: 14 });
    B.blob(4.0, 2.4, 1.5, 1.5);
    pendantDrum(B, 4.0, 2.4, 1.85, 0.32);
    // light switch by the entrance
    w.box('trim', 0.09, 0.13, 0.015, 4.1, 1.3, 0.0075); w.box('black', 0.03, 0.05, 0.012, 4.1, 1.3, 0.021);
    // art + plants
    artwork(B.group(5.925, 2.4, -Math.PI / 2), 'art0', 1.2, 1.5, 0, 1.75, 0);
    artwork(B.group(1.2, 0, 0), 'art1', 0.9, 1.1, 0, 1.6, 0);
    plant(B, 0.55, 0.6, 1.5, 11, 'pot'); plant(B, 5.45, 9.3, 1.3, 12, 'pot'); plant(B, 0.6, 9.3, 1.2, 13, 'pot');
    // ceiling downlights
    [[1.5, 2], [4.5, 1.0], [1.5, 6], [4.6, 6.2], [3, 4]].forEach(([x, z]) => w.box('led', 0.22, 0.012, 0.22, x, H - 0.006, z));
    aoLine(B, 'x', 0, 0, 6, 1); aoLine(B, 'x', D, 0, 6, -1);
    aoLine(B, 'z', 0, 0, D, 1); aoLine(B, 'z', 6 - PT / 2, 0, D, -1, [[4.2, 5.8]]);
  }

  function workspace(B, r) {
    const w = B.w;
    const cols = [7.75, 10, 12.25], rows = [2.6, 7.4];
    let k = 0;
    rows.forEach((zc) => cols.forEach((xc) => {
      workstation(B, xc, zc, -1, k++, r); workstation(B, xc, zc, 1, k++, r);
      w.box('fabA', 1.5, 0.34, 0.03, xc, 0.91, zc, {}); // low divider between the two benches
      lightBar(B, xc, zc, 2.35);
    }));
    // storage wall on the north side
    for (let i = 0; i < 3; i++) {
      const x = 6.9 + i * 0.9;
      w.box(i % 2 ? 'cabinetG' : 'cabinet', 0.88, 2.05, 0.45, x, 1.025, 0.225, { col: true });
      w.box('chrome', 0.02, 0.3, 0.02, x + 0.3, 1.05, 0.46);
    }
    for (let i = 0; i < 5; i++) {
      const x = 9.65 + i * 0.9;
      w.box('walnut', 0.88, 0.8, 0.45, x, 0.4, 0.225, { col: true, tile: 0.8 });
      w.box('chrome', 0.25, 0.015, 0.015, x, 0.7, 0.46);
    }
    const pr = B.group(10.4, 0.23, 0); pr.rbox('white', 0.5, 0.3, 0.42, 0.02, 0, 0.95, 0); pr.box('black', 0.3, 0.02, 0.2, 0, 1.11, 0.05);
    plant(B, 13.35, 0.45, 0.8, 21, 'pot');
    plant(B, 6.65, 9.35, 1.3, 22, 'pot'); plant(B, 13.3, 9.35, 1.2, 23, 'pot');
    // west wall (partition) display + art
    const wb = B.group(6.075, 2.2, Math.PI / 2);
    wb.box('frame', 1.9, 1.15, 0.04, 0, 1.5, 0.02); wb.box('whiteboard', 1.8, 1.05, 0.02, 0, 1.5, 0.032);
    artwork(B.group(6.075, 8.6, Math.PI / 2), 'art2', 0.9, 1.1, 0, 1.6, 0);
    // ceiling panels along the corridor
    [7.5, 10, 12.5].forEach((x) => w.box('led', 1.2, 0.012, 0.5, x, H - 0.006, 5));
    aoLine(B, 'x', 0, 6, 14, 1); aoLine(B, 'x', D, 6, 14, -1);
    aoLine(B, 'z', 6 + PT / 2, 0, D, 1, [[4.2, 5.8]]); aoLine(B, 'z', 14, 0, D, -1, [[4.4, 5.6]]);
  }

  function meeting(B, r) {
    const w = B.w;
    w.box('terra', 4.8, H, 0.03, 17, H / 2, 0.015);
    // table
    const t = B.group(17, 5.2, 0);
    t.rbox('walnut', 1.25, 0.06, 3.8, 0.02, 0, 0.74, 0, { tile: 0.8, rot: true, col: true });
    for (const sz of [-1.25, 1.25]) t.box('metal', 1.0, 0.7, 0.06, 0, 0.35, sz);
    t.box('black', 0.1, 0.02, 0.1, 0, 0.775, 0.1); t.cyl('black', 0.09, 0.09, 0.03, 0, 0.79, -0.4, { seg: 16 });
    for (let i = 0; i < 4; i++) {
      t.box('white', 0.22, 0.015, 0.3, i % 2 ? 0.35 : -0.35, 0.775, -1.2 + i * 0.75, { ry: 0.2 * (i - 1.5) });
      t.cyl('pot', 0.035, 0.03, 0.16, i % 2 ? -0.1 : 0.1, 0.85, -1.4 + i * 0.8, { seg: 10 });
    }
    B.blob(17, 5.2, 1.9, 4.5);
    [3.9, 4.8, 5.7, 6.5].forEach((z) => {
      officeChair(B.group(16.05, z, Math.PI / 2), 'fabE'); officeChair(B.group(17.95, z, -Math.PI / 2), 'fabE');
      B.blob(16.0, z, 0.8, 0.8); B.blob(18.0, z, 0.8, 0.8);
    });
    officeChair(B.group(17, 2.95, 0), 'fabE'); officeChair(B.group(17, 7.45, Math.PI), 'fabE');
    [4.0, 5.2, 6.4].forEach((z) => pendantDrum(B, 17, z, 1.95, 0.36));
    // TV wall
    const tv = B.group(17, 0, 0);
    tv.rbox('black', 1.7, 0.98, 0.05, 0.01, 0, 1.6, 0.04); tv.plane('tvScreen', 1.62, 0.912, 0, 1.6, 0.0655);
    tv.rbox('walnut', 2.6, 0.55, 0.4, 0.012, 0, 0.275, 0.22, { col: true }); tv.box('black', 0.5, 0.06, 0.25, 0.5, 0.58, 0.2);
    B.blob(17, 0.25, 3.0, 1.0);
    // south wall: whiteboard + credenza
    const wb = B.group(17, D, Math.PI);
    wb.box('frame', 2.5, 1.3, 0.04, 0, 1.55, 0.02); wb.box('whiteboard', 2.4, 1.2, 0.02, 0, 1.55, 0.032);
    wb.box('black', 0.12, 0.012, 0.02, -0.6, 1.0, 0.06); wb.box('terra', 0.12, 0.012, 0.02, -0.4, 1.0, 0.06);
    const cr = B.group(17, 9.75, Math.PI); cr.rbox('walnut', 2.4, 0.75, 0.4, 0.012, 0, 0.375, 0, { col: true, tile: 0.8 });
    cr.box('chrome', 0.3, 0.015, 0.015, -0.6, 0.55, 0.205); cr.box('chrome', 0.3, 0.015, 0.015, 0.6, 0.55, 0.205);
    cr.cyl('pot', 0.1, 0.07, 0.28, 0.9, 0.89, 0, { seg: 14 }); cr.box('cabinet', 0.4, 0.1, 0.28, -0.8, 0.8, 0);
    B.blob(17, 9.75, 2.7, 0.9);
    artwork(B.group(15.2, 0, 0), 'art1', 0.7, 0.9, 0, 1.6, 0);
    plant(B, 19.4, 0.8, 1.5, 31, 'pot'); plant(B, 19.4, 9.2, 1.4, 32, 'pot');
    [[16, 2.0], [18, 8.2]].forEach(([x, z]) => w.box('led', 0.6, 0.012, 1.2, x, H - 0.006, z));
    aoLine(B, 'x', 0, 14, 20, 1); aoLine(B, 'x', D, 14, 20, -1);
    aoLine(B, 'z', 20, 0, D, -1); aoLine(B, 'z', 14, 0, D, 1, [[4.4, 5.6]]);
  }

  function outside(B, r) {
    const w = B.w;
    w.box('ground', 800, 0.1, 800, 10, -0.07, 5);
  }

  /* ---------------- lighting ---------------- */
  OV.SUN_DIR = new T.Vector3(-0.45, 0.55, 0.7).normalize();

  function addLights(root, Q) {
    const hemi = new T.HemisphereLight(0xdfeaff, 0x9a8470, 0.5); root.add(hemi);
    const sun = new T.DirectionalLight(0xfff0d8, 3.4), tgt = new T.Vector3(10, 0, 5);
    sun.position.copy(tgt).addScaledVector(OV.SUN_DIR, 45); sun.target.position.copy(tgt);
    sun.castShadow = true; sun.shadow.mapSize.set(Q.shadow, Q.shadow);
    const c = sun.shadow.camera; c.left = -14; c.right = 14; c.top = 14; c.bottom = -14; c.near = 1; c.far = 120;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
    sun.shadow.autoUpdate = false; sun.shadow.needsUpdate = true; // static scene: render the shadow map once
    root.add(sun, sun.target);
    const pts = [[0xffe1b8, 3, 2.5, 4.5, 11, 12], [0xfff0dd, 10, 2.5, 3.2, 17, 11], [0xfff0dd, 10, 2.5, 6.8, 17, 11], [0xffe6c4, 17, 2.4, 5.2, 12, 11], [0xffe1b8, 4, 2.4, 8, 6, 8]];
    const lights = [];
    pts.slice(0, Q.lights).forEach(([col, x, y, z, i, d]) => { const l = new T.PointLight(col, i, d, 2); l.position.set(x, y, z); root.add(l); lights.push({ light: l, base: i }); });
    return { sun, lights, hemi };
  }

  // small furnished "room" rendered once into an image-based light: soft ceiling panels, a bright window, warm wall
  OV.makeEnv = function (renderer) {
    const s = new T.Scene(), face = (col, w, h, pos, rot) => {
      const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: col, side: T.DoubleSide }));
      m.position.set(...pos); m.rotation.set(...rot); s.add(m);
    };
    s.add(new T.Mesh(new T.BoxGeometry(14, 6, 14), new T.MeshBasicMaterial({ color: 0xa9a196, side: T.BackSide })));
    face(new T.Color().setRGB(0.42, 0.34, 0.26), 14, 14, [0, -2.98, 0], [-Math.PI / 2, 0, 0]);
    for (const x of [-3.5, 3.5]) for (const z of [-3.5, 3.5]) face(new T.Color().setRGB(13, 12, 10), 2.6, 1.1, [x, 2.95, z], [Math.PI / 2, 0, 0]);
    face(new T.Color().setRGB(8, 10.5, 14), 6, 3, [6.95, 0.4, 0], [0, -Math.PI / 2, 0]);
    face(new T.Color().setRGB(16, 12, 7.5), 3, 2.4, [-6.95, 0.4, 2.5], [0, Math.PI / 2, 0]);
    const pm = new T.PMREMGenerator(renderer), tex = pm.fromScene(s, 0.04).texture;
    pm.dispose();
    return tex;
  };

  /* ---------------- assembly ---------------- */
  OV.buildOffice = async function (Q, progress) {
    const tex = await OV.loadTextures(Q, async (m, f) => { progress && progress(m, f); await new Promise((r) => setTimeout(r, 0)); });
    if (Q.bake) { await OV.bakeTextures(tex); document.title = 'BAKED'; console.log('[office] textures baked to assets/tex/'); }
    const M = materials(tex), B = new OV.Batch(), w = B.w, r = OV.rng(42);
    progress && progress('Building rooms', 0.85); await new Promise((r2) => setTimeout(r2, 0));

    // floors + ceiling
    w.box('concrete', 6, 0.2, D, 3, -0.1, 5, { tile: 2 });
    w.box('carpet', 8, 0.2, D, 10, -0.1, 5, { tile: 2 });
    w.box('oak', 6, 0.2, D, 17, -0.1, 5, { tile: 1.2 });
    w.box('ceiling', W + 2 * WT, 0.1, D + 2 * WT, W / 2, H + 0.05, D / 2, { tile: 1.2 });
    // exterior + partition walls
    wall(B, { axis: 'x', line: -WT / 2, a: -WT, b: W + WT, thick: WT, inner: 1, sides: [1], openings: [{ a: 2.3, b: 3.7, y1: 2.4, type: 'entry' }] });
    wall(B, { axis: 'x', line: D + WT / 2, a: -WT, b: W + WT, thick: WT, inner: -1, sides: [-1], openings: [{ a: 6.7, b: 13.3, y0: 0.85, y1: 2.5, type: 'window' }] });
    wall(B, { axis: 'z', line: -WT / 2, a: -WT, b: D + WT, thick: WT, inner: 1, sides: [1], openings: [{ a: 2.6, b: 8.4, y0: 0.85, y1: 2.45, type: 'window' }] });
    wall(B, { axis: 'z', line: W + WT / 2, a: -WT, b: D + WT, thick: WT, inner: -1, sides: [-1], openings: [{ a: 2, b: 8, y0: 0.85, y1: 2.5, type: 'window' }] });
    wall(B, { axis: 'z', line: 6, a: 0, b: D, thick: PT, inner: 1, sides: [-1, 1], openings: [{ a: 4.2, b: 5.8, y1: 2.25, type: 'door' }] });
    glassPartition(B);

    reception(B, r); workspace(B, r); meeting(B, r); outside(B, r);

    const root = new T.Group(); root.name = 'office';
    const tris = B.build(M, root, FLAGS);
    const sky = new T.Mesh(new T.SphereGeometry(450, 24, 16), new T.MeshBasicMaterial({ map: tex.sky, side: T.BackSide, fog: false, depthWrite: false }));
    sky.renderOrder = -10; root.add(sky);
    const line = new T.Mesh(new T.CylinderGeometry(230, 230, 100, 64, 1, true), new T.MeshBasicMaterial({ map: tex.skyline, transparent: true, side: T.BackSide, depthWrite: false }));
    line.position.set(10, 49, 5); line.renderOrder = -5; root.add(line); // buildings fade into the haze via scene fog
    const L = addLights(root, Q);
    // things you can tap: every seat, the light switch, the meeting-room TV
    const hotspots = B.seats.map((s) => ({ kind: 'sit', seat: s, pos: new T.Vector3(s.x, s.hy, s.z), label: 'Sit down' }));
    hotspots.push({ kind: 'light', pos: new T.Vector3(4.1, 1.3, 0.14), label: 'Lights on / off' });
    hotspots.push({ kind: 'tv', pos: new T.Vector3(17, 2.3, 0.3), label: 'Next slide' });
    const slides = [tex.tv, ...OV.makeSlides()];
    return { root, sun: L.sun, lights: L.lights, hemi: L.hemi, mats: M, slides, hotspots, colliders: B.colliders, spots: OV.SPOTS, tris, bounds: { x0: 0, x1: W, z0: 0, z1: D } };
  };

  /* ---------------- A-Frame glue ---------------- */
  AFRAME.registerComponent('office-build', {
    init() {
      const el = this.el, sceneEl = el.sceneEl, Q = (OV.Q = OV.quality());
      const t0 = performance.now();
      OV.buildOffice(Q, (m, f) => OV.onProgress && OV.onProgress(m, f)).then((world) => {
        el.setObject3D('office', world.root);
        OV.world = world;
        const apply = () => {
          const rd = sceneEl.renderer;
          // A-Frame adds its own ambient + directional light when it sees none of its `light` components; ours are plain three lights
          const dropDefaults = () => document.querySelectorAll('[data-aframe-default-light]').forEach((n) => n.remove());
          dropDefaults(); sceneEl.hasLoaded || sceneEl.addEventListener('loaded', dropDefaults, { once: true });
          rd.toneMapping = T.ACESFilmicToneMapping; rd.toneMappingExposure = 1.05;
          rd.shadowMap.enabled = true; rd.shadowMap.type = T.PCFSoftShadowMap;
          sceneEl.object3D.environment = OV.makeEnv(rd);
          sceneEl.object3D.environmentIntensity = 0.65;
          sceneEl.object3D.fog = new T.Fog(0xd9d8d2, 70, 340); // only the outdoors is far enough to notice
          world.sun.shadow.needsUpdate = true;
          console.log('[office] built in', Math.round(performance.now() - t0), 'ms,', Math.round(world.tris), 'triangles');
          sceneEl.emit('office-ready');
        };
        sceneEl.renderer ? apply() : sceneEl.addEventListener('renderstart', apply, { once: true });
      });
    },
  });
})();
