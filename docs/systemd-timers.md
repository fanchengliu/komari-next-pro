# systemd timers reference

This project may use timers for scheduled batch probing.

Typical split:

- service unit: runs one batch probe execution
- timer unit: controls interval

Example ideas:

- `komari-unlock-probe-run-all.service`
- `komari-unlock-probe-run-all.timer`

Recommended considerations:

- keep batch execution serial if controller resources are limited
- store logs and last-run state on disk
- avoid frequent login-refresh loops against Komari
- prefer reading public configuration state where possible
