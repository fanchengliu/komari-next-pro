![Komari Next Pro](docs/brand/cover.png)

# Komari Next Pro

**Your nodes. Your network. One clear view.**

[简体中文](README.md) · [Releases](https://github.com/fanchengliu/komari-next-pro/releases) · [Installation](docs/INSTALL.md)

Komari Next Pro 3.0 is an independently implemented React/TypeScript rewrite of this project. Previous releases remain in Git history.

![Overview](docs/images/overview.png)

- Glass cards, compact inspection tables and mobile layouts.
- Interactive latency/loss history and comparable time windows across nodes.
- Up to four-node comparisons and a rotating globe with individual node selection.
- Asset reports, expiry timelines and automatically updated reference exchange rates.
- Card transparency, image/video backgrounds and a first-use configuration wizard.
- Simplified Chinese, Traditional Chinese, English, Japanese and Korean.

Download `komari-next-pro-3.0.0-theme.zip` from Releases, upload it in Komari's theme manager and select **Komari Next Pro**. GitHub's automatically generated source archive is not an installable theme.

The internal theme ID remains `komari-ds` to preserve existing DS settings. Core monitoring, charts, comparisons and the globe work without the optional companion service. Server-side media storage and manual node probes require the [extension](docs/EXTENSION.md). Compatibility baseline: Komari 1.5.0.

IP reference scores are documented heuristics, not reputation measurements or risk probabilities. HTTP reachability does not prove streaming unlock. Exchange rates are dated reference values, not live market ticks. Screenshots use synthetic data.

## Development

Use Node.js 24.15+ on the 24 or 26 release line.

```sh
npm ci --ignore-scripts
npm run demo
# another terminal
npm run dev
```

Visit `http://127.0.0.1:5173`; local demo credentials are `demo / demo`. Then run `npm test`, `npm run build`, and `npm run test:e2e`. On Linux/macOS, install Chromium with `npx playwright install chromium`; Windows uses Edge by default, or set `DS_BROWSER`. `npm run package` creates theme, source and extension ZIPs with SHA-256 checksums.

MIT-licensed code; upstream notices are retained. Third-party assets and geographic databases keep their own licenses. See [provenance](docs/PROVENANCE.md), [contributing](CONTRIBUTING.md), and [security](SECURITY.md).
