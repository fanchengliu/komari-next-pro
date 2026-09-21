export interface FlagAnchor {
  id: string;
  x: number;
  y: number;
}
/** Persistent, ID-stable positions. Continuous forces replace per-frame candidate hopping. */
export function createFlagLayout() {
  const positions = new Map<string, { x: number; y: number }>();
  return {
    reset() {
      positions.clear();
    },
    step(anchors: FlagAnchor[], width: number, height: number, elapsed = 16) {
      const sorted = [...anchors].sort((a, b) =>
        a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
      );
      const active = new Set(sorted.map((a) => a.id));
      for (const id of positions.keys())
        if (!active.has(id)) positions.delete(id);
      const clamp = (p: { x: number; y: number }) => ({
        x: Math.max(18, Math.min(width - 18, p.x)),
        y: Math.max(79, Math.min(height - 90, p.y)),
      });
      for (const a of sorted)
        if (!positions.has(a.id)) positions.set(a.id, clamp(a));
      let moving = false;
      const scale = Math.max(0.25, Math.min(40, elapsed) / 16);
      const forces = sorted.map((a) => {
        const p = positions.get(a.id)!;
        const target = clamp(a);
        return { x: (target.x - p.x) * 0.07, y: (target.y - p.y) * 0.07 };
      });
      for (let i = 0; i < sorted.length; i++)
        for (let j = i + 1; j < sorted.length; j++) {
          const a = positions.get(sorted[i].id)!,
            b = positions.get(sorted[j].id)!;
          let dx = (a.x - b.x) / 46,
            dy = (a.y - b.y) / 38,
            d = Math.hypot(dx, dy);
          if (d >= 1) continue;
          if (d < 0.001) {
            dx = -0.707;
            dy = -0.707;
            d = 1e-3;
          }
          const norm = Math.hypot(dx, dy),
            force = (1 - d) * (1 - d) * 10;
          const x = (dx / norm) * force,
            y = (dy / norm) * force;
          forces[i].x += x;
          forces[i].y += y;
          forces[j].x -= x;
          forces[j].y -= y;
        }
      sorted.forEach((a, i) => {
        const p = positions.get(a.id)!,
          f = forces[i],
          distance = Math.hypot(f.x, f.y),
          factor = distance
            ? Math.min(distance * scale, 3 * scale) / distance
            : 0;
        const next = clamp({ x: p.x + f.x * factor, y: p.y + f.y * factor });
        if (Math.hypot(next.x - p.x, next.y - p.y) > 0.025) moving = true;
        positions.set(a.id, next);
      });
      return { positions, moving };
    },
  };
}
