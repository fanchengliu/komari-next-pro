import { bytes } from "../domain/model";
import { S } from "./primitives";
export function SpeedDial({ down, up }: { down: number; up: number }) {
  const short = (n: number) => bytes(n, 0).replace(/[\sB]/g, "");
  return (
    <div className={S.speedDial}>
      <svg viewBox="0 0 92 92" aria-hidden="true">
        <circle
          cx="46"
          cy="46"
          r="40"
          fill="none"
          stroke="var(--download)"
          strokeWidth="6"
          opacity=".18"
        />
        <circle
          cx="46"
          cy="46"
          r="30"
          fill="none"
          stroke="var(--upload)"
          strokeWidth="5"
          opacity=".18"
        />
        <circle cx="46" cy="6" r="4" fill="var(--download)" />
        <circle cx="46" cy="16" r="3" fill="var(--upload)" />
      </svg>
      <span>
        <b>↓ {short(down)}</b>
        <small>↑ {short(up)}</small>
      </span>
    </div>
  );
}
