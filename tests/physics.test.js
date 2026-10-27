import test from "node:test";
import assert from "node:assert/strict";
import Matter from "matter-js";
import { area, centroid, splitPolygon } from "../src/geometry.js";
const { Bodies, Engine, Composite } = Matter;
test("Matter fragments preserve area and world-space geometry, then fall onto floor", () => {
  const original = [
    { x: 120, y: 180 },
    { x: 260, y: 180 },
    { x: 260, y: 300 },
    { x: 120, y: 300 },
  ];
  const fragments = splitPolygon(
    original,
    { x: 100, y: 150 },
    { x: 280, y: 320 },
  );
  const engine = Engine.create({ gravity: { x: 0, y: 0.25 } });
  Composite.add(
    engine.world,
    Bodies.rectangle(300, 680, 600, 40, { isStatic: true }),
  );
  const bodies = fragments.map((vs) => {
    const c = centroid(vs);
    const b = Bodies.fromVertices(
      c.x,
      c.y,
      [vs],
      { frictionAir: 0.035 },
      false,
      0,
      0,
      0,
    );
    Composite.add(engine.world, b);
    assert.ok(Math.abs(b.area - area(vs)) < 1e-5);
    assert.ok(Math.abs(b.position.x - c.x) < 1e-5);
    return b;
  });
  assert.ok(
    Math.abs(bodies.reduce((s, b) => s + b.area, 0) - area(original)) < 1e-5,
  );
  for (let i = 0; i < 360; i++) Engine.update(engine, 1000 / 60);
  bodies.forEach((b) => {
    assert.ok(b.position.y > 300);
    assert.ok(Math.max(...b.vertices.map((v) => v.y)) < 663);
  });
});
