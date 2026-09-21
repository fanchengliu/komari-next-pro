import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { CalendarClock } from "lucide-react";
import { useModel } from "../../data/context";
import { useTranslate } from "../../data/i18n";
import type { NetworkPreset, TimeWindow } from "../../domain/network";
import {
  fromLocalInput,
  presetWindow,
  toLocalInput,
  validateWindow,
} from "../../domain/time-window";
import V from "../../ui/v2.module.css";
export interface TimeChoice {
  preset: NetworkPreset;
  window: TimeWindow;
  day?: string;
}
export function formatWindow(w: TimeWindow, zone: string, locale = "zh-CN") {
  const format = new Intl.DateTimeFormat(locale, {
    timeZone: zone,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${format.format(w.start)} — ${format.format(w.end)} · ${zone}`;
}
export function TimeControls({
  window,
  preset,
  onChange,
}: {
  window: TimeWindow;
  preset: NetworkPreset;
  onChange: (choice: TimeChoice) => void;
}) {
  const t = useTranslate();
  const { settings, site } = useModel();
  const zone = settings.timezone;
  const [open, setOpen] = useState(false),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [day, setDay] = useState(""),
    [error, setError] = useState("");
  const apply = (choice: TimeChoice) => {
    const problem = validateWindow(
      choice.window,
      Date.now(),
      site?.ping_record_preserve_time ?? 744,
    );
    if (problem) {
      setError(t(problem));
      return;
    }
    onChange(choice);
    setOpen(false);
    setError("");
  };
  return (
    <div className={V.timeControls}>
      <div className={V.ranges}>
        {(["1h", "6h", "24h", "7d", "peak"] as const).map((p, i) => (
          <button
            key={p}
            aria-pressed={preset === p}
            onClick={() => {
              const w = presetWindow(p, zone);
              apply({
                preset: p,
                window: w,
                day:
                  p === "peak"
                    ? toLocalInput(w.start, zone).slice(0, 10)
                    : undefined,
              });
            }}
          >
            {
              [t("近 1h"), t("近 6h"), t("近 24h"), t("近 7 天"), t("晚高峰")][
                i
              ]
            }
          </button>
        ))}
      </div>
      <Popover.Root
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (v) {
            setStart(toLocalInput(window.start, zone));
            setEnd(toLocalInput(window.end, zone));
            setDay(toLocalInput(window.start, zone).slice(0, 10));
            setError("");
          }
        }}
      >
        <Popover.Trigger
          className={V.smallButton}
          aria-pressed={preset === "custom"}
        >
          <CalendarClock size={14} />
          {t("自定义时段")}
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content className={V.popover} sideOffset={8} align="end">
            <form
              className={V.timeForm}
              onSubmit={(e) => {
                e.preventDefault();
                try {
                  apply({
                    preset: "custom",
                    window: {
                      start: fromLocalInput(start, zone),
                      end: fromLocalInput(end, zone),
                    },
                  });
                } catch (e) {
                  setError(t((e as Error).message));
                }
              }}
            >
              <div className={V.popoverTitle}>
                {t("统计时区：")}
                {zone}
              </div>
              <label>
                {t("开始时间")}
                <input
                  type="datetime-local"
                  required
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>
              <label>
                {t("结束时间")}
                <input
                  type="datetime-local"
                  required
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </label>
              <div className={V.actions}>
                <button
                  type="submit"
                  className={`${V.smallButton} ${V.primary}`}
                >
                  {t("应用时间范围")}
                </button>
              </div>
              <label>
                {t("指定日期的晚高峰")}
                <input
                  type="date"
                  value={day}
                  max={toLocalInput(Date.now(), zone).slice(0, 10)}
                  onChange={(e) => setDay(e.target.value)}
                />
              </label>
              <button
                type="button"
                className={V.smallButton}
                onClick={() => {
                  try {
                    apply({
                      preset: "peak",
                      window: presetWindow("peak", zone, Date.now(), day),
                      day,
                    });
                  } catch (e) {
                    setError(t((e as Error).message));
                  }
                }}
              >
                {t("应用 19:00–23:00")}
              </button>
              <p className={V.fieldNote}>
                {t(
                  "当天未结束的晚高峰仅查询到当前时间。分位数在聚合数据上为估算。",
                )}
              </p>
              {error && (
                <div className={V.error} role="alert">
                  {error}
                </div>
              )}
            </form>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {error && !open && (
        <span role="alert" className={V.error}>
          {error}
        </span>
      )}
      <span className={V.timeCaption}>
        {formatWindow(window, zone, settings.locale)}
      </span>
    </div>
  );
}
