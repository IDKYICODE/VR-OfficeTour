/* Geometry helpers. Everything static is collected per material and merged into
   one mesh per material, so ~30 draw calls cover the whole office (matters on a
   phone, where stereo doubles every draw call). Furniture can register collision
   boxes as it is placed. */
(function () {
  const T = AFRAME.THREE;
  const OV = (window.OV = window.OV || {});

  // box-projected UVs from world position, so one texture tiles every `tile` metres
  function worldUV(g, tile, rot) {
    const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
      if (ay >= ax && ay >= az) rot ? uv.setXY(i, p.getZ(i) / tile, p.getX(i) / tile) : uv.setXY(i, p.getX(i) / tile, p.getZ(i) / tile);
      else if (ax >= az) uv.setXY(i, p.getZ(i) / tile, p.getY(i) / tile);
      else uv.setXY(i, p.getX(i) / tile, p.getY(i) / tile);
    }
  }

  function merge(list) {
    let vc = 0, ic = 0;
    for (const g of list) { vc += g.attributes.position.count; ic += g.index ? g.index.count : g.attributes.position.count; }
    const P = new Float32Array(vc * 3), N = new Float32Array(vc * 3), U = new Float32Array(vc * 2);
    const I = vc > 65535 ? new Uint32Array(ic) : new Uint16Array(ic);
    let vo = 0, io = 0;
    for (const g of list) {
      const a = g.attributes, c = a.position.count;
      P.set(a.position.array, vo * 3); N.set(a.normal.array, vo * 3);
      if (a.uv) U.set(a.uv.array, vo * 2);
      if (g.index) for (let k = 0; k < g.index.count; k++) I[io + k] = g.index.array[k] + vo;
      else for (let k = 0; k < c; k++) I[io + k] = vo + k;
      vo += c; io += g.index ? g.index.count : c;
    }
    const m = new T.BufferGeometry();
    m.setAttribute('position', new T.BufferAttribute(P, 3));
    m.setAttribute('normal', new T.BufferAttribute(N, 3));
    m.setAttribute('uv', new T.BufferAttribute(U, 2));
    m.setIndex(new T.BufferAttribute(I, 1));
    m.computeBoundingSphere(); m.computeBoundingBox();
    return m;
  }

  // smooth rounded box (same construction as three's RoundedBoxGeometry)
  OV.rboxGeo = function (w, h, d, r, seg) {
    seg = seg || 2;
    r = Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3);
    const n = seg * 2 + 1, g = new T.BoxGeometry(1, 1, 1, n, n, n), half = 0.5 / n;
    const pos = g.attributes.position, nor = g.attributes.normal, v = new T.Vector3(), q = new T.Vector3();
    const bx = w / 2 - r, by = h / 2 - r, bz = d / 2 - r;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      q.set(v.x - Math.sign(v.x) * half, v.y - Math.sign(v.y) * half, v.z - Math.sign(v.z) * half).normalize();
      pos.setXYZ(i, Math.sign(v.x) * bx + q.x * r, Math.sign(v.y) * by + q.y * r, Math.sign(v.z) * bz + q.z * r);
      nor.setXYZ(i, q.x, q.y, q.z);
    }
    return g;
  };

  class Group {
    constructor(batch, ox, oz, ry) {
      this.b = batch; this.ox = ox; this.oz = oz; this.ry = ry || 0;
      this.M = new T.Matrix4().makeRotationY(ry || 0).setPosition(ox, 0, oz);
    }
    geo(key, g, lx, ly, lz, o) {
      o = o || {};
      if (o.rx) g.rotateX(o.rx);
      if (o.ry) g.rotateY(o.ry);
      if (o.rz) g.rotateZ(o.rz);
      g.translate(lx, ly, lz);
      g.applyMatrix4(this.M);
      this.b.add(key, g, o.tile, o.rot);
      if (o.col) this.b.colGeo(g);
      return g;
    }
    // big boxes get a vertex every ~30 cm so baked per-vertex lighting has something to interpolate
    box(key, w, h, d, lx, ly, lz, o) {
      const big = Math.max(w, h, d) > 0.45 && !this.b.noSub.has(key), sg = (v) => (big ? Math.min(40, Math.max(1, Math.ceil(v / 0.3 - 0.01))) : 1);
      return this.geo(key, new T.BoxGeometry(w, h, d, sg(w), sg(h), sg(d)), lx, ly, lz, o);
    }
    rbox(key, w, h, d, r, lx, ly, lz, o) { return this.geo(key, OV.rboxGeo(w, h, d, r, (o && o.seg) || 2), lx, ly, lz, o); }
    cyl(key, rt, rb, h, lx, ly, lz, o) { return this.geo(key, new T.CylinderGeometry(rt, rb, h, (o && o.seg) || 18), lx, ly, lz, o); }
    sph(key, r, lx, ly, lz, o) { return this.geo(key, new T.SphereGeometry(r, 14, 10), lx, ly, lz, o); }
    plane(key, w, h, lx, ly, lz, o) { return this.geo(key, new T.PlaneGeometry(w, h), lx, ly, lz, o); }
    // invisible collision rectangle in local coords
    collide(lw, ld, lx, lz) {
      const g = new T.BoxGeometry(lw, 1, ld); g.translate(lx, 0, lz); g.applyMatrix4(this.M); this.b.colGeo(g, true);
    }
  }

  class Batch {
    constructor() {
      this.map = {}; this.colliders = []; this.seats = [];
      this.noSub = new Set(['glass', 'frost', 'blob', 'aoStrip', 'led', 'ledUp', 'ledSpot', 'logo', 'logoRed', 'tvScreen', 'ground']); // never baked: keep them coarse
      this.w = this.group(0, 0, 0);
    }
    // a subdivided flat slab (floor facing up, ceiling facing down) with ~25-30 cm vertex spacing
    slab(key, x0, x1, z0, z1, y, up, tile, cell) {
      const g = new T.PlaneGeometry(x1 - x0, z1 - z0, Math.ceil((x1 - x0) / cell), Math.ceil((z1 - z0) / cell));
      g.rotateX(up ? -Math.PI / 2 : Math.PI / 2); g.translate((x0 + x1) / 2, y, (z0 + z1) / 2); this.add(key, g, tile);
    }
    group(ox, oz, ry) { return new Group(this, ox, oz, ry); }
    add(key, g, tile, rot) {
      if (tile) worldUV(g, tile, rot);
      (this.map[key] || (this.map[key] = [])).push(g);
    }
    colGeo(g, discard) {
      g.computeBoundingBox(); const b = g.boundingBox;
      this.colliders.push({ x0: b.min.x, x1: b.max.x, z0: b.min.z, z1: b.max.z });
      if (discard) g.dispose();
    }
    // soft contact shadow under furniture
    blob(cx, cz, w, d) {
      const g = new T.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); g.translate(cx, 0.004, cz); this.add('blob', g);
    }
    // ambient-occlusion strip along a floor edge: (x0,z0)->(x1,z1), growing toward (nx,nz)
    strip(x0, z0, x1, z1, nx, nz, width) {
      const pos = [x0, 0.003, z0, x1, 0.003, z1, x1 + nx * width, 0.003, z1 + nz * width, x0 + nx * width, 0.003, z0 + nz * width];
      const uv = [0, 0, 1, 0, 1, 1, 0, 1], g = new T.BufferGeometry();
      const ex = x1 - x0, ez = z1 - z0, cy = -(ex * nz - ez * nx); // sign of (edge x normal).y
      const idx = cy >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new T.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
      g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      g.setIndex(idx); this.add('aoStrip', g);
    }
    build(mats, root, flags) {
      let tris = 0;
      for (const key of Object.keys(this.map)) {
        if (!mats[key]) { console.warn('missing material', key); continue; }
        const g = merge(this.map[key]); this.map[key].forEach((x) => x.dispose());
        const f = (flags && flags[key]) || {};
        const m = new T.Mesh(g, mats[key]);
        m.name = key; m.castShadow = f.cast !== false; m.receiveShadow = f.recv !== false;
        if (f.order != null) m.renderOrder = f.order;
        m.matrixAutoUpdate = false;
        root.add(m);
        tris += g.index.count / 3;
      }
      return tris;
    }
  }
  OV.Batch = Batch;
})();
