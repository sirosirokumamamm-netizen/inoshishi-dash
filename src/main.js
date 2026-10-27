import Matter from "matter-js";
import { area, centroid, splitPolygon } from "./geometry.js";
import "./style.css";
const { Engine, Bodies, Body, Composite } = Matter,
  $ = (s) => document.querySelector(s),
  W = 600,
  H = 800;
let best = 0;
try {
  best = Number(localStorage.getItem("laser-flow-best")) || 0;
} catch {}
$("#app").innerHTML =
  `<header><a href="#">L<span>／</span>S</a><span>LASER SLICER <i>FLOW</i></span><button id="settings" aria-label="設定">調整</button></header><main><aside><span class="eyebrow">A DIFFERENT KIND OF FLOW</span><h1>光を引く。<br>世界が、<br><em>ほどける。</em></h1><p>指先が、刃になる。<br>形を見て、角度を決めて、切り抜く。<br>ひとつの軌跡から、次の軌跡へ。</p><div class="guide"><b>01 ／ なぞって切断</b><p>色に関係なく、自由な軌跡で。<br>大きな破片は、もう一度切る。</p><b>02 ／ 中心を狙う</b><p>小さな断片が光に変わる。<br>赤いリングは切らずに避ける。</p><b>03 ／ オーバードライブ</b><p>切断でチャージ。発動すると<br>8秒間、消去サイズと得点が2倍。</p></div></aside><section class="game"><div class="hud"><div><small>SCORE</small><strong id="score">0</strong></div><div class="time"><small>SECONDS</small><strong id="time">60</strong></div><button id="pause" aria-label="一時停止">Ⅱ</button></div><div class="field"><canvas id="game" width="600" height="800" aria-label="ドラッグで浮遊する図形を切断。赤いリングは避けてください。"></canvas><div class="field-top"><span id="wave">SEQUENCE 01</span><span id="combo">FIND YOUR ANGLE</span></div><div id="notice" aria-live="polite"></div><div id="overlay"></div><div class="field-bottom"><span id="goal">0 / 8 CLEARED</span><span id="status">SLICE TO BEGIN</span></div></div><div class="charge"><button id="pulse" disabled><span>◈</span><b>OVERDRIVE</b><small id="charge">0%</small></button><div><i id="chargebar"></i></div></div><div class="under"><span>BEST <b id="best">${best.toLocaleString()}</b></span><span>DRAG TO SLICE · ESC TO PAUSE</span></div></section><aside class="right"><div class="orbit">／</div><span class="eyebrow">CUT WITH INTENTION</span><h2>切り方が、<br>結果を変える。</h2><p>なぞっている間はスローモーション。<br>破片を見極め、次の切断につなぐ。</p><div class="rule"><b>PRECISION → REACTION</b><p>短い間隔で切断を続けると<br>コンボが加速。目標を達成して<br>次のシークエンスへ。</p></div><small>赤いリングへの接触：−3秒<br>切り残した物体の落下：−1秒<br>小さく消去した破片はペナルティなし</small></aside></main><footer>LASER SLICER / FLOW STUDY 03<span>HEADPHONES RECOMMENDED</span></footer><dialog id="dialog"><h2>プレイ設定</h2><label>サウンド<input id="sound" type="checkbox" checked></label><label>画面揺れ・粒子・振動<input id="effects" type="checkbox" checked></label><button id="close">もどる</button></dialog>`;
const canvas = $("canvas"),
  ctx = canvas.getContext("2d"),
  engine = Engine.create({ gravity: { x: 0, y: 0.28 } }),
  palette = ["#baf1d5", "#b5cfff", "#dcc5f3", "#f4ceac"];
let pieces = [],
  debris = [],
  sparks = [],
  trails = [],
  scars = [],
  state = "title",
  score = 0,
  time = 60,
  combo = 0,
  comboClock = 0,
  gauge = 0,
  overdrive = 0,
  wave = 1,
  clears = 0,
  total = 0,
  maxCombo = 0,
  spawnClock = 0,
  last = 0,
  clock = 0,
  stroke = 0,
  drag = null,
  shake = 0,
  audio,
  uid = 0;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
