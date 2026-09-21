import { createPortal } from "react-dom";
import { useLayoutEffect, useRef, useState } from "react";
import { useTranslate } from "../../data/i18n";
import type { TimeBucket } from "../../domain/network";
import V from "../../ui/v2.module.css";
export function BucketTooltip({
  bucket,
  x,
  y,
  zone,
  locale,
  name,
}: {
  bucket: TimeBucket;
  x: number;
  y: number;
  zone: string;
  locale: string;
  name?: string;
}) {
  const t = useTranslate();
  const ref = useRef<HTMLDivElement>(null),
    [size, setSize] = useState({ w: 220, h: 170 });
  useLayoutEffect(() => {
    if (ref.current) {
      const r = ref.current.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    }
  }, [bucket, name]);
  const fmt = new Intl.DateTimeFormat(locale, {
    timeZone: zone,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return createPortal(
    <div
      ref={ref}
      className={V.tooltip}
      role="tooltip"
      style={{
        left: Math.max(8, Math.min(innerWidth - size.w - 8, x + 12)),
        top: Math.max(8, Math.min(innerHeight - size.h - 8, y - size.h - 10)),
      }}
    >
      <h4>
        {fmt.format(bucket.start)} — {fmt.format(bucket.end)}
      </h4>
      {name && <p>{name}</p>}
      <dl>
        <dt>{t("平均延迟")}</dt>
        <dd>
          {bucket.latency === null ? "--" : `${bucket.latency.toFixed(1)} ms`}
        </dd>
        <dt>{t("丢包率")}</dt>
        <dd>{bucket.loss === null ? "--" : `${bucket.loss.toFixed(1)}%`}</dd>
        <dt>{t("有效延迟样本")}</dt>
        <dd>{Math.round(bucket.latencyCount)}</dd>
        <dt>{t("丢包统计样本")}</dt>
        <dd>{Math.round(bucket.lossCount)}</dd>
      </dl>
      <p>
        {bucket.estimated
          ? t("聚合桶估算；点击查看该时段")
          : t("点击查看该时段")}
        {!bucket.latencyCount && !bucket.lossCount ? ` · ${t("无样本")}` : ""}
      </p>
    </div>,
    document.body,
  );
}
