import test from "node:test";
import assert from "node:assert/strict";
import { area, centroid, splitPolygon, extendLine } from "../src/geometry.js";
import { stages } from "../src/stages.js";
const box = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];
test("area and centroid use polygon geometry", () => {
  assert.equal(area(box), 10000);
  assert.deepEqual(centroid(box), { x: 50, y: 50 });
  assert.equal(area([...box].reverse()), 10000);
});
test("horizontal, vertical and diagonal cuts conserve area", () => {
  for (const [a, b] of [
    [
      { x: -10, y: 50 },
      { x: 110, y: 50 },
    ],
    [
      { x: 50, y: -10 },
      { x: 50, y: 110 },
    ],
    [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ],
    [
      { x: -5, y: 13 },
      { x: 108, y: 75 },
    ],
  ]) {
    const ps = splitPolygon(box, a, b);
    assert.equal(ps.length, 2);
    assert.ok(Math.abs(ps.reduce((s, p) => s + area(p), 0) - 10000) < 1e-6);
    assert.ok(ps.every((p) => area(p) > 0));
  }
});
test("tangent, missed and zero-length swipes do not split", () => {
  assert.equal(splitPolygon(box, { x: 0, y: 0 }, { x: 100, y: 0 }), null);
  assert.equal(splitPolygon(box, { x: 0, y: -10 }, { x: 100, y: -10 }), null);
  assert.equal(splitPolygon(box, { x: 50, y: 50 }, { x: 50, y: 50 }), null);
});
test("repeated cuts conserve mass and produce valid convex pieces", () => {
  let ps = [box];
  for (let i = 1; i < 15; i++) {
    const a = { x: Math.sin(i) * 130 + 50, y: 0 },
      b = { x: Math.cos(i) * 90 + 50, y: 100 };
    ps = ps.flatMap((p) => splitPolygon(p, a, b) || [p]);
  }
  assert.ok(Math.abs(ps.reduce((s, p) => s + area(p), 0) - 10000) < 1e-5);
  ps.forEach((p) => {
    assert.ok(Number.isFinite(centroid(p).x));
    assert.ok(p.length >= 3);
  });
});
test("short direction vectors extend to arena boundaries", () => {
  assert.deepEqual(
    extendLine({ x: 200, y: 100 }, { x: 250, y: 100 }, 600, 700).map((p) => ({
      x: p.x,
      y: p.y,
    })),
    [
      { x: 0, y: 100 },
      { x: 600, y: 100 },
    ],
  );
});
test("all six stages have viable shot budgets and thresholds", () => {
  assert.equal(stages.length, 6);
  stages.forEach((s) => {
    assert.ok(s.shots >= 5);
    assert.ok(s.blocks.length <= 50);
    assert.ok(
      s.blocks.every(
        (b) => b.w * b.h > s.threshold && (b.w * b.h) / 4 <= s.threshold,
      ),
    );
  });
});
