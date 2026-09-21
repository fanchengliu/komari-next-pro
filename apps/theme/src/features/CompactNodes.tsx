import { expiryText } from "../domain/model";
import { Link } from "react-router-dom";
import type { NodeInfo } from "../../../../packages/contracts";
import { useModel } from "../data/context";
import { useTranslate } from "../data/i18n";
import { bytes, daysLeft, pct, percent } from "../domain/model";
import { PingSummaryBars } from "./network/PingSummaryBars";
import { Flag } from "../ui/Flag";
import V from "../ui/v2.module.css";
export function CompactNodes({ nodes }: { nodes: NodeInfo[] }) {
  const { statuses, settings } = useModel();
  const t = useTranslate();
  return (
    <section className={`${V.panel} ${V.compact}`}>
      <div className={V.tableWrap}>
        <table className={V.table}>
          <thead>
            <tr>
              <th>{t("节点")}</th>
              <th>{t("状态")}</th>
              {settings.fields.includes("cpu") && <th>CPU</th>}
              {settings.fields.includes("memory") && <th>{t("内存")}</th>}
              {settings.fields.includes("disk") && <th>{t("磁盘")}</th>}
              {settings.fields.includes("rates") && <th>{t("下载 / 上传")}</th>}
              {settings.fields.includes("ping") && <th>{t("延迟 / 丢包")}</th>}
              {settings.fields.includes("expiry") && <th>{t("到期")}</th>}
            </tr>
          </thead>
          <tbody>
            {nodes.map((n) => {
              const s = statuses[n.id],
                days = daysLeft(n);
              return (
                <tr key={n.id} data-node={n.id}>
                  <td>
                    <Link
                      to={`/instance/${encodeURIComponent(n.id)}`}
                      className={V.name}
                      aria-label={`${t("查看")} ${n.name}`}
                    >
                      <Flag region={n.region} />
                      {n.name}
                    </Link>
                  </td>
                  <td>
                    <span className={V.softBadge}>
                      <i
                        className={V.dot}
                        data-status={
                          !s ? "unknown" : s.online ? "online" : "offline"
                        }
                      />
                      {t(!s ? "等待数据" : s.online ? "在线" : "离线")}
                    </span>
                  </td>
                  {settings.fields.includes("cpu") && <td>{pct(s?.cpu)}</td>}
                  {settings.fields.includes("memory") && (
                    <td>{pct(percent(s?.memory, n.memory))}</td>
                  )}
                  {settings.fields.includes("disk") && (
                    <td
                      style={{
                        color:
                          (percent(s?.disk, n.disk) ?? 0) > 80
                            ? "#b98940"
                            : undefined,
                      }}
                    >
                      {pct(percent(s?.disk, n.disk))}
                    </td>
                  )}
                  {settings.fields.includes("rates") && (
                    <td>
                      ↓ {bytes(s?.downRate)}/s　↑ {bytes(s?.upRate)}/s
                    </td>
                  )}
                  {settings.fields.includes("ping") && (
                    <td className={V.networkCell}>
                      <PingSummaryBars nodeId={n.id} />
                    </td>
                  )}
                  {settings.fields.includes("expiry") && (
                    <td>{t(expiryText(n))}</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
