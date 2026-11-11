/* IICL (Intelligence India.Com Limited) naming. The office keeps its original colours; IICL appears
   by name only: the front-desk sign, the reception and TV-wall logos, TV slide text, monitor screens.
   The logo is the site's own mark (assets/brand/iicl_logo.png). Facts come from iicl.in. */
(function () {
  const T = AFRAME.THREE;
  const OV = (window.OV = window.OV || {});
  const FONT = 'Helvetica, Arial, sans-serif';
  let img = null, loading = null;

  const B = (OV.brand = {
    ready() {
      return loading || (loading = new Promise((res) => {
        const im = new Image(); im.onload = () => { img = OV.logoImg = im; res(im); }; im.onerror = () => res(null); im.src = 'assets/brand/iicl_logo.png';
      }));
    },
    // the logo as a texture: its own red (on light plates) or filled white (on the dark teal / terracotta walls)
    logoTex(white) {
      const c = OV.canvasOf(699, 360), x = c.getContext('2d');
      if (img) {
        x.drawImage(img, 0, 0, 699, 360);
        if (white) { x.globalCompositeOperation = 'source-in'; x.fillStyle = '#ffffff'; x.fillRect(0, 0, 699, 360); }
      } else { x.fillStyle = white ? '#fff' : '#EE2B2E'; x.font = `800 200px ${FONT}`; x.textBaseline = 'middle'; x.fillText('IICL', 40, 180); }
      return OV.toTex(c, true, false);
    },
  });

  /* ---------- monitors ---------- */
  B.screen = function (kind) {
    const w = 512, h = 288, c = OV.canvasOf(w, h), x = c.getContext('2d'), r = OV.rng(100 + kind);
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
    } else if (kind === 1) B.drawDash(x, 0.4);
    else { // design doc
      x.fillStyle = '#e9e6e0'; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.fillRect(110, 12, 292, h - 24);
      x.fillStyle = '#d9c3a5'; x.fillRect(128, 28, 256, 100); x.fillStyle = '#b4573b'; x.beginPath(); x.arc(256, 78, 34, 0, 7); x.fill();
      x.fillStyle = '#222'; x.fillRect(128, 146, 150, 9); x.fillStyle = '#999'; for (let i = 0; i < 6; i++) x.fillRect(128, 168 + i * 14, 256 - r() * 90, 5);
    }
    return OV.toTex(c, true, false);
  };
  // live content, redrawn by life.js
  B.drawDash = function (x, t) {
    const w = 512, h = 288, bar = (i) => 0.22 + 0.7 * Math.abs(Math.sin(t * 0.6 + i * 1.3));
    x.fillStyle = '#f2f4f8'; x.fillRect(0, 0, w, h); x.fillStyle = '#1d5a60'; x.fillRect(0, 0, w, 26);
    x.fillStyle = '#fff'; x.font = `700 15px ${FONT}`; x.textBaseline = 'middle'; x.fillText('IICL  ·  dashboard', 12, 14);
    for (let i = 0; i < 3; i++) {
      x.fillStyle = '#fff'; x.fillRect(14 + i * 162, 40, 150, 62);
      x.fillStyle = '#1d5a60'; x.fillRect(24 + i * 162, 52, 40 + 90 * bar(i + 3), 8);
      x.fillStyle = '#b4573b'; x.fillRect(24 + i * 162, 70, 40, 18);
    }
    x.fillStyle = '#fff'; x.fillRect(14, 116, 300, 160);
    for (let i = 0; i < 12; i++) { const bh = 14 + 120 * bar(i); x.fillStyle = i % 3 ? '#4f9aa3' : '#1d5a60'; x.fillRect(26 + i * 23, 266 - bh, 15, bh); }
    x.fillStyle = '#fff'; x.fillRect(326, 116, 172, 160);
    x.strokeStyle = '#b4573b'; x.lineWidth = 3; x.beginPath();
    for (let i = 0; i <= 8; i++) { const px = 336 + i * 19, py = 245 - 90 * bar(i + 7); i ? x.lineTo(px, py) : x.moveTo(px, py); }
    x.stroke();
  };
  B.drawSaver = function (x, t) { // bouncing name
    const w = 512, h = 288, tw = 110, th = 40, tri = (v, m) => m - Math.abs((v % (2 * m)) - m);
    x.fillStyle = '#0b1316'; x.fillRect(0, 0, w, h);
    x.fillStyle = `hsl(${(t * 30) % 360}, 55%, 72%)`; x.font = `800 38px ${FONT}`; x.textBaseline = 'top';
    if (x.letterSpacing !== undefined) x.letterSpacing = '6px';
    x.fillText('IICL', tri(t * 58, w - tw), tri(t * 34, h - th));
  };

  /* ---------- TV slides (1024 x 576), original teal look, IICL wording ---------- */
  const slide = (draw) => {
    const c = OV.canvasOf(1024, 576), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 1024, 576); g.addColorStop(0, '#12383c'); g.addColorStop(1, '#1d5a60');
    x.fillStyle = g; x.fillRect(0, 0, 1024, 576); x.textBaseline = 'alphabetic'; draw(x);
    return OV.toTex(c, true, false);
  };
  const pill = (x, px, py, w, text, fill) => {
    x.fillStyle = fill; x.beginPath(); x.roundRect(px, py, w, 64, 32); x.fill();
    x.fillStyle = '#12383c'; x.font = `600 30px ${FONT}`; x.textBaseline = 'middle'; x.fillText(text, px + 28, py + 33); x.textBaseline = 'alphabetic';
  };
  B.slide = function () { // slide 0 (baked)
    return slide((x) => {
      x.fillStyle = '#f3efe8'; x.font = `700 78px ${FONT}`; x.fillText('IICL', 70, 170);
      x.font = `400 34px ${FONT}`; x.fillStyle = '#b8d7da'; x.fillText('Intelligence India.Com Limited · weekly sync', 74, 226);
      [0.35, 0.55, 0.45, 0.8, 0.65, 0.95].forEach((b, i) => { x.fillStyle = i % 2 ? '#b4573b' : '#e8c9a0'; x.fillRect(80 + i * 140, 520 - b * 230, 96, b * 230); });
    });
  };
  OV.makeSlides = B.slides = function () {
    const about = slide((x) => {
      x.fillStyle = '#f3efe8'; x.font = `700 52px ${FONT}`;
      ['Enterprise AI Solutions,', 'AI Automation and', 'Enterprise Technology Teams.'].forEach((l, i) => x.fillText(l, 64, 150 + i * 70));
      x.fillStyle = '#e8c9a0'; x.fillRect(64, 380, 150, 8);
      x.fillStyle = '#b8d7da'; x.font = `400 30px ${FONT}`; x.fillText('Delivery from Hyderabad, India and Seattle, USA', 64, 450);
    });
    const welcome = slide((x) => {
      x.fillStyle = '#f3efe8'; x.font = `700 84px ${FONT}`; x.fillText('Welcome', 70, 170);
      x.fillStyle = '#b8d7da'; x.font = `400 36px ${FONT}`; x.fillText('to IICL', 74, 232);
      pill(x, 74, 320, 300, 'Reception', '#e8c9a0'); pill(x, 74, 400, 420, 'Open workspace', '#e8c9a0'); pill(x, 74, 480, 380, 'Meeting room', '#e8c9a0');
    });
    const plan = slide((x) => {
      x.fillStyle = '#f3efe8'; x.font = `700 52px ${FONT}`; x.fillText('Floor plan', 60, 90);
      const ox = 72, oy = 130, s = 44;
      [['Reception', 0, 6, '#2b7a82'], ['Open workspace', 6, 14, '#4f9aa3'], ['Meeting room', 14, 20, '#b4573b']].forEach(([n, a, b, col]) => {
        x.fillStyle = col; x.fillRect(ox + a * s + 2, oy + 2, (b - a) * s - 4, 10 * s - 4);
        x.fillStyle = '#f3efe8'; x.font = `600 28px ${FONT}`; x.fillText(n, ox + a * s + 16, oy + 44);
      });
      x.fillStyle = '#12383c'; x.fillRect(ox + 6 * s - 6, oy + 4.2 * s, 12, 1.6 * s); x.fillRect(ox + 14 * s - 6, oy + 4.4 * s, 12, 1.2 * s);
    });
    return [about, welcome, plan];
  };

  /* ---------- wall art (the original abstract pieces) ---------- */
  B.art = function (kind) {
    const w = 512, h = 640, c = OV.canvasOf(w, h), x = c.getContext('2d');
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
    return OV.toTex(c, true, false);
  };
})();
