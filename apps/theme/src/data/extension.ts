import { API } from "../../../../packages/contracts";
import { json } from "./rpc";
export async function extensionWrite<T>(
  path: string,
  method: string,
  body?: unknown,
) {
  const session = await json<{ csrf: string }>(`${API}/session`);
  return json<T>(`${API}${path}`, {
    method,
    headers: {
      "X-DS-CSRF": session.csrf,
      ...(body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
    },
    body:
      body instanceof FormData
        ? body
        : body === undefined
          ? undefined
          : JSON.stringify(body),
  });
}
export async function uploadMedia<T>(
  body: FormData,
  onProgress: (percent: number) => void,
) {
  const session = await json<{ csrf: string }>(`${API}/session`);
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", API + "/media");
    xhr.withCredentials = true;
    xhr.setRequestHeader("X-DS-CSRF", session.csrf);
    xhr.timeout = 180000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onerror = () => reject(new Error("上传连接失败"));
    xhr.ontimeout = () => reject(new Error("上传超时"));
    xhr.onload = () => {
      try {
        const r = JSON.parse(xhr.responseText);
        if (xhr.status < 200 || xhr.status >= 300)
          throw new Error(r.error || "上传失败");
        resolve(r);
      } catch (e) {
        reject(e);
      }
    };
    xhr.send(body);
  });
}
