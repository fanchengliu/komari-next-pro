# DEPLOY.md

> **IMPORTANT: READ THIS FILE BEFORE DEPLOYMENT.**
> 
> This project has **two different backend services**:
> 
> 1. `unlock-probe` → stream unlock testing and node-card field controls
> 2. `ip-meta` → IP information panel data (`/ip-meta/*`)
> 
> If you only deploy the theme, some panels will render but advanced features will fail.

## 1. Theme package

Use the release asset:

```text
komari-next-pro-v26.04.24-pingblocks-fix.zip
```

In Komari admin:

```text
Theme Management -> Upload Theme / Update Theme
```

Do **not** use GitHub source ZIP as a Komari theme package.

---

## 2. unlock-probe backend

### One-line install

```bash
curl -fsSL -o install-unlock-probe.sh https://raw.githubusercontent.com/fanchengliu/komari-next-pro/main/scripts/install-unlock-probe.sh
bash install-unlock-probe.sh
```

### Example with overrides

```bash
INSTALL_DIR=/opt/komari-next-pro-unlock-probe \
KOMARI_BASE=http://127.0.0.1:25774 \
KOMARI_USER=admin \
KOMARI_PASS='your-password' \
UNLOCK_PROBE_PORT=19116 \
bash install-unlock-probe.sh
```

### Required runtime values

```env
KOMARI_BASE=http://127.0.0.1:25774
KOMARI_USER=admin
KOMARI_PASS=your-real-komari-password
UNLOCK_PROBE_PORT=19116
KOMARI_SITE_BASE=https://your-domain
KOMARI_RUNNER_BASE=https://your-domain
HOST=0.0.0.0
```

---

## 3. ip-meta backend

The IP info panel uses `/ip-meta/*`, not unlock-probe.

It should provide:

```text
/ip-meta/healthz
/ip-meta/ip-meta?ips=1.1.1.1,2606:4700:4700::1111
```

Recommended local binding:

```text
127.0.0.1:25901
```

---

## 4. nginx reverse proxy

### unlock-probe

```nginx
location /unlock-probe/ {
    proxy_pass http://127.0.0.1:19116/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Port $server_port;
    proxy_set_header Cookie $http_cookie;
}
```

### ip-meta

```nginx
location /ip-meta/ {
    proxy_pass http://127.0.0.1:25901/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Then:

```bash
nginx -t
nginx -s reload
```

---

## 5. Verify after deployment

### unlock-probe

```bash
curl -k https://your-domain/unlock-probe/healthz
curl -k https://your-domain/unlock-probe/status
```

### ip-meta

```bash
curl -k https://your-domain/ip-meta/healthz
curl -k 'https://your-domain/ip-meta/ip-meta?ips=1.1.1.1,2606:4700:4700::1111'
```

Expected:
- HTTP 200
- `content-type: application/json`
- JSON body, not HTML
