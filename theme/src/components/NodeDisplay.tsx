import React, { useState, useMemo, useRef, useEffect, Suspense } from "react";
import { Search, Grid3X3, Table2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import type { NodeBasicInfo } from "@/contexts/NodeListContext";
import type { LiveData } from "../types/LiveData";
import { NodeGrid } from "./Node";
const NodeTable = React.lazy(() => import("./NodeTable"));
import { isRegionMatch } from "@/utils/regionHelper";
import "./NodeDisplay.css";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type ViewMode = "grid" | "table";


const getGroupLabel = (group: string, t: (key: string, opts?: any) => string) => {
  const map: Record<string, string> = {
    all: t('groups.all', { defaultValue: '全部' }),
    '主力': t('groups.primary', { defaultValue: '主力' }),
    '大善人': t('groups.sponsor', { defaultValue: '大善人' }),
    '玩具': t('groups.toy', { defaultValue: '玩具' }),
    '落地机': t('groups.edge', { defaultValue: '落地机' }),
  };
  return map[group] || group;
};


interface NodeDisplayProps {
  nodes: NodeBasicInfo[];
  liveData: LiveData;
}

const NodeDisplay: React.FC<NodeDisplayProps> = ({ nodes, liveData }) => {
  const [t] = useTranslation();
  const [viewMode, setViewMode] = useLocalStorage<ViewMode>(
    "nodeViewMode",
    "grid"
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGroup, setSelectedGroup] = useLocalStorage<string>(
    "nodeSelectedGroup",
    "all"
  );
  const searchRef = useRef<HTMLInputElement>(null);

  // 获取所有的分组
  const groups = useMemo(() => {
    const groupSet = new Set<string>();
    nodes.forEach((node) => {
      if (node.group && node.group.trim()) {
        groupSet.add(node.group);
      }
    });
    return Array.from(groupSet).sort();
  }, [nodes]);

  // 判断是否显示分组选择器
  const showGroupSelector = groups.length >= 1;

  // 键盘快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 按 "/" 键聚焦搜索框
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      // 按 Escape 键清空搜索
      if (e.key === "Escape" && searchTerm) {
        setSearchTerm("");
        searchRef.current?.blur();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [searchTerm]);

  // 过滤节点
  const filteredNodes = useMemo(() => {
    let result = nodes;

    // 先按分组过滤
    if (selectedGroup !== "all") {
      result = result.filter((node) => node.group === selectedGroup);
    }

    // 再按搜索条件过滤
    if (!searchTerm.trim()) return result;

    const term = searchTerm.toLowerCase().trim();
    return result.filter((node) => {
      // 基本信息搜索
      const basicMatch =
        node.name.toLowerCase().includes(term) ||
        node.os.toLowerCase().includes(term) ||
        node.arch.toLowerCase().includes(term);

      // 地区搜索（支持emoji和地区名称）
      const regionMatch = isRegionMatch(node.region, term);

      // 价格搜索（如果输入数字）
      const priceMatch =
        !isNaN(Number(term)) && node.price.toString().includes(term);

      // 状态搜索
      const isOnline = liveData?.online?.includes(node.uuid) || false;
      const statusMatch =
        ((term === "online" || term === "在线") && isOnline) ||
        ((term === "offline" || term === "离线") && !isOnline);

      return basicMatch || regionMatch || priceMatch || statusMatch;
    });
  }, [nodes, searchTerm, liveData, selectedGroup]);

  return (
    <div className="w-full space-y-6">
      <div className="ds-home-toolbar ds-home-toolbar-quad">
        <div className="ds-home-toolbar-cell ds-home-toolbar-cell-search">
          <div className="ds-home-toolbar-search group">
            <Search className="ds-home-toolbar-search-icon" />
            <Input
              ref={searchRef}
              placeholder={t("search.placeholder", {
                defaultValue: "按节点名称、地区、系统搜索…",
              })}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="ds-home-toolbar-input"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="icon"
                className="ds-home-toolbar-clear"
                onClick={() => {
                  setSearchTerm("");
                  searchRef.current?.focus();
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="ds-home-toolbar-cell ds-home-toolbar-cell-stat">
          <div className="ds-home-toolbar-stat">
            <div className="ds-home-toolbar-stat-dot" />
            {searchTerm.trim() ? (
              <span>
                {t("search.results", {
                  count: filteredNodes.length,
                  total:
                    selectedGroup === "all"
                      ? nodes.length
                      : nodes.filter((n) => n.group === selectedGroup).length,
                  defaultValue: `Found ${filteredNodes.length} nodes`,
                })}
              </span>
            ) : (
              <span>
                {selectedGroup === "all"
                  ? t("nodeCard.totalNodes", {
                      total: nodes.length,
                      online: liveData?.online?.length || 0,
                      defaultValue: `${liveData?.online?.length || 0} Online / ${nodes.length} Total`,
                    })
                  : t("nodeCard.groupNodes", {
                      group: getGroupLabel(selectedGroup, t),
                      total: filteredNodes.length,
                      online: filteredNodes.filter((n) => liveData?.online?.includes(n.uuid)).length,
                      defaultValue: `${filteredNodes.filter((n) => liveData?.online?.includes(n.uuid)).length} Online in ${selectedGroup}`,
                    })}
              </span>
            )}
          </div>
        </div>

        <div className="ds-home-toolbar-cell ds-home-toolbar-cell-group">
          {showGroupSelector ? (
            <div className="ds-home-toolbar-group-shell">
              <div className="ds-home-toolbar-label">{t("common.group", { defaultValue: "分组" })}</div>
              <div className="ds-home-toolbar-tabs-wrap">
                <Tabs value={selectedGroup} onValueChange={setSelectedGroup} className="w-auto">
                  <TabsList className="ds-home-toolbar-tabslist">
                    <TabsTrigger value="all" className="ds-home-toolbar-tabtrigger">
                      {getGroupLabel("all", t)}
                    </TabsTrigger>
                    {groups.map((group) => (
                      <TabsTrigger key={getGroupLabel(group, t)} value={getGroupLabel(group, t)} className="ds-home-toolbar-tabtrigger">
                        {getGroupLabel(group, t)}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
            </div>
          ) : null}
        </div>

        <div className="ds-home-toolbar-cell ds-home-toolbar-cell-view">
          <div className="ds-home-toolbar-viewswitch-row">
            <Button
              variant="ghost"
              size="sm"
              className={cn("ds-home-toolbar-viewbtn", viewMode === "grid" && "is-active")}
              onClick={() => setViewMode("grid")}
            >
              <Grid3X3 className="h-4 w-4" />
              <span>{t("common.grid", { defaultValue: "网格" })}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn("ds-home-toolbar-viewbtn", viewMode === "table" && "is-active")}
              onClick={() => setViewMode("table")}
            >
              <Table2 className="h-4 w-4" />
              <span>{t("common.table", { defaultValue: "表格" })}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Node Display Area */}
      {filteredNodes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-muted/20 rounded-lg border border-dashed">
          <span className="text-lg text-muted-foreground mb-2">
            {searchTerm.trim()
              ? t("search.no_results", { defaultValue: "No matching nodes found" })
              : t("nodes.empty", { defaultValue: "No node data" })}
          </span>
          {searchTerm.trim() && (
            <span className="text-sm text-muted-foreground">
              {t("search.try_different", {
                defaultValue: "Try different keywords",
              })}
            </span>
          )}
        </div>
      ) : (
        <>
          {viewMode === "grid" ? (
            <NodeGrid nodes={filteredNodes} liveData={liveData} />
          ) : (
            <Suspense
              fallback={<div className="p-4 text-center">{t("common.loading_table", { defaultValue: "正在加载表格..." })}</div>}
            >
              <NodeTable nodes={filteredNodes} liveData={liveData} />
            </Suspense>
          )}
        </>
      )}
    </div>
  );
};

export default NodeDisplay;
