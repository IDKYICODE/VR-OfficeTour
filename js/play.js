/* Playful stuff: draw on the two whiteboards, and a paper-ball toss into a bin.
   Drawing: tap the pencil badge -> you are placed in front of the board, the view locks, drag to draw
   (touch / mouse) or aim + hold the remote button (headset). Pens sit on a tray under the board.
   Toss: tap the paper badge -> hold THROW (button, Space, remote) to charge, release to throw. */
(function () {
  const T = AFRAME.THREE;
  const OV = (window.OV = window.OV || {});
  const COLORS = ['#1a1d21', '#1d5a60', '#b4573b', '#2f5fd0'];
  const NAMES = ['Black pen', 'Teal pen', 'Terracotta pen', 'Blue pen', 'Eraser', 'Clear board', 'Done'];
  const G = 9.8, BR = 0.07;
  const cnv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const $ = (id) => document.getElementById(id);

  function swatch(k) {
    const c = cnv(64, 64), x = c.getContext('2d');
    x.fillStyle = 'rgba(14,18,20,0.85)'; x.beginPath(); x.arc(32, 32, 30, 0, 7); x.fill();
    x.lineWidth = 4; x.lineCap = x.lineJoin = 'round';
    if (k < 4) { x.fillStyle = COLORS[k]; x.beginPath(); x.arc(32, 32, 19, 0, 7); x.fill(); x.strokeStyle = '#f6f1e7'; x.stroke(); }
    else if (k === 4) { x.fillStyle = '#f2c9c0'; x.fillRect(16, 22, 32, 20); x.fillStyle = '#f6f1e7'; x.fillRect(16, 22, 12, 20); }
    else if (k === 5) { x.strokeStyle = '#f6f1e7'; x.beginPath(); x.moveTo(20, 20); x.lineTo(44, 44); x.moveTo(44, 20); x.lineTo(20, 44); x.stroke(); }
    else { x.strokeStyle = '#e8c9a0'; x.lineWidth = 6; x.beginPath(); x.moveTo(18, 34); x.lineTo(28, 44); x.lineTo(46, 22); x.stroke(); }
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
  }

  OV.Play = class {
    constructor(nav) {
      this.nav = nav; const w = (this.w = OV.world);
      this.group = new T.Group(); nav.el.sceneEl.object3D.add(this.group);
      this._o = new T.Vector3(); this._q = new T.Quaternion(); this._f = new T.Vector3();

      /* ---- whiteboards ---- */
      this.board = -1; this.ink = 0; this.stroking = false; this.last = null;
      w.boards.forEach((b) => (b.ctx = b.canvas.getContext('2d')));
      const tex = [0, 1, 2, 3, 4, 5, 6].map(swatch);
      this.pens = w.boards.map((b, bi) => tex.map((t, k) => {
        const sp = new T.Sprite(new T.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false }));
        sp.scale.setScalar(0.1); sp.visible = false;
        sp.position.copy(b.center).addScaledVector(b.xAxis, (k - 3) * 0.2).addScaledVector(b.normal, 0.05); sp.position.y = b.center.y - b.h / 2 - 0.065;
        sp.userData = { t: 'pen', i: bi, k, pos: sp.position, label: NAMES[k] };
        this.group.add(sp); nav.hits.push(sp); return sp;
      }));

      /* ---- paper toss ---- */
      const g = (this.game = { active: false, held: false, charging: false, charge: 0, reload: 0, score: 0, best: 0, domHeld: false });
      const geo = new T.IcosahedronGeometry(BR, 1), pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) { const s = 1 + 0.08 * Math.sin(i * 12.9898) * Math.cos(i * 4.1414); pos.setXYZ(i, pos.getX(i) * s, pos.getY(i) * s, pos.getZ(i) * s); }
      geo.computeVertexNormals();
      const mat = new T.MeshStandardMaterial({ color: 0xf4f2ec, roughness: 0.95, flatShading: true });
      this.balls = [...Array(6)].map(() => { const m = new T.Mesh(geo, mat); m.visible = false; this.group.add(m); return { m, p: m.position, v: new T.Vector3(), alive: false, inBin: false, age: 0, rest: 0, prevY: 0 }; });
      this.heldBall = new T.Mesh(geo, mat); this.heldBall.visible = false; nav.cam.object3D.add(this.heldBall);
      const bar = (col, z) => { const m = new T.Mesh(new T.PlaneGeometry(0.3, 0.018), new T.MeshBasicMaterial({ color: col, depthTest: false, depthWrite: false, transparent: true })); m.position.set(0, -0.3, -0.6); m.renderOrder = z; m.frustumCulled = false; m.visible = false; nav.cam.object3D.add(m); return m; };
      this.meterBg = bar(0x101417, 996); this.meter = bar(0x7bd88f, 997);

      this.boardC = cnv(512, 128); this.boardT = new T.CanvasTexture(this.boardC); this.boardT.colorSpace = T.SRGBColorSpace;
      this.scoreSp = new T.Sprite(new T.SpriteMaterial({ map: this.boardT, transparent: true, depthWrite: false, fog: false }));
      this.scoreSp.scale.set(0.9, 0.225, 1); this.scoreSp.position.set(w.game.bin.x, 1.25, 0.2); this.group.add(this.scoreSp);
      this.ring = new T.Mesh(new T.RingGeometry(0.34, 0.41, 40).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: 0xe8c9a0, transparent: true, opacity: 0.85, depthWrite: false }));
      this.ring.position.set(w.game.spot.x, 0.03, w.game.spot.z); this.group.add(this.ring);
      this.drawScore();

      const th = $('throw'); if (th) {
        th.addEventListener('pointerdown', (e) => { g.domHeld = true; e.preventDefault(); });
        ['pointerup', 'pointercancel', 'pointerleave'].forEach((n) => th.addEventListener(n, () => (g.domHeld = false)));
      }
      const q = $('quit'); if (q) q.onclick = () => this.stopGame();
      const dn = $('done'); if (dn) dn.onclick = () => this.endDraw();
      window.addEventListener('keydown', (e) => { if (e.code === 'Escape') { this.endDraw(); this.stopGame(); } });
    }

    /* called whenever the player is moved by something else (teleport, sit): drop out of drawing / game */
    leave() { if (this.board >= 0) this.endDraw(); if (this.game.active) this.stopGame(); }

    /* ================= whiteboard ================= */
    beginDraw(i) {
      const nav = this.nav, b = this.w.boards[i];
      nav.cam.object3D.rotation.set(0, 0, 0); // face straight at the board
      nav.place({ x: b.stand.x, z: b.stand.z, yaw: b.stand.yaw });
      nav.cam.setAttribute('look-controls', 'enabled', false);
      this.board = i; this.last = null; this.stroking = false;
      this.pens[i].forEach((s) => (s.visible = true));
      document.body.classList.add('drawing');
    }
    endDraw() {
      if (this.board < 0) return;
      this.pens[this.board].forEach((s) => (s.visible = false));
      this.board = -1; this.stroking = false; this.last = null;
      this.nav.cam.setAttribute('look-controls', 'enabled', true);
      document.body.classList.remove('drawing');
    }
    selectPen(i, k) {
      const b = this.w.boards[i];
      if (k < 4) this.ink = k; else if (k === 4) this.ink = -1;
      else if (k === 5) { b.ctx.fillStyle = '#fbfbf9'; b.ctx.fillRect(0, 0, b.canvas.width, b.canvas.height); b.dirty = true; }
      else this.endDraw();
    }
    paintRay(ray) {
      const b = this.w.boards[this.board], hit = ray.intersectObject(b.plane, false)[0];
      if (!hit) { this.last = null; return; }
      const x = hit.uv.x * b.canvas.width, y = (1 - hit.uv.y) * b.canvas.height, c = b.ctx;
      c.lineCap = c.lineJoin = 'round'; c.strokeStyle = this.ink >= 0 ? COLORS[this.ink] : '#fbfbf9'; c.lineWidth = this.ink >= 0 ? 7 : 38;
      c.beginPath(); c.moveTo(this.last ? this.last.x : x - 0.01, this.last ? this.last.y : y); c.lineTo(x, y); c.stroke();
      this.last = { x, y }; b.dirty = true;
    }
    // pointer from the canvas (touch / mouse). Returns true when it was used for drawing.
    pointer(type, e) {
      if (this.board < 0) return false;
      const nav = this.nav, r = nav.el.sceneEl.canvas.getBoundingClientRect();
      nav._ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      nav._ray.setFromCamera(nav._ndc, nav._ray.camera); nav._ray.far = 30;
      if (type === 'down') {
        const hit = nav._ray.intersectObjects(this.pens[this.board], false)[0];
        if (hit) { this.selectPen(this.board, hit.object.userData.k); this.stroking = false; return true; }
        this.stroking = true; this.last = null; this.paintRay(nav._ray);
      } else if (type === 'move') { if (this.stroking) this.paintRay(nav._ray); }
      else { this.stroking = false; this.last = null; }
      return true;
    }

    /* ================= paper toss ================= */
    startGame() {
      const nav = this.nav, s = this.w.game.spot, g = this.game;
      nav.cam.object3D.rotation.set(0, 0, 0); nav.place({ x: s.x, z: s.z, yaw: s.yaw }); // face the bin
      g.active = true; g.held = true; g.charging = false; g.charge = 0; g.reload = 0;
      document.body.classList.add('playing'); this.updateUI();
    }
    stopGame() {
      const g = this.game; if (!g.active) return;
      g.active = false; g.held = false; g.charging = false; this.heldBall.visible = this.meter.visible = this.meterBg.visible = false;
      document.body.classList.remove('playing');
    }
    blocksConfirm() { return this.game.active; }
    drawScore() {
      const x = this.boardC.getContext('2d'); x.clearRect(0, 0, 512, 128);
      x.fillStyle = 'rgba(14,18,20,0.74)'; x.beginPath(); x.roundRect(8, 24, 496, 80, 40); x.fill();
      x.fillStyle = '#f6f1e7'; x.font = '600 38px Helvetica, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(`Paper toss  ·  ${this.game.score}  ·  best ${this.game.best}`, 256, 66);
      this.boardT.needsUpdate = true;
    }
    updateUI() { const gs = $('gs'), gb = $('gb'); if (gs) gs.textContent = this.game.score; if (gb) gb.textContent = this.game.best; this.drawScore(); }
    toast(text) {
      const t = $('toast'); if (!t) return; t.textContent = text; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
    }

    throwBall(charge) {
      const nav = this.nav, bin = this.w.game.bin, ball = this.balls.find((b) => !b.alive); if (!ball) return;
      nav.cam.object3D.getWorldPosition(this._o); nav.cam.object3D.getWorldQuaternion(this._q);
      const fwd = this._f.set(0, 0, -1).applyQuaternion(this._q).clone();
      const start = this._o.clone().addScaledVector(fwd, 0.35); start.y -= 0.15;
      const v = fwd.clone().multiplyScalar(3.4 + 5.6 * charge);
      // aim assist: facing the bin within ~30 degrees pulls yaw and pitch toward the exact shot (up to 85%);
      // the speed comes from the exact shot scaled by charge, so releasing near the middle of the bar is the skill
      const dx = bin.x - start.x, dz = bin.z - start.z, d = Math.hypot(dx, dz), hh = bin.h - start.y, al = Math.PI / 4, den = d * Math.tan(al) - hh;
      if (den > 0.05) {
        const yawP = Math.atan2(v.x, v.z), yawI = Math.atan2(dx, dz), pitchP = Math.asin(v.y / v.length());
        let dyaw = yawI - yawP; while (dyaw > Math.PI) dyaw -= 2 * Math.PI; while (dyaw < -Math.PI) dyaw += 2 * Math.PI;
        const k = Math.max(0, 1 - Math.abs(dyaw) / 0.6) * 0.95;
        if (k > 0) {
          const yaw = yawP + dyaw * k, pitch = Math.min(1.2, Math.max(0.35, pitchP + (al - pitchP) * k));
          const dn = d * Math.tan(pitch) - hh; // speed that drops onto the bin at exactly this launch pitch
          const sHit = Math.sqrt((G * d * d) / (2 * Math.cos(pitch) ** 2 * Math.max(dn, 0.2)));
          const speed = sHit * (1 + (charge - 0.5) * 0.12); // charge near the middle = on target; too weak or too hard falls short / long
          v.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(speed);
        }
      }
      ball.p.copy(start); ball.v.copy(v); ball.alive = true; ball.inBin = false; ball.age = 0; ball.rest = 0; ball.prevY = start.y; ball.m.visible = true;
    }
    stepBall(b, dt) {
      const bin = this.w.game.bin;
      for (let s = 0; s < 3; s++) {
        const h = dt / 3; b.prevY = b.p.y; b.v.y -= G * h; b.p.addScaledVector(b.v, h);
        const floor = b.inBin ? 0.03 + BR : BR;
        if (b.p.y < floor) { b.p.y = floor; if (b.v.y < 0) b.v.y *= -0.4; b.v.x *= 0.8; b.v.z *= 0.8; }
        if (b.p.y > 2.75) { b.p.y = 2.75; b.v.y *= -0.3; }
        if (b.p.x < 0.1) { b.p.x = 0.1; b.v.x *= -0.35; } else if (b.p.x > 5.88) { b.p.x = 5.88; b.v.x *= -0.35; }
        if (b.p.z < 0.1) { b.p.z = 0.1; b.v.z *= -0.35; } else if (b.p.z > 9.9) { b.p.z = 9.9; b.v.z *= -0.35; }
        const dx = b.p.x - bin.x, dz = b.p.z - bin.z, d = Math.hypot(dx, dz) || 1e-6, nx = dx / d, nz = dz / d;
        if (!b.inBin) {
          if (b.prevY > bin.h && b.p.y <= bin.h && b.v.y < 0 && d < bin.r - 0.04) { b.inBin = true; b.age = 0; this.scored(); }
          else if (b.p.y < bin.h + BR * 0.4 && d < bin.r + BR && d > bin.r - 0.04) { // rim / outside wall of the bin (not the opening)
            const pen = bin.r + BR - d; b.p.x += nx * pen; b.p.z += nz * pen;
            const vn = b.v.x * nx + b.v.z * nz; if (vn < 0) { b.v.x -= 1.4 * vn * nx; b.v.z -= 1.4 * vn * nz; }
          }
        } else {
          const maxd = bin.r - BR * 0.9;
          if (d > maxd) { b.p.x = bin.x + nx * maxd; b.p.z = bin.z + nz * maxd; const vn = b.v.x * nx + b.v.z * nz; if (vn > 0) { b.v.x -= 1.5 * vn * nx; b.v.z -= 1.5 * vn * nz; } }
        }
      }
      b.age += dt;
      const slow = b.v.lengthSq() < 0.06 && b.p.y <= BR + 0.02; b.rest = slow ? b.rest + dt : 0;
      if ((b.inBin && b.age > 1.3) || b.rest > 3 || b.age > 12) { b.alive = false; b.m.visible = false; }
    }
    scored() {
      const g = this.game; g.score++; g.best = Math.max(g.best, g.score); this.updateUI();
      this.toast(['Nice!', 'Swish!', 'In!', 'Bullseye!'][g.score % 4]);
    }

    tick(dt, time) {
      const nav = this.nav, w = this.w, g = this.game, p = nav.el.object3D.position;
      w.boards.forEach((b) => { if (b.dirty) { b.tex.needsUpdate = true; b.dirty = false; } });
      const vr = nav.el.sceneEl.is('vr-mode');
      if (this.board >= 0 && vr) { if (nav.btnHeld) this.paintRay(nav._ray); else this.last = null; } // aim + hold to draw in the headset

      for (const b of this.balls) if (b.alive) { this.stepBall(b, dt); }
      const near = Math.hypot(p.x - w.game.spot.x, p.z - w.game.spot.z) < 9 && !nav.seated;
      this.ring.visible = near && !g.active; this.scoreSp.visible = Math.hypot(p.x - w.game.bin.x, p.z - w.game.bin.z) < 9;
      this.ring.material.opacity = 0.55 + 0.3 * Math.sin(time / 400);

      if (!g.active) return;
      if (Math.hypot(p.x - w.game.spot.x, p.z - w.game.spot.z) > 2.4) { this.stopGame(); return; } // walked away
      const down = nav.btnHeld || g.domHeld;
      if (g.held) {
        if (down) { g.charging = true; g.charge = Math.min(1, g.charge + dt / 0.9); }
        else if (g.charging) { this.throwBall(g.charge); g.charging = false; g.charge = 0; g.held = false; g.reload = 0.6; }
      } else { g.reload -= dt; if (g.reload <= 0) g.held = true; }
      this.heldBall.visible = g.held;
      this.heldBall.scale.setScalar(0.7);
      this.heldBall.position.set(0.2, -0.2 + 0.05 * g.charge + 0.004 * Math.sin(time / 300), -0.5 + 0.12 * g.charge);
      this.meter.visible = this.meterBg.visible = g.charging;
      if (g.charging) { this.meter.scale.x = Math.max(0.001, g.charge); this.meter.position.x = -0.15 + 0.15 * g.charge; this.meter.material.color.setHSL(0.33 - 0.33 * g.charge, 0.6, 0.6); }
    }
  };
})();
