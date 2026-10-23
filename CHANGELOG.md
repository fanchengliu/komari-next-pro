# Changelog

## 3.0.2

- Move home-card monitoring scope and history duration into accessible hover descriptions; keep latency/loss charts and task selection unchanged.
- Replace large layout illustrations with compact choices grouped by desktop and mobile, explicit preview/apply states, and responsive live-node previews.
- Keep desktop and mobile draft choices independent so a previous mobile preview cannot accidentally redirect a desktop preference change.
- Add translations and browser coverage for scope explanations, device-specific persistence, keyboard controls and narrow screens.

## 3.0.1

- Add the repository icon/link beside the fixed Komari Next Pro footer.
- Add a bilingual VitePress documentation website with local search, appearance switch and mobile navigation.
- Separate website and theme builds, with explicit Vercel configuration and the legacy `theme/public` publishing path.
- Add acknowledgements to the project README.

## 3.0.0 — Komari Next Pro

Major independent rewrite of Komari Next Pro, using the independently implemented komari-ds 2.2.2 codebase.

- New orbit identity, original default media and public demo dataset.
- Complete source, installable theme and optional companion service packages.
- Interactive network history, comparisons, globe, reports and appearance presets.
- Transparent IP reference rules, card opacity controls and five languages.
- Stable globe markers, explicit IPv4/IPv6 probe diagnostics and partial-result states.
- Cross-platform development, browser tests and GitHub Actions packaging workflow.

Technical IDs remain compatible with komari-ds 2.x. See docs/MIGRATION.md before upgrading from Next Pro.
