import type { ReactNode } from "react";
import V from "./v2.module.css";
export function PageHeader({
  title,
  description,
  eyebrow,
  children,
}: {
  title: string;
  description: string;
  eyebrow: string;
  children?: ReactNode;
}) {
  return (
    <div className={V.heading}>
      <div>
        <div className={V.eyebrow}>{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children && <div className={V.actions}>{children}</div>}
    </div>
  );
}
