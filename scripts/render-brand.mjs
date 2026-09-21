import { chromium } from "playwright";
import { readFile, writeFile, mkdir } from "node:fs/promises";
const browser = await chromium.launch({
  headless: true,
  ...(process.platform === "win32"
    ? {
        executablePath:
          process.env.DS_BROWSER ||
          "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      }
    : {}),
});
try {
  const page = await browser.newPage({
    viewport: { width: 160, height: 160 },
    deviceScaleFactor: 2,
  });
  const svg = await readFile("apps/theme/public/media/logo.svg", "utf8");
  await page.setContent(
    `<style>html,body{margin:0;width:160px;height:160px;background:transparent}svg{display:block;width:160px;height:160px}</style>${svg}`,
  );
  await page.screenshot({
    path: "apps/theme/public/media/logo.png",
    omitBackground: true,
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  const background =
    "data:image/png;base64," +
    (await readFile("apps/theme/public/media/background-poster.png")).toString(
      "base64",
    );
  await page.setContent(
    `<style>*{box-sizing:border-box}body{margin:0;background:#081422;color:#f0f8ff;font-family:Arial,sans-serif}.cover{position:relative;width:1280px;height:720px;padding:76px;background:linear-gradient(90deg,#061422b0,transparent),url('${background}') center/cover}.logo{width:70px;height:70px;margin-bottom:65px}.logo svg{width:70px;height:70px}small{color:#7fdbdf;font-size:14px;letter-spacing:4px}h1{font-size:74px;letter-spacing:-4px;margin:20px 0}p{font-size:22px;color:#a6c3d5;line-height:1.6;margin:0;max-width:520px}.bottom{position:absolute;bottom:58px;left:76px;display:flex;gap:14px;font-size:12px;letter-spacing:1px;color:#accad7}.bottom span{padding:11px 15px;border:1px solid #77c4dd44;border-radius:30px;background:#10324b88}</style><div class="cover"><div class="logo">${svg}</div><small>A GLASS THEME FOR KOMARI</small><h1>Komari Next Pro</h1><p>Your nodes.<br>Your network. One clear view.</p><div class="bottom"><span>GLOBAL GLOBE</span><span>NETWORK INSIGHTS</span><span>YOUR OWN STYLE</span></div></div>`,
  );
  await page.screenshot({ path: "docs/brand/cover.png" });
  // A tiny, original procedural loop keeps the built-in video option and video tests self-contained.
  const recorded = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 960;
    canvas.height = 540;
    const ctx = canvas.getContext("2d");
    const types = ["video/mp4;codecs=avc1.42001E", "video/mp4"];
    const mimeType = types.find((t) => MediaRecorder.isTypeSupported(t));
    if (!mimeType) throw Error("MP4 recorder unavailable");
    const chunks = [];
    const stream = canvas.captureStream(15),
      recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 500000,
      });
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    const done = new Promise((r) => (recorder.onstop = r));
    recorder.start();
    const start = performance.now();
    await new Promise((resolve) => {
      function frame() {
        const t = (performance.now() - start) / 4000;
        const bg = ctx.createLinearGradient(0, 0, 960, 540);
        bg.addColorStop(0, "#071525");
        bg.addColorStop(1, "#173855");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, 960, 540);
        for (let i = 0; i < 70; i++) {
          ctx.fillStyle = "rgba(136,205,227,.35)";
          ctx.fillRect((i * 173) % 960, (i * 97) % 540, 1.2, 1.2);
        }
        const orb = ctx.createRadialGradient(620, 180, 0, 710, 270, 210);
        orb.addColorStop(0, "#345c78");
        orb.addColorStop(0.6, "#1c3a55");
        orb.addColorStop(1, "#10273b");
        ctx.fillStyle = orb;
        ctx.beginPath();
        ctx.arc(710, 270, 176, 0, Math.PI * 2);
        ctx.fill();
        ctx.save();
        ctx.translate(710, 270);
        ctx.rotate(-0.45);
        ctx.strokeStyle = "#86d6e488";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(0, 0, 240, 65, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "#91ecdf";
        ctx.beginPath();
        ctx.arc(
          Math.cos(t * Math.PI * 2) * 240,
          Math.sin(t * Math.PI * 2) * 65,
          4,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.restore();
        if (t >= 1) {
          resolve();
          return;
        }
        requestAnimationFrame(frame);
      }
      frame();
    });
    recorder.stop();
    await done;
    stream.getTracks().forEach((t) => t.stop());
    return Array.from(
      new Uint8Array(await new Blob(chunks, { type: mimeType }).arrayBuffer()),
    );
  });
  await writeFile(
    "apps/theme/public/media/background.mp4",
    Buffer.from(recorded),
  );
  console.log(
    "Saved native SVG/PNG logo, 1280x720 cover, and original procedural MP4 loop.",
  );
} finally {
  await browser.close();
}
