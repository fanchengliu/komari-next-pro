import { resolve } from "node:path";
import { buildExtension } from "./server";
import { createBackend } from "./komari";
import { createTranscoder } from "./transcode";
const app = await buildExtension({
  directory: resolve(process.env.DS_DATA_DIR ?? ".local/extension"),
  publicOrigin: process.env.DS_PUBLIC_ORIGIN ?? "http://127.0.0.1:5173",
  backend: createBackend(
    process.env.DS_KOMARI_ORIGIN ?? "http://127.0.0.1:25774",
    process.env.DS_KOMARI_API_KEY,
    process.env.DS_IPAPI_KEY,
  ),
  enableJobs: process.env.DS_ENABLE_JOBS === "true",
  transcoder: process.env.DS_FFMPEG
    ? createTranscoder(process.env.DS_FFMPEG)
    : undefined,
});
await app.listen({
  port: Number(process.env.DS_PORT ?? 5175),
  host: process.env.DS_BIND ?? "127.0.0.1",
});
process.stdout.write("komari-ds extension is ready\n");
for (const event of ["SIGINT", "SIGTERM"] as const)
  process.on(event, () => void app.close().then(() => process.exit(0)));
