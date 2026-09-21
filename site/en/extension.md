# Optional companion service

Core monitoring, charts, comparisons and the globe work directly with Komari. The companion adds server-side media storage, URL import, persistent playlists and explicit manual node tasks.

Use Node.js 24.15+ on the 24 or 26 release line. Download the extension ZIP, install dependencies with `npm ci --ignore-scripts`, and configure the service environment:

```ini
DS_KOMARI_ORIGIN=http://127.0.0.1:25774
DS_PUBLIC_ORIGIN=https://monitor.example.com
DS_DATA_DIR=/var/lib/komari-ds
DS_BIND=127.0.0.1
DS_PORT=5175
DS_ENABLE_JOBS=false
```

Run the supplied systemd or Docker example and proxy `/komari-ds-api/` to the service. For the full configuration and security boundaries, see the [repository guide](https://github.com/fanchengliu/komari-next-pro/blob/main/docs/EXTENSION.md).

Enable jobs only when wanted and when the corresponding Komari Agent permits execution. Tasks run fixed commands for a selected visible node; the page does not automatically run probes.

Reference IP scores use existing metadata and explicit rules without a provider key. They are not measured reputation. Actual provider metrics are displayed separately and require appropriate server-side configuration. Keep all API keys out of theme settings and source control.

Back up the service database and media before upgrading. Preserve the existing data directory and environment file.
