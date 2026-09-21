import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { RpcClient } from "../../apps/theme/src/data/rpc";
class Socket {
  static OPEN = 1;
  static all: Socket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  messages: any[] = [];
  constructor(_url: string) {
    Socket.all.push(this);
    queueMicrotask(() => {
      this.readyState = 1;
      this.onopen?.();
    });
  }
  send(data: string) {
    this.messages.push(JSON.parse(data));
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
  reply(index: number, result: unknown) {
    this.onmessage?.({
      data: JSON.stringify({ id: this.messages[index].id, result }),
    });
  }
}
beforeEach(() => {
  Socket.all = [];
  vi.stubGlobal("WebSocket", Socket);
  vi.stubGlobal("location", { href: "http://localhost/", protocol: "http:" });
});
afterEach(() => vi.unstubAllGlobals());
describe("single-owner request-response transport", () => {
  it("multiplexes concurrent queries on one connection and matches out-of-order IDs", async () => {
    const client = new RpcClient();
    const pending = Array.from({ length: 10 }, (_, i) =>
      client.call("read", { i }),
    );
    await new Promise((r) => setTimeout(r, 1));
    expect(Socket.all).toHaveLength(1);
    const socket = Socket.all[0];
    for (let i = 9; i >= 0; i--) socket.reply(i, i);
    expect(await Promise.all(pending)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    client.reset();
  });
  it("drops requests from a previous identity and releases pending requests", async () => {
    const client = new RpcClient();
    const result = client.call("private");
    const rejected = expect(result).rejects.toMatchObject({
      name: "AbortError",
    });
    await new Promise((r) => setTimeout(r, 1));
    client.reset();
    await rejected;
    expect(Socket.all[0].readyState).toBe(3);
  });
  it("cancels a chart range without poisoning the shared connection", async () => {
    const client = new RpcClient();
    const abort = new AbortController();
    const old = client.call("old", {}, abort.signal);
    const rejected = expect(old).rejects.toMatchObject({ name: "AbortError" });
    await new Promise((r) => setTimeout(r, 1));
    abort.abort();
    await rejected;
    const next = client.call("new");
    await new Promise((r) => setTimeout(r, 1));
    Socket.all[0].reply(1, "new range");
    expect(await next).toBe("new range");
    expect(Socket.all).toHaveLength(1);
    client.reset();
  });
});
