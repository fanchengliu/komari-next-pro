import { useTranslate } from "../data/i18n";
import type { CSSProperties, ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, LoaderCircle } from "lucide-react";
import styles from "./theme.module.css";
export { styles as S };
export function Modal({
  title,
  children,
  open,
  onClose,
  wide = false,
  className = "",
}: {
  title: string;
  children: ReactNode;
  open: boolean;
  onClose: () => void;
  wide?: boolean;
  className?: string;
}) {
  const t = useTranslate();
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          className={`${styles.modal} ${wide ? styles.wide : ""} ${className}`}
          aria-describedby={undefined}
        >
          <div className={styles.modalHeading}>
            <Dialog.Title>{t(title)}</Dialog.Title>
            <Dialog.Close className={styles.icon} aria-label={t("关闭")}>
              <X size={18} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Meter({
  value,
  color = "var(--accent)",
}: {
  value: number | null;
  color?: string;
}) {
  const t = useTranslate();
  return (
    <span className={styles.meter}>
      <span
        style={{
          width: `${Math.min(100, Math.max(0, value ?? 0))}%`,
          background: color,
        }}
      />
    </span>
  );
}
export function Ring({
  value,
  label,
  color = "var(--accent)",
}: {
  value: number;
  label: ReactNode;
  color?: string;
}) {
  const t = useTranslate();
  return (
    <div
      className={styles.ring}
      style={
        {
          "--ring-value": `${Math.min(100, Math.max(0, value))}%`,
          "--ring-color": color,
        } as CSSProperties
      }
    >
      <span>{typeof label === "string" ? t(label) : label}</span>
    </div>
  );
}
export function State({
  error,
  empty,
  busy,
}: {
  error?: Error | null;
  empty?: string;
  busy?: boolean;
}) {
  const t = useTranslate();
  return (
    <div className={styles.state} role={error ? "alert" : "status"}>
      {busy ? (
        <>
          <LoaderCircle className={styles.spin} size={20} />
          {t("正在读取…")}
        </>
      ) : error ? (
        error.message
      ) : (
        empty
      )}
    </div>
  );
}
export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const t = useTranslate();
  return (
    <label className={styles.settingRow}>
      <span>{t(label)}</span>
      <input
        aria-label={label}
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
export function DataTable({
  heads,
  children,
}: {
  heads: string[];
  children: ReactNode;
}) {
  const t = useTranslate();
  return (
    <div className={styles.tableScroll}>
      <table>
        <thead>
          <tr>
            {heads.map((h) => (
              <th key={h}>{t(h)}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
