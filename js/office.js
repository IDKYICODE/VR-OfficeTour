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
    return { mobile, tex: mobile ? 512 : 1024, shadow: mobile ? 2048 : 4096, lights: mobile ? 3 : 5, debug: qs.has('debug'), bake: qs.has('bake'), gen: qs.has('gen') || qs.has('bake'), lightbake: qs.has('lightbake') ? (qs.get('lightbake') === 'quick' ? 'quick' : 'full') : null };
  };

  /* ---------------- materials ---------------- */
  function materials(tex, Q) {
    const S = (o) => new T.MeshStandardMaterial(o);
    const Bm = (o) => new T.MeshBasicMaterial(o);
    // clear-coat and fabric sheen look great but cost extra per pixel: desktop only (?q=high forces them, ?q=low removes them)
    const P = (o) => {
      if (!Q.mobile) return new T.MeshPhysicalMaterial(o);
      const c = Object.assign({}, o); ['clearcoat', 'clearcoatRoughness', 'sheen', 'sheenRoughness', 'sheenColor'].forEach((k) => delete c[k]); return S(c);
    };
    const nrm = (t, k) => ({ normalMap: t, normalScale: new T.Vector2(k, k) });
    const fab = (color) => P({ color, map: tex.weave, ...nrm(tex.weaveNormal, 1), roughness: 0.95, sheen: 0.8, sheenRoughness: 0.5, sheenColor: new T.Color(0xffffff) });
    const M = {
      plaster: S({ color: 0xf1ede6, roughness: 0.94, ...nrm(tex.plasterNormal, 0.7) }),
      teal: S({ color: 0x1d5a60, roughness: 0.88, ...nrm(tex.plasterNormal, 0.7) }),      // reception sign wall: light grey
      terra: S({ color: 0xa9503a, roughness: 0.88, ...nrm(tex.plasterNormal, 0.7) }),     // meeting-room TV wall + small accents: warm-neutral grey
      trim: S({ color: 0xfbfaf7, roughness: 0.42 }),
      frame: S({ color: 0x14161a, roughness: 0.45, metalness: 0.6 }),
      red: S({ color: 0xe0282c, roughness: 0.45 }),
      concrete: S({ map: tex.concrete, ...nrm(tex.concreteNormal, 1), roughnessMap: tex.concreteRough, roughness: 1 }),
      carpet: S({ map: tex.carpet, ...nrm(tex.carpetNormal, 1.3), roughness: 1 }),
      oak: S({ map: tex.oak, ...nrm(tex.oakNormal, 0.9), roughnessMap: tex.oakRough, roughness: 1 }),
      ceiling: S({ map: tex.ceil, ...nrm(tex.ceilNormal, 0.12), roughness: 0.8 }), // smooth painted plaster
      rug: S({ color: 0xd2b08c, map: tex.weave, ...nrm(tex.weaveNormal, 1.4), roughness: 1 }),
      ground: S({ color: 0x3b3e42, roughness: 1 }),
      metal: S({ color: 0x2a2c30, metalness: 0.85, roughness: 0.38 }),
      chrome: S({ color: 0xd5d8dc, metalness: 1, roughness: 0.2 }),
      black: S({ color: 0x111114, roughness: 0.5, metalness: 0.1 }),
      kb: S({ color: 0x3b3e44, roughness: 0.6 }),
      white: S({ color: 0xeeeeea, roughness: 0.4 }),
      stone: P({ color: 0xe8e6e0, roughness: 0.16, clearcoat: 0.6, clearcoatRoughness: 0.08 }),
      walnut: P({ color: 0xffffff, map: tex.walnut, ...nrm(tex.walnutNormal, 0.8), roughnessMap: tex.walnutRough, roughness: 1, clearcoat: 0.5, clearcoatRoughness: 0.14 }),
      woodDesk: P({ color: 0xffffff, map: tex.oakF, ...nrm(tex.oakFNormal, 0.8), roughnessMap: tex.oakFRough, roughness: 1, clearcoat: 0.35, clearcoatRoughness: 0.2 }),
      cabinet: S({ color: 0xe6e4de, roughness: 0.5 }),
      cabinetG: S({ color: 0x8fa397, roughness: 0.5 }),
      fabA: fab(0x3a4756), fabE: fab(0x30343a), fabC: fab(0xd8cfc0), fabD: fab(0xa9503a),
      pot: S({ color: 0xf1efe9, roughness: 0.35 }),
      soil: S({ color: 0x2a1d15, roughness: 1 }),
      leafA: S({ color: 0x2f5e34, map: tex.leaf, roughness: 0.5, side: T.DoubleSide }),
      leafB: S({ color: 0x4d7d3b, map: tex.leaf, roughness: 0.5, side: T.DoubleSide }),
      led: Bm({ color: new T.Color().setRGB(1, 0.93, 0.8) }),
      ledUp: Bm({ color: new T.Color().setRGB(1, 0.93, 0.8) }),      // cove / up-light strips (light the ceiling)
      ledSpot: Bm({ color: new T.Color().setRGB(1.1, 0.98, 0.85) }), // recessed downlight lenses
      alu: S({ color: 0xc7cbd1, metalness: 0.9, roughness: 0.3 }),
      brass: S({ color: 0xc9a45c, metalness: 1, roughness: 0.28, side: T.DoubleSide }),
      opal: S({ color: 0xfffaf0, emissive: 0xfff0d8, emissiveIntensity: 0.9, roughness: 0.25 }),
      drum: S({ color: 0xf3e6cf, emissive: 0xffd49a, emissiveIntensity: 0.85, roughness: 0.9, side: T.DoubleSide }),
      bin: S({ color: 0x3a4046, metalness: 0.7, roughness: 0.4, side: T.DoubleSide }),
      glass: S({ color: 0xcfe6ee, roughness: 0.04, transparent: true, opacity: 0.13, side: T.DoubleSide, depthWrite: false }),
      frost: S({ color: 0xffffff, roughness: 0.6, transparent: true, opacity: 0.5, side: T.DoubleSide, depthWrite: false }),
      logo: Bm({ map: tex.logo, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
      logoRed: Bm({ map: tex.logoRed, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
      tvScreen: Bm({ map: tex.tv }),
      blob: Bm({ map: tex.blob, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
      aoStrip: Bm({ map: tex.aoStrip, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    };
    M.carpet.color.setRGB(1.4, 1.4, 1.45); // baked carpet texture is dark; lift it
    OV.patchMaterial(M.leafA, { sway: true }); OV.patchMaterial(M.leafB, { sway: true }); // foliage moves in the wind
    for (let i = 0; i < 3; i++) { M['screen' + i] = Bm({ map: tex['screen' + i] }); M['art' + i] = S({ map: tex['art' + i], roughness: 0.8 }); }
    return M;
  }
  const NOSHADOW = { cast: false, recv: false };
  const FLAGS = {
    blob: NOSHADOW, aoStrip: NOSHADOW, led: NOSHADOW, ledUp: NOSHADOW, ledSpot: NOSHADOW, logo: NOSHADOW, logoRed: NOSHADOW, tvScreen: NOSHADOW,
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
    if (k % 4 === 0) deskLamp(d, 0.62, -0.18); else if (r() > 0.4) d.cyl('pot', 0.04, 0.035, 0.09, -0.55, 0.785, 0.0, { seg: 12 });
    if (r() > 0.5) d.box('white', 0.2, 0.012, 0.28, -0.5, 0.746, 0.18, { ry: 0.25 });
    B.blob(xc, dz, 1.75, 1.05);
    officeChair(B.group(xc, zc + side * 1.25, side < 0 ? 0 : Math.PI), k % 2 ? 'fabA' : 'fabE');
    B.blob(xc, zc + side * 1.25, 0.9, 0.9);
  }

  /* ---------------- ceiling + light fixtures ---------------- */
  const cableTo = (g, x, z, yLow) => g.box('alu', 0.005, H - yLow, 0.005, x, (H + yLow) / 2, z);
  function domeGeo(r, hgt) { // spun dome shade: rim at y = 0, apex at y = hgt
    const pts = [[r, 0], [r * 0.985, 0.012], [r * 0.9, hgt * 0.35], [r * 0.7, hgt * 0.68], [r * 0.4, hgt * 0.9], [r * 0.12, hgt * 0.985], [0.001, hgt]].map((p) => new T.Vector2(p[0], p[1]));
    return new T.LatheGeometry(pts, 40);
  }
  // brushed-brass dome pendant with a glowing underside (meeting table)
  function domePendant(B, x, z, y, r) {
    const g = B.group(x, z, 0), hh = r * 0.7;
    cableTo(g, 0, 0, y + hh); g.cyl('alu', 0.045, 0.045, 0.02, 0, H - 0.01, 0, { seg: 16 });
    g.geo('brass', domeGeo(r, hh), 0, y, 0);
    g.cyl('led', r * 0.8, r * 0.8, 0.006, 0, y + 0.02, 0, { seg: 28 });
  }
  // three opal globes at different heights (lounge)
  function globeCluster(B, x, z, y) {
    const g = B.group(x, z, 0);
    [[-0.22, 0, 0.15, y + 0.05], [0.18, 0.1, 0.12, y - 0.25], [0.02, -0.16, 0.1, y - 0.5]].forEach(([ox, oz, r, gy]) => {
      g.geo('opal', new T.SphereGeometry(r, 28, 18), ox, gy, oz);
      cableTo(g, ox, oz, gy + r); g.cyl('alu', 0.02, 0.02, 0.015, ox, H - 0.0075, oz, { seg: 12 });
    });
  }
  // slim aluminium linear pendant over each pod: diffuser below, up-light above
  function linearPendant(B, x, z, y) {
    const g = B.group(x, z, 0);
    g.rbox('alu', 1.6, 0.05, 0.09, 0.02, 0, y, 0);
    g.box('led', 1.5, 0.006, 0.06, 0, y - 0.028, 0);
    g.box('ledUp', 1.5, 0.006, 0.05, 0, y + 0.028, 0);
    for (const sx of [-0.65, 0.65]) { cableTo(g, sx, 0, y + 0.025); g.cyl('alu', 0.025, 0.025, 0.012, sx, H - 0.006, 0, { seg: 12 }); }
  }
  // recessed round downlight with a metal trim ring
  function downlight(B, x, z) {
    B.w.cyl('chrome', 0.095, 0.095, 0.012, x, H - 0.006, z, { seg: 24 });
    B.w.cyl('ledSpot', 0.072, 0.072, 0.004, x, H - 0.0135, z, { seg: 24 });
  }
  // flush linear slot light
  function slotLight(B, x, z, len) {
    B.w.box('alu', len + 0.05, 0.008, 0.09, x, H - 0.004, z);
    B.w.box('led', len, 0.006, 0.06, x, H - 0.0095, z);
  }
  // lit perimeter cove: a shallow soffit round the room with a shelf + up-light strip hidden behind it
  function cove(B, x0, x1, z0, z1) {
    const w = B.w, d = 0.4, h = 0.22, sh = 0.16, y = H - h / 2, ys = H - h + 0.012, T2 = { tile: 2.4 };
    w.box('ceiling', x1 - x0, h, d, (x0 + x1) / 2, y, z0 + d / 2, T2); w.box('ceiling', x1 - x0, h, d, (x0 + x1) / 2, y, z1 - d / 2, T2);
    w.box('ceiling', d, h, z1 - z0 - 2 * d, x0 + d / 2, y, (z0 + z1) / 2, T2); w.box('ceiling', d, h, z1 - z0 - 2 * d, x1 - d / 2, y, (z0 + z1) / 2, T2);
    const lx = x1 - x0 - 2 * d - 0.3, lz = z1 - z0 - 2 * d - 0.3, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    // shelves + strips (strip sits just in front of the soffit face, pointing up at the ceiling)
    w.box('alu', lx, 0.012, sh, cx, ys - 0.006, z0 + d + sh / 2); w.box('ledUp', lx, 0.01, 0.03, cx, ys + 0.004, z0 + d + 0.045);
    w.box('alu', lx, 0.012, sh, cx, ys - 0.006, z1 - d - sh / 2); w.box('ledUp', lx, 0.01, 0.03, cx, ys + 0.004, z1 - d - 0.045);
    w.box('alu', sh, 0.012, lz, x0 + d + sh / 2, ys - 0.006, cz); w.box('ledUp', 0.03, 0.01, lz, x0 + d + 0.045, ys + 0.004, cz);
    w.box('alu', sh, 0.012, lz, x1 - d - sh / 2, ys - 0.006, cz); w.box('ledUp', 0.03, 0.01, lz, x1 - d - 0.045, ys + 0.004, cz);
  }
  // arc floor lamp: marble base, slim stem, a long arc and a brass dome over the sofa end (local +z)
  function arcLamp(B, x, z) {
    const g = B.group(x, z, 0);
    g.cyl('stone', 0.2, 0.2, 0.04, 0, 0.02, 0, { seg: 28 }); g.cyl('alu', 0.012, 0.012, 1.5, 0, 0.78, 0, { seg: 10 });
    const curve = new T.QuadraticBezierCurve3(new T.Vector3(0, 1.52, 0), new T.Vector3(0, 2.25, 0.35), new T.Vector3(0, 1.9, 1.0));
    g.geo('alu', new T.TubeGeometry(curve, 24, 0.012, 8, false), 0, 0, 0);
    g.geo('brass', domeGeo(0.17, 0.12), 0, 1.78, 1.0); g.cyl('led', 0.13, 0.13, 0.005, 0, 1.8, 1.0, { seg: 20 });
    g.collide(0.42, 0.42, 0, 0); B.blob(x, z, 0.6, 0.6);
  }
  function tableLamp(g, lx, ly, lz) { // ceramic base, warm drum shade
    g.cyl('pot', 0.06, 0.09, 0.26, lx, ly + 0.13, lz, { seg: 18 }); g.cyl('alu', 0.012, 0.012, 0.12, lx, ly + 0.32, lz, { seg: 8 });
    g.geo('drum', new T.CylinderGeometry(0.15, 0.19, 0.2, 28, 1, true), lx, ly + 0.46, lz);
  }
  function deskLamp(g, lx, lz) { // articulated task lamp
    g.cyl('alu', 0.06, 0.065, 0.015, lx, 0.7475, lz, { seg: 16 });
    g.box('alu', 0.008, 0.32, 0.008, lx, 0.91, lz, { rx: 0.28 }); g.box('alu', 0.008, 0.26, 0.008, lx, 1.08, lz + 0.09, { rx: -0.6 });
    g.geo('alu', new T.CylinderGeometry(0.02, 0.07, 0.09, 18, 1, true), lx, 1.17, lz + 0.18, { rx: 0.5 });
    g.cyl('led', 0.045, 0.045, 0.004, lx, 1.13, lz + 0.2, { seg: 14, rx: 0.5 });
  }
  function artwork(g, key, w, h, lx, ly, lz) {
    g.box('frame', w + 0.06, h + 0.06, 0.035, lx, ly, lz + 0.018);
    g.plane(key, w, h, lx, ly, lz + 0.0365);
  }

  /* ---------------- rooms ---------------- */
  function reception(B, r) {
    const w = B.w;
    // accent wall + logo
    w.box('trim', 6, H, 0.03, 3, H / 2, D - 0.015); // clean white sign wall
    w.plane('logoRed', 2.6, 1.34, 3.0, 1.85, D - 0.034, { ry: Math.PI }); // red IICL letters on the white wall
    // reception desk (visitors approach from the north)
    const rd = B.group(3.0, 7.9, Math.PI);
    rd.box('walnut', 3.4, 0.95, 0.05, 0, 0.475, 0.39);
    for (let i = 0; i < 46; i++) rd.box('walnut', 0.05, 0.95, 0.05, -1.65 + i * 0.0735, 0.475, 0.43);
    rd.rbox('stone', 3.6, 0.05, 1.0, 0.015, 0, 1.045, 0, { col: true });
    rd.box('white', 1.3, 0.62, 0.012, 0, 0.52, 0.461); rd.plane('logoRed', 1.1, 0.567, 0, 0.52, 0.468); // IICL front-desk sign
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
    globeCluster(B, 4.0, 2.4, 1.95);
    // light switch by the entrance
    w.box('trim', 0.09, 0.13, 0.015, 4.1, 1.3, 0.0075); w.box('black', 0.03, 0.05, 0.012, 4.1, 1.3, 0.021);
    // art + plants
    artwork(B.group(5.925, 2.4, -Math.PI / 2), 'art0', 1.2, 1.5, 0, 1.75, 0);
    artwork(B.group(5.0, 0, 0), 'art1', 0.9, 1.1, 0, 1.6, 0);
    plant(B, 0.55, 0.6, 1.5, 11, 'pot'); plant(B, 5.45, 9.3, 1.3, 12, 'pot'); plant(B, 0.6, 9.3, 1.2, 13, 'pot');
    // paper-toss bin against the north wall (mouth at y 0.5, radius 0.2)
    const bn = B.group(1.35, 0.4, 0);
    const prof = [[0.001, 0], [0.16, 0], [0.2, 0.5], [0.216, 0.505], [0.2, 0.514], [0.188, 0.5], [0.152, 0.025], [0.001, 0.025]].map((p) => new T.Vector2(p[0], p[1]));
    bn.geo('bin', new T.LatheGeometry(prof, 28), 0, 0, 0); bn.collide(0.46, 0.46, 0, 0);
    B.blob(1.35, 0.4, 0.8, 0.8);
    // ceiling downlights
    [[1.6, 1.8], [4.4, 1.0], [1.6, 5.2], [4.4, 5.6], [3, 7.1], [1.6, 8.4], [4.4, 8.4]].forEach(([x, z]) => downlight(B, x, z));
    cove(B, 0, 5.925, 0, D); arcLamp(B, 5.55, 0.62); tableLamp(cr, 1.05, 0.78, 0);
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
      linearPendant(B, xc, zc, 2.35);
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
    // drawable whiteboard on the north wall above the low cabinets; wall art + clock on the west partition
    const wb = B.group(11.6, 0, 0);
    wb.box('frame', 1.9, 1.2, 0.04, 0, 1.5, 0.02); wb.box('board1', 1.8, 1.1, 0.02, 0, 1.5, 0.032);
    artwork(B.group(6.075, 8.6, Math.PI / 2), 'art2', 0.9, 1.1, 0, 1.6, 0);
    const ck = B.group(6.075, 3.5, Math.PI / 2); // face + ticks are static; the hands are separate meshes (see buildOffice)
    ck.cyl('frame', 0.215, 0.215, 0.03, 0, 2.15, 0.015, { rx: Math.PI / 2, seg: 32 });
    ck.cyl('white', 0.2, 0.2, 0.032, 0, 2.15, 0.016, { rx: Math.PI / 2, seg: 32 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ck.box('black', i % 3 ? 0.008 : 0.014, i % 3 ? 0.025 : 0.04, 0.006, Math.sin(a) * 0.165, 2.15 + Math.cos(a) * 0.165, 0.034, { rz: -a });
    }
    // ceiling panels along the corridor
    [7.5, 10, 12.5].forEach((x) => slotLight(B, x, 5, 1.2)); cove(B, 6.075, 13.97, 0, D);
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
    [4.0, 5.2, 6.4].forEach((z) => domePendant(B, 17, z, 1.95, 0.3));
    // TV wall
    const tv = B.group(17, 0, 0);
    tv.rbox('black', 1.7, 0.98, 0.05, 0.01, 0, 1.6, 0.04); tv.plane('tvScreen', 1.62, 0.912, 0, 1.6, 0.0655);
    tv.rbox('walnut', 2.6, 0.55, 0.4, 0.012, 0, 0.275, 0.22, { col: true }); tv.box('black', 0.5, 0.06, 0.25, 0.5, 0.58, 0.2);
    B.blob(17, 0.25, 3.0, 1.0);
    w.plane('logo', 0.97, 0.5, 17, 2.4, 0.034); // logo above the TV (under the cove soffit)
    // south wall: whiteboard + credenza
    const wb = B.group(17, D, Math.PI);
    wb.box('frame', 2.5, 1.3, 0.04, 0, 1.55, 0.02); wb.box('board0', 2.4, 1.2, 0.02, 0, 1.55, 0.032);
    wb.box('metal', 2.4, 0.03, 0.07, 0, 0.93, 0.05); // pen tray
    const cr = B.group(17, 9.75, Math.PI); cr.rbox('walnut', 2.4, 0.75, 0.4, 0.012, 0, 0.375, 0, { col: true, tile: 0.8 });
    cr.box('chrome', 0.3, 0.015, 0.015, -0.6, 0.55, 0.205); cr.box('chrome', 0.3, 0.015, 0.015, 0.6, 0.55, 0.205);
    cr.cyl('pot', 0.1, 0.07, 0.28, 0.9, 0.89, 0, { seg: 14 }); cr.box('cabinet', 0.4, 0.1, 0.28, -0.8, 0.8, 0);
    B.blob(17, 9.75, 2.7, 0.9);
    artwork(B.group(15.2, 0, 0), 'art1', 0.7, 0.9, 0, 1.6, 0);
    plant(B, 19.4, 0.8, 1.5, 31, 'pot'); plant(B, 19.4, 9.2, 1.4, 32, 'pot');
    cove(B, 14.03, W, 0, D);
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

  /* ---------------- drawable boards ---------------- */
  function makeBoard(title, w, h, center, normalZ, stand, ry) {
    const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round((1024 * h) / w);
    const x = c.getContext('2d');
    x.fillStyle = '#fbfbf9'; x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = '#a3abaf'; x.font = '600 34px Helvetica, Arial, sans-serif'; x.fillText(title, 40, 66);
    [['#f7e7a6', 60, 130], ['#cfe5e7', 330, 150], ['#f4cdbd', 600, 126]].forEach(([col, px, py]) => {
      x.save(); x.translate(px, py); x.rotate((px % 7) * 0.006 - 0.02); x.fillStyle = col; x.fillRect(0, 0, 220, 190);
      x.fillStyle = 'rgba(40,50,55,0.35)'; for (let k = 0; k < 4; k++) x.fillRect(22, 36 + k * 34, 120 + ((k * 37) % 70), 8); x.restore();
    });
    const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 8;
    const plane = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ visible: false }));
    plane.position.copy(center); plane.rotation.y = ry; plane.updateMatrixWorld(true);
    return { canvas: c, tex, w, h, center, normal: new T.Vector3(0, 0, normalZ), xAxis: new T.Vector3(normalZ > 0 ? 1 : -1, 0, 0), stand, plane };
  }

  /* ---------------- assembly ---------------- */
  OV.buildOffice = async function (Q, progress) {
    const tex = await OV.loadTextures(Q, async (m, f) => { progress && progress(m, f); await new Promise((r) => setTimeout(r, 0)); });
    if (Q.bake) { await OV.bakeTextures(tex); document.title = 'BAKED'; console.log('[office] textures baked to assets/tex/'); }
    const M = materials(tex, Q), B = new OV.Batch(), w = B.w, r = OV.rng(42);
    const boards = [
      makeBoard('Sprint board', 2.4, 1.2, new T.Vector3(17, 1.55, D - 0.043), -1, { x: 17, z: 8.15, yaw: 180 }, Math.PI),
      makeBoard('Team notes', 1.8, 1.1, new T.Vector3(11.6, 1.5, 0.043), 1, { x: 11.6, z: 1.25, yaw: 0 }, 0),
    ];
    boards.forEach((b, i) => (M['board' + i] = new T.MeshStandardMaterial({ map: b.tex, roughness: 0.18 })));
    progress && progress('Building rooms', 0.85); await new Promise((r2) => setTimeout(r2, 0));

    // floors + ceiling
    B.slab('concrete', 0, 6, 0, D, 0, true, 2, 0.25);
    B.slab('carpet', 6, 14, 0, D, 0, true, 2, 0.25);
    B.slab('oak', 14, W, 0, D, 0, true, 1.2, 0.25);
    B.slab('ceiling', -WT, W + WT, -WT, D + WT, H, false, 2.4, 0.3);
    // exterior + partition walls
    wall(B, { axis: 'x', line: -WT / 2, a: -WT, b: W + WT, thick: WT, inner: 1, sides: [1], openings: [{ a: 2.3, b: 3.7, y1: 2.4, type: 'entry' }] });
    wall(B, { axis: 'x', line: D + WT / 2, a: -WT, b: W + WT, thick: WT, inner: -1, sides: [-1], openings: [{ a: 6.7, b: 13.3, y0: 0.85, y1: 2.5, type: 'window' }] });
    wall(B, { axis: 'z', line: -WT / 2, a: -WT, b: D + WT, thick: WT, inner: 1, sides: [1], openings: [{ a: 2.6, b: 8.4, y0: 0.85, y1: 2.45, type: 'window' }] });
    wall(B, { axis: 'z', line: W + WT / 2, a: -WT, b: D + WT, thick: WT, inner: -1, sides: [-1], openings: [{ a: 2, b: 8, y0: 0.85, y1: 2.5, type: 'window' }] });
    wall(B, { axis: 'z', line: 6, a: 0, b: D, thick: PT, inner: 1, sides: [-1, 1], openings: [{ a: 4.2, b: 5.8, y1: 2.25, type: 'door' }] });
    glassPartition(B);

    reception(B, r); workspace(B, r); meeting(B, r); outside(B, r);

    const emitters = OV.collectEmitters(B); // lamp positions, read before the pieces are merged
    const root = new T.Group(); root.name = 'office';
    const tris = B.build(M, root, FLAGS);
    const sky = new T.Mesh(new T.SphereGeometry(450, 24, 16), new T.MeshBasicMaterial({ map: tex.sky, side: T.BackSide, fog: false, depthWrite: false }));
    sky.renderOrder = -10; root.add(sky);
    const line = new T.Mesh(new T.CylinderGeometry(230, 230, 100, 64, 1, true), new T.MeshBasicMaterial({ map: tex.skyline, transparent: true, side: T.BackSide, depthWrite: false }));
    line.position.set(10, 49, 5); line.renderOrder = -5; root.add(line); // buildings fade into the haze via scene fog
    const clouds = new T.Mesh(new T.SphereGeometry(440, 32, 16), new T.MeshBasicMaterial({ map: tex.clouds, transparent: true, side: T.BackSide, depthWrite: false, fog: false }));
    clouds.renderOrder = -9; root.add(clouds);
    boards.forEach((b) => root.add(b.plane));
    // clock hands: separate meshes on a pivot so they can turn (real local time, see life.js)
    const pivot = new T.Group(); pivot.position.set(6.075 + 0.04, 2.15, 3.5); pivot.rotation.y = Math.PI / 2; root.add(pivot);
    const hand = (len, wid, col, z) => {
      const g = new T.Group(); const m = new T.Mesh(new T.BoxGeometry(wid, len, 0.004), new T.MeshStandardMaterial({ color: col, roughness: 0.5 }));
      m.position.y = len / 2 - len * 0.1; m.position.z = z; g.add(m); pivot.add(g); return g;
    };
    const clock = { hour: hand(0.09, 0.012, 0x111114, 0.002), min: hand(0.14, 0.008, 0x111114, 0.006), sec: hand(0.16, 0.003, 0xb4573b, 0.01) };
    const L = addLights(root, Q);
    if (Q.lightbake) { // dev: compute and save the baked lighting, then carry on and show the result
      const opts = Q.lightbake === 'quick' ? { n1: 16, m: 12, iters: 1 } : {};
      const res = await OV.bakeLighting(root, emitters, opts, (m, f) => progress && progress('Baking light: ' + m, f));
      await OV.saveBake(res); document.title = 'LIGHTBAKED'; console.log('[office] lighting baked in', res.meta.seconds, 's');
    }
    // baked lighting replaces the hemisphere + point lights (the sun stays live); falls back to them if the file is missing or stale
    const baked = await OV.loadBake(root, M);
    if (baked) { L.lights.forEach((l) => root.remove(l.light)); L.lights.length = 0; root.remove(L.hemi); }
    console.log('[office] lighting:', baked ? 'baked' : 'realtime fallback');
    // things you can tap: every seat, the light switch, the meeting-room TV
    const hotspots = B.seats.map((s) => ({ kind: 'sit', seat: s, pos: new T.Vector3(s.x, s.hy, s.z), label: 'Sit down' }));
    hotspots.push({ kind: 'light', pos: new T.Vector3(4.1, 1.3, 0.14), label: 'Lights on / off' });
    hotspots.push({ kind: 'tv', pos: new T.Vector3(17, 2.3, 0.3), label: 'Next slide' });
    hotspots.push({ kind: 'draw', board: 0, pos: new T.Vector3(17, 2.4, D - 0.1), label: 'Draw on the board' });
    hotspots.push({ kind: 'draw', board: 1, pos: new T.Vector3(11.6, 2.4, 0.12), label: 'Draw on the board' });
    hotspots.push({ kind: 'toss', pos: new T.Vector3(1.5, 1.05, 3.3), label: 'Paper toss' });
    const slides = [tex.tv, ...OV.makeSlides()];
    const game = { bin: { x: 1.35, z: 0.4, r: 0.2, h: 0.5 }, spot: { x: 1.5, z: 3.3, yaw: 0 } };
    return { root, baked, sun: L.sun, lights: L.lights, hemi: L.hemi, mats: M, slides, hotspots, boards, game, clock, clouds, colliders: B.colliders, spots: OV.SPOTS, tris, bounds: { x0: 0, x1: W, z0: 0, z1: D } };
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
