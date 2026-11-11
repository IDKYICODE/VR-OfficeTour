/* Navigation: walk with stick / keys (relative to where you look), slide along
   walls, gaze-and-confirm teleport with a fade, comfort vignette while moving.
   Inputs: Bluetooth gamepad axes, d-pad, WASD/arrows, Enter/Space, tap/click.
   Add ?debug to the URL to see what the remote actually sends. */
(function () {
  const T = AFRAME.THREE;
  const OV = (window.OV = window.OV || {});
  const R = 0.26;        // body radius, m
  const SPEED = 1.5;     // walking speed, m/s (constant; no acceleration spikes)
  const DEAD = 0.18;

  function radial(inner, outer, a) { // transparent centre -> black rim
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 64 * inner, 64, 64, 64 * outer);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${a})`);
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    return new T.CanvasTexture(c);
  }
  function label(text) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = 'rgba(14,18,20,0.72)'; x.beginPath(); x.roundRect(8, 24, 496, 80, 40); x.fill();
    x.fillStyle = '#f6f1e7'; x.font = '600 44px Helvetica, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, 256, 66);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
  }
  function beamTex() {
    const c = document.createElement('canvas'); c.width = 4; c.height = 64;
    const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0.9)');
    x.fillStyle = g; x.fillRect(0, 0, 4, 64); return new T.CanvasTexture(c);
  }

  AFRAME.registerComponent('office-nav', {
    init() {
      this.keys = {}; this.vel = new T.Vector2(); this.fade = 0; this.fadeDir = 0; this.pending = -1;
      this.prevConfirm = false; this.target = -1; this.vig = 0; this.ready = false;
      this._q = new T.Quaternion(); this._f = new T.Vector3(); this._o = new T.Vector3(); this._e = new T.Euler();
      this._ray = new T.Raycaster(); this.cam = document.getElementById('cam');
      const isConfirm = (c) => c === 'Enter' || c === 'Space' || c === 'NumpadEnter' || c === 'KeyE';
      window.addEventListener('keydown', (e) => {
        this.keys[e.code] = true; this.lastKey = e.code + (e.key ? ' / ' + e.key : '');
        if (!this.ready) return;
        if (e.repeat) return;
        if (isConfirm(e.code)) this.confirm();
        const m = /^Digit([1-9])$/.exec(e.code); if (m) this.go(+m[1] - 1);
        if (/^Arrow|Space/.test(e.code)) e.preventDefault();
      });
      window.addEventListener('keyup', (e) => (this.keys[e.code] = false));
      window.addEventListener('blur', () => (this.keys = {}));
      // in the headset the touch button on the shell sends a click: confirm the gazed ring. Outside VR taps pick directly (see tap()).
      window.addEventListener('click', (e) => { if (this.ready && this.el.sceneEl.is('vr-mode') && !e.target.closest('#hud')) this.confirm(); });
      this.touchUI = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || /[?&]touch/.test(location.search);
      if (this.touchUI) document.body.classList.add('touch');
      this.touch = { x: 0, y: 0 }; this._ndc = new T.Vector2();
      const sceneEl = this.el.sceneEl;
      sceneEl.addEventListener('enter-vr', () => document.body.classList.add('vr'));
      sceneEl.addEventListener('exit-vr', () => document.body.classList.remove('vr'));
      OV.world ? this.setup() : sceneEl.addEventListener('office-ready', () => this.setup(), { once: true });
      OV.nav = this;
    },

    setup() {
      const world = (this.world = OV.world), sceneEl = this.el.sceneEl, cam = this.cam.object3D;
      // overlays that live on the camera: fade-to-black, comfort vignette, gaze reticle
      const ov = (geo, mat, z, order) => { const m = new T.Mesh(geo, mat); m.position.z = z; m.renderOrder = order; m.frustumCulled = false; cam.add(m); return m; };
      const base = { transparent: true, depthTest: false, depthWrite: false, fog: false };
      this.fadeMat = new T.MeshBasicMaterial({ ...base, color: 0x000000, opacity: 0 });
      this.fadeMesh = ov(new T.PlaneGeometry(3, 3), this.fadeMat, -0.2, 1000); this.fadeMesh.visible = false;
      this.vigMat = new T.MeshBasicMaterial({ ...base, map: radial(0.5, 1.0, 0.92), opacity: 0 });
      this.vigMesh = ov(new T.PlaneGeometry(0.9, 0.9), this.vigMat, -0.25, 999); this.vigMesh.visible = false;
      this.retMat = new T.MeshBasicMaterial({ ...base, color: 0xffffff, opacity: 0.85 });
      this.ret = ov(new T.RingGeometry(0.007, 0.011, 32), this.retMat, -1, 998);

      // teleport markers
      this.markers = new T.Group(); const beam = beamTex(); this.hits = [];
      world.spots.forEach((s, i) => {
        const g = new T.Group(); g.position.set(s.x, 0, s.z);
        const ringMat = new T.MeshBasicMaterial({ color: 0xffe3b8, transparent: true, opacity: 0.9, depthWrite: false });
        const ring = new T.Mesh(new T.RingGeometry(0.3, 0.36, 48).rotateX(-Math.PI / 2), ringMat); ring.position.y = 0.025;
        const disc = new T.Mesh(new T.CircleGeometry(0.3, 40).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: 0xffe3b8, transparent: true, opacity: 0.16, depthWrite: false })); disc.position.y = 0.022;
        const bm = new T.MeshBasicMaterial({ map: beam, color: 0xffd9a6, transparent: true, opacity: 0.2, depthWrite: false, side: T.DoubleSide });
        const bc = new T.Mesh(new T.CylinderGeometry(0.16, 0.3, 1.3, 24, 1, true), bm); bc.position.y = 0.66;
        const sp = new T.Sprite(new T.SpriteMaterial({ map: label(s.name), transparent: true, depthWrite: false, fog: false }));
        sp.scale.set(0.8, 0.2, 1); sp.position.y = 1.5;
        // pick targets: a flat disc on the floor (rings in a line of sight don't block each other), a thin pole, and the label
        const inv = new T.MeshBasicMaterial({ visible: false });
        const hitDisc = new T.Mesh(new T.CircleGeometry(0.6, 20).rotateX(-Math.PI / 2), inv); hitDisc.position.y = 0.03;
        const hitPole = new T.Mesh(new T.CylinderGeometry(0.22, 0.22, 1.6, 10), inv); hitPole.position.y = 0.8;
        hitDisc.userData.i = hitPole.userData.i = sp.userData.i = i;
        g.add(disc, ring, bc, sp, hitDisc, hitPole); this.markers.add(g); this.hits.push(hitDisc, hitPole, sp);
        g.userData = { ring, ringMat, beamMat: bm, sp, s };
      });
      sceneEl.object3D.add(this.markers);

      // HUD buttons for non-VR use
      const box = document.getElementById('spots');
      if (box) { box.innerHTML = ''; world.spots.forEach((s, i) => { const b = document.createElement('button'); b.textContent = (i + 1) + '  ' + s.name; b.onclick = () => this.go(i); box.appendChild(b); }); }

      this._ray.camera = this.cam.getObject3D('camera'); // sprites need it for picking
      this.setupTouch(sceneEl);

      if (OV.Q && OV.Q.debug) { this.dbg = document.createElement('pre'); this.dbg.id = 'dbg'; document.body.appendChild(this.dbg); }
      this.place(world.spots[0]);
      this.ready = true;
      document.body.classList.add('ready');
      sceneEl.emit('nav-ready');
    },

    // phone / mouse without a headset: on-screen joystick walks, a tap on a ring teleports, dragging looks (look-controls)
    setupTouch(sceneEl) {
      const hint = document.getElementById('hint');
      if (this.touchUI && hint) hint.textContent = 'Drag to look · left joystick to walk · tap a ring or a place name to teleport';
      const stick = document.getElementById('stick');
      if (stick) {
        const knob = stick.firstElementChild, RR = 44; let id = null;
        const set = (e) => {
          const b = stick.getBoundingClientRect();
          let dx = e.clientX - (b.left + b.width / 2), dy = e.clientY - (b.top + b.height / 2);
          const d = Math.hypot(dx, dy); if (d > RR) { dx *= RR / d; dy *= RR / d; }
          knob.style.setProperty('--x', dx + 'px'); knob.style.setProperty('--y', dy + 'px');
          this.touch.x = dx / RR; this.touch.y = dy / RR;
        };
        const end = (e) => {
          if (e.pointerId !== id) return;
          id = null; this.touch.x = this.touch.y = 0; knob.style.setProperty('--x', '0px'); knob.style.setProperty('--y', '0px');
        };
        stick.addEventListener('pointerdown', (e) => { id = e.pointerId; try { stick.setPointerCapture(id); } catch (_) {} set(e); e.preventDefault(); });
        stick.addEventListener('pointermove', (e) => { if (e.pointerId === id) set(e); });
        stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
      }
      const cv = sceneEl.canvas; let down = null;
      cv.style.touchAction = 'none';
      cv.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }; });
      cv.addEventListener('pointerup', (e) => {
        if (!down || e.pointerId !== down.id) return;
        const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t; down = null;
        if (moved < 12 && dt < 400) this.tap(e.clientX, e.clientY);
      });
    },

    tap(x, y) {
      if (this.fadeDir !== 0 || this.el.sceneEl.is('vr-mode')) return;
      const r = this.el.sceneEl.canvas.getBoundingClientRect();
      this._ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
      this._ray.setFromCamera(this._ndc, this._ray.camera); this._ray.far = 30;
      for (const h of this._ray.intersectObjects(this.hits, false)) if (h.object.parent.visible) { this.go(h.object.userData.i); return; }
    },

    place(s) {
      const rig = this.el.object3D;
      rig.position.set(s.x, 0, s.z);
      const camYaw = this._e.setFromQuaternion(this.cam.object3D.quaternion, 'YXZ').y;
      rig.rotation.y = T.MathUtils.degToRad(s.yaw) - camYaw;
      this.vel.set(0, 0);
    },

    go(i) { if (this.pending < 0 && this.world.spots[i]) { this.pending = i; this.fadeDir = 1; } },
    confirm() { if (this.target >= 0) this.go(this.target); },

    readInput() {
      const k = this.keys; let ix = 0, iz = 0, confirm = !!k.__never;
      if (k.KeyD || k.ArrowRight) ix += 1; if (k.KeyA || k.ArrowLeft) ix -= 1;
      if (k.KeyW || k.ArrowUp) iz += 1; if (k.KeyS || k.ArrowDown) iz -= 1;
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      this.padInfo = '';
      for (const p of pads) {
        if (!p || !p.connected) continue;
        let ax = p.axes[0] || 0, ay = p.axes[1] || 0;
        if (p.mapping !== 'standard' && p.axes.length >= 4 && Math.hypot(p.axes[2], p.axes[3]) > Math.hypot(ax, ay)) { ax = p.axes[2]; ay = p.axes[3]; }
        if (Math.hypot(ax, ay) > DEAD) { ix += ax; iz -= ay; }
        const b = p.buttons;
        if (b[12] && b[12].pressed) iz += 1; if (b[13] && b[13].pressed) iz -= 1;
        if (b[14] && b[14].pressed) ix -= 1; if (b[15] && b[15].pressed) ix += 1;
        if (b[0] && b[0].pressed) confirm = true;
        this.padInfo += `pad ${p.index} "${p.id.slice(0, 40)}" map=${p.mapping || '-'} axes=[${Array.from(p.axes, (v) => v.toFixed(2))}] btn=[${Array.from(b, (x, j) => (x.pressed ? j : '')).join('')}]\n`;
      }
      if (Math.hypot(this.touch.x, this.touch.y) > 0.12) { ix += this.touch.x; iz -= this.touch.y; }
      const len = Math.hypot(ix, iz); if (len > 1) { ix /= len; iz /= len; }
      return { ix, iz, confirm };
    },

    resolve(p) {
      const cs = this.world.colliders, bd = this.world.bounds;
      for (let it = 0; it < 3; it++) {
        for (let i = 0; i < cs.length; i++) {
          const c = cs[i];
          if (p.x < c.x0 - R || p.x > c.x1 + R || p.z < c.z0 - R || p.z > c.z1 + R) continue;
          const cx = Math.min(Math.max(p.x, c.x0), c.x1), cz = Math.min(Math.max(p.z, c.z0), c.z1);
          const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
          if (d2 >= R * R) continue;
          if (d2 > 1e-9) { const d = Math.sqrt(d2), k = (R - d) / d; p.x += dx * k; p.z += dz * k; }
          else { // centre inside the box: leave by the nearest face
            const l = p.x - c.x0, r = c.x1 - p.x, t = p.z - c.z0, b = c.z1 - p.z, m = Math.min(l, r, t, b);
            if (m === l) p.x = c.x0 - R; else if (m === r) p.x = c.x1 + R; else if (m === t) p.z = c.z0 - R; else p.z = c.z1 + R;
          }
        }
      }
      p.x = Math.min(Math.max(p.x, bd.x0 + R), bd.x1 - R); p.z = Math.min(Math.max(p.z, bd.z0 + R), bd.z1 - R);
    },

    tick(time, dtMs) {
      if (!this.ready) return;
      const dt = Math.min(dtMs / 1000, 0.05), rig = this.el.object3D, cam = this.cam.object3D;
      const inp = this.readInput();
      if (inp.confirm && !this.prevConfirm) this.confirm();
      this.prevConfirm = inp.confirm;

      // move relative to gaze direction on the floor plane
      cam.getWorldQuaternion(this._q); this._f.set(0, 0, -1).applyQuaternion(this._q); this._f.y = 0;
      if (this._f.lengthSq() < 1e-4) this._f.set(-Math.sin(rig.rotation.y), 0, -Math.cos(rig.rotation.y));
      this._f.normalize();
      const fx = this._f.x, fz = this._f.z, rx = -fz, rz = fx;
      const tx = (fx * inp.iz + rx * inp.ix) * SPEED, tz = (fz * inp.iz + rz * inp.ix) * SPEED;
      const k = 1 - Math.exp(-dt / 0.09);
      this.vel.x += (tx - this.vel.x) * k; this.vel.y += (tz - this.vel.y) * k;
      const sp = Math.hypot(this.vel.x, this.vel.y);
      if (sp > 0.01 && this.fadeDir === 0) {
        rig.position.x += this.vel.x * dt; rig.position.z += this.vel.y * dt;
        this.resolve(rig.position);
      }
      this.vig += ((sp / SPEED) - this.vig) * (1 - Math.exp(-dt / 0.25));
      this.vigMat.opacity = Math.min(1, this.vig * 0.9); this.vigMesh.visible = this.vigMat.opacity > 0.02;

      // teleport fade
      if (this.fadeDir === 1) {
        this.fade = Math.min(1, this.fade + dt / 0.14);
        if (this.fade >= 1) { this.place(this.world.spots[this.pending]); this.pending = -1; this.fadeDir = -1; }
      } else if (this.fadeDir === -1) {
        this.fade = Math.max(0, this.fade - dt / 0.3);
        if (this.fade <= 0) this.fadeDir = 0;
      }
      this.fadeMat.opacity = this.fade; this.fadeMesh.visible = this.fade > 0.002;

      // gaze picking
      cam.getWorldPosition(this._o); cam.getWorldQuaternion(this._q);
      this._f.set(0, 0, -1).applyQuaternion(this._q);
      this._ray.set(this._o, this._f); this._ray.far = 16;
      let tgt = -1;
      if (this.fadeDir === 0) {
        const hits = this._ray.intersectObjects(this.hits, false);
        for (const h of hits) { const g = h.object.parent; if (g.visible) { tgt = h.object.userData.i; break; } }
      }
      this.target = tgt;
      const p = rig.position, tt = time / 1000;
      this.markers.children.forEach((g, i) => {
        const u = g.userData, near = Math.hypot(p.x - u.s.x, p.z - u.s.z) < 1.0;
        g.visible = !near;
        const on = i === tgt, pulse = 1 + 0.05 * Math.sin(tt * 3 + i);
        u.ring.scale.setScalar(on ? 1.22 : pulse); u.ringMat.opacity = on ? 1 : 0.7;
        u.beamMat.opacity = on ? 0.42 : 0.2; u.sp.scale.set(on ? 1.0 : 0.8, on ? 0.25 : 0.2, 1);
      });
      this.ret.visible = this.el.sceneEl.is('vr-mode') || !this.touchUI; // a centre dot is noise on a touch screen
      this.retMat.color.set(tgt >= 0 ? 0xffc477 : 0xffffff);
      this.ret.scale.setScalar(tgt >= 0 ? 1.8 : 1);

      if (this.dbg && ((this._dt = (this._dt || 0) + dt) > 0.2)) {
        this._dt = 0; const i = this.el.sceneEl.renderer.info;
        this.dbg.textContent = `fps ${(1 / dt).toFixed(0)}  calls ${i.render.calls}  tris ${i.render.triangles}  tex ${i.memory.textures}\npos ${p.x.toFixed(2)}, ${p.z.toFixed(2)}  target ${tgt}\nkey ${this.lastKey || '-'}\n${this.padInfo || 'no gamepad'}`;
      }
    },
  });

  // dev helper: any teleport spot standing inside a collider?
  OV.checkSpots = function () {
    return OV.world.spots.filter((s) => OV.world.colliders.some((c) => s.x > c.x0 - R && s.x < c.x1 + R && s.z > c.z0 - R && s.z < c.z1 + R)).map((s) => s.id);
  };
})();
