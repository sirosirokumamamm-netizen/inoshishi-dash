import { CollapseWorld, levels } from "./collapse.js";
import "./style.css";
const $ = (s) => document.querySelector(s),
  W = 600,
  H = 800;
let records = {};
try {
  records = JSON.parse(localStorage.getItem("laser-collapse-v1")) || {};
} catch {}
$("#app").innerHTML =
  `<header><a href="#">L<span>／</span>S</a><span>LASER SLICER <i>CASCADE</i></span><button id="settings" aria-label="設定">調整</button></header><main><aside><span class="eyebrow">ONE CUT. EVERYTHING CHANGES.</span><h1>支えを切る。<br>崩れが、<br><em>答えになる。</em></h1><p>どちらを切り、どちらを残すか。<br>自分の一手が、落下の行き先を変える。</p><nav id="stages" aria-label="ステージ選択"></nav><div class="guide"><b>01 ／ 金色は切れる支え</b><p>切ると足場が傾く。両側を切れば落下。</p><b>02 ／ 緑の受け皿に運ぶ</b><p>結晶面積の80%を回収してクリア。<br>赤い範囲へ落とすと取り戻せない。</p><b>03 ／ 紫は共鳴コア</b><p>衝突と受け皿への落下で起動。<br>周囲を消去し、近くのコアへ連鎖する。</p></div></aside><section class="game"><div class="hud"><div><small>SCORE</small><strong id="score">0</strong></div><div class="time"><small>SHOTS LEFT</small><strong id="shots">3</strong></div><button id="pause" aria-label="一時停止">Ⅱ</button></div><div class="field"><canvas id="game" width="600" height="800" aria-label="ドラッグで切断線を狙い、離して発射。金色の支えを切って、結晶を緑の受け皿へ。"></canvas><div class="field-top"><span id="wave"></span><span id="combo">PLAN YOUR CUT</span></div><div id="notice" aria-live="polite"></div><div id="overlay"></div><div class="field-bottom"><span id="goal">0% / GOAL 80%</span><span id="status">PLAN YOUR CUT</span></div></div><div class="objective"><div><span>RECOVERED</span><b id="percent">0%</b></div><div class="recovery"><i id="recovered"></i><span></span></div><p id="hint"></p></div><div class="stage-controls"><button id="retry">↻ やり直す</button><button id="help">ルール</button><select id="level-select" aria-label="ステージ選択"><option value="0">01 ／ 支えを外す</option><option value="1">02 ／ 残す支点</option><option value="2">03 ／ 共鳴の連鎖</option></select></div><div class="under"><span>BEST <b id="best">—</b></span><span>AIM · RELEASE · WATCH IT UNFOLD</span></div></section><aside class="right"><div class="orbit">／</div><span class="eyebrow">CAUSE → COLLAPSE → CASCADE</span><h2>残した支点が、<br>落下を決める。</h2><p>照準中は時間を停止。<br>光るケーブルが切断対象。<br>足場が傾く方向を見極めよう。</p><div class="rule"><b>LESS CUTS, MORE CONSEQUENCE</b><p>残り1ショットにつき＋1,500点。<br>一度の崩壊で続けて回収すると<br>連鎖ボーナスが伸びる。</p></div><small>鋼の足場・紫のコアは切断できません。<br>結晶は小さく切って直接消去も可能。<br>空振りも1ショット消費します。</small></aside></main><footer>LASER SLICER / CASCADE<span>SET IT UP. LET IT FALL.</span></footer><dialog id="dialog"><h2>プレイ設定</h2><label>サウンド<input id="sound" type="checkbox" checked></label><label>画面揺れ・粒子・振動<input id="effects" type="checkbox" checked></label><button id="close">もどる</button></dialog>`;
const canvas = $("canvas"),
  ctx = canvas.getContext("2d");
let world = new CollapseWorld(),
  index = 0,
  state = "title",
  drag = null,
  last = 0,
  sparks = [],
  fragments = [],
  beams = [],
  rings = [],
  shake = 0,
  audio;
