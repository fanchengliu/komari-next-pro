import { siUbuntu, siDebian } from "simple-icons";
import { Server } from "lucide-react";
export function OSIcon({ os }: { os: string }) {
  if (!/ubuntu|debian/i.test(os)) return <Server size={16} aria-label={os} />;
  const icon = os.toLowerCase().includes("ubuntu") ? siUbuntu : siDebian;
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={`#${icon.hex}`}
      role="img"
      aria-label={os}
    >
      <path d={icon.path} />
    </svg>
  );
}
