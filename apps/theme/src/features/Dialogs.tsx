import { SetupWizard } from "./setup/SetupWizard";
import {
  ClockOverview,
  OnlineOverview,
  TransferOverview,
} from "./tools/Overview";

import { Assets, Expiry, Traffic } from "./tools/Reports";
import { Settings } from "./tools/Settings";
export { Settings } from "./tools/Settings";
import { BackgroundSettings } from "./tools/BackgroundSettings";
import { ExtensionCenter } from "./tools/ExtensionCenter";
import T from "../ui/tools.module.css";
import { useTranslate } from "../data/i18n";
import { useState, lazy, Suspense, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useModel } from "../data/context";
import { useUI } from "../data/store";
import { json, rpc } from "../data/rpc";
import { S, Modal, State } from "../ui/primitives";
const GlobePanel = lazy(() =>
  import("./globe/GlobePanel").then((m) => ({ default: m.GlobePanel })),
);
export function Dialogs() {
  const t = useTranslate();
  const { dialog, set } = useUI();
  if (dialog === "setup") return <SetupWizard />;
  const titles: Record<string, string> = {
    login: t("登录"),
    assets: t("资产统计"),
    expiry: t("到期时间线"),
    traffic: t("流量统计"),
    background: t("背景设置"),
    settings: t("主题设置"),
    extensions: t("扩展服务"),
    clock: t("当前时间"),
    online: t("当前在线"),
    globe: t("点亮地区"),
    totals: t("流量概览"),
    speed: t("网络速率"),
  };
  return (
    <Modal
      open={!!dialog}
      title={titles[dialog ?? ""] ?? ""}
      onClose={() => set({ dialog: null })}
      wide={dialog !== "login"}
      className={
        dialog !== "login"
          ? `${T.window} ${dialog === "globe" ? T.globeWindow : ""}`
          : ""
      }
    >
      <div className={dialog !== "login" ? T.body : undefined}>
        {dialog === "login" ? (
          <Login />
        ) : dialog === "assets" ? (
          <Assets />
        ) : dialog === "expiry" ? (
          <Expiry />
        ) : dialog === "traffic" ? (
          <Traffic />
        ) : dialog === "background" ? (
          <BackgroundSettings />
        ) : dialog === "settings" ? (
          <Settings />
        ) : dialog === "extensions" ? (
          <ExtensionCenter />
        ) : dialog === "clock" ? (
          <ClockOverview />
        ) : dialog === "online" ? (
          <OnlineOverview />
        ) : dialog === "totals" ? (
          <TransferOverview />
        ) : dialog === "speed" ? (
          <TransferOverview speed />
        ) : dialog === "globe" ? (
          <Suspense fallback={<State busy />}>
            <GlobePanel embedded onNavigate={() => set({ dialog: null })} />
          </Suspense>
        ) : null}
      </div>
    </Modal>
  );
}
function Login() {
  const t = useTranslate();
  const { site, refresh } = useModel();
  const set = useUI((s) => s.set);
  const client = useQueryClient();
  const [error, setError] = useState<Error | null>(null),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const result = await json<{ status: string; message?: string }>(
        "/api/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: form.get("username"),
            password: form.get("password"),
            "2fa_code": form.get("otp"),
          }),
        },
      );
      if (result.status !== "success")
        throw new Error(result.message || t("登录失败"));
      rpc.reset();
      await client.cancelQueries();
      client.removeQueries({ queryKey: ["session"] });
      await client.invalidateQueries({ queryKey: ["identity"] });
      set({ dialog: null });
      refresh();
    } catch (err) {
      setError(err as Error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className={S.form} onSubmit={submit}>
      {!site?.disable_password_login && (
        <>
          <label>
            {t("用户名")}
            <input name="username" autoComplete="username" required autoFocus />
          </label>
          <label>
            {t("密码")}
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <label>
            {t("两步验证码（如已启用）")}
            <input
              name="otp"
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={8}
            />
          </label>
          <button type="submit" disabled={busy}>
            {busy ? t("登录中…") : t("登录")}
          </button>
        </>
      )}
      {site?.oauth_enable && (
        <a className={S.notice} href="/api/oauth">
          {t("通过第三方账号登录")}
        </a>
      )}
      {error && <State error={error} />}
      <a href="/admin" className={S.note}>
        {t("打开 Komari 管理后台")}
      </a>
    </form>
  );
}
