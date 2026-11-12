(function () {
  var c = document.getElementById("matrix");
  if (!c || !c.getContext) return;
  var ctx = c.getContext("2d");
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var SIZE = 16, TRAIL = 14, cols = 0, drops = [], glyphs = {}, dpr = Math.min(window.devicePixelRatio || 1, 2);
  function accent() {
    return getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#1d8a66";
  }
  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    c.width = w * dpr; c.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(w / SIZE);
    drops = [];
    glyphs = {};
    for (var i = 0; i < cols; i++) drops.push(Math.random() * (h / SIZE + TRAIL));
  }
  function draw() {
    var w = window.innerWidth, h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);
    if (Object.keys(glyphs).length > 20000) glyphs = {};
    ctx.font = SIZE + "px 'JetBrains Mono', ui-monospace, monospace";
    ctx.fillStyle = accent();
    for (var i = 0; i < cols; i++) {
      for (var k = 0; k < TRAIL; k++) {
        var row = drops[i] - k;
        var y = row * SIZE;
        if (y < -SIZE || y > h + SIZE) continue;
        ctx.globalAlpha = 0.26 * (1 - k / TRAIL);
        var key = i + ":" + Math.floor(row);
        if (!glyphs[key] || Math.random() < 0.002) {
          glyphs[key] = Math.random() < 0.7
            ? String.fromCharCode(0x30A0 + Math.floor(Math.random() * 96))
            : String(Math.floor(Math.random() * 10));
        }
        ctx.fillText(glyphs[key], i * SIZE, y);
      }
      if (!reduce) {
        drops[i] += 0.12 + ((i * 37) % 7) * 0.02;
        if (drops[i] - TRAIL > h / SIZE) drops[i] = -Math.random() * 20;
      }
    }
    ctx.globalAlpha = 1;
    if (!reduce) requestAnimationFrame(draw);
  }
  resize();
  window.addEventListener("resize", resize);
  draw();
})();
