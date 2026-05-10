"use client";

import { useMemo } from "react";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useNodeList } from "@/contexts/NodeListContext";
import { useTranslation } from "react-i18next";

type ExpiryNode = {
  uuid: string;
  name: string;
  expiredAt: string;
  daysLeft: number;
};

function getUrgencyColor(days: number): string {
  if (days < 0) return "bg-destructive/15 text-destructive border-destructive/30";
  if (days <= 7) return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30";
  if (days <= 30) return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30";
  return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
}

function getUrgencyDot(days: number): string {
  if (days < 0) return "bg-destructive";
  if (days <= 7) return "bg-red-500";
  if (days <= 30) return "bg-amber-500";
  return "bg-emerald-500";
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const ExpiryTimeline = () => {
  const { t } = useTranslation();
  const { nodeList } = useNodeList();

  const expiryNodes = useMemo<ExpiryNode[]>(() => {
    if (!nodeList) return [];
    const now = Date.now();
    return nodeList
      .filter((n) => n.expired_at)
      .map((n) => {
        const exp = new Date(n.expired_at);
        const daysLeft = Math.ceil((exp.getTime() - now) / (1000 * 60 * 60 * 24));
        return {
          uuid: n.uuid,
          name: n.name,
          expiredAt: n.expired_at,
          daysLeft,
        };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [nodeList]);

  const urgentCount = expiryNodes.filter((n) => n.daysLeft <= 7 && n.daysLeft >= 0).length;
  const expiredCount = expiryNodes.filter((n) => n.daysLeft < 0).length;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 h-9 w-9 shrink-0 relative"
          aria-label={t("expiryTimeline.title", { defaultValue: "到期时间线" })}
        >
          <CalendarClock className="h-4 w-4" />
          {(urgentCount > 0 || expiredCount > 0) && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-background" />
          )}
          <span className="sr-only">{t("expiryTimeline.title", { defaultValue: "到期时间线" })}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[70vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            {t("expiryTimeline.title", { defaultValue: "到期时间线" })}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-1 -mr-1">
          {expiryNodes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t("expiryTimeline.empty", { defaultValue: "暂无到期信息" })}
            </p>
          ) : (
            <div className="space-y-2">
              {/* Summary bar */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground pb-2 border-b">
                <span>{t("expiryTimeline.total", { defaultValue: "共" })} {expiryNodes.length} {t("expiryTimeline.nodes", { defaultValue: "台" })}</span>
                {expiredCount > 0 && (
                  <span className="text-destructive font-medium">
                    {expiredCount} {t("expiryTimeline.expired", { defaultValue: "已过期" })}
                  </span>
                )}
                {urgentCount > 0 && (
                  <span className="text-red-500 font-medium">
                    {urgentCount} {t("expiryTimeline.urgent", { defaultValue: "即将到期" })}
                  </span>
                )}
              </div>

              {/* Timeline items */}
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

                <div className="space-y-1.5">
                  {expiryNodes.map((node) => (
                    <div
                      key={node.uuid}
                      className={`relative flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors ${getUrgencyColor(node.daysLeft)}`}
                    >
                      {/* Dot */}
                      <div className={`relative z-10 h-2.5 w-2.5 rounded-full shrink-0 ring-2 ring-background ${getUrgencyDot(node.daysLeft)}`} />

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{node.name}</div>
                        <div className="text-xs opacity-75">{formatDate(node.expiredAt)}</div>
                      </div>

                      {/* Days badge */}
                      <div className="shrink-0 text-xs font-semibold tabular-nums">
                        {node.daysLeft < 0
                          ? t("expiryTimeline.expiredDays", { days: Math.abs(node.daysLeft), defaultValue: `过期 ${Math.abs(node.daysLeft)} 天` })
                          : node.daysLeft === 0
                            ? t("expiryTimeline.today", { defaultValue: "今天到期" })
                            : t("expiryTimeline.daysLeft", { days: node.daysLeft, defaultValue: `${node.daysLeft} 天` })
                        }
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExpiryTimeline;
