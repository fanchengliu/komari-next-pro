"use client";

import React from "react";
import { useRPC2Call } from "./RPC2Context";
import { stringToBytes } from "@/utils/unitHelper";

export type NodeBasicInfo = {
  /** 节点唯一标识符 */
  uuid: string;
  /** 节点名称 */
  name: string;
  /** CPU型号 */
  cpu_name: string;
  /** 虚拟化 */
  virtualization: string;
  /** 系统架构 */
  arch: string;
  /** CPU核心数 */
  cpu_cores: number;
  /** 操作系统 */
  os: string;
  /** 内核版本 */
  kernel_version: string;
  /** GPU型号 */
  gpu_name: string;
  /** 地区标识 */
  region: string;
  /** 总内存(字节) */
  mem_total: number;
  /** 总交换空间(字节) */
  swap_total: number;
  /** 总磁盘空间(字节) */
  disk_total: number;
  /** 版本号 */
  version: string;
  /** 权重 */
  weight: number;
  /** 价格 */
  price: number;
  tags: string;
  /** 账单周期（天）*/
  billing_cycle: number;
  /** 货币 */
  currency: string;
  /** 分组 */
  group: string;
  /** 流量阈值 */
  traffic_limit: number;
  /** 流量阈值类型 */
  traffic_limit_type: undefined | "sum" | "max" | "min" | "up" | "down";
  /** 过期时间 */
  expired_at: string;
  /** 创建时间 */
  created_at: string;
  /** 更新时间 */
  updated_at: string;
  ipv4?: string; 
  ipv6?: string;
};

interface NodeListContextType {
  nodeList: NodeBasicInfo[] | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

const NodeListContext = React.createContext<NodeListContextType | undefined>(
  undefined
);

function normalizeTrafficLimit(value: unknown): number {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return 0;

    // Strings with units or expressions should always be parsed as byte sizes.
    if (/[a-zA-Z\s,*]/.test(trimmed)) {
      return stringToBytes(trimmed);
    }

    const numeric = Number(trimmed);
    if (!Number.isFinite(numeric) || numeric <= 0) return 0;

    // Backward compatibility: some payloads appear to send plain GB counts.
    if (numeric < 1024 ** 2) {
      return numeric * 1024 ** 3;
    }

    return numeric;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return 0;

    // Backward compatibility: treat tiny raw numbers as legacy GiB limits.
    if (value < 1024 ** 2) {
      return value * 1024 ** 3;
    }

    return value;
  }

  return 0;
}

export const NodeListProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [nodeList, setNodeList] = React.useState<NodeBasicInfo[] | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const { call } = useRPC2Call();

  const refresh = () => {
    // setIsLoading(true);
    setError(null);
    // 通过 RPC2 获取节点基本信息
    call<{ uuid?: string }, Record<string, any>>("common:getNodes")
      .then((result) => {
        if (!result || typeof result !== "object") {
          setNodeList([]);
          return;
        }
        // 将 { [uuid]: Client } 转换为 NodeBasicInfo[]
        const list: NodeBasicInfo[] = Object.values(result).map((n: any) => ({
          uuid: n.uuid,
          name: n.name,
          cpu_name: n.cpu_name,
          virtualization: n.virtualization,
          arch: n.arch,
          cpu_cores: n.cpu_cores,
          os: n.os,
          kernel_version: n.kernel_version,
          gpu_name: n.gpu_name,
          region: n.region,
          mem_total: n.mem_total,
          swap_total: n.swap_total,
          disk_total: n.disk_total,
          // 兼容旧字段，若无版本信息则给空串
          version: n.version ?? "",
          weight: n.weight ?? 0,
          price: n.price ?? 0,
          tags: n.tags ?? "",
          billing_cycle: n.billing_cycle ?? 0,
          currency: n.currency ?? "",
          group: n.group ?? "",
          traffic_limit: normalizeTrafficLimit(n.traffic_limit),
          traffic_limit_type: n.traffic_limit_type,
          expired_at: n.expired_at ?? "",
          created_at: n.created_at ?? "",
          updated_at: n.updated_at ?? "",
          ipv4: n.ipv4,
          ipv6: n.ipv6,
        }));
        setNodeList(list);
      })
      .catch((err: any) => {
        setError(err?.message || "An error occurred while fetching data");
        setNodeList([]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  React.useEffect(() => {
    refresh();
  }, []);
  return (
    <NodeListContext.Provider value={{ nodeList, isLoading, error, refresh }}>
      {children}
    </NodeListContext.Provider>
  );
};

export const useNodeList = () => {
  const context = React.useContext(NodeListContext);
  if (!context) {
    throw new Error("useNodeList must be used within a NodeListProvider");
  }
  return context;
};
