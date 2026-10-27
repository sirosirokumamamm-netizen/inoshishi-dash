export const cross = (a, b, p) =>
  (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
export function area(poly) {
  return (
    Math.abs(
      poly.reduce((sum, p, i) => {
        const q = poly[(i + 1) % poly.length];
        return sum + p.x * q.y - q.x * p.y;
      }, 0),
    ) / 2
  );
}
export function centroid(poly) {
  let x = 0,
    y = 0,
    sum = 0;
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length],
      c = p.x * q.y - q.x * p.y;
    x += (p.x + q.x) * c;
    y += (p.y + q.y) * c;
    sum += c;
  });
  return { x: x / (3 * sum), y: y / (3 * sum) };
}
export function splitPolygon(poly, a, b) {
  if (Math.hypot(b.x - a.x, b.y - a.y) < 1e-6) return null;
  const sides = [[], []];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i],
      q = poly[(i + 1) % poly.length];
    const dp = cross(a, b, p),
      dq = cross(a, b, q);
    if (dp >= -1e-7) sides[0].push({ x: p.x, y: p.y });
    if (dp <= 1e-7) sides[1].push({ x: p.x, y: p.y });
    if ((dp > 1e-7 && dq < -1e-7) || (dp < -1e-7 && dq > 1e-7)) {
      const t = dp / (dp - dq),
        hit = { x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) };
      sides[0].push({ ...hit });
      sides[1].push({ ...hit });
    }
  }
  const clean = sides.map((ps) =>
    ps.filter(
      (p, i) =>
        !ps.slice(0, i).some((q) => Math.hypot(p.x - q.x, p.y - q.y) < 1e-5),
    ),
  );
  return clean.every((ps) => ps.length >= 3 && area(ps) > 0.5) ? clean : null;
}
export function extendLine(a, b, width, height) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  if (Math.hypot(dx, dy) < 1e-6) return [a, b];
  const hits = [];
  if (dx)
    for (const x of [0, width]) {
      const t = (x - a.x) / dx,
        y = a.y + t * dy;
      if (y >= -0.01 && y <= height + 0.01) hits.push({ x, y, t });
    }
  if (dy)
    for (const y of [0, height]) {
      const t = (y - a.y) / dy,
        x = a.x + t * dx;
      if (x >= -0.01 && x <= width + 0.01) hits.push({ x, y, t });
    }
  hits.sort((p, q) => p.t - q.t);
  return hits.length >= 2 ? [hits[0], hits.at(-1)] : [a, b];
}
