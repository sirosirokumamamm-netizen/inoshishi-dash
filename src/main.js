import Matter from "matter-js";
import { area, centroid, splitPolygon, extendLine } from "./geometry.js";
import { stages } from "./stages.js";
import "@fontsource/barlow-condensed/latin-500.css";
import "@fontsource/barlow-condensed/latin-600.css";
import "@fontsource/barlow-condensed/latin-700.css";
import "@fontsource/barlow-condensed/latin-800.css";
import "./style.css";
const { Engine, Bodies, Body, Composite } = Matter;
const icons = {
  bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-7l1-7Z"/>',
  play: '<path d="m8 5 11 7-11 7Z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  reset: '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
  settings: '<path d="M4 7h16M4 17h16M8 4v6M16 14v6"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  sound:
    '<path d="m11 5-6 4H2v6h3l6 4V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
};
const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
function readSave() {
  try {
    return JSON.parse(localStorage.getItem("laser-slicer-v1")) || {};
  } catch {
    return {};
  }
}
let saved = readSave();
let records =
  saved.records && typeof saved.records === "object" ? saved.records : {};
const reducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;
let settings = {
  sound: true,
  vibration: true,
  shake: !reducedMotion,
  effects: !reducedMotion,
  ...saved.settings,
};
function persist() {
  try {
    localStorage.setItem(
      "laser-slicer-v1",
      JSON.stringify({ records, settings }),
    );
  } catch {
    /* Private mode may disable storage; play remains available. */
  }
}
document.querySelector("#app").innerHTML = `
<header class="header"><a class="brand" href="#" aria-label="タイトルへ"><span class="brand-mark">${icon("bolt")}</span> LASER<span class="brand-light">SLICER</span><span class="beta">BETA</span></a><div class="header-right"><span class="browser-label"><i></i> ブラウザで、ひと切り。</span><button class="icon-button" id="sound" aria-label="サウンド切替">${icon("sound")}</button><button class="icon-button" id="settings" aria-label="設定">${icon("settings")}</button></div></header>
<main class="layout">
<aside class="left-panel"><div class="eyebrow">THE ART OF A SINGLE CUT</div><h1>狙って。<br>切って。<br><span>連鎖する。</span></h1><p class="intro">ひと筋の光で、解き放て。<br>少ない一手が、大きな答えになる。</p><div class="section-label"><span>STAGE SELECT</span><span id="completed">00 / 06</span></div><nav id="stages" aria-label="ステージ選択"></nav><div class="local-note"><span class="tiny-dot"></span>進行状況はこのブラウザに保存されます</div></aside>
<section class="game-column" aria-label="ゲーム"><div class="game-heading"><div><span class="eyebrow" id="stage-number">STAGE 01</span><h2 id="stage-name"></h2></div><div class="game-actions"><button class="icon-button" id="restart" aria-label="ステージをやり直す">${icon("reset")}</button><button class="icon-button" id="pause" aria-label="一時停止">${icon("pause")}</button></div></div>
<div class="mobile-hud"><span>SCORE <b id="mobile-score">00000</b></span><span>SHOTS <b id="mobile-shots">05</b></span><span>CLEARED <b id="mobile-clear">0%</b></span></div><div class="arena-wrap"><div class="arena-top"><span><i></i> LASER FIELD</span><span id="arena-status">READY TO SLICE</span></div><canvas id="game" width="600" height="700" aria-label="ブロック切断フィールド。ドラッグして離すと発射します。"></canvas><div class="arena-corners"><span>＋</span><span>＋</span></div><div class="field-tip" id="field-tip">DRAG TO AIM <span>→</span> RELEASE TO SLICE</div><div class="overlay" id="overlay"></div><div id="toast" role="status" aria-live="polite"></div></div>
<div class="bottom-bar"><span>${icon("target")}スワイプして狙う、離して切断</span><button id="help">遊び方 <span>↗</span></button></div></section>
<aside class="right-panel"><div class="eyebrow">YOUR SESSION</div><div class="score-box"><span class="metric-label">SCORE</span><div id="score">00000</div><span class="best">BEST <b id="best">—</b></span></div><div class="stats-row"><div><span class="metric-label">SHOTS LEFT</span><div class="shot-number"><b id="shots">05</b><span id="total-shots">/ 05</span></div></div><span class="shot-symbol">${icon("bolt")}</span></div><div class="clear-box"><div class="clear-title"><span class="metric-label">CLEARED</span><strong><span id="cleared">0</span><small>%</small></strong></div><div class="progress-track"><div id="clear-bar"></div><i></i></div><div class="progress-caption"><span>0%</span><span>GOAL 80%</span></div></div><div class="pulse-card"><div class="pulse-heading"><span>${icon("bolt")} CHAIN PULSE</span><b id="pulse-percent">0%</b></div><p>次の一手に、もうひとつの力を。</p><div class="pulse-track"><div id="pulse-bar"></div></div><button id="pulse" disabled>${icon("bolt")}パルスを起動<span>↑</span></button><span class="pulse-note">切断でチャージ · 次の連鎖ボーナス ×2</span></div><div class="mission"><div class="eyebrow">MISSION BRIEF</div><p id="hint"></p><div>${icon("check")}面積の80%を消去してクリア</div><div>${icon("check")}95%以上で最高評価を目指そう</div></div><div class="mini-legend"><i></i>小さく切るほど、光になる。</div></aside>
</main><footer><span>LESS SHOTS. MORE SATISFACTION.</span><span>LASER SLICER <b> / </b> VOL. 01</span></footer><dialog id="dialog"></dialog>`;
const $ = (s) => document.querySelector(s);
const canvas = $("#game"),
  ctx = canvas.getContext("2d");
