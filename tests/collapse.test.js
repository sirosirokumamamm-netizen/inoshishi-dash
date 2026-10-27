import Matter from 'matter-js';
import test from "node:test";
import assert from "node:assert/strict";
import { CollapseWorld, segmentHit } from "../src/collapse.js";
function run(w, seconds) {
  for (let i = 0; i < seconds * 60; i++) w.step(1 / 60);
}
test("finite cable intersection does not extend a missed laser", () => {
  assert.ok(
    segmentHit(
      { x: 0, y: 50 },
      { x: 100, y: 50 },
      { x: 50, y: 0 },
      { x: 50, y: 100 },
    ),
  );
  assert.equal(
    segmentHit(
      { x: 0, y: 50 },
      { x: 20, y: 50 },
      { x: 50, y: 0 },
      { x: 50, y: 100 },
    ),
    false,
  );
});
test("uncut support holds the structure and awards no idle score", () => {
  const w = new CollapseWorld();
  const y = w.platforms[0].position.y;
  run(w, 5);
  assert.ok(Math.abs(w.platforms[0].position.y - y) < 2);
  assert.equal(w.ratio, 0);
  assert.equal(w.score, 0);
});
test("one stroke severs both cables and physical collapse clears stage one", () => {
  const w = new CollapseWorld();
  assert.equal(w.fire({ x: 50, y: 290 }, { x: 550, y: 290 }).cuts, 2);
  run(w, 8);
  assert.equal(w.state, "won");
  assert.ok(w.ratio >= 0.8);
  assert.equal(w.shots, 2);
});
test("left support and right support produce different outcomes at the left receiver", () => {
  const left = new CollapseWorld(1),
    right = new CollapseWorld(1);
  left.fire({ x: 110, y: 280 }, { x: 190, y: 280 });
  right.fire({ x: 410, y: 280 }, { x: 490, y: 280 });
  run(left, 9);
  run(right, 9);
  console.log(
    "directional results",
    left.ratio,
    left.state,
    right.ratio,
    right.state,
  );
  assert.ok(left.ratio > right.ratio + 0.3);
});
test("misses consume budget while cancellation-sized strokes do not", () => {
  const w = new CollapseWorld();
  assert.equal(w.fire({ x: 1, y: 1 }, { x: 2, y: 2 }).accepted, false);
  assert.equal(w.shots, 3);
  assert.equal(w.fire({ x: 2, y: 50 }, { x: 590, y: 50 }).cuts, 0);
  assert.equal(w.shots, 2);
});
test("resonance cores are triggered by falling physics, not by the cut command", () => {
  const w = new CollapseWorld(2);
  w.fire({ x: 30, y: 280 }, { x: 570, y: 280 });
  assert.equal(w.drain().filter((e) => e.type === "blast").length, 0);
  run(w, 8);
  const blasts = w.drain().filter((e) => e.type === "blast");
  console.log("resonance", blasts.length, w.ratio, w.state);
  assert.ok(blasts.length >= 2);
  assert.equal(w.state, "won");
});
test("splitting a crystal conserves remaining area and does not reward empty cutting", () => {
  const w = new CollapseWorld(),
    b = w.targets[0],
    x = b.position.x,
    y = b.position.y;
  const before = w.targets.reduce((s, t) => s + t.targetArea, 0);
  const r = w.fire({ x: x - 21, y }, { x: x + 21, y });
  assert.ok(r.cuts >= 1);
  assert.ok(
    Math.abs(
      w.targets.reduce((s, t) => s + t.targetArea, 0) + w.clearedArea - before,
    ) < 1e-6,
  );
  assert.equal(w.score, 0);
});

test('a core hitting a solid obstacle detonates before reaching the receiver',()=>{const w=new CollapseWorld(2),core=w.targets.find(b=>b.role==='core');w.fired=true;Matter.Body.setPosition(core,{x:300,y:190});Matter.Body.setVelocity(core,{x:0,y:0});Matter.Composite.add(w.engine.world,Matter.Bodies.rectangle(300,370,130,20,{isStatic:true}));run(w,1.6);const blasts=w.drain().filter(e=>e.type==='blast');assert.ok(blasts.length>=1);assert.ok(blasts[0].center.y<400);});
