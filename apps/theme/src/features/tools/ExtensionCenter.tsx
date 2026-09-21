import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useModel } from "../../data/context";
import { useTranslate } from "../../data/i18n";
import { useUI } from "../../data/store";
import T from "../../ui/tools.module.css";
export function ExtensionCenter() {
  const { extension, identity, viewer } = useModel(),
    t = useTranslate(),
    client = useQueryClient();
  const [busy, setBusy] = useState(false);
  return (
    <>
      <div className={T.intro}>
        <p>
          <span className={T.eyebrow}>EXTENSIONS / KOMARI NEXT PRO</span>
          {t("配套服务运行在 Komari 服务器上，通过同一域名连接。")}
        </p>
      </div>
      <div className={T.bar}>
        <h3>
          <i className={T.statusDot} data-ok={!!extension} />
          {t(extension ? "扩展已连接" : "扩展尚未连接")}
          {extension && ` · ${extension.version}`}
        </h3>
        <button
          className={T.action}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await client.invalidateQueries({
              queryKey: ["session", identity, "extension"],
            });
            setBusy(false);
          }}
        >
          {t("重新检查连接")}
        </button>
      </div>
      <div className={T.extensionCards}>
        {[
          ["media", "背景媒体库", "链接下载、文件上传、图片和视频播放列表"],
          [
            "ip",
            "IP 信息与质量",
            "通过节点查询出口 IP；质量数据可按需配置来源",
          ],
          [
            "unlock",
            "流媒体检测",
            "保留实际响应证据；可达不等于账号或地区已解锁",
          ],
          ["services", "本地服务快照", "通过现有 Agent 读取系统和服务状态"],
        ].map(([key, title, description]) => (
          <div key={key}>
            <i
              className={T.statusDot}
              data-ok={
                !!extension?.[key as "media" | "ip" | "unlock" | "services"]
              }
            />
            <strong>{t(title)}</strong>
            <small>{t(description)}</small>
            <small>
              {t(
                extension?.[key as "media" | "ip" | "unlock" | "services"]
                  ? "已启用"
                  : extension
                    ? "模块未启用"
                    : "等待接入",
              )}
            </small>
          </div>
        ))}
      </div>
      {viewer.logged_in && (
        <section className={T.section} style={{ marginTop: 18 }}>
          <h3>{t("如何接入")}</h3>
          <p className={T.muted}>
            {t(
              "解压配套的 extension.zip 到 Komari 服务器，按部署说明启动服务，再添加同域代理。无需向每台节点安装新的主题插件。",
            )}
          </p>
          <ol className={T.muted}>
            <li>
              {t("填写 Komari 后端地址和本站域名，使用独立媒体数据目录。")}
            </li>
            <li>{t("启动配套扩展服务，将 /komari-ds-api/ 代理到该服务。")}</li>
            <li>
              {t(
                "需要节点检测时启用任务模块，并在 Komari 中允许相应 Agent 执行任务。",
              )}
            </li>
            <li>{t("回到这里重新检查连接。检测始终由你手动发起。")}</li>
          </ol>
          <a
            className={T.action}
            href={import.meta.env.BASE_URL + "extension-guide.html"}
            target="_blank"
            rel="noreferrer"
          >
            {t("打开扩展部署说明")}
          </a>
        </section>
      )}
      {extension && !extension.remoteImport && (
        <p className={T.notice}>
          {t("当前扩展版本不支持链接下载，请使用随 2.1 主题提供的扩展包升级。")}
        </p>
      )}
      <p className={T.muted}>
        {t("检测结果按账号与节点隔离；主题不会自动运行节点命令。")}
      </p>
    </>
  );
}
export function ExtensionNotice() {
  const t = useTranslate(),
    set = useUI((s) => s.set);
  return (
    <div className={T.notice}>
      <p>{t("这个功能由服务器上的配套扩展提供。连接后可在这里直接使用。")}</p>
      <button
        className={T.action}
        onClick={() => set({ dialog: "extensions" })}
      >
        {t("查看扩展连接与安装")}
      </button>
    </div>
  );
}
