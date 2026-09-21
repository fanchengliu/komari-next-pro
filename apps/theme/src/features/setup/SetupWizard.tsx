import { useEffect, useState } from "react";
import { CardOpacity } from "../../ui/CardOpacity";
import { useLocation } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  LayoutGrid,
  Rows3,
  Moon,
  Settings2,
} from "lucide-react";
import { useModel } from "../../data/context";
import { useUI } from "../../data/store";
import { translate } from "../../data/i18n";
import { json } from "../../data/rpc";
import { safeMediaUrl } from "../../domain/model";
import {
  settingsSchema,
  type ThemeSettings,
} from "../../../../../packages/contracts";
import { Modal, Toggle } from "../../ui/primitives";
import { LanguageSelect } from "../../ui/LanguageSelect";
import { TimezonePicker } from "../tools/Overview";
import { presetConfiguration, presetIds, type PresetId } from "./presets";
import T from "../../ui/tools.module.css";
import W from "./setup.module.css";
export function SetupTrigger() {
  const { viewer, site, settings, loading } = useModel(),
    location = useLocation(),
    { setupSeen, dialog, set } = useUI();
  useEffect(() => {
    if (
      !loading &&
      viewer.logged_in &&
      site?.theme === "komari-ds" &&
      !settings.setupCompleted &&
      !setupSeen &&
      !dialog &&
      location.pathname === "/"
    )
      set({ dialog: "setup" });
  }, [
    loading,
    viewer.logged_in,
    site?.theme,
    settings.setupCompleted,
    setupSeen,
    dialog,
    location.pathname,
    set,
  ]);
  return null;
}
export function SetupWizard() {
  const { settings, viewer, refresh } = useModel(),
    { set, configure } = useUI();
  const [draft, setDraft] = useState<ThemeSettings>({ ...settings }),
    [preset, setPreset] = useState<PresetId>("current"),
    [step, setStep] = useState(0),
    [changedBackground, setChangedBackground] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const t = (text: string) => translate(text, draft.locale);
  const change = (update: Partial<ThemeSettings>) =>
    setDraft((d) => ({ ...d, ...update }));
  const close = () => set({ dialog: null, setupSeen: true });
  const steps = ["选择预设", "布局与外观", "背景", "语言与显示", "确认配置"];
  const names: Record<PresetId, string> = {
    current: "保留当前配置",
    glass: "经典玻璃",
    inspection: "简洁巡检",
    night: "深色聚焦",
  };
  function validate() {
    if (draft.backgroundSource === "single" && !safeMediaUrl(draft.background))
      throw Error(t("请输入有效的背景链接"));
    return settingsSchema.parse({
      ...draft,
      setupCompleted: true,
      presetId: preset === "current" ? "custom" : preset,
    });
  }
  async function apply(site: boolean) {
    setBusy(true);
    setError("");
    try {
      const value = validate();
      if (site) {
        const r = await json<{ status: string; message?: string }>(
          "/api/admin/theme/settings?theme=komari-ds",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(value),
          },
        );
        if (r.status !== "success") throw Error(r.message || t("保存失败"));
      }
      configure(value);
      set({
        dialog: null,
        setupSeen: true,
        ...(changedBackground ? { playlistOverride: null } : {}),
      });
      if (site) refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`Komari Next Pro · ${t("首次设置")}`}
      open
      onClose={close}
      wide
      className={T.window}
    >
      <div className={T.body}>
        <div className={T.intro}>
          <p>{t("用一套完整预设开始，也可以保留现有配置逐项调整。")}</p>
          <LanguageSelect
            value={draft.locale}
            onChange={(locale) => change({ locale })}
          />
        </div>
        <div className={W.steps}>
          {steps.map((name, i) => (
            <button
              key={name}
              aria-current={i === step ? "step" : undefined}
              disabled={busy}
              onClick={() => setStep(i)}
            >
              <span>{i < step ? <Check size={12} /> : i + 1}</span>
              {t(name)}
            </button>
          ))}
        </div>
        {step === 0 && (
          <div className={W.presets}>
            {presetIds.map((id, i) => {
              const Icon = [Settings2, LayoutGrid, Rows3, Moon][i];
              return (
                <button
                  key={id}
                  className={W.preset}
                  aria-pressed={preset === id}
                  onClick={() => {
                    setPreset(id);
                    setDraft(
                      presetConfiguration(
                        id,
                        settings,
                        import.meta.env.BASE_URL,
                      ),
                    );
                    setChangedBackground(id !== "current");
                  }}
                >
                  <Icon size={20} />
                  <strong>{t(names[id])}</strong>
                  <div className={W.thumb} data-preset={id}>
                    {[0, 1, 2, 3, 4, 5].map((n) => (
                      <i key={n} />
                    ))}
                  </div>
                  <small>
                    {t(
                      [
                        "沿用当前布局、背景和显示偏好。",
                        "玻璃卡片与视频背景，保留熟悉的日常样式。",
                        "紧凑表格与纯色背景，突出监测数据。",
                        "深色界面与安静背景，适合夜间观察。",
                      ][i],
                    )}
                  </small>
                </button>
              );
            })}
          </div>
        )}
        {step === 1 && (
          <section className={T.section}>
            <h3>{t("布局与外观")}</h3>
            <label className={T.field}>
              {t("桌面默认")}
              <select
                value={draft.desktopLayout}
                onChange={(e) =>
                  change({
                    desktopLayout: e.target.value as "daily" | "compact",
                  })
                }
              >
                <option value="daily">{t("日常展示")}</option>
                <option value="compact">{t("紧凑巡检")}</option>
              </select>
            </label>
            <label className={T.field}>
              {t("手机默认")}
              <select
                value={draft.mobileLayout}
                onChange={(e) =>
                  change({
                    mobileLayout: e.target.value as
                      "daily" | "compact" | "mobile",
                  })
                }
              >
                {[
                  ["daily", "日常展示"],
                  ["compact", "紧凑巡检"],
                  ["mobile", "手机布局"],
                ].map(([id, name]) => (
                  <option key={id} value={id}>
                    {t(name)}
                  </option>
                ))}
              </select>
            </label>
            <label className={T.field}>
              {t("外观")}
              <select
                value={draft.appearance}
                onChange={(e) =>
                  change({
                    appearance: e.target.value as "light" | "dark" | "system",
                  })
                }
              >
                {[
                  ["light", "浅色"],
                  ["dark", "深色"],
                  ["system", "跟随系统"],
                ].map(([id, name]) => (
                  <option key={id} value={id}>
                    {t(name)}
                  </option>
                ))}
              </select>
            </label>
            <label className={T.field}>
              {t("主题强调色")}
              <input
                type="color"
                value={draft.accent}
                onChange={(e) => change({ accent: e.target.value })}
              />
            </label>
            <CardOpacity
              value={draft.cardOpacity}
              appearance={draft.appearance}
              onChange={(cardOpacity) => change({ cardOpacity })}
            />
          </section>
        )}
        {step === 2 && (
          <section className={T.section}>
            <h3>{t("背景")}</h3>
            <label className={T.field}>
              {t("背景来源")}
              <select
                value={draft.backgroundSource}
                onChange={(e) => {
                  change({
                    backgroundSource: e.target.value as
                      "playlist" | "single" | "none",
                  });
                  setChangedBackground(true);
                }}
              >
                <option value="playlist">{t("使用当前媒体库")}</option>
                <option value="single">{t("单个图片或视频")}</option>
                <option value="none">{t("纯色背景")}</option>
              </select>
            </label>
            {draft.backgroundSource === "single" && (
              <>
                <label className={T.field}>
                  {t("背景类型")}
                  <select
                    value={draft.backgroundKind}
                    onChange={(e) => {
                      change({
                        backgroundKind: e.target.value as "image" | "video",
                      });
                      setChangedBackground(true);
                    }}
                  >
                    <option value="video">{t("视频")}</option>
                    <option value="image">{t("图片")}</option>
                  </select>
                </label>
                <label className={T.form}>
                  {t("背景链接")}
                  <input
                    value={draft.background}
                    onChange={(e) => {
                      change({ background: e.target.value });
                      setChangedBackground(true);
                    }}
                  />
                </label>
                <div className={T.actions} style={{ marginTop: 14 }}>
                  <button
                    className={T.action}
                    onClick={() => {
                      change({
                        background:
                          import.meta.env.BASE_URL + "media/background.mp4",
                        backgroundKind: "video",
                      });
                      setChangedBackground(true);
                    }}
                  >
                    {t("默认视频")}
                  </button>
                  <button
                    className={T.action}
                    onClick={() => {
                      change({
                        background:
                          import.meta.env.BASE_URL +
                          "media/background-poster.png",
                        backgroundKind: "image",
                      });
                      setChangedBackground(true);
                    }}
                  >
                    {t("默认图片")}
                  </button>
                </div>
              </>
            )}
            <p className={T.muted}>
              {t("完成后可在背景设置中上传、下载媒体并配置轮播。")}
            </p>
          </section>
        )}
        {step === 3 && (
          <>
            <section className={T.section}>
              <h3>{t("语言与时区")}</h3>
              <label className={T.field}>
                {t("语言")}
                <LanguageSelect
                  value={draft.locale}
                  onChange={(locale) => change({ locale })}
                />
              </label>
              <label className={T.field}>
                {t("显示时区")}
                <TimezonePicker
                  value={draft.timezone}
                  onChange={(timezone) => change({ timezone })}
                />
              </label>
            </section>
            <section className={T.section}>
              <h3>{t("状态显示设置")}</h3>
              <div className={T.fields}>
                {(
                  [
                    "clock",
                    "online",
                    "regions",
                    "traffic",
                    "speed",
                    "assets",
                  ] as const
                ).map((id, i) => (
                  <Toggle
                    key={id}
                    label={t(
                      [
                        "当前时间",
                        "当前在线",
                        "点亮地区",
                        "流量概览",
                        "网络速率",
                        "资产统计",
                      ][i],
                    )}
                    checked={draft.cards.includes(id)}
                    onChange={(value) =>
                      change({
                        cards: value
                          ? [...draft.cards, id]
                          : draft.cards.filter((k) => k !== id),
                      })
                    }
                  />
                ))}
              </div>
            </section>
            <section className={T.section}>
              <h3>{t("节点显示字段")}</h3>
              <div className={T.fields}>
                {(
                  [
                    "cpu",
                    "memory",
                    "disk",
                    "monthly",
                    "rates",
                    "totals",
                    "ping",
                    "expiry",
                  ] as const
                ).map((id, i) => (
                  <Toggle
                    key={id}
                    label={t(
                      [
                        "CPU",
                        "内存",
                        "磁盘",
                        "月度",
                        "上下行速率",
                        "累计流量",
                        "延迟 / 丢包",
                        "到期 / 运行时间",
                      ][i],
                    )}
                    checked={draft.fields.includes(id)}
                    onChange={(value) =>
                      change({
                        fields: value
                          ? [...draft.fields, id]
                          : draft.fields.filter((k) => k !== id),
                      })
                    }
                  />
                ))}
              </div>
              <Toggle
                label={t("心情系统")}
                checked={draft.mood}
                onChange={(mood) => change({ mood })}
              />
              <Toggle
                label={t("等级系统")}
                checked={draft.level}
                onChange={(level) => change({ level })}
              />
              <Toggle
                label={t("启用三维地球")}
                checked={draft.globeEnabled}
                onChange={(globeEnabled) => change({ globeEnabled })}
              />
            </section>
          </>
        )}
        {step === 4 && (
          <section className={T.section}>
            <h3>{t("即将应用的配置")}</h3>
            {[
              ["预设", t(names[preset])],
              [
                "桌面默认",
                t(draft.desktopLayout === "compact" ? "紧凑巡检" : "日常展示"),
              ],
              [
                "手机默认",
                t(
                  draft.mobileLayout === "mobile"
                    ? "手机布局"
                    : draft.mobileLayout === "compact"
                      ? "紧凑巡检"
                      : "日常展示",
                ),
              ],
              [
                "背景",
                t(
                  draft.backgroundSource === "none"
                    ? "纯色背景"
                    : draft.backgroundSource === "playlist"
                      ? "使用当前媒体库"
                      : draft.backgroundKind === "image"
                        ? "图片"
                        : "视频",
                ),
              ],
              ["显示时区", draft.timezone],
              ["语言", draft.locale],
              ["状态显示设置", String(draft.cards.length)],
              ["节点显示字段", String(draft.fields.length)],
              ["自动汇率", "Frankfurter"],
            ].map(([label, value]) => (
              <div key={label} className={T.field}>
                <span>{t(label)}</span>
                <strong>{value}</strong>
              </div>
            ))}
            <p className={T.muted}>
              {t("保存前不会改变当前站点。以后可在主题设置中重新打开向导。")}
            </p>
          </section>
        )}
        {error && (
          <p className={T.notice} role="alert">
            {error}
          </p>
        )}
        <div className={T.footer}>
          <button className={T.action} disabled={busy} onClick={close}>
            {t("稍后设置")}
          </button>
          <div className={T.actions}>
            {step > 0 && (
              <button
                className={T.action}
                disabled={busy}
                onClick={() => setStep((s) => s - 1)}
              >
                <ArrowLeft size={13} />
                {t("上一步")}
              </button>
            )}
            {step < 4 ? (
              <button
                className={T.primary}
                onClick={() => {
                  setError("");
                  try {
                    if (step === 2) validate();
                    setStep((s) => s + 1);
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                {t("下一步")}
                <ArrowRight size={13} />
              </button>
            ) : (
              <>
                <button
                  className={T.action}
                  disabled={busy}
                  onClick={() => void apply(false)}
                >
                  {t("仅应用到本机")}
                </button>
                {viewer.logged_in && (
                  <button
                    className={T.primary}
                    disabled={busy}
                    onClick={() => void apply(true)}
                  >
                    {t("保存为站点配置并开始")}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
