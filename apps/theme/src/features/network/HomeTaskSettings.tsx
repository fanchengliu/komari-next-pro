import { useModel } from "../../data/context";
import { useUI } from "../../data/store";
import { useTranslate } from "../../data/i18n";
import T from "../../ui/tools.module.css";
import V from "../../ui/v2.module.css";
export function HomeTaskSettings() {
  const { settings, tasks } = useModel(),
    configure = useUI((s) => s.configure),
    t = useTranslate();
  return (
    <>
      <div className={T.segments} role="group" aria-label={t("首页监测范围")}>
        {(["auto", "all", "custom"] as const).map((mode, i) => (
          <button
            key={mode}
            aria-pressed={settings.pingMode === mode}
            onClick={() => configure({ pingMode: mode })}
          >
            {t(["自动选择", "全部任务", "自定义任务"][i])}
          </button>
        ))}
      </div>
      <p className={T.muted}>
        {t(
          "自动选择优先汇总 TCP 任务；没有 TCP 任务时使用全部。真实的低延迟不会被修改。",
        )}
      </p>
      {settings.pingMode === "custom" && (
        <div className={V.pingTaskChoices}>
          {tasks
            .filter((task) => task.clients.length > 0)
            .map((task) => (
              <label key={task.id}>
                <input
                  type="checkbox"
                  aria-label={task.name}
                  checked={settings.pingTaskIds.includes(task.id)}
                  onChange={(e) =>
                    configure({
                      pingTaskIds: e.target.checked
                        ? [...settings.pingTaskIds, task.id]
                        : settings.pingTaskIds.filter((id) => id !== task.id),
                    })
                  }
                />
                <span>
                  {task.name}
                  <small> · {task.type.toUpperCase()}</small>
                </span>
              </label>
            ))}
        </div>
      )}
      <button
        className={T.action}
        onClick={() => configure({ pingMode: "auto", pingTaskIds: [] })}
      >
        {t("恢复首页默认线路")}
      </button>
    </>
  );
}