$("#effects").checked = !matchMedia("(prefers-reduced-motion: reduce)").matches;
function tone(n = 1, bass = false) {
  if (!$("#sound").checked) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
    const o = audio.createOscillator(),
      g = audio.createGain(),
      t = audio.currentTime;
    o.type = "sine";
    o.frequency.setValueAtTime(
      bass ? 100 : 420 * Math.pow(1.07, Math.min(n, 12)),
      t,
    );
    o.frequency.exponentialRampToValueAtTime(bass ? 35 : 200, t + 0.2);
    g.gain.setValueAtTime(0.055, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.connect(g);
    g.connect(audio.destination);
    o.start();
    o.stop(t + 0.26);
  } catch {}
}
function notify(a, b = "") {
  const el = $("#notice");
  el.innerHTML = `<b>${a}</b><small>${b}</small>`;
  el.classList.remove("visible");
  void el.offsetWidth;
  el.classList.add("visible");
}
function sync() {
  const percent = Math.min(100, world.ratio * 100);
  $("#score").textContent = world.score.toLocaleString();
  $("#shots").textContent = world.shots;
  $("#level-select").value = String(index);
  $("#wave").textContent =
    `${String(index + 1).padStart(2, "0")} / ${world.level.name}`;
  $("#goal").textContent = `${percent.toFixed(0)}% / GOAL 80%`;
  $("#percent").textContent = percent.toFixed(0) + "%";
  $("#recovered").style.width = percent + "%";
  $("#combo").textContent =
    world.chainTimer > 0 && world.chain > 1
      ? `${world.chain} CHAIN`
      : "PLAN YOUR CUT";
  $("#status").textContent = world.settling
    ? "COLLAPSE IN MOTION"
    : drag
      ? "RELEASE TO CUT"
      : "PLAN YOUR CUT";
  $("#hint").textContent = world.level.hint;
  $("#best").textContent = records[index]?.score?.toLocaleString() || "—";
  $("#shots").classList.toggle("danger", world.shots === 1);
  $("#stages").innerHTML = levels
    .map(
      (l, i) =>
        `<button data-stage="${i}" class="${i === index ? "selected" : ""}"><span>0${i + 1}</span>${l.name}<small>${records[i] ? "★".repeat(records[i].stars) : "→"}</small></button>`,
    )
    .join("");
  document
    .querySelectorAll("[data-stage]")
    .forEach((b) => (b.onclick = () => load(Number(b.dataset.stage))));
}
function overlay() {
  const o = $("#overlay");
  o.hidden = state === "playing";
  if (state === "title")
    o.innerHTML = `<span class="eyebrow">A PUZZLE OF CONSEQUENCES</span><div class="title-mark">／</div><h2>One cut.<br><em>A cascade.</em></h2><p>支えを切って、構造を崩す。<br>結晶の80%を、緑の受け皿へ。</p><button id="start">はじめる <span>↗</span></button><small>直線をドラッグして、離すと発射</small>`;
  if (state === "paused")
    o.innerHTML = `<span class="eyebrow">PAUSED</span><h2>次の一手を。</h2><p>物理演算は停止しています。</p><button id="resume">つづける ↗</button><button id="restart" class="secondary">最初から</button>`;
  if (state === "won" || state === "lost") {
    const won = state === "won";
    const stars =
      world.ratio >= 0.95 && world.shots >= 1 ? 3 : world.shots >= 1 ? 2 : 1;
    o.innerHTML = `<span class="eyebrow">${won ? "STRUCTURE SOLVED" : "RETHINK THE SUPPORT"}</span><div class="result-stars">${won ? "★".repeat(stars) + "☆".repeat(3 - stars) : "↻"}</div><h2>${won ? "It unfolds." : "別の切り方を。"}</h2><p>回収 ${(world.ratio * 100).toFixed(1)}% ／ ${world.score.toLocaleString()}点<br>${won ? `残り${world.shots}ショット · 効率ボーナス＋${world.shots * 1500}` : world.lostArea > 0 ? "赤い範囲に落とした分は回収できません。" : "支えの位置と、受け皿の場所を見直そう。"}</p><button id="next">${won ? (index === levels.length - 1 ? "もう一周、より少なく" : "次の構造へ") : "もう一度"} ↗</button>${won ? '<button id="restart" class="secondary">この構造をもう一度</button>' : ""}`;
  }
  $("#start")?.addEventListener("click", () => {
    state = "playing";
    tone(3);
    overlay();
  });
  $("#resume")?.addEventListener("click", () => {
    state = "playing";
    overlay();
  });
  $("#restart")?.addEventListener("click", () => load(index));
  $("#next")?.addEventListener("click", () =>
    load(state === "won" ? (index + 1) % levels.length : index),
  );
}
$("#level-select").onchange = (e) => load(Number(e.target.value));
function load(i) {
  index = i;
  world = new CollapseWorld(i);
  state = "playing";
  drag = null;
  sparks = [];
  fragments = [];
  beams = [];
  rings = [];
  $("#notice").classList.remove("visible");
  sync();
  overlay();
}
function handleEvents() {
  for (const e of world.drain()) {
    if (e.vertices) {
      const c = e.vertices.reduce(
        (s, p) => ({
          x: s.x + p.x / e.vertices.length,
          y: s.y + p.y / e.vertices.length,
        }),
        { x: 0, y: 0 },
      );
      fragments.push({ vs: e.vertices, color: e.color, life: 0.6, vy: -0.8 });
      if ($("#effects").checked)
        for (let i = 0; i < 14; i++) {
          const a = Math.random() * Math.PI * 2,
            v = 35 + Math.random() * 160;
          sparks.push({
            x: c.x,
            y: c.y,
            vx: Math.cos(a) * v,
            vy: Math.sin(a) * v,
            color: e.color,
            life: 0.4 + Math.random() * 0.45,
          });
        }
      if (e.type !== "lost") {
        tone(e.chain);
        if (e.chain >= 3)
          notify(`${e.chain} in cascade.`, `＋${e.gain} · 崩れが次の回収へ`);
      }
    }
    if (e.type === "blast") {
      rings.push({ ...e.center, life: 0.8, radius: e.radius });
      tone(1, true);
      shake = $("#effects").checked ? 7 : 0;
      notify("Resonance.", "衝突から、周囲へ連鎖");
    }
    if (e.type === "cable") {
      rings.push({
        x: (e.a.x + e.b.x) / 2,
        y: (e.a.y + e.b.y) / 2,
        life: 0.35,
        radius: 40,
      });
      tone(2);
    }
    if (e.type === "shot") {
      beams.push({ a: e.a, b: e.b, life: 0.35 });
      if (!e.cuts) notify("空振り。", "切断線を金色のケーブルへ");
      if ($("#effects").checked && navigator.vibrate) navigator.vibrate(10);
    }
    if (e.type === "win") {
      state = "won";
      const stars =
        world.ratio >= 0.95 && world.shots >= 1 ? 3 : world.shots >= 1 ? 2 : 1;
      records[index] = {
        score: Math.max(records[index]?.score || 0, world.score),
        stars: Math.max(records[index]?.stars || 0, stars),
      };
      try {
        localStorage.setItem("laser-collapse-v1", JSON.stringify(records));
      } catch {}
      tone(9);
      sync();
      overlay();
    }
    if (e.type === "fail") {
      state = "lost";
      tone(1, true);
      sync();
      overlay();
    }
  }
  if (sparks.length > 500) sparks.splice(0, sparks.length - 500);
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
  if (world.settling) {
    notify("崩れの行方を見よう。", "動きが落ち着くと次の一手へ");
    return;
  }
  drag = { id: e.pointerId, a: point(e), b: point(e) };
  canvas.setPointerCapture(e.pointerId);
};
canvas.onpointermove = (e) => {
  if (drag?.id === e.pointerId) drag.b = point(e);
};
canvas.onpointerup = (e) => {
  if (drag?.id !== e.pointerId) return;
  const { a } = drag,
    b = point(e);
  drag = null;
  world.fire(a, b);
  handleEvents();
  sync();
};
canvas.onpointercancel = canvas.onlostpointercapture = () => (drag = null);
function pause() {
  if (state === "playing") {
    state = "paused";
    drag = null;
  } else if (state === "paused") state = "playing";
  overlay();
}
$("#pause").onclick = pause;
$("#retry").onclick = () => {
  if (state === "playing") {
    pause();
    $("#overlay").insertAdjacentHTML(
      "beforeend",
      "<small>最初からのボタンで現在のプレイをリセットします。</small>",
    );
  } else load(index);
};
$("#settings").onclick = () => {
  if (state === "playing") pause();
  $("#dialog").showModal();
};
$("#close").onclick = () => $("#dialog").close();
$("#help").onclick = () => {
  if (state === "playing") pause();
  $("#overlay").innerHTML =
    `<h2>支えを、読む。</h2><p>金色のケーブルは足場とつながっています。<br>片側を切ると、切った側へ足場が傾きます。<br>両側を切ると、そのまま落下します。<br><br>照準中に光るケーブルが切断対象です。<br>緑の受け皿で80%の面積を回収するとクリア。<br>赤い範囲へ落とした結晶は失われます。<br><br>結晶自体を小さく切って直接消すこともできます。<br>鋼の足場と紫コアは切断不可。紫コアは<br>衝突や回収で起動し、周囲へ共鳴が伝わります。</p><button id="back">もどる</button>`;
  $("#overlay").hidden = false;
  $("#back").onclick = overlay;
};
document.onkeydown = (e) => {
  if (e.key === "Escape" && !$("#dialog").open) pause();
};
document.addEventListener("visibilitychange", () => {
  if (document.hidden && state === "playing") pause();
});
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
    if (dt) shake *= 0.86;
  }
  const bg = ctx.createRadialGradient(300, 350, 0, 300, 350, 560);
  bg.addColorStop(0, "#212e31");
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
  const [left, right] = world.level.zone;
  ctx.fillStyle = "#baf1d515";
  ctx.fillRect(left, 700, right - left, 45);
  ctx.strokeStyle = "#c0edd3";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left, 700);
  ctx.lineTo(left, 741);
  ctx.lineTo(right, 741);
  ctx.lineTo(right, 700);
  ctx.stroke();
  ctx.setLineDash([4, 7]);
  ctx.strokeStyle = "#d5948755";
  ctx.beginPath();
  ctx.moveTo(25, 735);
  ctx.lineTo(left - 5, 735);
  ctx.moveTo(right + 5, 735);
  ctx.lineTo(575, 735);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = "10px system-ui";
  ctx.textAlign = "center";
  ctx.fillStyle = "#abd3bc";
  ctx.fillText("RECEIVER · 80% TO CLEAR", (left + right) / 2, 768);
  if (left > 80) {
    ctx.fillStyle = "#d59487";
    ctx.fillText("LOST", left / 2, 755);
  }
  if (right < 500) {
    ctx.fillStyle = "#d59487";
    ctx.fillText("LOST", (600 + right) / 2, 755);
  }
  const selected = drag ? world.preview(drag.a, drag.b) : [];
  for (const cable of world.cables) {
    ctx.fillStyle = "#6b8077";
    ctx.beginPath();
    ctx.arc(cable.anchor.x, cable.anchor.y, 5, 0, 7);
    ctx.fill();
    if (cable.cut) continue;
    const end = world.cableEnd(cable),
      hit = selected.includes(cable);
    ctx.strokeStyle = hit ? "#fff8ce" : "#e8c994";
    ctx.lineWidth = hit ? 4 : 2;
    ctx.shadowColor = "#f4cf96";
    ctx.shadowBlur = hit ? 18 : 0;
    ctx.beginPath();
    ctx.moveTo(cable.anchor.x, cable.anchor.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#e8c994";
    ctx.beginPath();
    ctx.arc(end.x, end.y, 4, 0, 7);
    ctx.fill();
  }
  for (const b of world.platforms) {
    path(b.vertices);
    ctx.fillStyle = "#657a80";
    ctx.fill();
    ctx.strokeStyle = "#bdc9cb";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.save();
    ctx.translate(b.position.x, b.position.y);
    ctx.rotate(b.angle);
    ctx.fillStyle = "#25363a";
    ctx.font = "8px system-ui";
    ctx.fillText("STEEL · 支えを切る", 0, 3);
    ctx.restore();
  }
  for (const b of world.targets) {
    ctx.save();
    path(b.vertices);
    const g = ctx.createLinearGradient(
      b.position.x - 25,
      b.position.y - 25,
      b.position.x + 25,
      b.position.y + 25,
    );
    g.addColorStop(0, b.color + "ee");
    g.addColorStop(1, b.color + "66");
    ctx.shadowColor = b.color + "44";
    ctx.shadowBlur = 14;
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#ffffff99";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.clip();
    ctx.fillStyle = "#ffffff25";
    ctx.beginPath();
    ctx.moveTo(b.position.x - 40, b.position.y - 40);
    ctx.lineTo(b.position.x + 10, b.position.y - 40);
    ctx.lineTo(b.position.x - 10, b.position.y + 40);
    ctx.lineTo(b.position.x - 60, b.position.y + 40);
    ctx.fill();
    ctx.restore();
    if (b.role === "core") {
      ctx.strokeStyle = "#ebd4ff";
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(b.position.x, b.position.y, 11, 0, 7);
      ctx.stroke();
      ctx.fillStyle = "#eddcff";
      ctx.font = "14px system-ui";
      ctx.fillText("✦", b.position.x, b.position.y + 5);
    }
  }
  if (drag) {
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = "#fff9d8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(drag.a.x, drag.a.y);
    ctx.lineTo(drag.b.x, drag.b.y);
    ctx.stroke();
    ctx.setLineDash([]);
    for (const p of [drag.a, drag.b]) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8, 0, 7);
      ctx.stroke();
    }
    ctx.fillStyle = "#f1dbaf";
    ctx.font = "12px system-ui";
    let msg = "ケーブルに線を重ねる";
    if (selected.length) {
      const per = new Map();
      for (const c of selected) {
        if (!per.has(c.platform)) per.set(c.platform, []);
        per.get(c.platform).push(c);
      }
      msg = [...per.entries()]
        .map(([p, cs]) => {
          const remains = world.cables.filter(
            (c) => c.platform === p && !c.cut && !cs.includes(c),
          );
          return remains.length === 0
            ? "両側が外れる → 落下"
            : cs[0].side < 0
              ? "左支点が外れる → 左へ傾く"
              : "右支点が外れる → 右へ傾く";
        })
        .join(" ／ ");
    }
    ctx.fillText(msg, 300, 65);
  }
  for (const f of fragments) {
    f.life -= dt;
    f.vy += dt * 3;
    f.vs.forEach((p) => (p.y += f.vy * dt * 60));
    ctx.globalAlpha = Math.max(0, f.life / 0.6);
    path(f.vs);
    ctx.fillStyle = f.color + "70";
    ctx.fill();
    ctx.strokeStyle = f.color;
    ctx.stroke();
  }
  fragments = fragments.filter((f) => f.life > 0);
  ctx.globalAlpha = 1;
  for (const p of sparks) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 80 * dt;
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.8, 0, 7);
    ctx.fill();
  }
  sparks = sparks.filter((p) => p.life > 0);
  ctx.globalAlpha = 1;
  for (const r of rings) {
    r.life -= dt;
    ctx.globalAlpha = Math.max(0, r.life);
    ctx.strokeStyle = "#e0c2ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(r.x, r.y, (1 - r.life) * r.radius, 0, 7);
    ctx.stroke();
  }
  rings = rings.filter((r) => r.life > 0);
  ctx.globalAlpha = 1;
  for (const b of beams) {
    b.life -= dt;
    ctx.globalAlpha = Math.max(0, b.life / 0.35);
    ctx.strokeStyle = "#fff1d5";
    ctx.shadowColor = "#f2d7af";
    ctx.shadowBlur = 18;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.a.x, b.a.y);
    ctx.lineTo(b.b.x, b.b.y);
    ctx.stroke();
  }
  beams = beams.filter((b) => b.life > 0);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.restore();
}
function frame(now) {
  const dt = Math.min((now - last) / 1000 || 0, 0.05);
  last = now;
  if (state === "playing" && !drag && !$("#dialog").open) {
    world.step(dt);
    handleEvents();
  }
  draw(state === "playing" ? dt : 0);
  if (state === "playing") {
    // Update metrics without replacing stage buttons every animation frame.
    $("#score").textContent = world.score.toLocaleString();
    $("#goal").textContent = `${(world.ratio * 100).toFixed(0)}% / GOAL 80%`;
    $("#percent").textContent = (world.ratio * 100).toFixed(0) + "%";
    $("#recovered").style.width = world.ratio * 100 + "%";
    $("#combo").textContent =
      world.chainTimer > 0 && world.chain > 1
        ? `${world.chain} CHAIN`
        : "PLAN YOUR CUT";
    $("#status").textContent = world.settling
      ? "COLLAPSE IN MOTION"
      : drag
        ? "RELEASE TO CUT"
        : "PLAN YOUR CUT";
  }
  requestAnimationFrame(frame);
}
sync();
overlay();
requestAnimationFrame(frame);
