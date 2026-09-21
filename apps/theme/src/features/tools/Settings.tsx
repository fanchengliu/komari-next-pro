import { ExchangeRates } from "./ExchangeRates";
import { LanguageSelect } from "../../ui/LanguageSelect";
import { CardOpacity } from "../../ui/CardOpacity";
import { useState } from "react";
import {
  Palette,
  LayoutGrid,
  SlidersHorizontal,
  Globe,
  Plug,
} from "lucide-react";
import { useModel } from "../../data/context";
import { useUI } from "../../data/store";
import { useTranslate } from "../../data/i18n";
import { json } from "../../data/rpc";
import { defaultSettings } from "../../../../../packages/contracts";
import { Toggle } from "../../ui/primitives";
import { statNames } from "../Dashboard";
import { V2Settings } from "../V2Settings";
import { ExtensionCenter } from "./ExtensionCenter";
import T from "../../ui/tools.module.css";
export function Settings() {
  const { settings, viewer, refresh } = useModel(),
    t = useTranslate(),
    configure = useUI((s) => s.configure);
  const [tab, setTab] = useState("appearance"),
    [logo, setLogo] = useState(settings.logo),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const tabs = [
    ["appearance", "外观与颜色", Palette],
    ["display", "概览与字段", LayoutGrid],
    ["layout", "布局与网络", SlidersHorizontal],
    ["region", "地区与资产", Globe],
    ["extensions", "扩展服务", Plug],
  ] as const;
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const r = await json<{ status: string; message?: string }>(
        "/api/admin/theme/settings?theme=komari-ds",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settings),
        },
      );
      if (r.status !== "success") throw Error(r.message || t("保存失败"));
      setMessage(t("已保存站点默认设置"));
      refresh();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className={T.intro}>
        <p>{t("使用完整预设快速配置布局、背景和显示内容。")}</p>
        <button
          className={T.action}
          onClick={() => useUI.getState().set({ dialog: "setup" })}
        >
          {t("重新配置主题")}
        </button>
      </div>
      <div className={T.settings}>
        <div className={T.side} role="tablist" aria-label={t("设置分类")}>
          {tabs.map(([id, label, Icon]) => (
            <button
              role="tab"
              key={id}
              aria-selected={tab === id}
              aria-controls={"settings-" + id}
              id={"tab-" + id}
              onClick={() => setTab(id)}
            >
              <Icon size={16} />
              {t(label)}
            </button>
          ))}
        </div>
        <div
          className={T.settingsPanel}
          role="tabpanel"
          id={"settings-" + tab}
          aria-labelledby={"tab-" + tab}
        >
          {tab === "appearance" && (
            <>
              <section className={T.section}>
                <h3>{t("网络速率颜色")}</h3>
                {(["downloadColor", "uploadColor", "accent"] as const).map(
                  (key, i) => (
                    <label key={key} className={T.field}>
                      <span>
                        {t(["↓ 下载颜色", "↑ 上传颜色", "主题强调色"][i])}
                      </span>
                      <span className={T.actions}>
                        <code>{settings[key]}</code>
                        <input
                          type="color"
                          aria-label={t(
                            ["↓ 下载颜色", "↑ 上传颜色", "主题强调色"][i],
                          )}
                          value={settings[key]}
                          onChange={(e) => configure({ [key]: e.target.value })}
                        />
                      </span>
                    </label>
                  ),
                )}
                <button
                  className={T.action}
                  style={{ marginTop: 14 }}
                  onClick={() =>
                    configure({
                      downloadColor: defaultSettings.downloadColor,
                      uploadColor: defaultSettings.uploadColor,
                      accent: defaultSettings.accent,
                    })
                  }
                >
                  {t("恢复默认颜色")}
                </button>
              </section>
              <section className={T.section}>
                <h3>{t("外观")}</h3>
                <label className={T.field}>
                  {t("外观")}
                  <select
                    aria-label={t("外观")}
                    value={settings.appearance}
                    onChange={(e) =>
                      configure({
                        appearance: e.target.value as
                          "light" | "dark" | "system",
                      })
                    }
                  >
                    {[
                      ["light", "浅色"],
                      ["dark", "深色"],
                      ["system", "跟随系统"],
                    ].map(([id, label]) => (
                      <option key={id} value={id}>
                        {t(label)}
                      </option>
                    ))}
                  </select>
                </label>
                <CardOpacity
                  value={settings.cardOpacity}
                  appearance={settings.appearance}
                  onChange={(cardOpacity) => configure({ cardOpacity })}
                />
                <div className={T.form} style={{ marginTop: 16 }}>
                  <label>
                    {t("Logo 图片链接")}
                    <input
                      value={logo}
                      onChange={(e) => setLogo(e.target.value)}
                    />
                  </label>
                  <div className={T.actions}>
                    <button
                      className={T.action}
                      onClick={() => configure({ logo })}
                    >
                      {t("应用")}
                    </button>
                    <button
                      className={T.action}
                      onClick={() => {
                        setLogo("");
                        configure({ logo: "" });
                      }}
                    >
                      {t("清除")}
                    </button>
                  </div>
                </div>
              </section>
            </>
          )}
          {tab === "display" && (
            <>
              <section className={T.section}>
                <h3>{t("状态显示设置")}</h3>
                <div className={T.fields}>
                  {(Object.keys(statNames) as (keyof typeof statNames)[]).map(
                    (key) => (
                      <Toggle
                        key={key}
                        label={t(statNames[key])}
                        checked={settings.cards.includes(key)}
                        onChange={(value) =>
                          configure({
                            cards: value
                              ? [...settings.cards, key]
                              : settings.cards.filter((k) => k !== key),
                          })
                        }
                      />
                    ),
                  )}
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
                  ).map((key, i) => (
                    <Toggle
                      key={key}
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
                      checked={settings.fields.includes(key)}
                      onChange={(value) =>
                        configure({
                          fields: value
                            ? [...settings.fields, key]
                            : settings.fields.filter((k) => k !== key),
                        })
                      }
                    />
                  ))}
                </div>
                <Toggle
                  label={t("心情系统")}
                  checked={settings.mood}
                  onChange={(mood) => configure({ mood })}
                />
                <Toggle
                  label={t("等级系统")}
                  checked={settings.level}
                  onChange={(level) => configure({ level })}
                />
              </section>
            </>
          )}
          {tab === "layout" && <V2Settings />}
          {tab === "region" && (
            <>
              <section className={T.section}>
                <h3>{t("时区与语言")}</h3>
                <label className={T.field}>
                  {t("显示时区")}
                  <select
                    aria-label={t("显示时区")}
                    value={settings.timezone}
                    onChange={(e) => configure({ timezone: e.target.value })}
                  >
                    {[
                      "Asia/Shanghai",
                      "Asia/Hong_Kong",
                      "UTC",
                      "America/New_York",
                      "Europe/London",
                    ].map((zone) => (
                      <option key={zone}>{zone}</option>
                    ))}
                  </select>
                </label>
                <label className={T.field}>
                  {t("语言")}
                  <LanguageSelect />
                </label>
              </section>
              <ExchangeRates />
            </>
          )}
          {tab === "extensions" && <ExtensionCenter />}
        </div>
      </div>
      <div className={T.footer}>
        <span>
          {t("外观偏好保存于当前浏览器。管理员可将当前设置保存为站点默认。")}
        </span>
        {viewer.logged_in && (
          <button className={T.primary} disabled={busy} onClick={save}>
            {t("保存为站点默认")}
          </button>
        )}
      </div>
      {message && (
        <p className={T.notice} role="status">
          {message}
        </p>
      )}
    </>
  );
}
