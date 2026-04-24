# TROUBLESHOOTING.md

> **READ THIS FILE BEFORE CHANGING DEPLOYMENT SETTINGS.**

## 1. `Unexpected token '<'` / `"<!DOCTYPE ... is not valid JSON"`

Cause:
- frontend expected JSON
- but the path returned HTML

Usually means:
- `/unlock-probe/` is not reverse-proxied
- `/ip-meta/` is not reverse-proxied
- CDN or upstream rewrote the path to the frontend page

Fix:
- ensure `/unlock-probe/*` and `/ip-meta/*` return JSON, not HTML

---

## 2. `login_required`

Cause:
- unlock-probe is reachable
- but Komari login session is not recognized by the backend chain

Fixes that mattered in practice:
- add `proxy_set_header Cookie $http_cookie;`
- use site-domain auth chain (`https://your-domain`) instead of only `http://127.0.0.1:25774`

---

## 3. `502 Bad Gateway` / `recv() failed (104: Connection reset by peer)`

Cause encountered:
- unlock-probe listened on container-local `127.0.0.1`
- nginx upstream to `127.0.0.1:19116` failed from host side

Fix:

```env
HOST=0.0.0.0
```

Recreate the container afterwards.

---

## 4. `probe exited 1` with `Invalid credentials`

Cause:
- `.env` `KOMARI_USER` / `KOMARI_PASS` are wrong

Fix:
- set valid Komari credentials
- recreate unlock-probe container

---

## 5. `ECONNREFUSED 127.0.0.1:25774` from probe runner

Cause encountered:
- the runner executed inside Docker
- container-local `127.0.0.1` is not the host Komari process

Fix:
- use site-domain base for the runner, e.g.

```env
KOMARI_RUNNER_BASE=https://your-domain
```

---

## 6. IP info panel error: `The string did not match the expected pattern.`

Cause:
- IP info panel depends on `/ip-meta/*`
- if `/ip-meta/` is missing or returns HTML, frontend fails

Fix:
- deploy ip-meta backend
- add `/ip-meta/` reverse proxy
- verify `/ip-meta/ip-meta?ips=...` returns JSON
