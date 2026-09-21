import type { JobKind, Viewer } from "../../../packages/contracts";
import { enrichQuality } from "./ip-quality";
import { isIP } from "node:net";
import type { IPDiagnostic } from "../../../packages/contracts/ip-result";
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}
export interface Backend {
  viewer: (cookie: string) => Promise<Viewer>;
  nodes: (
    cookie: string,
  ) => Promise<
    Record<
      string,
      { uuid: string; name?: string; os?: string; ipv4?: string; ipv6?: string }
    >
  >;
  run: (node: string, kind: JobKind, cookie: string) => Promise<unknown>;
}
type Envelope = {
  status?: string;
  message?: string;
  data?: any;
  result?: any;
  error?: { message: string };
};
const serviceCommand = `printf '=== SYSTEM ===\n'; uname -a; uptime; printf '\n=== SERVICES ===\n'; systemctl list-units --type=service --state=running --no-pager --plain 2>/dev/null | head -80; printf '\n=== LISTENING ===\n'; ss -lntup 2>/dev/null | head -100; printf '\n=== CONTAINERS ===\n'; if command -v docker >/dev/null 2>&1; then docker ps --format '{{.Names}} | {{.Image}} | {{.Status}} | {{.Ports}}' 2>/dev/null | head -60; fi`;
// Fixed providers, fixed command bodies. Request bodies can choose a job kind and node only.
const ipCommand =
  `if ! command -v curl >/dev/null 2>&1; then echo 'curl unavailable'; exit 1; fi;\n` +
  ([4, 6] as const)
    .map(
      (family) =>
        `printf '=== IPV${family} ===\\n'; curl -${family} --silent --show-error --max-time 12 --connect-timeout 5 --max-filesize 262144 --write-out '\\nDS_HTTP:%{http_code}\\n' https://${family === 6 ? "v6.ipinfo.io" : "ipinfo.io"}/json 2>&1; ds_probe_exit=$?; printf '\\nDS_EXIT:%s\\n' "$ds_probe_exit";`,
    )
    .join("\n");
const probeHosts = [
  ["Netflix", "https://www.netflix.com/title/80018499"],
  ["Disney+", "https://www.disneyplus.com/"],
  ["YouTube Premium", "https://www.youtube.com/premium"],
  ["Spotify", "https://open.spotify.com/"],
  ["TikTok", "https://www.tiktok.com/"],
  ["ChatGPT", "https://chatgpt.com/"],
  ["Claude", "https://claude.ai/"],
  ["Gemini", "https://gemini.google.com/"],
] as const;
const unlockCommand =
  `if ! command -v curl >/dev/null 2>&1; then echo 'curl unavailable'; exit 1; fi\n` +
  probeHosts
    .flatMap(([name, url]) =>
      [4, 6].map(
        (v) =>
          `printf '${name}|IPv${v}|'; curl -${v} --silent --output /dev/null --max-time 6 --connect-timeout 3 --max-filesize 524288 --write-out '%{http_code}\\n' '${url}';`,
      ),
    )
    .join("\n");
