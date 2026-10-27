import Matter from "matter-js";
import { area, centroid, splitPolygon, cross } from "./geometry.js";
const { Engine, Bodies, Body, Composite, Constraint, Events } = Matter;
export const levels = [
  {
    name: "支えを外す",
    hint: "金色の2本が足場を支えている。結晶を下の受け皿へ運ぼう。",
    shots: 3,
    zone: [65, 535],
    platforms: [{ x: 300, y: 510, w: 360, columns: 5, rows: 2 }],
    cores: false,
  },
  {
    name: "残す支点",
    hint: "受け皿は左側。片側の支点を残すと、足場はどちらへ傾く？",
    shots: 2,
    zone: [45, 285],
    platforms: [{ x: 300, y: 510, w: 320, columns: 5, rows: 2 }],
    cores: false,
  },
  {
    name: "共鳴の連鎖",
    hint: "足場を落として紫のコアを衝突させる。近くのコアへ共鳴が伝わる。",
    shots: 3,
    zone: [40, 560],
    platforms: [
      { x: 175, y: 470, w: 220, columns: 3, rows: 3 },
      { x: 425, y: 530, w: 180, columns: 3, rows: 2 },
    ],
    cores: true,
  },
];
export function segmentHit(a, b, c, d) {
  if (Math.hypot(b.x - a.x, b.y - a.y) < 1e-5) return false;
  const ab1 = cross(a, b, c),
    ab2 = cross(a, b, d),
    cd1 = cross(c, d, a),
    cd2 = cross(c, d, b);
  return (
    ab1 * ab2 <= 1e-7 &&
    cd1 * cd2 <= 1e-7 &&
    Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)) <=
      Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) + 1e-7 &&
    Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)) <=
      Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) + 1e-7
  );
}
export class CollapseWorld {
  constructor(index = 0) {
    this.level = levels[index];
    this.index = index;
    this.engine = Engine.create({
      gravity: { x: 0, y: 0.85 },
      positionIterations: 8,
      velocityIterations: 8,
    });
    this.targets = [];
    this.platforms = [];
    this.cables = [];
    this.events = [];
    this.pending = [];
    this.totalArea = 0;
    this.clearedArea = 0;
    this.lostArea = 0;
    this.score = 0;
    this.chain = 0;
    this.chainTimer = 0;
    this.bestChain = 0;
    this.shots = this.level.shots;
    this.fired = false;
    this.age = 0;
    this.lastAction = 0;
    this.settling = false;
    this.accumulator = 0;
    this.state = "playing";
    this.totalCuts = 0;
    this.floor = Bodies.rectangle(300, 770, 620, 60, {
      isStatic: true,
      label: "floor",
      friction: 0.6,
    });
    Composite.add(this.engine.world, [
      this.floor,
      Bodies.rectangle(-20, 400, 40, 800, { isStatic: true }),
      Bodies.rectangle(620, 400, 40, 800, { isStatic: true }),
    ]);
    for (const spec of this.level.platforms) {
      const platform = Bodies.rectangle(spec.x, spec.y, spec.w, 18, {
        density: 0.008,
        friction: 0.8,
        frictionStatic: 1,
        restitution: 0.02,
      });
      platform.role = "platform";
      Composite.add(this.engine.world, platform);
      this.platforms.push(platform);
      for (const side of [-1, 1]) {
        const offset = side * (spec.w / 2 - 18),
          anchor = { x: spec.x + offset, y: 110 };
        const constraint = Constraint.create({
          pointA: anchor,
          bodyB: platform,
          pointB: { x: offset, y: 0 },
          length: spec.y - 110,
          stiffness: 1,
          damping: 0.1,
        });
        Composite.add(this.engine.world, constraint);
        this.cables.push({
          constraint,
          platform,
          offset,
          anchor,
          cut: false,
          side,
        });
      }
      const spacing = Math.min(47, (spec.w - 35) / spec.columns);
      for (let row = 0; row < spec.rows; row++)
        for (let col = 0; col < spec.columns; col++) {
          const x = spec.x + (col - (spec.columns - 1) / 2) * spacing,
            y = spec.y - 10 - 21 - row * 42;
          const core = this.level.cores && row === 0 && col === 1;
          const b = Bodies.rectangle(x, y, 36, 38, {
            friction: 0.55,
            frictionStatic: 0.9,
            restitution: 0.05,
            density: core ? 0.003 : 0.0016,
            slop: 0.02,
          });
          b.role = core ? "core" : "crystal";
          b.color = core
            ? "#c6a9ff"
            : ["#baf1d5", "#b5cfff", "#f4ceac"][(row + col) % 3];
          b.targetArea = area(b.vertices);
          b.depth = 0;
          this.totalArea += b.targetArea;
          this.targets.push(b);
          Composite.add(this.engine.world, b);
        }
    }
    Events.on(this.engine, "collisionStart collisionActive", ({ pairs }) => {
      if (!this.fired) return;
      for (const pair of pairs) {
        for (const [b, other] of [
          [pair.bodyA, pair.bodyB],
          [pair.bodyB, pair.bodyA],
        ]) {
          if (b.role !== "core" || b.detonated || !this.targets.includes(b))
            continue;
          const speed = Math.hypot(
            b.velocity.x - other.velocity.x,
            b.velocity.y - other.velocity.y,
          );
          if (speed > 2.4) this.scheduleCore(b, 0);
        }
      }
    });
    // Settle the initial stack before play without enabling impact clears.
    for (let i = 0; i < 90; i++) Engine.update(this.engine, 1000 / 60);
    for (const b of Composite.allBodies(this.engine.world))
      if (!b.isStatic) {
        Body.setVelocity(b, { x: 0, y: 0 });
        Body.setAngularVelocity(b, 0);
      }
  }
  cableEnd(c) {
    const a = c.platform.angle;
    return {
      x: c.platform.position.x + c.offset * Math.cos(a),
      y: c.platform.position.y + c.offset * Math.sin(a),
    };
  }
  preview(a, b) {
    return this.cables.filter(
      (c) => !c.cut && segmentHit(a, b, c.anchor, this.cableEnd(c)),
    );
  }
  scheduleCore(b, delay) {
    if (b.detonated) return;
    b.detonated = true;
    this.pending.push({ body: b, delay });
  }
  remove(b, reason) {
    if (!this.targets.includes(b)) return;
    this.targets.splice(this.targets.indexOf(b), 1);
    Composite.remove(this.engine.world, b);
    const mass = b.targetArea;
    if (reason === "lost") {
      this.lostArea += mass;
      this.events.push({
        type: "lost",
        vertices: b.vertices.map((p) => ({ ...p })),
        color: "#d09288",
      });
      return;
    }
    this.clearedArea += mass;
    this.chain = this.chainTimer > 0 ? this.chain + 1 : 1;
    this.chainTimer = 1.5;
    this.bestChain = Math.max(this.bestChain, this.chain);
    const gain = Math.round(
      (mass / this.totalArea) *
        10000 *
        (1 + Math.min(10, this.chain - 1) * 0.12),
    );
    this.score += gain;
    this.events.push({
      type: reason,
      vertices: b.vertices.map((p) => ({ ...p })),
      color: b.color,
      gain,
      chain: this.chain,
    });
  }
  detonate(b) {
    if (!this.targets.includes(b)) return;
    const center = { ...b.position };
    this.remove(b, "resonance");
    this.events.push({ type: "blast", center, radius: 112 });
    for (const t of [...this.targets]) {
      const dx = t.position.x - center.x,
        dy = t.position.y - center.y,
        d = Math.hypot(dx, dy);
      if (d < 112) {
        if (t.role === "core") this.scheduleCore(t, 0.14);
        else this.remove(t, "resonance");
      } else if (d < 210) {
        const force = 0.035 * (1 - d / 230);
        Body.applyForce(t, t.position, {
          x: (dx / Math.max(1, d)) * force,
          y: (dy / Math.max(1, d)) * force - 0.008,
        });
      }
    }
  }
  fire(a, b) {
    if (
      this.state !== "playing" ||
      this.shots <= 0 ||
      this.settling ||
      Math.hypot(b.x - a.x, b.y - a.y) < 20
    )
      return { accepted: false };
    this.shots--;
    this.fired = true;
    this.lastAction = this.age;
    this.settling = true;
    let cuts = 0;
    for (const c of this.preview(a, b)) {
      c.cut = true;
      Composite.remove(this.engine.world, c.constraint);
      cuts++;
      this.events.push({
        type: "cable",
        a: { ...c.anchor },
        b: this.cableEnd(c),
      });
    }
    // Crystals remain sliceable, but steel platforms and resonance cores do not.
    for (const body of [...this.targets]) {
      if (body.role === "core" || body.depth >= 5) continue;
      if (
        !body.vertices.some((p, i) =>
          segmentHit(a, b, p, body.vertices[(i + 1) % body.vertices.length]),
        )
      )
        continue;
      const parts = splitPolygon(body.vertices, a, b);
      if (!parts) continue;
      if (this.targets.length + 1 > 48) continue;
      cuts++;
      Composite.remove(this.engine.world, body);
      this.targets.splice(this.targets.indexOf(body), 1);
      const sum = parts.reduce((n, p) => n + area(p), 0);
      for (const vs of parts) {
        const pieceArea = (body.targetArea * area(vs)) / sum,
          c = centroid(vs);
        const fragment = Bodies.fromVertices(
          c.x,
          c.y,
          [vs],
          { friction: 0.5, restitution: 0.1 },
          false,
          0,
          0,
          0,
        );
        fragment.role = "crystal";
        fragment.color = body.color;
        fragment.targetArea = pieceArea;
        fragment.depth = body.depth + 1;
        this.targets.push(fragment);
        Composite.add(this.engine.world, fragment);
        Body.setVelocity(fragment, {
          x: body.velocity.x + (c.x - body.position.x) * 0.035,
          y: body.velocity.y,
        });
        if (pieceArea <= 450) this.remove(fragment, "slice");
      }
    }
    this.totalCuts += cuts;
    this.events.push({ type: "shot", a, b, cuts });
    return { accepted: true, cuts };
  }
  step(real) {
    if (this.state !== "playing") return;
    this.accumulator += Math.min(real, 0.1);
    while (this.accumulator >= 1 / 60) {
      this.tick(1 / 60);
      this.accumulator -= 1 / 60;
    }
  }
  tick(dt) {
    if (this.state !== "playing") return;
    this.age += dt;
    this.chainTimer = Math.max(0, this.chainTimer - dt);
    Engine.update(this.engine, dt * 1000);
    for (const p of this.pending) p.delay -= dt;
    const ready = this.pending.filter((p) => p.delay <= 0);
    this.pending = this.pending.filter((p) => p.delay > 0);
    for (const p of ready) this.detonate(p.body);
    if (this.fired) {
      for (const b of [...this.targets]) {
        if (b.position.y >= 700) {
          const [left, right] = this.level.zone;
          if (b.position.x >= left && b.position.x <= right) {
            if (b.role === "core") this.scheduleCore(b, 0);
            else this.remove(b, "collect");
          } else this.remove(b, "lost");
        } else if (
          b.position.y > 830 ||
          b.position.x < -100 ||
          b.position.x > 700
        )
          this.remove(b, "lost");
      }
    }
    if (this.clearedArea / this.totalArea >= 0.8 - 1e-7 && !this.winAt)
      this.winAt = this.age;
    if (this.winAt && this.age - this.winAt >= 0.8 && !this.pending.length) {
      this.state = "won";
      this.score += this.shots * 1500;
      this.events.push({ type: "win" });
      return;
    }
    const still =
      this.targets.every((b) => b.speed < 0.18) &&
      this.platforms.every((b) => b.speed < 0.18);
    const since = this.age - this.lastAction;
    if (
      this.settling &&
      since > 0.8 &&
      (still || since > 6) &&
      !this.pending.length
    )
      this.settling = false;
    if (
      (this.shots === 0 && !this.settling && !this.pending.length) ||
      (this.totalArea - this.lostArea) / this.totalArea < 0.8 - 1e-7
    ) {
      this.state = "lost";
      this.events.push({ type: "fail" });
    }
  }
  drain() {
    return this.events.splice(0);
  }
  get ratio() {
    return this.clearedArea / this.totalArea;
  }
}
