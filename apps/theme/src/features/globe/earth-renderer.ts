import land from "../../assets/land.json";
import type { RegionGroup } from "../../domain/regions";
import { createFlagLayout } from "./flag-layout";
export interface EarthController {
  reset: () => void;
  focus: (id: string) => void;
  update: (groups: RegionGroup[], selected: string) => void;
  setAuto: (auto: boolean) => void;
  setFilter: (online: boolean) => void;
  zoom: (factor: number) => void;
  destroy: () => void;
}
/** Own spherical projection/rendering. No external runtime maps or geolocation calls. */
export function createEarth(
  canvas: HTMLCanvasElement,
  layer: HTMLDivElement,
  onSelect: (id: string) => void,
  groups: RegionGroup[],
  selectedId: string,
  announce: (name: string) => void,
): EarthController | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const context = ctx;
  const flagLayout = createFlagLayout();
  let settling = false;
  const DEG = Math.PI / 180;
  let selected = selectedId,
    regions = groups,
    width = 0,
    height = 0,
    radius = 0,
    cx = 0,
    cy = 0,
    zoom = 1,
    angle = -88 * DEG,
    pitch = 22 * DEG,
    auto = false,
    onlyOnline = false,
    frame: number | null = null,
    last = 0,
    dead = false,
    target: { angle: number; pitch: number } | null = null,
    drag: { x: number; y: number; startX: number; startY: number } | null =
      null,
    pins: {
      x: number;
      y: number;
      z: number;
      region: RegionGroup;
      nodeId: string;
      name: string;
    }[] = [];
  const project = (lon: number, lat: number) => {
    const a = lon * DEG,
      b = lat * DEG,
      x = Math.cos(b) * Math.sin(a),
      y = Math.sin(b),
      z = Math.cos(b) * Math.cos(a),
      xx = x * Math.cos(angle) + z * Math.sin(angle),
      zz = -x * Math.sin(angle) + z * Math.cos(angle),
      yy = y * Math.cos(pitch) - zz * Math.sin(pitch);
    return {
      x: cx + radius * xx,
      y: cy - radius * yy,
      z: y * Math.sin(pitch) + zz * Math.cos(pitch),
    };
  };
  const drawLine = (coordinates: number[][], color: string) => {
    context.beginPath();
    let start = true;
    for (const [lon, lat] of coordinates) {
      const p = project(lon, lat);
      if (p.z < 0.01) {
        start = true;
        continue;
      }
      if (start) {
        context.moveTo(p.x, p.y);
        start = false;
      } else context.lineTo(p.x, p.y);
    }
    context.strokeStyle = color;
    context.lineWidth = 0.65;
    context.stroke();
  };
  function render(delta: number) {
    context.clearRect(0, 0, width, height);
    radius = Math.min(width * 0.39, height * 0.355) * zoom;
    context.save();
    context.filter = "blur(12px)";
    context.beginPath();
    context.ellipse(cx, cy + radius + 20, radius * 0.72, 11, 0, 0, Math.PI * 2);
    context.fillStyle = "#244e7a24";
    context.fill();
    context.restore();
    const glow = context.createRadialGradient(
      cx,
      cy,
      radius * 0.94,
      cx,
      cy,
      radius * 1.15,
    );
    glow.addColorStop(0, "#76aeed33");
    glow.addColorStop(1, "#8fbcfa00");
    context.fillStyle = glow;
    context.beginPath();
    context.arc(cx, cy, radius * 1.15, 0, Math.PI * 2);
    context.fill();
    const ocean = context.createRadialGradient(
      cx - radius * 0.35,
      cy - radius * 0.48,
      radius * 0.03,
      cx + radius * 0.18,
      cy + radius * 0.18,
      radius * 1.14,
    );
    ocean.addColorStop(0, "#365c86");
    ocean.addColorStop(0.5, "#254a71");
    ocean.addColorStop(0.85, "#18344f");
    ocean.addColorStop(1, "#10283e");
    context.fillStyle = ocean;
    context.beginPath();
    context.arc(cx, cy, radius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "#c4deff88";
    context.lineWidth = 1;
    context.stroke();
    for (let lat = -60; lat <= 60; lat += 30)
      drawLine(
        Array.from({ length: 181 }, (_, i) => [-180 + i * 2, lat]),
        "#bedcfa22",
      );
    for (let lon = -180; lon < 180; lon += 30)
      drawLine(
        Array.from({ length: 91 }, (_, i) => [lon, -90 + i * 2]),
        "#bedcfa1c",
      );
    for (const coast of land.coasts) drawLine(coast, "#aed2eb35");
    for (const [lon, lat] of land.dots) {
      const p = project(lon, lat);
      if (p.z <= 0.008) continue;
      context.fillStyle = `rgba(162,197,224,${0.18 + p.z * 0.6})`;
      context.beginPath();
      context.arc(
        p.x,
        p.y,
        Math.max(0.6, 1.55 * p.z) * Math.min(1.1, radius / 215),
        0,
        Math.PI * 2,
      );
      context.fill();
    }
    pins = [];
    const buttons = new Map(
      [...layer.querySelectorAll<HTMLButtonElement>("[data-map-node]")].map(
        (button) => [button.dataset.mapNode!, button],
      ),
    );
    const visiblePins: {
      nodeId: string;
      name: string;
      region: RegionGroup;
      p: { x: number; y: number; z: number };
      x: number;
      y: number;
      button: HTMLButtonElement;
    }[] = [];
    for (const region of regions) {
      const p = project(region.lon, region.lat);
      const members = [...region.nodes].sort((a, b) =>
        a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
      );
      for (const [index, node] of members.entries()) {
        const button = buttons.get(node.id);
        if (!button) continue;
        if (
          p.z < 0.045 ||
          (onlyOnline &&
            !["online", "stale"].includes(region.nodeStates[node.id]))
        ) {
          button.hidden = true;
          continue;
        }
        const phi = index * 2.399,
          r = members.length === 1 ? 0 : 22 + Math.sqrt(index) * 17;
        visiblePins.push({
          nodeId: node.id,
          name: node.name,
          region,
          p,
          x: p.x + Math.cos(phi) * r,
          y: p.y + Math.sin(phi) * r,
          button,
        });
      }
    }
    const layout = flagLayout.step(
      visiblePins.map((p) => ({ id: p.nodeId, x: p.x, y: p.y })),
      width,
      height,
      delta,
    );
    settling = layout.moving;
    for (const pin of visiblePins) {
      const { button, nodeId, name, region, p } = pin;
      const { x, y } = layout.positions.get(nodeId)!;
      button.hidden = false;
      button.style.transform = `translate(${(x - 14).toFixed(3)}px,${(y - 11).toFixed(3)}px)`;
      button.style.zIndex =
        nodeId === selected ? "4" : String(1 + Math.round(p.z));
      pins.push({ x, y, z: p.z, region, nodeId, name });
      const color =
        region.nodeStates[nodeId] === "online"
          ? "#78dfc3"
          : region.nodeStates[nodeId] === "offline"
            ? "#b7c5d8"
            : "#e9c384";
      context.strokeStyle = color + "80";
      context.lineWidth = nodeId === selected ? 1.6 : 0.7;
      context.beginPath();
      context.moveTo(p.x, p.y);
      context.lineTo(x, y);
      context.stroke();
      context.fillStyle = color;
      context.beginPath();
      context.arc(p.x, p.y, nodeId === selected ? 4 : 2.8, 0, Math.PI * 2);
      context.fill();
    }
  }
  function request() {
    if (frame === null && !dead && !document.hidden)
      frame = requestAnimationFrame(tick);
  }
  function tick(time: number) {
    frame = null;
    if (dead || document.hidden) return;
    const delta = Math.min(40, time - last || 16);
    last = time;
    if (auto && !drag && !target) angle += delta * 0.00004;
    if (target) {
      let diff = target.angle - angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      angle += diff * 0.12;
      pitch += (target.pitch - pitch) * 0.12;
      if (Math.abs(diff) < 0.001 && Math.abs(target.pitch - pitch) < 0.001)
        target = null;
    }
    render(delta);
    if (auto || target || settling) request();
  }
  function resize() {
    const r = canvas.getBoundingClientRect();
    width = r.width;
    height = r.height;
    if (width <= 0 || height <= 0) return;
    const d = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * d);
    canvas.height = Math.round(height * d);
    context.setTransform(d, 0, 0, d, 0, 0);
    cx = width / 2;
    cy = height * 0.51;
    flagLayout.reset();
    request();
  }
  const down = (e: PointerEvent) => {
    drag = { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY };
    target = null;
    canvas.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    if (!drag) return;
    angle += (e.clientX - drag.x) * 0.007;
    pitch = Math.max(-1.2, Math.min(1.2, pitch + (e.clientY - drag.y) * 0.005));
    drag.x = e.clientX;
    drag.y = e.clientY;
    request();
  };
  const up = (e: PointerEvent) => {
    if (!drag) return;
    const click =
      Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 7;
    drag = null;
    if (click) {
      const rect = canvas.getBoundingClientRect();
      const near = pins
        .filter(
          (p) =>
            Math.hypot(
              p.x - (e.clientX - rect.left),
              p.y - (e.clientY - rect.top),
            ) < 22,
        )
        .sort((a, b) => b.z - a.z)[0];
      if (near) {
        selected = near.nodeId;
        onSelect(selected);
        announce(near.name);
      }
    }
    request();
  };
  const cancel = () => {
    drag = null;
  };
  const key = (e: KeyboardEvent) => {
    if (
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "-"].includes(
        e.key,
      )
    )
      return;
    e.preventDefault();
    target = null;
    angle += e.key === "ArrowLeft" ? -0.13 : e.key === "ArrowRight" ? 0.13 : 0;
    pitch = Math.max(
      -1.2,
      Math.min(
        1.2,
        pitch +
          (e.key === "ArrowUp" ? 0.08 : e.key === "ArrowDown" ? -0.08 : 0),
      ),
    );
    if (e.key === "+" || e.key === "-")
      zoom = Math.max(0.7, Math.min(1.14, zoom * (e.key === "+" ? 1.1 : 0.9)));
    request();
  };
  const visibility = () => {
    if (document.hidden && frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    } else request();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", cancel);
  canvas.addEventListener("keydown", key);
  document.addEventListener("visibilitychange", visibility);
  resize();
  return {
    reset() {
      selected = "";
      angle = -88 * DEG;
      pitch = 22 * DEG;
      zoom = 1;
      target = null;
      request();
    },
    focus(id) {
      const g = regions.find((r) => r.nodes.some((n) => n.id === id));
      if (!g) return;
      selected = id;
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        angle = -g.lon * DEG;
        pitch = g.lat * DEG * 0.55;
        target = null;
      } else target = { angle: -g.lon * DEG, pitch: g.lat * DEG * 0.55 };
      request();
    },
    update(next, id) {
      regions = next;
      selected = id;
      request();
    },
    setAuto(value) {
      auto = value;
      request();
    },
    setFilter(value) {
      onlyOnline = value;
      request();
    },
    zoom(factor) {
      zoom = Math.max(0.7, Math.min(1.14, zoom * factor));
      request();
    },
    destroy() {
      dead = true;
      if (frame !== null) cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", cancel);
      canvas.removeEventListener("keydown", key);
      document.removeEventListener("visibilitychange", visibility);
    },
  };
}
