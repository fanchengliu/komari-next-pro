# Komari Next Pro Unlock Probe

This directory contains the optional backend module used by Komari Next Pro for stream unlock probing and node card configuration support.

## What it does

- runs probing workflows
- stores and serves cached latest results
- keeps IPv4 / IPv6 results separated
- provides endpoints for card field visibility configuration
- supports scheduled batch execution

## Deployment model

Recommended deployment approach:

- run the service near Komari on a trusted internal network
- keep `KOMARI_BASE` pointing to your local Komari instance, usually `http://127.0.0.1:25774`
- expose it behind a reverse proxy such as `/unlock-probe/`
- inject credentials through environment variables

## Environment variables

- `KOMARI_BASE` — Komari base URL
- `KOMARI_USER` — Komari admin username
- `KOMARI_PASS` — Komari admin password
- `PORT` — service port

## Start example

```bash
cd unlock-probe
PORT=19116 \
KOMARI_BASE=http://127.0.0.1:25774 \
KOMARI_USER=admin \
KOMARI_PASS=change-me \
node server.mjs
```

## Security notes

- Do not hardcode real production passwords.
- Do not expose privileged write endpoints without authentication.
- Prefer fixed-script execution over arbitrary command passthrough.
- Review public result masking behavior before internet exposure.
