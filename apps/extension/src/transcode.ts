import { spawn } from "node:child_process";
export type Transcoder = (input: string, output: string) => Promise<void>;
export function createTranscoder(executable: string): Transcoder {
  return (input, output) =>
    new Promise((resolve, reject) => {
      const child = spawn(
        executable,
        [
          "-nostdin",
          "-hide_banner",
          "-loglevel",
          "error",
          "-protocol_whitelist",
          "file,pipe",
          "-i",
          input,
          "-map",
          "0:v:0",
          "-an",
          "-vf",
          "scale=w='min(1920,iw)':h=-2",
          "-c:v",
          "libx264",
          "-preset",
          "fast",
          "-crf",
          "24",
          "-pix_fmt",
          "yuv420p",
          "-movflags",
          "+faststart",
          "-threads",
          "2",
          "-n",
          output,
        ],
        { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] },
      );
      let stderr = "";
      const timer = setTimeout(() => child.kill("SIGKILL"), 300000);
      child.stderr.on("data", (chunk) => {
        stderr = (stderr + chunk.toString()).slice(-2000);
      });
      child.once("error", (e) => {
        clearTimeout(timer);
        reject(e);
      });
      child.once("exit", (code, signal) => {
        clearTimeout(timer);
        code === 0
          ? resolve()
          : reject(
              new Error(
                signal
                  ? "转码超时或被终止"
                  : `转码失败 (${code}): ${stderr.slice(-300)}`,
              ),
            );
      });
    });
}
