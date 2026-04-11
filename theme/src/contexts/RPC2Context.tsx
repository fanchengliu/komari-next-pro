"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { RPC2Client } from "../lib/rpc2";
import type { RPC2ConnectionStateType } from "../types/rpc2";

interface RPC2ContextType {
  client: RPC2Client;
  connectionState: RPC2ConnectionStateType;
  isConnected: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const RPC2Context = createContext<RPC2ContextType | undefined>(undefined);

// 模块级单例，避免在开发环境 StrictMode 或路由切换时产生多个连接
let __rpc2_singleton__: RPC2Client | null = null;
let __rpc2_refcount = 0;

export const RPC2Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 创建/复用客户端实例，默认启用自动连接
  const [client] = useState(() => {
    if (!__rpc2_singleton__) {
      __rpc2_singleton__ = new RPC2Client("/api/rpc2", { autoConnect: true });
    }
    return __rpc2_singleton__;
  });
  const [connectionState, setConnectionState] = useState(client.state);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    __rpc2_refcount++;
    // 设置事件监听器
    client.setEventListeners({
      onConnect: () => {
        setConnectionState(client.state);
        setError(null);
      },
      onDisconnect: () => {
        setConnectionState(client.state);
      },
      onError: (err) => {
        setError(err.message);
        setConnectionState(client.state);
      },
      onReconnecting: (attempt) => {
        setConnectionState(client.state);
        console.log(`RPC2 重连尝试 ${attempt}`);
      },
      onMessage: (data) => {
        // 可以在这里处理全局消息
        console.debug("RPC2 消息:", data);
      },
    });

    // 清理函数
    return () => {
      __rpc2_refcount = Math.max(0, __rpc2_refcount - 1);
      // 只有在最后一个 Provider 卸载时才断开连接
      if (__rpc2_refcount === 0) {
        client.disconnect();
      }
    };
  }, [client]);

  const connect = async () => {
    try {
      setError(null);
      await client.connect();
    } catch (err) {
      setError(err instanceof Error ? err.message : "连接失败");
      throw err;
    }
  };

  const disconnect = () => {
    client.disconnect();
  };

  const isConnected = connectionState === "connected";

  return (
    <RPC2Context.Provider
      value={{
        client,
        connectionState,
        isConnected,
        error,
        connect,
        disconnect
      }}
    >
      {children}
    </RPC2Context.Provider>
  );
};

export const useRPC2 = (): RPC2ContextType => {
  const context = useContext(RPC2Context);
  if (context === undefined) {
    throw new Error("useRPC2 必须在 RPC2Provider 内使用");
  }
  return context;
};

// 自定义 Hook 用于调用 RPC 方法
export const useRPC2Call = () => {
  const { client, isConnected } = useRPC2();

  // 保持稳定引用，避免消费者重复触发副作用
  const call = useCallback(<TParams = any, TResult = any>(
    method: string,
    params?: TParams,
    options?: any
  ): Promise<TResult> => client.call(method, params, options), [client]);

  const callViaWebSocket = useCallback(<TParams = any, TResult = any>(
    method: string,
    params?: TParams,
    options?: any
  ): Promise<TResult> => client.callViaWebSocket(method, params, options), [client]);

  const callViaHTTP = useCallback(<TParams = any, TResult = any>(
    method: string,
    params?: TParams,
    options?: any
  ): Promise<TResult> => client.callViaHTTP(method, params, options), [client]);

  const batchCall = useCallback((requests: Array<{ method: string; params?: any; notification?: boolean }>) =>
    client.batchCall(requests), [client]);

  return {
    call,
    callViaWebSocket,
    callViaHTTP,
    batchCall,
    isConnected,
  };
}
