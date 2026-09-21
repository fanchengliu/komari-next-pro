import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  demoNodes,
  demoStatus,
  demoMetrics,
  demoTasks,
  demoPingStats,
} from "../tests/fixtures/komari";
import { buildExtension } from "../apps/extension/src/server";
import { defaultSettings } from "../packages/contracts";
const count = Number(process.env.DS_DEMO_NODES ?? 10);
let settings = {
  ...defaultSettings,
  setupCompleted: true,
  logo: "/media/logo.png",
  background: "/media/background.mp4",
  ...(process.env.DS_DEMO_SETTINGS
    ? JSON.parse(await readFile(process.env.DS_DEMO_SETTINGS, "utf8"))
    : {}),
};
let connections = 0,
  maxConnections = 0,
  calls: Record<string, number> = {};
const logged = (cookie = "") => cookie.includes("ds_demo=authenticated");
function nodes(admin: boolean) {
  return Object.fromEntries(
    demoNodes(count).map((n) => [
      n.uuid,
      admin ? n : { ...n, ipv4: undefined, ipv6: undefined },
    ]),
  );
}
function rpc(body: any, admin: boolean) {
  calls[body.method] = (calls[body.method] ?? 0) + 1;
  const methods: Record<string, () => unknown> = {
    "common:getNodes": () => nodes(admin),
    "common:getNodesLatestStatus": () => demoStatus(count),
    "public:queryMetrics": () => demoMetrics(body.params, count),
    "public:getPublicPingTasks": () => demoTasks(count),
    "public:getPingMetricStats": () => demoPingStats(body.params, count),
    "public:listMetricDefinitions": () =>
      [
        "cpu.usage",
        "memory.used",
        "swap.used",
        "net.in.rate",
        "net.out.rate",
        "traffic.up",
        "traffic.down",
        "net.total.up",
        "net.total.down",
        "ping.latency_ms",
        "ping.loss",
      ].map((name) => ({ name })),
  };
  return {
    jsonrpc: "2.0",
    id: body.id,
    ...(methods[body.method]
      ? { result: methods[body.method]() }
      : { error: { code: -32601, message: "Method not found" } }),
  };
}
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url ?? "/", "http://localhost");
    const admin = logged(req.headers.cookie);
    let body = "";
    for await (const chunk of req) body += chunk;
    const send = (data: unknown, status = 200) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(data));
    };
    if (path.pathname === "/sw.js") {
      res.writeHead(200, {
        "Content-Type": "text/javascript",
        "Service-Worker-Allowed": "/",
        "Cache-Control": "no-store",
      });
      return res.end(
        "self.addEventListener('install',e=>e.waitUntil(caches.open('ds-legacy-test').then(c=>c.add('/')).then(()=>self.skipWaiting())));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>{if(e.request.mode==='navigate'&&new URL(e.request.url).pathname.startsWith('/admin'))e.respondWith(caches.match('/'))})",
      );
    }
    if (path.pathname === "/api/me")
      return send({
        logged_in: admin,
        username: admin ? "Demo Admin" : "Guest",
      });
    if (path.pathname === "/api/public")
      return send({
        status: "success",
        data: {
          sitename: "Next Pro Lab",
          theme: "komari-ds",
          theme_settings: settings,
          description: "隔离演示数据",
        },
      });
    if (path.pathname === "/api/rpc2")
      return send(rpc(JSON.parse(body), admin));
    if (path.pathname === "/api/nodes")
      return send({ status: "success", data: Object.values(nodes(admin)) });
    if (path.pathname === "/api/login") {
      const data = JSON.parse(body);
      if (data.username === "demo" && data.password === "demo") {
        res.setHeader(
          "Set-Cookie",
          "ds_demo=authenticated; HttpOnly; SameSite=Lax; Path=/",
        );
        return send({ status: "success", data: {} });
      }
      return send({ status: "error", message: "演示账号或密码错误" }, 401);
    }
    if (path.pathname === "/api/logout") {
      res.writeHead(302, {
        Location: "/",
        "Set-Cookie": "ds_demo=; Max-Age=0; HttpOnly; SameSite=Lax; Path=/",
      });
      return res.end();
    }
    if (path.pathname === "/api/admin/theme/settings") {
      if (!admin) return send({}, 401);
      settings = { ...settings, ...JSON.parse(body) };
      return send({ status: "success" });
    }
    if (path.pathname === "/__test/stats")
      return send({ connections, maxConnections, calls });
    if (
      path.pathname === "/admin" ||
      path.pathname.startsWith("/admin/") ||
      path.pathname === "/terminal"
    ) {
      res.writeHead(200, { "Content-Type": "text/html" });
      return res.end(
        '<!doctype html><html><title>Isolated native route fixture</title><body><h1>Komari native route fixture</h1><a href="/">Home</a></body></html>',
      );
    }
    return send({ error: "Not found" }, 404);
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end('{"error":"Bad request"}');
  }
});
const wss = new WebSocketServer({ server, path: "/api/rpc2" });
wss.on("connection", (ws, req) => {
  connections++;
  maxConnections = Math.max(connections, maxConnections);
  ws.on("close", () => connections--);
  ws.on("message", (data) => {
    try {
      ws.send(
        JSON.stringify(
          rpc(JSON.parse(data.toString()), logged(req.headers.cookie)),
        ),
      );
    } catch {
      ws.close();
    }
  });
});
await new Promise<void>((r) => server.listen(5174, "127.0.0.1", r));
const demoDirectory =
  process.env.DS_DEMO_DATA_DIR ?? ".local/demo-extension-" + process.pid;
await mkdir(demoDirectory, { recursive: true });
const extension = await buildExtension({
  directory: resolve(demoDirectory),
  publicOrigin: "http://127.0.0.1:5173",
  enableJobs: true,
  rateRequest: async () =>
    new Response(
      JSON.stringify([
        {
          date: new Date().toISOString().slice(0, 10),
          base: "CNY",
          quote: "USD",
          rate: 1 / 7.2,
        },
        {
          date: new Date().toISOString().slice(0, 10),
          base: "CNY",
          quote: "EUR",
          rate: 1 / 7.8,
        },
      ]),
      { headers: { "Content-Type": "application/json" } },
    ),
  downloadMedia: async (url) => {
    if (url !== "https://media.test/background.png")
      throw Error("Fixture only");
    return Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a01kAAAAASUVORK5CYII=",
      "base64",
    );
  },
  backend: {
    viewer: async (cookie) => ({
      logged_in: logged(cookie),
      username: logged(cookie) ? "Demo Admin" : "Guest",
    }),
    nodes: async (cookie) => nodes(logged(cookie)),
    run: async (node, kind) => {
      await new Promise((r) => setTimeout(r, 100));
      return kind === "services"
        ? `隔离测试快照 ${node}\nnginx.service running\n127.0.0.1:80 LISTEN`
        : kind === "ip"
          ? {
              ip: "192.0.2.10",
              org: "AS64500 Documentation Network",
              country: "US",
              city: "Example",
            }
          : {
              notice: "合成协议测试数据",
              services: [
                {
                  name: "Netflix",
                  family: "IPv4",
                  httpStatus: 200,
                  status: "可达，解锁待确认",
                },
              ],
            };
    },
  },
});
await extension.listen({ port: 5175, host: "127.0.0.1" });
console.log(`Synthetic demo ready: ${count} nodes; login demo / demo`);
for (const event of ["SIGINT", "SIGTERM"] as const)
  process.on(event, () => {
    wss.close();
    server.close();
    void extension.close().then(() => process.exit(0));
  });
