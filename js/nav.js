/* Navigation + interaction: walk with stick / keys / on-screen joystick (relative to
   where you look), slide along walls, gaze-or-tap teleport rings, tap-to-sit on any
   chair or sofa, light switch, meeting-room TV. Comfort vignette while moving.
   Inputs: Bluetooth gamepad axes + d-pad, WASD/arrows, Enter/Space, taps/clicks.
   Add ?debug to the URL to see what the remote actually sends. */
(function () {
  const T = AFRAME.THREE;
  const OV = (window.OV = window.OV || {});
  const R = 0.26;        // body radius, m
  const SPEED = 1.5;     // walking speed, m/s (constant; no acceleration spikes)
  const DEAD = 0.18;
  // only structure blocks "can I see it" checks; furniture never hides a tap target
  const SOLID = new Set(['plaster', 'teal', 'terra', 'trim', 'frame', 'concrete', 'carpet', 'oak', 'ceiling', 'cabinet', 'cabinetG']);

  const cnv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const tex = (c) => { const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; };

  function radial(inner, outer, a) { // transparent centre -> black rim
    const c = cnv(128, 128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 64 * inner, 64, 64, 64 * outer);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${a})`);
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    return new T.CanvasTexture(c);
  }
  function drawLabel(c, text) {
    const x = c.getContext('2d'); x.clearRect(0, 0, 512, 128);
    x.fillStyle = 'rgba(14,18,20,0.74)'; x.beginPath(); x.roundRect(8, 24, 496, 80, 40); x.fill();
    x.fillStyle = '#f6f1e7'; x.font = '600 44px Helvetica, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, 256, 66);
  }
  function label(text) { const c = cnv(512, 128); drawLabel(c, text); return tex(c); }
  function beamTex() {
    const c = cnv(4, 64), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0.9)');
    x.fillStyle = g; x.fillRect(0, 0, 4, 64); return new T.CanvasTexture(c);
  }
  function icon(kind) { // round badge with a simple glyph
    const c = cnv(128, 128), x = c.getContext('2d');
    x.fillStyle = 'rgba(14,18,20,0.8)'; x.beginPath(); x.arc(64, 64, 58, 0, 7); x.fill();
    x.lineWidth = 6; x.strokeStyle = '#e8c9a0'; x.stroke();
    x.fillStyle = x.strokeStyle = '#f6f1e7'; x.lineWidth = 8; x.lineCap = x.lineJoin = 'round';
    if (kind === 'sit') { // chair, side view
      x.beginPath(); x.moveTo(46, 32); x.lineTo(46, 72); x.lineTo(84, 72); x.stroke();
      x.beginPath(); x.moveTo(52, 72); x.lineTo(52, 96); x.moveTo(80, 72); x.lineTo(80, 96); x.stroke();
    } else if (kind === 'light') { // bulb
      x.beginPath(); x.arc(64, 54, 22, 0, 7); x.fill(); x.fillRect(54, 80, 20, 7); x.fillRect(57, 91, 14, 6);
    } else if (kind === 'draw') { // pencil
      x.beginPath(); x.moveTo(40, 90); x.lineTo(44, 74); x.lineTo(80, 38); x.lineTo(90, 48); x.lineTo(54, 84); x.closePath(); x.stroke();
      x.beginPath(); x.moveTo(40, 90); x.lineTo(50, 87); x.stroke();
    } else if (kind === 'toss') { // crumpled paper ball + motion arc
      x.beginPath(); x.arc(76, 74, 15, 0, 7); x.fill();
      x.lineWidth = 6; x.setLineDash([2, 12]); x.beginPath(); x.moveTo(28, 92); x.quadraticCurveTo(42, 26, 70, 56); x.stroke(); x.setLineDash([]);
    } else { // play
      x.beginPath(); x.moveTo(50, 38); x.lineTo(50, 90); x.lineTo(94, 64); x.closePath(); x.fill();
    }
    return tex(c);
  }

  AFRAME.registerComponent('office-nav', {
    init() {
      this.keys = {}; this.vel = new T.Vector2(); this.fade = 0; this.fadeDir = 0; this.pending = null;
      this.prevConfirm = false; this.target = null; this.targetPoint = new T.Vector3(); this.vig = 0; this.ready = false;
      this.seated = null; this.seatT = 0; this.lightK = 1; this.lightGoal = 1; this.slide = 0;
      this.btnHeld = false; this.shellTouch = false; this.toys = null;
      // the headset shell's touch button taps the screen: treat a held touch as "button held" while in VR
      window.addEventListener('touchstart', () => { if (this.el.sceneEl.is('vr-mode')) this.shellTouch = true; }, { passive: true });
      ['touchend', 'touchcancel'].forEach((n) => window.addEventListener(n, () => (this.shellTouch = false), { passive: true }));
      this._q = new T.Quaternion(); this._f = new T.Vector3(); this._o = new T.Vector3(); this._e = new T.Euler(); this._d = new T.Vector3();
      this._ray = new T.Raycaster(); this._los = new T.Raycaster(); this.cam = document.getElementById('cam');
      const isConfirm = (c) => c === 'Enter' || c === 'Space' || c === 'NumpadEnter' || c === 'KeyE';
      window.addEventListener('keydown', (e) => {
        this.keys[e.code] = true; this.lastKey = e.code + (e.key ? ' / ' + e.key : '');
        if (!this.ready || e.repeat) return;
        if (isConfirm(e.code)) this.confirm();
        const m = /^Digit([1-9])$/.exec(e.code); if (m) this.go(+m[1] - 1);
        if (/^Arrow|Space/.test(e.code)) e.preventDefault();
      });
      window.addEventListener('keyup', (e) => (this.keys[e.code] = false));
      window.addEventListener('blur', () => (this.keys = {}));
      // in the headset the touch button on the shell sends a click: confirm the gazed target. Outside VR taps pick directly (see tap()).
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
      this.solid = world.root.children.filter((m) => m.isMesh && SOLID.has(m.name));
      this._ledBase = world.mats.led.color.clone();
      // overlays that live on the camera: fade-to-black, comfort vignette, gaze reticle
      const ov = (geo, mat, z, order) => { const m = new T.Mesh(geo, mat); m.position.z = z; m.renderOrder = order; m.frustumCulled = false; cam.add(m); return m; };
      const base = { transparent: true, depthTest: false, depthWrite: false, fog: false };
      this.fadeMat = new T.MeshBasicMaterial({ ...base, color: 0x000000, opacity: 0 });
      this.fadeMesh = ov(new T.PlaneGeometry(3, 3), this.fadeMat, -0.2, 1000); this.fadeMesh.visible = false;
      this.vigMat = new T.MeshBasicMaterial({ ...base, map: radial(0.5, 1.0, 0.92), opacity: 0 });
      this.vigMesh = ov(new T.PlaneGeometry(0.9, 0.9), this.vigMat, -0.25, 999); this.vigMesh.visible = false;
      this.retMat = new T.MeshBasicMaterial({ ...base, color: 0xffffff, opacity: 0.85 });
      this.ret = ov(new T.RingGeometry(0.007, 0.011, 32), this.retMat, -1, 998);

      this.markers = new T.Group(); this.hits = []; const beam = beamTex();
      // teleport markers (rings on the floor)
      world.spots.forEach((s, i) => {
        const g = new T.Group(); g.position.set(s.x, 0, s.z);
        const ringMat = new T.MeshBasicMaterial({ color: 0xffe3b8, transparent: true, opacity: 0.9, depthWrite: false });
        const ring = new T.Mesh(new T.RingGeometry(0.3, 0.36, 48).rotateX(-Math.PI / 2), ringMat); ring.position.y = 0.025;
        const disc = new T.Mesh(new T.CircleGeometry(0.3, 40).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: 0xffe3b8, transparent: true, opacity: 0.16, depthWrite: false })); disc.position.y = 0.022;
        const bm = new T.MeshBasicMaterial({ map: beam, color: 0xffd9a6, transparent: true, opacity: 0.09, depthWrite: false, side: T.DoubleSide });
        const bc = new T.Mesh(new T.CylinderGeometry(0.16, 0.3, 1.3, 24, 1, true), bm); bc.position.y = 0.66;
        const sp = new T.Sprite(new T.SpriteMaterial({ map: label(s.name), transparent: true, depthWrite: false, fog: false }));
        sp.scale.set(0.8, 0.2, 1); sp.position.y = 1.5;
        // pick targets: a flat disc on the floor (rings in a line of sight don't block each other), a thin pole, and the label
        const inv = new T.MeshBasicMaterial({ visible: false });
        const hitDisc = new T.Mesh(new T.CircleGeometry(0.6, 20).rotateX(-Math.PI / 2), inv); hitDisc.position.y = 0.03;
        const hitPole = new T.Mesh(new T.CylinderGeometry(0.22, 0.22, 1.6, 10), inv); hitPole.position.y = 0.8;
        hitDisc.userData = { t: 'spot', i }; hitPole.userData = { t: 'spot', i }; sp.userData = { t: 'spot', i };
        g.add(disc, ring, bc, sp, hitDisc, hitPole); this.markers.add(g); this.hits.push(hitDisc, hitPole, sp);
        g.userData = { ring, ringMat, beamMat: bm, sp, s };
      });
      // hotspots: a small badge floating at each seat / the switch / the TV; the badge itself is the tap target
      const icons = { sit: icon('sit'), light: icon('light'), tv: icon('tv'), draw: icon('draw'), toss: icon('toss') };
      this.acts = world.hotspots.map((h, i) => {
        const sp = new T.Sprite(new T.SpriteMaterial({ map: icons[h.kind], transparent: true, depthWrite: false, fog: false }));
        const size = h.kind === 'sit' ? 0.22 : 0.28;
        sp.position.copy(h.pos); sp.scale.setScalar(size); sp.userData = { t: 'act', i, size };
        this.markers.add(sp); this.hits.push(sp);
        return { h, sp, size };
      });
      this.hoverLabelC = cnv(512, 128); this.hoverLabelT = tex(this.hoverLabelC); this.hoverText = '';
      this.hoverLabel = new T.Sprite(new T.SpriteMaterial({ map: this.hoverLabelT, transparent: true, depthWrite: false, depthTest: false, fog: false }));
      this.hoverLabel.scale.set(0.8, 0.2, 1); this.hoverLabel.renderOrder = 997; this.hoverLabel.visible = false; this.markers.add(this.hoverLabel);
      sceneEl.object3D.add(this.markers);

      const stand = document.getElementById('stand'); if (stand) stand.onclick = () => this.stand();
      this._ray.camera = this.cam.getObject3D('camera'); // sprites need it for picking
      this.toys = new OV.Play(this); // whiteboards + paper toss (needs this.hits)
      this.setupTouch(sceneEl);

      if (OV.Q && OV.Q.debug) { this.dbg = document.createElement('pre'); this.dbg.id = 'dbg'; document.body.appendChild(this.dbg); }
      this.place(world.spots[0]);
      this.ready = true;
      document.body.classList.add('ready');
      sceneEl.emit('nav-ready');
    },

    // phone / mouse without a headset: on-screen joystick walks, a tap on a target acts, dragging looks (look-controls)
    setupTouch(sceneEl) {
      const hint = document.getElementById('hint');
      if (hint) hint.textContent = this.touchUI
        ? 'Drag to look · left joystick to walk · tap a ring to teleport, a chair badge to sit'
        : 'Drag to look · WASD or left stick to walk · click a ring to teleport, a chair badge to sit · 1–7 jump to a spot';
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
      cv.addEventListener('pointerdown', (e) => { if (this.toys.pointer('down', e)) { down = null; return; } down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }; });
      cv.addEventListener('pointermove', (e) => this.toys.pointer('move', e));
      cv.addEventListener('pointerup', (e) => {
        if (this.toys.pointer('up', e)) { down = null; return; }
        if (!down || e.pointerId !== down.id) return;
        const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t; down = null;
        if (moved < 12 && dt < 400) this.tap(e.clientX, e.clientY);
      });
    },

    /* ---- picking ---- */
    visible(ud) { // is this target currently shown?
      if (ud.t === 'spot') return this.markers.children[ud.i].visible;
      if (ud.t === 'pen') return this.toys.pens[ud.i][ud.k].visible;
      return this.acts[ud.i].sp.visible;
    },
    blocked(pt) { // a wall / floor / ceiling between the eye and the point?
      this.cam.object3D.getWorldPosition(this._o);
      this._d.copy(pt).sub(this._o); const d = this._d.length(); this._d.normalize();
      this._los.set(this._o, this._d); this._los.far = Math.max(0, d - 0.1);
      return this._los.intersectObjects(this.solid, false).length > 0;
    },
    tap(x, y) {
      if (this.fadeDir !== 0 || this.el.sceneEl.is('vr-mode')) return;
      const r = this.el.sceneEl.canvas.getBoundingClientRect();
      this._ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
      this._ray.setFromCamera(this._ndc, this._ray.camera); this._ray.far = 30;
      for (const h of this._ray.intersectObjects(this.hits, false)) {
        const ud = h.object.userData;
        if (!this.visible(ud) || this.blocked(h.point)) continue;
        this.activate(ud); return;
      }
    },
    confirm() {
      if (this.toys.blocksConfirm()) return; // the button is the throw button while tossing
      const t = this.target;
      if (t) { if (!this.blocked(this.targetPoint)) this.activate(t); }
      else if (this.seated) this.stand();
    },
    activate(ud) {
      if (ud.t === 'spot') return this.go(ud.i);
      if (ud.t === 'pen') return this.toys.selectPen(ud.i, ud.k);
      const a = this.acts[ud.i].h;
      if (this.toys.board >= 0) return; // while drawing only the pens (and the spot rings) react
      if (a.kind === 'sit') this.sit(a.seat);
      else if (a.kind === 'draw') { if (!this.pending) { this.pending = { t: 'draw', i: a.board }; this.fadeDir = 1; } }
      else if (a.kind === 'toss') { if (!this.pending) { this.pending = { t: 'toss' }; this.fadeDir = 1; } }
      else if (a.kind === 'light') this.lightGoal = this.lightGoal ? 0 : 1;
      else if (a.kind === 'tv') {
        const w = this.world; this.slide = (this.slide + 1) % w.slides.length;
        w.mats.tvScreen.map = w.slides[this.slide]; w.mats.tvScreen.needsUpdate = true;
      }
    },

    /* ---- moving the rig ---- */
    setSeated(s) { this.seated = s; this.seatT = performance.now(); document.body.classList.toggle('seated', !!s); },
    camYaw() { return this._e.setFromQuaternion(this.cam.object3D.quaternion, 'YXZ').y; },
    place(s) {
      const rig = this.el.object3D;
      if (this.toys && !s.keepPlay) this.toys.leave();
      rig.position.set(s.x, 0, s.z);
      rig.rotation.y = T.MathUtils.degToRad(s.yaw) - this.camYaw();
      this.vel.set(0, 0); this.setSeated(null);
    },
    seatPlace(s) { // camera drops to seated eye height, facing the way the chair faces
      const rig = this.el.object3D; this.toys.leave();
      rig.position.set(s.x, s.eye - 1.6, s.z);
      rig.rotation.y = s.ry + Math.PI - this.camYaw();
      this.vel.set(0, 0); this.setSeated(s);
    },
    standUp() {
      const s = this.seated; if (!s) return;
      const rig = this.el.object3D, k = 0.8 * s.exit;
      rig.position.set(s.x + Math.sin(s.ry) * k, 0, s.z + Math.cos(s.ry) * k);
      this.resolve(rig.position); this.vel.set(0, 0); this.setSeated(null);
    },
    go(i) { if (!this.pending && this.world.spots[i]) { this.pending = { t: 'spot', i }; this.fadeDir = 1; } },
    sit(seat) { if (!this.pending) { this.pending = { t: 'sit', seat }; this.fadeDir = 1; } },
    stand() { if (!this.pending && this.seated) { this.pending = { t: 'stand' }; this.fadeDir = 1; } },
    applyPending(p) {
      if (p.t === 'spot') this.place(this.world.spots[p.i]);
      else if (p.t === 'sit') this.seatPlace(p.seat);
      else if (p.t === 'draw') this.toys.beginDraw(p.i);
      else if (p.t === 'toss') this.toys.startGame();
      else this.standUp();
    },

    readInput() {
      const k = this.keys; let ix = 0, iz = 0, confirm = false;
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
      this.btnHeld = confirm || !!(k.Space || k.Enter || k.NumpadEnter || k.KeyE) || this.shellTouch; // held, for drawing and charging a throw
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

    applyLights(k) { // 1 = on, 0 = off
      const w = this.world;
      ['led', 'ledUp', 'ledSpot'].forEach((n) => w.mats[n].color.copy(this._ledBase).multiplyScalar(0.08 + 0.92 * k));
      w.mats.opal.emissiveIntensity = 0.03 + 0.87 * k;
      w.mats.drum.emissiveIntensity = 0.03 + 0.82 * k;
      if (w.baked) { OV.U.lamp.value = OV.BAKE.lampGain * k; return; } // the lamp channel of the baked light is what the switch dims
      w.lights.forEach((l) => (l.light.intensity = l.base * k));
      w.hemi.intensity = 0.28 + 0.22 * k;
      this.el.sceneEl.object3D.environmentIntensity = 0.45 + 0.2 * k;
    },

    tick(time, dtMs) {
      if (!this.ready) return;
      const dt = Math.min(dtMs / 1000, 0.05), rig = this.el.object3D, cam = this.cam.object3D;
      const inp = this.readInput();
      if (inp.confirm && !this.prevConfirm) this.confirm();
      this.prevConfirm = inp.confirm;

      // drawing: view and feet locked, pushing the stick ends it. seated: no walking; pushing the stick stands you up
      if (this.toys.board >= 0) {
        this.vel.set(0, 0);
        if (!this.pending && Math.hypot(inp.ix, inp.iz) > 0.6) this.toys.endDraw();
      } else if (this.seated) {
        this.vel.set(0, 0);
        if (!this.pending && performance.now() - this.seatT > 700 && Math.hypot(inp.ix, inp.iz) > 0.6) this.stand();
      } else {
        // move relative to gaze direction on the floor plane
        cam.getWorldQuaternion(this._q); this._f.set(0, 0, -1).applyQuaternion(this._q); this._f.y = 0;
        if (this._f.lengthSq() < 1e-4) this._f.set(-Math.sin(rig.rotation.y), 0, -Math.cos(rig.rotation.y));
        this._f.normalize();
        const fx = this._f.x, fz = this._f.z, rx = -fz, rz = fx;
        const tx = (fx * inp.iz + rx * inp.ix) * SPEED, tz = (fz * inp.iz + rz * inp.ix) * SPEED;
        const k = 1 - Math.exp(-dt / 0.09);
        this.vel.x += (tx - this.vel.x) * k; this.vel.y += (tz - this.vel.y) * k;
        if (Math.hypot(this.vel.x, this.vel.y) > 0.01 && this.fadeDir === 0) {
          rig.position.x += this.vel.x * dt; rig.position.z += this.vel.y * dt;
          this.resolve(rig.position);
        }
      }
      const sp = this.vel.length();
      this.vig += ((sp / SPEED) - this.vig) * (1 - Math.exp(-dt / 0.25));
      this.vigMat.opacity = Math.min(1, this.vig * 0.9); this.vigMesh.visible = this.vigMat.opacity > 0.02;

      // fade for teleport / sit / stand
      if (this.fadeDir === 1) {
        this.fade = Math.min(1, this.fade + dt / 0.14);
        if (this.fade >= 1) { this.applyPending(this.pending); this.pending = null; this.fadeDir = -1; }
      } else if (this.fadeDir === -1) {
        this.fade = Math.max(0, this.fade - dt / 0.3);
        if (this.fade <= 0) this.fadeDir = 0;
      }
      this.fadeMat.opacity = this.fade; this.fadeMesh.visible = this.fade > 0.002;

      // light switch eases over a third of a second
      if (this.lightK !== this.lightGoal) {
        this.lightK += Math.sign(this.lightGoal - this.lightK) * dt / 0.35;
        if (Math.abs(this.lightGoal - this.lightK) < dt / 0.35) this.lightK = this.lightGoal;
        this.applyLights(this.lightK);
      }

      // visibility of markers + badges
      const p = rig.position;
      this.markers.children.forEach((g) => {
        const u = g.userData; if (!u || !u.s) return;
        g.visible = Math.hypot(p.x - u.s.x, p.z - u.s.z) >= 1.0;
      });
      this.acts.forEach((a) => {
        const d = Math.hypot(p.x - a.h.pos.x, p.z - a.h.pos.z);
        const busy = this.toys.board >= 0 || this.toys.game.active;
        a.sp.visible = !this.seated && !busy && (a.h.kind === 'sit' ? d < 4.5 && d > 0.45 : d < 9);
      });

      // gaze picking
      cam.getWorldPosition(this._o); cam.getWorldQuaternion(this._q);
      this._f.set(0, 0, -1).applyQuaternion(this._q);
      this._ray.set(this._o, this._f); this._ray.far = 16;
      let tgt = null;
      if (this.fadeDir === 0) {
        for (const h of this._ray.intersectObjects(this.hits, false)) {
          if (this.visible(h.object.userData)) { tgt = h.object.userData; this.targetPoint.copy(h.point); break; }
        }
      }
      this.target = tgt;
      this.toys.tick(dt, time);
      const tt = time / 1000;
      this.markers.children.forEach((g, i) => {
        const u = g.userData; if (!u || !u.s) return;
        const on = tgt && tgt.t === 'spot' && tgt.i === i, pulse = 1 + 0.05 * Math.sin(tt * 3 + i);
        u.ring.scale.setScalar(on ? 1.22 : pulse); u.ringMat.opacity = on ? 1 : 0.7;
        u.beamMat.opacity = on ? 0.3 : 0.09; u.sp.scale.set(on ? 1.0 : 0.8, on ? 0.25 : 0.2, 1);
      });
      let hoverAct = null;
      this.acts.forEach((a, i) => {
        const on = tgt && tgt.t === 'act' && tgt.i === i; if (on) hoverAct = a;
        a.sp.scale.setScalar(a.size * (on ? 1.4 : 1 + 0.06 * Math.sin(tt * 3 + i)));
      });
      let hover = hoverAct ? { label: hoverAct.h.label, pos: hoverAct.h.pos } : null;
      this.toys.pens.forEach((row, bi) => row.forEach((s, k) => {
        const on = tgt && tgt.t === 'pen' && tgt.i === bi && tgt.k === k; s.scale.setScalar(on ? 0.14 : 0.1);
        if (on) hover = { label: s.userData.label, pos: s.position };
      }));
      if (hover) {
        if (this.hoverText !== hover.label) { this.hoverText = hover.label; drawLabel(this.hoverLabelC, this.hoverText); this.hoverLabelT.needsUpdate = true; }
        this.hoverLabel.position.copy(hover.pos); this.hoverLabel.position.y += 0.2; this.hoverLabel.visible = true;
      } else this.hoverLabel.visible = false;
      this.ret.visible = this.el.sceneEl.is('vr-mode') || !this.touchUI; // a centre dot is noise on a touch screen
      this.retMat.color.set(tgt ? 0xffc477 : 0xffffff);
      this.ret.scale.setScalar(tgt ? 1.8 : 1);

      if (this.dbg && ((this._dt = (this._dt || 0) + dt) > 0.2)) {
        this._dt = 0; const i = this.el.sceneEl.renderer.info;
        this.dbg.textContent = `fps ${(1 / dt).toFixed(0)}  calls ${i.render.calls}  tris ${i.render.triangles}  tex ${i.memory.textures}\npos ${p.x.toFixed(2)}, ${p.z.toFixed(2)}  seated ${!!this.seated}  target ${tgt ? tgt.t + ':' + tgt.i : '-'}\nkey ${this.lastKey || '-'}\n${this.padInfo || 'no gamepad'}`;
      }
    },
  });

  // dev helper: any teleport spot standing inside a collider?
  OV.checkSpots = function () {
    return OV.world.spots.filter((s) => OV.world.colliders.some((c) => s.x > c.x0 - R && s.x < c.x1 + R && s.z > c.z0 - R && s.z < c.z1 + R)).map((s) => s.id);
  };
})();