export const fixedCommands: Record<JobKind, string> = {
  services: serviceCommand,
  ip: ipCommand,
  unlock: unlockCommand,
};
export function parseIP(output: string) {
  const parse = (part: string) => {
    try {
      const start = part.indexOf("{"),
        end = part.lastIndexOf("}");
      return start >= 0 && end > start
        ? JSON.parse(part.slice(start, end + 1))
        : null;
    } catch {
      return null;
    }
  };
  const [v4, v6 = ""] = output.split("=== IPV6 ===");
  const decode = (part: string, family: 4 | 6) => {
    const data = parse(part);
    const exit = /(?:^|\n)DS_EXIT:(\d+)/.exec(part),
      http = /(?:^|\n)DS_HTTP:(\d+)/.exec(part);
    const exitCode = exit ? Number(exit[1]) : undefined,
      httpStatus = http ? Number(http[1]) : undefined;
    const valid =
      data && typeof data.ip === "string" && isIP(data.ip) === family;
    const success =
      valid &&
      !exitCode &&
      (httpStatus === undefined || (httpStatus >= 200 && httpStatus < 300));
    const code = exitCode ?? Number(/curl:\s*\((\d+)\)/.exec(part)?.[1] ?? 0);
    const reason =
      code === 6
        ? "dns"
        : code === 28
          ? "timeout"
          : code === 7
            ? "connect"
            : [35, 60].includes(code)
              ? "tls"
              : httpStatus && httpStatus >= 400
                ? "http"
                : "invalid";
    const diagnostic: IPDiagnostic = {
      state: success
        ? "success"
        : httpStatus === 429
          ? "rate_limited"
          : "failed",
      ...(success ? {} : { reason }),
      ...(exitCode === undefined ? {} : { exitCode }),
      ...(httpStatus === undefined ? {} : { httpStatus }),
    };
    return { data: success ? data : null, diagnostic };
  };
  const a = decode(v4, 4),
    b = decode(v6, 6);
  return {
    ipv4: a.data,
    ipv6: b.data,
    diagnostics: { ipv4: a.diagnostic, ipv6: b.diagnostic },
    provider: "ipinfo.io",
    quality: null,
  };
}
export function parseProbe(output: string) {
  return {
    method: "HTTP availability probe",
    notice: "HTTP 可达性不能证明账号或地区解锁；挑战页及鉴权响应保留为不确定。",
    services: output
      .split(/\r?\n/)
      .filter((x) => x.split("|").length === 3)
      .map((line) => {
        const [name, family, status] = line.split("|");
        const code = Number(status);
        return {
          name,
          family,
          httpStatus: code,
          status:
            code === 0
              ? "连接失败"
              : code === 451
                ? "地区限制"
                : code === 403
                  ? "拒绝或验证"
                  : code >= 200 && code < 400
                    ? "可达，解锁待确认"
                    : "不确定",
        };
      }),
  };
}
export function createBackend(
  origin: string,
  apiKey?: string,
  ipQualityKey?: string,
): Backend {
  const base = new URL(origin);
  if (!["http:", "https:"].includes(base.protocol))
    throw new Error("Invalid Komari origin");
  async function request(
    path: string,
    cookie: string,
    init: RequestInit = {},
    privileged = false,
  ) {
    const response = await fetch(new URL(path, base), {
      redirect: "error",
      ...init,
      signal: AbortSignal.timeout(20000),
      headers: {
        Accept: "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
        ...(privileged && apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        ...init.headers,
      },
    });
    if (!response.ok)
      throw new HttpError(
        response.status,
        `Komari 请求失败 (${response.status})`,
      );
    const r = (await response.json()) as Envelope;
    if (r.status === "error" || r.error)
      throw new HttpError(
        502,
        r.message ?? r.error?.message ?? "Komari 请求失败",
      );
    return r.data ?? r.result ?? r;
  }
  return {
    viewer: (cookie) => request("/api/me", cookie),
    nodes: (cookie) =>
      request("/api/rpc2", cookie, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "common:getNodes",
          params: {},
        }),
      }),
    run: async (node, kind, cookie) => {
      const submitted = await request(
        "/api/admin/task/exec",
        cookie,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            command: fixedCommands[kind],
            clients: [node],
          }),
        },
        true,
      );
      const task = submitted.task_id;
      if (typeof task !== "string")
        throw new HttpError(502, "任务接口未返回 task_id");
      const deadline = Date.now() + 150000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 1200));
        let result: any;
        try {
          result = await request(
            `/api/admin/task/${encodeURIComponent(task)}/result/${encodeURIComponent(node)}`,
            cookie,
            {},
            true,
          );
        } catch (e) {
          if (e instanceof HttpError && e.statusCode === 404) continue;
          throw e;
        }
        if (Array.isArray(result)) result = result[0];
        if (!result || typeof result !== "object") continue;
        if (result.exit_code === null || result.finished_at === null) continue;
        const output = result.result ?? result.output;
        if (typeof output !== "string") continue;
        if (output.length > 512000)
          throw new HttpError(502, "任务输出超过上限");
        if (result.exit_code && result.exit_code !== 0)
          throw new HttpError(502, `节点任务失败 (${result.exit_code})`);
        return kind === "unlock"
          ? parseProbe(output)
          : kind === "ip"
            ? await enrichQuality(parseIP(output), ipQualityKey)
            : output;
      }
      throw new HttpError(504, "等待节点返回超时");
    },
  };
}