const W = 600,
  H = 700;
const engine = Engine.create({ gravity: { x: 0, y: 0.25 } });
let bodies = [],
  particles = [],
  beams = [],
  floats = [];
let stageIndex = 0,
  shots = 0,
  score = 0,
  clearedArea = 0,
  initialArea = 0,
  gauge = 0,
  armed = false;
let state = "title",
  aim = null,
  settling = 0,
  shake = 0,
  lastTime = 0,
  simAccumulator = 0;
let audio;
function tone(type, count = 1) {
  if (!settings.sound) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
    const notes =
      type === "win"
        ? [523, 659, 784, 1047]
        : type === "miss"
          ? [140]
          : type === "pulse"
            ? [330, 660]
            : [800 + Math.min(count, 8) * 75, 320];
    notes.forEach((freq, i) => {
      const o = audio.createOscillator(),
        g = audio.createGain();
      o.type = type === "win" ? "sine" : "triangle";
      o.frequency.setValueAtTime(freq, audio.currentTime + i * 0.085);
      o.frequency.exponentialRampToValueAtTime(
        Math.max(60, freq * 0.45),
        audio.currentTime + i * 0.085 + 0.15,
      );
      g.gain.setValueAtTime(0.045, audio.currentTime + i * 0.085);
      g.gain.exponentialRampToValueAtTime(
        0.001,
        audio.currentTime + i * 0.085 + 0.22,
      );
      o.connect(g);
      g.connect(audio.destination);
      o.start(audio.currentTime + i * 0.085);
      o.stop(audio.currentTime + i * 0.085 + 0.23);
    });
  } catch {
    /* Audio is optional. */
  }
}
function vibrate(pattern) {
  if (settings.vibration && navigator.vibrate) navigator.vibrate(pattern);
}
function notify(text) {
  $("#toast").textContent = text;
  $("#toast").classList.add("show");
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => $("#toast").classList.remove("show"), 2000);
}
function updateStageList() {
  $("#stages").innerHTML = stages
    .map(
      (s, i) =>
        `<button class="stage-item ${i === stageIndex ? "active" : ""}" data-stage="${i}" ${i === stageIndex ? 'aria-current="true"' : ""}><span class="stage-index">${String(i + 1).padStart(2, "0")}</span><span class="stage-info"><b>${s.name}</b><small>${i === 0 ? "はじめの一歩" : i === 1 ? "切断を重ねる" : i === 2 ? "斜めの可能性" : i === 3 ? "均等の美学" : i === 4 ? "連鎖をつくる" : "光を極める"}</small></span><span class="stage-end">${records[i]?.stars ? "★".repeat(records[i].stars) : i === stageIndex ? "↗" : "—"}</span></button>`,
    )
    .join("");
  $("#completed").textContent =
    `${String(Object.values(records).filter((r) => r.stars > 0).length).padStart(2, "0")} / 06`;
  document
    .querySelectorAll("[data-stage]")
    .forEach(
      (b) => (b.onclick = () => loadStage(Number(b.dataset.stage), true)),
    );
}
function sync() {
  $("#score").textContent = String(score).padStart(5, "0");
  $("#mobile-score").textContent = String(score).padStart(5, "0");
  $("#mobile-shots").textContent = String(shots).padStart(2, "0");
  $("#shots").textContent = String(shots).padStart(2, "0");
  $("#total-shots").textContent =
    `/ ${String(stages[stageIndex].shots).padStart(2, "0")}`;
  const percent = Math.min(100, (clearedArea / initialArea) * 100) || 0;
  $("#cleared").textContent =
    percent >= 99.99 ? "100" : String(Math.floor(percent));
  $("#mobile-clear").textContent = `${$("#cleared").textContent}%`;
  $("#clear-bar").style.width = `${percent}%`;
  $("#pulse-percent").textContent = armed ? "ARMED" : `${Math.floor(gauge)}%`;
  $("#pulse-bar").style.width = `${gauge}%`;
  $("#pulse").disabled = gauge < 100 || armed || state !== "playing";
  $("#pulse").innerHTML =
    `${icon("bolt")}${armed ? "次のショットで発動" : "パルスを起動"}<span>↑</span>`;
  $(".pulse-card").classList.toggle("armed", armed);
  $("#best").textContent = records[stageIndex]?.score?.toLocaleString() || "—";
  $("#arena-status").textContent =
    state === "playing"
      ? settling > 0
        ? "FRAGMENTS IN MOTION"
        : armed
          ? "PULSE ARMED"
          : "READY TO SLICE"
      : state === "paused"
        ? "PAUSED"
        : state === "won"
          ? "MISSION COMPLETE"
          : state === "lost"
            ? "OUT OF SHOTS"
            : "AWAITING INPUT";
  $("#sound").classList.toggle("muted", !settings.sound);
  $("#sound").setAttribute(
    "aria-label",
    settings.sound ? "サウンドをオフ" : "サウンドをオン",
  );
}
function makePiece(
  vertices,
  color,
  depth = 0,
  isStatic = false,
  velocity = { x: 0, y: 0 },
) {
  const c = centroid(vertices);
  const body = Bodies.fromVertices(
    c.x,
    c.y,
    [vertices],
    {
      friction: 0.45,
      frictionAir: 0.035,
      restitution: 0.12,
      isStatic,
      slop: 0.01,
    },
    false,
    0,
    0,
    0,
  );
  if (!body) return null;
  body.game = { color, depth, area: area(vertices) };
  Body.setVelocity(body, velocity);
  Composite.add(engine.world, body);
  bodies.push(body);
  return body;
}
function loadStage(index, play = false) {
  stageIndex = index;
  Composite.clear(engine.world, false);
  Engine.clear(engine);
  bodies = [];
  particles = [];
  beams = [];
  floats = [];
  aim = null;
  settling = 0;
  simAccumulator = 0;
  shake = 0;
  Composite.add(engine.world, [
    Bodies.rectangle(300, 680, 600, 40, { isStatic: true, friction: 0.6 }),
    Bodies.rectangle(-15, 350, 30, 700, { isStatic: true }),
    Bodies.rectangle(615, 350, 30, 700, { isStatic: true }),
    Bodies.rectangle(300, -30, 600, 60, { isStatic: true }),
  ]);
  const s = stages[index];
  initialArea = 0;
  s.blocks.forEach((b) => {
    const vs = [
      { x: b.x - b.w / 2, y: b.y - b.h / 2 },
      { x: b.x + b.w / 2, y: b.y - b.h / 2 },
      { x: b.x + b.w / 2, y: b.y + b.h / 2 },
      { x: b.x - b.w / 2, y: b.y + b.h / 2 },
    ];
    initialArea += area(vs);
    makePiece(vs, b.color, 0, true);
  });
  shots = s.shots;
  score = 0;
  clearedArea = 0;
  gauge = 0;
  armed = false;
  state = play ? "playing" : "title";
  $("#stage-name").textContent = s.name;
  $("#stage-number").textContent =
    `STAGE ${String(index + 1).padStart(2, "0")}`;
  $("#hint").textContent = s.hint;
  $("#field-tip").classList.remove("hidden");
  updateStageList();
  sync();
  showOverlay();
}
function showOverlay() {
  const o = $("#overlay");
  o.className = `overlay ${state === "playing" ? "hidden" : ""}`;
  if (state === "playing") {
    o.innerHTML = "";
    return;
  }
  if (state === "title")
    o.innerHTML = `<div class="overlay-content title-content"><span class="eyebrow">A LITTLE FOCUS. A LOT OF LIGHT.</span><div class="title-emblem">${icon("bolt")}</div><h2>LASER<br><span>SLICER</span><i>®</i></h2><p>ひと筋の光で、<br>パズルを解き放とう。</p><button class="primary" id="start">プレイする ${icon("arrow")}</button><small>ドラッグで照準 · 離してスライス</small></div>`;
  if (state === "paused")
    o.innerHTML = `<div class="overlay-content"><span class="eyebrow">TAKE A BREATH</span><h2>ひと休み。</h2><p>次の一手を、ゆっくり考えよう。</p><button class="primary" id="resume">ゲームに戻る ${icon("play")}</button><button class="secondary" id="retry">最初からやり直す</button></div>`;
  if (state === "won" || state === "lost") {
    const won = state === "won",
      r = won ? records[stageIndex] : null;
    o.innerHTML = `<div class="overlay-content result"><span class="eyebrow">${won ? "MISSION COMPLETE" : "ANOTHER CUT, ANOTHER CHANCE"}</span><div class="result-stars">${won ? "★".repeat(r.lastStars) + "☆".repeat(3 - r.lastStars) : "↻"}</div><h2>${won ? "鮮やかな、一手。" : "あと、ひと切り。"}</h2><p>${won ? "光の軌跡が、答えになった。" : "切る位置を変えれば、結果も変わる。"}</p><div class="result-stats"><span>SCORE<b>${score.toLocaleString()}</b></span><span>CLEARED<b>${((clearedArea / initialArea) * 100).toFixed(1)}<small>%</small></b></span></div>${won ? `<p class="result-bonus">残り ${shots} ショット · 効率ボーナス +${shots * 500}</p>` : ""}<button class="primary" id="next">${won ? (stageIndex === stages.length - 1 ? "ステージ一覧へ" : "次のステージへ") : "もう一度挑戦"} ${icon("arrow")}</button>${won ? '<button class="secondary" id="retry">このステージをもう一度</button>' : '<button class="secondary" id="choose">ステージを選ぶ</button>'}</div>`;
  }
  $("#start")?.addEventListener("click", () => {
    state = "playing";
    tone("pulse");
    sync();
    showOverlay();
  });
  $("#resume")?.addEventListener("click", resume);
  $("#retry")?.addEventListener("click", () => loadStage(stageIndex, true));
  $("#next")?.addEventListener("click", () => {
    if (state === "won" && stageIndex === stages.length - 1) showStagePicker();
    else loadStage(state === "won" ? stageIndex + 1 : stageIndex, true);
  });
  $("#choose")?.addEventListener("click", showStagePicker);
}
function endGame(won) {
  state = won ? "won" : "lost";
  armed = false;
  if (won) {
    score += shots * 500;
    const pct = clearedArea / initialArea;
    const stars = pct >= 0.95 ? 3 : shots >= 2 ? 2 : 1;
    records[stageIndex] = {
      score: Math.max(records[stageIndex]?.score || 0, score),
      stars: Math.max(records[stageIndex]?.stars || 0, stars),
      lastStars: stars,
    };
    persist();
    tone("win");
    vibrate([25, 40, 45]);
    updateStageList();
  } else tone("miss");
  sync();
  showOverlay();
}
function burst(poly, color) {
  if (!settings.effects) return;
  const c = centroid(poly);
  for (let i = 0; i < Math.min(26, 8 + area(poly) / 400); i++) {
    const a = Math.random() * Math.PI * 2,
      s = 1 + Math.random() * 4;
    particles.push({
      x: c.x + (Math.random() - 0.5) * 40,
      y: c.y + (Math.random() - 0.5) * 40,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 1,
      color,
      size: 1 + Math.random() * 3,
    });
  }
  if (particles.length > 500) particles.splice(0, particles.length - 500);
}
function fire(a, b) {
  if (state !== "playing" || settling > 0 || shots <= 0) return;
  if (Math.hypot(b.x - a.x, b.y - a.y) < 24) {
    notify("24px以上ドラッグして、方向を決めよう");
    return;
  }
  const [p, q] = extendLine(a, b, W, H),
    dx = q.x - p.x,
    dy = q.y - p.y,
    len = Math.hypot(dx, dy),
    normal = { x: -dy / len, y: dx / len };
  shots--;
  let hit = 0,
    removed = 0,
    removedArea = 0,
    limited = false;
  const pulse = armed;
  armed = false;
  for (const body of [...bodies]) {
    const parts = splitPolygon(body.vertices, p, q);
    if (!parts) continue;
    if (body.game.depth >= 8) {
      limited = true;
      continue;
    }
    const survivors = parts.filter(
      (v) => area(v) > stages[stageIndex].threshold,
    );
    if (bodies.length - 1 + survivors.length > 50) {
      limited = true;
      continue;
    }
    hit++;
    Composite.remove(engine.world, body);
    bodies.splice(bodies.indexOf(body), 1);
    parts.forEach((vs, i) => {
      const size = area(vs);
      if (size <= stages[stageIndex].threshold) {
        removed++;
        removedArea += size;
        burst(vs, body.game.color);
      } else {
        const child = makePiece(
          vs,
          body.game.color,
          body.game.depth + 1,
          false,
          {
            x: body.velocity.x + normal.x * (i === 0 ? 1.1 : -1.1),
            y: body.velocity.y + normal.y * (i === 0 ? 1.1 : -1.1) - 0.6,
          },
        );
        if (child) {
          Body.setAngularVelocity(child, (i === 0 ? 1 : -1) * 0.007);
          child.game.flash = 1;
        }
      }
    });
  }
  clearedArea = Math.min(initialArea, clearedArea + removedArea);
  const base = Math.round((removedArea / initialArea) * 10000),
    bonus =
      removed >= 2
        ? Math.round(base * (Math.min(removed, 10) - 1) * 0.12) *
          (pulse ? 2 : 1)
        : 0;
  score += base + bonus;
  gauge = pulse ? 0 : Math.min(100, gauge + (hit ? 22 + hit * 4 : 0));
  beams.push({ a: p, b: q, life: 1, pulse });
  shake = settings.shake && hit ? (removed > 3 ? 7 : 3) : 0;
  if (hit) {
    tone("slice", removed || hit);
    vibrate(removed > 3 ? [20, 20, 30] : 12);
    settling = 0.65;
    const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    floats.push({
      x: center.x,
      y: center.y,
      text: removed >= 2 ? `${removed} CHAIN` : "SLICE",
      sub:
        base + bonus
          ? `+${(base + bonus).toLocaleString()}${pulse ? " · PULSE ×2" : ""}`
          : "もう一度、小さく",
      life: 1.6,
    });
  } else {
    tone("miss");
    notify(
      limited
        ? "分割上限です。別の破片を狙おう"
        : "空振り。次はブロックの内側を狙おう。",
    );
    settling = 0.25;
  }
  $("#field-tip").classList.add("hidden");
  sync();
}
function point(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(W, ((e.clientX - r.left) / r.width) * W)),
    y: Math.max(0, Math.min(H, ((e.clientY - r.top) / r.height) * H)),
  };
}
canvas.addEventListener("pointerdown", (e) => {
  if (e.button !== 0 || state !== "playing") return;
  if (settling > 0) {
    notify("破片が落ち着くまで、少し待とう");
    return;
  }
  canvas.setPointerCapture(e.pointerId);
  aim = { a: point(e), b: point(e), id: e.pointerId };
});
canvas.addEventListener("pointermove", (e) => {
  if (aim?.id === e.pointerId) aim.b = point(e);
});
canvas.addEventListener("pointerup", (e) => {
  if (!aim || aim.id !== e.pointerId) return;
  const a = aim.a,
    b = point(e);
  aim = null;
  fire(a, b);
});
canvas.addEventListener("pointercancel", () => (aim = null));
canvas.addEventListener("lostpointercapture", () => (aim = null));
function pause() {
  if (state !== "playing") return;
  aim = null;
  state = "paused";
  sync();
  showOverlay();
}
function resume() {
  state = "playing";
  sync();
  showOverlay();
}
$("#pause").onclick = () => {
  if (state === "paused") resume();
  else pause();
};
$("#restart").onclick = () => {
  if (state === "playing" && shots < stages[stageIndex].shots) {
    pause();
    openDialog(
      `<span class="eyebrow">START FRESH</span><h2>やり直しますか？</h2><p>このプレイのスコアと切断状態をリセットします。</p><button class="primary" id="confirm-retry">やり直す ${icon("reset")}</button>`,
    );
    $("#confirm-retry").onclick = () => {
      $("#dialog").close();
      loadStage(stageIndex, true);
    };
  } else loadStage(stageIndex, true);
};
$("#pulse").onclick = () => {
  if (gauge < 100 || state !== "playing" || armed) return;
  armed = true;
  gauge = 0;
  tone("pulse");
  notify("パルス起動。次の連鎖ボーナス ×2");
  sync();
};
$("#sound").onclick = () => {
  settings.sound = !settings.sound;
  persist();
  sync();
  if (settings.sound) tone("pulse");
};
$(".brand").onclick = (e) => {
  e.preventDefault();
  pause();
  openDialog(
    `<span class="eyebrow">LASER SLICER</span><h2>ひと筋の光から。</h2><p>切る角度を考えて、80%以上を消去。<br>6つのステージで、次の一手を見つけよう。</p><button class="primary" id="title-stages">ステージを選ぶ ${icon("arrow")}</button>`,
  );
  $("#title-stages").onclick = () => {
    $("#dialog").close();
    showStagePicker();
  };
};
function openDialog(content) {
  if (state === "playing") pause();
  $("#dialog").innerHTML =
    `<button class="dialog-close icon-button" aria-label="閉じる">${icon("close")}</button>${content}`;
  $(".dialog-close").onclick = () => $("#dialog").close();
  $("#dialog").showModal();
}
function showStagePicker() {
  openDialog(
    `<span class="eyebrow">FIND YOUR NEXT CUT</span><h2>ステージを選ぶ</h2><div class="dialog-stages">${stages.map((s, i) => `<button class="secondary" data-pick="${i}"><span>${String(i + 1).padStart(2, "0")}　${s.name}</span><span>${records[i]?.stars ? "★".repeat(records[i].stars) : "→"}</span></button>`).join("")}</div>`,
  );
  document.querySelectorAll("[data-pick]").forEach(
    (b) =>
      (b.onclick = () => {
        $("#dialog").close();
        loadStage(Number(b.dataset.pick), true);
      }),
  );
}
$("#help").onclick = () =>
  openDialog(
    `<span class="eyebrow">HOW TO SLICE</span><h2>少ない一手で、大きく。</h2><ol class="help-list"><li><b>ドラッグで狙う</b><p>24px以上ドラッグすると、方向に沿ってレーザーが画面端まで延びます。指を離すと1ショット。</p></li><li><b>小さく切って、光に変える</b><p>小さな破片は消滅。大きな破片は落下し、もう一度切断できます。空振りも1ショット消費します。</p></li><li><b>80%以上を消去</b><p>ショットが尽きる前に目標達成でクリア。95%以上で★3、80%以上かつ残り2ショット以上で★2。</p></li><li><b>連鎖をパルスで強化</b><p>1ショットで複数消去すると連鎖ボーナス。ゲージ満タンで起動すると、次の1ショットの連鎖ボーナスが2倍になります。</p></li></ol><p class="dialog-note">Esc：一時停止 ／ Space：パルス<br>サウンド・振動・画面揺れ・粒子は設定から変更できます。</p>`,
  );