$("#effects").checked = !reduced;
function tone(n = 1, deep = false) {
  if (!$("#sound").checked) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
    const o = audio.createOscillator(),
      g = audio.createGain();
    o.type = "sine";
    const t = audio.currentTime;
    o.frequency.setValueAtTime(
      deep ? 90 : 440 * Math.pow(1.07, Math.min(n, 12)),
      t,
    );
    o.frequency.exponentialRampToValueAtTime(deep ? 35 : 190, t + 0.18);
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    o.connect(g);
    g.connect(audio.destination);
    o.start();
    o.stop(t + 0.25);
  } catch {}
}
function notify(a, b = "") {
  const el = $("#notice");
  el.innerHTML = `<b>${a}</b><small>${b}</small>`;
  el.classList.remove("visible");
  void el.offsetWidth;
  el.classList.add("visible");
}
function make(
  vs,
  color,
  original,
  depth = 0,
  lastStroke = -1,
  vel = { x: 0, y: 0 },
  hazard = false,
) {
  const c = centroid(vs),
    b = Bodies.fromVertices(
      c.x,
      c.y,
      [vs],
      { frictionAir: 0.012, restitution: 0.3 },
      false,
      0,
      0,
      0,
    );
  if (!b) return;
  b.flow = {
    color,
    original: original || area(vs),
    depth,
    lastStroke,
    hazard,
    id: uid++,
    age: 0,
  };
  Body.setVelocity(b, vel);
  Body.setAngularVelocity(b, (Math.random() - 0.5) * 0.018);
  Composite.add(engine.world, b);
  pieces.push(b);
  return b;
}
function launch(initial = false) {
  const count = initial ? 8 : Math.min(5, 3 + Math.floor(wave / 3));
  for (let i = 0; i < count; i++) {
    if (pieces.length >= 40) break;
    const x = initial ? 125 + (i % 3) * 170 : 100 + Math.random() * 400,
      y = initial ? 210 + Math.floor(i / 3) * 185 : 850 + i * 65,
      r = initial ? 53 : 44 + Math.random() * 18,
      n = (i + wave) % 3 === 0 ? 6 : 4;
    const vs = Array.from({ length: n }, (_, j) => {
      const a = (j / n) * Math.PI * 2 + (n === 4 ? Math.PI / 4 : 0);
      return { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r };
    });
    const b = make(vs, palette[(i + wave) % 4], null, 0, -1, {
      x: initial ? 0 : (300 - x) * 0.007,
      y: initial ? -1 : -11 - Math.random() * 2,
    });
    if (b && initial) {
      Body.setStatic(b, true);
      b.flow.wait = true;
    }
  }
  if (wave >= 2 && !initial && pieces.length < 39) {
    const x = 140 + Math.random() * 320,
      y = 900,
      r = 26;
    make(
      Array.from({ length: 8 }, (_, i) => ({
        x: x + Math.cos((i / 8) * Math.PI * 2) * r,
        y: y + Math.sin((i / 8) * Math.PI * 2) * r,
      })),
      "#e7888b",
      null,
      0,
      -1,
      { x: (300 - x) * 0.005, y: -12 },
      true,
    );
  }
}
function sync() {
  $("#score").textContent = score.toLocaleString();
  $("#time").textContent = Math.ceil(time);
  $("#wave").textContent = `SEQUENCE ${String(wave).padStart(2, "0")}`;
  $("#combo").textContent =
    combo > 1 ? `${combo} CUT COMBO` : "FIND YOUR ANGLE";
  $("#goal").textContent = `${clears} / ${8 + wave * 2} CLEARED`;
  $("#status").textContent =
    overdrive > 0
      ? "OVERDRIVE · " + Math.ceil(overdrive) + "s"
      : drag
        ? "FOCUS ACTIVE"
        : "FREEFORM CUTTING";
  $("#charge").textContent =
    overdrive > 0 ? Math.ceil(overdrive) + "s" : Math.floor(gauge) + "%";
  $("#chargebar").style.width =
    (overdrive > 0 ? (overdrive / 8) * 100 : gauge) + "%";
  $("#pulse").disabled = gauge < 100 || state !== "playing" || overdrive > 0;
  $(".game").classList.toggle("active", overdrive > 0);
  $(".time").classList.toggle("danger", time < 10);
}
function overlay() {
  const o = $("#overlay");
  o.hidden = state === "playing";
  if (state === "title")
    o.innerHTML = `<span class="eyebrow">FREEFORM PHYSICS / 60 SECONDS</span><div class="title-mark">／</div><h2>Find your<br><em>flow.</em></h2><p>なぞった軌跡が、レーザーになる。<br>切って、分けて、小さな破片を光に。</p><button id="start">はじめる <span>↗</span></button><small>色合わせ不要 ／ マウス・タッチ対応</small>`;
  if (state === "paused")
    o.innerHTML = `<span class="eyebrow">PAUSED</span><h2>ひと呼吸。</h2><p>時間と物理演算は止まっています。</p><button id="resume">つづける ↗</button><button id="restart" class="secondary">もう一度</button>`;
  if (state === "result")
    o.innerHTML = `<span class="eyebrow">SESSION COMPLETE</span><h2>${score.toLocaleString()}</h2><p>消去 ${total}　／　最大コンボ ${maxCombo}<br>到達 SEQUENCE ${String(wave).padStart(2, "0")}</p><button id="start">もう一度、切る ↗</button>`;
  $("#start")?.addEventListener("click", start);
  $("#resume")?.addEventListener("click", () => {
    state = "playing";
    overlay();
  });
  $("#restart")?.addEventListener("click", start);
}
function start() {
  Composite.clear(engine.world, false);
  Engine.clear(engine);
  pieces = [];
  debris = [];
  sparks = [];
  trails = [];
  scars = [];
  score = 0;
  time = 60;
  combo = 0;
  gauge = 0;
  overdrive = 0;
  wave = 1;
  clears = 0;
  total = 0;
  maxCombo = 0;
  spawnClock = 0;
  drag = null;
  state = "playing";
  launch(true);
  tone(3);
  overlay();
  sync();
}
function burst(vs, color) {
  const c = centroid(vs);
  if ($("#effects").checked)
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2,
        s = 35 + Math.random() * 170;
      sparks.push({
        x: c.x,
        y: c.y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.5 + Math.random() * 0.5,
        color,
      });
    }
  debris.push({
    vs: vs.map((p) => ({ ...p })),
    color,
    life: 0.65,
    vx: (c.x - 300) * 0.002,
    vy: -1,
    angle: 0,
  });
  if (sparks.length > 500) sparks.splice(0, sparks.length - 500);
}
function cut(a, b) {
  if (Math.hypot(b.x - a.x, b.y - a.y) < 4) return;
  trails.push({ a, b, life: 0.24 });
  let hits = 0,
    removed = 0;
  for (const body of [...pieces]) {
    const f = body.flow;
    if (f.lastStroke === stroke) continue;
    const minX = Math.min(a.x, b.x),
      maxX = Math.max(a.x, b.x),
      minY = Math.min(a.y, b.y),
      maxY = Math.max(a.y, b.y);
    if (
      body.bounds.max.x < minX ||
      body.bounds.min.x > maxX ||
      body.bounds.max.y < minY ||
      body.bounds.min.y > maxY
    )
      continue;
    const parts = splitPolygon(body.vertices, a, b);
    if (!parts) continue; // Segment must cross the body, rather than extending infinitely.
    let intersects = 0;
    for (let j = 0; j < body.vertices.length; j++) {
      const p = body.vertices[j],
        q = body.vertices[(j + 1) % body.vertices.length];
      const dx = b.x - a.x,
        dy = b.y - a.y,
        ex = q.x - p.x,
        ey = q.y - p.y,
        den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-8) continue;
      const t = ((p.x - a.x) * ey - (p.y - a.y) * ex) / den,
        u = ((p.x - a.x) * dy - (p.y - a.y) * dx) / den;
      if (t >= 0 && t <= 1 && u >= 0 && u <= 1) intersects++;
    }
    if (!intersects) continue;
    f.lastStroke = stroke;
    if (f.hazard) {
      time = Math.max(0, time - 3);
      notify("INTERFERENCE", "−3秒 · 赤いリングを避けよう");
      tone(1, true);
      scars.push({ a, b, life: 0.5 });
      continue;
    }
    if (f.depth >= 7 || pieces.length >= 47) continue;
    hits++;
    Composite.remove(engine.world, body);
    pieces.splice(pieces.indexOf(body), 1);
    const nx = -(b.y - a.y) / Math.hypot(b.x - a.x, b.y - a.y),
      ny = (b.x - a.x) / Math.hypot(b.x - a.x, b.y - a.y);
    parts.forEach((vs, i) => {
      if (area(vs) <= f.original * (overdrive > 0 ? 0.64 : 0.32)) {
        burst(vs, f.color);
        removed++;
      } else {
        const child = make(vs, f.color, f.original, f.depth + 1, stroke, {
          x: body.velocity.x + nx * (i ? -2 : 2),
          y: Math.min(body.velocity.y, 1) + ny * (i ? -2 : 2) - 1.5,
        });
        if (child) child.flow.flash = 0.7;
      }
    });
    scars.push({ a, b, life: 0.3 });
  }
  if (hits) {
    combo = comboClock > 0 ? combo + hits : hits;
    comboClock = 2.2;
    maxCombo = Math.max(maxCombo, combo);
    score += Math.round(
      (hits * 40 + removed * 160) *
        (1 + Math.min(combo, 20) * 0.1) *
        (overdrive > 0 ? 2 : 1),
    );
    gauge = Math.min(100, gauge + hits * 9 + removed * 3);
    clears += removed;
    total += removed;
    shake = $("#effects").checked ? Math.min(5, hits + removed) : 0;
    tone(combo);
    if (removed >= 2 || combo >= 4)
      notify(
        removed >= 4 ? "Beautiful cut." : `${combo} cuts in flow`,
        removed ? `${removed} fragments released` : "切り口から、次の一手へ",
      );
    if (clears >= 8 + wave * 2) {
      clears = 0;
      wave++;
      time = Math.min(65, time + 3);
      notify("Sequence complete.", "＋3秒 · 次の構成へ");
      launch();
    }
    if (navigator.vibrate && $("#effects").checked) navigator.vibrate(8);
    sync();
  }
}
function point(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(W, ((e.clientX - r.left) / r.width) * W)),
    y: Math.max(0, Math.min(H, ((e.clientY - r.top) / r.height) * H)),
  };
}
canvas.onpointerdown = (e) => {
  if (state !== "playing" || drag || e.button !== 0) return;
  stroke++;
  drag = { id: e.pointerId, p: point(e), start: point(e), dist: 0 };
  canvas.setPointerCapture(e.pointerId);
};
canvas.onpointermove = (e) => {
  if (drag?.id !== e.pointerId) return;
  const events = e.getCoalescedEvents?.() || [e];
  for (const ev of events.length ? events : [e]) {
    const p = point(ev);
    drag.dist += Math.hypot(p.x - drag.p.x, p.y - drag.p.y);
    cut(drag.p, p);
    drag.p = p;
  }
};
canvas.onpointerup = (e) => {
  if (drag?.id !== e.pointerId) return;
  const p = point(e);
  cut(drag.p, p);
  if (drag.dist < 10)
    notify("光を、引いてみよう。", "物体を横切るようにドラッグ");
  drag = null;
};
canvas.onpointercancel = canvas.onlostpointercapture = () => (drag = null);
function pause() {
  if (state === "playing") {
    state = "paused";
    drag = null;
  } else if (state === "paused") state = "playing";
  overlay();
  sync();
}
$("#pause").onclick = pause;
document.onkeydown = (e) => {
  if (e.key === "Escape" && !$("#dialog").open) pause();
};
document.addEventListener("visibilitychange", () => {
  if (document.hidden && state === "playing") pause();
});
$("#settings").onclick = () => {
  if (state === "playing") pause();
  $("#dialog").showModal();
};
$("#close").onclick = () => $("#dialog").close();
$("#pulse").onclick = () => {
  if (state !== "playing" || gauge < 100) return;
  gauge = 0;
  overdrive = 8;
  notify("Overdrive.", "8秒間、消去閾値と得点が2倍");
  tone(8);
  sync();
};
function path(v) {
  ctx.beginPath();
  v.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
}
function draw(dt) {
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (shake > 0) {
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    if (dt) shake *= 0.84;
  }
  const bg = ctx.createRadialGradient(300, 350, 0, 300, 350, 560);
  bg.addColorStop(0, overdrive > 0 ? "#24382e" : "#212c32");
  bg.addColorStop(1, "#10191f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#829b9a29";
  for (let x = 30; x < 600; x += 40)
    for (let y = 40; y < 800; y += 40) {
      ctx.beginPath();
      ctx.arc(x, y, 0.8, 0, 7);
      ctx.fill();
    }
  for (const b of pieces) {
    const f = b.flow;
    if (f.hazard) {
      ctx.strokeStyle = "#ef9f9c";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.position.x, b.position.y, 24, 0, 7);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(b.position.x - 8, b.position.y - 8);
      ctx.lineTo(b.position.x + 8, b.position.y + 8);
      ctx.moveTo(b.position.x + 8, b.position.y - 8);
      ctx.lineTo(b.position.x - 8, b.position.y + 8);
      ctx.stroke();
      continue;
    }
    ctx.save();
    path(b.vertices);
    const g = ctx.createLinearGradient(
      b.position.x - 45,
      b.position.y - 45,
      b.position.x + 45,
      b.position.y + 45,
    );
    g.addColorStop(0, f.color + "ee");
    g.addColorStop(1, f.color + "65");
    ctx.shadowColor = f.color + "50";
    ctx.shadowBlur = 22;
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#ffffffaa";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.clip();
    ctx.fillStyle = "#ffffff15";
    ctx.beginPath();
    ctx.moveTo(b.position.x - 60, b.position.y - 80);
    ctx.lineTo(b.position.x + 30, b.position.y - 80);
    ctx.lineTo(b.position.x - 20, b.position.y + 80);
    ctx.lineTo(b.position.x - 110, b.position.y + 80);
    ctx.fill();
    ctx.restore();
    if (f.flash > 0) {
      path(b.vertices);
      ctx.strokeStyle = "#ffc3b0";
      ctx.lineWidth = 2;
      ctx.stroke();
      f.flash -= dt;
    }
  }
  for (const d of debris) {
    d.life -= dt;
    d.vy += dt * 4;
    d.vs.forEach((v) => {
      v.x += d.vx * dt * 60;
      v.y += d.vy * dt * 60;
    });
    ctx.globalAlpha = Math.max(0, d.life / 0.65);
    path(d.vs);
    ctx.fillStyle = d.color + "70";
    ctx.fill();
    ctx.strokeStyle = d.color;
    ctx.stroke();
  }
  debris = debris.filter((d) => d.life > 0);
  ctx.globalAlpha = 1;
  for (const p of sparks) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 70 * dt;
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.6, 0, 7);
    ctx.fill();
  }
  sparks = sparks.filter((p) => p.life > 0);
  ctx.globalAlpha = 1;
  for (const t of trails) {
    t.life -= dt;
    ctx.globalAlpha = Math.max(0, t.life / 0.24);
    ctx.strokeStyle = overdrive > 0 ? "#c7f2ce" : "#f2eee4";
    ctx.shadowColor = "#d4f5ff";
    ctx.shadowBlur = 15;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(t.a.x, t.a.y);
    ctx.lineTo(t.b.x, t.b.y);
    ctx.stroke();
  }
  trails = trails.filter((t) => t.life > 0);
  scars = scars.filter((s) => (s.life -= dt) > 0);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  if (drag) {
    ctx.strokeStyle = "#ffffff77";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(drag.p.x, drag.p.y, 18, 0, 7);
    ctx.stroke();
  }
  ctx.restore();
}
function frame(t) {
  const real = Math.min((t - last) / 1000 || 0, 0.05);
  last = t;
  let dt = 0;
  if (state === "playing") {
    time = Math.max(0, time - real);
    clock += real;
    comboClock = Math.max(0, comboClock - real);
    if (!comboClock) combo = 0;
    overdrive = Math.max(0, overdrive - real);
    dt = real * (drag ? 0.18 : overdrive > 0 ? 0.7 : 1);
    Engine.update(engine, dt * 1000);
    spawnClock += real;
    for (const b of [...pieces]) {
      b.flow.age += dt;
      if (b.position.y > 960 || b.position.x < -150 || b.position.x > 750) {
        Composite.remove(engine.world, b);
        pieces.splice(pieces.indexOf(b), 1);
        if (!b.flow.hazard) {
          time = Math.max(0, time - 1);
          notify("Lost fragment", "−1秒");
        }
      }
    }
    if (spawnClock > 3.7 || pieces.length < 3) {
      spawnClock = 0;
      launch();
    }
    if (time <= 0) {
      state = "result";
      drag = null;
      best = Math.max(best, score);
      try {
        localStorage.setItem("laser-flow-best", String(best));
      } catch {}
      $("#best").textContent = best.toLocaleString();
      overlay();
    }
    sync();
  }
  draw(dt);
  requestAnimationFrame(frame);
}
overlay();
sync();
requestAnimationFrame(frame);
