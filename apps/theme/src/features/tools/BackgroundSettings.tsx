import { patchSiteSettings } from "../../data/settings";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  Trash2,
  Check,
  Download,
  Upload,
} from "lucide-react";
import {
  API,
  emptyPlaylist,
  playlistSchema,
  type Playlist,
  type MediaItem,
} from "../../../../../packages/contracts";
import { useModel, usePlaylist } from "../../data/context";
import { useUI } from "../../data/store";
import { useTranslate } from "../../data/i18n";
import { extensionWrite, uploadMedia } from "../../data/extension";
import { json } from "../../data/rpc";
import { safeMediaUrl } from "../../domain/model";
import { State } from "../../ui/primitives";
import { ExtensionNotice } from "./ExtensionCenter";
import T from "../../ui/tools.module.css";
export function BackgroundSettings() {
  const { viewer, extension, identity, settings } = useModel(),
    t = useTranslate(),
    client = useQueryClient();
  const configure = useUI((s) => s.configure);
  const local = useUI((s) => s.playlistOverride),
    set = useUI((s) => s.set);
  const playlist = usePlaylist();
  const [draft, setDraft] = useState<Playlist>(
      () => local ?? playlist.data ?? emptyPlaylist,
    ),
    [dirty, setDirty] = useState(false),
    [url, setUrl] = useState(""),
    [kind, setKind] = useState<"image" | "video">("video"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [progress, setProgress] = useState(0);
  const library = useQuery({
    queryKey: ["session", identity, "media-library"],
    queryFn: () => json<MediaItem[]>(API + "/media"),
    enabled: viewer.logged_in && !!extension?.media,
    staleTime: 30000,
  });
  useEffect(() => {
    if (!dirty) setDraft(local ?? playlist.data ?? emptyPlaylist);
  }, [playlist.data, local, dirty]);
  function change(value: Partial<Playlist>) {
    setDirty(true);
    setDraft((d) => ({ ...d, ...value }));
  }
  function add(item: MediaItem) {
    setDirty(true);
    setDraft((d) => ({
      ...d,
      mode: item.kind,
      selectedId: item.id,
      items: [...d.items.filter((i) => i.id !== item.id), item],
    }));
    setUrl("");
  }
  async function job(work: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await work();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveServer() {
    await job(async () => {
      const validated = playlistSchema.parse(draft);
      await extensionWrite("/playlist", "PUT", validated);
      if (settings.backgroundSource !== "playlist") {
        try {
          await patchSiteSettings({ backgroundSource: "playlist" });
        } catch {
          throw Error(t("播放列表已保存，但背景来源切换失败，请重试"));
        }
      }
      configure({ backgroundSource: "playlist" });
      set({ playlistOverride: null });
      client.setQueryData(["session", identity, "playlist"], validated);
      setDirty(false);
      setMessage(t("播放列表已保存"));
      await client.invalidateQueries({
        queryKey: ["session", identity, "playlist"],
      });
    });
  }
  function saveLocal() {
    try {
      set({ playlistOverride: playlistSchema.parse(draft) });
      setDirty(false);
      setMessage(t("已保存本机背景设置"));
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  function linkItem() {
    if (!safeMediaUrl(url)) return;
    add({
      id: crypto.randomUUID(),
      url,
      kind,
      name:
        new URL(url, location.origin).pathname.split("/").pop() || t("背景"),
      duration: 10,
    });
  }
  async function upload(file: File) {
    await job(async () => {
      const body = new FormData();
      body.append("file", file);
      const item = await uploadMedia<MediaItem>(body, setProgress);
      add(item);
      setMessage(t("上传完成，请保存播放列表"));
      await client.invalidateQueries({
        queryKey: ["session", identity, "media-library"],
      });
    });
  }
  async function download() {
    await job(async () => {
      const item = await extensionWrite<MediaItem>("/media/import", "POST", {
        url,
      });
      add(item);
      setMessage(t("已下载到服务器媒体库，请保存播放列表"));
      await client.invalidateQueries({
        queryKey: ["session", identity, "media-library"],
      });
    });
  }
  async function remove(item: MediaItem) {
    await job(async () => {
      if (item.url.startsWith(API + "/media/"))
        await extensionWrite("/media/" + encodeURIComponent(item.id), "DELETE");
      change({
        items: draft.items.filter((i) => i.id !== item.id),
        selectedId: draft.selectedId === item.id ? undefined : draft.selectedId,
      });
      await client.invalidateQueries({
        queryKey: ["session", identity, "media-library"],
      });
    });
  }
  function move(index: number, by: number) {
    const items = [...draft.items];
    [items[index], items[index + by]] = [items[index + by], items[index]];
    change({ items });
  }
  const items = draft.items;
  const outside = (library.data ?? []).filter(
    (i) => !items.some((item) => item.id === i.id),
  );
  if (!viewer.logged_in)
    return <State empty={t("登录后可管理背景图片与视频")} />;
  return (
    <>
      <div className={T.intro}>
        <p>
          <span className={T.eyebrow}>BACKGROUND / KOMARI NEXT PRO</span>
          {t("图片、视频和播放节奏，在一个媒体库里管理。")}
        </p>
        <span className={T.badge}>
          {t(extension?.media ? "服务器媒体库已连接" : "本机背景设置")}
        </span>
      </div>
      <section className={T.section}>
        <div className={T.bar} style={{ marginTop: 0 }}>
          <h3>{t("添加背景")}</h3>
          <select
            aria-label={t("链接媒体类型")}
            value={kind}
            onChange={(e) => setKind(e.target.value as "image" | "video")}
          >
            <option value="video">{t("视频")}</option>
            <option value="image">{t("图片")}</option>
          </select>
        </div>
        <div className={T.form}>
          <label>
            {t("背景链接")}
            <input
              aria-label={t("背景链接")}
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (/\.(png|jpe?g|webp)(\?|$)/i.test(e.target.value))
                  setKind("image");
                if (/\.(mp4|webm)(\?|$)/i.test(e.target.value))
                  setKind("video");
              }}
              placeholder="https://…"
            />
          </label>
          <div className={T.actions}>
            <button
              className={T.action}
              disabled={busy || !safeMediaUrl(url)}
              onClick={linkItem}
            >
              {t("加入播放列表")}
            </button>
            <button
              className={T.primary}
              disabled={
                busy || !/^https?:\/\//i.test(url) || !extension?.remoteImport
              }
              onClick={() => void download()}
            >
              <Download size={13} />
              {t("下载到服务器")}
            </button>
          </div>
        </div>
        {extension?.media && (
          <label className={T.drop} style={{ display: "block", marginTop: 16 }}>
            <Upload size={17} /> {t("上传媒体")}
            <input
              type="file"
              aria-label={t("上传媒体")}
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
                e.target.value = "";
              }}
            />
          </label>
        )}
        {busy && (
          <progress
            aria-label={t("上传进度")}
            value={progress || undefined}
            max={100}
            style={{ width: "100%", marginTop: 14 }}
          />
        )}
      </section>
      <section className={T.section}>
        <h3>{t("播放设置")}</h3>
        <div className={T.fields}>
          <label className={T.field}>
            {t("背景类型")}
            <select
              aria-label={t("背景类型")}
              value={draft.mode}
              onChange={(e) =>
                change({ mode: e.target.value as Playlist["mode"] })
              }
            >
              <option value="image">{t("图片")}</option>
              <option value="video">{t("视频")}</option>
              <option value="none">{t("关闭")}</option>
            </select>
          </label>
          <label className={T.field}>
            {t("播放顺序")}
            <select
              aria-label={t("播放顺序")}
              value={draft.order}
              onChange={(e) =>
                change({ order: e.target.value as Playlist["order"] })
              }
            >
              <option value="rotation">{t("顺序轮播")}</option>
              <option value="random">{t("随机")}</option>
              <option value="hold">{t("保持当前背景")}</option>
            </select>
          </label>
          <label className={T.field}>
            {t("视频切换")}
            <select
              aria-label={t("视频切换")}
              value={draft.videoTiming}
              onChange={(e) =>
                change({
                  videoTiming: e.target.value as Playlist["videoTiming"],
                })
              }
              disabled={draft.order === "hold"}
            >
              <option value="full">{t("完整播放")}</option>
              <option value="fixed">{t("固定时长")}</option>
            </select>
          </label>
          <label className={T.field}>
            {t("间隔（秒）")}
            <input
              aria-label={t("间隔（秒）")}
              type="number"
              min={2}
              max={3600}
              value={draft.interval}
              disabled={draft.order === "hold"}
              onChange={(e) => change({ interval: Number(e.target.value) })}
            />
          </label>
        </div>
      </section>
      <div className={T.bar}>
        <h3>
          {t("播放列表")} <span className={T.badge}>{items.length}</span>
        </h3>
        <button
          className={T.action}
          onClick={() =>
            add({
              id: "bundled-default",
              url: import.meta.env.BASE_URL + "media/background.mp4",
              kind: "video",
              name: t("默认背景"),
              duration: 10,
            })
          }
        >
          {t("加入默认背景")}
        </button>
      </div>
      <div className={T.mediaGrid}>
        {items.map((item, i) => (
          <article
            className={T.media}
            key={item.id}
            data-selected={draft.selectedId === item.id}
          >
            {item.kind === "image" ? (
              <img className={T.mediaPreview} src={item.url} alt="" />
            ) : (
              <video
                className={T.mediaPreview}
                src={item.url}
                muted
                preload="metadata"
              />
            )}
            <div className={T.mediaInfo}>
              <strong title={item.name}>{item.name || t("背景")}</strong>
              <div className={T.actions}>
                <button
                  aria-label={`${t("选用")} ${i + 1}`}
                  onClick={() =>
                    change({ selectedId: item.id, mode: item.kind })
                  }
                >
                  <Check size={12} />
                  {t("选用")}
                </button>
                <button
                  aria-label={`上移 ${i + 1}`}
                  disabled={i === 0 || busy}
                  onClick={() => move(i, -1)}
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  aria-label={`下移 ${i + 1}`}
                  disabled={i === items.length - 1 || busy}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown size={12} />
                </button>
                <button
                  aria-label={`删除 ${i + 1}`}
                  disabled={busy}
                  onClick={() => void remove(item)}
                >
                  <Trash2 size={12} />
                </button>
                {item.kind === "video" &&
                  extension?.transcode &&
                  item.url.startsWith(API + "/media/") && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void job(async () => {
                          const converted = await extensionWrite<MediaItem>(
                            "/media/" + item.id + "/transcode",
                            "POST",
                          );
                          add(converted);
                          setMessage(
                            t("转码完成，原文件已保留，请保存播放列表"),
                          );
                        })
                      }
                    >
                      {t("转码")}
                    </button>
                  )}
              </div>
            </div>
          </article>
        ))}
      </div>
      {!items.length && (
        <p className={T.notice}>{t("尚未添加媒体，当前使用默认背景。")}</p>
      )}
      {outside.length > 0 && (
        <section className={T.section} style={{ marginTop: 18 }}>
          <h3>{t("媒体库中未加入列表的文件")}</h3>
          {outside.map((item) => (
            <div key={item.id} className={T.field}>
              <span>{item.name}</span>
              <button className={T.action} onClick={() => add(item)}>
                {t("加入播放列表")}
              </button>
            </div>
          ))}
        </section>
      )}
      {!extension?.media && <ExtensionNotice />}
      <div className={T.footer}>
        <span>
          {t(dirty ? "有未保存的更改" : "选择媒体后保存，即可应用背景")}
        </span>
        <div className={T.actions}>
          <button className={T.action} disabled={busy} onClick={saveLocal}>
            {t("保存到本机")}
          </button>
          {extension?.media && (
            <button
              className={T.primary}
              disabled={
                busy || (draft.order === "hold" && !extension.remoteImport)
              }
              onClick={() => void saveServer()}
            >
              {t("保存播放列表")}
            </button>
          )}
          {local && (
            <button
              className={T.action}
              onClick={() => {
                set({ playlistOverride: null });
                setDirty(false);
                setDraft(playlist.data ?? emptyPlaylist);
              }}
            >
              {t("使用站点背景")}
            </button>
          )}
        </div>
      </div>
      {message && (
        <p className={T.notice} role="status">
          {message}
        </p>
      )}
    </>
  );
}
