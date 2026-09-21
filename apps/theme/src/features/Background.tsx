import { useEffect, useReducer, useRef } from "react";
import type { MediaItem } from "../../../../packages/contracts";
import { useModel, usePlaylist } from "../data/context";
import { safeMediaUrl } from "../domain/model";
import { S } from "../ui/primitives";
import { useUI } from "../data/store";
import { playlistSchema } from "../../../../packages/contracts";
type State = {
  index: number;
  phase: "loading" | "playing" | "paused" | "error";
  hidden: boolean;
  failures: number;
};
type Event = {
  type: "ready" | "error" | "next" | "visibility" | "reset";
  count?: number;
  hidden?: boolean;
  random?: boolean;
};
export function mediaReducer(state: State, e: Event): State {
  if (e.type === "reset")
    return { index: 0, phase: "loading", hidden: state.hidden, failures: 0 };
  if (e.type === "visibility")
    return {
      ...state,
      hidden: !!e.hidden,
      phase: e.hidden
        ? state.phase === "playing"
          ? "paused"
          : state.phase
        : state.phase === "paused"
          ? "playing"
          : state.phase,
    };
  if (e.type === "ready")
    return {
      ...state,
      phase: state.hidden ? "paused" : "playing",
      failures: 0,
    };
  if (e.type === "error")
    return { ...state, phase: "error", failures: state.failures + 1 };
  const count = e.count ?? 1;
  let index = state.index + 1;
  if (e.random && count > 1)
    index = state.index + 1 + Math.floor(Math.random() * (count - 1));
  return { ...state, index, phase: "loading" };
}
export function Background() {
  const { settings } = useModel();
  const serverPlaylist = usePlaylist().data;
  const override = useUI((s) => s.playlistOverride);
  const parsed = playlistSchema.safeParse(override);
  const playlist = parsed.success
    ? parsed.data
    : settings.backgroundSource === "none"
      ? {
          version: 1 as const,
          mode: "none" as const,
          order: "hold" as const,
          videoTiming: "full" as const,
          interval: 10,
          items: [],
        }
      : settings.backgroundSource === "single"
        ? {
            version: 1 as const,
            mode: settings.backgroundKind,
            order: "hold" as const,
            videoTiming: "full" as const,
            interval: 10,
            items: safeMediaUrl(settings.background)
              ? [
                  {
                    id: "single",
                    url: settings.background,
                    kind: settings.backgroundKind,
                    name: "背景",
                    duration: 10,
                  },
                ]
              : [],
          }
        : serverPlaylist;
  const fallback: MediaItem[] = safeMediaUrl(settings.background)
    ? [
        {
          id: "fallback",
          url: settings.background,
          kind: /\.(mp4|webm)(\?|$)/i.test(settings.background)
            ? "video"
            : "image",
          name: "背景",
          duration: 10,
        },
      ]
    : [];
  const eligible =
    playlist?.mode === "none"
      ? []
      : playlist?.items.length
        ? playlist.items.filter(
            (x) => x.kind === playlist.mode && safeMediaUrl(x.url),
          )
        : playlist?.mode === "image"
          ? [
              {
                id: "poster",
                url: import.meta.env.BASE_URL + "media/background-poster.png",
                kind: "image" as const,
                name: "默认背景",
                duration: 10,
              },
            ]
          : fallback;
  const selected = Math.max(
    0,
    eligible.findIndex((i) => i.id === playlist?.selectedId),
  );
  const ordered = [...eligible.slice(selected), ...eligible.slice(0, selected)];
  const items = playlist?.order === "hold" ? ordered.slice(0, 1) : ordered;
  const [state, dispatch] = useReducer(mediaReducer, {
    index: 0,
    phase: "loading",
    hidden: document.hidden,
    failures: 0,
  });
  const video = useRef<HTMLVideoElement>(null);
  const key = items.map((x) => x.id + x.url).join("|");
  useEffect(() => dispatch({ type: "reset" }), [key]);
  const item = items[state.index % Math.max(1, items.length)];
  const next = () =>
    playlist?.order === "hold"
      ? undefined
      : dispatch({
          type: "next",
          count: items.length,
          random: playlist?.order === "random",
        });
  useEffect(() => {
    const onChange = () =>
      dispatch({ type: "visibility", hidden: document.hidden });
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (state.hidden) v.pause();
    else void v.play().catch(() => dispatch({ type: "error" }));
  }, [state.hidden, item?.url]);
  useEffect(() => {
    if (state.hidden || !item) return;
    if (state.phase === "error") {
      if (state.failures >= items.length) return;
      const t = setTimeout(next, 2000);
      return () => clearTimeout(t);
    }
    if (state.phase !== "playing") return;
    if (playlist?.order === "hold") return;
    if (item.kind === "video" && playlist?.videoTiming !== "fixed") return;
    const t = setTimeout(next, (playlist?.interval ?? item.duration) * 1000);
    return () => clearTimeout(t);
  }, [
    state.hidden,
    state.phase,
    state.index,
    item?.id,
    items.length,
    playlist?.interval,
    playlist?.videoTiming,
    playlist?.order,
  ]);
  useEffect(() => {
    if (items.length < 2) return;
    const upcoming = items[(state.index + 1) % items.length];
    if (upcoming.kind !== "image") return;
    const img = new Image();
    img.src = upcoming.url;
    return () => {
      img.src = "";
    };
  }, [state.index, key]);
  return (
    <div
      className={S.background}
      aria-hidden="true"
      data-phase={state.phase}
      data-empty={items.length === 0}
    >
      {state.phase === "error" ? null : item?.kind === "image" ? (
        <img
          key={item.url + state.index}
          src={item.url}
          alt=""
          onLoad={() => dispatch({ type: "ready" })}
          onError={() => dispatch({ type: "error" })}
        />
      ) : item ? (
        <video
          key={item.url + state.index}
          ref={video}
          src={item.url}
          autoPlay
          poster={import.meta.env.BASE_URL + "media/background-poster.png"}
          muted
          playsInline
          loop={items.length === 1}
          onCanPlay={() => dispatch({ type: "ready" })}
          onEnded={next}
          onError={() => dispatch({ type: "error" })}
        />
      ) : null}
    </div>
  );
}
