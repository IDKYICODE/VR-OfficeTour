/* Small things that keep the office from feeling like a still photo: the wall clock shows
   your real local time, monitors scroll / animate / run a screensaver, plants sway (shader),
   clouds drift, and a few birds cross the sky outside. Monitor redraws only run when you
   are near the workspace. */
(function () {
  const T = AFRAME.THREE;
  const OV = (window.OV = window.OV || {});
  const TAU = Math.PI * 2;

  function birdTex(flap) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 32;
    const x = c.getContext('2d'); x.strokeStyle = '#ffffff'; x.lineWidth = 3.5; x.lineCap = 'round'; x.lineJoin = 'round';
    x.beginPath(); x.moveTo(4, flap ? 8 : 24); x.quadraticCurveTo(20, flap ? 18 : 12, 32, 18); x.quadraticCurveTo(44, flap ? 18 : 12, 60, flap ? 8 : 24); x.stroke();
    return new T.CanvasTexture(c);
  }

  AFRAME.registerComponent('office-life', {
    init() {
      this.acc = { dash: 0, saver: 0 };
      OV.world ? this.setup() : this.el.sceneEl.addEventListener('office-ready', () => this.setup(), { once: true });
    },
    setup() {
      const w = (this.w = OV.world), live = () => {
        const c = document.createElement('canvas'); c.width = 512; c.height = 288;
        const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
        return { x: c.getContext('2d'), t };
      };
      this.dash = live(); this.saver = live();
      OV.brand.drawDash(this.dash.x, 0); OV.brand.drawSaver(this.saver.x, 0); this.dash.t.needsUpdate = this.saver.t.needsUpdate = true;
      w.mats.screen1.map = this.dash.t; w.mats.screen2.map = this.saver.t;
      this.code = w.mats.screen0.map; this.code.wrapT = T.RepeatWrapping; this.code.needsUpdate = true;

      this.flap = [birdTex(0), birdTex(1)];
      this.birds = [0, 1, 2, 3].map((i) => {
        const s = new T.Sprite(new T.SpriteMaterial({ map: this.flap[0], color: 0xf4f4f6, transparent: true, depthWrite: false, fog: false }));
        s.scale.set(5, 2.5, 1); w.root.add(s);
        return { s, a: i * 1.7 + 0.4, om: (i % 2 ? 1 : -1) * (0.05 + 0.012 * i), r: 150 + 14 * i, y: 38 + 9 * i };
      });
      this.ready = true;
    },
    tick(time, dtMs) {
      if (!this.ready) return;
      const t = time / 1000, dt = Math.min(dtMs / 1000, 0.1), w = this.w;
      OV.U.time.value = t;

      // wall clock: real local time
      const d = new Date(), s = d.getSeconds() + d.getMilliseconds() / 1000, m = d.getMinutes() + s / 60, h = (d.getHours() % 12) + m / 60;
      w.clock.sec.rotation.z = -(s / 60) * TAU; w.clock.min.rotation.z = -(m / 60) * TAU; w.clock.hour.rotation.z = -(h / 12) * TAU;

      w.clouds.rotation.y = t * 0.004;
      this.birds.forEach((b, i) => {
        b.a += b.om * dt;
        b.s.position.set(10 + Math.cos(b.a) * b.r, b.y + Math.sin(t * 0.4 + i) * 3, 5 + Math.sin(b.a) * b.r);
        b.s.material.map = this.flap[(Math.floor(t * 4 + i) & 1)];
      });

      // monitors: only while you are anywhere near the workspace
      const p = OV.nav && OV.nav.el.object3D.position;
      if (p && Math.hypot(p.x - 10, p.z - 5) < 12) {
        this.code.offset.y = (t * 0.04) % 1;
        this.acc.dash += dt; this.acc.saver += dt;
        if (this.acc.dash > 0.5) { this.acc.dash = 0; OV.brand.drawDash(this.dash.x, t); this.dash.t.needsUpdate = true; }
        if (this.acc.saver > 0.1) { this.acc.saver = 0; OV.brand.drawSaver(this.saver.x, t); this.saver.t.needsUpdate = true; }
      }
    },
  });
})();