$("#settings").onclick = () => {
  openDialog(
    `<span class="eyebrow">MAKE IT YOURS</span><h2>プレイ設定</h2><p>あなたにちょうどいい、光と音を。</p><div class="setting-list">${[
      ["sound", "サウンド", "レーザー・連鎖・クリア音"],
      ["vibration", "振動", "対応端末でのみ動作します"],
      ["shake", "画面揺れ", "切断時の小さなインパクト"],
      ["effects", "パーティクル", "消去時のネオン粒子"],
    ]
      .map(
        ([key, label, desc]) =>
          `<label><span><b>${label}</b><small>${desc}</small></span><input type="checkbox" data-setting="${key}" ${settings[key] ? "checked" : ""}></label>`,
      )
      .join(
        "",
      )}</div><p class="dialog-note">記録と設定はこのブラウザに保存されます。<br>ステージはすべて自由に選べます。</p>`,
  );
  document.querySelectorAll("[data-setting]").forEach(
    (input) =>
      (input.onchange = () => {
        settings[input.dataset.setting] = input.checked;
        persist();
        sync();
      }),
  );
};
document.addEventListener("keydown", (e) => {
  if (e.target.matches("button,input") || $("#dialog").open) return;
  if (e.key === "Escape") {
    if (state === "playing") pause();
    else if (state === "paused") resume();
  }
  if (e.code === "Space" && state === "playing") {
    e.preventDefault();
    $("#pulse").click();
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause();
});
function path(poly) {
  ctx.beginPath();
  poly.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
}
function draw(dt) {
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (shake > 0) {
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    if (dt > 0) shake *= 0.87;
  }
  ctx.fillStyle = "#15191b";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#303638";
  for (let x = 24; x < W; x += 28)
    for (let y = 20; y < H; y += 28) {
      ctx.beginPath();
      ctx.arc(x, y, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  const glow = ctx.createRadialGradient(300, 350, 0, 300, 350, 370);
  glow.addColorStop(0, "rgba(163,202,113,.035)");
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#343b3c";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(30, 657);
  ctx.lineTo(570, 657);
  ctx.stroke();
  ctx.fillStyle = "#59605c";
  ctx.font = "9px monospace";
  ctx.fillText("CONTAINMENT FLOOR", 32, 675);
  ctx.textAlign = "right";
  ctx.fillText("FIELD / 600 × 700", 570, 675);
  ctx.textAlign = "left";
  bodies.forEach((body) => {
    const { color } = body.game;
    ctx.save();
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 9;
    path(body.vertices);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    const c = body.position;
    const g = ctx.createLinearGradient(c.x - 60, c.y - 60, c.x + 60, c.y + 60);
    g.addColorStop(0, "rgba(255,255,255,.14)");
    g.addColorStop(1, "rgba(0,0,0,.12)");
    path(body.vertices);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.38)";
    ctx.lineWidth = 1.4;
    ctx.stroke();
    // Subtle material engraving follows the body's rotation.
    path(body.vertices);
    ctx.clip();
    ctx.translate(c.x, c.y);
    ctx.rotate(body.angle);
    ctx.fillStyle = "rgba(27,34,24,.28)";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText(
      body.game.depth
        ? "FRAGMENT"
        : "SLICE / " + String(stageIndex + 1).padStart(2, "0"),
      0,
      4,
    );
    ctx.textAlign = "left";
    ctx.restore();
    if (body.game.flash > 0) {
      path(body.vertices);
      ctx.strokeStyle = `rgba(255,86,94,${body.game.flash})`;
      ctx.lineWidth = 3;
      ctx.shadowColor = "#ff4b64";
      ctx.shadowBlur = 14;
      ctx.stroke();
      ctx.shadowBlur = 0;
      body.game.flash -= dt * 1.5;
    }
  });
  if (aim && Math.hypot(aim.b.x - aim.a.x, aim.b.y - aim.a.y) > 8) {
    const [a, b] = extendLine(aim.a, aim.b, W, H);
    ctx.save();
    ctx.setLineDash([8, 7]);
    ctx.strokeStyle = armed ? "#c5f56b" : "#ff6579";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
    for (const p of [aim.a, aim.b]) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
  beams.forEach((b) => {
    ctx.save();
    ctx.globalAlpha = b.life;
    ctx.strokeStyle = b.pulse ? "#c5f56b" : "#ff546b";
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 22;
    ctx.lineWidth = 7 * b.life;
    ctx.beginPath();
    ctx.moveTo(b.a.x, b.a.y);
    ctx.lineTo(b.b.x, b.b.y);
    ctx.stroke();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2 * b.life;
    ctx.stroke();
    ctx.restore();
    b.life -= dt * 3;
  });
  beams = beams.filter((b) => b.life > 0);
  particles.forEach((p) => {
    p.x += p.vx * dt * 60;
    p.y += p.vy * dt * 60;
    p.vy += dt * 2;
    p.life -= dt * 1.5;
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  });
  particles = particles.filter((p) => p.life > 0);
  ctx.globalAlpha = 1;
  floats.forEach((f) => {
    f.y -= dt * 18;
    f.life -= dt;
    ctx.save();
    ctx.globalAlpha = Math.min(1, Math.max(0, f.life * 2));
    ctx.textAlign = "center";
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 8;
    ctx.fillStyle = "#f0ffdb";
    ctx.font = "bold 29px monospace";
    ctx.fillText(f.text, Math.max(100, Math.min(500, f.x)), Math.max(90, f.y));
    ctx.fillStyle = "#c5f56b";
    ctx.font = "14px monospace";
    ctx.fillText(
      f.sub,
      Math.max(100, Math.min(500, f.x)),
      Math.max(90, f.y) + 24,
    );
    ctx.restore();
  });
  floats = floats.filter((f) => f.life > 0);
  ctx.restore();
}
function frame(now) {
  const dt = Math.min((now - lastTime) / 1000 || 0, 1 / 30);
  lastTime = now;
  if (state === "playing") {
    if (!aim) {
      simAccumulator += dt;
      let steps = 0;
      while (simAccumulator >= 1 / 60 && steps < 3) {
        Engine.update(engine, 1000 / 60);
        simAccumulator -= 1 / 60;
        steps++;
      }
    }
    if (settling > 0 && !aim) {
      settling = Math.max(0, settling - dt);
      if (settling === 0) {
        if (clearedArea / initialArea >= 0.8 - 1e-8) endGame(true);
        else if (shots === 0) endGame(false);
        else sync();
      }
    }
  }
  // Pausing freezes all gameplay effects as well as physics.
  draw(state === "playing" ? dt : 0);
  requestAnimationFrame(frame);
}
loadStage(0);
requestAnimationFrame(frame);
