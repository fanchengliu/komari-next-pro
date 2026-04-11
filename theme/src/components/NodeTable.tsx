import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Badge } from "@/components/ui/badge";
import { Flex } from "@/components/ui/flex";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { ChevronUp, ChevronDown, Cpu, MemoryStick, HardDrive } from "lucide-react";
import type { NodeBasicInfo } from "@/contexts/NodeListContext";
import type { LiveData, Record } from "../types/LiveData";
import { formatUptime } from "./Node";
import { formatBytes } from "@/utils/unitHelper";
import AdaptiveChart from "./AdaptiveChart";
import Flag from "./Flag";
import PriceTags from "./PriceTags";
import Tips from "./ui/tips";
import { getOSImage } from "@/utils";
import { cn } from "@/lib/utils";

interface NodeTableProps {
  nodes: NodeBasicInfo[];
  liveData: LiveData;
}

type SortField = 'name' | 'os' | 'status' | 'cpu' | 'ram' | 'disk' | 'price' | 'networkUp' | 'networkDown' | 'totalUp' | 'totalDown';
type SortOrder = 'asc' | 'desc' | 'default';

interface SortState {
  field: SortField | null;
  order: SortOrder;
}

const NodeTable: React.FC<NodeTableProps> = ({ nodes, liveData }) => {
  const [t] = useTranslation();
  const [sortState, setSortState] = useState<SortState>({ field: null, order: 'default' });

  const handleSort = (field: SortField) => {
    return (event: React.MouseEvent) => {
      event.preventDefault();
      
      setSortState((prev) => {
        if (prev.field === field) {
          const nextOrder: SortOrder = 
            prev.order === 'default' ? 'asc' : 
            prev.order === 'asc' ? 'desc' : 'default';
          return { field: nextOrder === 'default' ? null : field, order: nextOrder };
        } else {
          return { field, order: 'asc' };
        }
      });
    };
  };

  const getSortIcon = (field: SortField) => {
    if (sortState.field !== field) return <div className="hidden" />; // Placeholder to prevent layout shift
    return sortState.order === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  const onlineNodes = liveData && liveData.online ? liveData.online : [];

  const getNodeData = (uuid: string): Record => {
    const defaultLive = {
      cpu: { usage: 0 },
      ram: { used: 0 },
      disk: { used: 0 },
      network: { up: 0, down: 0, totalUp: 0, totalDown: 0 },
      uptime: 0,
    } as Record;

    return liveData && liveData.data
      ? liveData.data[uuid] || defaultLive
      : defaultLive;
  };

  const sortedNodes = [...nodes].sort((a, b) => {
    const aOnline = onlineNodes.includes(a.uuid);
    const bOnline = onlineNodes.includes(b.uuid);
    const aData = getNodeData(a.uuid);
    const bData = getNodeData(b.uuid);

    if (!sortState.field || sortState.order === 'default') {
      if (aOnline !== bOnline) {
        return aOnline ? -1 : 1;
      }
      return a.weight - b.weight;
    }

    let comparison = 0;
    switch (sortState.field) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'os':
        comparison = a.os.localeCompare(b.os);
        break;
      case 'status':
        comparison = Number(bOnline) - Number(aOnline);
        break;
      case 'cpu':
        comparison = aData.cpu.usage - bData.cpu.usage;
        break;
      case 'ram':
        const aRamPercent = a.mem_total ? (aData.ram.used / a.mem_total) * 100 : 0;
        const bRamPercent = b.mem_total ? (bData.ram.used / b.mem_total) * 100 : 0;
        comparison = aRamPercent - bRamPercent;
        break;
      case 'disk':
        const aDiskPercent = a.disk_total ? (aData.disk.used / a.disk_total) * 100 : 0;
        const bDiskPercent = b.disk_total ? (bData.disk.used / b.disk_total) * 100 : 0;
        comparison = aDiskPercent - bDiskPercent;
        break;
      case 'price':
        comparison = a.price - b.price;
        break;
      case 'networkUp':
        comparison = aData.network.up - bData.network.up;
        break;
      case 'networkDown':
        comparison = aData.network.down - bData.network.down;
        break;
      case 'totalUp':
        comparison = aData.network.totalUp - bData.network.totalUp;
        break;
      case 'totalDown':
        comparison = aData.network.totalDown - bData.network.totalDown;
        break;
      default:
        comparison = 0;
    }

    return sortState.order === 'desc' ? -comparison : comparison;
  });

  const showPriceColumn = nodes.some(node => node.price !== 0);

  return (
    <div className="node-table-shell">
      <div className="node-table-headerbar" />
      <div className="overflow-x-auto node-table-container">
        <Table className="node-table-modern min-w-[1094px] table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead
                className="w-[220px] cursor-pointer hover:bg-transparent transition-colors text-center px-2"
                onClick={handleSort('name')}
                title={t("nodeCard.sortTooltip")}
              >
                <Flex align="center" gap="1" justify="center" className="whitespace-nowrap">
                  {t("nodeCard.name")}
                  {getSortIcon('name')}
                </Flex>
              </TableHead>
              <TableHead
                className="w-[64px] cursor-pointer hover:bg-transparent transition-colors text-center px-2"
                onClick={handleSort('os')}
                title={t("nodeCard.sortTooltip")}
              >
                <Flex align="center" gap="1" justify="center" className="whitespace-nowrap">
                  {t("nodeCard.os")}
                  {getSortIcon('os')}
                </Flex>
              </TableHead>
              <TableHead
                className="w-[92px] cursor-pointer hover:bg-transparent transition-colors text-center px-2"
                onClick={handleSort('status')}
                title={t("nodeCard.sortTooltip")}
              >
                <Flex align="center" gap="1" justify="center" className="whitespace-nowrap">
                  {t("nodeCard.status")}
                  {getSortIcon('status')}
                </Flex>
              </TableHead>
              <TableHead
                className="w-[160px] cursor-pointer hover:bg-transparent transition-colors text-center px-2"
                onClick={handleSort('cpu')}
                title={t("nodeCard.sortTooltip")}
              >
                <Flex align="center" gap="1" justify="center" className="whitespace-nowrap">
                  {t("nodeCard.cpu")}
                  {getSortIcon('cpu')}
                </Flex>
              </TableHead>
              <TableHead
                className="w-[170px] cursor-pointer hover:bg-transparent transition-colors text-center px-2"
                onClick={handleSort('ram')}
                title={t("nodeCard.sortTooltip")}
              >
                <Flex align="center" gap="1" justify="center" className="whitespace-nowrap">
                  {t("nodeCard.ram")}
                  {getSortIcon('ram')}
                </Flex>
              </TableHead>
              <TableHead
                className="w-[170px] cursor-pointer hover:bg-transparent transition-colors text-center px-2"
                onClick={handleSort('disk')}
                title={t("nodeCard.sortTooltip")}
              >
                <Flex align="center" gap="1" justify="center" className="whitespace-nowrap">
                  {t("nodeCard.disk")}
                  {getSortIcon('disk')}
                </Flex>
              </TableHead>
              {showPriceColumn &&
                <TableHead
                  className="w-[100px] cursor-pointer hover:bg-muted/50 transition-colors text-center px-2"
                  onClick={handleSort('price')}
                  title={t("nodeCard.sortTooltip")}
                >
                  <Flex align="center" gap="1" justify="center" className="whitespace-nowrap">
                    {t("nodeCard.price")}
                    {getSortIcon('price')}
                  </Flex>
                </TableHead>
              }
              <TableHead
                className="w-[140px] cursor-pointer hover:bg-muted/50 transition-colors text-center px-2"
                onClick={handleSort('networkUp')}
                title={t("nodeCard.sortTooltip")}
              >
                <Flex align="center" gap="1" justify="center" className="whitespace-nowrap">
                  {t("nodeCard.networkSpeed")}
                  {getSortIcon('networkUp')}
                </Flex>
              </TableHead>
              <TableHead
                className="w-[140px] cursor-pointer hover:bg-muted/50 transition-colors text-center px-2"
                onClick={handleSort('totalUp')}
                title={t("nodeCard.sortTooltip")}
              >
                <Flex align="center" gap="1" justify="center" className="whitespace-nowrap">
                  {t("nodeCard.totalTransfer")}
                  {getSortIcon('totalUp')}
                </Flex>
              </TableHead>
            </TableRow>
          </TableHeader>
        <TableBody>
          {sortedNodes.map((node) => {
            const isOnline = onlineNodes.includes(node.uuid);
            const nodeData = getNodeData(node.uuid);
            const memoryUsagePercent = node.mem_total
              ? (nodeData.ram.used / node.mem_total) * 100
              : 0;
            const diskUsagePercent = node.disk_total
              ? (nodeData.disk.used / node.disk_total) * 100
              : 0;

            return (
              <React.Fragment key={node.uuid}>
                <TableRow className={cn("ds-node-row", !isOnline && "opacity-70")}>
                  <TableCell className="py-3 px-2">
                    <div className="ds-node-name-wrap">
                      <span className={cn("ds-node-status-dot", isOnline ? "is-online" : "is-offline")} />
                      <Flag flag={node.region} />
                      <Link
                        href={`/instance/${node.uuid}`}
                        className="hover:no-underline focus:outline-none"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="ds-node-meta">
                          <span className="ds-node-title">{node.name}</span>
                          <span className="ds-node-subline">
                            <span className="ds-node-pill">{node.ipv4 ? 'IPv4' : (node.ipv6 ? 'IPv6' : 'IP')}</span>
                            <span>{isOnline ? formatUptime(nodeData.uptime, t) : 'Offline'}</span>
                          </span>
                        </div>
                      </Link>
                    </div>
                  </TableCell>

                  <TableCell className="py-2 px-2">
                    <div className="flex items-center justify-center">
                      <img src={getOSImage(node.os)} alt={node.os} className="w-5 h-5 opacity-80" />
                    </div>
                  </TableCell>

                  <TableCell className="py-3 px-2">
                    <div className="flex items-center justify-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-normal text-xs px-2 py-0.5 border h-7 rounded-full",
                          isOnline
                            ? "border-green-500/24 text-green-600 bg-green-500/10 dark:text-green-400 dark:bg-green-500/20"
                            : "border-red-500/24 text-red-600 bg-red-500/10 dark:text-red-400 dark:bg-red-500/20"
                        )}
                      >
                         <span className={cn("w-1.5 h-1.5 rounded-full mr-1.5", isOnline ? "bg-green-500 animate-pulse" : "bg-red-500")} />
                        {isOnline ? t("nodeCard.online") : t("nodeCard.offline")}
                      </Badge>
                      {nodeData.message && <Tips color="#ef4444">{nodeData.message}</Tips>}
                    </div>
                  </TableCell>

                  <TableCell className="py-3 px-2">
                    <div className="ds-node-metric-card">
                      <div className="ds-node-metric-top"><span className="ds-node-metric-label"><Cpu size={12} /> CPU</span><strong>{nodeData.cpu.usage.toFixed(0)}%</strong></div>
                      <div className="ds-node-metric-bar"><div className="ds-node-metric-fill cpu" style={{ width: `${Math.max(0, Math.min(100, nodeData.cpu.usage))}%` }} /></div>
                      <div className="ds-node-metric-sub">CPU</div>
                    </div>
                  </TableCell>

                  <TableCell className="py-3 px-2">
                    <div className="ds-node-metric-card">
                      <div className="ds-node-metric-top"><span className="ds-node-metric-label"><MemoryStick size={12} /> 内存</span><strong>{memoryUsagePercent.toFixed(0)}%</strong></div>
                      <div className="ds-node-metric-bar"><div className="ds-node-metric-fill ram" style={{ width: `${Math.max(0, Math.min(100, memoryUsagePercent))}%` }} /></div>
                      <div className="ds-node-metric-sub">{formatBytes(nodeData.ram.used)} / {formatBytes(node.mem_total)}</div>
                    </div>
                  </TableCell>

                  <TableCell className="py-3 px-2">
                    <div className="ds-node-metric-card">
                      <div className="ds-node-metric-top"><span className="ds-node-metric-label"><HardDrive size={12} /> 硬盘</span><strong>{diskUsagePercent.toFixed(0)}%</strong></div>
                      <div className="ds-node-metric-bar"><div className="ds-node-metric-fill disk" style={{ width: `${Math.max(0, Math.min(100, diskUsagePercent))}%` }} /></div>
                      <div className="ds-node-metric-sub">{formatBytes(nodeData.disk.used)} / {formatBytes(node.disk_total)}</div>
                    </div>
                  </TableCell>
                  {showPriceColumn &&
                    <TableCell className="py-2 px-2">
                      <div className="flex items-center justify-center">
                        <PriceTags
                          price={node.price}
                          billing_cycle={node.billing_cycle}
                          expired_at={node.expired_at}
                          currency={node.currency}
                          gap="1"
                          tags={node.tags || ""}
                        />
                      </div>
                    </TableCell>
                  }
                  <TableCell className="py-3 px-2 text-center">
                    <div className="ds-node-traffic">
                      <span className="up">↑ {formatBytes(nodeData.network.up)}/s</span>
                      <span className="down">↓ {formatBytes(nodeData.network.down)}/s</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 px-2 text-center">
                    <div className="ds-node-transfer">
                      <span>↑ {formatBytes(nodeData.network.totalUp)}</span>
                      <span>↓ {formatBytes(nodeData.network.totalDown)}</span>
                    </div>
                  </TableCell>
                </TableRow>
              </React.Fragment>
            );
          })}
        </TableBody>
        </Table>
      </div>
    </div>
  );
};


export default NodeTable;
