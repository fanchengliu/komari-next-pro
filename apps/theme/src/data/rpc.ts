export class ApiError extends Error {
  constructor(
    message: string,
    public code: number,
  ) {
    super(message);
  }
}
export async function json<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: { Accept: "application/json", ...init.headers },
  });
  if (!response.ok)
    throw new ApiError(
      response.status === 401 ? "请先登录" : `请求失败 (${response.status})`,
      response.status,
    );
  if (!(response.headers.get("content-type") ?? "").includes("json"))
    throw new ApiError("服务器返回了非 JSON 内容，请检查代理或缓存", 502);
  return response.json() as Promise<T>;
}
export async function rest<T>(path: string, signal?: AbortSignal): Promise<T> {
  const result = await json<T | { data: T; status: string; message?: string }>(
    path,
    { signal },
  );
  if (result && typeof result === "object" && "status" in result) {
    if (result.status !== "success")
      throw new ApiError(
        (result as { message?: string }).message ?? "请求失败",
        400,
      );
    return (result as { data: T }).data;
  }
  return result as T;
}
type Pending = {
  resolve: (v: any) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  remove: () => void;
};
/** One owned socket per tab. Komari responds to requests; polling is owned by Query, never the transport. */
export class RpcClient {
  private socket?: WebSocket;
  private opening?: Promise<WebSocket>;
  private seq = 0;
  private generation = 0;
  private pending = new Map<number, Pending>();
  private retryAfter = 0;
  constructor(private path = "/api/rpc2") {}
  private connect(): Promise<WebSocket> {
    if (this.socket?.readyState === WebSocket.OPEN)
      return Promise.resolve(this.socket);
    if (this.opening) return this.opening;
    const generation = this.generation;
    let opening: Promise<WebSocket>;
    opening = new Promise<WebSocket>((resolve, reject) => {
      const url = new URL(this.path, location.href);
      url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(url);
      this.socket = ws;
      const timer = setTimeout(() => {
        ws.close();
        reject(new Error("连接超时"));
      }, 2500);
      ws.onopen = () => {
        clearTimeout(timer);
        if (generation !== this.generation) {
          ws.close();
          reject(new DOMException("身份已变化", "AbortError"));
          return;
        }
        resolve(ws);
      };
      ws.onerror = () => {
        clearTimeout(timer);
        reject(new Error("实时连接不可用"));
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const p = this.pending.get(data.id);
          if (!p) return;
          clearTimeout(p.timer);
          p.remove();
          this.pending.delete(data.id);
          data.error
            ? p.reject(new ApiError(data.error.message, data.error.code))
            : p.resolve(data.result);
        } catch {
          /* Ignore unrelated or malformed messages; bounded request timeout remains active. */
        }
      };
      ws.onclose = () => {
        clearTimeout(timer);
        if (this.socket !== ws) {
          reject(new Error("旧连接已关闭"));
          return;
        }
        this.socket = undefined;
        for (const [id, p] of this.pending) {
          clearTimeout(p.timer);
          p.remove();
          p.reject(new Error("连接断开"));
          this.pending.delete(id);
        }
        reject(new Error("连接关闭"));
      };
    }).finally(() => {
      if (this.opening === opening) this.opening = undefined;
    });
    this.opening = opening;
    return opening;
  }
  async call<T>(
    method: string,
    params: unknown = {},
    signal?: AbortSignal,
  ): Promise<T> {
    const generation = this.generation;
    const id = ++this.seq;
    const body = { jsonrpc: "2.0", id, method, params };
    signal?.throwIfAborted();
    if (Date.now() >= this.retryAfter) {
      try {
        const ws = await this.connect();
        signal?.throwIfAborted();
        if (generation !== this.generation)
          throw new DOMException("身份已变化", "AbortError");
        return await new Promise<T>((resolve, reject) => {
          const abort = () => {
            const p = this.pending.get(id);
            if (p) {
              clearTimeout(p.timer);
              p.remove();
              this.pending.delete(id);
            }
            reject(new DOMException("已取消", "AbortError"));
          };
          const timer = setTimeout(() => {
            this.pending.get(id)?.remove();
            this.pending.delete(id);
            reject(new Error("请求超时"));
          }, 8000);
          this.pending.set(id, {
            resolve,
            reject,
            timer,
            remove: () => signal?.removeEventListener("abort", abort),
          });
          signal?.addEventListener("abort", abort, { once: true });
          ws.send(JSON.stringify(body));
        });
      } catch (e) {
        if (
          e instanceof ApiError ||
          signal?.aborted ||
          generation !== this.generation
        )
          throw e;
        this.retryAfter = Date.now() + 30000;
        this.socket?.close();
      }
    }
    const data = await json<{
      result: T;
      error?: { message: string; code: number };
    }>(this.path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    if (generation !== this.generation)
      throw new DOMException("身份已变化", "AbortError");
    if (data.error) throw new ApiError(data.error.message, data.error.code);
    return data.result;
  }
  reset() {
    this.generation++;
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.remove();
      p.reject(new DOMException("身份已变化", "AbortError"));
    }
    this.pending.clear();
    this.socket?.close();
    this.socket = undefined;
    this.opening = undefined;
    this.retryAfter = 0;
  }
}
export const rpc = new RpcClient();
