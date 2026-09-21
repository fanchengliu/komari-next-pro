import { json, rest } from "./rpc";
import type { PublicInfo } from "../../../../packages/contracts";
export async function saveSiteSettings(value: unknown) {
  const result = await json<{ status: string; message?: string }>(
    "/api/admin/theme/settings?theme=komari-ds",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    },
  );
  if (result.status !== "success") throw Error(result.message ?? "保存失败");
}
export async function patchSiteSettings(patch: Record<string, unknown>) {
  const site = await rest<PublicInfo>("/api/public");
  if (site.theme !== "komari-ds") throw Error("主题状态已改变，请刷新后重试");
  await saveSiteSettings({ ...site.theme_settings, ...patch });
}
