import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useModel } from "../data/context";
import { useTranslate } from "../data/i18n";
import V from "./v2.module.css";
export function Freshness() {
  const { lastUpdate, error, refresh } = useModel();
  const t = useTranslate();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const age = lastUpdate
    ? Math.max(0, Math.floor((now - lastUpdate) / 1000))
    : null;
  return (
    <button
      className={V.freshness}
      onClick={refresh}
      title={t("点击刷新数据")}
      aria-label={t("点击刷新数据")}
      data-stale={!!error || age === null || age > 20}
    >
      <i />
      {error
        ? t("更新异常")
        : age === null
          ? t("等待数据")
          : `${t("最近接收")} ${age} ${t("秒前")}`}
      <RefreshCw size={11} />
    </button>
  );
}
